import crypto from 'crypto';
import express from 'express';
import { armazenamentoAvaliacaoDuravel, db } from '../../db.js';
import * as barbearia from '../../barbearia-erp-kytto.js';
import { queueAppointmentNotifications } from '../../core/barbershop-appointment-notifications.js';
import { avisarListaEspera } from '../../core/barbershop-agenda.js';
import { DinoNpsError, getDinoNpsSchemaReadiness, queueDinoNpsProcessing, recordDinoNpsResponse } from '../../core/dino-nps-canonical.js';
import * as captacao from '../../dino-captacao-kytto.js';
import * as cobranca from '../../dino-cobranca-kytto.js';
import { vincularClienteAoAtendimento } from '../../dino-clientes-vinculo.js';
import { phoneMatchKey } from '../../core/whatsapp-phone.js';

const router = express.Router();
const EMPRESA_PADRAO_ID = 'emp-kytto-001';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    tipo_preco: item.tipoPreco || 'fixo',
    preco_rotulo: barbearia.rotuloPrecoServico(item),
    duracao_min: Number(item.duracaoMinutos || 30),
    profissionais_ids: Array.isArray(item.profissionaisIds) ? item.profissionaisIds : [],
    profissionaisIds: Array.isArray(item.profissionaisIds) ? item.profissionaisIds : [],
  };
}

export function validarCpf(cpf) {
  const limpo = String(cpf || '').replace(/\D/g, '');
  if (limpo.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(limpo)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(limpo.charAt(i), 10) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(limpo.charAt(9), 10)) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(limpo.charAt(i), 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(limpo.charAt(10), 10);
}

export function formatarCpf(cpf) {
  const limpo = String(cpf || '').replace(/\D/g, '').slice(0, 11);
  if (limpo.length !== 11) return limpo;
  return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function profissionalPublico(item) {
  return {
    id: item.id,
    nome: item.nome,
    especialidade: item.especialidade || 'Barbeiro',
    foto_emoji: texto(item.fotoEmoji, 8) || '✂️',
    foto_url: texto(item.fotoUrl, 500) || '',
    slug: slug(item.nome) || item.id,
  };
}

function erroHttp(res, erro) {
  const mensagem = texto(erro?.message || 'Não foi possível concluir o agendamento.', 240);
  const indisponivel = /indisponível|indisponivel|conflito/i.test(mensagem);
  const entradaInvalida = /obrigatóri|inválid|indisponível para agendamento online|não funciona|fora do funcionamento|não trabalha|não realiza/i.test(mensagem);
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
    const planos = barbearia.listarPlanos(identidade.empresaId)
      .filter((p) => p.ativo !== false)
      .map((p) => ({
        id: p.id,
        nome: p.nome,
        descricao: p.descricao,
        preco: p.preco,
        ciclo: p.ciclo,
        sessoesIncluidas: p.sessoesIncluidas,
        ehVip: Boolean(p.ehVip),
        categoriaPlano: p.categoriaPlano,
        tipoProfissional: p.tipoProfissional,
        profissionalId: p.profissionalId,
        profissionalNome: p.profissionalNome,
        profissionaisIds: p.profissionaisIds || [],
        precosPorProfissional: p.precosPorProfissional || {},
        linkAdesao: p.linkAdesao,
        linkAdesaoCompleto: p.linkAdesaoCompleto,
      }));
    const configuracao = barbearia.obterConfiguracao(identidade.empresaId);
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    return res.json({
      ok: true,
      estabelecimento: identidade.estabelecimento,
      profissionais,
      servicos,
      planos,
      politicas: {
        cancelamentoHoras: Math.max(0, Number(configuracao.politicaCancelamentoHoras ?? 4)),
        sinal: (() => { const c = cobranca.obterConfiguracaoCobranca(identidade.empresaId); return cobranca.sinalExigido(identidade.empresaId) ? { tipo: c.sinal.tipo, valor: c.sinal.valor, prazoMinutos: c.sinal.prazoMinutos } : null; })(),
        valePresente: (() => { const c = cobranca.obterConfiguracaoCobranca(identidade.empresaId); return Boolean(c.vale?.ativo && c.provedor); })(),
      },
    });
  } catch (erro) {
    return erroHttp(res, erro);
  }
});

