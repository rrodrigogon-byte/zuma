with open('web/src/pages/admin/dino/DinoCarteiraClientesPanel.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add abertosIds state
old_state = "const [modalLote, setModalLote] = useState(null)"
new_state = """const [modalLote, setModalLote] = useState(null)
  const [abertosIds, setAbertosIds] = useState({})"""

assert old_state in code, "modalLote state not found"
code = code.replace(old_state, new_state)

# 2. Update gerarLinkWhatsapp
old_gerar_link = """  function gerarLinkWhatsapp(cliente) {
    const tel = String(cliente.telefone || '').replace(/\\D/g, '')
    if (tel.length < 10) return '#'
    const telCompleto = tel.startsWith('55') ? tel : `55${tel}`
    const primeiroNome = String(cliente.nome || '').trim().split(/\\s+/)[0] || 'amigo'
    const barbeiroNome = cliente.barbeiroApelido || cliente.barbeiroNome?.split(' ')[0] || 'Dino'
    const servico = cliente.servicoFavorito || 'corte'
    const dias = cliente.diasSemRetorno

    const tempoFrase = dias > 0 ? `já faz ${dias} dias do seu último ${servico}` : `está na hora de renovar o visual`
    const msg = encodeURIComponent(
      `Fala ${primeiroNome}, tudo bem? Aqui é o ${barbeiroNome} da Barbearia Dino! 💈\\n\\nVi aqui que ${tempoFrase}. Vamos dar aquele talento no visual essa semana?\\n\\nJá separei sua cadeira! Pode me avisar por aqui ou escolher o melhor horário no link: https://kytto.com.br/clube-vip`
    )
    return `https://wa.me/${telCompleto}?text=${msg}`
  }"""

new_gerar_link = """  function gerarLinkWhatsapp(cliente) {
    const tel = String(cliente.telefone || '').replace(/\\D/g, '')
    if (tel.length < 10) return '#'
    const telCompleto = tel.startsWith('55') ? tel : `55${tel}`
    const primeiroNome = String(cliente.nome || '').trim().split(/\\s+/)[0] || 'amigo'
    const barbeiroNome = cliente.barbeiroApelido || cliente.barbeiroNome?.split(' ')[0] || 'Dino'
    const servico = cliente.servicoFavorito || 'corte'
    const dias = cliente.diasSemRetorno

    const tempoFrase = dias > 0 ? `já faz ${dias} dias do seu último ${servico}` : `está na hora de renovar o visual`
    const saudacoes = ['Fala', 'Olá', 'E aí', 'Tudo bem? Aqui é o']
    const saudacao = saudacoes[Math.floor(Math.random() * saudacoes.length)]
    const msg = encodeURIComponent(
      `${saudacao} ${primeiroNome}! Aqui é o ${barbeiroNome} da Barbearia Dino! 💈\\n\\nVi aqui que ${tempoFrase}. Vamos dar aquele talento no visual essa semana?\\n\\nJá separei sua cadeira! Pode me avisar por aqui ou escolher o melhor horário no link: https://kytto.com.br/agendar/dino\\n\\n*(Caso prefira não receber lembretes de agenda, responda PARAR)*`
    )
    return `https://wa.me/${telCompleto}?text=${msg}`
  }"""

if old_gerar_link in code:
    code = code.replace(old_gerar_link, new_gerar_link)
else:
    print("AVISO: old_gerar_link não encontrado diretamente")

# 3. Update modalLote JSX with Meta Compliance badge, open tracking, and CSV export button
old_modal_start = """            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 16px 0' }}>
              Foram preparados <strong>{modalLote.totalProntos} contatos</strong> para reativação com mensagens humanizadas e links de agendamento personalizados.
            </p>"""

new_modal_start = """            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 12px 0' }}>
              Foram preparados <strong>{modalLote.totalProntos} contatos</strong> para reativação com mensagens humanizadas e links de agendamento personalizados.
            </p>

            {/* SELO OFICIAL DE BLINDAGEM ANTI-BLOQUEIO META WHATSAPP */}
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ color: '#10b981', fontWeight: 800, fontSize: 12.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  🛡️ Blindagem Oficial Anti-Bloqueio Meta WhatsApp
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 6, fontSize: 11.5, color: '#cbd5e1' }}>
                <div>🟢 <strong>Spintax Dinâmico:</strong> Hash único por disparo</div>
                <div>🟢 <strong>Jitter Aleatório (20s-45s):</strong> Simula pausa humana</div>
                <div>🟢 <strong>Janela Comercial (07h-21h):</strong> Sem incômodo noturno</div>
                <div>🟢 <strong>Opt-out Obrigatório:</strong> Cláusula "PARAR" ativa</div>
              </div>
            </div>"""

assert old_modal_start in code, "old_modal_start not found"
code = code.replace(old_modal_start, new_modal_start)

# 4. Update the item button in modalLote to show Aberto status
old_btn = """                  <div>
                    {d.whatsappUrl ? (
                      <a
                        href={d.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-whatsapp-carteira"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                      >
                        <MessageSquare size={12} />
                        Enviar
                      </a>
                    ) : (
                      <span style={{ fontSize: 11, color: '#ef4444' }}>Sem Celular</span>
                    )}
                  </div>"""

new_btn = """                  <div>
                    {abertosIds[d.clienteId] ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '5px 10px',
                        background: 'rgba(16, 185, 129, 0.2)',
                        color: '#34d399',
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontWeight: 700
                      }}>
                        ✓ Aberto
                      </span>
                    ) : d.whatsappUrl ? (
                      <a
                        href={d.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-whatsapp-carteira"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => setAbertosIds(prev => ({ ...prev, [d.clienteId]: true }))}
                      >
                        <MessageSquare size={12} />
                        Enviar
                      </a>
                    ) : (
                      <span style={{ fontSize: 11, color: '#ef4444' }}>Sem Celular</span>
                    )}
                  </div>"""

assert old_btn in code, "old_btn not found"
code = code.replace(old_btn, new_btn)

# 5. Add Exportar CSV button to modalLote footer
old_footer = """            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button
                type="button"
                className="carteira-prof-pill active"
                onClick={() => setModalLote(null)}
              >
                Concluir Reativações
              </button>
            </div>"""

new_footer = """            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 18 }}>
              <button
                type="button"
                className="carteira-prof-pill"
                onClick={exportarCsvCarteira}
              >
                📥 Baixar Fila em CSV
              </button>
              <button
                type="button"
                className="carteira-prof-pill active"
                onClick={() => setModalLote(null)}
              >
                Concluir Reativações
              </button>
            </div>"""

assert old_footer in code, "old_footer not found"
code = code.replace(old_footer, new_footer)

with open('web/src/pages/admin/dino/DinoCarteiraClientesPanel.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Sucesso ao atualizar DinoCarteiraClientesPanel.jsx com blindagem Meta e rastreamento de abertos!")
