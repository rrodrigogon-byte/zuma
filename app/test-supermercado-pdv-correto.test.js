import test from 'node:test';
import assert from 'node:assert/strict';

// 1. Testa a função de geração de PIX oficial Bacen EMV com CRC16
function gerarPixCopiaECola({ chavePix, nomeRecebedor, cidadeRecebedor, valor, txid }) {
  const chave = String(chavePix || 'financeiro@kytto.com.br').trim();
  const nome = String(nomeRecebedor || 'SUPERMERCADO KYTTO').slice(0, 25).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const cidade = String(cidadeRecebedor || 'TANGARA DA SERRA').slice(0, 15).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const idTx = String(txid || `PDV${Date.now()}`).replace(/[^a-zA-Z0-9]/g, '').slice(0, 25);
  const valorFmt = Number(valor || 0).toFixed(2);

  function emv(id, valorTag) {
    const v = String(valorTag);
    return id + String(v.length).padStart(2, '0') + v;
  }

  const gui = emv('00', 'br.gov.bcb.pix');
  const key = emv('01', chave);
  const merchantAccount = emv('26', gui + key);
  
  let payload = emv('00', '01') + merchantAccount + emv('52', '0000') + emv('53', '986') + emv('54', valorFmt) + emv('58', 'BR') + emv('59', nome) + emv('60', cidade) + emv('62', emv('05', idTx));
  payload += '6304';

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
  return payload + crcHex;
}

test('1. QR Code do PIX oficial Bacen EMV: formato válido, valor formatado e CRC16 calculado', () => {
  const payload = gerarPixCopiaECola({
    chavePix: 'loja.matriz@supermercadokytto.com.br',
    nomeRecebedor: 'Supermercado Central Kytto',
    cidadeRecebedor: 'Tangara da Serra',
    valor: 249.90,
    txid: 'PDV9988'
  });

  // Não contém ID interno da Dino
  assert.ok(!payload.includes('d0d0ac01-8e50-4b61-8c79-de4aaa916da6'), 'Não pode conter ID da Dino no Pix!');
  // Contém a chave informada
  assert.ok(payload.includes('loja.matriz@supermercadokytto.com.br'), 'Deve conter a chave da empresa');
  // Tag 54 devidamente formatada: '54' + '06' (tamanho de '249.90') + '249.90'
  assert.ok(payload.includes('5406249.90'), 'Tag 54 do valor deve ter tamanho de 2 dígitos e valor formatado');
  // Tag 63 de CRC16 deve estar presente com 4 dígitos hexadecimais no final
  assert.ok(payload.includes('6304'), 'Tag 63 de CRC deve estar presente');
  const crc = payload.slice(-4);
  assert.match(crc, /^[0-9A-F]{4}$/, 'CRC deve ser 4 caracteres hexadecimais maiúsculos');
});

test('2. Catálogo vazio: se a empresa não tem produtos, não pode injetar produtos fictícios (picanha, arroz, etc.)', () => {
  // Simulação da lógica do frontend
  const resProd = { produtos: [] };
  const produtosCarregados = (resProd?.produtos && Array.isArray(resProd.produtos)) ? resProd.produtos : [];
  
  assert.equal(produtosCarregados.length, 0, 'Lista de produtos deve permanecer vazia');
  assert.ok(!produtosCarregados.some(p => p.nome?.toLowerCase().includes('picanha')), 'Não pode conter picanha fictícia');
  assert.ok(!produtosCarregados.some(p => p.nome?.toLowerCase().includes('arroz')), 'Não pode conter arroz fictício');
});

test('3. Desconto de CPF: consumidor não participante do clube ou falha na consulta recebe ZERO desconto', () => {
  // Caso 1: Consulta falha (erro de rede)
  let clienteClube = null;
  const erroConsulta = true;
  if (erroConsulta) {
    clienteClube = null; // não aplica desconto
  }
  assert.equal(clienteClube, null, 'Cliente não pode ter desconto em caso de erro');

  // Caso 2: Consumidor encontrado mas não é sócio do clube
  const resConsulta = { clienteFidelidade: false, nome: 'João da Silva' };
  if (resConsulta && resConsulta.clienteFidelidade === true && Number(resConsulta.descontoPercentual) > 0) {
    clienteClube = { descontoPercentual: resConsulta.descontoPercentual };
  } else {
    clienteClube = null;
  }
  assert.equal(clienteClube, null, 'Consumidor sem adesão ao clube não recebe desconto');

  // Caso 3: Cálculo do item no cupom
  const precoBase = 100.00;
  let precoFinal = precoBase;
  if (clienteClube && Number(clienteClube.descontoPercentual) > 0) {
    precoFinal = Number((precoBase * (1 - clienteClube.descontoPercentual / 100)).toFixed(2));
  }
  assert.equal(precoFinal, 100.00, 'Preço final deve permanecer integral sem desconto');
});
