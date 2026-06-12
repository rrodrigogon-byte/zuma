import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { api, fmtDate } from '../lib/api'
import { useToast } from '../hooks/useToast'

/* ── KPI card ── */
function KpiCard({ label, value, color }) {
  return (
    <div style={{
      background:'#0f1f13', border:`2px solid ${color || '#1e3a24'}`, borderRadius:14,
      padding:'20px 28px', textAlign:'center', minWidth:140, flex:1,
    }}>
      <div style={{ fontSize:42, fontWeight:900, color:color || '#f0f0f0', lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:13, color:'#aaa', marginTop:6, fontWeight:600, textTransform:'uppercase', letterSpacing:1 }}>{label}</div>
    </div>
  )
}

/* ── Modal de ingresso ── */
function IngressoModal({ ingresso, onValidar, onClose }) {
  if (!ingresso) return null
  const jaValidado = !!ingresso.validado
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:'#0a1a0d', border:`3px solid ${jaValidado ? '#e74c3c' : '#5FB335'}`, borderRadius:20, padding:'40px 48px', minWidth:400, maxWidth:540, textAlign:'center' }}>
        <div style={{ fontSize:16, color:'#888', marginBottom:8, letterSpacing:2, textTransform:'uppercase' }}>Ingresso</div>
        <div style={{ fontSize:40, fontWeight:900, color:'#f0f0f0', lineHeight:1.1, marginBottom:10 }}>{ingresso.nome}</div>
        <div style={{ display:'inline-block', background:'#1e3a24', color:'#C9A656', borderRadius:8, padding:'6px 20px', fontWeight:700, fontSize:18, marginBottom:24 }}>
          {ingresso.tipo}
        </div>
        {jaValidado ? (
          <div style={{ background:'#3a0a0a', border:'2px solid #e74c3c', borderRadius:12, padding:'20px 24px', marginBottom:24 }}>
            <div style={{ fontSize:24, fontWeight:900, color:'#e74c3c' }}>⛔ JÁ VALIDADO</div>
            <div style={{ fontSize:16, color:'#e74c3c', marginTop:8 }}>
              Entrada registrada em {fmtDate(ingresso.validadoEm)}
            </div>
          </div>
        ) : (
          <button onClick={() => onValidar(ingresso.id)}
            style={{ background:'#5FB335', color:'#000', border:'none', borderRadius:12, padding:'18px 40px', fontSize:26, fontWeight:900, cursor:'pointer', letterSpacing:1, display:'block', width:'100%', marginBottom:16, textTransform:'uppercase' }}>
            ✔ VALIDAR ENTRADA
          </button>
        )}
        <button onClick={onClose}
          style={{ background:'transparent', color:'#888', border:'1px solid #333', borderRadius:8, padding:'10px 28px', fontSize:16, cursor:'pointer' }}>
          Fechar
        </button>
      </div>
    </div>
  )
}

