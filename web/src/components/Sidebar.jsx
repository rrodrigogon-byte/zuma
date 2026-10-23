import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef } from 'react'
import { rotaVisivel } from '../lib/disponibilidade'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { applyThemeMode, DINO_BARBERSHOP_LOGO, isClubeBrandContext, isDinoBrandContext, isStalloneBrandContext, STALLONE_LOGO, storedThemeMode } from '../lib/brand'
import { DINO_STORE, isDinoDedicatedHost } from '../lib/dino-scope'

// ── Badge de pedidos pendentes ─────────────────────────────────────────────────
function usePendingOrders(isStaff) {
  const [pendentes, setPendentes] = useState(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!isStaff) return

    async function check() {
      try {
        const mesas = await api.get('/api/mesas')
        // Conta itens com status "novo" em qualquer comanda aberta
        let count = 0
        const lista = Array.isArray(mesas) ? mesas : (mesas.mesas || [])
        lista.forEach(m => {
          const items = m.pedidos || m.itens || []
          count += items.filter(it => it.status === 'novo' || it.status === 'pendente').length
        })
        setPendentes(count)
      } catch {
        // silencioso — não interrompe UX
      }
    }

    check()
    intervalRef.current = setInterval(check, 20000) // poll a cada 20s
    return () => clearInterval(intervalRef.current)
  }, [isStaff])

  return pendentes
}

