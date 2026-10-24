// KYTTO — Clientes, contas a receber, alertas e fechamento diário.
// Persistência JSON/GCS com segregação obrigatória por empresaId.

import { db, save as saveFn } from './db.js';

const EMPRESA_PADRAO_ID = 'emp-kytto-001';
const agora = () => new Date().toISOString();
const texto = (valor, limite = 160) => String(valor ?? '').trim().slice(0, limite);
const numero = (valor) => Number(valor ?? 0) || 0;
function hashEmpresa(empresaId) {
  return Array.from(String(empresaId || '')).reduce((hash, caractere) => (hash * 31 + caractere.charCodeAt(0)) % 1000000007, 7).toString(36);
}
const CANAIS_CONSENTIMENTO = Object.freeze(['whatsapp', 'email']);
const FINALIDADES_CONSENTIMENTO = Object.freeze(['atendimento', 'marketing']);

function consentimentosPadrao() {
  return Object.fromEntries(CANAIS_CONSENTIMENTO.map((canal) => [canal, Object.fromEntries(FINALIDADES_CONSENTIMENTO.map((finalidade) => [finalidade, { concedido: false, atualizadoEm: null, origem: null }]))]));
}

function garantirConsentimentos(cliente) {
  cliente.consentimentos ||= consentimentosPadrao();
  for (const canal of CANAIS_CONSENTIMENTO) {
    cliente.consentimentos[canal] ||= {};
    for (const finalidade of FINALIDADES_CONSENTIMENTO) {
      const atual = cliente.consentimentos[canal][finalidade];
      cliente.consentimentos[canal][finalidade] = typeof atual === 'object' && atual !== null
        ? { concedido: Boolean(atual.concedido), atualizadoEm: atual.atualizadoEm || null, origem: atual.origem || null }
        : { concedido: Boolean(atual), atualizadoEm: null, origem: null };
    }
  }
  cliente.consentimentoHistorico ||= [];
  return cliente;
}

// Data de nascimento: aceita AAAA-MM-DD, DD/MM/AAAA ou DD/MM (sem ano).
// Guarda `dataNascimento` (AAAA-MM-DD, vazio se o ano não for informado) e
// `aniversario` (MM-DD), que é o que as campanhas de aniversário usam.
export function normalizarNascimento(valor) {
  const bruto = String(valor ?? '').trim();
  if (!bruto) return { dataNascimento: '', aniversario: '' };
  let ano = ''; let mes = ''; let dia = '';
  let m = bruto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) [, ano, mes, dia] = m;
  else if ((m = bruto.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/))) { dia = m[1].padStart(2, '0'); mes = m[2].padStart(2, '0'); ano = m[3] || ''; }
  else throw new Error('Data de nascimento inválida. Use DD/MM/AAAA ou DD/MM.');
  const anoTeste = ano ? Number(ano) : 2000; // 2000 é bissexto: aceita 29/02 sem ano
  const data = new Date(Date.UTC(anoTeste, Number(mes) - 1, Number(dia)));
  if (data.getUTCMonth() !== Number(mes) - 1 || data.getUTCDate() !== Number(dia)) throw new Error('Data de nascimento inválida.');
  if (ano && (Number(ano) < 1900 || data > new Date())) throw new Error('Data de nascimento fora do intervalo aceito.');
  return { dataNascimento: ano ? `${ano}-${mes}-${dia}` : '', aniversario: `${mes}-${dia}` };
}

function camposNascimento(payload = {}, atual = {}) {
  const informado = ['dataNascimento', 'data_nascimento', 'aniversario'].find((chave) => Object.prototype.hasOwnProperty.call(payload, chave));
  if (!informado) return { dataNascimento: atual.dataNascimento || '', aniversario: atual.aniversario || '' };
  return normalizarNascimento(payload[informado]);
}

