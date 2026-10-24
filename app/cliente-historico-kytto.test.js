// Histórico do cliente na ficha 360: consumo, família, gostos e sugestões de venda.
import test from 'node:test';
import assert from 'node:assert/strict';
import { coOcorrencias, diaLocal, linhasDeConsumo, montarHistoricoCliente, proximoAniversario, resumoConsumo } from './cliente-historico-kytto.js';

const AGORA = new Date('2026-10-24T15:00:00-04:00');
const HOJE = '2026-10-24';
const prof = [{ id: 'p1', nome: 'Rafael' }, { id: 'p2', nome: 'Bruno' }];
const item = (tipo, id, nome, valor, extra = {}) => ({ tipo, nome, quantidade: 1, subtotal: valor, precoUnitario: valor, ...(tipo === 'servico' ? { servicoId: id } : tipo === 'loja' ? { lojaVarianteId: id } : { produtoId: id }), ...extra });
const comanda = (id, dia, itens, extra = {}) => ({ id, status: 'paga', fechadaEm: `${dia}T14:00:00-04:00`, profissionalId: 'p1', itens, ...extra });

test('aniversário: dias até, idade, virada de ano e 29/02', () => {
  assert.deepEqual(proximoAniversario({ dataNascimento: '1990-10-30' }, HOJE), { data: '2026-10-30', dias: 6, idade: 36 });
  assert.deepEqual(proximoAniversario({ aniversario: '01-05' }, HOJE), { data: '2027-01-05', dias: 73, idade: null });
  assert.equal(proximoAniversario({ aniversario: '10-24' }, HOJE).dias, 0);
  assert.equal(proximoAniversario({ aniversario: '02-29' }, '2027-02-01').data, '2027-02-28');
  assert.equal(proximoAniversario({}, HOJE), null);
  assert.equal(diaLocal('2026-10-25T02:00:00Z'), '2026-10-24', 'fim do dia em Cuiabá ainda é dia 24');
});

test('consumo: só comandas faturadas e balcão pago; plano abatido aparece separado', () => {
  const linhas = linhasDeConsumo({
    profissionais: prof,
    comandas: [
      comanda('c1', '2026-10-10', [item('servico', 'corte', 'Corte', 0, { coberturaPlano: { planoNome: 'Clube VIP', valorAbatido: 70 } }), item('servico', 'sobr', 'Sobrancelha', 25), item('loja', 'v1', 'Perfume', 300)]),
      comanda('c2', '2026-10-20', [item('servico', 'corte', 'Corte', 70)], { status: 'aberta' }),
      comanda('c3', '2026-09-02', [item('servico', 'corte', 'Corte', 70)], { status: 'cancelada' }),
    ],
    vendas: [{ id: 'v1', status: 'pago', criadoEm: '2026-08-01T12:00:00Z', itens: [{ produtoId: 'pom', nome: 'Pomada', quantidade: 2, subtotal: 90 }] }, { id: 'v2', status: 'cancelada', itens: [{ produtoId: 'pom', nome: 'Pomada', subtotal: 45 }] }],
  });
  assert.equal(linhas.length, 4);
  assert.equal(linhas[0].profissional, 'Rafael');
  const r = resumoConsumo(linhas, { hoje: HOJE });
  assert.equal(r.total, 415);
  assert.equal(r.abatidoPlano, 70);
  assert.deepEqual(r.porTipo, { servicos: 25, revenda: 90, lojaDino: 300 });
  assert.equal(r.compras, 2);
  assert.equal(r.ticketMedio, 207.5);
  assert.equal(r.meses.length, 12);
  assert.equal(r.meses.at(-1).mes, '2026-10');
  assert.equal(r.meses.at(-1).valor, 325);
  assert.equal(r.meses.at(-1).abatido, 70);
  assert.equal(r.maisConsumidos.find((i) => i.nome === 'Corte').vezes, 1);
  assert.equal(r.maisConsumidos[0].nome, 'Perfume', 'empate em vezes: maior valor primeiro');
});

