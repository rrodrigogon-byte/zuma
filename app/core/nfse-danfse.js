// KYTTO — DANFSe gerado localmente a partir do XML da NFS-e autorizada.
//
// A API oficial de DANFSe da Sefin Nacional está suspensa (NT 008, 03/08/2026),
// então o emissor gera o documento auxiliar. O DANFSe não substitui a NFS-e:
// a validade é conferida pela chave de acesso no Portal Nacional (QR Code).

import { DOMParser } from '@xmldom/xmldom';
import QRCode from 'qrcode';

export const URL_CONSULTA_PUBLICA = 'https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=';

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');

function filhos(no, nome) {
  if (!no) return [];
  const out = [];
  for (let c = no.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && (c.localName || c.nodeName) === nome) out.push(c);
  return out;
}
// Caminho por nomes locais, ignorando namespace: el(raiz, 'emit', 'enderNac', 'xLgr').
function el(raiz, ...caminho) {
  let atual = raiz;
  for (const nome of caminho) { atual = filhos(atual, nome)[0]; if (!atual) return null; }
  return atual;
}
const txt = (raiz, ...caminho) => { const n = el(raiz, ...caminho); return n ? String(n.textContent || '').trim() : ''; };
function primeiro(raiz, nome) {
  if (!raiz) return null;
  const todos = raiz.getElementsByTagName('*');
  for (let i = 0; i < todos.length; i += 1) if ((todos[i].localName || todos[i].nodeName) === nome) return todos[i];
  return null;
}

export function formatarDocumento(v) {
  const d = soDigitos(v);
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return d;
}
const moeda = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
function dataHora(iso) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return String(iso);
  return `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` ${m[4]}:${m[5]}` : ''}`;
}
function cTribNacFmt(c) {
  const d = soDigitos(c);
  return d.length === 6 ? `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4, 6)}` : d;
}
function endereco(no) {
  if (!no) return '';
  const nac = el(no, 'enderNac') || el(no, 'end', 'endNac') || el(no, 'end');
  if (!nac) return '';
  const partes = [txt(nac, 'xLgr') || txt(no, 'end', 'xLgr'), txt(nac, 'nro') || txt(no, 'end', 'nro'), txt(nac, 'xCpl') || txt(no, 'end', 'xCpl'), txt(nac, 'xBairro') || txt(no, 'end', 'xBairro')].filter(Boolean);
  const cep = txt(nac, 'CEP');
  const uf = txt(nac, 'UF');
  return [partes.join(', '), [uf, cep && `CEP ${cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}`].filter(Boolean).join(' · ')].filter(Boolean).join(' — ');
}

