import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useToast } from '../../../hooks/useToast';
import { useAuth } from '../../../lib/auth';
import '../customer360.css';
import '../dino/dino-admin.css';

// Empresas canônicas de referência rápida caso a API ainda não tenha retornado
const EMPRESAS_CANONICAS = [
  { id: "d0d0ac01-8e50-4b61-8c79-de4aaa916da6", uuid: "d0d0ac01-8e50-4b61-8c79-de4aaa916da6", nome: "Barbearia Dino", icone: "💈", segmento: "Barbearia Masculina & Perfumaria", cnpj: "50.073.355/0001-89", ie: "14.229.191-9" },
  { id: "31f70c83-9172-40c2-945f-9e793b5048be", uuid: "31f70c83-9172-40c2-945f-9e793b5048be", nome: "Stallone Nutre Sport", icone: "💪", segmento: "Suplementos, Fitness & Saúde", cnpj: "56.099.531/0001-38", ie: "Isento" },
  { id: "2e041110-db20-4fd1-8278-12bd3dead008", uuid: "2e041110-db20-4fd1-8278-12bd3dead008", nome: "AGRO OPEN TTC", icone: "🌱", segmento: "Agronegócio & Esportes", cnpj: "43.084.070/0001-88", ie: "13.987.654-2" },
  { id: "supermercado", uuid: "supermercado", nome: "Supermercado Kytto", icone: "🛒", segmento: "Alimentos, Bebidas & Atacarejo", cnpj: "48.123.456/0001-77", ie: "Isento" }
];

function mapearIcone(nome = "") {
  const n = String(nome).toLowerCase();
  if (n.includes("dino")) return "💈";
  if (n.includes("stallone")) return "💪";
  if (n.includes("agro")) return "🌱";
  if (n.includes("supermercado")) return "🛒";
  if (n.includes("varejo") || n.includes("moda")) return "👗";
  return "🏢";
}

