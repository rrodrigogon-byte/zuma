import re

with open('app/server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Adicionar import
import_statement = "import * as lojaModaIa from './core/loja-moda-ia.js';\n"
if "import * as lojaModaIa from './core/loja-moda-ia.js';" not in content:
    target = "import * as totemLojaFisica from './core/totem-loja-fisica.js';\n"
    content = content.replace(target, target + import_statement)
    print("Import adicionado com sucesso!")
else:
    print("Import já existe.")

# 2. Adicionar bloco de rotas antes do app.listen ou no final das rotas de admin
routes_code = """
// ============================================================================
// LOJA DE MODA & VESTUÁRIO COM IA INTEGRADA (/api/v1/loja-moda e /api/admin/loja-moda)
// ============================================================================
const rotasLojaModa = express.Router();
rotasLojaModa.use(express.json());

rotasLojaModa.get('/resumo', (req, res) => {
  try {
    const empresaId = legacyEmpresaId(req);
    res.json(lojaModaIa.obterResumoLojaModa(empresaId));
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

rotasLojaModa.get('/produtos', (req, res) => {
  try {
    const empresaId = legacyEmpresaId(req);
    const produtos = lojaModaIa.listarProdutosModa(empresaId, req.query);
    res.json({ sucesso: true, produtos });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

rotasLojaModa.post('/produtos', (req, res) => {
  try {
    const empresaId = legacyEmpresaId(req);
    const prod = lojaModaIa.criarProdutoComGrade(empresaId, req.body || {});
    audit(req, 'MODA_PRODUTO_CRIADO', `id=${prod.id} ref=${prod.referencia}`);
    res.status(201).json({ sucesso: true, produto: prod });
  } catch (err) { res.status(400).json({ erro: err.message }); }
});

rotasLojaModa.post('/grade', (req, res) => {
  try {
    const empresaId = legacyEmpresaId(req);
    const prod = lojaModaIa.criarProdutoComGrade(empresaId, req.body || {});
    audit(req, 'MODA_GRADE_CRIADA', `id=${prod.id} ref=${prod.referencia}`);
    res.status(201).json({ sucesso: true, produto: prod });
  } catch (err) { res.status(400).json({ erro: err.message }); }
});

rotasLojaModa.patch('/grades/:id/estoque', (req, res) => {
  try {
    const empresaId = legacyEmpresaId(req);
    const resultado = lojaModaIa.atualizarEstoqueVariante(empresaId, { varianteId: req.params.id, ...(req.body || {}) });
    res.json({ sucesso: true, ...resultado });
  } catch (err) { res.status(400).json({ erro: err.message }); }
});

rotasLojaModa.get('/condicionais', (req, res) => {
  try {
    const empresaId = legacyEmpresaId(req);
    const condicionais = lojaModaIa.listarCondicionais(empresaId);
    res.json({ sucesso: true, condicionais });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

rotasLojaModa.post('/condicionais', (req, res) => {
  try {
    const empresaId = legacyEmpresaId(req);
    const cond = lojaModaIa.criarCondicional(empresaId, req.body || {});
    audit(req, 'MODA_CONDICIONAL_CRIADA', `id=${cond.id} cliente=${cond.cliente_nome}`);
    res.status(201).json({ sucesso: true, condicional: cond });
  } catch (err) { res.status(400).json({ erro: err.message }); }
});

rotasLojaModa.post('/condicionais/:id/finalizar', (req, res) => {
  try {
    const empresaId = legacyEmpresaId(req);
    const cond = lojaModaIa.finalizarCondicional(empresaId, req.params.id, req.body || {});
    audit(req, 'MODA_CONDICIONAL_FINALIZADA', `id=${cond.id} acao=${req.body?.acao}`);
    res.json({ sucesso: true, condicional: cond });
  } catch (err) { res.status(400).json({ erro: err.message }); }
});

rotasLojaModa.get('/crediario', (req, res) => {
  try {
    const empresaId = legacyEmpresaId(req);
    const clientes = lojaModaIa.listarCrediario(empresaId);
    res.json({ sucesso: true, clientes });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

rotasLojaModa.post('/crediario', (req, res) => {
  try {
    const empresaId = legacyEmpresaId(req);
    const cred = lojaModaIa.criarCrediario(empresaId, req.body || {});
    audit(req, 'MODA_CREDIARIO_CRIADO', `id=${cred.id} cliente=${cred.cliente_nome}`);
    res.status(201).json({ sucesso: true, cliente: cred });
  } catch (err) { res.status(400).json({ erro: err.message }); }
});

rotasLojaModa.post('/crediario/:id/pagar', (req, res) => {
  try {
    const empresaId = legacyEmpresaId(req);
    const resultado = lojaModaIa.pagarParcelaCrediario(empresaId, req.params.id);
    audit(req, 'MODA_CREDIARIO_PAGO', `id=${req.params.id}`);
    res.json({ sucesso: true, ...resultado });
  } catch (err) { res.status(400).json({ erro: err.message }); }
});

rotasLojaModa.get('/vales', (req, res) => {
  try {
    const empresaId = legacyEmpresaId(req);
    const vales = lojaModaIa.listarVales(empresaId);
    res.json({ sucesso: true, vales });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

rotasLojaModa.post('/vales', (req, res) => {
  try {
    const empresaId = legacyEmpresaId(req);
    const vale = lojaModaIa.emitirVale(empresaId, req.body || {});
    audit(req, 'MODA_VALE_EMITIDO', `codigo=${vale.codigo} valor=${vale.valor}`);
    res.status(201).json({ sucesso: true, vale });
  } catch (err) { res.status(400).json({ erro: err.message }); }
});

rotasLojaModa.post('/vales/:id/utilizar', (req, res) => {
  try {
    const empresaId = legacyEmpresaId(req);
    const vale = lojaModaIa.utilizarVale(empresaId, req.params.id);
    audit(req, 'MODA_VALE_UTILIZADO', `codigo=${vale.codigo}`);
    res.json({ sucesso: true, vale });
  } catch (err) { res.status(400).json({ erro: err.message }); }
});

rotasLojaModa.get('/comissoes', (req, res) => {
  try {
    const empresaId = legacyEmpresaId(req);
    const comissoes = lojaModaIa.listarComissoes(empresaId);
    res.json({ sucesso: true, comissoes });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Rotas de Inteligência Artificial de Moda
rotasLojaModa.post('/ai/look', async (req, res) => {
  try {
    const empresaId = legacyEmpresaId(req);
    const look = await lojaModaIa.montarLookIA(empresaId, req.body || {});
    res.json({ ok: true, look });
  } catch (err) { res.status(400).json({ erro: err.message }); }
});

rotasLojaModa.post('/ai/copy', async (req, res) => {
  try {
    const empresaId = legacyEmpresaId(req);
    const copy = await lojaModaIa.gerarDescricaoProdutoIA(empresaId, req.body || {});
    res.json({ ok: true, copy });
  } catch (err) { res.status(400).json({ erro: err.message }); }
});

rotasLojaModa.post('/ai/diagnostico-grade', (req, res) => {
  try {
    const empresaId = legacyEmpresaId(req);
    const diag = lojaModaIa.diagnosticoGradePrevisaoIA(empresaId);
    res.json({ ok: true, diagnostico: diag });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

rotasLojaModa.post('/ai/whatsapp', (req, res) => {
  try {
    const msg = lojaModaIa.gerarMensagemWhatsappIA(req.body || {});
    res.json({ ok: true, mensagem: msg });
  } catch (err) { res.status(400).json({ erro: err.message }); }
});

rotasLojaModa.post('/seed', (req, res) => {
  try {
    const empresaId = legacyEmpresaId(req);
    const est = lojaModaIa.popularSeedModa(empresaId);
    res.json({ ok: true, totalProdutos: est.produtos.length });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.use(['/api/v1/loja-moda', '/api/admin/loja-moda'], auth, rotasLojaModa);
"""

marker = "app.post('/api/admin/totens/chamar-senha'"
if marker in content and "rotasLojaModa" not in content:
    # Insere logo antes de app.post('/api/admin/totens/chamar-senha' ou depois
    idx = content.find(marker)
    content = content[:idx] + routes_code + "\n\n" + content[idx:]
    print("Rotas de loja-moda inseridas com sucesso!")
elif "rotasLojaModa" in content:
    print("Rotas de loja-moda já presentes!")
else:
    print("Marker não encontrado, inserindo no fim das rotas.")
    content += "\n" + routes_code

with open('app/server.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("app/server.js atualizado.")
