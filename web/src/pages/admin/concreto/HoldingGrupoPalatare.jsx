import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../lib/auth';
import {
  HOLDING_PALATARE_EMPRESA_ID,
  PALATARE_PIZZARIA_EMPRESA_ID,
  SERRANO_CONCRETO_EMPRESA_ID
} from '../../../lib/palatare-constants';

export default function HoldingGrupoPalatare({ setSecaoAtiva }) {
  const navigate = useNavigate();
  const { trocarEmpresa, empresaAtiva } = useAuth() || {};
  const [modalDossieAberto, setModalDossieAberto] = useState(false);
  const [filtroAbaInterna, setFiltroAbaInterna] = useState('todas'); // 'todas', 'empresas', 'societario', 'fiscais', 'licencas'

  const dadosHolding = {
    nomeGrupo: "Grupo Palatare",
    razaoSocial: "Holding Grupo Palatare Participações S/A",
    fundadorProprietario: "Alexandre Palatare",
    cargoFundador: "Fundador, Diretor-Presidente & Sócio-Controlador",
    cnpjControladora: "51.499.928/0001-01",
    cidade: "Tangará da Serra",
    uf: "MT",
    anoFundacao: "2018",
    capitalSocial: "R$ 4.850.000,00",
    totalColaboradores: 52,
    colaboradoresIndustria: 32,
    colaboradoresFoodService: 20,
    regimeTributario: "Tributação Integrada (Lucro Presumido / Real / Simples Nacional)",
    barramentoSefaz: "Síncrono A2 SEFAZ-MT · 100% Operacional",
    empresas: [
      {
        id: "palatare-pizzaria",
        empresaId: PALATARE_PIZZARIA_EMPRESA_ID,
        nomeFantasia: "Palatare Pizzaria & Restaurante",
        razaoSocial: "Palatare Pizzaria & Restaurante Ltda",
        segmento: "Gastronomia, Forno a Lenha, Rodízio & Delivery",
        participacaoGrupo: "100% Grupo Palatare",
        cnpj: "31.002.650/0001-08",
        inscricaoEstadual: "13.782.901-4 (SEFAZ-MT)",
        inscricaoMunicipal: "84.192 (Tangará da Serra)",
        cnaePrincipal: "56.11-2-01 — Restaurantes e similares",
        cnaesSecundarios: "56.11-2-03 (Lanchonetes e fast-food) · 56.20-1-04 (Fornecimento de alimentos)",
        endereco: "Rua Antônio Hortolani, Centro — Tangará da Serra/MT",
        responsavelOperacional: "Gerência Gastronômica & Brigada de Cozinha Palatare",
        contato: "(65) 99999-9455 / Instagram @palataretga",
        logo: "/palatare-logo.png",
        icone: "🍕",
        corDestaque: "#EF4444",
        corGradiente: "linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)",
        corBorda: "rgba(239, 68, 68, 0.4)",
        bgCard: "linear-gradient(180deg, #1A1212 0%, #140E0E 100%)",
        capacidadeEAtivos: [
          "Salão climatizado premium para 160 pessoas sentadas",
          "Forno a lenha napolitano a 400°C com lenha de reflorestamento",
          "Mais de 30 sabores finos de pizzas doces e salgadas",
          "Rodízio tradicional noturno e serviço à la carte de alta gastronomia",
          "Delivery estruturado com KDS em tempo real e frota dedicada de entregadores",
          "Adega climatizada e carta de chopps e cervejas artesanais"
        ],
        regimeFiscal: "NFC-e Mod 65 e NF-e Entrada via Kytto Barramento A2 Síncrono",
        linkPainel: "/admin/pizzaria",
        textoLink: "Abrir Painel Palatare Pizzaria"
      },
      {
        id: "serrano-concreto",
        empresaId: SERRANO_CONCRETO_EMPRESA_ID,
        nomeFantasia: "Serrano Concreto Usinado & Mineração",
        razaoSocial: "SERRANO CONCRETO USINADO & MINERAÇÃO LTDA",
        segmento: "Central Dosadora NBR 7212, FCK, Frota de Betoneiras & Mineração Sepotuba",
        participacaoGrupo: "100% Grupo Palatare",
        cnpjMatriz: "51.499.928/0001-01 (Mineração Rio Sepotuba)",
        cnpjUsinado: "53.798.485/0001-77 (Central de Concreto Usinado)",
        inscricaoEstadual: "14.229.191-9 (SEFAZ-MT)",
        inscricaoMunicipal: "92.381 (Tangará da Serra)",
        rntrcAntt: "056256077 (Transporte Rodoviário de Cargas)",
        creaMt: "Registro PJ MT-004819 · ART 2026/0491823-MT",
        responsavelTecnica: "Engª Karin Prestes (CREA-MT 027300)",
        cnaePrincipal: "23.30-3-05 — Preparação de massa de concreto e argamassa",
        cnaesSecundarios: "08.10-0-06 (Extração de areia e cascalho no Rio Sepotuba) · 49.30-2-02 (Transporte rodoviário)",
        endereco: "Distrito Industrial & Margens do Rio Sepotuba — Tangará da Serra/MT",
        logo: "/brand/concreto-usina-logo.png",
        icone: "🚚",
        corDestaque: "#FF7000",
        corGradiente: "linear-gradient(135deg, #FF7000 0%, #D97706 100%)",
        corBorda: "rgba(255, 112, 0, 0.4)",
        bgCard: "linear-gradient(180deg, #1C1917 0%, #141210 100%)",
        capacidadeEAtivos: [
          "Central Dosadora Convicta automatizada de 80 m³/h (NBR 7212)",
          "Balança Rodoviária Toledo 80t com 8 células digitais DLC-10t",
          "3 Silos verticais metálicos com capacidade combinada de 96t",
          "Frota própria de 5 caminhões betoneiras 8m³ e 2 bombas lança 32m",
          "Porto de extração mineral de areia e cascalho no Rio Sepotuba com L.O. SEMA-MT",
          "Laboratório tecnológico interno com prensa hidráulica 100t para ruptura NBR 5739"
        ],
        regimeFiscal: "NF-e Mod 55 (CFEM 1,5%), NFS-e Tangará (Dedução 70% materiais) e MDF-e frota",
        linkPainel: "/admin/concreto?secao=operacao-despacho",
        textoLink: "Abrir Despacho Serrano Concreto"
      }
    ],
    governanca: [
      {
        nome: "Alexandre Palatare",
        cargo: "Fundador, Diretor-Presidente & Sócio-Controlador",
        papel: "Liderança executiva máxima do Grupo Palatare, gestão estratégica de expansão, controle acionário integral (100%) e governança multissetorial.",
        badge: "Sócio-Controlador (100%)",
        corBadge: "#C5A059",
        icone: "👔"
      },
      {
        nome: "Engª Karin Prestes",
        cargo: "Diretoria de Engenharia & RT Usina",
        papel: "Responsabilidade técnica NBR 7212/5739, calibração da central Convicta, controle tecnológico de traços de concreto e ART CREA-MT 027300.",
        badge: "CREA-MT 027300",
        corBadge: "#FF7000",
        icone: "🔬"
      },
      {
        nome: "Diretoria de Gastronomia & Salão",
        cargo: "Coordenação Operacional Palatare",
        papel: "Padronização das receitas napolitanas a 400°C, gestão da brigada de salão, delivery e conformidade sanitária VISA Tangará.",
        badge: "Food Service & Salão",
        corBadge: "#EF4444",
        icone: "🍕"
      },
      {
        nome: "Centro de Serviços Compartilhados (CSC)",
        cargo: "Controladoria, Fiscal & KyttoIA",
        papel: "Gestão fiscal unificada, conciliação bancária, folha de pagamento de 52 colaboradores e barramento SEFAZ-MT A2 síncrono.",
        badge: "Shared Services",
        corBadge: "#10B981",
        icone: "💻"
      }
    ],
    certidoes: [
      { orgao: "SEFAZ-MT", descricao: "Certidão Negativa de Débitos Estaduais (CND) e Barramento A2 Síncrono", status: "Regular e Ativo", badge: "serrano-p-ok" },
      { orgao: "Receita Federal / PGFN", descricao: "Certidão Conjunta Negativa de Débitos Federais e Dívida Ativa da União", status: "Certificado Válido", badge: "serrano-p-ok" },
      { orgao: "SEMA-MT", descricao: "Licença de Operação (L.O.) nº 39218/2024 para dragagem no Rio Sepotuba", status: "Vigente até 2028", badge: "serrano-p-ok" },
      { orgao: "ANM", descricao: "Concessão de Lavra Mineral nº 867.412/2021 (CFEM Agregados 1,5%)", status: "Lavra Regular", badge: "serrano-p-ok" },
      { orgao: "CREA-MT", descricao: "Registro de Pessoa Jurídica MT-004819 e ART Técnica 2026/0491823-MT", status: "Habilitado", badge: "serrano-p-ok" },
      { orgao: "ANTT", descricao: "Registro Nacional de Transportadores Rodoviários de Cargas (RNTRC 056256077)", status: "Frota Autorizada", badge: "serrano-p-ok" },
      { orgao: "VISA Tangará", descricao: "Alvará Sanitário Municipal nº 2026/0148 para Alimentos e Cozinhas", status: "Aprovado", badge: "serrano-p-ok" },
      { orgao: "CBMMT", descricao: "Alvará de Prevenção e Combate a Incêndio (AVCB) Usina e Restaurante", status: "Vistoriado", badge: "serrano-p-ok" }
    ]
  };

  return (
    <div style={{ display: 'grid', gap: 24, paddingBottom: 40 }}>
      {/* ─── BANNER PRINCIPAL DO GRUPO PALATARE COM DESIGN EXECUTIVO ─── */}
      <div style={{
        background: 'radial-gradient(ellipse at top left, #23272F 0%, #14171C 60%, #0D0F12 100%)',
        border: '1px solid rgba(197, 160, 89, 0.45)',
        borderRadius: 16,
        padding: '30px 34px',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow dourado de fundo */}
        <div style={{
          position: 'absolute',
          top: -80,
          right: -80,
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(197, 160, 89, 0.18) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
            {/* Brasão Unificado dos Negócios com Conector Dourado */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'rgba(0, 0, 0, 0.55)',
              padding: '10px 16px',
              borderRadius: 14,
              border: '1px solid rgba(197, 160, 89, 0.35)',
              boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.1)'
            }}>
              <img
                src="/palatare-logo.png"
                alt="Palatare Pizzaria"
                style={{ width: 54, height: 54, borderRadius: '50%', border: '2px solid #C5A059', objectFit: 'contain', background: '#000' }}
              />
              <div style={{ width: 2, height: 40, background: 'linear-gradient(180deg, #C5A059 0%, #FF7000 100%)' }} />
              <div style={{
                width: 54,
                height: 54,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #FF7000 0%, #EA580C 100%)',
                color: '#16181B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: 22,
                boxShadow: '0 4px 14px rgba(255, 112, 0, 0.4)'
              }}>
                SC
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <span className="holding-gold-badge">
                  <span>🏛️</span> HOLDING CORPORATIVA &amp; GOVERNANÇA FAMILIAR
                </span>
                <span style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#34D399',
                  fontWeight: 800,
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 6
                }}>
                  ● 100% Capital Fechado
                </span>
              </div>
              <h1 style={{
                margin: '2px 0 8px',
                fontSize: 30,
                fontWeight: 900,
                color: '#FFFFFF',
                fontFamily: 'var(--font-display)',
                letterSpacing: '0.8px'
              }}>
                GRUPO PALATARE PARTICIPAÇÕES S/A
              </h1>
              <p style={{ margin: 0, color: '#D1D5DB', fontSize: 14.5, maxWidth: 860, lineHeight: 1.55 }}>
                Controladora integral sob liderança de <b>{dadosHolding.fundadorProprietario}</b>, proprietária da <b>Palatare Pizzaria &amp; Restaurante</b> e da <b>Serrano Concreto Usinado &amp; Mineração</b>. Conglomerado multinegócio de alta solidez em Tangará da Serra/MT, conectando a gastronomia de forno a lenha e a indústria da construção civil.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-serrano pri"
              style={{
                background: 'linear-gradient(135deg, #C5A059 0%, #A68037 100%)',
                borderColor: '#C5A059',
                color: '#000000',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 20px',
                borderRadius: 8,
                boxShadow: '0 4px 14px rgba(197, 160, 89, 0.35)',
                fontSize: 13
              }}
              onClick={() => setModalDossieAberto(true)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Dossiê Corporativo Oficial A4
            </button>
            <button
              type="button"
              className="btn-serrano"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                borderColor: 'rgba(255, 255, 255, 0.25)',
                fontWeight: 700,
                padding: '11px 18px',
                borderRadius: 8
              }}
              onClick={() => navigate('/admin/consolidacao-grupo')}
            >
              🏛️ Relatório Consolidado Holding
            </button>
          </div>
        </div>

        {/* Linha de Dados de Identificação com Destaque Dourado */}
        <div style={{
          marginTop: 24,
          paddingTop: 18,
          borderTop: '1px solid rgba(197, 160, 89, 0.2)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          fontSize: 12
        }}>
          <div>
            <span style={{ color: '#9CA3AF', display: 'block', fontSize: 11 }}>Proprietário Controlador:</span>
            <strong style={{ color: '#FFF', fontSize: 13.5 }}>{dadosHolding.fundadorProprietario}</strong>
          </div>
          <div>
            <span style={{ color: '#9CA3AF', display: 'block', fontSize: 11 }}>CNPJ Matriz da Holding:</span>
            <strong style={{ color: '#C5A059', fontFamily: 'var(--font-data)', fontSize: 13.5 }}>{dadosHolding.cnpjControladora}</strong>
          </div>
          <div>
            <span style={{ color: '#9CA3AF', display: 'block', fontSize: 11 }}>Sede Administrativa:</span>
            <strong style={{ color: '#FFF', fontSize: 13.5 }}>{dadosHolding.cidade} / {dadosHolding.uf}</strong>
          </div>
          <div>
            <span style={{ color: '#9CA3AF', display: 'block', fontSize: 11 }}>Quadro de Colaboradores:</span>
            <strong style={{ color: '#34D399', fontSize: 13.5 }}>{dadosHolding.totalColaboradores} colaboradores diretos</strong>
          </div>
          <div>
            <span style={{ color: '#9CA3AF', display: 'block', fontSize: 11 }}>Barramento Fiscal SEFAZ-MT:</span>
            <strong style={{ color: '#34D399', fontSize: 13.5 }}>Ativo &amp; Síncrono A2</strong>
          </div>
        </div>
      </div>

      {/* ─── COCKPIT DE KPIS EXECUTIVOS CONSOLIDADOS ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="holding-kpi-card">
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Capital Social Subscrito
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#C5A059', margin: '8px 0 4px', fontFamily: 'var(--font-display)' }}>
            {dadosHolding.capitalSocial}
          </div>
          <div style={{ fontSize: 11, color: '#10B981', fontWeight: 700 }}>
            ● 100% Integralizado
          </div>
        </div>

        <div className="holding-kpi-card">
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Força de Trabalho Integrada
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-main)', margin: '8px 0 4px', fontFamily: 'var(--font-display)' }}>
            52 Colaboradores
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            32 Indústria + 20 Food Service
          </div>
        </div>

        <div className="holding-kpi-card">
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Empresas Controladas
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-main)', margin: '8px 0 4px', fontFamily: 'var(--font-display)' }}>
            2 Unidades Líderes
          </div>
          <div style={{ fontSize: 11, color: '#C5A059', fontWeight: 700 }}>
            Pizzaria + Concreteira
          </div>
        </div>

        <div className="holding-kpi-card">
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Capacidade Industrial Usina
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#FF7000', margin: '8px 0 4px', fontFamily: 'var(--font-display)' }}>
            80 m³/h · 7 Veículos
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            5 Betoneiras + 2 Bombas Lança
          </div>
        </div>

        <div className="holding-kpi-card">
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Capacidade Gastronômica
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#EF4444', margin: '8px 0 4px', fontFamily: 'var(--font-display)' }}>
            160 Lugares · 400°C
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Forno Napolitano + Salão + Delivery
          </div>
        </div>
      </div>

      {/* ─── ABAS DE NAVEGAÇÃO SEGMENTADA ─── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--joint)', paddingBottom: 10 }}>
        {[
          { id: 'todas', label: 'Visão Completa do Conglomerado', icone: '🏢' },
          { id: 'empresas', label: 'Empresas Controladas (Pizzaria & Concreto)', icone: '🍕🚚' },
          { id: 'societario', label: 'Estrutura Societária & Alexandre Palatare', icone: '👔' },
          { id: 'fiscais', label: 'Matriz Tributária & Barramento A2', icone: '📑' },
          { id: 'licencas', label: 'Licenciamento & Conformidade Ambiental', icone: '🛡️' }
        ].map(item => {
          const ativo = filtroAbaInterna === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFiltroAbaInterna(item.id)}
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                border: '1px solid',
                borderColor: ativo ? '#C5A059' : 'var(--joint)',
                background: ativo ? 'rgba(197, 160, 89, 0.15)' : 'var(--surface)',
                color: ativo ? '#C5A059' : 'var(--text-main)',
                fontWeight: ativo ? 900 : 600,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: 15 }}>{item.icone}</span>
              {item.label}
            </button>
          );
        })}
      </div>

      {/* ─── ORGANOGRAMA SOCIETÁRIO E DE CONTROLE ACIONÁRIO VISUAL ─── */}
      {(filtroAbaInterna === 'todas' || filtroAbaInterna === 'societario') && (
        <div className="serrano-card">
          <div className="serrano-card-h">
            <div>
              <h3>Estrutura de Controle Societário &amp; Governança · Grupo Palatare</h3>
              <small style={{ color: 'var(--text-muted)' }}>
                Organograma institucional demonstrando o controle acionário unificado e integral de Alexandre Palatare sobre os dois negócios
              </small>
            </div>
            <span className="holding-gold-badge" style={{ marginLeft: 'auto' }}>
              Sociedade Anônima Fechada
            </span>
          </div>

          <div style={{ padding: '32px 24px', background: 'var(--surface-2)' }}>
            {/* 1. Nível Superior: Alexandre Palatare */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{
                background: 'linear-gradient(135deg, #16181B 0%, #22262C 100%)',
                border: '2px solid #C5A059',
                borderRadius: 14,
                padding: '18px 28px',
                textAlign: 'center',
                maxWidth: 520,
                width: '100%',
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                position: 'relative'
              }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: '#C5A059', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                  Proprietário Controlador &amp; Liderança Máxima
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#FFFFFF', margin: '4px 0' }}>
                  ALEXANDRE PALATARE
                </div>
                <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 10 }}>
                  Fundador, Diretor-Presidente &amp; Sócio-Controlador (100% das Ações Ordinárias)
                </div>
                <div style={{
                  background: 'rgba(197, 160, 89, 0.18)',
                  border: '1px solid rgba(197, 160, 89, 0.4)',
                  padding: '7px 14px',
                  borderRadius: 6,
                  color: '#F4E8C1',
                  fontSize: 12,
                  fontWeight: 800
                }}>
                  Holding Grupo Palatare Participações S/A · CNPJ 51.499.928/0001-01
                </div>
              </div>
            </div>

            {/* Linha Conectora Vertical */}
            <div style={{ display: 'flex', justifyContent: 'center', height: 36, position: 'relative' }}>
              <div style={{ width: 2, background: 'linear-gradient(180deg, #C5A059 0%, #9CA3AF 100%)' }} />
            </div>

            {/* Linha Horizontal de Ramificação */}
            <div style={{ maxWidth: 840, margin: '0 auto', position: 'relative' }}>
              <div style={{ borderTop: '2px solid #9CA3AF', margin: '0 25%' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 0 }}>
                {/* Conector esquerdo para Pizzaria */}
                <div style={{ width: 2, height: 28, background: '#EF4444', marginLeft: '25%' }} />
                {/* Conector direito para Concreto */}
                <div style={{ width: 2, height: 28, background: '#FF7000', marginRight: '25%' }} />
              </div>
            </div>

            {/* 2. Nível Inferior: As Duas Empresas Controladas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, maxWidth: 940, margin: '0 auto' }}>
              {/* Box da Pizzaria */}
              <div style={{
                background: 'linear-gradient(180deg, #1F1414 0%, #150D0D 100%)',
                border: '2px solid #EF4444',
                borderRadius: 12,
                padding: '20px 22px',
                boxShadow: '0 6px 20px rgba(239, 68, 68, 0.15)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 8, background: '#EF4444',
                      color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20
                    }}>
                      🍕
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#FFF' }}>
                        Palatare Pizzaria
                      </div>
                      <div style={{ fontSize: 11, color: '#EF4444', fontWeight: 700 }}>
                        Restaurante &amp; Delivery LTDA
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, background: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', padding: '2px 8px', borderRadius: 4, fontWeight: 800 }}>
                    100% Grupo Palatare
                  </span>
                </div>

                <div style={{ fontSize: 12, color: '#D1D5DB', display: 'grid', gap: 4, marginBottom: 14 }}>
                  <div>CNPJ: <b style={{ color: '#FFF', fontFamily: 'var(--font-data)' }}>31.002.650/0001-08</b></div>
                  <div>IE: <b style={{ color: '#FFF' }}>13.782.901-4 (SEFAZ-MT)</b></div>
                  <div>Atuação: <b>Forno napolitano 400°C, salão 160 lugares e delivery.</b></div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (trocarEmpresa) trocarEmpresa(PALATARE_PIZZARIA_EMPRESA_ID);
                    navigate('/admin/pizzaria');
                  }}
                  style={{
                    width: '100%',
                    background: '#EF4444',
                    color: '#FFF',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: 6,
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  🍕 Abrir Painel da Pizzaria
                </button>
              </div>

              {/* Box da Concreteira */}
              <div style={{
                background: 'linear-gradient(180deg, #1F1914 0%, #15110D 100%)',
                border: '2px solid #FF7000',
                borderRadius: 12,
                padding: '20px 22px',
                boxShadow: '0 6px 20px rgba(255, 112, 0, 0.15)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 8, background: '#FF7000',
                      color: '#16181B', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, fontWeight: 900
                    }}>
                      SC
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#FFF' }}>
                        Serrano Concreto
                      </div>
                      <div style={{ fontSize: 11, color: '#FF7000', fontWeight: 700 }}>
                        Usinado &amp; Mineração LTDA
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, background: 'rgba(255, 112, 0, 0.2)', color: '#FF7000', padding: '2px 8px', borderRadius: 4, fontWeight: 800 }}>
                    100% Grupo Palatare
                  </span>
                </div>

                <div style={{ fontSize: 12, color: '#D1D5DB', display: 'grid', gap: 4, marginBottom: 14 }}>
                  <div>CNPJ Usina: <b style={{ color: '#FFF', fontFamily: 'var(--font-data)' }}>53.798.485/0001-77</b></div>
                  <div>IE: <b style={{ color: '#FFF' }}>14.229.191-9 (SEFAZ-MT)</b></div>
                  <div>Atuação: <b>Central Convicta 80m³/h, 5 betoneiras e mineração Sepotuba.</b></div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (trocarEmpresa) trocarEmpresa(SERRANO_CONCRETO_EMPRESA_ID);
                    if (setSecaoAtiva) setSecaoAtiva('operacao-despacho');
                    else navigate('/admin/concreto');
                  }}
                  style={{
                    width: '100%',
                    background: '#FF7000',
                    color: '#16181B',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: 6,
                    fontWeight: 900,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  🚚 Abrir Despacho Serrano Concreto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── APRESENTAÇÃO DETALHADA DAS DUAS EMPRESAS CONTROLADAS ─── */}
      {(filtroAbaInterna === 'todas' || filtroAbaInterna === 'empresas') && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 20 }}>
          {/* EMPRESA 1: PALATARE PIZZARIA */}
          {(() => {
            const emp = dadosHolding.empresas[0];
            return (
              <div key={emp.id} className="holding-company-card" style={{ borderTop: `4px solid ${emp.corDestaque}` }}>
                <div className="serrano-card-h" style={{ background: 'var(--surface-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img
                      src={emp.logo}
                      alt={emp.nomeFantasia}
                      style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${emp.corDestaque}`, objectFit: 'contain', background: '#000' }}
                    />
                    <div>
                      <h3 style={{ color: emp.corDestaque }}>{emp.nomeFantasia}</h3>
                      <small style={{ color: 'var(--text-muted)' }}>{emp.segmento}</small>
                    </div>
                  </div>
                  <span style={{ marginLeft: 'auto', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', padding: '3px 8px', borderRadius: 4, fontWeight: 800, fontSize: 11 }}>
                    {emp.participacaoGrupo}
                  </span>
                </div>

                <div style={{ padding: 20, display: 'grid', gap: 16 }}>
                  {/* Ficha Cadastral */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'var(--surface-2)', padding: 14, borderRadius: 8, fontSize: 12 }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Razão Social:</span>
                      <b>{emp.razaoSocial}</b>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>CNPJ Oficial:</span>
                      <b style={{ fontFamily: 'var(--font-data)', color: '#EF4444' }}>{emp.cnpj}</b>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Inscrição Estadual SEFAZ-MT:</span>
                      <b style={{ fontFamily: 'var(--font-data)' }}>{emp.inscricaoEstadual}</b>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Inscrição Municipal:</span>
                      <b style={{ fontFamily: 'var(--font-data)' }}>{emp.inscricaoMunicipal}</b>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>CNAE Principal:</span>
                      <b>{emp.cnaePrincipal}</b>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Localização:</span>
                      <span>📍 {emp.endereco}</span>
                    </div>
                  </div>

                  {/* Ativos e Capacidade */}
                  <div>
                    <b style={{ fontSize: 13, display: 'block', marginBottom: 8, color: 'var(--text-main)' }}>
                      Capacidade Produtiva &amp; Ativos Gastronômicos:
                    </b>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-muted)', display: 'grid', gap: 4 }}>
                      {emp.capacidadeEAtivos.map((at, idx) => (
                        <li key={idx}><b>{at.split(' ')[0]}</b> {at.substring(at.indexOf(' ') + 1)}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Ações Rápidas */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 6 }}>
                    <button
                      type="button"
                      className="btn-serrano pri"
                      style={{ background: '#EF4444', borderColor: '#EF4444', color: '#FFF', fontWeight: 800 }}
                      onClick={() => {
                        if (trocarEmpresa) trocarEmpresa(PALATARE_PIZZARIA_EMPRESA_ID);
                        navigate(emp.linkPainel);
                      }}
                    >
                      🍕 {emp.textoLink}
                    </button>
                    <button
                      type="button"
                      className="btn-serrano"
                      onClick={() => navigate('/admin/cardapio')}
                    >
                      📜 Cardápio &amp; Mesas
                    </button>
                    <button
                      type="button"
                      className="btn-serrano"
                      onClick={() => navigate('/admin/cozinha')}
                    >
                      👨‍🍳 KDS Forno a Lenha
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* EMPRESA 2: SERRANO CONCRETO */}
          {(() => {
            const emp = dadosHolding.empresas[1];
            return (
              <div key={emp.id} className="holding-company-card" style={{ borderTop: `4px solid ${emp.corDestaque}` }}>
                <div className="serrano-card-h" style={{ background: 'var(--surface-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: '#FF7000',
                      color: '#16181B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: 18,
                      boxShadow: '0 2px 8px rgba(255, 112, 0, 0.4)'
                    }}>
                      SC
                    </div>
                    <div>
                      <h3 style={{ color: emp.corDestaque }}>{emp.nomeFantasia}</h3>
                      <small style={{ color: 'var(--text-muted)' }}>{emp.segmento}</small>
                    </div>
                  </div>
                  <span style={{ marginLeft: 'auto', background: 'rgba(255, 112, 0, 0.15)', color: '#FF7000', padding: '3px 8px', borderRadius: 4, fontWeight: 800, fontSize: 11 }}>
                    {emp.participacaoGrupo}
                  </span>
                </div>

                <div style={{ padding: 20, display: 'grid', gap: 16 }}>
                  {/* Ficha Cadastral */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'var(--surface-2)', padding: 14, borderRadius: 8, fontSize: 12 }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>CNPJ Matriz (Mineração):</span>
                      <b style={{ fontFamily: 'var(--font-data)' }}>{emp.cnpjMatriz.split(' ')[0]}</b>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>CNPJ Usina de Concreto:</span>
                      <b style={{ fontFamily: 'var(--font-data)', color: '#FF7000' }}>{emp.cnpjUsinado.split(' ')[0]}</b>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Inscrição Estadual (SEFAZ-MT):</span>
                      <b style={{ fontFamily: 'var(--font-data)' }}>{emp.inscricaoEstadual}</b>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Registro ANTT (RNTRC):</span>
                      <b style={{ fontFamily: 'var(--font-data)' }}>{emp.rntrcAntt.split(' ')[0]}</b>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Responsável Técnica (RT):</span>
                      <b style={{ color: 'var(--status-ok)' }}>{emp.responsavelTecnica}</b>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>CNAE Principal:</span>
                      <b>{emp.cnaePrincipal}</b>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Localização Operacional:</span>
                      <span>📍 {emp.endereco}</span>
                    </div>
                  </div>

                  {/* Ativos e Capacidade */}
                  <div>
                    <b style={{ fontSize: 13, display: 'block', marginBottom: 8, color: 'var(--text-main)' }}>
                      Capacidade Produtiva &amp; Ativos Industriais:
                    </b>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-muted)', display: 'grid', gap: 4 }}>
                      {emp.capacidadeEAtivos.map((at, idx) => (
                        <li key={idx}><b>{at.split(' ')[0]}</b> {at.substring(at.indexOf(' ') + 1)}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Ações Rápidas */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 6 }}>
                    <button
                      type="button"
                      className="btn-serrano pri"
                      style={{ background: '#FF7000', borderColor: '#FF7000', color: '#16181B', fontWeight: 900 }}
                      onClick={() => {
                        if (trocarEmpresa) trocarEmpresa(SERRANO_CONCRETO_EMPRESA_ID);
                        if (setSecaoAtiva) setSecaoAtiva('operacao-despacho');
                        else navigate('/admin/concreto');
                      }}
                    >
                      🚚 {emp.textoLink}
                    </button>
                    <button
                      type="button"
                      className="btn-serrano"
                      onClick={() => setSecaoAtiva('producao-central')}
                    >
                      🏭 Central Dosadora Convicta
                    </button>
                    <button
                      type="button"
                      className="btn-serrano"
                      onClick={() => setSecaoAtiva('vendas-faturamento')}
                    >
                      📑 Vendas &amp; Notas Fiscais
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ─── QUADRO DE SÓCIOS E ADMINISTRADORES (QSA) & DIRETORIA ─── */}
      {(filtroAbaInterna === 'todas' || filtroAbaInterna === 'societario') && (
        <div className="serrano-card">
          <div className="serrano-card-h">
            <div>
              <h3>Quadro de Sócios e Administradores (QSA) &amp; Diretoria Executiva</h3>
              <small style={{ color: 'var(--text-muted)' }}>
                Governança corporativa, liderança técnica de engenharia e responsabilidades legais do Grupo Palatare
              </small>
            </div>
            <span className="serrano-pill serrano-p-ok" style={{ marginLeft: 'auto', fontWeight: 700 }}>
              Administração Unificada
            </span>
          </div>

          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {dadosHolding.governanca.map((gov, i) => (
                <div key={i} style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--joint)',
                  borderRadius: 10,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 24 }}>{gov.icone}</span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: gov.corBadge || 'var(--text-main)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--joint)',
                        padding: '2px 8px',
                        borderRadius: 4
                      }}>
                        {gov.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-main)', marginBottom: 2 }}>
                      {gov.nome}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: gov.corBadge || '#C5A059', marginBottom: 8 }}>
                      {gov.cargo}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45, margin: 0 }}>
                      {gov.papel}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── MATRIZ TRIBUTÁRIA & BARRAMENTO FISCAL SEFAZ-MT A2 ─── */}
      {(filtroAbaInterna === 'todas' || filtroAbaInterna === 'fiscais') && (
        <div className="serrano-card">
          <div className="serrano-card-h">
            <div>
              <h3>Matriz Tributária Unificada &amp; Barramento Fiscal Síncrono A2</h3>
              <small style={{ color: 'var(--text-muted)' }}>
                Integração SEFAZ-MT, Prefeitura Municipal de Tangará da Serra e Receita Federal do Brasil
              </small>
            </div>
            <span className="serrano-pill serrano-p-ok" style={{ marginLeft: 'auto', fontWeight: 700 }}>
              Barramento A2 Síncrono Conectado
            </span>
          </div>

          <div style={{ padding: 20, display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8 }}>
                <b style={{ display: 'block', fontSize: 13, color: 'var(--text-main)', marginBottom: 4 }}>
                  📄 NF-e Modelo 55 (Agregados Minerais)
                </b>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Emitida pela Serrano Concreto para comercialização de areia média, areia grossa e cascalho lavados no Porto do Rio Sepotuba. Destaque de <b>1,5% de CFEM</b> e ICMS MT diferido conforme RICMS-MT.
                </p>
              </div>

              <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8 }}>
                <b style={{ display: 'block', fontSize: 13, color: 'var(--text-main)', marginBottom: 4 }}>
                  📑 NFS-e Serviços de Concretagem (LC 116/03)
                </b>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Emissão municipal sob o subitem 07.02 da LC 116/03 com dedução legal de <b>70% de materiais fornecidos</b> (cimento, agregados e aditivos) na base de cálculo do ISSQN de Tangará da Serra/MT.
                </p>
              </div>

              <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8 }}>
                <b style={{ display: 'block', fontSize: 13, color: 'var(--text-main)', marginBottom: 4 }}>
                  🍕 NFC-e Modelo 65 (Salão &amp; Delivery)
                </b>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Emitida pela Palatare Pizzaria na finalização de mesas e despacho de delivery com QR-Code SEFAZ-MT, segregação de ICMS Monofásico de bebidas e conciliação PIX instantânea.
                </p>
              </div>

              <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8 }}>
                <b style={{ display: 'block', fontSize: 13, color: 'var(--text-main)', marginBottom: 4 }}>
                  🚛 MDF-e &amp; CT-e de Frota Própria
                </b>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Manifesto Eletrônico de Documentos Fiscais para a frota de 5 betoneiras e basculantes da usina com amarração automática ao RNTRC ANTT 056256077 e Romaneio NBR 7212.
                </p>
              </div>
            </div>

            <div style={{ background: 'var(--status-ok-bg)', border: '1px solid var(--status-ok)', padding: 14, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <b style={{ color: 'var(--status-ok)', fontSize: 13, display: 'block' }}>
                  Auditoria Fiscal em Tempo Real: Regularidade Plena
                </b>
                <span style={{ fontSize: 11.5, color: 'var(--text-main)' }}>
                  Todas as inscrições estaduais e municipais do Grupo Palatare encontram-se ativas e sem pendências no Sistema de Conta Corrente Fiscal da SEFAZ-MT.
                </span>
              </div>
              <button
                type="button"
                className="btn-serrano pri"
                onClick={() => navigate('/admin/notas')}
              >
                Consultar Livro Fiscal Kytto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── LICENÇAS, CONCESSÕES MINERAIS & MEIO AMBIENTE ─── */}
      {(filtroAbaInterna === 'todas' || filtroAbaInterna === 'licencas') && (
        <div className="serrano-card">
          <div className="serrano-card-h">
            <div>
              <h3>Conformidade Regulatória, Licenciamento Ambiental &amp; Sanitário</h3>
              <small style={{ color: 'var(--text-muted)' }}>
                Certificados e licenças oficiais de operação das unidades de Tangará da Serra/MT
              </small>
            </div>
            <span className="serrano-pill serrano-p-ok" style={{ marginLeft: 'auto', fontWeight: 700 }}>
              100% Em Dia
            </span>
          </div>

          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {dadosHolding.certidoes.map((cert, idx) => (
                <div key={idx} style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--joint)',
                  borderRadius: 8,
                  padding: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <div>
                    <b style={{ fontSize: 13, display: 'block', color: 'var(--text-main)' }}>{cert.orgao}</b>
                    <small style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>{cert.descricao}</small>
                  </div>
                  <span className={`serrano-pill ${cert.badge}`} style={{ whiteSpace: 'nowrap', fontWeight: 700, fontSize: 11 }}>
                    {cert.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: DOSSIÊ CORPORATIVO OFICIAL A4 ─── */}
      {modalDossieAberto && (
        <div className="serrano-modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div className="serrano-modal-card" style={{
            maxWidth: 820,
            width: '100%',
            maxHeight: '92vh',
            overflowY: 'auto',
            background: '#FFFFFF',
            color: '#16181B',
            borderRadius: 14,
            padding: 32,
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
            fontFamily: 'var(--font-body)'
          }}>
            {/* Cabeçalho do Dossiê A4 Timbrado */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '3px solid #C5A059',
              paddingBottom: 16,
              marginBottom: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img src="/palatare-logo.png" alt="Palatare" style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid #C5A059' }} />
                <div style={{ width: 2, height: 44, background: '#DDD' }} />
                <div style={{ width: 52, height: 52, borderRadius: 10, background: '#FF7000', color: '#16181B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20 }}>
                  SC
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#16181B', letterSpacing: 0.5 }}>
                    GRUPO PALATARE PARTICIPAÇÕES S/A
                  </div>
                  <div style={{ fontSize: 11, color: '#C5A059', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Dossiê Corporativo Oficial · Estrutura Societária &amp; Governança
                  </div>
                  <div style={{ fontSize: 11, color: '#6B6F75' }}>
                    Sede Administrativa: Tangará da Serra/MT · CNPJ 51.499.928/0001-01
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{
                  background: '#E5F3EA',
                  color: '#1A7A43',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontWeight: 800,
                  fontSize: 11,
                  display: 'inline-block'
                }}>
                  DOSSIÊ OFICIAL
                </span>
                <div style={{ fontSize: 10, color: '#6B6F75', marginTop: 4 }}>
                  Emitido em: {new Date().toLocaleDateString('pt-BR')}
                </div>
              </div>
            </div>

            {/* Conteúdo do Dossiê */}
            <div style={{ fontSize: 12.5, lineHeight: 1.6, color: '#333', display: 'grid', gap: 16 }}>
              <div style={{ background: '#F8F9FA', border: '1px solid #E9ECEF', padding: 14, borderRadius: 8 }}>
                <b style={{ color: '#16181B', fontSize: 13, display: 'block', marginBottom: 4 }}>1. IDENTIFICAÇÃO DO PROPRIETÁRIO &amp; CONTROLE SOCIETÁRIO</b>
                <p style={{ margin: 0 }}>
                  A holding <b>Grupo Palatare Participações S/A</b> é uma pessoa jurídica de direito privado constituída sob a forma de Sociedade Anônima Fechada com sede no município de <b>Tangará da Serra / Mato Grosso</b>, sob controle societário integral e liderança executiva de <b>Alexandre Palatare</b> (Fundador, Diretor-Presidente e Sócio-Controlador com 100% das ações).
                </p>
              </div>

              <div>
                <b style={{ color: '#16181B', fontSize: 13, display: 'block', marginBottom: 8 }}>2. EMPRESAS INTEGRANTES DO GRUPO PALATARE</b>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ border: '1px solid #DDD', padding: 12, borderRadius: 6 }}>
                    <b style={{ color: '#EF4444', display: 'block', fontSize: 13 }}>Palatare Pizzaria &amp; Restaurante Ltda</b>
                    <div>CNPJ: <b>31.002.650/0001-08</b></div>
                    <div>Inscrição Estadual: 13.782.901-4 (SEFAZ-MT)</div>
                    <div>Localização: Centro, Tangará da Serra/MT</div>
                    <div>Atuação: Gastronomia fina, forno a lenha 400°C, rodízio e delivery.</div>
                    <div>Controle: <b>100% Grupo Palatare</b></div>
                  </div>

                  <div style={{ border: '1px solid #DDD', padding: 12, borderRadius: 6 }}>
                    <b style={{ color: '#FF7000', display: 'block', fontSize: 13 }}>SERRANO CONCRETO USINADO &amp; MINERAÇÃO LTDA</b>
                    <div>CNPJ Matriz: <b>51.499.928/0001-01</b> (Mineração)</div>
                    <div>CNPJ Usinado: <b>53.798.485/0001-77</b> (Usina de Concreto)</div>
                    <div>Inscrição Estadual: 14.229.191-9 (SEFAZ-MT) · ANTT: 056256077</div>
                    <div>Localização: Distrito Industrial &amp; Rio Sepotuba, Tangará da Serra/MT</div>
                    <div>Atuação: Central Convicta 80m³/h, balança 80t, 5 betoneiras e mineração.</div>
                    <div>Controle: <b>100% Grupo Palatare</b></div>
                  </div>
                </div>
              </div>

              <div>
                <b style={{ color: '#16181B', fontSize: 13, display: 'block', marginBottom: 8 }}>3. RESPONSABILIDADE TÉCNICA &amp; GOVERNANÇA OPERACIONAL</b>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: '#F1F3F5', borderBottom: '2px solid #DEE2E6', textAlign: 'left' }}>
                      <th style={{ padding: 6 }}>Nome</th>
                      <th style={{ padding: 6 }}>Função / Registro</th>
                      <th style={{ padding: 6 }}>Atribuição Legal</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #EEE' }}>
                      <td style={{ padding: 6 }}><b>Alexandre Palatare</b></td>
                      <td style={{ padding: 6 }}>Fundador &amp; Diretor-Presidente</td>
                      <td style={{ padding: 6 }}>Gestão Estratégica, Governança e Alocação de Capital (100% Controle)</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #EEE' }}>
                      <td style={{ padding: 6 }}><b>Engª Karin Prestes</b></td>
                      <td style={{ padding: 6 }}>CREA-MT 027300 · ART 2026/0491823-MT</td>
                      <td style={{ padding: 6 }}>Responsável Técnica Usina NBR 7212 e Laboratório NBR 5739</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #EEE' }}>
                      <td style={{ padding: 6 }}><b>Coordenação Food Service</b></td>
                      <td style={{ padding: 6 }}>Alvará Sanitário VISA 2026/0148</td>
                      <td style={{ padding: 6 }}>Padrão Gastronômico, Forno a Lenha e Qualidade</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ borderTop: '1px solid #E9ECEF', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 }}>
                <div style={{ textAlign: 'center', width: 260 }}>
                  <div style={{ borderBottom: '1px solid #333', marginBottom: 4, height: 28 }}></div>
                  <b>Alexandre Palatare</b><br />
                  <small style={{ color: '#666' }}>Fundador &amp; Diretor-Presidente · Grupo Palatare</small>
                </div>
                <div style={{ textAlign: 'center', width: 260 }}>
                  <div style={{ borderBottom: '1px solid #333', marginBottom: 4, height: 28 }}></div>
                  <b>Engª Karin Prestes</b><br />
                  <small style={{ color: '#666' }}>CREA-MT 027300 · Responsável Técnica</small>
                </div>
              </div>
            </div>

            {/* Rodapé do Modal com Botão Imprimir */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              marginTop: 24,
              borderTop: '1px solid #DDD',
              paddingTop: 16
            }}>
              <button
                type="button"
                className="btn-serrano"
                onClick={() => setModalDossieAberto(false)}
              >
                Fechar
              </button>
              <button
                type="button"
                className="btn-serrano pri"
                style={{ background: '#C5A059', borderColor: '#C5A059', color: '#000', fontWeight: 800 }}
                onClick={() => window.print()}
              >
                🖨️ Imprimir / Salvar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
