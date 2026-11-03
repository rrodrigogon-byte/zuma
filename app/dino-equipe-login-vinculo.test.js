import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';
import { provisionarEquipeDino, DINO_EMPRESA_CANONICA, PROFISSIONAIS_DINO_OFICIAIS } from './dino-equipe-seed.js';
import { profissionalDoUsuario, painelBarbeiro } from './dino-modo-barbeiro.js';

test('todos os profissionais da Dino Barbeira conseguem logar com 123456 e vincular ao seu perfil', async () => {
  // 1. Executa o provisionamento
  provisionarEquipeDino();

  const profs = barbeariaErpKytto.listarProfissionais(DINO_EMPRESA_CANONICA, { incluirInativos: false });
  assert.ok(profs.length >= 8, `Esperava ao menos 8 profissionais ativos, obteve ${profs.length}`);

  // 2. Testa variações de login para cada membro
  const casosDeTeste = [
    { login: 'dino', esperado: 'dino@barbeariadino.com.br' },
    { login: 'Dino', esperado: 'dino@barbeariadino.com.br' },
    { login: 'guilherme', esperado: 'dino@barbeariadino.com.br' },
    { login: 'bruno', esperado: 'bruno@barbeariadino.com.br' },
    { login: 'Bruno', esperado: 'bruno@barbeariadino.com.br' },
    { login: 'david', esperado: 'david@barbeariadino.com.br' },
    { login: 'David', esperado: 'david@barbeariadino.com.br' },
    { login: 'natani', esperado: 'natani@barbeariadino.com.br' },
    { login: 'Natani', esperado: 'natani@barbeariadino.com.br' },
    { login: 'nati', esperado: 'nati@barbeariadino.com.br' },
    { login: 'Nati', esperado: 'nati@barbeariadino.com.br' },
    { login: 'ester', esperado: 'ester@barbeariadino.com.br' },
    { login: 'Ester', esperado: 'ester@barbeariadino.com.br' },
    { login: 'joao', esperado: 'joao@barbeariadino.com.br' },
    { login: 'João', esperado: 'joao@barbeariadino.com.br' },
    { login: 'amanda', esperado: 'amanda@barbeariadino.com.br' },
    { login: 'Amanda', esperado: 'amanda@barbeariadino.com.br' },
    { login: 'jhenyffer', esperado: 'jhenyffer@barbeariadino.com.br' },
    { login: 'Jhenyffer', esperado: 'jhenyffer@barbeariadino.com.br' },
  ];

  const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const findUserMock = (login) => {
    const n = norm(login);
    if (!n) return null;
    const lista = db().usuarios || [];
    let alias = n;
    if (['natani', 'nati', 'naty', 'natani minanis', 'natani dobler'].includes(n)) alias = 'natani';
    else if (['bruno', 'bruno mendes'].includes(n)) alias = 'bruno';
    else if (['david', 'david kaua', 'david kauã'].includes(n)) alias = 'david';
    else if (['dino', 'guilherme', 'gui', 'guicunha'].includes(n)) alias = 'dino';
    else if (['joao', 'joão', 'ruedel'].includes(n)) alias = 'joao';
    else if (['ester', 'steffany', 'steffany marielly'].includes(n)) alias = 'ester';
    else if (['amanda', 'amanda gabrielly'].includes(n)) alias = 'amanda';
    else if (['jhenyffer', 'jhenyfer', 'jhennyfer'].includes(n)) alias = 'jhenyffer';

    const porLogin = lista.find(u =>
      norm(u.email) === n ||
      norm(u.email) === `${alias}@barbeariadino.com.br` ||
      (alias === 'natani' && norm(u.email) === 'nati@barbeariadino.com.br') ||
      norm(u.username) === n ||
      norm(u.username) === alias ||
      (alias === 'natani' && norm(u.username) === 'nati') ||
      (u.email && (norm(u.email.split('@')[0]) === n || norm(u.email.split('@')[0]) === alias))
    );
    if (porLogin) return porLogin;
    return lista.find(u =>
      (u.apelido && (norm(u.apelido) === n || norm(u.apelido) === alias)) ||
      (u.nome && (norm(u.nome.split(' ')[0]) === n || norm(u.nome.split(' ')[0]) === alias)) ||
      norm(u.nome) === n
    ) || null;
  };

  for (const c of casosDeTeste) {
    const u = findUserMock(c.login);
    assert.ok(u, `Usuário não encontrado para login: ${c.login}`);
    
    // Senha padrão 123456 confere
    const senhaOk = await bcrypt.compare('123456', u.senhaHash);
    assert.ok(senhaOk, `Senha 123456 não confere para ${c.login}`);

    // Vínculo profissional
    if (u.role === 'profissional' || u.role === 'organizador') {
      const vinculado = profissionalDoUsuario(profs, u);
      assert.ok(vinculado, `Profissional não foi vinculado para o usuário ${u.username} (${u.nome})`);

      // Painel barbeiro
      const painel = painelBarbeiro(barbeariaErpKytto, {
        empresaId: DINO_EMPRESA_CANONICA,
        usuario: u,
        data: '2026-11-03'
      });
      assert.ok(painel.vinculado, `painel.vinculado deve ser true para ${u.username}`);
      assert.ok(painel.profissional, `painel.profissional deve existir para ${u.username}`);
    }
  }
});
