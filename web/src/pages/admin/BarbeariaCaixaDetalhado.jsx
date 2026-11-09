import React, { useState, useEffect } from 'react';
import { api, fmtDateOnly, fmtR } from '../../lib/api';
import { Printer, Unlock, RefreshCw, X, AlertCircle, CheckCircle2, ChevronRight, Edit3, Calendar, Trash2, Eye, Send, Scissors, Search, Share2 } from 'lucide-react';

const moeda = (val) => fmtR(Number(val || 0));

export default function BarbeariaCaixaDetalhado({
  caixaId,
  data,
  profissionais = [],
  onOpenComanda,
  onCancelarComandaFinalizada,
  onCaixaAtualizado,
  toast,
}) {
  const [detalhes, setDetalhes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalDrilldown, setModalDrilldown] = useState(null); // { titulo, chave, total, comandas }
  const [modalReabrir, setModalReabrir] = useState(false);
  const [motivoReabertura, setMotivoReabertura] = useState('');
  const [reabrindo, setReabrindo] = useState(false);
  const [modalRelatorio, setModalRelatorio] = useState(false);
  const [modalTermico, setModalTermico] = useState(false);
  const [buscaDrilldown, setBuscaDrilldown] = useState('');
  const [profFiltroDrilldown, setProfFiltroDrilldown] = useState('');
  const [modalEdicaoPagamento, setModalEdicaoPagamento] = useState(null); // { comandaId, pagamentoId, meio, bandeira, valor }
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [modalAlterarDataComanda, setModalAlterarDataComanda] = useState(null); // { comandaId, dataAtual, titulo }
  const [novaDataComanda, setNovaDataComanda] = useState('');
  const [salvandoData, setSalvandoData] = useState(false);
  const [modalCancelarComanda, setModalCancelarComanda] = useState(null); // { comandaId, titulo, motivo, senhaGerente }
  const [cancelandoComanda, setCancelandoComanda] = useState(false);

  const carregarDetalhes = async () => {
    if (!caixaId) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/admin/barbearia/operacao/caixas/${caixaId}/detalhes`);
      if (res?.detalhes) {
        setDetalhes(res.detalhes);
      }
    } catch (e) {
      console.error(e);
      if (toast) toast(e.message || 'Erro ao carregar detalhes do caixa', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDetalhes();
  }, [caixaId]);

  const handleReabrir = async (e) => {
    e.preventDefault();
    if (!caixaId) return;
    try {
      setReabrindo(true);
      await api.post(`/api/admin/barbearia/operacao/caixas/${caixaId}/reabrir`, {
        confirmado: true,
        motivo: motivoReabertura || 'Reabertura para conferência e correções',
      });
      if (toast) toast('Caixa reaberto com sucesso! Agora você pode realizar correções.', 'success');
      setModalReabrir(false);
      setMotivoReabertura('');
      await carregarDetalhes();
      if (onCaixaAtualizado) onCaixaAtualizado();
    } catch (e) {
      if (toast) toast(e.message || 'Erro ao reabrir caixa', 'error');
    } finally {
      setReabrindo(false);
    }
  };

  const handleEnviarResumoWhatsApp = () => {
    if (!detalhes) return;
    const { caixa, formasPagamento, totalFaturado, dinheiroEsperado, movimentacoes, comissoes } = detalhes;
    const dataFormatada = caixa.data ? caixa.data.split('-').reverse().join('/') : data;
    const numeroCaixa = caixa.numeroCaixa || 1;
    const nomeCaixa = caixa.nomeCaixa || `Caixa ${numeroCaixa}`;
    const responsavel = caixa.responsavelNome || 'Operador';

    let texto = `💈 *BARBEARIA DINO — RESUMO DO CAIXA* 💈\n`;
    texto += `📅 *Data:* ${dataFormatada} · *${nomeCaixa}*\n`;
    texto += `👤 *Responsável:* ${responsavel}\n`;
    texto += `🔒 *Status:* ${caixa.status === 'aberto' ? '● CAIXA ABERTO' : '✓ CAIXA FECHADO'}\n\n`;

    texto += `💰 *TOTAL FATURADO:* ${moeda(totalFaturado)}\n`;
    texto += `💵 *Dinheiro em Gaveta:* ${moeda(dinheiroEsperado)} (Abertura: ${moeda(caixa.valorAbertura)})\n`;
    texto += `💳 *Cartão Débito:* ${moeda(formasPagamento?.cartao_debito?.total || 0)}\n`;
    texto += `💳 *Cartão Crédito:* ${moeda(formasPagamento?.cartao_credito?.total || 0)}\n`;
    texto += `📱 *Pix:* ${moeda(formasPagamento?.pix?.total || 0)}\n`;
    if (movimentacoes?.temMovimentacao) {
      texto += `🔻 *Sangrias:* ${moeda(movimentacoes.totalSangrias)} | 🔺 *Suprimentos:* ${moeda(movimentacoes.totalSuprimentos)}\n`;
    }

    if (comissoes?.profissionais?.length > 0) {
      texto += `\n✂️ *COMISSÕES DOS BARBEIROS NO CAIXA:*\n`;
      comissoes.profissionais.forEach((p) => {
        texto += `• *${p.nome}:* Faturou ${moeda(p.totalFaturado)} → Comissão: *${moeda(p.valorComissao)}*\n`;
      });
      texto += `👉 *Total de Comissões:* ${moeda(comissoes.totalComissoes)}\n`;
      texto += `🏢 *Líquido Barbearia Dino:* ${moeda(Math.max(0, totalFaturado - comissoes.totalComissoes))}\n`;
    }

    texto += `\n_Auditoria Kytto ERP Barbearia Dino_`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  };

  const handleSalvarEdicaoPagamento = async (e) => {
    e.preventDefault();
    if (!modalEdicaoPagamento) return;
    try {
      setSalvandoEdicao(true);
      await api.patch(
        `/api/admin/barbearia/comandas/${modalEdicaoPagamento.comandaId}/pagamentos/${modalEdicaoPagamento.pagamentoId}`,
        {
          meio: modalEdicaoPagamento.meio,
          bandeira: modalEdicaoPagamento.bandeira,
          motivo: 'Correção de pagamento com caixa reaberto',
        }
      );
      if (toast) toast('Forma de pagamento atualizada com sucesso!', 'success');
      setModalEdicaoPagamento(null);
      setModalDrilldown(null);
      await carregarDetalhes();
      if (onCaixaAtualizado) onCaixaAtualizado();
    } catch (e) {
      if (toast) toast(e.message || 'Erro ao atualizar pagamento', 'error');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const handleAlterarDataComanda = async (e) => {
    e.preventDefault();
    if (!modalAlterarDataComanda?.comandaId || !novaDataComanda) return;
    try {
      setSalvandoData(true);
      await api.post(`/api/admin/barbearia/comandas/${modalAlterarDataComanda.comandaId}/alterar-data`, {
        data: novaDataComanda,
      });
      if (toast) toast('Data da comanda alterada com sucesso!', 'success');
      setModalAlterarDataComanda(null);
      setModalDrilldown(null);
      await carregarDetalhes();
      if (onCaixaAtualizado) onCaixaAtualizado();
    } catch (err) {
      if (toast) toast(err.message || 'Erro ao alterar data da comanda', 'error');
    } finally {
      setSalvandoData(false);
    }
  };

  const handleCancelarComandaCaixa = async (e) => {
    e.preventDefault();
    if (!modalCancelarComanda?.comandaId) return;
    try {
      setCancelandoComanda(true);
      if (onCancelarComandaFinalizada) {
        await onCancelarComandaFinalizada(
          { id: modalCancelarComanda.comandaId, clienteNome: modalCancelarComanda.titulo },
          {
            motivo: modalCancelarComanda.motivo || 'Cancelamento solicitado pelo caixa',
            senhaGerente: modalCancelarComanda.senhaGerente,
            reabrirAgendamento: false,
          }
        );
      } else {
        await api.post(`/api/admin/barbearia/comandas/${modalCancelarComanda.comandaId}/cancelar-finalizada`, {
          motivo: modalCancelarComanda.motivo || 'Cancelamento solicitado pelo caixa',
          senhaGerente: modalCancelarComanda.senhaGerente,
          confirmado: true,
        });
      }
      if (toast) toast('Comanda cancelada e estornada com sucesso!', 'success');
      setModalCancelarComanda(null);
      setModalDrilldown(null);
      await carregarDetalhes();
      if (onCaixaAtualizado) onCaixaAtualizado();
    } catch (err) {
      if (toast) toast(err.message || 'Erro ao cancelar comanda', 'error');
    } finally {
      setCancelandoComanda(false);
    }
  };

  if (loading && !detalhes) {
    return (
      <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)', background: 'var(--card)', borderRadius: 12, border: '1px solid var(--line)' }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
        <div>Carregando conferência detalhada do caixa...</div>
      </div>
    );
  }

  if (!detalhes || !detalhes.caixa) {
    return null;
  }

  const { caixa, formasPagamento = {}, totalFaturado = 0, movimentacoes = {}, itensRelatorioFechamento = [] } = detalhes;
  const diaNumero = caixa.data ? String(caixa.data).slice(8, 10) : '';

  const abrirDrilldown = (chave, tituloCustom) => {
    const agrupamento = detalhes.comandasPorMeio?.[chave];
    if (agrupamento && agrupamento.comandas?.length > 0) {
      setModalDrilldown({
        titulo: tituloCustom || agrupamento.titulo,
        chave,
        total: agrupamento.total,
        comandas: agrupamento.comandas,
      });
    } else {
      if (toast) toast(`Nenhuma comanda vinculada a ${tituloCustom || chave}.`, 'info');
    }
  };

  return (
    <div style={{ background: '#f8fafc', color: '#1e293b', borderRadius: 12, border: '1px solid #cbd5e1', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', fontFamily: 'sans-serif' }}>
      
      {/* CABEÇALHO DO CAIXA NO PADRÃO AVEC */}
      <div style={{ background: '#ffffff', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#64748b', border: '2px solid #cbd5e1' }}>
            👤
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Responsável: <span style={{ color: '#2563eb' }}>{caixa.responsavelNome || 'Dino'}</span>
            </div>
            {caixa.responsavelEmail && (
              <div style={{ fontSize: 13, color: '#64748b' }}>E-mail: {caixa.responsavelEmail}</div>
            )}
            <div style={{ fontSize: 12, color: '#475569', marginTop: 4, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '4px 16px' }}>
              <div><strong>Abertura:</strong> {caixa.abertoEmFormatado}</div>
              <div><strong>Fechamento:</strong> {caixa.fechadoEmFormatado}</div>
              <div><strong>Data modificação:</strong> {caixa.atualizadoEmFormatado}</div>
              <div><strong>Última modificação:</strong> {caixa.responsavelNome}</div>
              <div><strong>Valor Inicial (Dinheiro):</strong> {moeda(caixa.valorAbertura)}</div>
              <div><strong>Valor Inicial (Cheque):</strong> {moeda(0)}</div>
            </div>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO SUPERIORES */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setModalRelatorio(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1e293b' }}
            title="Visualizar e Imprimir Relatório de Fechamento"
          >
            <Printer size={16} color="#2563eb" /> Imprimir Relatório
          </button>
          <button
            type="button"
            onClick={() => setModalTermico(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1e293b' }}
            title="Visualizar e Imprimir Cupom Térmico 80mm para Impressora de Balcão"
          >
            <Printer size={16} color="#059669" /> Cupom 80mm
          </button>
          <button
            type="button"
            onClick={handleEnviarResumoWhatsApp}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#25d366', color: '#ffffff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
            title="Enviar Resumo do Fechamento no WhatsApp da Gerência"
          >
            <Send size={15} /> WhatsApp
          </button>
          {caixa.status === 'aberto' ? (
            <span style={{ background: '#dcfce7', color: '#15803d', padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
              ● Caixa Aberto
            </span>
          ) : (
            <span style={{ background: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
              ✓ Caixa Fechado
            </span>
          )}
        </div>
      </div>

      {/* BLOCO SANGRIAS E SUPRIMENTOS */}
      <div style={{ padding: '12px 20px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', fontSize: 13 }}>
        <strong style={{ color: '#475569', display: 'block', marginBottom: 4 }}>Sangrias e Suprimentos</strong>
        {movimentacoes.temMovimentacao ? (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>Sangrias: <strong style={{ color: '#dc2626' }}>{moeda(movimentacoes.totalSangrias)}</strong> ({movimentacoes.sangrias.length})</span>
            <span>Suprimentos: <strong style={{ color: '#16a34a' }}>{moeda(movimentacoes.totalSuprimentos)}</strong> ({movimentacoes.suprimentos.length})</span>
          </div>
        ) : (
          <span style={{ color: '#64748b' }}>Nenhuma movimentação</span>
        )}
      </div>

      {/* TABELA DE FORMAS DE PAGAMENTO NO PADRÃO AVEC (CLICÁVEL) */}
      <div style={{ padding: '16px 20px', background: '#ffffff' }}>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontStyle: 'italic' }}>
          💡 Dica: Toque em qualquer forma de pagamento para listar as comandas correspondentes.
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #cbd5e1', color: '#64748b', fontSize: 12, textTransform: 'uppercase' }}>
              <th style={{ padding: '8px 12px' }}>Pagamentos</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Sist.</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Dif.</th>
            </tr>
          </thead>
          <tbody>
            {/* DINHEIRO */}
            <tr
              onClick={() => abrirDrilldown('dinheiro', 'Dinheiro')}
              style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: 'transparent' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                Dinheiro {formasPagamento.dinheiro?.quantidade > 0 && `(${formasPagamento.dinheiro.quantidade})`}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{moeda(formasPagamento.dinheiro?.total)}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>0,00</td>
            </tr>

            {/* CARTÃO CRÉDITO */}
            <tr
              onClick={() => abrirDrilldown('cartao_credito', 'Cartão Crédito')}
              style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                Cartão Crédito {formasPagamento.cartao_credito?.quantidade > 0 && `(${formasPagamento.cartao_credito.quantidade})`}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{moeda(formasPagamento.cartao_credito?.total)}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>0,00</td>
            </tr>
            {/* SUB-BANDEIRAS CRÉDITO */}
            {Object.entries(formasPagamento.cartao_credito?.bandeiras || {}).map(([bandeira, info]) => (
              <tr
                key={`cred_${bandeira}`}
                onClick={(e) => {
                  e.stopPropagation();
                  abrirDrilldown(`cartao_credito_${bandeira.toLowerCase().replace(/\s+/g, '_')}`, `Cartão Crédito / ${bandeira}`);
                }}
                style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer', color: '#475569', fontSize: 13 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '6px 12px 6px 28px' }}>
                  — {bandeira} ({info.quantidade})
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'right' }}>{moeda(info.total)}</td>
                <td style={{ padding: '6px 12px', textAlign: 'right', color: '#94a3b8' }}>—</td>
              </tr>
            ))}

            {/* CARTÃO DÉBITO */}
            <tr
              onClick={() => abrirDrilldown('cartao_debito', 'Cartão Débito')}
              style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                Cartão Débito {formasPagamento.cartao_debito?.quantidade > 0 && `(${formasPagamento.cartao_debito.quantidade})`}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{moeda(formasPagamento.cartao_debito?.total)}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>0,00</td>
            </tr>
            {/* SUB-BANDEIRAS DÉBITO */}
            {Object.entries(formasPagamento.cartao_debito?.bandeiras || {}).map(([bandeira, info]) => (
              <tr
                key={`deb_${bandeira}`}
                onClick={(e) => {
                  e.stopPropagation();
                  abrirDrilldown(`cartao_debito_${bandeira.toLowerCase().replace(/\s+/g, '_')}`, `Cartão Débito / ${bandeira}`);
                }}
                style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer', color: '#475569', fontSize: 13 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '6px 12px 6px 28px' }}>
                  — {bandeira} ({info.quantidade})
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'right' }}>{moeda(info.total)}</td>
                <td style={{ padding: '6px 12px', textAlign: 'right', color: '#94a3b8' }}>—</td>
              </tr>
            ))}

            {/* PIX */}
            <tr
              onClick={() => abrirDrilldown('pix', 'Pix')}
              style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                Pix {formasPagamento.pix?.quantidade > 0 && `(${formasPagamento.pix.quantidade})`}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{moeda(formasPagamento.pix?.total)}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>0,00</td>
            </tr>

            {/* OUTRAS FORMAS */}
            {[
              ['cheque', 'Cheque'],
              ['boleto', 'Boleto'],
              ['transferencia', 'Transferência'],
              ['deposito', 'Depósito'],
              ['voucher', 'Voucher'],
              ['permuta', 'Permuta'],
              ['cortesia', 'Cortesia'],
              ['credito_utilizado', 'Crédito Utilizado'],
              ['dividas', 'Dívidas / Em Conta'],
            ].map(([chave, label]) => {
              const info = formasPagamento[chave];
              if (!info || (info.total === 0 && info.quantidade === 0 && !['cheque', 'boleto', 'transferencia'].includes(chave))) {
                return null;
              }
              return (
                <tr
                  key={chave}
                  onClick={() => abrirDrilldown(chave, label)}
                  style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '8px 12px', color: '#334155' }}>
                    {label} {info.quantidade > 0 && `(${info.quantidade})`}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{moeda(info.total)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>0,00</td>
                </tr>
              );
            })}

            {/* TOTAL FATURADO */}
            <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 800 }}>
              <td style={{ padding: '12px', color: '#0f172a', fontSize: 15 }}>TOTAL FATURADO</td>
              <td style={{ padding: '12px', textAlign: 'right', color: '#2563eb', fontSize: 16 }}>{moeda(totalFaturado)}</td>
              <td style={{ padding: '12px', textAlign: 'right', color: '#64748b' }}>0,00</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* BLOCO DE RATEIO E COMISSÕES DA EQUIPE NO CAIXA */}
      {detalhes.comissoes?.profissionais?.length > 0 && (
        <div style={{ padding: '16px 20px', background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Scissors size={16} color="#2563eb" /> Rateio de Comissões dos Barbeiros no Caixa
            </h4>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Total Comissões: <strong style={{ color: '#0284c7' }}>{moeda(detalhes.comissoes.totalComissoes)}</strong> · Líquido Barbearia: <strong style={{ color: '#16a34a' }}>{moeda(Math.max(0, totalFaturado - detalhes.comissoes.totalComissoes))}</strong>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8 }}>
              <thead>
                <tr style={{ background: '#f1f5f9', color: '#475569', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Barbeiro</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qtd Serv.</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total Serviços</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qtd Prod.</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total Produtos</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Taxa Base</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Comissão a Pagar</th>
                </tr>
              </thead>
              <tbody>
                {detalhes.comissoes.profissionais.map((p) => (
                  <tr key={p.profissionalId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1e293b' }}>
                      👤 {p.nome}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{p.quantidadeServicos}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{moeda(p.totalServicos)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{p.quantidadeProdutos}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>{moeda(p.totalProdutos)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                        {p.comissaoPercent}%
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#16a34a', fontSize: 14 }}>
                      {moeda(p.valorComissao)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RODAPÉ DO CARD COM BOTÃO DE REABRIR CAIXA (IDÊNTICO À FOTO 1) */}
      <div style={{ padding: '16px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 13, color: '#64748b' }}>
          {caixa.status === 'fechado' ? (
            <span>Caixa fechado. Caso precise corrigir uma forma de pagamento ou valor lançado, reabra o caixa.</span>
          ) : (
            <span style={{ color: '#16a34a', fontWeight: 600 }}>Caixa aberto para registros e correções operacionais.</span>
          )}
        </div>

        {caixa.status === 'fechado' && (
          <button
            type="button"
            onClick={() => setModalReabrir(true)}
            style={{
              padding: '10px 20px',
              background: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
            }}
          >
            <Unlock size={16} /> Reabrir Caixa
          </button>
        )}
      </div>

      {/* MODAL DE DRILLDOWN DE COMANDAS (IDÊNTICO À FOTO 2) */}
      {modalDrilldown && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#ffffff', borderRadius: 12, maxWidth: 640, width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
            <div style={{ background: '#2563eb', color: '#ffffff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>
                  Comandas do caixa responsável: {caixa.responsavelNome}
                </div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  Dia: {diaNumero || fmtDateOnly(caixa.data)}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>
                  Por: {modalDrilldown.titulo} /
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalDrilldown(null)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* BARRA DE PESQUISA E FILTRO */}
            <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Buscar por cliente, comanda ou serviço..."
                  value={buscaDrilldown}
                  onChange={(e) => setBuscaDrilldown(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px 6px 30px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                />
              </div>
              <select
                value={profFiltroDrilldown}
                onChange={(e) => setProfFiltroDrilldown(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, background: '#ffffff', color: '#1e293b' }}
              >
                <option value="">Todos os barbeiros</option>
                {profissionais.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>

            <div style={{ padding: '16px 20px', maxHeight: '60vh', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: 12, textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Comanda & Cliente</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Barbeiro</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Itens / Serviços</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Valor</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {modalDrilldown.comandas.filter((item) => {
                    if (buscaDrilldown) {
                      const termo = buscaDrilldown.toLowerCase();
                      const bateTitulo = String(item.titulo || '').toLowerCase().includes(termo);
                      const bateCliente = String(item.clienteNome || '').toLowerCase().includes(termo);
                      const bateItens = (item.itens || []).some((it) => String(it.nome || '').toLowerCase().includes(termo));
                      if (!bateTitulo && !bateCliente && !bateItens) return false;
                    }
                    if (profFiltroDrilldown) {
                      const profId = profFiltroDrilldown;
                      const bateComanda = item.profissionalId === profId;
                      const bateItem = (item.itens || []).some((it) => it.profissionalId === profId);
                      if (!bateComanda && !bateItem) return false;
                    }
                    return true;
                  }).map((item, index) => (
                    <tr key={`${item.comandaId}-${index}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 10px', color: '#1e293b' }}>
                        <div style={{ fontWeight: 700 }}>{item.titulo}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>📅 {item.dataAtendimento || data}</span>
                          {item.bandeira && <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>{item.bandeira}</span>}
                        </div>
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 13, color: '#334155', fontWeight: 600 }}>
                        👤 {item.profissionalNome || 'Não definido'}
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 12, color: '#475569' }}>
                        {item.itens && item.itens.length > 0 ? (
                          <div style={{ display: 'grid', gap: 2 }}>
                            {item.itens.map((it, idx) => (
                              <span key={it.id || idx}>
                                • {it.nome} {it.profissionalNome && it.profissionalNome !== item.profissionalNome ? `(${it.profissionalNome})` : ''} ({moeda(it.subtotal || it.precoUnitario)})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>{moeda(item.valor)}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {onOpenComanda && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenComanda({ id: item.comandaId });
                                setModalDrilldown(null);
                              }}
                              style={{ background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                              title="Abrir comanda completa para editar itens ou profissionais"
                            >
                              <Eye size={12} /> Abrir
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setNovaDataComanda(item.dataAtendimento || data);
                              setModalAlterarDataComanda({
                                comandaId: item.comandaId,
                                dataAtual: item.dataAtendimento || data,
                                titulo: item.titulo,
                              });
                            }}
                            style={{ background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                            title="Mover data desta comanda para outro dia"
                          >
                            <Calendar size={12} /> Data
                          </button>
                          {caixa.status === 'aberto' && (
                            <button
                              type="button"
                              onClick={() => {
                                setModalEdicaoPagamento({
                                  comandaId: item.comandaId,
                                  pagamentoId: item.pagamentoId,
                                  meio: item.meio,
                                  bandeira: item.bandeira || '',
                                  valor: item.valor,
                                  titulo: item.titulo,
                                });
                              }}
                              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                              title="Corrigir forma de pagamento"
                            >
                              <Edit3 size={12} /> Meio
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setModalCancelarComanda({
                                comandaId: item.comandaId,
                                titulo: item.titulo,
                                motivo: 'Cancelamento solicitado pelo caixa',
                                senhaGerente: '',
                              });
                            }}
                            style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #f87171', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                            title="Cancelar e excluir comanda do caixa"
                          >
                            <Trash2 size={12} /> Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid #cbd5e1', fontWeight: 800 }}>
                    <td style={{ padding: '12px 10px' }} colSpan={3}>Total</td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', color: '#2563eb' }}>{moeda(modalDrilldown.total)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setModalDrilldown(null)}
                style={{ padding: '8px 18px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE REABERTURA DE CAIXA */}
      {modalReabrir && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#ffffff', borderRadius: 12, maxWidth: 480, width: '100%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, color: '#dc2626' }}>
              <Unlock size={28} />
              <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Reabrir Caixa {caixa.numeroCaixa}</h3>
            </div>
            <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Ao reabrir este caixa, o status retornará para <strong>Aberto</strong>. Você poderá alterar comandas, corrigir formas de pagamento incorretas (ex.: mudar de débito para crédito ou bandeira) e fazer novos lançamentos antes de fechá-lo novamente.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Motivo da reabertura (Opcional):
              </label>
              <input
                type="text"
                value={motivoReabertura}
                onChange={(e) => setMotivoReabertura(e.target.value)}
                placeholder="Ex.: Cliente pagou no débito e registraram como crédito"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setModalReabrir(false)}
                disabled={reabrindo}
                style={{ padding: '9px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReabrir}
                disabled={reabrindo}
                style={{ padding: '9px 16px', background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
              >
                {reabrindo ? 'Reabrindo...' : 'Confirmar Reabertura'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE FORMA DE PAGAMENTO (QUANDO CAIXA ESTIVER REABERTO) */}
      {modalEdicaoPagamento && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
          <div style={{ background: '#ffffff', borderRadius: 12, maxWidth: 440, width: '100%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', border: '1px solid #cbd5e1' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 18, color: '#0f172a' }}>Corrigir Forma de Pagamento</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
              {modalEdicaoPagamento.titulo} · Valor: <strong>{moeda(modalEdicaoPagamento.valor)}</strong>
            </p>
            <form onSubmit={handleSalvarEdicaoPagamento} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Forma de Pagamento:
                </label>
                <select
                  value={modalEdicaoPagamento.meio}
                  onChange={(e) => setModalEdicaoPagamento((prev) => ({ ...prev, meio: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                >
                  <option value="debito">Cartão Débito</option>
                  <option value="credito">Cartão Crédito</option>
                  <option value="pix">Pix</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="transferencia">Transferência</option>
                  <option value="conta">Em Conta / Dívida</option>
                  <option value="cheque">Cheque</option>
                  <option value="boleto">Boleto</option>
                </select>
              </div>

              {['debito', 'credito'].includes(modalEdicaoPagamento.meio) && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Bandeira do Cartão:
                  </label>
                  <select
                    value={modalEdicaoPagamento.bandeira || ''}
                    onChange={(e) => setModalEdicaoPagamento((prev) => ({ ...prev, bandeira: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  >
                    <option value="">(Sem bandeira / Padrão)</option>
                    <option value="MasterCard">MasterCard</option>
                    <option value="Visa">Visa</option>
                    <option value="ELO">ELO</option>
                    <option value="Hipercard">Hipercard</option>
                    <option value="American Express">American Express</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalEdicaoPagamento(null)}
                  disabled={salvandoEdicao}
                  style={{ padding: '9px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoEdicao}
                  style={{ padding: '9px 16px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                >
                  {salvandoEdicao ? 'Salvando...' : 'Salvar Alteração'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE ALTERAÇÃO DE DATA DA COMANDA (EX.: MOVER DO DIA 09/11 PARA 02/11 OU 03/11) */}
      {modalAlterarDataComanda && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: 16 }}>
          <div style={{ background: '#ffffff', borderRadius: 12, maxWidth: 440, width: '100%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, color: '#0284c7' }}>
              <Calendar size={24} />
              <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Alterar Data da Comanda</h3>
            </div>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16, lineHeight: 1.4 }}>
              <strong>{modalAlterarDataComanda.titulo}</strong><br />
              Data atual registrada: <strong>{modalAlterarDataComanda.dataAtual || 'Hoje'}</strong>.<br />
              Mover esta comanda atualizará a data de competência no caixa correspondente e o cálculo de comissões.
            </p>
            <form onSubmit={handleAlterarDataComanda} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Nova data oficial da comanda:
                </label>
                <input
                  type="date"
                  value={novaDataComanda}
                  onChange={(e) => setNovaDataComanda(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalAlterarDataComanda(null)}
                  disabled={salvandoData}
                  style={{ padding: '9px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoData || !novaDataComanda}
                  style={{ padding: '9px 16px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                >
                  {salvandoData ? 'Alterando...' : 'Salvar Nova Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CANCELAMENTO SEGURO DE COMANDA FINALIZADA COM SENHA DE GERENTE */}
      {modalCancelarComanda && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: 16 }}>
          <div style={{ background: '#ffffff', borderRadius: 12, maxWidth: 480, width: '100%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, color: '#dc2626' }}>
              <Trash2 size={24} />
              <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Cancelar e Estornar Comanda</h3>
            </div>
            <p style={{ color: '#475569', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
              Você está prestes a cancelar a <strong>{modalCancelarComanda.titulo}</strong>.<br />
              Esta ação irá <strong>estornar o valor do caixa</strong>, anular os lançamentos financeiros vinculados e <strong>zerar a comissão do profissional</strong> dessa comanda.
            </p>
            <form onSubmit={handleCancelarComandaCaixa} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Motivo do cancelamento:
                </label>
                <input
                  type="text"
                  value={modalCancelarComanda.motivo}
                  onChange={(e) => setModalCancelarComanda((prev) => ({ ...prev, motivo: e.target.value }))}
                  required
                  placeholder="Ex.: Comanda indevida de outro mês ou digitada por engano"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Senha de Gerente / Administrador:
                </label>
                <input
                  type="password"
                  value={modalCancelarComanda.senhaGerente}
                  onChange={(e) => setModalCancelarComanda((prev) => ({ ...prev, senhaGerente: e.target.value }))}
                  placeholder="Informe a senha de gerente para autorizar"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                />
                <small style={{ color: '#64748b', fontSize: 11, marginTop: 4, display: 'block' }}>
                  Se já estiver conectado como Gerente ou Admin, a confirmação poderá ser liberada automaticamente.
                </small>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalCancelarComanda(null)}
                  disabled={cancelandoComanda}
                  style={{ padding: '9px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569' }}
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={cancelandoComanda}
                  style={{ padding: '9px 16px', background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                >
                  {cancelandoComanda ? 'Estornando...' : 'Confirmar Cancelamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL / TELA DE IMPRESSÃO DO RELATÓRIO DE FECHAMENTO (IDÊNTICO À FOTO 3) */}
      {modalRelatorio && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#ffffff', borderRadius: 12, maxWidth: 840, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
            
            {/* BARRA SUPERIOR DE AÇÕES (NÃO IMPRESSA) */}
            <div className="dadm-no-print" style={{ padding: '14px 20px', background: '#0f172a', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                📄 Visualização de Impressão — Relatório Caixa
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{ background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 6, padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Printer size={16} /> Imprimir / PDF
                </button>
                <button
                  type="button"
                  onClick={() => setModalRelatorio(false)}
                  style={{ background: 'transparent', border: '1px solid #475569', color: '#ffffff', borderRadius: 6, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* ÁREA IMPRIMÍVEL DO RELATÓRIO (PADRÃO FOTO 3) */}
            <div id="relatorio-caixa-imprimir" style={{ padding: '30px 40px', overflowY: 'auto', flex: 1, color: '#000000', background: '#ffffff', fontFamily: 'monospace, Arial, sans-serif' }}>
              
              {/* CABEÇALHO */}
              <div style={{ borderBottom: '1px solid #000000', paddingBottom: 12, marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 20, textTransform: 'uppercase' }}>Dino barbearia</h2>
                <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>
                  Data da impressão: {detalhes.dataImpressao}
                </div>
                <h3 style={{ margin: '12px 0 6px 0', fontSize: 16, textTransform: 'uppercase' }}>Relatório Caixa</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12 }}>
                  <div><strong>Responsável:</strong> {caixa.responsavelNome}</div>
                  <div><strong>Abertura:</strong> {caixa.abertoEmFormatado}</div>
                  <div><strong>E-mail:</strong> {caixa.responsavelEmail || 'guicunha136@gmail.com'}</div>
                  <div><strong>Fechamento:</strong> {caixa.fechadoEmFormatado}</div>
                  <div><strong>Valor Inicial (Dinheiro):</strong> {moeda(caixa.valorAbertura)}</div>
                  <div><strong>Data modificação:</strong> {caixa.atualizadoEmFormatado}</div>
                  <div><strong>Valor Inicial (Cheque):</strong> 0,00</div>
                  <div><strong>Última modificação:</strong> {caixa.responsavelNome}</div>
                </div>
              </div>

              {/* SANGRIAS E SUPRIMENTOS */}
              <div style={{ marginBottom: 16, fontSize: 12 }}>
                <strong style={{ display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Sangrias e Suprimentos</strong>
                {movimentacoes.temMovimentacao ? (
                  <div>
                    {movimentacoes.sangrias.map((s, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                        <span>Sangria — {s.descricao}</span>
                        <span>{moeda(s.valor)}</span>
                      </div>
                    ))}
                    {movimentacoes.suprimentos.map((s, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                        <span>Suprimento — {s.descricao}</span>
                        <span>{moeda(s.valor)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>Nenhuma movimentação</div>
                )}
              </div>

              {/* TOTAL EM CAIXA POR FORMA DE PAGAMENTO */}
              <div style={{ marginBottom: 20 }}>
                <strong style={{ display: 'block', marginBottom: 6, fontSize: 12, textTransform: 'uppercase' }}>Total em Caixa</strong>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <tbody>
                    <tr><td style={{ padding: '2px 0' }}>Dinheiro</td><td style={{ textAlign: 'right' }}>{moeda(formasPagamento.dinheiro?.total)}</td></tr>
                    <tr><td style={{ padding: '2px 0 2px 14px', color: '#555' }}>- Sangrias/Supr.</td><td style={{ textAlign: 'right', color: '#555' }}>{moeda(movimentacoes.totalSuprimentos - movimentacoes.totalSangrias)}</td></tr>
                    
                    <tr><td style={{ padding: '2px 0' }}>Cartão Crédito</td><td style={{ textAlign: 'right' }}>{moeda(formasPagamento.cartao_credito?.total)}</td></tr>
                    {Object.entries(formasPagamento.cartao_credito?.bandeiras || {}).map(([bandeira, info]) => (
                      <tr key={`rel_cred_${bandeira}`}><td style={{ padding: '2px 0 2px 14px', color: '#555' }}>- {bandeira}</td><td style={{ textAlign: 'right', color: '#555' }}>{moeda(info.total)}</td></tr>
                    ))}

                    <tr><td style={{ padding: '2px 0' }}>Cartão Débito</td><td style={{ textAlign: 'right' }}>{moeda(formasPagamento.cartao_debito?.total)}</td></tr>
                    {Object.entries(formasPagamento.cartao_debito?.bandeiras || {}).map(([bandeira, info]) => (
                      <tr key={`rel_deb_${bandeira}`}><td style={{ padding: '2px 0 2px 14px', color: '#555' }}>- {bandeira}</td><td style={{ textAlign: 'right', color: '#555' }}>{moeda(info.total)}</td></tr>
                    ))}

                    <tr><td style={{ padding: '2px 0' }}>Cheque</td><td style={{ textAlign: 'right' }}>0,00</td></tr>
                    <tr><td style={{ padding: '2px 0' }}>Boleto</td><td style={{ textAlign: 'right' }}>0,00</td></tr>
                    <tr><td style={{ padding: '2px 0' }}>Transferência</td><td style={{ textAlign: 'right' }}>0,00</td></tr>
                    <tr><td style={{ padding: '2px 0' }}>Pix</td><td style={{ textAlign: 'right' }}>{moeda(formasPagamento.pix?.total)}</td></tr>
                    <tr><td style={{ padding: '2px 0' }}>Depósito</td><td style={{ textAlign: 'right' }}>0,00</td></tr>
                    <tr style={{ borderTop: '1px solid #000', fontWeight: 'bold' }}>
                      <td style={{ padding: '4px 0' }}>TOTAL FATURADO</td>
                      <td style={{ textAlign: 'right', padding: '4px 0' }}>{moeda(totalFaturado)}</td>
                    </tr>
                    <tr><td style={{ padding: '2px 0' }}>Cortesia</td><td style={{ textAlign: 'right' }}>{moeda(formasPagamento.cortesia?.total)}</td></tr>
                    <tr><td style={{ padding: '2px 0' }}>Crédito Utilizado</td><td style={{ textAlign: 'right' }}>{moeda(formasPagamento.credito_utilizado?.total)}</td></tr>
                    <tr><td style={{ padding: '2px 0' }}>Dívidas / Em Conta</td><td style={{ textAlign: 'right' }}>{moeda(formasPagamento.dividas?.total)}</td></tr>
                  </tbody>
                </table>
              </div>

              {/* TABELA DETALHADA DE COMANDAS E CLIENTES (PADRÃO EXATO FOTO 3) */}
              <div style={{ marginTop: 20 }}>
                <strong style={{ display: 'block', marginBottom: 8, fontSize: 12, textTransform: 'uppercase', borderBottom: '1px solid #000', paddingBottom: 4 }}>
                  Detalhamento de Comandas e Formas de Pagamento
                </strong>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #000', textAlign: 'left' }}>
                      <th style={{ padding: '4px 6px' }}>Forma de Pagamento</th>
                      <th style={{ padding: '4px 6px' }}>Comanda / Cliente</th>
                      <th style={{ padding: '4px 6px', textAlign: 'right' }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensRelatorioFechamento.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ padding: '12px 6px', textAlign: 'center', color: '#666' }}>
                          Nenhuma comanda vinculada a este caixa.
                        </td>
                      </tr>
                    ) : (
                      itensRelatorioFechamento.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                          <td style={{ padding: '4px 6px' }}>{item.formaPagamento}</td>
                          <td style={{ padding: '4px 6px' }}>{item.comandaTexto}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'right' }}>{moeda(item.valor)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL / TELA DE IMPRESSÃO DE CUPOM TÉRMICO 80MM (PADRÃO BALCÃO / MAQUININHA) */}
      {modalTermico && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#ffffff', borderRadius: 12, maxWidth: 440, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
            <div className="dadm-no-print" style={{ padding: '14px 20px', background: '#065f46', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Printer size={16} /> Cupom Térmico (80mm)
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{ background: '#ffffff', color: '#065f46', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                >
                  Imprimir 80mm
                </button>
                <button
                  type="button"
                  onClick={() => setModalTermico(false)}
                  style={{ background: 'transparent', border: '1px solid #34d399', color: '#ffffff', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* CUPOM 80MM */}
            <div id="cupom-termico-imprimir" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, color: '#000000', background: '#ffffff', fontFamily: 'Courier New, monospace', fontSize: 12, lineHeight: 1.4 }}>
              <div style={{ textAlign: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>BARBEARIA DINO</div>
                <div style={{ fontSize: 10, color: '#444' }}>Cuiabá - MT · Tel: (65) 99352-2260</div>
                <div style={{ fontWeight: 700, margin: '6px 0 2px' }}>FECHAMENTO DE CAIXA (80MM)</div>
                <div>----------------------------------------</div>
              </div>

              <div style={{ marginBottom: 8, fontSize: 11 }}>
                <div><strong>Caixa:</strong> {caixa.nomeCaixa || `Caixa ${caixa.numeroCaixa}`}</div>
                <div><strong>Data:</strong> {caixa.data} · <strong>Hora:</strong> {detalhes.dataImpressao}</div>
                <div><strong>Operador:</strong> {caixa.responsavelNome}</div>
                <div><strong>Status:</strong> {caixa.status.toUpperCase()}</div>
                <div>----------------------------------------</div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>RESUMO FINANCEIRO:</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>(+) Valor Abertura:</span>
                  <strong>{moeda(caixa.valorAbertura)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>(+) Dinheiro Recebido:</span>
                  <strong>{moeda(formasPagamento.dinheiro?.total || 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>(+) Suprimentos:</span>
                  <strong>{moeda(movimentacoes.totalSuprimentos)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>(-) Sangrias:</span>
                  <strong>{moeda(movimentacoes.totalSangrias)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #000', paddingTop: 3, marginTop: 3 }}>
                  <span>(=) DINHEIRO EM GAVETA:</span>
                  <strong>{moeda(dinheiroEsperado)}</strong>
                </div>
                <div>----------------------------------------</div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>FORMAS ELETRÔNICAS:</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cartão Débito:</span>
                  <strong>{moeda(formasPagamento.cartao_debito?.total || 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cartão Crédito:</span>
                  <strong>{moeda(formasPagamento.cartao_credito?.total || 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Pix:</span>
                  <strong>{moeda(formasPagamento.pix?.total || 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #000', paddingTop: 4, marginTop: 4, fontSize: 13 }}>
                  <span>TOTAL FATURADO:</span>
                  <strong>{moeda(totalFaturado)}</strong>
                </div>
                <div>----------------------------------------</div>
              </div>

              {detalhes.comissoes?.profissionais?.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>COMISSÕES DOS BARBEIROS:</div>
                  {detalhes.comissoes.profissionais.map((p) => (
                    <div key={p.profissionalId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{p.nome}:</span>
                      <strong>{moeda(p.valorComissao)}</strong>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #000', paddingTop: 3, marginTop: 3 }}>
                    <span>Total Comissões:</span>
                    <strong>{moeda(detalhes.comissoes.totalComissoes)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Líquido Barbearia:</span>
                    <strong>{moeda(Math.max(0, totalFaturado - detalhes.comissoes.totalComissoes))}</strong>
                  </div>
                  <div>----------------------------------------</div>
                </div>
              )}

              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <div>____________________________________</div>
                <div style={{ fontSize: 10, marginTop: 2 }}>Assinatura do Operador</div>
                <div style={{ marginTop: 15 }}>____________________________________</div>
                <div style={{ fontSize: 10, marginTop: 2 }}>Assinatura do Gerente</div>
                <div style={{ fontSize: 9, color: '#666', marginTop: 10 }}>Kytto ERP Barbearia Dino</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ESTILOS DE IMPRESSÃO */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #relatorio-caixa-imprimir, #relatorio-caixa-imprimir *, #cupom-termico-imprimir, #cupom-termico-imprimir * {
            visibility: visible;
          }
          #relatorio-caixa-imprimir {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
          }
          #cupom-termico-imprimir {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            margin: 0;
            padding: 5mm;
          }
          .dadm-no-print {
            display: none !important;
          }
        }
      `}} />

    </div>
  );
}
