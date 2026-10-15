// Rotas da conexão WhatsApp da empresa (mesmo backend do NossaGente).
// Base: /api/admin/barbearia/whatsapp-conexao — auth + staff + escopo de empresa
// já aplicados em server.js. Ações que mudam a conexão exigem gestor.

import * as conexaoKytto from './whatsapp-conexao-kytto.js';
import { instanceOwner, whatsappProviderName } from './core/whatsapp-provider.js';
import { diagnosticarWhatsapp } from './core/whatsapp-diagnostico.js';
import { db } from './core/database.js';
import { egressMensagem, egressResumo, evaluateWhatsappEgress } from './core/whatsapp-egress.js';
import { listWahaGroups, validWahaGroupId, wahaControlConfigured } from './core/whatsapp-waha.js';

const BASE = '/api/admin/barbearia/whatsapp-conexao';
const GESTORES = new Set(['admin', 'organizador']);
const TEST_LIMIT_PER_HOUR = 5;
const testWindow = new Map();

function gestor(req, res) {
  if (GESTORES.has(String(req.user?.role || ''))) return true;
  res.status(403).json({ error: 'Só administradores e gestores podem alterar a conexão do WhatsApp.' });
  return false;
}

function allowTest(empresaId, now = Date.now()) {
  const recent = (testWindow.get(empresaId) || []).filter((at) => now - at < 3_600_000);
  if (recent.length >= TEST_LIMIT_PER_HOUR) { testWindow.set(empresaId, recent); return false; }
  recent.push(now);
  testWindow.set(empresaId, recent);
  return true;
}

