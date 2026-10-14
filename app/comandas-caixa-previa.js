import crypto from 'node:crypto';

const MEIOS = new Set(['pix', 'dinheiro', 'cartao', 'credito', 'debito', 'transferencia', 'tef', 'carteira', 'conta']);
const UNIDADES = new Set(['un', 'g', 'ml', 'kg', 'l']);
const BASES = new Set(['bruto', 'liquido']);
const MAX_PARCELAS = 24;
const previewRegistry = new Map();

export class PreviewValidationError extends Error {
  constructor(message, code = 'PREVIEW_INVALID') {
    super(message);
    this.name = 'PreviewValidationError';
    this.code = code;
    this.status = 400;
  }
}

export class PreviewConflictError extends Error {
  constructor(message, code = 'PREVIEW_CONFLICT') {
    super(message);
    this.name = 'PreviewConflictError';
    this.code = code;
    this.status = 409;
  }
}

function text(value, limit = 180) {
  return String(value ?? '').trim().slice(0, limit);
}

function hasOwn(value, key) {
  return Boolean(value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key));
}

function number(value, fallback = NaN) {
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'object' || (typeof value === 'string' && !value.trim())) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value, field, places = 2) {
  const parsed = number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1000000000) throw new PreviewValidationError(`${field} deve ser um número maior ou igual a zero, dentro do limite da prévia.`, 'PREVIEW_NUMBER_INVALID');
  const rounded = round(parsed, places);
  if (parsed > 0 && rounded === 0) throw new PreviewValidationError(`${field} possui precisão menor que a suportada; não será convertido em zero.`, 'PREVIEW_PRECISION_INVALID');
  return rounded;
}

function optionalMoney(value, field, { absent = null, places = 2 } = {}) {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) return absent;
  return money(value, field, places);
}

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function rateKey(rate) {
  return [rate.meio, rate.bandeira || '*', rate.parcelas ?? '*', rate.base].join('|');
}

function materialKey(material) {
  return [material.servicoId, material.produtoId || '*', material.unidade].join('|');
}

function normalizeScope(value = {}) {
  const empresaId = text(value.empresaId ?? value.empresa_id, 120);
  const lojaId = text(value.lojaId ?? value.loja_id, 120);
  if (!empresaId) throw new PreviewValidationError('empresaId é obrigatório para a prévia.', 'EMPRESA_REQUIRED');
  if (!lojaId) throw new PreviewValidationError('lojaId é obrigatório para a prévia.', 'STORE_SELECTION_REQUIRED');
  return { empresaId, lojaId };
}

function normalizeRate(input = {}, index = 0) {
  const meio = text(input.meio ?? input.meioPagamento ?? input.meio_pagamento, 40).toLowerCase();
  if (!MEIOS.has(meio)) throw new PreviewValidationError(`Taxa ${index + 1}: meio de pagamento inválido.`, 'TAXA_MEIO_INVALIDO');
  const percentualRaw = input.percentual ?? input.percentualTaxa ?? input.percentual_taxa;
  const fixaRaw = input.fixa ?? input.valorFixo ?? input.valor_fixo;
  const informado = value => value !== undefined && value !== null && !(typeof value === 'string' && !value.trim());
  const percentualInformado = informado(percentualRaw);
  const fixaInformada = informado(fixaRaw);
  if (!percentualInformado && !fixaInformada) throw new PreviewValidationError(`Taxa ${index + 1}: informe percentual ou valor fixo; ausência não vira zero.`, 'TAXA_VALOR_REQUIRED');
  const percentual = percentualInformado ? money(percentualRaw, `Taxa ${index + 1}: percentual`, 6) : null;
  if (percentual !== null && percentual > 100) throw new PreviewValidationError(`Taxa ${index + 1}: percentual deve ficar entre 0 e 100%.`, 'TAXA_PERCENTUAL_INVALIDO');
  const fixa = fixaInformada ? money(fixaRaw, `Taxa ${index + 1}: fixa`) : null;
  const base = text(input.base ?? 'bruto', 20).toLowerCase();
  if (!BASES.has(base)) throw new PreviewValidationError(`Taxa ${index + 1}: base deve ser bruto ou liquido.`, 'TAXA_BASE_INVALIDA');
  const bandeira = text(input.bandeira ?? input.bandeiraCartao ?? input.bandeira_cartao, 50).toLowerCase();
  const parcelasRaw = input.parcelas ?? input.numeroParcelas ?? input.numero_parcelas;
  let parcelas = null;
  if (parcelasRaw !== undefined && parcelasRaw !== null && parcelasRaw !== '') {
    parcelas = number(parcelasRaw);
    if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > MAX_PARCELAS) throw new PreviewValidationError(`Taxa ${index + 1}: parcelas deve ser um inteiro entre 1 e ${MAX_PARCELAS}.`, 'TAXA_PARCELAS_INVALIDA');
  }
  const fonte = text(input.fonte ?? input.source ?? input.origem, 180);
  return { meio, bandeira: bandeira || null, parcelas, percentual, fixa, percentualInformado, fixaInformada, base, fonte: fonte || null };
}

