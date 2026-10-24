// Comanda da barbearia: plano do cliente abate os serviços, produtos da loja
// virtual entram conferidos pelo servidor e o cadastro guarda família,
// preferências e redes sociais.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'comanda-plano-')), 'db.json');

const test = (await import('node:test')).default;
const { beforeEach } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const { reset } = await import('./db.js');
const barbearia = await import('./barbearia-erp-kytto.js');
const clientes = await import('./clientes-contas-kytto.js');
const captacao = await import('./dino-captacao-kytto.js');
const plano = await import('./barbearia-comanda-plano.js');
const ponte = await import('./core/commerce-comanda-bridge.js');

const EMPRESA = '0f0e0d0c-1b2a-4c3d-8e9f-0123456789ab';
const LOJA = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const DIA_MS = 86400000;

beforeEach(() => reset());

function montar({ sessoes = 2, pagar = true } = {}) {
  const bruno = barbearia.criarProfissional(EMPRESA, { nome: 'Bruno', percentualComissao: 50, lojaId: LOJA });
  const corte = barbearia.criarServico(EMPRESA, { nome: 'Corte Club', preco: 70, duracaoMinutos: 30 });
  const barba = barbearia.criarServico(EMPRESA, { nome: 'Barba Club', preco: 50, duracaoMinutos: 30 });
  const sobrancelha = barbearia.criarServico(EMPRESA, { nome: 'Sobrancelha', preco: 25, duracaoMinutos: 15 });
  const cliente = clientes.criarCliente(EMPRESA, { nome: 'Carlos VIP', telefone: '65999990001' });
  const vip = barbearia.criarPlano(EMPRESA, { nome: 'Clube VIP', preco: 150, sessoesIncluidas: sessoes, ciclo: 'mensal', validadeDias: 30, servicosIds: [corte.id, barba.id] });
  const ass = barbearia.criarAssinatura(EMPRESA, { planoId: vip.id, clienteId: cliente.id, clienteNome: cliente.nome, inicio: new Date(Date.now() - DIA_MS).toISOString() });
  barbearia.alterarStatusAssinatura(EMPRESA, ass.id, 'ativa', { confirmadoSemCobranca: true, pagamentoConfirmado: false });
  if (pagar) captacao.registrarPagamentoAssinatura(EMPRESA, ass.id, { valor: 150, meio: 'pix', referencia: 'pix-vip' });
  return { bruno, corte, barba, sobrancelha, cliente, vip, ass };
}

function abrir(ctx, itens) {
  const preparo = plano.aplicarPlanoAosItens(EMPRESA, { clienteId: ctx.cliente.id, itens });
  return { comanda: barbearia.criarComandaBarbearia(EMPRESA, { lojaId: LOJA, clienteId: ctx.cliente.id, clienteNome: ctx.cliente.nome, profissionalId: ctx.bruno.id, itens: preparo.itens }), avisos: preparo.avisos };
}

test('cliente do Clube VIP: corte e barba abatidos, sobrancelha cobrada, uso gravado ao receber', () => {
  const ctx = montar();
  const coberturas = plano.coberturasDoCliente(EMPRESA, ctx.cliente.id);
  assert.equal(coberturas.length, 1);
  assert.equal(coberturas[0].utilizavel, true);
  assert.deepEqual(coberturas[0].servicosNomes.sort(), ['Barba Club', 'Corte Club']);

  const { comanda } = abrir(ctx, [
    { tipo: 'servico', servicoId: ctx.corte.id }, { tipo: 'servico', servicoId: ctx.barba.id }, { tipo: 'servico', servicoId: ctx.sobrancelha.id },
  ]);
  const cobertos = comanda.itens.filter((i) => i.coberturaPlano);
  assert.equal(cobertos.length, 2);
  assert.equal(cobertos.reduce((s, i) => s + i.coberturaPlano.valorAbatido, 0), 120);
  assert.equal(comanda.total, 25, 'só a sobrancelha é cobrada');
  assert.equal(plano.coberturasDoCliente(EMPRESA, ctx.cliente.id)[0].sessoesRestantes, 0, 'sessões reservadas pela comanda aberta');

  plano.validarCoberturasDaComanda(EMPRESA, comanda);
  const paga = barbearia.registrarPagamentoComandaBarbearia(EMPRESA, comanda.id, { confirmado: true, meioPagamento: 'pix', valor: 25, chaveIdempotencia: 'pg-1' });
  assert.equal(paga.status, 'paga');
  const usos = plano.consumirPlanosDaComanda(EMPRESA, paga);
  assert.equal(usos.filter((u) => u.ok).length, 2, JSON.stringify(usos));
  const resumo = captacao.resumoAssinatura(EMPRESA, ctx.ass.id);
  assert.equal(resumo.usosNoCiclo, 2);
  assert.equal(resumo.usos[0].profissionalId, ctx.bruno.id, 'quem atendeu fica no uso (pote do plano)');
  // Repetir não consome de novo.
  assert.equal(plano.consumirPlanosDaComanda(EMPRESA, barbearia.obterComandaBarbearia(EMPRESA, comanda.id)).length, 0);
  assert.equal(captacao.resumoAssinatura(EMPRESA, ctx.ass.id).usosNoCiclo, 2);
});

