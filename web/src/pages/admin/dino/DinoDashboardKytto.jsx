import React, { useState } from 'react'
import { useAuth } from '../../../lib/auth'

export default function DinoDashboardKytto() {
  const { user } = useAuth()
  
  // Acesso restrito a admin da loja
  const isAdmin = ['admin', 'organizador', 'gerente'].includes(String(user?.role || '').toLowerCase())
  
  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
        Acesso restrito. Apenas administradores e gerentes da loja podem acessar o painel de gestão.
      </div>
    )
  }

  const [abaAtiva, setAbaAtiva] = useState('painel')

  return (
    <div style={{ padding: '0 0 40px', maxWidth: 1200, margin: '0 auto', fontFamily: 'var(--font-sans, sans-serif)' }}>
      {/* Abas Superiores */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, borderBottom: '1px solid var(--line, #e2e8f0)' }}>
        <button 
          style={abaAtiva === 'painel' ? styles.tabAtiva : styles.tabInativa}
          onClick={() => setAbaAtiva('painel')}
        >
          Painel de gestão
        </button>
        <button 
          style={abaAtiva === 'comparativo' ? styles.tabAtiva : styles.tabInativa}
          onClick={() => setAbaAtiva('comparativo')}
        >
          Comparativo de períodos
        </button>
      </div>

      {abaAtiva === 'painel' && <VisaoPainelGestao />}
      {abaAtiva === 'comparativo' && <VisaoComparativo />}
    </div>
  )
}

