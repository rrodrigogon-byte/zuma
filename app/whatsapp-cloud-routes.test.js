import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerWhatsappCloudRoutes } from './whatsapp-cloud-routes.js';

test('WhatsApp Cloud Routes: registro de rotas e handshake de webhook', async () => {
  const app = express();
  app.use(express.json());
  registerWhatsappCloudRoutes(app);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. GET status
    const resStatus = await fetch(`${baseUrl}/api/admin/whatsapp-cloud/status?empresaId=emp_teste_cloud`);
    const dataStatus = await resStatus.json();
    assert.equal(resStatus.status, 200);
    assert.equal(dataStatus.ok, true);
    assert.equal(dataStatus.provedor, 'meta_cloud_api');

    // 2. GET Webhook verification challenge
    const resWebhookGet = await fetch(
      `${baseUrl}/api/webhooks/whatsapp-cloud?hub.mode=subscribe&hub.verify_token=kytto_meta_webhook_2026&hub.challenge=test_challenge_123`
    );
    const bodyWebhookGet = await resWebhookGet.text();
    assert.equal(resWebhookGet.status, 200);
    assert.equal(bodyWebhookGet, 'test_challenge_123');

    // 3. POST Webhook event
    const resWebhookPost = await fetch(`${baseUrl}/api/webhooks/whatsapp-cloud`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [{ from: '5565999056008', text: { body: 'Oi' } }],
                },
              },
            ],
          },
        ],
      }),
    });
    const bodyWebhookPost = await resWebhookPost.text();
    assert.equal(resWebhookPost.status, 200);
    assert.equal(bodyWebhookPost, 'EVENT_RECEIVED');

    // 4. POST config
    const resConfig = await fetch(`${baseUrl}/api/admin/whatsapp-cloud/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empresaId: 'emp_teste_cloud',
        token: 'EAAB_token_novo',
        phoneNumberId: '10998877',
        wabaId: '55443322',
        verifyToken: 'custom_verify',
        ativo: true,
      }),
    });
    const dataConfig = await resConfig.json();
    assert.equal(resConfig.status, 200);
    assert.equal(dataConfig.ok, true);

  } finally {
    server.close();
  }
});
