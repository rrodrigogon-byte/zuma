import test from 'node:test';
import assert from 'node:assert/strict';
import * as dinoGamif from './dino-metas-gamificacao.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';

test('Contabilização de múltiplos serviços extras e quantidades em comandas para metas e roleta', async () => {
  const empresaId = 'emp_teste_multiplos_extras_' + Date.now();
  const lojaId = 'loja_teste';
  const hoje = dinoGamif.dataIsoCuiaba();

  // Cadastra profissional
  const prof = barbeariaErpKytto.criarProfissional(empresaId, {
    nome: 'Natani Teste',
    apelido: 'Nati',
    email: 'nati.teste@barbeariadino.com.br',
    ativo: true,
  });

  // Cadastra serviços
  const srvCorte = barbeariaErpKytto.criarServico(empresaId, {
    nome: 'Corte Premium',
    preco: 100,
    categoria: 'Cabelo',
    ativo: true,
  });

  const srvLimpeza = barbeariaErpKytto.criarServico(empresaId, {
    nome: 'Limpeza de Pele',
    preco: 60,
    categoria: 'Estética Facial',
    ativo: true,
  });

  // Configura meta de 6 extras para 1 giro
  dinoGamif.salvarConfiguracao(empresaId, {
    metasDiarias: {
      servicosExtrasAtivo: true,
      servicosExtrasQtd: 6,
      servicosExtrasGiros: 1,
      produtosAtivo: true,
      produtosQtd: 2,
    },
  });

  // Cria comanda com 1 Corte + 6 Limpezas de Pele (R$ 360 total)
  const comanda = barbeariaErpKytto.criarComandaBarbearia(empresaId, {
    lojaId,
    profissionalId: prof.id,
    clienteNome: 'Guilherme Cliente',
    itens: [
      {
        tipo: 'servico',
        servicoId: srvCorte.id,
        quantidade: 1,
      },
      {
        tipo: 'servico',
        servicoId: srvLimpeza.id,
        quantidade: 6, // 6 unidades de extra
      },
    ],
  });

  // Fecha a comanda como paga hoje
  barbeariaErpKytto.registrarPagamentoComandaBarbearia(empresaId, comanda.id, {
    confirmado: true,
    meioPagamento: 'pix',
    valor: 460,
  });

  // Executa o cálculo de metas e gamificação para o dia
  const resultado = dinoGamif.avaliarMetasESincronizarGiros(empresaId, {
    dataIso: hoje,
    lojaId,
  });

  assert.ok(resultado.apuracao);
  const profStats = resultado.apuracao.profissionais.find((p) => p.profissionalId === prof.id);
  assert.ok(profStats, 'Profissional deve estar nas estatísticas');

  // Verifica que computou 6 extras e não apenas 1!
  assert.equal(profStats.dia.servicosExtras, 6, 'Deve computar 6 serviços extras (e não 1)');
  assert.equal(profStats.semana.servicosExtras, 6, 'Semana deve acumular 6 serviços extras');
  assert.equal(profStats.dia.servicosTotal, 7, 'Total de serviços deve ser 7 (1 corte + 6 limpezas)');
  assert.equal(profStats.dia.faturamentoServicos, 460, 'Faturamento de serviços deve ser 460');

  // Verifica que servicosExtrasLista tem quantidade 6
  assert.ok(Array.isArray(profStats.dia.servicosExtrasLista));
  const extraItem = profStats.dia.servicosExtrasLista.find((i) => i.nome === 'Limpeza de Pele');
  assert.ok(extraItem, 'Limpeza de pele deve constar nos extras');
  assert.equal(extraItem.quantidade, 6, 'Item extra deve ter quantidade 6');
  assert.equal(extraItem.valor, 360, 'Item extra deve ter valor total 360');

  // Verifica que bateu a meta diária de 6 extras e liberou o giro da roleta
  assert.equal(profStats.dia.metaExtrasAtingida, true, 'Meta diária de extras deve estar batida');
  assert.ok(profStats.girosPendentes.length >= 1, 'Deve liberar pelo menos 1 giro pendente na roleta');
  assert.equal(profStats.girosPendentes[0].tipoOrigem, 'meta_diaria_extras');
});
