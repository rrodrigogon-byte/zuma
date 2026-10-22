import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { criarProtecaoDados, postgresConfigurado, diaLocal, RETENCAO, cotaCopiasBytes } from './protecao-dados-kytto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const silencioso = { log() {}, warn() {}, error() {} };
const pastaTemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'protecao-'));

test('postgresConfigurado reconhece URL gerenciada ou o conjunto completo de variáveis', () => {
  assert.equal(postgresConfigurado({}), false);
  assert.equal(postgresConfigurado({ DATABASE_URL: 'postgres://x' }), true);
  assert.equal(postgresConfigurado({ DB_HOST: 'h', DB_USER: 'u', DB_PASSWORD: 'p' }), false);
  assert.equal(postgresConfigurado({ DB_HOST: 'h', DB_USER: 'u', DB_PASSWORD: 'p', DB_NAME: 'd' }), true);
});

test('sem PostgreSQL: instância é líder, mas a persistência fica degradada por não ter cópia externa', async () => {
  const protecao = criarProtecaoDados({ getPool: () => { throw new Error('não deve conectar'); }, caminhoBanco: () => '/inexistente.json', env: {}, log: silencioso });
  assert.equal(await protecao.disputarLideranca(), true);
  assert.equal(protecao.souLider(), true);
  const s = protecao.situacao();
  assert.equal(s.status, 'degradada');
  assert.deepEqual(s.problemas, ['sem_copia_externa']);
  assert.deepEqual(await protecao.criarCopia(), { ok: false, motivo: 'postgres_nao_configurado' });
});

test('falha de gravação local aparece no estado', () => {
  const protecao = criarProtecaoDados({ getPool: () => null, caminhoBanco: () => '/x.json', estadoGravacao: () => ({ ultimoErro: 'ENOSPC' }), env: {}, log: silencioso });
  assert.ok(protecao.situacao().problemas.includes('falha_gravacao_local'));
});

test('cópias locais diárias: comprimidas, mantém 7 dias e não toca em outros arquivos', async () => {
  const pasta = pastaTemp();
  const banco = path.join(pasta, 'db.json');
  fs.writeFileSync(banco, '{"seq":1}');
  const agora = Date.parse('2026-10-20T15:00:00Z');
  for (const dia of ['2026-10-01', '2026-10-12', '2026-10-13']) fs.writeFileSync(path.join(pasta, `db-${dia}.bak.json`), '{}');
  fs.writeFileSync(path.join(pasta, 'db-2026-10-11.bak.json.gz'), '');
  fs.writeFileSync(path.join(pasta, 'db-2026-10-19.bak.json.gz'), '');
  fs.writeFileSync(path.join(pasta, 'outro-2026-01-01.bak.json'), '{}');
  const protecao = criarProtecaoDados({ getPool: () => null, caminhoBanco: () => banco, env: {}, agora: () => agora, log: silencioso });
  const criada = await protecao.copiaLocalDiaria();
  assert.equal(criada, `db-${diaLocal(agora)}.bak.json.gz`);
  assert.equal(zlib.gunzipSync(fs.readFileSync(path.join(pasta, criada))).toString(), '{"seq":1}');
  const restantes = fs.readdirSync(pasta).sort();
  for (const removido of ['db-2026-10-01.bak.json', 'db-2026-10-12.bak.json', 'db-2026-10-11.bak.json.gz']) assert.ok(!restantes.includes(removido), removido);
  for (const mantido of ['db-2026-10-13.bak.json', 'db-2026-10-19.bak.json.gz', 'outro-2026-01-01.bak.json']) assert.ok(restantes.includes(mantido), mantido);
});

test('cota de espaço das cópias vem do ambiente, com padrão de 300 MB', () => {
  assert.equal(cotaCopiasBytes({}), 300 * 1024 * 1024);
  assert.equal(cotaCopiasBytes({ PROTECAO_COPIAS_MAX_MB: '50' }), 50 * 1024 * 1024);
  assert.equal(cotaCopiasBytes({ PROTECAO_COPIAS_MAX_MB: 'x' }), 300 * 1024 * 1024);
});

