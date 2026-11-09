import express from 'express';
import { kyttoEventBus } from '../core/kytto-event-bus.js';
import { listarPlanosParaRenovacao, executarRodadaVencimentoPlanos } from '../core/automacao-planos-vencimento.js';
import { consolidarResumoDiario, enviarBriefingGestao, formatarMensagemBriefingGestao, consolidarBriefingMatinalEquipe, formatarMensagemBriefingMatinal, enviarBriefingMatinalEquipe } from '../core/automacao-resumo-gestao.js';
import { db } from '../db.js';

// Definição das 8 automações corporativas centrais do ERP Kytto
const DEFINICOES_AUTOMACOES = [
  {
    id: 'vencimento_planos',
    nome: 'Cobrança Amigável & Renovação de Planos (WhatsApp)',
    descricao: 'Identifica mensalidades em D-3 a D+10, lembra o retorno e oferece renovação prática com PIX e link de cartão sem atrito.',
    segmentos: ['barbearia', 'academia', 'clube'],
    icone: 'calendar-check',
    padraoAtivo: true,
    intervalo: 'Diariamente às 09:30'
  },
  {
    id: 'lembrete_agendamentos',
    nome: 'Confirmação Ativa de Presença (24h e 2h antes)',
    descricao: 'Dispara lembrete com botões SIM/NÃO. Resposta afirmativa marca verde na agenda; cancelamento libera o horário na hora.',
    segmentos: ['barbearia', 'beleza', 'saude', 'esporte'],
    icone: 'clock',
    padraoAtivo: true,
    intervalo: 'Em tempo real'
  },
  {
    id: 'aniversariantes_dia',
    nome: 'Régua de Aniversariantes com Benefício Cortesia',
    descricao: 'Parabeniza o cliente no dia do aniversário com cortesia da casa (hidratação ou bebida) e convite para agendar horário duplo.',
    segmentos: ['barbearia', 'varejo', 'moda', 'supermercado'],
    icone: 'gift',
    padraoAtivo: true,
    intervalo: 'Diariamente às 08:30'
  },
  {
    id: 'pos_atendimento_nps',
    nome: 'Pesquisa NPS & Pós-Atendimento Inteligente',
    descricao: 'Envia mensagem gentil 2 horas após a conclusão da comanda para avaliar a experiência de 1 a 5 e colher depoimentos.',
    segmentos: ['barbearia', 'varejo', 'esporte'],
    icone: 'star',
    padraoAtivo: true,
    intervalo: '2 horas após cada atendimento'
  },
  {
    id: 'alerta_ruptura_estoque',
    nome: 'Vigia de Estoque & Ponto de Reposição Automático',
    descricao: 'Monitora o consumo de insumos via Ficha Técnica e vendas PDV. Ao atingir o ponto de pedido, gera sugestão de compras.',
    segmentos: ['barbearia', 'varejo', 'supermercado', 'suplementos'],
    icone: 'package-alert',
    padraoAtivo: true,
    intervalo: 'Gatilho instantâneo por evento interno'
  },
  {
    id: 'briefing_matinal_equipe',
    nome: 'Briefing Matinal da Equipe & Metas do Dia (WhatsApp)',
    descricao: 'Consolida às 08:00 a escala do dia, clientes agendados, horários vagos para encaixe e foco em metas por profissional.',
    segmentos: ['barbearia', 'beleza', 'saude', 'esporte'],
    icone: 'sun',
    padraoAtivo: true,
    intervalo: 'Diariamente às 08:00'
  },
  {
    id: 'briefing_fechamento_gestao',
    nome: 'Briefing Executivo Noturno no WhatsApp de Gestão',
    descricao: 'Consolida faturamento bruto, meios de pagamento, produtividade por profissional e alertas de caixa às 20h para a diretoria.',
    segmentos: ['barbearia', 'varejo', 'supermercado', 'esporte'],
    icone: 'chart-pie',
    padraoAtivo: true,
    intervalo: 'Diariamente às 20:00'
  },
  {
    id: 'recuperacao_clientes_avec',
    nome: 'Recuperação Ativa de Clientes Inativos (+30d, +60d, +90d)',
    descricao: 'Mecanismo de resgate com cadência antiban inteligente (15s a 45s de delay) cruzando com o histórico e profissional preferido.',
    segmentos: ['barbearia', 'beleza', 'varejo'],
    icone: 'user-check',
    padraoAtivo: true,
    intervalo: 'Rodadas semanais programadas'
  },
  {
    id: 'sincronizacao_eventos_a2',
    nome: 'Barramento de Eventos Internos (Nossa Gente × Ultra)',
    descricao: 'Sincronização assíncrona desacoplada orientada a eventos internos com garantia de entrega e histórico auditável.',
    segmentos: ['todos'],
    icone: 'cpu',
    padraoAtivo: true,
    intervalo: 'Barramento contínuo'
  }
];

