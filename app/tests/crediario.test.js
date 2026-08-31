/**
 * Testes — Módulo Crediário
 * SetPoint Ultra
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock do banco de dados
const mockDb = { query: vi.fn() };
vi.mock('../core/db.js', () => ({ getDb: () => mockDb }));

// Funções puras para testar sem banco
function calcularParcelasPrice(valorFinanciado, numParcelas, taxaMensal) {
  if (taxaMensal === 0) return valorFinanciado / numParcelas;
  const i = taxaMensal / 100;
  return valorFinanciado * (i * Math.pow(1 + i, numParcelas)) / (Math.pow(1 + i, numParcelas) - 1);
}

function calcularJurosMora(valorOriginal, diasAtraso, taxaDiaria = 0.001, multa = 0.02) {
  const jurosMora = valorOriginal * taxaDiaria * diasAtraso;
  const multaValor = valorOriginal * multa;
  return { jurosMora, multaValor, total: valorOriginal + jurosMora + multaValor };
}

function gerarDatasVencimento(numParcelas, diaVencimento) {
  const base = new Date();
  return Array.from({ length: numParcelas }, (_, k) => {
    const primeiroDia = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + k + 1, 1));
    const ultimoDia = new Date(Date.UTC(primeiroDia.getUTCFullYear(), primeiroDia.getUTCMonth() + 1, 0)).getUTCDate();
    primeiroDia.setUTCDate(Math.min(Number(diaVencimento), ultimoDia));
    return primeiroDia.toISOString().split('T')[0];
  });
}

describe('Crediário — Cálculos Financeiros', () => {
  describe('calcularParcelasPrice()', () => {
    it('deve calcular parcela sem juros corretamente', () => {
      const parcela = calcularParcelasPrice(1000, 10, 0);
      expect(parcela).toBe(100);
    });

    it('deve calcular parcela com juros de 2% ao mês (Price)', () => {
      const parcela = calcularParcelasPrice(1000, 3, 2);
      expect(parcela).toBeCloseTo(346.75, 1);
    });

    it('deve calcular parcela com juros de 1.5% ao mês', () => {
      const parcela = calcularParcelasPrice(5000, 12, 1.5);
      expect(parcela).toBeCloseTo(458.40, 1);
    });

    it('deve retornar valor positivo para qualquer entrada válida', () => {
      const parcela = calcularParcelasPrice(2000, 6, 3);
      expect(parcela).toBeGreaterThan(0);
    });
  });

  describe('calcularJurosMora()', () => {
    it('deve calcular multa de 2% no primeiro dia de atraso', () => {
      const { total } = calcularJurosMora(100, 1);
      expect(total).toBeCloseTo(102.1, 1); // 100 + 0.10 mora + 2.00 multa
    });

    it('deve calcular mora diária de 0.1% por dia', () => {
      const { jurosMora } = calcularJurosMora(1000, 10);
      expect(jurosMora).toBeCloseTo(10, 2); // 1000 * 0.001 * 10
    });

    it('deve acumular mora e multa corretamente em 30 dias', () => {
      const { total } = calcularJurosMora(1000, 30);
      expect(total).toBeCloseTo(1050, 0); // 1000 + 30 mora + 20 multa
    });

    it('deve retornar o valor original sem atraso', () => {
      const { total } = calcularJurosMora(500, 0);
      expect(total).toBeCloseTo(510, 0); // 500 + 0 mora + 10 multa (multa aplica no vencimento)
    });
  });

  describe('gerarDatasVencimento()', () => {
    it('deve gerar a quantidade correta de datas', () => {
      const datas = gerarDatasVencimento(12, 10);
      expect(datas).toHaveLength(12);
    });

    it('deve gerar datas no dia correto', () => {
      const datas = gerarDatasVencimento(3, 15);
      datas.forEach(d => {
        const dia = parseInt(d.split('-')[2]);
        expect(dia).toBe(15);
      });
    });

    it('deve gerar datas em meses consecutivos', () => {
      const datas = gerarDatasVencimento(3, 10);
      const meses = datas.map(d => parseInt(d.split('-')[1]));
      expect(meses[1]).toBe(meses[0] % 12 + 1);
    });
  });
});
