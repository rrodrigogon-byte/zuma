// Ativação guiada da Dino: mostra, numa lista só, o que falta para o atendente, o cérebro,
// a agenda online e a vitrine funcionarem em produção, e executa os passos que não
// dependem de segredo (canal, política, slug, identidade da vitrine, esgotados).
// Segredos nunca passam por aqui: só se informa se o nome da variável existe no servidor.

import { db } from './core/database.js';
import { publicConfig } from './core/commerce-tenants.js';
import { configureWhatsappAiChannel, configureWhatsappAiPolicy, whatsappAiOperationalStatus } from './core/whatsapp-ai.js';
import { providerConfigured } from './core/ai-router.js';
import { getBrainSettings } from './core/ai-memory.js';
import { whatsappProviderName, chatbotBackendConfig, chatbotBackendMode } from './core/whatsapp-provider.js';
import { obterConexao } from './whatsapp-conexao-kytto.js';
import { pollMode } from './core/whatsapp-isa-poll.js';
import { configuracaoResumoPublica } from './core/dino-resumo-diario.js';

const BASE = '/api/admin/barbearia/ativacao';
const GESTORES = new Set(['admin', 'organizador']);
const DEFAULT_ORANGE = '#FF6B2C';
// Índigo da Dino sobre o fundo claro atual da vitrine (contraste AA do texto branco nos botões).
export const DINO_IDENTITY = Object.freeze({ accent: '#4B57A6', accentStrong: '#3B4588' });
const LIGHT_BASE = Object.freeze({ background: '#F7F8FA', surface: '#FFFFFF', text: '#172033' });
export const RECOMMENDED_CAPABILITIES = Object.freeze({ humanized: true, captureLeads: true, operateStore: true, manageAppointments: true, sendPromotions: false, reminders: true, humanHandoff: true });
export const RECOMMENDED_NOTICE = 'Sou o assistente virtual da Barbearia Dino. Guardo nossas conversas para te atender melhor e só uso seu histórico se você autorizar. Para falar com uma pessoa, digite HUMANO; para não receber ofertas, SAIR.';

const envSet = (name) => Boolean(String(process.env[name] || '').trim());

function item(grupo, id, titulo, ok, detalhe, extra = {}) {
  // Botão de ação só aparece enquanto o item não está pronto.
  return { grupo, id, titulo, ok: ok === true, opcional: extra.opcional === true, detalhe, acao: ok === true ? null : (extra.acao || null), link: extra.link || null, dados: extra.dados || null };
}

// Serviços que normalmente não são feitos por todos os barbeiros. Sem "quem faz", a IA
// oferece o horário de qualquer profissional livre (ex.: manicure com o barbeiro).
const SERVICO_ESPECIALIZADO = /manicure|pedicure|unha|massag|qu[ií]mic|est[eé]tic|sobrancelh|depila|limpeza de pele|podolog/i;
const STATUS_INATIVOS = new Set(['cancelado', 'nao_compareceu', 'concluido']);

/** Fatos da agenda e da equipe que decidem se a IA pode atender clientes reais (puro, testável). */
export function fatosAgendaParaIa({ profissionais = [], servicos = [], agendamentos = [], agora = Date.now() } = {}) {
  const ativos = profissionais.filter((p) => p.ativo !== false);
  const semJornada = ativos.filter((p) => !(Array.isArray(p.diasTrabalho) && p.diasTrabalho.length) || !p.horarioInicio || !p.horarioFim);
  const especializados = servicos.filter((s) => s.ativo !== false && SERVICO_ESPECIALIZADO.test(String(s.nome || '')));
  const semQuemFaz = especializados.filter((s) => !(Array.isArray(s.profissionaisIds) && s.profissionaisIds.length));
  const futuros = agendamentos.filter((a) => !STATUS_INATIVOS.has(String(a.status || '')) && Date.parse(a.dataHora) >= agora);
  return {
    profissionais: ativos.length,
    semJornada: semJornada.map((p) => ({ id: p.id, nome: p.nome })),
    semQuemFaz: semQuemFaz.map((s) => ({ id: s.id, nome: s.nome })),
    agendamentosFuturos: futuros.length,
  };
}

