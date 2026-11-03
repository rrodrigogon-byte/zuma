import { subscriptionCycle } from './core/subscription-calendar.js';
// ============================================================================
// CAPTAÇÃO E RETENÇÃO DA BARBEARIA (onda 1)
// Tudo aqui se apoia na MESMA agenda da barbearia (barbearia-erp-kytto.js),
// que é a usada pelo admin, pelo link público e agora pela IA do WhatsApp.
//
// - Autoatendimento: o cliente vê, remarca ou cancela com código + telefone,
//   respeitando a política de cancelamento configurada.
// - Lista de espera da agenda: sem horário no dia, o cliente entra na lista;
//   quando alguém cancela, quem está na lista para aquele dia é avisado.
// - Indicação: cada cliente tem um código; quando o indicado conclui o
//   primeiro atendimento, os dois ganham pontos de fidelidade.
// - Clube de assinatura: uso por ciclo, limite de sessões, pagamento do ciclo
//   e bloqueio de inadimplente; painel de saúde e candidatos ao clube.
// - Retorno previsto por cliente, ocupação da agenda e metas por profissional.
//
// Os dados novos ficam em db().barbeariaCaptacao[empresaId], sem alterar a
// estrutura da agenda, das comandas ou do financeiro.
// ============================================================================

import crypto from 'node:crypto';
import { db, save } from './db.js';
import * as barbearia from './barbearia-erp-kytto.js';
import * as clientesKytto from './clientes-contas-kytto.js';
import * as fidelidadeKytto from './canais-fidelidade-kytto.js';
import { telefoneChave } from './dino-clientes-vinculo.js';
import * as financeiroKytto from './financeiro-central-kytto.js';
import { profissionalKyttoDoAvec } from './dino-vinculos-avec.js';
import { DINO_COMMERCE_LOJA_ID, DINO_LEGACY_LOJA_ID } from './core/legacy-commerce-scope.js';

const DIA_MS = 24 * 60 * 60 * 1000;
const STATUS_ATIVOS = new Set(['agendado', 'confirmado']);
const STATUS_FINAIS_INVALIDOS = new Set(['cancelado', 'nao_compareceu']);
const PERIODOS = new Set(['manha', 'tarde', 'noite', 'qualquer']);

export class CaptacaoError extends Error {
  constructor(message, code = 'CAPTACAO_ERRO', status = 400) {
    super(message);
    this.name = 'CaptacaoError';
    this.code = code;
    this.status = status;
  }
}

function texto(valor, limite = 240) {
  return String(valor ?? '').trim().slice(0, limite);
}

function numero(valor, fallback = 0) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : fallback;
}

function dinheiro(valor) {
  return Number(Math.max(0, numero(valor)).toFixed(2));
}

function agoraMs(opcoes = {}) {
  const valor = opcoes.agora instanceof Date ? opcoes.agora.valueOf() : Number(opcoes.agora);
  return Number.isFinite(valor) && valor > 0 ? valor : Date.now();
}

function iso(ms) {
  return new Date(ms).toISOString();
}

