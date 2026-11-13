import { Router } from 'express';
import * as sorteiosServico from './servico.js';

export function criarRotasSorteios({ legacyEmpresaId, audit } = {}) {
  const router = Router();

  const getEmpresaId = (req) => {
    const raw = (typeof legacyEmpresaId === 'function' ? legacyEmpresaId(req) : null) ||
                req.headers['x-empresa-id'] ||
                req.user?.empresaId ||
                'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
    return sorteiosServico.normalizarEmpresaId(raw);
  };

  /* ══════════════════════════════════════════════════════════════════════════
     ROTAS ADMINISTRATIVAS (/api/admin/sorteios)
     ══════════════════════════════════════════════════════════════════════════ */

  // Listar todas as campanhas da empresa
  router.get('/', async (req, res) => {
    try {
      const empresaId = getEmpresaId(req);
      const campanhas = await sorteiosServico.listarCampanhas(empresaId, {
        status: req.query.status,
        canal: req.query.canal,
      });
      res.json({ ok: true, campanhas });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Criar nova campanha de sorteio
  router.post('/', async (req, res) => {
    try {
      const empresaId = getEmpresaId(req);
      const campanha = await sorteiosServico.criarCampanha(empresaId, {
        ...req.body,
        criadoPor: req.user?.nome || req.user?.email || 'Administrador',
      });
      if (typeof audit === 'function') {
        audit(req, 'SORTEIO CAMPANHA CRIADA', `${campanha.id} - ${campanha.titulo}`);
      }
      res.status(201).json({ ok: true, campanha });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Obter detalhes de uma campanha específica
  router.get('/:id', async (req, res) => {
    try {
      const empresaId = getEmpresaId(req);
      const campanha = await sorteiosServico.obterCampanha(empresaId, req.params.id);
      if (!campanha) {
        return res.status(404).json({ error: 'Campanha de sorteio não encontrada.' });
      }
      res.json({ ok: true, campanha });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Atualizar uma campanha
  router.put('/:id', async (req, res) => {
    try {
      const empresaId = getEmpresaId(req);
      const campanha = await sorteiosServico.atualizarCampanha(empresaId, req.params.id, req.body);
      if (typeof audit === 'function') {
        audit(req, 'SORTEIO CAMPANHA ATUALIZADA', `${campanha.id} - ${campanha.titulo}`);
      }
      res.json({ ok: true, campanha });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Listar bilhetes de uma campanha com paginação e busca
  router.get('/:id/bilhetes', async (req, res) => {
    try {
      const empresaId = getEmpresaId(req);
      const resultado = await sorteiosServico.listarBilhetesCampanha(empresaId, req.params.id, {
        busca: req.query.busca,
        page: req.query.page,
        limit: req.query.limit,
      });
      res.json({ ok: true, ...resultado });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Emissão manual de bilhete de cortesia/balcão
  router.post('/:id/emitir-manual', async (req, res) => {
    try {
      const empresaId = getEmpresaId(req);
      const resultado = await sorteiosServico.emitirBilhetes({
        empresaId,
        campanhaId: req.params.id,
        cliente: req.body.cliente || {
          nome: req.body.clienteNome,
          telefone: req.body.clienteTelefone,
          cpf: req.body.clienteCpf,
        },
        quantidadeManual: req.body.quantidade || 1,
        motivo: req.body.motivo || 'Emissão manual pelo balcão/gerência',
        origem: req.body.origem || 'manual_balcao',
        emitidoPor: req.user?.nome || req.user?.email || 'Gerente Dino',
      });
      if (typeof audit === 'function') {
        audit(req, 'SORTEIO BILHETES MANUAIS', `Campanha ${req.params.id} qtd=${resultado.bilhetesGerados} cliente=${req.body.clienteNome}`);
      }
      res.status(201).json({ ok: true, ...resultado });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Gerar bilhetes em lote para clientes que vieram no período (3 meses ou este mês)
  router.post('/:id/gerar-por-periodo', async (req, res) => {
    try {
      const empresaId = getEmpresaId(req);
      const resultado = await sorteiosServico.gerarBilhetesPorPeriodo({
        empresaId,
        campanhaId: req.params.id,
        periodo: req.body.periodo || '3_meses',
        regra: req.body.regra || '1_por_cliente',
        emitidoPor: req.user?.nome || req.user?.email || 'Gerência Dino Barbearia',
      });
      if (typeof audit === 'function') {
        audit(req, 'SORTEIO BILHETES EM LOTE POR PERIODO', `Campanha ${req.params.id} periodo=${req.body.periodo} total=${resultado.bilhetesGerados}`);
      }
      res.json(resultado);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Executar o sorteio oficial ao vivo de forma auditada
  router.post('/:id/sortear', async (req, res) => {
    try {
      const empresaId = getEmpresaId(req);
      const resultado = await sorteiosServico.executarSorteio(empresaId, req.params.id, {
        realizadoPor: req.user?.nome || req.user?.email || 'Rodrigo Gonçalves (Dino)',
        premioIndex: Number(req.body.premioIndex || 0),
      });
      if (typeof audit === 'function') {
        audit(req, 'SORTEIO OFICIAL EXECUTADO', `${req.params.id} ganhador=${resultado.ganhador.clienteNome} bilhete=${resultado.ganhador.numeroSorte}`);
      }
      res.json(resultado);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Gerar mensagem de notificação para WhatsApp do ganhador
  router.post('/:id/notificar-ganhador', async (req, res) => {
    try {
      const empresaId = getEmpresaId(req);
      const camp = await sorteiosServico.obterCampanha(empresaId, req.params.id);
      if (!camp) return res.status(404).json({ error: 'Campanha não encontrada.' });
      
      const ganhador = camp.ganhadores?.[0] || {
        clienteNome: camp.ganhadorNome,
        clienteTelefone: camp.ganhadorTelefone,
        numeroSorte: camp.numeroSorte,
        premio: camp.premioPrincipal,
        sorteadoEm: camp.sorteadoEm,
        hashAuditoria: camp.hashAuditoria || '0000000000000000',
      };

      const textoWhats = sorteiosServico.gerarTextoNotificacaoGanhador(camp, ganhador);
      res.json({
        ok: true,
        mensagem: textoWhats,
        telefone: ganhador.clienteTelefone,
        linkWhatsappWeb: `https://api.whatsapp.com/send?phone=${String(ganhador.clienteTelefone).replace(/\D/g, '')}&text=${encodeURIComponent(textoWhats)}`,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}

/**
 * Cria rotas públicas para consulta do cliente.
 */
export function criarRotasPublicasSorteios() {
  const router = Router();

  // Visão pública do sorteio e prêmios da empresa
  router.get('/:slug', async (req, res) => {
    try {
      const visao = await sorteiosServico.obterVisaoPublicaSorteios(req.params.slug);
      res.json({ ok: true, ...visao });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Consulta do cliente pelos próprios bilhetes (via telefone ou CPF)
  router.get('/:slug/meus-bilhetes', async (req, res) => {
    try {
      const telefone = req.query.telefone || req.query.whatsapp || '';
      const cpf = req.query.cpf || '';
      const meusBilhetes = await sorteiosServico.consultarMeusBilhetes(req.params.slug, {
        telefone,
        cpf,
      });
      res.json({ ok: true, ...meusBilhetes });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}
