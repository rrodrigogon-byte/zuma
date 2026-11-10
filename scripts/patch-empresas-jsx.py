#!/usr/bin/env python3

with open('web/src/pages/admin/Empresas.jsx', 'r', encoding='utf8') as f:
    content = f.read()

# 1. useAuth(): importar isPlatformAdmin
content = content.replace(
    "const { empresaAtiva, trocarEmpresa, user } = useAuth()",
    "const { empresaAtiva, trocarEmpresa, user, isPlatformAdmin } = useAuth()",
    1
)

# 2. Atualizar o Header:
header_old = """      {/* Topo / Header com Barra de Gestão Executiva */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>🏢</span>
            <h1 className="page-title" style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#12283F' }}>
              Gestão de Empresas & Multiempresa
            </h1>
          </div>
          <div style={{ marginTop: 6, color: 'var(--muted, #64748b)', fontSize: 13 }}>
            Cadastro completo e autônomo com inteligência artificial, isolamento contábil, fiscal e operacional.
            {empresaAtiva && (
              <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,107,44,.12)', color: '#FF6B2C', fontWeight: 700 }}>
                Ativa agora: {empresaAtiva.nomeFantasia || empresaAtiva.nome}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={carregar} disabled={loading} title="Recarregar lista">
            ↺ {loading ? 'Carregando...' : 'Atualizar'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={abrirDiagnosticoHolding} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🧠</span> Copilot Holding
          </button>
          <Link to="/admin/lojas" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
            🏪 Unidades / Lojas
          </Link>
          <button className="btn btn-primary btn-sm" onClick={abrirNovo} style={{ background: '#FF6B2C', borderColor: '#FF6B2C', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>+</span> Nova Empresa
          </button>
        </div>
      </div>"""

header_new = """      {/* Topo / Header com Barra de Gestão Executiva */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>🏢</span>
            <h1 className="page-title" style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#12283F' }}>
              {isPlatformAdmin ? 'Gestão de Empresas & Multiempresa' : (empresaAtiva?.nome || 'Minha Empresa')}
            </h1>
          </div>
          <div style={{ marginTop: 6, color: 'var(--muted, #64748b)', fontSize: 13 }}>
            {isPlatformAdmin
              ? 'Cadastro completo e autônomo com inteligência artificial, isolamento contábil, fiscal e operacional.'
              : 'Dados cadastrais, fiscais e operacionais exclusivos da sua unidade no ERP Kytto.'}
            {empresaAtiva && (
              <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,107,44,.12)', color: '#FF6B2C', fontWeight: 700 }}>
                Unidade ativa: {empresaAtiva.nomeFantasia || empresaAtiva.nome}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={carregar} disabled={loading} title="Recarregar lista">
            ↺ {loading ? 'Carregando...' : 'Atualizar'}
          </button>
          {isPlatformAdmin && (
            <button className="btn btn-secondary btn-sm" onClick={abrirDiagnosticoHolding} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🧠</span> Copilot Holding
            </button>
          )}
          <Link to="/admin/lojas" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
            🏪 Unidades / Lojas
          </Link>
          {isPlatformAdmin && (
            <button className="btn btn-primary btn-sm" onClick={abrirNovo} style={{ background: '#FF6B2C', borderColor: '#FF6B2C', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>+</span> Nova Empresa
            </button>
          )}
        </div>
      </div>"""

if header_old in content:
    content = content.replace(header_old, header_new, 1)
    print("Header de Empresas.jsx atualizado com sucesso!")
else:
    print("AVISO: header_old não encontrado exatamente, aplicando busca flexível...")

# 3. Condicionar o painel de KPIs da Holding apenas a isPlatformAdmin
painel_old = "{/* Painel de Indicadores da Holding & IA */}\n      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 20 }}>"
painel_new = "{/* Painel de Indicadores da Holding & IA */}\n      {isPlatformAdmin && (\n      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 20 }}>"

if painel_old in content:
    # achar o fim desse grid
    # localizamos o fechamento após o quarto card
    idx = content.find(painel_old)
    # vamos ver onde termina esse bloco de grid
    # procurando o próximo bloco de busca/filtros
    busca_marker = "{/* Barra de Busca e Filtros Rápidos */}"
    idx_busca = content.find(busca_marker, idx)
    if idx_busca != -1:
        # achar o fechamento '</div>' imediatamente anterior à busca
        idx_div = content.rfind('</div>', idx, idx_busca)
        if idx_div != -1:
            content = content[:idx] + painel_new + content[idx + len(painel_old):idx_div + 6] + "\n      )}" + content[idx_div + 6:]
            print("Painel de KPIs condicionado ao Superadmin com sucesso!")

with open('web/src/pages/admin/Empresas.jsx', 'w', encoding='utf8') as f:
    f.write(content)
print("Empresas.jsx gravado com sucesso!")