function dataLocal(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: process.env.KYTTO_TIMEZONE || 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

function novoId(prefixo) {
  return `${prefixo}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function configuracaoPadrao() {
  return {
    pontosIndicador: 100,
    pontosIndicado: 50,
    carenciaInadimplenciaDias: 3,
    avisosListaEsperaPorVaga: 3,
    ttlOfertaListaEsperaMinutos: 15,
    pedirAvaliacaoAposMinutos: 0,
  };
}

function captacao(empresaId) {
  const raiz = db();
  raiz.barbeariaCaptacao ||= {};
  const chave = String(empresaId || '');
  raiz.barbeariaCaptacao[chave] ||= {};
  const estado = raiz.barbeariaCaptacao[chave];
  estado.listaEspera ||= {};
  estado.listaEsperaOfertas ||= {};
  estado.listaEsperaOfertaQuarentena ||= {};
  estado.indicacoes ||= {};
  estado.codigosIndicacao ||= {};
  estado.assinaturas ||= {};
  estado.metasProfissionais ||= {};
  estado.avaliacoes ||= {};
  estado.canais ||= {};
  // Descarta a configuração externa legada em memória; nunca a serve nem a usa
  // como destino do cliente. A próxima gravação legítima persiste a limpeza.
  const { googleReviewUrl: _legacyExternalReviewUrl, ...configuracaoInterna } = estado.configuracao || {};
  estado.configuracao = { ...configuracaoPadrao(), ...configuracaoInterna };
  return estado;
}

export function obterConfiguracaoCaptacao(empresaId) {
  return { ...captacao(empresaId).configuracao };
}

export function salvarConfiguracaoCaptacao(empresaId, dados = {}) {
  if (dados.googleReviewUrl) throw new CaptacaoError('Avaliações externas estão desativadas. Use o formulário interno.', 'EXTERNAL_REVIEW_DISABLED');
  const estado = captacao(empresaId);
  const atual = estado.configuracao;
  const inteiro = (valor, anterior, min, max) => Math.max(min, Math.min(max, Math.round(numero(valor, anterior))));
  estado.configuracao = {
    pontosIndicador: inteiro(dados.pontosIndicador, atual.pontosIndicador, 0, 100000),
    pontosIndicado: inteiro(dados.pontosIndicado, atual.pontosIndicado, 0, 100000),
    carenciaInadimplenciaDias: inteiro(dados.carenciaInadimplenciaDias, atual.carenciaInadimplenciaDias, 0, 60),
    avisosListaEsperaPorVaga: inteiro(dados.avisosListaEsperaPorVaga, atual.avisosListaEsperaPorVaga, 1, 20),
    pedirAvaliacaoAposMinutos: inteiro(dados.pedirAvaliacaoAposMinutos, atual.pedirAvaliacaoAposMinutos ?? 0, 0, 2880),
    atualizadoEm: new Date().toISOString(),
  };
  save();
  return { ...estado.configuracao };
}

function mapaPorId(lista) {
  return new Map(lista.map((item) => [item.id, item]));
}

function nomeCurto(nome) {
  return texto(nome, 160).split(/\s+/)[0] || 'Cliente';
}

function hojeLocal(opcoes = {}) {
  return dataLocal(agoraMs(opcoes));
}

/**
 * Registra o consentimento de WhatsApp para avisos do próprio atendimento
 * (confirmação, lembrete). Nunca reativa quem já revogou (respondeu SAIR):
 * um terceiro com o telefone de outra pessoa não pode religar os avisos.
 */
export function registrarConsentimentoAtendimento(empresaId, clienteId, origem) {
  if (!clienteId) return false;
  const cliente = clientesKytto.obterCliente(String(empresaId), String(clienteId));
  if (!cliente || cliente.padrao) return false;
  if (cliente.consentimentos?.whatsapp?.atendimento?.concedido === true) return true;
  const revogou = (cliente.consentimentoHistorico || []).some((item) => item.canal === 'whatsapp' && item.finalidade === 'atendimento' && item.concedido === false);
  if (revogou) return false;
  clientesKytto.atualizarConsentimentoCliente(String(empresaId), cliente.id, { canal: 'whatsapp', finalidade: 'atendimento', concedido: true, origem: texto(origem, 80) || 'agendamento' });
  return true;
}

// ---------------------------------------------------------------------------
// AUTOATENDIMENTO (código + telefone)
// ---------------------------------------------------------------------------

function politicaCancelamentoMs(empresaId) {
  const horas = Math.max(0, numero(barbearia.obterConfiguracao(empresaId).politicaCancelamentoHoras, 4));
  return horas * 60 * 60 * 1000;
}

function localizarPorCodigo(empresaId, codigo, telefone, lojaId) {
  const codigoNormalizado = texto(codigo, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const chave = telefoneChave(telefone);
  if (codigoNormalizado.length < 6 || !chave) throw new CaptacaoError('Informe o código do agendamento e o telefone usado na reserva.', 'DADOS_INVALIDOS');
  if (!lojaId) throw new CaptacaoError('Agendamento não encontrado. Confira o código e o telefone.', 'AGENDAMENTO_NAO_ENCONTRADO', 404);
  const agendamento = barbearia.listarAgendamentos(empresaId, {})
    .find((item) => String(item.lojaId || '') === String(lojaId) && String(item.codigoConfirmacao || '').toUpperCase() === codigoNormalizado && telefoneChave(item.clienteTelefone) === chave);
  // Mesma resposta para código errado e telefone errado: não confirma a existência do código.
  if (!agendamento) throw new CaptacaoError('Agendamento não encontrado. Confira o código e o telefone.', 'AGENDAMENTO_NAO_ENCONTRADO', 404);
  return agendamento;
}

function visaoPublicaAgendamento(empresaId, agendamento, opcoes = {}) {
  const servicos = mapaPorId(barbearia.listarServicos(empresaId, { incluirInativos: true }));
  const profissionais = mapaPorId(barbearia.listarProfissionais(empresaId, { incluirInativos: true }));
  const inicio = new Date(agendamento.dataHora).valueOf();
  const limite = inicio - politicaCancelamentoMs(empresaId);
  const dentroDoPrazo = agoraMs(opcoes) <= limite;
  const alteravel = STATUS_ATIVOS.has(agendamento.status) && dentroDoPrazo;
  const servico = servicos.get(agendamento.servicoId);
  const profissional = profissionais.get(agendamento.profissionalId);
  return {
    codigo: agendamento.codigoConfirmacao,
    status: agendamento.status,
    dataAgenda: agendamento.dataAgenda,
    horaLocal: agendamento.horaLocal,
    dataHora: agendamento.dataHora,
    servico: servico ? { id: servico.id, nome: servico.nome, duracaoMinutos: servico.duracaoMinutos, preco: Number(servico.preco || 0) } : null,
    profissional: profissional ? { id: profissional.id, nome: profissional.nome } : null,
    podeCancelar: alteravel,
    podeRemarcar: alteravel,
    limiteAlteracao: Number.isFinite(limite) ? iso(limite) : null,
    politicaCancelamentoHoras: Math.round(politicaCancelamentoMs(empresaId) / 3600000),
    motivoBloqueio: alteravel ? '' : (STATUS_ATIVOS.has(agendamento.status) ? 'fora_do_prazo' : 'status'),
  };
}

export function consultarAgendamentoCliente(empresaId, { codigo, telefone, lojaId } = {}, opcoes = {}) {
  return visaoPublicaAgendamento(empresaId, localizarPorCodigo(empresaId, codigo, telefone, lojaId), opcoes);
}

export function cancelarAgendamentoCliente(empresaId, { codigo, telefone, motivo, lojaId } = {}, opcoes = {}) {
  const agendamento = localizarPorCodigo(empresaId, codigo, telefone, lojaId);
  const visao = visaoPublicaAgendamento(empresaId, agendamento, opcoes);
  if (!visao.podeCancelar) {
    throw new CaptacaoError(
      visao.motivoBloqueio === 'fora_do_prazo'
        ? `Cancelamentos pelo site vão até ${visao.politicaCancelamentoHoras}h antes do horário. Fale com a barbearia pelo WhatsApp.`
        : 'Este agendamento não pode mais ser cancelado.',
      'CANCELAMENTO_FORA_DA_POLITICA',
      409,
    );
  }
  const atualizado = barbearia.alterarStatusAgendamento(empresaId, agendamento.id, 'cancelado', {
    observacoes: texto(`${agendamento.observacoes ? `${agendamento.observacoes} · ` : ''}Cancelado pelo cliente${motivo ? `: ${texto(motivo, 200)}` : ''}`, 600),
  });
  return { agendamento: atualizado, visao: visaoPublicaAgendamento(empresaId, atualizado, opcoes) };
}

export function remarcarAgendamentoCliente(empresaId, { codigo, telefone, data, horario, lojaId } = {}, opcoes = {}) {
  const agendamento = localizarPorCodigo(empresaId, codigo, telefone, lojaId);
  const visao = visaoPublicaAgendamento(empresaId, agendamento, opcoes);
  if (!visao.podeRemarcar) {
    throw new CaptacaoError(
      visao.motivoBloqueio === 'fora_do_prazo'
        ? `Remarcações pelo site vão até ${visao.politicaCancelamentoHoras}h antes do horário. Fale com a barbearia pelo WhatsApp.`
        : 'Este agendamento não pode mais ser remarcado.',
      'REMARCACAO_FORA_DA_POLITICA',
      409,
    );
  }
  const livre = barbearia.resolverProfissionalDisponivel(empresaId, {
    data,
    horario,
    servicoId: agendamento.servicoId,
    profissionalId: agendamento.profissionalId || 'qualquer',
    lojaId: agendamento.lojaId || lojaId,
  });
  const atualizado = barbearia.atualizarAgendamento(empresaId, agendamento.id, {
    dataHora: livre.dataHora,
    dataAgenda: livre.dataAgenda,
    horaLocal: livre.horaLocal,
    profissionalId: livre.profissional.id,
    origem: 'cliente_site',
  });
  return { agendamento: atualizado, anterior: agendamento, visao: visaoPublicaAgendamento(empresaId, atualizado, opcoes) };
}

// ---------------------------------------------------------------------------
// LISTA DE ESPERA DA AGENDA
// ---------------------------------------------------------------------------

const OFERTA_ATIVA = new Set(['offered', 'held', 'accepted', 'consumed']);
const OFERTA_EXPIRAVEL = new Set(['offered', 'held']);

function periodoDoHorario(hora) {
  const [h] = String(hora || '').split(':').map(Number);
  if (!Number.isFinite(h)) return 'qualquer';
  if (h < 12) return 'manha';
  if (h < 18) return 'tarde';
  return 'noite';
}

function hashHex(valor) {
  return crypto.createHash('sha256').update(String(valor)).digest('hex');
}

function slotLocalizado(slot = {}) {
  const dataHoraMs = new Date(slot.dataHora || '').valueOf();
  const dataAgenda = texto(slot.dataAgenda ?? slot.data, 10)
    || (Number.isFinite(dataHoraMs) ? dataLocal(dataHoraMs) : '');
  const horaLocal = texto(slot.horaLocal ?? slot.horario ?? slot.hora, 5)
    || (Number.isFinite(dataHoraMs) ? new Intl.DateTimeFormat('en-GB', { timeZone: process.env.KYTTO_TIMEZONE || 'America/Cuiaba', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(dataHoraMs)) : '');
  return {
    empresaId: texto(slot.empresaId, 120),
    lojaId: texto(slot.lojaId, 120),
    servicoId: texto(slot.servicoId ?? slot.serviceId, 100),
    profissionalId: texto(slot.profissionalId ?? slot.professionalId, 100) || 'qualquer',
    dataAgenda,
    horaLocal,
    duracaoMinutos: Math.max(1, numero(slot.duracaoMinutos ?? slot.durationMinutes, 30)),
  };
}

/** Fingerprint imutável do slot; não usa nome/telefone/status do cliente. */
export function fingerprintSlot(slot = {}) {
  const normalizado = slotLocalizado(slot);
  return hashHex([
    normalizado.empresaId,
    normalizado.lojaId,
    normalizado.servicoId,
    normalizado.profissionalId,
    normalizado.dataAgenda,
    normalizado.horaLocal,
    normalizado.duracaoMinutos,
  ].join('|'));
}

export function calcularFingerprintSlot(slot = {}) {
  return fingerprintSlot(slot);
}

function escopoEspera(empresaId, dados = {}, { quarentenar = false } = {}) {
  const empresa = texto(empresaId, 120);
  const loja = texto(dados.lojaId ?? dados.storeId, 120);
  const servico = texto(dados.servicoId ?? dados.servico_id ?? dados.serviceId, 100);
  if (!empresa || !loja || !servico) {
    if (quarentenar && empresa) {
      const estado = captacao(empresa);
      const legadoId = texto(dados.id ?? dados.waitlistId ?? `${dados.telefone || dados.clienteTelefone || 'sem-telefone'}:${dados.data || ''}`, 180);
      estado.listaEsperaOfertaQuarentena[legadoId] = {
        id: legadoId,
        empresaId: empresa,
        lojaId: null,
        legadoTipo: 'lista_espera',
        motivo: 'empresa_loja_servico_obrigatorios',
        payloadRestrito: { data: texto(dados.data, 10), servicoId: servico || null },
        status: 'quarantined',
        criadoEm: new Date().toISOString(),
      };
      save();
    }
    throw new CaptacaoError('empresaId, lojaId e servicoId são obrigatórios para a lista de espera.', 'LOJA_SERVICO_OBRIGATORIOS');
  }
  return { empresaId: empresa, lojaId: loja, servicoId: servico };
}

function avisoEnviado(item, agendamentoId) {
  return (item.avisos || []).some((aviso) => aviso.agendamentoId === agendamentoId && aviso.status === 'sent');
}

export function entrarListaEspera(empresaId, dados = {}, opcoes = {}) {
  const estado = captacao(empresaId);
  const nome = texto(dados.nome ?? dados.clienteNome, 160);
  const telefone = String(dados.telefone ?? dados.clienteTelefone ?? '').replace(/\D/g, '').slice(0, 13);
  const data = texto(dados.data, 10);
  const lojaId = texto(dados.lojaId ?? dados.storeId, 120);
  const servicoId = texto(dados.servicoId ?? dados.servico_id, 100);
  const profissionalId = texto(dados.profissionalId ?? dados.profissional_id, 100) || 'qualquer';
  const periodo = PERIODOS.has(String(dados.periodo)) ? String(dados.periodo) : 'qualquer';
  if (nome.length < 2) throw new CaptacaoError('Informe seu nome.', 'NOME_INVALIDO');
  if (!telefoneChave(telefone)) throw new CaptacaoError('Informe um telefone válido com DDD.', 'TELEFONE_INVALIDO');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new CaptacaoError('Informe a data desejada.', 'DATA_INVALIDA');
  if (data < hojeLocal(opcoes)) throw new CaptacaoError('A data desejada já passou.', 'DATA_PASSADA');
  const janelaDias = Math.max(1, numero(barbearia.obterConfiguracao(empresaId).janelaReservaDias, 60)) + 30;
  if (data > dataLocal(agoraMs(opcoes) + janelaDias * DIA_MS)) throw new CaptacaoError('Escolha uma data mais próxima para a lista de espera.', 'DATA_DISTANTE');
  const { empresaId: empresa, lojaId: loja, servicoId: servicoChave } = escopoEspera(empresaId, { lojaId, servicoId }, { quarentenar: true });
  const servico = barbearia.listarServicos(empresa).find((item) => item.id === servicoChave);
  if (!servico) throw new CaptacaoError('Serviço indisponível.', 'SERVICO_INVALIDO');
  expirarListaEspera(empresa, opcoes);
  const chave = telefoneChave(telefone);
  const repetida = Object.values(estado.listaEspera).find((item) => item.status === 'aguardando'
    && item.data === data && item.lojaId === loja && item.servicoId === servicoChave
    && (item.profissionalId || 'qualquer') === profissionalId && telefoneChave(item.telefone) === chave);
  if (repetida) return { ...repetida, repetida: true, avisos: [...(repetida.avisos || [])] };
  const ativasDoTelefone = Object.values(estado.listaEspera).filter((item) => item.status === 'aguardando'
    && item.lojaId === loja && item.servicoId === servicoChave && telefoneChave(item.telefone) === chave).length;
  if (ativasDoTelefone >= 3) throw new CaptacaoError('Este telefone já está na lista de espera de outros dias. Fale com a barbearia pelo WhatsApp.', 'LIMITE_LISTA_ESPERA');
  const id = novoId('espera');
  const registro = {
    id,
    empresaId: empresa,
    lojaId: loja,
    nome,
    telefone,
    data,
    periodo,
    servicoId: servicoChave,
    servicoNome: servico.nome,
    profissionalId,
    // Este fingerprint identifica a intenção da espera; cada vaga concreta tem
    // seu próprio slotFingerprint nos avisos/ofertas.
    fingerprint: fingerprintSlot({ empresaId: empresa, lojaId: loja, servicoId: servicoChave, profissionalId, dataAgenda: data, horaLocal: periodo }),
    consentimentoWhatsapp: dados.consentimentoWhatsapp === true,
    origem: texto(dados.origem, 40) || 'agendamento_online',
    status: 'aguardando',
    avisos: [],
    criadoEm: iso(agoraMs(opcoes)),
  };
  estado.listaEspera[id] = registro;
  save();
  return { ...registro, avisos: [] };
}

/** Entradas de dias que já passaram deixam de valer. */
export function expirarListaEspera(empresaId, opcoes = {}) {
  const estado = captacao(empresaId);
  const hoje = hojeLocal(opcoes);
  let mudou = false;
  for (const item of Object.values(estado.listaEspera)) {
    if (item.status === 'aguardando' && item.data < hoje) {
      item.status = 'expirado';
      item.atualizadoEm = iso(agoraMs(opcoes));
      mudou = true;
    }
  }
  if (mudou) save();
  return mudou;
}

/** Quem estava na lista e marcou horário naquele dia sai da lista. */
export function marcarListaEsperaAgendada(empresaId, dados = {}) {
  const estado = captacao(empresaId);
  const telefone = dados.telefone ?? dados.clienteTelefone;
  const data = texto(dados.data ?? dados.dataAgenda, 10);
  const lojaId = texto(dados.lojaId ?? dados.storeId, 120);
  const servicoId = texto(dados.servicoId ?? dados.serviceId, 100);
  const profissionalId = texto(dados.profissionalId ?? dados.professionalId, 100) || 'qualquer';
  const slotFingerprint = texto(dados.slotFingerprint ?? dados.fingerprint, 64).toLowerCase();
  if (!telefone || !data || !lojaId || !servicoId || !slotFingerprint) throw new CaptacaoError('lojaId, servicoId e fingerprint do slot são obrigatórios para marcar a espera.', 'LISTA_ESPERA_SLOT_OBRIGATORIO');
  const slotComDados = { empresaId, lojaId, servicoId, profissionalId, dataAgenda: data, horaLocal: dados.horaLocal ?? dados.horario, dataHora: dados.dataHora, duracaoMinutos: dados.duracaoMinutos };
  if (dados.dataHora || dados.horaLocal || dados.horario) {
    const esperado = fingerprintSlot(slotComDados);
    if (esperado !== slotFingerprint) throw new CaptacaoError('O fingerprint não corresponde ao slot informado.', 'SLOT_FINGERPRINT_CONFLICT', 409);
  }
  const chave = telefoneChave(telefone);
  if (!chave) return 0;
  let total = 0;
  for (const item of Object.values(estado.listaEspera)) {
    if (item.status === 'aguardando'
      && item.data === data
      && telefoneChave(item.telefone) === chave
      && item.lojaId === lojaId
      && item.servicoId === servicoId
      && ((!item.profissionalId || item.profissionalId === 'qualquer') || item.profissionalId === profissionalId)) {
      item.status = 'agendado';
      item.slotFingerprint = slotFingerprint;
      item.agendamentoId = texto(dados.agendamentoId, 120) || null;
      item.atualizadoEm = new Date().toISOString();
      total += 1;
    }
  }
  if (total) save();
  return total;
}

/** Cliente pediu SAIR: a lista de espera também para de avisá-lo. */
export function revogarAvisosListaEspera(empresaId, telefone) {
  const estado = captacao(empresaId);
  const chave = telefoneChave(telefone);
  if (!chave) return [];
  const ids = [];
  for (const item of Object.values(estado.listaEspera)) {
    if (telefoneChave(item.telefone) === chave && item.consentimentoWhatsapp === true) {
      item.consentimentoWhatsapp = false;
      item.atualizadoEm = new Date().toISOString();
      ids.push(item.id);
    }
  }
  if (ids.length) save();
  return ids;
}

export function listarListaEspera(empresaId, filtros = {}) {
  expirarListaEspera(empresaId);
  return Object.values(captacao(empresaId).listaEspera)
    .filter((item) => item.lojaId && (!filtros.lojaId || item.lojaId === String(filtros.lojaId)))
    .filter((item) => !filtros.data || item.data === String(filtros.data))
    .filter((item) => !filtros.servicoId || item.servicoId === String(filtros.servicoId))
    .filter((item) => !filtros.status || item.status === String(filtros.status))
    .sort((a, b) => a.data.localeCompare(b.data) || a.criadoEm.localeCompare(b.criadoEm))
    .map((item) => ({ ...item, avisos: [...(item.avisos || [])] }));
}

export function alterarStatusListaEspera(empresaId, id, status, lojaId = '') {
  const estado = captacao(empresaId);
  const registro = estado.listaEspera[String(id)];
  if (!registro || !registro.lojaId || (lojaId && registro.lojaId !== lojaId)) return null;
  if (!['aguardando', 'agendado', 'desistiu', 'expirado'].includes(String(status))) throw new CaptacaoError('Status inválido para a lista de espera.', 'STATUS_INVALIDO');
  registro.status = String(status);
  registro.atualizadoEm = new Date().toISOString();
  save();
  return { ...registro, avisos: [...(registro.avisos || [])] };
}

/** Uma vaga concreta só seleciona a mesma unidade, serviço e preferência de profissional. */
export function candidatosParaVaga(empresaId, agendamentoLiberado = {}, opcoes = {}) {
  const estado = captacao(empresaId);
  const data = String(agendamentoLiberado.dataAgenda || '').slice(0, 10);
  const inicio = new Date(agendamentoLiberado.dataHora).valueOf();
  if (!data || !Number.isFinite(inicio) || inicio <= agoraMs(opcoes)) return [];
  const periodo = periodoDoHorario(agendamentoLiberado.horaLocal);
  const limite = estado.configuracao.avisosListaEsperaPorVaga;
  const lojaId = texto(agendamentoLiberado.lojaId, 120);
  const servicoId = texto(agendamentoLiberado.servicoId, 100);
  if (!lojaId || !servicoId || !agendamentoLiberado.id || !periodo || (opcoes.lojaId && String(opcoes.lojaId) !== lojaId)) return [];
  const slotFingerprint = fingerprintSlot({ empresaId, ...agendamentoLiberado, lojaId, servicoId });
  return Object.values(estado.listaEspera)
    .filter((item) => item.status === 'aguardando' && item.data === data && item.lojaId === lojaId && item.servicoId === servicoId)
    .filter((item) => opcoes.incluirSemConsentimento === true || item.consentimentoWhatsapp === true)
    .filter((item) => item.periodo === 'qualquer' || item.periodo === periodo)
    .filter((item) => !item.profissionalId || item.profissionalId === 'qualquer' || item.profissionalId === agendamentoLiberado.profissionalId)
    // Um aviso queued/avisado não é prova de envio; só sent bloqueia nova seleção.
    .filter((item) => !avisoEnviado(item, agendamentoLiberado.id))
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
    .slice(0, limite)
    .map((item) => ({
      id: item.id,
      nome: item.nome,
      telefone: item.telefone,
      servicoId: item.servicoId,
      profissionalId: item.profissionalId || 'qualquer',
      consentimentoWhatsapp: item.consentimentoWhatsapp === true,
      lojaId,
      data,
      horaLocal: agendamentoLiberado.horaLocal,
      slotFingerprint,
      mensagem: `Olá, ${nomeCurto(item.nome)}! Abriu um horário em ${data.split('-').reverse().join('/')} às ${agendamentoLiberado.horaLocal}. Quer ficar com ele? Responda por aqui ou agende pelo link da barbearia. Para não receber avisos, responda SAIR.`,
    }));
}

function marcarAvisos(empresaId, agendamentoLiberado = {}, ids = [], opcoes = {}, status = 'queued') {
  const estado = captacao(empresaId);
  const lojaId = texto(opcoes.lojaId || agendamentoLiberado.lojaId, 120);
  const servicoId = texto(agendamentoLiberado.servicoId, 100);
  const profissionalId = texto(agendamentoLiberado.profissionalId, 100) || 'qualquer';
  const slotFingerprint = texto(opcoes.slotFingerprint || agendamentoLiberado.slotFingerprint, 64).toLowerCase() || fingerprintSlot({ empresaId, ...agendamentoLiberado, lojaId, servicoId });
  if (!lojaId || !servicoId || !agendamentoLiberado.id || !slotFingerprint) return 0;
  const registradoEm = iso(agoraMs(opcoes));
  let total = 0;
  for (const id of ids) {
    const item = estado.listaEspera[String(id)];
    if (!item || !item.lojaId || item.lojaId !== lojaId || item.servicoId !== servicoId
      || (item.profissionalId && item.profissionalId !== 'qualquer' && item.profissionalId !== profissionalId)) continue;
    item.avisos ||= [];
    const existente = item.avisos.find((aviso) => aviso.agendamentoId === agendamentoLiberado.id && aviso.slotFingerprint === slotFingerprint);
    if (existente) {
      if (status === 'sent' && existente.status !== 'sent') { existente.status = 'sent'; existente.enviadoEm = registradoEm; total += 1; }
      continue;
    }
    item.avisos.push({ agendamentoId: agendamentoLiberado.id, slotFingerprint, horaLocal: agendamentoLiberado.horaLocal, status, registradoEm, ...(status === 'sent' ? { enviadoEm: registradoEm } : {}) });
    item.ultimoAvisoEm = registradoEm;
    total += 1;
  }
  if (total) save();
  return total;
}

/** Compatibilidade legada: chamada direta representa aviso já confirmado. */
export function marcarAvisados(empresaId, agendamentoLiberado = {}, ids = [], opcoes = {}) {
  return marcarAvisos(empresaId, agendamentoLiberado, ids, opcoes, 'sent');
}

/** Fila aceita: persiste queued, mas não simula envio ao provedor. */
export function marcarAvisosEnfileirados(empresaId, agendamentoLiberado = {}, ids = [], opcoes = {}) {
  return marcarAvisos(empresaId, agendamentoLiberado, ids, opcoes, 'queued');
}

/** Confirmação do worker: somente aqui queued vira sent. */
export function marcarAvisoEnviado(empresaId, waitlistId, agendamentoLiberado = {}, opcoes = {}) {
  return marcarAvisos(empresaId, agendamentoLiberado, [waitlistId], opcoes, 'sent');
}

function ofertaCopia(oferta, extras = {}) {
  return { ...oferta, ...extras, eventos: [...(oferta.eventos || [])], agendaIntent: oferta.agendaIntent ? { ...oferta.agendaIntent } : null };
}

function ofertaConflito(mensagem, code = 'IDEMPOTENCY_CONFLICT') {
  return new CaptacaoError(mensagem, code, 409);
}

function ofertaEntrada(empresaId, dados) {
  const estado = captacao(empresaId);
  const waitlistId = texto(dados.waitlistId ?? dados.listaEsperaId ?? dados.entradaId ?? dados.candidato?.id, 120);
  const entrada = waitlistId ? estado.listaEspera[waitlistId] : null;
  if (!entrada) throw new CaptacaoError('Entrada da lista de espera não encontrada.', 'LISTA_ESPERA_NAO_ENCONTRADA', 404);
  const slot = dados.slot || dados.agendamento || dados.agendamentoLiberado || dados;
  const escopo = escopoEspera(empresaId, { lojaId: dados.lojaId ?? slot.lojaId, servicoId: dados.servicoId ?? dados.serviceId ?? slot.servicoId }, {});
  if (entrada.lojaId !== escopo.lojaId || entrada.servicoId !== escopo.servicoId) throw ofertaConflito('A oferta está fora do escopo da entrada da lista de espera.', 'LISTA_ESPERA_SCOPE_CONFLICT');
  const profissionalId = texto(dados.profissionalId ?? dados.professionalId ?? slot.profissionalId, 100) || 'qualquer';
  if (entrada.profissionalId && entrada.profissionalId !== 'qualquer' && entrada.profissionalId !== profissionalId) throw ofertaConflito('A preferência de profissional não coincide com a vaga.', 'PROFESSIONAL_SCOPE_CONFLICT');
  const dataAgenda = texto(dados.dataAgenda ?? dados.data ?? slot.dataAgenda ?? slot.data, 10);
  const horaLocal = texto(dados.horaLocal ?? dados.horario ?? slot.horaLocal ?? slot.horario, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAgenda) || !/^\d{2}:\d{2}$/.test(horaLocal)) throw new CaptacaoError('Data e horário do slot são obrigatórios para a oferta.', 'SLOT_INVALIDO');
  const dataHora = dados.dataHora ?? slot.dataHora ?? null;
  const duracaoMinutos = Math.max(1, numero(dados.duracaoMinutos ?? slot.duracaoMinutos, 30));
  const slotFingerprint = fingerprintSlot({ empresaId: escopo.empresaId, lojaId: escopo.lojaId, servicoId: escopo.servicoId, profissionalId, dataAgenda, horaLocal, dataHora, duracaoMinutos });
  const informado = texto(dados.slotFingerprint ?? dados.fingerprint ?? slot.slotFingerprint, 64).toLowerCase();
  if (informado && informado !== slotFingerprint) throw ofertaConflito('O fingerprint informado não corresponde ao slot.', 'SLOT_FINGERPRINT_CONFLICT');
  const slotMs = new Date(dataHora || `${dataAgenda}T${horaLocal}:00`).valueOf();
  if (Number.isFinite(slotMs) && slotMs <= Date.now() && !dados.permitirPassado) throw new CaptacaoError('Não é possível ofertar um slot passado.', 'SLOT_PASSADO', 409);
  return { estado, entrada, escopo, profissionalId, dataAgenda, horaLocal, dataHora, duracaoMinutos, slotFingerprint };
}

function acaoDados(dados = {}, prefixo, id) {
  const actionId = texto(dados.actionId ?? dados.action_id, 180) || `${prefixo}:${id}`;
  const idempotencyKey = texto(dados.idempotencyKey ?? dados.idempotency_key, 255) || actionId;
  return { actionId, idempotencyKey };
}

function acaoFingerprint(empresaId, oferta, acao, dados = {}) {
  return hashHex(JSON.stringify({ empresaId, ofertaId: oferta.id, slotFingerprint: oferta.slotFingerprint, actionId: acao.actionId, idempotencyKey: acao.idempotencyKey, motivo: texto(dados.motivo, 240) }));
}

function ofertaPorId(empresaId, referencia) {
  const estado = captacao(empresaId);
  const id = typeof referencia === 'string' ? referencia : referencia?.ofertaId ?? referencia?.id;
  const oferta = estado.listaEsperaOfertas[String(id || '')];
  if (!oferta) throw new CaptacaoError('Oferta da lista de espera não encontrada.', 'OFERTA_NAO_ENCONTRADA', 404);
  return { estado, oferta };
}

/** Cria uma oferta imutável de uma vaga concreta para uma entrada escopada. */
export function criarOfertaListaEspera(empresaId, dados = {}, opcoes = {}) {
  const normalizado = ofertaEntrada(empresaId, dados);
  const { estado, entrada, escopo, profissionalId, dataAgenda, horaLocal, dataHora, duracaoMinutos, slotFingerprint } = normalizado;
  const agora = agoraMs(opcoes);
  const acao = acaoDados({ ...opcoes, ...dados }, 'oferta', 'nova');
  const payload = acaoFingerprint(escopo.empresaId, { id: entrada.id, slotFingerprint }, acao, { motivo: dados.motivo });
  const porIdempotencia = Object.values(estado.listaEsperaOfertas).find((item) => item.idempotencyKey === acao.idempotencyKey);
  if (porIdempotencia) {
    if (porIdempotencia.payloadFingerprint !== payload) throw ofertaConflito('A idempotencyKey já foi usada para outra oferta.');
    return ofertaCopia(porIdempotencia, { replay: true });
  }
  const porAcao = Object.values(estado.listaEsperaOfertas).find((item) => item.actionId === acao.actionId);
  if (porAcao && porAcao.payloadFingerprint !== payload) throw ofertaConflito('O actionId já foi usado para outra oferta.');
  expirarOfertasListaEspera(escopo.empresaId, { agora });
  const mesmaVaga = Object.values(estado.listaEsperaOfertas).find((item) => item.slotFingerprint === slotFingerprint && OFERTA_ATIVA.has(item.status));
  if (mesmaVaga) throw ofertaConflito('Este slot já possui uma oferta ou reserva ativa.', 'SLOT_JA_OFERTADO');
  const ttlMs = Math.max(1000, numero(dados.ttlMs ?? dados.ttl ?? opcoes.ttlMs, Math.max(1, numero(estado.configuracao.ttlOfertaListaEsperaMinutos, 15)) * 60000));
  const expiresAt = iso(agora + ttlMs);
  const id = novoId('oferta');
  const oferta = {
    id,
    empresaId: escopo.empresaId,
    lojaId: escopo.lojaId,
    waitlistEntryId: entrada.id,
    customerId: texto(dados.customerId ?? dados.clienteId ?? entrada.clienteId, 120) || null,
    serviceId: escopo.servicoId,
    professionalId: profissionalId === 'qualquer' ? null : profissionalId,
    dataAgenda,
    horaLocal,
    dataHora,
    duracaoMinutos,
    slotFingerprint,
    fingerprint: slotFingerprint,
    actionId: acao.actionId,
    idempotencyKey: acao.idempotencyKey,
    payloadFingerprint: payload,
    status: 'offered',
    holdToken: null,
    expiresAt,
    criadoEm: iso(agora),
    atualizadoEm: iso(agora),
    eventos: [{ status: 'offered', actionId: acao.actionId, ocorridoEm: iso(agora) }],
    agendaIntent: null,
  };
  estado.listaEsperaOfertas[id] = oferta;
  save();
  return ofertaCopia(oferta);
}

/** Expira ofertas offered/held quando o relógio chega exatamente ao expiresAt. */
export function expirarOfertasListaEspera(empresaId, opcoes = {}) {
  const estado = captacao(empresaId);
  const agora = agoraMs(opcoes);
  const expiradas = [];
  for (const oferta of Object.values(estado.listaEsperaOfertas)) {
    if (OFERTA_EXPIRAVEL.has(oferta.status) && new Date(oferta.expiresAt).valueOf() <= agora) {
      oferta.status = 'expired';
      oferta.atualizadoEm = iso(agora);
      oferta.eventos ||= [];
      oferta.eventos.push({ status: 'expired', ocorridoEm: iso(agora) });
      expiradas.push(ofertaCopia(oferta));
    }
  }
  if (expiradas.length) save();
  return expiradas;
}

function aplicarAcaoOferta(empresaId, referencia, dados = {}, tipo) {
  const { estado, oferta } = ofertaPorId(empresaId, referencia);
  const acao = acaoDados({ ...(typeof referencia === 'object' ? referencia : {}), ...dados }, tipo, oferta.id);
  const agora = agoraMs(dados);
  expirarOfertasListaEspera(empresaId, { agora });
  const atual = estado.listaEsperaOfertas[oferta.id];
  const acaoExistente = (atual.eventos || []).find((evento) => evento.actionId === acao.actionId || evento.idempotencyKey === acao.idempotencyKey);
  const payload = acaoFingerprint(String(empresaId), atual, acao, dados);
  if (acaoExistente) {
    if (acaoExistente.payloadFingerprint && acaoExistente.payloadFingerprint !== payload) throw ofertaConflito('A ação já foi usada para outro payload.');
    if ((tipo === 'aceitar' && ['accepted', 'consumed'].includes(atual.status)) || (tipo === 'rejeitar' && atual.status === 'declined')) return ofertaCopia(atual, { replay: true });
  }
  if (tipo === 'aceitar') {
    if (atual.status === 'expired') throw new CaptacaoError('A oferta expirou.', 'OFERTA_EXPIRADA', 409);
    if (atual.status === 'declined' || atual.status === 'cancelled') throw new CaptacaoError('A oferta não está mais disponível.', 'OFERTA_INDISPONIVEL', 409);
    if (['accepted', 'consumed'].includes(atual.status)) throw ofertaConflito('Este slot já foi aceito por outro cliente.', 'SLOT_JA_ACEITO');
    const mesmaVagaAceita = Object.values(estado.listaEsperaOfertas).find((item) => item.id !== atual.id && item.slotFingerprint === atual.slotFingerprint && ['accepted', 'consumed'].includes(item.status));
    if (mesmaVagaAceita) throw ofertaConflito('Este slot já foi aceito por outro cliente.', 'SLOT_JA_ACEITO');
    const holdToken = hashHex(`hold:${empresaId}:${atual.id}:${acao.idempotencyKey}`).slice(0, 32);
    atual.status = 'accepted';
    atual.holdToken = holdToken;
    atual.acceptedAt = iso(agora);
    atual.acceptActionId = acao.actionId;
    atual.acceptIdempotencyKey = acao.idempotencyKey;
    atual.agendaIntent = {
      actionId: acao.actionId,
      idempotencyKey: acao.idempotencyKey,
      empresaId: atual.empresaId,
      lojaId: atual.lojaId,
      serviceId: atual.serviceId,
      professionalId: atual.professionalId || 'qualquer',
      customerId: atual.customerId,
      date: atual.dataAgenda,
      time: atual.horaLocal,
      slotFingerprint: atual.slotFingerprint,
      holdToken,
      criarAgendaTransacional: true,
    };
    atual.eventos ||= [];
    atual.eventos.push({ status: 'held', holdToken, actionId: acao.actionId, idempotencyKey: acao.idempotencyKey, ocorridoEm: iso(agora) });
    atual.eventos.push({ status: 'accepted', holdToken, actionId: acao.actionId, idempotencyKey: acao.idempotencyKey, payloadFingerprint: payload, ocorridoEm: iso(agora) });
  } else {
    if (atual.status === 'expired') throw new CaptacaoError('A oferta expirou.', 'OFERTA_EXPIRADA', 409);
    if (['accepted', 'consumed'].includes(atual.status)) throw new CaptacaoError('A oferta já foi aceita e não pode ser recusada.', 'OFERTA_JA_ACEITA', 409);
    if (atual.status === 'declined') return ofertaCopia(atual, { replay: true });
    atual.status = 'declined';
    atual.declinedAt = iso(agora);
    atual.declineActionId = acao.actionId;
    atual.eventos ||= [];
    atual.eventos.push({ status: 'declined', actionId: acao.actionId, idempotencyKey: acao.idempotencyKey, payloadFingerprint: payload, motivo: texto(dados.motivo, 240), ocorridoEm: iso(agora) });
  }
  atual.atualizadoEm = iso(agora);
  save();
  return ofertaCopia(atual);
}

export function aceitarOfertaListaEspera(empresaId, referencia, opcoes = {}) {
  return aplicarAcaoOferta(empresaId, referencia, opcoes, 'aceitar');
}

export function rejeitarOfertaListaEspera(empresaId, referencia, opcoes = {}) {
  return aplicarAcaoOferta(empresaId, referencia, opcoes, 'rejeitar');
}

/** Marca o aceite como consumido depois da criação transacional externa da agenda. */
export function consumirOfertaListaEspera(empresaId, referencia, opcoes = {}) {
  const { estado, oferta } = ofertaPorId(empresaId, referencia);
  const atual = estado.listaEsperaOfertas[oferta.id];
  const agora = agoraMs(opcoes);
  if (atual.status === 'consumed') return ofertaCopia(atual, { replay: true });
  if (atual.status !== 'accepted') throw new CaptacaoError('Somente uma oferta aceita pode ser consumida.', 'OFERTA_NAO_ACEITA', 409);
  if (opcoes.slotFingerprint && String(opcoes.slotFingerprint) !== atual.slotFingerprint) throw ofertaConflito('O slot mudou antes do consumo.', 'SLOT_FINGERPRINT_CONFLICT');
  atual.status = 'consumed';
  atual.consumedAt = iso(agora);
  atual.consumptionActionId = texto(opcoes.actionId ?? opcoes.action_id, 180) || `consumir:${atual.id}`;
  atual.eventos ||= [];
  atual.eventos.push({ status: 'consumed', actionId: atual.consumptionActionId, ocorridoEm: iso(agora) });
  atual.atualizadoEm = iso(agora);
  save();
  return ofertaCopia(atual);
}

// ---------------------------------------------------------------------------
// INDICAÇÃO
// ---------------------------------------------------------------------------

function codigoDeterministico(empresaId, clienteId) {
  return crypto.createHash('sha256').update(`indicacao:${empresaId}:${clienteId}`).digest('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 7).toUpperCase();
}

export function codigoIndicacaoCliente(empresaId, clienteId) {
  const estado = captacao(empresaId);
  const cliente = clientesKytto.obterCliente(String(empresaId), String(clienteId));
  if (!cliente || cliente.padrao) throw new CaptacaoError('Cliente não encontrado.', 'CLIENTE_NAO_ENCONTRADO', 404);
  const existente = Object.entries(estado.codigosIndicacao).find(([, id]) => id === cliente.id);
  if (existente) return { codigo: existente[0], clienteId: cliente.id, nome: cliente.nome };
  let codigo = codigoDeterministico(empresaId, cliente.id);
  for (let tentativa = 0; estado.codigosIndicacao[codigo] && tentativa < 20; tentativa += 1) codigo = crypto.randomBytes(4).toString('hex').slice(0, 7).toUpperCase();
  if (estado.codigosIndicacao[codigo]) throw new CaptacaoError('Não foi possível gerar o código agora. Tente de novo.', 'CODIGO_INDISPONIVEL', 409);
  estado.codigosIndicacao[codigo] = cliente.id;
  save();
  return { codigo, clienteId: cliente.id, nome: cliente.nome };
}

function clientePorCodigoIndicacao(empresaId, codigo) {
  const normalizado = texto(codigo, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalizado) return null;
  const clienteId = captacao(empresaId).codigosIndicacao[normalizado];
  const cliente = clienteId ? clientesKytto.obterCliente(String(empresaId), clienteId) : null;
  // Cliente excluído ou anonimizado (LGPD) não indica mais ninguém.
  return cliente && !cliente.anonimizadoEm && cliente.status !== 'deletado' && !cliente.padrao ? cliente : null;
}

/**
 * Liga um novo agendamento a quem indicou. Só conta indicação de cliente novo
 * (sem atendimento concluído antes) e nunca autoindicação.
 */
export function registrarIndicacao(empresaId, { codigo, agendamento } = {}) {
  if (!codigo || !agendamento?.id) return null;
  const estado = captacao(empresaId);
  const indicador = clientePorCodigoIndicacao(empresaId, codigo);
  if (!indicador) return null;
  const indicadoChave = telefoneChave(agendamento.clienteTelefone);
  if (!indicadoChave || telefoneChave(indicador.telefone) === indicadoChave) return null;
  const jaFoiCliente = barbearia.listarAgendamentos(empresaId, {})
    .some((item) => item.id !== agendamento.id && item.status === 'concluido' && telefoneChave(item.clienteTelefone) === indicadoChave);
  if (jaFoiCliente) return null;
  const repetida = Object.values(estado.indicacoes).find((item) => telefoneChave(item.indicadoTelefone) === indicadoChave);
  if (repetida) return { ...repetida, repetida: true };
  const id = novoId('ind');
  const registro = {
    id,
    indicadorClienteId: indicador.id,
    indicadorNome: indicador.nome,
    indicadoClienteId: agendamento.clienteId || '',
    indicadoNome: agendamento.clienteNome,
    indicadoTelefone: agendamento.clienteTelefone,
    agendamentoId: agendamento.id,
    codigo: texto(codigo, 12).toUpperCase(),
    status: 'pendente',
    criadoEm: new Date().toISOString(),
  };
  estado.indicacoes[id] = registro;
  save();
  return { ...registro };
}

/**
 * Chamado quando um atendimento é concluído. Se for o primeiro atendimento de
 * alguém indicado, credita os pontos dos dois (idempotente).
 */
export function processarConclusaoIndicacao(empresaId, agendamento = {}) {
  if (agendamento.status !== 'concluido') return null;
  const estado = captacao(empresaId);
  const chave = telefoneChave(agendamento.clienteTelefone);
  const indicacao = Object.values(estado.indicacoes).find((item) => item.status === 'pendente' && (item.agendamentoId === agendamento.id || (chave && telefoneChave(item.indicadoTelefone) === chave)));
  if (!indicacao) return null;
  const { pontosIndicador, pontosIndicado } = estado.configuracao;
  const indicador = clientesKytto.obterCliente(String(empresaId), indicacao.indicadorClienteId);
  const indicadoId = agendamento.clienteId || indicacao.indicadoClienteId;
  const indicado = indicadoId ? clientesKytto.obterCliente(String(empresaId), indicadoId) : null;
  const contextoPonteFidelidade = {
    legacyMigration: true,
    lojaId: agendamento.lojaId,
    bridge: 'legacy-loyalty-bridge',
  };
  const creditoIndicador = indicador ? fidelidadeKytto.creditarPontosBonus(String(empresaId), indicador.id, pontosIndicador, 'indicacao', { ...contextoPonteFidelidade, nome: indicador.nome, telefone: indicador.telefone, chaveIdempotencia: `indicacao:${indicacao.id}:indicador` }) : null;
  const creditoIndicado = indicado ? fidelidadeKytto.creditarPontosBonus(String(empresaId), indicado.id, pontosIndicado, 'indicado', { ...contextoPonteFidelidade, nome: indicado.nome, telefone: indicado.telefone, chaveIdempotencia: `indicacao:${indicacao.id}:indicado` }) : null;
  if (!creditoIndicador) {
    // Programa de fidelidade inativo (ou indicador inativo): a indicação fica
    // pendente para ser recompensada quando o programa voltar.
    indicacao.aguardandoFidelidade = true;
    indicacao.atualizadoEm = new Date().toISOString();
    save();
    return { ...indicacao };
  }
  indicacao.aguardandoFidelidade = false;
  indicacao.status = 'recompensada';
  indicacao.indicadoClienteId = indicadoId || indicacao.indicadoClienteId;
  indicacao.concluidaEm = new Date().toISOString();
  indicacao.pontosIndicador = creditoIndicador?.pontosCreditados ?? 0;
  indicacao.pontosIndicado = creditoIndicado?.pontosCreditados ?? 0;
  save();
  return { ...indicacao };
}

export function painelIndicacoes(empresaId) {
  const estado = captacao(empresaId);
  const lista = Object.values(estado.indicacoes).sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
  const porIndicador = new Map();
  for (const item of lista) {
    const atual = porIndicador.get(item.indicadorClienteId) || { clienteId: item.indicadorClienteId, nome: item.indicadorNome, indicacoes: 0, convertidas: 0, pontos: 0 };
    atual.indicacoes += 1;
    if (item.status === 'recompensada') {
      atual.convertidas += 1;
      atual.pontos += Number(item.pontosIndicador || 0);
    }
    porIndicador.set(item.indicadorClienteId, atual);
  }
  return {
    configuracao: { pontosIndicador: estado.configuracao.pontosIndicador, pontosIndicado: estado.configuracao.pontosIndicado },
    total: lista.length,
    convertidas: lista.filter((item) => item.status === 'recompensada').length,
    ranking: [...porIndicador.values()].sort((a, b) => b.convertidas - a.convertidas || b.indicacoes - a.indicacoes).slice(0, 20),
    recentes: lista.slice(0, 30).map((item) => ({ ...item, indicadoTelefone: undefined })),
  };
}

// ---------------------------------------------------------------------------
// CLUBE DE ASSINATURA: ciclo, uso, pagamento e saúde
// ---------------------------------------------------------------------------

function controleAssinatura(empresaId, assinaturaId) {
  const estado = captacao(empresaId);
  estado.assinaturas[assinaturaId] ||= { usos: [], pagamentos: [], pagoAte: null };
  const controle = estado.assinaturas[assinaturaId];
  controle.usos ||= [];
  controle.pagamentos ||= [];
  return controle;
}

function cicloAtual(assinatura, plano, ms) { return subscriptionCycle(assinatura,plano,ms); }

/**
 * Até quando a assinatura está paga. Sem pagamento registrado vale o 1º ciclo
 * quando a ativação confirmou o pagamento; senão, nada está pago ainda.
 */
function pagoAteMs(assinatura, plano, controle) {
  if (controle.pagoAte) return new Date(controle.pagoAte).valueOf();
  const inicio = new Date(assinatura.inicio).valueOf();
  if (!Number.isFinite(inicio)) return null;
  return assinatura.pagamentoConfirmado ? cicloAtual(assinatura,plano,inicio).fim : null;
}

function situacaoPagamento(empresaId, assinatura, plano, controle, ms) {
  if (assinatura.status !== 'ativa') return assinatura.status;
  if (ms < new Date(assinatura.inicio).valueOf()) return 'aguardando_inicio';
  if (assinatura.fim && ms >= new Date(assinatura.fim).valueOf()) return 'encerrada';
  const carencia = plano?.regraRenovacao === 'aniversario' ? 0 : captacao(empresaId).configuracao.carenciaInadimplenciaDias * DIA_MS;
  const pagoAte = pagoAteMs(assinatura, plano, controle);
  if (pagoAte === null) return 'aguardando_pagamento';
  return (plano?.regraRenovacao === 'aniversario' ? ms < pagoAte : ms <= pagoAte + carencia) ? 'em_dia' : 'inadimplente';
}

/** Usos e pagamentos completos de uma assinatura (base da comissão sobre plano). */
export function movimentosAssinatura(empresaId, assinaturaId) {
  const controle = controleAssinatura(empresaId, String(assinaturaId));
  return { usos: controle.usos.map((uso) => ({ ...uso })), pagamentos: controle.pagamentos.map((pag) => ({ ...pag })) };
}

export function resumoAssinatura(empresaId, assinaturaId, opcoes = {}) {
  const assinatura = barbearia.listarAssinaturas(empresaId).find((item) => item.id === String(assinaturaId));
  if (!assinatura) return null;
  const catalogo = barbearia.listarPlanos(empresaId, { incluirInativos: true }).find((item) => item.id === assinatura.planoId) || null;
  const plano = assinatura.condicoesContratadas ? {...catalogo,...assinatura.condicoesContratadas} : catalogo;
  const controle = controleAssinatura(empresaId, assinatura.id);
  const ms = agoraMs(opcoes);
  const ciclo = cicloAtual(assinatura, plano, ms);
  const usosCiclo = controle.usos.filter((uso) => uso.ciclo === ciclo.indice);
  const limite = Math.max(0, numero(assinatura.sessoesContratadas || plano?.sessoesIncluidas, 0));
  return {
    assinatura,
    plano,
    ciclo: { indice: ciclo.indice, inicio: iso(ciclo.inicio), fim: iso(ciclo.fim) },
    usosNoCiclo: usosCiclo.length,
    usosDoCiclo: usosCiclo.map(uso=>({...uso})),
    limiteNoCiclo: limite,
    sessoesRestantes: Math.max(0, limite - usosCiclo.length),
    situacaoPagamento: situacaoPagamento(empresaId, assinatura, plano, controle, ms),
    pagoAte: Number.isFinite(pagoAteMs(assinatura, plano, controle)) ? iso(pagoAteMs(assinatura, plano, controle)) : null,
    usos: controle.usos.slice(-20),
    pagamentos: controle.pagamentos.slice(-12),
  };
}

export function registrarPagamentoAssinatura(empresaId, assinaturaId, dados = {}, opcoes = {}) {
  const resumo = resumoAssinatura(empresaId, assinaturaId, opcoes);
  if (!resumo) throw new CaptacaoError('Assinatura não encontrada.', 'ASSINATURA_NAO_ENCONTRADA', 404);
  if (!['ativa', 'pausada'].includes(resumo.assinatura.status)) throw new CaptacaoError('Só assinaturas ativas ou pausadas recebem pagamento.', 'ASSINATURA_INATIVA', 409);
  const valor = dinheiro(dados.valor ?? resumo.plano?.preco);
  if (valor <= 0) throw new CaptacaoError('Informe o valor pago.', 'VALOR_INVALIDO');
  const controle = controleAssinatura(empresaId, resumo.assinatura.id);
  const dias = Math.max(1, numero(resumo.plano?.validadeDias, 30));
  // Cada pagamento cobre o próximo período a partir do que já estava pago
  // (ou do início da assinatura), nunca a partir de "agora": pagar atrasado
  // quita o ciclo devido, sem deslocar o calendário do plano.
  const pagoAtual = pagoAteMs(resumo.assinatura, resumo.plano, controle);
  const base = pagoAtual ?? new Date(resumo.assinatura.inicio).valueOf();
  // Sem referência informada, a referência é o período que está sendo pago:
  // duplo clique ou dois atendentes registrando juntos não pagam duas vezes.
  const referencia = texto(dados.referencia, 120) || `${resumo.assinatura.id}:ate:${iso(base).slice(0, 10)}`;
  const repetido = controle.pagamentos.find((item) => item.referencia === referencia);
  if (repetido) return { ...resumoAssinatura(empresaId, assinaturaId, opcoes), repetido: true };
  if (dados.periodoInicio && new Date(dados.periodoInicio).valueOf() !== base) throw new CaptacaoError('O ciclo já foi atualizado. Recarregue antes de registrar outro pagamento.', 'CICLO_ATUALIZADO', 409);
  controle.pagoAte = iso(resumo.plano?.regraRenovacao === 'aniversario' ? cicloAtual(resumo.assinatura,resumo.plano,base).fim : base + dias * DIA_MS);
  controle.pagamentos.push({ id: novoId('asspag'), valor, meio: texto(dados.meio, 40) || 'pix', referencia, periodoAte: controle.pagoAte, registradoEm: iso(agoraMs(opcoes)), responsavel: texto(dados.usuario, 120) || null });
  controle.pagamentos = controle.pagamentos.slice(-120);
  save();
  return resumoAssinatura(empresaId, assinaturaId, opcoes);
}

/** Assinatura ativa e em dia que cobre o serviço, para o cliente informado. */
export function assinaturaQueCobre(empresaId, { clienteId, clienteTelefone, servicoId, profissionalId } = {}, opcoes = {}) {
  const chave = telefoneChave(clienteTelefone);
  const clientes = clienteId ? null : (chave ? clientesKytto.listarClientes(String(empresaId)).filter((item) => telefoneChave(item.telefone) === chave).map((item) => item.id) : []);
  if (!clienteId && clientes.length !== 1) return null;
  const candidatas = barbearia.listarAssinaturas(empresaId, { status: 'ativa' })
    .filter((item) => (clienteId ? item.clienteId === String(clienteId) : clientes.includes(item.clienteId)))
    .filter((assinatura) => {
      if (!profissionalId) return true;
      const profId = String(profissionalId);
      if (assinatura.profissionalId && String(assinatura.profissionalId) !== profId) return false;
      const plano = barbearia.obterPlano(empresaId, assinatura.planoId) || assinatura.condicoesContratadas;
      if (plano?.profissionalId && String(plano.profissionalId) !== profId) return false;
      if (plano?.profissionaisIds?.length && !plano.profissionaisIds.includes(profId)) return false;
      return true;
    });
  const resumos = candidatas.map((assinatura) => resumoAssinatura(empresaId, assinatura.id, opcoes)).filter((resumo) => {
    const servicos = resumo.plano?.servicosIds || [];
    return !servicos.length || servicos.includes(String(servicoId));
  });
  return resumos.find((r) => r.situacaoPagamento === 'em_dia' && r.sessoesRestantes > 0) || resumos[0] || null;
}

export function registrarUsoAssinatura(empresaId, assinaturaId, dados = {}, opcoes = {}) {
  const resumo = resumoAssinatura(empresaId, assinaturaId, opcoes);
  if (!resumo) throw new CaptacaoError('Assinatura não encontrada.', 'ASSINATURA_NAO_ENCONTRADA', 404);
  if (resumo.assinatura.status !== 'ativa') throw new CaptacaoError('A assinatura não está ativa.', 'ASSINATURA_INATIVA', 409);
  if (resumo.situacaoPagamento === 'inadimplente') throw new CaptacaoError('Assinatura com pagamento em atraso: regularize antes de usar o plano.', 'ASSINATURA_INADIMPLENTE', 409);
  if (resumo.situacaoPagamento === 'aguardando_pagamento') throw new CaptacaoError('A assinatura ainda não tem pagamento confirmado.', 'ASSINATURA_SEM_PAGAMENTO', 409);
  const servicoId = texto(dados.servicoId, 100);
  const servicos = resumo.plano?.servicosIds || [];
  if (servicos.length && !servicos.includes(servicoId)) throw new CaptacaoError('Este serviço não está incluído no plano.', 'SERVICO_FORA_DO_PLANO', 409);
  const controle = controleAssinatura(empresaId, resumo.assinatura.id);
  const agendamentoId = texto(dados.agendamentoId, 120);
  if (agendamentoId) {
    const repetido = controle.usos.find((uso) => uso.agendamentoId === agendamentoId);
    if (repetido) return { ...resumoAssinatura(empresaId, assinaturaId, opcoes), repetido: true };
  }
  if (resumo.situacaoPagamento !== 'em_dia') throw new CaptacaoError('O pacote não está disponível nesta data. Verifique o início e o vencimento.', 'ASSINATURA_FORA_DA_VALIDADE',409);
  if (resumo.sessoesRestantes <= reservasAssinatura(empresaId,resumo.assinatura.id,resumo,{ignorarAgendamentoId:dados.agendamentoId,ignorarComandaId:dados.comandaId})) throw new CaptacaoError('O plano já usou ou reservou todas as sessões deste ciclo.', 'LIMITE_DO_CICLO', 409);
  const servico = barbearia.listarServicos(empresaId, { incluirInativos: true }).find((item) => item.id === servicoId);
  controle.usos.push({
    id: novoId('assuso'),
    ciclo: resumo.ciclo.indice,
    agendamentoId: agendamentoId || null,
    servicoId: servicoId || null,
    servicoNome: servico?.nome || '',
    valorAvulso: Number(servico?.preco || 0),
    // Uso lançado pela comanda não tem agendamento: guarda quem atendeu para o pote do plano.
    profissionalId: texto(dados.profissionalId, 120) || null,
    comandaId: texto(dados.comandaId, 120) || null,
    registradoEm: iso(agoraMs(opcoes)),
  });
  controle.usos = controle.usos.slice(-500);
  save();
  return resumoAssinatura(empresaId, assinaturaId, opcoes);
}

/**
 * Chamado quando um atendimento é concluído: se o cliente tem plano ativo, em
 * dia e com saldo que cobre o serviço, desconta uma sessão (idempotente).
 * Nunca lança: o atendimento já foi concluído.
 */
export function consumirAssinaturaNaConclusao(empresaId, agendamento = {}, opcoes = {}) {
  if (agendamento.status !== 'concluido') return null;
  try {
    const resumo = agendamento.assinaturaId ? resumoAssinatura(empresaId,agendamento.assinaturaId,opcoes) : assinaturaQueCobre(empresaId, agendamento, opcoes);
    if (!resumo || resumo.situacaoPagamento !== 'em_dia' || resumo.sessoesRestantes <= 0) return null;
    return registrarUsoAssinatura(empresaId, resumo.assinatura.id, { servicoId: agendamento.servicoId, agendamentoId: agendamento.id }, opcoes);
  } catch (_) {
    return null;
  }
}

function precoMensal(plano) {
  const preco = Number(plano?.preco || 0);
  if (plano?.regraRenovacao==='aniversario') return Number((preco/(plano.ciclo==='anual'?12:plano.ciclo==='trimestral'?3:1)).toFixed(2));
  const dias = Math.max(1, numero(plano?.validadeDias, 30));
  return Number((preco * 30 / dias).toFixed(2));
}

export function saudeClube(empresaId, opcoes = {}) {
  const ms = agoraMs(opcoes);
  const assinaturas = barbearia.listarAssinaturas(empresaId).filter((item) => ['ativa', 'pausada'].includes(item.status));
  const itens = assinaturas.map((assinatura) => {
    const resumo = resumoAssinatura(empresaId, assinatura.id, opcoes);
    const usosCiclo = resumo.usosDoCiclo;
    const valorAvulso = usosCiclo.reduce((soma, uso) => soma + Number(uso.valorAvulso || 0), 0);
    const mensalidade = Number(resumo.plano?.preco || 0);
    const decorrido = (ms - new Date(resumo.ciclo.inicio).valueOf()) / Math.max(1, new Date(resumo.ciclo.fim).valueOf() - new Date(resumo.ciclo.inicio).valueOf());
    const alertas = [];
    if (resumo.situacaoPagamento === 'inadimplente') alertas.push('inadimplente');
    if (resumo.situacaoPagamento === 'aguardando_pagamento') alertas.push('sem_pagamento');
    if (assinatura.status === 'ativa' && decorrido >= 0.5 && usosCiclo.length === 0) alertas.push('sem_uso_risco_cancelamento');
    if (mensalidade > 0 && valorAvulso > mensalidade * 1.2) alertas.push('uso_acima_da_mensalidade');
    return {
      assinaturaId: assinatura.id,
      clienteId: assinatura.clienteId,
      clienteNome: assinatura.clienteNome,
      plano: resumo.plano?.nome || '',
      status: assinatura.status,
      situacaoPagamento: resumo.situacaoPagamento,
      mensalidade,
      usosNoCiclo: usosCiclo.length,
      limiteNoCiclo: resumo.limiteNoCiclo,
      valorAvulsoConsumido: Number(valorAvulso.toFixed(2)),
      margemCiclo: Number((mensalidade - valorAvulso).toFixed(2)),
      pagoAte: resumo.pagoAte,
      inicio: assinatura.inicio,
      ciclo: resumo.ciclo,
      regraRenovacao: resumo.plano?.regraRenovacao || 'dias',
      referenciaRenovacao: `${assinatura.id}:ate:${resumo.pagoAte || assinatura.inicio}`,
      alertas,
    };
  });
  const ativas = itens.filter((item) => item.status === 'ativa');
  const mrr = assinaturas
    .filter((item) => item.status === 'ativa')
    .reduce((soma, item) => {
      const plano = resumoAssinatura(empresaId,item.id,opcoes)?.plano;
      return soma + precoMensal(plano);
    }, 0);
  return {
    assinantesAtivos: ativas.length,
    mrr: Number(mrr.toFixed(2)),
    inadimplentes: itens.filter((item) => item.alertas.includes('inadimplente')).length,
    emRisco: itens.filter((item) => item.alertas.includes('sem_uso_risco_cancelamento')).length,
    acimaDaMensalidade: itens.filter((item) => item.alertas.includes('uso_acima_da_mensalidade')).length,
    usoMedioPorAssinante: ativas.length ? Number((ativas.reduce((s, i) => s + i.usosNoCiclo, 0) / ativas.length).toFixed(2)) : 0,
    itens: itens.sort((a, b) => b.alertas.length - a.alertas.length || a.clienteNome.localeCompare(b.clienteNome, 'pt-BR')),
  };
}

/** Clientes sem plano que gastaram no avulso mais do que pagariam no plano mais barato. */
export function candidatosAoClube(empresaId, { dias = 60 } = {}, opcoes = {}) {
  const ms = agoraMs(opcoes);
  const planos = barbearia.listarPlanos(empresaId).filter((plano) => plano.preco > 0);
  if (!planos.length) return { planoReferencia: null, candidatos: [] };
  const comPlano = new Set(barbearia.listarAssinaturas(empresaId).filter((item) => ['ativa', 'pausada', 'pendente_ativacao'].includes(item.status)).map((item) => item.clienteId));
  const desde = ms - Math.max(7, numero(dias, 60)) * DIA_MS;
  const porCliente = new Map();
  for (const item of barbearia.listarAgendamentos(empresaId, {})) {
    if (item.status !== 'concluido') continue;
    const quando = new Date(item.dataHora).valueOf();
    if (!Number.isFinite(quando) || quando < desde || quando > ms) continue;
    const chave = item.clienteId || telefoneChave(item.clienteTelefone);
    if (!chave || comPlano.has(item.clienteId)) continue;
    const atual = porCliente.get(chave) || { clienteId: item.clienteId || '', nome: item.clienteNome, telefone: item.clienteTelefone, visitas: 0, gasto: 0 };
    atual.visitas += 1;
    atual.gasto += Number(item.valorRecebido || item.valor || 0);
    porCliente.set(chave, atual);
  }
  const meses = Math.max(1, numero(dias, 60) / 30);
  const candidatos = [];
  for (const cliente of porCliente.values()) {
    if (cliente.visitas < 2) continue;
    const gastoMensal = cliente.gasto / meses;
    const melhor = planos
      .map((plano) => ({ plano, mensal: precoMensal(plano) }))
      .sort((a, b) => a.mensal - b.mensal)
      .find((opcao) => opcao.mensal < gastoMensal);
    if (!melhor) continue;
    candidatos.push({
      clienteId: cliente.clienteId,
      nome: cliente.nome,
      visitas: cliente.visitas,
      gastoMensalAvulso: Number(gastoMensal.toFixed(2)),
      planoSugerido: { id: melhor.plano.id, nome: melhor.plano.nome, mensal: melhor.mensal },
      economiaMensal: Number((gastoMensal - melhor.mensal).toFixed(2)),
      argumento: `${nomeCurto(cliente.nome)} gastou em média R$ ${gastoMensal.toFixed(2).replace('.', ',')} por mês; no ${melhor.plano.nome} pagaria R$ ${melhor.mensal.toFixed(2).replace('.', ',')}.`,
    });
  }
  return {
    planoReferencia: planos.map((plano) => ({ id: plano.id, nome: plano.nome, mensal: precoMensal(plano) })).sort((a, b) => a.mensal - b.mensal)[0],
    candidatos: candidatos.sort((a, b) => b.economiaMensal - a.economiaMensal).slice(0, 50),
  };
}

// ---------------------------------------------------------------------------
// RETORNO PREVISTO
// ---------------------------------------------------------------------------

// Convite manual de retorno pelo WhatsApp da equipe: só para quem autorizou
// mensagens de atendimento (e não respondeu SAIR depois).
function whatsappAutorizadoPara(empresaId, agendamento = {}) {
  const chave = telefoneChave(agendamento.clienteTelefone);
  const lista = clientesKytto.listarClientes(String(empresaId));
  const cliente = (agendamento.clienteId && lista.find((item) => item.id === agendamento.clienteId))
    || (chave && lista.find((item) => telefoneChave(item.telefone) === chave));
  return cliente?.consentimentos?.whatsapp?.atendimento?.concedido === true;
}

function mediana(valores) {
  const ordenados = [...valores].sort((a, b) => a - b);
  if (!ordenados.length) return null;
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
}

function proximoHorarioLivre(empresaId, { servicoId, profissionalId, lojaId, aPartirDe, dias = 5 }) {
  // Tenta o barbeiro preferido; se ele estiver inativo ou sem horário, qualquer um.
  for (const profissional of [...new Set([profissionalId || 'qualquer', 'qualquer'])]) {
    for (let i = 0; i < dias; i += 1) {
      const data = dataLocal(aPartirDe + i * DIA_MS);
      try {
        const horario = barbearia.listarHorariosDisponiveis(empresaId, { data, servicoId, profissionalId: profissional, lojaId })
          .find((item) => item.disponivel);
        if (horario) return { data, horario: horario.horario, qualquerProfissional: profissional === 'qualquer' };
      } catch (_) {
        break;
      }
    }
  }
  return null;
}

function chaveCliente(item) {
  // O telefone une o histórico de quem foi cadastrado mais de uma vez.
  return telefoneChave(item.clienteTelefone) || item.clienteId || '';
}

/**
 * Para cada cliente com 2+ atendimentos concluídos: intervalo habitual
 * (mediana), data prevista do próximo retorno, barbeiro e serviço preferidos.
 * Classifica em "no prazo", "esta semana" e "atrasado".
 */
export function retornosPrevistos(empresaId, { horizonteDias = 7, sugerirHorario = true, lojaId = '' } = {}, opcoes = {}) {
  const unidade = texto(lojaId, 120);
  const horizonte = Number(horizonteDias);
  if (!unidade) throw new CaptacaoError('Selecione a unidade para consultar retornos previstos.', 'LOJA_OBRIGATORIA');
  if (!Number.isInteger(horizonte) || horizonte < 1 || horizonte > 90) throw new CaptacaoError('Informe um horizonte de 1 a 90 dias.', 'HORIZONTE_INVALIDO');
  const ms = agoraMs(opcoes);
  const agendamentos = barbearia.listarAgendamentos(empresaId, {})
    .filter((item) => item.lojaId === unidade);
  const futurosPorChave = new Set(agendamentos
    .filter((item) => STATUS_ATIVOS.has(item.status) && new Date(item.dataHora).valueOf() > ms)
    .map((item) => `${chaveCliente(item)}:${item.servicoId || ''}`));
  const porCliente = new Map();
  for (const item of agendamentos) {
    if (item.status !== 'concluido') continue;
    const chave = chaveCliente(item);
    const servicoId = texto(item.servicoId, 100);
    if (!chave || !servicoId) continue;
    const chaveRetorno = `${chave}:${servicoId}`;
    const lista = porCliente.get(chaveRetorno) || [];
    lista.push(item);
    porCliente.set(chaveRetorno, lista);
  }
  const profissionais = mapaPorId(barbearia.listarProfissionais(empresaId, { incluirInativos: true }));
  const servicos = mapaPorId(barbearia.listarServicos(empresaId, { incluirInativos: true }));
  const itens = [];
  for (const [chave, visitas] of porCliente) {
    if (visitas.length < 2) continue;
    const ordenadas = visitas.sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
    const intervalos = [];
    for (let i = 1; i < ordenadas.length; i += 1) {
      const dias = (new Date(ordenadas[i].dataHora) - new Date(ordenadas[i - 1].dataHora)) / DIA_MS;
      if (dias >= 3) intervalos.push(dias);
    }
    const intervalo = mediana(intervalos);
    if (!intervalo) continue;
    const ultima = ordenadas.at(-1);
    const previsto = new Date(ultima.dataHora).valueOf() + intervalo * DIA_MS;
    const contagem = (campo) => {
      const mapa = new Map();
      for (const visita of ordenadas.slice(-5)) mapa.set(visita[campo], (mapa.get(visita[campo]) || 0) + 1);
      return [...mapa.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    };
    const profissionalId = contagem('profissionalId');
    const servicoId = contagem('servicoId');
    const diasAtraso = Math.floor((ms - previsto) / DIA_MS);
    const situacao = futurosPorChave.has(chave)
      ? 'agendado'
      : diasAtraso > 0 ? 'atrasado' : previsto - ms <= horizonte * DIA_MS ? 'esta_semana' : 'no_prazo';
    itens.push({
      clienteId: ultima.clienteId || '',
      nome: ultima.clienteNome,
      // Telefone só de quem autorizou o WhatsApp (minimização): é o que o convite usa.
      ...(whatsappAutorizadoPara(empresaId, ultima) ? { telefone: texto(ultima.clienteTelefone, 30), whatsappAutorizado: true } : { whatsappAutorizado: false, temTelefone: Boolean(telefoneChave(ultima.clienteTelefone)) }),
      visitas: ordenadas.length,
      intervaloHabitualDias: Math.round(intervalo),
      ultimaVisita: ultima.dataAgenda || String(ultima.dataHora).slice(0, 10),
      retornoPrevisto: dataLocal(previsto),
      diasAtraso: Math.max(0, diasAtraso),
      situacao,
      profissionalPreferido: profissionais.get(profissionalId) ? { id: profissionalId, nome: profissionais.get(profissionalId).nome } : null,
      servicoPreferido: servicos.get(servicoId) ? { id: servicoId, nome: servicos.get(servicoId).nome } : null,
    });
  }

  // Integrar clientes históricos da base consolidada (Avec e Dino)
  const isDinoContext = !empresaId || String(empresaId).toLowerCase().includes("dino") || empresaId === "d0d0ac01-8e50-4b61-8c79-de4aaa916da6" || empresaId === "emp-kytto-001" || empresaId === "principal";
  const isDinoStore = !unidade || unidade === DINO_COMMERCE_LOJA_ID || unidade === DINO_LEGACY_LOJA_ID || String(unidade).toLowerCase().includes("dino") || unidade === "loja_dino";
  if ((isDinoContext || itens.length === 0) && isDinoStore && baseConsolidadaRetornosCache && Array.isArray(baseConsolidadaRetornosCache)) {
    for (const c of baseConsolidadaRetornosCache) {
      if (!c.totalVisitas || !c.ultimaVisita) continue;
      const chaveTel = telefoneChave(c.telefone);
      const chaveNome = String(c.nome || '').trim().toLowerCase();
      if (chaveTel && clientesProcessados.has(chaveTel)) continue;
      if (chaveNome && clientesProcessados.has(chaveNome)) continue;
      if (chaveTel) clientesProcessados.add(chaveTel);
      if (chaveNome) clientesProcessados.add(chaveNome);

      let intervalo = 25;
      if (c.datasVisitas && c.datasVisitas.length >= 2) {
        const sorted = [...new Set(c.datasVisitas)].sort();
        const diffs = [];
        for (let i = 1; i < sorted.length; i++) {
          const d = (new Date(sorted[i]) - new Date(sorted[i - 1])) / DIA_MS;
          if (d >= 5 && d <= 120) diffs.push(d);
        }
        if (diffs.length) {
          diffs.sort((a, b) => a - b);
          intervalo = diffs[Math.floor(diffs.length / 2)];
        }
      }
      const msUltima = new Date(`${c.ultimaVisita}T12:00:00Z`).valueOf();
      const previsto = msUltima + intervalo * DIA_MS;
      const diasAtraso = Math.floor((ms - previsto) / DIA_MS);
      const previstoData = new Date(previsto).toISOString().slice(0, 10);
      const jaAgendado = (chaveTel && futurosCliente.has(chaveTel)) || (chaveNome && futurosCliente.has(chaveNome));
      const situacao = jaAgendado
        ? 'agendado'
        : diasAtraso > 0 ? 'atrasado' : previsto - ms <= horizonte * DIA_MS ? 'esta_semana' : 'no_prazo';

      itens.push({
        clienteId: c.clienteId || c.telefone || '',
        nome: c.nome,
        telefone: c.telefone || '',
        whatsappAutorizado: true,
        temTelefone: Boolean(c.telefone),
        visitas: c.totalVisitas,
        intervaloHabitualDias: Math.round(intervalo),
        ultimaVisita: c.ultimaVisita,
        retornoPrevisto: previstoData,
        diasAtraso: Math.max(0, diasAtraso),
        situacao,
        profissionalPreferido: c.profissionalPreferido ? { id: '', nome: c.profissionalPreferido } : null,
        servicoPreferido: c.servicoPreferido ? { id: '', nome: c.servicoPreferido } : { id: '', nome: 'Corte / Barba' },
      });
    }
  }

  const acionaveis = itens.filter((item) => item.situacao === 'atrasado' || item.situacao === 'esta_semana')
    .sort((a, b) => b.diasAtraso - a.diasAtraso || a.retornoPrevisto.localeCompare(b.retornoPrevisto));
  if (sugerirHorario) {
    for (const item of acionaveis.slice(0, 10)) {
      if (!item.servicoPreferido) continue;
      item.sugestao = proximoHorarioLivre(empresaId, {
        servicoId: item.servicoPreferido.id,
        profissionalId: item.profissionalPreferido?.id,
        lojaId: unidade,
        aPartirDe: Math.max(ms, new Date(`${item.retornoPrevisto}T12:00:00Z`).valueOf()),
      });
    }
  }
  return {
    resumo: {
      clientesComHistorico: itens.length,
      atrasados: itens.filter((item) => item.situacao === 'atrasado').length,
      estaSemana: itens.filter((item) => item.situacao === 'esta_semana').length,
      agendados: itens.filter((item) => item.situacao === 'agendado').length,
    },
    acionaveis,
    todos: itens,
  };
}

// ---------------------------------------------------------------------------
// OCUPAÇÃO DA AGENDA E METAS POR PROFISSIONAL
// ---------------------------------------------------------------------------

function minutos(hora) {
  const [h, m] = String(hora || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
}

function diasNoIntervalo(inicio, fim) {
  const dias = [];
  const cursor = new Date(`${inicio}T12:00:00Z`);
  const ultimo = new Date(`${fim}T12:00:00Z`);
  while (cursor <= ultimo && dias.length < 400) {
    dias.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dias;
}

function diasUteisDoProfissional(calendario, profissional, inicio, fim) {
  const feriados = new Set(calendario.feriados || []);
  const diasLoja = Array.isArray(calendario.diasFuncionamento) ? calendario.diasFuncionamento : [1, 2, 3, 4, 5, 6];
  const diasTrabalho = Array.isArray(profissional.diasTrabalho) ? profissional.diasTrabalho : diasLoja;
  return diasNoIntervalo(inicio, fim).filter((dia) => {
    const semana = new Date(`${dia}T12:00:00Z`).getUTCDay();
    return !feriados.has(dia) && diasLoja.includes(semana) && diasTrabalho.includes(semana);
  });
}

function proximoDia(data) {
  return new Date(new Date(`${data}T12:00:00Z`).valueOf() + DIA_MS).toISOString().slice(0, 10);
}

export function ocupacaoAgenda(empresaId, { inicio, fim, lojaId = '' } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(inicio)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(fim)) || fim < inicio) throw new CaptacaoError('Período inválido.', 'PERIODO_INVALIDO');
  const configuracao = barbearia.obterConfiguracao(empresaId);
  const calendario = lojaId && configuracao.lojas?.[lojaId] ? { ...configuracao, ...configuracao.lojas[lojaId] } : configuracao;
  const dias = diasNoIntervalo(inicio, fim);
  const agendamentos = barbearia.listarAgendamentos(empresaId, {})
    .filter((item) => !lojaId || item.lojaId === lojaId)
    .filter((item) => !STATUS_FINAIS_INVALIDOS.has(item.status))
    .filter((item) => item.dataAgenda >= inicio && item.dataAgenda <= fim);
  // Atendimento coberto pelo plano não é receita avulsa (a receita é a mensalidade).
  const cobertosPeloPlano = new Set(Object.values(captacao(empresaId).assinaturas)
    .flatMap((controle) => (controle.usos || []).map((uso) => uso.agendamentoId).filter(Boolean)));
  const profissionais = barbearia.listarProfissionais(empresaId).map((profissional) => {
    const jornada = Math.max(0, Math.min(minutos(profissional.horarioFim), minutos(calendario.horarioFechamento)) - Math.max(minutos(profissional.horarioInicio), minutos(calendario.horarioAbertura)));
    const diasUteis = diasUteisDoProfissional(calendario, profissional, inicio, fim);
    const capacidade = Number.isFinite(jornada) ? jornada * diasUteis.length : 0;
    const proprios = agendamentos.filter((item) => item.profissionalId === profissional.id);
    const ocupados = proprios.reduce((soma, item) => soma + Number(item.duracaoMinutos || 0), 0);
    const concluidos = proprios.filter((item) => item.status === 'concluido');
    return {
      profissionalId: profissional.id,
      nome: profissional.nome,
      capacidadeMinutos: capacidade,
      diasUteis: diasUteis.length,
      minutosAgendados: ocupados,
      ocupacao: capacidade > 0 ? Number((ocupados / capacidade).toFixed(4)) : 0,
      atendimentos: proprios.length,
      concluidos: concluidos.length,
      minutosConcluidos: concluidos.reduce((soma, item) => soma + Number(item.duracaoMinutos || 0), 0),
      receita: Number(concluidos.reduce((soma, item) => {
        if (cobertosPeloPlano.has(item.id)) return soma;
        const recebimento = barbearia.recebimentoAgendamentoVerificado(empresaId, item);
        return soma + (recebimento ? Number(recebimento.valor || 0) : 0);
      }, 0).toFixed(2)),
      cobertosPeloPlano: concluidos.filter((item) => cobertosPeloPlano.has(item.id)).length,
    };
  });
  const capacidade = profissionais.reduce((soma, item) => soma + item.capacidadeMinutos, 0);
  const ocupados = profissionais.reduce((soma, item) => soma + item.minutosAgendados, 0);
  return {
    periodo: { inicio, fim, dias: dias.length },
    ocupacaoGeral: capacidade > 0 ? Number((ocupados / capacidade).toFixed(4)) : 0,
    capacidadeMinutos: capacidade,
    minutosAgendados: ocupados,
    profissionais: profissionais.sort((a, b) => b.ocupacao - a.ocupacao),
  };
}

export function salvarMetaProfissional(empresaId, { profissionalId, mes, receita, atendimentos, planoAcao, diagnostico, tendenciaObservada } = {}) {
  const estado = captacao(empresaId);
  const id = texto(profissionalId, 100);
  const competencia = texto(mes, 7);
  if (!barbearia.listarProfissionais(empresaId, { incluirInativos: true }).some((item) => item.id === id)) throw new CaptacaoError('Profissional não encontrado.', 'PROFISSIONAL_NAO_ENCONTRADO', 404);
  if (!/^\d{4}-\d{2}$/.test(competencia)) throw new CaptacaoError('Mês inválido (use AAAA-MM).', 'MES_INVALIDO');
  estado.metasProfissionais[competencia] ||= {};
  const anterior = estado.metasProfissionais[competencia][id] || {};
  estado.metasProfissionais[competencia][id] = {
    receita: receita !== undefined && receita !== null && receita !== '' ? dinheiro(receita) : (anterior.receita || 0),
    atendimentos: atendimentos !== undefined && atendimentos !== null && atendimentos !== '' ? Math.max(0, Math.round(numero(atendimentos))) : (anterior.atendimentos || 0),
    planoAcao: planoAcao !== undefined ? texto(planoAcao, 4000) : (anterior.planoAcao || ''),
    diagnostico: diagnostico !== undefined ? texto(diagnostico, 2000) : (anterior.diagnostico || ''),
    tendenciaObservada: tendenciaObservada !== undefined ? texto(tendenciaObservada, 50) : (anterior.tendenciaObservada || ''),
    atualizadoEm: new Date().toISOString(),
  };
  save();
  return { profissionalId: id, mes: competencia, ...estado.metasProfissionais[competencia][id] };
}

function ultimoDiaDoMes(competencia) {
  const [ano, mes] = competencia.split('-').map(Number);
  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
}

export function painelMetasProfissionais(empresaId, { mes, lojaId = '' } = {}, opcoes = {}) {
  const competencia = /^\d{4}-\d{2}$/.test(String(mes)) ? String(mes) : dataLocal(agoraMs(opcoes)).slice(0, 7);
  const inicio = `${competencia}-01`;
  const fim = ultimoDiaDoMes(competencia);
  const metas = captacao(empresaId).metasProfissionais[competencia] || {};
  const ocupacao = ocupacaoAgenda(empresaId, { inicio, fim, lojaId });
  const configuracao = barbearia.obterConfiguracao(empresaId);
  const calendario = lojaId && configuracao.lojas?.[lojaId] ? { ...configuracao, ...configuracao.lojas[lojaId] } : configuracao;
  const cadastroProfissionais = new Map(barbearia.listarProfissionais(empresaId).map((item) => [item.id, item]));
  const agendamentos = barbearia.listarAgendamentos(empresaId, {})
    .filter((item) => !lojaId || !item.lojaId || item.lojaId === lojaId)
    .filter((item) => !STATUS_FINAIS_INVALIDOS.has(item.status))
    .filter((item) => item.dataAgenda >= inicio && item.dataAgenda <= fim);
  const cobertosPeloPlano = new Set(Object.values(captacao(empresaId).assinaturas)
    .flatMap((controle) => (controle.usos || []).map((uso) => uso.agendamentoId).filter(Boolean)));
  const hoje = dataLocal(agoraMs(opcoes));
  const totalDias = Number(fim.slice(8));
  const decorridos = hoje < inicio ? 0 : hoje > fim ? totalDias : Number(hoje.slice(8));
  const fracao = totalDias ? decorridos / totalDias : 0;
  return {
    mes: competencia,
    fracaoDoMes: Number(fracao.toFixed(4)),
    profissionais: ocupacao.profissionais.map((item) => {
      const profissional = cadastroProfissionais.get(item.profissionalId) || {};
      const meta = metas[item.profissionalId] || null;
      const diasUteisTotais = item.diasUteis || diasUteisDoProfissional(calendario, profissional, inicio, fim).length;
      const fimDecorrido = hoje < inicio ? '' : hoje > fim ? fim : hoje;
      const inicioRestante = hoje < inicio ? inicio : hoje < fim ? proximoDia(hoje) : '';
      const diasUteisDecorridos = fimDecorrido ? diasUteisDoProfissional(calendario, profissional, inicio, fimDecorrido).length : 0;
      const diasUteisRestantes = inicioRestante ? diasUteisDoProfissional(calendario, profissional, inicioRestante, fim).length : 0;
      const proprios = agendamentos.filter((agendamento) => agendamento.profissionalId === item.profissionalId);
      const cobrados = proprios.filter((agendamento) => agendamento.status === 'concluido' && !cobertosPeloPlano.has(agendamento.id) && Number(agendamento.valorRecebido || agendamento.valor || 0) > 0);
      const estimados = proprios.filter((agendamento) => !cobertosPeloPlano.has(agendamento.id) && Number(agendamento.valorRecebido || agendamento.valor || 0) > 0);
      const ticketMedio = cobrados.length
        ? Number((item.receita / cobrados.length).toFixed(2))
        : estimados.length
          ? Number((estimados.reduce((soma, agendamento) => soma + Number(agendamento.valorRecebido || agendamento.valor || 0), 0) / estimados.length).toFixed(2))
          : 0;
      const duracaoMedia = cobrados.length
        ? Number((cobrados.reduce((soma, agendamento) => soma + Number(agendamento.duracaoMinutos || 0), 0) / cobrados.length).toFixed(1))
        : estimados.length
          ? Number((estimados.reduce((soma, agendamento) => soma + Number(agendamento.duracaoMinutos || 0), 0) / estimados.length).toFixed(1))
          : 0;
      const futuros = proprios.filter((agendamento) => agendamento.dataAgenda > hoje && ['agendado', 'confirmado', 'em_atendimento'].includes(agendamento.status) && !cobertosPeloPlano.has(agendamento.id));
      const receitaAgendada = Number(futuros.reduce((soma, agendamento) => soma + Number(agendamento.valor || 0), 0).toFixed(2));
      const atendimentosAgendados = futuros.length;
      const minutosAgendadosFuturos = futuros.reduce((soma, agendamento) => soma + Number(agendamento.duracaoMinutos || 0), 0);
      const receitaPorDia = diasUteisDecorridos > 0 ? Number((item.receita / diasUteisDecorridos).toFixed(2)) : 0;
      const projecao = Number((item.receita + receitaPorDia * diasUteisRestantes).toFixed(2));
      const receitaRestante = meta?.receita ? Number(Math.max(0, meta.receita - item.receita).toFixed(2)) : 0;
      const receitaExtraNecessaria = meta?.receita ? Number(Math.max(0, meta.receita - item.receita - receitaAgendada).toFixed(2)) : 0;
      const atendimentosRestantesReceita = ticketMedio > 0 ? Math.ceil(receitaRestante / ticketMedio) : 0;
      const atendimentosExtrasReceita = ticketMedio > 0 ? Math.ceil(receitaExtraNecessaria / ticketMedio) : 0;
      const minutosRestantesReceita = Math.ceil(atendimentosRestantesReceita * duracaoMedia);
      const minutosExtrasReceita = Math.ceil(atendimentosExtrasReceita * duracaoMedia);
      const atendimentosRestantesMeta = meta?.atendimentos ? Math.max(0, meta.atendimentos - item.concluidos) : 0;
      const receitaDiariaNecessaria = diasUteisRestantes > 0 ? Number((receitaRestante / diasUteisRestantes).toFixed(2)) : receitaRestante;
      const atendimentosDiariosNecessarios = diasUteisRestantes > 0 ? Math.ceil(atendimentosRestantesReceita / diasUteisRestantes) : atendimentosRestantesReceita;
      const horasDiariasNecessarias = diasUteisRestantes > 0 ? Number((minutosRestantesReceita / diasUteisRestantes / 60).toFixed(2)) : Number((minutosRestantesReceita / 60).toFixed(2));
      const ocupacaoNecessaria = meta?.receita && item.capacidadeMinutos > 0
        ? Number(((item.minutosAgendados + minutosExtrasReceita) / item.capacidadeMinutos).toFixed(4))
        : null;
      return {
        ...item,
        meta,
        progressoReceita: meta?.receita ? Number((item.receita / meta.receita).toFixed(4)) : null,
        progressoAtendimentos: meta?.atendimentos ? Number((item.concluidos / meta.atendimentos).toFixed(4)) : null,
        projecaoReceita: projecao,
        noRitmo: meta?.receita ? projecao >= meta.receita : null,
        diasUteisTotais,
        diasUteisDecorridos,
        diasUteisRestantes,
        ticketMedio,
        duracaoMedia,
        receitaPorDia,
        receitaAgendada,
        atendimentosAgendados,
        minutosAgendadosFuturos,
        receitaRestante,
        receitaExtraNecessaria,
        atendimentosRestantesReceita,
        atendimentosExtrasReceita,
        atendimentosRestantesMeta,
        minutosRestantesReceita,
        minutosExtrasReceita,
        receitaDiariaNecessaria,
        atendimentosDiariosNecessarios,
        horasDiariasNecessarias,
        ocupacaoNecessaria,
      };
    }),
  };
}


// ---------------------------------------------------------------------------
// PROJEÇÃO INTELIGENTE DE FATURAMENTO
// A previsão é deliberadamente explicável: fatos financeiros/operacionais são
// calculados no servidor e a leitura gerencial aponta a evidência que a gerou.
// Ela não cria venda, agenda, mensagem ou meta; também não usa IA generativa
// como fonte dos valores financeiros.
// ---------------------------------------------------------------------------
const STATUS_AGENDA_PREVISAO = new Set(['agendado', 'confirmado', 'em_atendimento']);

function competenciaValida(valor, fallback) {
  const competencia = texto(valor, 7);
  if (!competencia) return fallback;
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(competencia)) throw new CaptacaoError('Mês inválido (use AAAA-MM).', 'MES_INVALIDO');
  return competencia;
}

function deslocarCompetencia(competencia, quantidade) {
  const [ano, mes] = competencia.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1 + quantidade, 1));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`;
}

function diasNoMes(competencia) {
  return Number(ultimoDiaDoMes(competencia).slice(8));
}

function mediaPonderada(valores = []) {
  if (!valores.length) return 0;
  const totalPesos = valores.reduce((soma, _, indice) => soma + indice + 1, 0);
  return totalPesos ? valores.reduce((soma, valor, indice) => soma + Number(valor || 0) * (indice + 1), 0) / totalPesos : 0;
}

function desvioPadrao(valores = []) {
  if (valores.length < 2) return 0;
  const media = valores.reduce((soma, valor) => soma + Number(valor || 0), 0) / valores.length;
  return Math.sqrt(valores.reduce((soma, valor) => soma + (Number(valor || 0) - media) ** 2, 0) / valores.length);
}

function numeroArredondado(valor) {
  return Number(Math.max(0, Number(valor || 0)).toFixed(2));
}

function dataDoAgendamento(item) {
  return String(item?.dataAgenda || item?.dataHora || '').slice(0, 10);
}

function dataDoPagamentoRevenda(item) {
  return dataLocal(new Date(item?.pagamento?.confirmadoEm || item?.atualizadoEm || item?.criadoEm || 0).valueOf());
}

// A Dino tem uma unidade só (Dino Matriz). O código legado da loja (usado nas
// importações do Avec) é a mesma unidade do código Commerce.
const UNIDADES_EQUIVALENTES = new Map([[DINO_LEGACY_LOJA_ID, DINO_COMMERCE_LOJA_ID]]);
function unidadeCanonica(lojaId) {
  const valor = String(lojaId || '').trim();
  return UNIDADES_EQUIVALENTES.get(valor) || valor;
}

function noEscopoEstrito(item, lojaId) {
  return !lojaId || unidadeCanonica(item?.lojaId) === unidadeCanonica(lojaId);
}

function ehRecebimentoAvec(item) {
  return item?.metadata?.historicoAvec === true || String(item?.origem || '').startsWith('avec-import-financeiro');
}

// Recebimentos pagos do extrato financeiro importado do Avec: são o faturamento
// realizado de cada mês até a virada para o Kytto (não viram venda nova).
function recebimentosAvec(empresaId, lojaId, corte, opcoes = {}) {
  let lancamentos = opcoes.lancamentosFinanceiros;
  if (!Array.isArray(lancamentos)) {
    try { lancamentos = financeiroKytto.listarLancamentos(empresaId, {}); } catch { lancamentos = []; }
  }
  const itens = [];
  for (const item of lancamentos) {
    if (item?.tipo !== 'receita' || item.status !== 'pago' || !ehRecebimentoAvec(item) || !noEscopoEstrito(item, lojaId)) continue;
    const ms = new Date(item.pagoEm || item.dataOperacao || 0).valueOf();
    if (!Number.isFinite(ms) || ms <= 0) continue;
    const dia = dataLocal(ms);
    const valor = dinheiro(item.valor);
    if (dia > corte || valor <= 0) continue;
    itens.push({ id: item.id, dia, mes: dia.slice(0, 7), valor });
  }
  return itens;
}

// Atendimentos do histórico Avec com valor, por profissional (atribuição analítica:
// o Avec registra o valor da comanda em um dos itens).
function atendimentosAvecComValor(empresaId, lojaId, corte) {
  return barbearia.listarHistoricoAtendimentos(empresaId, {})
    .filter((item) => item.somenteHistorico === true && noEscopoEstrito(item, lojaId))
    .map((item) => {
      const dia = String(item.dataAgenda || '').slice(0, 10);
      return { id: item.id, dia, mes: dia.slice(0, 7), profissionalId: String(item.profissionalId || ''), profissionalNome: String(item.profissionalNome || ''), valor: dinheiro(item.total ?? item.valor ?? 0) };
    })
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.dia) && item.dia <= corte && item.valor > 0);
}