const TELA = Object.freeze({
  agenda: '/admin/barbearia-erp?area=operacao&tab=Agenda',
  equipe: '/admin/barbearia-erp?area=catalogo&tab=Profissionais',
  servicos: '/admin/barbearia-erp?area=catalogo&tab=Servi%C3%A7os',
  fila: '/admin/barbearia-erp?area=integracoes&tab=Integra%C3%A7%C3%B5es',
  resumo: '/admin/barbearia-erp?area=gestao&tab=Resumo+di%C3%A1rio',
});
const lista = (itens, n = 5) => `${itens.slice(0, n).map((i) => i.nome).join(', ')}${itens.length > n ? '…' : ''}`;

/** Grupo "Antes de liberar para os clientes": o que evita a IA errar no primeiro dia. */
function itensGoLive(f, out) {
  const g = 'Antes de liberar para os clientes';
  const a = f.agendaIa;
  const pronto = f.conexao === 'open' && a && a.agendamentosFuturos > 0 && a.semJornada.length === 0 && a.semQuemFaz.length === 0;
  const modo = f.poll?.modo || 'on';
  const pilotos = Number(f.poll?.pilotos || 0);
  const modoOk = modo === 'pilot' ? pilotos > 0 : modo === 'on' ? pronto : false;
  const modoDetalhe = {
    off: 'WHATSAPP_POLL_MODE=off: a IA não lê nenhuma mensagem.',
    shadow: 'WHATSAPP_POLL_MODE=shadow: a IA só observa, não responde.',
    pilot: pilotos > 0 ? `Piloto: só ${pilotos} telefone(s) de teste falam com a IA. Quando o ensaio passar, troque para on.` : 'Modo pilot sem telefones: defina WHATSAPP_POLL_PILOT_PHONES com os celulares de teste.',
    on: pronto ? 'Liberado para todos os clientes.' : 'WHATSAPP_POLL_MODE=on com itens abaixo pendentes: ao ler o QR, todos os clientes falam com a IA. Use pilot (com WHATSAPP_POLL_PILOT_PHONES) até tudo ficar verde.',
  }[modo];
  out.push(item(g, 'modo_entrada', 'Quem fala com a IA', modoOk, modoDetalhe));
  if (!a) {
    out.push(item(g, 'agenda', 'Agenda do Kytto em uso', false, 'Não foi possível ler a agenda desta empresa.'));
  } else {
    out.push(item(g, 'agenda', 'Agenda do Kytto em uso', a.agendamentosFuturos > 0,
      a.agendamentosFuturos > 0 ? `${a.agendamentosFuturos} horário(s) futuro(s) marcados.` : 'Nenhum horário futuro na agenda do Kytto: se a barbearia marca em outro sistema, a IA vai oferecer horários que já estão ocupados lá. Importe a agenda ou passe a marcar só no Kytto antes de liberar.',
      { link: TELA.agenda }));
    out.push(item(g, 'jornada', 'Profissionais com dias e horário', a.profissionais > 0 && a.semJornada.length === 0,
      a.profissionais === 0 ? 'Nenhum profissional ativo.' : a.semJornada.length ? `Sem dias ou horário: ${lista(a.semJornada)}.` : `${a.profissionais} profissional(is) com jornada definida.`,
      { link: TELA.equipe, dados: a.semJornada.length ? { itens: a.semJornada } : null }));
    out.push(item(g, 'quem_faz', 'Quem faz cada serviço especializado', a.semQuemFaz.length === 0,
      a.semQuemFaz.length ? `${a.semQuemFaz.length} serviço(s) aceitam qualquer profissional: ${lista(a.semQuemFaz)}. Marque quem faz em Serviços para a IA não oferecer, por exemplo, manicure com um barbeiro.` : 'Todos definidos.',
      { link: TELA.servicos, dados: a.semQuemFaz.length ? { itens: a.semQuemFaz } : null }));
  }
  const fila = Number(f.filaAntiga || 0);
  out.push(item(g, 'fila', 'Fila da equipe em dia', fila === 0,
    fila ? `${fila} conversa(s) esperando a equipe há mais de 2 horas.` : 'Sem conversas esquecidas.', { link: TELA.fila }));
  const r = f.resumo;
  out.push(item(g, 'resumo', 'Resumo diário no WhatsApp do dono', Boolean(r?.ativo && r.destinatarios?.length),
    r?.ativo && r.destinatarios?.length ? `Às ${r.hora} para ${r.destinatarios.join(', ')}.` : 'Defina DINO_RESUMO_DIARIO=on e DINO_RESUMO_TELEFONES no Render.', { opcional: true, link: TELA.resumo }));
}

