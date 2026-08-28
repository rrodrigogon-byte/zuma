import crypto from 'crypto';

const RESERVA_MINUTOS = 30;

export function normalizeItems(items, catalog) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('carrinho vazio');
  }

  const agregadas = new Map();
  for (const raw of items) {
    const produtoId = raw?.produtoId ?? raw?.id;
    const produto = (catalog || []).find(p => p.id == produtoId && p.ativo !== false);
    if (!produto) throw new Error('produto indisponível no carrinho');
    const tamanho = String(raw.tamanho || '').slice(0, 30);
    const key = `${produto.id}:${tamanho}`;
    const qtd = Math.max(1, Math.min(99, parseInt(raw.qtd, 10) || 1));
    const anterior = agregadas.get(key);
    agregadas.set(key, { produto, produtoId:produto.id, cod:produto.cod || '', nome:produto.nome, tamanho, qtd:(anterior?.qtd || 0) + qtd });
  }

  return [...agregadas.values()].map(item => {
    const estoque = item.produto.estoque == null ? 999 : Number(item.produto.estoque);
    if (item.qtd > 99) throw new Error(`quantidade máxima por item: 99`);
    if (estoque < item.qtd) {
      throw new Error(`estoque insuficiente de ${item.nome || 'produto'} (disponível: ${estoque})`);
    }
    const preco = Number(item.produto.preco || 0);
    if (!(preco >= 0)) throw new Error(`preço inválido para ${item.nome || 'produto'}`);
    return { ...item, qtd:item.qtd, preco, subtotal:Math.round(preco * item.qtd * 100) / 100, produto:undefined };
  }).map(({ produto, ...item }) => item);
}

function couponIsValid(coupon, usage = 'loja') {
  if (!coupon || coupon.ativo === false) return { ok: false, error: 'Cupom inválido ou expirado' };
  if (coupon.validade && new Date() > new Date(`${coupon.validade}T23:59:59`)) {
    return { ok: false, error: 'Cupom expirado' };
  }
  if (coupon.maxUsos !== null && coupon.maxUsos !== undefined && Number(coupon.usos || 0) >= Number(coupon.maxUsos)) {
    return { ok: false, error: 'Cupom esgotado' };
  }
  const uso = coupon.uso || 'ambos';
  const aceitos = new Set([uso, ...(uso === 'todos' ? ['loja', 'inscricao', 'ingresso', 'ambos'] : [])]);
  if (usage && !aceitos.has(usage) && !aceitos.has('ambos') && uso !== 'ambos') {
    return { ok: false, error: 'Cupom não válido para a loja' };
  }
  return { ok: true };
}

export function findCoupon(coupons, code, usage = 'loja') {
  if (!code) return null;
  const normalized = String(code).trim().toUpperCase();
  const coupon = (coupons || []).find(c => String(c.codigo || '').toUpperCase() === normalized);
  const validation = couponIsValid(coupon, usage);
  if (!validation.ok) {
    const error = new Error(validation.error);
    error.code = coupon ? 'COUPON_INVALID' : 'COUPON_NOT_FOUND';
    throw error;
  }
  return coupon;
}

export function calculateDiscount(coupon, subtotal) {
  if (!coupon) return 0;
  const raw = coupon.tipo === 'pct'
    ? subtotal * (Number(coupon.valor || 0) / 100)
    : Number(coupon.valor || 0);
  return Math.min(subtotal, Math.max(0, Math.round(raw * 100) / 100));
}

export function availableShipping() {
  const options = [
    {
      id: 'pickup',
      nome: 'Retirada na loja',
      descricao: 'Retire no ponto informado pela Kytto',
      preco: 0,
      prazo: 'Disponível após a confirmação',
      tipo: 'retirada',
    },
  ];

  if (process.env.CHECKOUT_DELIVERY_ENABLED === '1') {
    options.push({
      id: 'delivery-local',
      nome: 'Entrega local',
      descricao: 'Entrega calculada pela operação da loja',
      preco: Number(process.env.CHECKOUT_DELIVERY_FEE || 0),
      prazo: process.env.CHECKOUT_DELIVERY_DAYS || 'A combinar',
      tipo: 'entrega',
    });
  }
  return options;
}

