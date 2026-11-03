// ============================================================================
// DINO & ERP ESTOQUE, FICHAS TÉCNICAS E INVENTÁRIO (ROTAS ADMIN)
// Conecta o frontend Vite às regras de negócio de perdas, inventário e fichas
// com segregação por empresa e auditoria contábil.
// ============================================================================

import { db, save } from './db.js';
import * as perdasInventarioKytto from './perdas-inventario-kytto.js';
import * as fichasTecnicasKytto from './fichas-tecnicas-kytto.js';

function storeEstoque(empresaId) {
  const estado = db();
  estado.estoquePorEmpresa ||= {};
  const id = String(empresaId || 'principal');
  estado.estoquePorEmpresa[id] ||= {};
  return estado.estoquePorEmpresa[id];
}

function storeCardapio(empresaId) {
  const estado = db();
  estado.cardapioPorEmpresa ||= {};
  const id = String(empresaId || 'principal');
  if (!estado.cardapioPorEmpresa[id] && Array.isArray(estado.cardapio)) {
    estado.cardapioPorEmpresa[id] = estado.cardapio.map((item) => ({ ...item, empresaId: id }));
  }
  estado.cardapioPorEmpresa[id] ||= [];
  return estado.cardapioPorEmpresa[id];
}

function listarEstoqueCardapio(empresaId) {
  const cardapio = storeCardapio(empresaId);
  const estoque = storeEstoque(empresaId);

  // Garantir fichas de estoque para cada item de cardápio
  for (const item of cardapio) {
    const pId = String(item.id);
    if (!estoque[pId]) {
      estoque[pId] = {
        id: pId,
        produtoId: pId,
        empresaId: String(empresaId),
        nome: item.nome,
        cat: item.cat || item.categoria || 'Geral',
        preco: Number(item.preco || 0),
        qtd: Number(item.estoqueAtual ?? 10),
        custo: Number(item.custo ?? (Number(item.preco || 0) * 0.4)),
        min: Number(item.estoqueMinimo ?? 5),
        controlaEstoque: true,
        unidade: item.unidade || 'UN',
        criadoEm: new Date().toISOString()
      };
    }
  }

  return Object.values(estoque).map((e) => ({
    ...e,
    baixo: Number(e.qtd || 0) <= Number(e.min || 0)
  }));
}