router.get('/:slug/planos', (req, res) => {
  try {
    const identidade = identidadePublica(req.params.slug);
    if (!identidade) return res.status(404).json({ ok: false, error: 'Estabelecimento não encontrado.' });
    const profissionais = barbearia.listarProfissionais(identidade.empresaId).filter((p) => p.ativo !== false);
    const profsMap = new Map(profissionais.map((p) => [p.id, p.nome]));
    const planos = barbearia.listarPlanos(identidade.empresaId)
      .filter((p) => p.ativo !== false)
      .map((p) => {
        const item = { ...p };
        if (item.profissionalId && !item.profissionalNome) {
          item.profissionalNome = profsMap.get(item.profissionalId) || '';
        }
        return item;
      });
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    return res.json({ ok: true, estabelecimento: identidade.estabelecimento, planos });
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

router.post('/:slug/assinatura', async (req, res) => {
  try {
    const identidade = identidadePublica(req.params.slug);
    if (!identidade) return res.status(404).json({ ok: false, error: 'Estabelecimento não encontrado.' });
    const corpo = req.body || {};
    const nome = texto(corpo.cliente_nome || corpo.clienteNome, 160);
    const telefone = String(corpo.cliente_telefone || corpo.clienteTelefone || '').replace(/\D/g, '').slice(0, 13);
    const planoId = texto(corpo.plano_id || corpo.planoId, 100);
    const profissionalId = texto(corpo.profissional_id || corpo.profissionalId, 100);
    const observacoes = texto(corpo.observacoes, 500);

    if (nome.length < 2) return res.status(400).json({ ok: false, error: 'Informe seu nome completo.' });
    if (telefone.length < 10) return res.status(400).json({ ok: false, error: 'Informe um telefone WhatsApp válido com DDD.' });
    if (!planoId) return res.status(400).json({ ok: false, error: 'Plano é obrigatório.' });

    const plano = barbearia.obterPlano(identidade.empresaId, planoId);
    if (!plano) return res.status(404).json({ ok: false, error: 'Plano não encontrado.' });

    const vinculo = vincularClienteAoAtendimento(identidade.empresaId, { clienteNome: nome, clienteTelefone: telefone }, { origem: 'clube_vip_online' });
    const clienteId = vinculo.clienteId || `cli-${crypto.randomUUID()}`;

    const prof = profissionalId ? barbearia.listarProfissionais(identidade.empresaId).find((p) => p.id === profissionalId) : null;
    const precoFinal = (profissionalId && plano.precosPorProfissional?.[profissionalId])
      ? Number(plano.precosPorProfissional[profissionalId])
      : Number(plano.preco);

    const assinatura = barbearia.criarAssinatura(identidade.empresaId, {
      clienteId,
      clienteNome: nome,
      clienteTelefone: telefone,
      planoId: plano.id,
      profissionalId: prof?.id || plano.profissionalId || null,
      profissionalNome: prof?.nome || plano.profissionalNome || null,
      precoContratado: precoFinal,
      ehVip: Boolean(plano.ehVip),
      regraRenovacao: plano.regraRenovacao || 'aniversario',
      inicio: new Date().toISOString().slice(0, 10),
      observacoes: observacoes || 'Adesão online pelo Clube VIP',
    });

    const linkVinculo = `https://kytto.com.br/admin/barbearia-erp?area=catalogo&tab=Planos+e+assinaturas&assinaturaId=${assinatura.id}`;
    const linkExtrato = `https://kytto.com.br/perfil?aba=pacotes&assinatura=${assinatura.id}`;

    return res.status(201).json({
      ok: true,
      assinatura,
      plano,
      precoFinal,
      linkVinculo,
      linkExtrato,
    });
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

    const rawCpf = String(corpo.cliente_cpf || corpo.cpf || corpo.clienteCpf || '').trim();
    const cpfLimpo = rawCpf.replace(/\D/g, '');
    if (cpfLimpo) {
      if (!validarCpf(cpfLimpo)) {
        return res.status(400).json({ ok: false, error: 'CPF inválido. Verifique os dígitos informados.', code: 'CPF_INVALIDO' });
      }
    }
    const cpfFormatado = cpfLimpo ? formatarCpf(cpfLimpo) : '';

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
    const vinculo = vincularClienteAoAtendimento(identidade.empresaId, { clienteNome: nome, clienteTelefone: telefone, clienteCpf: cpfFormatado }, { origem: 'agendamento_online' });
    const agendamento = barbearia.criarAgendamento(identidade.empresaId, {
      clienteId: vinculo.clienteId || undefined,
      clienteNome: nome,
      clienteTelefone: telefone,
      clienteCpf: cpfFormatado,
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
    try { captacao.marcarListaEsperaAgendada(identidade.empresaId, { telefone, data: agendamento.dataAgenda, lojaId: agendamento.lojaId, servicoId: agendamento.servicoId }); } catch (_) { /* não impede o agendamento */ }
    if (corpo.indicacao) {
      try { captacao.registrarIndicacao(identidade.empresaId, { codigo: texto(corpo.indicacao, 12), agendamento }); } catch (_) { /* indicação inválida não impede o agendamento */ }
    }
    // Canal de origem (link da bio, Google, campanha): só o nome do canal, nunca dado pessoal.
    try { captacao.registrarCanalAgendamento(identidade.empresaId, agendamento.id, { canal: corpo.canal, campanha: corpo.campanha }); } catch (_) { /* não impede o agendamento */ }
    // Sinal: com cobrança ligada, o horário fica reservado até o prazo do sinal.
    // Se o link de pagamento não puder ser gerado, o horário não fica preso.
    let pagamento = null;
    if (cobranca.sinalExigido(identidade.empresaId)) {
      try {
        pagamento = await cobranca.criarSinalDoAgendamento(identidade.empresaId, agendamento);
      } catch (erroSinal) {
        try { barbearia.alterarStatusAgendamento(identidade.empresaId, agendamento.id, 'cancelado', { observacoes: 'Cancelado: não foi possível gerar o sinal' }); } catch (_) { /* segue com o erro */ }
        console.error('[Cobrança] sinal:', erroSinal?.message || erroSinal);
        return res.status(502).json({ ok: false, error: 'Não foi possível gerar o pagamento do sinal agora. Tente de novo em instantes ou fale com a barbearia pelo WhatsApp.', code: 'SINAL_INDISPONIVEL' });
      }
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
      pagamento: pagamento ? {
        valor: pagamento.valor,
        url: pagamento.url,
        pixCopiaECola: pagamento.pixCopiaECola,
        expiraEm: pagamento.expiraEm,
        provedor: pagamento.provedor,
      } : null,
    });
  } catch (erro) {
    return erroHttp(res, erro);
  }
});

function erroCaptacao(res, erro) {
  if (erro instanceof captacao.CaptacaoError || erro instanceof cobranca.CobrancaError || erro instanceof DinoNpsError) {
    return res.status(erro.statusCode || erro.status || 400).json({ ok: false, error: erro.message, code: erro.code });
  }
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
  // Remove só registros vencidos: zerar o mapa inteiro liberaria quem está bloqueado.
  if (FALHAS_AUTOATENDIMENTO.size > 5000) {
    const agora = Date.now();
    for (const [k, r] of FALHAS_AUTOATENDIMENTO) if (r.expira < agora) FALHAS_AUTOATENDIMENTO.delete(k);
    // Ainda grande (ataque distribuído): descarta os mais antigos, mantendo os bloqueados.
    for (const [k, r] of FALHAS_AUTOATENDIMENTO) {
      if (FALHAS_AUTOATENDIMENTO.size <= 5000) break;
      if (r.falhas < 6) FALHAS_AUTOATENDIMENTO.delete(k);
    }
  }
}
function autoatendimento(handler) {
  return async (req, res) => {
    const identidade = identidadePublica(req.params.slug);
    if (!identidade) return res.status(404).json({ ok: false, error: 'Estabelecimento não encontrado.' });
    if (bloqueadoPorFalhas(req, identidade.empresaId)) return res.status(429).json({ ok: false, error: 'Muitas tentativas. Fale com a barbearia pelo WhatsApp ou tente mais tarde.', code: 'AUTOATENDIMENTO_BLOQUEADO' });
    try {
      return await handler(req, res, identidade);
    } catch (erro) {
      if (['AGENDAMENTO_NAO_ENCONTRADO', 'DADOS_INVALIDOS', 'VALE_NAO_ENCONTRADO'].includes(erro?.code)) registrarFalha(req, identidade.empresaId);
      return erroCaptacao(res, erro);
    }
  };
}

// Autoatendimento: código + telefone no corpo (nunca na URL).
router.post('/:slug/meu-agendamento', autoatendimento(async (req, res, identidade) => {
  const visao = captacao.consultarAgendamentoCliente(identidade.empresaId, { codigo: req.body?.codigo, telefone: req.body?.cliente_telefone, lojaId: identidade.lojaId });
  // Código + telefone conferidos: mostra o sinal pendente (para pagar) e o saldo de cashback.
  const agendamento = barbearia.listarAgendamentos(identidade.empresaId, {}).find((item) => item.codigoConfirmacao === visao.codigo && (!identidade.lojaId || item.lojaId === identidade.lojaId));
  const sinal = agendamento ? cobranca.sinalDoAgendamento(identidade.empresaId, agendamento.id, identidade.lojaId) : null;
  const cashback = cobranca.saldoCashback(identidade.empresaId, req.body?.cliente_telefone, { lojaId: identidade.lojaId });
  res.setHeader('Cache-Control', 'no-store');
  return res.json({
    ok: true,
    agendamento: {
      ...visao,
      sinal: sinal ? { valor: sinal.valor, status: sinal.status, url: sinal.status === 'pendente' ? sinal.url : null, pixCopiaECola: sinal.status === 'pendente' ? sinal.pixCopiaECola : null, expiraEm: sinal.expiraEm } : null,
    },
    cashback: cashback.ativo || cashback.saldo > 0 ? { saldo: cashback.saldo, proximoVencimento: cashback.proximoVencimento } : null,
  });
}));

router.post('/:slug/meu-agendamento/cancelar', autoatendimento(async (req, res, identidade) => {
  const { agendamento, visao } = captacao.cancelarAgendamentoCliente(identidade.empresaId, { codigo: req.body?.codigo, telefone: req.body?.cliente_telefone, motivo: req.body?.motivo, lojaId: identidade.lojaId });
  try { cobranca.cancelarSinalPendente(identidade.empresaId, agendamento.id, identidade.lojaId); } catch (_) { /* não impede o cancelamento */ }
  const contexto = { empresaId: identidade.empresaId, lojaId: agendamento.lojaId || identidade.lojaId, legacyEmpresaId: identidade.empresaId };
  await queueAppointmentNotifications(contexto, agendamento, 'cancelado').catch(() => null);
  await avisarListaEspera(contexto, agendamento, captacao.candidatosParaVaga(identidade.empresaId, agendamento)).catch(() => null);
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ ok: true, agendamento: visao });
}));

router.post('/:slug/meu-agendamento/remarcar', autoatendimento(async (req, res, identidade) => {
  const corpo = req.body || {};
  const { agendamento, anterior, visao } = captacao.remarcarAgendamentoCliente(identidade.empresaId, {
    codigo: corpo.codigo,
    telefone: corpo.cliente_telefone,
    data: texto(corpo.data, 10),
    horario: texto(corpo.horario, 5),
    lojaId: identidade.lojaId,
  });
  try { captacao.marcarListaEsperaAgendada(identidade.empresaId, { telefone: corpo.cliente_telefone, data: agendamento.dataAgenda, lojaId: agendamento.lojaId, servicoId: agendamento.servicoId }); } catch (_) { /* não impede a remarcação */ }
  const contexto = { empresaId: identidade.empresaId, lojaId: agendamento.lojaId || identidade.lojaId, legacyEmpresaId: identidade.empresaId };
  await queueAppointmentNotifications(contexto, agendamento, 'remarcado').catch(() => null);
  if (anterior && (anterior.dataAgenda !== agendamento.dataAgenda || anterior.horaLocal !== agendamento.horaLocal || anterior.profissionalId !== agendamento.profissionalId)) {
    const contextoAnterior = { empresaId: identidade.empresaId, lojaId: anterior.lojaId || identidade.lojaId, legacyEmpresaId: identidade.empresaId };
    await avisarListaEspera(contextoAnterior, { ...anterior, status: 'cancelado' }, captacao.candidatosParaVaga(identidade.empresaId, { ...anterior, status: 'cancelado' }, { lojaId: anterior.lojaId || identidade.lojaId })).catch(() => null);
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ ok: true, agendamento: visao });
}));

// Volta do checkout da InfinitePay: confere o pagamento na própria InfinitePay
// (payment_check) antes de confirmar o horário. Os identificadores vêm do retorno.
router.post('/:slug/pagamento/verificar', async (req, res) => {
  const identidade = identidadePublica(req.params.slug);
  if (!identidade) return res.status(404).json({ ok: false, error: 'Estabelecimento não encontrado.' });
  try {
    const invoiceSlug = texto(req.body?.invoice_slug || req.body?.invoiceSlug, 180);
    if (!invoiceSlug) return res.status(400).json({ ok: false, error: 'O invoice_slug do pagamento é obrigatório.', code: 'PAGAMENTO_INVOICE_SLUG_AUSENTE' });
    const resultado = await cobranca.confirmarPelaInfinitePay({
      order_nsu: texto(req.body?.order_nsu, 40),
      transaction_nsu: texto(req.body?.transaction_nsu, 80),
      invoice_slug: invoiceSlug,
    });
    if (resultado.empresaId !== identidade.empresaId) return res.status(404).json({ ok: false, error: 'Pagamento não encontrado.' });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ ok: true, pago: resultado.status === 'paga', tipo: resultado.tipo, horarioLiberado: resultado.revisar === 'horario_liberado' || resultado.revisar === 'cobranca_cancelada' });
  } catch (erro) {
    if (erro instanceof cobranca.CobrancaError) return res.status(erro.status || 400).json({ ok: false, error: erro.message, code: erro.code });
    return res.status(400).json({ ok: false, error: 'Não foi possível confirmar o pagamento ainda. Se já pagou, aguarde alguns instantes.' });
  }
});