function normalizeMaterial(input = {}, index = 0) {
  const servicoId = text(input.servicoId ?? input.servico_id, 120);
  if (!servicoId) throw new PreviewValidationError(`Material ${index + 1}: servicoId é obrigatório.`, 'MATERIAL_SERVICO_REQUIRED');
  const unidade = text(input.unidade ?? input.unidadeMedida ?? input.unidade_medida, 12).toLowerCase();
  if (!UNIDADES.has(unidade)) throw new PreviewValidationError(`Material ${index + 1}: unidade deve ser un, g, ml, kg ou l.`, 'MATERIAL_UNIDADE_INVALIDA');
  const quantidade = number(input.quantidade);
  if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 1000000000) throw new PreviewValidationError(`Material ${index + 1}: quantidade deve ser maior que zero e explícita.`, 'MATERIAL_QUANTIDADE_INVALIDA');
  if (round(quantidade, 6) <= 0) throw new PreviewValidationError('Quantidade menor que a precisão suportada.', 'MATERIAL_QUANTIDADE_INVALIDA');
  if (unidade === 'un' && !Number.isInteger(quantidade)) throw new PreviewValidationError(`Material ${index + 1}: quantidade em unidade deve ser inteira.`, 'MATERIAL_QUANTIDADE_INVALIDA');
  const hasCost = hasOwn(input, 'custoUnitario') || hasOwn(input, 'custo_unitario') || hasOwn(input, 'custo') || hasOwn(input, 'valor');
  const rawCost = input.custoUnitario ?? input.custo_unitario ?? input.custo ?? input.valor;
  const custoUnitario = hasCost ? optionalMoney(rawCost, `Material ${index + 1}: custo unitário`, { places: 6 }) : null;
  const unidadeReferencia = text(input.unidadeReferencia ?? input.unidade_referencia ?? unidade, 12).toLowerCase();
  const families = { un: ['count', 1], g: ['mass', 1], kg: ['mass', 1000], ml: ['volume', 1], l: ['volume', 1000] };
  if (!families[unidadeReferencia] || families[unidade][0] !== families[unidadeReferencia][0]) throw new PreviewValidationError('Unidades de consumo e de custo incompatíveis.', 'MATERIAL_CONVERSAO_INVALIDA');
  const fatorReferencia = families[unidade][1] / families[unidadeReferencia][1];
  return {
    servicoId,
    servicoNome: text(input.servicoNome ?? input.servico_nome, 160) || null,
    produtoId: text(input.produtoId ?? input.produto_id, 120) || null,
    produtoNome: text(input.produtoNome ?? input.produto_nome, 160) || null,
    quantidade: round(quantidade, 6),
    unidade,
    unidadeReferencia,
    fatorReferencia,
    custoUnitario,
    fonte: text(input.fonte ?? input.source ?? input.origem, 180) || null,
  };
}

