// Figurinhas do T-Rex (mascote da Dino) no atendimento do WhatsApp.
//
// Regras de uso (decididas pelo sistema, nunca pelo modelo):
//   - só em momentos marcados: primeiro contato, agendamento/remarcação confirmados,
//     presença confirmada, atraso avisado, pedido confirmado, autorização dada e falha
//     de confirmação ("foi mal");
//   - no máximo 1 a cada 4 horas e 3 por dia por conversa; nunca a mesma em seguida;
//   - sempre DEPOIS da resposta em texto e nunca no lugar dela;
//   - desligadas por padrão: WHATSAPP_STICKERS=on liga. Sem rota de figurinha no
//     backend (CHATBOT_BACKEND_STICKER_PATH), nada sai e nada quebra.
//   - figurinha é atendimento, não marketing: "promo" e "parabéns" só saem por campanha
//     com opt-in (fora deste módulo).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const FIGURINHAS = Object.freeze({
  ola: { legenda: 'E aí!', momento: 'Primeira mensagem do dia' },
  agendado: { legenda: 'Agendado!', momento: 'Agendamento ou remarcação confirmados' },
  lembrete: { legenda: 'Amanhã, hein?', momento: 'Lembrete da véspera' },
  confirmado: { legenda: 'Confirmado', momento: 'Cliente confirmou presença' },
  chegando: { legenda: 'Tô chegando', momento: 'Cliente avisou atraso' },
  valeu: { legenda: 'Valeu!', momento: 'Cliente autorizou personalização' },
  cheiroso: { legenda: 'Cheirosão', momento: 'Pedido de produto confirmado' },
  parabens: { legenda: 'Parabéns!', momento: 'Aniversário (campanha com opt-in)' },
  corte: { legenda: 'Na régua', momento: 'Pós-atendimento do corte' },
  pensando: { legenda: 'Deixa eu ver…', momento: 'Consulta demorada' },
  desculpa: { legenda: 'Foi mal!', momento: 'Confirmação não deu certo' },
  promo: { legenda: 'Promoção!', momento: 'Oferta (campanha com opt-in)' },
  neutro: { legenda: '', momento: 'Avatar' },
});

export const INTERVALO_MS = 4 * 60 * 60 * 1000;
export const MAX_POR_DIA = 3;

export function figurinhasLigadas() {
  return String(process.env.WHATSAPP_STICKERS || '').trim().toLowerCase() === 'on';
}

export function arquivoFigurinha(mood) {
  return FIGURINHAS[mood] ? `trex-${mood}.webp` : '';
}

export function urlFigurinha(mood) {
  const base = String(process.env.PUBLIC_BASE_URL || process.env.DINO_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  const arquivo = arquivoFigurinha(mood);
  return arquivo && /^https:\/\//.test(base) ? `${base}/figurinhas/${arquivo}` : '';
}

/** Lê o WebP do build (app/public) ou da fonte (web/public). */
export function lerFigurinha(mood) {
  const arquivo = arquivoFigurinha(mood);
  if (!arquivo) return null;
  for (const dir of [path.join(__dirname, '..', 'public', 'figurinhas'), path.join(__dirname, '..', '..', 'web', 'public', 'figurinhas')]) {
    const caminho = path.join(dir, arquivo);
    if (fs.existsSync(caminho)) return fs.readFileSync(caminho);
  }
  return null;
}

function okTrace(traces = [], nome) {
  return (Array.isArray(traces) ? traces : []).some((t) => t?.name === nome && t?.ok !== false);
}

/** Decide a figurinha do momento a partir da resposta já enviada. null = nenhuma. */
export function escolherFigurinha({ kind = '', actionType = '', traces = [], primeiroContato = false } = {}) {
  if (kind === 'confirmed') {
    if (actionType === 'agendamento' || actionType === 'remarcacao') return 'agendado';
    if (actionType === 'pedido') return 'cheiroso';
    return null;
  }
  if (kind === 'confirmation_failed') return 'desculpa';
  if (kind === 'personalization_granted') return 'valeu';
  if (!['gemini', 'reserve_ai'].includes(kind)) return null;
  if (okTrace(traces, 'confirmar_presenca')) return 'confirmado';
  if (okTrace(traces, 'avisar_atraso')) return 'chegando';
  if (primeiroContato) return 'ola';
  return null;
}

/** Limite por conversa, guardado em whatsapp_ai_sessions.estado.figurinhas. */
export function podeEnviarFigurinha(estado = {}, mood, agora = Date.now()) {
  const hist = (Array.isArray(estado?.figurinhas) ? estado.figurinhas : [])
    .filter((item) => item && Number.isFinite(new Date(item.em).valueOf()));
  const ultima = hist[hist.length - 1];
  if (ultima && agora - new Date(ultima.em).valueOf() < INTERVALO_MS) return false;
  if (ultima && ultima.mood === mood) return false;
  const doDia = hist.filter((item) => agora - new Date(item.em).valueOf() < 24 * 60 * 60 * 1000);
  return doDia.length < MAX_POR_DIA;
}

/**
 * Envia (no máximo) uma figurinha depois da resposta. Nunca lança: falha de
 * figurinha não pode atrapalhar o atendimento. Devolve o que aconteceu.
 */
export async function enviarFigurinhaDoMomento({ session, response, primeiroContato = false, tenant, enviar, query = db.query.bind(db), agora = Date.now() } = {}) {
  try {
    if (!figurinhasLigadas()) return { sent: false, reason: 'desligadas' };
    const mood = escolherFigurinha({ kind: response?.kind, actionType: response?.actionType, traces: response?.traces, primeiroContato });
    if (!mood) return { sent: false, reason: 'sem_momento' };
    if (!podeEnviarFigurinha(session?.estado || {}, mood, agora)) return { sent: false, reason: 'limite', mood };
    const arquivo = lerFigurinha(mood);
    const url = urlFigurinha(mood);
    if (!arquivo && !url) return { sent: false, reason: 'arquivo_ausente', mood };
    const resultado = await enviar(tenant, session.telefone, { mood, url, base64: arquivo ? arquivo.toString('base64') : '', mimetype: 'image/webp' });
    if (!resultado?.ok) return { sent: false, reason: resultado?.error || 'provedor_recusou', mood };
    const hist = (Array.isArray(session?.estado?.figurinhas) ? session.estado.figurinhas : []).slice(-9);
    hist.push({ mood, em: new Date(agora).toISOString() });
    await query(
      `UPDATE whatsapp_ai_sessions SET estado = COALESCE(estado, '{}'::jsonb) || jsonb_build_object('figurinhas', $4::jsonb), atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $1 AND empresa_id = $2 AND loja_id = $3`,
      [session.id, session.empresa_id, session.loja_id, JSON.stringify(hist)],
    ).catch(() => null);
    return { sent: true, mood };
  } catch (error) {
    return { sent: false, reason: String(error?.code || error?.message || 'erro').slice(0, 80) };
  }
}