// App do cliente: "minha conta" com código + telefone no corpo (nunca na URL).
router.post('/:slug/minha-conta', autoatendimento(async (req, res, identidade) => {
  const conta = captacao.minhaConta(identidade.empresaId, { codigo: req.body?.codigo, telefone: req.body?.cliente_telefone, lojaId: identidade.lojaId });
  const cashback = cobranca.saldoCashback(identidade.empresaId, req.body?.cliente_telefone, { lojaId: identidade.lojaId });
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ ok: true, conta: { ...conta, cashback: cashback.ativo || cashback.saldo > 0 ? { saldo: cashback.saldo, proximoVencimento: cashback.proximoVencimento } : null } });
}));

// Vale-presente: compra online (o código só vale depois de pago) e consulta de saldo.
router.post('/:slug/vale/comprar', async (req, res) => {
  const identidade = identidadePublica(req.params.slug);
  if (!identidade) return res.status(404).json({ ok: false, error: 'Estabelecimento não encontrado.' });
  try {
    const corpo = req.body || {};
    const resultado = await cobranca.comprarVale(identidade.empresaId, {
      valor: Number(corpo.valor), deNome: texto(corpo.de_nome, 80), deTelefone: texto(corpo.de_telefone, 30),
      paraNome: texto(corpo.para_nome, 80), mensagem: texto(corpo.mensagem, 200),
      lojaId: identidade.lojaId,
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({ ok: true, ...resultado });
  } catch (erro) {
    return erroCaptacao(res, erro);
  }
});
router.post('/:slug/vale/consultar', autoatendimento(async (req, res, identidade) => {
  const vale = cobranca.consultarVale(identidade.empresaId, req.body?.codigo, identidade.lojaId);
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ ok: true, vale: { saldo: vale.saldo, status: vale.status, validoAte: vale.validoAte } });
}));

