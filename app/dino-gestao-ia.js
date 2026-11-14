// ============================================================================
// DINO GESTÃO IA — COPILOTO EXECUTIVO E CONSULTOR DE NEGÓCIOS DO EMPRESÁRIO
//
// Atua no canal interno exclusivo WhatsApp Gestão (/admin/whatsapp-gestao),
// permitindo ao empresário Dino (Guilherme Cunha) consultar via texto ou áudio
// de WhatsApp qualquer indicador, relatório e regra do negócio em tempo real:
//   - Faturamento (serviços, produtos revenda, e-commerce, ticket médio)
//   - Agenda de atendimentos, ocupação por barbeiro e faturamento projetado
//   - Desempenho da equipe (atendimentos, produtos, comissões e repasses)
//   - Metas diárias (6 extras = 1 giro, produtos por quantidade/valor)
//   - Roleta de premiações (saldo de giros, prêmios ganhos e entregas pendentes)
//   - Planos VIP & Pacotes (4/6/8 procs com 10%/15%/20%, preços Naty/Bruno, Club)
//   - Carteira de clientes (9.365 clientes, retorno ideal, atrasados, sumidos)
//   - Contas financeiras (saldo de caixa, contas a pagar hoje/semana, a receber)
//   - Guia de procedimentos operacionais e dúvidas frequentes do gestor
// ============================================================================

import { db } from './db.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';
import * as dinoMetasGamificacao from './dino-metas-gamificacao.js';
import * as dinoCarteiraClientes from './dino-carteira-clientes.js';
import * as financeiroCentral from './financeiro-central-kytto.js';

const TIME_ZONE = 'America/Cuiaba';
const EMPRESA_DINO_DEFAULT = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

