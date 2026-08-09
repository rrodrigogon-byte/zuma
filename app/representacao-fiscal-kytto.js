import QRCode from 'qrcode';
import bwipjs from 'bwip-js';
import { DOMParser } from '@xmldom/xmldom';

function texto(valor, tamanho = 400) {
  return String(valor ?? '').trim().slice(0, tamanho);
}

function escaparHtml(valor) {
  return texto(valor).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function moeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numero(valor));
}

function formatarChave(chave) {
  return String(chave || '').replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function primeiro(elemento, tag) {
  return elemento?.getElementsByTagName(tag)?.[0]?.textContent || '';
}

function todos(elemento, tag) {
  return Array.from(elemento?.getElementsByTagName(tag) || []);
}

function meioPagamento(codigo) {
  const mapa = { '01': 'Dinheiro', '02': 'Cheque', '03': 'Cartão de crédito', '04': 'Cartão de débito', '10': 'Vale-alimentação', '11': 'Vale-refeição', '12': 'Vale-presente', '13': 'Vale-combustível', '14': 'Duplicata mercantil', '15': 'Boleto bancário', '16': 'Depósito bancário', '17': 'PIX', '18': 'Transferência bancária', '19': 'Programa de fidelidade', '90': 'Sem pagamento', '99': 'Outros' };
  return mapa[String(codigo || '')] || 'Outros';
}

export async function gerarRepresentacaoAuxiliarNfce({ xmlAssinado, documento = {}, modo = 'rascunho' } = {}) {
  if (!xmlAssinado) throw new Error('O XML assinado é obrigatório para gerar a representação auxiliar.');
  const xml = new DOMParser().parseFromString(xmlAssinado, 'application/xml');
  const infNFe = xml.getElementsByTagName('infNFe')[0];
  const ide = xml.getElementsByTagName('ide')[0];
  const emit = xml.getElementsByTagName('emit')[0];
  const total = xml.getElementsByTagName('ICMSTot')[0];
  if (!infNFe || primeiro(ide, 'mod') !== '65' || !emit || !total) throw new Error('A representação auxiliar desta etapa atende somente NFC-e modelo 65 com XML válido.');

  const chave = texto(infNFe.getAttribute('Id')).replace(/^NFe/, '');
  const qrCode = primeiro(xml.getElementsByTagName('infNFeSupl')[0], 'qrCode');
  const qrDataUrl = qrCode ? await QRCode.toDataURL(qrCode, { errorCorrectionLevel: 'M', margin: 2, width: 260 }) : null;
  const barras = await bwipjs.toBuffer({ bcid: 'code128', text: chave, scale: 2, height: 10, includetext: false });
  const barrasDataUrl = `data:image/png;base64,${barras.toString('base64')}`;
  const itens = todos(xml, 'det').map((detalhe) => {
    const produto = detalhe.getElementsByTagName('prod')[0];
    return { codigo: primeiro(produto, 'cProd'), descricao: primeiro(produto, 'xProd'), quantidade: primeiro(produto, 'qCom'), unidade: primeiro(produto, 'uCom'), unitario: primeiro(produto, 'vUnCom'), total: primeiro(produto, 'vProd') };
  });
  const pagamentos = todos(xml.getElementsByTagName('pag')[0], 'detPag').map((pagamento) => ({ codigo: primeiro(pagamento, 'tPag'), valor: primeiro(pagamento, 'vPag') }));
  const destinatario = xml.getElementsByTagName('dest')[0];
  const statusContingencia = String(documento?.contingencia?.status || '').toLowerCase() === 'pendente';
  const ambiente = String(documento?.ambiente || 'homologacao').toLowerCase();
  const marcaRascunho = modo !== 'autorizado' || documento.status !== 'autorizada';
  const aviso = statusContingencia
    ? 'CONTINGÊNCIA INTERNA — NÃO TRANSMITIDA À SEFAZ'
    : ambiente !== 'producao'
      ? 'EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL'
      : 'RASCUNHO VALIDADO LOCALMENTE — SEM AUTORIZAÇÃO SEFAZ';

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Representação auxiliar NFC-e ${escaparHtml(primeiro(ide, 'nNF'))}</title>
<style>
@page { margin: 6mm; } *{box-sizing:border-box} body{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#111;max-width:80mm;margin:0 auto;padding:5mm;font-size:11px;line-height:1.35}.center{text-align:center}.bold{font-weight:800}.divider{border-top:1px dashed #444;margin:8px 0}.notice{border:2px solid #B42318;background:#FFF1F0;color:#8A1C13;text-align:center;font-weight:900;padding:7px;margin:8px 0}.row{display:flex;justify-content:space-between;gap:8px}.item{margin:5px 0}.small{font-size:9px;color:#444}.qr{width:42mm;height:42mm;display:block;margin:10px auto}.barcode{width:100%;height:34px;object-fit:fill;margin:8px 0}@media print{body{padding:0}.no-print{display:none}}
</style></head><body>
<div class="notice">${escaparHtml(aviso)}</div>
<div class="center bold">${escaparHtml(primeiro(emit, 'xNome'))}</div>
<div class="center">CNPJ: ${escaparHtml(primeiro(emit, 'CNPJ'))} · IE: ${escaparHtml(primeiro(emit, 'IE'))}</div>
<div class="center small">${escaparHtml(primeiro(emit, 'xLgr'))}, ${escaparHtml(primeiro(emit, 'nro'))} — ${escaparHtml(primeiro(emit, 'xBairro'))}<br>${escaparHtml(primeiro(emit, 'xMun'))}/${escaparHtml(primeiro(emit, 'UF'))}</div>
<div class="divider"></div>
<div class="center bold">REPRESENTAÇÃO AUXILIAR DE NFC-e</div>
<div class="center small">Rascunho para conferência operacional. Não substitui DANFE autorizado.</div>
<div class="divider"></div>
${itens.map(item => `<div class="item"><div class="bold">${escaparHtml(item.codigo)} — ${escaparHtml(item.descricao)}</div><div class="row"><span>${escaparHtml(item.quantidade)} ${escaparHtml(item.unidade)} × ${moeda(item.unitario)}</span><span>${moeda(item.total)}</span></div></div>`).join('')}
<div class="divider"></div>
<div class="row bold"><span>ITENS DISTINTOS</span><span>${itens.length}</span></div>
<div class="row bold"><span>VALOR DOS PRODUTOS</span><span>${moeda(primeiro(total, 'vProd'))}</span></div>
${numero(primeiro(total, 'vDesc')) > 0 ? `<div class="row"><span>DESCONTO</span><span>-${moeda(primeiro(total, 'vDesc'))}</span></div>` : ''}
<div class="row bold"><span>VALOR A PAGAR</span><span>${moeda(primeiro(total, 'vNF'))}</span></div>
<div class="divider"></div>
<div class="center bold">PAGAMENTOS</div>
${pagamentos.map(pagamento => `<div class="row"><span>${escaparHtml(meioPagamento(pagamento.codigo))}</span><span>${moeda(pagamento.valor)}</span></div>`).join('')}
<div class="divider"></div>
<div class="center">${destinatario ? `CONSUMIDOR: ${escaparHtml(primeiro(destinatario, 'CPF') || primeiro(destinatario, 'CNPJ') || 'IDENTIFICADO')}` : 'CONSUMIDOR NÃO IDENTIFICADO'}</div>
<div class="divider"></div>
<div class="center bold">CHAVE DE ACESSO</div><div class="center small">${escaparHtml(formatarChave(chave))}</div><img class="barcode" src="${barrasDataUrl}" alt="Código de barras da chave de acesso">
${qrDataUrl ? `<img class="qr" src="${qrDataUrl}" alt="QR Code de consulta da NFC-e">` : '<div class="center small">QR Code não disponível no XML.</div>'}
<div class="center">NFC-e nº ${escaparHtml(primeiro(ide, 'nNF'))} · Série ${escaparHtml(primeiro(ide, 'serie'))}</div>
<div class="center small">Emissão: ${escaparHtml(primeiro(ide, 'dhEmi'))}</div>
<div class="center small">Hash XML: ${escaparHtml(documento.hashXmlAssinado || 'não informado')}</div>
<div class="center no-print" style="margin-top:12px"><button onclick="window.print()">Imprimir rascunho</button></div>
</body></html>`;
}

export default { gerarRepresentacaoAuxiliarNfce };