function VisaoPainelGestao() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
      {/* Esquerda */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: '0 0 5px', fontSize: 24, fontWeight: 800 }}>Painel de gestão</h1>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              29/10/2026 • 10:00 &nbsp; <span style={{ color: '#10b981' }}>● Atualização em tempo real</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <select style={styles.input}><option>Hoje</option></select>
            <button style={{ ...styles.btnPrimary, background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }}>🎯 Editar meta</button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 15 }}>
          <KpiBox title="Meta do dia" value="R$ 3.000" icon="🎯" color="#f59e0b" />
          <KpiBox title="Realizado" value="R$ 1.200" icon="📊" color="#10b981" />
          <KpiBox title="Falta para a meta" value="R$ 1.800 • 60%" icon="📈" color="#f97316" />
          <KpiBox title="Atendimentos concluídos" value="12" icon="👥" color="#3b82f6" />
        </div>

        {/* Gráfico Principal */}
        <div style={styles.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Donut Chart (Mock) */}
            <div style={{ width: 140, height: 140, borderRadius: '50%', background: 'conic-gradient(#10b981 40%, #e2e8f0 40%)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ width: 110, height: 110, borderRadius: '50%', background: 'var(--card, #fff)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <strong style={{ fontSize: 24, fontWeight: 800 }}>40%</strong>
                <span style={{ fontSize: 11, textAlign: 'center', color: 'var(--muted)' }}>da meta atingida</span>
              </div>
            </div>

            {/* Line Chart Area (Mock) */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10, fontWeight: 600 }}>
                <span>Faturamento ao longo do dia</span>
                <div style={{ display: 'flex', gap: 15, fontWeight: 400, color: 'var(--muted)' }}>
                  <span style={{ color: '#10b981' }}>● Realizado</span>
                  <span style={{ color: '#3b82f6' }}>--- Projeção</span>
                  <span style={{ color: '#f59e0b' }}>--- Meta do dia</span>
                </div>
              </div>
              <div style={{ height: 100, borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', position: 'relative' }}>
                {/* Eixo Y */}
                <div style={{ position: 'absolute', left: -40, top: 0, fontSize: 11, color: '#94a3b8' }}>3.000</div>
                <div style={{ position: 'absolute', left: -40, top: 40, fontSize: 11, color: '#94a3b8' }}>1.500</div>
                <div style={{ position: 'absolute', left: -15, bottom: -5, fontSize: 11, color: '#94a3b8' }}>0</div>
                
                {/* Linha Meta */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, borderTop: '2px dashed #f59e0b' }}></div>
                <div style={{ position: 'absolute', top: -10, right: 0, fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>Meta R$ 3.000</div>
                
                {/* Mock da curva verde */}
                <svg width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0 }}>
                  <path d="M 0 100 L 50 80 L 100 65 L 150 40" fill="none" stroke="#10b981" strokeWidth="3" />
                  <path d="M 0 100 L 50 80 L 100 65 L 150 40 L 150 100 Z" fill="rgba(16, 185, 129, 0.1)" />
                  <circle cx="150" cy="40" r="4" fill="#10b981" />
                  <text x="160" y="45" fill="#10b981" fontSize="12" fontWeight="700">R$ 1.200</text>
                  
                  {/* Projeção azul */}
                  <path d="M 150 40 L 250 20 L 350 0" fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" />
                  <path d="M 150 40 L 250 20 L 350 0 L 350 100 L 150 100 Z" fill="rgba(59, 130, 246, 0.05)" />
                  <circle cx="350" cy="0" r="4" fill="#3b82f6" />
                  <text x="310" y="15" fill="#3b82f6" fontSize="11">Projeção</text>
                </svg>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginTop: 5 }}>
                <span>07h</span><span>10h</span><span>13h</span><span>16h</span><span>19h</span><span>21h</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 20px', background: '#f8fafc', borderRadius: 8, marginTop: 20, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>📅</span>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Agenda restante:</div>
                <strong style={{ fontSize: 15 }}>R$ 1.400 <span style={{ fontWeight: 400, fontSize: 14 }}>previstos</span></strong>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20, color: '#f97316' }}>📊</span>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Gap estimado:</div>
                <strong style={{ fontSize: 15, color: '#f97316' }}>R$ 400</strong>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              ℹ️ Previsão sujeita a alterações.
            </div>
          </div>
        </div>

        {/* Cards Inferiores */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Produção por categoria */}
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Produção do dia por categoria</h3>
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                <span style={{ padding: '4px 10px', fontSize: 11, background: '#0f172a', color: '#fff' }}>Valor (R$)</span>
                <span style={{ padding: '4px 10px', fontSize: 11, color: 'var(--muted)' }}>Quantidade</span>
              </div>
            </div>
            
            <div style={{ display: 'grid', gap: 12 }}>
              <BarRow label="Cabelo" value="R$ 450" pct="70%" color="#10b981" />
              <BarRow label="Barba" value="R$ 300" pct="50%" color="#10b981" />
              <BarRow label="Serviços extras" value="R$ 200" pct="40%" color="#10b981" />
              <BarRow label="Produtos" value="R$ 250" pct="45%" color="#10b981" />
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Extras: hidratação, peeling e limpeza de pele</div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: 12, borderRadius: 8, marginTop: 15 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
                  <span>📦</span> Pacotes vendidos: 2 • R$ 720
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Separados do realizado para evitar duplicidade</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Total realizado</div>
                <strong style={{ fontSize: 20, color: '#10b981' }}>R$ 1.200</strong>
              </div>
            </div>
          </div>

          {/* Ranking */}
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>🏆 Ranking de produção • Hoje</h3>
            </div>
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 6, overflow: 'hidden', marginBottom: 15 }}>
              <span style={{ flex: 1, textAlign: 'center', padding: '6px 0', fontSize: 12, background: '#0f172a', color: '#fff', fontWeight: 600 }}>Faturamento</span>
              <span style={{ flex: 1, textAlign: 'center', padding: '6px 0', fontSize: 12, color: 'var(--muted)' }}>Extras</span>
              <span style={{ flex: 1, textAlign: 'center', padding: '6px 0', fontSize: 12, color: 'var(--muted)' }}>Produtos</span>
            </div>
            
            <div style={{ display: 'grid', gap: 10 }}>
              <RankingRow pos={1} name="Bruno" value="R$ 500" pct="50%" selected />
              <RankingRow pos={2} name="Nath" value="R$ 400" pct="40%" />
              <RankingRow pos={3} name="David" value="R$ 200" pct="40%" />
              <RankingRow pos={4} name="Victor" value="R$ 100" pct="20%" />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 15 }}>
              <span>Ranking por faturamento realizado</span>
              <span>Clique para ver os detalhes ao lado</span>
            </div>
          </div>
        </div>

        {/* Dicas de Ação */}
        <div style={{ ...styles.card, background: '#fffbeb', borderColor: '#fde68a', display: 'flex', alignItems: 'center', padding: '15px 20px', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, color: '#92400e' }}>
              💡 Como buscar a meta hoje
            </strong>
            <span style={{ fontSize: 13, color: '#b45309' }}>Com a agenda prevista, faltam <strong>R$ 400</strong>.</span>
          </div>
          <div style={{ display: 'flex', gap: 15 }}>
            <ActionBtn icon="📅" label="Preencher horários" />
            <ActionBtn icon="➕" label="Oferecer extras" />
            <ActionBtn icon="🛒" label="Sugerir produtos" />
          </div>
        </div>
        
        {/* Alertas */}
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 15px', borderRadius: 8, fontSize: 13, color: '#991b1b', display: 'flex', gap: 10, alignItems: 'center' }}>
          <strong>⚠️ Agenda:</strong>
          <span><strong style={{ color: '#b91c1c' }}>Bruno</strong> • 1 cancelamento às 11:00</span>
          <span style={{ color: '#fca5a5' }}>|</span>
          <span><strong style={{ color: '#b91c1c' }}>David</strong> • atraso de 15 min</span>
        </div>

      </div>

      {/* Direita - Side Panel Profissional */}
      <div style={{ ...styles.card, alignSelf: 'start', position: 'sticky', top: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Bruno</h2>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Detalhes do profissional<br/>Hoje • atualizado às 10:00</div>
          </div>
          <button style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', marginBottom: 20 }}>
          <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderBottom: '2px solid #f59e0b', fontWeight: 700, color: '#f59e0b' }}>Produção</div>
          <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', color: 'var(--muted)' }}>Agenda</div>
        </div>

        <div style={{ background: '#f8fafc', padding: 15, borderRadius: 10, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Total realizado hoje</span>
            <strong style={{ color: '#10b981', fontSize: 18 }}>50%</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <strong style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>R$ 500</strong>
            <div style={{ textAlign: 'right' }}>
              <div style={{ width: 100, height: 6, background: '#e2e8f0', borderRadius: 3, marginBottom: 4, overflow: 'hidden' }}>
                <div style={{ width: '50%', height: '100%', background: '#10b981' }}></div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Meta individual: R$ 1.000</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20, color: '#f59e0b' }}>✂️</span>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Serviços</div>
              <strong style={{ fontSize: 16 }}>R$ 400</strong>
            </div>
          </div>
          <div style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20, color: '#f59e0b' }}>🧴</span>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Produtos</div>
              <strong style={{ fontSize: 16 }}>R$ 100</strong>
            </div>
          </div>
        </div>

        <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>Produção por categoria</h4>
        <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
          <CatRow label="Corte" value="R$ 200" pct="60%" />
          <CatRow label="Barba" value="R$ 100" pct="30%" />
          <CatRow label="Produtos" value="R$ 100" pct="40%" />
          <CatRow label="Serviços extras" value="R$ 100" pct="30%" />
        </div>

        <div style={{ background: '#fffbeb', borderRadius: 8, padding: 15, marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 10px', fontSize: 14, color: '#92400e' }}>Detalhamento dos extras</h4>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid #fde68a' }}>
                <th style={{ paddingBottom: 5, fontWeight: 400 }}>Serviço</th>
                <th style={{ paddingBottom: 5, fontWeight: 400 }}>Qtd.</th>
                <th style={{ paddingBottom: 5, fontWeight: 400, textAlign: 'right' }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{ padding: '6px 0' }}>Selagem</td><td>1</td><td style={{ textAlign: 'right', fontWeight: 600 }}>R$ 50</td></tr>
              <tr><td style={{ padding: '6px 0' }}>Hidratação</td><td>1</td><td style={{ textAlign: 'right', fontWeight: 600 }}>R$ 30</td></tr>
              <tr><td style={{ padding: '6px 0' }}>Limpeza de pele</td><td>1</td><td style={{ textAlign: 'right', fontWeight: 600 }}>R$ 20</td></tr>
            </tbody>
          </table>
          <div style={{ textAlign: 'right', marginTop: 10, fontSize: 13, fontWeight: 700 }}>3 extras • R$ 100</div>
        </div>

        <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>Agenda de hoje</h4>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 15px', fontSize: 13, display: 'grid', gap: 8 }}>
          <li style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span>✅</span> <strong>4</strong> atendimentos concluídos</li>
          <li style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span>🕒</span> <strong>3</strong> próximos atendimentos</li>
          <li style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#dc2626' }}><span>❌</span> <strong>1</strong> cancelamento</li>
          <li style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#10b981' }}><span>✔️</span> Pontualidade: em dia</li>
        </ul>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fdf4ff', padding: '10px 15px', borderRadius: 8, border: '1px solid #fbcfe8' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#86198f', fontWeight: 600 }}>
            <span>📅</span> Horário disponível às 11:00
          </div>
          <button style={{ background: '#a21caf', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Ver na agenda</button>
        </div>
        
        <div style={{ textAlign: 'right', marginTop: 20, fontSize: 10, color: '#cbd5e1' }}>Protótipo visual • Dados ilustrativos</div>
      </div>
    </div>
  )
}

function VisaoComparativo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: '0 0 5px', fontSize: 24, fontWeight: 800, color: '#1e3a8a' }}>Comparativo de períodos</h1>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>Analise o desempenho em diferentes períodos da sua barbearia</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={styles.btnSecondary}>Hoje</button>
          <button style={styles.btnSecondary}>Semana</button>
          <button style={styles.btnSecondary}>Mês</button>
          <button style={{ ...styles.btnPrimary, background: '#fffbeb', color: '#b45309', borderColor: '#fcd34d' }}>Personalizado</button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 15, background: '#fff', padding: 15, borderRadius: 12, border: '1px solid var(--line)', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, fontWeight: 600 }}>Período A:</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line)', padding: '8px 12px', borderRadius: 8 }}>
            <span>📅</span>
            <strong>01/10/2026 - 28/10/2026</strong>
            <span style={{ marginLeft: 'auto' }}>▼</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, fontWeight: 600 }}>Comparar com:</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line)', padding: '8px 12px', borderRadius: 8 }}>
            <span>📅</span>
            <strong>01/09/2026 - 28/09/2026</strong>
            <span style={{ marginLeft: 'auto' }}>▼</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, fontWeight: 600 }}>Equipe:</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line)', padding: '8px 12px', borderRadius: 8 }}>
            <span>👥</span>
            <strong>Toda a equipe</strong>
            <span style={{ marginLeft: 'auto' }}>▼</span>
          </div>
        </div>
        <button style={{ ...styles.btnPrimary, background: '#f59e0b', borderColor: '#f59e0b', color: '#fff', height: 40, padding: '0 20px', alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⇌</span> Aplicar comparação
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -10 }}>Comparação de períodos equivalentes • 28 dias</div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
        <CompKpi title="Faturamento" valA="R$ 60.000" valB="R$ 50.000" pct="+20%" abs="+ R$ 10.000" icon="📊" />
        <CompKpi title="Atendimentos" valA="500" valB="450" pct="+11,1%" abs="+ 50 atendimentos" icon="👥" />
        <CompKpi title="Ticket médio" valA="R$ 120" valB="R$ 111,11" pct="+8%" abs="+ R$ 8,89" icon="📈" />
        <CompKpi title="Ocupação" valA="80%" valB="70%" pct="+10 p.p." abs="" icon="🕒" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Receita por categoria */}
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 30 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Receita por categoria</h3>
            <div style={{ display: 'flex', gap: 15, fontSize: 12, fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: '#10b981', borderRadius: 2 }}></span> Outubro (01-28)</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: '#3b82f6', borderRadius: 2 }}></span> Setembro (01-28)</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: 200, paddingBottom: 25, borderBottom: '1px solid var(--line)', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, bottom: 25, top: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', borderRight: '1px solid var(--line)', paddingRight: 5 }}>
              <span>R$ 40.000</span><span>R$ 30.000</span><span>R$ 20.000</span><span>R$ 10.000</span><span>R$ 0</span>
            </div>
            <DoubleBar label="Corte" valA="30.000" valB="26.000" hA={150} hB={130} />
            <DoubleBar label="Barba" valA="15.000" valB="14.000" hA={75} hB={70} />
            <DoubleBar label="Extras" valA="6.000" valB="4.000" hA={30} hB={20} />
            <DoubleBar label="Produtos" valA="9.000" valB="6.000" hA={45} hB={30} />
          </div>
        </div>

        {/* Evolução do faturamento acumulado */}
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Evolução do faturamento acumulado</h3>
            <div style={{ display: 'flex', gap: 15, fontSize: 12, fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: '#10b981', borderRadius: 2 }}></span> Outubro (01-28)</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: '#3b82f6', borderRadius: 2 }}></span> Setembro (01-28)</span>
            </div>
          </div>
          <div style={{ height: 200, position: 'relative', borderLeft: '1px solid var(--line)', borderBottom: '1px solid var(--line)', marginLeft: 45, paddingBottom: 25 }}>
            <div style={{ position: 'absolute', left: -45, bottom: 25, top: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', width: 40, textAlign: 'right' }}>
              <span>R$ 80.000</span><span>R$ 60.000</span><span>R$ 40.000</span><span>R$ 20.000</span><span>R$ 0</span>
            </div>
            
            <svg width="100%" height="100%" preserveAspectRatio="none">
              <path d="M 0 175 L 50 150 L 100 120 L 150 90 L 200 65 L 250 40 L 300 20" fill="none" stroke="#10b981" strokeWidth="2" />
              <path d="M 0 175 L 50 160 L 100 140 L 150 120 L 200 95 L 250 70 L 300 50" fill="none" stroke="#3b82f6" strokeWidth="2" />
              
              <circle cx="300" cy="20" r="4" fill="#10b981" />
              <circle cx="300" cy="50" r="4" fill="#3b82f6" />
              
              <text x="310" y="25" fill="#10b981" fontSize="12" fontWeight="700">R$ 60.000</text>
              <text x="310" y="55" fill="#3b82f6" fontSize="12" fontWeight="700">R$ 50.000</text>
            </svg>
            
            <div style={{ position: 'absolute', bottom: -20, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)' }}>
              <span>Dia 1</span><span>Dia 7</span><span>Dia 14</span><span>Dia 21</span><span>Dia 28</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Comparativo por profissional */}
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Comparativo por profissional</h3>
            <div style={{ display: 'flex', gap: 15, fontSize: 11, fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: '#10b981', borderRadius: 2 }}></span> Outubro</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: '#3b82f6', borderRadius: 2 }}></span> Setembro</span>
            </div>
          </div>
          
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
                <th style={{ paddingBottom: 10, fontWeight: 600 }}>Profissional</th>
                <th style={{ paddingBottom: 10, fontWeight: 600 }}>Total A</th>
                <th style={{ paddingBottom: 10, fontWeight: 600 }}>Total B</th>
                <th style={{ paddingBottom: 10, fontWeight: 600 }}>Variação</th>
              </tr>
            </thead>
            <tbody>
              <ProfRow name="Bruno" valA="R$ 22.000" valB="R$ 18.000" pct="+22,2%" selected wA={100} wB={80} />
              <ProfRow name="Nath" valA="R$ 20.000" valB="R$ 17.000" pct="+17,6%" wA={90} wB={75} />
              <ProfRow name="David" valA="R$ 10.000" valB="R$ 9.000" pct="+11,1%" wA={45} wB={40} />
              <ProfRow name="Victor" valA="R$ 8.000" valB="R$ 6.000" pct="+33,3%" wA={35} wB={25} />
            </tbody>
          </table>
        </div>

        {/* Bruno Comparacao Individual */}
        <div style={{ ...styles.card, background: '#f8fafc', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Bruno • comparação individual</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...styles.btnPrimary, background: '#fef3c7', color: '#b45309', borderColor: '#fef3c7', fontSize: 11, padding: '4px 10px' }}>Faturamento</button>
              <button style={{ ...styles.btnSecondary, fontSize: 11, padding: '4px 10px', border: 'none' }}>Serviços</button>
              <button style={{ ...styles.btnSecondary, fontSize: 11, padding: '4px 10px', border: 'none' }}>Agenda</button>
            </div>
          </div>
          
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', color: 'var(--muted)', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Métrica</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#10b981', textAlign: 'center' }}>Período A<br/><small style={{fontWeight: 400}}>Outubro (01-28)</small></th>
                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#3b82f6', textAlign: 'center' }}>Período B<br/><small style={{fontWeight: 400}}>Setembro (01-28)</small></th>
                <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Variação</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}><span style={{marginRight: 8}}>📊</span> <strong>Faturamento</strong></td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', textAlign: 'center', fontWeight: 600 }}>R$ 22.000</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', textAlign: 'center' }}>R$ 18.000</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', textAlign: 'right', color: '#10b981', fontWeight: 700 }}>▲ +22,2%</td>
              </tr>
              <tr>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}><span style={{marginRight: 8}}>👥</span> Atendimentos</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', textAlign: 'center', fontWeight: 600 }}>160</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', textAlign: 'center' }}>150</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', textAlign: 'right', color: '#10b981', fontWeight: 700 }}>▲ +6,7%</td>
              </tr>
              <tr>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}><span style={{marginRight: 8}}>🧴</span> Produtos</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', textAlign: 'center', fontWeight: 600 }}>R$ 3.000</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', textAlign: 'center' }}>R$ 2.000</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', textAlign: 'right', color: '#10b981', fontWeight: 700 }}>▲ +50%</td>
              </tr>
              <tr>
                <td style={{ padding: '10px 12px' }}><span style={{marginRight: 8}}>➕</span> Extras</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>R$ 2.000</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>R$ 1.500</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#10b981', fontWeight: 700 }}>▲ +33,3%</td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: 20, marginTop: 15 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Ocupação • Bruno</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ fontSize: 11, width: 45 }}>Outubro</div>
                <div style={{ flex: 1, background: '#e2e8f0', height: 12, borderRadius: 2 }}><div style={{ width: '85%', height: '100%', background: '#10b981', borderRadius: 2 }}></div></div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>85%</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 11, width: 45 }}>Setembro</div>
                <div style={{ flex: 1, background: '#e2e8f0', height: 12, borderRadius: 2 }}><div style={{ width: '75%', height: '100%', background: '#3b82f6', borderRadius: 2 }}></div></div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>75%</div>
              </div>
            </div>
            <div style={{ flex: 1, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 24 }}>💡</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#065f46' }}>O que mudou</div>
                <div style={{ fontSize: 12, color: '#047857' }}>Produtos e extras cresceram no período selecionado.</div>
              </div>
            </div>
          </div>
          
          <div style={{ textAlign: 'right', marginTop: 15, fontSize: 10, color: '#cbd5e1' }}>Protótipo visual • Dados ilustrativos</div>
        </div>
      </div>
    </div>
  )
}