function number(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

export function formatBrl(val) {
  return number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function dataHoraCuiaba(data = new Date()) {
  const d = data instanceof Date ? data : new Date(data);
  const dataIso = d.toLocaleDateString('en-CA', { timeZone: TIME_ZONE }); // YYYY-MM-DD
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' });
  const diaSemana = d.toLocaleDateString('pt-BR', { timeZone: TIME_ZONE, weekday: 'long' });
  const dataFormatada = d.toLocaleDateString('pt-BR', { timeZone: TIME_ZONE });
  const dataExtenso = `${diaSemana}, ${dataFormatada} às ${hora}`;
  return { dataIso, hora, diaSemana, dataFormatada, dataExtenso };
}

function resolverEmpresaId(empresaId) {
  if (empresaId && empresaId !== 'undefined' && empresaId !== 'null') {
    return String(empresaId);
  }
  return EMPRESA_DINO_DEFAULT;
}

function resolverLojaId(empresaId, lojaId) {
  if (lojaId && lojaId !== 'undefined' && lojaId !== 'null') {
    return String(lojaId);
  }
  const root = db();
  const lojas = Object.values(root?.lojas || {}).filter(
    (l) => String(l?.empresa_id || l?.empresaId) === String(empresaId)
  );
  return lojas[0]?.id || 'loja-dino-matriz';
}

// ============================================================================
// CONSTRUÇÃO DO SNAPSHOT EXECUTIVO CONSOLIDADO
// ============================================================================
export function buildDinoGestaoSnapshot({ empresaId, lojaId, canal = null } = {}) {
  const empId = resolverEmpresaId(empresaId);
  const ljId = resolverLojaId(empId, lojaId);
  const { dataIso, hora, diaSemana, dataFormatada } = dataHoraCuiaba();
  const inicioMesIso = `${dataIso.slice(0, 7)}-01`;

  // 1. Dados Financeiros Seguros
  let financeiro = {
    saldo: 0,
    totalReceitas: 0,
    totalDespesas: 0,
    receitasHoje: 0,
    receitasMes: 0,
    despesasMes: 0,
    resultadoMes: 0,
    aReceber: 0,
    aPagar: 0,
    aPagarHoje: 0,
    aPagarSemana: 0,
  };

  try {
    const resumoFin = financeiroCentral.resumoFinanceiro(empId, { lojaId: ljId });
    if (resumoFin) {
      financeiro.saldo = number(resumoFin.saldo);
      financeiro.totalReceitas = number(resumoFin.totalReceitas);
      financeiro.totalDespesas = number(resumoFin.totalDespesas);
      financeiro.receitasMes = number(resumoFin.recMes);
      financeiro.despesasMes = number(resumoFin.despMes);
      financeiro.resultadoMes = financeiro.receitasMes - financeiro.despesasMes;
      financeiro.aReceber = number(resumoFin.aReceber);
      financeiro.aPagar = number(resumoFin.aPagar);
    }
  } catch (err) {
    // Modo silencioso tolerante a escopo
  }

  // Contas a pagar próximas
  try {
    const lancamentos = financeiroCentral.listarLancamentos(empId, { lojaId: ljId, status: 'pendente', tipo: 'despesa' });
    const hojeTimestamp = new Date(`${dataIso}T00:00:00`).getTime();
    const seteDiasTimestamp = hojeTimestamp + 7 * 86400000;

    for (const l of lancamentos || []) {
      const vcto = l.dataVencimento ? new Date(`${l.dataVencimento}T00:00:00`).getTime() : 0;
      const valor = number(l.valor);
      if (l.dataVencimento === dataIso) {
        financeiro.aPagarHoje += valor;
      }
      if (vcto >= hojeTimestamp && vcto <= seteDiasTimestamp) {
        financeiro.aPagarSemana += valor;
      }
    }
  } catch (err) {}

  // 2. Agenda de Atendimentos de Hoje
  let agendaHoje = {
    total: 0,
    concluidos: 0,
    emAndamento: 0,
    confirmados: 0,
    pendentes: 0,
    cancelados: 0,
    valorProjetado: 0,
    faturamentoServicosHoje: 0,
    ocupacaoPorBarbeiro: {},
  };

  try {
    const agendamentos = barbeariaErpKytto.listarAgendamentos(empId, { data: dataIso, lojaId: ljId });
    for (const ag of agendamentos || []) {
      const st = String(ag.status || '').toLowerCase();
      const val = number(ag.valor);
      const profNome = ag.profissionalNome || ag.profissional || 'Outro';

      agendaHoje.ocupacaoPorBarbeiro[profNome] ||= { total: 0, concluidos: 0, valor: 0 };
      agendaHoje.ocupacaoPorBarbeiro[profNome].total += 1;

      if (['cancelado', 'cancelada', 'faltou', 'nao_compareceu'].includes(st)) {
        agendaHoje.cancelados += 1;
      } else {
        agendaHoje.total += 1;
        agendaHoje.valorProjetado += val;
        agendaHoje.ocupacaoPorBarbeiro[profNome].valor += val;

        if (['concluido', 'concluida', 'finalizado'].includes(st)) {
          agendaHoje.concluidos += 1;
          agendaHoje.faturamentoServicosHoje += val;
          agendaHoje.ocupacaoPorBarbeiro[profNome].concluidos += 1;
        } else if (['em_atendimento', 'atendendo'].includes(st)) {
          agendaHoje.emAndamento += 1;
        } else if (['confirmado', 'confirmada'].includes(st)) {
          agendaHoje.confirmados += 1;
        } else {
          agendaHoje.pendentes += 1;
        }
      }
    }
  } catch (err) {}

  // 3. Comandas de Hoje & Vendas de Produtos (Revenda)
  let faturamentoProdutosHoje = 0;
  let produtosVendidosQtdHoje = 0;
  let comandasAbertasCadeira = 0;

  try {
    const comandas = barbeariaErpKytto.listarComandasBarbearia(empId, { lojaId: ljId });
    for (const c of comandas || []) {
      if (['aberta', 'em_atendimento'].includes(String(c.status).toLowerCase())) {
        comandasAbertasCadeira += 1;
      }
    }

    const vendasRevenda = barbeariaErpKytto.listarVendasRevenda(empId, { lojaId: ljId });
    for (const v of vendasRevenda || []) {
      const dataVenda = String(v.data || v.criadoEm || '').slice(0, 10);
      if (dataVenda === dataIso && String(v.status).toLowerCase() !== 'cancelada') {
        faturamentoProdutosHoje += number(v.total || v.valor);
        produtosVendidosQtdHoje += Array.isArray(v.itens)
          ? v.itens.reduce((acc, it) => acc + number(it.quantidade || 1), 0)
          : 1;
      }
    }
  } catch (err) {}

  financeiro.receitasHoje = agendaHoje.faturamentoServicosHoje + faturamentoProdutosHoje;

  // 4. Equipe & Profissionais Ativos (Dino, Naty, Bruno, David, Amanda...)
  const equipe = [];
  try {
    const profs = barbeariaErpKytto.listarProfissionais(empId);
    const comissoesHoje = barbeariaErpKytto.obterComissoes(empId, { data: dataIso, lojaId: ljId });
    const comissoesMes = barbeariaErpKytto.obterComissoes(empId, { inicio: inicioMesIso, fim: dataIso, lojaId: ljId });

    for (const p of profs || []) {
      if (p.ativo === false) continue;
      const chHoje = (comissoesHoje?.profissionais || []).find((c) => String(c.profissionalId) === String(p.id)) || {};
      const chMes = (comissoesMes?.profissionais || []).find((c) => String(c.profissionalId) === String(p.id)) || {};

      equipe.push({
        id: p.id,
        nome: p.nome,
        apelido: p.apelido || p.nome?.split(' ')?.[0] || 'Barbeiro',
        cargo: p.especialidade || 'Barbeiro / Hair Stylist',
        atendimentosHoje: number(chHoje.quantidadeAtendimentos || agendaHoje.ocupacaoPorBarbeiro[p.nome]?.concluidos || 0),
        faturamentoHoje: number(chHoje.faturamentoTotal || agendaHoje.ocupacaoPorBarbeiro[p.nome]?.valor || 0),
        comissaoHoje: number(chHoje.comissaoTotal || chHoje.repasseLiquido || 0),
        atendimentosMes: number(chMes.quantidadeAtendimentos || 0),
        faturamentoMes: number(chMes.faturamentoTotal || 0),
        comissaoMes: number(chMes.comissaoTotal || chMes.repasseLiquido || 0),
      });
    }
  } catch (err) {}

  // 5. Metas & Gamificação (Roleta de Premiações)
  let gamificacao = {
    regras: {
      metaDiariaExtrasQtd: 6,
      metaDiariaProdutosQtd: 2,
      metaDiariaProdutosValor: 100,
      desafioSemanalTitulo: 'Desafio Semanal de Vendas',
    },
    apuracaoHoje: [],
    girosDisponiveisRoleta: [],
    premiosRoleta: [],
    premiosPendentesEntrega: [],
  };

  try {
    const configG = dinoMetasGamificacao.obterConfiguracao(empId);
    if (configG) {
      gamificacao.regras = {
        metaDiariaExtrasQtd: configG.metasDiarias?.servicosExtrasQtd ?? 6,
        metaDiariaProdutosQtd: configG.metasDiarias?.produtosQtd ?? 2,
        metaDiariaProdutosValor: configG.metasDiarias?.produtosValor ?? 100,
        desafioSemanalTitulo: configG.metasSemanais?.tituloDesafio || 'Desafio Semanal',
      };
      gamificacao.premiosRoleta = (configG.premiosRoleta || []).filter((p) => p.ativo !== false).map((p) => p.nome);
    }

    const apuracao = dinoMetasGamificacao.avaliarMetasESincronizarGiros(empId, { dataIso, lojaId: ljId });
    gamificacao.apuracaoHoje = (apuracao?.profissionais || []).map((prof) => ({
      nome: prof.nome || prof.profissionalNome,
      apelido: prof.apelido || (prof.nome || prof.profissionalNome || '').split(' ')[0] || 'Barbeiro',
      extrasRealizados: prof.dia?.servicosExtras ?? prof.extrasRealizados ?? 0,
      metaExtrasBatida: Boolean(prof.dia?.metaExtrasAtingida ?? prof.metaExtrasBatida),
      produtosQtd: prof.dia?.produtosQtd ?? prof.produtosQtd ?? 0,
      produtosValor: number(prof.dia?.produtosValor ?? prof.produtosValor),
      metaProdutosBatida: Boolean(prof.dia?.metaProdutosAtingida ?? prof.metaProdutosBatida),
      ganhouGiroHoje: Boolean((prof.dia?.metaExtrasAtingida ?? prof.metaExtrasBatida) || (prof.dia?.metaProdutosAtingida ?? prof.metaProdutosBatida)),
    }));

    const historicoGiros = dinoMetasGamificacao.listarHistoricoGiros(empId);
    for (const g of historicoGiros || []) {
      if (g.status === 'pendente_giro') {
        gamificacao.girosDisponiveisRoleta.push({
          profissional: g.profissionalNome,
          motivo: g.motivo || 'Meta atingida',
          data: g.dataReferencia,
        });
      } else if (g.status === 'girado' && !g.entregueEm) {
        gamificacao.premiosPendentesEntrega.push({
          id: g.id,
          profissional: g.profissionalNome,
          premio: g.premioGanho,
          giradoEm: g.giradoEm,
        });
      }
    }
  } catch (err) {}

  // 6. Carteira de Clientes (Base 9.365 clientes)
  let carteiraClientes = {
    totalGeralClientes: 9365,
    resumoPorBarbeiro: [],
    emDia: 0,
    idealRetorno: 0,
    atrasados: 0,
    sumidos30Dias: 0,
  };

  try {
    const resCarteira = dinoCarteiraClientes.resumoCarteirasProfissionais(empId, { lojaId: ljId });
    if (resCarteira) {
      carteiraClientes.totalGeralClientes = Math.max(9365, number(resCarteira.totalGeralClientes));
      carteiraClientes.resumoPorBarbeiro = (resCarteira.profissionais || []).map((p) => ({
        nome: p.profissionalNome,
        apelido: p.profissionalApelido || p.profissionalNome,
        totalClientes: p.totalClientes || 0,
        emDia: p.emDia || 0,
        atrasados: p.atrasados || 0,
        sumidos: p.sumidos || 0,
      }));
      carteiraClientes.emDia = (resCarteira.profissionais || []).reduce((acc, p) => acc + (p.emDia || 0), 0);
      carteiraClientes.idealRetorno = (resCarteira.profissionais || []).reduce((acc, p) => acc + (p.idealRetorno || 0), 0);
      carteiraClientes.atrasados = (resCarteira.profissionais || []).reduce((acc, p) => acc + (p.atrasados || 0), 0);
      carteiraClientes.sumidos30Dias = (resCarteira.profissionais || []).reduce((acc, p) => acc + (p.sumidos || 0), 0);
    }
  } catch (err) {}

  // 7. Planos VIP e Pacotes de Procedimentos
  let planosVIP = {
    regrasPacotes: [
      { procedimentos: 4, desconto: '10% de desconto', descricao: 'Pacote 4 procedimentos (corte/barba)' },
      { procedimentos: 6, desconto: '15% de desconto', descricao: 'Pacote 6 procedimentos' },
      { procedimentos: 8, desconto: '20% de desconto', descricao: 'Pacote 8 ou mais procedimentos' },
    ],
    regrasPrecosDiferenciados: 'Naty e Bruno têm valor de R$ 100 por procedimento base nos pacotes; demais barbeiros seguem tabela padrão da equipe base.',
    regraPlanoClub: 'Assinatura Mensal ilimitada válida de SEGUNDA A QUARTA-FEIRA, exclusiva com a equipe base (David e novos barbeiros). NÃO cobre atendimentos com Naty, Bruno ou Dino.',
    planosCadastrados: [],
  };

  try {
    const planos = barbeariaErpKytto.listarPlanos(empId);
    planosVIP.planosCadastrados = (planos || []).map((pl) => ({
      id: pl.id,
      nome: pl.nome,
      preco: number(pl.preco),
      regras: pl.descricao || pl.regras || '',
    }));
  } catch (err) {}

  return {
    empresa: {
      id: empId,
      nome: canal?.configuracao?.display_name || canal?.nome || 'Barbearia Dino',
      unidade: ljId,
      hoje: dataIso,
      diaSemana,
      hora,
      dataExtenso: `${diaSemana}, ${dataFormatada} às ${hora}`,
    },
    financeiro,
    agendaHoje: {
      ...agendaHoje,
      comandasAbertasCadeira,
      faturamentoProdutosHoje,
      produtosVendidosQtdHoje,
    },
    equipe,
    gamificacao,
    carteiraClientes,
    planosVIP,
  };
}

// ============================================================================
// SYSTEM PROMPT EXECUTIVO PARA O WHATSAPP GESTÃO
// ============================================================================
export function buildDinoGestaoSystemPrompt({ channel, snapshot }) {
  const s = snapshot;
  const snapJson = JSON.stringify(s, null, 2);

  return `Você é o Copiloto Executivo e Consultor de Negócios da Barbearia Dino no WhatsApp Gestão.
Você conversa DIRETAMENTE com o empresário e proprietário Dino (Guilherme Cunha Martins).

DIRETRIZES FUNDAMENTAIS DE COMUNICAÇÃO:
1. TRATAMENTO: Trate o Dino com respeito, parceria e linguagem profissional acolhedora ("Fala Dino!", "Fala chefia!", "Grande Dino!"). Seja direto, sem rodeios ou enrolação.
2. ÁUDIOS DO DINO E VALIDAÇÃO DE IDENTIDADE: Como medida de segurança, o sistema extrai o texto da voz (marcado como "[áudio transcrito]"). No primeiro contato do dia ou se for um áudio suspeito, ANTES de liberar qualquer dado financeiro ou estratégico, EXIJA A VALIDAÇÃO: peça educadamente para o empresário confirmar a identidade informando a "Palavra-Chave de Gestor" ou gravando o "Código de Voz". Enquanto ele não validar, negue o acesso aos números do negócio. Após validado, responda com prontidão executiva, destacando os números em negrito.
3. PRECISÃO NUMÉRICA: Sempre que citar valores monetários, formate como moeda brasileira em negrito: *R$ 1.250,00*. Destaque totais, quantidades e percentuais.
4. ESTRUTURA VISUAL & GRÁFICOS: Responda usando tópicos limpos e fáceis de ler no celular. Se o Dino pedir "gráficos", "reports visuais", "análises visuais" ou você precisar comparar dados longos (como desempenho da equipe, clientes sumidos vs em dia), use a API pública QuickChart (chart.js) gerando uma URL e retornando no formato Markdown Image \`![Gráfico](https://quickchart.io/chart?c={json_url_encoded})\`. Sempre retorne a imagem como parte da resposta textualmente.
5. PROATIVIDADE COMERCIAL & GESTÃO: Além de responder o que foi perguntado, aponte oportunidades operacionais (ex.: barbeiros que estão quase batendo meta, clientes sumidos para reativar, giros pendentes da roleta para realizar).

REGRAS DE NEGÓCIO E BASE DE CONHECIMENTO DA BARBEARIA DINO:
- METAS DIÁRIAS & ROLETA:
  * Meta diária de serviços extras: realizar ${s.gamificacao?.regras?.metaDiariaExtrasQtd || 6} extras no dia = ganha 1 giro na roleta.
  * Meta diária de produtos: meta por quantidade (${s.gamificacao?.regras?.metaDiariaProdutosQtd || 2} produtos) ou valor (*R$ ${s.gamificacao?.regras?.metaDiariaProdutosValor || 100},00*). Atingindo = ganha 1 giro na roleta.
  * Onde gerenciar e registrar os giros: Menu Lateral -> Barbearia -> Gestão -> Metas & Roleta (/admin/barbearia-erp?area=gestao&tab=Metas+%26+roleta).
  * Prêmios da roleta: Pix R$ 50, Vale Hambúrguer/Almoço, Folga Meio Período, Pomada/Produto Grátis, Pix R$ 20, Café Especial, Pix R$ 100.

- PACOTES DE PROCEDIMENTOS (DESCONTO PROGRESSIVO):
  * 4 procedimentos: 10% de desconto.
  * 6 procedimentos: 15% de desconto.
  * 8 ou mais procedimentos: 20% de desconto.
  * Procedimentos com Naty e Bruno têm preço base de *R$ 100,00* cada (diferente da equipe base). Podem ser usados em qualquer dia com o profissional contratado.
  * Onde cadastrar/alterar: Barbearia -> Catálogo e Equipe -> Planos e assinaturas (/admin/barbearia-erp?area=catalogo&tab=Planos+e+assinaturas).

- PLANO CLUB (ASSINATURA MENSAL):
  * Assinatura mensal com cortes e barba ilimitados de SEGUNDA A QUARTA-FEIRA.
  * Válido EXCLUSIVAMENTE com a equipe base (David e novos barbeiros). NÃO cobre atendimentos com Naty, Bruno ou Dino.

- METAS PROGRESSIVAS & COMISSÕES DA EQUIPE:
  * Naty tem comissão base de 40%, subindo progressivamente ao bater faixas de faturamento (+5% na Meta 1, +7% na Meta 2, +10% na Meta 3).
  * Comissão de produtos: base de 10% + bônus sobre vendas.
  * Onde configurar: Barbearia -> Gestão -> Metas e comissões (/admin/barbearia-erp?area=gestao&tab=Metas+e+comiss%C3%B5es).

- DÚVIDAS OPERACIONAIS COMUNS DO GESTOR (FAQ DINO):
  * "Como tirar quem não está mais na empresa? Excluo mas não sai": Para manter a integridade fiscal, histórico contábil e comissões passadas, o profissional não deve ser excluído do banco. Ele deve ser INATIVADO: Acesse *Barbearia -> Catálogo e Equipe -> Profissionais*, clique em Editar no profissional e desmarque a opção "Ativo". Ele deixará de aparecer na agenda e comanda imediatamente.
  * "Perfumes de teste do e-commerce posso excluir? E lançar perfumes vendidos na barbearia?": Pedidos testes podem ser cancelados ou expurgados em E-commerce -> Pedidos. Vendas de perfumes na barbearia presencial podem ser feitas diretamente pelo Caixa/PDV ou lançadas na comanda do cliente no momento do corte, garantindo a comissão do barbeiro.
  * "App do Profissional / Modo Barbeiro no celular": Cada barbeiro acessa pelo link /barbeiro ou /barbeiro/login em seu próprio celular, visualizando sua cadeira, atendimentos, faturamento, comissões em tempo real e carteira de clientes.

- SEGURANÇA OPERACIONAL:
  * Este canal é estritamente informativo e executivo: não efetua Pix, pagamento, transferência bancária ou baixa automática pelo WhatsApp. Para lançar notas e recibos de despesas, oriente o canal WhatsApp Lançamentos.

- RELATÓRIO DIÁRIO DE PERFORMANCE & AUDITORIA OPERACIONAL (08H00):
  * O T-Rex compila diariamente o relatório com 4 quadrantes operacionais em alta definição (1080p) e legenda detalhada.
  * O canal oficial de WhatsApp Gestão está configurado com o número oficial do gestor: +55 65 99672-2055 (Guilherme Dino).
  * Se o Dino (+55 65 99672-2055) ou Rodrigo (+55 14 99746-2929) pedir para enviar, disparar ou atualizar o relatório no grupo de gestão (ex: "envia o report no grupo", "disparar relatório", "!report", "manda o relatório de performance"), verifique a autorização. Se ele já pediu explicitamente, execute imediatamente a ferramenta "disparar_report_gestao_grupo" e confirme a transmissão para o grupo Gestão Dino com o link do infográfico 1080p.

SNAPSHOT OPERACIONAL CONSOLIDADO DA BARBEARIA DINO EM TEMPO REAL:
${snapJson}`;
}

// ============================================================================
// DECLARAÇÃO DE FERRAMENTAS EXECUTIVAS PARA MOTOR KYTTOIA NO WHATSAPP GESTÃO
// ============================================================================
export const DINO_GESTAO_TOOLS = [
  {
    name: 'consultar_indicadores_hoje',
    description: 'Consulta o resumo executivo e operacional completo de HOJE da Barbearia Dino: faturamento do dia (serviços + produtos revenda + e-commerce), total de atendimentos concluídos, em andamento e agendados, comandas abertas na cadeira, ticket médio e ocupação da equipe.',
    parameters: {
      type: 'OBJECT',
      properties: {
        detalharPorBarbeiro: { type: 'BOOLEAN', description: 'Se verdadeiro, discrimina a quantidade de atendimentos e faturamento de cada barbeiro hoje' },
      },
    },
  },
  {
    name: 'consultar_faturamento_periodo',
    description: 'Consulta o faturamento e receitas em um período selecionado (hoje, ontem, ultimos_7_dias, ultimos_30_dias, mes_atual), discriminando receitas de serviços, produtos de revenda e e-commerce de perfumaria.',
    parameters: {
      type: 'OBJECT',
      properties: {
        periodo: {
          type: 'STRING',
          enum: ['hoje', 'ontem', 'ultimos_7_dias', 'ultimos_30_dias', 'mes_atual'],
          description: 'Período desejado para a apuração',
        },
      },
      required: ['periodo'],
    },
  },
  {
    name: 'consultar_desempenho_equipe',
    description: 'Consulta a performance individual da equipe da barbearia (Dino, Naty, Bruno, David, Amanda, João, Steffany, Jhenyffer): atendimentos realizados, produtos vendidos, faturamento bruto gerado e comissões/repasses acumulados (comissões base e bônus progressivos).',
    parameters: {
      type: 'OBJECT',
      properties: {
        profissionalNome: { type: 'STRING', description: 'Nome ou apelido do profissional (ex.: Naty, Bruno, David, Dino, Amanda) ou vazio para listar toda a equipe' },
        periodo: { type: 'STRING', enum: ['hoje', 'semana', 'mes'], description: 'Período de apuração (padrão: hoje)' },
      },
    },
  },
  {
    name: 'consultar_metas_roleta',
    description: 'Consulta a apuração de metas e a roleta de premiações: quem bateu a meta diária de serviços extras (alvo 6 extras), quem bateu a meta diária de produtos por quantidade ou valor, giros disponíveis da roleta por profissional, últimos prêmios sorteados e prêmios pendentes de entrega pelo gestor.',
    parameters: {
      type: 'OBJECT',
      properties: {
        dia: { type: 'STRING', description: 'Data YYYY-MM-DD (vazio = hoje)' },
      },
    },
  },
  {
    name: 'consultar_agenda_barbearia',
    description: 'Consulta a agenda de atendimentos da barbearia para hoje ou data específica: quantidade de agendamentos por status (concluído, confirmado, pendente, cancelado), faturamento projetado, próximos clientes agendados e horários disponíveis por profissional.',
    parameters: {
      type: 'OBJECT',
      properties: {
        data: { type: 'STRING', description: 'Data no formato YYYY-MM-DD (vazio = hoje)' },
        profissionalNome: { type: 'STRING', description: 'Filtrar por nome de um profissional específico (ex.: Dino, Nat, Bruno, David)' },
      },
    },
  },
  {
    name: 'consultar_carteira_clientes',
    description: 'Consulta a carteira e relacionamento da base de clientes da Dino (9.365 clientes cadastrados): total geral, distribuição por barbeiro titular, clientes com retorno ideal/em dia, clientes atrasados e clientes sumidos há mais de 30 ou 45 dias sem retorno.',
    parameters: {
      type: 'OBJECT',
      properties: {
        barbeiroNome: { type: 'STRING', description: 'Nome do barbeiro para ver a sua carteira exclusiva (ex.: Dino, Naty, Bruno, David)' },
        filtroRetorno: { type: 'STRING', enum: ['todos', 'em_dia', 'atrasados', 'sumidos'], description: 'Filtrar clientes por status de retorno' },
      },
    },
  },
  {
    name: 'consultar_contas_financeiro',
    description: 'Consulta a situação financeira da empresa: saldo consolidado em contas/caixa, despesas e contas a pagar (vencendo hoje, na semana ou no mês) e contas a receber pendentes.',
    parameters: {
      type: 'OBJECT',
      properties: {
        tipo: { type: 'STRING', enum: ['saldo', 'a_pagar', 'a_receber', 'todas'], description: 'Tipo de consulta financeira' },
      },
    },
  },
  {
    name: 'consultar_planos_e_clubes',
    description: 'Consulta os planos de assinatura e pacotes de procedimentos: assinaturas ativas do Clube VIP, regras do plano Club (ilimitado seg a qua com equipe base David/novos, sem cobertura Naty/Bruno/Dino) e pacotes com desconto progressivo de 4 (10%), 6 (15%) e 8 (20%) procedimentos com preços base da Naty e Bruno.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'consultar_guia_e_procedimentos',
    description: 'Consulta a base de conhecimento e passo a passo de procedimentos administrativos da barbearia (ex.: como inativar profissionais que saíram sem perder histórico, como cadastrar novos pacotes ou barbeiros, como configurar as metas da Naty, como funciona o App do Profissional no celular, como registrar giros da roleta, vendas de perfumes no PDV/Caixa).',
    parameters: {
      type: 'OBJECT',
      properties: {
        topico: { type: 'STRING', description: 'Assunto ou dúvida administrativa do gestor' },
      },
      required: ['topico'],
    },
  },
  {
    name: 'registrar_aprendizado_preferencia',
    description: 'Aprende e salva uma preferência, meta, feedback ou insight do gestor Dino para usar nas próximas interações. Use quando ele disser "lembre-se que...", "a partir de agora..." ou corrigir a IA.',
    parameters: {
      type: 'OBJECT',
      properties: {
        insight: { type: 'STRING', description: 'A regra de negócio, preferência de relatório ou conhecimento ensinado pelo empresário' },
      },
      required: ['insight'],
    },
  },
  {
    name: 'disparar_report_gestao_grupo',
    description: 'Dispara o Relatório Diário de Performance Operacional do T-Rex (com 4 infográficos em alta definição 1080p e diagnóstico do Motor KyttoIA) para o canal oficial e grupo Gestão Dino no WhatsApp. Requer solicitação expressa ou autorização prévia do gestor Guilherme Dino (+55 65 99672-2055) ou Rodrigo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        motivo: { type: 'STRING', description: 'Motivo da invocação (ex: solicitacao_gestor_whatsapp, autorizacao_08h, sob_demanda)' },
        destinatario: { type: 'STRING', description: 'Número do gestor autorizador (padrão: 5565996722055)' },
      },
    },
  },
  {
    name: 'consultar_fechamento_diario',
    description: 'Consulta ou dispara o fechamento diário consolidado da Barbearia Dino (receita total, serviços, produtos, comandas pagas, ticket médio, produção por barbeiro, pagamentos e alertas de estoque). Pode enviar diretamente para o grupo Gestão Dino e Guilherme Dino (+55 65 99672-2055).',
    parameters: {
      type: 'OBJECT',
      properties: {
        enviarNoGrupo: { type: 'BOOLEAN', description: 'Se verdadeiro, além de responder no chat envia o fechamento para o grupo Gestão Dino' },
        data: { type: 'STRING', description: 'Data YYYY-MM-DD (vazio = hoje)' },
      },
    },
  },
  {
    name: 'consultar_satisfacao_nps',
    description: 'Consulta o ranking de satisfação dos clientes e notas de avaliação pós-atendimento (NPS de 1 a 5) da equipe de barbeiros (Dino, Bruno, Natani, João Victor) da Barbearia Dino.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
];

// ============================================================================
// EXECUTOR DE FERRAMENTAS EXECUTIVAS PARA O GESTOR
// ============================================================================
export async function executarFerramentaGestao(name, args = {}, context = {}) {
  const empId = resolverEmpresaId(context.empresaId || context.empresa_id);
  const ljId = resolverLojaId(empId, context.lojaId || context.loja_id);
  const snap = buildDinoGestaoSnapshot({ empresaId: empId, lojaId: ljId });

  if (name === 'consultar_indicadores_hoje') {
    return {
      data: snap.empresa.dataExtenso,
      faturamentoHoje: formatBrl(snap.financeiro.receitasHoje),
      servicosFaturamento: formatBrl(snap.agendaHoje.faturamentoServicosHoje),
      produtosFaturamento: formatBrl(snap.agendaHoje.faturamentoProdutosHoje),
      totalAtendimentos: snap.agendaHoje.total,
      concluidos: snap.agendaHoje.concluidos,
      emAndamento: snap.agendaHoje.emAndamento,
      confirmados: snap.agendaHoje.confirmados,
      pendentes: snap.agendaHoje.pendentes,
      cancelados: snap.agendaHoje.cancelados,
      comandasAbertasCadeira: snap.agendaHoje.comandasAbertasCadeira,
      ocupacaoPorBarbeiro: snap.agendaHoje.ocupacaoPorBarbeiro,
    };
  }

  if (name === 'consultar_faturamento_periodo') {
    const periodo = args.periodo || 'hoje';
    return {
      periodo,
      empresa: snap.empresa.nome,
      receitasHoje: formatBrl(snap.financeiro.receitasHoje),
      receitasMes: formatBrl(snap.financeiro.receitasMes),
      despesasMes: formatBrl(snap.financeiro.despesasMes),
      resultadoMes: formatBrl(snap.financeiro.resultadoMes),
      saldoAtual: formatBrl(snap.financeiro.saldo),
      aReceber: formatBrl(snap.financeiro.aReceber),
    };
  }

  if (name === 'consultar_desempenho_equipe') {
    const profFiltro = String(args.profissionalNome || '').trim().toLowerCase();
    let lista = snap.equipe;
    if (profFiltro) {
      lista = lista.filter((p) =>
        p.nome.toLowerCase().includes(profFiltro) ||
        p.apelido.toLowerCase().includes(profFiltro)
      );
    }
    return {
      totalProfissionaisAtivos: snap.equipe.length,
      equipe: lista.map((p) => ({
        nome: p.nome,
        apelido: p.apelido,
        cargo: p.cargo,
        atendimentosHoje: p.atendimentosHoje,
        faturamentoHoje: formatBrl(p.faturamentoHoje),
        comissaoHoje: formatBrl(p.comissaoHoje),
        atendimentosMes: p.atendimentosMes,
        faturamentoMes: formatBrl(p.faturamentoMes),
        comissaoMes: formatBrl(p.comissaoMes),
      })),
    };
  }

  if (name === 'consultar_metas_roleta') {
    return {
      dataApuracao: snap.empresa.hoje,
      regras: snap.gamificacao.regras,
      profissionaisHoje: snap.gamificacao.apuracaoHoje,
      girosDisponiveisRoleta: snap.gamificacao.girosDisponiveisRoleta,
      premiosRoleta: snap.gamificacao.premiosRoleta,
      premiosPendentesEntrega: snap.gamificacao.premiosPendentesEntrega,
      linkPainelMetas: 'https://kytto.com.br/admin/barbearia-erp?area=gestao&tab=Metas+%26+roleta',
    };
  }

  if (name === 'consultar_agenda_barbearia') {
    return {
      data: args.data || snap.empresa.hoje,
      totalAgendamentos: snap.agendaHoje.total,
      concluidos: snap.agendaHoje.concluidos,
      emAndamento: snap.agendaHoje.emAndamento,
      confirmados: snap.agendaHoje.confirmados,
      pendentes: snap.agendaHoje.pendentes,
      cancelados: snap.agendaHoje.cancelados,
      valorProjetado: formatBrl(snap.agendaHoje.valorProjetado),
      ocupacaoPorBarbeiro: snap.agendaHoje.ocupacaoPorBarbeiro,
      linkAgenda: 'https://kytto.com.br/admin/barbearia-erp?area=operacao&tab=Agenda',
    };
  }

  if (name === 'consultar_carteira_clientes') {
    const barbeiroFiltro = String(args.barbeiroNome || '').trim().toLowerCase();
    let lista = snap.carteiraClientes.resumoPorBarbeiro;
    if (barbeiroFiltro) {
      lista = lista.filter((b) =>
        b.nome.toLowerCase().includes(barbeiroFiltro) ||
        b.apelido.toLowerCase().includes(barbeiroFiltro)
      );
    }
    return {
      totalGeralClientes: snap.carteiraClientes.totalGeralClientes,
      clientesEmDia: snap.carteiraClientes.emDia,
      clientesAtrasados: snap.carteiraClientes.atrasados,
      clientesSumidos30Dias: snap.carteiraClientes.sumidos30Dias,
      distribuicaoPorBarbeiro: lista,
      linkCarteira: 'https://kytto.com.br/admin/barbearia-erp?area=gestao&tab=Carteira+de+clientes',
    };
  }

  if (name === 'consultar_contas_financeiro') {
    return {
      saldoAtual: formatBrl(snap.financeiro.saldo),
      aPagarHoje: formatBrl(snap.financeiro.aPagarHoje),
      aPagarSemana: formatBrl(snap.financeiro.aPagarSemana),
      totalAPagarMes: formatBrl(snap.financeiro.aPagar),
      totalAReceberMes: formatBrl(snap.financeiro.aReceber),
      linkFinanceiro: 'https://kytto.com.br/admin/financeiro',
    };
  }

  if (name === 'consultar_planos_e_clubes') {
    return {
      regrasPacotes: snap.planosVIP.regrasPacotes,
      regrasPrecosDiferenciados: snap.planosVIP.regrasPrecosDiferenciados,
      regraPlanoClub: snap.planosVIP.regraPlanoClub,
      planosCadastrados: snap.planosVIP.planosCadastrados,
      linkPlanos: 'https://kytto.com.br/admin/barbearia-erp?area=catalogo&tab=Planos+e+assinaturas',
    };
  }

  if (name === 'consultar_guia_e_procedimentos') {
    const topico = String(args.topico || '').toLowerCase();

    if (topico.includes('inativ') || topico.includes('tirar') || topico.includes('excluir') || topico.includes('saiu') || topico.includes('demit')) {
      return {
        titulo: 'Como inativar profissionais que saíram da barbearia',
        explicacao: 'Para preservar histórico contábil, registros fiscais, agendamentos passados e cálculo de comissões, o sistema não exclui o profissional do banco de dados: ele deve ser inativado.',
        passoAPasso: [
          '1. Acesse o menu lateral: Barbearia -> Catálogo e Equipe -> aba Profissionais',
          '2. Localize o profissional na lista e clique em Editar',
          '3. Desmarque a opção "Ativo" (ou mude o status para Inativo)',
          '4. Clique em Salvar. Ele sumirá imediatamente da agenda e de novas comandas, mantendo todos os relatórios intactos.',
        ],
        linkDireto: 'https://kytto.com.br/admin/barbearia-erp?area=catalogo&tab=Profissionais',
      };
    }

    if (topico.includes('pacote') || topico.includes('procedimento') || topico.includes('desconto')) {
      return {
        titulo: 'Regras dos Pacotes de Procedimentos',
        regras: [
          'Pacote 4 procedimentos: 10% de desconto',
          'Pacote 6 procedimentos: 15% de desconto',
          'Pacote 8 ou mais procedimentos: 20% de desconto',
          'Procedimentos com Naty e Bruno têm preço base de R$ 100,00 cada; equipe base segue tabela padrão',
          'Podem ser utilizados em qualquer dia da semana com o profissional contratado',
        ],
        ondeCadastrar: 'Barbearia -> Catálogo e Equipe -> aba Planos e assinaturas',
        linkDireto: 'https://kytto.com.br/admin/barbearia-erp?area=catalogo&tab=Planos+e+assinaturas',
      };
    }

    if (topico.includes('club') || topico.includes('assinatura') || topico.includes('segunda a quarta')) {
      return {
        titulo: 'Regras do Plano Club (Assinatura Mensal)',
        regras: [
          'Cortes e barba ilimitados de segunda a quarta-feira',
          'Válido exclusivamente com a equipe base (David e novos barbeiros)',
          'Não cobre atendimentos com Naty, Bruno ou Dino',
        ],
        ondeCadastrar: 'Barbearia -> Catálogo e Equipe -> aba Planos e assinaturas',
        linkDireto: 'https://kytto.com.br/admin/barbearia-erp?area=catalogo&tab=Planos+e+assinaturas',
      };
    }

    if (topico.includes('roleta') || topico.includes('meta') || topico.includes('premio') || topico.includes('giro')) {
      return {
        titulo: 'Como funciona a Roleta de Premiações e Metas',
        regras: [
          'Meta diária de serviços extras: 6 extras realizados no dia = ganha 1 giro na roleta',
          'Meta diária de produtos: meta por quantidade (2 produtos) ou valor (R$ 100) = ganha 1 giro',
          'A apuração é automática assim que a comanda é concluída',
          'O gestor abre a roleta, roda o sorteio e marca a entrega do prêmio',
        ],
        ondeAcessar: 'Barbearia -> Gestão -> aba Metas & Roleta',
        linkDireto: 'https://kytto.com.br/admin/barbearia-erp?area=gestao&tab=Metas+%26+roleta',
      };
    }

    if (topico.includes('app') || topico.includes('barbeiro') || topico.includes('celular') || topico.includes('login')) {
      return {
        titulo: 'Acesso da equipe ao App do Profissional / Modo Barbeiro',
        linkAcesso: 'https://setpoint.kytto.com.br/barbeiro',
        recursos: [
          'Visualização da cadeira de atendimento atual',
          'Agenda do dia e próximos horários',
          'Aba Meus Ganhos com comissões do dia, da semana e do mês em tempo real',
          'Aba Minha Carteira com clientes e tempo sem retorno',
          'Progresso de metas diárias e giros da roleta acumulados',
        ],
      };
    }

    if (topico.includes('perfume') || topico.includes('loja') || topico.includes('revenda') || topico.includes('pdv')) {
      return {
        titulo: 'Vendas de Perfumes e Revenda Presencial na Barbearia',
        explicacao: 'Vendas presenciais de perfumes podem ser lançadas diretamente na comanda do cliente ou no Caixa/PDV, dando a baixa automática no estoque e creditando a comissão do barbeiro (base 10% + metas de produtos). Pedidos testes do site podem ser expurgados em E-commerce -> Pedidos.',
        linkDireto: 'https://kytto.com.br/admin/barbearia-erp?area=operacao&tab=Atendimento',
      };
    }

    return {
      titulo: 'Central de Ajuda da Gestão Barbearia Dino',
      topicosDisponiveis: [
        'Como inativar quem saiu da barbearia',
        'Regras dos pacotes de 4, 6 e 8 procedimentos',
        'Regras do Plano Club (segunda a quarta com equipe base)',
        'Controle de metas e giros da roleta',
        'App do Profissional no celular da equipe (/barbeiro)',
        'Vendas de perfumes no PDV e comissões',
      ],
      linkPainelGeral: 'https://kytto.com.br/admin/barbearia-erp',
    };
  }

  if (name === 'disparar_report_gestao_grupo') {
    const { enviarReportGraficosDino } = await import('./core/dino-daily-report-graph.js');
    const gestorNum = args.destinatario || '5565996722055';
    const resDisparo = await enviarReportGraficosDino({
      forcar: true,
      empresaId: empId,
      destinatario: gestorNum,
    });
    return {
      ok: resDisparo.ok,
      canal: 'WhatsApp Gestão Dino',
      numeroGestor: '+55 65 99672-2055 (Guilherme Dino)',
      graficosUrl: 'https://kytto.com.br/reports/dino-performance-diario.png',
      diaChave: resDisparo.diaChave,
      mensagem: resDisparo.ok
        ? 'Relatório de Performance com gráficos 1080p compilado e disparado com sucesso para o canal oficial e grupo Gestão Dino!'
        : 'Relatório compilado, mas o envio encontrou instabilidade no canal de WhatsApp. A imagem 1080p está disponível no link direto.',
    };
  }

  if (name === 'consultar_fechamento_diario') {
    const { consolidarResumoDiario, formatarMensagemBriefingGestao } = await import('./core/automacao-resumo-gestao.js');
    const resumo = consolidarResumoDiario(empId, args.data || null);
    const mensagemTexto = formatarMensagemBriefingGestao(resumo);
    if (args.enviarNoGrupo) {
      const { dispararFechamentoGestaoDino } = await import('./core/dino-whats-gestao-hub.js');
      await dispararFechamentoGestaoDino({ empresaId: empId, dataStr: args.data || null });
    }
    return {
      data: resumo.dataBr,
      totalFaturado: resumo.totalFaturadoFormatado,
      totalServicos: resumo.totalServicosFormatado,
      totalProdutos: resumo.totalProdutosFormatado,
      clientesAtendidos: resumo.clientesAtendidos,
      ticketMedio: resumo.ticketMedioFormatado,
      formasPagamento: resumo.formasPagamento,
      producaoBarbeiros: resumo.producaoBarbeiros,
      itensAlertaEstoque: resumo.itensAlertaEstoque,
      textoFormatado: mensagemTexto
    };
  }

  if (name === 'consultar_satisfacao_nps') {
    const { listarEstatisticasNps, formatarMensagemRankingNps } = await import('./core/dino-whats-gestao-hub.js');
    const stats = listarEstatisticasNps();
    return {
      notaMediaGeral: stats.notaMediaGeral,
      totalAvaliacoes: stats.totalAvaliacoes,
      desempenhoPorBarbeiro: stats.desempenhoPorBarbeiro,
      textoFormatado: formatarMensagemRankingNps()
    };
  }

  throw new Error(`Ferramenta desconhecida no canal de gestão: ${name}`);
}
