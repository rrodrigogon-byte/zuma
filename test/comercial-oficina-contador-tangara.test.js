import test from 'node:test';
import assert from 'node:assert/strict';
import { createOficinaAdminRouter, createOficinaPublicoRouter } from '../app/routes/oficina-routes.js';
import express from 'express';

test('Oficina Mecânica & OS Interativa no WhatsApp (Tangará da Serra)', async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/api/publico/oficina', createOficinaPublicoRouter());
  app.use('/api/admin/oficina', createOficinaAdminRouter());

  await t.test('1. Consulta pública da Ordem de Serviço pelo cliente via link do WhatsApp', async () => {
    const server = app.listen(0);
    const port = server.address().port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/publico/oficina/os/os-1042`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.equal(data.os.numeroOs, 'OS-2026-01042');
      assert.equal(data.os.placa, 'RNI-4E29');
      assert.ok(data.os.itensPecas.length > 0, 'Deve conter peças de reposição');
      assert.ok((data.os.itensServicos || data.os.itensMaoObra).length > 0, 'Deve conter serviços especializados');
      assert.ok(data.os.oficinaNome.includes('Tangará'), 'Deve identificar a oficina de Tangará');
    } finally {
      server.close();
    }
  });

  await t.test('2. Aprovação de orçamento de OS em 1 clique pelo cliente no celular', async () => {
    const server = app.listen(0);
    const port = server.address().port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/publico/oficina/os/os-1042/aprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origem: 'whatsapp_mobile' })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.equal(data.os.status, 'APROVADO_WHATSAPP');
      assert.equal(data.os.aprovadoPeloWhatsApp, true);
      assert.ok(data.os.dataAprovacaoWhatsApp, 'Deve gravar timestamp da aprovação');
    } finally {
      server.close();
    }
  });

  await t.test('3. Envio do orçamento pelo painel com link de aprovação para o WhatsApp', async () => {
    const server = app.listen(0);
    const port = server.address().port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/admin/oficina/os/os-1042/enviar-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.ok(data.linkAprovacao.includes('os-aprovacao/os-1042'), 'Deve conter link de aprovação');
      assert.ok(data.mensagem.includes('WhatsApp Cloud API'), 'Deve confirmar disparo via WhatsApp');
    } finally {
      server.close();
    }
  });
});