function normalizeSimulation(input = {}, index = 0) {
  const id = text(input.id ?? input.linhaId ?? input.linha_id, 120) || `linha-${index + 1}`;
  const servicoId = text(input.servicoId ?? input.servico_id, 120);
  if (!servicoId) throw new PreviewValidationError(`Simulação ${index + 1}: servicoId é obrigatório.`, 'SIMULACAO_SERVICO_REQUIRED');
  if (!hasOwn(input, 'bruto') && !hasOwn(input, 'valorBruto') && !hasOwn(input, 'valor_bruto')) throw new PreviewValidationError(`Simulação ${index + 1}: bruto é obrigatório; zero explícito é permitido.`, 'SIMULACAO_BRUTO_REQUIRED');
  const bruto = money(input.bruto ?? input.valorBruto ?? input.valor_bruto, `Simulação ${index + 1}: bruto`);
  const meio = text(input.meio ?? input.meioPagamento ?? input.meio_pagamento, 40).toLowerCase();
  if (!MEIOS.has(meio)) throw new PreviewValidationError(`Simulação ${index + 1}: meio de pagamento inválido.`, 'SIMULACAO_MEIO_INVALIDO');
  const bandeira = text(input.bandeira ?? input.bandeiraCartao ?? input.bandeira_cartao, 50).toLowerCase() || null;
  const parcelasRaw = input.parcelas ?? input.numeroParcelas ?? input.numero_parcelas;
  let parcelas = null;
  if (parcelasRaw !== undefined && parcelasRaw !== null && parcelasRaw !== '') {
    parcelas = number(parcelasRaw);
    if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > MAX_PARCELAS) throw new PreviewValidationError(`Simulação ${index + 1}: parcelas deve ser um inteiro entre 1 e ${MAX_PARCELAS}.`, 'SIMULACAO_PARCELAS_INVALIDA');
  }
  const quantidade = input.quantidade === undefined || input.quantidade === null || input.quantidade === '' ? 1 : number(input.quantidade);
  if (!Number.isFinite(quantidade) || quantidade <= 0) throw new PreviewValidationError(`Simulação ${index + 1}: quantidade deve ser maior que zero.`, 'SIMULACAO_QUANTIDADE_INVALIDA');
  const comissaoPercentual = input.comissaoPercentual ?? input.comissao_percentual;
  if (comissaoPercentual !== undefined && comissaoPercentual !== null && comissaoPercentual !== '') {
    const n = money(comissaoPercentual, `Simulação ${index + 1}: comissão`);
    if (n > 100) throw new PreviewValidationError(`Simulação ${index + 1}: comissão deve ficar entre 0 e 100%.`, 'COMISSAO_PERCENTUAL_INVALIDO');
  }
  return {
    id,
    servicoId,
    servicoNome: text(input.servicoNome ?? input.servico_nome, 160) || null,
    bruto,
    meio,
    bandeira,
    parcelas,
    quantidade: round(quantidade, 6),
    comissaoPercentual: comissaoPercentual === undefined || comissaoPercentual === null || comissaoPercentual === '' ? null : Number(Number(comissaoPercentual).toFixed(2)),
  };
}

function normalizeCurrentRates(currentRates = {}) {
  if (Array.isArray(currentRates)) return currentRates.map((item, index) => normalizeRate(item, index));
  if (!currentRates || typeof currentRates !== 'object') return [];
  return Object.entries(currentRates).map(([meio, item], index) => normalizeRate({ ...(item || {}), meio: item?.meio || meio }, index));
}

function normalizeCurrentMaterials(currentMaterials = []) {
  return Array.isArray(currentMaterials) ? currentMaterials.map((item, index) => normalizeMaterial(item, index)) : [];
}

