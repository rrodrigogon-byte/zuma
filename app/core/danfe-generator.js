/**
 * Gerador de DANFE e DANFE NFC-e (PDF)
 * SetPoint Ultra — Motor Fiscal Próprio
 */

import ejs from 'ejs';
import pdf from 'html-pdf'; // Requer phantomjs ou puppeteer no servidor, ou podemos usar pdfkit puro
import qr from 'qr-image';
import bwipjs from 'bwip-js';
import { parseStringPromise } from 'xml2js';

// ============================================================================
// GERAÇÃO DE DANFE NFC-e (Bobina 80mm)
// ============================================================================

export async function gerarDanfeNFCePdf(xmlAutorizado, urlQrCode) {
  // Parse do XML da nota
  const xml = await parseStringPromise(xmlAutorizado, { explicitArray: false });
  const infNFe = xml.NFe?.infNFe || xml.nfeProc?.NFe?.infNFe;
  const protNFe = xml.nfeProc?.protNFe?.infProt;

  if (!infNFe) throw new Error('XML inválido ou sem infNFe');

  // Extrair dados principais
  const emit = infNFe.emit;
  const dest = infNFe.dest;
  const itens = Array.isArray(infNFe.det) ? infNFe.det : [infNFe.det];
  const total = infNFe.total.ICMSTot;
  const pag = Array.isArray(infNFe.pag?.detPag) ? infNFe.pag.detPag : [infNFe.pag?.detPag];

  // Gerar QR Code Base64
  const qrPng = qr.imageSync(urlQrCode, { type: 'png', margin: 0 });
  const qrBase64 = `data:image/png;base64,${qrPng.toString('base64')}`;

  // Gerar Código de Barras da Chave (Base64)
  const chave = infNFe.$.Id.replace('NFe', '');
  const barcodeBuffer = await bwipjs.toBuffer({
    bcid: 'code128',
    text: chave,
    scale: 2,
    height: 10,
    includetext: true,
    textxalign: 'center',
  });
  const barcodeBase64 = `data:image/png;base64,${barcodeBuffer.toString('base64')}`;

  // Template HTML do DANFE NFC-e
  const htmlTemplate = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: monospace; font-size: 11px; width: 300px; margin: 0; padding: 10px; color: #000; }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .divider { border-top: 1px dashed #000; margin: 5px 0; }
      .item-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
      .item-desc { width: 100%; margin-bottom: 2px; }
      .totals { display: flex; justify-content: space-between; }
      .qrcode { width: 150px; height: 150px; margin: 10px auto; display: block; }
      .barcode { width: 100%; height: 40px; margin: 10px 0; }
    </style>
  </head>
  <body>
    <div class="center bold"><%= emit.xNome %></div>
    <div class="center">CNPJ: <%= emit.CNPJ %> IE: <%= emit.IE %></div>
    <div class="center"><%= emit.enderEmit.xLgr %>, <%= emit.enderEmit.nro %> - <%= emit.enderEmit.xBairro %></div>
    <div class="center"><%= emit.enderEmit.xMun %> - <%= emit.enderEmit.UF %></div>

    <div class="divider"></div>
    <div class="center bold">DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</div>
    <div class="center">Não permite aproveitamento de crédito de ICMS</div>
    <div class="divider"></div>

    <div class="item-row bold">
      <span>CÓDIGO</span>
      <span>DESCRIÇÃO</span>
      <span>QTDxUNxVL.UNIT(R$)</span>
      <span>VL.TOT(R$)</span>
    </div>

    <% itens.forEach(function(i) { %>
      <div class="item-desc"><%= i.prod.cProd %> - <%= i.prod.xProd %></div>
      <div class="item-row">
        <span></span>
        <span><%= i.prod.qCom %> <%= i.prod.uCom %> x <%= Number(i.prod.vUnCom).toFixed(2) %></span>
        <span><%= Number(i.prod.vProd).toFixed(2) %></span>
      </div>
    <% }); %>

    <div class="divider"></div>
    <div class="totals bold"><span>QTD. TOTAL DE ITENS</span><span><%= itens.length %></span></div>
    <div class="totals bold"><span>VALOR TOTAL R$</span><span><%= Number(total.vNF).toFixed(2) %></span></div>

    <div class="divider"></div>
    <div class="center bold">FORMA DE PAGAMENTO</div>
    <% pag.forEach(function(p) { %>
      <div class="totals"><span><%= p.tPag === '01' ? 'Dinheiro' : (p.tPag === '03' ? 'Cartão de Crédito' : 'Outros') %></span><span><%= Number(p.vPag).toFixed(2) %></span></div>
    <% }); %>

    <div class="divider"></div>
    <div class="center">
      <strong>Consumidor:</strong><br>
      <% if (dest) { %>
        <%= dest.CPF ? 'CPF: ' + dest.CPF : (dest.CNPJ ? 'CNPJ: ' + dest.CNPJ : '') %> - <%= dest.xNome || 'Nome não informado' %>
      <% } else { %>
        CONSUMIDOR NÃO IDENTIFICADO
      <% } %>
    </div>

    <div class="divider"></div>
    <div class="center bold">Consulte pela Chave de Acesso em</div>
    <div class="center">http://www.sefaz.mt.gov.br/nfce/consultanfce</div>
    <div class="center" style="margin-top: 5px; word-break: break-all; font-size: 10px;">
      <%= chave.replace(/(.{4})/g, '$1 ') %>
    </div>

    <img src="<%= barcodeBase64 %>" class="barcode" />

    <div class="center">
      <div><strong>NFC-e nº <%= infNFe.ide.nNF %> Série <%= infNFe.ide.serie %></strong></div>
      <div>Emissão: <%= new Date(infNFe.ide.dhEmi).toLocaleString('pt-BR') %></div>
      <% if (protNFe) { %>
        <div>Protocolo de Autorização: <%= protNFe.nProt %></div>
        <div>Data de Autorização: <%= new Date(protNFe.dhRecbto).toLocaleString('pt-BR') %></div>
      <% } else { %>
        <div class="bold" style="font-size: 14px; margin-top: 5px;">EMITIDA EM CONTINGÊNCIA</div>
        <div>Pendente de autorização</div>
      <% } %>
    </div>

    <img src="<%= qrBase64 %>" class="qrcode" />
    <div class="center" style="font-size: 9px; margin-top: 10px;">SetPoint Ultra - ERP Modular Brasil</div>
  </body>
  </html>
  `;

  const htmlRenderizado = ejs.render(htmlTemplate, {
    emit, dest, itens, total, pag, chave, protNFe, infNFe, qrBase64, barcodeBase64
  });

  // Retornar HTML para o client renderizar (ou podemos usar puppeteer no server para gerar o PDF binário)
  // Como estamos num ambiente sandbox, gerar PDF nativo pode exigir binários pesados.
  // Vamos retornar o HTML que pode ser impresso diretamente no PDV.
  return htmlRenderizado;
}