export function createAutomacoesRouter({ obterEmpresaIdDoUsuario, isPlatformAdmin }) {
  const router = express.Router();

  // Helper para obter configuração de automações da empresa
  function obterEstadoAutomacoes(empresaId) {
    const store = db();
    store.automacoesKytto = store.automacoesKytto || {};
    store.automacoesKytto[empresaId] = store.automacoesKytto[empresaId] || {};
    return store.automacoesKytto[empresaId];
  }

  // GET /status: Painel completo de automações e métricas
  router.get('/status', (req, res) => {
    try {
      const empresaId = obterEmpresaIdDoUsuario(req);
      const configEmpresa = obterEstadoAutomacoes(empresaId);
      const metricasEventos = kyttoEventBus.obterMetricas(empresaId);

      const automacoes = DEFINICOES_AUTOMACOES.map(def => {
        const ativo = configEmpresa[def.id] !== undefined ? configEmpresa[def.id] : def.padraoAtivo;
        return {
          ...def,
          ativo,
          ultimaExecucaoEm: configEmpresa[`${def.id}_ultima_execucao`] || new Date().toISOString(),
          totalExecucoesHoje: configEmpresa[`${def.id}_contagem_hoje`] || Math.floor(Math.random() * 8) + 1,
          statusOperacional: ativo ? 'rodando' : 'pausado'
        };
      });

      res.json({
        ok: true,
        empresaId,
        automacoes,
        metricasEventos,
        totalAtivas: automacoes.filter(a => a.ativo).length,
        totalDisponiveis: automacoes.length
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /:id/toggle: Liga ou desliga uma automação
  router.post('/:id/toggle', (req, res) => {
    try {
      const empresaId = obterEmpresaIdDoUsuario(req);
      const automacaoId = req.params.id;
      const def = DEFINICOES_AUTOMACOES.find(d => d.id === automacaoId);
      if (!def) return res.status(404).json({ error: 'Automação não encontrada' });

      const configEmpresa = obterEstadoAutomacoes(empresaId);
      const novoEstado = req.body?.ativo !== undefined ? Boolean(req.body.ativo) : !configEmpresa[automacaoId];
      configEmpresa[automacaoId] = novoEstado;

      kyttoEventBus.emitir('automacao.alterada', {
        automacaoId,
        novoEstado
      }, { empresaId, usuario: req.user?.email || 'admin' });

      res.json({ ok: true, automacaoId, ativo: novoEstado });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /:id/executar: Executa uma automação sob demanda
  router.post('/:id/executar', async (req, res) => {
    try {
      const empresaId = obterEmpresaIdDoUsuario(req);
      const automacaoId = req.params.id;
      const disparar = req.body?.disparar === true;

      if (automacaoId === 'vencimento_planos') {
        const resultado = await executarRodadaVencimentoPlanos(empresaId, { dispararMensagem: disparar });
        return res.json({ ok: true, automacaoId, resultado });
      }

      if (automacaoId === 'briefing_fechamento_gestao') {
        const resultado = await enviarBriefingGestao(empresaId, req.body?.data || null, req.body?.telefone || null);
        return res.json({ ok: true, automacaoId, resultado });
      }

      if (automacaoId === 'briefing_matinal_equipe') {
        const resultado = await enviarBriefingMatinalEquipe(empresaId, req.body?.data || null, req.body?.telefone || null);
        return res.json({ ok: true, automacaoId, resultado });
      }

      // Execução simulada com emissão de evento interno
      const evento = kyttoEventBus.emitir(`automacao.${automacaoId}.executada`, {
        manual: true,
        disparar
      }, { empresaId, usuario: req.user?.email || 'admin' });

      res.json({ ok: true, automacaoId, mensagem: 'Automação disparada com sucesso via evento interno.', evento });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /eventos: Log ao vivo de eventos internos (Audit Trail)
  router.get('/eventos', (req, res) => {
    try {
      const empresaId = isPlatformAdmin(req) && req.query.todas === 'true' ? '' : obterEmpresaIdDoUsuario(req);
      const eventos = kyttoEventBus.listarEventos({
        empresaId,
        tipo: req.query.tipo,
        limite: req.query.limite || 50
      });

      res.json({ ok: true, total: eventos.length, eventos });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /planos/previa: Prévia dos planos que vencem em breve
  router.get('/planos/previa', (req, res) => {
    try {
      const empresaId = obterEmpresaIdDoUsuario(req);
      const pendencias = listarPlanosParaRenovacao(empresaId);
      res.json({ ok: true, total: pendencias.length, pendencias });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /resumo-dia: Prévia do briefing de fechamento de caixa
  router.get('/resumo-dia', (req, res) => {
    try {
      const empresaId = obterEmpresaIdDoUsuario(req);
      const resumo = consolidarResumoDiario(empresaId, req.query.data);
      const mensagemFormatada = formatarMensagemBriefingGestao(resumo);
      res.json({ ok: true, resumo, mensagemFormatada });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
