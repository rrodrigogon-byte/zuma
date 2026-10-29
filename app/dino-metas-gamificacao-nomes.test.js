import assert from 'node:assert/strict';
import test from 'node:test';
import * as barbearia from './barbearia-erp-kytto.js';
import { apurarDesempenhoEquipe } from './dino-metas-gamificacao.js';

// Regressão: o apelido de exibição (Nati, Ester, Dino…) não pode renomear o cadastro.
test('apurar metas não renomeia os profissionais gravados', () => {
  const empresa = `emp-teste-nomes-${Date.now()}`;
  const criado = barbearia.criarProfissional(empresa, { nome: `Natani Teste ${Date.now()}`, ativo: true, percentualComissao: 45 });
  apurarDesempenhoEquipe(empresa, { dataIso: '2026-10-29' });
  const gravado = barbearia.listarProfissionais(empresa, { incluirInativos: true }).find((item) => item.id === criado.id);
  assert.equal(gravado.nome, criado.nome);
});
