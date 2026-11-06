// ============================================================================
// TESTES AUTOMATIZADOS: KYTTO ERP 360
// Propostas Comerciais, Ordens de Serviço (OS 360), Romaneios e Patrimônio
// ============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { reset, db as getJsonDb } from '../db.js';
import * as erpService from '../modules/erp/servico.js';

const EMPRESA_TESTE = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
const mockDb = {
  query: async () => { throw new Error('PG_OFFLINE_FALLBACK'); }
};

test('KYTTO ERP 360: Ciclo Completo de Propostas, OS, Expedição e Ativos', async (t) => {
  reset();

  await t.test('1. Propostas Comerciais: criação, cálculo de totais, desconto e conversão', async () => {
    const proposta = await erpService.salvarProposta(mockDb, EMPRESA_TESTE, {
      cliente_nome: 'Agropecuária Vale Verde Ltda',
      cliente_documento: '12.345.678/0001-90',
      cliente_telefone: '(14) 99876-5432',
      cliente_email: 'compras@valeverde.com.br',
      vendedor_nome: 'Marcos Silveira',
      validade_dias: 20,
      condicao_pagamento: '28 dias',
      forma_pagamento: 'Boleto Bancário',
      tipo_frete: 'cif',
      valor_frete: 150,
      itens: [
        { descricao: 'Adubo Foliar NPK 20-20-20 25kg', ncm: '31052000', quantidade: 10, valor_unitario: 180, valor_desconto: 50 },
        { descricao: 'Bioestimulante Raiz Forte 5L', ncm: '38089329', quantidade: 4, valor_unitario: 220, valor_desconto: 0 }
      ],
      observacoes: 'Entrega na fazenda sede.'
    }, 'admin');

    assert.ok(proposta.id, 'Deve gerar ID único para a proposta');
    assert.ok(proposta.numero.startsWith('PROP-'), 'Deve gerar número formatado PROP-');
    assert.equal(proposta.subtotal, 2680); // 10*180 + 4*220 = 1800 + 880 = 2680
    assert.equal(proposta.desconto_total, 50);
    assert.equal(proposta.valor_total, 2780); // 2680 - 50 + 150 = 2780
    assert.equal(proposta.status, 'rascunho');

    // Listagem
    const lista = await erpService.listarPropostas(mockDb, EMPRESA_TESTE, { busca: 'Vale Verde' });
    assert.equal(lista.length, 1);
    assert.equal(lista[0].cliente_nome, 'Agropecuária Vale Verde Ltda');

    // Alterar status para enviada e depois aprovada
    const enviada = await erpService.alterarStatusProposta(mockDb, EMPRESA_TESTE, proposta.id, { status: 'enviada' });
    assert.equal(enviada.status, 'enviada');

    const aprovada = await erpService.alterarStatusProposta(mockDb, EMPRESA_TESTE, proposta.id, { status: 'aprovada' });
    assert.equal(aprovada.status, 'aprovada');

    // Conversão em Venda / Faturamento
    const convertida = await erpService.converterPropostaEmVenda(mockDb, EMPRESA_TESTE, proposta.id, { destino: 'razao' }, 'admin');
    assert.equal(convertida.sucesso, true, 'Deve confirmar faturamento da proposta');
    const propostaAtualizada = await erpService.obterProposta(mockDb, EMPRESA_TESTE, proposta.id);
    assert.equal(propostaAtualizada.status, 'faturada', 'Proposta deve estar com status faturada');
    assert.ok(propostaAtualizada.faturado_em, 'Deve registrar timestamp do faturamento');
  });

  await t.test('2. Ordens de Serviço (OS 360): checklist, peças, serviços, assinatura e faturamento', async () => {
    const os = await erpService.salvarOS(mockDb, EMPRESA_TESTE, {
      cliente_nome: 'Dr. Roberto Antunes',
      cliente_documento: '123.456.789-00',
      cliente_telefone: '(14) 99123-4567',
      cliente_email: 'roberto@clinica.com.br',
      tecnico_responsavel: 'Lucas Mecânico Chefe',
      prioridade: 'alta',
      equipamento_tipo: 'Trator / Máquina Agrícola',
      equipamento_marca: 'John Deere',
      equipamento_modelo: '6110J',
      equipamento_serie: 'JD-98421-2024',
      defeito_reclamado: 'Perda de pressão hidráulica e ruído na bomba principal',
      laudo_tecnico: 'Válvula de alívio obstruída e retentor desgastado',
      solucao_aplicada: 'Substituição do kit de retentores e regulagem de pressão',
      garantia_dias: 90,
      checklist: [
        { item: 'Nível de óleo hidráulico', conferido: true, obs: 'Baixo' },
        { item: 'Chave de ignição original', conferido: true, obs: 'Entregue' }
      ],
      pecas: [
        { descricao: 'Kit Retentores Hidráulicos HD-20', quantidade: 1, valor_unitario: 350, subtotal: 350 },
        { descricao: 'Óleo Hidráulico ISO 68 20L', quantidade: 2, valor_unitario: 240, subtotal: 480 }
      ],
      servicos: [
        { descricao: 'Revisão e regulagem do sistema hidráulico', horas: 3, valor_unitario: 150, total: 450 }
      ],
      desconto: 80
    }, 'admin');

    assert.ok(os.id, 'Deve gerar ID único da OS');
    assert.ok(os.numero.startsWith('OS-'), 'Deve gerar número formatado OS-');
    assert.equal(os.valor_pecas, 830); // 350 + 480 = 830
    assert.equal(os.valor_servicos, 450);
    assert.equal(os.valor_total, 1200); // 830 + 450 - 80 = 1200
    assert.equal(os.status, 'aberta');

    // Transição de status
    const emExecucao = await erpService.atualizarStatusOS(mockDb, EMPRESA_TESTE, os.id, 'em_execucao', 'admin');
    assert.equal(emExecucao.status, 'em_execucao');

    const concluida = await erpService.atualizarStatusOS(mockDb, EMPRESA_TESTE, os.id, 'concluida', 'admin');
    assert.equal(concluida.status, 'concluida');
    assert.ok(concluida.data_conclusao, 'Deve ter data de conclusão');

    // Assinatura digital do cliente
    const assinada = await erpService.salvarAssinaturaOS(mockDb, EMPRESA_TESTE, os.id, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...');
    assert.ok(assinada.assinatura_cliente, 'Deve salvar assinatura touch');

    // Faturamento
    const faturada = await erpService.faturarOS(mockDb, EMPRESA_TESTE, os.id, 'admin');
    assert.equal(faturada.sucesso, true, 'Deve confirmar faturamento');
    const osAtualizada = await erpService.obterOS(mockDb, EMPRESA_TESTE, os.id);
    assert.equal(osAtualizada.status, 'faturada', 'OS deve estar com status faturada');
    assert.ok(osAtualizada.faturado_em, 'Deve registrar timestamp do faturamento da OS');
  });

  await t.test('3. Expedição & Romaneios: montagem de carga, volumes e baixa de entrega', async () => {
    const romaneio = await erpService.salvarRomaneio(mockDb, EMPRESA_TESTE, {
      data_saida: '2026-11-06',
      motorista_nome: 'Carlos Eduardo Entregador',
      veiculo_placa: 'BRA2E19',
      veiculo_modelo: 'Furgão Mercedes Sprinter',
      observacoes: 'Rota Centro-Norte e Distrito Industrial',
      entregas: [
        { cliente_nome: 'Restaurante Sabor da Terra', endereco: 'Av. Paulista, 1000', telefone: '(14) 99777-1111', volumes: 3, valor_mercadoria: 850, forma_pagamento: 'pago_antecipado', valor_a_cobrar: 0 },
        { cliente_nome: 'Supermercado Nova Era', endereco: 'Rua das Flores, 450', telefone: '(14) 99888-2222', volumes: 5, valor_mercadoria: 1420, forma_pagamento: 'cobrar_na_entrega', valor_a_cobrar: 1420 }
      ]
    }, 'admin');

    assert.ok(romaneio.id, 'Deve gerar ID único do romaneio');
    assert.ok(romaneio.numero.startsWith('ROM-'), 'Deve gerar número formatado ROM-');
    assert.equal(romaneio.total_pedidos, 2);
    assert.equal(romaneio.total_volumes, 8);
    assert.equal(romaneio.valor_total_mercadorias, 2270);
    assert.equal(romaneio.valor_a_receber_destino, 1420);

    // Baixa de uma entrega específica
    const primeiraEntregaId = romaneio.entregas[0].id;
    const atualizado = await erpService.atualizarStatusEntrega(mockDb, EMPRESA_TESTE, romaneio.id, primeiraEntregaId, {
      status: 'entregue',
      recebedor_nome: 'Mariana Gerente',
      recebedor_doc: '987.654.321-11'
    });

    const entregaBaixada = atualizado.entregas.find(e => e.id === primeiraEntregaId);
    assert.equal(entregaBaixada.status, 'entregue');
    assert.equal(entregaBaixada.recebedor_nome, 'Mariana Gerente');
    assert.ok(entregaBaixada.entregue_em, 'Deve ter data e hora de baixa');
  });

  await t.test('4. Patrimônio & Ativos Imobilizados: tombamento, depreciação e manutenção preventiva', async () => {
    const ativo = await erpService.salvarAtivo(mockDb, EMPRESA_TESTE, {
      codigo_tombamento: 'PAT-EQ-2026-001',
      descricao: 'Compressores de Ar Parafuso Atlas Copco 15HP',
      categoria: 'maquinas_equipamentos',
      marca: 'Atlas Copco',
      modelo: 'G11 10-TM',
      numero_serie: 'AC-7890123-BR',
      data_aquisicao: '2024-01-15',
      valor_aquisicao: 24000,
      vida_util_anos: 10,
      taxa_depreciacao_anual: 10.0,
      nf_compra: 'NF-10492',
      fornecedor_nome: 'Atlas Copco Brasil Ltda',
      localizacao_setor: 'Oficina Central / Sala de Compressores',
      responsavel: 'Eng. Fernando Souza',
      estado_conservacao: 'otimo'
    });

    assert.ok(ativo.id, 'Deve cadastrar ativo patrimonial');
    assert.equal(ativo.codigo_tombamento, 'PAT-EQ-2026-001');

    // Listagem com cálculo de depreciação linear automática (IN SRF 162)
    const lista = await erpService.listarAtivos(mockDb, EMPRESA_TESTE);
    const ativoComCalculo = lista.find(a => a.id === ativo.id);
    assert.ok(ativoComCalculo, 'Deve encontrar o ativo na listagem');
    assert.ok(ativoComCalculo.depreciacaoAcumulada > 0, 'Deve ter depreciação acumulada calculada proporcional aos meses decorridos');
    assert.ok(ativoComCalculo.valorResidual < 24000, 'Valor residual deve ser menor que o valor original de aquisição');

    // Registro de Manutenção Preventiva
    const ativoComManut = await erpService.registrarManutencaoAtivo(mockDb, EMPRESA_TESTE, ativo.id, {
      tipo: 'preventiva',
      descricao: 'Troca de elemento filtrante e óleo sintético Roto-Inject',
      custo: 850,
      prestador: 'Autorizada Atlas Ar Comprimido',
      proxima_manutencao: '2027-05-15'
    });

    assert.equal(ativoComManut.historico_manutencoes.length, 1);
    assert.equal(ativoComManut.historico_manutencoes[0].custo, 850);
  });

  await t.test('5. KPIs Gerais do Hub ERP 360', async () => {
    const kpis = await erpService.obterKpisErp(mockDb, EMPRESA_TESTE);
    assert.ok(kpis.propostas, 'Deve ter bloco de propostas');
    assert.ok(kpis.ordensServico, 'Deve ter bloco de ordens de serviço');
    assert.ok(kpis.logistica, 'Deve ter bloco de logística');
    assert.ok(kpis.patrimonio, 'Deve ter bloco de patrimônio');
    assert.ok(kpis.propostas.total >= 1, 'Deve contabilizar proposta criada');
    assert.ok(kpis.ordensServico.total >= 1, 'Deve contabilizar OS criada');
    assert.ok(kpis.logistica.totalRomaneios >= 1, 'Deve contabilizar romaneio criado');
    assert.ok(kpis.patrimonio.totalAtivos >= 1, 'Deve contabilizar ativo tombado');
  });
});