// Helpers -------------------------------------------------------------
function KpiBox({ title, value, icon, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--line, #e2e8f0)', borderRadius: 12, padding: '15px 20px', display: 'flex', alignItems: 'center', gap: 15 }}>
      <div style={{ fontSize: 24 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      </div>
    </div>
  )
}

function BarRow({ label, value, pct, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 15, fontSize: 13 }}>
      <div style={{ width: 100, fontWeight: 600 }}>{label}</div>
      <div style={{ flex: 1, height: 12, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: pct, height: '100%', background: color }}></div>
      </div>
      <div style={{ width: 60, textAlign: 'right', fontWeight: 700 }}>{value}</div>
    </div>
  )
}

function RankingRow({ pos, name, value, pct, selected }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: selected ? '#fffbeb' : 'transparent', padding: '8px 10px', borderRadius: 8, border: selected ? '1px solid #fde68a' : '1px solid transparent' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: pos === 1 ? '#f59e0b' : '#94a3b8', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
        {pos}
      </div>
      <div style={{ width: 60, fontWeight: selected ? 800 : 600, display: 'flex', alignItems: 'center', gap: 5 }}>
        {name} {pos === 1 && '👑'}
      </div>
      <div style={{ flex: 1, fontWeight: 700 }}>{value}</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 60, height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: pct, height: '100%', background: '#10b981' }}></div>
        </div>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{pct} da meta</span>
      </div>
    </div>
  )
}

