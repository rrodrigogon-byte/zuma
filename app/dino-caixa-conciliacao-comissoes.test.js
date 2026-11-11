import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { obterSubtotalBrutoItemComanda } from './dino-caixa-detalhes.js';

describe('Conciliação 100% entre Total Faturado do Caixa e Rateio de Comissões dos Barbeiros', () => {
  it('1. Deve respeitar subtotal === 0 em serviços de pacote/clube sem cair no fallback precoUnitario * quantidade', () => {
    const itemPacote = {
      tipo: 'servico',
      nome: 'BARBA PREMIUM ( BRUNO OU NATI)',
      quantidade: 1,
      precoUnitario: 100,
      subtotal: 0,
    };
    const itemClub = {
      tipo: 'servico',
      nome: 'Barba Club',
      quantidade: 1,
      precoUnitario: 0.01,
      subtotal: 0,
    };
    const itemNormal = {
      tipo: 'servico',
      nome: 'CORTE E BARBA PREMIUM',
      quantidade: 1,
      precoUnitario: 200,
      subtotal: 200,
    };

    assert.equal(obterSubtotalBrutoItemComanda(itemPacote), 0);
    assert.equal(obterSubtotalBrutoItemComanda(itemClub), 0);
    assert.equal(obterSubtotalBrutoItemComanda(itemNormal), 200);
  });

  it('2. Deve reproduzir o caixa real de 02/11/2026 da Jhenyffer (R$ 1.400,00) batendo 100% entre Total Faturado e Rateio (R$ 1.100,00 Bruno + R$ 5,00 bebida + R$ 295,00 Dino = R$ 1.400,00)', () => {
    const comandasCaixa0211 = [
      {
        id: 'cmdbar-mw6sghso-041',
        status: 'paga',
        pagamentos: [],
        itens: [{ tipo: 'servico', nome: 'Barba Club', quantidade: 1, precoUnitario: 0.01, subtotal: 0, profissionalId: 'bruno' }],
      },
      {
        id: 'cmdbar-mw6sc9ii-040',
        status: 'em_conta',
        pagamentos: [{ meio: 'credito', valor: 180 }, { meio: 'conta', valor: 20 }],
        itens: [
          { tipo: 'pacote', nome: 'Pacote 4 Procedimentos Premiun', quantidade: 1, precoUnitario: 200, subtotal: 200, profissionalId: 'bruno' },
          { tipo: 'servico', nome: 'Procedimento pacote', quantidade: 2, precoUnitario: 0, subtotal: 0, profissionalId: 'bruno' },
        ],
      },
      {
        id: 'cmdbar-mw6sakbh-039',
        status: 'paga',
        pagamentos: [{ meio: 'credito', valor: 200 }],
        itens: [{ tipo: 'servico', nome: 'CORTE E BARBA PREMIUM', quantidade: 1, precoUnitario: 200, subtotal: 200, profissionalId: 'bruno' }],
      },
      {
        id: 'cmdbar-mw6s2t2n-037',
        status: 'paga',
        pagamentos: [{ meio: 'credito', valor: 200 }],
        itens: [{ tipo: 'servico', nome: 'CORTE E BARBA PREMIUM', quantidade: 1, precoUnitario: 200, subtotal: 200, profissionalId: 'bruno' }],
      },
      {
        id: 'cmdbar-mw6s0rej-036',
        status: 'paga',
        pagamentos: [],
        itens: [{ tipo: 'servico', nome: 'Procedimento pacote', quantidade: 1, precoUnitario: 0, subtotal: 0, profissionalId: 'bruno' }],
      },
      {
        id: 'cmdbar-mw6rzv8o-035',
        status: 'paga',
        pagamentos: [{ meio: 'credito', valor: 205 }],
        itens: [
          { tipo: 'servico', nome: 'CORTE E BARBA PREMIUM', quantidade: 1, precoUnitario: 200, subtotal: 200, profissionalId: 'bruno' },
          { tipo: 'produto', nome: 'Agua com gás', quantidade: 1, precoUnitario: 5, subtotal: 5, profissionalId: 'bruno' },
        ],
      },
      {
        id: 'cmdbar-mw6s32p1-038',
        status: 'paga',
        pagamentos: [{ meio: 'pix', valor: 300 }],
        itens: [
          { tipo: 'servico', nome: 'BARBA PREMIUM ( BRUNO OU NATI)', quantidade: 1, precoUnitario: 100, subtotal: 0, profissionalId: 'bruno' },
          { tipo: 'pacote', nome: 'Pacote 4 Procedimentos Premiun', quantidade: 1, precoUnitario: 300, subtotal: 300, profissionalId: 'bruno' },
        ],
      },
      {
        id: 'cmdbar-mwc7h93v-077',
        status: 'paga',
        pagamentos: [{ meio: 'debito', valor: 295 }],
        itens: [
          { tipo: 'servico', nome: 'Corte Club', quantidade: 1, precoUnitario: 0, subtotal: 0, profissionalId: 'dino' },
          { tipo: 'produto', nome: 'Defrisante', quantidade: 1, precoUnitario: 180, subtotal: 180, profissionalId: 'dino' },
          { tipo: 'produto', nome: 'Grooming', quantidade: 1, precoUnitario: 115, subtotal: 115, profissionalId: 'dino' },
        ],
      },
    ];

    let totalFaturado = 0;
    let totalServicosBruno = 0;
    let totalProdutosBruno = 0;
    let totalProdutosDino = 0;

    for (const c of comandasCaixa0211) {
      const pago = (c.pagamentos || []).reduce((s, p) => s + Number(p.valor || 0), 0);
      totalFaturado += pago;
      for (const it of c.itens) {
        const sub = obterSubtotalBrutoItemComanda(it);
        if (it.profissionalId === 'bruno') {
          if (it.tipo === 'produto') totalProdutosBruno += sub;
          else totalServicosBruno += sub;
        } else if (it.profissionalId === 'dino') {
          if (it.tipo === 'produto') totalProdutosDino += sub;
        }
      }
    }

    assert.equal(totalFaturado, 1400);
    assert.equal(totalServicosBruno, 1100);
    assert.equal(totalProdutosBruno, 5);
    assert.equal(totalProdutosDino, 295);
    assert.equal(totalServicosBruno + totalProdutosBruno + totalProdutosDino, totalFaturado);
  });
});
