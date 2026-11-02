/**
 * Agropecuária & Petshop — KYTTO Clube
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
  const [vacinas, setVacinas] = useState([])
  const [prontuarios, setProntuarios] = useState([])
  const [receituarios, setReceituarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [petSelecionado, setPetSelecionado] = useState(null)
  const [formPet, setFormPet] = useState({ nome: '', especie: '', raca: '', sexo: 'macho', data_nascimento: '', peso_kg: '', cliente_nome: '', cliente_telefone: '', castrado: false })
  const [formVacina, setFormVacina] = useState({ pet_nome: '', nome_vacina: '', veterinario: '', lote: '', data_aplicacao: '', proxima_dose: '' })
  const [formPront, setFormPront] = useState({ pet_nome: '', veterinario: '', queixa: '', diagnostico: '', prescricao: '' })
  const [formReceita, setFormReceita] = useState({ tipo: 'agronomico', profissional_nome: '', profissional_registro: '', cliente_nome: '', propriedade: '', validade_dias: 30 })

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [petsData, vacData, prontData, recData] = await Promise.all([
        api.get('/api/v1/agropecuaria/pets'),
        api.get('/api/v1/agropecuaria/vacinas').catch(() => ({ vacinas: [] })),
        api.get('/api/v1/agropecuaria/prontuarios').catch(() => ({ prontuarios: [] })),
        api.get('/api/v1/agropecuaria/receituarios')
      ])
      setPets(petsData.pets || [])
      setVacinas(vacData.vacinas || [])
      setProntuarios(prontData.prontuarios || [])
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

  async function salvarVacina() {
    try {
      await api.post('/api/v1/agropecuaria/vacinas', formVacina)
      toast('Vacina registrada!', 'success')
      setModal(null)
      setFormVacina({ pet_nome: '', nome_vacina: '', veterinario: '', lote: '', data_aplicacao: '', proxima_dose: '' })
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  async function salvarProntuario() {
    try {
      await api.post('/api/v1/agropecuaria/prontuarios', formPront)
      toast('Atendimento clínico registrado no prontuário!', 'success')
      setModal(null)
      setFormPront({ pet_nome: '', veterinario: '', queixa: '', diagnostico: '', prescricao: '' })
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>🌾 Agropecuária & Petshop</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>{pets.length} pets · {vacinas.length} vacinas · {receituarios.length} receituários</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {tab === 'Pets' && <button className="btn-primary" onClick={() => setModal('novo-pet')}>+ Novo Pet</button>}
          {tab === 'Vacinas' && <button className="btn-primary" onClick={() => setModal('nova-vacina')}>+ Registrar Vacina</button>}
          {tab === 'Prontuários' && <button className="btn-primary" onClick={() => setModal('novo-prontuario')}>+ Novo Atendimento</button>}
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
                        <span style={{ background: r.tipo === 'agronomico' ? '#FF6B2C22' : '#8b5cf622', color: r.tipo === 'agronomico' ? '#FF6B2C' : '#8b5cf6', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                          {r.tipo === 'agronomico' ? '🌱 Agronômico' : '🐾 Veterinário'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{r.profissional_nome}</td>
                      <td style={{ padding: '12px 16px' }}>{r.cliente_nome}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>{fmtDate(r.data_emissao)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: r.status === 'emitido' ? '#4a9eff22' : '#FF6B2C22', color: r.status === 'emitido' ? '#4a9eff' : '#FF6B2C', padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>
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
          {tab === 'Vacinas' && (
            <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--card2)', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Pet</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Vacina</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Veterinário</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Aplicação</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Próxima dose</th>
                  </tr>
                </thead>
                <tbody>
                  {vacinas.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nenhuma vacina registrada. Clique em + Registrar Vacina.</td></tr>
                  ) : vacinas.map(v => (
                    <tr key={v.id} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{v.pet_nome}</td>
                      <td style={{ padding: '12px 16px' }}>{v.nome_vacina}{v.lote ? ` · Lote ${v.lote}` : ''}</td>
                      <td style={{ padding: '12px 16px' }}>{v.veterinario || '-'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>{v.data_aplicacao ? fmtDate(v.data_aplicacao) : '-'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13 }}>{v.proxima_dose ? fmtDate(v.proxima_dose) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === 'Prontuários' && (
            <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--card2)', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Pet</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Veterinário</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Queixa / Diagnóstico</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Prescrição</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {prontuarios.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nenhum prontuário registrado. Clique em + Novo Atendimento.</td></tr>
                  ) : prontuarios.map(p => (
                    <tr key={p.id} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{p.pet_nome}</td>
                      <td style={{ padding: '12px 16px' }}>{p.veterinario || '-'}</td>
                      <td style={{ padding: '12px 16px' }}><div><strong>{p.diagnostico || p.queixa}</strong>{p.queixa && p.diagnostico && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.queixa}</div>}</div></td>
                      <td style={{ padding: '12px 16px', fontSize: 13 }}>{p.prescricao || '-'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>{p.data_atendimento ? fmtDate(p.data_atendimento) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {modal === 'nova-vacina' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: 480 }}>
            <h2 style={{ margin: '0 0 20px' }}>💉 Registrar Vacina</h2>
            <div style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
              <input placeholder="Nome do Pet *" value={formVacina.pet_nome} onChange={e => setFormVacina(p => ({ ...p, pet_nome: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
              <input placeholder="Vacina (ex.: V10, Antirrábica) *" value={formVacina.nome_vacina} onChange={e => setFormVacina(p => ({ ...p, nome_vacina: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
              <input placeholder="Veterinário responsável" value={formVacina.veterinario} onChange={e => setFormVacina(p => ({ ...p, veterinario: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
              <input placeholder="Lote da vacina" value={formVacina.lote} onChange={e => setFormVacina(p => ({ ...p, lote: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
              <label style={{ fontSize: 12, color: 'var(--muted)' }}>Próxima dose (reforço)<input type="date" value={formVacina.proxima_dose} onChange={e => setFormVacina(p => ({ ...p, proxima_dose: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} /></label>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarVacina} className="btn-primary">Salvar Vacina</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'novo-prontuario' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: 500 }}>
            <h2 style={{ margin: '0 0 20px' }}>🩺 Novo Atendimento Clínico</h2>
            <div style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
              <input placeholder="Nome do Pet *" value={formPront.pet_nome} onChange={e => setFormPront(p => ({ ...p, pet_nome: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
              <input placeholder="Veterinário responsável *" value={formPront.veterinario} onChange={e => setFormPront(p => ({ ...p, veterinario: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
              <input placeholder="Queixa principal / Anamnese" value={formPront.queixa} onChange={e => setFormPront(p => ({ ...p, queixa: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
              <input placeholder="Diagnóstico clínico" value={formPront.diagnostico} onChange={e => setFormPront(p => ({ ...p, diagnostico: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
              <textarea rows={3} placeholder="Prescrição / Conduta terapêutica" value={formPront.prescricao} onChange={e => setFormPront(p => ({ ...p, prescricao: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarProntuario} className="btn-primary">Salvar Prontuário</button>
            </div>
          </div>
        </div>
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
