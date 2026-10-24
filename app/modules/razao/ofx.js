// Leitura de extrato OFX (1.x SGML e 2.x XML), sem dependências.
// Devolve as contas do arquivo (um OFX pode trazer corrente, poupança e cartão), cada uma com
// período, saldo e transações: FITID, data, valor (+ crédito, − débito) e texto.
import crypto from 'node:crypto';
import { ErroDominio } from '../acesso/banco.js';

/** Decodifica respeitando o cabeçalho (OFX 1.x de banco brasileiro costuma vir em Windows-1252). */
export function decodificarOfx(buffer) {
  const bruto = Buffer.isBuffer(buffer) ? buffer : Buffer.from(String(buffer || ''), 'utf8');
  const cabecalho = bruto.subarray(0, 600).toString('latin1');
  const cp1252 = () => { try { return new TextDecoder('windows-1252').decode(bruto); } catch { return bruto.toString('latin1'); } };
  if (/CHARSET:\s*(1252|ISO-8859-1|8859)/i.test(cabecalho)) return cp1252();
  const utf8 = bruto.toString('utf8');
  return utf8.includes('�') ? cp1252() : utf8;
}

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const limpar = (v) => String(v)
  .replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENTIDADES[e])
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
  .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
  .replace(/\s+/g, ' ').trim();

const valorDaTag = (bloco, tag) => {
  // OFX 1.x: <TAG>valor (sem fechar) · OFX 2.x: <TAG>valor</TAG>
  const m = String(bloco).match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'));
  return m ? limpar(m[1]) : null;
};

/** 20261015120000[-3:BRT] → '2026-10-15' (a data do banco, sem conversão de fuso). Data impossível = null. */
export function dataOfx(v) {
  const m = String(v || '').match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** 1234.56 · -1234.56 · 1.234,56 · 1234,5 · +10.00 (milhar com ponto só no formato com vírgula). */
export function numeroOfx(v) {
  const t = String(v || '').trim().replace(/^\+/, '');
  let n;
  if (/^-?\d{1,3}(\.\d{3})*,\d{1,2}$/.test(t) || /^-?\d+,\d{1,2}$/.test(t)) n = Number(t.replace(/\./g, '').replace(',', '.'));
  else if (/^-?\d+(\.\d+)?$/.test(t)) n = Number(t);
  else return NaN;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

// Tipos que são saída de dinheiro: valor positivo com estes tipos é débito exportado sem sinal.
const TIPOS_DEBITO = new Set(['DEBIT', 'PAYMENT', 'FEE', 'SRVCHG', 'CHECK', 'ATM', 'POS', 'DIRECTDEBIT', 'REPEATPMT', 'CASH']);
const TIPOS_CREDITO = new Set(['CREDIT', 'DEP', 'INT', 'DIV', 'DIRECTDEP']);

function lerExtrato(bloco) {
  const banco = valorDaTag(bloco, 'BANKID');
  const agencia = valorDaTag(bloco, 'BRANCHID');
  const conta = valorDaTag(bloco, 'ACCTID');
  const lista = bloco.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0]);
  const transacoes = [];
  const descartadas = [];
  const vistos = new Map();
  let duplicadas = 0;
  for (const b of lista) {
    const fitidBruto = valorDaTag(b, 'FITID');
    const data = dataOfx(valorDaTag(b, 'DTPOSTED'));
    let valor = numeroOfx(valorDaTag(b, 'TRNAMT'));
    const tipo = (valorDaTag(b, 'TRNTYPE') || '').toUpperCase().slice(0, 20) || null;
    if (!data || !Number.isFinite(valor) || valor === 0) { descartadas.push({ fitid: fitidBruto || null, motivo: !data ? 'data inválida' : 'valor inválido' }); continue; }
    // o sinal decide receita × despesa: tipo de débito com valor positivo é corrigido e vai para conferência
    let sinalCorrigido = false;
    if (valor > 0 && TIPOS_DEBITO.has(tipo)) { valor = -valor; sinalCorrigido = true; }
    else if (valor < 0 && TIPOS_CREDITO.has(tipo) && tipo !== 'CREDIT') sinalCorrigido = true; // incoerente: confere à mão
    const descricao = [valorDaTag(b, 'NAME'), valorDaTag(b, 'MEMO')].filter(Boolean).join(' · ').slice(0, 300);
    const assinatura = `${data}|${valor}|${descricao}`;
    // FITID ausente ou repetido com conteúdo diferente: chave estável a partir do conteúdo e da ordem
    let fitid = fitidBruto ? fitidBruto.slice(0, 120) : null;
    const anterior = fitid ? vistos.get(fitid) : null;
    if (anterior !== undefined && anterior !== null && anterior === assinatura) { duplicadas += 1; continue; }
    if (!fitid || anterior !== undefined) {
      const ordem = transacoes.filter((t) => `${t.data}|${t.valor}|${t.descricao}` === assinatura).length;
      fitid = `${fitid ? `${fitid.slice(0, 60)}#` : 'sem-fitid:'}${crypto.createHash('sha256').update(`${assinatura}|${ordem}`).digest('hex').slice(0, 16)}`;
    }
    if (fitidBruto && !vistos.has(fitidBruto)) vistos.set(fitidBruto, assinatura);
    transacoes.push({ fitid, data, valor, tipo: sinalCorrigido ? `${tipo}*` : tipo, sinalCorrigido, descricao, documento: (valorDaTag(b, 'CHECKNUM') || valorDaTag(b, 'REFNUM') || '').slice(0, 60) || null });
  }
  const saldo = numeroOfx(valorDaTag(bloco.split(/<LEDGERBAL>/i)[1] || '', 'BALAMT'));
  return {
    banco: banco ? banco.slice(0, 10) : null, agencia: agencia ? agencia.slice(0, 20) : null, conta: conta ? conta.slice(0, 30) : null,
    cartao: /<CCACCTFROM>/i.test(bloco),
    inicio: dataOfx(valorDaTag(bloco, 'DTSTART')), fim: dataOfx(valorDaTag(bloco, 'DTEND')), saldoFinal: Number.isFinite(saldo) ? saldo : null,
    transacoes, descartadas, duplicadas,
  };
}

export function lerOfx(texto) {
  const conteudo = String(texto || '');
  if (!/<OFX>/i.test(conteudo)) throw new ErroDominio('OFX_INVALIDO', 'Arquivo não parece um extrato OFX', 422);
  // um bloco por conta (STMTRS = conta corrente/poupança, CCSTMTRS = cartão)
  const blocos = conteudo.split(/<(?:CC)?STMTRS>/i).slice(1).map((b) => b.split(/<\/(?:CC)?STMTRS>/i)[0]);
  const contas = (blocos.length ? blocos : [conteudo]).map(lerExtrato);
  if (!contas.some((c) => c.transacoes.length || c.descartadas.length)) throw new ErroDominio('OFX_VAZIO', 'O extrato não tem lançamentos', 422);
  const primeira = contas[0];
  // compatibilidade: campos da primeira conta no topo
  return { ...primeira, contas };
}
