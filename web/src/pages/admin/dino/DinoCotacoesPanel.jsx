import { useState, useMemo } from 'react';
import Modal from '../../../components/Modal';
import { api } from '../../../lib/api';

const styles = {
  card: {
    background: 'var(--surface, #ffffff)',
    border: '1px solid var(--line, #e2e8f0)',
    borderRadius: 14,
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))',
    gap: 12,
  },
  kpi: {
    background: 'var(--surface-2, #f8fafc)',
    border: '1px solid var(--line, #e2e8f0)',
    borderRadius: 12,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--muted, #64748b)',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: 900,
    color: 'var(--text, #0f172a)',
  },
  btn: {
    border: '1px solid var(--line, #cbd5e1)',
    background: 'var(--surface, #ffffff)',
    color: 'var(--text, #1e293b)',
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all .15s ease',
  },
  btnPrimary: {
    background: '#0284c7',
    border: '1px solid #0369a1',
    color: '#ffffff',
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  btnSuccess: {
    background: '#16a34a',
    border: '1px solid #15803d',
    color: '#ffffff',
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--line, #cbd5e1)',
    background: 'var(--surface, #ffffff)',
    color: 'var(--text, #0f172a)',
    fontSize: 13,
    boxSizing: 'border-box',
  },
  badge: (bg, cor) => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 800,
    color: cor,
    background: bg,
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
  }),
};