function baselinePart(context, key, fallback) {
  const part = context?.baseline?.[key];
  if (part?.status === 'bloqueado') {
    return {
      bloqueado: true,
      status: 'bloqueado',
      code: text(part.code, 120) || 'BASELINE_UNIT_SCOPE_UNVERIFIED',
      message: text(part.message, 300) || 'Comparativo unitário indisponível: o vínculo explícito com a unidade não foi comprovado.',
      value: null,
    };
  }
  return { bloqueado: false, status: 'disponivel', code: null, message: null, value: fallback };
}

function matchingRate(rates, line) {
  const candidates = rates.filter((rate) => rate.meio === line.meio && (!rate.bandeira || rate.bandeira === line.bandeira) && (rate.parcelas === null || rate.parcelas === line.parcelas));
  const specificity = rate => Number(Boolean(rate.bandeira)) + Number(rate.parcelas !== null);
  candidates.sort((a, b) => specificity(b) - specificity(a));
  if (candidates.length > 1 && specificity(candidates[0]) === specificity(candidates[1]) && rateKey(candidates[0]) !== rateKey(candidates[1])) throw new PreviewConflictError('Regras de taxa igualmente específicas exigem revisão.', 'TAXA_AMBIGUA');
  return candidates[0] || null;
}

function materialForLine(materials, line) {
  const matching = materials.filter((item) => item.servicoId === line.servicoId);
  if (!matching.length) return { value: null, status: 'pendente', items: [], reason: 'MATERIAL_NAO_INFORMADO' };
  if (matching.some((item) => item.custoUnitario === null)) return { value: null, status: 'pendente', items: matching, reason: 'MATERIAL_CUSTO_DESCONHECIDO' };
  return {
    value: money(matching.reduce((sum, item) => sum + item.custoUnitario * item.quantidade * item.fatorReferencia * line.quantidade, 0), 'Custo calculado de material'),
    status: 'calculado',
    items: matching,
    reason: null,
  };
}

function taxForLine(line, rule) {
  if (!rule) return { value: null, status: 'pendente', reason: 'TAXA_NAO_CONFIGURADA' };
  const fixed = rule.fixa ?? 0;
  const percentual = rule.percentual ?? 0;
  const value = rule.base === 'liquido'
    ? (line.bruto * percentual / 100 + fixed) / (1 + percentual / 100)
    : line.bruto * percentual / 100 + fixed;
  if (value > line.bruto) throw new PreviewValidationError('Taxa estimada excede o bruto; revise a regra, sem corte silencioso.', 'TAXA_EXCEDE_BRUTO');
  return { value: round(value), status: 'calculado', reason: null };
}

function compareRates(imported, current) {
  const divergencias = [];
  for (const rule of imported) {
    const currentRule = matchingRate(current, { meio: rule.meio, bandeira: rule.bandeira, parcelas: rule.parcelas });
    if (!currentRule) {
      divergencias.push({ tipo: 'TAXA_NOVA', chave: rateKey(rule), mensagem: 'Não há regra equivalente no cadastro atual; a prévia não aplica a alteração.' });
      continue;
    }
    if (JSON.stringify({ percentual: currentRule.percentual, fixa: currentRule.fixa, base: currentRule.base }) !== JSON.stringify({ percentual: rule.percentual, fixa: rule.fixa, base: rule.base })) {
      divergencias.push({ tipo: 'TAXA_DIVERGENTE', chave: rateKey(rule), mensagem: 'A regra importada difere da configuração atual; aprovação explícita seria necessária.' });
    }
  }
  return divergencias;
}