function usosDePlano(empresaId) {
  return new Set(Object.values(captacao(empresaId).assinaturas)
    .flatMap((controle) => (controle.usos || []).map((uso) => uso.agendamentoId).filter(Boolean)));
}

function fatosDeFaturamento(empresaId, lojaId = '', opcoes = {}) {
  const corte = hojeLocal(opcoes);
  const usosPlano = usosDePlano(empresaId);
  const avec = recebimentosAvec(empresaId, lojaId, corte, opcoes);
  // Até o último dia com recebimento Avec, o Avec é a fonte do faturamento; o que o
  // Kytto registrar nesses dias não soma de novo (os dois sistemas rodaram juntos).
  const ultimoDiaAvec = avec.reduce((maior, item) => (item.dia > maior ? item.dia : maior), '');
  const depoisDoAvec = (dia) => !ultimoDiaAvec || dia > ultimoDiaAvec;
  const servicos = [];
  const agenda = [];
  const ocorrencias = [];
  for (const item of barbearia.listarAgendamentos(empresaId, {})) {
    const dia = dataDoAgendamento(item);
    if (!dia || !noEscopoEstrito(item, lojaId)) continue;
    const valor = dinheiro(item.valorRecebido || item.valor || 0);
    const base = {
      id: item.id,
      dia,
      mes: dia.slice(0, 7),
      profissionalId: item.profissionalId || '',
      valor,
      duracaoMinutos: Math.max(0, numero(item.duracaoMinutos)),
      status: item.status,
    };
    ocorrencias.push(base);
    if (item.status === 'concluido' && dia <= corte && depoisDoAvec(dia) && !usosPlano.has(item.id) && valor > 0) servicos.push(base);
    if (STATUS_AGENDA_PREVISAO.has(item.status) && dia > corte && !usosPlano.has(item.id) && valor > 0) agenda.push(base);
  }
  const revenda = [];
  for (const item of barbearia.listarVendasRevenda(empresaId, {})) {
    if (item.status !== 'pago' || !noEscopoEstrito(item, lojaId)) continue;
    const dia = dataDoPagamentoRevenda(item);
    const valor = dinheiro(item.pagamento?.valorRecebido || item.total || 0);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || dia > corte || valor <= 0 || !depoisDoAvec(dia)) continue;
    revenda.push({ id: item.id, dia, mes: dia.slice(0, 7), profissionalId: item.profissionalId || '', valor, status: item.status });
  }
  const servicosAvec = atendimentosAvecComValor(empresaId, lojaId, corte);
  return { corte, servicos, agenda, revenda, ocorrencias, avec, servicosAvec, ultimoDiaAvec };
}