/** Monta a lista de prontidão a partir de fatos já carregados (puro, testável). */
export function buildChecklist(f) {
  const out = [];
  const provider = f.provider;
  out.push(item('Servidor', 'commerce', 'Banco da loja (Commerce Core) ativo', f.commerce, f.commerce ? 'COMMERCE_CORE_ENABLED=1' : 'Defina COMMERCE_CORE_ENABLED=1 no Render.'));
  out.push(item('Servidor', 'migracao', 'Tabelas do cérebro criadas (migration 052)', f.migracao, f.migracao ? 'Aplicada.' : 'Roda sozinha no deploy (preDeployCommand).'));
  out.push(item('Servidor', 'whatsapp_chave', 'WhatsApp pelo backend do NossaGente', provider === 'chatbot_backend' && f.env.CHATBOT_BACKEND_KEY,
    provider !== 'chatbot_backend' ? 'Defina WHATSAPP_PROVIDER=chatbot_backend.' : f.env.CHATBOT_BACKEND_KEY ? `Instância ${f.instance}.` : 'Falta CHATBOT_BACKEND_KEY no Secret Manager.'));
  if (provider === 'chatbot_backend' && f.modo !== 'instancias') {
    // Igual à Isa: o backend não envia webhook; a Dino consulta as mensagens.
    out.push(item('Servidor', 'whatsapp_url', 'Backend WhatsApp próprio da Dino (URL)', Boolean(f.env.CHATBOT_BACKEND_URL), f.env.CHATBOT_BACKEND_URL ? 'Configurada.' : 'Falta CHATBOT_BACKEND_URL: o backend da Dino (o mesmo software da Isa, com o número da barbearia).'));
    out.push(item('Servidor', 'whatsapp_empresa', 'Número ligado a esta empresa', f.empresaDoNumero === true, f.empresaDoNumero ? 'CHATBOT_BACKEND_EMPRESA_ID aponta para esta empresa.' : 'Defina CHATBOT_BACKEND_EMPRESA_ID com o id desta empresa.'));
    out.push(item('Servidor', 'webhook_segredo', 'Entrada de mensagens', true, 'Por consulta periódica, igual à Isa (não usa webhook).', { opcional: true }));
  } else {
    out.push(item('Servidor', 'webhook_segredo', 'Segredo do webhook de entrada', f.env.WHATSAPP_AI_WEBHOOK_SECRET, f.env.WHATSAPP_AI_WEBHOOK_SECRET ? 'Configurado.' : 'Falta WHATSAPP_AI_WEBHOOK_SECRET (valor aleatório forte, diferente da chave do backend).'));
  }
  out.push(item('Servidor', 'ia_flag', 'Atendente IA habilitado', f.env.FEATURE_WHATSAPP_AI, f.env.FEATURE_WHATSAPP_AI ? 'FEATURE_WHATSAPP_AI=true' : 'Defina FEATURE_WHATSAPP_AI=true.'));
  out.push(item('Servidor', 'gemini', 'Gemini (IA principal do atendimento)', f.ia.gemini, f.ia.gemini ? 'Configurada.' : 'Falta GEMINI_API_KEY.'));
  out.push(item('Servidor', 'claude', 'Claude (reserva e aprendizado)', f.ia.anthropic, f.ia.anthropic ? 'Configurada.' : 'Opcional: ANTHROPIC_API_KEY.', { opcional: true }));
  out.push(item('Servidor', 'gpt', 'GPT (IA avaliadora)', f.ia.openai, f.ia.openai ? 'Configurada.' : 'Opcional: OPENAI_API_KEY.', { opcional: true }));

  out.push(item('WhatsApp', 'numero', 'Número conectado', f.conexao === 'open', f.conexao === 'open' ? 'Conectado.' : 'Leia o QR na tela WhatsApp.', { link: '/admin/whatsapp' }));
  const canal = f.canal;
  out.push(item('WhatsApp', 'canal', 'Canal do atendente', canal?.status === 'ativo',
    !canal ? 'Ainda não criado.' : canal.status === 'ativo' ? `Ativo · instância ${canal.instance}.` : `Em ${canal.status}.`,
    { acao: !canal ? 'criar_canal' : canal.status !== 'ativo' ? 'ativar_canal' : null }));
  const recebeu = canal?.lastEventAt && (f.agora - new Date(canal.lastEventAt).valueOf()) < 7 * 86400000;
  out.push(item('WhatsApp', 'webhook', 'Mensagens chegando no Kytto', Boolean(recebeu),
    recebeu ? `Última mensagem recebida em ${new Date(canal.lastEventAt).toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}.` : 'Cadastre o webhook no backend do NossaGente e mande uma mensagem de teste.',
    { dados: canal?.publicCode ? { url: `${f.baseUrl}/api/webhooks/whatsapp/${canal.publicCode}`, cabecalho: 'x-setpoint-webhook-token', segredo: 'WHATSAPP_AI_WEBHOOK_SECRET' } : null }));
  out.push(item('WhatsApp', 'politica', 'Aviso de privacidade e pedido de personalização', f.politica?.personalizationEnabled === true && Boolean(f.politica?.privacyNotice),
    f.politica?.personalizationEnabled ? 'O assistente pergunta antes de usar o histórico.' : 'Aplique a política recomendada.', { acao: canal ? 'politica' : null }));

  out.push(item('Cérebro', 'cerebro', 'Cérebro do atendente ligado', f.cerebro.ativo, f.cerebro.ativo ? `Nível N${f.cerebro.autonomia}.` : 'Ligue na aba Visão geral (comece no N1).', { link: '/admin/cerebro-ia' }));
  out.push(item('Cérebro', 'aprendizado', 'Primeiro ciclo de aprendizado', f.execucoes > 0, f.execucoes > 0 ? `${f.execucoes} execução(ões).` : 'Roda na madrugada seguinte à ativação.'));

  out.push(item('Loja e agenda', 'slug', 'Agendamento online em /agendar/dino', Boolean(f.slug) && f.agendamentoAtivo,
    f.slug ? `/agendar/${f.slug}${f.agendamentoAtivo ? '' : ' (desativado)'}` : 'Slug público não definido: a página de agendamento responde erro.', { acao: (!f.slug || !f.agendamentoAtivo) ? 'slug' : null }));
  const cores = f.vitrine?.accent && f.vitrine.accent !== DEFAULT_ORANGE;
  out.push(item('Loja e agenda', 'vitrine_cores', 'Cores da Dino na vitrine', cores, cores ? `Destaque ${f.vitrine.accent}.` : 'Vitrine com o laranja padrão da plataforma.', { acao: f.vitrine?.aliasCount ? 'vitrine' : null }));
  out.push(item('Loja e agenda', 'vitrine_contato', 'WhatsApp de contato na vitrine', Boolean(f.vitrine?.phone), f.vitrine?.phone ? `Contato ${f.vitrine.phone}.` : 'Sem telefone de contato na vitrine.', { acao: f.vitrine?.aliasCount ? 'vitrine' : null }));
  out.push(item('Loja e agenda', 'fotos', 'Perfumes com foto', f.semFoto.length === 0, f.semFoto.length ? `${f.semFoto.length} sem foto: ${f.semFoto.slice(0, 5).map((p) => p.nome).join(', ')}${f.semFoto.length > 5 ? '…' : ''}` : 'Todos com foto.', { link: '/admin/ecommerce', dados: { itens: f.semFoto } }));
  if (f.reservados?.length) out.push(item('Loja e agenda', 'reservados', 'Itens presos em reserva de pagamento pendente', true, `${f.reservados.length} aparecem esgotados na vitrine porque o saldo está reservado: ${f.reservados.slice(0, 4).map((p) => p.nome).join(', ')}. Confira os pagamentos pendentes antes de liberar.`, { opcional: true }));
  out.push(item('Loja e agenda', 'esgotados', 'Esgotados fora da vitrine', f.esgotados.length === 0, f.esgotados.length ? `${f.esgotados.length} à venda sem estoque: ${f.esgotados.slice(0, 5).map((p) => p.nome).join(', ')}${f.esgotados.length > 5 ? '…' : ''}` : 'Nenhum.', { acao: f.esgotados.length ? 'esgotados' : null, dados: { itens: f.esgotados } }));
  itensGoLive(f, out);
  const obrigatorios = out.filter((i) => !i.opcional);
  return { itens: out, prontos: obrigatorios.filter((i) => i.ok).length, total: obrigatorios.length };
}

