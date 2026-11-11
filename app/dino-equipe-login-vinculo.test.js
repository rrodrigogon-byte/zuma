import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from './db.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';
import { provisionarEquipeDino, DINO_EMPRESA_CANONICA, DINO_LOJA_CANONICA, PROFISSIONAIS_DINO_OFICIAIS } from './dino-equipe-seed.js';
import { profissionalDoUsuario, painelBarbeiro } from './dino-modo-barbeiro.js';

test('a equipe oficial ativa da Dino tem contas da mesma empresa vinculadas ao próprio perfil', () => {
  assert.equal(provisionarEquipeDino().totalMembros, PROFISSIONAIS_DINO_OFICIAIS.length);
  const profissionais = barbeariaErpKytto.listarProfissionais(DINO_EMPRESA_CANONICA);
  for (const membro of PROFISSIONAIS_DINO_OFICIAIS) {
    const usuario = db().usuarios.find(u => u.email === membro.email);
    assert.ok(usuario?.ativo);
    assert.equal(usuario.empresaId, DINO_EMPRESA_CANONICA);
    assert.equal(usuario.lojaId, DINO_LOJA_CANONICA);
    const correspondentes = profissionais.filter(profissional => profissional.nome === membro.nome);
    assert.equal(correspondentes.length, 1, `um perfil ativo por membro oficial (${membro.username})`);
    assert.equal(profissionalDoUsuario(profissionais, usuario)?.id, correspondentes[0].id);
    const painel = painelBarbeiro(barbeariaErpKytto, {
      empresaId: DINO_EMPRESA_CANONICA,
      lojaId: DINO_LOJA_CANONICA,
      usuario,
      data: '2026-11-03',
    });
    assert.equal(painel.vinculado, true);
    assert.equal(painel.profissional?.id, correspondentes[0].id);
  }
});