function compareMaterials(imported, current) {
  const divergencias = [];
  const byService = (items) => {
    const grouped = new Map();
    for (const item of items) {
      const group = grouped.get(item.servicoId) || { value: 0, unknown: false, units: [] };
      group.unknown ||= item.custoUnitario === null;
      if (item.custoUnitario !== null) group.value += item.custoUnitario * item.quantidade * item.fatorReferencia;
      group.units.push(`${item.produtoId || '*'}:${item.unidade}:${item.unidadeReferencia}:${item.quantidade}`);
      grouped.set(item.servicoId, group);
    }
    return grouped;
  };
  const importedByService = byService(imported);
  const currentByService = byService(current);
  for (const [servicoId, importedGroup] of importedByService) {
    const currentGroup = currentByService.get(servicoId);
    if (!currentGroup) {
      divergencias.push({ tipo: 'MATERIAL_NOVO', chave: servicoId, mensagem: 'Não há material equivalente no cadastro atual; a prévia não grava ficha técnica.' });
      continue;
    }
    const currentValue = currentGroup.unknown ? null : round(currentGroup.value);
    const importedValue = importedGroup.unknown ? null : round(importedGroup.value);
    if (currentValue !== importedValue || [...currentGroup.units].sort().join('|') !== [...importedGroup.units].sort().join('|')) {
      divergencias.push({ tipo: 'MATERIAL_DIVERGENTE', chave: servicoId, mensagem: 'Custo, quantidade ou unidade importada difere do cadastro atual.' });
    }
  }
  return divergencias;
}

function checkDuplicate(items, keyFn, label) {
  const seen = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) throw new PreviewConflictError(`${label} repetida; revise o lote para não contar o mesmo item duas vezes.`, 'PLAN_CONFLICT');
    seen.set(key, item);
  }
}

function sanitizeFiscal(input) {
  const hasCredentials = Boolean(input && typeof input === 'object' && (hasOwn(input, 'certificado') || hasOwn(input, 'certificadoA1') || hasOwn(input, 'senha') || hasOwn(input, 'password') || hasOwn(input, 'chavePrivada')));
  return { credenciaisRecebidas: hasCredentials, credenciaisImportaveis: false };
}

export function clearPreviewRegistry() {
  previewRegistry.clear();
}

