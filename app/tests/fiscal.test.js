/**
 * Testes — Motor Fiscal Próprio
 * SetPoint Ultra
 */
import { describe, it, expect } from 'vitest';

// Funções puras do motor fiscal para teste isolado
function gerarChaveAcesso({ cUF, AAMM, CNPJ, mod, serie, nNF, tpEmis }) {
  const cNF = String(Math.floor(Math.random() * 99999999)).padStart(8, '0');
  const semDV = `${cUF}${AAMM}${CNPJ}${mod}${serie.padStart(3, '0')}${String(nNF).padStart(9, '0')}${tpEmis}${cNF}`;
  // Cálculo do dígito verificador (módulo 11)
  const pesos = [2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2];
  let soma = 0;
  for (let i = 0; i < semDV.length; i++) soma += parseInt(semDV[i]) * pesos[i];
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return semDV + dv;
}

function calcularICMS({ vBC, pICMS }) {
  return parseFloat((vBC * pICMS / 100).toFixed(2));
}

function calcularPISCOFINS({ vProd, pPIS = 0.65, pCOFINS = 3.0 }) {
  return {
    vPIS: parseFloat((vProd * pPIS / 100).toFixed(2)),
    vCOFINS: parseFloat((vProd * pCOFINS / 100).toFixed(2)),
  };
}

function decodificarCodigoBalanca(codigo) {
  if (codigo.length !== 13) return null;
  if (codigo[0] !== '2') return null;
  const produtoCod = codigo.substring(1, 6);
  const pesoStr = codigo.substring(6, 11);
  const peso = parseInt(pesoStr) / 1000;
  return { produtoCod, peso };
}

function calcularTotalNFe(itens) {
  return itens.reduce((acc, item) => {
    acc.vProd += item.vProd;
    acc.vICMS += item.vICMS || 0;
    acc.vPIS += item.vPIS || 0;
    acc.vCOFINS += item.vCOFINS || 0;
    acc.vNF += item.vProd;
    return acc;
  }, { vProd: 0, vICMS: 0, vPIS: 0, vCOFINS: 0, vNF: 0 });
}

describe('Motor Fiscal — Cálculos Tributários', () => {
  describe('gerarChaveAcesso()', () => {
    it('deve gerar chave de acesso com 44 dígitos', () => {
      const chave = gerarChaveAcesso({ cUF: '51', AAMM: '2607', CNPJ: '43084070000188', mod: '65', serie: '1', nNF: 1, tpEmis: '1' });
      expect(chave).toHaveLength(44);
    });

    it('deve conter apenas dígitos numéricos', () => {
      const chave = gerarChaveAcesso({ cUF: '51', AAMM: '2607', CNPJ: '43084070000188', mod: '55', serie: '1', nNF: 100, tpEmis: '1' });
      expect(chave).toMatch(/^\d+$/);
    });
  });

  describe('calcularICMS()', () => {
    it('deve calcular ICMS de 17% corretamente', () => {
      const icms = calcularICMS({ vBC: 1000, pICMS: 17 });
      expect(icms).toBe(170);
    });

    it('deve calcular ICMS de 12% para operação interestadual', () => {
      const icms = calcularICMS({ vBC: 500, pICMS: 12 });
      expect(icms).toBe(60);
    });

    it('deve retornar 0 para produto isento', () => {
      const icms = calcularICMS({ vBC: 1000, pICMS: 0 });
      expect(icms).toBe(0);
    });
  });

  describe('calcularPISCOFINS()', () => {
    it('deve calcular PIS de 0.65% e COFINS de 3% (regime cumulativo)', () => {
      const { vPIS, vCOFINS } = calcularPISCOFINS({ vProd: 1000 });
      expect(vPIS).toBe(6.5);
      expect(vCOFINS).toBe(30);
    });

    it('deve calcular PIS de 1.65% e COFINS de 7.6% (regime não-cumulativo)', () => {
      const { vPIS, vCOFINS } = calcularPISCOFINS({ vProd: 1000, pPIS: 1.65, pCOFINS: 7.6 });
      expect(vPIS).toBe(16.5);
      expect(vCOFINS).toBe(76);
    });
  });

  describe('decodificarCodigoBalanca()', () => {
    it('deve decodificar código de balança corretamente', () => {
      // Código: 2 + 12345 (produto) + 00500 (500g = 0.500kg) + DV
      const resultado = decodificarCodigoBalanca('2123450050012');
      expect(resultado).not.toBeNull();
      expect(resultado.produtoCod).toBe('12345');
      expect(resultado.peso).toBe(0.5);
    });

    it('deve retornar null para código que não começa com 2', () => {
      const resultado = decodificarCodigoBalanca('7891234567890');
      expect(resultado).toBeNull();
    });

    it('deve retornar null para código com tamanho errado', () => {
      const resultado = decodificarCodigoBalanca('21234');
      expect(resultado).toBeNull();
    });
  });

  describe('calcularTotalNFe()', () => {
    it('deve somar corretamente os totais de uma NF-e', () => {
      const itens = [
        { vProd: 100, vICMS: 17, vPIS: 0.65, vCOFINS: 3 },
        { vProd: 200, vICMS: 34, vPIS: 1.30, vCOFINS: 6 },
      ];
      const totais = calcularTotalNFe(itens);
      expect(totais.vProd).toBe(300);
      expect(totais.vICMS).toBe(51);
      expect(totais.vNF).toBe(300);
    });
  });
});