async function tableExists(name) {
  const r = await db.queryRead('SELECT to_regclass($1) AS t', [name]).catch(() => ({ rows: [] }));
  return Boolean(r.rows[0]?.t);
}

async function catalogIssues(empresaId) {
  const r = await db.queryRead(
    `SELECT p.id, p.nome,
            EXISTS (SELECT 1 FROM commerce_product_media m WHERE m.empresa_id = p.empresa_id AND m.product_id = p.id) AS tem_foto,
            COALESCE((SELECT SUM(il.reservado) FROM commerce_product_variants v
                        JOIN commerce_inventory_levels il ON il.empresa_id = v.empresa_id AND il.variant_id = v.id
                       WHERE v.empresa_id = p.empresa_id AND v.product_id = p.id AND v.ativo = true), 0)::int AS reservado,
            COALESCE((SELECT SUM(GREATEST(il.disponivel, 0)) FROM commerce_product_variants v
                        JOIN commerce_inventory_levels il ON il.empresa_id = v.empresa_id AND il.variant_id = v.id
                       WHERE v.empresa_id = p.empresa_id AND v.product_id = p.id AND v.ativo = true), 0)::int AS estoque
       FROM commerce_products p
      WHERE p.empresa_id = $1 AND p.status = 'active' AND p.tipo = 'physical'
      ORDER BY p.nome LIMIT 2000`,
    [empresaId],
  );
  return {
    semFoto: r.rows.filter((p) => !p.tem_foto).map((p) => ({ id: p.id, nome: p.nome })),
    // Esgotado = saldo físico zero. Item com saldo só reservado (pagamento pendente) não entra:
    // despublicar esconderia um produto que volta a ficar disponível se o pagamento não vier.
    esgotados: r.rows.filter((p) => Number(p.estoque) <= 0).map((p) => ({ id: p.id, nome: p.nome })),
    reservados: r.rows.filter((p) => Number(p.estoque) > 0 && Number(p.reservado) >= Number(p.estoque)).map((p) => ({ id: p.id, nome: p.nome })),
  };
}

