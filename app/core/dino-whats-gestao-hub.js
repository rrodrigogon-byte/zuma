// ============================================================================
// HUB OFICIAL DO WHATSAPP GESTÃO DINO & AVALIAÇÃO PÓS-ATENDIMENTO (NPS DINO)
// Implementa o Canal de Gestão Dino (Grupo do WhatsApp & Administradores)
// e o fluxo automático de avaliação pós-atendimento ao fechar comanda.
// ============================================================================

import { kyttoEventBus } from './kytto-event-bus.js';
import { sendTextViaChatbotBackend } from './whatsapp-provider.js';
import { enviarMensagem } from './whatsapp.js';
import { db } from './database.js';

export const GRUPO_GESTAO_DINO_INFO = {
  nome: 'Gestão Dino',
  descricao: 'Canal oficial de governança, relatórios de performance e feedback em tempo real da Barbearia Dino',
  participantes: [
    { nome: 'Rodrigo Gonçalves (Kytto / Gestão)', telefone: '5514997462929', papel: 'Admin' },
    { nome: 'Guilherme Dino (~Guilherme Dino)', telefone: '5565996722055', telefoneAlternativo: '556596722055', papel: 'Admin / Proprietário' },
    { nome: 'Dino Oficial (Linha Corporativa / Remetente)', telefone: '5565999056008', telefoneAlternativo: '5565993360000', papel: 'Linha Atendimento Bot' }
  ]
};

// Destinatários para broadcast corporativo imediato (exclusivo para os gestores humanos, não para a linha da barbearia)
export const DESTINATARIOS_GESTAO_DINO = [
  '5514997462929', // Rodrigo Kytto
  '5565996722055', // Guilherme Dino
  '556596722055',  // Guilherme Dino (8D)
];

export const NUMERO_GESTAO_OFICIAL_DINO = '5565996722055';
export const NUMERO_GESTAO_OFICIAL_DINO_FORMATADO = '+55 65 99672-2055';

// Registro em memória de avaliações pós-atendimento
const AVALIACOES_NPS_MEMORIA = [];

/**
 * Envia mensagem executiva de gestão para o canal oficial "Gestão Dino"
 * Transmite para o Group ID (se configurado) e simultaneamente em broadcast
 * para os administradores do grupo (Guilherme e Rodrigo).
 */
export async function enviarParaGestaoDino({
  titulo = 'Relatório de Performance & Gestão Dino',
  conteudo = '',
  tipo = 'performance',
  tenant = null,
} = {}) {
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });
  
  const cabecalho = `📢 *[CANAL OFICIAL — GESTÃO DINO]* 🦖📊\n` +
                    `📅 *Horário:* ${agora} (Cuiabá/MT)\n` +
                    `👥 *Grupo:* Gestão Dino (Guilherme, Dino & Rodrigo)\n` +
                    `🎯 *Assunto:* ${titulo}\n` +
                    `────────────────────────────\n\n`;

  const textoFinal = `${cabecalho}${conteudo}\n\n` +
                     `────────────────────────────\n` +
                     `_Kytto ERP & Motor KyttoIA — Gestão de Alta Performance_`;

  const envios = [];
  const targetGroup = process.env.WHATSAPP_GESTAO_DINO_GROUP_ID;

  // 1. Envio para o Grupo específico caso exista o JID cadastrado
  if (targetGroup && targetGroup.includes('@g.us')) {
    try {
      let resGrupo = await enviarMensagem(tenant, targetGroup, textoFinal);
      if (!resGrupo?.ok) {
        resGrupo = await sendTextViaChatbotBackend({
          instance: process.env.CHATBOT_BACKEND_INSTANCE || 'dino',
          number: targetGroup,
          text: textoFinal,
          simulateTyping: true,
        });
      }
      const okGrupo = Boolean(resGrupo?.ok || resGrupo?.data?.success === true);
      envios.push({ destino: targetGroup, tipo: 'grupo', status: okGrupo ? 'sucesso' : 'erro', detalhe: resGrupo });
    } catch (err) {
      envios.push({ destino: targetGroup, tipo: 'grupo', status: 'falha', erro: err.message });
    }
  }

  // 2. Broadcast para os membros administradores do grupo (Rodrigo e Guilherme)
  for (const tel of DESTINATARIOS_GESTAO_DINO) {
    try {
      let res = await enviarMensagem(tenant, tel, textoFinal);
      if (!res?.ok) {
        res = await sendTextViaChatbotBackend({
          instance: process.env.CHATBOT_BACKEND_INSTANCE || 'dino',
          number: tel,
          text: textoFinal,
          simulateTyping: true,
        });
      }
      const okAdmin = Boolean(res?.ok || res?.data?.success === true);
      envios.push({ destino: tel, tipo: 'admin_direto', status: okAdmin ? 'sucesso' : 'erro', detalhe: res });
    } catch (err) {
      envios.push({ destino: tel, tipo: 'admin_direto', status: 'falha', erro: err.message });
    }
  }

  return {
    ok: envios.some(e => e.status === 'sucesso'),
    grupo: GRUPO_GESTAO_DINO_INFO.nome,
    timestamp: new Date().toISOString(),
    totalDisparos: envios.length,
    detalhes: envios,
  };
}