/* ── QR Scanner via câmera ── */
function QRScanner({ onScan, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const animRef = useRef(null)
  const [erro, setErro] = useState('')
  const [ativo, setAtivo] = useState(false)

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [])

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode:'environment', width:{ ideal:1280 }, height:{ ideal:720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setAtivo(true)
        // Polling por BarcodeDetector (moderno) ou fallback manual
        if ('BarcodeDetector' in window) {
          const bd = new window.BarcodeDetector({ formats:['qr_code','code_128','code_39','ean_13'] })
          const scan = async () => {
            try {
              if (videoRef.current && videoRef.current.readyState === 4) {
                const codes = await bd.detect(videoRef.current)
                if (codes.length > 0) {
                  stopCamera()
                  onScan(codes[0].rawValue)
                  return
                }
              }
            } catch {}
            animRef.current = requestAnimationFrame(scan)
          }
          animRef.current = requestAnimationFrame(scan)
        }
      }
    } catch(e) {
      setErro('Não foi possível acessar a câmera: ' + (e.message || 'Permissão negada'))
    }
  }

  function stopCamera() {
    cancelAnimationFrame(animRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.92)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:200 }}>
      <div style={{ fontSize:20, fontWeight:800, color:'#5FB335', marginBottom:14, letterSpacing:2 }}>📷 CÂMERA QR</div>
      {erro ? (
        <div style={{ background:'#3a0a0a', border:'2px solid #e74c3c', borderRadius:12, padding:24, maxWidth:380, textAlign:'center', color:'#e74c3c', fontSize:14 }}>
          {erro}
          <br /><br />
          <span style={{ fontSize:12, color:'#888' }}>Use a busca manual por nome ou código.</span>
        </div>
      ) : (
        <div style={{ position:'relative', width:300, height:300, borderRadius:16, overflow:'hidden', border:'3px solid #5FB335', background:'#000' }}>
          <video ref={videoRef} style={{ width:'100%', height:'100%', objectFit:'cover' }} muted playsInline />
          {/* Linha de escaneamento animada */}
          <div style={{
            position:'absolute', top:0, left:0, right:0, height:2, background:'rgba(95,179,53,.8)',
            animation:'scan-line 2s ease-in-out infinite',
          }} />
          {/* Cantos do visor */}
          {[['0%','0%','0 0'],['0%','auto','0 0'],['auto','0%','0 0'],['auto','auto','0 0']].map(([t,b,r], i) => (
            <div key={i} style={{
              position:'absolute', top:i<2?0:undefined, bottom:i>=2?0:undefined,
              left:i%2===0?0:undefined, right:i%2===1?0:undefined,
              width:24, height:24,
              borderTop: i < 2 ? '3px solid #5FB335' : 'none',
              borderBottom: i >= 2 ? '3px solid #5FB335' : 'none',
              borderLeft: i % 2 === 0 ? '3px solid #5FB335' : 'none',
              borderRight: i % 2 === 1 ? '3px solid #5FB335' : 'none',
            }} />
          ))}
        </div>
      )}
      {!erro && !('BarcodeDetector' in window) && (
        <div style={{ color:'#888', fontSize:12, marginTop:10, textAlign:'center', maxWidth:280 }}>
          Seu navegador não suporta leitura automática.<br />
          Aponte a câmera para o QR e o código aparecerá no campo de busca.
        </div>
      )}
      <div style={{ marginTop:18, display:'flex', gap:10 }}>
        {/* Input manual para browsers sem BarcodeDetector */}
        <form onSubmit={e => { e.preventDefault(); const v = e.target.qr.value.trim(); if(v){stopCamera();onScan(v)} }}
          style={{ display:'flex', gap:8 }}>
          <input name='qr' placeholder='Cole o código QR aqui…'
            style={{ background:'#0f1f13', border:'2px solid #2d4a32', borderRadius:10, padding:'10px 14px', fontSize:16, color:'#f0f0f0', outline:'none', width:220 }} />
          <button type='submit'
            style={{ background:'#5FB335', color:'#000', border:'none', borderRadius:10, padding:'0 20px', fontSize:14, fontWeight:900, cursor:'pointer' }}>OK</button>
        </form>
      </div>
      <button onClick={() => { stopCamera(); onClose() }}
        style={{ marginTop:14, background:'transparent', color:'#888', border:'1px solid #333', borderRadius:8, padding:'10px 28px', fontSize:16, cursor:'pointer' }}>
        Fechar câmera
      </button>
      <style>{`
        @keyframes scan-line {
          0%   { top: 0;    opacity:1 }
          50%  { top: 97%;  opacity:1 }
          100% { top: 0;    opacity:1 }
        }
      `}</style>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ */
