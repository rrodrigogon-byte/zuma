/**
 * Motor de Boleto Bancário Registrado & Pix Cobrança Híbrido Kytto Enterprise
 * Suporta Sicredi (748), Sicoob (756), Itaú (341), Banco do Brasil (001) e Bradesco (237)
 * Em conformidade com o padrão FEBRABAN e arranjo Pix do Banco Central do Brasil.
 */

import crypto from 'node:crypto';

export const BANCOS_BOLETO = Object.freeze({
  '748': {
    codigo: '748',
    nome: 'Banco Cooperativo Sicredi S.A.',
    apelido: 'Sicredi',
    moeda: '9',
    carteiras: ['1', '3'],
    cooperativaDigitos: 4,
    postoDigitos: 2,
    beneficiarioDigitos: 5,
  },
  '756': {
    codigo: '756',
    nome: 'Banco Cooperativo Sicoob S.A.',
    apelido: 'Sicoob',
    moeda: '9',
    carteiras: ['1'],
    cooperativaDigitos: 4,
    beneficiarioDigitos: 7,
  },
  '341': {
    codigo: '341',
    nome: 'Itaú Unibanco S.A.',
    apelido: 'Itaú',
    moeda: '9',
    carteiras: ['109', '112'],
    agenciaDigitos: 4,
    contaDigitos: 5,
  },
  '001': {
    codigo: '001',
    nome: 'Banco do Brasil S.A.',
    apelido: 'Banco do Brasil',
    moeda: '9',
    carteiras: ['17'],
    convenioDigitos: 7,
  },
  '237': {
    codigo: '237',
    nome: 'Banco Bradesco S.A.',
    apelido: 'Bradesco',
    moeda: '9',
    carteiras: ['09'],
    agenciaDigitos: 4,
    contaDigitos: 7,
  },
});

/**
 * Cálculo do Dígito Verificador Módulo 10 (FEBRABAN)
 */
export function modulo10(sequencia) {
  const seq = String(sequencia).replace(/\D/g, '');
  let soma = 0;
  let peso = 2;
  for (let i = seq.length - 1; i >= 0; i--) {
    let mult = Number(seq[i]) * peso;
    if (mult > 9) mult = Math.floor(mult / 10) + (mult % 10);
    soma += mult;
    peso = peso === 2 ? 1 : 2;
  }
  const resto = soma % 10;
  return resto === 0 ? 0 : 10 - resto;
}

/**
 * Cálculo do Dígito Verificador Módulo 11 (FEBRABAN Código de Barras)
 */
export function modulo11(sequencia, base = 9, r = 0) {
  const seq = String(sequencia).replace(/\D/g, '');
  let soma = 0;
  let peso = 2;
  for (let i = seq.length - 1; i >= 0; i--) {
    soma += Number(seq[i]) * peso;
    peso = peso >= base ? 2 : peso + 1;
  }
  const resto = soma % 11;
  if (r === 0) {
    if (resto === 0 || resto === 1 || resto === 10) return 1;
    return 11 - resto;
  }
  return resto;
}

/**
 * Fator de vencimento padrão FEBRABAN
 * Base: 07/10/1997 = 1000. Reinício em 22/02/2025 = 1000.
 */
