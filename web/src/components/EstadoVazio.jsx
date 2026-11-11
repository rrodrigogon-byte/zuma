import React from 'react';

export function EstadoVazio({
  icone = '📋',
  titulo = 'Nenhum registro encontrado',
  descricao = 'Ainda não há dados cadastrados para o filtro selecionado.',
  acaoRotulo,
  aoClicarAcao,
  compacto = false,
}) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: compacto ? '24px 16px' : '40px 24px',
        borderRadius: 12,
        border: '1px dashed rgba(148, 163, 184, 0.35)',
        background: 'rgba(15, 23, 42, 0.02)',
        gap: 10,
      }}
    >
      <div style={{ fontSize: compacto ? 28 : 36, lineHeight: 1 }} aria-hidden="true">
        {icone}
      </div>
      <h3 style={{ margin: 0, fontSize: compacto ? 15 : 17, fontWeight: 700 }}>{titulo}</h3>
      {descricao && (
        <p style={{ margin: 0, fontSize: 13.5, opacity: 0.78, maxWidth: 460, lineHeight: 1.5 }}>
          {descricao}
        </p>
      )}
      {acaoRotulo && typeof aoClicarAcao === 'function' && (
        <button
          type="button"
          onClick={aoClicarAcao}
          className="btn btn-primary"
          style={{ marginTop: 6, padding: '8px 16px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
        >
          {acaoRotulo}
        </button>
      )}
    </div>
  );
}

export default EstadoVazio;