function resumoDaCompetencia(fatos, competencia, { incluirFuturo = true } = {}) {
  const servicos = fatos.servicos.filter((item) => item.mes === competencia);
  const revenda = fatos.revenda.filter((item) => item.mes === competencia);
  const agenda = incluirFuturo ? fatos.agenda.filter((item) => item.mes === competencia) : [];
  const totalServicos = dinheiro(servicos.reduce((soma, item) => soma + item.valor, 0));
  const totalRevenda = dinheiro(revenda.reduce((soma, item) => soma + item.valor, 0));
  const totalAgenda = dinheiro(agenda.reduce((soma, item) => soma + item.valor, 0));
  const avec = (fatos.avec || []).filter((item) => item.mes === competencia);
  const totalAvec = dinheiro(avec.reduce((soma, item) => soma + item.valor, 0));
  const vendas = servicos.length + avec.length;
  return {
    mes: competencia,
    servicos: totalServicos,
    revenda: totalRevenda,
    historicoAvec: totalAvec,
    servicosConsolidados: dinheiro(totalServicos + totalAvec),
    realizado: dinheiro(totalServicos + totalRevenda + totalAvec),
    agendaFutura: totalAgenda,
    atendimentosConcluidos: servicos.length,
    comandasAvec: avec.length,
    atendimentosAgendados: agenda.length,
    ticketMedio: vendas ? dinheiro((totalServicos + totalAvec) / vendas) : 0,
  };
}

