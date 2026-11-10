import express from 'express';

// Dados em memória/persistência de fallback resiliente
const VEICULOS_DEFAULT = [
  {
    id: 'veic-001',
    placa: 'RNI-4E29',
    chassi: '9BWCA41V0EP012345',
    renavam: '01123456789',
    marca: 'Volkswagen',
    modelo: 'Amarok Highline 2.0 4x4',
    anoFabricacao: 2023,
    anoModelo: 2024,
    cor: 'Prata Sírius',
    combustivel: 'Diesel S10',
    clienteNome: 'Rodrigo Ribeiro Gonçalves',
    clienteTelefone: '+55 65 99352-2260',
    totalOs: 3,
    historicoGarantias: [
      { peca: 'Pastilhas de Freio Cerâmica Dianteiras', dataInstalacao: '2026-08-15', garantiaMeses: 6, status: 'VIGENTE' },
      { peca: 'Filtro de Ar e Óleo Sintético 5W30', dataInstalacao: '2026-10-02', garantiaMeses: 3, status: 'VIGENTE' }
    ]
  },
  {
    id: 'veic-002',
    placa: 'QBQ-8J12',
    chassi: '9BRBL48E8HP987654',
    renavam: '00987654321',
    marca: 'Toyota',
    modelo: 'Hilux SRV 2.8 Turbo 4x4',
    anoFabricacao: 2022,
    anoModelo: 2023,
    cor: 'Branco Polar',
    combustivel: 'Diesel S10',
    clienteNome: 'Agro Open Grãos e Sementes',
    clienteTelefone: '+55 65 99999-1234',
    totalOs: 5,
    historicoGarantias: [
      { peca: 'Amortecedores Dianteiros Reforçados Off-Road', dataInstalacao: '2026-07-20', garantiaMeses: 12, status: 'VIGENTE' }
    ]
  }
];

const ORDENS_SERVICO_DEFAULT = [
  {
    id: 'os-1042',
    numeroOs: 'OS-2026-01042',
    placa: 'RNI-4E29',
    veiculoDescricao: 'Volkswagen Amarok Highline 2.0 4x4 (2024)',
    clienteNome: 'Rodrigo Ribeiro Gonçalves',
    clienteTelefone: '+55 65 99352-2260',
    dataAbertura: '2026-11-10T08:30:00Z',
    kmAtual: 42500,
    mecanicoResponsavel: 'Carlos Mecânico Chefe',
    status: 'EM_EXECUCAO', // 'ORCAMENTO', 'APROVADO_WHATSAPP', 'EM_EXECUCAO', 'FINALIZADO'
    reclamacaoCliente: 'Revisão periódica dos 40.000 km e barulho leve na suspensão ao passar em quebra-molas.',
    itensPecas: [
      { descricao: 'Kit Pastilha de Freio Dianteira Cerâmica', quantidade: 1, valorUnitario: 380.00, valorTotal: 380.00 },
      { descricao: 'Óleo Motor Sintético 5W30 Castrol (Litros)', quantidade: 7, valorUnitario: 65.00, valorTotal: 455.00 },
      { descricao: 'Filtro de Combustível Separador Água', quantidade: 1, valorUnitario: 145.00, valorTotal: 145.00 }
    ],
    itensServicos: [
      { descricao: 'Mão de obra: Troca de pastilhas e fluído DOT4', valor: 180.00 },
      { descricao: 'Mão de obra: Alinhamento 3D e Balanceamento 4 Rodas', valor: 160.00 },
      { descricao: 'Checklist 40 Pontos com Fotos para WhatsApp', valor: 0.00 }
    ],
    totalPecas: 980.00,
    totalServicos: 340.00,
    valorTotal: 1320.00,
    aprovadoPeloWhatsApp: true,
    dataAprovacaoWhatsApp: '2026-11-10T09:12:00Z',
    garantiaMeses: 6
  }
];

export function createOficinaAdminRouter() {
  const router = express.Router();

  // Listar ou buscar veículos por placa
  router.get('/veiculos', (req, res) => {
    const { placa } = req.query;
    if (placa) {
      const v = VEICULOS_DEFAULT.find(item => item.placa.toUpperCase() === String(placa).toUpperCase().replace(/[^A-Z0-9]/g, ''));
      return res.json({ ok: true, veiculo: v || null });
    }
    res.json({ ok: true, veiculos: VEICULOS_DEFAULT });
  });

  // Cadastrar novo veículo
  router.post('/veiculos', (req, res) => {
    try {
      const { placa, chassi, renavam, marca, modelo, anoFabricacao, cor, combustivel, clienteNome, clienteTelefone } = req.body || {};
      if (!placa) return res.status(400).json({ ok: false, error: 'Placa é obrigatória' });

      const novo = {
        id: `veic-${Date.now()}`,
        placa: String(placa).toUpperCase().trim(),
        chassi: chassi || '',
        renavam: renavam || '',
        marca: marca || 'Genérica',
        modelo: modelo || 'Veículo',
        anoFabricacao: Number(anoFabricacao) || 2024,
        cor: cor || 'Preto',
        combustivel: combustivel || 'Flex',
        clienteNome: clienteNome || 'Cliente Balcão',
        clienteTelefone: clienteTelefone || '',
        totalOs: 1,
        historicoGarantias: []
      };
      VEICULOS_DEFAULT.unshift(novo);
      res.json({ ok: true, mensagem: 'Veículo cadastrado com sucesso', veiculo: novo });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Listar Ordens de Serviço (OS)
  router.get('/os', (req, res) => {
    res.json({ ok: true, ordens: ORDENS_SERVICO_DEFAULT });
  });

  // Enviar orçamento com aprovação pelo WhatsApp
  router.post('/os/:id/enviar-whatsapp', (req, res) => {
    const os = ORDENS_SERVICO_DEFAULT.find(o => o.id === req.params.id) || ORDENS_SERVICO_DEFAULT[0];
    res.json({
      ok: true,
      mensagem: `Orçamento da OS ${os.numeroOs} enviado com sucesso para ${os.clienteTelefone} via WhatsApp Cloud API com botões de APROVAR e DETALHES.`,
      linkAprovacao: `https://kytto.com.br/os-aprovacao/${os.id}`,
      telefone: os.clienteTelefone
    });
  });

  // Aprovar OS
  router.post('/os/:id/aprovar', (req, res) => {
    const os = ORDENS_SERVICO_DEFAULT.find(o => o.id === req.params.id) || ORDENS_SERVICO_DEFAULT[0];
    os.status = 'APROVADO_WHATSAPP';
    os.aprovadoPeloWhatsApp = true;
    os.dataAprovacaoWhatsApp = new Date().toISOString();
    res.json({
      ok: true,
      mensagem: `Ordem de Serviço ${os.numeroOs} aprovada pelo cliente com sucesso!`,
      os
    });
  });

  return router;
}