function Badge({ count }) {
  if (!count) return null
  return (
    <span style={{
      marginLeft: 'auto',
      background: 'var(--danger)', color: '#fff',
      borderRadius: 10, fontSize: 10, fontWeight: 800,
      padding: '1px 6px', minWidth: 18, textAlign: 'center',
      lineHeight: '16px', display: 'inline-block',
    }}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

const NAV_OP = [
  { to: '/pdv',      icon: '🛒', label: 'PDV',            badge: true },
  { to: '/garcom',   icon: '🍽️', label: 'Modo Garçom',   badge: false },
  { to: '/kds',      icon: '👨‍🍳', label: 'Cozinha / KDS', badge: true },
  { to: '/loja-atendimento', icon: '🛍️', label: 'Atend. Loja', badge: false },
  { to: '/portaria', icon: '🎫', label: 'Portaria',        badge: false },
]

// Grupos do admin organizados por tema
const NAV_ADMIN_GROUPS = [
  {
    label: 'Visão Geral',
    items: [
      { to: '/admin',           icon: '📊', label: 'Dashboard', end: true },
      { to: '/admin/bi',        icon: '📉', label: 'BI & Analytics' },
      { to: '/admin/relatorios-operacionais',icon: '📄', label: 'Relatórios Operacionais' },
      { to: '/admin/financeiro',icon: '💰', label: 'Financeiro' },
      { to: '/admin/whatsapp', icon: '💬', label: 'WhatsApp da empresa' },
      { to: '/admin/whatsapp-gestao', icon: '▣', label: 'WhatsApp Gestão' },
      { to: '/admin/whatsapp-lancamentos', icon: '🧾', label: 'WhatsApp Lançamentos' },
    ],
  },
  {
    label: 'Torneio',
    items: [
      { to: '/admin/torneios',   icon: '🎾', label: 'Torneios' },
      { to: '/admin/agenda',     icon: '📅', label: 'Agenda / OoP' },
      { to: '/admin/sumula',     icon: '📝', label: 'Súmula' },
      { to: '/admin/inscricoes', icon: '📋', label: 'Inscrições' },
      { to: '/admin/quadras',    icon: '🏟️', label: 'Quadras' },
      { to: '/admin/pontos',     icon: '⭐', label: 'Pontos & Elo' },
      { to: '/admin/ranking',    icon: '🏆', label: 'Ranking Torneios' },
      { to: '/admin/ligas',      icon: '🏅', label: 'Ligas de Ranking' },
    ],
  },
  {
    label: 'Bar & PDV',
    items: [
      { to: '/admin/mesas',    icon: '🪑', label: 'Mesas' },
      { to: '/admin/reservas', icon: '📅', label: 'Reservas & Fila' },
      { to: '/admin/kds',       icon: '🖨️', label: 'KDS & Impressão' },
      { to: '/admin/cardapio', icon: '🍽️', label: 'Cardápio' },
      { to: '/admin/estoque',  icon: '📦', label: 'Estoque' },
      { to: '/admin/perdas-inventario', icon: '🧾', label: 'Perdas & Inventário' },
      { to: '/admin/fichas-tecnicas', icon: '🧪', label: 'Fichas Técnicas' },
      { to: '/admin/modificadores-combos', icon: '➕', label: 'Adicionais & Combos' },
      { to: '/admin/pagamentos',icon: '💳', label: 'Pagamentos' },
      { to: '/admin/notas',    icon: '🧾', label: 'Notas Fiscais' },
      { to: '/admin/cadastros-mestres', icon: '🗂️', label: 'Cadastros Mestres' },
      { to: '/admin/clientes', icon: '👥', label: 'Clientes & Contas' },
      { to: '/admin/contas-receber', icon: '💰', label: 'Contas a Receber' },
      { to: '/admin/fechamento-diario', icon: '🔐', label: 'Fechamento Diário' },
      { to: '/admin/cupons',   icon: '🎟️', label: 'Cupons' },
      { to: '/admin/pdv-offline', icon: '📡', label: 'PDV Offline & Periféricos' },
      { to: '/admin/omnichannel', icon: '🔄', label: 'Canais, Delivery & Fidelidade' },
    ],
  },
  {
    label: 'ERP Comercial',
    items: [
      { to: '/admin/erp',           icon: '🏢', label: 'Hub ERP' },
      { to: '/admin/ecommerce',     icon: '🛒', label: 'E-commerce' },
      { to: '/admin/supermercado',  icon: '🏪', label: 'Supermercado' },
      { to: '/admin/loja-moda',     icon: '👗', label: 'Loja de Moda' },
      { to: '/admin/barbearia-erp', icon: '✂️', label: 'Barbearia ERP' },
      { to: '/admin/oficina',       icon: '🔧', label: 'Oficina Mecânica' },
      { to: '/admin/agropecuaria',  icon: '🌾', label: 'Agropecuária & Pet' },
      { to: '/admin/varejo',        icon: '🛒', label: 'Varejo Geral' },
      { to: '/admin/compras',       icon: '📦', label: 'Compras & Fornec.' },
      { to: '/admin/fiscal/config', icon: '⚙️', label: 'Config. Fiscal' },
      { to: '/admin/fiscal/classificacao', icon: '🏷️', label: 'Classificação Fiscal' },
    ],
  },
  {
    label: 'Clube & Academia',
    items: [
      { to: '/admin/clube/recepcao',  icon: '🚪', label: 'Recepção & Catraca' },
      { to: '/admin/clube/alunos',    icon: '🏋️', label: 'Alunos' },
      { to: '/admin/clube/aulas',     icon: '🗓️', label: 'Grade de Aulas' },
      { to: '/admin/clube/quadras',   icon: '📅', label: 'Reservas de Quadras' },
      { to: '/admin/clube/contratos', icon: '✍️', label: 'Contratos Digitais' },
      { to: '/admin/clube/retencao',  icon: '🔁', label: 'Retenção (IA)' },
      { to: '/admin/clube/cobrancas', icon: '💠', label: 'Cobranças Pix' },
      { to: '/admin/clube/parceiros', icon: '🤝', label: 'Wellhub & TotalPass' },
      { to: '/admin/clube/ajustes',   icon: '⚙️', label: 'Quadras, Catracas & Planos' },
    ],
  },
  {
    label: 'Membros',
    items: [
      { to: '/admin/usuarios',     icon: '👥', label: 'Usuários' },
      { to: '/admin/socios',       icon: '🏆', label: 'Sócios' },
      { to: '/admin/mensalidades', icon: '💳', label: 'Mensalidades' },
      { to: '/admin/aulas',        icon: '🎓', label: 'Aulas' },
      { to: '/admin/crm',          icon: '📈', label: 'CRM' },
    ],
  },
  {
    label: 'Loja & Conteúdo',
    items: [
      { to: '/admin/loja',          icon: '🛍️', label: 'Loja' },
      { to: '/admin/lojas',         icon: '🏬', label: 'Unidades' },
      { to: '/admin/noticias',      icon: '📰', label: 'Notícias' },
      { to: '/admin/contatos',      icon: '✉️', label: 'Contatos' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/admin/auditoria',     icon: '🔍', label: 'Auditoria' },
      { to: '/admin/configuracoes', icon: '⚙️', label: 'Configurações' },
    ],
  },
]

const NAV_DINO_GROUPS = [
  {
    label: 'Hoje',
    items: [
      { to: '/admin', icon: '◔', label: 'Painel do negócio', end: true },
      { to: '/admin/barbearia-erp?area=operacao&tab=Vis%C3%A3o+geral', icon: '⌂', label: 'Operação do dia' },
      { to: '/admin/barbearia-erp?area=operacao&tab=Agenda', icon: '▣', label: 'Agenda' },
      { to: '/admin/barbearia-erp?area=operacao&tab=Atendimento', icon: '✂', label: 'Atendimento e comandas' },
      { to: '/admin/barbearia-erp?area=operacao&tab=Caixa+e+fechamento', icon: '▱', label: 'Caixa e fechamento' },
    ],
  },
  {
    label: 'Clientes & WhatsApp',
    items: [
      { to: '/admin/clientes-360', icon: '◉', label: 'Clientes 360' },
      { to: '/admin/barbearia-erp?area=relacionamento&tab=Clientes', icon: '↻', label: 'CRM e campanhas' },
      { to: '/admin/barbearia-erp?area=relacionamento&tab=Retorno+previsto', icon: '↺', label: 'Retorno previsto' },
      { to: '/admin/barbearia-erp?area=relacionamento&tab=Lista+de+espera', icon: '⧗', label: 'Lista de espera' },
      { to: '/admin/barbearia-erp?area=relacionamento&tab=Indica%C3%A7%C3%B5es', icon: '⇢', label: 'Indique um amigo' },
      { to: '/admin/barbearia-erp?area=relacionamento&tab=Avalia%C3%A7%C3%B5es+%28NPS%29', icon: '★', label: 'Avaliações (NPS)' },
      { to: '/admin/barbearia-erp?area=relacionamento&tab=Origem+dos+clientes', icon: '⌖', label: 'Origem dos clientes' },
      { to: '/admin/barbearia-erp?area=relacionamento&tab=Fidelidade', icon: '☆', label: 'Fidelidade' },
      { to: '/admin/whatsapp', icon: '✆', label: 'WhatsApp' },
      { to: '/admin/whatsapp-gestao', icon: '▣', label: 'WhatsApp Gestão' },
      { to: '/admin/whatsapp-lancamentos', icon: '🧾', label: 'WhatsApp Lançamentos' },
      { to: '/admin/cerebro-ia', icon: '◈', label: 'Cérebro do atendente' },
      { to: '/admin/barbearia-erp?area=integracoes&tab=Integra%C3%A7%C3%B5es', icon: '✦', label: 'Atendente IA' },
      { to: '/admin/omnichannel', icon: '⇄', label: 'Canais e resgates' },
    ],
  },
  {
    label: 'Barbearia',
    items: [
      { to: '/admin/barbearia-erp?area=catalogo&tab=Profissionais', icon: '♙', label: 'Equipe' },
      { to: '/admin/barbearia-erp?area=catalogo&tab=Servi%C3%A7os', icon: '≡', label: 'Serviços' },
      { to: '/admin/barbearia-erp?area=catalogo&tab=Planos+e+assinaturas', icon: '◆', label: 'Planos e assinaturas' },
      { to: '/admin/barbearia-erp?area=catalogo&tab=Sa%C3%BAde+do+clube', icon: '♥', label: 'Saúde do clube' },
      { to: '/admin/barbearia-erp?area=catalogo&tab=Estoque+de+revenda', icon: '▧', label: 'Revenda e estoque' },
      { to: '/admin/barbearia-erp?area=gestao&tab=Comiss%C3%B5es', icon: '△', label: 'Comissões' },
      { to: '/admin/barbearia-erp?area=gestao&tab=Ocupa%C3%A7%C3%A3o+e+metas', icon: '◐', label: 'Ocupação e metas' },
      { to: '/admin/barbearia-erp?area=gestao&tab=Cobran%C3%A7as+e+cashback', icon: '$', label: 'Cobranças e cashback' },
      { to: '/admin/barbearia-erp?area=gestao&tab=Receita+da+IA', icon: '✦', label: 'Receita da IA' },
    ],
  },
  {
    label: 'Loja online',
    items: [
      { to: '/admin/ecommerce?tab=overview', icon: '▦', label: 'Visão da loja' },
      { to: '/admin/ecommerce?tab=catalog', icon: '□', label: 'Produtos e estoque' },
      { to: '/admin/ecommerce?tab=orders', icon: '◧', label: 'Pedidos e entregas' },
      { to: '/admin/ecommerce?tab=promotions', icon: '%', label: 'Promoções' },
      { to: '/admin/ecommerce?tab=shipping', icon: '↝', label: 'Frete e retirada' },
      { to: '/admin/ecommerce?tab=payments', icon: '▰', label: 'Pagamentos' },
      { to: '/admin/ecommerce?tab=domains', icon: '◎', label: 'Domínios' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { to: '/admin/bi', icon: '↗', label: 'BI & Analytics' },
      { to: '/admin/barbearia-erp?area=gestao&tab=Desempenho+da+equipe', icon: '↗', label: 'Desempenho da equipe' },
      { to: '/admin/financeiro', icon: '◇', label: 'Financeiro' },
      { to: '/admin/barbearia-erp?area=gestao&tab=Relat%C3%B3rios', icon: '▤', label: 'Relatórios' },
      { to: '/admin/ecommerce?tab=users', icon: '♧', label: 'Usuários e acessos' },
      { to: '/admin/auditoria', icon: '◌', label: 'Auditoria' },
      { to: '/admin/barbearia-erp?area=gestao&tab=Configura%C3%A7%C3%A3o', icon: '⚙', label: 'Configurações' },
    ],
  },
]

// Menu do clube/academia (AGRO OPEN TTC e próximas academias): organizado pelo dia a dia
// — recepção e catraca primeiro, depois sócios, aulas e quadras, torneios, bar e gestão.
// Sem os verticais de varejo que não se aplicam (supermercado, oficina, moda, barbearia).
export const NAV_CLUBE_GROUPS = [
  {
    label: 'Hoje no clube', aberto: true,
    items: [
      { to: '/admin', icon: '📊', label: 'Painel', end: true },
      { to: '/admin/clube/recepcao', icon: '🚪', label: 'Recepção & Catraca' },
      { to: '/admin/clube/quadras', icon: '📅', label: 'Reservas de quadras' },
      { to: '/admin/clube/aulas', icon: '🗓️', label: 'Aulas do dia' },
      { to: '/admin/clube/cobrancas', icon: '💠', label: 'Pix a confirmar' },
    ],
  },
  {
    label: 'Sócios & Alunos', aberto: true,
    items: [
      { to: '/admin/clube/alunos', icon: '🎾', label: 'Sócios e alunos' },
      { to: '/admin/clube/contratos', icon: '✍️', label: 'Contratos digitais' },
      { to: '/admin/clube/retencao', icon: '🔁', label: 'Retenção (IA)' },
      { to: '/admin/clube/parceiros', icon: '🤝', label: 'Wellhub & TotalPass' },
      { to: '/admin/crm', icon: '📈', label: 'CRM' },
    ],
  },
  {
    label: 'Torneios (evento Agro Open)',
    items: [
      { to: '/admin/torneios', icon: '🏆', label: 'Torneios' },
      { to: '/admin/inscricoes', icon: '📋', label: 'Inscrições' },
      { to: '/admin/agenda', icon: '🗓️', label: 'Agenda / OoP' },
      { to: '/admin/quadras', icon: '🏟️', label: 'Quadras do torneio' },
      { to: '/admin/sumula', icon: '📝', label: 'Súmula' },
      { to: '/admin/ranking', icon: '🥇', label: 'Ranking' },
      { to: '/admin/pontos', icon: '⭐', label: 'Pontos & Elo' },
      { to: '/admin/ligas', icon: '🏅', label: 'Ligas de Ranking' },
    ],
  },
  {
    label: 'Bar & Restaurante (evento)',
    items: [
      { to: '/admin/mesas', icon: '🪑', label: 'Mesas' },
      { to: '/admin/cardapio', icon: '🍽️', label: 'Cardápio' },
      { to: '/admin/estoque', icon: '📦', label: 'Estoque' },
      { to: '/admin/kds', icon: '🖨️', label: 'KDS & Impressão' },
      { to: '/admin/fechamento-diario', icon: '🔐', label: 'Fechamento do dia' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { to: '/admin/financeiro', icon: '💰', label: 'Financeiro' },
      { to: '/admin/contas-receber', icon: '🧾', label: 'Contas a Receber' },
      { to: '/admin/pagamentos', icon: '💳', label: 'Pagamentos (evento)' },
      { to: '/admin/notas', icon: '🧾', label: 'Notas Fiscais' },
    ],
  },
  {
    label: 'WhatsApp',
    items: [
      { to: '/admin/whatsapp-central', icon: '🧭', label: 'Central de Conexões' },
      { to: '/admin/whatsapp', icon: '💬', label: 'WhatsApp Clientes' },
      { to: '/admin/whatsapp-gestao', icon: '▣', label: 'WhatsApp Gestão' },
      { to: '/admin/whatsapp-lancamentos', icon: '🧾', label: 'WhatsApp Lançamentos' },
    ],
  },
  {
    label: 'Configurações',
    items: [
      { to: '/admin/clube/ajustes', icon: '⚙️', label: 'Quadras, horário, catracas e planos' },
      { to: '/admin/usuarios', icon: '👥', label: 'Usuários' },
      { to: '/admin/configuracoes', icon: '🛠️', label: 'Configurações' },
      { to: '/admin/auditoria', icon: '🔍', label: 'Auditoria' },
      { to: '/admin/socios', icon: '🗂️', label: 'Sócios (cadastro antigo)' },
      { to: '/admin/mensalidades', icon: '🗂️', label: 'Mensalidades (antigo)' },
    ],
  },
]

// Menu de varejo da Stallone Nutre Sport (loja de suplementos: loja física +
// e-commerce + WhatsApp). Sem torneio, mesas, garçom, portaria nem barbearia.
const NAV_STALLONE_GROUPS = [
  {
    label: 'Hoje',
    items: [
      { to: '/admin/ecommerce?tab=overview', icon: '◔', label: 'Painel da loja' },
      { to: '/loja-atendimento', icon: '⌂', label: 'Pedidos para separar' },
      { to: '/admin/ecommerce?tab=orders', icon: '◧', label: 'Pedidos e entregas' },
    ],
  },
  {
    label: 'Produtos',
    items: [
      { to: '/admin/ecommerce?tab=catalog', icon: '□', label: 'Produtos e estoque' },
      { to: '/admin/ecommerce?tab=promotions', icon: '%', label: 'Promoções' },
    ],
  },
  {
    label: 'Clientes & WhatsApp',
    items: [
      { to: '/admin/ecommerce?tab=customers', icon: '◉', label: 'Clientes' },
      { to: '/admin/whatsapp', icon: '✆', label: 'WhatsApp' },
      { to: '/admin/cerebro-ia', icon: '◈', label: 'Cérebro do atendente' },
      { to: '/admin/omnichannel', icon: '☆', label: 'Fidelidade e canais' },
    ],
  },
  {
    label: 'Loja online',
    items: [
      { to: '/admin/ecommerce?tab=shipping', icon: '↝', label: 'Frete e retirada' },
      { to: '/admin/ecommerce?tab=payments', icon: '▰', label: 'Pagamentos' },
      { to: '/admin/ecommerce?tab=domains', icon: '◎', label: 'Domínios' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { to: '/admin/ecommerce?tab=reports', icon: '▤', label: 'Relatórios' },
      { to: '/admin/financeiro', icon: '◇', label: 'Financeiro' },
      { to: '/admin/ecommerce?tab=users', icon: '♧', label: 'Usuários e acessos' },
      { to: '/admin/ecommerce?tab=audit', icon: '◌', label: 'Auditoria' },
    ],
  },
]

const NAV_STALLONE_PUBLIC = [
  { to: '/ecommerce/stallone', icon: '↗', label: 'Abrir loja Stallone' },
]

const NAV_DINO_PUBLIC = [
  { to: '/perfumaria/dino', icon: '↗', label: 'Abrir loja Dino' },
  { to: '/agendar/dino', icon: '▣', label: 'Agendamento público' },
]

// Lista plana para compatibilidade
const NAV_ADMIN = NAV_ADMIN_GROUPS.flatMap(g => g.items)

const NAV_PLATFORM = [
  { to: '/admin/plataforma', icon: '🏢', label: 'Empresas e Módulos' },
]

// O backend continua sendo a autoridade final. Este mapa apenas mantém o menu
// coerente com o contrato da empresa ativa e evita oferecer links não contratados.
const ROUTE_MODULES = [
  ['/admin/pdv', 'pdv'], ['/pdv', 'pdv'], ['/admin/garcom', 'pdv'], ['/garcom', 'pdv'],
  ['/admin/kds', 'kds'], ['/kds', 'kds'], ['/admin/loja-atendimento', 'loja'], ['/loja-atendimento', 'loja'],
  ['/admin/portaria', 'portaria'], ['/portaria', 'portaria'],
  ['/admin/torneios', 'torneios'], ['/admin/agenda', 'torneios'], ['/admin/sumula', 'torneios'],
  ['/admin/inscricoes', 'torneios'], ['/admin/quadras', 'quadras'], ['/admin/pontos', 'pontos'],
  ['/admin/ranking', 'torneios'], ['/admin/ligas', 'ligas'],
  ['/admin/mesas', 'mesas'], ['/admin/reservas', 'mesas'], ['/admin/cardapio', 'cardapio'],
  ['/admin/estoque', 'estoque'], ['/admin/perdas-inventario', 'estoque'], ['/admin/fichas-tecnicas', 'estoque'],
  ['/admin/modificadores-combos', 'cardapio'], ['/admin/pagamentos', 'pagamentos'], ['/admin/notas', 'fiscal'],
  ['/admin/cadastros-mestres', 'cadastros'], ['/admin/clientes', 'clientes'], ['/admin/contas-receber', 'financeiro'],
  ['/admin/fechamento-diario', 'financeiro'], ['/admin/cupons', 'pdv'], ['/admin/pdv-offline', 'pdv'],
  ['/admin/omnichannel', 'delivery'], ['/admin/erp', 'erp'], ['/admin/ecommerce', 'ecommerce'],
  ['/admin/supermercado', 'supermercado'], ['/admin/loja-moda', 'loja_moda'], ['/admin/barbearia-erp', 'barbearia'],
  ['/admin/barbearia', 'barbearia'], ['/admin/oficina', 'oficina'], ['/admin/agropecuaria', 'agropecuaria'],
  ['/admin/varejo', 'varejo'], ['/admin/compras', 'compras'], ['/admin/fiscal', 'fiscal'],
  ['/admin/usuarios', 'usuarios'], ['/admin/socios', 'socios'], ['/admin/mensalidades', 'socios'],
  ['/admin/aulas', 'socios'], ['/admin/clube', 'clube'], ['/admin/crm', 'crm'], ['/admin/loja', 'loja'], ['/admin/lojas', 'loja'],
  ['/admin/noticias', 'conteudo'], ['/admin/contatos', 'conteudo'],
]

function moduloDaRota(to) {
  const path = String(to || '').split('?')[0]
  return ROUTE_MODULES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1] || null
}

function itemDisponivel(item, isPlatformAdmin, empresa, usuarioDeEmpresa = false) {
  // telas sem backend em produção somem para todos; as do banco global do evento, para usuário de empresa
  if (!rotaVisivel(item.to, { isPlatformAdmin, usuarioDeEmpresa })) return false
  if (isPlatformAdmin) return true
  const modulos = Array.isArray(empresa?.modulos) ? empresa.modulos.map((modulo) => String(modulo).toLowerCase()) : null
  if (!modulos) return true
  const modulo = moduloDaRota(item.to)
  return !modulo || modulos.includes(modulo)
}

const NAV_ATLETA = [
  { to: '/meu-painel',  icon: '🏠', label: 'Visão Geral', end: true },
  { to: '/meu-painel?tab=jogos',       icon: '🎾', label: 'Meus Jogos' },
  { to: '/meu-painel?tab=ranking',     icon: '🏆', label: 'Meu Ranking' },
  { to: '/meu-painel?tab=inscricoes',  icon: '📋', label: 'Inscrições' },
  { to: '/meu-painel?tab=chaves',      icon: '🎯', label: 'Minhas Chaves' },
  { to: '/meu-painel?tab=historico',   icon: '📊', label: 'Histórico' },
  { to: '/meu-painel?tab=perfil',      icon: '👤', label: 'Perfil' },
]

const NAV_PUBLIC = [
  { to: '/',            icon: '🏠', label: 'Home', end: true },
  { to: '/inscricao',   icon: '✍️', label: 'Inscrição' },
  { to: '/ranking',     icon: '🏅', label: 'Ranking' },
  { to: '/regulamento', icon: '📜', label: 'Regulamento' },
  { to: '/bracket',     icon: '🎯', label: 'Chaves' },
  { to: '/loja',        icon: '🛍️', label: 'Loja' },
  { to: '/contato',     icon: '📞', label: 'Contato' },
  { to: '/noticias',    icon: '📰', label: 'Notícias' },
  { to: '/quadras',     icon: '🏟️', label: 'Quadras' },
  { to: '/clube',       icon: '🎾', label: 'O Clube (TTC)' },
  { to: '/liga',        icon: '🏆', label: 'Ligas de Ranking' },
]

const linkStyle = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '9px 16px', fontSize: 13, fontWeight: 600,
  color: 'var(--muted)', transition: 'all .1s',
}
const activeStyle = {
  ...linkStyle,
  background: 'var(--accent-soft)', color: 'var(--accent)',
  borderLeft: '3px solid var(--accent)',
}

function NavItem({ to, icon, label, end, onClick, badgeCount, sidebarCollapsed = false }) {
  const location = useLocation()
  const [targetPath, targetQuery = ''] = String(to || '').split('?')
  const queryAware = Boolean(targetQuery) || ['/admin/barbearia-erp', '/admin/ecommerce'].includes(targetPath)
  const targetParams = new URLSearchParams(targetQuery)
  const currentParams = new URLSearchParams(location.search)
  const searchMatches = targetQuery
    ? [...targetParams.entries()].every(([key, value]) => currentParams.get(key) === value)
    : !currentParams.has('tab') && !currentParams.has('area')
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => {
        const selected = isActive && (!queryAware || searchMatches)
        return { ...(selected ? activeStyle : linkStyle), ...(sidebarCollapsed ? { justifyContent: 'center', padding: '10px 8px', borderLeftWidth: selected ? 3 : 0 } : {}) }
      }}
      onClick={onClick}
      aria-label={sidebarCollapsed ? label : undefined}
      title={sidebarCollapsed ? label : undefined}
    >
      <span style={{ fontSize: 16 }} aria-hidden="true">{icon}</span>
      {!sidebarCollapsed && <span style={{ flex: 1 }}>{label}</span>}
      {badgeCount > 0 && <Badge count={badgeCount} />}
    </NavLink>
  )
}

function Section({ label, items, onNavClick, collapsible = false, badgesMap = {}, sidebarCollapsed = false, startCollapsed = false }) {
  const [collapsed, setCollapsed] = useState(startCollapsed)
  return (
    <div style={{ padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
      {!sidebarCollapsed && <div
        style={{
          fontSize: 10, fontWeight: 800, color: 'var(--muted)',
          padding: '6px 16px 4px', textTransform: 'uppercase', letterSpacing: '.8px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: collapsible ? 'pointer' : 'default',
          userSelect: 'none',
        }}
        onClick={() => collapsible && setCollapsed(c => !c)}
      >
        <span>{label}</span>
        {collapsible && <span style={{ fontSize: 9 }}>{collapsed ? '▶' : '▼'}</span>}
      </div>}
      {(!collapsed || sidebarCollapsed) && items.map(n => (
        <NavItem
          key={n.to}
          {...n}
          onClick={onNavClick}
          badgeCount={n.badge ? (badgesMap[n.to] || 0) : 0}
          sidebarCollapsed={sidebarCollapsed}
        />
      ))}
    </div>
  )
}

function AdminGroups({ groups, onNavClick, isPlatformAdmin, empresa, usuarioDeEmpresa = false, sidebarCollapsed = false, compacto = false }) {
  const location = useLocation()
  // menu compacto: só os grupos do dia a dia abertos; o grupo da tela atual abre sozinho
  const naRota = (g) => g.items.some((item) => {
    const p = String(item.to).split('?')[0]
    return item.end ? location.pathname === p : location.pathname === p || location.pathname.startsWith(`${p}/`)
  })
  return (
    <>
      {groups.map(g => ({ ...g, items: g.items.filter((item) => itemDisponivel(item, isPlatformAdmin, empresa, usuarioDeEmpresa)) }))
        .filter((group) => group.items.length > 0)
        .map(g => (
          <Section
            key={g.label}
            label={g.label}
            items={g.items}
            onNavClick={onNavClick}
            collapsible
            sidebarCollapsed={sidebarCollapsed}
            startCollapsed={compacto && !g.aberto && !naRota(g)}
          />
        ))}
    </>
  )
}

export default function Sidebar({ collapsed = false, onToggleCollapse = () => {} }) {
  const { user, logout, isOrg, isStaff, isAtleta, isPlatformAdmin, empresaAtiva, empresasAcessiveis, lojaAtiva, lojasAcessiveis, trocarEmpresa, trocarLoja } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const pendentes = usePendingOrders(isStaff)
  const isDino = isDinoDedicatedHost() || isDinoBrandContext(empresaAtiva)
  const isStallone = !isDino && isStalloneBrandContext(empresaAtiva)
  const isClube = !isDino && !isStallone && isClubeBrandContext(empresaAtiva)
  const [themeMode, setThemeMode] = useState(() => storedThemeMode())

  // 🔒 SEGURANÇA: Ocultar sidebar completamente se não autenticado
  if (!user) {
    return null // Sem sidebar se não há usuário
  }

  // Mapeia badges por rota (PDV e KDS recebem o total de pendentes)
  const badgesMap = {
    '/pdv': pendentes,
    '/kds': pendentes,
  }
  const empresaDoMenu = empresaAtiva
  // usuário preso a uma empresa (não é da plataforma nem usuário legado do evento)
  const usuarioDeEmpresa = (Boolean(user?.empresaId) || user?.tenantBound === true) && !isPlatformAdmin
  const opVisiveis = (itens) => itens.filter((item) => rotaVisivel(item.to, { isPlatformAdmin, usuarioDeEmpresa }))
  const lojasContexto = isDino && !lojasAcessiveis.some((loja) => loja.id === DINO_STORE.id)
    ? [...lojasAcessiveis, DINO_STORE]
    : lojasAcessiveis
  const lojasDaEmpresa = lojasContexto.filter((loja) => {
    if (isDino && loja.id === DINO_STORE.id) return true
    return !empresaAtiva?.id || loja.empresaId === empresaAtiva.id || loja.commerceEmpresaId === empresaAtiva.id
  })

  useEffect(() => {
    const handler = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setOpen(false)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Close sidebar on nav (mobile)
  const handleNavClick = () => {
    if (isMobile) setOpen(false)
  }

  const changeThemeMode = (mode) => {
    setThemeMode(applyThemeMode(mode, { persist: true }))
  }

  const sidebarStyle = {
    width: collapsed && !isMobile ? 78 : 256,
    background: 'var(--surface)',
    borderRight: '1px solid var(--line)',
    height: '100vh',
    position: 'fixed',
    top: 0,
    left: 0,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 50,
    overflowY: 'auto',
    overflowX: 'hidden',
    transition: 'transform .25s ease, width .2s ease',
    ...(isMobile && !open ? { transform: 'translateX(-100%)' } : { transform: 'translateX(0)' }),
  }

  return (
    <>
      {/* Hamburger button — mobile only */}
      {isMobile && (
        <button
          className="hamburger"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
        >
          ☰
        </button>
      )}

      {/* Overlay */}
      <div
        className={`sidebar-overlay${open ? ' open' : ''}`}
        onClick={() => setOpen(false)}
      />

      <nav style={sidebarStyle}>
        {/* Logo + close button (mobile) */}
        <div className={`sidebar-brand-header${collapsed && !isMobile ? ' is-collapsed' : ''}`} style={{
          padding: collapsed && !isMobile ? '14px 10px' : '20px 18px 18px',
          background: 'var(--brand-header)',
          borderBottom: '4px solid var(--brand-header-accent)',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 20px rgba(18,40,63,.14)',
        }}>
          <div style={{ flex: 1, minWidth: 0, display: collapsed && !isMobile ? 'none' : 'block' }}>
            <img
              src="/brand/kytto-negativo.svg"
              alt="Kytto — Sistemas inteligentes para negócios"
              className="kytto-mark sidebar-brand-kytto"
              style={{ width: 184, height: 52, objectFit: 'contain', objectPosition: 'left center' }}
            />
            <img
              src={DINO_BARBERSHOP_LOGO}
              alt="Barbearia Dino — desde 1997"
              className="sidebar-brand-dino"
            />
            <div className="sidebar-brand-subtitle" style={{
              marginTop: 8, color: 'var(--brand-header-text)', fontFamily: 'var(--font-mono)',
              fontSize: 9, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', opacity: .92,
            }}>
              Plataforma multinegócio
            </div>
          </div>
          {!isMobile && (
            <button
              type="button"
              onClick={onToggleCollapse}
              style={{
                width: 36, height: 36, flex: '0 0 36px', display: 'grid', placeItems: 'center',
                margin: collapsed ? '0 auto' : 0, background: 'rgba(255,255,255,.08)',
                border: '1px solid rgba(255,255,255,.18)', borderRadius: 10,
                color: 'var(--brand-header-text)', fontSize: 17, cursor: 'pointer',
              }}
              aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
              aria-expanded={!collapsed}
              title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {collapsed ? '›' : '‹'}
            </button>
          )}
          {isMobile && (
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'none', border: 'none', color: 'var(--muted)',
                fontSize: 20, cursor: 'pointer', padding: '4px 6px', borderRadius: 6,
              }}
              aria-label="Fechar menu"
            >
              ✕
            </button>
          )}
        </div>

        {user && !collapsed && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'grid', gap: 10 }}>
            {empresasAcessiveis.length > 1 && <label htmlFor="empresa-ativa" style={{ display: 'grid', gap: 6, fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.8px' }}>
              Empresa ativa
              <select id="empresa-ativa" value={empresaAtiva?.id || ''} onChange={(event) => trocarEmpresa(event.target.value)} style={{ width: '100%', padding: '8px 9px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--cream)', fontSize: 12, fontWeight: 700 }}>
                {empresasAcessiveis.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nome || empresa.slug || empresa.id}</option>)}
              </select>
            </label>}
            {lojasDaEmpresa.length > 0 && <div>
            <label htmlFor="loja-ativa" style={{
              display: 'block', marginBottom: 6, fontSize: 10, fontWeight: 800,
              color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.8px',
            }}>
              Loja ativa
            </label>
            <select
              id="loja-ativa"
              value={lojaAtiva?.id || (isDino && lojasDaEmpresa.some((loja) => loja.id === DINO_STORE.id) ? DINO_STORE.id : '')}
              onChange={(event) => trocarLoja(event.target.value)}
              style={{
                width: '100%', padding: '8px 9px', borderRadius: 7,
                border: '1px solid var(--line)', background: 'var(--surface-2)',
                color: 'var(--cream)', fontSize: 12, fontWeight: 700,
              }}
              aria-label="Selecionar loja ativa"
            >
              <option value="">Todas as lojas da empresa</option>
              {lojasDaEmpresa.map((loja) => (
                <option key={loja.id} value={loja.id}>
                  {loja.codigo ? `${loja.codigo} — ` : ''}{loja.nome || loja.nome_fantasia}
                </option>
              ))}
            </select>
            </div>}
          </div>
        )}

        {isStallone && !collapsed && (
          <div className="sidebar-brand-logo" style={{ padding: '10px 14px 4px' }}>
            <img src={STALLONE_LOGO} alt="Stallone Nutre Sport" style={{ width: '100%', maxWidth: 200, display: 'block', background: '#141416', borderRadius: 10 }} />
          </div>
        )}
        {(isDino || isStallone) && !collapsed && (
          <div className="sidebar-theme-switch" aria-label={isDino ? 'Tema do painel Dino' : 'Tema do painel Stallone'}>
            <span>Tema</span>
            {[
              ['system', 'Sistema'],
              ['light', 'Claro'],
              ['dark', 'Escuro'],
            ].map(([mode, label]) => (
              <button key={mode} type="button" className={themeMode === mode ? 'active' : ''} onClick={() => changeThemeMode(mode)} aria-pressed={themeMode === mode}>{label}</button>
            ))}
          </div>
        )}
        {isStaff && !isDino && !isStallone && <Section label={isClube ? 'Balcão, bar e portaria' : 'Operações'} items={opVisiveis(isClube ? NAV_OP.filter((item) => item.to !== '/loja-atendimento') : NAV_OP)} onNavClick={handleNavClick} badgesMap={badgesMap} sidebarCollapsed={collapsed && !isMobile} />}
        {isOrg && <AdminGroups groups={isDino ? NAV_DINO_GROUPS : isStallone ? NAV_STALLONE_GROUPS : isClube ? NAV_CLUBE_GROUPS : NAV_ADMIN_GROUPS} onNavClick={handleNavClick} isPlatformAdmin={isPlatformAdmin} empresa={empresaDoMenu} usuarioDeEmpresa={usuarioDeEmpresa} sidebarCollapsed={collapsed && !isMobile} compacto={isClube} />}
        {isPlatformAdmin && <Section label="Administração da Plataforma" items={NAV_PLATFORM} onNavClick={handleNavClick} sidebarCollapsed={collapsed && !isMobile} />}
        {isAtleta && <Section label="Portal do Atleta" items={NAV_ATLETA} onNavClick={handleNavClick} sidebarCollapsed={collapsed && !isMobile} />}
        <Section label={isDino ? 'Dino público' : isStallone ? 'Stallone público' : 'Site Público'} items={isDino ? NAV_DINO_PUBLIC : isStallone ? NAV_STALLONE_PUBLIC : NAV_PUBLIC} onNavClick={handleNavClick} sidebarCollapsed={collapsed && !isMobile} />

        {/* Bottom user area */}
        <div style={{ marginTop: 'auto', padding: collapsed && !isMobile ? '10px 8px' : '12px 16px', borderTop: '1px solid var(--line)' }}>
          {user ? (
            <>
              {!collapsed && <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cream)' }}>
                  {user.nome || user.user}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, textTransform: 'uppercase' }}>
                  {user.role}
                </div>
              </div>}
              {isAtleta && !collapsed && (
                <NavLink
                  to="/meu-painel"
                  style={({ isActive }) => ({
                    display: 'block',
                    textAlign: 'center',
                    padding: '7px 10px',
                    marginBottom: 8,
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'none',
                    background: isActive ? 'var(--accent-soft)' : 'transparent',
                    color: 'var(--accent)',
                    border: '1px solid var(--accent)',
                    transition: 'background 0.15s',
                  })}
                  onClick={handleNavClick}
                >
                  🏠 Meu Painel
                </NavLink>
              )}
              <button
                className="btn btn-ghost btn-sm btn-block"
                onClick={() => {
                  // 🔒 Limpar localStorage antes de fazer logout
                  localStorage.removeItem('sp_token')
                  localStorage.removeItem('sp_user')
                  localStorage.removeItem('sp_loja_ativa')
                  localStorage.removeItem('sp_lojas_acessiveis')
                  localStorage.removeItem('sp_empresa_ativa')
                  logout()
                  navigate('/login')
                }}
                aria-label="Sair do sistema"
                title={collapsed ? 'Sair' : undefined}
              >
                {collapsed && !isMobile ? '↪' : 'Sair'}
              </button>
            </>
          ) : (
            <NavLink to="/login" className="btn btn-primary btn-sm btn-block" onClick={handleNavClick}>
              Entrar
            </NavLink>
          )}
        </div>
      </nav>
    </>
  )
}
