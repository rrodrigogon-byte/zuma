// DANFE em HTML imprimível (SÓ HOMOLOGAÇÃO): cupom de 80 mm da NFC-e (com QR Code) e DANFE
// simplificado A4 da NF-e. Tudo vem do documento gravado (dados + XML assinado/autorizado); nada
// é recalculado aqui. Todo texto variável passa por `esc` (o HTML é aberto no navegador do usuário).
import QRCode from 'qrcode';

export const TEXTO_HOMOLOGACAO_DANFE = 'EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL';

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const desescaparXml = (v) => String(v ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const pegar = (xml, tag) => { const m = String(xml || '').match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)); return m ? desescaparXml(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, '').trim()) : null; };
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtd = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');

export const formatarChave = (chave) => (soDigitos(chave).match(/.{1,4}/g) || []).join(' ');
export function formatarCnpjCpf(v) {
  const d = soDigitos(v);
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return d;
}
function dataHora(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.valueOf())) return String(v);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Cuiaba', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(d);
}
const MEIOS = { dinheiro: 'Dinheiro', credito: 'Cartão de crédito', debito: 'Cartão de débito', pix: 'PIX', boleto: 'Boleto', credito_loja: 'Crédito loja', cheque: 'Cheque', outros: 'Outros' };

function enderecoEmitente(e) {
  const end = e.endereco || {};
  return [[end.logradouro, end.numero].filter(Boolean).join(', '), end.complemento, end.bairro, [end.cidade, e.uf].filter(Boolean).join(' - '), end.cep ? `CEP ${String(end.cep).replace(/^(\d{5})(\d{3})$/, '$1-$2')}` : null].filter(Boolean).join(' · ');
}

/** Situação que precisa aparecer em destaque no documento auxiliar. */
function avisosSituacao(doc) {
  const avisos = [];
  if (doc.status === 'contingencia' || doc.tp_emis === '9') avisos.push('EMITIDA EM CONTINGÊNCIA');
  if (doc.status === 'contingencia') avisos.push('Pendente de autorização');
  if (doc.status === 'cancelado') avisos.push('DOCUMENTO CANCELADO');
  if (['validado_localmente', 'rejeitado', 'falha_comunicacao', 'enviando', 'rascunho'].includes(doc.status)) avisos.push('DOCUMENTO NÃO AUTORIZADO PELA SEFAZ');
  return avisos;
}

function linhaTributos(trib) {
  if (!trib || !(trib.total >= 0)) return '';
  return `<p class="trib">Tributos aproximados: R$ ${brl(trib.total)} (Fonte: ${esc(trib.fonte || 'IBPT')})</p>`
    + `<p class="trib pequeno">Federal R$ ${brl(trib.federal)} · Estadual R$ ${brl(trib.estadual)} · Municipal R$ ${brl(trib.municipal)}${trib.chave ? ` · Chave ${esc(trib.chave)}` : ''}${trib.versao ? ` · Versão ${esc(trib.versao)}` : ''}</p>`;
}

const CSS_CUPOM = `@page{size:80mm auto;margin:2mm}*{box-sizing:border-box}body{margin:0 auto;width:76mm;padding:2mm;font:11px/1.35 "Courier New",Courier,monospace;color:#000;background:#fff}
h1,h2,p{margin:0}h1{font-size:12px;text-align:center}.c{text-align:center}.b{font-weight:bold}.pequeno{font-size:9.5px}
.sep{border-top:1px dashed #000;margin:4px 0}.aviso{border:1px solid #000;padding:3px;margin:4px 0;text-align:center;font-weight:bold}
table{width:100%;border-collapse:collapse}th,td{padding:1px 0;vertical-align:top;font-size:10px}th{text-align:left;border-bottom:1px solid #000}.r{text-align:right}
.tot td{font-size:11px}.qr{display:flex;justify-content:center;margin:6px 0}.qr svg{width:34mm;height:34mm}.chave{word-spacing:2px;font-size:10px}.trib{font-size:10px;text-align:center}
@media screen{body{box-shadow:0 0 0 1px #ccc;margin:12px auto}}`;

const CSS_A4 = `@page{size:A4;margin:10mm}*{box-sizing:border-box}body{margin:0 auto;max-width:190mm;font:11px/1.35 Arial,Helvetica,sans-serif;color:#000;background:#fff}
h1,h2,p{margin:0}.caixa{border:1px solid #000;padding:4px 6px;margin-bottom:4px}.grade{display:grid;gap:4px}.g2{grid-template-columns:2fr 1fr}.g3{grid-template-columns:2fr 1fr 1fr}.g4{grid-template-columns:repeat(4,1fr)}
.rot{font-size:8px;text-transform:uppercase;color:#333}.v{font-size:11px;font-weight:bold}.aviso{border:2px solid #000;padding:4px;margin:4px 0;text-align:center;font-weight:bold;font-size:13px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:2px 3px;font-size:9.5px;vertical-align:top}th{background:#eee;text-align:left}.r{text-align:right}.chave{font-family:"Courier New",monospace;font-size:12px;letter-spacing:.5px}
h2{font-size:10px;margin:6px 0 2px;text-transform:uppercase}@media screen{body{margin:12px auto}}`;

