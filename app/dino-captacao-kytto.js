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

function cicloAtual(assinatura, plano, ms) {
  const inicio = new Date(assinatura.inicio).valueOf();
  const dias = Math.max(1, numero(plano?.validadeDias, 30));
  if (!Number.isFinite(inicio) || ms < inicio) return { indice: 0, inicio: Number.isFinite(inicio) ? inicio : ms, fim: (Number.isFinite(inicio) ? inicio : ms) + dias * DIA_MS };
  const indice = Math.floor((ms - inicio) / (dias * DIA_MS));
  const comeco = inicio + indice * dias * DIA_MS;
  return { indice, inicio: comeco, fim: comeco + dias * DIA_MS };
}

/**
 * Até quando a assinatura está paga. Sem pagamento registrado vale o 1º ciclo
 * quando a ativação confirmou o pagamento; senão, nada está pago ainda.
 */
function pagoAteMs(assinatura, plano, controle) {
  if (controle.pagoAte) return new Date(controle.pagoAte).valueOf();
  const inicio = new Date(assinatura.inicio).valueOf();
  if (!Number.isFinite(inicio)) return null;
  return assinatura.pagamentoConfirmado ? inicio + Math.max(1, numero(plano?.validadeDias, 30)) * DIA_MS : null;
}

function situacaoPagamento(empresaId, assinatura, plano, controle, ms) {
  if (assinatura.status !== 'ativa') return assinatura.status;
  const carencia = captacao(empresaId).configuracao.carenciaInadimplenciaDias * DIA_MS;
  const pagoAte = pagoAteMs(assinatura, plano, controle);
  if (pagoAte === null) return 'aguardando_pagamento';
  return ms <= pagoAte + carencia ? 'em_dia' : 'inadimplente';
}

/** Usos e pagamentos completos de uma assinatura (base da comissão sobre plano). */
export function movimentosAssinatura(empresaId, assinaturaId) {
  const controle = controleAssinatura(empresaId, String(assinaturaId));
  return { usos: controle.usos.map((uso) => ({ ...uso })), pagamentos: controle.pagamentos.map((pag) => ({ ...pag })) };
}

export function resumoAssinatura(empresaId, assinaturaId, opcoes = {}) {
  const assinatura = barbearia.listarAssinaturas(empresaId).find((item) => item.id === String(assinaturaId));
  if (!assinatura) return null;
  const plano = barbearia.listarPlanos(empresaId, { incluirInativos: true }).find((item) => item.id === assinatura.planoId) || null;
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
  controle.pagoAte = iso(base + dias * DIA_MS);
  controle.pagamentos.push({ id: novoId('asspag'), valor, meio: texto(dados.meio, 40) || 'pix', referencia, periodoAte: controle.pagoAte, registradoEm: iso(agoraMs(opcoes)), responsavel: texto(dados.usuario, 120) || null });
  controle.pagamentos = controle.pagamentos.slice(-120);
  save();
  return resumoAssinatura(empresaId, assinaturaId, opcoes);
}

