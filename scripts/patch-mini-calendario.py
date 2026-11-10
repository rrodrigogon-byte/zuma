with open('web/src/pages/admin/BarbeariaAgendaBoard.jsx', 'r', encoding='utf8') as f:
    code = f.read()

# 1. Adicionar estado do mes de visualizacao do mini calendario
target_state = "  const [menuDataAberto, setMenuDataAberto] = useState(false)"
replacement_state = """  const [menuDataAberto, setMenuDataAberto] = useState(false)
  const [mesAnoView, setMesAnoView] = useState(() => {
    const d = new Date(data + 'T12:00:00')
    return { ano: d.getFullYear(), mes: d.getMonth() }
  })

  // Sincroniza mês de visualização ao mudar a data da agenda
  useEffect(() => {
    if (data) {
      const d = new Date(data + 'T12:00:00')
      if (!isNaN(d.getTime())) {
        setMesAnoView({ ano: d.getFullYear(), mes: d.getMonth() })
      }
    }
  }, [data])"""

code = code.replace(target_state, replacement_state, 1)

# 2. Localizar o bloco do botão Hoje e substituir pela versão com mini calendário popup
target_botoes = """            <button type="button" onClick={() => onDateChange(dataComDeslocamento(data, -1))} style={styles.navButton} aria-label="Dia anterior">‹</button>
            <button
              type="button"
              onClick={() => onDateChange(hojeAgenda())}
              style={{
                ...styles.todayButton,
                background: isHoje ? '#FF6B2C' : 'var(--card)',
                color: isHoje ? '#fff' : 'var(--fg)',
                borderColor: isHoje ? '#FF6B2C' : 'var(--line)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
              title="Voltar para a data de hoje"
            >
              <span>📅</span> Hoje
            </button>
            <button type="button" onClick={() => onDateChange(dataComDeslocamento(data, 1))} style={styles.navButton} aria-label="Próximo dia">›</button>"""