function normalizarCliente(payload = {}) {
  return {
    ...camposNascimento(payload),
    nome: texto(payload.nome, 120),
    tipo: ['pf', 'pj'].includes(String(payload.tipo || '').toLowerCase()) ? String(payload.tipo).toLowerCase() : 'pf',
    cpfCnpj: texto(payload.cpfCnpj ?? payload.cpf_cnpj, 20),
    email: texto(payload.email, 100).toLowerCase(),
    telefone: texto(payload.telefone, 30),
    endereco: texto(payload.endereco, 240),
    limiteCreditoMensal: Math.max(0, numero(payload.limiteCreditoMensal ?? payload.limite_credito)),
    diasVencimento: Math.max(1, Math.min(90, Math.floor(numero(payload.diasVencimento ?? payload.dias_pagamento ?? 30) || 30))),
    observacao: texto(payload.observacao, 300),
  };
}

function normalizarContaReceber(payload = {}) {
  const normalizarData = (valor) => {
    const data = new Date(valor);
    return Number.isNaN(data.valueOf()) ? agora() : data.toISOString();
  };
  return {
    clienteId: texto(payload.clienteId ?? payload.cliente_id, 80),
    mesaNumero: Math.max(0, Math.floor(numero(payload.mesaNumero ?? payload.mesa_numero))),
    descricao: texto(payload.descricao, 200),
    valor: Math.max(0, numero(payload.valor)),
    dataVencimento: normalizarData(payload.dataVencimento ?? payload.data_vencimento),
    dataPagamento: payload.dataPagamento ? normalizarData(payload.dataPagamento) : null,
    observacao: texto(payload.observacao, 300),
  };
}

function migrarEstruturaLegada(estado) {
  if (!estado.clientesKytto || typeof estado.clientesKytto !== 'object') {
    estado.clientesKytto = { empresas: {} };
  }
  const store = estado.clientesKytto;
  // A versão anterior possuía um único conjunto global. A migração idempotente o
  // associa à empresa padrão sem apagar ou misturar os registros existentes.
  if (!store.empresas || typeof store.empresas !== 'object') {
    const legado = {
      clientes: store.clientes || {},
      contasReceber: store.contasReceber || {},
      alertas: store.alertas || {},
      fechamentoDiario: store.fechamentoDiario || {},
    };
    store.empresas = { [EMPRESA_PADRAO_ID]: legado };
    delete store.clientes;
    delete store.contasReceber;
    delete store.alertas;
    delete store.fechamentoDiario;
  }

  // Algumas instalações podem ter recebido a estrutura intermediária antes do
  // campo empresaId existir. Completar esse campo torna a migração retroativa e
  // evita que registros legítimos desapareçam do filtro da empresa padrão.
  const legadoPadrao = store.empresas[EMPRESA_PADRAO_ID];
  if (legadoPadrao) {
    for (const tipo of ['clientes', 'contasReceber', 'alertas', 'fechamentoDiario']) {
      legadoPadrao[tipo] ||= {};
      for (const registro of Object.values(legadoPadrao[tipo])) {
        if (registro && !registro.empresaId) registro.empresaId = EMPRESA_PADRAO_ID;
      }
    }
  }
  return store;
}

// ── Relacionamento: família, preferências e redes sociais ──────────────────
// Só muda o que vier no corpo da requisição. Os perfis sociais são apenas
// links informados pela equipe: o sistema não lê nem coleta dados dessas redes.
const RELACOES_FAMILIA = Object.freeze(['conjuge', 'esposa', 'marido', 'namorada', 'namorado', 'filho', 'filha', 'enteado', 'enteada', 'pai', 'mae', 'irmao', 'irma', 'outro']);
const RELACOES_MENOR_POSSIVEL = new Set(['filho', 'filha', 'enteado', 'enteada']);
const CAMPOS_PREFERENCIA = Object.freeze(['corte', 'barba', 'bebida', 'perfumes', 'produtos', 'horario', 'atendimento', 'observacoes']);