export function registerWhatsappConexaoRoutes(app, { legacyEmpresaId, legacyLojaId, audit, save, enviarMensagem, fetchImpl, isPlatformAdmin = () => false, basePath = BASE, tipoCanal = 'cliente' } = {}) {
  const perfilBruto = String(tipoCanal || 'cliente').toLowerCase();
  const perfil = ['cliente', 'gestao', 'lancamentos'].includes(perfilBruto) ? perfilBruto : 'cliente';
  const routeBase = basePath;
  const who = (req) => req.user?.email || req.user?.nome || '';
  // `saida` acompanha toda resposta da conexão para a tela saber se o envio está liberado.
  const view = (req, empresaId) => ({
    ...conexaoKytto.visaoPublica(conexaoKytto.obterConexao(empresaId, perfil), {
      numeroCompleto: GESTORES.has(String(req.user?.role || '')),
    }),
    saida: egressResumo(),
  });

  app.get(routeBase, async (req, res) => {
    const empresaId = legacyEmpresaId(req);
    try {
      if (req.query?.atualizar === '1' && (whatsappProviderName() === 'chatbot_backend' || perfil !== 'cliente')) {
        await conexaoKytto.verificarConexao(empresaId, { fetchImpl, tipoCanal: perfil });
      }
      res.set('Cache-Control', 'private, no-store');
      res.json({ ok: true, conexao: view(req, empresaId), podeGerenciar: GESTORES.has(String(req.user?.role || '')) });
    } catch (error) { res.status(502).json({ error: 'Não foi possível consultar o backend do WhatsApp.', detail: String(error?.message || '').slice(0, 120) }); }
  });

  app.get(`${routeBase}/grupos`, async (req, res) => {
    if (!gestor(req, res)) return;
    if (perfil === 'cliente') return res.status(409).json({ error: 'Listagem de grupos pertence somente aos canais internos WAHA.' });
    if (!wahaControlConfigured()) return res.status(503).json({ error: 'Controle privado WAHA não configurado no servidor.', code: 'WAHA_NOT_CONFIGURED' });
    const empresaId = legacyEmpresaId(req);
    const conexao = conexaoKytto.obterConexao(empresaId, perfil);
    if (!conexao.instance) return res.status(409).json({ error: 'Esta empresa ainda não tem uma sessão WAHA atribuída.', code: 'WHATSAPP_INSTANCE_UNASSIGNED' });
    try {
      const groups = await listWahaGroups(conexao.instance);
      res.set('Cache-Control', 'private, no-store');
      res.json({ ok: true, groups });
    } catch (error) { res.status(502).json({ error: 'Não foi possível listar os grupos WAHA agora.', detail: String(error?.message || '').slice(0, 160) }); }
  });

  app.put(`${routeBase}/grupo`, async (req, res) => {
    if (!gestor(req, res)) return;
    if (perfil === 'cliente') return res.status(409).json({ error: 'Grupo Admin pertence somente aos canais internos WAHA.' });
    const groupId = validWahaGroupId(req.body?.groupId || req.body?.grupoId);
    if (!groupId) return res.status(400).json({ error: 'Selecione um grupo WAHA válido.' });
    if (!wahaControlConfigured()) return res.status(503).json({ error: 'Controle privado WAHA não configurado no servidor.', code: 'WAHA_NOT_CONFIGURED' });
    const empresaId = legacyEmpresaId(req);
    const lojaId = legacyLojaId(req);
    const conexao = conexaoKytto.obterConexao(empresaId, perfil);
    if (!conexao.instance) return res.status(409).json({ error: 'Esta empresa ainda não tem uma sessão WAHA atribuída.', code: 'WHATSAPP_INSTANCE_UNASSIGNED' });
    try {
      const groups = await listWahaGroups(conexao.instance);
      const selected = groups.find((item) => item.id === groupId);
      if (!selected) return res.status(400).json({ error: 'O grupo não pertence à sessão WAHA desta empresa ou não está disponível.' });
      const result = await db.query(
        `UPDATE canais_integracao
            SET configuracao = COALESCE(configuracao, '{}'::jsonb) || $4::jsonb,
                data_atualizacao = CURRENT_TIMESTAMP
          WHERE empresa_id = $1 AND loja_id = $2 AND provedor = 'whatsapp' AND tipo_canal = $3
          RETURNING id`,
        [empresaId, lojaId, perfil, JSON.stringify({ waha_group_id: groupId, waha_group_subject: selected.subject, transporte: 'waha', provider: 'waha' })],
      );
      if (!result.rows[0]) return res.status(409).json({ error: 'Prepare primeiro o canal WhatsApp em rascunho.' });
      audit(req, 'WHATSAPP WAHA GRUPO ADMIN', `perfil=${perfil}; grupo=${groupId}`);
      save();
      res.json({ ok: true, group: selected });
    } catch (error) { res.status(502).json({ error: 'Não foi possível salvar o grupo Admin WAHA.', detail: String(error?.message || '').slice(0, 160) }); }
  });

  app.post(`${routeBase}/qr`, async (req, res) => {
    if (!gestor(req, res)) return;
    if (perfil === 'cliente' && whatsappProviderName() !== 'chatbot_backend') return res.status(409).json({ error: 'Defina WHATSAPP_PROVIDER=chatbot_backend no servidor para usar o backend do NossaGente.' });
    const empresaId = legacyEmpresaId(req);
    const auto = req.body?.auto === true;
    const result = await conexaoKytto.gerarQr(empresaId, { usuario: who(req), fetchImpl, registrarHistorico: !auto, tipoCanal: perfil });
    if (!auto) { audit(req, 'WHATSAPP CONEXAO QR', `instancia=${result.conexao.instance}; ok=${result.ok}`); save(); }
    res.status(result.ok ? 200 : result.code === 'WHATSAPP_INSTANCE_UNASSIGNED' ? 409 : 502).json({ ...result, conexao: view(req, empresaId) });
  });

  app.post(`${routeBase}/desconectar`, async (req, res) => {
    if (!gestor(req, res)) return;
    if (req.body?.confirmado !== true) return res.status(400).json({ error: 'Confirme a desconexão.' });
    const empresaId = legacyEmpresaId(req);
    const result = await conexaoKytto.desconectar(empresaId, { usuario: who(req), fetchImpl, tipoCanal: perfil });
    audit(req, 'WHATSAPP CONEXAO DESCONECTAR', `instancia=${result.conexao.instance}; ok=${result.ok}`);
    save();
    res.status(result.ok ? 200 : result.code === 'WHATSAPP_INSTANCE_UNASSIGNED' ? 409 : 502).json({ ...result, conexao: view(req, empresaId) });
  });

  app.put(`${routeBase}/config`, (req, res) => {
    if (!gestor(req, res)) return;
    try {
      const empresaId = legacyEmpresaId(req);
      const conexao = conexaoKytto.configurar(empresaId, req.body || {}, { podeTrocarInstancia: isPlatformAdmin(req.user), tipoCanal: perfil });
      audit(req, 'WHATSAPP CONEXAO CONFIG', `instancia=${conexao.instance}; autoReconnect=${conexao.autoReconnect}`);
      save();
      res.json({ ok: true, conexao: view(req, empresaId) });
    } catch (error) { res.status(400).json({ error: error.message }); }
  });

  // Diagnóstico de ponta a ponta (só leitura): contagens, horários e travas; nunca conteúdo, número completo ou segredo.
  app.get(`${routeBase}/diagnostico`, async (req, res) => {
    if (!gestor(req, res)) return;
    // O diagnóstico consulta a instância DESTA empresa. Só a empresa dona da instância
    // (CHATBOT_BACKEND_INSTANCES ou o par antigo) vê o estado dela; nunca o da Dino.
    const empresaId = String(legacyEmpresaId(req) || '');
    const instance = conexaoKytto.obterConexao(empresaId, perfil).instance || '';
    if (!instance) {
      return res.status(403).json({ error: 'Esta empresa ainda não tem uma instância de WhatsApp atribuída.', code: 'PERMISSION_DENIED', motivo: 'WHATSAPP_INSTANCE_UNASSIGNED' });
    }
    const owner = instanceOwner(instance);
    if (owner && owner !== empresaId.toLowerCase()) {
      return res.status(403).json({ error: 'Diagnóstico indisponível para esta empresa.', code: 'PERMISSION_DENIED' });
    }
    try {
      // Sem dono registrado o diagnóstico ainda roda: ele mostra exatamente o que falta
      // (instância no backend, empresa dona, linha verificada) sem ler mensagens de outra empresa.
      res.json({ ok: true, ...(await diagnosticarWhatsapp({ fetchImpl, instance, semDono: !owner })) });
    } catch (error) { res.status(502).json({ error: 'Não foi possível diagnosticar o WhatsApp agora.', detail: String(error?.message || '').slice(0, 160) }); }
  });

  app.post(`${routeBase}/verificar`, async (req, res) => {
    if (!gestor(req, res)) return;
    const empresaId = legacyEmpresaId(req);
    const resultado = await conexaoKytto.vigiarConexao(empresaId, { fetchImpl, tipoCanal: perfil });
    res.json({ ok: true, resultado, conexao: view(req, empresaId) });
  });

  app.post(`${routeBase}/teste`, async (req, res) => {
    if (!gestor(req, res)) return;
    if (req.body?.confirmado !== true) return res.status(400).json({ error: 'Confirme o envio do teste.' });
    const telefone = String(req.body?.telefone || '').replace(/\D/g, '');
    if (perfil === 'cliente' && (telefone.length < 10 || telefone.length > 13)) return res.status(400).json({ error: 'Informe um telefone com DDD.' });
    const empresaId = legacyEmpresaId(req);
    const lojaId = legacyLojaId(req);
    if (!lojaId) return res.status(409).json({ error: 'Selecione a unidade da empresa para o teste.', code: 'STORE_SELECTION_REQUIRED' });
    const conexao = conexaoKytto.obterConexao(empresaId, perfil);
    if (!conexao.instance) return res.status(409).json({ error: 'Esta empresa ainda não tem uma instância de WhatsApp atribuída.', code: 'WHATSAPP_INSTANCE_UNASSIGNED' });
    const canal = await db.queryRead(`SELECT id, configuracao FROM canais_integracao WHERE empresa_id=$1 AND loja_id=$2 AND provedor='whatsapp' AND tipo_canal=$4 AND status='ativo' AND configuracao->>'instance'=$3 LIMIT 1`, [empresaId, lojaId, conexao.instance, perfil]).catch(() => ({ rows: [] }));
    if (!canal.rows[0]) return res.status(409).json({ error: 'Canal da unidade indisponível para o teste.', code: 'WHATSAPP_CHANNEL_UNAVAILABLE' });
    if (perfil !== 'cliente') {
      const groupId = validWahaGroupId(canal.rows[0].configuracao?.waha_group_id);
      if (!groupId) return res.status(409).json({ error: 'Selecione exatamente um grupo Admin antes de testar.', code: 'WAHA_GROUP_REQUIRED' });
      if (!allowTest(`${empresaId}:${perfil}`)) return res.status(429).json({ error: `Limite de ${TEST_LIMIT_PER_HOUR} testes por hora atingido.` });
      const texto = String(req.body?.mensagem || '').trim().slice(0, 300) || 'Teste do canal interno WAHA. Esta mensagem foi enviada somente ao grupo Admin allowlisted.';
      const result = await enviarMensagem({ transport: 'waha', waha_session: conexao.instance, waha_group_id: groupId, empresa_id: empresaId, loja_id: lojaId, canal_id: canal.rows[0].id }, groupId, texto);
      audit(req, 'WHATSAPP CONEXAO TESTE', `perfil=${perfil}; ok=${result.ok === true}`);
      save();
      return res.status(result.ok ? 200 : 502).json({ ok: result.ok, status: result.status ?? null, code: result.ok ? null : (result.error || null), error: result.ok ? null : (result.error || 'Envio não confirmado pelo bridge WAHA.') });
    }
    // Trava de saída conferida antes do envio: se o servidor bloqueia (ex.: WHATSAPP_EGRESS_MODE=off),
    // responde 409 com orientação em português e não consome a cota de testes.
    if (whatsappProviderName() === 'chatbot_backend') {
      const gate = evaluateWhatsappEgress({ empresaId, lojaId, canalId: canal.rows[0].id, instance: conexao.instance, number: telefone.length <= 11 ? `55${telefone}` : telefone });
      if (!gate.ok && gate.reason !== 'provider_scope') {
        audit(req, 'WHATSAPP CONEXAO TESTE', `ok=false; bloqueio=${gate.reason}`);
        save();
        return res.status(409).json({ ok: false, code: `WHATSAPP_EGRESS_${gate.reason.toUpperCase()}`, error: egressMensagem(gate.reason) || 'Envio bloqueado pela política de saída do servidor.' });
      }
    }
    if (!allowTest(`${empresaId}:${perfil}`)) return res.status(429).json({ error: `Limite de ${TEST_LIMIT_PER_HOUR} testes por hora atingido.` });
    const texto = String(req.body?.mensagem || '').trim().slice(0, 300) || 'Teste de conexão do WhatsApp da Dino. Se você recebeu esta mensagem, o canal está funcionando.';
    const result = await enviarMensagem({ whatsapp_instance: conexao.instance, empresa_id: empresaId, loja_id: lojaId, canal_id: canal.rows[0].id }, telefone, texto);
    audit(req, 'WHATSAPP CONEXAO TESTE', `ok=${result.ok === true}; status=${Number(result.status) || '-'}`);
    save();
    res.status(result.ok ? 200 : 502).json({ ok: result.ok, status: result.status ?? null, code: result.ok ? null : (result.error || null), error: result.ok ? null : (result.authError ? 'Backend recusou a chave de API.' : (egressMensagem(result.error) || result.error || 'Envio não confirmado pelo backend.')) });
  });
}
