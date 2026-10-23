// Leitura de extrato OFX (1.x SGML e 2.x XML), sem dependências.
// Devolve conta, período, saldo e as transações com FITID, data, valor (+ crédito, − débito) e texto.
import { ErroDominio } from '../acesso/banco.js';

/** Decodifica o arquivo respeitando o cabeçalho (OFX 1.x de banco brasileiro costuma vir em 1252). */
export function decodificarOfx(buffer) {
  const bruto = Buffer.isBuffer(buffer) ? buffer : Buffer.from(String(buffer || ''), 'utf8');
  const cabecalho = bruto.subarray(0, 600).toString('latin1');
  if (/CHARSET:\s*(1252|ISO-8859-1|8859)/i.test(cabecalho)) return bruto.toString('latin1');
  const utf8 = bruto.toString('utf8');
  // sem cabeçalho confiável: se não for UTF-8 válido, é latin1
  return utf8.includes('\uFFFD') ? bruto.toString('latin1') : utf8;
}

const valorDaTag = (bloco, tag) => {
  // OFX 1.x: <TAG>valor (sem fechar) · OFX 2.x: <TAG>valor</TAG>
  const m = String(bloco).match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'));
  return m ? m[1].trim() : null;
};

/** 20261015120000[-3:BRT] → '2026-10-15' (a data do banco, sem conversão de fuso). */
function dataOfx(v) {
  const m = String(v || '').match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  return Number.isNaN(new Date(`${iso}T12:00:00Z`).valueOf()) ? null : iso;
}

function numeroOfx(v) {
  const t = String(v || '').trim();
  // aceita 1234.56, -1234.56 e o formato com vírgula que alguns bancos exportam (1.234,56)
  const n = Number(/,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export function lerOfx(texto) {
  const conteudo = String(texto || '');
  if (!/<OFX>/i.test(conteudo)) throw new ErroDominio('OFX_INVALIDO', 'Arquivo não parece um extrato OFX', 422);
  const banco = valorDaTag(conteudo, 'BANKID');
  const agencia = valorDaTag(conteudo, 'BRANCHID');
  const conta = valorDaTag(conteudo, 'ACCTID');
  const blocos = conteudo.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0]);
  const transacoes = [];
  const descartadas = [];
  for (const b of blocos) {
    const fitid = valorDaTag(b, 'FITID');
    const data = dataOfx(valorDaTag(b, 'DTPOSTED'));
    const valor = numeroOfx(valorDaTag(b, 'TRNAMT'));
    if (!fitid || !data || !Number.isFinite(valor) || valor === 0) { descartadas.push({ fitid: fitid || null, motivo: 'FITID, data ou valor ausente' }); continue; }
    const descricao = [valorDaTag(b, 'NAME'), valorDaTag(b, 'MEMO')].filter(Boolean).join(' · ').replace(/\s+/g, ' ').slice(0, 300);
    transacoes.push({ fitid: fitid.slice(0, 120), data, valor, tipo: (valorDaTag(b, 'TRNTYPE') || '').toUpperCase().slice(0, 20) || null, descricao, documento: (valorDaTag(b, 'CHECKNUM') || valorDaTag(b, 'REFNUM') || '').slice(0, 60) || null });
  }
  if (!transacoes.length && !descartadas.length) throw new ErroDominio('OFX_VAZIO', 'O extrato não tem lançamentos', 422);
  const saldo = numeroOfx(valorDaTag(conteudo.split(/<LEDGERBAL>/i)[1] || '', 'BALAMT'));
  return {
    banco: banco ? banco.replace(/\D/g, '').slice(0, 10) || banco.slice(0, 10) : null, agencia: agencia ? agencia.slice(0, 20) : null, conta: conta ? conta.slice(0, 30) : null,
    inicio: dataOfx(valorDaTag(conteudo, 'DTSTART')), fim: dataOfx(valorDaTag(conteudo, 'DTEND')), saldoFinal: Number.isFinite(saldo) ? saldo : null,
    transacoes, descartadas,
  };
}