function estimativaHistorica(linhas, campo) {
  const observadas = linhas.map((item) => Number(item[campo] || 0)).filter((valor) => valor > 0);
  if (!observadas.length) return { base: 0, desvio: 0, tendencia: 0, mesesComDados: 0 };
  const media = mediaPonderada(observadas);
  const tendencia = observadas.length > 1 ? (observadas.at(-1) - observadas[0]) / (observadas.length - 1) : 0;
  const base = Math.max(0, media + tendencia * 0.35);
  return {
    base: numeroArredondado(base),
    desvio: numeroArredondado(desvioPadrao(observadas)),
    tendencia: numeroArredondado(Math.abs(tendencia)),
    direcao: tendencia > 0.01 ? 'crescimento' : tendencia < -0.01 ? 'queda' : 'estavel',
    mesesComDados: observadas.length,
  };
}

function nivelConfianca(mesesComDados, historico) {
  if (mesesComDados >= 5 && historico.length >= 5) return { nivel: 'alta', rotulo: 'Alta', explicacao: 'Há pelo menos cinco meses com faturamento registrado para comparar.' };
  if (mesesComDados >= 3) return { nivel: 'media', rotulo: 'Média', explicacao: 'Há histórico suficiente para identificar ritmo, mas a série ainda pode oscilar.' };
  if (mesesComDados >= 1) return { nivel: 'baixa', rotulo: 'Baixa', explicacao: 'A projeção usa poucos meses registrados; complete os lançamentos para refiná-la.' };
  return { nivel: 'insuficiente', rotulo: 'Histórico insuficiente', explicacao: 'Ainda não há meses concluídos com receita registrada para formar uma tendência.' };
}

function metaDaEquipe(empresaId, competencia) {
  const metas = captacao(empresaId).metasProfissionais[competencia] || {};
  const valores = Object.values(metas);
  return {
    receita: dinheiro(valores.reduce((soma, item) => soma + Number(item.receita || 0), 0)),
    atendimentos: valores.reduce((soma, item) => soma + Math.max(0, Math.round(numero(item.atendimentos))), 0),
    profissionaisComMeta: valores.filter((item) => Number(item.receita || 0) > 0 || Number(item.atendimentos || 0) > 0).length,
  };
}