test('rotinaDoLider não executa em instância que não é líder', async () => {
  let execucoes = 0;
  const pool = { connect: async () => ({ query: async () => ({ rows: [{ ok: false }] }), release() {}, on() {} }) };
  const protecao = criarProtecaoDados({ getPool: () => pool, caminhoBanco: () => '/x.json', env: { DATABASE_URL: 'postgres://x' }, log: silencioso });
  assert.equal(await protecao.disputarLideranca(), false);
  const timer = protecao.rotinaDoLider('teste', 5, () => { execucoes += 1; }, { imediata: true });
  await new Promise((r) => setTimeout(r, 30));
  clearInterval(timer);
  assert.equal(execucoes, 0);
  assert.ok(protecao.situacao().problemas.includes('outra_instancia_ativa'));
});

test('cópia externa valida JSON grande sem manter descompressão inteira em memória', async () => {
  const pasta = pastaTemp();
  const banco = path.join(pasta, 'db.json');
  fs.writeFileSync(banco, JSON.stringify({ seq: 7, ruido: 'x'.repeat(1024 * 1024) }));
  const registros = new Map();
  let proximoId = 1;
  const pool = {
    connect: async () => ({ query: async () => ({ rows: [{ ok: true }] }), release() {}, on() {} }),
    query: async (sql, values = []) => {
      if (sql.includes('INSERT INTO kytto_json_snapshots')) {
        const id = String(proximoId++);
        registros.set(id, { id, conteudo: values[6], bytesGzip: values[3], sha256: values[4], criado_em: new Date().toISOString(), verificado_em: null, tipo: values[0] });
        return { rows: [{ id, criado_em: registros.get(id).criado_em }] };
      }
      if (sql.includes('SELECT conteudo FROM kytto_json_snapshots')) return { rows: [{ conteudo: registros.get(String(values[0])).conteudo }] };
      if (sql.includes('UPDATE kytto_json_snapshots SET verificado_em')) { registros.get(String(values[0])).verificado_em = new Date().toISOString(); return { rows: [] }; }
      if (sql.includes('DELETE FROM kytto_json_snapshots WHERE verificado_em')) return { rows: [] };
      if (sql.includes('SELECT id, bytes_gzip FROM kytto_json_snapshots')) return { rows: [...registros.values()] };
      if (sql.includes('SELECT id FROM kytto_json_snapshots')) return { rows: [{ id: [...registros.keys()].at(-1) }] };
      if (sql.includes('DELETE FROM kytto_json_snapshots WHERE id = ANY')) return { rows: [] };
      throw new Error(`consulta inesperada no mock: ${sql}`);
    },
  };
  const protecao = criarProtecaoDados({ getPool: () => pool, caminhoBanco: () => banco, env: { DATABASE_URL: 'postgres://x' }, log: silencioso });
  assert.equal(await protecao.disputarLideranca(), true);
  const copia = await protecao.criarCopia({ tipo: 'manual', forcar: true });
  assert.equal(copia.verificada, true);
  assert.equal(registros.get(copia.id).verificado_em !== null, true);
  assert.equal(zlib.gunzipSync(registros.get(copia.id).conteudo).toString(), fs.readFileSync(banco, 'utf8'));
  assert.equal(fs.readdirSync(os.tmpdir()).some((nome) => nome.startsWith(`kytto-snapshot-${process.pid}-`)), false);
  await protecao.encerrar();
});

