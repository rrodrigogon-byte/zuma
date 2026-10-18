import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registrarExtensaoWhatsappAi, limparExtensoesWhatsappAi, ferramentasExtrasWhatsappAi, notificarMensagemWhatsappAi,
} from './whatsapp-ai-extensoes.js';

const EMP_A = '00000000-0000-4000-8000-00000000000a';
const EMP_B = '00000000-0000-4000-8000-00000000000b';
const decl = (name) => ({ name, description: 'x', parameters: { type: 'OBJECT', properties: {} } });

function extensao(over = {}) {
  const chamadas = []; const recebidas = [];
  return {
    chamadas, recebidas,
    ext: {
      nome: 'teste', declaracoes: [decl('teste_ola')], orientacao: 'Use teste_ola.',
      ativaPara: async ({ empresaId }) => empresaId === EMP_A,
      executar: async (ctx, nome, args) => { chamadas.push({ ctx, nome, args }); return { ok: true, nome }; },
      aoReceber: async (d) => { recebidas.push(d); },
      ...over,
    },
  };
}

test('extensão só aparece na empresa em que está ativa (multiempresa)', async () => {
  limparExtensoesWhatsappAi();
  const { ext, chamadas } = extensao();
  registrarExtensaoWhatsappAi(ext);
  const base = async (nome) => ({ base: nome });
  const a = await ferramentasExtrasWhatsappAi({ empresaId: EMP_A, lojaId: null, phone: '65999990000' });
  assert.deepEqual(a.declaracoes.map((d) => d.name), ['teste_ola']);
  assert.equal(a.orientacao, 'Use teste_ola.');
  const exec = a.envolver(base);
  assert.deepEqual(await exec('teste_ola', { x: 1 }), { ok: true, nome: 'teste_ola' });
  assert.equal(chamadas[0].ctx.empresaId, EMP_A, 'identidade vem do contexto da conversa');
  assert.deepEqual(await exec('buscar_produtos', {}), { base: 'buscar_produtos' }, 'ferramentas do núcleo seguem iguais');
  // resultado e link entram no contexto da tentativa (checagem de preço e link garantido do núcleo)
  const tentativa = { empresaId: EMP_A, toolResults: [], toolLinks: [] };
  registrarExtensaoWhatsappAi({ ...extensao().ext, executar: async () => ({ ok: true, valor: 'R$ 120,00', link: 'https://a.kytto.com.br/clube/pagar/x' }) });
  const b2 = await ferramentasExtrasWhatsappAi({ empresaId: EMP_A });
  await b2.envolver(base, tentativa)('teste_ola', {});
  assert.equal(tentativa.toolResults.length, 1);
  assert.deepEqual(tentativa.toolLinks, ['https://a.kytto.com.br/clube/pagar/x']);

  const b = await ferramentasExtrasWhatsappAi({ empresaId: EMP_B });
  assert.equal(b.declaracoes.length, 0);
  assert.equal(b.envolver(base), base, 'sem extensão ativa o executor é o original');
});

test('canais internos (gestão e lançamentos) não recebem ferramentas de extensão', async () => {
  limparExtensoesWhatsappAi();
  registrarExtensaoWhatsappAi(extensao().ext);
  for (const channelType of ['gestao', 'lancamentos']) {
    assert.equal((await ferramentasExtrasWhatsappAi({ empresaId: EMP_A, channelType })).declaracoes.length, 0);
  }
});

test('nome de ferramenta repetido ou inválido é recusado no registro', () => {
  limparExtensoesWhatsappAi();
  assert.throws(() => registrarExtensaoWhatsappAi(extensao({ declaracoes: [decl('buscar_produtos')] }).ext, { nomesReservados: ['buscar_produtos'] }), /já existe/);
  assert.throws(() => registrarExtensaoWhatsappAi(extensao({ declaracoes: [decl('Nome Ruim')] }).ext), /inválido/);
  registrarExtensaoWhatsappAi(extensao().ext);
  assert.throws(() => registrarExtensaoWhatsappAi(extensao({ nome: 'outra' }).ext), /já existe/);
});

test('falha da extensão não derruba o atendimento', async () => {
  limparExtensoesWhatsappAi();
  registrarExtensaoWhatsappAi(extensao({
    executar: async () => { throw new Error('banco fora'); },
    aoReceber: async () => { throw new Error('banco fora'); },
  }).ext);
  const a = await ferramentasExtrasWhatsappAi({ empresaId: EMP_A });
  const r = await a.envolver(async () => null)('teste_ola', {});
  assert.equal(r.ok, false);
  await notificarMensagemWhatsappAi({ empresaId: EMP_A, phone: '65999990000', text: 'oi' });
});

test('mensagem recebida chega só às extensões ativas na empresa; ativaPara com erro conta como inativa', async () => {
  limparExtensoesWhatsappAi();
  const { ext, recebidas } = extensao();
  registrarExtensaoWhatsappAi(ext);
  await notificarMensagemWhatsappAi({ empresaId: EMP_A, phone: '65999990000', text: 'parar' });
  await notificarMensagemWhatsappAi({ empresaId: EMP_B, phone: '65999990000', text: 'oi' });
  assert.deepEqual(recebidas.map((d) => d.text), ['parar']);
  limparExtensoesWhatsappAi();
  registrarExtensaoWhatsappAi(extensao({ ativaPara: async () => { throw new Error('x'); } }).ext);
  assert.equal((await ferramentasExtrasWhatsappAi({ empresaId: EMP_A })).declaracoes.length, 0);
});
