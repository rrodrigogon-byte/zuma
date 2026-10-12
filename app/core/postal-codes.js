// Consulta de CEP para todo o Brasil.
//
// Nenhuma base pública sozinha cobre todos os CEPs: o ViaCEP, por exemplo, não traz
// CEPs gerais de município como 78300-000 (Tangará da Serra), que o OpenCEP, a
// BrasilAPI e a AwesomeAPI trazem. Por isso a consulta:
//   1. usa primeiro o cache permanente (tabela commerce_postal_codes), que guarda todo
//      CEP já confirmado e continua respondendo quando os serviços externos caem;
//   2. consulta as fontes em paralelo e fica com a primeira resposta válida;
//   3. confere se a UF devolvida bate com a faixa oficial de CEP da UF (Correios);
//   4. só diz "CEP não encontrado" quando nenhuma fonte reconhece o CEP.
import { CommerceError } from './commerce-core.js';

const CEP_PATTERN = /^\d{8}$/;
const DEFAULT_TIMEOUT_MS = 6000;
const CACHE_MAX_AGE_DAYS = 365;

// Faixas de CEP por UF publicadas pelos Correios.
export const UF_CEP_RANGES = [
  ['SP', '01000000', '19999999'], ['RJ', '20000000', '28999999'], ['ES', '29000000', '29999999'],
  ['MG', '30000000', '39999999'], ['BA', '40000000', '48999999'], ['SE', '49000000', '49999999'],
  ['PE', '50000000', '56999999'], ['AL', '57000000', '57999999'], ['PB', '58000000', '58999999'],
  ['RN', '59000000', '59999999'], ['CE', '60000000', '63999999'], ['PI', '64000000', '64999999'],
  ['MA', '65000000', '65999999'], ['PA', '66000000', '68899999'], ['AP', '68900000', '68999999'],
  ['AM', '69000000', '69299999'], ['RR', '69300000', '69399999'], ['AM', '69400000', '69899999'],
  ['AC', '69900000', '69999999'], ['DF', '70000000', '72799999'], ['GO', '72800000', '72999999'],
  ['DF', '73000000', '73699999'], ['GO', '73700000', '76799999'], ['RO', '76800000', '76999999'],
  ['TO', '77000000', '77999999'], ['MT', '78000000', '78899999'], ['MS', '79000000', '79999999'],
  ['PR', '80000000', '87999999'], ['SC', '88000000', '89999999'], ['RS', '90000000', '99999999'],
];

/** UF dona da faixa do CEP, ou null quando o CEP não está em nenhuma faixa oficial. */
export function ufForCep(cep) {
  const value = String(cep || '');
  if (!CEP_PATTERN.test(value)) return null;
  const found = UF_CEP_RANGES.find(([, from, to]) => value >= from && value <= to);
  return found ? found[0] : null;
}

function clean(value, max) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

function result(cep, fields, source) {
  return {
    cep,
    logradouro: clean(fields.logradouro, 240),
    complemento: clean(fields.complemento, 120),
    bairro: clean(fields.bairro, 120),
    cidade: clean(fields.cidade, 120),
    estado: clean(fields.estado, 2)?.toUpperCase() || null,
    ibge: clean(fields.ibge, 20),
    fonte: source,
  };
}

const NOT_FOUND = Symbol('not-found');

// Cada fonte devolve o endereço normalizado, NOT_FOUND quando reconhece que o CEP não
// existe, ou lança erro quando está fora do ar.
export const POSTAL_PROVIDERS = [
  {
    code: 'viacep',
    url: cep => `https://viacep.com.br/ws/${cep}/json/`,
    parse(body, status) {
      if (status === 400 || status === 404 || body?.erro === true || String(body?.erro).toLowerCase() === 'true') return NOT_FOUND;
      return { logradouro: body?.logradouro, complemento: body?.complemento, bairro: body?.bairro, cidade: body?.localidade, estado: body?.uf, ibge: body?.ibge };
    },
  },
  {
    code: 'opencep',
    url: cep => `https://opencep.com/v1/${cep}`,
    parse(body, status) {
      if (status === 404 || body?.error === true) return NOT_FOUND;
      return { logradouro: body?.logradouro, complemento: body?.complemento, bairro: body?.bairro, cidade: body?.localidade, estado: body?.uf, ibge: body?.ibge };
    },
  },
  {
    code: 'brasilapi',
    url: cep => `https://brasilapi.com.br/api/cep/v2/${cep}`,
    parse(body, status) {
      // A BrasilAPI responde 404 tanto para CEP inexistente quanto quando as fontes dela caem.
      if (status === 404 && body?.type === 'service_error') return NOT_FOUND;
      return { logradouro: body?.street, bairro: body?.neighborhood, cidade: body?.city, estado: body?.state, ibge: body?.ibge?.city };
    },
  },
  {
    code: 'awesomeapi',
    url: cep => `https://cep.awesomeapi.com.br/json/${cep}`,
    parse(body, status) {
      if (status === 404 || body?.code === 'not_found') return NOT_FOUND;
      return { logradouro: body?.address, bairro: body?.district, cidade: body?.city, estado: body?.state, ibge: body?.city_ibge };
    },
  },
];

