import crypto from 'crypto';
import express from 'express';
import { db } from '../../db.js';
import * as barbearia from '../../barbearia-erp-kytto.js';
import { queueAppointmentNotifications } from '../../core/barbershop-appointment-notifications.js';
import { avisarListaEspera } from '../../core/barbershop-agenda.js';
import * as captacao from '../../dino-captacao-kytto.js';
import { vincularClienteAoAtendimento } from '../../dino-clientes-vinculo.js';
import { phoneMatchKey } from '../../core/whatsapp-phone.js';

const router = express.Router();
const EMPRESA_PADRAO_ID = 'emp-kytto-001';

function texto(valor, limite = 160) {
  return String(valor ?? '').trim().slice(0, limite);
}

function slug(valor) {
  return texto(valor, 100)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function empresaCadastrada(estado, empresaId) {
  return estado.cadastrosMestresKytto?.empresas?.[empresaId]
    || estado.empresas?.[empresaId]
    || null;
}

function identidadePublica(slugRecebido) {
  const solicitado = slug(slugRecebido);
  if (!solicitado) return null;
  const estado = db();
  const barbearias = estado.barbearias || {};

  // Slug configurado explicitamente vence o apelido legado "dino" da empresa padrão:
  // a empresa real (com unidade e canal) é a que recebe agendamentos e notificações.
  const entradas = Object.entries(barbearias);
  const explicita = entradas.some(([, dados]) => slug(dados?.configuracao?.slugPublico || dados?.configuracao?.slugAgendamento) === solicitado);
  for (const [empresaId, dados] of entradas) {
    const configuracao = dados?.configuracao || {};
    const empresa = empresaCadastrada(estado, empresaId);
    const slugConfigurado = slug(configuracao.slugPublico || configuracao.slugAgendamento);
    const aliasDino = !explicita && solicitado === 'dino' && empresaId === EMPRESA_PADRAO_ID;
    if (!aliasDino && (!slugConfigurado || slugConfigurado !== solicitado)) continue;
    if (configuracao.agendamentoPublicoAtivo === false || empresa?.ativa === false) return null;
    return {
      empresaId,
      lojaId: texto(configuracao.lojaPublicaId, 120),
      estabelecimento: {
        nome: texto(configuracao.nomePublico, 160) || (aliasDino ? 'Dino' : texto(empresa?.nomeFantasia || empresa?.nome, 160)) || 'Barbearia',
        slug: aliasDino ? 'dino' : slugConfigurado,
        whatsapp: texto(configuracao.whatsappPublico || empresa?.telefone, 30),
        endereco: texto(configuracao.enderecoPublico || empresa?.endereco, 240),
        emoji: texto(configuracao.emojiPublico, 8) || '✂️',
      },
    };
  }
  return null;
}

function servicoPublico(item) {
  return {
    id: item.id,
    nome: item.nome,
    descricao: item.descricao || '',
    preco: Number(item.preco || 0),
    duracao_min: Number(item.duracaoMinutos || 30),
  };
}

function profissionalPublico(item) {
  return {
    id: item.id,
    nome: item.nome,
    especialidade: item.especialidade || 'Barbeiro',
    foto_emoji: texto(item.fotoEmoji, 8) || '✂️',
  };
}

function erroHttp(res, erro) {
  const mensagem = texto(erro?.message || 'Não foi possível concluir o agendamento.', 240);
  const indisponivel = /indisponível|indisponivel|conflito/i.test(mensagem);
  const entradaInvalida = /obrigatóri|inválid|indisponível para agendamento online|não funciona|fora do funcionamento|não trabalha/i.test(mensagem);
  const status = indisponivel ? 409 : entradaInvalida ? 400 : 500;
  if (status === 500) console.error('[Agendamento público]', erro);
  return res.status(status).json({ ok: false, error: status === 500 ? 'Não foi possível concluir o agendamento.' : mensagem });
}

router.get('/:slug', (req, res) => {
  try {
    const identidade = identidadePublica(req.params.slug);
    if (!identidade) return res.status(404).json({ ok: false, error: 'Estabelecimento não encontrado.' });
    const profissionais = barbearia.listarProfissionais(identidade.empresaId)
      .filter((item) => item.ativo !== false)
      .map(profissionalPublico);
    const servicos = barbearia.listarServicos(identidade.empresaId)
      .filter((item) => item.ativo !== false && item.permiteAgendamentoOnline !== false)
      .map(servicoPublico);
    const configuracao = barbearia.obterConfiguracao(identidade.empresaId);
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    return res.json({
      ok: true,
      estabelecimento: identidade.estabelecimento,
      profissionais,
      servicos,
      politicas: { cancelamentoHoras: Math.max(0, Number(configuracao.politicaCancelamentoHoras ?? 4)) },
    });
  } catch (erro) {
    return erroHttp(res, erro);
  }
});

router.get('/:slug/horarios', (req, res) => {
  try {
    const identidade = identidadePublica(req.params.slug);
    if (!identidade) return res.status(404).json({ ok: false, error: 'Estabelecimento não encontrado.' });
    const servicoId = texto(req.query.servico_id, 100);
    if (!servicoId) return res.status(400).json({ ok: false, error: 'servico_id é obrigatório.' });
    const horarios = barbearia.listarHorariosDisponiveis(identidade.empresaId, {
      data: req.query.data,
      servicoId,
      profissionalId: req.query.profissional_id,
      lojaId: identidade.lojaId,
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ ok: true, horarios });
  } catch (erro) {
    return erroHttp(res, erro);
  }
});

router.post('/:slug/confirmar', async (req, res) => {
  try {
    const identidade = identidadePublica(req.params.slug);
    if (!identidade) return res.status(404).json({ ok: false, error: 'Estabelecimento não encontrado.' });
    const corpo = req.body || {};
    const nome = texto(corpo.cliente_nome, 160);
    const telefone = String(corpo.cliente_telefone || '').replace(/\D/g, '').slice(0, 13);
    const servicoId = texto(corpo.servico_id, 100);
    const profissionalId = texto(corpo.profissional_id || 'qualquer', 100);
    const data = texto(corpo.data, 10);
    const horario = texto(corpo.horario, 5);
    if (nome.length < 2) return res.status(400).json({ ok: false, error: 'Informe seu nome.' });
    if (telefone.length < 10) return res.status(400).json({ ok: false, error: 'Informe um telefone válido com DDD.' });
    if (!servicoId || !data || !horario) return res.status(400).json({ ok: false, error: 'Serviço, data e horário são obrigatórios.' });
    // Um mesmo telefone não segura a agenda inteira: no máximo 2 horários futuros pelo site.
    const limitePorTelefone = Math.max(1, Number.parseInt(process.env.AGENDAMENTO_PUBLICO_MAX_POR_TELEFONE || '2', 10));
    const agora = Date.now();
    const futurosDoTelefone = barbearia.listarAgendamentos(identidade.empresaId, {})
      .filter((item) => !['cancelado', 'nao_compareceu', 'concluido'].includes(item.status))
      .filter((item) => new Date(item.dataHora).valueOf() > agora)
      .filter((item) => phoneMatchKey(item.clienteTelefone) === phoneMatchKey(telefone));
    if (futurosDoTelefone.length >= limitePorTelefone) {
      return res.status(409).json({ ok: false, error: 'Este telefone já tem horários marcados. Para mais um, fale com a barbearia pelo WhatsApp.', code: 'LIMITE_AGENDAMENTOS_TELEFONE' });
    }

    const disponibilidade = barbearia.resolverProfissionalDisponivel(identidade.empresaId, {
      data,
      horario,
      servicoId,
      profissionalId,
      lojaId: identidade.lojaId,
    });
    const codigo = crypto.randomBytes(4).toString('hex').toUpperCase();
    const vinculo = vincularClienteAoAtendimento(identidade.empresaId, { clienteNome: nome, clienteTelefone: telefone }, { origem: 'agendamento_online' });
    const agendamento = barbearia.criarAgendamento(identidade.empresaId, {
      clienteId: vinculo.clienteId || undefined,
      clienteNome: nome,
      clienteTelefone: telefone,
      profissionalId: disponibilidade.profissional.id,
      servicoId,
      dataHora: disponibilidade.dataHora,
      dataAgenda: disponibilidade.dataAgenda,
      horaLocal: disponibilidade.horaLocal,
      lojaId: identidade.lojaId,
      observacoes: texto(corpo.observacoes, 600),
      origem: 'agendamento_online',
      status: 'agendado',
      codigoConfirmacao: codigo,
    });
    // Consentimento de WhatsApp para os avisos do próprio agendamento (LGPD):
    // só quando o cliente marca a opção no formulário.
    // Nunca reativa quem já revogou (SAIR): quem digita um telefone não prova ser o dono dele.
    if (vinculo.clienteId && corpo.consentimento_whatsapp === true) {
      try { captacao.registrarConsentimentoAtendimento(identidade.empresaId, vinculo.clienteId, 'agendamento_online_checkbox'); } catch (_) { /* não impede o agendamento */ }
    }
    try { captacao.marcarListaEsperaAgendada(identidade.empresaId, { telefone, data: agendamento.dataAgenda }); } catch (_) { /* não impede o agendamento */ }
    if (corpo.indicacao) {
      try { captacao.registrarIndicacao(identidade.empresaId, { codigo: texto(corpo.indicacao, 12), agendamento }); } catch (_) { /* indicação inválida não impede o agendamento */ }
    }
    await queueAppointmentNotifications({ empresaId: identidade.empresaId, lojaId: identidade.lojaId, legacyEmpresaId: identidade.empresaId }, agendamento, 'criado').catch(() => null);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({
      ok: true,
      agendamento: {
        id: agendamento.id,
        codigo: agendamento.codigoConfirmacao,
        status: agendamento.status,
        profissional: disponibilidade.profissional.nome,
      },
    });
  } catch (erro) {
    return erroHttp(res, erro);
  }
});

function erroCaptacao(res, erro) {
  if (erro instanceof captacao.CaptacaoError) return res.status(erro.status || 400).json({ ok: false, error: erro.message, code: erro.code });
  return erroHttp(res, erro);
}

// Lista de espera: sem horário no dia, o cliente pede para ser avisado.
router.post('/:slug/lista-espera', (req, res) => {
  try {
    const identidade = identidadePublica(req.params.slug);
    if (!identidade) return res.status(404).json({ ok: false, error: 'Estabelecimento não encontrado.' });
    const corpo = req.body || {};
    const registro = captacao.entrarListaEspera(identidade.empresaId, {
      nome: corpo.cliente_nome,
      telefone: corpo.cliente_telefone,
      data: corpo.data,
      servicoId: corpo.servico_id,
      profissionalId: corpo.profissional_id,
      periodo: corpo.periodo,
      lojaId: identidade.lojaId,
      consentimentoWhatsapp: corpo.consentimento_whatsapp === true,
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(registro.repetida ? 200 : 201).json({ ok: true, listaEspera: { id: registro.id, data: registro.data, periodo: registro.periodo, repetida: Boolean(registro.repetida) } });
  } catch (erro) {
    return erroCaptacao(res, erro);
  }
});

// Tentativas erradas de código + telefone por IP e estabelecimento: depois de 6
// erros em 30 minutos, a consulta fica bloqueada (evita adivinhar códigos).
const FALHAS_AUTOATENDIMENTO = new Map();
function chaveFalha(req, empresaId) { return `${empresaId}:${req.ip || ''}`; }
function bloqueadoPorFalhas(req, empresaId) {
  const registro = FALHAS_AUTOATENDIMENTO.get(chaveFalha(req, empresaId));
  if (!registro || registro.expira < Date.now()) return false;
  return registro.falhas >= 6;
}
function registrarFalha(req, empresaId) {
  const chave = chaveFalha(req, empresaId);
  const atual = FALHAS_AUTOATENDIMENTO.get(chave);
  const registro = atual && atual.expira > Date.now() ? atual : { falhas: 0, expira: Date.now() + 30 * 60 * 1000 };
  registro.falhas += 1;
  FALHAS_AUTOATENDIMENTO.set(chave, registro);
  if (FALHAS_AUTOATENDIMENTO.size > 5000) FALHAS_AUTOATENDIMENTO.clear();
}
function autoatendimento(handler) {
  return async (req, res) => {
    const identidade = identidadePublica(req.params.slug);
    if (!identidade) return res.status(404).json({ ok: false, error: 'Estabelecimento não encontrado.' });
    if (bloqueadoPorFalhas(req, identidade.empresaId)) return res.status(429).json({ ok: false, error: 'Muitas tentativas. Fale com a barbearia pelo WhatsApp ou tente mais tarde.', code: 'AUTOATENDIMENTO_BLOQUEADO' });
    try {
      return await handler(req, res, identidade);
    } catch (erro) {
      if (erro?.code === 'AGENDAMENTO_NAO_ENCONTRADO' || erro?.code === 'DADOS_INVALIDOS') registrarFalha(req, identidade.empresaId);
      return erroCaptacao(res, erro);
    }
  };
}

// Autoatendimento: código + telefone no corpo (nunca na URL).
router.post('/:slug/meu-agendamento', autoatendimento(async (req, res, identidade) => {
  const visao = captacao.consultarAgendamentoCliente(identidade.empresaId, { codigo: req.body?.codigo, telefone: req.body?.cliente_telefone, lojaId: identidade.lojaId });
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ ok: true, agendamento: visao });
}));

router.post('/:slug/meu-agendamento/cancelar', autoatendimento(async (req, res, identidade) => {
  const { agendamento, visao } = captacao.cancelarAgendamentoCliente(identidade.empresaId, { codigo: req.body?.codigo, telefone: req.body?.cliente_telefone, motivo: req.body?.motivo, lojaId: identidade.lojaId });
  const contexto = { empresaId: identidade.empresaId, lojaId: agendamento.lojaId || identidade.lojaId, legacyEmpresaId: identidade.empresaId };
  await queueAppointmentNotifications(contexto, agendamento, 'cancelado').catch(() => null);
  await avisarListaEspera(contexto, agendamento, captacao.candidatosParaVaga(identidade.empresaId, agendamento)).catch(() => null);
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ ok: true, agendamento: visao });
}));

