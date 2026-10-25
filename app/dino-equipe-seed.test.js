import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { provisionarEquipeDino, PROFISSIONAIS_DINO_OFICIAIS, DINO_EMPRESA_CANONICA } from './dino-equipe-seed.js';
import { db } from './db.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';
import { profissionalDoUsuario } from './dino-modo-barbeiro.js';

test('dino-equipe-seed: provisiona 8 profissionais da Dino no ERP e cria credenciais de login', () => {
  const resultado = provisionarEquipeDino();
  assert.equal(resultado.ok, true);
  assert.equal(resultado.totalMembros, 8);

  const profs = barbeariaErpKytto.listarProfissionais(DINO_EMPRESA_CANONICA);
  assert.ok(profs.length >= 8, 'Deve ter pelo menos 8 profissionais cadastrados');

  const usuarios = db().usuarios;

  for (const membro of PROFISSIONAIS_DINO_OFICIAIS) {
    // 1. Verifica se existe no ERP
    const noErp = profs.find(
      (p) => p.email.toLowerCase() === membro.email.toLowerCase() || p.nome.toLowerCase() === membro.nome.toLowerCase()
    );
    assert.ok(noErp, `Profissional ${membro.nome} deve constar no ERP`);
    assert.equal(noErp.ativo, true);

    // 2. Verifica se usuário foi criado
    const u = usuarios.find((user) => user.email.toLowerCase() === membro.email.toLowerCase());
    assert.ok(u, `Usuário ${membro.email} deve existir em db().usuarios`);
    assert.equal(u.ativo, true);

    // 3. Testa senha
    const senhaOk = bcrypt.compareSync(membro.senhaPadrao, u.senhaHash);
    assert.ok(senhaOk, `Senha padrão do ${membro.nome} deve ser válida`);

    // 4. Testa vínculo com profissionalDoUsuario
    const vinculado = profissionalDoUsuario(profs, u);
    assert.ok(vinculado, `Usuário ${u.email} deve vincular com o profissional do ERP`);
  }
});