test('saldo do plano: quantidade maior que as sessões vira linha coberta + linha avulsa', () => {
  const ctx = montar({ sessoes: 1 });
  const { comanda, avisos } = abrir(ctx, [{ tipo: 'servico', servicoId: ctx.corte.id, quantidade: 2 }]);
  assert.equal(comanda.itens.length, 2);
  assert.equal(comanda.itens.filter((i) => i.coberturaPlano).length, 1);
  assert.equal(comanda.total, 70);
  assert.match(avisos[0], /avulso/);
  // Outra comanda aberta não reaproveita a sessão já reservada.
  const segunda = abrir(ctx, [{ tipo: 'servico', servicoId: ctx.corte.id }]).comanda;
  assert.equal(segunda.total, 70);
  assert.equal(segunda.itens[0].coberturaPlano, undefined);
});

test('plano sem pagamento não cobre; usarPlano:false cobra avulso; o corpo não injeta cobertura', () => {
  const ctx = montar({ pagar: false });
  const r = abrir(ctx, [{ tipo: 'servico', servicoId: ctx.corte.id }]);
  assert.equal(r.comanda.total, 70);
  assert.match(r.avisos[0], /sem pagamento confirmado/);
  const ctx2 = (() => { reset(); return montar(); })();
  const avulso = abrir(ctx2, [{ tipo: 'servico', servicoId: ctx2.corte.id, usarPlano: false }]).comanda;
  assert.equal(avulso.total, 70);
  const forjado = plano.limparItensRecebidos([{ tipo: 'servico', servicoId: ctx2.corte.id, coberturaPlano: { verificadoPeloServidor: true, assinaturaId: 'x' }, itemLoja: { verificadoPeloServidor: true } }]);
  assert.equal(forjado[0].coberturaPlano, undefined);
  assert.equal(forjado[0].itemLoja, undefined);
});

test('comanda toda coberta fecha pelo plano, sem recebimento; plano em atraso bloqueia o fechamento', () => {
  const ctx = montar();
  const { comanda } = abrir(ctx, [{ tipo: 'servico', servicoId: ctx.corte.id }]);
  assert.equal(comanda.total, 0);
  assert.throws(() => barbearia.fecharComandaSemSaldoBarbearia(EMPRESA, comanda.id, {}), /Confirme/);
  const fechada = barbearia.fecharComandaSemSaldoBarbearia(EMPRESA, comanda.id, { confirmado: true, usuario: 'gestor' });
  assert.equal(fechada.status, 'paga');
  assert.equal(fechada.fechadaPeloPlano, true);
  assert.equal(plano.consumirPlanosDaComanda(EMPRESA, fechada)[0].ok, true);

  // Com valor a receber não fecha pelo plano.
  const mista = abrir(ctx, [{ tipo: 'servico', servicoId: ctx.sobrancelha.id }]).comanda;
  assert.throws(() => barbearia.fecharComandaSemSaldoBarbearia(EMPRESA, mista.id, { confirmado: true }), /valor a receber/);

  // Plano cancelado depois de lançar: o recebimento é bloqueado com orientação.
  const outra = abrir(ctx, [{ tipo: 'servico', servicoId: ctx.barba.id }]).comanda;
  barbearia.alterarStatusAssinatura(EMPRESA, ctx.ass.id, 'cancelada', {});
  assert.throws(() => plano.validarCoberturasDaComanda(EMPRESA, outra), { code: 'PLANO_INDISPONIVEL' });
});

test('item de plano não muda de quantidade; agendamento e comanda não consomem duas vezes', () => {
  const ctx = montar();
  const { comanda } = abrir(ctx, [{ tipo: 'servico', servicoId: ctx.corte.id }]);
  assert.throws(() => barbearia.atualizarItemComandaBarbearia(EMPRESA, comanda.id, comanda.itens[0].id, { quantidade: 2 }), /remova a linha/);
  // Mesmo agendamento consumido pela agenda e pela comanda: uma sessão só.
  const fechada = barbearia.fecharComandaSemSaldoBarbearia(EMPRESA, comanda.id, { confirmado: true });
  captacao.registrarUsoAssinatura(EMPRESA, ctx.ass.id, { servicoId: ctx.corte.id, agendamentoId: `comanda:${fechada.id}:${fechada.itens[0].id}` });
  plano.consumirPlanosDaComanda(EMPRESA, fechada);
  assert.equal(captacao.resumoAssinatura(EMPRESA, ctx.ass.id).usosNoCiclo, 1);
});