// Extrai do XML da NFS-e (leiaute nacional) os campos exibidos no DANFSe.
export function dadosDaNfse(xml) {
  const limpo = String(xml || '').replace(/^﻿/, '');
  if (!limpo.includes('infNFSe')) throw new Error('XML não é de uma NFS-e nacional (infNFSe ausente).');
  const doc = new DOMParser({ onError: () => {} }).parseFromString(limpo, 'text/xml');
  const inf = primeiro(doc, 'infNFSe');
  if (!inf) throw new Error('XML da NFS-e inválido.');
  const dps = primeiro(inf, 'infDPS');
  const idNfse = inf.getAttribute('Id') || '';
  const chave = soDigitos(idNfse).slice(-50) || '';
  const emit = el(inf, 'emit');
  const prest = dps && el(dps, 'prest');
  const toma = dps && el(dps, 'toma');
  const serv = dps && el(dps, 'serv');
  const vInf = el(inf, 'valores');
  const vDps = dps && el(dps, 'valores');
  return {
    chaveAcesso: chave,
    numero: txt(inf, 'nNFSe'),
    numeroDfse: txt(inf, 'nDFSe'),
    dataProcessamento: txt(inf, 'dhProc'),
    localEmissao: txt(inf, 'xLocEmi'),
    localPrestacao: txt(inf, 'xLocPrestacao'),
    localIncidencia: txt(inf, 'xLocIncid'),
    descricaoTributacaoNacional: txt(inf, 'xTribNac'),
    descricaoTributacaoMunicipal: txt(inf, 'xTribMun'),
    ambiente: dps && txt(dps, 'tpAmb') === '1' ? 'producao' : 'producao_restrita',
    situacao: txt(inf, 'cStat'),
    dps: dps ? { serie: txt(dps, 'serie'), numero: txt(dps, 'nDPS'), emissao: txt(dps, 'dhEmi'), competencia: txt(dps, 'dCompet') } : {},
    prestador: {
      documento: txt(emit, 'CNPJ') || txt(emit, 'CPF') || txt(prest, 'CNPJ') || txt(prest, 'CPF'),
      inscricaoMunicipal: txt(emit, 'IM') || txt(prest, 'IM'),
      nome: txt(emit, 'xNome') || txt(prest, 'xNome'),
      fantasia: txt(emit, 'xFant'),
      endereco: endereco(emit),
      telefone: txt(emit, 'fone') || txt(prest, 'fone'),
      email: txt(emit, 'email') || txt(prest, 'email'),
      simples: prest ? txt(prest, 'regTrib', 'opSimpNac') : '',
    },
    tomador: toma ? { documento: txt(toma, 'CNPJ') || txt(toma, 'CPF'), nome: txt(toma, 'xNome'), endereco: endereco(toma), email: txt(toma, 'email') } : null,
    servico: {
      cTribNac: serv ? txt(serv, 'cServ', 'cTribNac') : '',
      cTribMun: serv ? txt(serv, 'cServ', 'cTribMun') : '',
      descricao: serv ? txt(serv, 'cServ', 'xDescServ') : '',
      municipioPrestacao: serv ? txt(serv, 'locPrest', 'cLocPrestacao') : '',
    },
    valores: {
      servico: vDps ? txt(vDps, 'vServPrest', 'vServ') : '',
      descontoIncondicionado: vDps ? txt(vDps, 'vDescCondIncond', 'vDescIncond') : '',
      descontoCondicionado: vDps ? txt(vDps, 'vDescCondIncond', 'vDescCond') : '',
      baseCalculo: txt(vInf, 'vBC'),
      aliquota: txt(vInf, 'pAliqAplic'),
      issqn: txt(vInf, 'vISSQN'),
      retencoes: txt(vInf, 'vTotalRet'),
      liquido: txt(vInf, 'vLiq'),
      pTotTribSN: vDps ? txt(vDps, 'trib', 'totTrib', 'pTotTribSN') : '',
    },
  };
}

const ROTULO_SIMPLES = { 1: 'Não optante', 2: 'MEI', 3: 'ME/EPP (Simples Nacional)' };