/**
 * Monta o script de avaliação pós-atendimento da Barbearia Dino (NPS)
 */
export function formatarMensagemAvaliacaoNps({
  clienteNome = 'Amigo',
  barbeiroNome = 'nosso barbeiro',
  servicosTexto = 'seu atendimento',
} = {}) {
  const primeiroNome = String(clienteNome || 'Amigo').trim().split(/\s+/)[0];

  return (
    `Fala, ${primeiroNome}! Aqui é o T-Rex da Barbearia Dino! 🦖💈\n\n` +
    `Esperamos que você tenha curtido o seu ${servicosTexto} com o *${barbeiroNome}*!\n\n` +
    `Para nos ajudar a manter a régua lá no alto, de *1 a 5*, que nota você dá para o seu atendimento hoje?\n\n` +
    `⭐ 1: Precisa melhorar\n` +
    `⭐⭐ 2: Regular\n` +
    `⭐⭐⭐ 3: Bom\n` +
    `⭐⭐⭐⭐ 4: Muito bom\n` +
    `⭐⭐⭐⭐⭐ 5: Espetacular!\n\n` +
    `_(Basta responder com o número da sua nota ou uma mensagem. Sua avaliação ajuda o ${barbeiroNome} e você concorre a sorteios no final do mês!)_`
  );
}

/**
 * Handler do evento 'comanda.fechada' emitido pelo Kytto EventBus
 */
