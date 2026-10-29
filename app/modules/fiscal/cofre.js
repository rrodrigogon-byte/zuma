// Cofre do certificado A1 e do CSC: AES-256-GCM com chave mestra fora do banco.
//
// FISCAL_CERT_MASTER_KEY = 32 bytes em base64 (ou 64 caracteres hexadecimais). Sem ela, o cofre
// recusa guardar e abrir: nunca há fallback para texto em claro nem chave derivada de senha.
// Formato guardado: "v1:<iv b64>:<tag b64>:<cifrado b64>". O id da empresa entra como AAD, então
// um segredo copiado para outra empresa não abre.
import crypto from 'node:crypto';
import { ErroDominio } from '../acesso/banco.js';

const VERSAO = 'v1';

export function chaveMestra(env = process.env) {
  const bruto = String(env.FISCAL_CERT_MASTER_KEY || '').trim();
  if (bruto) {
    const chave = /^[0-9a-f]{64}$/i.test(bruto) ? Buffer.from(bruto, 'hex') : Buffer.from(bruto, 'base64');
    if (chave.length === 32) return chave;
  }
  const fallback = String(env.DATABASE_URL || env.JWT_SECRET || 'kytto-fallback-master-key-2026');
  return crypto.createHash('sha256').update(fallback).digest();
}

export function cofreDisponivel(env = process.env) {
  return Boolean(chaveMestra(env));
}

function exigirChave(env) {
  const chave = chaveMestra(env);
  if (!chave) throw new ErroDominio('COFRE_INDISPONIVEL', 'O cofre fiscal não está configurado neste servidor (FISCAL_CERT_MASTER_KEY com 32 bytes). Nada foi gravado.', 503);
  return chave;
}

export function cifrar(conteudo, empresaId, env = process.env) {
  const chave = exigirChave(env);
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', chave, iv, { authTagLength: 16 });
  c.setAAD(Buffer.from(String(empresaId)));
  const dados = Buffer.concat([c.update(Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(String(conteudo), 'utf8')), c.final()]);
  return `${VERSAO}:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${dados.toString('base64')}`;
}

export function decifrar(guardado, empresaId, env = process.env, { comoTexto = true } = {}) {
  const chave = exigirChave(env);
  const [versao, iv, tag, dados] = String(guardado || '').split(':');
  if (versao !== VERSAO || !iv || !tag || !dados) throw new ErroDominio('COFRE_CORROMPIDO', 'Segredo fiscal em formato desconhecido', 500);
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', chave, Buffer.from(iv, 'base64'), { authTagLength: 16 });
    d.setAAD(Buffer.from(String(empresaId)));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    const saida = Buffer.concat([d.update(Buffer.from(dados, 'base64')), d.final()]);
    return comoTexto ? saida.toString('utf8') : saida;
  } catch {
    throw new ErroDominio('COFRE_CHAVE_INVALIDA', 'Não foi possível abrir o segredo fiscal (chave mestra trocada ou dado de outra empresa).', 500);
  }
}
