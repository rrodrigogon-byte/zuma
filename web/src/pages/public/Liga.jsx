import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../lib/api'

/* ── Paleta ─────────────────────────────────────────────────────────────── */
const C = {
  green: '#1B4D2E', lime: '#7BC142', gold: '#FF6B2C',
  silver: '#9e9e9e', bronze: '#cd7f32',
  bg: '#FFF4EC', card: '#fff', border: '#e0ead0',
  muted: '#6a8a6a', danger: '#e05555', white: '#fff',
  text: '#1a2a1a',
}
const MEDAL = ['🥇','🥈','🥉']

/* ── Utilitários ─────────────────────────────────────────────────────────── */
const fmtTel = v => {
  const d = v.replace(/\D/g,'')
  if(d.length<=11) return d.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3')
  return v
}
const fmtCPF = v => v.replace(/\D/g,'').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4')

const statusBadge = {
  inscricoes:   { label:'Inscrições Abertas', color:'#27ae60', bg:'#eafaf1' },
  em_andamento: { label:'Em Andamento',       color:'#2980b9', bg:'#eaf4fb' },
  encerrada:    { label:'Encerrada',           color:'#7f8c8d', bg:'#f2f3f4' },
}

/* ── Barra de aproveitamento ─────────────────────────────────────────────── */
function AprBar({ v, d }) {
  const total = v + d; if(!total) return <span style={{color:C.muted,fontSize:12}}>—</span>
  const pct = Math.round(100*v/total)
  const color = pct>=70?C.lime:pct>=40?C.gold:C.danger
  return (
    <div style={{display:'flex',alignItems:'center',gap:6,minWidth:80}}>
      <div style={{flex:1,height:6,background:'#eee',borderRadius:99,overflow:'hidden'}}>
        <div style={{width:`${pct}%`,height:'100%',background:color,borderRadius:99,transition:'width .5s'}}/>
      </div>
      <span style={{fontSize:11,fontWeight:700,color,minWidth:30}}>{pct}%</span>
    </div>
  )
}

/* ── Donut SVG de aproveitamento ─────────────────────────────────────────── */
function Donut({ pct=0, size=40 }) {
  const r=14, circ=2*Math.PI*r
  const color = pct>=70?C.lime:pct>=40?C.gold:C.danger
  return (
    <svg width={size} height={size} viewBox="0 0 36 36">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#eee" strokeWidth="4"/>
      <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={circ-(pct/100)*circ}
        strokeLinecap="round" transform="rotate(-90 18 18)"/>
      <text x="18" y="22" textAnchor="middle" fontSize="8" fontWeight="800" fill={color}>{pct}%</text>
    </svg>
  )
}

/* ── Toast ───────────────────────────────────────────────────────────────── */
function Toast({ msg, onClose }) {
  useEffect(() => { if(msg) { const t=setTimeout(onClose,3500); return ()=>clearTimeout(t) } }, [msg])
  if(!msg) return null
  return (
    <div style={{position:'fixed',top:20,right:20,zIndex:1001,background:msg.ok?C.green:C.danger,
      color:'#fff',padding:'12px 22px',borderRadius:12,fontWeight:700,fontSize:'0.88rem',
      boxShadow:'0 4px 20px rgba(0,0,0,.25)',animation:'fadeIn .2s'}}>
      {msg.ok?'✓ ':' ⚠ '}{msg.text}
    </div>
  )
}

