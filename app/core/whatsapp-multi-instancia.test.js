// Várias empresas no mesmo backend multi-instância (Dino + Stallone): cada instância
// tem uma empresa dona; entrada, saída e diagnóstico nunca cruzam empresas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { instanceLineVerified, instanceOwner, instanceRegistry, instancesOfCompany } from './whatsapp-provider.js';
import { evaluateWhatsappEgress } from './whatsapp-egress.js';
import { estadoDaEntrada, instanciasDaEntrada, pollMode, runIsaPollPass } from './whatsapp-isa-poll.js';

const DINO = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
const STALLONE = '31f70c83-9172-40c2-945f-9e793b5048be';
const LOJA = '6a15e943-2570-4f29-a2d5-d900d2812911';
const CANAL = 'ae741d39-039c-4f4b-9183-9c5f639405a0';

const ENV = {
  WHATSAPP_PROVIDER: 'chatbot_backend', CHATBOT_BACKEND_MODE: 'instancias',
  CHATBOT_BACKEND_URL: 'https://backend.test', CHATBOT_BACKEND_KEY: 'chave-de-teste-com-24-car',
  CHATBOT_BACKEND_INSTANCE: 'dino', CHATBOT_BACKEND_EMPRESA_ID: DINO,
  CHATBOT_BACKEND_INSTANCES: `dino=${DINO},stallone-1=${STALLONE}`,
  WHATSAPP_LINE_VERIFIED: undefined, WHATSAPP_LINE_VERIFIED_INSTANCES: 'dino,stallone-1',
  WHATSAPP_EGRESS_MODE: 'on', WHATSAPP_FULL_ROLLOUT_APPROVED: '1', WHATSAPP_POLL_MODE: 'on',
  WHATSAPP_POLL_PILOT_PHONES: undefined,
};

async function comEnv(valores, fn) {
  const salvos = {};
  for (const [chave, valor] of Object.entries(valores)) { salvos[chave] = process.env[chave]; if (valor === undefined) delete process.env[chave]; else process.env[chave] = valor; }
  try { return await fn(); } finally { for (const [chave, valor] of Object.entries(salvos)) { if (valor === undefined) delete process.env[chave]; else process.env[chave] = valor; } }
}

test('registro de instâncias: lista explícita, dono por instância e par antigo compatível', () => {
  const reg = instanceRegistry({ CHATBOT_BACKEND_INSTANCES: `dino=${DINO}, stallone-1=${STALLONE}` });
  assert.deepEqual([...reg], [['dino', DINO], ['stallone-1', STALLONE]]);
  assert.equal(instanceOwner('STALLONE-1', { CHATBOT_BACKEND_INSTANCES: `stallone-1=${STALLONE}` }), STALLONE);
  assert.deepEqual(instancesOfCompany(STALLONE, { CHATBOT_BACKEND_INSTANCES: `dino=${DINO},stallone-1=${STALLONE}` }), ['stallone-1']);
  // Mesma instância com dois donos: ninguém fica com ela.
  assert.equal(instanceRegistry({ CHATBOT_BACKEND_INSTANCES: `dino=${DINO},dino=${STALLONE}` }).size, 0);
  // Sem a lista, vale o par antigo (Dino continua igual).
  assert.deepEqual([...instanceRegistry({ CHATBOT_BACKEND_INSTANCE: 'dino', CHATBOT_BACKEND_EMPRESA_ID: DINO })], [['dino', DINO]]);
  assert.equal(instanceLineVerified('dino', { CHATBOT_BACKEND_INSTANCE: 'dino', WHATSAPP_LINE_VERIFIED: '1' }), true);
  assert.equal(instanceLineVerified('stallone-1', { CHATBOT_BACKEND_INSTANCE: 'dino', WHATSAPP_LINE_VERIFIED: '1' }), false, 'a variável antiga não abre outra linha');
  assert.equal(instanceLineVerified('stallone-1', { WHATSAPP_LINE_VERIFIED_INSTANCES: 'dino' }), false);
});

test('saída: cada empresa só envia pela própria instância e só com a linha conferida', async () => {
  await comEnv(ENV, async () => {
    const base = { lojaId: LOJA, canalId: CANAL, number: '65999990001' };
    assert.equal(evaluateWhatsappEgress({ ...base, empresaId: STALLONE, instance: 'stallone-1' }).ok, true);
    assert.equal(evaluateWhatsappEgress({ ...base, empresaId: DINO, instance: 'dino' }).ok, true);
    assert.equal(evaluateWhatsappEgress({ ...base, empresaId: STALLONE, instance: 'dino' }).reason, 'company_scope', 'Stallone nunca fala pela linha da Dino');
    assert.equal(evaluateWhatsappEgress({ ...base, empresaId: DINO, instance: 'stallone-1' }).reason, 'company_scope');
    assert.equal(evaluateWhatsappEgress({ ...base, empresaId: STALLONE, instance: 'outra' }).reason, 'instance_scope');
  });
  await comEnv({ ...ENV, WHATSAPP_LINE_VERIFIED_INSTANCES: 'dino' }, async () => {
    const r = evaluateWhatsappEgress({ lojaId: LOJA, canalId: CANAL, number: '65999990001', empresaId: STALLONE, instance: 'stallone-1' });
    assert.equal(r.reason, 'line_unverified', 'linha da Stallone fechada até ser conferida');
  });
});

test('entrada: o worker lê cada linha aberta e a linha fechada não abre as outras', async () => {
  await comEnv(ENV, async () => {
    assert.deepEqual(instanciasDaEntrada().sort(), ['dino', 'stallone-1']);
    assert.equal(pollMode('stallone-1'), 'on');
    assert.equal(estadoDaEntrada({ instance: 'stallone-1' }).linhaVerificada, true);
  });
  await comEnv({ ...ENV, WHATSAPP_LINE_VERIFIED_INSTANCES: 'dino' }, async () => {
    assert.equal(pollMode('stallone-1'), 'off');
    assert.equal(pollMode('dino'), 'on');
    const r = await runIsaPollPass({ instance: 'stallone-1', canal: { id: CANAL, empresa_id: STALLONE, loja_id: LOJA, configuracao: { instance: 'stallone-1' } }, comTrava: false });
    assert.equal(r.reason, 'line_closed');
  });
});

test('entrada: canal de outra empresa nunca consulta a linha da Stallone', async () => {
  await comEnv(ENV, async () => {
    const chamadas = [];
    const fetchImpl = async (url) => { chamadas.push(url); return { ok: true, status: 200, text: async () => '{"users":[]}' }; };
    const canalDino = { id: CANAL, empresa_id: DINO, loja_id: LOJA, configuracao: { instance: 'stallone-1' } };
    const negado = await runIsaPollPass({ instance: 'stallone-1', fetchImpl, canal: canalDino, carregarCanal: async () => canalDino, comTrava: false, equipe: { liberar: async () => 0, pausar: async () => ({}) } });
    assert.equal(negado.reason, 'instance_scope_mismatch');
    assert.equal(chamadas.length, 0, 'nenhum GET antes de negar');
    const canalStallone = { id: CANAL, empresa_id: STALLONE, loja_id: LOJA, configuracao: { instance: 'stallone-1' } };
    const ok = await runIsaPollPass({ instance: 'stallone-1', fetchImpl, canal: canalStallone, carregarCanal: async () => canalStallone, comTrava: false, equipe: { liberar: async () => 0, pausar: async () => ({}) } });
    assert.equal(ok.skipped, false, JSON.stringify(ok));
    assert.match(chamadas[0], /instanceName=stallone-1/);
  });
});
