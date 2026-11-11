// Suítes reais do ERP em PostgreSQL descartável: não lê DSNs nem credenciais remotas.
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { localPostgresFixture } from '../app/tests/local-postgres-fixture.js';
import { runCommerceSchemaMigrations } from '../app/migrations/run-commerce-schema-migrations.js';
const suites = ['unidades', 'a2', 'bar-a1', 'razao', 'razao-rotas', 'suprimentos', 'conciliacao', 'salao', 'pdv-offline', 'varejo', 'fiscal', 'fiscal-completo'];
// As suítes fiscais exigem validação real do XSD; não ignorar testes sem o binário.
if (spawnSync('xmllint', ['--version'], { stdio: 'ignore' }).status !== 0) throw new Error('Instale o validador XML xmllint (libxml2-utils no Ubuntu) para executar a matriz completa.');
const fixture = await localPostgresFixture();
try {
  const client = await fixture.connect();
  const { user, host, port, database } = client.connectionParameters;
  const url = new URL(`postgresql://${user}@localhost:${port}/${database}`);
  url.searchParams.set('host', host);
  const env = Object.fromEntries(['PATH', 'HOME', 'LANG', 'TZ'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  const run = async (args, localEnv) => {
    const child = spawn(process.execPath, args, { cwd: new URL('..', import.meta.url), env: { ...env, NODE_ENV: 'test', DB_PATH: `${host}/fixture-db.json`, ...localEnv }, stdio: 'inherit' });
    const [code] = await once(child, 'exit');
    if (code !== 0) throw new Error('Validação local do ERP falhou; consulte o resultado dos testes.');
  };
  await run(['--test', '--test-concurrency=1', ...suites.map(name => `app/core/${name}.pg.test.js`)], { CLUBE_PG_TEST_URL: url.href });
  if (process.argv.includes('--e2e')) {
    const db = { acquireClient: async () => client, releaseClient() {} };
    await runCommerceSchemaMigrations({ db, through: '116_supermercado_fase7_auditoria_fraude_tabloide_trade.sql' });
    // As migrações históricas seguintes pressupõem as empresas, unidades e a holding existentes.
    // Reproduz apenas esses vínculos na instância descartável, sem copiar cadastros de produção.
    const empresas = [
      ['d0d0ac01-8e50-4b61-8c79-de4aaa916da6', 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8', '00111111000100'],
      ['31f70c83-9172-40c2-945f-9e793b5048be', '6a15e943-2570-4f29-a2d5-d900d2812911', '00222222000100'],
      ['2e041110-db20-4fd1-8278-12bd3dead008', '17b057ab-a13f-4fee-ae42-bc70578ec756', '00333333000100'],
    ];
    for (const [indice, [empresa, loja, cnpj]] of empresas.entries()) {
      const nome = `Empresa fixture ${indice + 1}`;
      await client.query('INSERT INTO empresas (id, nome, razao_social, cnpj) VALUES ($1, $2, $2, $3)', [empresa, nome, cnpj]);
      await client.query('INSERT INTO lojas (id, empresa_id, codigo, nome) VALUES ($1, $2, $3, $4)', [loja, empresa, `fixture-${indice + 1}`, 'Unidade fixture']);
    }
    await client.query(`INSERT INTO grupos_empresariais (id, nome, slug)
      VALUES ('1bf95920-76a8-4241-961e-c7a45c8c38ae', 'Holding fixture', 'holding-fixture')`);
    await runCommerceSchemaMigrations({ db });
    await run(['--test', 'app/core/commerce-operational-invites.pg.test.js'], { COMMERCE_OPERATIONAL_INVITE_TEST_DATABASE_URL: url.href });
    await run(['--test', 'app/core/account-password-reset.pg.test.js'], { PASSWORD_RESET_TEST_DATABASE_URL: url.href });
    await run(['--test', 'app/backoffice-ondas.e2e.pg.test.js'], { BACKOFFICE_E2E_DATABASE_URL: url.href });
    // Volume de dezenas de conversas por segundo só na fixture; não altera limites de produção.
    if(process.argv.includes('--ai')) await run(['--test','app/core/whatsapp-ai-cenarios.pg.test.js'],{WHATSAPP_SIM_PG_URL:url.href,WHATSAPP_AI_CHANNEL_HOURLY_LIMIT:'5000',WHATSAPP_AI_WEBHOOK_EVENTS_PER_MINUTE:'1000'});
  }
} finally { await fixture.close(); }
