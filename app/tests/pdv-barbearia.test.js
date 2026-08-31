/**
 * Testes — PDV e Barbearia
 * SetPoint Ultra
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Funções puras do PDV
function calcularTotalVenda(itens, desconto = 0) {
  const subtotal = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
  return Math.max(0, subtotal - desconto);
}

function calcularTroco(valorPago, totalVenda) {
  if (valorPago < totalVenda) return null; // Pagamento insuficiente
  return parseFloat((valorPago - totalVenda).toFixed(2));
}

function aplicarPromocaoLevePague(quantidade, leveX, pagueY) {
  // Ex: Leve 3 Pague 2 → leveX=3, pagueY=2
  const grupos = Math.floor(quantidade / leveX);
  const resto = quantidade % leveX;
  return grupos * pagueY + resto;
}

function calcularComissaoBarbearia(valorServico, percentualProfissional, taxaMaquininha, formaPagamento) {
  const taxas = { credito: 0.0299, debito: 0.0149, pix: 0.0099, dinheiro: 0 };
  const taxa = taxas[formaPagamento] || 0;
  const valorLiquido = valorServico * (1 - taxa);
  const comissaoProfissional = valorLiquido * (percentualProfissional / 100);
  const repaseSalao = valorLiquido - comissaoProfissional;
  return { valorLiquido, comissaoProfissional, repaseSalao, taxaMaquininha: valorServico * taxa };
}

function gerarSlotHorarios(inicio, fim, duracaoMinutos) {
  const slots = [];
  const [hIni, mIni] = inicio.split(':').map(Number);
  const [hFim, mFim] = fim.split(':').map(Number);
  let totalMinutos = hIni * 60 + mIni;
  const fimMinutos = hFim * 60 + mFim;
  while (totalMinutos + duracaoMinutos <= fimMinutos) {
    const h = Math.floor(totalMinutos / 60).toString().padStart(2, '0');
    const m = (totalMinutos % 60).toString().padStart(2, '0');
    slots.push(`${h}:${m}`);
    totalMinutos += duracaoMinutos;
  }
  return slots;
}

describe('PDV — Cálculos de Venda', () => {
  describe('calcularTotalVenda()', () => {
    it('deve calcular total sem desconto', () => {
      const itens = [{ preco: 10, quantidade: 3 }, { preco: 25, quantidade: 2 }];
      assert.equal(calcularTotalVenda(itens), 80);
    });

    it('deve aplicar desconto corretamente', () => {
      const itens = [{ preco: 100, quantidade: 1 }];
      assert.equal(calcularTotalVenda(itens, 15), 85);
    });

    it('não deve retornar valor negativo com desconto maior que o total', () => {
      const itens = [{ preco: 50, quantidade: 1 }];
      assert.equal(calcularTotalVenda(itens, 100), 0);
    });
  });

  describe('calcularTroco()', () => {
    it('deve calcular troco corretamente', () => {
      assert.equal(calcularTroco(50, 37.50), 12.50);
    });

    it('deve retornar null para pagamento insuficiente', () => {
      assert.equal(calcularTroco(30, 50), null);
    });

    it('deve retornar 0 para pagamento exato', () => {
      assert.equal(calcularTroco(100, 100), 0);
    });
  });

  describe('aplicarPromocaoLevePague()', () => {
    it('deve aplicar Leve 3 Pague 2 para 3 unidades', () => {
      assert.equal(aplicarPromocaoLevePague(3, 3, 2), 2);
    });

    it('deve aplicar Leve 3 Pague 2 para 6 unidades', () => {
      assert.equal(aplicarPromocaoLevePague(6, 3, 2), 4);
    });

    it('deve aplicar Leve 3 Pague 2 para 7 unidades (2 grupos + 1 resto)', () => {
      assert.equal(aplicarPromocaoLevePague(7, 3, 2), 5);
    });

    it('deve não aplicar promoção para quantidade menor que leveX', () => {
      assert.equal(aplicarPromocaoLevePague(2, 3, 2), 2);
    });
  });
});

describe('Barbearia — Rateio e Agendamento', () => {
  describe('calcularComissaoBarbearia()', () => {
    it('deve calcular rateio no crédito (2.99% taxa)', () => {
      const r = calcularComissaoBarbearia(100, 50, 0.0299, 'credito');
      assert.ok(Math.abs(r.taxaMaquininha - 2.99) < 0.005);
      assert.ok(Math.abs(r.valorLiquido - 97.01) < 0.005);
      assert.ok(Math.abs(r.comissaoProfissional - 48.505) < 0.005);
    });

    it('deve calcular rateio no PIX (0.99% taxa)', () => {
      const r = calcularComissaoBarbearia(100, 60, 0.0099, 'pix');
      assert.ok(Math.abs(r.taxaMaquininha - 0.99) < 0.005);
      assert.ok(Math.abs(r.comissaoProfissional - 59.406) < 0.005);
    });

    it('deve calcular rateio no dinheiro (sem taxa)', () => {
      const r = calcularComissaoBarbearia(100, 70, 0, 'dinheiro');
      assert.equal(r.taxaMaquininha, 0);
      assert.equal(r.comissaoProfissional, 70);
      assert.equal(r.repaseSalao, 30);
    });
  });

  describe('gerarSlotHorarios()', () => {
    it('deve gerar slots de 30 minutos entre 08:00 e 10:00', () => {
      const slots = gerarSlotHorarios('08:00', '10:00', 30);
      assert.deepEqual(slots, ['08:00', '08:30', '09:00', '09:30']);
    });

    it('deve gerar slots de 60 minutos', () => {
      const slots = gerarSlotHorarios('09:00', '12:00', 60);
      assert.equal(slots.length, 3);
    });

    it('deve retornar array vazio se não há tempo suficiente', () => {
      const slots = gerarSlotHorarios('09:00', '09:30', 60);
      assert.equal(slots.length, 0);
    });
  });
});
