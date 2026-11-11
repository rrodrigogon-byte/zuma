import React, { useState } from 'react';

export function ConfirmarAcao({
  aberto = false,
  titulo = 'Confirmar operação',
  descricao = 'Esta ação ficará registrada na trilha de auditoria.',
  rotuloConfirmar = 'Confirmar',
  rotuloCancelar = 'Voltar',
  exigirMotivo = true,
  placeholderMotivo = 'Informe o motivo ou justificativa desta operação (mínimo 3 caracteres)...',
  perigoso = true,
  aoConfirmar,
  aoCancelar,
}) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');

  if (!aberto) return null;

  const confirmar = () => {
    const limpo = String(motivo || '').trim();
    if (exigirMotivo && limpo.length < 3) {
      setErro('Informe uma justificativa com pelo menos 3 caracteres.');
      return;
    }
    setErro('');
    if (typeof aoConfirmar === 'function') {
      aoConfirmar(limpo);
    }
    setMotivo('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmar-acao-titulo"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: 14,
          padding: 24,
          boxShadow: '0 20px 45px rgba(0,0,0,0.25)',
        }}
      >
        <h3 id="confirmar-acao-titulo" style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>
          {titulo}
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: '#475569', lineHeight: 1.5 }}>{descricao}</p>

        {exigirMotivo && (
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="confirmar-acao-motivo"
              style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: '#334155' }}
            >
              Justificativa obrigatória *
            </label>
            <textarea
              id="confirmar-acao-motivo"
              rows={3}
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                if (erro) setErro('');
              }}
              placeholder={placeholderMotivo}
              style={{
                width: '100%',
                borderRadius: 8,
                border: erro ? '1px solid #dc2626' : '1px solid #cbd5e1',
                padding: '10px 12px',
                fontSize: 13.5,
                resize: 'vertical',
              }}
            />
            {erro && <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#dc2626', fontWeight: 600 }}>{erro}</p>}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={() => {
              setErro('');
              setMotivo('');
              if (typeof aoCancelar === 'function') aoCancelar();
            }}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#334155',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {rotuloCancelar}
          </button>
          <button
            type="button"
            onClick={confirmar}
            style={{
              padding: '9px 18px',
              borderRadius: 8,
              border: 'none',
              background: perigoso ? '#dc2626' : '#0284c7',
              color: '#ffffff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmarAcao;