function idFamiliar(item = {}, indice = 0) {
  const informado = texto(item.id, 60);
  return /^fam-[a-z0-9-]{4,56}$/.test(informado) ? informado : `fam-${Date.now().toString(36)}-${indice}`;
}

export function normalizarFamilia(lista) {
  if (lista === null || lista === undefined || lista === '') return [];
  if (!Array.isArray(lista)) throw new Error('A família deve ser uma lista de pessoas.');
  if (lista.length > 12) throw new Error('Cadastre no máximo 12 familiares por cliente.');
  return lista.map((item, indice) => {
    const nome = texto(item?.nome, 120);
    if (!nome) throw new Error('Informe o nome de cada familiar.');
    const relacao = String(item?.relacao || 'outro').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    if (!RELACOES_FAMILIA.includes(relacao)) throw new Error(`Parentesco inválido para ${nome}.`);
    const nascimento = item?.dataNascimento ? normalizarNascimento(item.dataNascimento) : { dataNascimento: '', aniversario: '' };
    return {
      id: idFamiliar(item, indice),
      relacao,
      nome,
      dataNascimento: nascimento.dataNascimento,
      aniversario: nascimento.aniversario,
      telefone: texto(item?.telefone, 30),
      clienteId: texto(item?.clienteId, 120) || null,
      observacao: texto(item?.observacao, 300),
    };
  });
}

export function normalizarPreferencias(valor) {
  const origem = valor && typeof valor === 'object' ? valor : {};
  const preferencias = {};
  for (const campo of CAMPOS_PREFERENCIA) preferencias[campo] = texto(origem[campo], campo === 'observacoes' ? 600 : 200);
  preferencias.profissionalPreferidoId = texto(origem.profissionalPreferidoId, 120) || null;
  const tags = Array.isArray(origem.tags) ? origem.tags : String(origem.tags || '').split(',');
  preferencias.tags = [...new Set(tags.map((tag) => texto(tag, 40)).filter(Boolean))].slice(0, 20);
  return preferencias;
}

// Instagram: aceita @usuario, usuario ou o link do perfil. Guarda só o usuário.
export function normalizarInstagram(valor) {
  const bruto = texto(valor, 200);
  if (!bruto) return '';
  const semUrl = bruto.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').split(/[/?#]/)[0];
  if (!/^[A-Za-z0-9._]{1,30}$/.test(semUrl)) throw new Error('Instagram inválido. Use @usuario ou o link do perfil.');
  return semUrl.toLowerCase();
}

