import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const adminSource = new URL('../web/src/pages/admin/EcommerceAdmin.jsx', import.meta.url);
const helperSource = new URL('../web/src/lib/payment-account-form.js', import.meta.url);

test('backoffice publicado expõe InfinitePay com configuração pública e sem ativação automática', async () => {
  const [admin, helper] = await Promise.all([
    readFile(adminSource, 'utf8'),
    readFile(helperSource, 'utf8'),
  ]);

  assert.match(admin, /option value="infinitepay">InfinitePay Checkout/);
  assert.match(admin, /InfiniteTag \/ handle/);
  assert.match(admin, /URL de retorno/);
  assert.match(admin, /URL do webhook/);
  assert.match(admin, /paymentAccountPublicConfig\(paymentForm\)/);
  assert.match(helper, /methods: \['pix', 'credit_card'\]/);
  assert.match(helper, /ativo: false/);
  assert.doesNotMatch(helper, /APP_USR-|sk_live_|Bearer\s+[A-Za-z0-9._-]+|password\s*[:=]|senha\s*[:=]/i);
});
