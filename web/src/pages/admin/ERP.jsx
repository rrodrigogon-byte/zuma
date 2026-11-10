/**
 * KYTTO ERP 360 — HUB CENTRAL EMPRESARIAL
 * Painel executivo integrado conectando todas as operações corporativas:
 * Vendas, Ordens de Serviço, Expedição, Patrimônio, Estoque, Financeiro e Fiscal
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'

const GRUPOS_ERP = [
  {
    categoria: '📜 Comercial & Vendas B2B/B2C',
    destaque: true,
    items: [
      { icon: '🚀', label: 'Como Vender Mais com IA', desc: 'Funil Dinheiro na Mesa, recuperação de clientes inativos, opt-out Meta e cadência de WhatsApp', href: '/admin/inteligencia-vendas', novo: true },
      { icon: '📜', label: 'Propostas Comerciais', desc: 'Cotações B2B/B2C, envio WhatsApp, PDF timbrado e faturamento em 1 clique', href: '/admin/propostas', novo: true },
      { icon: '🛍️', label: 'Loja Online & E-commerce', desc: 'Catálogo de produtos, pedidos online, promoções e multi-loja', href: '/admin/ecommerce' },
      { icon: '🏪', label: 'Varejo Geral', desc: 'Preços por unidade, promoções, balança e etiquetas de gôndola', href: '/admin/varejo' },
      { icon: '📦', label: 'Compras & Suprimentos', desc: 'Pedidos de compra, importação XML NF-e e ficha Kardex', href: '/admin/compras' },
      { icon: '👗', label: 'Loja de Moda & Vestuário', desc: 'Grade Cor×Tamanho, condicional e crediário', href: '/admin/loja-moda' }
    ]
  },
  {
    categoria: '🛠️ Serviços & Assistência Técnica (OS)',
    destaque: true,
    items: [
      { icon: '🛠️', label: 'Ordens de Serviço (OS 360)', desc: 'Assistência técnica universal, checklist, laudo, garantia e assinatura touch', href: '/admin/ordens-servico', novo: true },
      { icon: '🔧', label: 'Oficina Mecânica', desc: 'OS automotiva por placa, checklist veicular e aprovação WhatsApp', href: '/admin/oficina' },
      { icon: '✂️', label: 'Barbearia & Salão', desc: 'Comanda digital, rateio de comissões e agendamento online', href: '/admin/barbearia' },
      { icon: '🐾', label: 'Agropecuária & Petshop', desc: 'Receituário veterinário, prontuário animal e vacinas', href: '/admin/agropecuaria' }
    ]
  },
  {
    categoria: '🚚 Logística, Expedição & Patrimônio',
    destaque: true,
    items: [
      { icon: '🚚', label: 'Expedição & Romaneios', desc: 'Conferência (picking/packing), roteirização de entregas e comprovante assinado', href: '/admin/expedicao', novo: true },
      { icon: '🏛️', label: 'Patrimônio & Ativos Imobilizados', desc: 'Tombamento, depreciação linear (IN SRF 162) e manutenção de máquinas', href: '/admin/patrimonio', novo: true },
      { icon: '📦', label: 'Estoque Central', desc: 'Movimentações de entrada/saída, saldo por unidade e rastreabilidade', href: '/admin/estoque' },
      { icon: '🧪', label: 'Fichas Técnicas & Produção', desc: 'Composição de produtos, insumos e custos de fabricação', href: '/admin/fichas-tecnicas' }
    ]
  },
  {
    categoria: '💰 Gestão Financeira & Fiscal',
    items: [
      { icon: '🧾', label: 'Central de Notas Fiscais', desc: 'Emissão e consulta SEFAZ de NFC-e, NF-e e NFS-e com DANFE oficial', href: '/admin/notas' },
      { icon: '💰', label: 'Razão Financeiro', desc: 'Contas a pagar/receber, conciliação bancária OFX e fluxo de caixa', href: '/admin/financeiro' },
      { icon: '📊', label: 'DRE Completa & Gerencial', desc: 'Demonstração do Resultado com EBITDA, margens, análise vertical e comparativo anual', href: '/admin/dre' },
      { icon: '⚙️', label: 'Configurações Fiscais', desc: 'Certificado A1, SEFAZ-MT, credenciamento CSC e alíquotas IBS/CBS', href: '/admin/fiscal/config' },
      { icon: '🏷️', label: 'Classificação Fiscal & NCM', desc: 'Auditoria tributária de itens, NCM, CFOP e regras de impostos', href: '/admin/fiscal/classificacao' },
      { icon: '📈', label: 'BI & Relatórios', desc: 'Curva ABC de vendas, ticket médio e dashboards executivos', href: '/admin/bi' }
    ]
  },
  {
    categoria: '🍽️ Alimentação & Ponto de Venda',
    items: [
      { icon: '🛒', label: 'PDV Balcão & Caixa', desc: 'Frente de caixa rápido com TEF, Pix Dinâmico e contingência', href: '/admin/pdv' },
      { icon: '🪑', label: 'Mesas & Comandas', desc: 'Gestão de salão, comandas digitais e transferência de mesas', href: '/admin/mesas' },
      { icon: '🍽️', label: 'Cardápio & Produtos', desc: 'Cardápio digital, combos e adicionais de cozinha', href: '/admin/cardapio' },
      { icon: '🖨️', label: 'KDS Cozinha', desc: 'Display de pedidos para preparação em tempo real na cozinha/bar', href: '/admin/kds' }
    ]
  },
  {
    categoria: '🎾 Esportivo & Sócios',
    items: [
      { icon: '🎾', label: 'Quadras & Reservas', desc: 'Agendamento de quadras esportivas e controle de horários', href: '/admin/agenda' },
      { icon: '🏆', label: 'Torneios & Ligas', desc: 'Chaves, grupos, tabela de jogos e ranking Elo dos atletas', href: '/admin/torneios' },
      { icon: '👥', label: 'Sócios & CRM', desc: 'Planos de mensalidade, carteira digital e histórico do cliente', href: '/admin/socios' }
    ]
  }
]

export default function ERP() {
  const navigate = useNavigate()
  const { empresaAtiva } = useAuth()
  const [kpis, setKpis] = useState(null)

  useEffect(() => {
    async function carregarKpis() {
      try {
        const data = await api.get('/api/admin/erp/kpis')
        setKpis(data)
      } catch {}
    }
    carregarKpis()
  }, [])

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', fontFamily: 'inherit' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 32 }}>🧩</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>Kytto ERP 360</h1>
            <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 2 }}>
              Empresa Ativa: <strong style={{ color: 'var(--primary, #0f172a)' }}>{empresaAtiva?.nome || 'Holding Kytto'}</strong>
            </div>
          </div>
        </div>
        <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: 14 }}>
          Ecossistema corporativo completo de gestão integrada — orçamentos, ordens de serviço, logística, patrimônio, fiscal e PDV
        </p>
      </div>

      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
          <div
            onClick={() => navigate('/admin/propostas')}
            style={{
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              border: '1px solid #bfdbfe', borderRadius: 12, padding: 18, cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>📜 Propostas Ofertadas</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#1e3a8a', marginTop: 4 }}>
              R$ {Number(kpis.propostas?.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>{kpis.propostas?.total || 0} propostas ({kpis.propostas?.taxaConversao || 0}% aprovadas)</div>
          </div>

          <div
            onClick={() => navigate('/admin/ordens-servico')}
            style={{
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              border: '1px solid #fcd34d', borderRadius: 12, padding: 18, cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>🛠️ Ordens de Serviço (OS)</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#78350f', marginTop: 4 }}>
              {kpis.ordensServico?.abertas || 0} em andamento
            </div>
            <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>
              Faturado: R$ {Number(kpis.ordensServico?.faturamento || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div
            onClick={() => navigate('/admin/expedicao')}
            style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              border: '1px solid #bbf7d0', borderRadius: 12, padding: 18, cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>🚚 Expedição & Cargas</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#14532d', marginTop: 4 }}>
              {kpis.logistica?.totalRomaneios || 0} romaneios
            </div>
            <div style={{ fontSize: 12, color: '#15803d', marginTop: 2 }}>{kpis.logistica?.entregasEmTransito || 0} em trânsito</div>
          </div>

          <div
            onClick={() => navigate('/admin/patrimonio')}
            style={{
              background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
              border: '1px solid #e9d5ff', borderRadius: 12, padding: 18, cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6b21a8' }}>🏛️ Patrimônio & Ativos</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#581c87', marginTop: 4 }}>
              R$ {Number(kpis.patrimonio?.valorResidual || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 12, color: '#7e22ce', marginTop: 2 }}>{kpis.patrimonio?.totalAtivos || 0} bens tombados com depreciação</div>
          </div>
        </div>
      )}

      {GRUPOS_ERP.map(grupo => (
        <div key={grupo.categoria} style={{ marginBottom: 32 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {grupo.categoria}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {grupo.items.map(mod => (
              <button
                key={mod.href}
                onClick={() => navigate(mod.href)}
                style={{
                  background: 'var(--card, #fff)', borderRadius: 12, padding: '16px 18px',
                  border: mod.novo ? '1.5px solid var(--orange, #f97316)' : '1px solid var(--line, #e2e8f0)',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'flex-start', gap: 14,
                  position: 'relative'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--orange, #f97316)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = mod.novo ? 'var(--orange, #f97316)' : 'var(--line, #e2e8f0)'; e.currentTarget.style.transform = 'none' }}
              >
                {mod.novo && (
                  <span style={{
                    position: 'absolute', top: 10, right: 12,
                    background: 'var(--orange, #f97316)', color: '#fff', fontSize: 10,
                    fontWeight: 800, padding: '2px 6px', borderRadius: 8, textTransform: 'uppercase'
                  }}>
                    Novo
                  </span>
                )}
                <span style={{ fontSize: 26, lineHeight: 1 }}>{mod.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, color: 'var(--primary, #0f172a)' }}>{mod.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>{mod.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