replacement_botoes = """            <button type="button" onClick={() => onDateChange(dataComDeslocamento(data, -1))} style={styles.navButton} aria-label="Dia anterior">‹</button>
            <div style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
              <button
                type="button"
                onClick={() => onDateChange(hojeAgenda())}
                style={{
                  ...styles.todayButton,
                  background: isHoje ? '#FF6B2C' : 'var(--card)',
                  color: isHoje ? '#fff' : 'var(--fg)',
                  borderColor: isHoje ? '#FF6B2C' : 'var(--line)',
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  paddingRight: 8
                }}
                title="Ir para a data de hoje"
              >
                <span>📅</span> Hoje
              </button>
              <button
                type="button"
                onClick={() => setMenuDataAberto((prev) => !prev)}
                style={{
                  ...styles.todayButton,
                  background: menuDataAberto ? 'var(--line)' : isHoje ? '#FF6B2C' : 'var(--card)',
                  color: isHoje && !menuDataAberto ? '#fff' : 'var(--fg)',
                  borderColor: isHoje ? '#FF6B2C' : 'var(--line)',
                  borderLeft: '1px solid rgba(255,255,255,0.25)',
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                  padding: '6px 8px',
                  cursor: 'pointer'
                }}
                title="Abrir mini calendário mensal"
                aria-label="Abrir mini calendário mensal"
              >
                <span style={{ fontSize: 10 }}>▼</span>
              </button>

              {/* Mini Calendário Pop-up */}
              {menuDataAberto && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    zIndex: 1050,
                    background: 'var(--card, #1c1d22)',
                    color: 'var(--fg, #f3f4f6)',
                    border: '1px solid var(--line, rgba(255,255,255,0.12))',
                    borderRadius: 14,
                    boxShadow: '0 20px 30px -10px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                    padding: 16,
                    width: 290,
                    animation: 'fadeIn 0.15s ease-out'
                  }}
                >
                  {/* Cabeçalho do mês com navegação */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <button
                      type="button"
                      onClick={() => setMesAnoView((prev) => {
                        const novoMes = prev.mes === 0 ? 11 : prev.mes - 1
                        const novoAno = prev.mes === 0 ? prev.ano - 1 : prev.ano
                        return { ano: novoAno, mes: novoMes }
                      })}
                      style={{ ...styles.navButton, width: 28, height: 28, fontSize: 14 }}
                      title="Mês anterior"
                    >
                      ‹
                    </button>
                    <span style={{ fontWeight: 800, fontSize: 14, textTransform: 'capitalize' }}>
                      {new Date(mesAnoView.ano, mesAnoView.mes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMesAnoView((prev) => {
                        const novoMes = prev.mes === 11 ? 0 : prev.mes + 1
                        const novoAno = prev.mes === 11 ? prev.ano + 1 : prev.ano
                        return { ano: novoAno, mes: novoMes }
                      })}
                      style={{ ...styles.navButton, width: 28, height: 28, fontSize: 14 }}
                      title="Próximo mês"
                    >
                      ›
                    </button>
                  </div>

                  {/* Dias da semana */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--muted, #9ca3af)', marginBottom: 6 }}>
                    <span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>
                  </div>

                  {/* Grade de dias do mês */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
                    {(() => {
                      const primeiroDiaSemana = new Date(mesAnoView.ano, mesAnoView.mes, 1).getDay()
                      const totalDiasMes = new Date(mesAnoView.ano, mesAnoView.mes + 1, 0).getDate()
                      const totalDiasMesAnterior = new Date(mesAnoView.ano, mesAnoView.mes, 0).getDate()
                      const elementos = []

                      // Dias do mês anterior
                      for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
                        const dia = totalDiasMesAnterior - i
                        elementos.push(
                          <div key={`ant-${dia}`} style={{ padding: '6px 0', fontSize: 12, color: 'var(--muted, #6b7280)', opacity: 0.35 }}>
                            {dia}
                          </div>
                        )
                      }

                      // Dias do mês atual
                      for (let dia = 1; dia <= totalDiasMes; dia++) {
                        const diaFormatado = String(dia).padStart(2, '0')
                        const mesFormatado = String(mesAnoView.mes + 1).padStart(2, '0')
                        const isoStr = `${mesAnoView.ano}-${mesFormatado}-${diaFormatado}`
                        const ehDataAtiva = isoStr === data
                        const ehHoje = isoStr === hojeAgenda()

                        elementos.push(
                          <button
                            key={isoStr}
                            type="button"
                            onClick={() => {
                              onDateChange(isoStr)
                              setMenuDataAberto(false)
                            }}
                            style={{
                              padding: '6px 0',
                              fontSize: 12,
                              fontWeight: ehDataAtiva || ehHoje ? 800 : 500,
                              background: ehDataAtiva ? '#FF6B2C' : ehHoje ? 'rgba(255, 107, 44, 0.15)' : 'transparent',
                              color: ehDataAtiva ? '#ffffff' : ehHoje ? '#FF6B2C' : 'var(--fg, #f3f4f6)',
                              border: ehHoje && !ehDataAtiva ? '1px dashed #FF6B2C' : 'none',
                              borderRadius: 8,
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                            title={ehHoje ? 'Hoje' : ''}
                          >
                            {dia}
                          </button>
                        )
                      }
                      return elementos
                    })()}
                  </div>

                  {/* Rodapé do mini calendário */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line, rgba(255,255,255,0.08))' }}>
                    <button
                      type="button"
                      onClick={() => {
                        onDateChange(hojeAgenda())
                        setMenuDataAberto(false)
                      }}
                      style={{ fontSize: 11, fontWeight: 700, color: '#FF6B2C', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}
                    >
                      Ir para Hoje
                    </button>
                    <button
                      type="button"
                      onClick={() => setMenuDataAberto(false)}
                      style={{ fontSize: 11, color: 'var(--muted, #9ca3af)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}
                    >
                      Fechar ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button type="button" onClick={() => onDateChange(dataComDeslocamento(data, 1))} style={styles.navButton} aria-label="Próximo dia">›</button>"""

if target_botoes in code:
    code = code.replace(target_botoes, replacement_botoes, 1)
    with open('web/src/pages/admin/BarbeariaAgendaBoard.jsx', 'w', encoding='utf8') as f:
        f.write(code)
    print('Mini Calendario adicionado com sucesso!')
else:
    print('Target botoes nao encontrado')