test('db.js grava JSON compacto, mede a gravação e recupera do .bak se o principal sumir', () => {
  const pasta = pastaTemp();
  const banco = path.join(pasta, 'db.json');
  const script = `
    import('${path.join(__dirname, 'db.js').replace(/\\/g, '/')}').then((m) => {
      m.db().teste = { a: 1 }; m.save(); m.save();
      const e = m.estadoGravacao();
      console.log(JSON.stringify({ gravacoes: e.gravacoes, tamanho: e.tamanhoBytes, erro: e.ultimoErro }));
    });`;
  const saida = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, DB_PATH: banco }, encoding: 'utf8' }).trim().split('\n').pop());
  assert.ok(saida.gravacoes >= 2);
  assert.equal(saida.erro, null);
  const texto = fs.readFileSync(banco, 'utf8');
  assert.ok(!texto.includes('\n'), 'JSON deve ser compacto');
  assert.equal(JSON.parse(texto).teste.a, 1);
  assert.ok(fs.existsSync(banco + '.bak'));
  // Processo interrompido entre gravações: principal ausente, .bak presente.
  fs.renameSync(banco, banco + '.perdido');
  const leitura = `import('${path.join(__dirname, 'db.js').replace(/\\/g, '/')}').then((m) => console.log(JSON.stringify(m.db().teste || null)));`;
  const recuperado = execFileSync(process.execPath, ['--input-type=module', '-e', leitura], { env: { ...process.env, DB_PATH: banco }, encoding: 'utf8' }).trim().split('\n').pop();
  assert.equal(recuperado, '{"a":1}');
});

// ── Integração com PostgreSQL real ─────────────────────────────────────────
const URL_TESTE = process.env.PROTECAO_DADOS_TEST_DATABASE_URL || '';
const opcoesPg = { skip: URL_TESTE ? false : 'defina PROTECAO_DADOS_TEST_DATABASE_URL para rodar' };

async function prepararBanco() {
  const pool = new pg.Pool({ connectionString: URL_TESTE, max: 6 });
  await pool.query('DROP TABLE IF EXISTS kytto_json_snapshots');
  await pool.query(fs.readFileSync(path.join(__dirname, 'migrations', '060_kytto_json_snapshots.sql'), 'utf8'));
  return pool;
}

test('PostgreSQL: cópia conferida, cópia pulada sem mudança, diária por dia e retenção', opcoesPg, async () => {
  const pool = await prepararBanco();
  const pasta = pastaTemp();
  const banco = path.join(pasta, 'db.json');
  fs.writeFileSync(banco, JSON.stringify({ seq: 1, barbearias: { x: { agendamentos: [{ id: 1 }] } } }));
  let agora = Date.parse('2026-10-20T12:00:00Z');
  const protecao = criarProtecaoDados({ getPool: () => pool, caminhoBanco: () => banco, env: { DATABASE_URL: URL_TESTE }, agora: () => agora, log: silencioso });
  try {
    const primeira = await protecao.ciclo();
    assert.equal(primeira.ok, true);
    assert.equal(primeira.tipo, 'diario');
    assert.equal(primeira.verificada, true);
    const segunda = await protecao.ciclo();
    assert.equal(segunda.pulada, true, 'sem mudança no arquivo, a cópia de hora em hora é pulada');
    fs.writeFileSync(banco, JSON.stringify({ seq: 2 }));
    const terceira = await protecao.ciclo();
    assert.equal(terceira.tipo, 'horario');
    const restaurado = await protecao.lerCopia(terceira.id);
    assert.deepEqual(JSON.parse(restaurado.toString('utf8')), { seq: 2 });
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM kytto_json_snapshots WHERE verificado_em IS NULL');
    assert.equal(rows[0].n, 0, 'toda cópia guardada foi conferida');
    // Retenção das cópias de hora em hora.
    for (let i = 0; i < RETENCAO.horario + 5; i += 1) {
      fs.writeFileSync(banco, JSON.stringify({ seq: 100 + i }));
      agora += 1000;
      await protecao.criarCopia({ tipo: 'horario' });
    }
    const horario = await pool.query("SELECT count(*)::int AS n FROM kytto_json_snapshots WHERE tipo = 'horario'");
    assert.equal(horario.rows[0].n, RETENCAO.horario);
    assert.equal(protecao.situacao().status, 'ok');
    const lista = await protecao.listarCopias({ limite: 3 });
    assert.equal(lista.length, 3);
    assert.equal(lista[0].sha256.length, 12, 'lista não expõe o hash completo nem o conteúdo');
    assert.equal('conteudo' in lista[0], false);
  } finally {
    await protecao.encerrar();
    await pool.end();
  }
});

