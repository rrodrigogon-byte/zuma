import os

with open('app/server.js', 'r', encoding='utf8') as f:
    code = f.read()

# 1. Adicionar 'financeiro' em TENANT_ADMIN_MODULES se nao estiver
if "'financeiro'" not in code[code.find("TENANT_ADMIN_MODULES"):code.find("TENANT_ADMIN_MODULES")+350]:
    old_set = "'compras', 'whatsapp', 'whatsapp-gestao', 'ia', 'gamificacao', 'barber', 'barbeiro', 'crm']"
    new_set = "'compras', 'whatsapp', 'whatsapp-gestao', 'ia', 'gamificacao', 'barber', 'barbeiro', 'crm', 'financeiro']"
    if old_set in code:
        code = code.replace(old_set, new_set)
        print('1. TENANT_ADMIN_MODULES atualizado com financeiro!')

# 2. Localizar marcadores
inicio_marcador = "// --- Lançamentos financeiros (contas a pagar / receber) com suporte multi-tenant ---"
if inicio_marcador not in code:
    inicio_marcador = "// --- Lançamentos financeiros (contas a pagar / receber) ---"

fim_marcador = "// =================== FASE 3A — WHATSAPP ==================="

pos_inicio = code.find(inicio_marcador)
pos_fim = code.find(fim_marcador)