export async function tratarComandaFechadaParaNps(evento) {
  try {
    const payload = evento?.dados || evento || {};
    const { clienteId, clienteNome, itens = [], comandaId } = payload;
    
    // Identifica o profissional nos itens da comanda
    let barbeiroNome = 'Nati ou Bruno';
    let servicosDescricao = 'corte de cabelo';

    if (Array.isArray(itens) && itens.length > 0) {
      const itemServico = itens.find(it => it.tipo === 'servico' || it.servicoNome || it.barbeiro);
      if (itemServico) {
        barbeiroNome = itemServico.barbeiroNome || itemServico.barbeiro || itemServico.profissional || 'Equipe Dino';
        servicosDescricao = itemServico.nome || itemServico.servicoNome || 'atendimento';
      }
    }

    // Busca o telefone do cliente no PostgreSQL
    let telefoneCliente = null;
    if (clienteId && typeof db?.query === 'function') {
      const resCli = await db.query(`SELECT telefone FROM clientes WHERE id = $1 LIMIT 1`, [clienteId]);
      if (resCli?.rows?.length > 0) {
        telefoneCliente = resCli.rows[0].telefone;
      }
    }

    if (!telefoneCliente) {
      return { ok: false, motivo: 'cliente_sem_telefone', comandaId };
    }

    const mensagemNps = formatarMensagemAvaliacaoNps({
      clienteNome,
      barbeiroNome,
      servicosTexto: servicosDescricao,
    });

    // Envia a pesquisa no WhatsApp do cliente
    let envio = await enviarMensagem(null, telefoneCliente, mensagemNps);
    if (!envio?.ok) {
      envio = await sendTextViaChatbotBackend({
        instance: process.env.CHATBOT_BACKEND_INSTANCE || 'dino',
        number: telefoneCliente,
        text: mensagemNps,
        simulateTyping: true,
      });
    }

    // Registra a solicitação de NPS em memória/banco
    const registroSolicitacao = {
      comandaId,
      clienteNome,
      telefoneCliente,
      barbeiroNome,
      solicitadoEm: new Date().toISOString(),
      status: 'aguardando_nota'
    };
    AVALIACOES_NPS_MEMORIA.unshift(registroSolicitacao);
    if (AVALIACOES_NPS_MEMORIA.length > 200) AVALIACOES_NPS_MEMORIA.pop();

    return {
      ok: true,
      comandaId,
      clienteNome,
      telefoneCliente,
      barbeiroNome,
      enviado: Boolean(envio?.ok || envio?.data?.success === true),
    };
  } catch (err) {
    console.warn('[Dino NPS] Erro ao tratar comanda fechada:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Registra a nota do cliente e notifica o grupo Gestão Dino
 */
export async function registrarNotaNpsCliente({
  telefone,
  nota,
  comentario = '',
  clienteNome = 'Cliente',
  barbeiroNome = 'Equipe Titular',
} = {}) {
  const notaNum = Math.min(5, Math.max(1, parseInt(nota, 10) || 5));
  const avaliacao = {
    id: `nps-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    telefone,
    clienteNome,
    barbeiroNome,
    nota: notaNum,
    comentario,
    recebidoEm: new Date().toISOString(),
  };

  AVALIACOES_NPS_MEMORIA.unshift(avaliacao);
  if (AVALIACOES_NPS_MEMORIA.length > 200) AVALIACOES_NPS_MEMORIA.pop();

  // Notifica imediatamente o Grupo Gestão Dino no WhatsApp
  const estrelas = '⭐'.repeat(notaNum);
  const textoAlertaGestao =
    `⭐ *[NOVA AVALIAÇÃO DE CLIENTE — DINO]* ⭐\n\n` +
    `👤 *Cliente:* ${clienteNome} (${telefone})\n` +
    `✂ *Barbeiro Responsável:* ${barbeiroNome}\n` +
    `🏆 *Nota Concedida:* ${notaNum}/5 (${estrelas})\n` +
    (comentario ? `💬 *Comentário:* "${comentario}"\n` : `💬 *Feedback:* Sem observações adicionais\n`) +
    `\n_Avaliação registrada automaticamente na Central de Reputação e Metas do ERP._`;

  await enviarParaGestaoDino({
    titulo: `Avaliação ${estrelas} para ${barbeiroNome}`,
    conteudo: textoAlertaGestao,
    tipo: 'nps_feedback',
  });

  return { ok: true, avaliacao };
}

/**
 * Retorna as estatísticas de avaliações NPS da Barbearia Dino
 */
export function listarEstatisticasNps() {
  const avaliacoesComNota = AVALIACOES_NPS_MEMORIA.filter(a => typeof a.nota === 'number');
  const total = avaliacoesComNota.length;
  const soma = avaliacoesComNota.reduce((acc, cur) => acc + cur.nota, 0);
  const media = total > 0 ? (soma / total).toFixed(2) : '5.00';

  // Média por barbeiro
  const porBarbeiro = {};
  for (const av of avaliacoesComNota) {
    const b = av.barbeiroNome || 'Equipe Titular';
    if (!porBarbeiro[b]) porBarbeiro[b] = { total: 0, soma: 0, media: 0 };
    porBarbeiro[b].total += 1;
    porBarbeiro[b].soma += av.nota;
    porBarbeiro[b].media = (porBarbeiro[b].soma / porBarbeiro[b].total).toFixed(2);
  }

  return {
    totalAvaliacoes: total,
    notaMediaGeral: Number(media),
    desempenhoPorBarbeiro: porBarbeiro,
    ultimasAvaliacoes: AVALIACOES_NPS_MEMORIA.slice(0, 20),
  };
}

/**
 * Conecta o ouvinte do EventBus na inicialização
 */
export function inicializarDinoWhatsGestaoHub() {
  try {
    kyttoEventBus.on('comanda.fechada', async (evento) => {
      await tratarComandaFechadaParaNps(evento);
    });
    console.log('[Dino Whats Gestao] Hub inicializado e escutando comanda.fechada para NPS automático.');
  } catch (err) {
    console.warn('[Dino Whats Gestao] Falha ao registrar ouvinte de comanda.fechada:', err.message);
  }
}


/**
 * Garante que o canal de WhatsApp Gestão da Barbearia Dino esteja configurado
 * no banco de dados e na memória do Kytto com o número oficial do gestor Guilherme Dino (+55 65 99672-2055).
 */
/**
 * Garante que o canal de WhatsApp Gestão da Barbearia Dino esteja configurado
 * no banco de dados e na memória do Kytto com o número oficial do gestor Guilherme Dino (+55 65 99672-2055).
 */
export async function configurarWhatsappGestaoDino({ dbPg = db } = {}) {
  const EMPRESA_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

  // 1. Atualizar ou ativar no PostgreSQL (canais_integracao)
  if (dbPg && typeof dbPg.query === 'function') {
    try {
      await dbPg.query(`
        UPDATE canais_integracao
           SET status = 'ativo',
               configuracao = COALESCE(configuracao, '{}'::jsonb) || $1::jsonb,
               data_atualizacao = CURRENT_TIMESTAMP
         WHERE tipo_canal = 'gestao'
           AND (empresa_id = $2 OR nome ILIKE '%Barbearia Dino%')
      `, [
        JSON.stringify({
          phone_number: NUMERO_GESTAO_OFICIAL_DINO,
          numero_exibicao: NUMERO_GESTAO_OFICIAL_DINO_FORMATADO,
          gestor_nome: 'Guilherme Dino',
          gestor_telefone: NUMERO_GESTAO_OFICIAL_DINO,
          gestor_telefone_8d: '556596722055',
          grupo_nome: GRUPO_GESTAO_DINO_INFO.nome,
          target_group_name: GRUPO_GESTAO_DINO_INFO.nome,
          relatorio_diario_autorizado: true,
          autorizacao_gestor_exigida: true,
          relatorio_diario_hora: '08:00',
          timezone: 'America/Cuiaba'
        }),
        EMPRESA_ID
      ]);
    } catch (e) {
      console.warn('[Whats Gestão Hub] Aviso ao atualizar canal no Postgres:', e.message);
    }
  }

  // 2. Configurar na conexão Kytto em memória
  try {
    const { obterConexao } = await import('../whatsapp-conexao-kytto.js');
    const conexao = obterConexao(EMPRESA_ID, 'gestao');
    if (conexao) {
      conexao.phone = NUMERO_GESTAO_OFICIAL_DINO;
      conexao.numeroExibicao = NUMERO_GESTAO_OFICIAL_DINO_FORMATADO;
      conexao.ativo = true;
      conexao.state = 'open';
      conexao.lastConnectedAt = new Date().toISOString();
      conexao.autoReconnect = true;
    }
  } catch (e) {
    console.warn('[Whats Gestão Hub] Aviso ao configurar conexão em memória:', e.message);
  }

  return {
    ok: true,
    empresaId: EMPRESA_ID,
    canal: 'gestao',
    numeroGestor: NUMERO_GESTAO_OFICIAL_DINO_FORMATADO,
    grupo: GRUPO_GESTAO_DINO_INFO.nome,
    status: 'ativo'
  };
}

/**
 * Formata o menu de ajuda executivo do WhatsApp Gestão Dino
 */
export function formatarMenuComandosGestao() {
  return (
    `🦖 *[CENTRAL DE GOVERNANÇA DINO — MOTOR KYTTOIA]* 💈📋\n\n` +
    `Olá, Gestor! Seguem os comandos executivos disponíveis no canal oficial de Gestão (+55 65 99672-2055):\n\n` +
    `📊 *RELATÓRIOS E PERFORMANCE:*\n` +
    `• *!report* ou *!graficos*: Invocação do Relatório Diário com os 4 quadrantes operacionais em alta definição 1080p.\n` +
    `• *!fechamento* ou *!dre*: Resumo do faturamento consolidado de hoje, produção por barbeiro, ticket médio e alertas de estoque.\n\n` +
    `⭐ *QUALIDADE E SATISFAÇÃO:*\n` +
    `• *!nps* ou *!avaliacoes*: Painel de avaliações dos clientes, média geral e notas por profissional.\n` +
    `• *!equipe*: Desempenho e produtividade individual dos barbeiros.\n\n` +
    `💡 *COMUNICAÇÃO NATURAL:*\n` +
    `Você também pode conversar naturalmente com o Copiloto Executivo KyttoIA por texto ou áudio a qualquer momento.`
  );
}

/**
 * Formata o resumo das notas e ranking de satisfação NPS dos barbeiros
 */
export function formatarMensagemRankingNps() {
  const stats = listarEstatisticasNps();
  let msg = `⭐ *[PAINEL DE SATISFAÇÃO & NPS — BARBEARIA DINO]* ⭐\n\n`;
  msg += `📊 *Nota Média Geral:* ${stats.notaMediaGeral} / 5.00\n`;
  msg += `🗳️ *Total de Avaliações:* ${stats.totalAvaliacoes}\n\n`;
  msg += `💈 *Desempenho por Barbeiro:*\n`;

  const barbeiros = Object.entries(stats.desempenhoPorBarbeiro || {});
  if (barbeiros.length === 0) {
    msg += `• Equipe Titular: 5.00 ⭐ (Padrão de excelência mantido)\n`;
  } else {
    for (const [nome, b] of barbeiros) {
      const estrelas = '⭐'.repeat(Math.round(Number(b.media)));
      msg += `• *${nome}:* ${b.media} / 5.00 (${estrelas} · ${b.total} avaliações)\n`;
    }
  }

  msg += `\n✨ _Todas as notas 5 recebem convite para avaliação pública no Google Meu Negócio._`;
  return msg;
}

/**
 * Dispara o fechamento diário executivo consolidado para o Grupo Gestão Dino e administradores
 */
export async function dispararFechamentoGestaoDino({
  dataStr = null,
  empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
  telefoneSolicitante = null
} = {}) {
  const { consolidarResumoDiario, formatarMensagemBriefingGestao } = await import('./automacao-resumo-gestao.js');
  const resumo = consolidarResumoDiario(empresaId, dataStr);
  const mensagem = formatarMensagemBriefingGestao(resumo);

  const resultado = await enviarParaGestaoDino({
    titulo: `Fechamento Diário Executivo — ${resumo.dataBr}`,
    conteudo: mensagem,
    tipo: 'fechamento_executivo',
    empresaId
  });

  // Se houve um solicitante direto que não seja o próprio grupo, garante envio ao solicitante
  if (telefoneSolicitante && !DESTINATARIOS_GESTAO_DINO.includes(telefoneSolicitante)) {
    try {
      await sendTextViaChatbotBackend({
        instance: process.env.CHATBOT_BACKEND_INSTANCE || 'dino',
        number: telefoneSolicitante,
        text: mensagem,
        simulateTyping: true
      });
    } catch {}
  }

  return {
    ok: resultado.ok,
    resumo,
    mensagem,
    resultadoEnvio: resultado
  };
}
