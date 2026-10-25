import React, { useState, useEffect, useRef } from 'react'

/** Síntese de áudio Web Audio API (sem dependências externas) */
function playClickSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(600, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.04)
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.04)
  } catch {}
}

function playWinSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notas = [523.25, 659.25, 783.99, 1046.50] // Dó Maior
    notas.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1)
      gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.1)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.35)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + idx * 0.1)
      osc.stop(ctx.currentTime + idx * 0.1 + 0.35)
    })
  } catch {}
}

export function DinoRoletaModal({
  open,
  onClose,
  giro,
  premios = [],
  onGiroConcluido,
}) {
  const [girando, setGirando] = useState(false)
  const [anguloAtual, setAnguloAtual] = useState(0)
  const [premioSorteado, setPremioSorteado] = useState(null)
  const [premioManual, setPremioManual] = useState('')
  const [modoManual, setModoManual] = useState(false)
  const animationRef = useRef(null)

  const premiosAtivos = premios.filter((p) => p.ativo !== false)
  const totalFatias = Math.max(1, premiosAtivos.length)
  const anguloPorFatia = 360 / totalFatias

  useEffect(() => {
    if (open) {
      setPremioSorteado(null)
      setGirando(false)
      setModoManual(false)
      setPremioManual('')
    }
  }, [open, giro])

  function iniciarGiro() {
    if (girando || !premiosAtivos.length) return
    setGirando(true)
    setPremioSorteado(null)

    // Sorteio ponderado pelo peso da fatia
    const pesoTotal = premiosAtivos.reduce((soma, p) => soma + (Number(p.peso) || 10), 0)
    let rand = Math.random() * pesoTotal
    let indiceEscolhido = 0
    for (let i = 0; i < premiosAtivos.length; i++) {
      rand -= Number(premiosAtivos[i].peso) || 10
      if (rand <= 0) {
        indiceEscolhido = i
        break
      }
    }

    const escolhido = premiosAtivos[indiceEscolhido]

    // Calcula o ângulo alvo de parada
    // O ponteiro fica no topo (270 graus ou 90 graus no SVG standard).
    // Para que a fatia fique no topo: anguloAlvo = 360 * voltas + compensacao
    const voltas = 6 + Math.floor(Math.random() * 3) // 6 a 8 voltas
    const centroFatia = indiceEscolhido * anguloPorFatia + anguloPorFatia / 2
    // Ajuste para ponteiro no topo (90 graus de offset visual)
    const anguloFinal = (voltas * 360) + (360 - centroFatia) + 90

    const duracaoMs = 4500
    const inicioTempo = performance.now()
    const anguloOrigem = anguloAtual % 360

    let ultimoTick = 0

    function animar(agora) {
      const decorrido = agora - inicioTempo
      const progresso = Math.min(1, decorrido / duracaoMs)

      // Easing cúbico desacelerado (easeOutCubic)
      const easeOut = 1 - Math.pow(1 - progresso, 3)
      const anguloCorrente = anguloOrigem + (anguloFinal - anguloOrigem) * easeOut

      setAnguloAtual(anguloCorrente)

      // Toca som de click a cada passagem de pino
      if (anguloCorrente - ultimoTick > anguloPorFatia / 2) {
        playClickSound()
        ultimoTick = anguloCorrente
      }

      if (progresso < 1) {
        animationRef.current = requestAnimationFrame(animar)
      } else {
        setGirando(false)
        setPremioSorteado(escolhido)
        playWinSound()
        if (onGiroConcluido) {
          onGiroConcluido({
            giroId: giro?.id,
            premioNome: escolhido.nome,
            premioId: escolhido.id,
          })
        }
      }
    }

    animationRef.current = requestAnimationFrame(animar)
  }

  function confirmarManual() {
    const nome = premioManual.trim()
    if (!nome) return
    const escolhido = premiosAtivos.find((p) => p.nome === nome) || { nome, id: 'manual' }
    setPremioSorteado(escolhido)
    playWinSound()
    if (onGiroConcluido) {
      onGiroConcluido({
        giroId: giro?.id,
        premioNome: escolhido.nome,
        premioId: escolhido.id,
      })
    }
  }

  if (!open) return null

  return (
    <div className="dino-roleta-modal-backdrop" onClick={!girando ? onClose : undefined}>
      <div className="dino-roleta-modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="dino-roleta-header">
          <div>
            <span className="dino-roleta-badge">🎡 Roleta de Premiações Dino</span>
            <h2>{`Giro da Sorte de ${giro?.profissionalNome || 'Profissional'}`}</h2>
            <p className="dino-roleta-motivo">{giro?.motivo || 'Meta Diária ou Desafio Semanal atingido!'}</p>
          </div>
          {!girando && (
            <button type="button" className="dino-roleta-close-btn" onClick={onClose} title="Fechar">
              ✕
            </button>
          )}
        </header>

        <div className="dino-roleta-body">
          {/* Seção da Roleta Visual */}
          <div className="dino-roleta-stage">
            {/* Ponteiro no Topo */}
            <div className="dino-roleta-pointer" />

            {/* Roda Giratória SVG */}
            <div
              className="dino-roleta-wheel-wrap"
              style={{
                transform: `rotate(${anguloAtual}deg)`,
                transition: girando ? 'none' : 'transform 0.3s ease-out',
              }}
            >
              <svg viewBox="0 0 400 400" className="dino-roleta-svg">
                <defs>
                  <filter id="roleta-shadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.35" />
                  </filter>
                </defs>
                <circle cx="200" cy="200" r="195" fill="#1e293b" stroke="#f59e0b" strokeWidth="8" />

                {premiosAtivos.map((premio, idx) => {
                  const inicioAngulo = idx * anguloPorFatia
                  const fimAngulo = (idx + 1) * anguloPorFatia

                  const radIni = (inicioAngulo * Math.PI) / 180
                  const radFim = (fimAngulo * Math.PI) / 180

                  const x1 = 200 + 190 * Math.cos(radIni)
                  const y1 = 200 + 190 * Math.sin(radIni)
                  const x2 = 200 + 190 * Math.cos(radFim)
                  const y2 = 200 + 190 * Math.sin(radFim)

                  const pathD = `M 200 200 L ${x1} ${y1} A 190 190 0 0 1 ${x2} ${y2} Z`

                  // Posição do texto no meio da fatia
                  const meioRad = ((inicioAngulo + fimAngulo) / 2 * Math.PI) / 180
                  const textoX = 200 + 120 * Math.cos(meioRad)
                  const textoY = 200 + 120 * Math.sin(meioRad)
                  const rotTexto = (inicioAngulo + fimAngulo) / 2

                  return (
                    <g key={premio.id || idx}>
                      <path d={pathD} fill={premio.cor || '#10b981'} stroke="#0f172a" strokeWidth="2" />
                      {/* Pinos decorativos na borda */}
                      <circle cx={x1} cy={y1} r="4" fill="#ffffff" />
                      <g transform={`translate(${textoX}, ${textoY}) rotate(${rotTexto + 90})`}>
                        <text
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="11"
                          fontWeight="700"
                          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                        >
                          <tspan x="0" dy="-8">{premio.icone || '🎁'}</tspan>
                          <tspan x="0" dy="14">{premio.nome.slice(0, 16)}</tspan>
                        </text>
                      </g>
                    </g>
                  )
                })}

                {/* Centro da Roleta */}
                <circle cx="200" cy="200" r="38" fill="#0f172a" stroke="#f59e0b" strokeWidth="4" />
                <circle cx="200" cy="200" r="18" fill="#f59e0b" />
              </svg>
            </div>

            {/* Botão Central de Girar */}
            {!premioSorteado && !girando && (
              <button
                type="button"
                className="dino-roleta-center-spin-btn"
                onClick={iniciarGiro}
                disabled={girando}
              >
                GIRAR!
              </button>
            )}
          </div>

          {/* Resultado / Celebração */}
          {premioSorteado && (
            <div className="dino-roleta-winner-box">
              <div className="dino-roleta-winner-emoji">{premioSorteado.icone || '🎉'}</div>
              <h3>Parabéns, {giro?.profissionalNome}!</h3>
              <div className="dino-roleta-winner-prize">{premioSorteado.nome}</div>
              <p className="dino-roleta-winner-sub">
                O prêmio foi registrado no sistema e aguarda confirmação de entrega do gestor.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: 12, width: '100%' }}
                onClick={onClose}
              >
                Concluir e Voltar
              </button>
            </div>
          )}

          {/* Opção Alternativa: Registrar Giro Físico Manual */}
          {!girando && !premioSorteado && (
            <div className="dino-roleta-manual-toggle">
              {!modoManual ? (
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setModoManual(true)}
                  style={{ fontSize: 12 }}
                >
                  Gira na roleta física do salão? Registrar prêmio manualmente →
                </button>
              ) : (
                <div className="dino-roleta-manual-form">
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Selecione o prêmio sorteado na roleta física:</label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <select
                      className="form-control"
                      value={premioManual}
                      onChange={(e) => setPremioManual(e.target.value)}
                    >
                      <option value="">Selecione o prêmio...</option>
                      {premiosAtivos.map((p) => (
                        <option key={p.id} value={p.nome}>
                          {p.icone} {p.nome}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={confirmarManual}
                      disabled={!premioManual}
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setModoManual(false)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