async function storefrontIdentity(empresaId) {
  const r = await db.queryRead(
    `SELECT a.id, a.public_config, s.configuracoes->'public' AS storefront_public
       FROM commerce_storefront_aliases a
       JOIN commerce_storefronts s ON s.empresa_id = a.empresa_id AND s.id = a.storefront_id
      WHERE a.empresa_id = $1 AND a.ativo = true AND s.status = 'active'
      ORDER BY a.atualizado_em DESC NULLS LAST`,
    [empresaId],
  );
  const first = r.rows[0];
  const source = first ? (Object.keys(first.public_config || {}).length ? first.public_config : (first.storefront_public || {})) : {};
  return { aliasCount: r.rows.length, accent: String(source?.colors?.accent || DEFAULT_ORANGE).toUpperCase(), phone: source?.contact?.phone || '', displayName: source?.displayName || '', config: source };
}

export function registerAtivacaoRoutes(app, deps) {
  const { legacyEmpresaId, requireCommercePermission, barbeariaErpKytto, audit = () => {} } = deps;
  const note = (req, acao, detalhe) => { try { audit(req, acao, JSON.stringify(detalhe ?? {}).slice(0, 600)); } catch { /* não bloqueia */ } };

  async function scope(req, res, permission = 'reports.read') {
    if (!(req.user?.platformAdmin || GESTORES.has(String(req.user?.role || '')))) { res.status(403).json({ error: 'Disponível para administradores e gestores da empresa.', code: 'TENANT_MANAGER_REQUIRED' }); return null; }
    if (process.env.COMMERCE_CORE_ENABLED !== '1') return { semCommerce: true, legacy: legacyEmpresaId(req) };
    try {
      const context = await requireCommercePermission(req, permission);
      if (!context.lojaId) {
        const loja = await db.queryRead(
          `SELECT loja_id FROM canais_integracao WHERE empresa_id = $1 AND provedor = 'whatsapp' ORDER BY data_atualizacao DESC NULLS LAST LIMIT 1`, [context.empresaId],
        ).catch(() => ({ rows: [] }));
        const fallback = loja.rows[0]?.loja_id || (await db.queryRead(`SELECT id FROM lojas WHERE empresa_id = $1 ORDER BY id LIMIT 1`, [context.empresaId]).catch(() => ({ rows: [] }))).rows[0]?.id || null;
        return { context: { ...context, lojaId: fallback }, legacy: legacyEmpresaId(req) };
      }
      return { context, legacy: legacyEmpresaId(req) };
    } catch (error) {
      res.status(error?.code === 'PERMISSION_DENIED' ? 403 : 409).json({ error: 'Sem acesso ao banco da loja para esta empresa.', code: error?.code || 'COMMERCE_SCOPE' });
      return null;
    }
  }
  const fail = (res, error) => res.status(Number(error?.status) || 400).json({ error: String(error?.message || 'Não foi possível concluir.').slice(0, 300), code: error?.code || 'ATIVACAO_ERROR' });

  app.get(BASE, async (req, res) => {
    const s = await scope(req, res); if (!s) return;
    try {
      const config = barbeariaErpKytto.obterConfiguracao(s.legacy) || {};
      const conexao = obterConexao(s.legacy);
      const base = String(process.env.SERVER_URL || process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
      const facts = {
        agora: Date.now(), baseUrl: base,
        commerce: process.env.COMMERCE_CORE_ENABLED === '1',
        provider: whatsappProviderName(), instance: whatsappProviderName() === 'chatbot_backend' ? chatbotBackendConfig().instance : process.env.EVOLUTION_INSTANCE || '',
        env: Object.fromEntries(['CHATBOT_BACKEND_KEY', 'CHATBOT_BACKEND_URL', 'WHATSAPP_AI_WEBHOOK_SECRET'].map((n) => [n, envSet(n)]).concat([['FEATURE_WHATSAPP_AI', process.env.FEATURE_WHATSAPP_AI === 'true']])),
        modo: chatbotBackendMode(),
        empresaDoNumero: String(process.env.CHATBOT_BACKEND_EMPRESA_ID || '').trim() === String(s.context?.empresaId || s.legacy || '').trim(),
        ia: { gemini: providerConfigured('gemini'), anthropic: providerConfigured('anthropic'), openai: providerConfigured('openai') },
        conexao: conexao?.state || 'unknown',
        slug: config.slugPublico || '', agendamentoAtivo: config.agendamentoPublicoAtivo !== false,
        migracao: false, canal: null, politica: null, cerebro: { ativo: false, autonomia: 1 }, execucoes: 0,
        vitrine: null, semFoto: [], esgotados: [], reservados: [],
        poll: { modo: pollMode(), pilotos: String(process.env.WHATSAPP_POLL_PILOT_PHONES || '').split(',').filter((t) => t.replace(/\D/g, '').length >= 10).length },
        resumo: configuracaoResumoPublica(),
        agendaIa: null, filaAntiga: 0,
      };
      try {
        facts.agendaIa = fatosAgendaParaIa({
          profissionais: barbeariaErpKytto.listarProfissionais(s.legacy),
          servicos: barbeariaErpKytto.listarServicos(s.legacy),
          agendamentos: barbeariaErpKytto.listarAgendamentos(s.legacy),
          agora: facts.agora,
        });
      } catch { facts.agendaIa = null; }
      if (!s.semCommerce) {
        const empresaId = s.context.empresaId;
        const [migracao, status, cerebro, runs, vitrine, catalogo, filaAntiga] = await Promise.all([
          tableExists('ai_brain_settings'),
          whatsappAiOperationalStatus(s.context).catch(() => null),
          getBrainSettings(empresaId),
          db.queryRead('SELECT COUNT(*)::int AS n FROM ai_learning_runs WHERE empresa_id = $1', [empresaId]).then((r) => r.rows[0].n).catch(() => 0),
          storefrontIdentity(empresaId).catch(() => null),
          catalogIssues(empresaId).catch(() => ({ semFoto: [], esgotados: [], reservados: [] })),
          // Conversa na fila há mais de 2 h que não é só a pausa automática (equipe no celular).
          db.queryRead(
            `SELECT COUNT(*)::int AS n FROM whatsapp_ai_sessions
              WHERE empresa_id = $1 AND status = 'humano' AND (estado->>'staffPauseUntil') IS NULL
                AND ultima_interacao_em < CURRENT_TIMESTAMP - INTERVAL '2 hours'`, [empresaId],
          ).then((r) => r.rows[0].n).catch(() => 0),
        ]);
        Object.assign(facts, { migracao, canal: status?.channel || null, politica: status?.policy || null, cerebro, execucoes: runs, vitrine, ...catalogo, filaAntiga });
      }
      res.json({ ...buildChecklist(facts), vitrine: facts.vitrine ? { displayName: facts.vitrine.displayName, phone: facts.vitrine.phone, accent: facts.vitrine.accent } : null, identidadeDino: DINO_IDENTITY, avisoRecomendado: RECOMMENDED_NOTICE });
    } catch (error) { fail(res, error); }
  });

  app.post(`${BASE}/canal`, async (req, res) => {
    const s = await scope(req, res, 'settings.write'); if (!s) return;
    if (s.semCommerce) return fail(res, { message: 'Ative o banco da loja primeiro.', status: 409 });
    try {
      const ativar = req.body?.ativar === true;
      if (ativar && req.body?.confirmado !== true) throw Object.assign(new Error('Confirme a ativação.'), { status: 400 });
      const canal = await configureWhatsappAiChannel(s.context, {
        status: ativar ? 'ativo' : 'rascunho', instance: whatsappProviderName() === 'chatbot_backend' ? chatbotBackendConfig().instance : undefined,
        displayName: 'Barbearia Dino', webhookSecretEnv: 'WHATSAPP_AI_WEBHOOK_SECRET', capabilities: RECOMMENDED_CAPABILITIES, confirmed: ativar,
      });
      note(req, ativar ? 'ativacao_canal_ativo' : 'ativacao_canal_rascunho', { status: canal.status });
      res.json({ canal });
    } catch (error) { fail(res, error); }
  });

  app.post(`${BASE}/politica`, async (req, res) => {
    const s = await scope(req, res, 'settings.write'); if (!s) return;
    if (s.semCommerce) return fail(res, { message: 'Ative o banco da loja primeiro.', status: 409 });
    try {
      const result = await configureWhatsappAiPolicy(s.context, { personalizationEnabled: true, opportunitiesEnabled: false, cooldownDays: 30, privacyNotice: RECOMMENDED_NOTICE, confirmed: true });
      note(req, 'ativacao_politica', { personalization: true });
      res.json(result);
    } catch (error) { fail(res, error); }
  });

  app.post(`${BASE}/slug`, async (req, res) => {
    const s = await scope(req, res, 'settings.write'); if (!s) return;
    try {
      const slug = String(req.body?.slug || 'dino').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
      if (slug.length < 3) throw new Error('Slug muito curto.');
      const configuracao = barbeariaErpKytto.atualizarConfiguracao(s.legacy, { slugPublico: slug, agendamentoPublicoAtivo: true });
      note(req, 'ativacao_slug', { slug });
      res.json({ slug: configuracao.slugPublico, url: `/agendar/${configuracao.slugPublico}` });
    } catch (error) { fail(res, error); }
  });

  app.put(`${BASE}/vitrine`, async (req, res) => {
    const s = await scope(req, res, 'settings.write'); if (!s) return;
    if (s.semCommerce) return fail(res, { message: 'Ative o banco da loja primeiro.', status: 409 });
    try {
      const empresaId = s.context.empresaId;
      const atual = await storefrontIdentity(empresaId);
      if (!atual.aliasCount) throw Object.assign(new Error('Vitrine não encontrada para esta empresa.'), { status: 404 });
      const base = atual.config || {};
      const body = req.body || {};
      const next = publicConfig({
        ...base,
        displayName: body.displayName ?? base.displayName,
        phone: body.phone ?? base.contact?.phone,
        email: base.contact?.email || undefined,
        // Só o destaque muda; fundo, superfície e texto ficam como estão (ou no padrão claro da vitrine).
        colors: { ...LIGHT_BASE, ...(base.colors || {}), ...(body.usarIdentidadeDino ? DINO_IDENTITY : (body.colors || {})) },
      }, base.displayName || 'Barbearia Dino');
      await db.transaction(async (trx) => {
        await trx.query(`UPDATE commerce_storefront_aliases SET public_config = $2::jsonb, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND ativo = true`, [empresaId, JSON.stringify(next)]);
        await trx.query(
          `INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois)
           VALUES ($1, $2, $3, 'storefront_identity', $1, 'updated', $4::jsonb)`,
          [empresaId, s.context.lojaId, s.context.usuarioId || null, JSON.stringify({ accent: next.colors.accent, telefone: next.contact.phone ? `…${next.contact.phone.slice(-4)}` : '' })],
        );
      });
      note(req, 'ativacao_vitrine', { accent: next.colors.accent });
      res.json({ ok: true, accent: next.colors.accent, phone: next.contact.phone });
    } catch (error) { fail(res, error); }
  });

  app.post(`${BASE}/esgotados`, async (req, res) => {
    const s = await scope(req, res, 'catalog.write'); if (!s) return;
    if (s.semCommerce) return fail(res, { message: 'Ative o banco da loja primeiro.', status: 409 });
    try {
      if (req.body?.confirmado !== true) throw new Error('Confirme a lista de produtos.');
      const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).filter((id) => /^[0-9a-f-]{36}$/i.test(String(id))).slice(0, 200);
      if (!ids.length) throw new Error('Nenhum produto informado.');
      const { esgotados } = await catalogIssues(s.context.empresaId);
      const permitido = new Set(esgotados.map((p) => p.id));
      const alvo = ids.filter((id) => permitido.has(id)); // só o que continua sem estoque agora
      const result = await db.transaction(async (trx) => {
        const r = await trx.query(
          `UPDATE commerce_products SET status = 'draft', atualizado_em = CURRENT_TIMESTAMP
            WHERE empresa_id = $1 AND id = ANY($2::uuid[]) AND status = 'active' RETURNING id, nome`,
          [s.context.empresaId, alvo],
        );
        await trx.query(
          `INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois)
           VALUES ($1, $2, $3, 'product', $1, 'unpublished_out_of_stock', $4::jsonb)`,
          [s.context.empresaId, s.context.lojaId, s.context.usuarioId || null, JSON.stringify({ produtos: r.rows.map((p) => p.nome) })],
        );
        return r.rows;
      });
      note(req, 'ativacao_esgotados', { total: result.length });
      res.json({ despublicados: result.map((p) => p.nome) });
    } catch (error) { fail(res, error); }
  });
}