function empresaComandas() {
  // 10 comandas de corte: 6 levam cera (60%), 2 levam barba (20%), 1 leva gel (10%, abaixo do corte).
  return Array.from({ length: 10 }, (_, i) => comanda(`e${i}`, '2026-10-01', [
    item('servico', 'corte', 'Corte', 70),
    ...(i < 6 ? [item('produto', 'cera', 'Cera fosca', 45)] : []),
    ...(i >= 6 && i < 8 ? [item('servico', 'barba', 'Barba', 50)] : []),
    ...(i === 9 ? [item('produto', 'gel', 'Gel', 30)] : []),
  ]));
}

test('co-ocorrência ignora comandas antigas e não faturadas', () => {
  const coo = coOcorrencias([...empresaComandas(), comanda('velha', '2025-01-01', [item('servico', 'corte', 'Corte', 70), item('produto', 'cera', 'Cera', 45)]), comanda('aberta', '2026-10-02', [item('servico', 'corte', 'Corte', 70), item('produto', 'cera', 'Cera', 45)], { status: 'aberta' })], { desdeDia: '2026-05-01' });
  assert.equal(coo.get('servico:corte').total, 10);
  assert.equal(coo.get('servico:corte').junto.get('produto:cera').n, 6);
});

test('ficha: família com aniversário próximo, gostos, dicas e sugestões explicadas', () => {
  const cliente = {
    id: 'cli1', nome: 'Carlos', dataNascimento: '1990-10-30', aniversario: '10-30',
    familia: [
      { id: 'f1', relacao: 'esposa', nome: 'Ana', aniversario: '11-05', telefone: '65999998888' },
      { id: 'f2', relacao: 'filho', nome: 'Lucas', dataNascimento: '2016-11-10', aniversario: '11-10' },
      { id: 'f3', relacao: 'pai', nome: 'Valdo', aniversario: '03-01' },
    ],
    familiaConsentimento: { concedido: true },
    preferencias: { bebida: 'café sem açúcar', corte: 'degradê baixo', perfumes: 'Amadeirados', profissionalPreferidoId: 'p2', tags: ['pontual'] },
    redesSociais: { instagram: 'carlos.prado', linkedin: 'https://www.linkedin.com/in/carlos' },
    consentimentos: { whatsapp: { marketing: { concedido: false } } },
  };
  const comandas = [comanda('c1', '2026-09-01', [item('servico', 'corte', 'Corte', 70)]), comanda('c2', '2026-07-01', [item('servico', 'corte', 'Corte', 70)])];
  const h = montarHistoricoCliente({
    cliente, comandas, comandasEmpresa: empresaComandas(), profissionais: prof,
    produtos: [{ id: 'cera', nome: 'Cera fosca', estoqueAtual: 3 }, { id: 'gel', nome: 'Gel', estoqueAtual: 9 }],
    planosAtivos: [{ id: 'vip', nome: 'Clube VIP', preco: 150, ciclo: 'mensal', servicosIds: ['corte'] }],
    perfil360: { indicadores: { diasSemAtividade: 53, retornoMedioDias: 30, aReceber: 0 }, proximos: [{ profissional: 'Rafael' }] },
    agora: AGORA, maskPhone: (v) => `(65) •••••-${String(v).slice(-4)}`,
  });
  assert.deepEqual(h.familia.map((f) => f.nome), ['Ana', 'Lucas', 'Valdo'], 'ordenada pelo próximo aniversário');
  assert.equal(h.familia[0].telefone, '(65) •••••-8888', 'telefone de familiar sai mascarado');
  assert.equal(h.familia[1].proximoAniversario.idade, 10);
  assert.equal(h.preferencias.profissionalPreferido.nome, 'Bruno');
  assert.equal(h.redesSociais.instagram, 'carlos.prado');
  assert.equal(h.contatoMarketing.whatsapp, false);
  const titulos = h.sugestoes.map((s) => s.titulo);
  assert.ok(titulos.includes('Aniversário do cliente em 6 dias'));
  assert.ok(titulos.includes('Aniversário de Ana (esposa) em 12 dias'));
  assert.ok(h.sugestoes.find((s) => s.id === 'aniv-f2').detalhe.includes('corte dele(a)'));
  assert.ok(!titulos.some((t) => t.includes('Valdo')), 'aniversário distante não vira sugestão');
  const cera = h.sugestoes.find((s) => s.titulo === 'Apresentar Cera fosca');
  assert.match(cera.detalhe, /60% de quem faz Corte também leva \(6 de 10/);
  assert.ok(titulos.includes('Oferecer Barba'));
  assert.ok(!titulos.some((t) => t.includes('Gel')), 'abaixo de 15% não sugere');
  assert.ok(!titulos.includes('Convidar para voltar'), 'já tem próximo horário');
  assert.ok(h.dicas.some((d) => d.titulo === 'Ofereça café sem açúcar ao chegar'));
  assert.ok(h.dicas.some((d) => d.id === 'prof-diferente'));
  // Gasta em média 70/3 por mês em 90 dias com corte (só 1 comanda no período): plano de 150 não compensa.
  assert.ok(!titulos.some((t) => t.startsWith('Oferecer o Clube')));
});

test('oferta de plano quando o gasto com serviços cobertos passa do preço; uso do plano no fim do ciclo', () => {
  const comandas = ['2026-08-01', '2026-08-15', '2026-09-01', '2026-09-15', '2026-10-01', '2026-10-15'].map((d, i) => comanda(`c${i}`, d, [item('servico', 'corte', 'Corte', 70), item('servico', 'barba', 'Barba', 50)]));
  const h = montarHistoricoCliente({ cliente: { id: 'x' }, comandas, planosAtivos: [{ id: 'vip', nome: 'Clube VIP', preco: 150, ciclo: 'mensal', servicosIds: ['corte', 'barba'] }], agora: AGORA });
  const oferta = h.sugestoes.find((s) => s.id === 'plano-oferta-vip');
  assert.ok(oferta);
  assert.match(oferta.detalhe, /R\$ 240,00\/mês .* economia de R\$ 90,00\/mês/);

  const comPlano = montarHistoricoCliente({ cliente: { id: 'x' }, coberturas: [{ assinaturaId: 'a1', planoNome: 'Clube VIP', utilizavel: true, sessoesRestantes: 2, cicloFim: '2026-10-30T23:59:00-04:00', situacaoPagamento: 'em_dia' }], planosAtivos: [{ id: 'vip', nome: 'Clube VIP', preco: 150 }], agora: AGORA });
  assert.equal(comPlano.sugestoes[0].titulo, 'Usar 2 sessões do Clube VIP');
  assert.ok(!comPlano.sugestoes.some((s) => s.id.startsWith('plano-oferta')), 'quem já tem plano não recebe oferta');

  const atrasado = montarHistoricoCliente({ cliente: { id: 'x' }, coberturas: [{ assinaturaId: 'a1', planoNome: 'Clube VIP', utilizavel: false, situacaoPagamento: 'inadimplente', motivo: 'ciclo em atraso' }], agora: AGORA });
  assert.equal(atrasado.sugestoes[0].categoria, 'atencao');
});

test('retorno atrasado e valor em aberto entram como prioridade', () => {
  const h = montarHistoricoCliente({ cliente: { id: 'x' }, perfil360: { indicadores: { diasSemAtividade: 50, retornoMedioDias: 30, aReceber: 80, carrinhosAbertos: 1 }, proximos: [] }, agora: AGORA });
  assert.deepEqual(h.sugestoes.filter((s) => s.prioridade === 1).map((s) => s.id).sort(), ['receber', 'retorno']);
  assert.ok(h.sugestoes.some((s) => s.id === 'carrinho'));
});

test('sem cadastro local (só loja online): não quebra', () => {
  const h = montarHistoricoCliente({ cliente: null, agora: AGORA });
  assert.deepEqual(h.familia, []);
  assert.equal(h.preferencias, null);
  assert.equal(h.consumo.total, 0);
});