function fmtR(val) {
  const n = Number(val || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPct(val) {
  const n = Number(val || 0);
  return `${n >= 0 ? '' : ''}${n.toFixed(1).replace('.', ',')}%`;
}

export default function DRECompleta() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();

  const empresaParam = searchParams.get('empresa') || searchParams.get('empresaId') || '';
  const empEncontrada = EMPRESAS_DISPONIVEIS.find(e => e.id === empresaParam || e.uuid === empresaParam) || EMPRESAS_DISPONIVEIS[0];
  const [empresaAtiva, setEmpresaAtiva] = useState(empEncontrada);

  const hoje = new Date().toISOString().slice(0, 7);
  const [mesSelecionado, setMesSelecionado] = useState(hoje);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [regime, setRegime] = useState('competencia'); // 'competencia' ou 'caixa'
  const [modoVisao, setModoVisao] = useState('estruturada'); // 'estruturada', 'anual', 'graficos'
  const [linhasExpandidas, setLinhasExpandidas] = useState({ '1': true, '2': true, '4': true, '6': true });

  const [dre, setDre] = useState(null);
  const [dreAnual, setDreAnual] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [exportando, setExportando] = useState(false);
  // Carrega empresas autorizadas estritamente da API
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const res = await api.get('/api/admin/empresas');
        if (!ativo) return;
        const bruta = res?.empresas || res || [];
        const ehAdmin = Boolean(res?.ehAdminPlataforma);
        setEhAdminPlataforma(ehAdmin);

        const lista = (Array.isArray(bruta) ? bruta : []).filter(e => {
          const nome = String(e.nome || '').toLowerCase();
          const cnpj = String(e.cnpj || '').replace(/\D/g, '');
          return !nome.includes('imperial') && !nome.includes('homologação alterada') && cnpj !== '98765432000199';
        }).map(e => ({
          id: e.id,
          uuid: e.id,
          nome: e.nome || e.nomeFantasia || e.razaoSocial,
          icone: mapearIcone(e.nome),
          segmento: e.tipoNegocio || e.segmento || 'Operação Comercial',
          cnpj: e.cnpj || '',
          ie: e.inscricaoEstadual || 'Isento'
        }));

        if (lista.length > 0) {
          setEmpresasAutorizadas(lista);
          // Sincroniza se a empresa ativa não for das autorizadas
          setEmpresaAtiva(prev => {
            const achou = lista.find(item => item.id === prev.id || (item.cnpj && prev.cnpj && item.cnpj.replace(/\D/g, '') === prev.cnpj.replace(/\D/g, '')));
            return achou || lista[0];
          });
        }
      } catch (err) {
        console.warn('Erro ao buscar empresas para DRE:', err);
      }
    })();

    // Escutar evento de troca global de empresa vinda da topbar
    const onEmpresaAlterada = (ev) => {
      const nova = ev.detail;
      if (nova) {
        setEmpresaAtiva({
          id: nova.id,
          uuid: nova.id,
          nome: nova.nome || nova.nomeFantasia || nova.razaoSocial,
          icone: mapearIcone(nova.nome),
          segmento: nova.tipoNegocio || nova.segmento || 'Operação Comercial',
          cnpj: nova.cnpj || '',
          ie: nova.inscricaoEstadual || 'Isento'
        });
      }
    };
    window.addEventListener('empresa_alterada', onEmpresaAlterada);

    return () => {
      ativo = false;
      window.removeEventListener('empresa_alterada', onEmpresaAlterada);
    };
  }, []);

  // Carrega DRE estruturada do mês/período
  const carregarDre = useCallback(async () => {
    setCarregando(true);
    try {
      const qs = new URLSearchParams({
        mes: mesSelecionado,
        regime,
        empresaId: empresaAtiva.uuid
      });
      const data = await api.get(`/api/admin/erp/dre?${qs.toString()}`);
      setDre(data);
    } catch (err) {
      console.error('Erro ao carregar DRE:', err);
      toast(err.message || 'Erro ao carregar a DRE da empresa.', 'error');
    } finally {
      setCarregando(false);
    }
  }, [mesSelecionado, regime, empresaAtiva.uuid, toast]);

  // Carrega DRE anual (12 meses)
  const carregarDreAnual = useCallback(async () => {
    try {
      const qs = new URLSearchParams({
        ano: anoSelecionado,
        regime,
        empresaId: empresaAtiva.uuid
      });
      const data = await api.get(`/api/admin/erp/dre/anual?${qs.toString()}`);
      setDreAnual(data);
    } catch (err) {
      console.error('Erro ao carregar DRE Anual:', err);
    }
  }, [anoSelecionado, regime, empresaAtiva.uuid]);

  useEffect(() => {
    carregarDre();
  }, [carregarDre]);

  useEffect(() => {
    if (modoVisao === 'anual') {
      carregarDreAnual();
    }
  }, [modoVisao, carregarDreAnual]);

  const trocarEmpresa = (emp) => {
    setEmpresaAtiva(emp);
    try {
      localStorage.setItem('empresa_ativa', JSON.stringify(emp));
      localStorage.setItem('sp_empresa_ativa', JSON.stringify(emp));
      localStorage.setItem('empresaAtivaId', emp.id);
      window.dispatchEvent(new CustomEvent('empresa_alterada', { detail: emp }));
    } catch {}
    setSearchParams({ empresa: emp.id, mes: mesSelecionado, regime });
  };

  const toggleLinha = (codigo) => {
    setLinhasExpandidas(prev => ({
      ...prev,
      [codigo]: !prev[codigo]
    }));
  };

  const exportarCsv = async () => {
    setExportando(true);
    try {
      const qs = new URLSearchParams({
        mes: mesSelecionado,
        regime,
        empresaId: empresaAtiva.uuid
      });
      const res = await api.get(`/api/admin/erp/dre/exportar-csv?${qs.toString()}`);
      if (res?.csvText) {
        const blob = new Blob([res.csvText], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', res.nomeArquivo || `DRE_${empresaAtiva.id}_${mesSelecionado}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast('DRE exportada com sucesso para CSV/Excel!', 'success');
      }
    } catch (err) {
      toast('Falha ao exportar CSV: ' + err.message, 'error');
    } finally {
      setExportando(false);
    }
  };

  const imprimirDre = () => {
    window.print();
  };

  const resumo = dre?.resumo || {};

  return (
    <div className="dre-container" style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
      {/* ── CABEÇALHO EXECUTIVO E MULTI-TENANT (Oculto na Impressão Oficial) ── */}
      <div className="no-print" style={{
        background: 'var(--surface)',
        padding: '16px 20px',
        borderRadius: 16,
        border: '1px solid var(--line)',
        marginBottom: 20,
        boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>📊</span>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--cream, #0f172a)' }}>
                Demonstração do Resultado do Exercício (DRE)
              </h1>
              <span style={{
                background: 'rgba(34,197,94,0.12)',
                color: '#16a34a',
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 800,
                border: '1px solid rgba(34,197,94,0.3)'
              }}>
                Padrão CPC / CFC
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted, #64748b)' }}>
              Apuração contábil e gerencial de receitas, custos, margens, EBITDA e lucro líquido com análise vertical.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={exportarCsv}
              disabled={exportando}
              className="c360-btn ghost"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, background: 'var(--card)' }}
            >
              📥 {exportando ? 'Exportando…' : 'Exportar CSV (Excel)'}
            </button>
            <button
              onClick={imprimirDre}
              className="c360-btn primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13, background: '#16a34a', borderColor: '#16a34a' }}
            >
              🖨️ Imprimir DRE Oficial (PDF)
            </button>
          </div>
        </div>

        {/* Seletor Multi-Empresa com Blindagem Tenant */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>
            {ehAdminPlataforma && empresasAutorizadas.length > 1 ? 'Empresa Ativa:' : 'Empresa Vinculada:'}
          </span>
          {ehAdminPlataforma && empresasAutorizadas.length > 1 ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {empresasAutorizadas.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => trocarEmpresa(emp)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: `1.5px solid ${empresaAtiva.id === emp.id ? '#2563eb' : 'var(--line)'}`,
                    background: empresaAtiva.id === emp.id ? 'rgba(37,99,235,0.08)' : 'var(--card)',
                    color: empresaAtiva.id === emp.id ? '#2563eb' : 'var(--fg)',
                    fontWeight: empresaAtiva.id === emp.id ? 800 : 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{emp.icone}</span>
                  <span>{emp.nome}</span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 8,
              background: 'rgba(37,99,235,0.08)',
              border: '1px solid rgba(37,99,235,0.25)',
              color: '#2563eb',
              fontWeight: 800,
              fontSize: 13
            }}>
              <span>{empresaAtiva?.icone || '🏢'}</span>
              <span>{empresaAtiva?.nome}</span>
              {empresaAtiva?.cnpj && (
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>• CNPJ: {empresaAtiva.cnpj}</span>
              )}
              {empresaAtiva?.ie && empresaAtiva.ie !== 'Isento' && (
                <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>• IE: {empresaAtiva.ie} (SEFAZ-MT)</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── CABEÇALHO OFICIAL TIMBRADO (Exclusivo para Impressão) ── */}
      <div className="print-only" style={{ display: 'none', marginBottom: 24, borderBottom: '2px solid #000', paddingBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, textTransform: 'uppercase' }}>{empresaAtiva.nome}</h2>
            <div style={{ fontSize: 11, color: '#333', marginTop: 3 }}>
              <span>CNPJ: {empresaAtiva.cnpj}</span> · <span>Inscrição Estadual: {empresaAtiva.ie}</span>
            </div>
            <div style={{ fontSize: 11, color: '#444' }}>Segmento: {empresaAtiva.segmento}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: '#444' }}>
            <div style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase' }}>DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO</div>
            <div>Período: <strong>{dre?.periodo?.de} até {dre?.periodo?.ate}</strong></div>
            <div>Regime de Apuração: <strong>{regime === 'competencia' ? 'Competência' : 'Caixa'}</strong></div>
            <div>Emitido em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</div>
          </div>
        </div>
      </div>

      {/* ── CARDS KPIS EXECUTIVOS (Visão Resumida) ── */}
      <div className="no-print" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: 14,
        marginBottom: 20
      }}>
        {/* Receita Bruta */}
        <div style={{ background: 'var(--card)', padding: '16px 18px', borderRadius: 14, border: '1px solid var(--line)', borderTop: '4px solid #2563eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>1. Receita Operacional Bruta</span>
            <span style={{ fontSize: 18 }}>💰</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#2563eb', margin: '8px 0 4px' }}>
            {fmtR(resumo.receitaBruta)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            Base de faturamento ({regime === 'competencia' ? 'Competência' : 'Caixa'})
          </div>
        </div>

        {/* Margem Bruta */}
        <div style={{ background: 'var(--card)', padding: '16px 18px', borderRadius: 14, border: '1px solid var(--line)', borderTop: '4px solid #16a34a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>5. Lucro Bruto (Margem)</span>
            <span style={{ fontSize: 18 }}>📊</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a', margin: '8px 0 4px' }}>
            {fmtR(resumo.lucroBruto)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            Margem Bruta: <strong style={{ color: '#16a34a' }}>{resumo.margemBrutaPct || 0}%</strong> da Receita
          </div>
        </div>

        {/* EBITDA / LAJIDA */}
        <div style={{ background: 'var(--card)', padding: '16px 18px', borderRadius: 14, border: '1px solid var(--line)', borderTop: '4px solid #d97706' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>7. EBITDA / LAJIDA</span>
            <span style={{ fontSize: 18 }}>⚡</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: resumo.ebitda >= 0 ? '#d97706' : '#dc2626', margin: '8px 0 4px' }}>
            {fmtR(resumo.ebitda)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            Geração Operacional: <strong>{resumo.margemEbitdaPct || 0}%</strong>
          </div>
        </div>

        {/* Resultado Líquido */}
        <div style={{ background: 'var(--card)', padding: '16px 18px', borderRadius: 14, border: '1px solid var(--line)', borderTop: `4px solid ${resumo.resultadoLiquido >= 0 ? '#059669' : '#dc2626'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>11. Resultado Líquido</span>
            <span style={{ fontSize: 18 }}>🏆</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: resumo.resultadoLiquido >= 0 ? '#059669' : '#dc2626', margin: '8px 0 4px' }}>
            {fmtR(resumo.resultadoLiquido)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            Margem Líquida Real: <strong style={{ color: resumo.resultadoLiquido >= 0 ? '#059669' : '#dc2626' }}>{resumo.margemLiquidaPct || 0}%</strong>
          </div>
        </div>

        {/* Ponto de Equilíbrio */}
        <div style={{ background: 'var(--card)', padding: '16px 18px', borderRadius: 14, border: '1px solid var(--line)', borderTop: '4px solid #7c3aed' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>🎯 Ponto de Equilíbrio</span>
            <span style={{ fontSize: 18 }}>🎯</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#7c3aed', margin: '8px 0 4px' }}>
            {fmtR(resumo.pontoEquilibrio)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            Faturamento zero a zero (Break-even)
          </div>
        </div>
      </div>

      {/* ── BARRA DE FERRAMENTAS E FILTROS ── */}
      <div className="no-print" style={{
        background: 'var(--surface)',
        padding: '12px 18px',
        borderRadius: 14,
        border: '1px solid var(--line)',
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Seletor de Mês */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>MÊS:</label>
            <input
              type="month"
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
              className="c360-input"
              style={{ fontWeight: 700, padding: '5px 10px', fontSize: 13 }}
            />
          </div>

          {/* Seletor de Regime */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--card)', padding: '3px 6px', borderRadius: 10, border: '1px solid var(--line)' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', paddingLeft: 4 }}>REGIME:</span>
            <button
              onClick={() => setRegime('competencia')}
              style={{
                border: 'none',
                background: regime === 'competencia' ? '#2563eb' : 'transparent',
                color: regime === 'competencia' ? '#fff' : 'var(--muted)',
                fontWeight: 700,
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              Competência
            </button>
            <button
              onClick={() => setRegime('caixa')}
              style={{
                border: 'none',
                background: regime === 'caixa' ? '#2563eb' : 'transparent',
                color: regime === 'caixa' ? '#fff' : 'var(--muted)',
                fontWeight: 700,
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              Caixa (Financeiro)
            </button>
          </div>
        </div>

        {/* Alternador de Modo de Visualização */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'estruturada', label: '📑 DRE Oficial (AV%)', icone: '📑' },
            { id: 'anual', label: '📅 Matriz Anual (12 Meses)', icone: '📅' },
            { id: 'graficos', label: '📊 Gráficos & Mix', icone: '📊' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setModoVisao(m.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: `1px solid ${modoVisao === m.id ? '#16a34a' : 'var(--line)'}`,
                background: modoVisao === m.id ? 'rgba(22,163,74,0.1)' : 'var(--card)',
                color: modoVisao === m.id ? '#16a34a' : 'var(--muted)',
                fontWeight: modoVisao === m.id ? 800 : 600,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      {carregando ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Apurando lançamentos contábeis e gerenciais...</div>
        </div>
      ) : (
        <>
          {/* VISÃO 1: DRE OFICIAL ESTRUTURADA */}
          {modoVisao === 'estruturada' && (
            <div style={{
              background: 'var(--card)',
              borderRadius: 16,
              border: '1px solid var(--line)',
              overflow: 'hidden',
              boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
            }}>
              <div style={{ padding: '14px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--cream, #0f172a)' }}>
                  Demonstração Contábil Oficial · Período {dre?.periodo?.de} até {dre?.periodo?.ate}
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Total de Lançamentos Apurados: <strong>{resumo.totalLancamentosApurados || 0}</strong>
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '2px solid var(--line)' }}>
                      <th style={{ padding: '12px 18px', width: 90, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>CÓDIGO</th>
                      <th style={{ padding: '12px 18px', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>CONTA / CLASSIFICAÇÃO CONTÁBIL</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right', width: 180, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>VALOR (R$)</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right', width: 140, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>ANÁLISE VERTICAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dre?.linhas?.map((linha) => {
                      const isSubtotal = linha.tipo === 'subtotal' || linha.tipo === 'resultado_final';
                      const isDestaque = linha.destaque;
                      const hasFilhos = Boolean(linha.filhos?.length);
                      const isExpandido = linhasExpandidas[linha.codigo];

                      return (
                        <React.Fragment key={linha.codigo}>
                          {/* Linha Sintética Principal */}
                          <tr
                            onClick={() => hasFilhos && toggleLinha(linha.codigo)}
                            style={{
                              borderBottom: '1px solid var(--line)',
                              background: isSubtotal ? 'rgba(37,99,235,0.04)' : linha.codigo === '1' ? 'rgba(34,197,94,0.04)' : 'transparent',
                              cursor: hasFilhos ? 'pointer' : 'default',
                              fontWeight: isDestaque ? 800 : 600,
                              transition: 'background 0.15s ease'
                            }}
                          >
                            <td style={{ padding: '12px 18px', color: 'var(--muted)', fontFamily: 'monospace', fontWeight: 800 }}>
                              {hasFilhos ? (isExpandido ? '▼ ' : '▶ ') : ''}{linha.codigo}
                            </td>
                            <td style={{ padding: '12px 18px', color: isSubtotal ? '#2563eb' : linha.codigo === '11' ? '#059669' : 'var(--cream, #0f172a)' }}>
                              <span style={{ fontSize: isDestaque ? 14 : 13 }}>{linha.descricao}</span>
                            </td>
                            <td style={{
                              padding: '12px 18px',
                              textAlign: 'right',
                              fontWeight: 800,
                              fontSize: isDestaque ? 14 : 13,
                              color: linha.valor < 0 ? '#dc2626' : isSubtotal ? '#2563eb' : linha.codigo === '11' ? '#059669' : 'var(--fg)'
                            }}>
                              {fmtR(linha.valor)}
                            </td>
                            <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 800,
                                background: linha.av < 0 ? 'rgba(220,38,38,0.08)' : 'rgba(37,99,235,0.08)',
                                color: linha.av < 0 ? '#dc2626' : '#2563eb'
                              }}>
                                {fmtPct(linha.av)}
                              </span>
                            </td>
                          </tr>

                          {/* Linhas Analíticas / Filhos (quando expandido) */}
                          {hasFilhos && isExpandido && linha.filhos.map((filho) => {
                            if (filho.valor === 0 && (!filho.detalhe || !filho.detalhe.length)) return null;
                            return (
                              <React.Fragment key={filho.codigo}>
                                <tr style={{ borderBottom: '1px dashed var(--line)', background: 'rgba(0,0,0,0.015)' }}>
                                  <td style={{ padding: '8px 18px 8px 36px', color: 'var(--muted)', fontSize: 11, fontFamily: 'monospace' }}>
                                    {filho.codigo}
                                  </td>
                                  <td style={{ padding: '8px 18px', color: 'var(--muted)', fontSize: 12 }}>
                                    {filho.descricao}
                                  </td>
                                  <td style={{
                                    padding: '8px 18px',
                                    textAlign: 'right',
                                    fontWeight: 700,
                                    fontSize: 12,
                                    color: filho.valor < 0 ? '#ef4444' : 'var(--muted)'
                                  }}>
                                    {fmtR(filho.valor)}
                                  </td>
                                  <td style={{ padding: '8px 18px', textAlign: 'right', fontSize: 11, color: 'var(--muted)' }}>
                                    {fmtPct(filho.av)}
                                  </td>
                                </tr>

                                {/* Detalhe por Categoria Individual */}
                                {filho.detalhe?.map((d, dIdx) => (
                                  <tr key={`${filho.codigo}-det-${dIdx}`} style={{ borderBottom: '1px solid rgba(0,0,0,0.02)', background: 'rgba(0,0,0,0.025)' }}>
                                    <td></td>
                                    <td style={{ padding: '5px 18px 5px 48px', color: 'var(--muted)', fontSize: 11, fontStyle: 'italic' }}>
                                      ↳ {d.categoria}
                                    </td>
                                    <td style={{ padding: '5px 18px', textAlign: 'right', fontSize: 11, color: 'var(--muted)' }}>
                                      {fmtR(d.valor)}
                                    </td>
                                    <td></td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VISÃO 2: MATRIZ ANUAL COMPARATIVA (12 MESES JAN A DEZ) */}
          {modoVisao === 'anual' && (
            <div style={{
              background: 'var(--card)',
              borderRadius: 16,
              border: '1px solid var(--line)',
              overflow: 'hidden',
              boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
            }}>
              <div style={{ padding: '14px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--cream, #0f172a)' }}>
                    Matriz Comparativa Anual (12 Meses) · Ano {anoSelecionado}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[2025, 2026, 2027].map(y => (
                      <button
                        key={y}
                        onClick={() => setAnoSelecionado(y)}
                        style={{
                          border: `1px solid ${anoSelecionado === y ? '#2563eb' : 'var(--line)'}`,
                          background: anoSelecionado === y ? '#2563eb' : 'var(--card)',
                          color: anoSelecionado === y ? '#fff' : 'var(--muted)',
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Regime: <strong>{regime === 'competencia' ? 'Competência' : 'Caixa'}</strong>
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '2px solid var(--line)' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', width: 220, color: 'var(--muted)', textTransform: 'uppercase' }}>CONTA / CLASSIFICAÇÃO</th>
                      {dreAnual?.meses?.map(m => (
                        <th key={m.mes} style={{ padding: '10px 8px', minWidth: 80, color: 'var(--muted)', textTransform: 'uppercase' }}>
                          {m.nomeMes}
                        </th>
                      ))}
                      <th style={{ padding: '10px 12px', minWidth: 95, color: '#2563eb', textTransform: 'uppercase', background: 'rgba(37,99,235,0.06)' }}>
                        TOTAL YTD
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Linhas principais comparativas */}
                    {[
                      { label: '1. Receita Operacional Bruta', key: 'receitaBruta', cor: '#2563eb', negrito: true },
                      { label: '2. (-) Deduções', key: 'totalDeducoes', cor: '#dc2626', negrito: false, negativo: true },
                      { label: '3. (=) Receita Líquida (ROL)', key: 'receitaLiquida', cor: '#2563eb', negrito: true },
                      { label: '4. (-) Custos (CMV/CSP)', key: 'totalCustos', cor: '#dc2626', negrito: false, negativo: true },
                      { label: '5. (=) Lucro Bruto', key: 'lucroBruto', cor: '#16a34a', negrito: true },
                      { label: '6. (-) Despesas Operacionais', key: 'totalDespesasOperacionais', cor: '#dc2626', negrito: false, negativo: true },
                      { label: '7. (=) EBITDA / LAJIDA', key: 'ebitda', cor: '#d97706', negrito: true },
                      { label: '8. (+/-) Resultado Financeiro', key: 'resultadoFinanceiro', cor: 'var(--muted)', negrito: false },
                      { label: '11. (=) Lucro Líquido', key: 'resultadoLiquido', cor: '#059669', negrito: true },
                    ].map(row => (
                      <tr key={row.key} style={{ borderBottom: '1px solid var(--line)', fontWeight: row.negrito ? 800 : 500 }}>
                        <td style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--cream, #0f172a)' }}>
                          {row.label}
                        </td>
                        {dreAnual?.meses?.map(m => {
                          const val = m.resumo?.[row.key] || 0;
                          const showVal = row.negativo && val > 0 ? -val : val;
                          return (
                            <td key={m.mes} style={{ padding: '10px 8px', color: showVal < 0 ? '#dc2626' : row.cor || 'var(--fg)' }}>
                              {showVal === 0 ? '-' : fmtR(showVal).replace('R$', '').trim()}
                            </td>
                          );
                        })}
                        <td style={{ padding: '10px 12px', fontWeight: 900, color: row.cor, background: 'rgba(37,99,235,0.03)' }}>
                          {(() => {
                            const tot = dreAnual?.totalAno?.resumo?.[row.key] || 0;
                            const showTot = row.negativo && tot > 0 ? -tot : tot;
                            return fmtR(showTot);
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VISÃO 3: GRÁFICOS & MIX DE RESULTADOS */}
          {modoVisao === 'graficos' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
              {/* Composição das Receitas */}
              <div style={{ background: 'var(--card)', borderRadius: 16, border: '1px solid var(--line)', padding: 20 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800, color: 'var(--cream, #0f172a)' }}>
                  Composição da Receita Bruta (Mix)
                </h3>
                {dre?.graficos?.composicaoReceita?.length ? (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {dre.graficos.composicaoReceita.map(item => (
                      <div key={item.nome}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span style={{ fontWeight: 700 }}>{item.nome}</span>
                          <span style={{ color: 'var(--muted)' }}>{fmtR(item.valor)} ({item.pct}%)</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, Math.max(0, item.pct))}%`, height: '100%', background: '#2563eb' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhuma receita apurada no período.</div>
                )}
              </div>

              {/* Composição dos Custos & Despesas */}
              <div style={{ background: 'var(--card)', borderRadius: 16, border: '1px solid var(--line)', padding: 20 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800, color: 'var(--cream, #0f172a)' }}>
                  Composição dos Custos e Despesas
                </h3>
                {dre?.graficos?.composicaoCustosDespesas?.length ? (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {dre.graficos.composicaoCustosDespesas.map(item => (
                      <div key={item.nome}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span style={{ fontWeight: 700 }}>{item.nome}</span>
                          <span style={{ color: 'var(--muted)' }}>{fmtR(item.valor)}</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.min(100, Math.max(0, (item.valor / (resumo.receitaBruta || 1)) * 100))}%`,
                            height: '100%',
                            background: item.cor || '#dc2626'
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum custo registrado no período.</div>
                )}
              </div>
            </div>
          )}

          {/* ── TERMO DE RESPONSABILIDADE & ASSINATURA (Para Impressão) ── */}
          <div className="print-only" style={{ display: 'none', marginTop: 40, paddingTop: 30 }}>
            <div style={{ fontSize: 10, color: '#666', textAlign: 'justify', marginBottom: 40 }}>
              Declaramos para os devidos fins legais e fiscais que a presente Demonstração do Resultado do Exercício reflete com fidelidade as operações contábeis, receitas auferidas, deduções legais, custos incorridos e despesas operacionais da sociedade empresária no período de apuração retrocitado, sob as normas da legislação contábil brasileira (Lei nº 6.404/76 e normas CFC/CPC).
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, textAlign: 'center' }}>
              <div>
                <div style={{ borderTop: '1px solid #000', width: 260, margin: '0 auto 6px' }}></div>
                <div style={{ fontWeight: 800, fontSize: 11 }}>DIRETORIA EXECUTIVA / ADMINISTRADOR</div>
                <div style={{ fontSize: 10, color: '#444' }}>{empresaAtiva.nome}</div>
              </div>
              <div>
                <div style={{ borderTop: '1px solid #000', width: 260, margin: '0 auto 6px' }}></div>
                <div style={{ fontWeight: 800, fontSize: 11 }}>CONTABILIDADE / RESPONSÁVEL TÉCNICO</div>
                <div style={{ fontSize: 10, color: '#444' }}>CRC/MT · Responsável Contábil</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── ESTILOS ESPECÍFICOS PARA IMPRESSÃO (@media print) ── */}
      <style>{`
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
            font-family: 'Helvetica Neue', Arial, sans-serif !important;
          }
          .no-print, .topbar, .sidebar, aside, nav, button {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .layout-main {
            margin-left: 0 !important;
            margin-top: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          .dre-container {
            padding: 0 !important;
            max-width: 100% !important;
          }
          table {
            border: 1px solid #ddd !important;
          }
          th, td {
            border-bottom: 1px solid #eee !important;
          }
        }
      `}</style>
    </div>
  );
}