function ActionBtn({ icon, label }) {
  return (
    <button style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
      <span style={{ color: '#3b82f6' }}>{icon}</span> {label}
    </button>
  )
}

function CatRow({ label, value, pct }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
      <div style={{ width: 100 }}>{label}</div>
      <div style={{ flex: 1, background: '#e2e8f0', height: 10, borderRadius: 2 }}>
        <div style={{ width: pct, height: '100%', background: '#10b981', borderRadius: 2 }}></div>
      </div>
      <div style={{ width: 60, textAlign: 'right', fontWeight: 600 }}>{value}</div>
    </div>
  )
}

function CompKpi({ title, valA, valB, pct, abs, icon }) {
  const isPos = pct.includes('+')
  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '15px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
        <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>{icon}</span> {title}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginBottom: 2 }}>Período A (Outubro)</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{valA}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, marginBottom: 2 }}>Período B (Setembro)</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{valB}</div>
        </div>
      </div>
      <div style={{ marginTop: 15, textAlign: 'center', background: isPos ? '#ecfdf5' : '#fef2f2', color: isPos ? '#059669' : '#dc2626', padding: '8px', borderRadius: 8 }}>
        <strong style={{ fontSize: 15, display: 'block' }}>{pct.includes('+') ? '▲' : '▼'} {pct}</strong>
        <span style={{ fontSize: 12 }}>{abs}</span>
      </div>
    </div>
  )
}