// Manifesto do app do cliente (instalável), com a marca da barbearia.
function enviarManifesto(res, manifesto) {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.send(JSON.stringify(manifesto));
}

// App do cliente (/minha/:slug), instalável no Android e no iPhone.
router.get('/:slug/manifest.webmanifest', (req, res) => {
  const identidade = identidadePublica(req.params.slug);
  if (!identidade) return res.status(404).json({ ok: false, error: 'Estabelecimento não encontrado.' });
  const { nome, slug: slugPublico } = identidade.estabelecimento;
  const ehDino = slugPublico === 'dino';
  const icones = ehDino
    ? [
      { src: '/brand/dino-app-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/dino-app-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/dino-app-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]
    : [{ src: '/icon-512.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' }];
  return enviarManifesto(res, {
    id: `/minha/${encodeURIComponent(slugPublico)}`,
    name: nome,
    short_name: texto(nome, 12) || 'Barbearia',
    description: `Agende, acompanhe seu clube e seu cashback na ${nome}.`,
    lang: 'pt-BR',
    start_url: `/minha/${encodeURIComponent(slugPublico)}`,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0E1014',
    theme_color: '#0E1014',
    categories: ['lifestyle', 'beauty'],
    icons: icones,
    shortcuts: [{ name: 'Agendar horário', short_name: 'Agendar', url: `/agendar/${encodeURIComponent(slugPublico)}?canal=app`, icons: icones.slice(0, 1) }],
  });
});

// App da equipe (/barbeiro/:slug): agenda do dia do profissional no celular.
// O manifesto é público (só nome e ícones); a agenda exige login.
router.get('/:slug/app-barbeiro.webmanifest', (req, res) => {
  const identidade = identidadePublica(req.params.slug);
  if (!identidade) return res.status(404).json({ ok: false, error: 'Estabelecimento não encontrado.' });
  const { nome, slug: slugPublico } = identidade.estabelecimento;
  const ehDino = slugPublico === 'dino';
  const icones = ehDino
    ? [
      { src: '/brand/dino-equipe-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/dino-equipe-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/dino-equipe-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]
    : [{ src: '/icon-512.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' }];
  const inicio = `/barbeiro/${encodeURIComponent(slugPublico)}`;
  return enviarManifesto(res, {
    id: inicio,
    name: `${nome} · Equipe`,
    short_name: ehDino ? 'Dino Equipe' : 'Equipe',
    description: 'Agenda do dia, atendimentos e comissão do profissional.',
    lang: 'pt-BR',
    start_url: inicio,
    scope: '/barbeiro',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0E1014',
    theme_color: '#0E1014',
    categories: ['business', 'productivity'],
    icons: icones,
    // App da loja (Android) quando publicado; o PWA continua valendo para quem já instalou.
    ...(ehDino && process.env.ANDROID_TWA_PACKAGE ? { related_applications: [{ platform: 'play', id: String(process.env.ANDROID_TWA_PACKAGE), url: `https://play.google.com/store/apps/details?id=${encodeURIComponent(String(process.env.ANDROID_TWA_PACKAGE))}` }], prefer_related_applications: false } : {}),
    shortcuts: [
      { name: 'Agenda de hoje', short_name: 'Hoje', url: inicio, icons: icones.slice(0, 1) },
      { name: 'Encaixe de cliente', short_name: 'Encaixe', url: `${inicio}?acao=encaixe`, icons: icones.slice(0, 1) },
    ],
  });
});

// NPS pós-atendimento: nota 0–10 do atendimento concluído (código + telefone no corpo).
router.post('/:slug/avaliar', autoatendimento(async (req, res, identidade) => {
  if (process.env.DINO_NPS_CANONICAL_ENABLED === '1') {
    const readiness = getDinoNpsSchemaReadiness();
    if (process.env.COMMERCE_CORE_ENABLED !== '1' || !readiness.ready) {
      throw new DinoNpsError('Avaliação canônica indisponível até o schema Commerce estar pronto.', 503, readiness.code || 'DINO_NPS_SCHEMA_NOT_READY');
    }
    // A resposta canônica nunca aceita o identificador legado como prova. O
    // link antigo (código+telefone) recebe 409 e não toca o armazenamento JSON.
    if (!UUID_RE.test(String(identidade.empresaId || '')) || !UUID_RE.test(String(identidade.lojaId || ''))) {
      throw new DinoNpsError('Atualize o link de avaliação para uma empresa e loja Commerce canônicas.', 409, 'NPS_CANONICAL_LINK_UPDATE_REQUIRED');
    }
    const corpo = req.body || {};
    const appointmentId = corpo.appointmentId || corpo.appointment_id || corpo.agendamentoId || corpo.agendamento_id;
    if (!appointmentId || !UUID_RE.test(String(appointmentId))) {
      throw new DinoNpsError('Atualize o link de avaliação: appointmentId/agendamentoId é obrigatório.', 409, 'NPS_APPOINTMENT_ID_REQUIRED');
    }
    const codigo = texto(corpo.codigo || corpo.codigoConfirmacao || corpo.codigo_confirmacao, 80);
    const telefone = texto(corpo.cliente_telefone || corpo.telefone, 40);
    if (!codigo || !telefone) {
      throw new DinoNpsError('Código e telefone são obrigatórios para validar o atendimento.', 400, 'NPS_CUSTOMER_PROOF_REQUIRED');
    }
    let resposta;
    let processamento;
    try {
      resposta = await recordDinoNpsResponse({
        empresaId: identidade.empresaId,
        lojaId: identidade.lojaId,
        correlationId: req.requestId,
      }, {
        appointmentId,
        nota: corpo.nota,
        comentario: texto(corpo.comentario, 2000),
        codigo,
        telefone,
      });
      processamento = await queueDinoNpsProcessing({
        empresaId: identidade.empresaId,
        lojaId: identidade.lojaId,
        correlationId: req.requestId,
      }, { responseId: resposta.id });
    } catch (error) {
      if (error instanceof DinoNpsError) throw error;
      console.warn('[Dino NPS] avaliação canônica indisponível:', error?.code || error?.message || error);
      throw new DinoNpsError('Avaliação canônica temporariamente indisponível.', 503, 'DINO_NPS_DATABASE_UNAVAILABLE');
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(resposta.replay || processamento.replay ? 200 : 201).json({
      ok: true,
      avaliacao: { repetida: Boolean(resposta.replay), nota: resposta.nota },
      processamento: { status: processamento.status, replay: Boolean(processamento.replay) },
    });
  }
  if (!armazenamentoAvaliacaoDuravel()) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ ok: false, code: 'REVIEW_STORAGE_UNAVAILABLE', error: 'Avaliações temporariamente indisponíveis. Tente novamente mais tarde.' });
  }
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
  const { nome, slug: slugPublico, endereco, whatsapp } = identidade.estabelecimento;
  return { nome, slug: slugPublico, endereco, telefone: whatsapp };
}

export default router;
