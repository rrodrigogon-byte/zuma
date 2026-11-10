with open('web/src/pages/admin/Financeiro.jsx', 'r', encoding='utf8') as f:
    content = f.read()

# 1. Adicionar import
old_import = "import { useToast } from '../../hooks/useToast'"
new_import = """import { useToast } from '../../hooks/useToast'
import ConciliacaoBancariaTab from './financeiro/ConciliacaoBancariaTab'"""

content = content.replace(old_import, new_import, 1)

# 2. Adicionar aba nas tabs
old_tabs = """        [
          { id: 'resumo', label: '📊 Visão Geral & Fluxo' },
          { id: 'dre', label: '📋 DRE Gerencial' },
          { id: 'receitas', label: '↑ Contas a Receber' },
          { id: 'despesas', label: '↓ Contas a Pagar' },
          { id: 'todos', label: '📑 Todos os Lançamentos' },
        ].map(t => ("""

new_tabs = """        [
          { id: 'resumo', label: '📊 Visão Geral & Fluxo' },
          { id: 'dre', label: '📋 DRE Gerencial' },
          { id: 'conciliacao', label: '🏦 Conciliação Bancária OFX' },
          { id: 'receitas', label: '↑ Contas a Receber' },
          { id: 'despesas', label: '↓ Contas a Pagar' },
          { id: 'todos', label: '📑 Todos os Lançamentos' },
        ].map(t => ("""

content = content.replace(old_tabs, new_tabs, 1)

# 3. Adicionar render da aba conciliacao
old_render_dre = """      {/* Tab: DRE Gerencial */}
      {tab === 'dre' && (
        <DreGerencialView mes={mesDRE} onMesChange={setMesDRE} />
      )}"""

new_render_dre = """      {/* Tab: DRE Gerencial */}
      {tab === 'dre' && (
        <DreGerencialView mes={mesDRE} onMesChange={setMesDRE} />
      )}

      {/* Tab: Conciliação Bancária OFX */}
      {tab === 'conciliacao' && (
        <ConciliacaoBancariaTab onAtualizarFinanceiro={load} />
      )}"""

content = content.replace(old_render_dre, new_render_dre, 1)

with open('web/src/pages/admin/Financeiro.jsx', 'w', encoding='utf8') as f:
    f.write(content)

print("Financeiro.jsx atualizado com sucesso!")