test('PostgreSQL: cota de espaço remove as mais antigas e preserva a mais recente', opcoesPg, async () => {
  const pool = await prepararBanco();
  const pasta = pastaTemp();
  const banco = path.join(pasta, 'db.json');
  let agora = Date.parse('2026-10-20T12:00:00Z');
  const protecao = criarProtecaoDados({ getPool: () => pool, caminhoBanco: () => banco, env: { DATABASE_URL: URL_TESTE, PROTECAO_COPIAS_MAX_MB: '1' }, agora: () => agora, log: silencioso });
  try {
    await protecao.disputarLideranca();
    let ultima = null;
    for (let i = 0; i < 10; i += 1) {
      // ~180 KB pouco compressíveis por cópia: 10 cópias passam de 1 MB.
      fs.writeFileSync(banco, JSON.stringify({ seq: i, ruido: crypto.randomBytes(135000).toString('base64') }));
      agora += 1000;
      ultima = await protecao.criarCopia({ tipo: 'horario' });
    }
    const { rows } = await pool.query('SELECT COALESCE(sum(bytes_gzip),0)::bigint AS total, max(id)::text AS ultimo, count(*)::int AS n FROM kytto_json_snapshots');
    assert.ok(Number(rows[0].total) <= 1024 * 1024, `total ${rows[0].total} acima da cota`);
    assert.equal(rows[0].ultimo, ultima.id);
    assert.ok(rows[0].n < 10 && rows[0].n >= 3);
  } finally {
    await protecao.encerrar();
    await pool.end();
  }
});

test('PostgreSQL: cópia adulterada é recusada na leitura', opcoesPg, async () => {
  const pool = await prepararBanco();
  const pasta = pastaTemp();
  const banco = path.join(pasta, 'db.json');
  fs.writeFileSync(banco, '{"seq":7}');
  const protecao = criarProtecaoDados({ getPool: () => pool, caminhoBanco: () => banco, env: { DATABASE_URL: URL_TESTE }, log: silencioso });
  try {
    await protecao.disputarLideranca();
    const copia = await protecao.criarCopia({ tipo: 'manual', forcar: true });
    await pool.query("UPDATE kytto_json_snapshots SET sha256 = repeat('0', 64) WHERE id = $1", [copia.id]);
    await assert.rejects(() => protecao.lerCopia(copia.id), /hash não confere/);
  } finally {
    await protecao.encerrar();
    await pool.end();
  }
});

test('PostgreSQL: só uma instância é líder; ao sair, a outra assume', opcoesPg, async () => {
  const pool = await prepararBanco();
  const env = { DATABASE_URL: URL_TESTE };
  const a = criarProtecaoDados({ getPool: () => pool, caminhoBanco: () => '/x.json', env, log: silencioso });
  const b = criarProtecaoDados({ getPool: () => pool, caminhoBanco: () => '/x.json', env, log: silencioso });
  try {
    assert.equal(await a.disputarLideranca(), true);
    assert.equal(await b.disputarLideranca(), false);
    assert.deepEqual(await b.criarCopia({ tipo: 'manual' }), { ok: false, motivo: 'instancia_nao_lider' });
    await a.encerrar();
    assert.equal(await b.disputarLideranca(), true);
  } finally {
    await a.encerrar();
    await b.encerrar();
    await pool.end();
  }
});
