/**
 * Testes — PDV e Barbearia
 * SetPoint Ultra
 */
import { describe, it, expect } from 'vitest';

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
      expect(calcularTotalVenda(itens)).toBe(80);
    });

    it('deve aplicar desconto corretamente', () => {
      const itens = [{ preco: 100, quantidade: 1 }];
      expect(calcularTotalVenda(itens, 15)).toBe(85);
    });

    it('não deve retornar valor negativo com desconto maior que o total', () => {
      const itens = [{ preco: 50, quantidade: 1 }];
      expect(calcularTotalVenda(itens, 100)).toBe(0);
    });
  });

  describe('calcularTroco()', () => {
    it('deve calcular troco corretamente', () => {
      expect(calcularTroco(50, 37.50)).toBe(12.50);
    });

    it('deve retornar null para pagamento insuficiente', () => {
      expect(calcularTroco(30, 50)).toBeNull();
    });

    it('deve retornar 0 para pagamento exato', () => {
      expect(calcularTroco(100, 100)).toBe(0);
    });
  });

  describe('aplicarPromocaoLevePague()', () => {
    it('deve aplicar Leve 3 Pague 2 para 3 unidades', () => {
      expect(aplicarPromocaoLevePague(3, 3, 2)).toBe(2);
    });

    it('deve aplicar Leve 3 Pague 2 para 6 unidades', () => {
      expect(aplicarPromocaoLevePague(6, 3, 2)).toBe(4);
    });

    it('deve aplicar Leve 3 Pague 2 para 7 unidades (2 grupos + 1 resto)', () => {
      expect(aplicarPromocaoLevePague(7, 3, 2)).toBe(5);
    });

    it('deve não aplicar promoção para quantidade menor que leveX', () => {
      expect(aplicarPromocaoLevePague(2, 3, 2)).toBe(2);
    });
  });
});

describe('Barbearia — Rateio e Agendamento', () => {
  describe('calcularComissaoBarbearia()', () => {
    it('deve calcular rateio no crédito (2.99% taxa)', () => {
      const r = calcularComissaoBarbearia(100, 50, 0.0299, 'credito');
      expect(r.taxaMaquininha).toBeCloseTo(2.99, 2);
      expect(r.valorLiquido).toBeCloseTo(97.01, 2);
      expect(r.comissaoProfissional).toBeCloseTo(48.505, 2);
    });

    it('deve calcular rateio no PIX (0.99% taxa)', () => {
      const r = calcularComissaoBarbearia(100, 60, 0.0099, 'pix');
      expect(r.taxaMaquininha).toBeCloseTo(0.99, 2);
      expect(r.comissaoProfissional).toBeCloseTo(59.406, 2);
    });

    it('deve calcular rateio no dinheiro (sem taxa)', () => {
      const r = calcularComissaoBarbearia(100, 70, 0, 'dinheiro');
      expect(r.taxaMaquininha).toBe(0);
      expect(r.comissaoProfissional).toBe(70);
      expect(r.repaseSalao).toBe(30);
    });
  });

  describe('gerarSlotHorarios()', () => {
    it('deve gerar slots de 30 minutos entre 08:00 e 10:00', () => {
      const slots = gerarSlotHorarios('08:00', '10:00', 30);
      expect(slots).toEqual(['08:00', '08:30', '09:00', '09:30']);
    });

    it('deve gerar slots de 60 minutos', () => {
      const slots = gerarSlotHorarios('09:00', '12:00', 60);
      expect(slots).toHaveLength(3);
    });

    it('deve retornar array vazio se não há tempo suficiente', () => {
      const slots = gerarSlotHorarios('09:00', '09:30', 60);
      expect(slots).toHaveLength(0);
    });
  });
});
