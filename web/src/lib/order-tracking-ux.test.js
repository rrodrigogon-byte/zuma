import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const orderSource = readFileSync(new URL('../pages/public/AcompanharPedido.jsx', import.meta.url), 'utf8');
const orderStyles = readFileSync(new URL('../pages/public/order-tracking.css', import.meta.url), 'utf8');
const theme = readFileSync(new URL('../theme.css', import.meta.url), 'utf8');

test('acompanhamento explica jornada, histórico e ação de pagamento', () => {
  assert.match(orderSource, /Pedido recebido/);
  assert.match(orderSource, /Pagamento confirmado/);
  assert.match(orderSource, /Prazo total estimado/);
  assert.match(orderSource, /Concluir pagamento/);
  assert.match(orderSource, /FINAL_STATUSES\.has\(presentation\.status\) \? 'Concluída'/);
  assert.match(orderSource, /Atualização automática a cada 10 segundos/);
  assert.match(orderSource, /lastAnnouncedStatus/);
  assert.match(orderSource, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.doesNotMatch(orderSource, /order-current-status[^>]+aria-live/);
});

test('pesquisa aparece somente após conclusão e usa idempotência local', () => {
  assert.match(orderSource, /satisfactionEligible/);
  assert.match(orderSource, /pedido\?\.isCore === true/);
  assert.match(orderSource, /FINAL_STATUSES\.has/);
  assert.match(orderSource, /\/satisfaction/);
  assert.match(orderSource, /X-Idempotency-Key/);
  assert.match(orderSource, /crypto\.randomUUID\(\)/);
  assert.match(orderSource, /type="radio" name="order-rating"/);
  assert.match(orderSource, /sem texto livre ou dados de pagamento/);
  assert.doesNotMatch(orderSource, /survey\.comment/);
});

test('checkout e acompanhamento têm estilos explícitos de alto contraste', () => {
  assert.match(theme, /\.checkout-page \.checkout-recovery-consent strong \{ color: #172033/);
  assert.match(theme, /html\[data-brand='dino'\] \.checkout-page \.checkout-recovery-consent strong \{ color: #ffffff/);
  assert.match(theme, /html\[data-brand='dino'\] \.checkout-result-meta > div/);
  assert.match(orderStyles, /--order-text: #172033/);
  assert.match(orderStyles, /--order-text: #f4f6fb/);
});