// LinkedIn: aceita o link do perfil (linkedin.com/in/...) ou só o identificador.
export function normalizarLinkedin(valor) {
  const bruto = texto(valor, 300);
  if (!bruto) return '';
  const m = bruto.match(/^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(in|company)\/([A-Za-z0-9\-_%.]{2,100})\/?(?:[?#].*)?$/i);
  if (m) return `https://www.linkedin.com/${m[1].toLowerCase()}/${m[2]}`;
  if (/^[A-Za-z0-9\-_%.]{2,100}$/.test(bruto)) return `https://www.linkedin.com/in/${bruto}`;
  throw new Error('LinkedIn inválido. Use o link do perfil (linkedin.com/in/...).');
}

function camposRelacionamento(payload = {}, atual = {}) {
  const tem = (chave) => Object.prototype.hasOwnProperty.call(payload, chave);
  const resultado = {};
  if (tem('familia')) {
    resultado.familia = normalizarFamilia(payload.familia);
    // LGPD art. 14: dados de criança ou adolescente só com consentimento do responsável.
    const possivelMenor = resultado.familia.some((item) => RELACOES_MENOR_POSSIVEL.has(item.relacao));
    const consentido = payload.familiaConsentimento === true || (atual.familiaConsentimento?.concedido === true && !tem('familiaConsentimento'));
    if (possivelMenor && !consentido) throw new Error('Para cadastrar filhos ou enteados, confirme que o cliente (responsável) autorizou o registro.');
    if (tem('familiaConsentimento') || possivelMenor) {
      resultado.familiaConsentimento = payload.familiaConsentimento === true || consentido
        ? { concedido: true, registradoEm: atual.familiaConsentimento?.concedido ? atual.familiaConsentimento.registradoEm : agora(), origem: texto(payload.familiaConsentimentoOrigem, 60) || atual.familiaConsentimento?.origem || 'painel_barbearia' }
        : { concedido: false, registradoEm: agora(), origem: 'painel_barbearia' };
    }
  }
  if (tem('preferencias')) resultado.preferencias = normalizarPreferencias(payload.preferencias);
  if (tem('redesSociais') || tem('instagram') || tem('linkedin')) {
    const redes = payload.redesSociais && typeof payload.redesSociais === 'object' ? payload.redesSociais : {};
    const instagram = tem('instagram') ? payload.instagram : (Object.prototype.hasOwnProperty.call(redes, 'instagram') ? redes.instagram : atual.redesSociais?.instagram);
    const linkedin = tem('linkedin') ? payload.linkedin : (Object.prototype.hasOwnProperty.call(redes, 'linkedin') ? redes.linkedin : atual.redesSociais?.linkedin);
    resultado.redesSociais = { instagram: normalizarInstagram(instagram), linkedin: normalizarLinkedin(linkedin) };
  }
  return resultado;
}

export function clientesPersistidos(empresaId = EMPRESA_PADRAO_ID) {
  const estado = db();
  const store = migrarEstruturaLegada(estado);
  const chave = String(empresaId || EMPRESA_PADRAO_ID);
  store.empresas[chave] ||= { clientes: {}, contasReceber: {}, alertas: {}, fechamentoDiario: {} };
  const empresa = store.empresas[chave];
  empresa.clientes ||= {};
  empresa.contasReceber ||= {};
  empresa.alertas ||= {};
  empresa.fechamentoDiario ||= {};
  return empresa;
}

function clientePadrao(empresaId, id, dados = {}) {
  const ts = agora();
  return {
    id, empresaId, ...normalizarCliente(dados), status: 'ativo', saldoDevedor: 0,
    scoreCredito: 100, risco: 'baixo', consentimentos: consentimentosPadrao(), consentimentoHistorico: [], criadoEm: ts, atualizadoEm: ts,
  };
}

function contaPadrao(empresaId, id, dados = {}) {
  const ts = agora();
  const normalizado = normalizarContaReceber(dados);
  const diasAtraso = Math.floor((Date.now() - new Date(normalizado.dataVencimento).valueOf()) / 86400000);
  return {
    id, empresaId, ...normalizado,
    status: normalizado.dataPagamento ? 'paga' : diasAtraso > 0 ? 'atrasada' : 'pendente',
    diasAtraso: Math.max(0, diasAtraso), criadoEm: ts, atualizadoEm: ts,
  };
}

export function garantirClientePadrao(empresaId = EMPRESA_PADRAO_ID) {
  const store = clientesPersistidos(empresaId);
  const id = 'cli-padrao-balcao';
  if (!store.clientes[id]) {
    store.clientes[id] = { ...clientePadrao(empresaId, id, {
      nome: 'Cliente Balcão', tipo: 'pf', limiteCreditoMensal: 0, diasVencimento: 1,
      observacao: 'Conta padrão para atendimento eventual sem cadastro nominal.',
    }), padrao: true };
    saveFn();
  }
  return store.clientes[id];
}

export function criarCliente(empresaId, dados) {
  const store = clientesPersistidos(empresaId);
  const cliente = clientePadrao(empresaId, `cli-${hashEmpresa(empresaId)}-${Date.now().toString(36)}-${String(Object.keys(store.clientes).length + 1).padStart(3, '0')}`, dados);
  if (!cliente.nome) throw new Error('Nome do cliente é obrigatório.');
  Object.assign(cliente, camposRelacionamento(dados, {}));
  if (cliente.cpfCnpj && Object.values(store.clientes).some((item) => item.cpfCnpj === cliente.cpfCnpj && item.status !== 'deletado')) {
    throw new Error('Já existe cliente ativo com este CPF/CNPJ nesta empresa.');
  }
  store.clientes[cliente.id] = cliente;
  return cliente;
}

export function atualizarCliente(empresaId, clienteId, dados) {
  const cliente = clientesPersistidos(empresaId).clientes[clienteId];
  if (!cliente || cliente.empresaId !== empresaId) return null;
  // Nascimento só muda quando vier no corpo; senão preserva o que já existe.
  const relacionamento = camposRelacionamento(dados, cliente);
  Object.assign(cliente, normalizarCliente({ ...cliente, ...dados }), camposNascimento(dados, cliente), relacionamento, { atualizadoEm: agora() });
  garantirConsentimentos(cliente);
  return cliente;
}

export function atualizarConsentimentoCliente(empresaId, clienteId, dados = {}) {
  const cliente = clientesPersistidos(empresaId).clientes[clienteId];
  if (!cliente || cliente.empresaId !== String(empresaId)) return null;
  const canal = texto(dados.canal, 30).toLowerCase();
  const finalidade = texto(dados.finalidade, 40).toLowerCase();
  if (!CANAIS_CONSENTIMENTO.includes(canal) || !FINALIDADES_CONSENTIMENTO.includes(finalidade)) throw new Error('Canal ou finalidade de consentimento inválidos.');
  garantirConsentimentos(cliente);
  const concedido = Boolean(dados.concedido);
  const atualizadoEm = agora();
  const origem = texto(dados.origem || 'painel_barbearia', 80);
  cliente.consentimentos[canal][finalidade] = { concedido, atualizadoEm, origem };
  cliente.consentimentoHistorico.unshift({
    id: `cons-${Date.now().toString(36)}-${cliente.consentimentoHistorico.length + 1}`,
    canal, finalidade, concedido, origem,
    responsavel: texto(dados.responsavel, 120), registradoEm: atualizadoEm,
  });
  cliente.consentimentoHistorico = cliente.consentimentoHistorico.slice(0, 100);
  cliente.atualizadoEm = atualizadoEm;
  saveFn();
  return cliente;
}

export function listarClientes(empresaId) {
  garantirClientePadrao(empresaId);
  return Object.values(clientesPersistidos(empresaId).clientes)
    .filter((cliente) => cliente.status !== 'deletado' && cliente.empresaId === empresaId)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function obterCliente(empresaId, clienteId) {
  const cliente = clientesPersistidos(empresaId).clientes[clienteId];
  return cliente?.empresaId === empresaId ? garantirConsentimentos(cliente) : null;
}

export function obterSituacaoCredito(empresaId, clienteId, valorSolicitado = 0) {
  const cliente = obterCliente(empresaId, clienteId);
  if (!cliente || cliente.padrao) return null;
  const limite = Math.max(0, numero(cliente.limiteCreditoMensal));
  const saldoDevedor = Math.max(0, numero(cliente.saldoDevedor));
  const disponivel = Math.max(0, limite - saldoDevedor);
  const solicitado = Math.max(0, numero(valorSolicitado));
  const diasVencimento = Math.max(1, Math.min(90, Math.floor(numero(cliente.diasVencimento) || 30)));
  const vencimento = new Date();
  vencimento.setUTCDate(vencimento.getUTCDate() + diasVencimento);
  return {
    clienteId: cliente.id,
    limite: Number(limite.toFixed(2)),
    saldoDevedor: Number(saldoDevedor.toFixed(2)),
    disponivel: Number(disponivel.toFixed(2)),
    solicitado: Number(solicitado.toFixed(2)),
    diasVencimento,
    dataVencimento: vencimento.toISOString(),
    permitido: limite > 0 && solicitado > 0 && solicitado - disponivel <= 0.005,
  };
}

export function criarContaReceber(empresaId, dados) {
  const store = clientesPersistidos(empresaId);
  const cliente = obterCliente(empresaId, dados?.clienteId);
  if (!cliente) throw new Error('Cliente não encontrado no escopo da empresa ativa.');
  const credito = obterSituacaoCredito(empresaId, cliente.id, dados?.valor);
  if (!credito?.permitido) {
    if (!credito?.limite) throw new Error('O cliente não possui limite de crédito configurado para pagar na conta.');
    throw new Error(`Limite de crédito insuficiente. Disponível: R$ ${credito.disponivel.toFixed(2)}.`);
  }
  const conta = contaPadrao(empresaId, `ctr-${Date.now().toString(36)}-${String(Object.keys(store.contasReceber).length + 1).padStart(3, '0')}`, { ...dados, dataVencimento: dados?.dataVencimento || credito.dataVencimento });
  if (!conta.descricao || conta.valor <= 0) throw new Error('Descrição e valor positivo são obrigatórios.');
  store.contasReceber[conta.id] = conta;
  if (conta.status !== 'paga') cliente.saldoDevedor = Number(cliente.saldoDevedor || 0) + conta.valor;
  return conta;
}

export function atualizarContaReceber(empresaId, contaId, dados) {
  const store = clientesPersistidos(empresaId);
  const conta = store.contasReceber[contaId];
  if (!conta || conta.empresaId !== empresaId) return null;
  const clienteAnterior = obterCliente(empresaId, conta.clienteId);
  const saldoAntes = conta.status !== 'paga' ? Number(conta.valor || 0) : 0;
  const normalizada = normalizarContaReceber({ ...conta, ...dados });
  const clienteNovo = obterCliente(empresaId, normalizada.clienteId);
  if (!clienteNovo) throw new Error('Cliente não encontrado no escopo da empresa ativa.');
  Object.assign(conta, normalizada, { atualizadoEm: agora() });
  const diasAtraso = Math.floor((Date.now() - new Date(conta.dataVencimento).valueOf()) / 86400000);
  conta.status = conta.dataPagamento ? 'paga' : diasAtraso > 0 ? 'atrasada' : 'pendente';
  conta.diasAtraso = Math.max(0, diasAtraso);
  const saldoDepois = conta.status !== 'paga' ? Number(conta.valor || 0) : 0;
  if (clienteAnterior?.id === clienteNovo.id) {
    clienteNovo.saldoDevedor = Math.max(0, Number(clienteNovo.saldoDevedor || 0) - saldoAntes + saldoDepois);
  } else {
    if (clienteAnterior) clienteAnterior.saldoDevedor = Math.max(0, Number(clienteAnterior.saldoDevedor || 0) - saldoAntes);
    clienteNovo.saldoDevedor = Math.max(0, Number(clienteNovo.saldoDevedor || 0) + saldoDepois);
  }
  return conta;
}

export function listarContasReceber(empresaId, filtros = {}) {
  return Object.values(clientesPersistidos(empresaId).contasReceber)
    .filter((conta) => conta.empresaId === empresaId)
    .filter((conta) => !filtros.clienteId || conta.clienteId === filtros.clienteId)
    .filter((conta) => !filtros.status || conta.status === filtros.status)
    .sort((a, b) => new Date(a.dataVencimento) - new Date(b.dataVencimento));
}

export function verificarAlertasVencimento(empresaId) {
  const store = clientesPersistidos(empresaId);
  const ts = agora();
  const alertas = [];
  for (const conta of Object.values(store.contasReceber)) {
    if (conta.empresaId !== empresaId || conta.status === 'paga') continue;
    const diasAteVenc = Math.floor((new Date(conta.dataVencimento).valueOf() - Date.now()) / 86400000);
    const diasAtraso = Math.floor((Date.now() - new Date(conta.dataVencimento).valueOf()) / 86400000);
    if (diasAteVenc >= 0 && diasAteVenc <= 3) alertas.push({
      id: `alt-${conta.id}`, empresaId, tipo: 'vencimento_proximo', contaId: conta.id, clienteId: conta.clienteId,
      valor: conta.valor, dataVencimento: conta.dataVencimento, diasAteVenc,
      severidade: diasAteVenc === 0 ? 'critica' : 'alta', criadoEm: ts,
    });
    if (diasAtraso > 0) alertas.push({
      id: `alt-${conta.id}`, empresaId, tipo: 'vencimento_atrasado', contaId: conta.id, clienteId: conta.clienteId,
      valor: conta.valor, dataVencimento: conta.dataVencimento, diasAtraso,
      severidade: diasAtraso > 7 ? 'critica' : 'alta', criadoEm: ts,
    });
  }
  store.alertas = Object.fromEntries(alertas.map((alerta) => [alerta.contaId, alerta]));
  return alertas;
}

export function listarAlertas(empresaId) {
  return Object.values(clientesPersistidos(empresaId).alertas).filter((alerta) => alerta.empresaId === empresaId);
}

export function criarFechamentoDiario(empresaId, dados = {}) {
  const store = clientesPersistidos(empresaId);
  const dataFechamento = String(dados.dataFechamento || agora().slice(0, 10)).slice(0, 10);
  const contas = Object.values(store.contasReceber).filter((conta) => conta.empresaId === empresaId);
  const abertas = contas.filter((conta) => conta.status !== 'paga');
  const totalReceber = abertas.reduce((soma, conta) => soma + Number(conta.valor || 0), 0);
  const totalRecebido = contas.filter((conta) => conta.status === 'paga' && String(conta.dataPagamento || '').slice(0, 10) === dataFechamento).reduce((soma, conta) => soma + Number(conta.valor || 0), 0);
  const totalPendente = abertas.filter((conta) => conta.status === 'pendente').reduce((soma, conta) => soma + Number(conta.valor || 0), 0);
  const totalAtrasado = abertas.filter((conta) => conta.status === 'atrasada').reduce((soma, conta) => soma + Number(conta.valor || 0), 0);
  const fechamento = {
    id: `fec-${empresaId}-${dataFechamento}-${Date.now().toString(36)}`, empresaId, dataFechamento,
    totalClientes: Object.values(store.clientes).filter((cliente) => cliente.status !== 'deletado').length,
    totalContasReceber: contas.length, totalReceber, totalRecebido, totalPendente, totalAtrasado,
    alertas: Object.values(store.alertas).length, observacao: texto(dados.observacao, 300),
    responsavel: texto(dados.responsavel, 120) || 'admin@setpoint-ultra.local',
    origem: texto(dados.origem, 30) || 'manual', status: 'fechado', criadoEm: agora(),
  };
  store.fechamentoDiario[fechamento.id] = fechamento;
  return fechamento;
}

export function listarFechamentosDiarios(empresaId) {
  return Object.values(clientesPersistidos(empresaId).fechamentoDiario)
    .filter((fechamento) => fechamento.empresaId === empresaId)
    .sort((a, b) => new Date(b.dataFechamento) - new Date(a.dataFechamento));
}

export function obterFechamentoDiario(empresaId, dataFechamento) {
  return Object.values(clientesPersistidos(empresaId).fechamentoDiario)
    .find((fechamento) => fechamento.empresaId === empresaId && fechamento.dataFechamento === dataFechamento) || null;
}

export { saveFn as save };

export default {
  clientesPersistidos, garantirClientePadrao, criarCliente, atualizarCliente, atualizarConsentimentoCliente, listarClientes, obterCliente, obterSituacaoCredito,
  criarContaReceber, atualizarContaReceber, listarContasReceber, verificarAlertasVencimento,
  listarAlertas, criarFechamentoDiario, listarFechamentosDiarios, obterFechamentoDiario,
};