// Sazonalidade: quanto o mesmo mês do ano anterior ficou acima ou abaixo da média
// dos seis meses que vieram antes dele. Sem um ano de histórico, o fator é 1.
// O mapa só traz meses completos (o primeiro mês do histórico, se começou no meio,
// fica fora para não distorcer). Fator: o mês do ano anterior sobre a média dos três
// meses completos antes dele.
function fatorSazonal(competencia, mapaRealizado) {
  const anoAnterior = deslocarCompetencia(competencia, -12);
  const valor = Number(mapaRealizado.get(anoAnterior) || 0);
  if (valor <= 0) return { fator: 1, referencia: null, anoAnterior: null };
  const anteriores = Array.from({ length: 3 }, (_, indice) => Number(mapaRealizado.get(deslocarCompetencia(anoAnterior, -(indice + 1))) || 0)).filter((item) => item > 0);
  if (anteriores.length < 2) return { fator: 1, referencia: null, anoAnterior: valor };
  const media = anteriores.reduce((soma, item) => soma + item, 0) / anteriores.length;
  const fator = Math.min(2.2, Math.max(0.6, valor / media));
  return { fator: Number(fator.toFixed(4)), referencia: anoAnterior, anoAnterior: valor };
}

// Crescimento contra o ano anterior: soma dos meses fechados recentes que têm o
// mesmo mês no ano anterior (pelo menos três pares).
function crescimentoAnual(mapaRealizado, ultimoFechado) {
  let atual = 0; let anterior = 0; let pares = 0;
  for (let indice = 0; indice < 6; indice += 1) {
    const mes = deslocarCompetencia(ultimoFechado, -indice);
    const valor = Number(mapaRealizado.get(mes) || 0);
    const passado = Number(mapaRealizado.get(deslocarCompetencia(mes, -12)) || 0);
    if (valor > 0 && passado > 0) { atual += valor; anterior += passado; pares += 1; }
  }
  if (pares < 3 || anterior <= 0) return null;
  return { fator: Number(Math.min(1.6, Math.max(0.7, atual / anterior)).toFixed(4)), pares };
}

function previsaoDaCompetencia(competencia, fatos, historico, meta, { corte, competenciaAtual, mapaRealizado = new Map(), crescimento = null }) {
  const realizado = resumoDaCompetencia(fatos, competencia);
  const sazonal = fatorSazonal(competencia, mapaRealizado);
  const baseServicosBruta = estimativaHistorica(historico, 'servicosConsolidados');
  // Base = metade pelo nível recente com sazonalidade, metade pelo mesmo mês do ano
  // anterior corrigido pelo crescimento anual (quando há esse histórico).
  const porNivel = baseServicosBruta.base * sazonal.fator;
  const porAnoAnterior = crescimento && sazonal.anoAnterior ? sazonal.anoAnterior * crescimento.fator : null;
  const baseServicos = { ...baseServicosBruta, base: numeroArredondado(porAnoAnterior === null ? porNivel : (porNivel + porAnoAnterior) / 2) };
  const baseRevenda = estimativaHistorica(historico, 'revenda');
  const baseTotal = estimativaHistorica(historico, 'realizado');
  const inicio = `${competencia}-01`;
  const fim = ultimoDiaDoMes(competencia);
  const dentroDoMesAtual = competencia === competenciaAtual;
  const mesPassado = competencia < competenciaAtual;
  const diasRestantes = dentroDoMesAtual ? Math.max(0, Number(fim.slice(8)) - Number(corte.slice(8))) : competencia > competenciaAtual ? diasNoMes(competencia) : 0;
  const fracaoRestante = diasNoMes(competencia) ? diasRestantes / diasNoMes(competencia) : 0;

  let projetadoServicos;
  let projetadoRevenda;
  let agendaConsiderada = 0;
  if (mesPassado) {
    projetadoServicos = realizado.servicosConsolidados;
    projetadoRevenda = realizado.revenda;
  } else if (dentroDoMesAtual) {
    agendaConsiderada = realizado.agendaFutura;
    const ritmoServicos = baseServicos.base * fracaoRestante;
    projetadoServicos = realizado.servicosConsolidados + Math.max(agendaConsiderada, ritmoServicos);
    projetadoRevenda = realizado.revenda + baseRevenda.base * fracaoRestante;
  } else {
    agendaConsiderada = realizado.agendaFutura;
    projetadoServicos = Math.max(agendaConsiderada, baseServicos.base);
    projetadoRevenda = baseRevenda.base;
  }
  const base = dinheiro(projetadoServicos + projetadoRevenda);
  const intervalo = Math.max(baseTotal.desvio * (dentroDoMesAtual ? Math.max(fracaoRestante, 0.2) : 1), base * 0.08);
  const compromisso = dinheiro(realizado.realizado + agendaConsiderada);
  const conservador = dinheiro(Math.max(compromisso, base - intervalo));
  const favoravel = dinheiro(base + intervalo);
  const diferencaMeta = meta.receita > 0 ? Number((base - meta.receita).toFixed(2)) : null;
  return {
    ...realizado,
    inicio,
    fim,
    tipo: mesPassado ? 'fechado' : dentroDoMesAtual ? 'atual' : 'futuro',
    projetadoServicos: dinheiro(projetadoServicos),
    projetadoRevenda: dinheiro(projetadoRevenda),
    projecao: base,
    conservador,
    favoravel,
    agendaConsiderada,
    ritmoPendente: dinheiro(Math.max(0, projetadoServicos - realizado.servicos - agendaConsiderada) + Math.max(0, projetadoRevenda - realizado.revenda)),
    metaReceita: meta.receita || null,
    diferencaMeta,
    noRitmo: meta.receita > 0 ? base >= meta.receita : null,
    estimativa: { servicos: baseServicos, revenda: baseRevenda, total: baseTotal },
    sazonalidade: { fator: sazonal.fator, referencia: sazonal.referencia, crescimentoAnual: crescimento?.fator ?? null },
  };
}

function previsaoProfissionais(empresaId, competencia, fatos, historico, lojaId = '') {
  const corte = fatos.corte;
  const competenciaAtual = corte.slice(0, 7);
  const metas = captacao(empresaId).metasProfissionais[competencia] || {};
  const configuracao = barbearia.obterConfiguracao(empresaId);
  const calendario = lojaId && configuracao.lojas?.[lojaId] ? { ...configuracao, ...configuracao.lojas[lojaId] } : configuracao;
  const inicio = `${competencia}-01`;
  const fim = ultimoDiaDoMes(competencia);
  const profissionais = barbearia.listarProfissionais(empresaId, { incluirInativos: true });
  // Produção por profissional: serviços do Kytto e, no período do Avec, os atendimentos importados.
  // Quem tem vínculo no cadastro do Avec (nome social = cadastro do Kytto) soma no próprio cadastro.
  const vinculoPorNome = new Map();
  const producaoAvec = (fatos.servicosAvec || []).map((item) => {
    if (!vinculoPorNome.has(item.profissionalNome)) vinculoPorNome.set(item.profissionalNome, profissionalKyttoDoAvec(item.profissionalNome, profissionais)?.id || null);
    const vinculado = vinculoPorNome.get(item.profissionalNome);
    return vinculado ? { ...item, profissionalId: vinculado } : item;
  });
  const producao = [...fatos.servicos, ...producaoAvec];
  return profissionais.map((profissional) => {
    const meta = metas[profissional.id] || null;
    const realizados = producao.filter((item) => item.mes === competencia && item.profissionalId === profissional.id);
    const agendados = fatos.agenda.filter((item) => item.mes === competencia && item.profissionalId === profissional.id);
    const serie = historico.map((item) => {
      const total = producao.filter((fato) => fato.mes === item.mes && fato.profissionalId === profissional.id)
        .reduce((soma, fato) => soma + fato.valor, 0);
      return { ...item, receitaProfissional: dinheiro(total) };
    });
    const base = estimativaHistorica(serie, 'receitaProfissional');
    const realizado = dinheiro(realizados.reduce((soma, item) => soma + item.valor, 0));
    const agendaFutura = dinheiro(agendados.reduce((soma, item) => soma + item.valor, 0));
    const emCurso = competencia === competenciaAtual;
    const futuro = competencia > competenciaAtual;
    const restante = emCurso ? Math.max(0, (diasNoMes(competencia) - Number(corte.slice(8))) / diasNoMes(competencia)) : futuro ? 1 : 0;
    const projecao = competencia < competenciaAtual
      ? realizado
      : emCurso
        ? dinheiro(realizado + Math.max(agendaFutura, base.base * restante))
        : dinheiro(Math.max(agendaFutura, base.base));
    const registrosDoProfissional = fatos.ocorrencias
      .filter((item) => item.mes === competencia && item.profissionalId === profissional.id)
      .filter((item) => !STATUS_FINAIS_INVALIDOS.has(item.status));
    const minutosAgendados = registrosDoProfissional.reduce((soma, item) => soma + item.duracaoMinutos, 0);
    const jornada = Math.max(0, Math.min(minutos(profissional.horarioFim), minutos(calendario.horarioFechamento)) - Math.max(minutos(profissional.horarioInicio), minutos(calendario.horarioAbertura)));
    const capacidadeMinutos = profissional.ativo === false ? 0 : jornada * diasUteisDoProfissional(calendario, profissional, inicio, fim).length;
    const ocupacao = capacidadeMinutos > 0 ? Number((minutosAgendados / capacidadeMinutos).toFixed(4)) : null;
    const ticketMedio = realizados.length ? dinheiro(realizado / realizados.length) : agendados.length ? dinheiro(agendaFutura / agendados.length) : 0;
    const diferencaMeta = meta?.receita ? Number((projecao - meta.receita).toFixed(2)) : null;
    return {
      profissionalId: profissional.id,
      nome: profissional.nome,
      ativo: profissional.ativo !== false,
      meta: meta ? {
        receita: Number(meta.receita || 0),
        atendimentos: Number(meta.atendimentos || 0),
        planoAcao: meta.planoAcao || '',
        diagnostico: meta.diagnostico || '',
        tendenciaObservada: meta.tendenciaObservada || '',
        atualizadoEm: meta.atualizadoEm || null,
      } : null,
      realizado,
      agendaFutura,
      projecao,
      diferencaMeta,
      noRitmo: meta?.receita ? projecao >= meta.receita : null,
      atendimentosConcluidos: realizados.length,
      atendimentosAgendados: agendados.length,
      ticketMedio,
      minutosAgendados,
      capacidadeMinutos,
      ocupacao,
      tendencia: base.direcao || 'estavel',
      historicoMeses: base.mesesComDados,
    };
  }).sort((a, b) => Number(b.projecao) - Number(a.projecao) || a.nome.localeCompare(b.nome));
}

function construirLeiturasGerenciais({ atual, historico, qualidade, profissionais, ocorrencias, competencia, corte }) {
  const fatores = [];
  const acoes = [];
  const adicionar = (item, acao = null) => {
    fatores.push(item);
    if (acao) acoes.push(acao);
  };
  if (qualidade.nivel === 'insuficiente') {
    adicionar({ tipo: 'dados', severidade: 'informativo', titulo: 'Histórico ainda insuficiente', evidencia: qualidade.explicacao, impacto: null },
      { prioridade: 'alta', titulo: 'Concluir e registrar recebimentos', descricao: 'A previsão melhora quando atendimentos e vendas de revenda são finalizados no sistema.', aba: 'Atendimento' });
  }
  if (atual.metaReceita && atual.projecao < atual.metaReceita) {
    const falta = dinheiro(atual.metaReceita - atual.projecao);
    adicionar({ tipo: 'meta', severidade: falta >= atual.metaReceita * 0.2 ? 'critico' : 'alerta', titulo: 'Risco de não alcançar a meta da equipe', evidencia: `A projeção é ${falta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} abaixo da meta configurada.`, impacto: falta },
      { prioridade: 'alta', titulo: 'Revisar produção adicional por profissional', descricao: 'Veja a meta individual, o ticket e os horários necessários para recuperar o ritmo.', aba: 'Ocupação e metas' });
  } else if (atual.metaReceita && atual.projecao >= atual.metaReceita) {
    adicionar({ tipo: 'meta', severidade: 'positivo', titulo: 'Equipe projetada no ritmo da meta', evidencia: `A projeção supera a meta em ${(atual.projecao - atual.metaReceita).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`, impacto: atual.projecao - atual.metaReceita });
  }
  const ultimos = historico.filter((item) => item.realizado > 0).slice(-2);
  if (ultimos.length === 2 && ultimos[0].realizado > 0) {
    const variacao = (ultimos[1].realizado - ultimos[0].realizado) / ultimos[0].realizado;
    if (Math.abs(variacao) >= 0.1) {
      const crescimento = variacao > 0;
      adicionar({ tipo: 'tendencia', severidade: crescimento ? 'positivo' : 'alerta', titulo: crescimento ? 'Faturamento em crescimento recente' : 'Faturamento em queda recente', evidencia: `${Math.abs(variacao * 100).toFixed(1).replace('.', ',')}% em relação ao mês anterior registrado.`, impacto: ultimos[1].realizado - ultimos[0].realizado });
    }
  }
  if (atual.tipo === 'atual' && atual.agendaFutura > 0) {
    adicionar({ tipo: 'agenda', severidade: 'informativo', titulo: 'Receita já reservada na agenda', evidencia: `${atual.atendimentosAgendados} atendimento(s) futuro(s) somam ${atual.agendaFutura.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}; esse valor entra uma vez na projeção.`, impacto: atual.agendaFutura });
  } else if (atual.tipo === 'atual' && atual.projecao > atual.realizado) {
    adicionar({ tipo: 'agenda', severidade: 'alerta', titulo: 'Agenda futura ainda cobre pouco do fechamento', evidencia: 'A maior parte da previsão depende do ritmo histórico, não de horários já reservados.', impacto: atual.projecao - atual.realizado },
      { prioridade: 'media', titulo: 'Ocupar horários disponíveis', descricao: 'Use retornos previstos e a lista de espera antes de abrir novos horários.', aba: 'Retorno previsto' });
  }
  const ocorrenciasDoMes = ocorrencias.filter((item) => item.mes === competencia);
  const invalidos = ocorrenciasDoMes.filter((item) => STATUS_FINAIS_INVALIDOS.has(item.status)).length;
  if (ocorrenciasDoMes.length >= 5 && invalidos / ocorrenciasDoMes.length >= 0.1) {
    adicionar({ tipo: 'perdas', severidade: 'alerta', titulo: 'Cancelamentos ou faltas pressionam a agenda', evidencia: `${invalidos} de ${ocorrenciasDoMes.length} registros do mês terminaram cancelados ou sem comparecimento.`, impacto: null },
      { prioridade: 'media', titulo: 'Confirmar agenda e acionar a lista de espera', descricao: 'Priorize confirmações e ofereça vagas liberadas para reduzir horários ociosos.', aba: 'Lista de espera' });
  }
  const foraDoRitmo = profissionais.filter((item) => item.meta?.receita && item.noRitmo === false);
  if (foraDoRitmo.length) {
    adicionar({ tipo: 'profissionais', severidade: 'alerta', titulo: 'Profissionais abaixo do ritmo individual', evidencia: `${foraDoRitmo.length} profissional(is) têm projeção abaixo da própria meta.`, impacto: null },
      { prioridade: 'alta', titulo: 'Acompanhar metas individuais', descricao: 'Compare ticket, agenda futura e projeção de cada profissional antes de cobrar ações.', aba: 'Ocupação e metas' });
  }
  return { fatores: fatores.slice(0, 8), acoes: acoes.slice(0, 5), geradoPara: corte };
}

/**
 * Projeta faturamento de serviços e revenda para o mês selecionado e os cinco
 * seguintes. Todo valor retornado vem da empresa/unidade recebida pelo servidor.
 */
export function projecaoFaturamento(empresaId, { mes, lojaId = '', horizonte = 6 } = {}, opcoes = {}) {
  const corte = hojeLocal(opcoes);
  const competencia = competenciaValida(mes, corte.slice(0, 7));
  const quantidade = Math.max(1, Math.min(6, Math.round(numero(horizonte, 6))));
  const fatos = fatosDeFaturamento(empresaId, lojaId, opcoes);
  // Para competência futura, o mês em curso continua sendo parcial; ele não
  // pode entrar como se fosse um fechamento completo da série histórica.
  const competenciaHistoricoFinal = competencia > corte.slice(0, 7)
    ? deslocarCompetencia(corte.slice(0, 7), -1)
    : deslocarCompetencia(competencia, -1);
  const historico = Array.from({ length: 6 }, (_, indice) => resumoDaCompetencia(fatos, deslocarCompetencia(competenciaHistoricoFinal, indice - 5), { incluirFuturo: false }));
  // Série completa: do primeiro mês com faturamento (Avec ou Kytto) até o mês em curso.
  const primeiroMes = [...fatos.avec, ...fatos.servicos, ...fatos.revenda].reduce((menor, item) => (!menor || item.mes < menor ? item.mes : menor), '');
  const historicoCompleto = [];
  if (primeiroMes) {
    for (let mesSerie = primeiroMes; mesSerie <= corte.slice(0, 7) && historicoCompleto.length < 240; mesSerie = deslocarCompetencia(mesSerie, 1)) {
      historicoCompleto.push({ ...resumoDaCompetencia(fatos, mesSerie, { incluirFuturo: false }), emCurso: mesSerie === corte.slice(0, 7) });
    }
  }
  // Meses completos: o primeiro fica fora quando o histórico começou no meio do mês.
  const primeiroDia = [...fatos.avec, ...fatos.servicos, ...fatos.revenda].reduce((menor, item) => (!menor || item.dia < menor ? item.dia : menor), '');
  const primeiroParcial = primeiroDia && primeiroDia.slice(8) > '03';
  const mapaRealizado = new Map(historicoCompleto.filter((item) => !item.emCurso && !(primeiroParcial && item.mes === primeiroMes)).map((item) => [item.mes, item.servicosConsolidados]));
  const crescimento = crescimentoAnual(mapaRealizado, deslocarCompetencia(corte.slice(0, 7), -1));
  const fechados = historicoCompleto.filter((item) => !item.emCurso && item.realizado > 0);
  const melhor = fechados.reduce((maior, item) => (!maior || item.realizado > maior.realizado ? item : maior), null);
  const resumoHistorico = {
    primeiroMes: primeiroMes || null,
    meses: historicoCompleto.length,
    totalRealizado: dinheiro(historicoCompleto.reduce((soma, item) => soma + item.realizado, 0)),
    totalAvec: dinheiro(historicoCompleto.reduce((soma, item) => soma + item.historicoAvec, 0)),
    totalKytto: dinheiro(historicoCompleto.reduce((soma, item) => soma + item.servicos + item.revenda, 0)),
    mediaMensal: fechados.length ? dinheiro(fechados.reduce((soma, item) => soma + item.realizado, 0) / fechados.length) : 0,
    melhorMes: melhor ? { mes: melhor.mes, realizado: melhor.realizado } : null,
    ultimoDiaAvec: fatos.ultimoDiaAvec || null,
  };
  const mesesComDados = historico.filter((item) => item.realizado > 0).length;
  const qualidade = { ...nivelConfianca(mesesComDados, historico), mesesAnalisados: historico.length, mesesComDados, mesesNoHistorico: fechados.length, dataCorte: corte, fontes: { servicos: fatos.servicos.length, revenda: fatos.revenda.length, recebimentosAvec: fatos.avec.length, atendimentosAvec: fatos.servicosAvec.length, ultimoDiaAvec: fatos.ultimoDiaAvec || null } };
  const previsoes = Array.from({ length: quantidade }, (_, indice) => {
    const alvo = deslocarCompetencia(competencia, indice);
    return previsaoDaCompetencia(alvo, fatos, historico, metaDaEquipe(empresaId, alvo), { corte, competenciaAtual: corte.slice(0, 7), mapaRealizado, crescimento });
  });
  const atual = previsoes[0];
  const profissionais = previsaoProfissionais(empresaId, competencia, fatos, historico, lojaId);
  const leituras = construirLeiturasGerenciais({ atual, historico, qualidade, profissionais, ocorrencias: fatos.ocorrencias, competencia, corte });
  return {
    mes: competencia,
    horizonte: quantidade,
    geradoEm: iso(agoraMs(opcoes)),
    escopo: { empresaId: String(empresaId), lojaId: lojaId || null, filtroEstritoDeUnidade: Boolean(lojaId) },
    qualidade,
    metodologia: {
      versao: '2.1',
      rotulo: 'Previsão explicável por histórico, agenda, tendência e sazonalidade',
      resumo: 'O realizado de cada mês soma os recebimentos do histórico Avec (até a virada) e, depois dela, os serviços concluídos e a revenda paga no Kytto, sem contar o mesmo dia duas vezes. A base combina o nível dos últimos seis meses fechados ajustado pela sazonalidade do mesmo mês no ano anterior com esse mesmo mês corrigido pelo crescimento anual; respeita a agenda já reservada e ignora o primeiro mês quando ele é parcial. Cenários representam a variação observada; não são garantia de faturamento.',
    },
    atual,
    previsoes,
    historico,
    historicoCompleto,
    resumoHistorico,
    profissionais,
    ...leituras,
  };
}

