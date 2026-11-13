import * as erpService from './app/modules/erp/servico.js';
import { db, save } from './app/db.js';

const EMPRESA_DINO = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
const mockDb = {
  query: async () => { throw new Error('PG_OFFLINE'); }
};

async function seed() {
  console.log('--- Populando ERP 360 ---');

  // 1. Propostas Comerciais
  await erpService.salvarProposta(mockDb, EMPRESA_DINO, {
    cliente_nome: 'Fazenda Santa Helena & Haras',
    cliente_documento: '04.891.234/0001-55',
    cliente_telefone: '(14) 99888-7711',
    cliente_email: 'financeiro@fazendasantahelena.com.br',
    vendedor_nome: 'Rodrigo Gonçalves',
    validade_dias: 30,
    condicao_pagamento: 'Entrada + 30/60 dias',
    forma_pagamento: 'Pix / Boleto',
    tipo_frete: 'cif',
    valor_frete: 250,
    itens: [
      { descricao: 'Kit Pomadas e Shampoos Linha Premium Dino Barba & Cabelo (50 un)', ncm: '33059000', quantidade: 2, valor_unitario: 1200, valor_desconto: 100 },
      { descricao: 'Kit Cerveja Artesanal Dino Golden Ale 600ml (Caixa c/ 24)', ncm: '22030000', quantidade: 4, valor_unitario: 240, valor_desconto: 0 }
    ],
    observacoes: 'Entrega programada para evento corporativo e confraternização de fim de ano.'
  });

  const prop2 = await erpService.salvarProposta(mockDb, EMPRESA_DINO, {
    cliente_nome: 'Centro Automotivo & Lava Jato Paulista',
    cliente_documento: '28.192.839/0001-02',
    cliente_telefone: '(14) 99777-6622',
    vendedor_nome: 'Marcos Consultor B2B',
    validade_dias: 15,
    condicao_pagamento: 'À vista',
    forma_pagamento: 'Pix',
    tipo_frete: 'fob',
    valor_frete: 0,
    itens: [
      { descricao: 'Assinatura Pacote Clube VIP Dino 10 Colaboradores (Semestral)', ncm: '99831100', quantidade: 1, valor_unitario: 3500, valor_desconto: 350 }
    ]
  });
  await erpService.alterarStatusProposta(mockDb, EMPRESA_DINO, prop2.id, { status: 'aprovada' });

  // 2. Ordens de Serviço (OS 360)
  const os1 = await erpService.salvarOS(mockDb, EMPRESA_DINO, {
    cliente_nome: 'Barbearia Dino - Unidade Centro',
    cliente_documento: '04.891.234/0001-55',
    cliente_telefone: '(14) 99746-2929',
    tecnico_responsavel: 'Paulo Refrigeração & Climatização',
    prioridade: 'alta',
    equipamento_tipo: 'Ar Condicionado Inverter 30.000 BTUs',
    equipamento_marca: 'Daikin',
    equipamento_modelo: 'Split Cassete Inverter',
    equipamento_serie: 'DK-30K-99124',
    equipamento_patrimonio: 'PAT-AC-001',
    defeito_reclamado: 'Baixo rendimento térmico no salão principal em dias quentes',
    laudo_tecnico: 'Vazamento na flange de sucção com perda parcial de gás ecológico R-410A',
    solucao_aplicada: 'Refeita flange de cobre, teste de estanqueidade c/ nitrogênio e carga completa de fluido',
    garantia_dias: 90,
    checklist: [
      { item: 'Turbina e serpentina limpas', conferido: true, obs: 'Higienização bactericida realizada' },
      { item: 'Dreno desobstruído', conferido: true, obs: 'Sem refluxo' }
    ],
    pecas: [
      { descricao: 'Fluido Refrigerante R-410A 3.5kg', quantidade: 1, valor_unitario: 280, subtotal: 280 },
      { descricao: 'Kit Isolamento Térmico Blindado', quantidade: 1, valor_unitario: 95, subtotal: 95 }
    ],
    servicos: [
      { descricao: 'Mão de obra técnica de pressurização, vácuo e carga de gás', horas: 3, valor_unitario: 140, total: 420 }
    ],
    desconto: 45
  });
  await erpService.atualizarStatusOS(mockDb, EMPRESA_DINO, os1.id, 'em_execucao');

  // 3. Expedição & Romaneio
  await erpService.salvarRomaneio(mockDb, EMPRESA_DINO, {
    data_saida: new Date().toISOString().split('T')[0],
    motorista_nome: 'Carlos Eduardo Logística Express',
    veiculo_placa: 'BRA2E19',
    veiculo_modelo: 'Furgão Mercedes Sprinter 416',
    observacoes: 'Rota Centro-Norte e Distrito Industrial',
    entregas: [
      { cliente_nome: 'Restaurante Sabor da Terra', endereco: 'Av. Brasil, 1420', telefone: '(14) 99777-1111', volumes: 4, valor_mercadoria: 960, forma_pagamento: 'pago_antecipado', valor_a_cobrar: 0 },
      { cliente_nome: 'Empório & Conveniência Gourmet', endereco: 'Rua Nove de Julho, 880', telefone: '(14) 99888-2222', volumes: 6, valor_mercadoria: 1580, forma_pagamento: 'cobrar_na_entrega', valor_a_cobrar: 1580 }
    ]
  });

  // 4. Ativos & Patrimônio
  await erpService.salvarAtivo(mockDb, EMPRESA_DINO, {
    codigo_tombamento: 'PAT-CAD-001',
    descricao: 'Cadeira de Barbeiro Ferrante Vintage Premium Couro Legítimo Hidráulica',
    categoria: 'moveis_utensilios',
    marca: 'Ferrante',
    modelo: 'Imperador Gold',
    numero_serie: 'FER-2023-891',
    data_aquisicao: '2023-03-10',
    valor_aquisicao: 8500,
    vida_util_anos: 10,
    taxa_depreciacao_anual: 10.0,
    nf_compra: 'NF-89214',
    fornecedor_nome: 'Ferrante Móveis Corporativos',
    localizacao_setor: 'Salão de Corte - Estação 1 (Dino)',
    responsavel: 'Dino Master Barber',
    estado_conservacao: 'otimo'
  });

  await erpService.salvarAtivo(mockDb, EMPRESA_DINO, {
    codigo_tombamento: 'PAT-MQ-002',
    descricao: 'Máquina de Café Espresso Profissional Italiana 2 Grupos La Marzocco',
    categoria: 'maquinas_equipamentos',
    marca: 'La Marzocco',
    modelo: 'Linea Mini Pro',
    numero_serie: 'LM-990142-IT',
    data_aquisicao: '2023-08-20',
    valor_aquisicao: 28000,
    vida_util_anos: 10,
    taxa_depreciacao_anual: 10.0,
    nf_compra: 'NF-11029',
    fornecedor_nome: 'Importadora Café & Arte',
    localizacao_setor: 'Bar Lounge & Recepção',
    responsavel: 'Barista Chefe',
    estado_conservacao: 'otimo'
  });

  save();
  console.log('✅ ERP 360 populado com sucesso!');
}

seed().catch(console.error);