if pos_inicio != -1 and pos_fim != -1:
    bloco_novo = '''// --- Lançamentos financeiros (contas a pagar / receber) com suporte multi-tenant ---
app.get('/api/admin/financeiro/lancamentos', auth, requireStaff, (req,res)=>{
  const empresaId = isTenantScopedUser(req.user) ? legacyEmpresaId(req) : (req.query.empresaId || legacyEmpresaId(req));
  const lojaId = legacyLojaId(req);
  if (empresaId && financeiroKytto) {
    try {
      const itens = financeiroKytto.listarLancamentos(empresaId, { ...(req.query || {}), lojaId });
      if (itens && itens.length > 0) return res.json(itens);
    } catch(e) {
      console.warn('[financeiro] Erro ao listar do financeiro central:', e.message);
    }
  }
  let list = db().lancamentos||[];
  if (empresaId) list = list.filter(l => !l.empresaId || String(l.empresaId) === String(empresaId));
  const { tipo, status, categoria, de, ate } = req.query;
  if(tipo) list=list.filter(l=>l.tipo===tipo);
  if(status) list=list.filter(l=>l.status===status);
  if(categoria) list=list.filter(l=>l.categoria===categoria);
  if(de) list=list.filter(l=>(l.vencimento||'')>=de);
  if(ate) list=list.filter(l=>(l.vencimento||'')<=ate);
  res.json(list.slice().sort((a,b)=>(a.vencimento||'').localeCompare(b.vencimento||'')));
});

app.post('/api/admin/financeiro/lancamentos', auth, requireStaff, (req,res)=>{
  const { tipo, categoria, descricao, valor, vencimento, obs, formaPagamento } = req.body||{};
  if(!tipo||!valor||!descricao) return res.status(400).json({error:'tipo, valor e descrição obrigatórios'});
  if(!['receita','despesa'].includes(tipo)) return res.status(400).json({error:'tipo deve ser receita ou despesa'});
  const empresaId = isTenantScopedUser(req.user) ? legacyEmpresaId(req) : (req.body.empresaId || legacyEmpresaId(req));
  const lojaId = legacyLojaId(req);
  const l = {
    id: nextId(),
    empresaId,
    lojaId,
    tipo,
    categoria: categoria||'Outros',
    descricao,
    valor: Number(valor),
    vencimento: vencimento||new Date().toISOString().slice(0,10),
    status: 'pendente',
    pagoEm: null,
    meioPagamento: formaPagamento||'pix',
    obs: obs||'',
    origem: 'manual',
    criadoEm: new Date().toISOString()
  };
  if (empresaId && financeiroKytto) {
    try {
      financeiroKytto.registrarLancamento(empresaId, {
        lojaId,
        tipo,
        categoria: categoria||'Outros',
        descricao,
        valor: Number(valor),
        vencimento: l.vencimento,
        meioPagamento: formaPagamento||'pix',
        origem: 'manual',
        status: 'pendente'
      });
    } catch(e) {
      console.warn('[financeiro] Erro ao gravar no financeiro central:', e.message);
    }
  }
  const d=db(); d.lancamentos=d.lancamentos||[]; d.lancamentos.push(l); save();
  res.json(l);
});

app.patch('/api/admin/financeiro/lancamentos/:id', auth, requireStaff, (req,res)=>{
  const empresaId = isTenantScopedUser(req.user) ? legacyEmpresaId(req) : (req.query.empresaId || legacyEmpresaId(req));
  const lojaId = legacyLojaId(req);
  if (financeiroKytto && empresaId) {
    try {
      const atualizado = financeiroKytto.atualizarLancamento(empresaId, req.params.id, req.body || {}, { lojaId, permitirAutomatico: true });
      if (atualizado) { save(); return res.json(atualizado); }
    } catch {}
  }
  const d=db(); const l=(d.lancamentos||[]).find(x=>String(x.id)==String(req.params.id));
  if(!l) return res.status(404).json({error:'não encontrado'});
  if(req.body.status==='pago' && !l.pagoEm) req.body.pagoEm=new Date().toISOString();
  Object.assign(l, req.body); save(); res.json(l);
});

app.delete('/api/admin/financeiro/lancamentos/:id', auth, requireRole('admin','organizador'), (req,res)=>{
  const empresaId = isTenantScopedUser(req.user) ? legacyEmpresaId(req) : (req.query.empresaId || legacyEmpresaId(req));
  const lojaId = legacyLojaId(req);
  if (financeiroKytto && empresaId) {
    try {
      const cancelado = financeiroKytto.cancelarLancamento(empresaId, req.params.id, { usuario: req.user?.email || 'admin', lojaId, permitirAutomatico: true });
      if (cancelado) { save(); return res.json({ ok: true }); }
    } catch {}
  }
  const d=db();
  d.lancamentos=(d.lancamentos||[]).filter(x=>String(x.id)!=String(req.params.id)); save(); res.json({ok:true});
});

// --- Resumo financeiro, fluxo de caixa e DRE ---
app.get('/api/admin/financeiro/resumo', auth, requireStaff, (req,res)=>{
  const empresaId = isTenantScopedUser(req.user) ? legacyEmpresaId(req) : (req.query.empresaId || legacyEmpresaId(req));
  const lojaId = legacyLojaId(req);
  if (empresaId && financeiroKytto) {
    try {
      const resumoCentral = financeiroKytto.resumoFinanceiro(empresaId, { ...(req.query || {}), lojaId });
      if (resumoCentral) return res.json(resumoCentral);
    } catch(e) {
      console.warn('[financeiro] Erro ao obter resumo do financeiro central:', e.message);
    }
  }
  const d=db();
  const hoje=new Date().toISOString().slice(0,10);
  const mesAtual=hoje.slice(0,7);
  let lancs=d.lancamentos||[];
  if (empresaId) lancs = lancs.filter(l => !l.empresaId || String(l.empresaId) === String(empresaId));
  const recMes=lancs.filter(l=>l.tipo==='receita'&&l.status==='pago'&&(l.pagoEm||'').startsWith(mesAtual)).reduce((s,l)=>s+(l.valor||0),0);
  const despMes=lancs.filter(l=>l.tipo==='despesa'&&l.status==='pago'&&(l.pagoEm||'').startsWith(mesAtual)).reduce((s,l)=>s+(l.valor||0),0);
  const aReceber=lancs.filter(l=>l.tipo==='receita'&&l.status==='pendente').reduce((s,l)=>s+(l.valor||0),0);
  const aPagar=lancs.filter(l=>l.tipo==='despesa'&&l.status==='pendente').reduce((s,l)=>s+(l.valor||0),0);
  res.json({
    saldo: recMes - despMes,
    totalReceitas: recMes,
    totalDespesas: despMes,
    recMes,
    despMes,
    aReceber,
    aPagar,
    mesAtual,
    hoje
  });
});

app.get('/api/admin/financeiro/fluxo', auth, requireStaff, (req,res)=>{
  const empresaId = isTenantScopedUser(req.user) ? legacyEmpresaId(req) : (req.query.empresaId || legacyEmpresaId(req));
  const lojaId = legacyLojaId(req);
  if (empresaId && financeiroKytto) {
    try {
      const fluxoCentral = financeiroKytto.fluxoFinanceiro(empresaId, 12, new Date(), { lojaId });
      if (fluxoCentral) return res.json(fluxoCentral);
    } catch(e) {
      console.warn('[financeiro] Erro ao obter fluxo do financeiro central:', e.message);
    }
  }
  const d=db();
  const hoje=new Date();
  const meses=[];
  for(let i=11;i>=0;i--){
    const dt=new Date(hoje.getFullYear(), hoje.getMonth()-i, 1);
    meses.push(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`);
  }
  let lancs=d.lancamentos||[];
  if (empresaId) lancs = lancs.filter(l => !l.empresaId || String(l.empresaId) === String(empresaId));
  res.json(meses.map(mes=>{
    const rec=lancs.filter(l=>l.tipo==='receita'&&l.status==='pago'&&(l.pagoEm||'').startsWith(mes)).reduce((s,l)=>s+(l.valor||0),0);
    const desp=lancs.filter(l=>l.tipo==='despesa'&&l.status==='pago'&&(l.pagoEm||'').startsWith(mes)).reduce((s,l)=>s+(l.valor||0),0);
    return { mes, receitas:rec, despesas:desp, saldo:rec-desp };
  }));
});

app.get('/api/admin/financeiro/dre', auth, requireStaff, (req,res)=>{
  const empresaId = isTenantScopedUser(req.user) ? legacyEmpresaId(req) : (req.query.empresaId || legacyEmpresaId(req));
  const lojaId = legacyLojaId(req);
  if (empresaId && financeiroKytto) {
    try {
      const mes = req.query?.mes || new Date().toISOString().slice(0, 7);
      const dre = financeiroKytto.dreGerencial(empresaId, { ...(req.query || {}), mes, lojaId });
      return res.json(dre);
    } catch(e) {
      console.warn('[financeiro] Erro ao calcular DRE:', e.message);
    }
  }
  res.json({
    receitaBruta: 0,
    totalDeducoes: 0,
    receitaLiquida: 0,
    totalCustosVariaveis: 0,
    margemContribuicao: 0,
    totalDespesasOperacionais: 0,
    ebitda: 0,
    resultadoLiquido: 0,
    rankingCategorias: []
  });
});

app.get('/api/admin/financeiro/categorias', auth, requireStaff, (req,res)=>{
  res.json({
    receita:['Serviços & Cortes','Venda de Revenda / Bar','Mensalidades / Planos','Loja Virtual','Assinaturas','Outros'],
    despesa:['Pessoal/RH & Comissões','Aluguel & Ocupação','Produtos & Insumos','Taxas de Cartão / Bancárias','Utilities (Água/Luz)','Internet & Telefonia','Marketing & Tráfego','Impostos/Taxas','Manutenção & Equipamentos','Serviços Terceiros','Outros']
  });
});

'''
    code = code[:pos_inicio] + bloco_novo + code[pos_fim:]
    print('2. Rotas /api/admin/financeiro atualizadas com sucesso!')

with open('app/server.js', 'w', encoding='utf8') as f:
    f.write(code)
print('Script finalizado com sucesso!')
