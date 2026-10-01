// Rotas da conexão WhatsApp da empresa (mesmo backend do NossaGente).
// Base: /api/admin/barbearia/whatsapp-conexao — auth + staff + escopo de empresa
// já aplicados em server.js. Ações que mudam a conexão exigem gestor.

import * as conexaoKytto from './whatsapp-conexao-kytto.js';
import { whatsappProviderName } from './core/whatsapp-provider.js';

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

export function registerWhatsappConexaoRoutes(app, { legacyEmpresaId, audit, save, enviarMensagem, fetchImpl, isPlatformAdmin = () => false } = {}) {
  const who = (req) => req.user?.email || req.user?.nome || '';

  app.get(BASE, async (req, res) => {
    const empresaId = legacyEmpresaId(req);
    try {
      const conexao = req.query?.atualizar === '1' && whatsappProviderName() === 'chatbot_backend'
        ? await conexaoKytto.verificarConexao(empresaId, { fetchImpl })
        : conexaoKytto.visaoPublica(conexaoKytto.obterConexao(empresaId));
      res.json({ ok: true, conexao, podeGerenciar: GESTORES.has(String(req.user?.role || '')) });
    } catch (error) { res.status(502).json({ error: 'Não foi possível consultar o backend do WhatsApp.', detail: String(error?.message || '').slice(0, 120) }); }
  });

  app.post(`${BASE}/qr`, async (req, res) => {
    if (!gestor(req, res)) return;
    if (whatsappProviderName() !== 'chatbot_backend') return res.status(409).json({ error: 'Defina WHATSAPP_PROVIDER=chatbot_backend no servidor para usar o backend do NossaGente.' });
    const empresaId = legacyEmpresaId(req);
    const auto = req.body?.auto === true;
    const result = await conexaoKytto.gerarQr(empresaId, { usuario: who(req), fetchImpl, registrarHistorico: !auto });
    if (!auto) { audit(req, 'WHATSAPP CONEXAO QR', `instancia=${result.conexao.instance}; ok=${result.ok}`); save(); }
    res.status(result.ok ? 200 : result.code === 'WHATSAPP_INSTANCE_UNASSIGNED' ? 409 : 502).json(result);
  });

  app.post(`${BASE}/desconectar`, async (req, res) => {
    if (!gestor(req, res)) return;
    if (req.body?.confirmado !== true) return res.status(400).json({ error: 'Confirme a desconexão.' });
    const empresaId = legacyEmpresaId(req);
    const result = await conexaoKytto.desconectar(empresaId, { usuario: who(req), fetchImpl });
    audit(req, 'WHATSAPP CONEXAO DESCONECTAR', `instancia=${result.conexao.instance}; ok=${result.ok}`);
    save();
    res.status(result.ok ? 200 : result.code === 'WHATSAPP_INSTANCE_UNASSIGNED' ? 409 : 502).json(result);
  });

  app.put(`${BASE}/config`, (req, res) => {
    if (!gestor(req, res)) return;
    try {
      const conexao = conexaoKytto.configurar(legacyEmpresaId(req), req.body || {}, { podeTrocarInstancia: isPlatformAdmin(req.user) });
      audit(req, 'WHATSAPP CONEXAO CONFIG', `instancia=${conexao.instance}; autoReconnect=${conexao.autoReconnect}`);
      save();
      res.json({ ok: true, conexao });
    } catch (error) { res.status(400).json({ error: error.message }); }
  });

  app.post(`${BASE}/verificar`, async (req, res) => {
    if (!gestor(req, res)) return;
    const empresaId = legacyEmpresaId(req);
    const resultado = await conexaoKytto.vigiarConexao(empresaId, { fetchImpl });
    res.json({ ok: true, resultado, conexao: conexaoKytto.visaoPublica(conexaoKytto.obterConexao(empresaId)) });
  });

  app.post(`${BASE}/teste`, async (req, res) => {
    if (!gestor(req, res)) return;
    if (req.body?.confirmado !== true) return res.status(400).json({ error: 'Confirme o envio do teste.' });
    const telefone = String(req.body?.telefone || '').replace(/\D/g, '');
    if (telefone.length < 10 || telefone.length > 13) return res.status(400).json({ error: 'Informe um telefone com DDD.' });
    const empresaId = legacyEmpresaId(req);
    if (!allowTest(empresaId)) return res.status(429).json({ error: `Limite de ${TEST_LIMIT_PER_HOUR} testes por hora atingido.` });
    const conexao = conexaoKytto.obterConexao(empresaId);
    if (!conexao.instance) return res.status(409).json({ error: 'Esta empresa ainda não tem uma instância de WhatsApp atribuída.', code: 'WHATSAPP_INSTANCE_UNASSIGNED' });
    const texto = String(req.body?.mensagem || '').trim().slice(0, 300) || 'Teste de conexão do WhatsApp da Dino. Se você recebeu esta mensagem, o canal está funcionando.';
    const result = await enviarMensagem({ whatsapp_instance: conexao.instance }, telefone, texto);
    audit(req, 'WHATSAPP CONEXAO TESTE', `instancia=${conexao.instance}; destino=${telefone.slice(0, 4)}****${telefone.slice(-2)}; ok=${result.ok}; status=${result.status ?? '-'}`);
    save();
    res.status(result.ok ? 200 : 502).json({ ok: result.ok, status: result.status ?? null, error: result.ok ? null : (result.authError ? 'Backend recusou a chave de API.' : (result.error || 'Envio não confirmado pelo backend.')) });
  });
}
