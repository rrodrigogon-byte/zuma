import React from 'react';
import { formatarDataHora } from '../lib/formatadores';

async function calcularHashCurto(conteudo) {
  try {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const bytes = new TextEncoder().encode(String(conteudo || ''));
      const digest = await window.crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 16)
        .toUpperCase();
    }
  } catch {}
  return `AUDIT-${Date.now().toString(16).toUpperCase()}`;
}

export function ExportadorRelatorio({
  titulo = 'Relatorio_Operacional',
  empresaNome = 'Barbearia Dino',
  empresaCnpj = '',
  usuarioNome = 'Operador Autenticado',
  colunas = [],
  linhas = [],
}) {
  const exportarCsv = async () => {
    const cabecalho = colunas.map((c) => `"${String(c.rotulo || c.chave || '').replace(/"/g, '""')}"`).join(';');
    const corpo = linhas
      .map((linha) =>
        colunas
          .map((c) => {
            const val = typeof c.formatar === 'function' ? c.formatar(linha[c.chave], linha) : linha[c.chave];
            return `"${String(val ?? '').replace(/"/g, '""')}"`;
          })
          .join(';'),
      )
      .join('\r\n');
    const carimbo = formatarDataHora(new Date());
    const hash = await calcularHashCurto(`${titulo}:${carimbo}:${linhas.length}`);
    const rodape = `\r\n"Emitido por";"Empresa: ${empresaNome} ${empresaCnpj ? `(${empresaCnpj})` : ''}";"Usuário: ${usuarioNome}";"Data/Hora (America/Cuiaba): ${carimbo}";"Hash SHA-256: ${hash}"`;
    const csvComBom = `\uFEFF${cabecalho}\r\n${corpo}${rodape}`;
    const blob = new Blob([csvComBom], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${String(titulo).toLowerCase().replace(/[^a-z0-9_-]+/gi, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const imprimirRelatorio = () => {
    window.print();
  };

  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <button
        type="button"
        onClick={exportarCsv}
        style={{
          padding: '7px 13px',
          borderRadius: 8,
          border: '1px solid #cbd5e1',
          background: '#ffffff',
          color: '#0f172a',
          fontSize: 12.5,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Exportar CSV (UTF-8)
      </button>
      <button
        type="button"
        onClick={imprimirRelatorio}
        style={{
          padding: '7px 13px',
          borderRadius: 8,
          border: '1px solid #0284c7',
          background: '#0284c7',
          color: '#ffffff',
          fontSize: 12.5,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Imprimir / Salvar PDF (A4)
      </button>
    </div>
  );
}

export default ExportadorRelatorio;