/** DANFE NFC-e (cupom 80 mm). */
export async function danfeNfceHtml({ doc, emitente }) {
  const dados = doc.dados || {};
  const xml = doc.xml_autorizado || doc.xml_assinado || '';
  const qrUrl = pegar(xml, 'qrCode');
  const urlChave = pegar(xml, 'urlChave');
  const itens = dados.itens || [];
  const pagamentos = dados.pagamentos || [];
  const total = Number(doc.valor_total || 0);
  const pago = pagamentos.reduce((s, p) => s + Number(p.valor || 0), 0);
  const dest = dados.destinatario || null;
  const docDest = soDigitos(dest?.cnpj) || soDigitos(dest?.cpf);
  const qrSvg = qrUrl ? await QRCode.toString(qrUrl, { type: 'svg', errorCorrectionLevel: 'M', margin: 0 }) : '';
  const linhasItens = itens.map((i, idx) => `<tr><td>${idx + 1}</td><td>${esc(i.produtoId || i.fonteId || '')}</td><td colspan="4">${esc(i.descricaoOriginal || i.descricao)}</td></tr>`
    + `<tr><td></td><td></td><td class="r">${qtd(i.quantidade)}</td><td>${esc(i.unidade || 'UN')}</td><td class="r">x ${brl(i.valorUnitario)}</td><td class="r">${brl(i.valorProduto)}</td></tr>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DANFE NFC-e ${esc(doc.serie)}/${esc(doc.numero)} (homologação)</title><style>${CSS_CUPOM}</style></head><body>
<h1>${esc(emitente.razao_social)}</h1>
${emitente.nome_fantasia ? `<p class="c">${esc(emitente.nome_fantasia)}</p>` : ''}
<p class="c pequeno">CNPJ ${esc(formatarCnpjCpf(emitente.cnpj))}${emitente.ie ? ` · IE ${esc(emitente.ie)}` : ''}</p>
<p class="c pequeno">${esc(enderecoEmitente(emitente))}</p>
<div class="sep"></div>
<p class="c b pequeno">DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA</p>
<p class="aviso">${TEXTO_HOMOLOGACAO_DANFE}</p>
${avisosSituacao(doc).map((a) => `<p class="aviso">${esc(a)}</p>`).join('')}
<table><thead><tr><th>#</th><th>Código</th><th class="r">Qtde</th><th>Un</th><th class="r">Vl unit</th><th class="r">Vl total</th></tr></thead><tbody>${linhasItens}</tbody></table>
<div class="sep"></div>
<table class="tot"><tbody>
<tr><td>Qtde. total de itens</td><td class="r">${itens.length}</td></tr>
${Number(dados.desconto) > 0 ? `<tr><td>Desconto R$</td><td class="r">${brl(dados.desconto)}</td></tr>` : ''}
<tr><td class="b">Valor a pagar R$</td><td class="r b">${brl(total)}</td></tr>
<tr><td class="b">FORMA DE PAGAMENTO</td><td class="r b">VALOR PAGO R$</td></tr>
${pagamentos.map((p) => `<tr><td>${esc(MEIOS[p.meio] || p.meio)}</td><td class="r">${brl(p.valor)}</td></tr>`).join('')}
${pago > total ? `<tr><td>Troco R$</td><td class="r">${brl(pago - total)}</td></tr>` : ''}
</tbody></table>
<div class="sep"></div>
<p class="c b pequeno">Consulte pela Chave de Acesso em</p>
<p class="c pequeno">${esc(urlChave || '')}</p>
<p class="c chave">${esc(formatarChave(doc.chave))}</p>
<div class="sep"></div>
<p class="c pequeno">${docDest ? `CONSUMIDOR ${docDest.length === 14 ? 'CNPJ' : 'CPF'}: ${esc(formatarCnpjCpf(docDest))}${dest?.nome && dest.nome !== 'CONSUMIDOR' ? ` · ${esc(dest.nome)}` : ''}` : 'CONSUMIDOR NÃO IDENTIFICADO'}</p>
<p class="c b">NFC-e nº ${esc(String(doc.numero).padStart(9, '0'))} Série ${esc(String(doc.serie).padStart(3, '0'))} ${esc(dataHora(dados.dhEmi || doc.criado_em))}</p>
${doc.protocolo ? `<p class="c pequeno">Protocolo de autorização: ${esc(doc.protocolo)}</p><p class="c pequeno">Data de autorização: ${esc(dataHora(doc.autorizado_em))}</p>` : ''}
${qrSvg ? `<div class="qr" aria-label="QR Code de consulta">${qrSvg}</div>` : ''}
${linhaTributos(dados.tributos)}
<p class="c pequeno">${TEXTO_HOMOLOGACAO_DANFE}</p>
</body></html>`;
}

/** DANFE simplificado da NF-e (A4) com os campos essenciais. */
export function danfeNfeHtml({ doc, emitente }) {
  const dados = doc.dados || {};
  const xml = doc.xml_autorizado || doc.xml_assinado || '';
  const itens = dados.itens || [];
  const dest = dados.destinatario || {};
  const endDest = dest.endereco || dest;
  const icmsTot = String(xml).match(/<ICMSTot>([\s\S]*?)<\/ICMSTot>/)?.[1] || '';
  const totalIcms = pegar(icmsTot, 'vICMS');
  const baseIcms = pegar(icmsTot, 'vBC');
  const natOp = pegar(xml, 'natOp') || emitente.natureza_operacao;
  const campo = (rot, val) => `<div><div class="rot">${esc(rot)}</div><div class="v">${val}</div></div>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DANFE NF-e ${esc(doc.serie)}/${esc(doc.numero)} (homologação)</title><style>${CSS_A4}</style></head><body>
<p class="aviso">${TEXTO_HOMOLOGACAO_DANFE}</p>
${avisosSituacao(doc).map((a) => `<p class="aviso">${esc(a)}</p>`).join('')}
<div class="grade g2">
  <div class="caixa"><div class="v" style="font-size:14px">${esc(emitente.razao_social)}</div><div>${esc(enderecoEmitente(emitente))}</div>
    <div>CNPJ ${esc(formatarCnpjCpf(emitente.cnpj))}${emitente.ie ? ` · IE ${esc(emitente.ie)}` : ''}${emitente.im ? ` · IM ${esc(emitente.im)}` : ''}</div></div>
  <div class="caixa"><div class="v" style="font-size:16px">DANFE</div><div>Documento Auxiliar da Nota Fiscal Eletrônica</div>
    <div>1 - SAÍDA</div><div class="v">Nº ${esc(String(doc.numero).padStart(9, '0'))} · Série ${esc(String(doc.serie).padStart(3, '0'))}</div></div>
</div>
<div class="caixa">${campo('Chave de acesso', `<span class="chave">${esc(formatarChave(doc.chave))}</span>`)}
  <div class="pequeno">Consulta de autenticidade no portal nacional da NF-e (www.nfe.fazenda.gov.br/portal) ou no site da SEFAZ autorizadora.</div></div>
<div class="caixa grade g3">${campo('Natureza da operação', esc(natOp || ''))}${campo('Protocolo de autorização', doc.protocolo ? `${esc(doc.protocolo)} · ${esc(dataHora(doc.autorizado_em))}` : '—')}${campo('Data de emissão', esc(dataHora(dados.dhEmi || doc.criado_em)))}</div>
<h2>Destinatário / remetente</h2>
<div class="caixa grade g3">${campo('Nome / razão social', esc(dest.nome || ''))}${campo('CNPJ / CPF', esc(formatarCnpjCpf(dest.cnpj || dest.cpf)))}${campo('Inscrição estadual', esc(dest.ie || ''))}</div>
<div class="caixa grade g4">${campo('Endereço', esc([endDest.logradouro, endDest.numero].filter(Boolean).join(', ')))}${campo('Bairro', esc(endDest.bairro || ''))}${campo('Município / UF', esc([endDest.cidade, endDest.uf].filter(Boolean).join(' - ')))}${campo('CEP', esc(endDest.cep || ''))}</div>
<h2>Cálculo do imposto</h2>
<div class="caixa grade g4">${campo('Base de cálculo do ICMS', brl(baseIcms))}${campo('Valor do ICMS', brl(totalIcms))}${campo('Valor total dos produtos', brl(itens.reduce((s, i) => s + Number(i.valorProduto || 0), 0)))}${campo('Valor total da nota', brl(doc.valor_total))}</div>
${dados.tributos ? `<div class="caixa">${campo('Valor aproximado dos tributos', `R$ ${brl(dados.tributos.total)} (Fonte: ${esc(dados.tributos.fonte || 'IBPT')})`)}</div>` : ''}
<h2>Dados dos produtos / serviços</h2>
<table><thead><tr><th>Código</th><th>Descrição</th><th>NCM</th><th>CFOP</th><th>Un</th><th class="r">Qtde</th><th class="r">Vl unit</th><th class="r">Vl total</th></tr></thead><tbody>
${itens.map((i) => `<tr><td>${esc(i.produtoId || i.fonteId || '')}</td><td>${esc(i.descricaoOriginal || i.descricao)}</td><td>${esc(i.ncm || '')}</td><td>${esc(i.cfop || '')}</td><td>${esc(i.unidade || 'UN')}</td><td class="r">${qtd(i.quantidade)}</td><td class="r">${brl(i.valorUnitario)}</td><td class="r">${brl(i.valorProduto)}</td></tr>`).join('')}
</tbody></table>
<h2>Dados adicionais</h2>
<div class="caixa"><p>${TEXTO_HOMOLOGACAO_DANFE}.</p>${dados.tributos ? `<p>Tributos aproximados: R$ ${brl(dados.tributos.total)} (Fonte: ${esc(dados.tributos.fonte || 'IBPT')})</p>` : ''}</div>
</body></html>`;
}
