/**
 * Agropecuária & Petshop — SetPoint Ultra
 * Tela: Pets, Prontuários, Vacinas, Receituários
 */
import { useState, useEffect, useCallback } from 'react'
import { api, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const TABS = ['Pets', 'Prontuários', 'Vacinas', 'Receituários']

export default function Agropecuaria() {
  const { toast } = useToast()
  const [tab, setTab] = useState('Pets')
  const [pets, setPets] = useState([])
  const [receituarios, setReceituarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [petSelecionado, setPetSelecionado] = useState(null)
  const [formPet, setFormPet] = useState({ nome: '', especie: '', raca: '', sexo: 'macho', data_nascimento: '', peso_kg: '', cliente_nome: '', cliente_telefone: '', castrado: false })
  const [formReceita, setFormReceita] = useState({ tipo: 'agronomico', profissional_nome: '', profissional_registro: '', cliente_nome: '', propriedade: '', validade_dias: 30 })

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [petsData, recData] = await Promise.all([
        api.get('/api/v1/agropecuaria/pets'),
        api.get('/api/v1/agropecuaria/receituarios')
      ])
      setPets(petsData.pets || [])
      setReceituarios(recData.receituarios || [])
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function salvarPet() {
    try {
      await api.post('/api/v1/agropecuaria/pets', formPet)
      toast('Pet cadastrado!', 'success')
      setModal(null)
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  async function emitirReceita() {
    try {
      await api.post('/api/v1/agropecuaria/receituarios', formReceita)
      toast('Receituário emitido!', 'success')
      setModal(null)
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>🌾 Agropecuária & Petshop</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>{pets.length} pets cadastrados</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {tab === 'Pets' && <button className="btn-primary" onClick={() => setModal('novo-pet')}>+ Novo Pet</button>}
          {tab === 'Receituários' && <button className="btn-primary" onClick={() => setModal('nova-receita')}>+ Emitir Receituário</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--card)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? '#fff' : 'var(--muted)', cursor: 'pointer', fontWeight: tab === t ? 600 : 400, transition: 'all 0.2s' }}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Carregando...</div>
      ) : (
        <>
          {/* Tab: Pets */}
          {tab === 'Pets' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {pets.length === 0 ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Nenhum pet cadastrado</div>
              ) : pets.map(pet => (
                <div key={pet.id} onClick={() => { setPetSelecionado(pet); setModal('prontuario') }}
                  style={{ background: 'var(--card)', borderRadius: 12, padding: 20, cursor: 'pointer', border: '1px solid var(--line)', transition: 'border-color 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: pet.especie === 'cão' ? '#f59e0b22' : '#8b5cf622', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                      {pet.especie === 'cão' ? '🐕' : pet.especie === 'gato' ? '🐈' : '🐾'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{pet.nome}</div>
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{pet.raca || pet.especie}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                    <div><span style={{ color: 'var(--muted)' }}>Dono:</span> {pet.cliente_nome}</div>
                    <div><span style={{ color: 'var(--muted)' }}>Peso:</span> {pet.peso_kg ? `${pet.peso_kg} kg` : '-'}</div>
                    <div><span style={{ color: 'var(--muted)' }}>Sexo:</span> {pet.sexo}</div>
                    <div><span style={{ color: 'var(--muted)' }}>Castrado:</span> {pet.castrado ? 'Sim' : 'Não'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab: Receituários */}
          {tab === 'Receituários' && (
            <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--card2)', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Nº Receita</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Tipo</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Profissional</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Cliente</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Emissão</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {receituarios.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nenhum receituário emitido</td></tr>
                  ) : receituarios.map(r => (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{r.numero_receita}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: r.tipo === 'agronomico' ? '#5FB33522' : '#8b5cf622', color: r.tipo === 'agronomico' ? '#5FB335' : '#8b5cf6', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                          {r.tipo === 'agronomico' ? '🌱 Agronômico' : '🐾 Veterinário'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{r.profissional_nome}</td>
                      <td style={{ padding: '12px 16px' }}>{r.cliente_nome}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>{fmtDate(r.data_emissao)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: r.status === 'emitido' ? '#4a9eff22' : '#5FB33522', color: r.status === 'emitido' ? '#4a9eff' : '#5FB335', padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tabs Vacinas e Prontuários — placeholder */}
          {(tab === 'Vacinas' || tab === 'Prontuários') && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
              {tab === 'Vacinas' ? '💉 Selecione um pet para ver o histórico de vacinas' : '📋 Selecione um pet para ver o prontuário'}
            </div>
          )}
        </>
      )}

      {/* Modal: Novo Pet */}
      {modal === 'novo-pet' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 24px' }}>🐾 Novo Pet</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'Nome do Pet *', key: 'nome', placeholder: 'Rex' },
                { label: 'Espécie *', key: 'especie', placeholder: 'cão, gato, pássaro...' },
                { label: 'Raça', key: 'raca', placeholder: 'Labrador' },
                { label: 'Peso (kg)', key: 'peso_kg', placeholder: '12.5', type: 'number' },
                { label: 'Data de Nascimento', key: 'data_nascimento', type: 'date' },
                { label: 'Microchip', key: 'microchip', placeholder: 'opcional' },
                { label: 'Nome do Dono *', key: 'cliente_nome', placeholder: 'Maria Silva' },
                { label: 'Telefone do Dono', key: 'cliente_telefone', placeholder: '(65) 99999-9999' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type || 'text'} placeholder={f.placeholder} value={formPet[f.key] || ''} onChange={e => setFormPet(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Sexo</label>
                <select value={formPet.sexo} onChange={e => setFormPet(p => ({ ...p, sexo: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }}>
                  <option value="macho">Macho</option>
                  <option value="femea">Fêmea</option>
                  <option value="nao_informado">Não informado</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                <input type="checkbox" id="castrado" checked={formPet.castrado} onChange={e => setFormPet(p => ({ ...p, castrado: e.target.checked }))} />
                <label htmlFor="castrado" style={{ fontSize: 14 }}>Castrado</label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarPet} className="btn-primary">Salvar Pet</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Emitir Receituário */}
      {modal === 'nova-receita' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: 520 }}>
            <h2 style={{ margin: '0 0 24px' }}>📋 Emitir Receituário</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Tipo</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['agronomico', 'veterinario'].map(t => (
                    <button key={t} onClick={() => setFormReceita(p => ({ ...p, tipo: t }))}
                      style={{ flex: 1, padding: '10px', borderRadius: 8, border: `2px solid ${formReceita.tipo === t ? 'var(--accent)' : 'var(--line)'}`, background: formReceita.tipo === t ? 'var(--accent)22' : 'transparent', color: formReceita.tipo === t ? 'var(--accent)' : 'var(--fg)', cursor: 'pointer', fontWeight: 600 }}>
                      {t === 'agronomico' ? '🌱 Agronômico' : '🐾 Veterinário'}
                    </button>
                  ))}
                </div>
              </div>
              {[
                { label: 'Profissional (Nome)', key: 'profissional_nome', placeholder: 'Dr. Carlos Mendes' },
                { label: 'CREA/CFMV', key: 'profissional_registro', placeholder: '12345-MT' },
                { label: 'Nome do Cliente', key: 'cliente_nome', placeholder: 'João Fazendeiro' },
                { label: 'Propriedade', key: 'propriedade', placeholder: 'Fazenda Boa Vista' },
                { label: 'Validade (dias)', key: 'validade_dias', type: 'number', placeholder: '30' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type || 'text'} placeholder={f.placeholder} value={formReceita[f.key] || ''} onChange={e => setFormReceita(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={emitirReceita} className="btn-primary">Emitir Receituário</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