/* ── Modal de inscrição ─────────────────────────────────────────────────── */
function ModalInscricao({ liga, onClose, onSuccess }) {
  const [f, setF] = useState({ nome:'', email:'', tel:'' })
  const [erros, setErros] = useState({})
  const [loading, setLoading] = useState(false)
  const set = (k,v) => { setF(p=>({...p,[k]:v})); setErros(p=>({...p,[k]:''})) }

  const validar = () => {
    const e = {}
    if(!f.nome.trim()) e.nome = 'Nome obrigatório'
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'E-mail inválido'
    setErros(e); return Object.keys(e).length === 0
  }

  const enviar = async () => {
    if(!validar()) return
    setLoading(true)
    try {
      const res = await api.post(`/api/ligas/${liga.id}/inscrever`, f)
      onSuccess(`Inscrição confirmada! Bem-vindo(a) à liga, ${f.nome.split(' ')[0]}!`)
      onClose()
    } catch(err) {
      setErros({ _: err.message || 'Erro ao inscrever' })
    } finally { setLoading(false) }
  }

  const inp = (err) => ({
    borderRadius:8, border:`1.5px solid ${err?C.danger:C.border}`, padding:'10px 14px',
    fontSize:'0.92rem', width:'100%', outline:'none', boxSizing:'border-box',
    fontFamily:'inherit', background:'#fff'
  })

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(14,46,28,.6)',zIndex:999,
      display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div style={{background:C.card,borderRadius:16,padding:28,maxWidth:420,width:'100%',
        boxShadow:'0 8px 40px rgba(0,0,0,.2)'}} onClick={e=>e.stopPropagation()}>

        <div style={{textAlign:'center',marginBottom:20}}>
          <div style={{fontSize:'2.5rem',marginBottom:8}}>🎾</div>
          <h2 style={{margin:0,color:C.green,fontSize:'1.15rem'}}>Inscrição na Liga</h2>
          <p style={{margin:'6px 0 0',color:C.muted,fontSize:'0.85rem'}}>{liga.nome} · {liga.temporada}</p>
        </div>

        {erros._ && <div style={{background:'#ffeaea',color:C.danger,borderRadius:8,padding:'8px 12px',marginBottom:12,fontSize:'0.85rem'}}>{erros._}</div>}

        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div>
            <input placeholder="Seu nome completo *" value={f.nome}
              onChange={e=>set('nome',e.target.value)} style={inp(erros.nome)}/>
            {erros.nome && <div style={{color:C.danger,fontSize:11,marginTop:3}}>{erros.nome}</div>}
          </div>
          <div>
            <input placeholder="E-mail *" type="email" value={f.email}
              onChange={e=>set('email',e.target.value)} style={inp(erros.email)}/>
            {erros.email && <div style={{color:C.danger,fontSize:11,marginTop:3}}>{erros.email}</div>}
          </div>
          <div>
            <input placeholder="WhatsApp (opcional)" value={f.tel}
              onChange={e=>set('tel',fmtTel(e.target.value))} maxLength={16} style={inp(false)}/>
          </div>
        </div>

        <div style={{display:'flex',gap:10,marginTop:20}}>
          <button onClick={onClose} style={{flex:1,padding:'11px',borderRadius:9,border:`1.5px solid ${C.border}`,
            background:'#f5f7f0',cursor:'pointer',fontWeight:600,color:C.muted,fontSize:'0.9rem'}}>
            Cancelar
          </button>
          <button onClick={enviar} disabled={loading} style={{flex:2,padding:'11px',borderRadius:9,border:'none',
            background:loading?'#aaa':C.lime,cursor:loading?'not-allowed':'pointer',fontWeight:800,
            color:C.green,fontSize:'0.95rem',boxShadow:`0 3px 12px ${C.lime}55`}}>
            {loading?'Enviando…':'🎾 Confirmar Inscrição'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Tabela de Classificação ────────────────────────────────────────────── */
function TabelaClassificacao({ tabela, liga }) {
  if(!tabela?.length) return (
    <div style={{textAlign:'center',padding:40,color:C.muted}}>
      <div style={{fontSize:'2.5rem',marginBottom:8}}>📋</div>
      <p>Nenhum resultado registrado ainda.</p>
    </div>
  )

  const podio = tabela.slice(0,3)
  const resto = tabela.slice(3)

  return (
    <div>
      {/* Pódio visual top 3 */}
      {tabela.length >= 3 && (
        <div style={{display:'flex',gap:10,marginBottom:20,justifyContent:'center',flexWrap:'wrap'}}>
          {[podio[1],podio[0],podio[2]].filter(Boolean).map((p, rawIdx) => {
            const real = p === podio[0] ? 0 : p === podio[1] ? 1 : 2
            const h = real===0?100:85
            const bg = ['linear-gradient(135deg,#FF6B2C,#f0d080)','linear-gradient(135deg,#b8c8b0,#d8e8d0)','linear-gradient(135deg,#cd7f32,#e8a96a)'][real]
            return (
              <div key={p.nome} style={{textAlign:'center',width:real===0?130:110}}>
                <div style={{height:h,background:bg,borderRadius:'12px 12px 0 0',display:'flex',
                  alignItems:'flex-end',justifyContent:'center',paddingBottom:10}}>
                  <span style={{fontSize:real===0?'2.2rem':'1.9rem'}}>{MEDAL[real]}</span>
                </div>
                <div style={{background:'#fff',border:`2px solid ${C.border}`,borderTop:'none',
                  borderRadius:'0 0 12px 12px',padding:'8px 4px'}}>
                  <div style={{fontWeight:800,fontSize:'0.82rem',color:C.green,lineHeight:1.2}}>{p.nome.split(' ')[0]}</div>
                  <div style={{fontSize:'0.75rem',color:C.muted}}>{p.pts}pts</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tabela completa */}
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.88rem'}}>
          <thead>
            <tr style={{background:C.green,color:'#fff'}}>
              <th style={th}>#</th>
              <th style={{...th,textAlign:'left'}}>Atleta</th>
              <th style={th}>Pts</th>
              <th style={th}>J</th>
              <th style={th}>V</th>
              <th style={th}>D</th>
              <th style={th}>Aprovt.</th>
            </tr>
          </thead>
          <tbody>
            {tabela.map((p,i) => (
              <tr key={p.nome} style={{background:i%2===0?'#f8fbf5':'#fff',
                borderBottom:`1px solid ${C.border}`,transition:'background .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='#e8f5dc'}
                onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#f8fbf5':'#fff'}>
                <td style={{...td,textAlign:'center',fontWeight:800}}>
                  {i<3?<span style={{fontSize:'1.1rem'}}>{MEDAL[i]}</span>:p.pos}
                </td>
                <td style={{...td,fontWeight:600,color:C.green}}>{p.nome}</td>
                <td style={{...td,textAlign:'center',fontWeight:800,color:C.lime,fontSize:'1rem'}}>{p.pts}</td>
                <td style={{...td,textAlign:'center',color:C.muted}}>{p.jogos}</td>
                <td style={{...td,textAlign:'center',color:'#27ae60',fontWeight:700}}>{p.v}</td>
                <td style={{...td,textAlign:'center',color:C.danger}}>{p.d}</td>
                <td style={{...td}}><AprBar v={p.v} d={p.d}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legenda de pontos */}
      <div style={{marginTop:12,padding:'8px 12px',background:'#f0f7e8',borderRadius:8,
        fontSize:'0.8rem',color:C.muted,display:'flex',gap:16,flexWrap:'wrap'}}>
        <span>🏆 Vitória: <strong style={{color:C.green}}>{liga.config?.pontosVitoria??3}pts</strong></span>
        <span>😓 Derrota: <strong style={{color:C.green}}>{liga.config?.pontosDerrota??1}pts</strong></span>
        <span>🎟 BYE: <strong style={{color:C.green}}>{liga.config?.pontosBye??2}pts</strong></span>
        <span>❌ W.O.: <strong style={{color:C.green}}>{liga.config?.pontosWO??0}pts</strong></span>
      </div>
    </div>
  )
}

/* ── Rodadas ────────────────────────────────────────────────────────────── */
function Rodadas({ rodadas, inscricoes, rodadaAtual }) {
  const [aberta, setAberta] = useState(Math.max(0, (rodadaAtual||1)-1))
  if(!rodadas?.length) return (
    <div style={{textAlign:'center',padding:40,color:C.muted}}>
      <div style={{fontSize:'2.5rem',marginBottom:8}}>📅</div>
      <p>Rodadas ainda não geradas.</p>
    </div>
  )

  const statusRodada = {
    pendente:    { label:'Pendente',    color:C.muted,   bg:'#f5f5f5' },
    em_andamento:{ label:'Em Andamento',color:'#2980b9', bg:'#eaf4fb' },
    encerrada:   { label:'Encerrada',   color:'#27ae60', bg:'#eafaf1' },
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {rodadas.map((rd, ri) => {
        const sr = statusRodada[rd.status] || statusRodada.pendente
        const open = aberta === ri
        const jogosReais = rd.jogos.filter(j=>j.tipo!=='bye')
        const concluidos = jogosReais.filter(j=>j.vencedor).length

        return (
          <div key={ri} style={{border:`1.5px solid ${open?C.lime:C.border}`,borderRadius:12,overflow:'hidden',
            transition:'border-color .2s'}}>
            {/* Header da rodada */}
            <div onClick={()=>setAberta(open?-1:ri)}
              style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                padding:'12px 16px',cursor:'pointer',background:open?'#f0fbea':'#f8fbf5',
                userSelect:'none'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:32,height:32,borderRadius:'50%',background:C.green,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  color:'#fff',fontWeight:800,fontSize:'0.9rem'}}>{rd.numero}</div>
                <div>
                  <div style={{fontWeight:700,color:C.green,fontSize:'0.95rem'}}>Rodada {rd.numero}</div>
                  <div style={{fontSize:'0.75rem',color:C.muted}}>{concluidos}/{jogosReais.length} jogos concluídos</div>
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{background:sr.bg,color:sr.color,borderRadius:20,padding:'3px 10px',
                  fontSize:'0.75rem',fontWeight:700}}>{sr.label}</span>
                <span style={{color:C.muted,fontSize:'1.2rem',transform:open?'rotate(90deg)':'',transition:'transform .2s'}}>›</span>
              </div>
            </div>

            {/* Jogos */}
            {open && (
              <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:8}}>
                {rd.jogos.map((j, ji) => {
                  const done = j.vencedor
                  const isBye = j.tipo === 'bye'
                  return (
                    <div key={j.id} style={{
                      display:'flex',alignItems:'center',gap:8,padding:'10px 14px',
                      background:done?'#f0fbea':isBye?'#f8f8f8':'#fff',
                      border:`1.5px solid ${done?'#c3e6cb':isBye?'#e0e0e0':C.border}`,
                      borderRadius:10,
                    }}>
                      {isBye ? (
                        <>
                          <span style={{flex:1,fontWeight:600,color:C.green}}>{j.a}</span>
                          <span style={{background:'#e9e9e9',color:C.muted,borderRadius:6,
                            padding:'2px 10px',fontSize:'0.78rem',fontWeight:700}}>BYE 🎟</span>
                        </>
                      ) : (
                        <>
                          <span style={{flex:1,fontWeight:done&&j.vencedor===j.a?800:500,
                            color:done&&j.vencedor===j.a?C.green:C.text,
                            textDecoration:done&&j.vencedor!==j.a?'line-through':''
                          }}>{j.a}</span>
                          <div style={{textAlign:'center',minWidth:60}}>
                            {done ? (
                              <span style={{background:'#1B4D2E',color:'#fff',borderRadius:6,
                                padding:'3px 10px',fontSize:'0.78rem',fontWeight:700}}>
                                {j.placar||'✓'}
                              </span>
                            ) : (
                              <span style={{color:C.muted,fontSize:'0.82rem',fontWeight:600}}>vs</span>
                            )}
                          </div>
                          <span style={{flex:1,textAlign:'right',fontWeight:done&&j.vencedor===j.b?800:500,
                            color:done&&j.vencedor===j.b?C.green:C.text,
                            textDecoration:done&&j.vencedor!==j.b?'line-through':''
                          }}>{j.b}</span>
                          {done && (
                            <span style={{fontSize:'1rem',marginLeft:4}}>
                              {j.tipo==='normal'?'✅':j.tipo==='wo'?'🚫':'🏁'}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Participantes ──────────────────────────────────────────────────────── */
function Participantes({ inscricoes, tabela }) {
  if(!inscricoes?.length) return (
    <div style={{textAlign:'center',padding:40,color:C.muted}}>
      <div style={{fontSize:'2.5rem'}}>👥</div>
      <p>Nenhum participante inscrito ainda.</p>
    </div>
  )
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:10}}>
      {inscricoes.map((insc,i) => {
        const entry = tabela?.find(t=>t.nome===insc.nome)
        return (
          <div key={insc.id} style={{background:'#f8fbf5',border:`1.5px solid ${C.border}`,
            borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:36,height:36,borderRadius:'50%',background:C.green,display:'flex',
              alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:'0.9rem',
              flexShrink:0}}>
              {insc.nome.charAt(0).toUpperCase()}
            </div>
            <div style={{minWidth:0}}>
              <div style={{fontWeight:700,color:C.green,fontSize:'0.85rem',
                whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{insc.nome}</div>
              {entry && <div style={{fontSize:'0.75rem',color:C.muted}}>{entry.pts}pts · {entry.v}V {entry.d}D</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Estilos tabela ──────────────────────────────────────────────────────── */
const th = { padding:'10px 8px', fontWeight:700, fontSize:'0.8rem', textAlign:'center', whiteSpace:'nowrap' }
const td = { padding:'9px 8px', verticalAlign:'middle' }

/* ════════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL — Lista de Ligas
══════════════════════════════════════════════════════════════════════════════ */
function ListaLigas() {
  const [ligas, setLigas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/ligas').then(setLigas).catch(()=>{}).finally(()=>setLoading(false))
  }, [])

  if(loading) return <div style={{textAlign:'center',padding:60,color:C.muted}}>Carregando ligas…</div>

  return (
    <div style={{maxWidth:800,margin:'0 auto',padding:'24px 16px'}}>
      <div style={{textAlign:'center',marginBottom:32}}>
        <h1 style={{color:C.green,fontSize:'1.8rem',margin:0}}>🏆 Ligas de Ranking</h1>
        <p style={{color:C.muted,marginTop:8}}>Participe, acompanhe sua posição e suba no ranking!</p>
      </div>

      {!ligas.length ? (
        <div style={{textAlign:'center',padding:60,color:C.muted,background:C.card,borderRadius:16,
          border:`1.5px solid ${C.border}`}}>
          <div style={{fontSize:'3rem',marginBottom:12}}>🎾</div>
          <h3 style={{margin:0,color:C.green}}>Nenhuma liga disponível no momento</h3>
          <p style={{marginTop:8}}>Fique de olho — novas ligas serão criadas em breve!</p>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {ligas.map(liga => {
            const sb = statusBadge[liga.status] || statusBadge.inscricoes
            return (
              <Link key={liga.id} to={`/liga/${liga.id}`} style={{textDecoration:'none'}}>
                <div style={{background:C.card,border:`1.5px solid ${C.border}`,borderRadius:14,
                  padding:'18px 20px',display:'flex',alignItems:'center',gap:16,
                  boxShadow:'0 2px 8px rgba(0,0,0,.06)',cursor:'pointer',
                  transition:'transform .15s,box-shadow .15s'}}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 20px rgba(0,0,0,.1)'}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,.06)'}}>
                  <div style={{width:54,height:54,background:C.green,borderRadius:14,display:'flex',
                    alignItems:'center',justifyContent:'center',fontSize:'1.8rem',flexShrink:0}}>🏆</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <h3 style={{margin:0,color:C.green,fontSize:'1rem'}}>{liga.nome}</h3>
                      <span style={{background:sb.bg,color:sb.color,borderRadius:20,padding:'2px 10px',
                        fontSize:'0.72rem',fontWeight:700}}>{sb.label}</span>
                    </div>
                    <div style={{fontSize:'0.82rem',color:C.muted,marginTop:4}}>
                      {liga.categoria} · {liga.temporada}
                      {liga.descricao && ` · ${liga.descricao}`}
                    </div>
                    <div style={{display:'flex',gap:14,marginTop:6,fontSize:'0.8rem',color:C.muted}}>
                      <span>👤 {liga.inscricoes} inscritos</span>
                      <span>📅 {liga.totalRodadas} rodada{liga.totalRodadas!==1?'s':''}</span>
                      {liga.status==='em_andamento' && <span style={{color:'#2980b9'}}>🔴 Rodada {liga.rodadaAtual}</span>}
                    </div>
                  </div>
                  <span style={{color:C.lime,fontSize:'1.5rem',flexShrink:0}}>›</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL — Detalhe de uma Liga
══════════════════════════════════════════════════════════════════════════════ */
function Detalheliga() {
  const { id } = useParams()
  const [liga, setLiga] = useState(null)
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState('tabela')
  const [showModal, setShowModal] = useState(false)
  const [toast, setToast] = useState(null)

  const carregar = useCallback(() => {
    api.get(`/api/ligas/${id}`).then(setLiga).catch(()=>setLiga(null)).finally(()=>setLoading(false))
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  const onSuccess = msg => {
    setToast({ ok:true, text:msg })
    carregar()
  }

  if(loading) return <div style={{textAlign:'center',padding:60,color:C.muted}}>Carregando…</div>
  if(!liga) return (
    <div style={{textAlign:'center',padding:60,color:C.muted}}>
      <div style={{fontSize:'3rem'}}>❌</div>
      <p>Liga não encontrada.</p>
      <Link to="/liga" style={{color:C.lime}}>← Voltar às ligas</Link>
    </div>
  )

  const sb = statusBadge[liga.status] || statusBadge.inscricoes
  const inscricaoAberta = liga.status === 'inscricoes'

  const ABAS = [
    { id:'tabela',        label:'🏆 Classificação' },
    { id:'rodadas',       label:`📅 Rodadas (${liga.rodadas?.length||0})` },
    { id:'participantes', label:`👥 Atletas (${liga.inscricoes?.length||0})` },
  ]

  return (
    <div style={{maxWidth:820,margin:'0 auto',padding:'20px 16px',fontFamily:'system-ui,sans-serif'}}>
      <Toast msg={toast} onClose={()=>setToast(null)}/>

      {/* Voltar */}
      <Link to="/liga" style={{color:C.muted,fontSize:'0.88rem',textDecoration:'none',display:'inline-flex',
        alignItems:'center',gap:4,marginBottom:16}}>← Todas as ligas</Link>

      {/* Header da liga */}
      <div style={{background:C.green,borderRadius:16,padding:'24px 24px',marginBottom:20,
        color:'#fff',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-20,right:-20,width:150,height:150,
          background:'rgba(123,193,66,.15)',borderRadius:'50%'}}/>
        <div style={{position:'relative'}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
            <div>
              <span style={{background:sb.bg,color:sb.color,borderRadius:20,padding:'3px 12px',
                fontSize:'0.75rem',fontWeight:700,display:'inline-block',marginBottom:8}}>{sb.label}</span>
              <h1 style={{margin:0,fontSize:'1.4rem',fontWeight:900}}>{liga.nome}</h1>
              <p style={{margin:'6px 0 0',opacity:.8,fontSize:'0.9rem'}}>
                {liga.categoria} · Temporada {liga.temporada}
                {liga.descricao && ` · ${liga.descricao}`}
              </p>
            </div>
            {inscricaoAberta && (
              <button onClick={()=>setShowModal(true)}
                style={{background:C.lime,color:C.green,border:'none',borderRadius:10,
                  padding:'12px 20px',fontWeight:800,cursor:'pointer',fontSize:'0.9rem',
                  boxShadow:`0 4px 16px ${C.lime}55`,flexShrink:0}}>
                🎾 Inscrever-se
              </button>
            )}
          </div>

          {/* Stats rápidas */}
          <div style={{display:'flex',gap:20,marginTop:16,flexWrap:'wrap'}}>
            {[
              { label:'Atletas', value:liga.inscricoes?.length||0, icon:'👥' },
              { label:'Rodadas', value:liga.rodadas?.length||0, icon:'📅' },
              { label:'Rodada Atual', value:liga.rodadaAtual||'—', icon:'🔴' },
              { label:'Pontos V', value:liga.config?.pontosVitoria??3, icon:'🏆' },
            ].map(s => (
              <div key={s.label} style={{textAlign:'center'}}>
                <div style={{fontSize:'1.4rem'}}>{s.icon}</div>
                <div style={{fontWeight:800,fontSize:'1.1rem'}}>{s.value}</div>
                <div style={{fontSize:'0.72rem',opacity:.7}}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Abas */}
      <div style={{display:'flex',gap:4,marginBottom:16,background:'#f0f5e8',borderRadius:12,padding:4,overflowX:'auto'}}>
        {ABAS.map(a => (
          <button key={a.id} onClick={()=>setAba(a.id)}
            style={{flex:1,padding:'9px 8px',border:'none',borderRadius:9,cursor:'pointer',
              fontWeight:aba===a.id?800:500,fontSize:'0.82rem',whiteSpace:'nowrap',
              background:aba===a.id?C.green:'transparent',color:aba===a.id?'#fff':C.muted,
              transition:'all .2s',minWidth:100}}>
            {a.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div style={{background:C.card,border:`1.5px solid ${C.border}`,borderRadius:14,padding:'16px 16px',
        minHeight:200}}>
        {aba==='tabela' && <TabelaClassificacao tabela={liga.tabela} liga={liga}/>}
        {aba==='rodadas' && <Rodadas rodadas={liga.rodadas} inscricoes={liga.inscricoes} rodadaAtual={liga.rodadaAtual}/>}
        {aba==='participantes' && <Participantes inscricoes={liga.inscricoes} tabela={liga.tabela}/>}
      </div>

      {showModal && <ModalInscricao liga={liga} onClose={()=>setShowModal(false)} onSuccess={onSuccess}/>}
    </div>
  )
}

/* ── Export: roteador interno ───────────────────────────────────────────── */
export default function Liga() {
  const { id } = useParams()
  return id ? <Detalheliga/> : <ListaLigas/>
}
