import {
  obterConfiguracaoAntiban,
  atualizarConfiguracaoAntiban,
  registrarOptOut,
  estaEmJanelaSeguraEnvio,
  gerarMensagemHumanizadaDino,
  ESTAGIOS_AQUECIMENTO,
} from './core/whatsapp-antiban.js';

export function registerDinoAntibanRoutes(app, deps = {}) {
  const { legacyEmpresaId } = deps;
  const BASE = '/api/admin/barbearia/antiban';

  function getEmpresaId(req) {
    if (typeof legacyEmpresaId === 'function') {
      try {
        const id = legacyEmpresaId(req);
        if (id) return id;
      } catch {}
    }
    return req.query?.empresaId || req.body?.empresaId || 'dino';
  }

  // 1. Obter diagnóstico e estado de aquecimento do chip
  app.get(BASE, (req, res) => {
    try {
      const empresaId = getEmpresaId(req);
      const config = obterConfiguracaoAntiban(empresaId);
      const janelaAtual = estaEmJanelaSeguraEnvio();

      res.json({
        ok: true,
        antiban: config,
        janelaEnvio: {
          aberta: janelaAtual.ok,
          motivo: janelaAtual.motivo || null,
          regras: 'Segunda a Sábado, das 09h00 às 19h30 (horário de Cuiabá)',
        },
        estagiosDisponiveis: ESTAGIOS_AQUECIMENTO,
      });
    } catch (error) {
      console.error('[Antiban Routes] Erro ao obter status:', error);
      res.status(500).json({ ok: false, error: 'Erro ao consultar status antiban.' });
    }
  });

  // 2. Atualizar estágio de aquecimento ou limite diário
  app.post(`${BASE}/config`, (req, res) => {
    try {
      const empresaId = getEmpresaId(req);
      const { estagio, limiteDiarioPersonalizado, ativo } = req.body || {};

      const atualizado = atualizarConfiguracaoAntiban(empresaId, {
        estagio,
        limiteDiarioPersonalizado,
        ativo,
      });

      res.json({
        ok: true,
        mensagem: 'Configurações de proteção antiban atualizadas com sucesso.',
        antiban: atualizado,
      });
    } catch (error) {
      console.error('[Antiban Routes] Erro ao atualizar config:', error);
      res.status(500).json({ ok: false, error: 'Erro ao salvar configuração antiban.' });
    }
  });

  // 3. Cadastrar número em Opt-Out manualmente
  app.post(`${BASE}/opt-out`, (req, res) => {
    try {
      const empresaId = getEmpresaId(req);
      const { telefone, motivo = 'solicitacao_gestor' } = req.body || {};

      if (!telefone) {
        return res.status(400).json({ ok: false, error: 'Informe o número de telefone.' });
      }

      registrarOptOut(empresaId, telefone, motivo);

      res.json({
        ok: true,
        mensagem: 'Número adicionado à lista de Opt-Out. Disparos ativos bloqueados permanentemente.',
      });
    } catch (error) {
      console.error('[Antiban Routes] Erro ao registrar opt-out:', error);
      res.status(500).json({ ok: false, error: 'Erro ao registrar opt-out.' });
    }
  });

  // 4. Teste de Spintax e Prévia Humanizada
  app.post(`${BASE}/previa-humanizada`, (req, res) => {
    try {
      const { template, clienteNome, modelo = 'essencial' } = req.body || {};
      const previa = gerarMensagemHumanizadaDino({
        template,
        cliente: { nome: clienteNome || 'Rodrigo Gonçalves' },
        profissional: 'Dino',
        modelo,
        incluirOptOut: true,
      });

      res.json({ ok: true, previa });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
}
