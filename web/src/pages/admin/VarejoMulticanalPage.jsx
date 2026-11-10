import React, { useState, useEffect } from 'react';

export default function VarejoMulticanalPage() {
  const [abaAtiva, setAbaAtiva] = useState('grade_produtos');
  const [produtosGrade, setProdutosGrade] = useState([]);
  const [dadosBarbearia, setDadosBarbearia] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form de devolução
  const [chaveOriginal, setChaveOriginal] = useState('51261150073355000260550010000010421893748291');
  const [numeroNota, setNumeroNota] = useState('1042');
  const [motivoDevolucao, setMotivoDevolucao] = useState('Troca de mercadoria por divergência de sabor no balcão');
  const [resultadoDevolucao, setResultadoDevolucao] = useState(null);
  const [emitindoDevolucao, setEmitindoDevolucao] = useState(false);

  const token = localStorage.getItem('token') || localStorage.getItem('sp_token');

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);
    try {
      // 1. Produtos com Grade
      const resGrade = await fetch('/api/admin/varejo/produtos-grade', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataGrade = await resGrade.json();
      if (dataGrade.ok) setProdutosGrade(dataGrade.itens || []);

      // 2. Fila da Vez e Upsell Barbearia
      const resBarb = await fetch('/api/admin/varejo/barbearia/rodizio-upsell', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataBarb = await resBarb.json();
      if (dataBarb.ok) setDadosBarbearia(dataBarb);
    } catch (e) {
      console.error('Erro ao carregar dados de varejo:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleEmitirDevolucao(e) {
    e.preventDefault();
    setEmitindoDevolucao(true);
    try {
      const res = await fetch('/api/admin/varejo/devolucoes/emitir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          chaveAcessoOriginal: chaveOriginal,
          numeroNfOriginal: numeroNota,
          motivoDevolucao,
          itensDevolvidos: [
            { sku: 'STL-WHEY-100-CHOCOLATEBELGA-900G', descricao: 'Whey Protein Chocolate Belga 900g', quantidade: 1, valorUnitario: 149.90 }
          ]
        })
      });
      const data = await res.json();
      if (data.ok) {
        setResultadoDevolucao(data);
      } else {
        alert(data.error || 'Erro ao emitir nota de devolução');
      }
    } catch (err) {
      alert('Falha na comunicação com a SEFAZ-MT');
    } finally {
      setEmitindoDevolucao(false);
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header Corporativo */}
      <div style={{ background: '#0F172A', color: '#F8FAFC', padding: '24px', borderRadius: '12px', marginBottom: '24px', borderLeft: '6px solid #38BDF8' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>📦</span> Hub Varejo Multicanal, Grade de Produtos & Balcão Avançado
            </h1>
            <p style={{ margin: '8px 0 0 0', color: '#94A3B8', fontSize: '0.9rem' }}>
              Gestão de SKUs multidimensionais (Sabores/Tamanhos), Precificação por Canal, Devoluções Vinculadas SEFAZ-MT e Rodízio de Balcão.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <span style={{ background: '#1E293B', padding: '8px 14px', borderRadius: '8px', border: '1px solid #334155', fontSize: '0.85rem', color: '#38BDF8', fontWeight: 600 }}>
              🏢 Stallone Nutre Sport & Barbearia Dino
            </span>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px', borderTop: '1px solid #334155', paddingTop: '16px' }}>
          <button
            onClick={() => setAbaAtiva('grade_produtos')}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              background: abaAtiva === 'grade_produtos' ? '#38BDF8' : '#1E293B',
              color: abaAtiva === 'grade_produtos' ? '#0F172A' : '#CBD5E1',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>📊</span> Grade Multidimensional & Preços por Canal
          </button>

          <button
            onClick={() => setAbaAtiva('devolucoes_nfe')}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              background: abaAtiva === 'devolucoes_nfe' ? '#38BDF8' : '#1E293B',
              color: abaAtiva === 'devolucoes_nfe' ? '#0F172A' : '#CBD5E1',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>🔄</span> Emissão de Devolução Vinculada (CFOP 1.202)
          </button>

          <button
            onClick={() => setAbaAtiva('rodizio_upsell')}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              background: abaAtiva === 'rodizio_upsell' ? '#38BDF8' : '#1E293B',
              color: abaAtiva === 'rodizio_upsell' ? '#0F172A' : '#CBD5E1',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>💈</span> Fila da Vez (Rodízio) & Upsell Barbearia
          </button>
        </div>
      </div>

      {/* CONTEÚDO DA ABA 1: GRADE MULTIDIMENSIONAL */}
      {abaAtiva === 'grade_produtos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {produtosGrade.map((prodPai, idx) => (
            <div key={idx} style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', background: '#F1F5F9', color: '#475569', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                    SKU PAI: {prodPai.codigoPai}
                  </span>
                  <h2 style={{ margin: '6px 0 0 0', fontSize: '1.25rem', color: '#0F172A', fontWeight: 700 }}>
                    {prodPai.nome}
                  </h2>
                  <div style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '4px' }}>
                    Marca: <strong>{prodPai.marca}</strong> | Categoria: <strong>{prodPai.categoria}</strong> | NCM: <strong>{prodPai.ncm}</strong>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', textTransform: 'uppercase' }}>Estoque Consolidado</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16A34A' }}>{prodPai.estoqueTotalPai} un</div>
                </div>
              </div>

              {/* Tabela de Variações / SKUs Filhos */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', color: '#475569', borderBottom: '2px solid #E2E8F0' }}>
                      <th style={{ padding: '10px 12px' }}>SKU Filho</th>
                      <th style={{ padding: '10px 12px' }}>Sabor / Atributo 1</th>
                      <th style={{ padding: '10px 12px' }}>Peso / Tamanho</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Loja Física (Balcão)</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>E-commerce</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Atacado B2B</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Saldo Físico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prodPai.skus.map((skuFilho, sIdx) => (
                      <tr key={sIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0F172A' }}>{skuFilho.sku}</td>
                        <td style={{ padding: '10px 12px', color: '#334155' }}>
                          <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>
                            {skuFilho.sabor}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#334155' }}>{skuFilho.tamanhoPeso}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                          R$ {skuFilho.precos.lojaFisica.toFixed(2)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#0284C7', fontWeight: 600 }}>
                          R$ {skuFilho.precos.ecommerce.toFixed(2)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#16A34A', fontWeight: 600 }}>
                          R$ {skuFilho.precos.atacadoB2B.toFixed(2)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ background: skuFilho.estoqueFisico > 10 ? '#DCFCE7' : '#FEF2F2', color: skuFilho.estoqueFisico > 10 ? '#15803D' : '#DC2626', padding: '3px 10px', borderRadius: '12px', fontWeight: 700 }}>
                            {skuFilho.estoqueFisico} un
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: DEVOLUÇÃO VINCULADA CFOP 1.202 */}
      {abaAtiva === 'devolucoes_nfe' && (
        <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', color: '#0F172A', fontWeight: 700 }}>
            Emissão de Nota Fiscal de Devolução de Mercadoria (CFOP 1.202 / SEFAZ-MT)
          </h2>
          <p style={{ margin: '0 0 20px 0', color: '#64748B', fontSize: '0.9rem' }}>
            Vincula diretamente a chave de acesso da NF-e/NFC-e original de venda, estornando financeiro e repondo o estoque com total validade jurídica.
          </p>

          <form onSubmit={handleEmitirDevolucao} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Chave de Acesso da Nota Fiscal Original (44 Dígitos) *
              </label>
              <input
                type="text"
                value={chaveOriginal}
                onChange={(e) => setChaveOriginal(e.target.value)}
                maxLength={44}
                required
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.95rem', fontFamily: 'monospace' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Número da NF Original
              </label>
              <input
                type="text"
                value={numeroNota}
                onChange={(e) => setNumeroNota(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Motivo da Devolução
              </label>
              <input
                type="text"
                value={motivoDevolucao}
                onChange={(e) => setMotivoDevolucao(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
              <button
                type="submit"
                disabled={emitindoDevolucao}
                style={{
                  padding: '12px 24px',
                  background: '#0F172A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                {emitindoDevolucao ? 'Transmitindo à SEFAZ-MT...' : 'Transmitir Nota de Devolução na SEFAZ-MT'}
              </button>
            </div>
          </form>

          {resultadoDevolucao && (
            <div style={{ marginTop: '24px', background: '#ECFDF5', padding: '20px', borderRadius: '8px', border: '1px solid #A7F3D0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#065F46', fontWeight: 700, fontSize: '1.1rem' }}>
                <span>✅</span> {resultadoDevolucao.mensagem}
              </div>
              <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#065F46' }}>
                Protocolo SEFAZ-MT: <strong>{resultadoDevolucao.protocoloAutorizacao}</strong> | CFOP: <strong>1.202</strong> | Ação de Estoque: <strong>Retorno físico concluído</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO DA ABA 3: RODÍZIO DA VEZ & UPSELL BARBEARIA */}
      {abaAtiva === 'rodizio_upsell' && dadosBarbearia && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
          {/* Card da Fila da Vez */}
          <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', color: '#0F172A', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🔄</span> Fila da Vez (Rodízio Oficial de Barbeiros)
            </h3>
            <p style={{ margin: '0 0 14px 0', fontSize: '0.85rem', color: '#64748B' }}>
              Distribuição equitativa de clientes sem agendamento (walk-ins) para equilíbrio de atendimentos e comissões.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {dadosBarbearia.filaDaVez.map((b, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: b.eProximo ? '#FEF3C7' : '#F8FAFC',
                    border: b.eProximo ? '2px solid #F59E0B' : '1px solid #E2E8F0'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: b.eProximo ? '#B45309' : '#64748B' }}>
                      #{b.posicaoFila}
                    </span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{b.profissionalNome}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{b.atendimentosHoje} atendimentos realizados hoje</div>
                    </div>
                  </div>
                  <div>
                    <span style={{
                      background: b.eProximo ? '#F59E0B' : (b.statusDisponibilidade === 'EM_ATENDIMENTO' ? '#E2E8F0' : '#DCFCE7'),
                      color: b.eProximo ? '#FFFFFF' : (b.statusDisponibilidade === 'EM_ATENDIMENTO' ? '#475569' : '#15803D'),
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '12px'
                    }}>
                      {b.statusDisponibilidade}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card de Upsell Sugestivo */}
          <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', color: '#0F172A', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🚀</span> Motor de Upsell Inteligente (Comanda Ativa)
            </h3>
            <p style={{ margin: '0 0 14px 0', fontSize: '0.85rem', color: '#64748B' }}>
              Sugestões automáticas no PDV quando o cliente agenda ou adiciona Corte ou Barba:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {dadosBarbearia.sugestoesUpsell.map((sug, idx) => (
                <div key={idx} style={{ padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ background: sug.tipo === 'servico' ? '#E0F2FE' : '#DCFCE7', color: sug.tipo === 'servico' ? '#0369A1' : '#15803D', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
                        {sug.tipo}
                      </span>
                      <div style={{ fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>{sug.item.nome}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748B' }}>Gatilho na comanda: {sug.gatilho}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#16A34A' }}>
                        + R$ {sug.ticketIncremento.toFixed(2)}
                      </div>
                      {sug.descontoCombo && (
                        <div style={{ fontSize: '0.75rem', color: '#DC2626' }}>
                          Economia: R$ {sug.descontoCombo.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