export function analisarProfissionalProjecao(empresaId, profissionalId, { mes, lojaId = '' } = {}, opcoes = {}) {
  const projecao = projecaoFaturamento(empresaId, { mes, lojaId }, opcoes);
  const id = texto(profissionalId, 100);
  const profissional = (projecao.profissionais || []).find((p) => p.profissionalId === id);
  if (!profissional) {
    throw new CaptacaoError('Profissional não encontrado na competência.', 'PROFISSIONAL_NAO_ENCONTRADO', 404);
  }
  const competencia = projecao.mes;
  const metas = captacao(empresaId).metasProfissionais?.[competencia] || {};
  const metaAtual = metas[id] || null;

  const nome = profissional.nome;
  const tendencia = profissional.tendencia || 'estavel';
  const realizado = profissional.realizado || 0;
  const agenda = profissional.agendaFutura || 0;
  const valorProjecao = profissional.projecao || 0;
  const ticket = profissional.ticketMedio || 0;
  const ocupacao = profissional.ocupacao;
  const concluidos = profissional.atendimentosConcluidos || 0;
  const agendados = profissional.atendimentosAgendados || 0;
  const metaReceitaAtual = profissional.meta?.receita || null;
  const metaAtendimentosAtual = profissional.meta?.atendimentos || null;

  const motivos = [];
  if (tendencia === 'queda') {
    if (agenda === 0) {
      motivos.push({
        fator: 'Agenda futura sem reservas',
        detalhe: `${nome} não possui atendimentos futuros agendados nesta competência (R$ 0,00 agendado), fazendo a projeção depender exclusivamente da produção já realizada sem tração de novas reservas.`
      });
    }
    if (ocupacao !== null && ocupacao !== undefined && ocupacao < 0.25) {
      motivos.push({
        fator: 'Baixa ocupação da capacidade',
        detalhe: `Taxa de ocupação calculada em apenas ${(ocupacao * 100).toFixed(1)}%. A cadeira possui ampla capacidade ociosa de horários úteis que não foram aproveitados.`
      });
    }
    if (ticket > 0 && ticket < 65) {
      motivos.push({
        fator: 'Ticket médio abaixo do potencial',
        detalhe: `O ticket médio atual de R$ ${ticket.toFixed(2).replace('.', ',')} indica concentração em serviços de menor valor unitário, com baixa agregação de combos ou serviços adicionais (barba terapia, sobrancelha, tratamentos).`
      });
    }
    if (concluidos > 0 && agenda === 0) {
      motivos.push({
        fator: 'Falta de pré-agendamento de retorno',
        detalhe: `Os clientes atendidos (${concluidos} concluídos) não saíram com o retorno já agendado no balcão, interrompendo o ciclo de faturamento recorrente.`
      });
    }
  } else if (tendencia === 'crescimento') {
    if (agenda > 0) {
      motivos.push({
        fator: 'Forte carteira de reservas futuras',
        detalhe: `${nome} já conta com R$ ${agenda.toFixed(2).replace('.', ',')} (${agendados} atendimentos) garantidos na agenda futura, impulsionando a projeção para R$ ${valorProjecao.toFixed(2).replace('.', ',')}.`
      });
    }
    if (ticket >= 65) {
      motivos.push({
        fator: 'Ticket médio elevado e saudável',
        detalhe: `Ticket médio de R$ ${ticket.toFixed(2).replace('.', ',')} por atendimento, refletindo excelente mix de serviços e valor agregado por cliente.`
      });
    }
    if (ocupacao !== null && ocupacao !== undefined && ocupacao >= 0.25) {
      motivos.push({
        fator: 'Boa taxa de ocupação da cadeira',
        detalhe: `Ocupação de ${(ocupacao * 100).toFixed(1)}% da capacidade produtiva, demonstrando alta procura e fidelização da carteira.`
      });
    }
  } else {
    motivos.push({
      fator: 'Produção linear e previsível',
      detalhe: `Produção em ritmo regular de atendimentos, com ticket de R$ ${ticket.toFixed(2).replace('.', ',')} e ocupação de ${((ocupacao || 0) * 100).toFixed(1)}%.`
    });
    motivos.push({
      fator: 'Potencial reprimido de expansão',
      detalhe: `Existe espaço livre na agenda para aumentar o volume de atendimentos e trabalhar cross-selling de produtos e serviços para acelerar.`
    });
  }

  const ticketAlvo = ticket > 0 ? Math.max(70, Number((ticket * 1.15).toFixed(2))) : 75;
  const atendAlvo = Math.max(concluidos + agendados + 15, 40);
  let receitaAlvo = Number((atendAlvo * ticketAlvo).toFixed(2));
  if (metaReceitaAtual && metaReceitaAtual > receitaAlvo) {
    receitaAlvo = metaReceitaAtual;
  }

  const alavancas = [
    {
      titulo: '1. Reativação ativa de clientes da carteira',
      acao: `Disparar contato via WhatsApp para clientes atendidos por ${nome} há mais de 25 dias que ainda não retornaram, oferecendo horários exclusivos de preferência.`,
      impacto: '+10 a 15 atendimentos extras no mês.'
    },
    {
      titulo: '2. Elevação do ticket médio (Cross-sell de combos)',
      acao: `Oferecer ativamente serviços complementares (barba terapia, selagem capilar, hidratação ou sobrancelha) e pomadas/produtos de finalização. Meta de ticket de R$ ${ticketAlvo.toFixed(2).replace('.', ',')}.`,
      impacto: `Aumento de R$ ${(ticketAlvo - ticket).toFixed(2).replace('.', ',')} por cliente atendido.`
    },
    {
      titulo: '3. Travamento do próximo retorno no balcão',
      acao: 'Orientar o profissional a fechar cada atendimento já agendando a volta do cliente para 15 a 21 dias antes da saída da barbearia.',
      impacto: 'Garante estabilidade e previsibilidade de agenda nas semanas seguintes.'
    },
    {
      titulo: '4. Preenchimento de horários nobres e dias ociosos',
      acao: 'Estimular o agendamento de clientes nos horários de menor movimento (terça e quarta à tarde) para liberar finais de semana para serviços mais longos e rentáveis.',
      impacto: 'Aumento direto da taxa de ocupação da cadeira.'
    }
  ];

  const textoPlanoSugerido = `PLANO DE AÇÃO DE CRESCIMENTO — ${nome.toUpperCase()} (${competencia})
Meta de Receita: R$ ${receitaAlvo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Meta de Atendimentos: ${atendAlvo} | Ticket Médio Alvo: R$ ${ticketAlvo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

1. FOCO PRINCIPAL:
- ${tendencia === 'queda' ? 'Reverter queda de produção alavancando agenda futura e ticket médio.' : tendencia === 'crescimento' ? 'Manter ritmo de crescimento e consolidar retenção e upsell.' : 'Acelerar ocupação e aumentar o ticket médio por cliente.'}

2. AÇÕES PRÁTICAS DO PROFISSIONAL:
- Pré-agendar o retorno de 100% dos clientes atendidos antes da finalização da comanda.
- Ofertar combo complementar (cabelo + barba terapia / sobrancelha) em pelo menos 1 de cada 3 atendimentos para bater o ticket alvo de R$ ${ticketAlvo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.
- Reativar 5 clientes sumidos da carteira por semana via WhatsApp.

3. ROTINA E HORÁRIOS:
- Preencher horários ociosos entre terça e quinta-feira para elevar a taxa de ocupação.
- Oferecer produtos de acabamento (pomada modeladora / óleo para barba) no pós-atendimento.

4. ACOMPANHAMENTO:
- Revisão semanal de metas toda segunda-feira com o gestor da unidade.`;

  return {
    profissionalId: id,
    nome,
    mes: competencia,
    tendencia,
    metricas: {
      realizado,
      agendaFutura: agenda,
      projecao: valorProjecao,
      ticketMedio: ticket,
      ocupacao,
      atendimentosConcluidos: concluidos,
      atendimentosAgendados: agendados,
      capacidadeMinutos: profissional.capacidadeMinutos,
      minutosAgendados: profissional.minutosAgendados,
      diferencaMeta: profissional.diferencaMeta,
      noRitmo: profissional.noRitmo,
    },
    metaAtual: {
      receita: metaReceitaAtual,
      atendimentos: metaAtendimentosAtual,
      planoAcao: metaAtual?.planoAcao || '',
      diagnostico: metaAtual?.diagnostico || '',
      tendenciaObservada: metaAtual?.tendenciaObservada || '',
      atualizadoEm: metaAtual?.atualizadoEm || null,
    },
    diagnostico: {
      titulo: tendencia === 'queda' ? `Diagnóstico de Desempenho: Tendência de Queda (${nome})` : tendencia === 'crescimento' ? `Diagnóstico de Desempenho: Tendência de Crescimento (${nome})` : `Diagnóstico de Desempenho: Ritmo Estável (${nome})`,
      tendencia,
      motivos,
    },
    planoAcao: {
      titulo: `Plano de Ação Sugerido para Crescimento — ${nome}`,
      alavancas,
      metasSugeridas: {
        receita: receitaAlvo,
        atendimentos: atendAlvo,
        ticketMedio: ticketAlvo,
      },
      textoPlanoSugerido,
    },
  };
}


// ---------------------------------------------------------------------------
// IA QUE VENDE (onda 2): dados que a atendente do WhatsApp pode usar, sempre
// pelo telefone da própria conversa e sem expor valores gastos.
// ---------------------------------------------------------------------------

function agendamentosConcluidosDoTelefone(empresaId, telefone, { desde = 0 } = {}) {
  const chave = telefoneChave(telefone);
  if (!chave) return [];
  return barbearia.listarAgendamentos(empresaId, {})
    .filter((item) => item.status === 'concluido' && telefoneChave(item.clienteTelefone) === chave)
    .filter((item) => new Date(item.dataHora).valueOf() >= desde)
    .sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));
}

/** Plano do próprio cliente (pedido por ele): nome, saldo do ciclo e validade. */
export function perfilDoTelefone(empresaId, telefone, opcoes = {}) {
  const chave = telefoneChave(telefone);
  if (!chave) return {perfil:'telefone_invalido',clienteEncontrado:false,pacotes:[]};
  const clientes = clientesKytto.listarClientes(String(empresaId)).filter(item=>telefoneChave(item.telefone)===chave && !item.anonimizadoEm);
  if (clientes.length > 1) return {perfil:'cadastro_ambiguo',clienteEncontrado:false,pacotes:[],orientacao:'A equipe precisa conferir os cadastros deste telefone antes de informar benefícios.'};
  const cliente = clientes[0];
  const atendimentos=agendamentosConcluidosDoTelefone(empresaId,telefone);
  const comandas=cliente ? barbearia.listarComandasBarbearia(empresaId).filter(c=>c.clienteId===String(cliente.id)&&['paga','em_conta'].includes(c.status)) : [];
  const historico=cliente ? barbearia.listarHistoricoAtendimentos(empresaId,{clienteId:cliente.id}).filter(a=>a.status==='concluido') : [];
  const hoje=dataLocal(agoraMs(opcoes));
  const dias=new Set([...atendimentos,...comandas,...historico].map(a=>{
    const data=a.dataAgenda||a.dataHora||a.fechadaEm||a.criadoEm;
    if(!data)return '';return /^\d{4}-\d{2}-\d{2}$/.test(String(data)) ? data : Number.isFinite(new Date(data).valueOf()) ? dataLocal(new Date(data).valueOf()) : '';
  }).filter(d=>d&&d<=hoje));
  const visitas = dias.size;
  const pacotes = cliente ? barbearia.listarAssinaturas(empresaId).filter(item=>item.clienteId===String(cliente.id)).map(item=>{
    const r=resumoAssinatura(empresaId,item.id,opcoes);
    const reservadas=reservasAssinatura(empresaId,item.id,r,opcoes),disponiveis=Math.max(0,r.sessoesRestantes-reservadas);
    return {assinaturaId:item.id,plano:r.plano?.nome || 'Pacote',status:item.status,situacao:r.situacaoPagamento,
      sessoesNoCiclo:r.limiteNoCiclo,usadasNoCiclo:r.usosNoCiclo,restantes:r.sessoesRestantes,pagoAte:r.pagoAte,
      proximaRenovacao:r.pagoAte || r.ciclo.inicio,regraRenovacao:r.plano?.regraRenovacao || 'dias',
      sessoesReservadas:reservadas,disponiveisParaAgendar:disponiveis,
      utilizavel:item.status==='ativa'&&r.situacaoPagamento==='em_dia'&&disponiveis>0,
      servicosIncluidos:(r.plano?.servicosIds||[]).map(id=>barbearia.listarServicos(empresaId,{incluirInativos:true}).find(s=>s.id===id)?.nome).filter(Boolean)};
  }) : [];
  const ativo=pacotes.find(p=>p.utilizavel),vencido=pacotes.find(p=>p.status==='ativa'&&['inadimplente','encerrada'].includes(p.situacao));
  const emDia=pacotes.find(p=>p.status==='ativa'&&p.situacao==='em_dia');
  const perfil=ativo?'pacote_ativo':emDia?(emDia.restantes>0?'pacote_reservado':'pacote_esgotado'):vencido?'pacote_vencido':pacotes.some(p=>p.status==='pausada')?'pacote_pausado':pacotes.some(p=>p.status==='ativa'||p.status==='pendente_ativacao')?'pacote_pendente':visitas>=2?'recorrente':cliente||visitas?'avulso':'novo';

  // Aprender sempre com padrão do cliente (barbeiro preferido, período habitual e serviços mais frequentes)
  const historicoVisitas = [...atendimentos, ...comandas, ...historico];
  const contagemProf = {};
  const contagemHoras = { madrugada: 0, manha: 0, tarde: 0, noite: 0 };
  const contagemServicos = {};
  for (const item of historicoVisitas) {
    const prof = item.profissionalNome || item.profissional || '';
    if (prof) contagemProf[prof] = (contagemProf[prof] || 0) + 1;
    const srv = item.servicoNome || item.servico || item.descricao || '';
    if (srv) contagemServicos[srv] = (contagemServicos[srv] || 0) + 1;
    const horaStr = item.horaLocal || (item.dataHora ? String(item.dataHora).slice(11, 16) : '');
    if (/^\d{2}:\d{2}$/.test(horaStr)) {
      const h = Number(horaStr.split(':')[0]);
      if (h < 6) contagemHoras.madrugada++;
      else if (h < 12) contagemHoras.manha++;
      else if (h < 18) contagemHoras.tarde++;
      else contagemHoras.noite++;
    }
  }
  const profPreferido = Object.entries(contagemProf).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const periodoPreferido = Object.entries(contagemHoras).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const servicoHabitual = Object.entries(contagemServicos).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      const padraoCliente = {
    profissionalPreferido: profPreferido,
    periodoPreferido,
    servicoHabitual,
    visitasTotais: visitas,
  };
  let orientacaoPadrao = null;
  if (profPreferido) {
    orientacaoPadrao = `Padrão do cliente: costuma ser atendido por ${profPreferido}${periodoPreferido ? ` no período da ${periodoPreferido}` : ''}. Priorize essa preferência ao sugerir horários.`;
  }

  return {
    perfil,
    clienteEncontrado: Boolean(cliente),
    visitasConhecidas: visitas,
    pacotes,
    padraoCliente,
    orientacao: perfil === 'pacote_vencido' ? 'Renove com a equipe para voltar a usar benefícios e agendamentos pelo pacote.' : perfil === 'pacote_esgotado' ? 'As sessões deste ciclo foram utilizadas. Consulte a equipe sobre renovação ou atendimento avulso.' : orientacaoPadrao,
  };
}

export function planoDoTelefone(empresaId, telefone, opcoes = {}) {
  const perfil=perfilDoTelefone(empresaId,telefone,opcoes);
  const p=perfil.pacotes.find(item=>item.utilizavel)||perfil.pacotes.find(item=>item.status==='ativa'&&item.situacao==='em_dia')||perfil.pacotes.find(item=>['ativa','pausada'].includes(item.status));
  if (!p) return null;
  return {...p,perfil:perfil.perfil,pagamentoEmDia:p.situacao==='em_dia',cicloTermina:p.proximaRenovacao ? dataLocal(new Date(p.proximaRenovacao).valueOf()):null,orientacao:perfil.orientacao};
}

/**
 * O clube compensa para este cliente? Compara a frequência dos últimos 60 dias
 * com o plano mais barato. Devolve só frequência e o plano: a atendente não
 * fala de quanto o cliente gastou.
 */
export function clubeParaTelefone(empresaId, telefone, { dias = 60 } = {}, opcoes = {}) {
  const ms = agoraMs(opcoes);
  const existente=planoDoTelefone(empresaId,telefone,opcoes);
  if(existente) return {elegivel:false,motivo:existente.pagamentoEmDia ? 'ja_assinante' : 'renovacao_pendente'};
  const visitas = agendamentosConcluidosDoTelefone(empresaId, telefone, { desde: ms - dias * DIA_MS });
  const planos = barbearia.listarPlanos(empresaId).filter((plano) => plano.preco > 0);
  if (!planos.length) return { elegivel: false, motivo: 'sem_plano' };
  if (visitas.length < 2) return { elegivel: false, motivo: 'poucas_visitas' };
  const meses = Math.max(1, dias / 30);
  const gastoMensal = visitas.reduce((soma, item) => soma + Number(item.valorRecebido || item.valor || 0), 0) / meses;
  const servicosDoCliente = new Set(visitas.map((item) => item.servicoId));
  const opcoesPlano = planos
    .map((plano) => ({ plano, mensal: precoMensal(plano), cobre: !(plano.servicosIds || []).length || (plano.servicosIds || []).some((id) => servicosDoCliente.has(id)) }))
    .filter((item) => item.cobre && item.mensal < gastoMensal)
    .sort((a, b) => a.mensal - b.mensal);
  if (!opcoesPlano.length) return { elegivel: false, motivo: 'plano_nao_compensa' };
  const melhor = opcoesPlano[0];
  return {
    elegivel: true,
    visitasPorMes: Number((visitas.length / meses).toFixed(1)),
    plano: {
      nome: melhor.plano.nome,
      precoMensal: melhor.mensal,
      sessoesPorCiclo: melhor.plano.sessoesIncluidas,
      servicos: (melhor.plano.servicosIds || []).map((id) => barbearia.listarServicos(empresaId, { incluirInativos: true }).find((s) => s.id === id)?.nome).filter(Boolean),
    },
  };
}

const PALAVRAS_POR_SERVICO = [
  [/barba|barbo/i, ['barba', 'óleo', 'balm']],
  [/hidrata|progressiva|selagem|luzes|nevou|platin|descolor|pigment/i, ['shampoo', 'máscara', 'condicionador']],
  [/corte|fade|degrad|pezinho|máquina|maquina/i, ['pomada', 'cera', 'modelador']],
  [/sobrancelha|pele|limpeza/i, ['hidratante', 'facial']],
];

/** Último serviço concluído (até 14 dias) e as palavras para buscar produtos ligados a ele. */
export function sugestaoPosServico(empresaId, telefone, { dias = 14 } = {}, opcoes = {}) {
  const ultimo = agendamentosConcluidosDoTelefone(empresaId, telefone, { desde: agoraMs(opcoes) - dias * DIA_MS })[0];
  if (!ultimo) return null;
  const servico = barbearia.listarServicos(empresaId, { incluirInativos: true }).find((item) => item.id === ultimo.servicoId);
  if (!servico) return null;
  const texto = `${servico.nome} ${servico.categoria || ''}`;
  const palavras = PALAVRAS_POR_SERVICO.find(([padrao]) => padrao.test(texto))?.[1] || ['cuidado'];
  return { servico: servico.nome, data: ultimo.dataAgenda, palavras };
}


// ---------------------------------------------------------------------------
// NPS PÓS-ATENDIMENTO
// O cliente avalia o atendimento concluído com o código + telefone da reserva
// (nada pessoal na URL). Uma avaliação por atendimento, sempre dentro do sistema.
// ---------------------------------------------------------------------------
const PRAZO_AVALIACAO_DIAS = 30;

/**
 * Agendamento criado no balcão/admin não tem código; o link de avaliação (e o
 * autoatendimento) precisa de um. Gera um código único só quando falta.
 */
export function garantirCodigoConfirmacao(empresaId, agendamentoId) {
  const estado = db().barbearias?.[String(empresaId)];
  const atual = estado?.agendamentos?.[String(agendamentoId)];
  if (!atual) return null;
  if (texto(atual.codigoConfirmacao, 20)) return { ...atual };
  const usados = new Set(Object.values(estado.agendamentos).map((item) => String(item.codigoConfirmacao || '').toUpperCase()));
  let codigo = '';
  do { codigo = crypto.randomBytes(4).toString('hex').toUpperCase(); } while (usados.has(codigo));
  atual.codigoConfirmacao = codigo;
  save();
  return { ...atual };
}