export function registerDinoEstoqueFichasRoutes(app, { auth, requireStaff, legacyEmpresaId }) {
  // ── CARDÁPIO / CATÁLOGO ───────────────────────────────────────────────────
  app.get('/api/admin/cardapio', auth, requireStaff, (req, res) => {
    try {
      const empresaId = legacyEmpresaId(req);
      const cardapio = storeCardapio(empresaId);
      res.json(cardapio);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── ESTOQUE SIMPLES E CONSOLIDADO ─────────────────────────────────────────
  app.get('/api/admin/estoque', auth, requireStaff, (req, res) => {
    try {
      const empresaId = legacyEmpresaId(req);
      const itens = listarEstoqueCardapio(empresaId);
      res.json({ ok: true, estoque: itens });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── PERDAS E AVARIAS ──────────────────────────────────────────────────────
  app.get('/api/admin/estoque/ocorrencias', auth, requireStaff, (req, res) => {
    try {
      const empresaId = legacyEmpresaId(req);
      const ocorrencias = perdasInventarioKytto.listarOcorrencias(empresaId);
      res.json({ ok: true, ocorrencias });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/estoque/ocorrencias', auth, requireStaff, (req, res) => {
    try {
      const empresaId = legacyEmpresaId(req);
      const estoque = storeEstoque(empresaId);
      const produtoId = String(req.body?.produtoId || '');
      const item = estoque[produtoId] || { nome: 'Item avulso', cat: 'Geral', custo: 0, qtd: 0 };
      
      const qtdPerda = Number(req.body?.qtd || 1);
      const ocorrencia = perdasInventarioKytto.registrarOcorrencia(
        empresaId,
        {
          ...req.body,
          usuario: req.user?.email || 'admin'
        },
        item
      );

      // Atualiza saldo de estoque
      item.qtd = Math.max(0, Number(item.qtd || 0) - qtdPerda);
      save();

      res.status(201).json({ ok: true, ocorrencia, item });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ── INVENTÁRIOS E CONTAGENS ───────────────────────────────────────────────
  app.get('/api/admin/estoque/inventarios', auth, requireStaff, (req, res) => {
    try {
      const empresaId = legacyEmpresaId(req);
      const inventarios = perdasInventarioKytto.listarInventarios(empresaId);
      res.json({ ok: true, inventarios });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/estoque/inventarios/:id', auth, requireStaff, (req, res) => {
    try {
      const empresaId = legacyEmpresaId(req);
      const inventario = perdasInventarioKytto.obterInventario(empresaId, req.params.id);
      if (!inventario) return res.status(404).json({ error: 'Inventário não encontrado.' });
      res.json({ ok: true, inventario });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/estoque/inventarios', auth, requireStaff, (req, res) => {
    try {
      const empresaId = legacyEmpresaId(req);
      const itensEstoque = listarEstoqueCardapio(empresaId);
      const tipo = req.body?.tipo === 'geral' ? 'geral' : 'rotativo';
      const categoria = String(req.body?.categoria || '').trim();

      const itensFiltrados = itensEstoque
        .filter((item) => tipo === 'geral' || !categoria || item.cat === categoria);

      const inventario = perdasInventarioKytto.criarInventario(
        empresaId,
        {
          ...req.body,
          tipo,
          categoria,
          iniciadoPor: req.user?.email || 'admin'
        },
        itensFiltrados
      );
      save();

      res.status(201).json({ ok: true, inventario });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/admin/estoque/inventarios/:id/contagens', auth, requireStaff, (req, res) => {
    try {
      const empresaId = legacyEmpresaId(req);
      const inventario = perdasInventarioKytto.registrarContagem(
        empresaId,
        req.params.id,
        String(req.body?.produtoId || ''),
        req.body?.contado ?? req.body?.qtd,
        req.user?.email || 'admin'
      );
      if (!inventario) return res.status(404).json({ error: 'Inventário não encontrado.' });
      save();

      res.json({ ok: true, inventario });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/admin/estoque/inventarios/:id/concluir', auth, requireStaff, (req, res) => {
    try {
      const empresaId = legacyEmpresaId(req);
      const resultado = perdasInventarioKytto.concluirInventario(
        empresaId,
        req.params.id,
        req.user?.email || 'admin'
      );
      if (!resultado) return res.status(404).json({ error: 'Inventário não encontrado.' });

      // Aplica os ajustes de contagem ao saldo de estoque
      const estoque = storeEstoque(empresaId);
      const movimentos = [];
      for (const ajuste of resultado.ajustes || []) {
        const item = estoque[ajuste.produtoId];
        if (item) {
          const saldoAnterior = Number(item.qtd || 0);
          item.qtd = Number(ajuste.contado || 0);
          movimentos.push({
            produtoId: ajuste.produtoId,
            saldoAnterior,
            saldoFinal: item.qtd,
            divergencia: ajuste.divergencia
          });
        }
      }
      save();

      res.json({ ok: true, inventario: resultado.inventario, movimentos });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/admin/estoque/acuracidade', auth, requireStaff, (req, res) => {
    try {
      const empresaId = legacyEmpresaId(req);
      const relatorio = perdasInventarioKytto.relatorioAcuracidade(empresaId, req.query || {});
      res.json({ ok: true, relatorio });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── FICHAS TÉCNICAS (PRODUTOS COMPOSTOS) ──────────────────────────────────
  app.get('/api/admin/fichas-tecnicas', auth, requireStaff, (req, res) => {
    try {
      const empresaId = legacyEmpresaId(req);
      const fichas = fichasTecnicasKytto.listarFichasTecnicas(empresaId);
      res.json({ ok: true, fichas });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/fichas-tecnicas', auth, requireStaff, (req, res) => {
    try {
      const empresaId = legacyEmpresaId(req);
      const ficha = fichasTecnicasKytto.salvarFichaTecnica(empresaId, req.body || {});
      save();
      res.status(201).json({ ok: true, ficha });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/admin/fichas-tecnicas/:fichaId', auth, requireStaff, (req, res) => {
    try {
      const empresaId = legacyEmpresaId(req);
      const ficha = fichasTecnicasKytto.salvarFichaTecnica(empresaId, req.body || {}, req.params.fichaId);
      save();
      res.json({ ok: true, ficha });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/admin/fichas-tecnicas/:fichaId', auth, requireStaff, (req, res) => {
    try {
      const empresaId = legacyEmpresaId(req);
      const removido = fichasTecnicasKytto.removerFichaTecnica(empresaId, req.params.fichaId);
      if (!removido) return res.status(404).json({ error: 'Ficha técnica não encontrada.' });
      save();
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
}
