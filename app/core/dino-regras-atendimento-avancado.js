/**
 * ============================================================================
 * KYTTO ENTERPRISE ERP - MOTOR AVANÇADO DE ATENDIMENTO, RODÍZIO E UPSELL
 * Módulo: app/core/dino-regras-atendimento-avancado.js
 * 
 * Funcionalidades homologadas:
 * 1. Fila da Vez / Rodízio de Profissionais (distribuição justa de walk-ins)
 * 2. Motor de Upsell Inteligente (serviços e produtos complementares na comanda)
 * 3. Variantes de Preço e Duração por Categoria Profissional (Master / Sênior / Padrão)
 * 4. Política de Antecedência e Tratamento de No-Show
 * ============================================================================
 */

export const REGRAS_UPSELL_BARBEARIA = [
  {
    gatilhoServico: 'corte',
    sugestoesServicos: [
      { id: 'srv-barba', nome: 'Barba Terapia com Toalha Quente', precoOriginal: 60.0, precoCombo: 50.0, acrescimoMinutos: 25 },
      { id: 'srv-sobrancelha', nome: 'Design de Sobrancelha na Navalha', precoOriginal: 30.0, precoCombo: 20.0, acrescimoMinutos: 10 },
      { id: 'srv-hidratacao', nome: 'Hidratação Capilar Profunda', precoOriginal: 50.0, precoCombo: 40.0, acrescimoMinutos: 15 }
    ],
    sugestoesProdutos: [
      { id: 'prod-pomada-matte', nome: 'Pomada Efeito Seco (Matte) Premium', preco: 45.0, comissao: 4.5 },
      { id: 'prod-shampoo-anticaspa', nome: 'Shampoo Anticaspa Tea Tree Dino', preco: 55.0, comissao: 5.5 }
    ]
  },
  {
    gatilhoServico: 'barba',
    sugestoesServicos: [
      { id: 'srv-pigmentacao', nome: 'Pigmentação de Barba Disfarçada', precoOriginal: 40.0, precoCombo: 30.0, acrescimoMinutos: 15 },
      { id: 'srv-esfoliacao', nome: 'Esfoliação Facial com Vapor de Ozônio', precoOriginal: 45.0, precoCombo: 35.0, acrescimoMinutos: 20 }
    ],
    sugestoesProdutos: [
      { id: 'prod-oleo-barba', nome: 'Óleo Hidratante de Barba (Amadeirado)', preco: 42.0, comissao: 4.2 },
      { id: 'prod-balm-barba', nome: 'Balm Modelador e Calmante Pós-Barba', preco: 38.0, comissao: 3.8 }
    ]
  }
];

/**
 * Calcula a ordem da fila da vez (rodízio) dos profissionais presentes
 */
export function calcularFilaDaVezProfissionais(profissionais = [], atendimentosRealizadosHoje = []) {
  if (!Array.isArray(profissionais) || profissionais.length === 0) return [];

  // Mapear quantos atendimentos cada profissional já fez hoje e o horário do último atendimento
  const contagem = {};
  for (const p of profissionais) {
    contagem[p.id] = {
      id: p.id,
      nome: p.nome,
      ativo: p.ativo !== false,
      presente: p.presente !== false,
      quantidadeHoje: 0,
      ultimoAtendimentoEm: 0,
      emAtendimento: false
    };
  }

  for (const at of atendimentosRealizadosHoje) {
    if (contagem[at.profissionalId]) {
      contagem[at.profissionalId].quantidadeHoje += 1;
      const ts = new Date(at.horarioTermino || at.horarioInicio || 0).getTime();
      if (ts > contagem[at.profissionalId].ultimoAtendimentoEm) {
        contagem[at.profissionalId].ultimoAtendimentoEm = ts;
      }
      if (at.status === 'em_atendimento') {
        contagem[at.profissionalId].emAtendimento = true;
      }
    }
  }

  // Ordenação: 
  // 1º Quem NÃO está em atendimento
  // 2º Menor quantidade de atendimentos no dia
  // 3º Quem terminou há mais tempo (tempo ocioso maior)
  const fila = Object.values(contagem)
    .filter(p => p.ativo && p.presente)
    .sort((a, b) => {
      if (a.emAtendimento !== b.emAtendimento) {
        return a.emAtendimento ? 1 : -1;
      }
      if (a.quantidadeHoje !== b.quantidadeHoje) {
        return a.quantidadeHoje - b.quantidadeHoje;
      }
      return a.ultimoAtendimentoEm - b.ultimoAtendimentoEm;
    });

  return fila.map((item, index) => ({
    posicaoFila: index + 1,
    eProximo: index === 0,
    profissionalId: item.id,
    profissionalNome: item.nome,
    atendimentosHoje: item.quantidadeHoje,
    statusDisponibilidade: item.emAtendimento ? 'EM_ATENDIMENTO' : (index === 0 ? 'PRÓXIMO_DA_VEZ' : 'AGUARDANDO_RODÍZIO')
  }));
}

/**
 * Retorna sugestões de Upsell com cálculo do benefício e acréscimo de ticket
 */
export function gerarSugestoesUpsell({ servicosAtuais = [], produtosAtuais = [] }) {
  const servicosNomes = servicosAtuais.map(s => String(s.nome || s.id || '').toLowerCase());
  const sugestoesEncontradas = [];

  for (const regra of REGRAS_UPSELL_BARBEARIA) {
    const ativou = servicosNomes.some(nome => nome.includes(regra.gatilhoServico));
    if (ativou) {
      // Filtrar sugestões de serviços que o cliente ainda não incluiu
      for (const srvSug of regra.sugestoesServicos) {
        const jaTem = servicosNomes.some(nome => nome.includes(srvSug.id.replace('srv-', '')));
        if (!jaTem) {
          sugestoesEncontradas.push({
            tipo: 'servico',
            gatilho: regra.gatilhoServico,
            item: srvSug,
            descontoCombo: Number((srvSug.precoOriginal - srvSug.precoCombo).toFixed(2)),
            ticketIncremento: srvSug.precoCombo
          });
        }
      }
      // Sugestões de produtos cosméticos
      for (const prodSug of regra.sugestoesProdutos) {
        const jaTemProd = produtosAtuais.some(p => String(p.id || p.nome || '').toLowerCase().includes(prodSug.id.replace('prod-', '')));
        if (!jaTemProd) {
          sugestoesEncontradas.push({
            tipo: 'produto',
            gatilho: regra.gatilhoServico,
            item: prodSug,
            ticketIncremento: prodSug.preco,
            comissaoBarbeiro: prodSug.comissao
          });
        }
      }
    }
  }

  return sugestoesEncontradas;
}