router.post('/:slug/meu-agendamento/remarcar', autoatendimento(async (req, res, identidade) => {
  const corpo = req.body || {};
  const { agendamento, visao } = captacao.remarcarAgendamentoCliente(identidade.empresaId, {
    codigo: corpo.codigo,
    telefone: corpo.cliente_telefone,
    data: texto(corpo.data, 10),
    horario: texto(corpo.horario, 5),
    lojaId: identidade.lojaId,
  });
  const contexto = { empresaId: identidade.empresaId, lojaId: agendamento.lojaId || identidade.lojaId, legacyEmpresaId: identidade.empresaId };
  await queueAppointmentNotifications(contexto, agendamento, 'remarcado').catch(() => null);
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ ok: true, agendamento: visao });
}));

// NPS pós-atendimento: nota 0–10 do atendimento concluído (código + telefone no corpo).
router.post('/:slug/avaliar', autoatendimento(async (req, res, identidade) => {
  const corpo = req.body || {};
  const resultado = captacao.registrarAvaliacao(identidade.empresaId, {
    codigo: corpo.codigo,
    telefone: corpo.cliente_telefone,
    nota: corpo.nota,
    comentario: texto(corpo.comentario, 600),
    lojaId: identidade.lojaId,
  });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(resultado.repetida ? 200 : 201).json({ ok: true, avaliacao: resultado });
}));

/** Dados públicos mínimos para as meta tags (SEO/compartilhamento) do link. */
export function metaPublicaDoSlug(slugRecebido) {
  const identidade = identidadePublica(slugRecebido);
  if (!identidade) return null;
  const { nome, slug: slugPublico, endereco } = identidade.estabelecimento;
  return { nome, slug: slugPublico, endereco };
}

export default router;
