import { sanitizeUntrustedBusinessText } from './whatsapp-ai-profile.js';

const clean = (value, limit = 240) => sanitizeUntrustedBusinessText(value, limit).replace(/[\r\n]+/g, ' ').trim();
const ATTRIBUTES = {
  marca: ['marca', 'brand'],
  concentracao: ['concentracao', 'concentração', 'concentration'],
  familiaOlfativa: ['familia_olfativa', 'família olfativa', 'familiaOlfativa'],
  apresentacao: ['apresentacao', 'apresentação', 'presentation'],
};

export function productDetails(product = {}, variant = {}) {
  const attrs = variant.atributos && typeof variant.atributos === 'object' ? variant.atributos : {};
  const details = {};
  for (const [field, keys] of Object.entries(ATTRIBUTES)) {
    const value = keys.map(key => attrs[key]).find(value => typeof value === 'string' && value.trim());
    if (value) details[field] = clean(value, 120);
  }
  // Só números cujo campo declara ml, ou textos que trazem explicitamente a unidade.
  const explicitMl = attrs.volume_ml ?? attrs.volumeMl ?? attrs.ml;
  const uniqueVolume = values => {
    const matches = values.filter(value => typeof value === 'string').flatMap(value => [...value.matchAll(/\b(?:\d+\s*[x×]\s*)?\d+(?:[.,]\d+)?\s*ml\b/gi)].map(match => match[0].toLowerCase().replace(/\s+/g, '').replace('×', 'x')));
    const unique = [...new Set(matches)];
    return unique.length === 1 ? unique[0].replace(/ml$/, ' ml') : '';
  };
  const volumeText = explicitMl != null && /^\d+(?:[.,]\d+)?$/.test(String(explicitMl)) && Number(String(explicitMl).replace(',', '.')) > 0
    ? `${explicitMl} ml` : uniqueVolume([attrs.volume, attrs.capacidade, attrs.apresentacao, variant.nome])
      || uniqueVolume([product.nome, product.descricao_curta, product.descricao]);
  if (volumeText) details.volume = clean(volumeText, 60);
  return details;
}

export function productCard(product, variant) {
  const info = variant.detalhes || {};
  const lines = [`*${clean(product.nome, 160)}*`];
  if (variant.nome && variant.nome !== product.nome) lines.push(clean(variant.nome, 160));
  lines.push(`Volume: ${info.volume || 'não informado no cadastro'}`);
  for (const [key, label] of [['marca', 'Marca'], ['concentracao', 'Concentração'], ['familiaOlfativa', 'Família olfativa'], ['apresentacao', 'Apresentação']]) {
    if (info[key]) lines.push(`${label}: ${clean(info[key], 120)}`);
  }
  lines.push(clean(product.descricao, 320) || 'Descrição ainda não cadastrada.');
  lines.push(`Preço: ${Number(variant.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
  lines.push(variant.sobEncomenda ? 'Sob encomenda — entrega em até 10 dias úteis.' : variant.estoque > 0 ? 'Em estoque — disponibilidade revalidada ao finalizar.' : 'Sob encomenda — entrega em até 10 dias úteis.');
  const photo = product.fotos?.[0];
  if (photo) lines.push('Foto do produto:', photo);
  else lines.push('Este produto ainda não tem foto cadastrada.');
  return lines.join('\n');
}
