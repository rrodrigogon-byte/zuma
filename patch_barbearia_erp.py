import re
with open('web/src/pages/admin/BarbeariaERP.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "if (tab === 'Projeção inteligente') return <Suspense fallback={<Card style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Carregando projeção de IA…</Card>}><ProjecaoFaturamentoPanel onOpenTab={navegarParaTab} /></Suspense>",
    "if (tab === 'Projeção inteligente') return <Suspense fallback={<Card style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Carregando projeção de IA…</Card>}><ProjecaoFaturamentoPanel onOpenTab={navegarParaTab} /></Suspense>\n    if (tab === 'Painel de gestão') return <Suspense fallback={<Card style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Carregando painel de gestão…</Card>}><DinoDashboardKytto onOpenTab={navegarParaTab} /></Suspense>"
)

with open('web/src/pages/admin/BarbeariaERP.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