export async function gerarDanfseHtml(xml, { cancelada = false, canceladaEm = '', ambiente = '' } = {}) {
  const d = dadosDaNfse(xml);
  const amb = ambiente || d.ambiente;
  const urlConsulta = `${URL_CONSULTA_PUBLICA}${d.chaveAcesso}`;
  const qr = d.chaveAcesso ? await QRCode.toString(urlConsulta, { type: 'svg', margin: 0, width: 116, errorCorrectionLevel: 'M' }) : '';
  const tarja = amb !== 'producao' ? 'SEM VALOR FISCAL — PRODUÇÃO RESTRITA (TESTE)' : (cancelada ? 'NFS-e CANCELADA' : '');
  const linha = (r, v) => (v ? `<div class="c"><span>${esc(r)}</span><b>${esc(v)}</b></div>` : '');
  const chaveFmt = d.chaveAcesso.replace(/(\d{4})(?=\d)/g, '$1 ');
  const v = d.valores;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DANFSe ${esc(d.numero)}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f2f2f2;font:12px/1.35 Arial,Helvetica,sans-serif;color:#111}
.pg{max-width:800px;margin:16px auto;background:#fff;border:1px solid #222;position:relative}
.sec{border-top:1px solid #222;padding:6px 8px}.sec:first-child{border-top:0}
h1{font-size:15px;margin:0}h2{font-size:10px;letter-spacing:.06em;text-transform:uppercase;margin:0 0 4px;color:#333}
.top{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center}
.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:4px 12px}
.c span{display:block;font-size:9px;text-transform:uppercase;color:#555}.c b{font-weight:600;word-break:break-word}
.chave{font:600 12px/1.3 'Courier New',monospace;letter-spacing:.02em}
.desc{white-space:pre-wrap}.tot{font-size:14px}
.tarja{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
.tarja div{transform:rotate(-24deg);font:700 28px Arial;color:rgba(200,0,0,.18);border:4px solid rgba(200,0,0,.18);padding:6px 16px;text-align:center}
.rod{font-size:10px;color:#444}.acoes{text-align:center;margin:12px}
.acoes button{font:600 13px Arial;padding:8px 18px;border:1px solid #222;background:#fff;border-radius:6px;cursor:pointer}
@media print{body{background:#fff}.pg{margin:0;max-width:none;border-color:#000}.acoes{display:none}@page{size:A4;margin:10mm}}
</style></head><body>
<div class="acoes"><button onclick="window.print()">Imprimir / salvar em PDF</button></div>
<div class="pg">${tarja ? `<div class="tarja"><div>${esc(tarja)}</div></div>` : ''}
<div class="sec top"><div><h1>DANFSe — Documento Auxiliar da NFS-e</h1>
<div class="g" style="margin-top:6px">${linha('Número da NFS-e', d.numero)}${linha('Emissão (processamento)', dataHora(d.dataProcessamento))}${linha('Competência', dataHora(d.dps.competencia))}${linha('DPS (série/número)', d.dps.numero ? `${d.dps.serie}/${d.dps.numero}` : '')}</div>
<div class="c" style="margin-top:6px"><span>Chave de acesso</span><b class="chave">${esc(chaveFmt)}</b></div></div>
<div style="text-align:center">${qr}<div class="rod">Consulte a autenticidade<br>em nfse.gov.br</div></div></div>
<div class="sec"><h2>Prestador do serviço</h2><div class="g">${linha('Nome / razão social', d.prestador.nome)}${linha('Nome fantasia', d.prestador.fantasia)}${linha('CNPJ/CPF', formatarDocumento(d.prestador.documento))}${linha('Inscrição municipal', d.prestador.inscricaoMunicipal)}${linha('Regime', ROTULO_SIMPLES[d.prestador.simples] || '')}${linha('Telefone', d.prestador.telefone)}${linha('E-mail', d.prestador.email)}</div>${d.prestador.endereco ? `<div class="c" style="margin-top:4px"><span>Endereço</span><b>${esc(d.prestador.endereco)}</b></div>` : ''}</div>
<div class="sec"><h2>Tomador do serviço</h2>${d.tomador && (d.tomador.documento || d.tomador.nome) ? `<div class="g">${linha('Nome', d.tomador.nome)}${linha('CPF/CNPJ', formatarDocumento(d.tomador.documento))}${linha('E-mail', d.tomador.email)}</div>${d.tomador.endereco ? `<div class="c"><span>Endereço</span><b>${esc(d.tomador.endereco)}</b></div>` : ''}` : '<div>Tomador não identificado.</div>'}</div>
<div class="sec"><h2>Serviço prestado</h2><div class="g">${linha('Código de tributação nacional', [cTribNacFmt(d.servico.cTribNac), d.descricaoTributacaoNacional].filter(Boolean).join(' — '))}${linha('Código municipal', [d.servico.cTribMun, d.descricaoTributacaoMunicipal].filter(Boolean).join(' — '))}${linha('Local da prestação', d.localPrestacao)}${linha('Local de incidência', d.localIncidencia)}</div>
<div class="c" style="margin-top:4px"><span>Discriminação</span><b class="desc">${esc(d.servico.descricao)}</b></div></div>
<div class="sec"><h2>Valores</h2><div class="g">${linha('Valor do serviço', moeda(v.servico))}${v.descontoIncondicionado ? linha('Desconto incondicionado', moeda(v.descontoIncondicionado)) : ''}${v.descontoCondicionado ? linha('Desconto condicionado', moeda(v.descontoCondicionado)) : ''}${v.baseCalculo ? linha('Base de cálculo', moeda(v.baseCalculo)) : ''}${v.aliquota ? linha('Alíquota ISSQN', `${Number(v.aliquota).toLocaleString('pt-BR')}%`) : ''}${v.issqn ? linha('ISSQN', moeda(v.issqn)) : ''}${v.retencoes ? linha('Retenções', moeda(v.retencoes)) : ''}</div>
<div class="c tot" style="margin-top:6px"><span>Valor líquido da NFS-e</span><b>${moeda(v.liquido || v.servico)}</b></div>
${v.pTotTribSN ? `<div class="rod" style="margin-top:4px">Valor aproximado dos tributos (Simples Nacional): ${esc(Number(v.pTotTribSN).toLocaleString('pt-BR'))}% do valor do serviço.</div>` : ''}</div>
<div class="sec rod">${cancelada ? `<b>NFS-e cancelada${canceladaEm ? ` em ${esc(dataHora(canceladaEm))}` : ''}.</b> ` : ''}Documento auxiliar gerado pelo emissor a partir do XML autorizado pela Sefin Nacional; não substitui a NFS-e. Local de emissão: ${esc(d.localEmissao || '—')}. Verifique pela chave de acesso em ${esc(urlConsulta)}</div>
</div></body></html>`;
}
