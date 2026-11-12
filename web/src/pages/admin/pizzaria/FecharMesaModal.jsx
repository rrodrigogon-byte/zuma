import React, { useState, useMemo } from 'react';
import Modal from '../../../components/Modal';

const MEIOS = [
  { id: 'pix', nome: 'PIX Instantâneo', icone: '⚡', cor: '#10b981' },
  { id: 'cartao', nome: 'Cartão Crédito', icone: '💳', cor: '#6366f1' },
  { id: 'debito', nome: 'Cartão Débito', icone: '💳', cor: '#3b82f6' },
  { id: 'dinheiro', nome: 'Dinheiro', icone: '💵', cor: '#f59e0b' },
];

export default function FecharMesaModal({
  isOpen,
  onClose,
  mesa,
  comanda,
  onConfirmarFechamento,
}) {
  const [incluirServico, setIncluirServico] = useState(true);
  const [dividirPessoas, setDividirPessoas] = useState(1);
  const [descontoPercentual, setDescontoPercentual] = useState(0);
  const [meioPagamento, setMeioPagamento] = useState('pix');
  const [salvando, setSalvando] = useState(false);

  const subtotal = useMemo(() => {
    return Number(comanda?.total || mesa?.total || 0);
  }, [comanda, mesa]);

  const calculo = useMemo(() => {
    const descontoValor = Number((subtotal * (Number(descontoPercentual) / 100)).toFixed(2));
    const subtotalComDesconto = Math.max(0, subtotal - descontoValor);
    const taxaServicoValor = incluirServico ? Number((subtotalComDesconto * 0.10).toFixed(2)) : 0;
    const totalFinal = Number((subtotalComDesconto + taxaServicoValor).toFixed(2));
    const pessoas = Math.max(1, parseInt(dividirPessoas, 10) || 1);
    const valorPorPessoa = Number((totalFinal / pessoas).toFixed(2));

    return {
      subtotal,
      descontoValor,
      subtotalComDesconto,
      taxaServicoValor,
      totalFinal,
      pessoas,
      valorPorPessoa,
    };
  }, [subtotal, incluirServico, dividirPessoas, descontoPercentual]);

  const handleConfirmar = async () => {
    setSalvando(true);
    try {
      await onConfirmarFechamento({
        mesaNumero: mesa?.num || mesa?.numero,
        comandaId: comanda?.id || mesa?.comandaId,
        incluirServico,
        dividirPessoas: calculo.pessoas,
        desconto: Number(descontoPercentual),
        meios: [{ meio: meioPagamento, valor: calculo.totalFinal }],
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`🧾 Fechamento de Conta · ${mesa?.nome || 'Mesa'}`} width="560px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Resumo do Consumo */}
        <div style={{ background: 'var(--card, #0f172a)', padding: 14, borderRadius: 10, border: '1px solid var(--line, #334155)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--muted, #94a3b8)' }}>Subtotal do Consumo:</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>R$ {calculo.subtotal.toFixed(2)}</span>
          </div>

          {/* Taxa de Serviço 10% */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px dashed var(--line, #334155)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                Taxa de Serviço 10% (Garçom / Equipe)
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Opcional conforme Lei da Gorjeta</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: incluirServico ? '#10b981' : 'var(--muted, #64748b)' }}>
                + R$ {calculo.taxaServicoValor.toFixed(2)}
              </span>
              <input
                type="checkbox"
                checked={incluirServico}
                onChange={(e) => setIncluirServico(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#10b981' }}
              />
            </div>
          </div>

          {/* Desconto */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px dashed var(--line, #334155)' }}>
            <span style={{ fontSize: 13, color: 'var(--muted, #94a3b8)' }}>Desconto Comercial (%):</span>
            <input
              type="number"
              min="0"
              max="100"
              value={descontoPercentual}
              onChange={(e) => setDescontoPercentual(Math.min(100, Math.max(0, Number(e.target.value))))}
              style={{
                width: 70,
                textAlign: 'right',
                padding: '4px 8px',
                borderRadius: 4,
                border: '1px solid var(--line, #334155)',
                background: 'var(--surface, #1e293b)',
                color: '#fff',
                fontSize: 12,
              }}
            />
          </div>

          {/* Total Final */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, borderTop: '1px solid var(--line, #334155)', marginTop: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>TOTAL A PAGAR:</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>R$ {calculo.totalFinal.toFixed(2)}</span>
          </div>
        </div>

        {/* Divisão da Conta por Pessoas */}
        <div style={{ background: 'var(--surface, #1e293b)', padding: 14, borderRadius: 10, border: '1px solid var(--line, #334155)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Dividir a Conta na Mesa:</div>
              <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Número de pagantes em partes iguais</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => setDividirPessoas((p) => Math.max(1, p - 1))}
                style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--card)', border: '1px solid var(--line)', color: '#fff', cursor: 'pointer', fontWeight: 800 }}
              >
                -
              </button>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', minWidth: 26, textAlign: 'center' }}>
                {calculo.pessoas}
              </span>
              <button
                type="button"
                onClick={() => setDividirPessoas((p) => p + 1)}
                style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--card)', border: '1px solid var(--line)', color: '#fff', cursor: 'pointer', fontWeight: 800 }}
              >
                +
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.1)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>VALOR POR PESSOA ({calculo.pessoas}x):</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#10b981' }}>R$ {calculo.valorPorPessoa.toFixed(2)}</span>
          </div>
        </div>

        {/* Forma de Pagamento */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--cream, #fff)', display: 'block', marginBottom: 8 }}>
            Selecione a Forma de Pagamento:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {MEIOS.map((m) => {
              const ativo = meioPagamento === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMeioPagamento(m.id)}
                  style={{
                    padding: '10px 6px',
                    borderRadius: 8,
                    border: ativo ? `2px solid ${m.cor}` : '1px solid var(--line, #334155)',
                    background: ativo ? `${m.cor}22` : 'var(--surface, #1e293b)',
                    color: ativo ? m.cor : 'var(--cream, #fff)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: 11,
                  }}
                >
                  <div style={{ fontSize: 16, marginBottom: 2 }}>{m.icone}</div>
                  <div>{m.nome}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Botões de Ação */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: '1px solid var(--line, #334155)',
              background: 'var(--surface, #1e293b)',
              color: 'var(--muted, #94a3b8)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Voltar
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={handleConfirmar}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              background: '#10b981',
              color: '#000',
              cursor: salvando ? 'not-allowed' : 'pointer',
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            {salvando ? 'Processando...' : '✓ Confirmar Pagamento e Liberar Mesa'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
