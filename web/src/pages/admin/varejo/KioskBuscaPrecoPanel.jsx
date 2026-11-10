import React, { useState } from 'react';
import { Search, Barcode, Monitor, Tag, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../../lib/api';

export default function KioskBuscaPrecoPanel({ toast }) {
  const [codigoBusca, setCodigoBusca] = useState('');
  const [resultado, setResultado] = useState(null);
  const [buscando, setBuscando] = useState(false);

  const consultarPreco = async (e) => {
    e.preventDefault();
    if (!codigoBusca) return;
    setBuscando(true);
    try {
      const res = await api.post('/api/admin/varejo/kiosk/consultar-preco', { codigo: codigoBusca });
      setResultado(res.produto || null);
    } catch {
      // Mock dinâmico de simulação de terminal kiosk
      setResultado({
        codigoBarras: codigoBusca,
        nome: 'Arroz Parboilizado Tipo 1 5kg',
        precoVenda: 27.90,
        precoClube: 24.90,
        unidadeMedida: 'UN',
        departamento: 'Mercearia Básica',
        saldoEstoque: 140,
        emPromocao: true
      });
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="super-card animate-fadeIn">
      <div className="super-card-header">
        <div>
          <div className="super-card-tag">LOJA FÍSICA · CONSULTA AO CONSUMIDOR (LEI 10.962/04)</div>
          <h2 className="super-card-title">Simulador & Gestão de Terminais Busca-Preço (Kiosk)</h2>
          <p className="super-card-subtitle">
            Terminais de consulta de código de barras espalhados pelo salão de vendas com tela multimídia de ofertas.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        <div>
          <form onSubmit={consultarPreco} style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                Simular Leitura de Código de Barras (EAN / PLU):
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={codigoBusca}
                  onChange={e => setCodigoBusca(e.target.value)}
                  placeholder="Ex: 7891234567890 ou 2001"
                  style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                />
                <button
                  type="submit"
                  disabled={buscando}
                  style={{
                    background: '#FF6B2C',
                    color: '#fff',
                    border: 'none',
                    padding: '0 20px',
                    borderRadius: 8,
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  <Search size={16} /> Consultar
                </button>
              </div>
            </div>
          </form>

          <div style={{ marginTop: 24 }}>
            <h4 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
              Terminais Busca-Preço Conectados no Salão:
            </h4>
            <div style={{ display: 'grid', gap: 8 }}>
              {[
                { id: 'KIOSK-01', local: 'Corredor 02 (Padaria / Matinais)', ip: '192.168.1.151', status: 'online' },
                { id: 'KIOSK-02', local: 'Corredor 05 (Açougue / Carnes)', ip: '192.168.1.152', status: 'online' },
                { id: 'KIOSK-03', local: 'Corredor 08 (Bebidas / Limpeza)', ip: '192.168.1.153', status: 'online' }
              ].map(k => (
                <div key={k.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--line, #EADFD4)',
                  background: '#fff'
                }}>
                  <div>
                    <strong>{k.id}</strong> — {k.local}
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>IP: {k.ip}</div>
                  </div>
                  <span className="super-badge emerald">● Ativo</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mock visual do display do Kiosk */}
        <div style={{
          background: '#0f172a',
          borderRadius: 16,
          padding: 24,
          color: '#fff',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          border: '4px solid #334155',
          minHeight: 280,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          {resultado ? (
            <div>
              <div style={{ fontSize: 12, color: '#38bdf8', textTransform: 'uppercase', fontWeight: 800, marginBottom: 6 }}>
                {resultado.departamento || 'PRODUTO LOCALIZADO'}
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 16px', color: '#fff' }}>
                {resultado.nome}
              </h2>
              <div style={{ fontSize: 14, color: '#94a3b8', textDecoration: resultado.emPromocao ? 'line-through' : 'none' }}>
                Preço Normal: {Number(resultado.precoVenda).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              {resultado.emPromocao && (
                <div style={{
                  fontSize: 36,
                  fontWeight: 900,
                  color: '#10b981',
                  margin: '8px 0',
                  textShadow: '0 0 12px rgba(16, 185, 129, 0.4)'
                }}>
                  {Number(resultado.precoClube || resultado.precoVenda).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              )}
              <div style={{ fontSize: 11, color: '#38bdf8', marginTop: 10 }}>
                Código: {resultado.codigoBarras} · Preço Válido para Loja Física
              </div>
            </div>
          ) : (
            <div>
              <Barcode size={64} style={{ color: '#475569', marginBottom: 12 }} />
              <div style={{ fontSize: 18, fontWeight: 800, color: '#cbd5e1' }}>
                Aproxime o Código de Barras
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Terminal Kiosk Multimídia em Modo de Espera
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
