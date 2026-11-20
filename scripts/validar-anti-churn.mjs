import { carregarBaseConsolidada } from '../app/dino-recuperacao-avec.js';
import { buildInteligenciaVendas } from '../app/dino-inteligencia-vendas.js';

async function validar() {
  console.log('=== TESTE DE RECONCILIAÇÃO REAL & ANTI-CHURN ===\n');

  const hoje = '2026-11-19';

  const agendamentosHoje = [
    {
      id: 'ag-pablo-hoje',
      clienteNome: 'Pablo Selle (Club Combo - Asaas Dia 04)',
      clienteTelefone: '(65) 99694-6939',
      data: hoje,
      horario: '14:30',
      status: 'concluido',
      profissionalNome: 'Bruno',
      valor: 0,
    },
    {
      id: 'ag-jefferson-hoje',
      clienteNome: 'Jefferson Gonçalves Melo',
      clienteTelefone: '5565996478950',
      data: hoje,
      horario: '15:30',
      status: 'concluido',
      profissionalNome: 'Dino',
      valor: 85,
    },
    {
      id: 'ag-oziel-hoje',
      clienteNome: 'Oziel (Club Barba e Cabelo)',
      clienteTelefone: '65999778235',
      data: hoje,
      horario: '16:00',
      status: 'confirmado',
      profissionalNome: 'Bruno',
      valor: 0,
    },
    {
      id: 'ag-bruno-hoje',
      clienteNome: 'Bruno Carvalho',
      clienteTelefone: '65999928906',
      data: hoje,
      horario: '17:00',
      status: 'concluido',
      profissionalNome: 'Jazon',
      valor: 90,
    },
  ];

  const comandasHoje = [
    {
      id: 'cmd-pablo-01',
      clienteNome: 'Pablo Selle',
      clienteTelefone: '65996946939',
      dataFechamento: hoje,
      status: 'fechada',
      total: 0,
      itens: [{ nome: 'Corte Cabelo Club', valor: 0 }],
    },
  ];

  const base = await carregarBaseConsolidada({
    agendamentosRecentes: agendamentosHoje,
    comandasRecentes: comandasHoje,
    dataReferencia: hoje,
    force: true,
  });

  const checados = ['Pablo Selle', 'Jefferson Gonçalves Melo', 'Oziel', 'Bruno Carvalho'];
  console.log('[1] RESULTADOS NA BASE CONSOLIDADA:');
  for (const c of base) {
    if (checados.some((nome) => c.nome.includes(nome))) {
      console.log(`- ${c.nome} | Tel: ${c.telefone} | Dias sem vir: ${c.diasSemVir} | Veio hoje: ${c.veioHoje} | Plano: ${c.planoClub || 'Nenhum'} | Em Churn: ${c.emChurn}`);
    }
  }

  const mockDb = {
    barbearias: {
      'd0d0ac01-8e50-4b61-8c79-de4aaa916da6': {
        agendamentos: Object.fromEntries(agendamentosHoje.map((a) => [a.id, a])),
        comandas: Object.fromEntries(comandasHoje.map((c) => [c.id, c])),
        produtosRevenda: {},
      },
    },
  };

  const inteligencia = await buildInteligenciaVendas(mockDb, {
    empresaId: 'dino',
    hoje,
    force: true,
  });

  const reativacao = inteligencia.oportunidades?.reativacaoAntiChurn || inteligencia.reativacao || [];
  console.log('\n[2] VERIFICAÇÃO NA ABA DE REATIVAÇÃO ANTI-CHURN:');
  console.log(`Total geral de oportunidades de reativação: ${reativacao.length}`);

  const pabloNaReativacao = Boolean(reativacao.find((r) => r.nome.includes('Pablo')));
  const jeffersonNaReativacao = Boolean(reativacao.find((r) => r.nome.includes('Jefferson')));
  const ozielNaReativacao = Boolean(reativacao.find((r) => r.nome.includes('Oziel')));
  const brunoNaReativacao = Boolean(reativacao.find((r) => r.nome.includes('Bruno Carvalho')));

  console.log(`- Pablo Selle listado incorretamente como Churn? ${pabloNaReativacao ? 'SIM (ERRO)' : 'NÃO (CORRETO)'}`);
  console.log(`- Jefferson Gonçalves Melo listado incorretamente como Churn? ${jeffersonNaReativacao ? 'SIM (ERRO)' : 'NÃO (CORRETO)'}`);
  console.log(`- Oziel listado incorretamente como Churn? ${ozielNaReativacao ? 'SIM (ERRO)' : 'NÃO (CORRETO)'}`);
  console.log(`- Bruno Carvalho listado incorretamente como Churn? ${brunoNaReativacao ? 'SIM (ERRO)' : 'NÃO (CORRETO)'}`);

  if (!pabloNaReativacao && !jeffersonNaReativacao && !ozielNaReativacao && !brunoNaReativacao) {
    console.log('\n>>> APROVADO: Reconciliação em tempo real e saneamento funcionando com 100% de precisão!');
  } else {
    console.error('\n>>> FALHA: Clientes atendidos hoje ainda estão sendo listados no Anti-Churn!');
    process.exit(1);
  }
}

validar().catch((err) => {
  console.error(err);
  process.exit(1);
});
