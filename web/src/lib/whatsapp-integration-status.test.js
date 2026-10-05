import test from 'node:test';
import assert from 'node:assert/strict';
import { whatsappIntegrationStatus } from './whatsapp-integration-status.js';

const ready = {
  envioManualDisponivel: false,
  credencialConfigurada: false,
  ai: {
    featureEnabled: true,
    gemini: { configured: true },
    messagingConfigured: true,
    channel: { status: 'ativo' },
    connection: { state: 'open', checkedAt: new Date().toISOString() },
    worker: { lastHeartbeatAt: new Date().toISOString() },
  },
};

test('canal IA ativo não fica pendente só porque adaptador manual legado está desligado', () => {
  assert.deepEqual(whatsappIntegrationStatus(ready), {
    badge: 'configurado',
    label: 'Canal da unidade conectado · atendimento automático habilitado',
    automatic: 'Ativo por padrão (reativo)',
  });
});

test('sem contexto da unidade, não presume canal nem status de outro tenant', () => {
  assert.match(whatsappIntegrationStatus({ ai: { unavailable: true } }).label, /indisponível/);
  assert.equal(whatsappIntegrationStatus({ ai: { unavailable: true } }).automatic, 'Não verificável');
  assert.match(whatsappIntegrationStatus({ ai: {} }).label, /não cadastrado/);
});

test('canal pausado, circuito aberto ou provedor ausente não anunciam automação ativa', () => {
  assert.equal(whatsappIntegrationStatus({ ai: { ...ready.ai, channel: { status: 'pausado' } } }).automatic, 'Pausado');
  assert.equal(whatsappIntegrationStatus({ ai: { ...ready.ai, channel: { status: 'ativo', aiCircuitOpen: true } } }).automatic, 'Handoff de segurança');
  assert.equal(whatsappIntegrationStatus({ ai: { ...ready.ai, messagingConfigured: false } }).automatic, 'Indisponível');
  assert.equal(whatsappIntegrationStatus({ ai: { ...ready.ai, featureEnabled: false } }).automatic, 'Desativado');
});

test('flags ativas não bastam para anunciar conexão quando número ou worker estão indisponíveis', () => {
  assert.equal(whatsappIntegrationStatus({ ai: { ...ready.ai, connection: undefined } }).badge, 'nao_verificado');
  assert.match(whatsappIntegrationStatus({ ai: { ...ready.ai, connection: { state: 'qr', checkedAt: new Date().toISOString() } } }).label, /pareamento/);
  assert.match(whatsappIntegrationStatus({ ai: { ...ready.ai, connection: { state: 'close', checkedAt: new Date().toISOString() } } }).label, /desconectado/);
  assert.equal(whatsappIntegrationStatus({ ai: { ...ready.ai, worker: { lastHeartbeatAt: null } } }).automatic, 'Worker indisponível');
  assert.equal(whatsappIntegrationStatus({ ai: { ...ready.ai, connection: { state: 'open', checkedAt: '2020-01-01' } } }).badge, 'nao_verificado');
});