test('produto da loja virtual: só entra conferido pelo servidor, com preço e estoque da loja', () => {
  const ctx = montar();
  assert.throws(() => barbearia.criarComandaBarbearia(EMPRESA, { lojaId: LOJA, clienteId: ctx.cliente.id, itens: [{ tipo: 'loja', variantId: 'v1', itemLoja: { preco: 1 } }] }), /não verificado/);
  const itemLoja = { verificadoPeloServidor: true, variantId: '11111111-2222-4333-8444-555555555555', productId: '11111111-2222-4333-8444-666666666666', locationId: '11111111-2222-4333-8444-777777777777', nome: 'Perfume Ghost · 100ml', sku: 'GHOST-100', preco: 430, disponivel: 2 };
  assert.throws(() => barbearia.criarComandaBarbearia(EMPRESA, { lojaId: LOJA, itens: [{ tipo: 'loja', quantidade: 3, itemLoja }] }), /Estoque insuficiente na loja/);
  const comanda = barbearia.criarComandaBarbearia(EMPRESA, { lojaId: LOJA, clienteId: ctx.cliente.id, itens: [{ tipo: 'loja', quantidade: 1, itemLoja }] });
  assert.equal(comanda.total, 430);
  assert.equal(comanda.itens[0].estoqueLoja.status, 'pendente');
  const paga = barbearia.registrarPagamentoComandaBarbearia(EMPRESA, comanda.id, { confirmado: true, meioPagamento: 'credito', valor: 430, chaveIdempotencia: 'pg-loja' });
  assert.equal(paga.status, 'paga');
  barbearia.registrarBaixaLojaNoItemComanda(EMPRESA, comanda.id, comanda.itens[0].id, { ok: true, movimento: { disponivel: 1 } });
  assert.equal(barbearia.obterComandaBarbearia(EMPRESA, comanda.id).itens[0].estoqueLoja.status, 'baixado');
});

test('ponte da loja: preço promocional vale quando menor; baixa idempotente com chave da comanda', async () => {
  const item = ponte.linhaParaItemLoja({ variant_id: 'v', product_id: 'p', location_id: 'l', produto: 'Pomada', variante: 'Pomada', sku: 'P1', preco: '45.00', preco_promocional: '39.90', disponivel_local: 3, disponivel_total: 5 });
  assert.equal(item.preco, 39.9);
  assert.equal(item.nome, 'Pomada');
  assert.equal(item.disponivel, 3);
  let chamada = null;
  const transacao = async (fn) => fn({ query: async () => { throw new Error('não deve consultar'); } });
  await assert.rejects(() => ponte.baixarEstoqueLoja({}, { variantId: 'x', locationId: 'y', quantidade: 1, chave: 'k' }, transacao), /inválido/);
  const falsa = async (fn) => { chamada = fn; return { ok: true }; };
  await ponte.baixarEstoqueLoja({ empresaId: EMPRESA }, { variantId: '11111111-2222-4333-8444-555555555555', locationId: '11111111-2222-4333-8444-777777777777', quantidade: 2, chave: 'barbearia-comanda:c1:i1' }, falsa);
  assert.equal(typeof chamada, 'function');
});

test('cadastro do cliente: família com consentimento, preferências e redes sociais', () => {
  const c = clientes.criarCliente(EMPRESA, { nome: 'Rafael', telefone: '65999990002' });
  assert.throws(() => clientes.atualizarCliente(EMPRESA, c.id, { familia: [{ relacao: 'filho', nome: 'Pedro', dataNascimento: '10/05/2015' }] }), /autorizou/);
  const atualizado = clientes.atualizarCliente(EMPRESA, c.id, {
    familia: [{ relacao: 'esposa', nome: 'Ana', dataNascimento: '12/03', telefone: '65999990003' }, { relacao: 'filho', nome: 'Pedro', dataNascimento: '10/05/2015' }],
    familiaConsentimento: true,
    preferencias: { corte: 'Degradê baixo, tesoura em cima', bebida: 'Café sem açúcar', tags: 'perfume amadeirado, conversa pouca' },
    redesSociais: { instagram: 'https://www.instagram.com/rafa.barber/', linkedin: 'linkedin.com/in/rafael-silva-123' },
  });
  assert.equal(atualizado.familia.length, 2);
  assert.equal(atualizado.familia[0].aniversario, '03-12');
  assert.equal(atualizado.familia[1].dataNascimento, '2015-05-10');
  assert.equal(atualizado.familiaConsentimento.concedido, true);
  assert.deepEqual(atualizado.preferencias.tags, ['perfume amadeirado', 'conversa pouca']);
  assert.equal(atualizado.redesSociais.instagram, 'rafa.barber');
  assert.equal(atualizado.redesSociais.linkedin, 'https://www.linkedin.com/in/rafael-silva-123');
  // Atualizar outro campo não apaga a família.
  assert.equal(clientes.atualizarCliente(EMPRESA, c.id, { observacao: 'ok' }).familia.length, 2);
  assert.throws(() => clientes.atualizarCliente(EMPRESA, c.id, { redesSociais: { instagram: 'nome com espaço' } }), /Instagram inválido/);
  assert.throws(() => clientes.atualizarCliente(EMPRESA, c.id, { redesSociais: { linkedin: 'https://facebook.com/x' } }), /LinkedIn inválido/);
});
