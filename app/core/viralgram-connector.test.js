import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analisarPerfilSocialViralgram,
  mapearClienteNoViralgram,
  mapearTodosClientesViralgram,
  statusIntegracaoViralgram,
} from './viralgram-connector.js';
import * as clientesKytto from '../clientes-contas-kytto.js';

test('ViralGram Connector: analisa perfil social sem redes', () => {
  const cliente = { nome: 'Carlos Silva', cidade: 'Cuiabá', bairro: 'Bosque' };
  const perfil = analisarPerfilSocialViralgram(cliente);
  assert.equal(perfil.status, 'pendente_redes');
  assert.equal(perfil.reputationScore, 50);
  assert.equal(perfil.visibilityScore, 30);
  assert.match(perfil.estrategiaDino, /Coletar o @/);
});

test('ViralGram Connector: analisa perfil social com Instagram e LinkedIn', () => {
  const cliente = {
    nome: 'Rodrigo Gonçalves',
    cidade: 'Cuiabá',
    bairro: 'Jardim das Américas',
    instagram: '@rodrigokytto',
    linkedin: 'https://www.linkedin.com/in/rodrigokytto',
  };
  const perfil = analisarPerfilSocialViralgram(cliente);
  assert.equal(perfil.status, 'mapeado');
  assert.ok(perfil.reputationScore >= 80);
  assert.ok(perfil.visibilityScore >= 80);
  assert.equal(perfil.tier, 'Líder / Influenciador');
  assert.equal(perfil.instagram, 'rodrigokytto');
  assert.ok(perfil.linkedin.includes('rodrigokytto'));
  assert.ok(perfil.instagramAnalysis);
  assert.ok(perfil.linkedinAnalysis);
  assert.match(perfil.estrategiaDino, /stories|embaixador/i);
});

test('ViralGram Connector: mapeamento no store de clientes e status', async () => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const clienteCriado = clientesKytto.criarCliente(empresaId, {
    nome: 'Marcos VIP ViralGram',
    telefone: '5565977771234',
    instagram: 'marcosvip',
    linkedin: 'marcos-executivo',
    cidade: 'Cuiabá',
  });

  const resMapeamento = await mapearClienteNoViralgram(empresaId, clienteCriado.id);
  assert.equal(resMapeamento.ok, true);
  assert.equal(resMapeamento.viralgramProfile.status, 'mapeado');
  assert.equal(resMapeamento.viralgramProfile.instagram, 'marcosvip');

  const status = statusIntegracaoViralgram(empresaId);
  assert.equal(status.conectado, true);
  assert.ok(status.comInstagram >= 1);
  assert.ok(status.mapeados >= 1);
});
