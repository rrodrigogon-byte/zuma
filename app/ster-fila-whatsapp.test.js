import test from 'node:test';
import assert from 'node:assert/strict';
import { restricaoDePermissao } from './core/perfis-acesso.js';

test('Acesso do perfil Operador à Fila de Atendimento do WhatsApp', async (t) => {
  await t.test('1. Operador deve ter acesso permitido às rotas de sessions da Fila', () => {
    const req = {
      user: { role: 'operador' },
      method: 'GET',
      originalUrl: '/api/admin/commerce/whatsapp-ai/sessions?status=humano&assignment=all&limit=100'
    };
    const restricao = restricaoDePermissao(req, 'reports.read');
    assert.equal(restricao, null, 'Não deve haver restrição para a fila de WhatsApp');
  });

  await t.test('2. Operador deve ter acesso permitido às ações de claim e messages', () => {
    const reqClaim = {
      user: { role: 'operador' },
      method: 'POST',
      originalUrl: '/api/admin/commerce/whatsapp-ai/sessions/sess-123/claim'
    };
    assert.equal(restricaoDePermissao(reqClaim, 'settings.write'), null);

    const reqMsg = {
      user: { role: 'operador' },
      method: 'POST',
      originalUrl: '/api/admin/commerce/whatsapp-ai/sessions/sess-123/messages'
    };
    assert.equal(restricaoDePermissao(reqMsg, 'settings.write'), null);
  });
});