/** Assinatura ativa e em dia que cobre o serviço, para o cliente informado. */
export function assinaturaQueCobre(empresaId, { clienteId, clienteTelefone, servicoId } = {}, opcoes = {}) {
  const chave = telefoneChave(clienteTelefone);
  const clientes = clienteId ? null : (chave ? clientesKytto.listarClientes(String(empresaId)).filter((item) => telefoneChave(item.telefone) === chave).map((item) => item.id) : []);
  const candidatas = barbearia.listarAssinaturas(empresaId, { status: 'ativa' })
    .filter((item) => (clienteId ? item.clienteId === String(clienteId) : clientes.includes(item.clienteId)));
  for (const assinatura of candidatas) {
    const resumo = resumoAssinatura(empresaId, assinatura.id, opcoes);
    const servicos = resumo.plano?.servicosIds || [];
    if (servicos.length && !servicos.includes(String(servicoId))) continue;
    return resumo;
  }
  return null;
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
  if (resumo.sessoesRestantes <= 0) throw new CaptacaoError('O plano já usou todas as sessões deste ciclo.', 'LIMITE_DO_CICLO', 409);
  const servico = barbearia.listarServicos(empresaId, { incluirInativos: true }).find((item) => item.id === servicoId);
  controle.usos.push({
    id: novoId('assuso'),
    ciclo: resumo.ciclo.indice,
    agendamentoId: agendamentoId || null,
    servicoId: servicoId || null,
    servicoNome: servico?.nome || '',
    valorAvulso: Number(servico?.preco || 0),
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
    const resumo = assinaturaQueCobre(empresaId, agendamento, opcoes);
    if (!resumo || resumo.situacaoPagamento !== 'em_dia' || resumo.sessoesRestantes <= 0) return null;
    return registrarUsoAssinatura(empresaId, resumo.assinatura.id, { servicoId: agendamento.servicoId, agendamentoId: agendamento.id }, opcoes);
  } catch (_) {
    return null;
  }
}

function precoMensal(plano) {
  const preco = Number(plano?.preco || 0);
  const dias = Math.max(1, numero(plano?.validadeDias, 30));
  return Number((preco * 30 / dias).toFixed(2));
}

export function saudeClube(empresaId, opcoes = {}) {
  const ms = agoraMs(opcoes);
  const assinaturas = barbearia.listarAssinaturas(empresaId).filter((item) => ['ativa', 'pausada'].includes(item.status));
  const itens = assinaturas.map((assinatura) => {
    const resumo = resumoAssinatura(empresaId, assinatura.id, opcoes);
    const usosCiclo = (resumo.usos || []).filter((uso) => uso.ciclo === resumo.ciclo.indice);
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
      alertas,
    };
  });
  const ativas = itens.filter((item) => item.status === 'ativa');
  const mrr = assinaturas
    .filter((item) => item.status === 'ativa')
    .reduce((soma, item) => {
      const plano = barbearia.listarPlanos(empresaId, { incluirInativos: true }).find((p) => p.id === item.planoId);
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

export function salvarMetaProfissional(empresaId, { profissionalId, mes, receita, atendimentos } = {}) {
  const estado = captacao(empresaId);
  const id = texto(profissionalId, 100);
  const competencia = texto(mes, 7);
  if (!barbearia.listarProfissionais(empresaId, { incluirInativos: true }).some((item) => item.id === id)) throw new CaptacaoError('Profissional não encontrado.', 'PROFISSIONAL_NAO_ENCONTRADO', 404);
  if (!/^\d{4}-\d{2}$/.test(competencia)) throw new CaptacaoError('Mês inválido (use AAAA-MM).', 'MES_INVALIDO');
  estado.metasProfissionais[competencia] ||= {};
  estado.metasProfissionais[competencia][id] = {
    receita: dinheiro(receita),
    atendimentos: Math.max(0, Math.round(numero(atendimentos))),
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
export function planoDoTelefone(empresaId, telefone, opcoes = {}) {
  const chave = telefoneChave(telefone);
  if (!chave) return null;
  const clientes = clientesKytto.listarClientes(String(empresaId)).filter((item) => telefoneChave(item.telefone) === chave).map((item) => item.id);
  const assinatura = barbearia.listarAssinaturas(empresaId)
    .find((item) => clientes.includes(item.clienteId) && ['ativa', 'pausada'].includes(item.status));
  if (!assinatura) return null;
  const resumo = resumoAssinatura(empresaId, assinatura.id, opcoes);
  return {
    plano: resumo.plano?.nome || 'Plano',
    status: assinatura.status,
    sessoesNoCiclo: resumo.limiteNoCiclo,
    usadasNoCiclo: resumo.usosNoCiclo,
    restantes: resumo.sessoesRestantes,
    cicloTermina: dataLocal(new Date(resumo.ciclo.fim).valueOf()),
    pagamentoEmDia: resumo.situacaoPagamento === 'em_dia',
    servicosIncluidos: (resumo.plano?.servicosIds || []).map((id) => barbearia.listarServicos(empresaId, { incluirInativos: true }).find((s) => s.id === id)?.nome).filter(Boolean),
  };
}

/**
 * O clube compensa para este cliente? Compara a frequência dos últimos 60 dias
 * com o plano mais barato. Devolve só frequência e o plano: a atendente não
 * fala de quanto o cliente gastou.
 */
export function clubeParaTelefone(empresaId, telefone, { dias = 60 } = {}, opcoes = {}) {
  const ms = agoraMs(opcoes);
  if (planoDoTelefone(empresaId, telefone, opcoes)) return { elegivel: false, motivo: 'ja_assinante' };
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
