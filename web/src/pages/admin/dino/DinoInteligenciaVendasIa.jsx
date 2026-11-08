import React, { useState, useEffect, useCallback } from 'react';
import { api, fmtR } from '../../../lib/api';

const COR = {
  verde: '#16a34a',
  verdeClaro: '#dcfce7',
  azul: '#3b82f6',
  azulClaro: '#dbeafe',
  laranja: '#f59e0b',
  laranjaClaro: '#fef3c7',
  roxo: '#8b5cf6',
  roxoClaro: '#f3e8ff',
  vermelho: '#dc2626',
  vermelhoClaro: '#fee2e2',
  dourado: '#c99a2e',
  douradoClaro: '#fdf3dc',
  card: 'var(--card, #fff)',
  line: 'var(--line, #e2e8f0)',
  fg: 'var(--fg, #0f172a)',
  muted: 'var(--muted, #64748b)',
};

export default function DinoInteligenciaVendasIa() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('reativacao');
  const [filtroPropensao, setFiltroPropensao] = useState('todos');
  const [disparando, setDisparando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState('');

  const carregarInteligencia = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await api.get('/api/admin/barbearia/inteligencia-vendas');
      setDados(res);
    } catch (e) {
      console.error('Erro ao carregar inteligência de vendas:', e);
      setErro(e.message || 'Erro ao carregar inteligência de vendas.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarInteligencia();
  }, [carregarInteligencia]);

  const dispararMensagem = async (cliente, tipo) => {
    const tel = String(cliente.telefone || '').replace(/\D/g, '');
    const texto = encodeURIComponent(cliente.mensagemIa || '');
    const urlWpp = tel ? `https://wa.me/55${tel}?text=${texto}` : null;

    if (urlWpp) {
      window.open(urlWpp, '_blank');
    }

    try {
      await api.post('/api/admin/barbearia/inteligencia-vendas/disparar-acao', {
        tipo,
        clienteId: cliente.id,
        telefone: cliente.telefone,
        mensagem: cliente.mensagemIa,
      });
      setMensagemSucesso(`Ação registrada para ${cliente.nome}! WhatsApp aberto com a mensagem da IA.`);
      setTimeout(() => setMensagemSucesso(''), 6000);
    } catch (_) {}
  };

  if (carregando) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: COR.muted, background: COR.card, borderRadius: 16 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
        <h3 style={{ margin: 0, fontWeight: 700 }}>A IA está analisando sua base e calculando as oportunidades de vendas...</h3>
        <p style={{ margin: '8px 0 0', fontSize: 14 }}>Processando histórico de agendamentos, ticket médio, churn preditivo e vagas ociosas.</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div style={{ padding: 30, background: COR.vermelhoClaro, border: `1px solid ${COR.vermelho}`, borderRadius: 14, color: COR.vermelho }}>
        <h3 style={{ margin: '0 0 8px' }}>Erro ao consultar inteligência de vendas</h3>
        <p style={{ margin: 0 }}>{erro}</p>
        <button onClick={carregarInteligencia} style={{ marginTop: 12, padding: '8px 16px', background: COR.vermelho, color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
          Tentar novamente
        </button>
      </div>
    );
  }

  const kpis = dados?.kpis || {};
  const oportunidades = dados?.oportunidades || {};
  const produtos = dados?.produtosDestaque || [];
  const simulador = dados?.simulador || {};

  const listaReativacao = (oportunidades.reativacaoAntiChurn || []).filter(c => {
    if (filtroPropensao === 'todos') return true;
    return c.propensao.toLowerCase() === filtroPropensao;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* HEADER DE INTELIGÊNCIA */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        color: '#fff',
        padding: '24px 28px',
        borderRadius: 18,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26 }}>🚀</span>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Motor de Vendas & Inteligência Comercial IA</h1>
            <span style={{
              background: '#10b981',
              color: '#fff',
              fontSize: 11,
              fontWeight: 800,
              padding: '3px 9px',
              borderRadius: 20,
              textTransform: 'uppercase',
              letterSpacing: 0.5
            }}>
              IA Ativa 24h
            </span>
          </div>
          <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: 14 }}>
            Algoritmo preditivo de aumento de faturamento: combate ao churn, venda casada (cross-sell), preenchimento de buracos de agenda e upsell de produtos.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={carregarInteligencia}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <span>🔄</span> Atualizar Oportunidades
          </button>
        </div>
      </div>

      {mensagemSucesso && (
        <div style={{
          background: COR.verdeClaro,
          color: '#065f46',
          border: `1px solid ${COR.verde}`,
          borderRadius: 12,
          padding: '12px 18px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <span>✅</span> {mensagemSucesso}
        </div>
      )}

      {/* 4 CARDS DE INDICADORES PRINCIPAIS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {/* KPI 1: TICKET MÉDIO */}
        <div style={{ background: COR.card, border: `1px solid ${COR.line}`, borderRadius: 16, padding: 20, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: COR.muted }}>TICKET MÉDIO ATUAL</span>
            <span style={{ fontSize: 18 }}>💳</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: COR.fg, marginTop: 8 }}>
            {fmtR(kpis.ticketMedioAtual || 0)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12 }}>
            <span style={{ background: COR.verdeClaro, color: COR.verde, padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>
              Meta IA: {fmtR(kpis.metaTicketMedio || 0)}
            </span>
            <span style={{ color: COR.muted }}>+{fmtR(kpis.expansaoProjetadaTicket || 0)}/atend.</span>
          </div>
        </div>

        {/* KPI 2: VENDA CASADA (CROSS-SELL) */}
        <div style={{ background: COR.card, border: `1px solid ${COR.line}`, borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: COR.muted }}>TAXA DE VENDA CASADA</span>
            <span style={{ fontSize: 18 }}>✂️🧴</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: COR.azul, marginTop: 8 }}>
            {kpis.taxaCrossSell || 0}%
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12 }}>
            <span style={{ background: COR.azulClaro, color: COR.azul, padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>
              Meta: {kpis.metaCrossSell || 55}%
            </span>
            <span style={{ color: COR.muted }}>Combos & Produtos</span>
          </div>
        </div>

        {/* KPI 3: CLIENTES EM RISCO DE CHURN */}
        <div style={{ background: COR.card, border: `1px solid ${COR.line}`, borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: COR.muted }}>EM RISCO DE CHURN</span>
            <span style={{ fontSize: 18 }}>⚠️</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: COR.vermelho, marginTop: 8 }}>
            {kpis.clientesEmRiscoChurn || 0} clientes
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12 }}>
            <span style={{ background: COR.vermelhoClaro, color: COR.vermelho, padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>
              21 a 75 dias sem vir
            </span>
            <span style={{ color: COR.muted }}>Prontos para resgate</span>
          </div>
        </div>

        {/* KPI 4: RECEITA ADICIONAL MAPEADA PELA IA */}
        <div style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%)', border: `1px solid #fde047`, borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#854d0e' }}>POTENCIAL EXTRA / MÊS</span>
            <span style={{ fontSize: 18 }}>💰</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#a16207', marginTop: 8 }}>
            +{fmtR(kpis.receitaPotencialTotal || 0)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12, color: '#854d0e', fontWeight: 600 }}>
            <span>Oportunidades identificadas na mesa</span>
          </div>
        </div>
      </div>

      {/* ABAS INTERATIVAS */}
      <div style={{ background: COR.card, border: `1px solid ${COR.line}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: `1px solid ${COR.line}`, background: '#f8fafc', padding: '6px 12px', gap: 6, overflowX: 'auto' }}>
          {[
            { id: 'reativacao', label: '🎯 Reativação Anti-Churn', badge: kpis.clientesEmRiscoChurn },
            { id: 'buracos', label: '⚡ Preencher Vagas da Semana', badge: oportunidades.vagasOciosasSemana?.length },
            { id: 'upsell', label: '🛍️ Up-Sell de Serviços & Produtos', badge: oportunidades.upSellServicos?.length },
            { id: 'clube', label: '👑 Conversão para Clube VIP', badge: oportunidades.clubeAssinaturas?.length },
            { id: 'simulador', label: '📈 Simulador de Impacto Financeiro' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setAbaAtiva(tab.id)}
              style={{
                padding: '10px 18px',
                border: 0,
                borderRadius: 10,
                background: abaAtiva === tab.id ? '#fff' : 'transparent',
                color: abaAtiva === tab.id ? '#0f172a' : COR.muted,
                fontWeight: abaAtiva === tab.id ? 800 : 600,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: abaAtiva === tab.id ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span style={{
                  background: abaAtiva === tab.id ? '#e2e8f0' : '#cbd5e1',
                  color: '#0f172a',
                  fontSize: 11,
                  padding: '1px 7px',
                  borderRadius: 10,
                  fontWeight: 800
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ padding: 24 }}>
          {/* ABA 1: REATIVAÇÃO ANTI-CHURN */}
          {abaAtiva === 'reativacao' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Clientes com Corte Vencido (Reativação Preditiva)</h3>
                  <p style={{ margin: '4px 0 0', color: COR.muted, fontSize: 13 }}>
                    Clientes que costumam frequentar a barbearia mas estão entre 21 e 75 dias sem vir. A IA redigiu uma mensagem sob medida para cada um.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setFiltroPropensao('todos')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: `1px solid ${filtroPropensao === 'todos' ? COR.azul : COR.line}`,
                      background: filtroPropensao === 'todos' ? COR.azulClaro : '#fff',
                      color: filtroPropensao === 'todos' ? COR.azul : COR.muted,
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    Todos ({oportunidades.reativacaoAntiChurn?.length || 0})
                  </button>
                  <button
                    onClick={() => setFiltroPropensao('alta')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: `1px solid ${filtroPropensao === 'alta' ? COR.verde : COR.line}`,
                      background: filtroPropensao === 'alta' ? COR.verdeClaro : '#fff',
                      color: filtroPropensao === 'alta' ? COR.verde : COR.muted,
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    Alta Propensão (&lt;35 dias)
                  </button>
                </div>
              </div>

              {listaReativacao.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: COR.muted }}>
                  <p style={{ margin: 0 }}>Nenhum cliente em risco nesta categoria no momento. Sua base está saudável!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {listaReativacao.map((c, i) => (
                    <div
                      key={c.id || i}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(200px, 1.2fr) minmax(140px, 1fr) minmax(280px, 2fr) auto',
                        gap: 16,
                        alignItems: 'center',
                        padding: 16,
                        borderRadius: 12,
                        border: `1px solid ${COR.line}`,
                        background: '#fafafa',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 15, color: COR.fg }}>{c.nome}</strong>
                        <div style={{ fontSize: 12, color: COR.muted, marginTop: 2 }}>{c.telefone || 'Sem telefone'}</div>
                        <div style={{ fontSize: 11, color: COR.laranja, fontWeight: 700, marginTop: 4 }}>
                          Barbeiro: {c.barbeiroPreferido}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 12, color: COR.muted }}>Dias sem vir:</div>
                        <strong style={{ fontSize: 16, color: c.diasSemVir > 45 ? COR.vermelho : COR.laranja }}>
                          {c.diasSemVir} dias
                        </strong>
                        <div style={{ fontSize: 11, color: COR.muted }}>Gasto histórico: {fmtR(c.gastoTotal)}</div>
                      </div>

                      <div style={{ background: '#fff', padding: 10, borderRadius: 8, border: `1px solid ${COR.line}`, fontSize: 12, color: '#334155' }}>
                        <div style={{ fontWeight: 700, color: '#64748b', fontSize: 10, textTransform: 'uppercase', marginBottom: 4 }}>
                          💬 Mensagem Sugerida pela IA (T-Rex)
                        </div>
                        {c.mensagemIa}
                      </div>

                      <div>
                        <button
                          onClick={() => dispararMensagem(c, 'anti_churn')}
                          style={{
                            padding: '10px 16px',
                            background: '#25D366',
                            color: '#fff',
                            border: 0,
                            borderRadius: 10,
                            fontWeight: 800,
                            fontSize: 12,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <span>📲</span> Enviar no WhatsApp
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ABA 2: PREENCHER VAGAS DA SEMANA */}
          {abaAtiva === 'buracos' && (
            <div>
              <div style={{ marginBottom: 18 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Otimizador de Vagas Ociosas (Yield Management)</h3>
                <p style={{ margin: '4px 0 0', color: COR.muted, fontSize: 13 }}>
                  A IA localizou horários vazios na agenda dos barbeiros e calcula o potencial de receita para preenchimento ativo via WhatsApp.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {(oportunidades.vagasOciosasSemana || []).map((vaga, idx) => (
                  <div key={idx} style={{ background: '#fff', border: `1px solid ${COR.line}`, borderRadius: 14, padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ background: COR.azulClaro, color: COR.azul, padding: '3px 8px', borderRadius: 6, fontWeight: 800, fontSize: 11 }}>
                        {vaga.dia} · {vaga.data.split('-').reverse().slice(0, 2).join('/')}
                      </span>
                      <strong style={{ fontSize: 16, color: COR.fg }}>{vaga.horario}</strong>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: COR.fg }}>Barbeiro: {vaga.profissional}</div>
                      <div style={{ fontSize: 12, color: COR.verde, fontWeight: 700, marginTop: 4 }}>
                        Potencial Estimado: {fmtR(vaga.potencial)}
                      </div>
                    </div>

                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COR.line}` }}>
                      <button
                        onClick={() => {
                          const msg = `Opa! Aqui é o T-Rex da Barbearia Dino. Abriu um horário exclusivo com o ${vaga.profissional} nesta ${vaga.dia} às ${vaga.horario}. Quer aproveitar para dar aquele tapa no visual?`;
                          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                        }}
                        style={{
                          width: '100%',
                          padding: '10px',
                          background: COR.azul,
                          color: '#fff',
                          border: 0,
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6
                        }}
                      >
                        <span>📢</span> Convidar Clientes para esta Vaga
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ABA 3: UP-SELL DE SERVIÇOS & PRODUTOS */}
          {abaAtiva === 'upsell' && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Radar de Up-Sell & Produtos de Alto Ticket</h3>
                <p style={{ margin: '4px 0 0', color: COR.muted, fontSize: 13 }}>
                  Combine serviços com produtos de cuidado masculino para expandir seu ticket médio em até 35%.
                </p>
              </div>

              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: '#334155' }}>
                🧴 Produtos Campeões de Revenda Recomendados pela IA
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14, marginBottom: 24 }}>
                {produtos.map(p => (
                  <div key={p.id} style={{ background: '#f8fafc', border: `1px solid ${COR.line}`, borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <strong style={{ fontSize: 14, color: COR.fg }}>{p.nome}</strong>
                      <span style={{ fontSize: 14, fontWeight: 800, color: COR.verde }}>{fmtR(p.preco)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: COR.muted, marginTop: 4 }}>Estoque disponível: {p.estoque} un.</div>
                    <div style={{ marginTop: 10, padding: 8, background: '#fff', borderRadius: 8, border: `1px solid ${COR.line}`, fontSize: 11, color: '#475569' }}>
                      💡 <strong>Dica da IA:</strong> {p.dicaVendaIa}
                    </div>
                  </div>
                ))}
              </div>

              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: '#334155' }}>
                🎯 Clientes com Alta Propensão para Combo Corte + Barba (+R$ 60 a R$ 100)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(oportunidades.upSellServicos || []).map((c, i) => (
                  <div
                    key={c.id || i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 14,
                      borderRadius: 10,
                      border: `1px solid ${COR.line}`,
                      background: '#fff',
                      flexWrap: 'wrap',
                      gap: 12
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 14, color: COR.fg }}>{c.nome}</strong>
                      <div style={{ fontSize: 12, color: COR.muted }}>{c.telefone || 'Sem telefone'} · Barbeiro habitual: {c.barbeiroPreferido}</div>
                      <div style={{ fontSize: 12, color: COR.azul, fontWeight: 700, marginTop: 4 }}>
                        Oferta Recomendada: {c.tipoOferta} (+{fmtR(c.impactoTicket)})
                      </div>
                    </div>
                    <button
                      onClick={() => dispararMensagem(c, 'upsell')}
                      style={{
                        padding: '8px 14px',
                        background: COR.roxo,
                        color: '#fff',
                        border: 0,
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <span>💬</span> Propor no WhatsApp
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ABA 4: CONVERSÃO CLUBE VIP */}
          {abaAtiva === 'clube' && (
            <div>
              <div style={{ marginBottom: 18 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Candidatos ao Clube de Assinatura Dino (Receita Recorrente)</h3>
                <p style={{ margin: '4px 0 0', color: COR.muted, fontSize: 13 }}>
                  Clientes com 3+ visitas no período. Converter esses clientes para plano mensal garante previsibilidade de caixa e blinda contra concorrência.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
                {(oportunidades.clubeAssinaturas || []).map((c, i) => (
                  <div key={c.id || i} style={{ background: '#fff', border: `1px solid ${COR.dourado}`, borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 15, color: COR.fg }}>{c.nome}</strong>
                      <span style={{ background: COR.douradoClaro, color: '#92400e', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 10 }}>
                        {c.visitasTotal} Visitas
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: COR.muted, marginTop: 4 }}>Gasto Acumulado: {fmtR(c.gastoTotal)}</div>

                    <div style={{ marginTop: 12, padding: 10, background: '#fdfbf7', borderRadius: 8, fontSize: 12, color: '#78350f' }}>
                      💬 <em>{c.mensagemIa}</em>
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <button
                        onClick={() => dispararMensagem(c, 'clube_vip')}
                        style={{
                          width: '100%',
                          padding: '9px',
                          background: COR.dourado,
                          color: '#fff',
                          border: 0,
                          borderRadius: 8,
                          fontWeight: 800,
                          fontSize: 12,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6
                        }}
                      >
                        <span>👑</span> Convidar para o Clube VIP
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ABA 5: SIMULADOR DE IMPACTO FINANCEIRO */}
          {abaAtiva === 'simulador' && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Simulador de Crescimento de Faturamento</h3>
                <p style={{ margin: '4px 0 0', color: COR.muted, fontSize: 13 }}>
                  Veja o impacto financeiro de pequenas melhorias na rotina diária da equipe (base: {simulador.baseMensalAtendimentos || 0} atendimentos analisados).
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                <div style={{ background: '#f8fafc', border: `1px solid ${COR.line}`, borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COR.muted }}>+R$ 20 NO TICKET MÉDIO</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Oferecendo 1 produto ou barba para quem só corta</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: COR.verde, marginTop: 12 }}>
                    +{fmtR(simulador.impactoMais20ReaisTicket || 0)}/mês
                  </div>
                  <div style={{ fontSize: 12, color: COR.muted, marginTop: 4 }}>
                    +{fmtR((simulador.impactoMais20ReaisTicket || 0) * 12)} ao ano
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: `1px solid ${COR.line}`, borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COR.muted }}>RECUPERAR 10 CLIENTES EM CHURN</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Disparando as mensagens sugeridas pelo T-Rex</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: COR.azul, marginTop: 12 }}>
                    +{fmtR(simulador.impactoRecuperar10Clientes || 0)}/mês
                  </div>
                  <div style={{ fontSize: 12, color: COR.muted, marginTop: 4 }}>
                    +{fmtR((simulador.impactoRecuperar10Clientes || 0) * 12)} ao ano
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: `1px solid ${COR.line}`, borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COR.muted }}>PREENCHER 2 VAGAS OCIOSAS / DIA</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Aproveitando os buracos nos dias mais fracos</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#d97706', marginTop: 12 }}>
                    +{fmtR(simulador.impactoPreencher2VagasDia || 0)}/mês
                  </div>
                  <div style={{ fontSize: 12, color: COR.muted, marginTop: 4 }}>
                    +{fmtR((simulador.impactoPreencher2VagasDia || 0) * 12)} ao ano
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
