// Promoções de preço por produto cadastradas pela loja entram no atendimento enquanto vigentes
// (caso Stallone, Fecha Mês 31/10): bloco na 1ª resposta do dia e valores certos para o modelo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { promotionBlock, promotionCondition, promotionGuidance, promotionTitle } from './whatsapp-ai.js';

const fim = new Date(Date.now() + 3 * 3600000).toISOString();
const regras = (produto, de, por, ordem) => ({ campanha: 'fecha-mes-2026-10-31', ordem, produto, precoDe: de, precoPor: por, canal: 'loja_fisica', pagamento: ['debito', 'dinheiro', 'pix'], somenteNaLoja: true });
const promos = [
  { nome: 'Fecha Mês 31/10 · Whey 100% Pure: de R$ 229,00 por R$ 179,00', regras: regras('Whey 100% Pure Integralmédica 900 g', 229, 179, 1), fim },
  { nome: 'Fecha Mês 31/10 · Protein Crisp: de R$ 154,80 por R$ 99,00', regras: regras('Protein Crisp Ovomaltine — caixa com 12 unidades', 154.8, 99, 7), fim },
];

test('bloco da promoção traz título, condição e de/por de cada produto', () => {
  const bloco = promotionBlock(promos);
  assert.match(bloco, /^🔥 \*FECHA MÊS 31\/10\*/);
  assert.match(bloco, /(só hoje, |até )\d{2}\/\d{2} · na loja · débito, dinheiro ou Pix/);
  assert.match(bloco, /• Whey 100% Pure Integralmédica 900 g: de R\$ 229 por \*R\$ 179\*/);
  assert.match(bloco, /• Protein Crisp Ovomaltine — caixa com 12 unidades: de R\$ 154,80 por \*R\$ 99\*/);
  assert.equal(promotionBlock([]), '');
});

test('título genérico quando as promoções são de campanhas diferentes', () => {
  assert.equal(promotionTitle([{ nome: 'A · x' }, { nome: 'B · y' }]), 'Promoções de hoje');
  assert.equal(promotionTitle(promos), 'Fecha Mês 31/10');
});

test('orientação ao modelo usa os valores cadastrados e proíbe aplicar online quando é só na loja', () => {
  const texto = promotionGuidance(promos);
  assert.match(texto, /Whey 100% Pure Integralmédica 900 g de R\$ 229 por R\$ 179/);
  assert.match(texto, /só na loja física/);
  assert.match(promotionCondition(promos), /na loja/);
});