export function registrarAvaliacao(empresaId, { codigo, telefone, nota, comentario, lojaId } = {}, opcoes = {}) {
  const valor = Number(nota);
  if (!Number.isInteger(valor) || valor < 0 || valor > 10) throw new CaptacaoError('Escolha uma nota de 0 a 10.', 'NOTA_INVALIDA');
  const agendamento = localizarPorCodigo(empresaId, codigo, telefone, lojaId);
  if (agendamento.status !== 'concluido') throw new CaptacaoError('A avaliação abre depois que o atendimento é concluído.', 'ATENDIMENTO_NAO_CONCLUIDO', 409);
  const ms = agoraMs(opcoes);
  if (ms - new Date(agendamento.dataHora).valueOf() > PRAZO_AVALIACAO_DIAS * DIA_MS) throw new CaptacaoError('O prazo para avaliar este atendimento terminou.', 'AVALIACAO_EXPIRADA', 409);
  const estado = captacao(empresaId);
  const existente = estado.avaliacoes[agendamento.id];
  if (existente) return { repetida: true, nota: existente.nota };
  estado.avaliacoes[agendamento.id] = {
    id: agendamento.id,
    agendamentoId: agendamento.id,
    nota: valor,
    comentario: texto(comentario, 600),
    profissionalId: agendamento.profissionalId || '',
    servicoId: agendamento.servicoId || '',
    lojaId: agendamento.lojaId || '',
    clienteNome: nomeCurto(agendamento.clienteNome),
    dataAtendimento: agendamento.dataAgenda || dataLocal(new Date(agendamento.dataHora).valueOf()),
    criadoEm: iso(ms),
  };
  save();
  return { repetida: false, nota: valor };
}

function categoriaNps(nota) {
  if (nota >= 9) return 'promotor';
  if (nota >= 7) return 'neutro';
  return 'detrator';
}

function resumoNps(lista) {
  const total = lista.length;
  const promotores = lista.filter((item) => item.nota >= 9).length;
  const detratores = lista.filter((item) => item.nota <= 6).length;
  return {
    respostas: total,
    promotores,
    neutros: total - promotores - detratores,
    detratores,
    nps: total ? Math.round(((promotores - detratores) / total) * 100) : null,
    media: total ? Number((lista.reduce((soma, item) => soma + item.nota, 0) / total).toFixed(1)) : null,
  };
}

export function painelNps(empresaId, { inicio, fim, lojaId = '' } = {}) {
  const de = /^\d{4}-\d{2}-\d{2}$/.test(String(inicio || '')) ? inicio : '0000-01-01';
  const ate = /^\d{4}-\d{2}-\d{2}$/.test(String(fim || '')) ? fim : '9999-12-31';
  // A agenda é a fonte do denominador; o helper legado inclui registros sem
  // loja mesmo quando filtrado, portanto aplicamos escopo ESTRITO aqui.
  const concluidos = barbearia.listarAgendamentos(empresaId, { status: 'concluido' })
    .filter((item) => !lojaId || item.lojaId === lojaId)
    .filter((item) => {
      const dia = String(item.dataAgenda || item.dataHora || '').slice(0, 10);
      return dia >= de && dia <= ate;
    });
  const lista = Object.values(captacao(empresaId).avaliacoes)
    .filter((item) => item.dataAtendimento >= de && item.dataAtendimento <= ate)
    .filter((item) => !lojaId || item.lojaId === lojaId)
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
  const idsConcluidos = new Set(concluidos.map((item) => item.id));
  const respondidosConcluidos = lista.filter((item) => idsConcluidos.has(item.agendamentoId)).length;
  const distribuicao = Array.from({ length: 11 }, (_, nota) => ({ nota, respostas: lista.filter((item) => item.nota === nota).length }));
  const meses = [...new Set(lista.map((item) => item.dataAtendimento.slice(0, 7)))].sort().slice(-12);
  const evolucaoMensal = meses.map((mes) => ({ mes, ...resumoNps(lista.filter((item) => item.dataAtendimento.startsWith(mes))) }));
  const profissionais = mapaPorId(barbearia.listarProfissionais(empresaId, { incluirInativos: true }));
  const servicos = mapaPorId(barbearia.listarServicos(empresaId, { incluirInativos: true }));
  const porProfissional = [...new Set(lista.map((item) => item.profissionalId))].map((id) => ({
    profissionalId: id,
    nome: profissionais.get(id)?.nome || 'Equipe',
    ...resumoNps(lista.filter((item) => item.profissionalId === id)),
  })).sort((a, b) => (b.nps ?? -999) - (a.nps ?? -999));
  return {
    ...resumoNps(lista),
    atendimentosConcluidos: concluidos.length,
    taxaResposta: concluidos.length ? Number((100 * respondidosConcluidos / concluidos.length).toFixed(1)) : null,
    distribuicao,
    evolucaoMensal,
    porProfissional,
    comentarios: lista.filter((item) => item.comentario).slice(0, 30).map((item) => ({
      nota: item.nota,
      categoria: categoriaNps(item.nota),
      comentario: item.comentario,
      profissional: profissionais.get(item.profissionalId)?.nome || '',
      servico: servicos.get(item.servicoId)?.nome || '',
      dataAtendimento: item.dataAtendimento,
    })),
  };
}


// ---------------------------------------------------------------------------
// CAPTAÇÃO POR CANAL (fase 3)
// O link público aceita ?canal= (ou utm_source): google, instagram, whatsapp,
// indicacao... Guardamos só o nome do canal e da campanha por agendamento, para
// medir de onde vêm os clientes novos. Nada pessoal.
// ---------------------------------------------------------------------------
const CANAIS_CONHECIDOS = new Map([
  ['google', 'Google'], ['gbp', 'Google'], ['maps', 'Google'], ['googlemaps', 'Google'],
  ['instagram', 'Instagram'], ['ig', 'Instagram'], ['facebook', 'Facebook'], ['fb', 'Facebook'],
  ['whatsapp', 'WhatsApp'], ['wa', 'WhatsApp'], ['tiktok', 'TikTok'], ['site', 'Site'],
  ['indicacao', 'Indicação'], ['qrcode', 'QR code'], ['qr', 'QR code'],
]);

export function normalizarCanal(valor) {
  const bruto = texto(valor, 40).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!bruto) return '';
  return CANAIS_CONHECIDOS.get(bruto) || (bruto.length <= 24 ? bruto : '');
}

export function registrarCanalAgendamento(empresaId, agendamentoId, { canal, campanha } = {}) {
  const nome = normalizarCanal(canal);
  if (!nome || !agendamentoId) return null;
  const estado = captacao(empresaId);
  if (estado.canais[agendamentoId]) return estado.canais[agendamentoId];
  estado.canais[agendamentoId] = { canal: nome, campanha: texto(campanha, 60).replace(/[^\p{L}\p{N} _-]/gu, ''), em: new Date().toISOString() };
  save();
  return estado.canais[agendamentoId];
}

/** Agendamentos, clientes novos, concluídos e receita por canal no período. */
// Valor do atendimento: o maior entre o preço e o recebido no dia (o sinal e o
// cashback, pagos em outro momento, não reduzem o valor gerado pelo canal).
function valorDoAtendimento(empresaId, item) {
  const recebimento = barbearia.recebimentoAgendamentoVerificado(empresaId, item);
  return recebimento ? dinheiro(Math.max(Number(item.valor || 0), Number(recebimento.valor || 0))) : 0;
}

export function painelCanais(empresaId, { inicio, fim, lojaId = '' } = {}) {
  const de = /^\d{4}-\d{2}-\d{2}$/.test(String(inicio || '')) ? inicio : '0000-01-01';
  const ate = /^\d{4}-\d{2}-\d{2}$/.test(String(fim || '')) ? fim : '9999-12-31';
  const canais = captacao(empresaId).canais;
  const todos = barbearia.listarAgendamentos(empresaId, {}).filter((item) => !lojaId || item.lojaId === lojaId);
  // Primeiro agendamento de cada telefone: define quem é cliente novo.
  const primeiro = new Map();
  for (const item of [...todos].sort((a, b) => String(a.dataHora).localeCompare(String(b.dataHora)))) {
    const chave = telefoneChave(item.clienteTelefone) || `id:${item.clienteId || item.id}`;
    if (!primeiro.has(chave)) primeiro.set(chave, item.id);
  }
  const linhas = new Map();
  for (const item of todos) {
    const dia = item.dataAgenda || String(item.dataHora).slice(0, 10);
    if (dia < de || dia > ate) continue;
    const nome = canais[item.id]?.canal
      || (item.origem === 'whatsapp_ia' ? 'WhatsApp (IA)' : item.origem === 'agendamento_online' ? 'Link direto' : 'Balcão / equipe');
    const linha = linhas.get(nome) || { canal: nome, agendamentos: 0, clientesNovos: 0, concluidos: 0, cancelados: 0, receita: 0 };
    linha.agendamentos += 1;
    const chave = telefoneChave(item.clienteTelefone) || `id:${item.clienteId || item.id}`;
    if (primeiro.get(chave) === item.id) linha.clientesNovos += 1;
    if (item.status === 'concluido') { linha.concluidos += 1; linha.receita = dinheiro(linha.receita + valorDoAtendimento(empresaId, item)); }
    if (['cancelado', 'nao_compareceu'].includes(item.status)) linha.cancelados += 1;
    linhas.set(nome, linha);
  }
  const lista = [...linhas.values()].sort((a, b) => b.agendamentos - a.agendamentos);
  return {
    canais: lista,
    total: lista.reduce((soma, item) => soma + item.agendamentos, 0),
    clientesNovos: lista.reduce((soma, item) => soma + item.clientesNovos, 0),
  };
}

// ---------------------------------------------------------------------------
// RECEITA ATRIBUÍDA À IA E À CAPTAÇÃO (fase 4)
// Atendimentos que nasceram de uma ação automática: marcados pela IA no
// WhatsApp, vindos da lista de espera, de indicação ou de quem voltou depois do
// convite de retorno. Conta só o que foi concluído.
// ---------------------------------------------------------------------------
export function painelReceitaIa(empresaId, { inicio, fim, lojaId = '' } = {}) {
  const de = /^\d{4}-\d{2}-\d{2}$/.test(String(inicio || '')) ? inicio : '0000-01-01';
  const ate = /^\d{4}-\d{2}-\d{2}$/.test(String(fim || '')) ? fim : '9999-12-31';
  const estado = captacao(empresaId);
  const indicados = new Set(Object.values(estado.indicacoes).map((item) => item.agendamentoId).filter(Boolean));
  const daEspera = new Set(Object.values(estado.listaEspera).filter((item) => item.status === 'agendado').map((item) => `${telefoneChave(item.telefone)}|${item.data}`));
  let totalUnico = 0;
  const linhas = {
    whatsapp_ia: { fonte: 'Atendente IA no WhatsApp', agendamentos: 0, concluidos: 0, receita: 0 },
    lista_espera: { fonte: 'Lista de espera (vaga aproveitada)', agendamentos: 0, concluidos: 0, receita: 0 },
    indicacao: { fonte: 'Indique um amigo', agendamentos: 0, concluidos: 0, receita: 0 },
  };
  for (const item of barbearia.listarAgendamentos(empresaId, {})) {
    if (lojaId && item.lojaId !== lojaId) continue;
    const dia = item.dataAgenda || String(item.dataHora).slice(0, 10);
    if (dia < de || dia > ate) continue;
    const fontes = [];
    if (item.origem === 'whatsapp_ia') fontes.push('whatsapp_ia');
    if (daEspera.has(`${telefoneChave(item.clienteTelefone)}|${dia}`)) fontes.push('lista_espera');
    if (indicados.has(item.id)) fontes.push('indicacao');
    for (const fonte of fontes) {
      const linha = linhas[fonte];
      linha.agendamentos += 1;
      if (item.status === 'concluido') { linha.concluidos += 1; linha.receita = dinheiro(linha.receita + valorDoAtendimento(empresaId, item)); }
    }
    // Um atendimento com duas fontes (ex.: indicação marcada pela IA) conta uma vez no total.
    if (fontes.length && item.status === 'concluido') totalUnico = dinheiro(totalUnico + valorDoAtendimento(empresaId, item));
  }
  const lista = Object.values(linhas);
  return { fontes: lista, receitaTotal: totalUnico };
}

// ---------------------------------------------------------------------------
// COMPARATIVO POR UNIDADE (fase 5 — multiunidade)
// Mesma régua para todas as unidades da empresa no período: volume, conclusão,
// faltas, valor atendido, ticket médio, ocupação da agenda e NPS.
// ---------------------------------------------------------------------------
export function comparativoUnidades(empresaId, { inicio, fim } = {}) {
  const de = /^\d{4}-\d{2}-\d{2}$/.test(String(inicio || '')) ? inicio : '0000-01-01';
  const ate = /^\d{4}-\d{2}-\d{2}$/.test(String(fim || '')) ? fim : '9999-12-31';
  const avaliacoes = Object.values(captacao(empresaId).avaliacoes);
  const porLoja = new Map();
  for (const item of barbearia.listarAgendamentos(empresaId, {})) {
    const dia = item.dataAgenda || String(item.dataHora).slice(0, 10);
    if (dia < de || dia > ate) continue;
    const lojaId = item.lojaId || '';
    const linha = porLoja.get(lojaId) || { lojaId, agendamentos: 0, concluidos: 0, faltas: 0, cancelados: 0, valorAtendido: 0, clientes: new Set() };
    linha.agendamentos += 1;
    if (item.status === 'concluido') { linha.concluidos += 1; linha.valorAtendido = dinheiro(linha.valorAtendido + valorDoAtendimento(empresaId, item)); }
    if (item.status === 'nao_compareceu') linha.faltas += 1;
    if (item.status === 'cancelado') linha.cancelados += 1;
    linha.clientes.add(telefoneChave(item.clienteTelefone) || item.clienteId || item.id);
    porLoja.set(lojaId, linha);
  }
  const unidades = [...porLoja.values()].map((linha) => {
    const notas = avaliacoes.filter((a) => (a.lojaId || '') === linha.lojaId && a.dataAtendimento >= de && a.dataAtendimento <= ate);
    const promotores = notas.filter((a) => a.nota >= 9).length;
    const detratores = notas.filter((a) => a.nota <= 6).length;
    let ocupacao = null;
    try { ocupacao = ocupacaoAgenda(empresaId, { inicio: de === '0000-01-01' ? undefined : de, fim: ate === '9999-12-31' ? undefined : ate, lojaId: linha.lojaId }).ocupacaoGeral; } catch (_) { ocupacao = null; }
    return {
      lojaId: linha.lojaId,
      agendamentos: linha.agendamentos,
      concluidos: linha.concluidos,
      taxaConclusao: linha.agendamentos ? Number((linha.concluidos / linha.agendamentos).toFixed(4)) : 0,
      taxaFalta: linha.agendamentos ? Number((linha.faltas / linha.agendamentos).toFixed(4)) : 0,
      cancelados: linha.cancelados,
      clientesUnicos: linha.clientes.size,
      valorAtendido: linha.valorAtendido,
      ticketMedio: linha.concluidos ? dinheiro(linha.valorAtendido / linha.concluidos) : 0,
      ocupacao,
      nps: notas.length ? Math.round(((promotores - detratores) / notas.length) * 100) : null,
      respostasNps: notas.length,
    };
  }).sort((a, b) => b.valorAtendido - a.valorAtendido);
  return { unidades, total: { agendamentos: unidades.reduce((s, u) => s + u.agendamentos, 0), valorAtendido: dinheiro(unidades.reduce((s, u) => s + u.valorAtendido, 0)) } };
}

// ---------------------------------------------------------------------------
// MINHA CONTA (app do cliente)
// O cliente prova que é ele com o código de um agendamento + o telefone (a
// mesma regra do autoatendimento). Devolve só os dados desse telefone.
// ---------------------------------------------------------------------------
export function minhaConta(empresaId, { codigo, telefone, lojaId = '' } = {}, opcoes = {}) {
  consultarAgendamentoCliente(empresaId, { codigo, telefone, lojaId }, opcoes);
  const chave = telefoneChave(telefone);
  const ms = agoraMs(opcoes);
  const servicos = mapaPorId(barbearia.listarServicos(empresaId, { incluirInativos: true }));
  const profissionais = mapaPorId(barbearia.listarProfissionais(empresaId, { incluirInativos: true }));
  const doTelefone = barbearia.listarAgendamentos(empresaId, {})
    .filter((item) => telefoneChave(item.clienteTelefone) === chave)
    // Mesma regra do autoatendimento: só a unidade do link (lojaId obrigatório).
    .filter((item) => String(item.lojaId || '') === String(lojaId));
  const resumo = (item) => ({
    codigo: item.codigoConfirmacao || null,
    status: item.status,
    dataAgenda: item.dataAgenda,
    horaLocal: item.horaLocal,
    servico: servicos.get(item.servicoId)?.nome || 'Atendimento',
    profissional: profissionais.get(item.profissionalId)?.nome || '',
  });
  const proximos = doTelefone
    .filter((item) => STATUS_ATIVOS.has(item.status) && new Date(item.dataHora).valueOf() > ms)
    .sort((a, b) => String(a.dataHora).localeCompare(String(b.dataHora)))
    .slice(0, 5).map(resumo);
  const avaliacoes = captacao(empresaId).avaliacoes;
  const paraAvaliar = doTelefone
    .filter((item) => item.status === 'concluido' && !avaliacoes[item.id] && ms - new Date(item.dataHora).valueOf() <= 30 * DIA_MS && item.codigoConfirmacao)
    .sort((a, b) => String(b.dataHora).localeCompare(String(a.dataHora)))[0];
  const visitas = doTelefone.filter((item) => item.status === 'concluido').length;
  return {
    nome: nomeCurto(doTelefone[0]?.clienteNome),
    visitas,
    proximos,
    paraAvaliar: paraAvaliar ? resumo(paraAvaliar) : null,
    plano: planoDoTelefone(empresaId, telefone, opcoes),
    codigoIndicacao: (() => {
      const cliente = clientesKytto.listarClientes(String(empresaId)).find((item) => telefoneChave(item.telefone) === chave);
      try { return cliente ? codigoIndicacaoCliente(empresaId, cliente.id).codigo : null; } catch (_) { return null; }
    })(),
  };
}

/** Valida explicitamente uma reserva pelo pacote, inclusive na data futura. */
export function validarAgendamentoComPlano(empresaId, agendamento, opcoes={}) {
  const assinatura=assinaturaQueCobre(empresaId,agendamento,{...opcoes,agora:new Date(agendamento.dataHora)});
  if(!assinatura)throw new CaptacaoError('Cliente sem pacote elegível para este serviço.','PLANO_INDISPONIVEL',409);
  const futuro=resumoAssinatura(empresaId,assinatura.assinatura.id,{...opcoes,agora:new Date(agendamento.dataHora)});
  if(resumoAssinatura(empresaId,assinatura.assinatura.id,opcoes).situacaoPagamento!=='em_dia'||futuro.situacaoPagamento!=='em_dia'||assinatura.assinatura.status!=='ativa')throw new CaptacaoError('Renove o pacote para agendar nesta data. Você pode optar por um atendimento avulso.','PLANO_VENCIDO',409);
  const reservas=reservasAssinatura(empresaId,assinatura.assinatura.id,futuro,opcoes);
  if(futuro.sessoesRestantes<=reservas)throw new CaptacaoError('Todas as sessões disponíveis deste ciclo já foram usadas ou reservadas.','LIMITE_DO_CICLO',409);
  return assinatura.assinatura.id;
}

/** Reservas de agenda e comanda compartilham o mesmo saldo, sem contar a visita duas vezes. */
export function reservasAssinatura(empresaId, assinaturaId, resumo, opcoes={}) {
  const consumidos=new Set((resumo.usosDoCiclo||[]).map(u=>u.agendamentoId));
  const inicio=new Date(resumo.ciclo.inicio).valueOf(),fim=new Date(resumo.ciclo.fim).valueOf();
  const ids=new Set(barbearia.listarAgendamentos(empresaId).filter(a=>a.id!==opcoes.ignorarAgendamentoId&&a.assinaturaId===assinaturaId&&['agendado','confirmado','em_atendimento'].includes(a.status)&&!consumidos.has(a.id)&&new Date(a.dataHora).valueOf()>=inicio&&new Date(a.dataHora).valueOf()<fim).map(a=>a.id));
  let total=ids.size;const pareados=new Set();
  for(const item of barbearia.itensPlanoNaoConsumidos(empresaId)){
    if(item.assinaturaId!==assinaturaId||item.comandaId===opcoes.ignorarComandaId)continue;
    if(item.agendamentoId&&ids.has(item.agendamentoId)&&!pareados.has(item.agendamentoId)){pareados.add(item.agendamentoId);continue;}
    total++;
  }
  return total;
}
