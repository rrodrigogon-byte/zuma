import { db as getDb, save } from '../db.js';
import { sendTextViaChatbotBackend } from './whatsapp-provider.js';

// Lista oficial de clientes VIP do Dino ausentes há mais de 60 dias para reativação diária
const CLIENTES_AUSENTES_DINO = [
  { nome: 'Wesley da Silva Bezerra', telefone: '5579999969792', dias: 61, ultima: '28/08/2026' },
  { nome: 'Alex Paulo De Souza', telefone: '5565996688981', dias: 63, ultima: '26/08/2026' },
  { nome: 'Vinicius Batista', telefone: '5565999259292', dias: 63, ultima: '26/08/2026' },
  { nome: 'Junior Dias', telefone: '5565999121788', dias: 68, ultima: '21/08/2026' },
  { nome: 'Matheus Oliveira dos Santos', telefone: '5566999917647', dias: 68, ultima: '21/08/2026' },
  { nome: 'Fernando Luiz', telefone: '5565999559838', dias: 69, ultima: '20/08/2026' },
  { nome: 'Wellinton Camargo', telefone: '5565992267634', dias: 64, ultima: '25/08/2026' },
  { nome: 'Marcos Antonio Szlachta', telefone: '5585996400095', dias: 65, ultima: '24/08/2026' },
  { nome: 'Jakson', telefone: '5565992139807', dias: 69, ultima: '20/08/2026' },
  { nome: 'Glauber Albino Ferreira', telefone: '556599598721', dias: 60, ultima: '29/08/2026' }
];

export function obterClientesParaReativar(dataStr = '') {
  const d = new Date(dataStr || Date.now());
  const seed = (d.getFullYear() * 372) + (d.getMonth() * 31) + d.getDate();
  const idx1 = Math.abs(seed) % CLIENTES_AUSENTES_DINO.length;
  let idx2 = (idx1 + 1) % CLIENTES_AUSENTES_DINO.length;
  return [CLIENTES_AUSENTES_DINO[idx1], CLIENTES_AUSENTES_DINO[idx2]];
}

/**
 * Módulo de Briefing Diário da Agenda & Inteligência Comercial da Barbearia Dino
 * Disparo automático diário às 08h30 (horário de Cuiabá/MT - UTC-4) via WhatsApp (T-Rex)
 * Destinatário: Mestre Dino (+55 65 99336-0000)
 */

import { estadoEmpresa } from '../barbearia-erp-kytto.js';
import { enviarMensagem } from './whatsapp.js';

export const TELEFONE_DINO_PADRAO = '5565993360000';
export const EMPRESA_DINO_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

// Cache em memória para evitar múltiplos disparos no mesmo dia
let ultimoDiaEnviado = null;

function carregarUltimoDiaEnviado() {
  try {
    const data = getDb();
    return data?.dinoBriefingUltimoEnvio || null;
  } catch {
    return null;
  }
}

function salvarUltimoDiaEnviado(diaChave) {
  try {
    const data = getDb();
    if (data) {
      data.dinoBriefingUltimoEnvio = diaChave;
      save();
    }
  } catch (err) {
    console.warn('[Dino Briefing] Falha ao persistir dia de envio:', err?.message || err);
  }
}


/**
 * Obtém a data e hora atual no fuso horário de Cuiabá/MT (UTC-4)
 */