export default function DinoCotacoesPanel({
  cotacoes = [],
  fornecedores = [],
  produtos = [],
  onAtualizar,
  fmtR,
  toast,
}) {
  const [filtroStatus, setFiltroStatus] = useState('todas');
  const [busca, setBusca] = useState('');

  // Modais
  const [modalNovaCotacao, setModalNovaCotacao] = useState(false);
  const [salvandoCotacao, setSalvandoCotacao] = useState(false);
  const [formNovaCotacao, setFormNovaCotacao] = useState({
    titulo: '',
    descricao: '',
    prazoLimiteResposta: '',
    fornecedoresSelecionados: [],
    itens: [],
  });
  const [novoItem, setNovoItem] = useState({
    produtoId: '',
    nome: '',
    unidade: 'un',
    quantidade: 10,
    observacao: '',
  });

  // Modal Lançar Proposta
  const [modalProposta, setModalProposta] = useState(false);
  const [cotacaoAlvoProposta, setCotacaoAlvoProposta] = useState(null);
  const [salvandoProposta, setSalvandoProposta] = useState(false);
  const [formProposta, setFormProposta] = useState({
    fornecedorId: '',
    fornecedorNome: '',
    fornecedorCnpj: '',
    fornecedorTelefone: '',
    fornecedorEmail: '',
    prazoEntregaDias: 5,
    condicaoPagamento: 'Boleto 30 dias',
    freteTipo: 'cif',
    freteValor: 0,
    observacoes: '',
    itens: [], // [{ itemCotacaoId, precoUnitario, marcaSugerida }]
  });

  // Modal Mapa Comparativo
  const [modalMapa, setModalMapa] = useState(false);
  const [mapaComparativo, setMapaComparativo] = useState(null);
  const [carregandoMapa, setCarregandoMapa] = useState(false);
  const [aprovandoCotacao, setAprovandoCotacao] = useState(false);

  // KPIs
  const kpis = useMemo(() => {
    const total = cotacoes.length;
    const abertas = cotacoes.filter((c) => c.status === 'em_aberto').length;
    const comPropostas = cotacoes.filter((c) => c.status === 'com_propostas').length;
    const finalizadas = cotacoes.filter((c) => c.status === 'finalizada').length;
    return { total, abertas, comPropostas, finalizadas };
  }, [cotacoes]);

  // Lista Filtrada
  const cotacoesFiltradas = useMemo(() => {
    return cotacoes.filter((c) => {
      if (filtroStatus !== 'todas' && c.status !== filtroStatus) return false;
      if (busca) {
        const termo = busca.toLowerCase();
        const num = String(c.numero || '').toLowerCase();
        const tit = String(c.titulo || '').toLowerCase();
        if (!num.includes(termo) && !tit.includes(termo)) return false;
      }
      return true;
    });
  }, [cotacoes, filtroStatus, busca]);

  // Handlers
  function abrirNovaCotacao() {
    setFormNovaCotacao({
      titulo: 'Cotação de Suprimentos & Cosméticos',
      descricao: 'Solicitação de cotação para abastecimento de estoque com entrega para a Dino Barbearia.',
      prazoLimiteResposta: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      fornecedoresSelecionados: fornecedores.slice(0, 3).map((f) => f.id),
      itens: [],
    });
    setModalNovaCotacao(true);
  }

  function adicionarItemFormCotacao() {
    if (!novoItem.nome && !novoItem.produtoId) {
      toast('Selecione um produto ou digite o nome do item.', 'aviso');
      return;
    }
    const prod = produtos.find((p) => p.id === novoItem.produtoId);
    const nomeFinal = novoItem.nome || prod?.nome || 'Item Cotado';
    setFormNovaCotacao((prev) => ({
      ...prev,
      itens: [
        ...prev.itens,
        {
          id: `it-${Date.now()}-${prev.itens.length + 1}`,
          produtoId: novoItem.produtoId || null,
          nome: nomeFinal,
          unidade: novoItem.unidade || 'un',
          quantidade: Number(novoItem.quantidade || 1),
          observacao: novoItem.observacao || '',
        },
      ],
    }));
    setNovoItem({ produtoId: '', nome: '', unidade: 'un', quantidade: 10, observacao: '' });
  }

  async function salvarNovaCotacao() {
    if (formNovaCotacao.itens.length === 0) {
      toast('Adicione pelo menos um item à cotação.', 'aviso');
      return;
    }
    setSalvandoCotacao(true);
    try {
      const fornecedoresConvidados = fornecedores
        .filter((f) => formNovaCotacao.fornecedoresSelecionados.includes(f.id))
        .map((f) => ({
          id: f.id,
          nome: f.nome,
          email: f.email,
          telefone: f.telefone,
        }));

      await api.post('/api/admin/barbearia/compras/cotacoes', {
        titulo: formNovaCotacao.titulo,
        descricao: formNovaCotacao.descricao,
        prazoLimiteResposta: formNovaCotacao.prazoLimiteResposta,
        fornecedores: fornecedoresConvidados,
        itens: formNovaCotacao.itens,
      });

      toast('Cotação criada com sucesso! Fornecedores convidados.');
      setModalNovaCotacao(false);
      onAtualizar?.();
    } catch (err) {
      toast(err.message || 'Erro ao criar cotação', 'erro');
    } finally {
      setSalvandoCotacao(false);
    }
  }

  function abrirModalProposta(cotacao) {
    setCotacaoAlvoProposta(cotacao);
    const primeiroForn = cotacao.fornecedoresConvidados?.[0] || fornecedores[0] || {};
    setFormProposta({
      fornecedorId: primeiroForn.id || '',
      fornecedorNome: primeiroForn.nome || '',
      fornecedorCnpj: primeiroForn.cnpj || '',
      fornecedorTelefone: primeiroForn.telefone || '',
      fornecedorEmail: primeiroForn.email || '',
      prazoEntregaDias: 4,
      condicaoPagamento: 'Boleto 30 dias',
      freteTipo: 'cif',
      freteValor: 0,
      observacoes: '',
      itens: (cotacao.itens || []).map((it) => ({
        itemCotacaoId: it.id,
        produtoId: it.produtoId,
        nome: it.nome,
        quantidade: it.quantidade,
        unidade: it.unidade,
        precoUnitario: 0,
        marcaSugerida: '',
      })),
    });
    setModalProposta(true);
  }

  async function salvarProposta() {
    if (!formProposta.fornecedorNome) {
      toast('Informe o fornecedor da proposta.', 'aviso');
      return;
    }
    setSalvandoProposta(true);
    try {
      await api.post(`/api/admin/barbearia/compras/cotacoes/${cotacaoAlvoProposta.id}/propostas`, formProposta);
      toast('Proposta registrada com sucesso!');
      setModalProposta(false);
      onAtualizar?.();
    } catch (err) {
      toast(err.message || 'Erro ao registrar proposta', 'erro');
    } finally {
      setSalvandoProposta(false);
    }
  }

  async function abrirMapaComparativo(cotacao) {
    setCarregandoMapa(true);
    setModalMapa(true);
    try {
      const res = await api.get(`/api/admin/barbearia/compras/cotacoes/${cotacao.id}/mapa-comparativo`);
      setMapaComparativo(res);
    } catch (err) {
      toast(err.message || 'Erro ao carregar mapa comparativo', 'erro');
      setModalMapa(false);
    } finally {
      setCarregandoMapa(false);
    }
  }

  async function aprovarPropostaVencedora(fornecedorId) {
    if (!mapaComparativo?.cotacao?.id) return;
    if (!confirm('Deseja aprovar esta proposta e gerar o Pedido de Compra Oficial automaticamente?')) return;
    setAprovandoCotacao(true);
    try {
      const res = await api.post(`/api/admin/barbearia/compras/cotacoes/${mapaComparativo.cotacao.id}/aprovar`, {
        fornecedorId,
        observacoes: 'Aprovado via Mapa Comparativo de Cotações Kytto.',
      });
      toast(`Pedido de Compra #${res.pedido?.numero} gerado com sucesso!`);
      setModalMapa(false);
      onAtualizar?.();
    } catch (err) {
      toast(err.message || 'Erro ao aprovar proposta', 'erro');
    } finally {
      setAprovandoCotacao(false);
    }
  }

  function gerarTextoWhatsappRfq(cotacao) {
    const linhasItens = (cotacao.itens || [])
      .map((it, i) => `   ${i + 1}. *${it.nome}* — ${it.quantidade} ${it.unidade}`)
      .join('\n');

    const msg = `Olá! Aqui é da *Dino Barbearia*.\n\n` +
      `Gostaríamos de solicitar cotação de preços para o fornecimento dos seguintes itens (*${cotacao.numero}*):\n\n` +
      `${linhasItens}\n\n` +
      `📅 *Prazo Limite:* ${cotacao.prazoLimiteResposta ? new Date(cotacao.prazoLimiteResposta).toLocaleDateString('pt-BR') : 'Urgente'}\n` +
      `🚚 *Local de Entrega:* Av. Filinto Müller, 1269 — Várzea Grande - MT\n\n` +
      `Por favor, informe: Preços unitários, condições de pagamento, frete (CIF/FOB) e prazo de entrega. Obrigado!`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* ── KPIS DE COTAÇÃO ── */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Cotações em Aberto</div>
          <div style={{ ...styles.kpiValue, color: kpis.abertas ? '#0284c7' : '#0f172a' }}>{kpis.abertas}</div>
        </div>
        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Com Propostas Recebidas</div>
          <div style={{ ...styles.kpiValue, color: kpis.comPropostas ? '#10b981' : '#0f172a' }}>{kpis.comPropostas}</div>
        </div>
        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Cotações Finalizadas</div>
          <div style={{ ...styles.kpiValue, color: '#16a34a' }}>{kpis.finalizadas}</div>
        </div>
        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Total de Cotações</div>
          <div style={styles.kpiValue}>{kpis.total}</div>
        </div>
      </div>

      {/* ── CARD PRINCIPAL: TABELA E AÇÕES ── */}
      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Cotações de Preços & RFQ (Request for Quotation)</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted, #64748b)' }}>
              Negociação multifornecedor com geração de Mapa Comparativo de menor preço e conversão automática em Pedido de Compra Oficial.
            </p>
          </div>
          <button type="button" style={styles.btnPrimary} onClick={abrirNovaCotacao}>
            + Nova Cotação de Preços (RFQ)
          </button>
        </div>

        {/* Filtros e Busca */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'todas', label: 'Todas as Cotações' },
              { id: 'em_aberto', label: 'Em Aberto' },
              { id: 'com_propostas', label: 'Com Propostas' },
              { id: 'finalizada', label: 'Finalizadas' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                style={{
                  ...styles.btn,
                  background: filtroStatus === f.id ? '#0284c7' : 'var(--surface, #ffffff)',
                  color: filtroStatus === f.id ? '#ffffff' : 'var(--text, #1e293b)',
                  borderColor: filtroStatus === f.id ? '#0369a1' : 'var(--line, #cbd5e1)',
                }}
                onClick={() => setFiltroStatus(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ width: 280 }}>
            <input
              type="text"
              placeholder="Buscar por número ou título..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        {/* Tabela de Cotações */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--line, #e2e8f0)', color: 'var(--muted, #64748b)', textAlign: 'left' }}>
                <th style={{ padding: '10px 8px' }}>Cotação</th>
                <th style={{ padding: '10px 8px' }}>Título & Finalidade</th>
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>Itens</th>
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>Convidados</th>
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>Propostas</th>
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>Prazo Limite</th>
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '10px 8px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {cotacoesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--muted, #64748b)' }}>
                    Nenhuma cotação encontrada neste filtro. Clique em "+ Nova Cotação de Preços (RFQ)" para iniciar uma negociação.
                  </td>
                </tr>
              ) : (
                cotacoesFiltradas.map((c) => {
                  let badge = styles.badge('#e0f2fe', '#0284c7');
                  let statusTxt = 'Em Aberto';
                  if (c.status === 'com_propostas') {
                    badge = styles.badge('#fef3c7', '#d97706');
                    statusTxt = 'Propostas Recebidas';
                  } else if (c.status === 'finalizada') {
                    badge = styles.badge('#dcfce7', '#15803d');
                    statusTxt = 'Finalizada / Pedido Gerado';
                  }

                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--line, #f1f5f9)' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 800, color: '#0284c7' }}>
                        {c.numero}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <strong>{c.titulo}</strong>
                        {c.descricao && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.descricao}</div>}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                        <strong>{c.qtdItens || (c.itens || []).length}</strong> un
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                        {c.qtdFornecedoresConvidados || (c.fornecedoresConvidados || []).length}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 800, color: c.qtdPropostasRecebidas > 0 ? '#16a34a' : 'inherit' }}>
                        {c.qtdPropostasRecebidas || Object.keys(c.propostas || {}).length}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                        {c.prazoLimiteResposta ? new Date(c.prazoLimiteResposta).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                        <span style={badge}>{statusTxt}</span>
                      </td>
                      <td style={{ textAlign: 'right', padding: '10px 8px' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {Object.keys(c.propostas || {}).length > 0 && (
                            <button
                              type="button"
                              style={{ ...styles.btn, background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}
                              onClick={() => abrirMapaComparativo(c)}
                              title="Visualizar Mapa Comparativo de Preços"
                            >
                              📊 Mapa Comparativo
                            </button>
                          )}
                          {c.status !== 'finalizada' && (
                            <button
                              type="button"
                              style={styles.btn}
                              onClick={() => abrirModalProposta(c)}
                              title="Lançar proposta recebida de fornecedor"
                            >
                              📝 + Proposta
                            </button>
                          )}
                          <button
                            type="button"
                            style={{ ...styles.btn, background: '#f0fdf4', borderColor: '#86efac', color: '#15803d' }}
                            onClick={() => gerarTextoWhatsappRfq(c)}
                            title="Disparar solicitação aos fornecedores via WhatsApp"
                          >
                            💬 WhatsApp
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: NOVA COTAÇÃO DE PREÇOS (RFQ) ── */}
      {modalNovaCotacao && (
        <Modal open={modalNovaCotacao} onClose={() => setModalNovaCotacao(false)} width={820} title="Nova Cotação de Preços (RFQ) Multiforncedor">
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Título da Cotação</label>
                <input
                  type="text"
                  value={formNovaCotacao.titulo}
                  onChange={(e) => setFormNovaCotacao({ ...formNovaCotacao, titulo: e.target.value })}
                  style={styles.input}
                  placeholder="Ex: Cotação de Pomadas & Navalhetas 1º Tri"
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Data Limite de Resposta</label>
                <input
                  type="date"
                  value={formNovaCotacao.prazoLimiteResposta}
                  onChange={(e) => setFormNovaCotacao({ ...formNovaCotacao, prazoLimiteResposta: e.target.value })}
                  style={styles.input}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Observações Gerais / Instruções</label>
              <input
                type="text"
                value={formNovaCotacao.descricao}
                onChange={(e) => setFormNovaCotacao({ ...formNovaCotacao, descricao: e.target.value })}
                style={styles.input}
                placeholder="Ex: Entrega na unidade Filinto Müller com DANFE. Preço com frete CIF incluso."
              />
            </div>

            {/* Inclusão de Itens */}
            <div style={{ background: 'var(--surface-2, #f8fafc)', padding: 12, borderRadius: 10, border: '1px solid var(--line, #e2e8f0)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
                Adicionar Produtos / Itens a Cotar
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr auto', gap: 8 }}>
                <select
                  value={novoItem.produtoId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    const prod = produtos.find((p) => p.id === pid);
                    setNovoItem({ ...novoItem, produtoId: pid, nome: prod?.nome || '' });
                  }}
                  style={styles.input}
                >
                  <option value="">Selecione do Catálogo de Produtos...</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (Estoque: {p.estoqueAtual || 0})
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Ou item avulso..."
                  value={novoItem.nome}
                  onChange={(e) => setNovoItem({ ...novoItem, nome: e.target.value, produtoId: '' })}
                  style={styles.input}
                />

                <input
                  type="number"
                  min="1"
                  placeholder="Qtd"
                  value={novoItem.quantidade}
                  onChange={(e) => setNovoItem({ ...novoItem, quantidade: e.target.value })}
                  style={{ ...styles.input, textAlign: 'center' }}
                />

                <button type="button" style={styles.btnPrimary} onClick={adicionarItemFormCotacao}>
                  + Inserir
                </button>
              </div>

              {/* Lista dos Itens Inseridos */}
              {formNovaCotacao.itens.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#64748b' }}>
                        <th style={{ textAlign: 'left', padding: '4px' }}>Item</th>
                        <th style={{ textAlign: 'center', padding: '4px' }}>Quantidade</th>
                        <th style={{ textAlign: 'center', padding: '4px' }}>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formNovaCotacao.itens.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '6px 4px' }}>
                            <strong>{it.nome}</strong>
                          </td>
                          <td style={{ textAlign: 'center', padding: '6px 4px' }}>
                            {it.quantidade} {it.unidade}
                          </td>
                          <td style={{ textAlign: 'center', padding: '6px 4px' }}>
                            <button
                              type="button"
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 800 }}
                              onClick={() => {
                                setFormNovaCotacao({
                                  ...formNovaCotacao,
                                  itens: formNovaCotacao.itens.filter((_, i) => i !== idx),
                                });
                              }}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Seleção de Fornecedores */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
                Selecionar Fornecedores Convidados para a Cotação
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, maxHeight: 140, overflowY: 'auto' }}>
                {fornecedores.map((f) => {
                  const marcado = formNovaCotacao.fornecedoresSelecionados.includes(f.id);
                  return (
                    <label
                      key={f.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: marcado ? '#f0f9ff' : 'var(--surface-2, #f8fafc)',
                        border: `1px solid ${marcado ? '#38bdf8' : 'var(--line, #e2e8f0)'}`,
                        padding: '6px 10px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 11,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={(e) => {
                          const novos = e.target.checked
                            ? [...formNovaCotacao.fornecedoresSelecionados, f.id]
                            : formNovaCotacao.fornecedoresSelecionados.filter((x) => x !== f.id);
                          setFormNovaCotacao({ ...formNovaCotacao, fornecedoresSelecionados: novos });
                        }}
                      />
                      <span style={{ fontWeight: 700 }}>{f.nome}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button type="button" style={styles.btn} onClick={() => setModalNovaCotacao(false)}>
                Cancelar
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={salvarNovaCotacao}
                disabled={salvandoCotacao}
              >
                {salvandoCotacao ? 'Criando...' : '✓ Criar Cotação & Convidar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: LANÇAR PROPOSTA DE FORNECEDOR ── */}
      {modalProposta && cotacaoAlvoProposta && (
        <Modal open={modalProposta} onClose={() => setModalProposta(false)} width={820} title={`Lançar Proposta de Fornecedor — ${cotacaoAlvoProposta.numero}`}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Fornecedor Participante</label>
                <select
                  value={formProposta.fornecedorId}
                  onChange={(e) => {
                    const fid = e.target.value;
                    const f = fornecedores.find((x) => x.id === fid) || {};
                    setFormProposta({
                      ...formProposta,
                      fornecedorId: fid,
                      fornecedorNome: f.nome || '',
                      fornecedorCnpj: f.cnpj || '',
                      fornecedorTelefone: f.telefone || '',
                      fornecedorEmail: f.email || '',
                      prazoEntregaDias: f.prazoEntregaDias || 5,
                      condicaoPagamento: f.condicaoPagamento || 'Boleto 30 dias',
                    });
                  }}
                  style={styles.input}
                >
                  <option value="">Selecione o Fornecedor...</option>
                  {(cotacaoAlvoProposta.fornecedoresConvidados || fornecedores).map((f) => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Prazo de Entrega (Dias)</label>
                <input
                  type="number"
                  value={formProposta.prazoEntregaDias}
                  onChange={(e) => setFormProposta({ ...formProposta, prazoEntregaDias: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Condição de Pagamento</label>
                <input
                  type="text"
                  value={formProposta.condicaoPagamento}
                  onChange={(e) => setFormProposta({ ...formProposta, condicaoPagamento: e.target.value })}
                  style={styles.input}
                  placeholder="Ex: Boleto 30 dias"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Modalidade do Frete</label>
                <select
                  value={formProposta.freteTipo}
                  onChange={(e) => setFormProposta({ ...formProposta, freteTipo: e.target.value })}
                  style={styles.input}
                >
                  <option value="cif">CIF (Por conta do Fornecedor / Incluso)</option>
                  <option value="fob">FOB (Por conta da Dino Barbearia)</option>
                </select>
              </div>

              {formProposta.freteTipo === 'fob' && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Valor do Frete (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formProposta.freteValor}
                    onChange={(e) => setFormProposta({ ...formProposta, freteValor: e.target.value })}
                    style={styles.input}
                  />
                </div>
              )}
            </div>

            {/* Tabela de Preços Ofertados por Item */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
                Preços Unitários Ofertados pelos Itens
              </div>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--line, #e2e8f0)', color: 'var(--muted)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 6px' }}>Item Solicitado</th>
                    <th style={{ textAlign: 'center', padding: '8px 6px' }}>Qtd Cotada</th>
                    <th style={{ textAlign: 'center', padding: '8px 6px' }}>Preço Unitário (R$)</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px' }}>Marca / Linha Ofertada</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px' }}>Total do Item</th>
                  </tr>
                </thead>
                <tbody>
                  {formProposta.itens.map((it, idx) => {
                    const totalItem = (Number(it.precoUnitario) || 0) * it.quantidade;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--line, #f1f5f9)' }}>
                        <td style={{ padding: '8px 6px' }}>
                          <strong>{it.nome}</strong>
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                          {it.quantidade} {it.unidade}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={it.precoUnitario}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormProposta((prev) => ({
                                ...prev,
                                itens: prev.itens.map((x, i) => i === idx ? { ...x, precoUnitario: val } : x),
                              }));
                            }}
                            style={{ ...styles.input, width: 110, textAlign: 'right' }}
                            placeholder="0,00"
                          />
                        </td>
                        <td style={{ padding: '8px 6px' }}>
                          <input
                            type="text"
                            value={it.marcaSugerida}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormProposta((prev) => ({
                                ...prev,
                                itens: prev.itens.map((x, i) => i === idx ? { ...x, marcaSugerida: val } : x),
                              }));
                            }}
                            style={styles.input}
                            placeholder="Ex: Linha Premium"
                          />
                        </td>
                        <td style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 800 }}>
                          {fmtR(totalItem)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button type="button" style={styles.btn} onClick={() => setModalProposta(false)}>
                Cancelar
              </button>
              <button
                type="button"
                style={styles.btnSuccess}
                onClick={salvarProposta}
                disabled={salvandoProposta}
              >
                {salvandoProposta ? 'Salvando...' : '✓ Registrar Proposta'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: MAPA COMPARATIVO DE PREÇOS (MATRIZ RFQ) ── */}
      {modalMapa && (
        <Modal open={modalMapa} onClose={() => setModalMapa(false)} width={920} title={`Mapa Comparativo de Cotações — ${mapaComparativo?.cotacao?.numero || ''}`}>
          {carregandoMapa ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Carregando dados da matriz comparativa...</div>
          ) : !mapaComparativo ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nenhuma proposta registrada para comparação.</div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {/* Resumo da Melhor Proposta Recomendada */}
              {mapaComparativo.melhorPropostaGeral && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <span style={styles.badge('#dcfce7', '#15803d')}>🏆 Melhor Proposta Global</span>
                    <h4 style={{ margin: '4px 0 2px', fontSize: 16, fontWeight: 900, color: '#166534' }}>
                      {mapaComparativo.melhorPropostaGeral.fornecedorNome}
                    </h4>
                    <div style={{ fontSize: 12, color: '#166534' }}>
                      Valor Global: <strong>{fmtR(mapaComparativo.melhorPropostaGeral.valorTotal)}</strong> · Entrega em <strong>{mapaComparativo.melhorPropostaGeral.prazoEntregaDias} dias</strong> · Condição: <strong>{mapaComparativo.melhorPropostaGeral.condicaoPagamento}</strong>
                    </div>
                  </div>
                  {mapaComparativo.cotacao.status !== 'finalizada' && (
                    <button
                      type="button"
                      style={{ ...styles.btnSuccess, fontSize: 13, padding: '10px 18px' }}
                      onClick={() => aprovarPropostaVencedora(mapaComparativo.melhorPropostaGeral.fornecedorId)}
                      disabled={aprovandoCotacao}
                    >
                      {aprovandoCotacao ? 'Aprovando...' : '✓ Aprovar e Gerar Pedido Oficial'}
                    </button>
                  )}
                </div>
              )}

              {/* Matriz Lado a Lado por Item */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
                  Comparativo de Preços Item a Item
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--line, #e2e8f0)', color: 'var(--muted)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 6px' }}>Item Cotado</th>
                        <th style={{ textAlign: 'center', padding: '8px 6px' }}>Qtd</th>
                        {(mapaComparativo.rankingFornecedores || []).map((f) => (
                          <th key={f.fornecedorId} style={{ textAlign: 'right', padding: '8px 6px', minWidth: 130 }}>
                            {f.fornecedorNome}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(mapaComparativo.matrizItens || []).map((it) => (
                        <tr key={it.itemId} style={{ borderBottom: '1px solid var(--line, #f1f5f9)' }}>
                          <td style={{ padding: '8px 6px' }}>
                            <strong>{it.nome}</strong>
                          </td>
                          <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                            {it.quantidade} {it.unidade}
                          </td>
                          {(mapaComparativo.rankingFornecedores || []).map((f) => {
                            const oferta = (it.ofertas || []).find((o) => o.fornecedorId === f.fornecedorId) || {};
                            const ehMenor = it.menorPreco > 0 && oferta.precoUnitario === it.menorPreco;
                            return (
                              <td
                                key={f.fornecedorId}
                                style={{
                                  textAlign: 'right',
                                  padding: '8px 6px',
                                  background: ehMenor ? '#f0fdf4' : 'transparent',
                                  color: ehMenor ? '#16a34a' : 'inherit',
                                  fontWeight: ehMenor ? 800 : 500,
                                }}
                              >
                                {oferta.precoUnitario > 0 ? (
                                  <>
                                    <div>{fmtR(oferta.precoUnitario)}</div>
                                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>Total: {fmtR(oferta.totalItem)}</div>
                                  </>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>Não cotado</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {/* Linha de Totais */}
                      <tr style={{ borderTop: '2px solid #0284c7', background: 'var(--surface-2, #f8fafc)' }}>
                        <td colSpan={2} style={{ padding: '10px 6px', fontWeight: 900, color: '#0284c7' }}>
                          TOTAL GLOBAL DA ORDEM:
                        </td>
                        {(mapaComparativo.rankingFornecedores || []).map((f) => (
                          <td key={f.fornecedorId} style={{ textAlign: 'right', padding: '10px 6px', fontWeight: 900, fontSize: 13 }}>
                            <div>{fmtR(f.valorTotal)}</div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b' }}>
                              Frete: {f.freteTipo === 'cif' ? 'CIF (Incluso)' : fmtR(f.freteValor)}
                            </div>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Botão Fechar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" style={styles.btn} onClick={() => setModalMapa(false)}>
                  Fechar Mapa Comparativo
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
