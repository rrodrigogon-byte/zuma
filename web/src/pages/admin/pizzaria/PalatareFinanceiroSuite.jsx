import React, { useState, useMemo } from 'react';
import FiltroPeriodoData from '../../../components/FiltroPeriodoData';

import { useToast } from '../../../hooks/useToast';

export default function PalatareFinanceiroSuite() {
  const { toast } = useToast();
  const [subAba, setSubAba] = useState('receber_tef'); // 'receber_tef' | 'pagar_insumos' | 'dre' | 'fechamento_caixa' | 'planejamento'
  const [filtroStatusPagar, setFiltroStatusPagar] = useState('todos');
  const [periodoFiltro, setPeriodoFiltro] = useState('mes_atual');
  const [fatorFiltro, setFatorFiltro] = useState(1.0);
  const [rotuloPeriodo, setRotuloPeriodo] = useState('Novembro/2026');

  const handlePeriodoChange = (id, config) => {
    setPeriodoFiltro(id);
    setFatorFiltro(config.fator || 1.0);
    setRotuloPeriodo(config.label || id);
  };


  // Modais
  const [modalNovoPagar, setModalNovoPagar] = useState(false);
  const [modalFechamentoTurno, setModalFechamentoTurno] = useState(false);

  // Contas a Receber, TEF, Pix & Marketplaces
  const [recebiveisTef, setRecebiveisTef] = useState([
    {
      id: 'REC-PIX-HOJE',
      canal: 'Pix Banco Central (Banco do Brasil)',
      tipo: 'Pix Instantâneo (QR Code Dinâmico PDV & Mesa)',
      volumeHoje: 48,
      valorBruto: 6840.00,
      taxaPercent: 0.40,
      valorTaxa: 27.36,
      valorLiquido: 6812.64,
      prazoLiquidacao: 'D+0 (Instantâneo na Conta)',
      status: 'liquidado'
    },
    {
      id: 'REC-CARTAO-DEB',
      canal: 'Cartões Débito (Stone / Rede)',
      tipo: 'Vendas Balcão & Mesa Salão',
      volumeHoje: 32,
      valorBruto: 4120.00,
      taxaPercent: 0.99,
      valorTaxa: 40.78,
      valorLiquido: 4079.22,
      prazoLiquidacao: 'D+1 (Amanhã 10h)',
      status: 'a_receber'
    },
    {
      id: 'REC-CARTAO-CRED',
      canal: 'Cartões Crédito à Vista (Visa / Master / Elo)',
      tipo: 'Vendas Salão & Rodízio',
      volumeHoje: 41,
      valorBruto: 7450.00,
      taxaPercent: 1.89,
      valorTaxa: 140.80,
      valorLiquido: 7309.20,
      prazoLiquidacao: 'D+30 (ou Antecipação 1,2% a.m.)',
      status: 'a_receber'
    },
    {
      id: 'REC-IFOOD',
      canal: 'iFood Marketplace (Delivery Tangará)',
      tipo: 'Pedidos Online com Entrega Própria',
      volumeHoje: 29,
      valorBruto: 3280.00,
      taxaPercent: 12.00,
      valorTaxa: 393.60,
      valorLiquido: 2886.40,
      prazoLiquidacao: 'Repasse Quarta-feira Semanal',
      status: 'a_receber'
    },
    {
      id: 'REC-KEETA',
      canal: 'Keeta Delivery Food',
      tipo: 'Pedidos App Keeta Tangará da Serra',
      volumeHoje: 14,
      valorBruto: 1450.00,
      taxaPercent: 10.00,
      valorTaxa: 145.00,
      valorLiquido: 1305.00,
      prazoLiquidacao: 'Repasse Quinquenal',
      status: 'a_receber'
    },
    {
      id: 'REC-CLUBE-MRR',
      canal: 'Palatare Pizza Club (Stripe / Iugu)',
      tipo: 'Recorrência Mensal Assinaturas VIP',
      volumeHoje: 348,
      valorBruto: 24360.00,
      taxaPercent: 1.50,
      valorTaxa: 365.40,
      valorLiquido: 23994.60,
      prazoLiquidacao: 'Débito Automático Cartão Recorrente',
      status: 'liquidado'
    }
  ]);

  // Contas a Pagar Gastronômicas & Fornecedores
  const [contasPagar, setContasPagar] = useState([
    {
      id: 'PAG-PIZ-01',
      fornecedor: 'Laticínios Scala & Burrata Viva',
      categoria: 'Queijos Especiais & Muçarela',
      nf: 'NF-e 89.201',
      vencimento: '18/11/2026',
      valor: 18400.00,
      status: 'aberto',
      detalhes: '600 kg muçarela fatiada + 120 un burrata de búfala'
    },
    {
      id: 'PAG-PIZ-02',
      fornecedor: 'Moinhos Le 5 Stagioni / Caputo Brasil',
      categoria: 'Farinha Tipo 00 & Sêmola',
      nf: 'NF-e 44.110',
      vencimento: '22/11/2026',
      valor: 9800.00,
      status: 'aberto',
      detalhes: '1.200 kg farinha italiana para longa fermentação 48h'
    },
    {
      id: 'PAG-PIZ-03',
      fornecedor: 'Berna Charcutaria Artesanal',
      categoria: 'Pepperoni, Presunto Parma & Costela',
      nf: 'NF-e 19.340',
      vencimento: '25/11/2026',
      valor: 12200.00,
      status: 'aberto',
      detalhes: 'Pepperoni fatiado calibre 44mm, pancetta e copa'
    },
    {
      id: 'PAG-PIZ-04',
      fornecedor: 'Distribuidora Bebidas Tangará (Ambev / Heineken)',
      categoria: 'Cervejas, Chopp Artesanal & Refrigerantes',
      nf: 'NF-e 102.840',
      vencimento: '20/11/2026',
      valor: 14500.00,
      status: 'aberto',
      detalhes: 'Barris de chopp 50L, cervejas long neck e refrigerantes'
    },
    {
      id: 'PAG-PIZ-05',
      fornecedor: 'BioLenha Tangará (Eucalipto Certificado)',
      categoria: 'Lenha Ecológica Forno a Lenha 400°C',
      nf: 'NF-e 04.991',
      vencimento: '15/11/2026',
      valor: 4200.00,
      status: 'pago',
      detalhes: '12 metros estéreos de lenha seca com baixa umidade (<15%)'
    },
    {
      id: 'PAG-PIZ-06',
      fornecedor: 'Embalagens Tangará Express',
      categoria: 'Caixas Térmicas Oitavadas 35cm e 40cm',
      nf: 'NF-e 33.109',
      vencimento: '12/11/2026',
      valor: 5800.00,
      status: 'pago',
      detalhes: '5.000 caixas kraft personalizadas com ventilação anti-umidade'
    },
    {
      id: 'PAG-PIZ-07',
      fornecedor: 'Folha de Pagamento Pizzaiolos & Salão',
      categoria: 'Recursos Humanos & Equipe Gastronômica',
      nf: 'Folha Mensal',
      vencimento: '05/12/2026',
      valor: 52000.00,
      status: 'aberto',
      detalhes: 'Chefe pizzaiolo napolitano, 3 auxiliares, forneiro, 6 garçons e copeira'
    },
    {
      id: 'PAG-PIZ-08',
      fornecedor: 'Aluguel do Salão Nobre Tangará da Serra',
      categoria: 'Ocupação & Ponto Comercial',
      nf: 'Recibo Locação',
      vencimento: '10/11/2026',
      valor: 12000.00,
      status: 'pago',
      detalhes: 'Imóvel comercial com salão climatizado e área kids'
    }
  ]);

  // Form de Novo Título a Pagar
  const [formPagar, setFormPagar] = useState({
    fornecedor: '',
    categoria: 'Insumos Alimentos & Bebidas',
    nf: '',
    vencimento: '',
    valor: '',
    detalhes: ''
  });

  // KPIs Totais Calculados
  const totalRecebiveisHoje = useMemo(() => {
    return recebiveisTef.reduce((acc, r) => acc + r.valorLiquido, 0);
  }, [recebiveisTef]);

  const totalPagarAberto = useMemo(() => {
    return contasPagar.filter(p => p.status === 'aberto').reduce((acc, p) => acc + p.valor, 0);
  }, [contasPagar]);

  const totalPagoMes = useMemo(() => {
    return contasPagar.filter(p => p.status === 'pago').reduce((acc, p) => acc + p.valor, 0);
  }, [contasPagar]);

  const saldoCaixaPizzaria = 168200.00;

  // Baixa de Título
  const handleBaixarPagar = (id) => {
    setContasPagar(prev => prev.map(p => {
      if (p.id === id) return { ...p, status: 'pago' };
      return p;
    }));
    toast({ title: 'Título Liquidado', description: `Despesa ${id} paga com sucesso.`, status: 'success' });
  };

  // Salvar Novo Pagar
  const handleSalvarPagar = (e) => {
    e.preventDefault();
    const v = Number(formPagar.valor) || 0;
    const novo = {
      id: `PAG-PIZ-${Math.floor(10 + Math.random() * 90)}`,
      fornecedor: formPagar.fornecedor,
      categoria: formPagar.categoria,
      nf: formPagar.nf || 'Avulso',
      vencimento: formPagar.vencimento ? new Date(formPagar.vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
      valor: v,
      status: 'aberto',
      detalhes: formPagar.detalhes || 'Despesa gastronômica'
    };
    setContasPagar(prev => [novo, ...prev]);
    setModalNovoPagar(false);
    toast({ title: 'Conta a Pagar Cadastrada', description: `Lançamento ${novo.id} incluído.`, status: 'success' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '16px 0' }}>
      
      {/* ─── CABEÇALHO FINANCEIRO DA PIZZARIA ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.8rem' }}>🍕💰</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                Gestão Financeira, CMV & DRE · Palatare Pizzaria
              </h2>
              <div style={{ fontSize: '0.86rem', color: 'var(--muted)', marginTop: 2 }}>
                Conciliação TEF/Cartões · Contas a Pagar (Insumos) · Engenharia de CMV (Meta: 30%) · DRE Gerencial
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button 
            type="button" 
            className="serrano-btn-gold"
            onClick={() => setModalNovoPagar(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', fontWeight: 700 }}
          >
            <span>🧾</span>
            Novo Contas a Pagar
          </button>

          <button 
            type="button" 
            className="serrano-btn-outline"
            onClick={() => setModalFechamentoTurno(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', fontWeight: 700 }}
          >
            <span>🔐</span>
            Fechamento de Caixa Turno
          </button>
        </div>
      </div>

      {/* ─── COCKPIT DE KPIS FINANCEIROS ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
        
        {/* Card 1: Faturamento Mensal */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--joint)', borderRadius: 14, padding: 18, borderLeft: '4px solid #10B981' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>
            Faturamento Mensal
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#10B981', marginTop: 4 }}>
            R$ 320.000,00
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>
            Salão + Delivery + Rodízio + Clube
          </div>
        </div>

        {/* Card 2: CMV Controlado */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--joint)', borderRadius: 14, padding: 18, borderLeft: '4px solid #3B82F6' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>
            CMV Geral Realizado
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#3B82F6', marginTop: 4 }}>
            30,0%
          </div>
          <div style={{ fontSize: '0.78rem', color: '#10B981', fontWeight: 700, marginTop: 4 }}>
            ✓ R$ 96.000,00 (Meta Abrasel batida)
          </div>
        </div>

        {/* Card 3: EBITDA Gastronômico */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--joint)', borderRadius: 14, padding: 18, borderLeft: '4px solid #C5A059' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>
            EBITDA da Pizzaria
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#C5A059', marginTop: 4 }}>
            R$ 110.000,00
          </div>
          <div style={{ fontSize: '0.78rem', color: '#10B981', fontWeight: 700, marginTop: 4 }}>
            Margem EBITDA: 34,4% s/ Receita
          </div>
        </div>

        {/* Card 4: Saldo em Conta */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--joint)', borderRadius: 14, padding: 18, borderLeft: '4px solid #8B5CF6' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>
            Saldo em Caixa & Bancos
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#8B5CF6', marginTop: 4 }}>
            R$ {saldoCaixaPizzaria.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>
            Banco do Brasil Ag 0892 Tangará
          </div>
        </div>

        {/* Card 5: MRR Clube de Assinaturas */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--joint)', borderRadius: 14, padding: 18, borderLeft: '4px solid #F59E0B' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>
            Receita Recorrente (Pizza Club)
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#F59E0B', marginTop: 4 }}>
            R$ 24.360,00/mês
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>
            348 membros VIP recorrentes
          </div>
        </div>

      </div>

      {/* ─── NAVEGAÇÃO DE SUB-ABAS ─── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--joint)', paddingBottom: 10 }}>
        {[
          { id: 'receber_tef', label: 'Conciliação TEF, Pix & Marketplaces', icone: '💳' },
          { id: 'pagar_insumos', label: 'Contas a Pagar & Insumos Gastronômicos', icone: '🧾', badge: contasPagar.filter(p => p.status === 'aberto').length },
          { id: 'dre', label: 'DRE Gerencial Completa da Gastronomia', icone: '📊' },
          { id: 'fechamento_caixa', label: 'Fechamento de Caixa Diário por Turno', icone: '🔐' },
          { id: 'planejamento', label: 'Planejamento Financeiro de Expansão (+100%)', icone: '🎯' }
        ].map(item => {
          const ativo = subAba === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubAba(item.id)}
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                border: '1px solid',
                borderColor: ativo ? '#FF6B2C' : 'var(--joint)',
                background: ativo ? 'rgba(255, 107, 44, 0.12)' : 'var(--surface)',
                color: ativo ? '#FF6B2C' : 'var(--text-main)',
                fontWeight: ativo ? 900 : 600,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.15s ease'
              }}
            >
              <span>{item.icone}</span>
              {item.label}
              {item.badge !== undefined && item.badge > 0 && (
                <span style={{ 
                  background: ativo ? '#FF6B2C' : 'var(--joint)', 
                  color: ativo ? '#fff' : 'var(--text-main)', 
                  borderRadius: 10, 
                  padding: '2px 7px', 
                  fontSize: '0.72rem', 
                  fontWeight: 900 
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── CONTEÚDO 1: CONCILIAÇÃO TEF, PIX & MARKETPLACES ─── */}
      {subAba === 'receber_tef' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--joint)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--joint)', color: 'var(--muted)', textTransform: 'uppercase', fontSize: '0.74rem', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '12px 16px' }}>Canal / Adquirente</th>
                  <th style={{ padding: '12px 16px' }}>Modalidade</th>
                  <th style={{ padding: '12px 16px' }}>Transações</th>
                  <th style={{ padding: '12px 16px' }}>Valor Bruto</th>
                  <th style={{ padding: '12px 16px' }}>Taxa Acordada</th>
                  <th style={{ padding: '12px 16px' }}>Valor Líquido</th>
                  <th style={{ padding: '12px 16px' }}>Prazo de Repasse</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recebiveisTef.map(rec => (
                  <tr key={rec.id} style={{ borderBottom: '1px solid var(--joint)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 800 }}>
                      <div style={{ color: 'var(--text-main)' }}>{rec.canal}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{rec.id}</div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.82rem' }}>{rec.tipo}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 700 }}>{rec.volumeHoje}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                      R$ {rec.valorBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#EF4444', fontWeight: 600 }}>
                      {rec.taxaPercent}% (- R$ {rec.valorTaxa.toFixed(2)})
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 900, color: '#10B981', fontSize: '0.96rem' }}>
                      R$ {rec.valorLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                      {rec.prazoLiquidacao}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ 
                        background: rec.status === 'liquidado' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: rec.status === 'liquidado' ? '#10B981' : '#3B82F6',
                        padding: '4px 9px',
                        borderRadius: 6,
                        fontSize: '0.75rem',
                        fontWeight: 800
                      }}>
                        {rec.status === 'liquidado' ? 'Liquidado em Conta' : 'A Repassar'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid #3B82F6', borderRadius: 10, padding: 14, fontSize: '0.84rem' }}>
            <b>💡 Otimização de Meios de Pagamento Kytto:</b> Incentivar Pix no autoatendimento da mesa e no delivery reduz o custo com taxas de cartão em até <b>R$ 3.800,00/mês</b>, uma vez que a taxa Pix é de apenas 0,40% com liquidação instantânea na conta jurídica.
          </div>
        </div>
      )}

      {/* ─── CONTEÚDO 2: CONTAS A PAGAR & INSUMOS GASTRONÔMICOS ─── */}
      {subAba === 'pagar_insumos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)' }}>Filtro:</span>
              {['todos', 'aberto', 'pago'].map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFiltroStatusPagar(st)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--joint)',
                    background: filtroStatusPagar === st ? 'var(--text-main)' : 'var(--surface)',
                    color: filtroStatusPagar === st ? 'var(--bg-card)' : 'var(--muted)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {st === 'todos' ? 'Todos' : st === 'aberto' ? 'A Pagar' : 'Pagos'}
                </button>
              ))}
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              Total a pagar em aberto: <b style={{ color: '#F59E0B' }}>R$ {totalPagarAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b>
            </div>
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--joint)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--joint)', color: 'var(--muted)', textTransform: 'uppercase', fontSize: '0.74rem', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '12px 16px' }}>Código</th>
                  <th style={{ padding: '12px 16px' }}>Fornecedor / Insumo</th>
                  <th style={{ padding: '12px 16px' }}>Categoria</th>
                  <th style={{ padding: '12px 16px' }}>Documento</th>
                  <th style={{ padding: '12px 16px' }}>Vencimento</th>
                  <th style={{ padding: '12px 16px' }}>Valor</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {contasPagar
                  .filter(p => filtroStatusPagar === 'todos' || p.status === filtroStatusPagar)
                  .map(pag => (
                    <tr key={pag.id} style={{ borderBottom: '1px solid var(--joint)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 800 }}>{pag.id}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{pag.fornecedor}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{pag.detalhes}</div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: 'rgba(0,0,0,0.05)', padding: '3px 8px', borderRadius: 4, fontSize: '0.76rem', fontWeight: 600 }}>
                          {pag.categoria}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: 'var(--muted)' }}>
                        {pag.nf}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                        {pag.vencimento}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 900, color: '#EF4444', fontSize: '0.98rem' }}>
                        R$ {pag.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ 
                          background: pag.status === 'pago' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: pag.status === 'pago' ? '#10B981' : '#F59E0B',
                          padding: '4px 9px',
                          borderRadius: 6,
                          fontSize: '0.75rem',
                          fontWeight: 800
                        }}>
                          {pag.status === 'pago' ? 'Pago' : 'A Pagar'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        {pag.status !== 'pago' ? (
                          <button
                            type="button"
                            onClick={() => handleBaixarPagar(pag.id)}
                            style={{
                              background: '#10B981',
                              border: 'none',
                              borderRadius: 6,
                              padding: '6px 12px',
                              color: '#fff',
                              cursor: 'pointer',
                              fontSize: '0.82rem',
                              fontWeight: 700
                            }}
                          >
                            ✓ Pagar
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: '#10B981', fontWeight: 700 }}>
                            Liquidado
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ─── CONTEÚDO 3: DRE GERENCIAL COMPLETA DA GASTRONOMIA ─── */}
      {subAba === 'dre' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--joint)', borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>
                DRE Gerencial Consolidada · Palatare Pizzaria & Restaurante
              </h3>
              <span style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>Competência: Novembro/2026</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: '(=) RECEITA BRUTA OPERACIONAL (FATURAMENTO TOTAL)', val: 320000.00 * fatorFiltro, perc: '100,0%', neg: false, bold: true, bg: 'rgba(0,0,0,0.03)' },
                { label: '   (+) Salão Gourmet & Rodízio Inteligente (Ter/Qua/Sex)', val: 195000.00 * fatorFiltro, perc: '60,9%', neg: false, bold: false },
                { label: '   (+) Delivery Multicanal (iFood · Keeta · WhatsApp Tangará)', val: 100640.00 * fatorFiltro, perc: '31,5%', neg: false, bold: false },
                { label: '   (+) Palatare Pizza Club (MRR Assinaturas Recorrentes)', val: 24360.00 * fatorFiltro, perc: '7,6%', neg: false, bold: false },
                { label: '(–) DEDUÇÕES, IMPOSTOS & TAXAS DE MEIOS DE PAGAMENTO', val: -38400.00 * fatorFiltro, perc: '-12,0%', neg: true, bold: true, bg: 'rgba(239, 68, 68, 0.05)' },
                { label: '   (–) Simples Nacional Anexo I (Alimentação - 6,84%)', val: -21888.00 * fatorFiltro, perc: '-6,8%', neg: true, bold: false },
                { label: '   (–) Comissões de Marketplaces (iFood 12% / Keeta 10%)', val: -10432.00 * fatorFiltro, perc: '-3,3%', neg: true, bold: false },
                { label: '   (–) Taxas de TEF e Cartões (Débito 0,99% / Crédito 1,89% / Pix)', val: -6080.00 * fatorFiltro, perc: '-1,9%', neg: true, bold: false },
                { label: '(=) RECEITA OPERACIONAL LÍQUIDA', val: 281600.00 * fatorFiltro, perc: '88,0%', neg: false, bold: true, bg: 'rgba(59, 130, 246, 0.08)', color: '#3B82F6' },
                { label: '(–) CUSTO DE MERCADORIAS VENDIDAS (CMV DIRETO INSUMOS)', val: -84480.00 * fatorFiltro, perc: '-30,0%', neg: true, bold: true, bg: 'rgba(245, 158, 11, 0.05)' },
                { label: '   (–) Queijos Especiais & Muçarela Scala (38%)', val: -32102.40 * fatorFiltro, perc: '-11,4%', neg: true, bold: false },
                { label: '   (–) Farinha Tipo 00 Italiana & Fermentos (17%)', val: -14361.60 * fatorFiltro, perc: '-5,1%', neg: true, bold: false },
                { label: '   (–) Charcutaria, Carnes Nobres & Recheios (25%)', val: -21120.00 * fatorFiltro, perc: '-7,5%', neg: true, bold: false },
                { label: '   (–) Molhos, Tomate San Marzano & Temperos (10%)', val: -8448.00 * fatorFiltro, perc: '-3,0%', neg: true, bold: false },
                { label: '   (–) Bebidas, Vinhos & Cervejas para Revenda (10%)', val: -8448.00 * fatorFiltro, perc: '-3,0%', neg: true, bold: false },
                { label: '(=) MARGEM DE CONTRIBUIÇÃO BRUTA', val: 197120.00 * fatorFiltro, perc: '70,0%', neg: false, bold: true, bg: 'rgba(16, 185, 129, 0.08)', color: '#10B981' },
                { label: '(–) CUSTOS FIXOS OPERACIONAIS & PESSOAL', val: -87120.00 * fatorFiltro, perc: '-30,9%', neg: true, bold: true },
                { label: '   (–) Equipe Gastronômica (Pizzaiolos, Forneiro, Garçons, Encargos)', val: -52000.00 * fatorFiltro, perc: '-18,5%', neg: true, bold: false },
                { label: '   (–) Aluguel do Ponto Salão Nobre Tangará da Serra', val: -12000.00 * fatorFiltro, perc: '-4,3%', neg: true, bold: false },
                { label: '   (–) Energia Elétrica, Gás GLP e Lenha Forno 400°C', val: -13120.00 * fatorFiltro, perc: '-4,7%', neg: true, bold: false },
                { label: '   (–) Embalagens Térmicas Kraft e Insumos de Despacho', val: -6800.00 * fatorFiltro, perc: '-2,4%', neg: true, bold: false },
                { label: '   (–) Software Kytto e Licenças Cloud', val: -3200.00 * fatorFiltro, perc: '-1,1%', neg: true, bold: false },
                { label: '(=) EBITDA OPERACIONAL DA PIZZARIA', val: 110000.00 * fatorFiltro, perc: '39,1%', neg: false, bold: true, bg: 'rgba(197, 160, 89, 0.15)', color: '#C5A059' },
                { label: '(–) Depreciação e Amortização de Forno e Mobiliário', val: -8000.00 * fatorFiltro, perc: '-2,8%', neg: true, bold: false },
                { label: '(=) LUCRO LÍQUIDO DISPONÍVEL DA PIZZARIA', val: 102000.00, perc: '36,2%', neg: false, bold: true, bg: 'rgba(16, 185, 129, 0.18)', color: '#10B981' }
              ].map((row, idx) => (
                <div 
                  key={idx}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '8px 12px', 
                    borderRadius: 6,
                    background: row.bg || 'transparent',
                    fontWeight: row.bold ? 800 : 500,
                    fontSize: row.bold ? '0.92rem' : '0.84rem'
                  }}
                >
                  <span style={{ color: row.color || 'var(--text-main)' }}>{row.label}</span>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span style={{ width: 60, textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)' }}>{row.perc}</span>
                    <span style={{ width: 140, textAlign: 'right', color: row.color || (row.neg ? '#EF4444' : 'var(--text-main)') }}>
                      R$ {row.val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* ─── CONTEÚDO 4: FECHAMENTO DE CAIXA DIÁRIO POR TURNO ─── */}
      {subAba === 'fechamento_caixa' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--joint)', borderRadius: 14, padding: 24 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', fontWeight: 900 }}>
              Auditoria de Fechamento de Caixa por Turno
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 20 }}>
              
              <div style={{ background: 'rgba(0,0,0,0.02)', padding: 18, borderRadius: 12, border: '1px solid var(--joint)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontWeight: 800, fontSize: '0.96rem' }}>Turno 1: Noite / Jantar Salão & Delivery</span>
                  <span style={{ background: '#10B981', color: '#fff', padding: '3px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 800 }}>Fechado</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>Responsável: <b>Carlos Forneiro (Supervisor)</b></div>
                  <div>Vendas em Dinheiro (Gaveta): <b>R$ 1.840,00</b></div>
                  <div>Vendas Cartão Débito/Crédito: <b>R$ 6.220,00</b></div>
                  <div>Vendas Pix Instantâneo: <b>R$ 4.190,00</b></div>
                  <div>Vendas iFood & Keeta: <b>R$ 2.450,00</b></div>
                  <div style={{ borderTop: '1px solid var(--joint)', paddingTop: 6, fontWeight: 900, color: '#10B981', fontSize: '0.96rem' }}>
                    Total Faturado Turno: R$ 14.700,00
                  </div>
                  <div>Diferença de Caixa: <b style={{ color: '#10B981' }}>R$ 0,00 (100% Conciliado)</b></div>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.02)', padding: 18, borderRadius: 12, border: '1px solid var(--joint)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontWeight: 800, fontSize: '0.96rem' }}>Turno 2: Rodízio de Sexta-feira</span>
                  <span style={{ background: '#3B82F6', color: '#fff', padding: '3px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 800 }}>Em Operação</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>Responsável: <b>Amanda Maitre</b></div>
                  <div>Total de Mesas Atendidas: <b>24 mesas (86 rodízios)</b></div>
                  <div>Receita em Andamento: <b>R$ 7.731,40</b></div>
                  <div>Gorjeta / Taxa de Serviço 10%: <b>R$ 773,14</b></div>
                  <div style={{ borderTop: '1px solid var(--joint)', paddingTop: 6, fontWeight: 900, color: '#3B82F6', fontSize: '0.96rem' }}>
                    Previsão de Fechamento: R$ 11.200,00
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ─── CONTEÚDO 5: PLANEJAMENTO FINANCEIRO DE EXPANSÃO (+100%) ─── */}
      {subAba === 'planejamento' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--joint)', borderRadius: 14, padding: 24 }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', fontWeight: 900, color: '#FF6B2C' }}>
              🎯 Roteiro Financeiro para Dobrar a Receita da Palatare (+100%)
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.86rem', color: 'var(--muted)' }}>
              Projeção de crescimento de <b>R$ 320.000,00</b> para <b>R$ 640.000,00/mês</b> ancorado em 4 alavancas estratégicas validadas no mercado gastronômico brasileiro:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {[
                { titulo: '1. Pizza Club (MRR)', de: 'R$ 24k', para: 'R$ 72k/mês', desc: 'Expandir base de 348 para 850 assinantes nos planos Tradizionale e Famiglia.' },
                { titulo: '2. Rodízio Expandido (4x/sem)', de: 'R$ 55k', para: 'R$ 130k/mês', desc: 'Incluir domingo no rodízio e oferecer opção de rodízio corporativo com chopp liberado.' },
                { titulo: '3. Almoço Executivo & Massas', de: 'R$ 0', para: 'R$ 95k/mês', desc: 'Aproveitamento da ociosidade diurna com pratos executivos de massas artesanais e pizzas individuais.' },
                { titulo: '4. Delivery Multicanal Otimizado', de: 'R$ 100k', para: 'R$ 190k/mês', desc: 'Campanhas de recompra por WhatsApp KyttoIA, redução de cancelamentos e combo família.' }
              ].map((alav, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.02)', padding: 16, borderRadius: 10, border: '1px solid var(--joint)' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-main)' }}>{alav.titulo}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
                    <span style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>{alav.de}</span>
                    <span>➔</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10B981' }}>{alav.para}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{alav.desc}</div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* ─── MODAL: NOVO CONTAS A PAGAR ─── */}
      {modalNovoPagar && (
        <div className="serrano-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
          <div style={{ background: 'var(--surface)', color: 'var(--text-main)', borderRadius: 14, maxWidth: 520, width: '100%', padding: 24, border: '1px solid var(--joint)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', fontWeight: 900 }}>
              Lançar Título no Contas a Pagar Gastronômico
            </h3>

            <form onSubmit={handleSalvarPagar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Fornecedor *</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Laticínios Scala"
                  value={formPagar.fornecedor}
                  onChange={e => setFormPagar({ ...formPagar, fornecedor: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--joint)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Categoria</label>
                  <select 
                    value={formPagar.categoria}
                    onChange={e => setFormPagar({ ...formPagar, categoria: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--joint)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                  >
                    <option value="Queijos e Laticínios">Queijos e Laticínios</option>
                    <option value="Farinhas e Grãos">Farinhas e Grãos</option>
                    <option value="Carnes e Charcutaria">Carnes e Charcutaria</option>
                    <option value="Bebidas e Vinhos">Bebidas e Vinhos</option>
                    <option value="Lenha e Gás">Lenha e Gás</option>
                    <option value="Embalagens Delivery">Embalagens Delivery</option>
                    <option value="Equipe e Salários">Equipe e Salários</option>
                    <option value="Aluguel e Ocupação">Aluguel e Ocupação</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Nota Fiscal / Cupom</label>
                  <input 
                    type="text"
                    placeholder="NF-e 12345"
                    value={formPagar.nf}
                    onChange={e => setFormPagar({ ...formPagar, nf: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--joint)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Data de Vencimento *</label>
                  <input 
                    type="date"
                    required
                    value={formPagar.vencimento}
                    onChange={e => setFormPagar({ ...formPagar, vencimento: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--joint)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Valor do Título (R$) *</label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    placeholder="0,00"
                    value={formPagar.valor}
                    onChange={e => setFormPagar({ ...formPagar, valor: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--joint)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button 
                  type="button" 
                  onClick={() => setModalNovoPagar(false)}
                  style={{ padding: '9px 16px', background: 'var(--surface)', border: '1px solid var(--joint)', color: 'var(--text-main)', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="serrano-btn-gold"
                  style={{ padding: '9px 18px', fontWeight: 800 }}
                >
                  Salvar Despesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: FECHAMENTO DE CAIXA DE TURNO ─── */}
      {modalFechamentoTurno && (
        <div className="serrano-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
          <div style={{ background: 'var(--surface)', color: 'var(--text-main)', borderRadius: 14, maxWidth: 500, width: '100%', padding: 24, border: '1px solid var(--joint)' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1.2rem', fontWeight: 900 }}>
              🔐 Fechar Caixa do Turno Atual
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--muted)', margin: '0 0 16px 0' }}>
              Confirmação e conciliação dos valores lançados no KDS, PDV de Balcão e mesas com a gaveta física.
            </p>

            <div style={{ background: 'rgba(0,0,0,0.02)', padding: 14, borderRadius: 8, border: '1px solid var(--joint)', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.84rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Faturado no Turno:</span>
                <b>R$ 14.700,00</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Dinheiro em Espécie (Gaveta):</span>
                <b>R$ 1.840,00</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Cartões & Pix (Conciliado):</span>
                <b>R$ 12.860,00</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--joint)', paddingTop: 6, color: '#10B981', fontWeight: 800 }}>
                <span>Diferença Apurada:</span>
                <span>R$ 0,00 (Caixa Perfeito)</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button 
                type="button" 
                onClick={() => setModalFechamentoTurno(false)}
                style={{ padding: '9px 16px', background: 'var(--surface)', border: '1px solid var(--joint)', color: 'var(--text-main)', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
              >
                Voltar
              </button>
              <button 
                type="button" 
                className="serrano-btn-gold"
                onClick={() => {
                  setModalFechamentoTurno(false);
                  toast({ title: 'Caixa Fechado com Sucesso', description: 'Relatório de fechamento arquivado e enviado à gerência.', status: 'success' });
                }}
                style={{ padding: '9px 18px', fontWeight: 800 }}
              >
                Confirmar Fechamento
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
