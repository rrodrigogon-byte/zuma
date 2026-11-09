import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function EmpresaSwitcher() {
  const [empresas, setEmpresas] = useState([]);
  const [empresaAtiva, setEmpresaAtiva] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  // Carregar empresa ativa inicial do localStorage
  useEffect(() => {
    try {
      const empRaw = localStorage.getItem('empresa_ativa') || localStorage.getItem('sp_empresa_ativa');
      if (empRaw) {
        setEmpresaAtiva(JSON.parse(empRaw));
      }
    } catch {}
  }, []);

  // Buscar lista de empresas da API
  const carregarEmpresas = async () => {
    try {
      setCarregando(true);
      const res = await api.get('/api/admin/empresas');
      const lista = res?.empresas || res || [];
      if (Array.isArray(lista) && lista.length > 0) {
        setEmpresas(lista);
        // Se ainda não tinha empresa ativa, pegar a primeira
        if (!empresaAtiva) {
          selecionarEmpresa(lista[0], false);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar empresas:', e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarEmpresas();
  }, []);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const clickFora = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', clickFora);
    return () => document.removeEventListener('mousedown', clickFora);
  }, []);

  const selecionarEmpresa = (emp, recarregar = true) => {
    setEmpresaAtiva(emp);
    try {
      localStorage.setItem('empresa_ativa', JSON.stringify(emp));
      localStorage.setItem('sp_empresa_ativa', JSON.stringify(emp));
      // Se a empresa possui lojas associadas
      if (emp.lojas && emp.lojas.length > 0) {
        localStorage.setItem('loja_ativa', JSON.stringify(emp.lojas[0]));
        localStorage.setItem('sp_loja_ativa', JSON.stringify(emp.lojas[0]));
      }
    } catch {}
    setAberto(false);
    if (recarregar) {
      window.location.reload();
    }
  };

  const nome = empresaAtiva?.nome || empresaAtiva?.nomeFantasia || empresaAtiva?.razaoSocial || 'Barbearia Dino';
  const ie = empresaAtiva?.inscricaoEstadual || '14.229.191-9';
  const cnpj = empresaAtiva?.cnpj || '50.073.355/0001-89';

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 10px',
          background: aberto ? 'rgba(99, 102, 241, 0.12)' : 'var(--card, #0f172a)',
          border: aberto ? '1px solid var(--accent, #6366f1)' : '1px solid var(--line, #334155)',
          borderRadius: '10px',
          color: 'var(--text, #f8fafc)',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
        title="Alternar Empresa Ativa no ERP"
      >
        <span style={{ fontSize: '16px' }}>🏢</span>
        <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 800,
            color: 'var(--text, #f8fafc)',
            maxWidth: '140px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {nome}
          </div>
          <div style={{
            fontSize: '10px',
            color: '#10b981',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}>
            <span>●</span> IE: {ie} (SEFAZ-MT)
          </div>
        </div>
        <span style={{ fontSize: '10px', color: 'var(--muted, #94a3b8)', marginLeft: '2px' }}>
          {aberto ? '▲' : '▼'}
        </span>
      </button>

      {/* Dropdown */}
      {aberto && (
        <div style={{
          position: 'absolute',
          top: '46px',
          left: 0,
          width: '320px',
          background: 'var(--surface, #1e293b)',
          border: '1px solid var(--line, #334155)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          overflow: 'hidden',
          animation: 'fadeIn 0.12s ease'
        }}>
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--line, #334155)',
            background: 'var(--card, #0f172a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Empresas do Grupo
            </span>
            <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
              {empresas.length || 1} ativa(s)
            </span>
          </div>

          <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '6px' }}>
            {empresas.map((emp) => {
              const selecionada = (empresaAtiva?.id === emp.id) || (empresaAtiva?.cnpj === emp.cnpj);
              return (
                <div
                  key={emp.id}
                  onClick={() => selecionarEmpresa(emp)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: selecionada ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    border: selecionada ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '4px',
                    transition: 'all 0.1s ease'
                  }}
                >
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '6px',
                    background: selecionada ? 'var(--accent, #6366f1)' : 'var(--card, #0f172a)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 700,
                    flexShrink: 0
                  }}>
                    🏢
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: selecionada ? '#ffffff' : 'var(--text, #f8fafc)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {emp.nome || emp.nomeFantasia || emp.razaoSocial}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted, #94a3b8)' }}>
                      CNPJ: {emp.cnpj || '50.073.355/0001-89'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 600 }}>
                      IE: {emp.inscricaoEstadual || '14.229.191-9'} (MT)
                    </div>
                  </div>
                  {selecionada && (
                    <span style={{ color: '#10b981', fontSize: '16px', fontWeight: 800 }}>✓</span>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{
            padding: '8px 12px',
            borderTop: '1px solid var(--line, #334155)',
            background: 'var(--card, #0f172a)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <button
              type="button"
              onClick={() => { setAberto(false); navigate('/admin/empresas'); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent, #6366f1)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              ⚙️ Gerenciar Empresas & Filiais
            </button>
            <span style={{ fontSize: '10px', color: 'var(--muted, #94a3b8)' }}>
              SEFAZ-MT CCE
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
