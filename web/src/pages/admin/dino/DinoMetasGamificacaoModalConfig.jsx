import React, { useState } from 'react'

export function DinoMetasGamificacaoModalConfig({
  open,
  onClose,
  configAtual,
  onSalvar,
  salvando = false,
}) {
  const [form, setForm] = useState(() => {
    return JSON.parse(JSON.stringify(configAtual || {}))
  })
  const [abaConfig, setAbaConfig] = useState('diarias') // 'diarias' | 'semanais' | 'roleta'

  if (!open) return null

  function atualizarDiaria(campo, valor) {
    setForm((prev) => ({
      ...prev,
      metasDiarias: {
        ...(prev.metasDiarias || {}),
        [campo]: valor,
      },
    }))
  }

  function atualizarSemanal(campo, valor) {
    setForm((prev) => ({
      ...prev,
      metasSemanais: {
        ...(prev.metasSemanais || {}),
        [campo]: valor,
      },
    }))
  }

  function atualizarPremio(idx, campo, valor) {
    setForm((prev) => {
      const premios = [...(prev.premiosRoleta || [])]
      premios[idx] = { ...premios[idx], [campo]: valor }
      return { ...prev, premiosRoleta: premios }
    })
  }

  function adicionarPremio() {
    setForm((prev) => ({
      ...prev,
      premiosRoleta: [
        ...(prev.premiosRoleta || []),
        {
          id: `p_${Date.now()}`,
          nome: 'Novo Prêmio',
          cor: '#10b981',
          icone: '🎁',
          ativo: true,
          peso: 15,
        },
      ],
    }))
  }

  function removerPremio(idx) {
    setForm((prev) => {
      const premios = [...(prev.premiosRoleta || [])]
      premios.splice(idx, 1)
      return { ...prev, premiosRoleta: premios }
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (onSalvar) onSalvar(form)
  }

  return (
    <div className="dino-roleta-modal-backdrop" onClick={onClose}>
      <div
        className="dino-roleta-modal-content"
        style={{ maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dino-roleta-header">
          <div>
            <span className="dino-roleta-badge">⚙️ Autonomia do Gestor</span>
            <h2>Configurar Metas & Prêmios da Roleta</h2>
            <p className="dino-roleta-motivo">
              Defina as regras de serviços extras, metas de produtos e as premiações da roleta.
            </p>
          </div>
          <button type="button" className="dino-roleta-close-btn" onClick={onClose}>
            ✕
          </button>
        </header>

        {/* Sub-abas de Configuração */}
        <div style={{ display: 'flex', gap: 6, padding: '12px 24px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            type="button"
            className={`dino-metas-tab-btn ${abaConfig === 'diarias' ? 'active' : ''}`}
            onClick={() => setAbaConfig('diarias')}
          >
            ☀️ Metas Diárias
          </button>
          <button
            type="button"
            className={`dino-metas-tab-btn ${abaConfig === 'semanais' ? 'active' : ''}`}
            onClick={() => setAbaConfig('semanais')}
          >
            📅 Desafio Semanal
          </button>
          <button
            type="button"
            className={`dino-metas-tab-btn ${abaConfig === 'roleta' ? 'active' : ''}`}
            onClick={() => setAbaConfig('roleta')}
          >
            🎡 Prêmios da Roleta ({form.premiosRoleta?.length || 0})
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* ABA 1: METAS DIÁRIAS */}
          {abaConfig === 'diarias' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Meta 1: Serviços Extras */}
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>✂️</span>
                    <div>
                      <strong style={{ fontSize: 14 }}>Meta Diária de Serviços Extras</strong>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        Incentiva o barbeiro a adicionar sobrancelha, barba, spa, hidratação ou 2º serviço na comanda.
                      </div>
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.metasDiarias?.servicosExtrasAtivo !== false}
                      onChange={(e) => atualizarDiaria('servicosExtrasAtivo', e.target.checked)}
                    />
                    Ativa
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: 12 }}>Quantidade de extras para ganhar giro:</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={form.metasDiarias?.servicosExtrasQtd ?? 6}
                      onChange={(e) => atualizarDiaria('servicosExtrasQtd', Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: 12 }}>Giros na roleta concedidos:</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={form.metasDiarias?.servicosExtrasGiros ?? 1}
                      onChange={(e) => atualizarDiaria('servicosExtrasGiros', Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              {/* Meta 2: Venda Diária de Produtos */}
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>🧴</span>
                    <div>
                      <strong style={{ fontSize: 14 }}>Meta Diária de Venda de Produtos</strong>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        Se o profissional vender o valor mínimo estipulado em produtos no dia, ganha a roleta.
                      </div>
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.metasDiarias?.produtosAtivo !== false}
                      onChange={(e) => atualizarDiaria('produtosAtivo', e.target.checked)}
                    />
                    Ativa
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: 12 }}>Quantidade mínima de produtos vendidos (unidades):</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="form-control"
                      value={form.metasDiarias?.produtosQtd ?? 2}
                      onChange={(e) => atualizarDiaria('produtosQtd', Math.max(1, Math.floor(Number(e.target.value))))}
                      placeholder="Ex: 2 unidades"
                    />
                    <small style={{ color: 'var(--muted)', fontSize: 11 }}>Meta por quantidade (ex.: 2 produtos no dia dão direito a 1 giro)</small>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: 12 }}>Giros na roleta concedidos:</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={form.metasDiarias?.produtosGiros ?? 1}
                      onChange={(e) => atualizarDiaria('produtosGiros', Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: DESAFIO SEMANAL */}
          {abaConfig === 'semanais' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <strong style={{ fontSize: 15 }}>Desafio Semanal de Vendas da Equipe</strong>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Mude as metas toda semana para manter o time motivado com novos desafios.
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.metasSemanais?.ativo !== false}
                      onChange={(e) => atualizarSemanal('ativo', e.target.checked)}
                    />
                    Desafio Ativo
                  </label>
                </div>

                <div style={{ display: 'grid', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: 12 }}>Título do Desafio da Semana:</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ex.: Semana da Pomada & Barba"
                      value={form.metasSemanais?.tituloDesafio || ''}
                      onChange={(e) => atualizarSemanal('tituloDesafio', e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: 12 }}>Descrição / Regras para o time:</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ex.: Quem atingir 10 pomadas vendidas ou R$ 500 no acumulado"
                      value={form.metasSemanais?.descricaoDesafio || ''}
                      onChange={(e) => atualizarSemanal('descricaoDesafio', e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 12 }}>Meta Produtos (R$):</label>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        className="form-control"
                        value={form.metasSemanais?.produtosValor ?? 500}
                        onChange={(e) => atualizarSemanal('produtosValor', Number(e.target.value))}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 12 }}>Meta Produtos (Qtd):</label>
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        value={form.metasSemanais?.produtosQtd ?? 10}
                        onChange={(e) => atualizarSemanal('produtosQtd', Number(e.target.value))}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 12 }}>Meta Faturamento (R$):</label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        className="form-control"
                        value={form.metasSemanais?.faturamentoValor ?? 2500}
                        onChange={(e) => atualizarSemanal('faturamentoValor', Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 12 }}>Premiação Extra do Desafio:</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ex.: R$ 100 no Pix + Troféu Barbeiro da Semana"
                        value={form.metasSemanais?.premiacaoDesafio || ''}
                        onChange={(e) => atualizarSemanal('premiacaoDesafio', e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 12 }}>Giros da Roleta:</label>
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        value={form.metasSemanais?.girosDesafio ?? 2}
                        onChange={(e) => atualizarSemanal('girosDesafio', Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA 3: PRÊMIOS DA ROLETA */}
          {abaConfig === 'roleta' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: 14 }}>Fatias e Prêmios da Roleta</strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Personalize o nome, ícone, cor e chance de cada prêmio.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={adicionarPremio}
                  style={{ fontSize: 12 }}
                >
                  + Adicionar Fatia
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(form.premiosRoleta || []).map((premio, idx) => (
                  <div
                    key={premio.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'rgba(255,255,255,0.03)',
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <input
                      type="text"
                      title="Ícone / Emoji"
                      style={{ width: 44, textAlign: 'center', fontSize: 16 }}
                      className="form-control form-control-sm"
                      value={premio.icone || '🎁'}
                      onChange={(e) => atualizarPremio(idx, 'icone', e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Nome do prêmio"
                      style={{ flex: 1 }}
                      className="form-control form-control-sm"
                      value={premio.nome || ''}
                      onChange={(e) => atualizarPremio(idx, 'nome', e.target.value)}
                    />
                    <input
                      type="color"
                      title="Cor da fatia"
                      style={{ width: 36, height: 32, padding: 2, cursor: 'pointer', borderRadius: 6, border: 'none' }}
                      value={premio.cor || '#10b981'}
                      onChange={(e) => atualizarPremio(idx, 'cor', e.target.value)}
                    />
                    <input
                      type="number"
                      min="1"
                      max="100"
                      title="Peso / Probabilidade (maior = mais chance)"
                      style={{ width: 60 }}
                      className="form-control form-control-sm"
                      value={premio.peso ?? 15}
                      onChange={(e) => atualizarPremio(idx, 'peso', Number(e.target.value))}
                    />
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', padding: '2px 8px' }}
                      onClick={() => removerPremio(idx)}
                      title="Excluir fatia"
                      disabled={(form.premiosRoleta || []).length <= 2}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rodapé com Salvar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={salvando}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
