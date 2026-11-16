import React, { useState } from 'react';
import {
  DollarSign,
  TrendingDown,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Users,
  Building2,
  FileSpreadsheet,
  Award,
  ArrowRight,
  Calculator,
  Briefcase,
  Layers,
  Sparkles,
  HelpCircle,
  FileCheck2,
  Clock
} from 'lucide-react';

export default function ComercialPlanosTangara() {
  // Estados da Calculadora de Economia
  const [usuarios, setUsuarios] = useState(4);
  const [caixas, setCaixas] = useState(2);
  const [filiais, setFiliais] = useState(1);
  const [concorrenteAtual, setConcorrenteAtual] = useState('tga'); // 'tga', 'puma', 'stor', 'avec', 'totvs'

  // Dados dos Concorrentes baseados no dossiê de mercado de Tangará
  const CUSTOS_CONCORRENTES = {
    tga: {
      nome: 'TGA Sistemas (Delphi / Terminal Service)',
      baseMensal: 480,
      usuarioExtra: 35,
      caixaExtra: 65,
      implantacao: 1850,
      whatsappExtra: 89.90,
      nuvemExtra: 140
    },
    puma: {
      nome: 'Puma Sistemas (Desktop Local)',
      baseMensal: 690,
      usuarioExtra: 45,
      caixaExtra: 85,
      implantacao: 2200,
      whatsappExtra: 120,
      nuvemExtra: 180
    },
    stor: {
      nome: 'STOR Sistemas (Por Operador)',
      baseMensal: 219, // por operador
      usuarioExtra: 110,
      caixaExtra: 75,
      implantacao: 1450,
      whatsappExtra: 0,
      nuvemExtra: 95
    },
    avec: {
      nome: 'Avec (Beleza / Barba)',
      baseMensal: 380,
      usuarioExtra: 40,
      caixaExtra: 0,
      implantacao: 1350,
      whatsappExtra: 149,
      nuvemExtra: 0
    },
    totvs: {
      nome: 'TOTVS / Linx / Sankhya',
      baseMensal: 1150,
      usuarioExtra: 65,
      caixaExtra: 110,
      implantacao: 4500,
      whatsappExtra: 180,
      nuvemExtra: 250
    }
  };

  // Cálculo Kytto
  // Se até 3 users e 1 caixa -> Essencial R$ 169
  // Se até 6 users e 2 caixas -> Pro R$ 349
  // Se mais -> Business R$ 790
  let planoKyttoNome = 'Kytto Pro';
  let valorKyttoBase = 349;
  if (usuarios <= 2 && caixas <= 1 && filiais === 1) {
    planoKyttoNome = 'Kytto Essencial';
    valorKyttoBase = 169;
  } else if (usuarios > 6 || caixas > 2 || filiais > 1) {
    planoKyttoNome = 'Kytto Business';
    valorKyttoBase = 790;
  }

  // Extras Kytto
  const usersExcedentes = Math.max(0, usuarios - (planoKyttoNome === 'Kytto Essencial' ? 2 : (planoKyttoNome === 'Kytto Pro' ? 6 : 15)));
  const caixasExcedentes = Math.max(0, caixas - (planoKyttoNome === 'Kytto Essencial' ? 1 : (planoKyttoNome === 'Kytto Pro' ? 2 : 4)));
  const filiaisExcedentes = Math.max(0, filiais - 1);

  const valorKyttoMensal = valorKyttoBase + (usersExcedentes * 29) + (caixasExcedentes * 39) + (filiaisExcedentes * 149);
  const implantacaoKytto = 0; // ZERO na migração de concorrente!

  // Cálculo Concorrente Selecionado
  const c = CUSTOS_CONCORRENTES[concorrenteAtual];
  const custoConcorrenteMensal = c.baseMensal + (Math.max(0, usuarios - 2) * c.usuarioExtra) + (Math.max(0, caixas - 1) * c.caixaExtra) + c.whatsappExtra + c.nuvemExtra + (Math.max(0, filiais - 1) * 200);
  const economiaMensal = Math.max(0, custoConcorrenteMensal - valorKyttoMensal);
  const economiaAnual = (economiaMensal * 12) + c.implantacao;

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Topo Executivo */}
      <div style={{ background: '#0F172A', color: '#F8FAFC', padding: '28px 32px', borderRadius: '14px', marginBottom: '24px', borderLeft: '6px solid #FF6B2C' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.75rem' }}>💼</span>
              <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800 }}>
                Central Comercial Kytto ERP · Tangará da Serra / MT
              </h1>
            </div>
            <p style={{ margin: '8px 0 0 0', color: '#94A3B8', fontSize: '0.95rem' }}>
              Posicionamento "Tudo Incluso com IA", Tabela Oficial de Planos e Calculadora Comparativa de Economia vs Concorrentes Locais.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ background: '#1E293B', padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155', color: '#FF6B2C', fontWeight: 700, fontSize: '0.85rem' }}>
              ⚡ Migração em até 4h
            </span>
            <span style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '8px 16px', borderRadius: '8px', border: '1px solid #10B981', color: '#10B981', fontWeight: 700, fontSize: '0.85rem' }}>
              🏷️ Implantação ZERO
            </span>
          </div>
        </div>
      </div>

      {/* Proposta de Valor e Oferta de Entrada */}
      <div style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', borderRadius: '14px', padding: '24px 28px', border: '1px solid #334155', color: '#FFFFFF', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ maxWidth: '820px' }}>
            <span style={{ background: '#F59E0B', color: '#000000', padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}>
              Oferta Oficial de Entrada
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '10px 0 6px 0', color: '#FFFFFF' }}>
              "O sistema que vende por você: gestão em nuvem, atendente de IA no WhatsApp e loja online"
            </h2>
            <p style={{ margin: 0, color: '#CBD5E1', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Mostre a fatura do seu sistema atual: <strong>zero taxa de implantação</strong>, migração assistida de cadastros, clientes, estoque e contas a pagar/receber em até 4 horas, com preço congelado por 12 meses.
            </p>
          </div>
          <div style={{ textAlign: 'center', background: 'rgba(255, 107, 44, 0.12)', border: '1px solid #FF6B2C', padding: '16px 24px', borderRadius: '12px' }}>
            <span style={{ fontSize: '0.8rem', color: '#FF6B2C', fontWeight: 800, textTransform: 'uppercase' }}>Economia Média</span>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>25% a 65%</div>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>vs TGA, Puma e STOR</span>
          </div>
        </div>
      </div>

      {/* Grid com os 6 Planos Oficiais */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>📋</span> Tabela Oficial de Planos (Novembro 2026 / 2027)
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        
        {/* Plano 1: Start Serviços */}
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>Start Serviços</h3>
              <span style={{ background: '#F1F5F9', color: '#475569', fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px' }}>Serviços</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0 0 16px 0' }}>Barbearia, salão de beleza e estética até 3 profissionais.</p>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0F172A', marginBottom: '16px' }}>
              R$ 119 <span style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 400 }}>/mês</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', color: '#334155' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> Agenda e link público de agendamento</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> Comandas unificadas e caixa do dia</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> Comissões por serviço e produto</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> CRM, fidelidade e loja online básica</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> KyttoIA no WhatsApp (até 300 chats)</li>
            </ul>
          </div>
        </div>

        {/* Plano 2: Essencial */}
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>Essencial</h3>
              <span style={{ background: '#E0F2FE', color: '#0284C7', fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px' }}>MEI / Micro</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0 0 16px 0' }}>Microempresa e comércio de balcão (2 usuários, 1 caixa).</p>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0F172A', marginBottom: '16px' }}>
              R$ 169 <span style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 400 }}>/mês</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', color: '#334155' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> Emissão de NFC-e (65) SEFAZ-MT</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> Controle de estoque e custo médio</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> Contas a pagar, receber e DRE</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> Boleto e Pix direto no banco (0% taxa)</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> Loja online com domínio próprio e IA</li>
            </ul>
          </div>
        </div>

        {/* Plano 3: Pro (CAMPEÃO DE VENDAS) */}
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '2px solid #FF6B2C', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(255,107,44,0.12)', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '-12px', right: '20px', background: '#FF6B2C', color: '#FFFFFF', padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900 }}>
            MAIS ESCOLHIDO
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>Kytto Pro</h3>
              <span style={{ background: '#FEF3C7', color: '#D97706', fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px' }}>Varejo & Serviços</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0 0 16px 0' }}>Loja, barbearia, bar, oficina, suplementos (6 users, 2 caixas).</p>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#FF6B2C', marginBottom: '16px' }}>
              R$ 349 <span style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 400 }}>/mês</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', color: '#334155' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> <strong>Tudo do Essencial + NF-e (55) e NFS-e</strong></li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> PDV offline garantido (contingência)</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> Assinaturas, cashback e campanhas/sorteios</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> Ordem de serviço com aprovação WhatsApp</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> KyttoIA até 1.500 conversas + plantão sábado</li>
            </ul>
          </div>
        </div>

        {/* Plano 4: Business */}
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>Business</h3>
              <span style={{ background: '#F3E8FF', color: '#7E22CE', fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px' }}>Multi-Unidades</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0 0 16px 0' }}>Grupos e redes (15 usuários, 4 caixas, multi-CNPJ).</p>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0F172A', marginBottom: '16px' }}>
              R$ 790 <span style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 400 }}>/mês</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', color: '#334155' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> Tudo do Pro + Várias unidades e CNPJs</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> SPED Fiscal e EFD Contribuições</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> DRE Consolidada e conciliação bancária</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> KyttoIA até 3.000 conversas + API aberta</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> Consultoria trimestral de sucesso (CS)</li>
            </ul>
          </div>
        </div>

        {/* Plano 5: Clube & Eventos */}
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>Clube & Eventos</h3>
              <span style={{ background: '#DCFCE7', color: '#166534', fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px' }}>Arenas / Beach</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0 0 16px 0' }}>Clubes esportivos, arenas de beach tennis e torneios.</p>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0F172A', marginBottom: '16px' }}>
              R$ 490 <span style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 400 }}>/mês</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', color: '#334155' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> Quadras, reservas e mensalidades</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> Chaves de torneio, súmula e ranking</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> Bar e restaurante com comandas e KDS</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> Controle de portaria e biometria/cartão</li>
            </ul>
          </div>
        </div>

        {/* Plano 6: Imobiliária Casa Nova */}
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>Imobiliária</h3>
              <span style={{ background: '#FEF9C3', color: '#854D0E', fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px' }}>Imóveis / Lotes</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0 0 16px 0' }}>Imobiliárias e corretores até 5 usuários.</p>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0F172A', marginBottom: '16px' }}>
              R$ 249 <span style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 400 }}>/mês</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', color: '#334155' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> Portal com busca inteligente e mapa</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> Comparativo de preço vs mediana do bairro</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> Captação de imóveis pelo WhatsApp</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10B981" /> Locação a R$ 1,90 por boleto (sem split)</li>
            </ul>
          </div>
        </div>

      </div>

      {/* CALCULADORA DINÂMICA DE ECONOMIA */}
      <section style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #CBD5E1', padding: '28px', marginBottom: '32px', boxShadow: '0 4px 6px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ background: '#FEF2F2', padding: '10px', borderRadius: '8px', color: '#DC2626' }}>
            <Calculator size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#0F172A' }}>
              Calculadora Dinâmica de Economia em Tangará da Serra
            </h2>
            <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: '0.875rem' }}>
              Compare o custo real com licença, caixas, Terminal Service e WhatsApp entre o Kytto e o sistema que você usa hoje.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', background: '#F8FAFC', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '24px' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Sistema Atual que Você Utiliza:
            </label>
            <select
              value={concorrenteAtual}
              onChange={(e) => setConcorrenteAtual(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: '0.95rem', fontWeight: 600 }}
            >
              <option value="tga">TGA Sistemas (Delphi + Terminal Service)</option>
              <option value="puma">Puma Sistemas (Desktop Local)</option>
              <option value="stor">STOR Sistemas (Cobrança por Operador)</option>
              <option value="avec">Avec / Beleza (Comissões e Salão)</option>
              <option value="totvs">TOTVS / Linx / Sankhya</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Quantidade de Usuários no Sistema: <strong>{usuarios} usuários</strong>
            </label>
            <input
              type="range"
              min="1"
              max="20"
              value={usuarios}
              onChange={(e) => setUsuarios(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#FF6B2C' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Pontos de Frente de Caixa (PDV): <strong>{caixas} caixas</strong>
            </label>
            <input
              type="range"
              min="1"
              max="8"
              value={caixas}
              onChange={(e) => setCaixas(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#FF6B2C' }}
            />
          </div>

        </div>

        {/* Comparativo de Resultados */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          
          <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', padding: '20px', borderRadius: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9F1239', textTransform: 'uppercase' }}>Seu Custo Atual Estimado</span>
            <h3 style={{ margin: '6px 0', fontSize: '1.85rem', fontWeight: 900, color: '#BE123C' }}>
              R$ {custoConcorrenteMensal.toFixed(2)} <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>/mês</span>
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#881337', display: 'block' }}>
              Inclui licença, caixas extras, taxa de nuvem/TS e bot de WhatsApp cobrado à parte.
            </span>
          </div>

          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '20px', borderRadius: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Custo com Kytto ERP ({planoKyttoNome})</span>
            <h3 style={{ margin: '6px 0', fontSize: '1.85rem', fontWeight: 900, color: '#15803D' }}>
              R$ {valorKyttoMensal.toFixed(2)} <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>/mês</span>
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#14532D', display: 'block' }}>
              Tudo incluso: emissão fiscal, PDV, loja online e atendente de IA no WhatsApp.
            </span>
          </div>

          <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: '#FFFFFF', padding: '20px', borderRadius: '12px', border: '2px solid #10B981' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#34D399', textTransform: 'uppercase' }}>Economia Anual Garantida</span>
            <h3 style={{ margin: '6px 0', fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>
              R$ {economiaAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'block' }}>
              (R$ {(economiaMensal * 12).toFixed(2)} em mensalidades + R$ {c.implantacao} de taxa zero de implantação)
            </span>
          </div>

        </div>

      </section>

      {/* PROGRAMA DO CONTADOR PARCEIRO (15% RECORRENTE) */}
      <section style={{ background: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.5rem' }}>🤝</span>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                Programa de Parceria para Contadores de Tangará da Serra
              </h2>
            </div>
            <p style={{ margin: '8px 0 0 0', color: '#64748B', fontSize: '0.9rem', maxWidth: '800px', lineHeight: 1.5 }}>
              O contador tem acesso <strong>100% gratuito</strong> a um painel exclusivo para baixar SPED Fiscal, EFD Contribuições, fechamentos contábeis no layout Domínio/Questor/Alterdata e XMLs de todas as suas empresas atendidas, recebendo <strong>15% de comissão recorrente mensal</strong> enquanto o cliente estiver ativo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => alert('Para cadastrar seu escritório contábil e receber o acesso ao Portal do Contador com 15% de comissionamento recorrente, entre em contato com nosso time de Tangará pelo WhatsApp: +55 (65) 99352-2260')}
            style={{
              background: '#0F172A',
              color: '#FFFFFF',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Credenciar Escritório Contábil <ArrowRight size={16} />
          </button>
        </div>
      </section>

    </div>
  );
}