export default function Portaria() {
  const [ingressos, setIngressos] = useState([])
  const [busca, setBusca] = useState('')
  const [encontrado, setEncontrado] = useState(null)
  const [ultimosValidados, setUltimosValidados] = useState([])
  const [loading, setLoading] = useState(true)
  const [showScanner, setShowScanner] = useState(false)
  const [histTab, setHistTab] = useState('sessao') // 'sessao' | 'hoje' | 'todos'
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const inputRef = useRef(null)
  const { toast } = useToast()

  // Busca instantânea
  const resultadosBusca = useMemo(() => {
    if (!busca.trim() || busca.length < 2) return []
    const q = busca.toLowerCase()
    return ingressos.filter(i =>
      i.nome.toLowerCase().includes(q) ||
      (i.qrCode && i.qrCode.toLowerCase().includes(q)) ||
      String(i.id) === busca.trim()
    ).slice(0, 8)
  }, [ingressos, busca])

  // Tipos únicos de ingresso
  const tipos = useMemo(() => ['todos', ...new Set(ingressos.map(i => i.tipo).filter(Boolean))], [ingressos])

  const load = useCallback(async () => {
    try {
      const data = await api.get('/api/admin/ingressos')
      setIngressos(Array.isArray(data) ? data : data?.ingressos || [])
    } catch { toast('Erro ao carregar ingressos', true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    setTimeout(() => inputRef.current?.focus(), 300)
  }, [load])

  /* ── Busca ── */
  function handleBusca(e) {
    e.preventDefault()
    if (!busca.trim()) return
    buscarIngresso(busca.trim())
  }

  function buscarIngresso(q) {
    const ql = q.toLowerCase()
    const found = ingressos.find(
      i => (i.qrCode && i.qrCode.toLowerCase() === ql) ||
           i.nome.toLowerCase().includes(ql) ||
           String(i.id) === q
    )
    setBusca(q)
    if (found) {
      setEncontrado(found)
    } else {
      toast(`Ingresso não encontrado: "${q}"`, true)
    }
  }

  /* ── Validar ── */
  async function handleValidar(id) {
    try {
      await api.post(`/api/admin/ingressos/${id}/validar`)
      const agora = new Date().toISOString()
      const atualizado = { ...ingressos.find(i => i.id === id), validado:true, validadoEm:agora }
      setIngressos(prev => prev.map(i => i.id === id ? atualizado : i))
      setEncontrado(atualizado)
      setUltimosValidados(prev => [atualizado, ...prev].slice(0, 20))
      toast('✅ Entrada validada!')
      setBusca('')
    } catch { toast('Erro ao validar ingresso', true) }
  }

  function fecharModal() {
    setEncontrado(null); setBusca('')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  /* ── KPIs ── */
  const hoje = new Date().toDateString()
  const validadosHoje = ingressos.filter(i => i.validado && new Date(i.validadoEm).toDateString() === hoje).length
  const total     = ingressos.length
  const restantes = total - ingressos.filter(i => i.validado).length
  const pct = total > 0 ? ((ingressos.filter(i => i.validado).length / total) * 100).toFixed(0) : 0

  /* ── Histórico hoje (do servidor, não só da sessão) ── */
  const validadosHojeList = ingressos.filter(i => i.validado && new Date(i.validadoEm).toDateString() === hoje)
    .sort((a, b) => new Date(b.validadoEm) - new Date(a.validadoEm))

  /* ── Lista todos com filtro tipo ── */
  const todosFiltrados = useMemo(() => {
    return ingressos
      .filter(i => filtroTipo === 'todos' || i.tipo === filtroTipo)
      .sort((a,b) => a.nome.localeCompare(b.nome))
  }, [ingressos, filtroTipo])

  return (
    <>
      <style>{`
        @keyframes fadeSlide {
          from { opacity:0; transform:translateY(10px) }
          to   { opacity:1; transform:none }
        }
      `}</style>
      <IngressoModal ingresso={encontrado} onValidar={handleValidar} onClose={fecharModal} />
      {showScanner && (
        <QRScanner
          onScan={val => { setShowScanner(false); buscarIngresso(val); setTimeout(() => inputRef.current?.focus(), 300) }}
          onClose={() => setShowScanner(false)}
        />
      )}
      <div style={{ minHeight:'100vh', background:'#060e08', color:'#f0f0f0', fontFamily:"'Segoe UI',system-ui,sans-serif", display:'flex', flexDirection:'column', padding:0 }}>

        {/* Header */}
        <div style={{ background:'#0a1a0d', borderBottom:'2px solid #1e3a24', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:26, fontWeight:900, color:'#5FB335', letterSpacing:2 }}>PORTARIA</div>
            <div style={{ fontSize:13, color:'#888', marginTop:2 }}>Controle de acesso — Agro Open</div>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <button onClick={load} style={{ background:'transparent', color:'#5FB335', border:'1px solid #2d4a32', borderRadius:8, padding:'6px 14px', fontSize:13, cursor:'pointer' }}>
              ↺ Recarregar
            </button>
            <div style={{ fontSize:13, color:'#888' }}>
              {loading ? 'Carregando…' : `${total} ingressos · ${pct}% validados`}
            </div>
          </div>
        </div>

        <div style={{ flex:1, padding:'24px 32px', display:'flex', flexDirection:'column', gap:20 }}>

          {/* KPIs */}
          <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
            <KpiCard label="Total Vendidos" value={total} color="#C9A656" />
            <KpiCard label="Validados Hoje" value={validadosHoje} color="#5FB335" />
            <KpiCard label="Restantes" value={restantes} color={restantes > 0 ? '#5FB335' : '#888'} />
            <div style={{
              background:'#0f1f13', border:`2px solid ${pct >= 80 ? '#5FB335' : pct >= 50 ? '#C9A656' : '#1e3a24'}`,
              borderRadius:14, padding:'20px 28px', textAlign:'center', minWidth:140, flex:1,
            }}>
              <div style={{ fontSize:13, color:'#888', marginBottom:4, fontWeight:600, textTransform:'uppercase', letterSpacing:1 }}>Ocupação</div>
              <div style={{ fontSize:42, fontWeight:900, color: pct >= 80 ? '#5FB335' : '#C9A656', lineHeight:1 }}>{pct}%</div>
              <div style={{ background:'#1e3a24', borderRadius:4, height:6, marginTop:10 }}>
                <div style={{ width:`${pct}%`, background:'#5FB335', borderRadius:4, height:'100%', transition:'width .5s' }} />
              </div>
            </div>
          </div>

          {/* Busca + Scanner */}
          <form onSubmit={handleBusca}>
            <div style={{ background:'#0f1f13', border:'2px solid #1e3a24', borderRadius:14, padding:'20px 24px', position:'relative' }}>
              <label style={{ fontSize:16, color:'#aaa', fontWeight:600, display:'block', marginBottom:10 }}>
                🔍 Código QR / Nome do participante
              </label>
              <div style={{ display:'flex', gap:10 }}>
                <input ref={inputRef} type="text" value={busca} onChange={e => setBusca(e.target.value)}
                  placeholder="Escaneie o QR ou digite o nome/ID…"
                  autoComplete="off"
                  style={{ flex:1, background:'#060e08', border:'2px solid #2d4a32', borderRadius:10, padding:'14px 20px', fontSize:22, color:'#f0f0f0', outline:'none', fontFamily:'inherit' }}
                />
                <button type="button" onClick={() => setShowScanner(true)} title="Abrir câmera QR"
                  style={{ background:'#1e3a24', color:'#5FB335', border:'none', borderRadius:10, padding:'0 18px', fontSize:24, cursor:'pointer' }}>
                  📷
                </button>
                <button type="submit"
                  style={{ background:'#5FB335', color:'#000', border:'none', borderRadius:10, padding:'0 28px', fontSize:18, fontWeight:900, cursor:'pointer', letterSpacing:1, textTransform:'uppercase' }}>
                  Buscar
                </button>
              </div>
              {/* Resultados instantâneos */}
              {resultadosBusca.length > 0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#0a1a0d', border:'2px solid #2d4a32',
                  borderTop:'none', borderRadius:'0 0 14px 14px', zIndex:50, overflow:'hidden' }}>
                  {resultadosBusca.map(ing => (
                    <div key={ing.id} onClick={() => { setEncontrado(ing); setBusca('') }}
                      style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                        padding:'12px 20px', cursor:'pointer', borderBottom:'1px solid #1e3a24',
                        background: ing.validado ? 'rgba(231,76,60,.05)' : 'transparent' }}>
                      <div>
                        <div style={{ fontSize:16, fontWeight:700, color:'#f0f0f0' }}>{ing.nome}</div>
                        <div style={{ fontSize:12, color:'#888' }}>{ing.tipo || '—'} · ID #{ing.id}</div>
                      </div>
                      <span style={{ fontSize:13, fontWeight:700, color: ing.validado ? '#e74c3c' : '#5FB335' }}>
                        {ing.validado ? '⛔ Validado' : '✅ Disponível'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>

          {/* Histórico */}
          <div style={{ background:'#0f1f13', border:'1px solid #1e3a24', borderRadius:14, padding:'20px 24px', flex:1 }}>
            {/* Tabs histórico */}
            <div style={{ display:'flex', gap:0, marginBottom:16, borderBottom:'1px solid #1e3a24', flexWrap:'wrap' }}>
              {[
                { k:'sessao', l:`Sessão (${ultimosValidados.length})` },
                { k:'hoje', l:`Hoje (${validadosHoje})` },
                { k:'todos', l:`Todos (${total})` }
              ].map(t => (
                <button key={t.k} onClick={() => setHistTab(t.k)} style={{
                  padding:'8px 18px', background:'none', border:'none', color: histTab === t.k ? '#5FB335' : '#555',
                  cursor:'pointer', fontWeight:700, fontSize:13,
                  borderBottom: histTab === t.k ? '2px solid #5FB335' : '2px solid transparent',
                }}>{t.l}</button>
              ))}
            </div>

            {histTab === 'sessao' && (
              ultimosValidados.length === 0 ? (
                <div style={{ color:'#3a5a40', fontSize:16, textAlign:'center', marginTop:20 }}>
                  Nenhuma entrada validada nesta sessão
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8, overflowY:'auto', maxHeight:380 }}>
                  {ultimosValidados.map((ing, idx) => (
                    <div key={`${ing.id}-${idx}`} onClick={() => setEncontrado(ing)} style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      background:'#0a1a0d', borderRadius:10, padding:'12px 18px',
                      borderLeft:'4px solid #5FB335', cursor:'pointer', animation:'fadeSlide .25s ease',
                    }}>
                      <div>
                        <div style={{ fontSize:18, fontWeight:800, color:'#f0f0f0' }}>{ing.nome}</div>
                        <div style={{ fontSize:13, color:'#888', marginTop:2 }}>{ing.tipo || '—'}</div>
                      </div>
                      <div style={{ fontSize:13, color:'#5FB335', fontWeight:600 }}>
                        ✔ {new Date(ing.validadoEm).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {histTab === 'hoje' && (
              validadosHojeList.length === 0 ? (
                <div style={{ color:'#3a5a40', fontSize:16, textAlign:'center', marginTop:20 }}>
                  Nenhuma entrada validada hoje
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:6, overflowY:'auto', maxHeight:380 }}>
                  {validadosHojeList.map((ing, idx) => (
                    <div key={`h-${ing.id}-${idx}`} onClick={() => setEncontrado(ing)} style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      background:'#0a1a0d', borderRadius:10, padding:'10px 16px',
                      borderLeft:'4px solid #C9A656', cursor:'pointer',
                    }}>
                      <div>
                        <div style={{ fontSize:16, fontWeight:700, color:'#f0f0f0' }}>{ing.nome}</div>
                        <div style={{ fontSize:12, color:'#888' }}>{ing.tipo || '—'}</div>
                      </div>
                      <div style={{ fontSize:12, color:'#C9A656' }}>
                        {new Date(ing.validadoEm).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {histTab === 'todos' && (
              <>
                {/* Filtro por tipo */}
                <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
                  {tipos.map(t => (
                    <button key={t} onClick={() => setFiltroTipo(t)} style={{
                      padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer',
                      background: filtroTipo===t ? '#5FB335' : '#1e3a24',
                      color: filtroTipo===t ? '#000' : '#888', border:'none',
                    }}>{t === 'todos' ? `Todos (${ingressos.length})` : t}</button>
                  ))}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, overflowY:'auto', maxHeight:340 }}>
                  {todosFiltrados.length === 0 ? (
                    <div style={{ color:'#3a5a40', textAlign:'center', padding:20 }}>Nenhum ingresso.</div>
                  ) : todosFiltrados.map(ing => (
                    <div key={ing.id} onClick={() => setEncontrado(ing)} style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      background: ing.validado ? 'rgba(95,179,53,.05)' : '#0a1a0d', borderRadius:10, padding:'10px 16px',
                      borderLeft:`4px solid ${ing.validado ? '#5FB335' : '#1e3a24'}`, cursor:'pointer',
                    }}>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:'#f0f0f0' }}>{ing.nome}</div>
                        <div style={{ fontSize:11, color:'#888' }}>{ing.tipo || '—'} · #{ing.id}</div>
                      </div>
                      <span style={{ fontSize:12, fontWeight:700, color: ing.validado ? '#5FB335' : '#555' }}>
                        {ing.validado ? '✔ Validado' : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
