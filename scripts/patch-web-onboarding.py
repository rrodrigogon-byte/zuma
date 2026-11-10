#!/usr/bin/env python3

with open('web/src/pages/admin/Empresas.jsx', 'r', encoding='utf8') as f:
    code = f.read()

# 1. Adicionar estado modalSucessoOnboarding
old_states = "  const [sugestaoIaCnpj, setSugestaoIaCnpj] = useState(null)"
new_states = """  const [sugestaoIaCnpj, setSugestaoIaCnpj] = useState(null)
  const [modalSucessoOnboarding, setModalSucessoOnboarding] = useState(null)
  const [templateAtivo, setTemplateAtivo] = useState('barbearia')"""

if old_states in code and "modalSucessoOnboarding" not in code:
    code = code.replace(old_states, new_states, 1)
    print("Estados adicionados em Empresas.jsx")

# 2. Adicionar função gerarAcessoAutomatico e seleção de template
old_abrir_novo = """  const abrirNovo = () => {
    setForm(formInicial)
    setSugestaoIaCnpj(null)
    setModal({ modo: 'novo' })
  }"""

new_abrir_novo = """  const selecionarTemplateOnboarding = (tipoId) => {
    setTemplateAtivo(tipoId)
    setForm((prev) => ({
      ...prev,
      tipoNegocio: tipoId,
      autoProvisionarCatalogo: true,
      criarLojaMatriz: true,
    }))
  }

  const gerarAcessoAutomatico = () => {
    const nomeBase = String(form.nome || 'gestor').trim().toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9]/g, '') || 'gestor'
    const emailGerado = `admin.${nomeBase}@kytto.com.br`
    const senhaGerada = `Kytto@${Math.floor(1000 + Math.random() * 9000)}`
    setForm((prev) => ({
      ...prev,
      administrador: {
        nome: form.administrador?.nome || `Gestor ${form.nome || 'Nova Unidade'}`,
        email: emailGerado,
        senhaInicial: senhaGerada
      }
    }))
    toast('Acesso inicial gerado automaticamente! Senha: ' + senhaGerada)
  }

  const abrirNovo = () => {
    setForm({ ...formInicial, autoProvisionarCatalogo: true, criarLojaMatriz: true })
    setSugestaoIaCnpj(null)
    setTemplateAtivo('barbearia')
    setModal({ modo: 'novo' })
  }"""

if old_abrir_novo in code:
    code = code.replace(old_abrir_novo, new_abrir_novo, 1)
    print("Funcoes de template e geracao de acesso adicionadas!")

# 3. Atualizar retorno de salvar para exibir o modal de sucesso
old_salvar_novo = """      if (modal?.modo === 'novo') {
        await api.post('/api/admin/empresas', form)
        toast('Empresa cadastrada com sucesso com isolamento multiempresa!')
      } else {"""

new_salvar_novo = """      if (modal?.modo === 'novo') {
        const resp = await api.post('/api/admin/empresas', form)
        if (resp?.empresa?.administrador) {
          setModalSucessoOnboarding({
            empresa: resp.empresa,
            administrador: resp.empresa.administrador,
            catalogoInicial: resp.empresa.catalogoInicial
          })
        } else {
          toast('Empresa cadastrada com sucesso com isolamento multiempresa!')
        }
      } else {"""

if old_salvar_novo in code:
    code = code.replace(old_salvar_novo, new_salvar_novo, 1)
    print("salvar atualizado para exibir onboarding com credenciais!")

# 4. Adicionar barra de templates no topo do modal de nova empresa
old_modal_header = """            {/* Bloco de Ajuda IA */}
            <div className="card" style={{ fontSize: 12, color: '#334155', background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.2)', padding: '10px 14px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <strong>Assistente de Cadastro por IA:</strong> Digite o CNPJ e clique no botão para auto-preencher razão social, endereço e segmento automaticamente!
              </div>
            </div>"""

new_modal_header = """            {/* Seletor Rápido de Templates de Onboarding */}
            {modal.modo === 'novo' && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🚀</span> Templates de Onboarding Ágil (Auto-provisionamento com 1 Clique):
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    Cria catálogo, matriz, regras fiscais e equipe isolada
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                  {[
                    { id: 'barbearia', icon: '💈', label: 'Barbearia & Salão' },
                    { id: 'loja', icon: '💊', label: 'Suplementos / Moda' },
                    { id: 'bar', icon: '🍔', label: 'Bar / Gastronomia' },
                    { id: 'esporte', icon: '🎾', label: 'Arena Esportiva' },
                    { id: 'supermercado', icon: '🛒', label: 'Supermercado' },
                    { id: 'outro', icon: '🏢', label: 'Serviços Gerais' },
                  ].map((tpl) => {
                    const sel = form.tipoNegocio === tpl.id
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => selecionarTemplateOnboarding(tpl.id)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 4,
                          padding: '8px 6px',
                          borderRadius: 8,
                          border: sel ? '2px solid #FF6B2C' : '1px solid #cbd5e1',
                          background: sel ? '#FFF7ED' : '#ffffff',
                          color: sel ? '#C2410C' : '#334155',
                          fontWeight: sel ? 700 : 500,
                          fontSize: 11,
                          cursor: 'pointer',
                          transition: 'all .15s ease'
                        }}
                      >
                        <span style={{ fontSize: 18 }}>{tpl.icon}</span>
                        <span>{tpl.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Bloco de Ajuda IA */}
            <div className="card" style={{ fontSize: 12, color: '#334155', background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.2)', padding: '10px 14px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <strong>Assistente de Cadastro por IA:</strong> Digite o CNPJ e clique no botão para auto-preencher razão social, endereço e segmento automaticamente!
              </div>
            </div>"""