function DoubleBar({ label, valA, valB, hA, hB }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 160 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 700 }}>R$ {valA}</span>
          <div style={{ width: 40, height: hA, background: '#10b981', borderRadius: '4px 4px 0 0' }}></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 700 }}>R$ {valB}</span>
          <div style={{ width: 40, height: hB, background: '#3b82f6', borderRadius: '4px 4px 0 0' }}></div>
        </div>
      </div>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
    </div>
  )
}

function ProfRow({ name, valA, valB, pct, selected, wA, wB }) {
  const isPos = pct.includes('+')
  return (
    <tr style={{ background: selected ? '#fffbeb' : 'transparent' }}>
      <td style={{ padding: '12px 10px', borderBottom: '1px solid var(--line)', width: 100 }}>
        <strong style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{selected && '👑'} {name}</strong>
      </td>
      <td style={{ padding: '12px 10px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ width: '100%', maxWidth: 150 }}>
          <div style={{ width: `${wA}%`, background: '#10b981', height: 10, borderRadius: 2, marginBottom: 4 }}></div>
          <div style={{ width: `${wB}%`, background: '#3b82f6', height: 10, borderRadius: 2 }}></div>
        </div>
      </td>
      <td style={{ padding: '12px 10px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{valA}</div>
        <div style={{ fontSize: 12 }}>{valB}</div>
      </td>
      <td style={{ padding: '12px 10px', borderBottom: '1px solid var(--line)', color: isPos ? '#10b981' : '#dc2626', fontWeight: 700 }}>
        {isPos ? '▲' : '▼'} {pct}
      </td>
    </tr>
  )
}

const styles = {
  tabAtiva: {
    padding: '10px 0', border: 'none', background: 'none', fontSize: 16, fontWeight: 700,
    color: '#0f172a', borderBottom: '3px solid #f59e0b', cursor: 'pointer'
  },
  tabInativa: {
    padding: '10px 0', border: 'none', background: 'none', fontSize: 16, fontWeight: 500,
    color: 'var(--muted, #64748b)', cursor: 'pointer'
  },
  card: {
    background: '#fff', border: '1px solid var(--line, #e2e8f0)', borderRadius: 12, padding: 20
  },
  input: {
    padding: '8px 12px', border: '1px solid var(--line, #e2e8f0)', borderRadius: 8, background: '#fff', fontSize: 13
  },
  btnPrimary: {
    padding: '8px 16px', border: '1px solid transparent', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13
  },
  btnSecondary: {
    padding: '8px 16px', border: '1px solid var(--line)', borderRadius: 8, background: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13
  }
}
// Force Cache Invalidation V2