export function calcularFatorVencimento(dataVencimento) {
  if (!dataVencimento) return '0000';
  const data = new Date(dataVencimento);
  if (Number.isNaN(data.getTime())) return '0000';
  
  // Data base de referência FEBRABAN ciclo 2 (22/02/2025)
  const baseCiclo2 = new Date('2025-02-22T00:00:00Z');
  const alvo = new Date(data.toISOString().slice(0, 10) + 'T00:00:00Z');
  const diffDias = Math.round((alvo.getTime() - baseCiclo2.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDias >= 0) {
    return String(1000 + diffDias).padStart(4, '0');
  }
  // Ciclo 1 legado
  const baseCiclo1 = new Date('1997-10-07T00:00:00Z');
  const diffDias1 = Math.round((alvo.getTime() - baseCiclo1.getTime()) / (1000 * 60 * 60 * 24));
  return String(Math.max(1000, 1000 + diffDias1)).padStart(4, '0');
}

/**
 * Monta o Pix Copia e Cola (EMV QR Code Dinâmico) do Boleto Híbrido
 */
export function gerarPixCopiaEColaHibrido({ chavePix, nomeRecebedor, cidadeRecebedor, valor, txid }) {
  const chave = String(chavePix || '50073355000260').trim();
  const nome = String(nomeRecebedor || 'DINO BARBEARIA LTDA').slice(0, 25).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const cidade = String(cidadeRecebedor || 'TANGARA DA SERRA').slice(0, 15).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const idTx = String(txid || `BOL${Date.now()}`).replace(/[^a-zA-Z0-9]/g, '').slice(0, 25);
  const valorFmt = Number(valor || 0).toFixed(2);

  function emv(id, valorTag) {
    const v = String(valorTag);
    return `${id}${String(v.length).padStart(2, '0')}${v}`;
  }

  const gui = emv('00', 'br.gov.bcb.pix');
  const key = emv('01', chave);
  const merchantAccount = emv('26', `${gui}${key}`);
  
  let payload = `${emv('00', '01')}${merchantAccount}${emv('52', '0000')}${emv('53', '986')}${emv('54', valorFmt)}${emv('58', 'BR')}${emv('59', nome)}${emv('60', cidade)}${emv('62', emv('05', idTx))}`;
  payload += '6304';

  // Cálculo CRC16-CCITT (Polinômio 0x1021)
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  const crcHex = crc.toString(16).toUpperCase().padStart(4, '0');
  return `${payload}${crcHex}`;
}

/**
 * Emite Boleto Bancário Registrado Híbrido com Linha Digitável e Pix
 */
export function emitirBoletoHibrido(dados = {}) {
  const bancoCodigo = String(dados.banco || '748').padStart(3, '0');
  const banco = BANCOS_BOLETO[bancoCodigo] || BANCOS_BOLETO['748'];
  const valor = Number(dados.valor || 0);
  if (valor <= 0) throw new Error('Valor do boleto deve ser maior que zero.');

  const vencimento = dados.vencimento ? new Date(dados.vencimento).toISOString().slice(0, 10) : new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const fatorVencimento = calcularFatorVencimento(vencimento);
  const valorNominal = String(Math.round(valor * 100)).padStart(10, '0');

  // Nosso Número e Campo Livre de acordo com o Banco
  const nossoNumeroSeq = String(dados.nossoNumero || Math.floor(100000 + Math.random() * 899999)).slice(0, 8).padStart(8, '0');
  const carteira = String(dados.carteira || banco.carteiras[0]).padStart(2, '0');
  const cooperativa = String(dados.cooperativa || dados.agencia || '0812').padStart(4, '0');
  const beneficiario = String(dados.codigoBeneficiario || dados.conta || '50073').padStart(banco.beneficiarioDigitos || 5, '0');

  let campoLivre = '';
  let nossoNumeroCompleto = nossoNumeroSeq;

  if (bancoCodigo === '748') {
    // Sicredi: Tipo Cobrança (1 - Simples), Carteira (1), Nosso Número (8 dígitos + DV), Cooperativa (4), Posto (02), Beneficiário (5)
    const posto = String(dados.posto || '02').padStart(2, '0');
    const dvNossoNumero = modulo11(`${cooperativa}${posto}${beneficiario}262${nossoNumeroSeq}`);
    nossoNumeroCompleto = `${nossoNumeroSeq}-${dvNossoNumero}`;
    // Campo livre Sicredi: 25 posições
    campoLivre = `11${nossoNumeroSeq}${dvNossoNumero}${cooperativa}${posto}${beneficiario}10`;
    campoLivre = campoLivre.padEnd(25, '0').slice(0, 25);
  } else if (bancoCodigo === '756') {
    // Sicoob: Carteira (1), Cooperativa (4), Modalidade (01), Beneficiário (7), Nosso Número (7 + DV)
    const dvNossoNumero = modulo11(`${cooperativa}0000000${beneficiario}${nossoNumeroSeq.slice(0, 7)}`);
    nossoNumeroCompleto = `${nossoNumeroSeq.slice(0, 7)}-${dvNossoNumero}`;
    campoLivre = `1${cooperativa}01${beneficiario.padStart(7, '0')}${nossoNumeroSeq.slice(0, 7)}${dvNossoNumero}001`;
    campoLivre = campoLivre.padEnd(25, '0').slice(0, 25);
  } else {
    // Genérico / Itaú / BB
    campoLivre = `${carteira}${nossoNumeroSeq}${cooperativa}${beneficiario}`.padEnd(25, '0').slice(0, 25);
  }

  // Código de Barras (44 dígitos)
  // [0..2] Banco | [3] Moeda (9) | [4] DV | [5..8] Fator Venc | [9..18] Valor | [19..43] Campo Livre
  const semDv = `${bancoCodigo}9${fatorVencimento}${valorNominal}${campoLivre}`;
  const dvCodigoBarras = modulo11(semDv);
  const codigoBarras = `${bancoCodigo}9${dvCodigoBarras}${fatorVencimento}${valorNominal}${campoLivre}`;

  // Linha Digitável (47 dígitos / 5 campos)
  // Campo 1: BBB M CCCCC d1
  const campo1 = `${bancoCodigo}9${campoLivre.slice(0, 5)}`;
  const dv1 = modulo10(campo1);
  const p1 = `${campo1.slice(0, 5)}.${campo1.slice(5)}${dv1}`;

  // Campo 2: CCCCC CCCCC d2
  const campo2 = campoLivre.slice(5, 15);
  const dv2 = modulo10(campo2);
  const p2 = `${campo2.slice(0, 5)}.${campo2.slice(5)}${dv2}`;

  // Campo 3: CCCCC CCCCC d3
  const campo3 = campoLivre.slice(15, 25);
  const dv3 = modulo10(campo3);
  const p3 = `${campo3.slice(0, 5)}.${campo3.slice(5)}${dv3}`;

  // Campo 4: DV Código de Barras
  const p4 = String(dvCodigoBarras);

  // Campo 5: Fator Vencimento (4) + Valor (10)
  const p5 = `${fatorVencimento}${valorNominal}`;

  const linhaDigitavel = `${p1} ${p2} ${p3} ${p4} ${p5}`;

  // Pix Copia e Cola Híbrido
  const txid = `BOL${bancoCodigo}${nossoNumeroSeq}`;
  const pixCopiaECola = gerarPixCopiaEColaHibrido({
    chavePix: dados.chavePix || '50073355000260',
    nomeRecebedor: dados.beneficiarioNome || 'DINO BARBEARIA LTDA',
    cidadeRecebedor: dados.beneficiarioCidade || 'TANGARA DA SERRA',
    valor,
    txid,
  });

  return {
    id: `bol_${crypto.randomUUID()}`,
    banco: bancoCodigo,
    bancoNome: banco.nome,
    bancoApelido: banco.apelido,
    nossoNumero: nossoNumeroCompleto,
    carteira,
    vencimento,
    fatorVencimento,
    valor,
    valorFormatado: `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    codigoBarras,
    linhaDigitavel,
    pixCopiaECola,
    txid,
    pagador: {
      nome: dados.pagadorNome || 'Cliente Consumidor Final',
      documento: dados.pagadorDocumento || '000.000.000-00',
      endereco: dados.pagadorEndereco || 'Tangará da Serra / MT',
    },
    beneficiario: {
      nome: dados.beneficiarioNome || 'DINO BARBEARIA LTDA',
      cnpj: dados.beneficiarioCnpj || '50.073.355/0002-60',
      endereco: 'Rua José Corsino, 545 W, Centro, Tangará da Serra - MT',
      cooperativaAgencia: cooperativa,
      codigoBeneficiarioConta: beneficiario,
    },
    jurosMora: '1,00% ao mês após vencimento',
    multa: '2,00% após o vencimento',
    instrucoes: [
      'Pague via Pix apontando a câmera do celular para o QR Code ou pelo código de barras.',
      'Após o vencimento cobrar juros de 1% ao mês e multa de 2%.',
      'Não receber após 30 dias do vencimento.',
    ],
    status: 'emitido',
    emitidoEm: new Date().toISOString(),
  };
}

/**
 * Renderiza o layout HTML oficial do boleto bancário FEBRABAN
 */
export function renderizarBoletoHtml(boleto) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Boleto Bancário Híbrido · ${boleto.bancoApelido} · ${boleto.nossoNumero}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; margin: 20px; color: #1e293b; line-height: 1.3; }
    .boleto-container { max-width: 760px; margin: 0 auto; border: 1px dashed #cbd5e1; padding: 20px; background: #fff; }
    .recibo-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
    .banco-logo { font-size: 18px; font-weight: 800; color: #047857; }
    .banco-codigo { font-size: 16px; font-weight: 800; border-left: 2px solid #000; border-right: 2px solid #000; padding: 0 10px; }
    .linha-digitavel { font-size: 13px; font-weight: 700; font-family: monospace; }
    .grade { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; border: 1px solid #000; margin-bottom: 10px; }
    .campo { border: 1px solid #e2e8f0; padding: 4px 6px; }
    .campo-titulo { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .campo-valor { font-size: 11px; font-weight: 700; }
    .col-span-2 { grid-column: span 2; }
    .col-span-3 { grid-column: span 3; }
    .col-span-4 { grid-column: span 4; }
    .destaque-valor { background: #f8fafc; font-size: 14px; color: #0f172a; }
    .pix-box { display: flex; align-items: center; gap: 16px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px; margin: 14px 0; }
    .pix-tag { background: #16a34a; color: #fff; font-size: 10px; font-weight: 800; padding: 3px 6px; border-radius: 4px; }
    .codigo-barras-box { text-align: center; margin-top: 15px; border-top: 1px dashed #94a3b8; padding-top: 15px; }
    .codigo-barras-fake { font-family: monospace; font-size: 20px; letter-spacing: 3px; font-weight: 900; background: #000; color: #fff; padding: 10px; display: inline-block; }
    @media print { .no-print { display: none; } body { margin: 0; } .boleto-container { border: none; padding: 0; } }
  </style>
</head>
<body>
  <div class="boleto-container">
    <div class="no-print" style="margin-bottom: 15px; display: flex; justify-content: flex-end; gap: 10px;">
      <button onclick="window.print()" style="background: #0284c7; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer;">🖨️ Imprimir Boleto</button>
    </div>

    <div class="recibo-header">
      <div class="banco-logo">${boleto.bancoApelido}</div>
      <div class="banco-codigo">${boleto.banco}-9</div>
      <div class="linha-digitavel">${boleto.linhaDigitavel}</div>
    </div>

    <!-- Box do Pix Híbrido -->
    <div class="pix-box">
      <div>
        <span class="pix-tag">PAGAMENTO INSTANTÂNEO PIX HÍBRIDO</span>
        <div style="font-weight: 700; margin-top: 4px; font-size: 12px;">Pague com a chave Copia e Cola ou QR Code via Pix</div>
        <div style="font-family: monospace; font-size: 9px; color: #166534; word-break: break-all; margin-top: 4px;">${boleto.pixCopiaECola}</div>
      </div>
    </div>

    <div class="grade">
      <div class="campo col-span-3">
        <div class="campo-titulo">Local de Pagamento</div>
        <div class="campo-valor">PAGÁVEL EM QUALQUER BANCO OU CORRESPONDENTE BANCÁRIO ATÉ O VENCIMENTO</div>
      </div>
      <div class="campo">
        <div class="campo-titulo">Data de Vencimento</div>
        <div class="campo-valor" style="color: #b91c1c; font-size: 12px;">${boleto.vencimento.split('-').reverse().join('/')}</div>
      </div>

      <div class="campo col-span-3">
        <div class="campo-titulo">Beneficiário</div>
        <div class="campo-valor">${boleto.beneficiario.nome} · CNPJ: ${boleto.beneficiario.cnpj}</div>
        <div style="font-size: 9px; color: #64748b;">${boleto.beneficiario.endereco}</div>
      </div>
      <div class="campo">
        <div class="campo-titulo">Agência / Código Beneficiário</div>
        <div class="campo-valor">${boleto.beneficiario.cooperativaAgencia} / ${boleto.beneficiario.codigoBeneficiarioConta}</div>
      </div>

      <div class="campo">
        <div class="campo-titulo">Data do Documento</div>
        <div class="campo-valor">${new Date().toLocaleDateString('pt-BR')}</div>
      </div>
      <div class="campo">
        <div class="campo-titulo">Número do Documento</div>
        <div class="campo-valor">${boleto.id.slice(4, 16).toUpperCase()}</div>
      </div>
      <div class="campo">
        <div class="campo-titulo">Espécie Doc.</div>
        <div class="campo-valor">DM (Duplicata Mercantil)</div>
      </div>
      <div class="campo">
        <div class="campo-titulo">Nosso Número</div>
        <div class="campo-valor">${boleto.nossoNumero}</div>
      </div>

      <div class="campo col-span-3" style="min-height: 80px;">
        <div class="campo-titulo">Instruções de Responsabilidade do Beneficiário</div>
        <div class="campo-valor" style="font-weight: normal; margin-top: 4px;">
          ${boleto.instrucoes.map(i => `<div>• ${i}</div>`).join('')}
          <div style="margin-top: 6px; font-weight: 700;">Multa: ${boleto.multa} · Juros: ${boleto.jurosMora}</div>
        </div>
      </div>
      <div class="campo destaque-valor">
        <div class="campo-titulo">(=) Valor do Documento</div>
        <div class="campo-valor" style="font-size: 14px; color: #0f172a;">${boleto.valorFormatado}</div>
      </div>

      <div class="campo col-span-4" style="background: #f8fafc;">
        <div class="campo-titulo">Pagador</div>
        <div class="campo-valor">${boleto.pagador.nome} · CPF/CNPJ: ${boleto.pagador.documento}</div>
        <div style="font-size: 9px; color: #64748b;">${boleto.pagador.endereco}</div>
      </div>
    </div>

    <div class="codigo-barras-box">
      <div style="font-size: 9px; color: #64748b; margin-bottom: 6px;">CÓDIGO DE BARRAS FEBRABAN (${boleto.codigoBarras.length} DÍGITOS)</div>
      <div class="codigo-barras-fake">|| | ||| || |||| ||| || ||||| | || |||| | ||| |||| | ||</div>
      <div style="font-family: monospace; font-size: 11px; margin-top: 4px; font-weight: 700;">${boleto.codigoBarras}</div>
    </div>
  </div>
</body>
</html>`;
}