async function askProvider(provider, cep, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(provider.url(cep), { headers: { Accept: 'application/json' }, signal: controller.signal });
    let body = null;
    try { body = await response.json(); } catch { body = null; }
    const parsed = provider.parse(body, response.status);
    if (parsed === NOT_FOUND) return { status: 'not_found' };
    if (!response.ok) return { status: 'error' };
    const address = result(cep, parsed, provider.code);
    if (!address.cidade || !address.estado) return { status: 'not_found' };
    const expectedUf = ufForCep(cep);
    if (expectedUf && address.estado !== expectedUf) return { status: 'error' };
    return { status: 'found', address };
  } catch (error) {
    return { status: error?.name === 'AbortError' ? 'timeout' : 'error' };
  } finally {
    clearTimeout(timer);
  }
}

/** Primeira resposta válida entre as fontes, sem esperar as mais lentas. */
async function askAll(cep, providers, fetchImpl, timeoutMs) {
  const outcomes = [];
  return new Promise(resolve => {
    let pending = providers.length;
    if (!pending) resolve({ address: null, outcomes });
    for (const provider of providers) {
      askProvider(provider, cep, fetchImpl, timeoutMs).then(outcome => {
        outcomes.push({ provider: provider.code, ...outcome });
        if (outcome.status === 'found') resolve({ address: outcome.address, outcomes });
        pending -= 1;
        if (pending === 0) resolve({ address: null, outcomes });
      });
    }
  });
}

/**
 * store: { get(cep) → { address, updatedAt } | null, set(address) } — opcional.
 * Falhas do store nunca impedem a consulta.
 */
export function createPostalCodeLookup({ fetchImpl = (...args) => globalThis.fetch(...args), store = null, providers = POSTAL_PROVIDERS, timeoutMs = DEFAULT_TIMEOUT_MS, maxAgeDays = CACHE_MAX_AGE_DAYS, now = () => Date.now() } = {}) {
  return async function lookup(cep) {
    if (!CEP_PATTERN.test(String(cep || ''))) throw new CommerceError('CEP deve conter 8 dígitos', 'SHIPPING_CEP_INVALID');
    if (!ufForCep(cep)) throw new CommerceError('CEP não encontrado; confira os números', 'SHIPPING_CEP_NOT_FOUND');
    let cached = null;
    try { cached = store ? await store.get(cep) : null; } catch { cached = null; }
    const fresh = cached?.address && cached.updatedAt && (now() - new Date(cached.updatedAt).getTime()) < maxAgeDays * 86400000;
    if (fresh) return { ...cached.address, fonte: 'cache' };
    const { address, outcomes } = await askAll(cep, providers, fetchImpl, timeoutMs);
    if (address) {
      try { if (store) await store.set(address); } catch { /* cache é opcional */ }
      return address;
    }
    // Fontes fora do ar: um CEP já confirmado continua valendo, mesmo antigo.
    if (cached?.address) return { ...cached.address, fonte: 'cache' };
    // Duas fontes independentes dizendo que o CEP não existe bastam, mesmo com outra fora do ar.
    const notFoundCount = outcomes.filter(outcome => outcome.status === 'not_found').length;
    if (notFoundCount >= 2 || (notFoundCount > 0 && !outcomes.some(outcome => outcome.status === 'error' || outcome.status === 'timeout'))) {
      throw new CommerceError('CEP não encontrado; confira os números', 'SHIPPING_CEP_NOT_FOUND');
    }
    if (outcomes.some(outcome => outcome.status === 'not_found')) {
      // Parte das fontes não conhece o CEP e as demais falharam: não dá para afirmar que não existe.
      throw new CommerceError('não foi possível confirmar o CEP agora; tente novamente em instantes', 'SHIPPING_CEP_PROVIDER_ERROR');
    }
    if (outcomes.length && outcomes.every(outcome => outcome.status === 'timeout')) {
      throw new CommerceError('serviço de CEP não respondeu no prazo', 'SHIPPING_CEP_PROVIDER_TIMEOUT');
    }
    throw new CommerceError('não foi possível consultar o CEP', 'SHIPPING_CEP_PROVIDER_ERROR');
  };
}

/** Cache em PostgreSQL (tabela commerce_postal_codes, migration 067). */
export function createPostgresPostalStore(db) {
  return {
    async get(cep) {
      const found = await db.query(
        `SELECT cep, logradouro, complemento, bairro, cidade, estado, ibge, fonte, atualizado_em
           FROM commerce_postal_codes WHERE cep = $1 LIMIT 1`,
        [cep],
      );
      const row = found.rows?.[0];
      if (!row) return null;
      return { address: { cep: row.cep, logradouro: row.logradouro, complemento: row.complemento, bairro: row.bairro, cidade: row.cidade, estado: row.estado, ibge: row.ibge, fonte: row.fonte }, updatedAt: row.atualizado_em };
    },
    async set(address) {
      await db.query(
        `INSERT INTO commerce_postal_codes (cep, logradouro, complemento, bairro, cidade, estado, ibge, fonte, atualizado_em)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
         ON CONFLICT (cep) DO UPDATE SET
           logradouro = EXCLUDED.logradouro, complemento = EXCLUDED.complemento, bairro = EXCLUDED.bairro,
           cidade = EXCLUDED.cidade, estado = EXCLUDED.estado, ibge = EXCLUDED.ibge,
           fonte = EXCLUDED.fonte, atualizado_em = CURRENT_TIMESTAMP`,
        [address.cep, address.logradouro, address.complemento, address.bairro, address.cidade, address.estado, address.ibge, address.fonte],
      );
    },
  };
}