export function dataHoraCuiaba(data = new Date()) {
  const opcoes = { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  const formatador = new Intl.DateTimeFormat('pt-BR', opcoes);
  const partes = formatador.formatToParts(data);
  const map = {};
  for (const p of partes) map[p.type] = p.value;
  return {
    ano: map.year,
    mes: map.month,
    dia: map.day,
    hora: Number(map.hour || 0),
    minuto: Number(map.minute || 0),
    dataISO: `${map.year}-${map.month}-${map.day}`,
    dataFormatada: `${map.day}/${map.month}/${map.year}`,
  };
}

/**
 * Compila os dados da agenda e gera o texto oficial do briefing matinal do T-Rex
 */
export function compilarBriefingDiarioDino({
  dataStr = null,
  empresaId = EMPRESA_DINO_ID,
} = {}) {
  const agoraCuiaba = dataHoraCuiaba();
  const dataAlvo = dataStr || agoraCuiaba.dataISO;
  const estado = estadoEmpresa(empresaId, false);

  if (!estado || !estado.agendamentos) {
    throw new Error(`Dados da barbearia ${empresaId} não encontrados.`);
  }

  const servicosMap = {};
  for (const s of Object.values(estado.servicos || {})) {
    servicosMap[s.id] = { nome: s.nome, preco: Number(s.preco || 0) };
  }

  const profissionaisMap = {};
  for (const p of Object.values(estado.profissionais || {})) {
    profissionaisMap[p.id] = p.nome;
  }

  // Filtrar agendamentos do dia alvo
  const agendamentos = Object.values(estado.agendamentos || {})
    .filter(a => {
      const d = String(a.dataAgenda || a.dataHora || '').slice(0, 10);
      return d === dataAlvo && a.status !== 'cancelado';
    })
    .sort((a, b) => {
      const hA = String(a.horario || a.dataHora || '');
      const hB = String(b.horario || b.dataHora || '');
      return hA.localeCompare(hB);
    });

  let totalAtendimentos = agendamentos.length;
  let totalAssinantes = 0;
  let faturamentoAvulso = 0;
  let faturamentoTotalEstimado = 0;

  const agendaDino = [];
  const porProfissional = {};
  const oportunidades = [];

  agendamentos.forEach(a => {
    const srv = servicosMap[a.servicoId] || { nome: a.servicoNome || a.servicoId || 'Serviço', preco: Number(a.valorServico || 0) };
    const profNomeOriginal = profissionaisMap[a.profissionalId] || a.profissionalNome || 'Profissional';
    
    // Normalização dos nomes
    let profNome = profNomeOriginal;
    const nLow = profNomeOriginal.toLowerCase();
    if (nLow.includes('dino') || nLow.includes('guilherme')) profNome = 'Dino';
    else if (nLow.includes('natani') || nLow.includes('nat') || nLow.includes('ester') || nLow.includes('steffany')) profNome = 'Natani';
    else if (nLow.includes('bruno')) profNome = 'Bruno';
    else if (nLow.includes('joão') || nLow.includes('joao')) profNome = 'João Victor';

    const clienteNome = a.clienteNome || a.cliente || 'Cliente';
    const cLow = String(clienteNome).toLowerCase();
    const sLow = String(srv.nome).toLowerCase();
    
    // É assinante se o cliente tem tag de clube, se o serviço é de clube, ou se foi explicitamente zerado
    const ehAssinante = cLow.includes('club') || cLow.includes('asaas') || cLow.includes('plano') || sLow.includes('club') || sLow.includes('assinatura') || (a.valorServico !== undefined && Number(a.valorServico) === 0);

    const valorCobrado = Number(a.valorServico && a.valorServico > 1 ? a.valorServico : (srv.preco || 0));
    const hora = a.horario || a.dataHora?.slice(11, 16) || '--:--';

    if (ehAssinante) {
      totalAssinantes++;
      faturamentoTotalEstimado += srv.preco; // Valor de tabela do procedimento coberto
    } else {
      faturamentoAvulso += valorCobrado;
      faturamentoTotalEstimado += valorCobrado;
    }

    if (!porProfissional[profNome]) {
      porProfissional[profNome] = { total: 0, avulso: 0, assinantes: 0, clientes: [] };
    }
    porProfissional[profNome].total++;
    if (ehAssinante) porProfissional[profNome].assinantes++;
    else porProfissional[profNome].avulso += valorCobrado;
    porProfissional[profNome].clientes.push({ hora, cliente: clienteNome, servico: srv.nome, valor: valorCobrado, ehAssinante });

    if (profNome === 'Dino') {
      agendaDino.push({ hora, cliente: clienteNome, servico: srv.nome, valor: valorCobrado, ehAssinante });
    }

    // Identificação de oportunidades de vendas do cliente
    const jaListado = oportunidades.some(op => op.cliente === clienteNome);
    if (!ehAssinante && !jaListado) {
      if (profNome === 'Bruno' || profNome === 'Natani') {
        oportunidades.push({
          cliente: clienteNome,
          barbeiro: profNome,
          tipo: 'Pacote Premium',
          detalhe: `Cliente avulso agendado com ${profNome}. Oferecer Pacote de 4 procedimentos por R$ 360 (economia de R$ 40).`,
        });
      } else if (profNome === 'João Victor') {
        oportunidades.push({
          cliente: clienteNome,
          barbeiro: profNome,
          tipo: 'Club Recorrente',
          detalhe: `Cliente com João Victor. Apresentar o Club Cabelo por R$ 157/mês para vir o mês todo.`,
        });
      }
    }
  });

  // Formatar data brasileira
  const [ano, mes, dia] = dataAlvo.split('-');
  const dataFormatada = `${dia}/${mes}/${ano}`;

  // Montagem da Mensagem do T-Rex
  let msg = `🦖 *BOM DIA, DINO! AQUI É O T-REX COM O SEU BRIEFING DIÁRIO* ☕✂️\n\n`;
  msg += `📅 *Agenda de Hoje — ${dataFormatada}*\n`;
  msg += `📊 *Panorama do Dia:* ${totalAtendimentos} atendimentos confirmados\n`;
  msg += `💰 *Previsão de Faturamento Avulso:* R$ ${faturamentoAvulso.toFixed(2).replace('.', ',')}\n`;
  msg += `🎟️ *Atendimentos de Assinantes/Clubes:* ${totalAssinantes} clientes\n`;
  msg += `📈 *Faturamento Bruto em Serviços:* R$ ${faturamentoTotalEstimado.toFixed(2).replace('.', ',')}\n\n`;

  msg += `─────────────────────────\n`;
  msg += `👑 *SUA AGENDA PESSOAL HOJE (${agendaDino.length} atendimentos):*\n`;
  if (agendaDino.length === 0) {
    msg += `_Nenhum horário marcado com o Dino para hoje até o momento._\n`;
  } else {
    agendaDino.forEach(item => {
      const tag = item.ehAssinante ? '🎟️ [Assinante Club]' : `💵 R$ ${item.valor.toFixed(2).replace('.', ',')}`;
      msg += `• *${item.hora}* — ${item.cliente}\n  _${item.servico}_ (${tag})\n`;
    });
  }

  msg += `\n─────────────────────────\n`;
  msg += `💈 *RESUMO DA EQUIPE HOJE:*\n`;
  for (const prof in porProfissional) {
    if (prof === 'Dino') continue;
    const p = porProfissional[prof];
    msg += `• *${prof}:* ${p.total} atendimento(s) | Avulso: R$ ${p.avulso.toFixed(2).replace('.', ',')} (${p.assinantes} assinantes)\n`;
  }

  // 2 Clientes ausentes do Dino para reativação ativa
  const clientesReativar = obterClientesParaReativar(dataAlvo);
  msg += `\n─────────────────────────\n`;
  msg += `🔄 *2 CLIENTES VIP DO DINO PARA REATIVAR HOJE (>60 dias sem vir):*\n`;
  clientesReativar.forEach((c, idx) => {
    msg += `${idx + 1}. *${c.nome}* (WhatsApp: ${c.telefone})\n   ⏳ ${c.dias} dias ausente (Última visita: ${c.ultima})\n   💡 _Sugestão: "Fala ${c.nome.split(' ')[0]}! Dino e T-Rex sentiram sua falta. Bora alinhar o visual essa semana?"_\n`;
  });

  msg += `\n─────────────────────────\n`;
  msg += `🎯 *OPORTUNIDADES DE VENDAS & UPSELL HOJE:*\n`;
  if (oportunidades.length > 0) {
    const maxOp = oportunidades.slice(0, 3);
    maxOp.forEach((op, idx) => {
      msg += `${idx + 1}. *${op.cliente}* (${op.barbeiro}): ${op.detalhe}\n`;
    });
  } else {
    msg += `• Clientes assíduos com Bruno/Nat têm perfil para o Pacote Premium (R$ 360).\n`;
  }
  msg += `• *Venda de Produtos na Bancada:* Excelente dia para sugerir pomada matte e pós-barba no checkout para os clientes de corte e barba!\n\n`;

  msg += `⚡ *Encaixes & WhatsApp:* T-Rex segue monitorando novos contatos matinais para preencher os horários livres da tarde!\n\n`;
  msg += `_Ótimos atendimentos e um dia de muito sucesso para você e toda a equipe!_ 🚀🦖`;

  return {
    dataAlvo,
    dataFormatada,
    totalAtendimentos,
    totalAssinantes,
    faturamentoAvulso,
    faturamentoTotalEstimado,
    agendaDino,
    porProfissional,
    oportunidades,
    mensagem: msg,
  };
}

/**
 * Envia o briefing matinal via WhatsApp para o Dino
 */
export async function enviarBriefingDiarioDino({
  dataStr = null,
  telefone = TELEFONE_DINO_PADRAO,
  empresaId = EMPRESA_DINO_ID,
  forcar = false,
} = {}) {
  const briefing = compilarBriefingDiarioDino({ dataStr, empresaId });
  const diaChave = briefing.dataAlvo;

  if (!forcar && ultimoDiaEnviado === diaChave) {
    return { ok: false, motivo: 'ja_enviado_hoje', diaChave };
  }

  const numLimpo = String(telefone).replace(/\D/g, '');
  const numFormatado = numLimpo.startsWith('55') ? numLimpo : `55${numLimpo}`;

  let enviado = false;
  let resposta = null;

  // 1. Envio Direto via Chatbot Backend (Proxy Oficial da Dino no Cloud Run)
  try {
    const resChatbot = await sendTextViaChatbotBackend({
      instance: process.env.CHATBOT_BACKEND_INSTANCE || 'dino',
      number: numFormatado,
      text: briefing.mensagem,
      simulateTyping: false,
    });
    if (resChatbot?.ok) {
      enviado = true;
      resposta = { ok: true, via: 'chatbot_backend', data: resChatbot };
    } else {
      console.warn('[Dino Briefing] Chatbot Backend retorno:', resChatbot);
      resposta = resChatbot;
    }
  } catch (err) {
    console.warn('[Dino Briefing] Falha Chatbot Backend:', err.message);
  }

  // 2. Fallback via Evolution API direta se o Chatbot Backend falhar
  if (!enviado && (process.env.EVOLUTION_API_URL || process.env.CHATBOT_BACKEND_URL)) {
    const evoUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/+$/, '');
    const evoKey = process.env.EVOLUTION_API_KEY || '';
    const evoInstance = process.env.EVOLUTION_INSTANCE || 'dino';

    if (evoUrl && evoKey) {
      try {
        const evoRes = await fetch(`${evoUrl}/message/sendText/${encodeURIComponent(evoInstance)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: evoKey,
          },
          body: JSON.stringify({
            number: numFormatado,
            text: briefing.mensagem,
            delay: 1200,
          }),
        });
        const data = await evoRes.json().catch(() => ({}));
        if (evoRes.ok) {
          enviado = true;
          resposta = { ok: true, via: 'evolution_api', data };
        }
      } catch (err) {
        console.warn('[Dino Briefing] Falha Evolution API:', err.message);
      }
    }
  }

  if (enviado) {
    ultimoDiaEnviado = diaChave;
    salvarUltimoDiaEnviado(diaChave);
  }

  return {
    ok: enviado,
    telefone: numFormatado,
    resposta,
    briefing,
  };
}

export async function verificarEEnviarBriefingDiario() {
  const agora = dataHoraCuiaba();
  // Dispara a partir das 08:30 da manhã até as 21:00
  const horaMinuto = agora.hora * 60 + agora.minuto;
  const hora8e30 = 8 * 60 + 30;
  const hora21e00 = 21 * 60;

  if (horaMinuto >= hora8e30 && horaMinuto <= hora21e00) {
    const ultimo = ultimoDiaEnviado || carregarUltimoDiaEnviado();
    if (ultimo !== agora.dataISO) {
      console.log(`[Dino Daily Briefing] Disparando briefing matinal para ${TELEFONE_DINO_PADRAO} (${agora.dataISO})...`);
      try {
        const res = await enviarBriefingDiarioDino({ dataStr: agora.dataISO, telefone: TELEFONE_DINO_PADRAO });
        console.log(`[Dino Daily Briefing] Envio concluído:`, res.ok ? 'SUCESSO' : res.motivo || 'FALHA');
        return res;
      } catch (err) {
        console.error(`[Dino Daily Briefing] Erro ao enviar briefing:`, err.message);
        return { ok: false, error: err.message };
      }
    }
  }

  return { ok: false, motivo: 'fora_do_horario_ou_ja_enviado', agora };
}


export function startDinoDailyBriefingWorker() {
  if (process.env.DINO_DAILY_BRIEFING_ENABLED === '0') return null;

  console.log('[Dino Briefing] Inicializando agendador do briefing matinal diario (08:30 Cuiaba)...');

  // Checagem a cada 30 segundos
  const timer = setInterval(async () => {
    try {
      await verificarEEnviarBriefingDiario();
    } catch (err) {
      console.warn('[Dino Briefing] Erro no ciclo do briefing:', err?.message || err);
    }
  }, 30 * 1000);

  // Executa uma verificacao inicial
  setTimeout(() => {
    verificarEEnviarBriefingDiario().catch(() => {});
  }, 5000);

  return {
    stop() { clearInterval(timer); }
  };
}