if old_modal_header in code:
    code = code.replace(old_modal_header, new_modal_header, 1)
    print("Barra de templates adicionada no topo do modal de nova empresa!")

# 5. Adicionar botão de Gerar Acesso Automático no bloco de Administrador
old_admin_header = """                <h3 style={{ margin: '8px 0 0', color: '#12283F', fontSize: 14, fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
                  4. Unidade Matriz & Administrador Inicial (Opcional)
                </h3>"""

new_admin_header = """                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 4, marginTop: 8 }}>
                  <h3 style={{ margin: 0, color: '#12283F', fontSize: 14, fontWeight: 700 }}>
                    4. Unidade Matriz, Loja Virtual & Administrador da Empresa
                  </h3>
                  <button
                    type="button"
                    onClick={gerarAcessoAutomatico}
                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 11, fontWeight: 700, padding: '4px 8px', color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    title="Gera automaticamente e-mail e senha padrão para o administrador da nova empresa"
                  >
                    <span>⚡</span> Gerar Acesso Automático
                  </button>
                </div>"""

if old_admin_header in code:
    code = code.replace(old_admin_header, new_admin_header, 1)
    print("Botao Gerar Acesso Automatico adicionado no header do admin!")

# 6. Adicionar Modal de Sucesso do Onboarding com botão Copiar Credenciais
modal_sucesso_jsx = """
      {/* Modal de Sucesso do Onboarding com Credenciais Geradas */}
      {modalSucessoOnboarding && (
        <Modal
          title="🎉 Empresa Criada & Onboarding Concluído com Sucesso!"
          onClose={() => setModalSucessoOnboarding(null)}
          width={640}
        >
          <div style={{ display: 'grid', gap: 14, paddingBottom: 10 }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '14px', color: '#166534', fontSize: 13 }}>
              <strong>Unidade Ativa & Pronta para Operar:</strong> A empresa <strong>{modalSucessoOnboarding.empresa?.nomeFantasia || modalSucessoOnboarding.empresa?.nome}</strong> foi cadastrada com isolamento absoluto de dados, loja matriz provisionada e catálogo inicial.
            </div>

            {modalSucessoOnboarding.administrador && (
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🔐</span> Credenciais de Acesso do Administrador da Empresa:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: '#f8fafc', padding: 12, borderRadius: 6, fontFamily: 'monospace', fontSize: 13 }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>Login / E-mail:</span>
                    <strong>{modalSucessoOnboarding.administrador.email}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>Senha Inicial:</span>
                    <strong style={{ color: '#FF6B2C' }}>{modalSucessoOnboarding.administrador.senhaInicial}</strong>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const texto = `Bem-vindo ao ERP Kytto!\\n\\nSua empresa foi ativada:\\nUnidade: ${modalSucessoOnboarding.empresa?.nomeFantasia || modalSucessoOnboarding.empresa?.nome}\\nAcesso: https://kytto.com.br/admin\\nLogin: ${modalSucessoOnboarding.administrador.email}\\nSenha: ${modalSucessoOnboarding.administrador.senhaInicial}`
                      navigator.clipboard.writeText(texto)
                      toast('Credenciais copiadas com sucesso!')
                    }}
                    style={{ background: '#0f172a', borderColor: '#0f172a', fontWeight: 700, flex: 1 }}
                  >
                    📋 Copiar Dados de Acesso
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setModalSucessoOnboarding(null)}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
"""

if "{/* Modal de Diagnóstico IA da Empresa */}" in code:
    code = code.replace("{/* Modal de Diagnóstico IA da Empresa */}", modal_sucesso_jsx + "\n      {/* Modal de Diagnóstico IA da Empresa */}", 1)
    print("Modal de sucesso do onboarding inserido!")

with open('web/src/pages/admin/Empresas.jsx', 'w', encoding='utf8') as f:
    f.write(code)

print("web/src/pages/admin/Empresas.jsx atualizado com sucesso!")