function normalizeAddress(address = {}) {
  return {
    cep: String(address.cep || '').replace(/\D/g, '').slice(0, 8),
    rua: String(address.rua || address.street || '').trim().slice(0, 160),
    numero: String(address.numero || address.number || '').trim().slice(0, 20),
    complemento: String(address.complemento || address.complement || '').trim().slice(0, 100),
    bairro: String(address.bairro || address.neighborhood || '').trim().slice(0, 100),
    cidade: String(address.cidade || address.city || '').trim().slice(0, 100),
    uf: String(address.uf || address.state || '').trim().toUpperCase().slice(0, 2),
    referencia: String(address.referencia || address.reference || '').trim().slice(0, 160),
  };
}

export function simulateCheckout({ catalog, coupons, items, couponCode, shippingMethod = 'pickup', address = {} }) {
  const linhas = normalizeItems(items, catalog);
  const subtotal = Math.round(linhas.reduce((sum, item) => sum + item.subtotal, 0) * 100) / 100;
  let coupon = null;
  let desconto = 0;
  if (couponCode) {
    coupon = findCoupon(coupons, couponCode, 'loja');
    desconto = calculateDiscount(coupon, subtotal);
  }

  const shipping = availableShipping().find(option => option.id === shippingMethod);
  if (!shipping) throw new Error('método de entrega indisponível');
  const endereco = normalizeAddress(address);
  if (shipping.tipo === 'entrega') {
    if (endereco.cep.length !== 8) throw new Error('informe um CEP válido para calcular a entrega');
    if (!endereco.rua || !endereco.numero || !endereco.cidade || !endereco.uf) {
      throw new Error('complete o endereço de entrega');
    }
  }

  const totalFinal = Math.max(0, Math.round((subtotal - desconto + Number(shipping.preco || 0)) * 100) / 100);
  return {
    checkoutId: `chk_${crypto.randomUUID()}`,
    itens: linhas.map(({ produto, ...item }) => item),
    subtotal,
    desconto,
    cupom: coupon ? { id: coupon.id, codigo: coupon.codigo, tipo: coupon.tipo, valor: coupon.valor, descricao: coupon.descricao || '' } : null,
    frete: Number(shipping.preco || 0),
    metodoEntrega: shipping,
    enderecoEntrega: shipping.tipo === 'entrega' ? endereco : null,
    totalFinal,
    moeda: 'BRL',
    reservaMinutos: RESERVA_MINUTOS,
  };
}

export function createIdempotencyKey(value) {
  const raw = String(value || '').trim();
  return raw.length >= 12 ? raw.slice(0, 120) : `web_${crypto.randomUUID()}`;
}

export function reservationExpiry() {
  return new Date(Date.now() + RESERVA_MINUTOS * 60 * 1000).toISOString();
}

export function publicCheckoutOrder(order) {
  return {
    id: order.id,
    codigo: order.codigo,
    status: order.status,
    pagamento: order.pagamento,
    paymentStatus: order.paymentStatus || (order.pagamento === 'pago' ? 'aprovado' : 'pendente'),
    itens: order.itens || [],
    subtotal: Number(order.subtotal ?? order.total ?? 0),
    desconto: Number(order.desconto || 0),
    frete: Number(order.frete || 0),
    total: Number(order.totalFinal ?? order.total ?? 0),
    cupom: order.cupom || null,
    metodoEntrega: order.metodoEntrega || null,
    reservadoAte: order.reservadoAte || null,
    criadoEm: order.criadoEm,
    atualizadoEm: order.atualizadoEm,
  };
}

export function consumeCoupon(coupons, couponId) {
  const coupon = (coupons || []).find(c => c.id == couponId);
  if (coupon) coupon.usos = Number(coupon.usos || 0) + 1;
}
