// QR dinâmico do aluno (item 1.4): muda a cada 30 s e é assinado, para que um print repassado
// a outra pessoa pare de funcionar em segundos. Formato: K1.<userId>.<janela>.<assinatura>
import { createHmac, timingSafeEqual } from 'node:crypto';

const JANELA_S = 30;
const PREFIXO = 'K1';

function assinar(segredo, userId, janela) {
  return createHmac('sha256', segredo).update(`${PREFIXO}.${userId}.${janela}`).digest('base64url').slice(0, 22);
}

export function gerarQrDinamico(segredo, userIdEquipamento, agora = Date.now()) {
  if (!segredo || String(segredo).length < 16) throw new Error('CLUBE_QR_SECRET ausente ou curto');
  const janela = Math.floor(agora / 1000 / JANELA_S);
  return {
    valor: `${PREFIXO}.${userIdEquipamento}.${janela}.${assinar(segredo, userIdEquipamento, janela)}`,
    expiraEm: new Date((janela + 1) * JANELA_S * 1000),
  };
}

/** Aceita a janela atual e a anterior (tolerância de relógio/leitura). Retorna o userId ou null. */
export function validarQrDinamico(segredo, valor, agora = Date.now()) {
  if (!segredo) return null;
  const partes = String(valor || '').trim().split('.');
  if (partes.length !== 4 || partes[0] !== PREFIXO) return null;
  const [, userTxt, janelaTxt, assinatura] = partes;
  if (!/^\d{1,12}$/.test(userTxt) || !/^\d{1,12}$/.test(janelaTxt)) return null;
  const janela = Number(janelaTxt);
  const atual = Math.floor(agora / 1000 / JANELA_S);
  if (janela !== atual && janela !== atual - 1) return null;
  const esperado = Buffer.from(assinar(segredo, userTxt, janela));
  const recebido = Buffer.from(assinatura);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  return Number(userTxt);
}
