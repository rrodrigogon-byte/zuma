#!/usr/bin/env python3

with open('web/src/pages/admin/ConsolidacaoGrupo.jsx', 'r', encoding='utf8') as f:
    content = f.read()

# Substituir:
# const { empresaAtiva, trocarEmpresa } = useAuth();
# Por:
# const { empresaAtiva, trocarEmpresa, isPlatformAdmin } = useAuth();

content = content.replace(
    "const { empresaAtiva, trocarEmpresa } = useAuth();",
    "const { empresaAtiva, trocarEmpresa, isPlatformAdmin } = useAuth();",
    1
)

# Em carregarDados, colocar a guarda:
# if (!isPlatformAdmin) { setLoading(false); return; }
carregar_guard = """  const carregarDados = useCallback(async () => {
    if (!isPlatformAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);"""

content = content.replace(
    """  const carregarDados = useCallback(async () => {
    setLoading(true);""",
    carregar_guard,
    1
)

# Antes do return final da tela, checar if (!isPlatformAdmin):
# Vamos procurar a linha onde começa o return principal:
marker = "return (\n    <div className=\"space-y-6\">"
if marker not in content:
    # procurar variante de espacos
    marker = "return (\n    <div className="

print("Encontrando ponto de inserção do bloqueio...")
idx = content.find("return (\n    <div className=")
if idx != -1:
    bloqueio = """  if (!isPlatformAdmin) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center" style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-6">
          <ShieldCheck size={40} />
        </div>
        <h1 className="text-2xl font-bold text-slate-100 mb-3">
          Acesso Restrito à Controladoria da Holding Kytto
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto mb-6 text-base leading-relaxed">
          A visão consolidada de grupo econômico é de acesso exclusivo aos auditores e diretores corporativos da holding Kytto.
        </p>
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 text-left max-w-lg mx-auto mb-8 text-sm text-slate-300 shadow-lg">
          <div className="font-semibold text-emerald-400 mb-2 flex items-center gap-2">
            <CheckCircle2 size={18} /> Isolamento Multi-tenant Rigoroso
          </div>
          <div className="leading-relaxed">
            Os dados cadastrais, financeiros, clientes, vendas e relatórios de <strong>{empresaAtiva?.nome || 'sua empresa'}</strong> estão estritamente isolados e protegidos. Nenhuma outra empresa da rede visualiza os seus registros comerciais.
          </div>
        </div>
        <a
          href="/admin/barbearia-erp?area=gestao&tab=Painel+de+gestão"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20"
        >
          Voltar ao Painel da Barbearia Dino
        </a>
      </div>
    );
  }

  """
    content = content[:idx] + bloqueio + content[idx:]
    with open('web/src/pages/admin/ConsolidacaoGrupo.jsx', 'w', encoding='utf8') as f:
        f.write(content)
    print("ConsolidacaoGrupo.jsx atualizado com sucesso com tela de proteção de tenant!")
else:
    print("ERRO: Não encontrou o ponto de retorno em ConsolidacaoGrupo.jsx")