export function previewTaxMaterialPlan(input = {}, context = {}) {
  const scope = normalizeScope(context);
  const requestedScope = {
    empresaId: text(input.empresaId ?? input.empresa_id, 120),
    lojaId: text(input.lojaId ?? input.loja_id, 120),
  };
  if (requestedScope.empresaId && requestedScope.empresaId !== scope.empresaId) throw new PreviewConflictError('A empresa selecionada não pertence ao escopo da sessão.', 'TENANT_SCOPE_MISMATCH');
  if (requestedScope.lojaId && requestedScope.lojaId !== scope.lojaId) throw new PreviewConflictError('A unidade selecionada não pertence ao escopo da sessão.', 'STORE_SCOPE_MISMATCH');
  const idempotencyKey = text(input.idempotencyKey ?? input.chaveIdempotencia ?? input.chave_idempotencia, 220);
  if (!idempotencyKey) throw new PreviewValidationError('idempotencyKey é obrigatório para a prévia.', 'IDEMPOTENCY_KEY_REQUIRED');
  for (const field of ['taxas', 'materiais', 'simulacoes']) {
    if (input[field] !== undefined && (!Array.isArray(input[field]) || input[field].length > 500)) throw new PreviewValidationError('A prévia aceita no máximo 500 linhas por categoria.', 'PREVIEW_SIZE_INVALID');
  }
  const taxas = (Array.isArray(input.taxas) ? input.taxas : []).map(normalizeRate);
  const materiais = (Array.isArray(input.materiais) ? input.materiais : []).map(normalizeMaterial);
  const simulacoes = (Array.isArray(input.simulacoes) ? input.simulacoes : []).map(normalizeSimulation);
  if (!simulacoes.length) throw new PreviewValidationError('Inclua ao menos uma linha de simulação.', 'SIMULACAO_REQUIRED');
  checkDuplicate(taxas, rateKey, 'Taxa');
  checkDuplicate(materiais, materialKey, 'Material');
  checkDuplicate(simulacoes, item => item.id, 'Simulação');
  if (context.validServiceIds) {
    const permitted = new Set(context.validServiceIds.map(String));
    if ([...materiais, ...simulacoes].some(item => !permitted.has(item.servicoId))) throw new PreviewConflictError('Serviço sem vínculo confirmado na empresa selecionada.', 'SERVICE_SCOPE_MISMATCH');
  }
  if (context.validProductIds) {
    const permitted = new Set(context.validProductIds.map(String));
    if (materiais.some(item => item.produtoId && !permitted.has(item.produtoId))) throw new PreviewConflictError('Material sem vínculo confirmado na empresa selecionada.', 'PRODUCT_SCOPE_MISMATCH');
  }
  const taxasBaseline = baselinePart(context, 'taxas', context.currentTaxas || {});
  const materiaisBaseline = baselinePart(context, 'materiais', context.currentMaterials || []);
  const normalized = { scope, taxas, materiais, simulacoes, fiscal: sanitizeFiscal(input.credenciaisFiscais ?? input.fiscal), descricao: text(input.descricao, 300) || null };
  const planHash = hash({
    ...normalized,
    baseline: {
      taxas: taxasBaseline.bloqueado ? { status: taxasBaseline.status, code: taxasBaseline.code } : taxasBaseline.value,
      materiais: materiaisBaseline.bloqueado ? { status: materiaisBaseline.status, code: materiaisBaseline.code } : materiaisBaseline.value,
    },
  });
  const registryKey = `${scope.empresaId}|${scope.lojaId}|${idempotencyKey}`;
  if (previewRegistry.size >= 500 && !previewRegistry.has(registryKey)) previewRegistry.delete(previewRegistry.keys().next().value);
  const previous = previewRegistry.get(registryKey);
  if (previous && previous !== planHash) throw new PreviewConflictError('A chave de idempotência já foi usada para outra prévia neste escopo.', 'PLAN_CONFLICT');

  const currentRates = taxasBaseline.bloqueado ? [] : normalizeCurrentRates(taxasBaseline.value);
  const currentMaterials = materiaisBaseline.bloqueado ? [] : normalizeCurrentMaterials(materiaisBaseline.value);
  const divergencias = [
    ...(taxasBaseline.bloqueado
      ? [{ tipo: 'BASELINE_UNIT_SCOPE_UNVERIFIED', chave: 'taxas', mensagem: taxasBaseline.message }]
      : compareRates(taxas, currentRates)),
    ...(materiaisBaseline.bloqueado
      ? [{ tipo: 'BASELINE_UNIT_SCOPE_UNVERIFIED', chave: 'materiais', mensagem: materiaisBaseline.message }]
      : compareMaterials(materiais, currentMaterials)),
  ];
  if (normalized.fiscal.credenciaisRecebidas) divergencias.push({ tipo: 'CREDENCIAL_FISCAL_IGNORADA', chave: 'fiscal', mensagem: 'Certificado, senha e chave privada não são importáveis nesta prévia.' });
  const linhas = simulacoes.map((line) => {
    const regra = matchingRate(taxas, line);
    const taxa = taxForLine(line, regra);
    const material = materialForLine(materiais, line);
    const liquido = taxa.value === null || material.value === null ? null : round(line.bruto - taxa.value - material.value);
    const baseComissao = liquido === null ? null : Math.max(0, liquido);
    const comissaoIndicativa = line.comissaoPercentual === null || baseComissao === null ? null : round(baseComissao * line.comissaoPercentual / 100);
    const linhaDivergencias = [];
    if (taxa.reason) linhaDivergencias.push({ tipo: taxa.reason, mensagem: 'Taxa permanece pendente; nenhuma taxa zero foi presumida.' });
    if (material.reason) linhaDivergencias.push({ tipo: material.reason, mensagem: 'Custo de material permanece pendente; não foi convertido em zero.' });
    if (regra?.fonte === null) linhaDivergencias.push({ tipo: 'TAXA_FONTE_AUSENTE', mensagem: 'A regra não informa contrato, extrato ou outra fonte verificável.' });
    return {
      ...line,
      taxa: taxa.value,
      material: material.value,
      liquido,
      baseComissao,
      comissaoIndicativa,
      regraTaxa: regra,
      materialItens: material.items,
      status: taxa.status === 'calculado' && material.status === 'calculado' ? 'calculado' : 'pendente',
      divergencias: linhaDivergencias,
      liquidado: false,
      conciliado: false,
      pagamentoCriado: false,
    };
  });
  const totais = {
    bruto: round(linhas.reduce((sum, item) => sum + item.bruto, 0)),
    taxa: linhas.every((item) => item.taxa !== null) ? round(linhas.reduce((sum, item) => sum + item.taxa, 0)) : null,
    material: linhas.every((item) => item.material !== null) ? round(linhas.reduce((sum, item) => sum + item.material, 0)) : null,
    liquido: linhas.every((item) => item.liquido !== null) ? round(linhas.reduce((sum, item) => sum + item.liquido, 0)) : null,
    comissaoIndicativa: linhas.every((item) => item.comissaoIndicativa !== null) ? round(linhas.reduce((sum, item) => sum + item.comissaoIndicativa, 0)) : null,
  };
  previewRegistry.set(registryKey, planHash);
  return {
    somenteLeitura: true,
    gravacaoAplicada: false,
    status: linhas.every((item) => item.status === 'calculado') && divergencias.length === 0 && !taxasBaseline.bloqueado && !materiaisBaseline.bloqueado ? 'calculado' : 'pendente_revisao',
    escopo: scope,
    idempotencyKey,
    planHash,
    idempotente: previous === planHash,
    linhas,
    totais,
    divergencias,
    comparativo: {
      status: taxasBaseline.bloqueado || materiaisBaseline.bloqueado ? 'parcial_bloqueado' : 'disponivel',
      taxasAtuais: taxasBaseline.bloqueado ? null : currentRates,
      materiaisAtuais: materiaisBaseline.bloqueado ? null : currentMaterials,
      baseline: {
        taxas: { status: taxasBaseline.status, code: taxasBaseline.code, message: taxasBaseline.message },
        materiais: { status: materiaisBaseline.status, code: materiaisBaseline.code, message: materiaisBaseline.message },
      },
    },
    fiscal: normalized.fiscal,
    avisos: ['Estimativa assistida; não representa liquidação, conciliação, cobrança, ledger, comanda, pagamento ou documento fiscal.', 'Comissões permanecem indicativas e não substituem a configuração ou apuração existente.'],
  };
}

export function buildCurrentMaterials({ servicos = [], produtos = [] } = {}) {
  const produtosById = new Map((Array.isArray(produtos) ? produtos : []).map((item) => [String(item.id), item]));
  return (Array.isArray(servicos) ? servicos : []).flatMap((servico) => {
    const consumo = Array.isArray(servico.consumoInterno) ? servico.consumoInterno : [];
    if (servico.custoMaterial !== undefined && servico.custoMaterial !== null) {
      return [{ servicoId: servico.id, servicoNome: servico.nome, quantidade: 1, unidade: 'un', custoUnitario: optionalMoney(servico.custoMaterial, 'custoMaterial') }];
    }
    return consumo.map((item) => {
      const produto = produtosById.get(String(item.produtoId));
      return {
        servicoId: servico.id,
        servicoNome: servico.nome,
        produtoId: item.produtoId,
        produtoNome: produto?.nome || null,
        quantidade: item.quantidade,
        unidade: item.unidade || produto?.unidade || 'un',
        unidadeReferencia: item.unidadeReferencia || item.unidade_referencia || produto?.unidade || item.unidade || 'un',
        custoUnitario: produto && hasOwn(produto, 'custoUnitario') ? produto.custoUnitario : null,
      };
    });
  });
}
