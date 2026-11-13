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
  const { trocarEmpresa } = useAuth() || {};
  const [modalDossieAberto, setModalDossieAberto] = useState(false);
  const [filtroAbaInterna, setFiltroAbaInterna] = useState('todas'); // 'todas', 'societario', 'empresas', 'fiscais', 'licencas'

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
        nomeFantasia: "Palatare Pizzaria & Restaurante",
        razaoSocial: "Palatare Pizzaria & Restaurante Ltda",
        segmento: "Gastronomia, Forno a Lenha, Rodízio & Delivery",
        participacaoGrupo: "100% Grupo Palatare",
        cnpj: "31.002.650/0001-08",
        inscricaoEstadual: "13.782.901-4 (SEFAZ-MT)",
        inscricaoMunicipal: "84.192 (Tangará da Serra)",
        cnaePrincipal: "56.11-2-01 — Restaurantes e similares",
        cnaesSecundarios: "56.11-2-03 (Lanchonetes, fast-food e similares) · 56.20-1-04 (Fornecimento de alimentos preparados para eventos)",
        endereco: "Rua Antônio Hortolani, Centro — Tangará da Serra/MT",
        responsavelOperacional: "Gerência de Operações Gastronômicas & Brigada Palatare",
        contato: "(65) 99999-9455 / Instagram @palataretga",
        logo: "/palatare-logo.png",
        corDestaque: "#FF6B2C",
        corBorda: "rgba(255, 107, 44, 0.35)",
        bgCard: "#1C130D",
        capacidadeEAtivos: [
          "Salão climatizado com capacidade para 160 pessoas sentadas",
          "Forno a lenha napolitano operando a 400°C com lenha de reflorestamento",
          "Cardápio com mais de 30 sabores finos de pizzas doces e salgadas",
          "Rodízio tradicional noturno e operação à la carte completa",
          "Sistema de Delivery próprio com KDS integrado e frota dedicada",
          "Adega de vinhos selecionados e chopps artesanais mato-grossenses"
        ],
        regimeFiscal: "Emissão de NFC-e Mod 65 e NF-e Entrada via Kytto Barramento A2",
        linkPainel: "/admin/pizzaria",
        linkSecundario: "/admin/cardapio",
        textoLink: "Acessar Palatare Pizzaria Suite"
      },
      {
        id: "serrano-concreto",
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
        cnaePrincipal: "23.30-3-05 — Preparação de massa de concreto e argamassa para construção",
        cnaesSecundarios: "08.10-0-06 (Extração de areia, cascalho e pedregulho no Rio Sepotuba) · 49.30-2-02 (Transporte rodoviário de carga)",
        endereco: "Distrito Industrial / Pátio de Usinagem & Margens do Rio Sepotuba — Tangará da Serra/MT",
        logo: "/brand/concreto-usina-logo.png",
        corDestaque: "#FF7000",
        corBorda: "rgba(255, 112, 0, 0.35)",
        bgCard: "#16181B",
        capacidadeEAtivos: [
          "Central Dosadora Convicta automatizada com capacidade de 80 m³/h (NBR 7212)",
          "Balança Rodoviária Toledo 80t com 8 células de carga digitais DLC-10t",
          "3 Silos verticais metálicos com capacidade estática combinada de 96t de cimento",
          "Frota própria de 5 caminhões betoneiras 8m³ (BT-01 a BT-05) e 2 bombas lança 32m (BL-01 e BL-02)",
          "Porto de extração mineral de areia e cascalho no Rio Sepotuba com licença SEMA-MT",
          "Laboratório tecnológico interno com prensa hidráulica 100t para ensaios NBR 5739"
        ],
        regimeFiscal: "NF-e Mod 55 (Agregados / CFEM 1,5%), NFS-e Tangará (Dedução 70% materiais LC 116/03) e MDF-e frota",
        linkPainel: "/admin/concreto?secao=operacao-despacho",
        linkSecundario: "/pdv",
        textoLink: "Acessar Despacho Serrano Concreto"
      }
    ],
    governanca: [
      {
        nome: "Alexandre Palatare",
        cargo: "Fundador, Diretor-Presidente & Sócio-Controlador",
        papel: "Liderança corporativa do Grupo Palatare, gestão de investimentos, expansão dos negócios e governança multissetorial.",
        badge: "Sócio-Controlador",
        icone: "👔"
      },
      {
        nome: "Engª Karin Prestes",
        cargo: "Diretoria de Engenharia & Responsável Técnica",
        papel: "Responsável técnica pelo controle tecnológico do concreto NBR 7212/5739, traços FCK, calibração da central e certificação CREA-MT 027300.",
        badge: "CREA-MT 027300",
        icone: "🔬"
      },
      {
        nome: "Diretoria de Operações Gastronômicas",
        cargo: "Coordenação Geral Palatare Pizzaria",
        papel: "Supervisão da qualidade culinária de forno a lenha, cadeia de frio, atendimento ao público e logística de entrega rápida.",
        badge: "Food Service & Salão",
        icone: "🍕"
      },
      {
        nome: "Centro de Serviços Compartilhados (CSC)",
        cargo: "Controladoria, Fiscal & Tecnologia Kytto",
        papel: "Fechamento contábil integrado, gestão da folha unificada de 52 colaboradores, transmissão SEFAZ-MT e orquestração KyttoIA.",
        badge: "Shared Services",
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
    <div style={{ display: 'grid', gap: 24 }}>
      {/* ─── BANNER PRINCIPAL DO GRUPO PALATARE ─── */}
      <div style={{
        background: 'linear-gradient(135deg, #16181B 0%, #20242A 50%, #1A1C1F 100%)',
        border: '1px solid rgba(197, 160, 89, 0.35)',
        borderRadius: 14,
        padding: '28px 32px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Detalhe de fundo dourado sutil */}
        <div style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(197, 160, 89, 0.12) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Logos integrados lado a lado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.4)', padding: '8px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
              <img
                src="/palatare-logo.png"
                alt="Palatare Pizzaria"
                style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid #C5A059', objectFit: 'contain', background: '#000' }}
              />
              <div style={{ width: 1, height: 38, background: 'rgba(255,255,255,0.2)' }} />
              <div style={{
                width: 52,
                height: 52,
                borderRadius: 10,
                background: '#FF7000',
                color: '#16181B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: 20,
                boxShadow: '0 4px 12px rgba(255, 112, 0, 0.3)'
              }}>
                SC
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{
                  color: '#C5A059',
                  fontWeight: 800,
                  fontSize: 12,
                  letterSpacing: '1.2px',
                  textTransform: 'uppercase'
                }}>
                  Holding Corporativa &amp; Governança Multinegócio
                </span>
                <span className="serrano-pill serrano-p-ok" style={{ fontWeight: 800 }}>
                  ● Controle Total 100% Grupo Palatare
                </span>
              </div>
              <h1 style={{
                margin: '4px 0 6px',
                fontSize: 28,
                fontWeight: 900,
                color: '#FFFFFF',
                fontFamily: 'var(--font-display)',
                letterSpacing: '0.5px'
              }}>
                GRUPO PALATARE PARTICIPAÇÕES S/A
              </h1>
              <p style={{ margin: 0, color: '#C9CBCE', fontSize: 14, maxWidth: 840, lineHeight: 1.5 }}>
                Fundado e liderado por <b>{dadosHolding.fundadorProprietario}</b>, o <b>Grupo Palatare</b> é o proprietário e controlador integral da <b>Palatare Pizzaria &amp; Restaurante</b> e da <b>Serrano Concreto Usinado &amp; Mineração</b>. Estrutura multinegócio sólida consolidada em Tangará da Serra/MT, unindo excelência gastronômica e infraestrutura pesada para a construção civil.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-serrano pri"
              style={{
                background: '#C5A059',
                borderColor: '#C5A059',
                color: '#16181B',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px'
              }}
              onClick={() => setModalDossieAberto(true)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Dossiê Corporativo Oficial A4
            </button>
            <button
              type="button"
              className="btn-serrano"
              style={{ background: 'rgba(255,255,255,0.08)', color: '#FFF', borderColor: 'rgba(255,255,255,0.2)' }}
              onClick={() => navigate('/admin/consolidacao-grupo')}
            >
              🏛️ Relatório Consolidado Holding
            </button>
          </div>
        </div>

        {/* Linha de Dados de Identificação Rápida */}
        <div style={{
          marginTop: 22,
          paddingTop: 18,
          borderTop: '1px solid rgba(255,255,255,0.12)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          fontSize: 12
        }}>
          <div>
            <span style={{ color: '#8E9297', display: 'block' }}>Proprietário &amp; Diretor-Presidente:</span>
            <strong style={{ color: '#FFF', fontSize: 13 }}>{dadosHolding.fundadorProprietario}</strong>
          </div>
          <div>
            <span style={{ color: '#8E9297', display: 'block' }}>CNPJ Matriz da Holding:</span>
            <strong style={{ color: '#C5A059', fontFamily: 'var(--font-data)', fontSize: 13 }}>{dadosHolding.cnpjControladora}</strong>
          </div>
          <div>
            <span style={{ color: '#8E9297', display: 'block' }}>Sede Administrativa:</span>
            <strong style={{ color: '#FFF', fontSize: 13 }}>{dadosHolding.cidade} / {dadosHolding.uf}</strong>
          </div>
          <div>
            <span style={{ color: '#8E9297', display: 'block' }}>Quadro de Colaboradores:</span>
            <strong style={{ color: '#3DBE74', fontSize: 13 }}>{dadosHolding.totalColaboradores} colaboradores diretos</strong>
          </div>
          <div>
            <span style={{ color: '#8E9297', display: 'block' }}>Barramento Fiscal SEFAZ-MT:</span>
            <strong style={{ color: '#3DBE74', fontSize: 13 }}>Ativo &amp; Síncrono A2</strong>
          </div>
        </div>
      </div>

      {/* ─── FILTROS DE NAVEGAÇÃO DA SEÇÃO ─── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--joint)', paddingBottom: 10 }}>
        {[
          { id: 'todas', label: 'Visão Completa do Grupo', icone: '🏢' },
          { id: 'empresas', label: 'Empresas Controladas (Pizzaria & Concreto)', icone: '🍕🚚' },
          { id: 'societario', label: 'Quadro Societário & Liderança (Alexandre Palatare)', icone: '👔' },
          { id: 'fiscais', label: 'Matriz Tributária & Barramento A2', icone: '📑' },
          { id: 'licencas', label: 'Licenças, Meio Ambiente & Órgãos', icone: '🛡️' }
        ].map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFiltroAbaInterna(item.id)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid',
              borderColor: filtroAbaInterna === item.id ? 'var(--serrano-orange)' : 'var(--joint)',
              background: filtroAbaInterna === item.id ? 'var(--serrano-orange-soft)' : 'var(--surface)',
              color: filtroAbaInterna === item.id ? 'var(--serrano-orange-text)' : 'var(--text-main)',
              fontWeight: filtroAbaInterna === item.id ? 800 : 600,
              fontSize: 12.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease'
            }}
          >
            <span>{item.icone}</span>
            {item.label}
          </button>
        ))}
      </div>

      {/* ─── ORGANOGRAMA SOCIETÁRIO E DE CONTROLE ACIONÁRIO ─── */}
      {(filtroAbaInterna === 'todas' || filtroAbaInterna === 'societario') && (
        <div className="serrano-card">
          <div className="serrano-card-h">
            <div>
              <h3>Estrutura de Controle Societário · Grupo Palatare</h3>
              <small style={{ color: 'var(--text-muted)' }}>
                Organograma institucional consolidado comprovando o controle acionário integral exercido por Alexandre Palatare
              </small>
            </div>
            <span className="serrano-pill serrano-p-ok" style={{ marginLeft: 'auto', fontWeight: 700 }}>
              Sociedade Anônima Fechada / Holding Familiar
            </span>
          </div>

          <div style={{ padding: 24, background: 'var(--surface-2)' }}>
            {/* Topo do Organograma: Alexandre Palatare e Holding */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{
                background: '#16181B',
                border: '2px solid #C5A059',
                borderRadius: 12,
                padding: '16px 24px',
                textAlign: 'center',
                maxWidth: 480,
                width: '100%',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
              }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#C5A059', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Proprietário Controlador &amp; Liderança Estratégica
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#FFF', margin: '4px 0' }}>
                  ALEXANDRE PALATARE
                </div>
                <div style={{ fontSize: 13, color: '#A9ADB2', marginBottom: 8 }}>
                  Fundador &amp; Diretor-Presidente do Grupo Palatare
                </div>
                <div style={{
                  background: 'rgba(197, 160, 89, 0.15)',
                  border: '1px solid rgba(197, 160, 89, 0.4)',
                  padding: '6px 12px',
                  borderRadius: 6,
                  color: '#F4E8C1',
                  fontSize: 12,
                  fontWeight: 700
                }}>
                  Holding Grupo Palatare Participações S/A · CNPJ 51.499.928/0001-01
                </div>
              </div>
            </div>

            {/* Linha conectora central com CSC */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 20px', maxWidth: 640 }}>
              <div style={{ flex: 1, height: 2, background: 'var(--joint)' }}></div>
              <div style={{
                padding: '6px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--joint)',
                borderRadius: 20,
                fontSize: 11.5,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textAlign: 'center'
              }}>
                Centro de Serviços Compartilhados (CSC Kytto ERP) · Gestão Financeira, Fiscal &amp; KyttoIA
              </div>
              <div style={{ flex: 1, height: 2, background: 'var(--joint)' }}></div>
            </div>

            {/* As Duas Pontas Operacionais (Pizzaria e Concreto) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              {/* Ponta 1: Palatare Pizzaria */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid rgba(255, 107, 44, 0.4)',
                borderTop: '4px solid #FF6B2C',
                borderRadius: 12,
                padding: 18,
                boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img src="/palatare-logo.png" alt="Palatare" style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #C5A059' }} />
                    <div>
                      <b style={{ fontSize: 15, display: 'block', color: 'var(--text-main)' }}>Divisão Alimentos &amp; Gastronomia</b>
                      <small style={{ color: '#FF6B2C', fontWeight: 700 }}>100% Controlada pelo Grupo Palatare</small>
                    </div>
                  </div>
                  <span className="serrano-pill" style={{ background: '#FFF0E3', color: '#B34700', fontWeight: 700 }}>
                    Food Service
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  <b>Palatare Pizzaria &amp; Restaurante Ltda</b> · CNPJ 31.002.650/0001-08<br />
                  Forno a lenha 400°C, rodízio com mais de 30 sabores, atendimento no Centro de Tangará da Serra e Delivery próprio.
                </div>
              </div>

              {/* Ponta 2: Serrano Concreto */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid rgba(255, 112, 0, 0.4)',
                borderTop: '4px solid #FF7000',
                borderRadius: 12,
                padding: 18,
                boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FF7000', color: '#16181B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15 }}>
                      SC
                    </div>
                    <div>
                      <b style={{ fontSize: 15, display: 'block', color: 'var(--text-main)' }}>Divisão Indústria &amp; Mineração</b>
                      <small style={{ color: '#FF7000', fontWeight: 700 }}>100% Controlada pelo Grupo Palatare</small>
                    </div>
                  </div>
                  <span className="serrano-pill" style={{ background: '#FFF0E3', color: '#B34700', fontWeight: 700 }}>
                    Construção Pesada
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  <b>SERRANO CONCRETO USINADO &amp; MINERAÇÃO LTDA</b> · CNPJ 51.499.928/0001-01 / 53.798.485/0001-77<br />
                  Central Dosadora Convicta 80m³/h, balança 80t, 3 silos 96t, frota de 5 betoneiras e mineração no Rio Sepotuba.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── AS DUAS EMPRESAS CONTROLADAS (CARDS COMPLETOS LADO A LADO) ─── */}
      {(filtroAbaInterna === 'todas' || filtroAbaInterna === 'empresas') && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 24 }}>
          {/* EMPRESA 1: PALATARE PIZZARIA */}
          {(() => {
            const emp = dadosHolding.empresas[0];
            return (
              <div key={emp.id} className="serrano-card" style={{ borderTop: `4px solid ${emp.corDestaque}` }}>
                <div className="serrano-card-h" style={{ background: 'var(--surface-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img
                      src={emp.logo}
                      alt={emp.nomeFantasia}
                      style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid #C5A059', background: '#000', objectFit: 'contain' }}
                    />
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-main)' }}>{emp.nomeFantasia}</h3>
                      <small style={{ color: emp.corDestaque, fontWeight: 700 }}>{emp.segmento}</small>
                    </div>
                  </div>
                  <span className="serrano-pill serrano-p-ok" style={{ marginLeft: 'auto', fontWeight: 700 }}>
                    {emp.participacaoGrupo}
                  </span>
                </div>

                <div style={{ padding: 20, display: 'grid', gap: 16 }}>
                  {/* Dados Cadastrais Oficiais */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'var(--surface-2)', padding: 14, borderRadius: 8, fontSize: 12 }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Razão Social:</span>
                      <b>{emp.razaoSocial}</b>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>CNPJ Oficial:</span>
                      <b style={{ fontFamily: 'var(--font-data)', color: '#FF6B2C' }}>{emp.cnpj}</b>
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

                  {/* Ativos e Capacidade Operacional */}
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

                  {/* Regime Fiscal e Emissões */}
                  <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ color: 'var(--status-ok)', fontWeight: 800 }}>● Barramento SEFAZ-MT Ativo</span>
                      <span style={{ color: 'var(--text-muted)' }}>· {emp.regimeFiscal}</span>
                    </div>
                    <small style={{ color: 'var(--text-muted)', display: 'block' }}>
                      Emissão instantânea de NFC-e nos terminais PDV e delivery com contingência síncrona.
                    </small>
                  </div>

                  {/* Ações Rápidas */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 6 }}>
                    <button
                      type="button"
                      className="btn-serrano pri"
                      style={{ background: '#FF6B2C', borderColor: '#FF6B2C' }}
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

          {/* EMPRESA 2: SERRANO CONCRETO USINADO */}
          {(() => {
            const emp = dadosHolding.empresas[1];
            return (
              <div key={emp.id} className="serrano-card" style={{ borderTop: `4px solid ${emp.corDestaque}` }}>
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
                      <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-main)' }}>{emp.nomeFantasia}</h3>
                      <small style={{ color: emp.corDestaque, fontWeight: 700 }}>{emp.segmento.split(',')[0]}</small>
                    </div>
                  </div>
                  <span className="serrano-pill serrano-p-ok" style={{ marginLeft: 'auto', fontWeight: 700 }}>
                    {emp.participacaoGrupo}
                  </span>
                </div>

                <div style={{ padding: 20, display: 'grid', gap: 16 }}>
                  {/* Dados Cadastrais Oficiais */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'var(--surface-2)', padding: 14, borderRadius: 8, fontSize: 12 }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Razão Social:</span>
                      <b>{emp.razaoSocial}</b>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>CNPJ Matriz (Mineração):</span>
                      <b style={{ fontFamily: 'var(--font-data)', color: '#FF7000' }}>{emp.cnpjMatriz.split(' ')[0]}</b>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>CNPJ Filial (Usinado):</span>
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
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>CNAE Principal:</span>
                      <b>{emp.cnaePrincipal}</b>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Localização Operacional:</span>
                      <span>📍 {emp.endereco}</span>
                    </div>
                  </div>

                  {/* Ativos e Capacidade Operacional */}
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

                  {/* Regime Fiscal e Emissões */}
                  <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ color: 'var(--status-ok)', fontWeight: 800 }}>● Barramento SEFAZ-MT Ativo</span>
                      <span style={{ color: 'var(--text-muted)' }}>· {emp.regimeFiscal}</span>
                    </div>
                    <small style={{ color: 'var(--text-muted)', display: 'block' }}>
                      Integração de pesagem rodoviária Toledo 80t com emissão direta de NF-e 55 e NFS-e LC 116/03.
                    </small>
                  </div>

                  {/* Ações Rápidas */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 6 }}>
                    <button
                      type="button"
                      className="btn-serrano pri"
                      onClick={() => {
                        if (trocarEmpresa) trocarEmpresa(SERRANO_CONCRETO_EMPRESA_ID);
                        setSecaoAtiva('operacao-despacho');
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

      {/* ─── QUADRO DE SÓCIOS E ADMINISTRADORES (QSA) & GOVERNANÇA ─── */}
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
                      <span style={{ fontSize: 22 }}>{gov.icone}</span>
                      <span className="serrano-pill serrano-p-ok" style={{ fontSize: 11, fontWeight: 700 }}>
                        {gov.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', marginBottom: 2 }}>
                      {gov.nome}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--serrano-orange)', marginBottom: 8 }}>
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

      {/* ─── SINERGIA DO GRUPO NO KYTTO ERP & INTELIGÊNCIA KYTTOIA ─── */}
      {filtroAbaInterna === 'todas' && (
        <div className="serrano-card" style={{ background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%)' }}>
          <div className="serrano-card-h">
            <div>
              <h3>Sinergia Operacional &amp; Inteligência KyttoIA Multinegócio</h3>
              <small style={{ color: 'var(--text-muted)' }}>
                Vantagens competitivas integradas no ecossistema Kytto ERP
              </small>
            </div>
            <span className="serrano-pill serrano-p-ok" style={{ marginLeft: 'auto', fontWeight: 700 }}>
              Motor KyttoIA 2.5 Flash Ativo
            </span>
          </div>

          <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--joint)', padding: 16, borderRadius: 8 }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>🔄</div>
              <b style={{ fontSize: 14, display: 'block', color: 'var(--text-main)', marginBottom: 6 }}>
                Compras Corporativas &amp; Poder de Escala
              </b>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Centralização de fornecedores de diesel para frota pesada e geradores, seguros patrimoniais, uniformes e suprimentos administrativos gerando redução de custos diretos.
              </p>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--joint)', padding: 16, borderRadius: 8 }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>🧠</div>
              <b style={{ fontSize: 14, display: 'block', color: 'var(--text-main)', marginBottom: 6 }}>
                Motor KyttoIA Preditivo
              </b>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Modelos de machine learning que antecipam a demanda de rodízio da pizzaria aos finais de semana e calculam a perda de abatimento (slump loss) das betoneiras com base na temperatura em Tangará da Serra.
              </p>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--joint)', padding: 16, borderRadius: 8 }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>💰</div>
              <b style={{ fontSize: 14, display: 'block', color: 'var(--text-main)', marginBottom: 6 }}>
                Tesouraria &amp; Fluxo de Caixa Unificado
              </b>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Painel consolidado da holding com liquidação automática de recebíveis em cartão e PIX, conciliação bancária OFX/API e apuração de DRE por centro de resultado.
              </p>
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
          background: 'rgba(0, 0, 0, 0.82)',
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
            borderRadius: 12,
            padding: 32,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
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
                <div style={{ width: 1, height: 44, background: '#CCC' }} />
                <div style={{ width: 52, height: 52, borderRadius: 8, background: '#FF7000', color: '#16181B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18 }}>
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
                  A holding <b>Grupo Palatare Participações S/A</b> é uma pessoa jurídica de direito privado constituída sob a forma de Sociedade Anônima Fechada com sede no município de <b>Tangará da Serra / Mato Grosso</b>, sob controle societário integral e liderança executiva de <b>Alexandre Palatare</b> (Fundador, Diretor-Presidente e Sócio-Controlador).
                </p>
              </div>

              <div>
                <b style={{ color: '#16181B', fontSize: 13, display: 'block', marginBottom: 8 }}>2. EMPRESAS INTEGRANTES DO GRUPO PALATARE</b>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ border: '1px solid #DDD', padding: 12, borderRadius: 6 }}>
                    <b style={{ color: '#FF6B2C', display: 'block', fontSize: 13 }}>Palatare Pizzaria &amp; Restaurante Ltda</b>
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
                      <td style={{ padding: 6 }}>Gestão Estratégica, Governança e Alocação de Capital</td>
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
                  <small style={{ color: '#666' }}>Diretor-Presidente · Grupo Palatare</small>
                </div>
                <div style={{ textAlign: 'center', width: 260 }}>
                  <div style={{ borderBottom: '1px solid #333', marginBottom: 4, height: 28 }}></div>
                  <b>Engª Karin Prestes</b><br />
                  <small style={{ color: '#666' }}>CREA-MT 027300 · Responsável Técnica</small>
                </div>
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid #E9ECEF',
              paddingTop: 16,
              marginTop: 20
            }}>
              <span style={{ fontSize: 11, color: '#6B6F75' }}>
                Sistema Kytto ERP Multinegócio · Documento Chave: DOSS-PLT-2026-TGA
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
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
                  style={{ background: '#C5A059', borderColor: '#C5A059', color: '#16181B', fontWeight: 800 }}
                  onClick={() => window.print()}
                >
                  🖨️ Imprimir / Salvar PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
