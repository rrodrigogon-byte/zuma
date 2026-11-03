import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import bcrypt from 'bcryptjs';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function aguardarServidor(base, processo) {
  const inicio = Date.now();
  while (Date.now() - inicio < 12000) {
    if (processo.exitCode !== null) throw new Error(`server.js encerrou antes do healthcheck: ${processo.exitCode}`);
    try {
      const { response } = await request(base, '/api/info');
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Tempo excedido aguardando server.js iniciar.');
}

test('fluxo completo de troca de senha no aplicativo do barbeiro (/barbeiro)', async () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'barbeiro-troca-senha-'));
  const dbPath = path.join(diretorio, 'db.json');
  const senhaInicial = '123456';
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const lojaId = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';

  fs.writeFileSync(dbPath, JSON.stringify({
    seq: 10,
    usuarios: [
      {
        id: 'usr-teste-bruno',
        nome: 'Bruno Mendes Teste',
        username: 'bruno',
        email: 'bruno@barbeariadino.com.br',
        senhaHash: bcrypt.hashSync(senhaInicial, 6),
        role: 'profissional',
        ativo: true,
        empresaId,
        lojaId,
      }
    ],
    barbearias: {
      [empresaId]: {
        configuracao: {
          slugPublico: 'dino',
          nomePublico: 'Barbearia Dino',
          profissionais: [
            { id: 'prof-bruno-01', nome: 'Bruno Mendes Teste', email: 'bruno@barbeariadino.com.br', ativo: true }
          ]
        }
      }
    }
  }));

  const porta = 38000 + Math.floor(Math.random() * 2000);
  const processo = spawn(process.execPath, [path.join(ROOT, 'app', 'server.js')], {
    cwd: path.join(ROOT, 'app'),
    env: {
      ...process.env,
      PORT: String(porta),
      DB_PATH: dbPath,
      JWT_SECRET: 'test-secret-troca-senha-jwt',
      COMMERCE_CORE_ENABLED: '0',
    },
    stdio: 'pipe',
  });

  const base = `http://127.0.0.1:${porta}`;

  try {
    await aguardarServidor(base, processo);

    // 1. Login inicial com a senha padrão (123456)
    const loginRes = await request(base, '/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ user: 'bruno', senha: senhaInicial }),
    });
    assert.equal(loginRes.response.status, 200, 'Login inicial deve retornar 200');
    assert.ok(loginRes.body.token, 'Deve retornar token de autenticação');
    const tokenInicial = loginRes.body.token;

    // 2. Tentativa com senha atual incorreta
    const errSenhaAtual = await request(base, '/api/admin/barbearia/modo-barbeiro/trocar-senha', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenInicial}` },
      body: JSON.stringify({
        senhaAtual: 'senha-errada-999',
        senhaNova: 'NovaSenha@2026',
        confirmarSenha: 'NovaSenha@2026',
      }),
    });
    assert.equal(errSenhaAtual.response.status, 401, 'Senha atual errada deve retornar 401');
    assert.match(errSenhaAtual.body.error, /senha atual digitada está incorreta/i);

    // 3. Tentativa com nova senha curta (< 6 caracteres)
    const errCurta = await request(base, '/api/admin/barbearia/modo-barbeiro/trocar-senha', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenInicial}` },
      body: JSON.stringify({
        senhaAtual: senhaInicial,
        senhaNova: '123',
        confirmarSenha: '123',
      }),
    });
    assert.equal(errCurta.response.status, 400, 'Nova senha curta deve retornar 400');
    assert.match(errCurta.body.error, /mínimo 6 caracteres/i);

    // 4. Tentativa com confirmação divergente
    const errDivergente = await request(base, '/api/admin/barbearia/modo-barbeiro/trocar-senha', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenInicial}` },
      body: JSON.stringify({
        senhaAtual: senhaInicial,
        senhaNova: 'NovaSenha@2026',
        confirmarSenha: 'OutraCoisaDiferente',
      }),
    });
    assert.equal(errDivergente.response.status, 400, 'Confirmação divergente deve retornar 400');
    assert.match(errDivergente.body.error, /confirmação da nova senha não confere/i);

    // 5. Tentativa com nova senha idêntica à senha atual
    const errIdentica = await request(base, '/api/admin/barbearia/modo-barbeiro/trocar-senha', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenInicial}` },
      body: JSON.stringify({
        senhaAtual: senhaInicial,
        senhaNova: senhaInicial,
        confirmarSenha: senhaInicial,
      }),
    });
    assert.equal(errIdentica.response.status, 400, 'Senha idêntica deve retornar 400');
    assert.match(errIdentica.body.error, /deve ser diferente da senha atual/i);

    // 6. Troca de senha com sucesso
    const novaSenhaValida = 'BrunoSegura#2026!';
    const okRes = await request(base, '/api/admin/barbearia/modo-barbeiro/trocar-senha', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenInicial}` },
      body: JSON.stringify({
        senhaAtual: senhaInicial,
        senhaNova: novaSenhaValida,
        confirmarSenha: novaSenhaValida,
      }),
    });
    assert.equal(okRes.response.status, 200, 'Troca com sucesso deve retornar 200');
    assert.equal(okRes.body.ok, true);
    assert.ok(okRes.body.token, 'Deve retornar novo token atualizado');
    assert.match(okRes.body.mensagem, /alterada com sucesso/i);

    // 7. Teste de login com a senha antiga (deve falhar)
    const loginAntiga = await request(base, '/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ user: 'bruno', senha: senhaInicial }),
    });
    assert.equal(loginAntiga.response.status, 401, 'Login com senha antiga deve falhar com 401');

    // 8. Teste de login com a nova senha (deve suceder)
    const loginNova = await request(base, '/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ user: 'bruno', senha: novaSenhaValida }),
    });
    assert.equal(loginNova.response.status, 200, 'Login com a nova senha deve suceder');
    assert.equal(loginNova.body.user.email, 'bruno@barbeariadino.com.br');

  } finally {
    processo.kill('SIGKILL');
    fs.rmSync(diretorio, { recursive: true, force: true });
  }
});
