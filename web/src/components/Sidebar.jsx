import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef } from 'react'
import { rotaVisivel } from '../lib/disponibilidade'
import { useRazaoAtivo } from '../lib/razao-estado'
import { lojasDaEmpresa as lojasDaEmpresaAtiva } from '../lib/context-selection'
import { catalogoPorArea, contagemPorEstado, ESTADOS } from '../lib/catalogo-modulos'
import { itemVisivelNoPerfil } from '../lib/perfis-menu'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { applyThemeMode, DINO_BARBERSHOP_LOGO, isClubeBrandContext, isDinoBrandContext, isStalloneBrandContext, isRestauranteBrandContext, isConcretoBrandContext, PALATARE_LOGO, CONCRETO_LOGO, STALLONE_LOGO, storedThemeMode } from '../lib/brand'
import {
  HOLDING_PALATARE_EMPRESA_ID,
  PALATARE_PIZZARIA_EMPRESA_ID,
  SERRANO_CONCRETO_EMPRESA_ID,
  isGrupoPalatareEmpresa,
  deduplicarEmpresas,
  deduplicarLojas
} from '../lib/palatare-constants'
import { DINO_STORE, isDinoDedicatedHost } from '../lib/dino-scope'
import { empresaSemUnidade, sincronizarContextoComercial } from '../lib/contexto-comercial'
import { useMenuEmGaveta } from '../lib/modo-menu'

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
      { to: '/admin/inteligencia-vendas', icon: '🚀', label: 'Como Vender Mais com IA' },
      { to: '/admin/bi',        icon: '📉', label: 'BI & Analytics' },
      { to: '/admin/relatorios-operacionais',icon: '📄', label: 'Relatórios Operacionais' },
      { to: '/admin/financeiro',icon: '💰', label: 'Financeiro' },
      { to: '/admin/dre', icon: '📈', label: 'DRE Contábil & Gerencial' },
      { to: '/admin/whatsapp-fila', icon: '💬', label: 'Atendimento WhatsApp' },
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
      { to: '/admin/empresas', icon: '🏢', label: 'Minha Empresa' },
      { to: '/admin/clientes', icon: '👥', label: 'Clientes & Contas' },
      { to: '/admin/contas-receber', icon: '💰', label: 'Contas a Receber' },
      { to: '/admin/fechamento-diario', icon: '🔐', label: 'Fechamento Diário' },
      { to: '/admin/cupons',   icon: '🎟️', label: 'Cupons' },
      { to: '/admin/pdv-offline', icon: '📡', label: 'PDV Offline & Periféricos' },
      { to: '/admin/delivery', icon: '🛵', label: 'Central Delivery & Motoboys' },
      { to: '/admin/supply-chain', icon: '📦', label: 'Supply Chain & Cotações RFQ' },
      { to: '/admin/varejo-multicanal', icon: '🏷️', label: 'Varejo Multicanal & Grade' },
      { to: '/admin/oficina', icon: '🚗', label: 'Oficina, Autopeças & OS' },
      { to: '/admin/omnichannel', icon: '🔄', label: 'Canais, Delivery & Fidelidade' },
    ],
  },
  {
    label: 'ERP Comercial',
    items: [
      { to: '/admin/erp',           icon: '🏢', label: 'Hub ERP' },
      { to: '/admin/dre',           icon: '📈', label: 'DRE & Margens' },
      { to: '/admin/propostas',     icon: '📜', label: 'Propostas Comerciais' },
      { to: '/admin/ordens-servico', icon: '🛠️', label: 'Ordens de Serviço (OS)' },
      { to: '/admin/expedicao',     icon: '🚚', label: 'Expedição & Logística' },
      { to: '/admin/patrimonio',    icon: '🏛️', label: 'Patrimônio & Ativos' },
      { to: '/admin/ecommerce',     icon: '🛒', label: 'E-commerce' },
      { to: '/admin/supermercado',  icon: '🏪', label: 'Supermercado' },
      { to: '/admin/loja-moda',     icon: '👗', label: 'Loja de Moda' },
      { to: '/admin/barbearia-erp', icon: '✂️', label: 'Barbearia ERP' },
      { to: '/admin/sorteios', icon: '🎁', label: 'Sorteios & Prêmios' },
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
      { to: '/admin/inteligencia-vendas', icon: '🚀', label: 'Como Vender Mais com IA' },
      { to: '/admin/whatsapp-fila', icon: '💬', label: 'Atendimento WhatsApp (T-Rex)' },
      { to: '/admin/barbearia-erp?area=operacao&tab=Vis%C3%A3o+geral', icon: '⌂', label: 'Operação do dia' },
      // A agenda abre numa guia própria, em tela cheia, para ficar aberta ao lado do painel.
      { to: '/admin/barbearia-erp?area=operacao&tab=Agenda', icon: '▣', label: 'Agenda', novaGuia: true },
      { to: '/admin/barbearia-erp?area=operacao&tab=Atendimento', icon: '✂', label: 'Atendimento e comandas' },
      { to: '/admin/barbearia-erp?area=operacao&tab=Caixa+e+fechamento', icon: '▱', label: 'Caixa e fechamento' },
    ],
  },
  {
    label: 'Clientes & WhatsApp',
    items: [
      { to: '/admin/whatsapp-fila', icon: '💬', label: 'Atendimento WhatsApp (T-Rex)' },
      { to: '/admin/clientes-360', icon: '◉', label: 'Clientes 360' },
      { to: '/admin/barbearia-erp?area=relacionamento&tab=Carteira+por+barbeiro', icon: '✂', label: 'Carteira de Clientes' },
      { to: '/admin/barbearia-erp?area=relacionamento&tab=Clientes', icon: '↻', label: 'CRM e campanhas' },
      { to: '/admin/barbearia-erp?area=relacionamento&tab=Retorno+previsto', icon: '↺', label: 'Retorno previsto' },
      { to: '/admin/barbearia-erp?area=relacionamento&tab=Lista+de+espera', icon: '⧗', label: 'Lista de espera' },
      { to: '/admin/barbearia-erp?area=relacionamento&tab=Indica%C3%A7%C3%B5es', icon: '⇢', label: 'Indique um amigo' },
      { to: '/admin/barbearia-erp?area=relacionamento&tab=Avalia%C3%A7%C3%B5es+%28NPS%29', icon: '★', label: 'Avaliações (NPS)' },
      { to: '/admin/barbearia-erp?area=relacionamento&tab=Origem+dos+clientes', icon: '⌖', label: 'Origem dos clientes' },
      { to: '/admin/barbearia-erp?area=relacionamento&tab=Fidelidade', icon: '☆', label: 'Fidelidade' },
      { to: '/admin/sorteios', icon: '🎁', label: 'Sorteios & Prêmios' },
      { to: '/admin/whatsapp', icon: '✆', label: 'WhatsApp' },
      { to: '/admin/whatsapp-gestao', icon: '▣', label: 'WhatsApp Gestão' },
      { to: '/admin/whatsapp-lancamentos', icon: '🧾', label: 'WhatsApp Lançamentos' },
      { to: '/admin/cerebro-ia', icon: '◈', label: 'Cérebro do atendente' },
      { to: '/admin/automacoes', icon: '⚡', label: 'Automações & Robôs' },
      { to: '/admin/ia-advisor', icon: '✦', label: 'Kytto Advisor (IA)' },
      { to: '/admin/licenciamento', icon: '🛡️', label: 'Licenças & Instâncias' },
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
      { to: '/admin/metas-roleta', icon: '🎯', label: 'Metas & Roleta' },
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
    label: 'Compras e estoque',
    items: [
      { to: '/admin/compras', icon: '🚚', label: 'Compras e fornecedores' },
      { to: '/admin/comprador-inteligente', icon: '🤖', label: 'Comprador inteligente (IA)' },
      { to: '/admin/estoque', icon: '📦', label: 'Estoque' },
      { to: '/admin/perdas-inventario', icon: '🧾', label: 'Perdas e inventário' },
      { to: '/admin/fichas-tecnicas', icon: '🧪', label: 'Fichas técnicas' },
      { to: '/admin/cadastros-mestres', icon: '🗂️', label: 'Fornecedores e funcionários' },
    ],
  },
  {
    label: 'Fiscal',
    items: [
      { to: '/admin/notas', icon: '🧾', label: 'Notas fiscais' },
      { to: '/admin/sped-fiscal', icon: '📑', label: 'SPED Bloco K' },
      { to: '/admin/matriz-tributaria', icon: '⚖️', label: 'Matriz Tributária' },
      { to: '/admin/fiscal/config', icon: '⚙️', label: 'Configuração fiscal' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { to: '/admin/gestao-salao', icon: '📊', label: 'Gestão do Salão (IA)' },
      { to: '/admin/bi', icon: '↗', label: 'BI & Analytics' },
      { to: '/admin/barbearia-erp?area=gestao&tab=Painel+de+gestão', icon: '↗', label: 'Painel de gestão' },
      { to: '/admin/barbearia-erp?area=gestao&tab=Desempenho+da+equipe', icon: '↗', label: 'Desempenho da equipe' },
      { to: '/admin/financeiro', icon: '◇', label: 'Financeiro' },
      { to: '/admin/dre-ebitda', icon: '📈', label: 'DRE & EBITDA Operacional' },
      { to: '/admin/conciliacao-tef', icon: '💳', label: 'Conciliação TEF & PIX' },
      { to: '/admin/tesouraria', icon: '🏦', label: 'Tesouraria & Cofre' },
      { to: '/admin/contas-pagar', icon: '◇', label: 'Contas a pagar', razao: true },
      { to: '/admin/contas-receber', icon: '◇', label: 'Contas a receber', razao: true },
      { to: '/admin/fechamento-diario', icon: '◇', label: 'Fechamento do dia', razao: true },
      { to: '/admin/cadastros-mestres', icon: '▤', label: 'Fornecedores e funcionários' },
      { to: '/admin/empresas', icon: '🏢', label: 'Minha Empresa' },
      { to: '/admin/lojas', icon: '▤', label: 'Unidades' },
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
      { to: '/admin/inteligencia-vendas', icon: '🚀', label: 'Como Vender Mais com IA' },
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
    label: 'Compras e estoque',
    items: [
      { to: '/admin/compras', icon: '🚚', label: 'Compras e fornecedores' },
      { to: '/admin/comprador-inteligente', icon: '🤖', label: 'Comprador inteligente (IA)' },
      { to: '/admin/estoque', icon: '📦', label: 'Estoque' },
      { to: '/admin/perdas-inventario', icon: '🧾', label: 'Perdas e inventário' },
      { to: '/admin/fichas-tecnicas', icon: '🧪', label: 'Fichas técnicas' },
      { to: '/admin/cadastros-mestres', icon: '🗂️', label: 'Fornecedores e funcionários' },
    ],
  },
  {
    label: 'Bar & Fiscal',
    items: [
      { to: '/admin/reservas', icon: '🍽️', label: 'Reservas e fila do bar' },
      { to: '/admin/pdv-offline', icon: '🖨️', label: 'PDV offline e periféricos' },
      { to: '/admin/fiscal/config', icon: '⚙️', label: 'Configuração fiscal' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { to: '/admin/financeiro', icon: '💰', label: 'Financeiro' },
      { to: '/admin/contas-pagar', icon: '🧾', label: 'Contas a Pagar', razao: true },
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
      { to: '/admin/lojas', icon: '🏬', label: 'Unidades' },
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
      { to: '/admin/inteligencia-vendas', icon: '🚀', label: 'Como Vender Mais com IA' },
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
      { to: '/admin/automacoes', icon: '⚡', label: 'Automações & Robôs' },
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
    label: 'Compras e estoque',
    items: [
      { to: '/admin/compras', icon: '🚚', label: 'Compras e fornecedores' },
      { to: '/admin/comprador-inteligente', icon: '🤖', label: 'Comprador inteligente (IA)' },
      { to: '/admin/estoque', icon: '📦', label: 'Estoque' },
      { to: '/admin/perdas-inventario', icon: '🧾', label: 'Perdas e inventário' },
      { to: '/admin/fichas-tecnicas', icon: '🧪', label: 'Fichas técnicas' },
      { to: '/admin/cadastros-mestres', icon: '🗂️', label: 'Fornecedores e funcionários' },
    ],
  },
  {
    label: 'Fiscal',
    items: [
      { to: '/admin/notas', icon: '🧾', label: 'Notas fiscais' },
      { to: '/admin/fiscal/config', icon: '⚙️', label: 'Configuração fiscal' },
      { to: '/admin/fiscal/classificacao', icon: '🏷️', label: 'Classificação fiscal (NCM)' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { to: '/admin/ecommerce?tab=reports', icon: '▤', label: 'Relatórios' },
      { to: '/admin/financeiro', icon: '◇', label: 'Financeiro' },
      { to: '/admin/contas-pagar', icon: '◇', label: 'Contas a pagar', razao: true },
      { to: '/admin/contas-receber', icon: '◇', label: 'Contas a receber', razao: true },
      { to: '/admin/fechamento-diario', icon: '◇', label: 'Fechamento do dia', razao: true },
      { to: '/admin/cadastros-mestres', icon: '▤', label: 'Fornecedores e funcionários' },
      { to: '/admin/empresas', icon: '🏢', label: 'Empresas' },
      { to: '/admin/consolidacao-grupo', icon: '🏛️', label: 'Consolidação Holding' },
      { to: '/admin/cockpit-360', icon: '🌐', label: 'Cockpit Executivo 360' },
      { to: '/admin/negocios-modulos', icon: '⚡', label: 'Negócios & Módulos' },
      { to: '/admin/lojas', icon: '▤', label: 'Unidades' },
      { to: '/admin/ecommerce?tab=users', icon: '♧', label: 'Usuários e acessos' },
      { to: '/admin/ecommerce?tab=audit', icon: '◌', label: 'Auditoria' },
    ],
  },
]

const NAV_STALLONE_PUBLIC = [
  { to: '/ecommerce/stallone', icon: '↗', label: 'Abrir loja Stallone' },
]


export const NAV_RESTAURANTE_GROUPS = [
  {
    label: 'Hoje na Pizzaria', aberto: true,
    items: [
      { to: '/admin/pizzaria', icon: '📊', label: 'Painel Palatare Suite', end: true },
      { to: '/admin/pizzaria?tab=hub_delivery', icon: '🛵', label: 'Hub Delivery Multicanal', badge: 'iFood' },
      { to: '/admin/pizzaria?tab=montador', icon: '🍕', label: 'Montador de Pizzas' },
      { to: '/admin/pizzaria?tab=rodizio', icon: '🍽️', label: 'Rodízio Inteligente' },
      { to: '/admin/pizzaria?tab=engenharia', icon: '📈', label: 'Engenharia & CMV +100%' },
      { to: '/admin/pizzaria?tab=clube', icon: '👑', label: 'Pizza Club (Assinaturas)' },
      { to: '/admin/pizzaria?tab=autoatendimento', icon: '📱', label: 'Autoatendimento QR Mesa' },
      { to: '/admin/pizzaria?tab=forno', icon: '🔥', label: 'Telemetria Forno 400°C' },
      { to: '/admin/pizzaria?tab=kds', icon: '👨‍🍳', label: 'KDS Forno a Lenha', badge: true },
      { to: '/admin/pizzaria?tab=delivery', icon: '🛵', label: 'Delivery Tangará' },
      { to: '/admin/pizzaria?tab=implantacao', icon: '✅', label: 'Implantação & Homologação' },
      { to: '/admin/mesas', icon: '🪑', label: 'Mesas & Salão' },
      { to: '/pdv', icon: '🛒', label: 'PDV & Caixa', badge: true },
      { to: '/admin/inteligencia-vendas', icon: '🚀', label: 'Como Vender Mais com IA' },
    ],
  },
  {
    label: 'Cardápio & Produção', aberto: true,
    items: [
      { to: '/admin/cardapio', icon: '🍕', label: 'Cardápio' },
      { to: '/admin/modificadores-combos', icon: '➕', label: 'Bordas, Adicionais & Combos' },
      { to: '/admin/estoque', icon: '📦', label: 'Estoque de Insumos' },
      { to: '/admin/fichas-tecnicas', icon: '🧪', label: 'Fichas Técnicas & Receitas' },
      { to: '/admin/perdas-inventario', icon: '🧾', label: 'Perdas & Inventário' },
      { to: '/admin/reservas', icon: '📅', label: 'Reservas & Fila' },
    ],
  },
  {
    label: 'Atendimento & Clientes',
    items: [
      { to: '/admin/pizzaria?tab=crm', icon: '⭐', label: 'Clientes 360° & CRM Paladar' },
      { to: '/admin/clientes', icon: '👥', label: 'Todos os Clientes' },
      { to: '/admin/whatsapp', icon: '💬', label: 'WhatsApp Pedidos' },
      { to: '/admin/cupons', icon: '🎟️', label: 'Cupons & Promoções' },
      { to: '/admin/pdv-offline', icon: '📡', label: 'PDV Offline & Periféricos' },
    ],
  },
  {
    label: 'Financeiro & Caixa',
    items: [
      { to: '/admin/pizzaria?tab=financeiro', icon: '💰', label: 'Financeiro, CMV & DRE' },
      { to: '/admin/fechamento-diario', icon: '🔐', label: 'Fechamento de Caixa', razao: true },
      { to: '/admin/financeiro', icon: '💰', label: 'Financeiro' },
      { to: '/admin/contas-pagar', icon: '🧾', label: 'Contas a Pagar', razao: true },
      { to: '/admin/contas-receber', icon: '💳', label: 'Contas a Receber', razao: true },
      { to: '/admin/pagamentos', icon: '💵', label: 'Pagamentos' },
      { to: '/admin/dre', icon: '📈', label: 'DRE & Margens' },
    ],
  },
  {
    label: 'Fiscal',
    items: [
      { to: '/admin/notas', icon: '🧾', label: 'Notas Fiscais (NFC-e / NF-e)' },
      { to: '/admin/fiscal/config', icon: '⚙️', label: 'Configuração Fiscal' },
      { to: '/admin/fiscal/classificacao', icon: '🏷️', label: 'Classificação Fiscal (NCM)' },
    ],
  },
  {
    label: 'Gestão da Empresa',
    items: [
      { to: '/admin/empresas', icon: '🏢', label: 'Minha Empresa' },
      { to: '/admin/cadastros-mestres', icon: '🗂️', label: 'Fornecedores & Equipe' },
      { to: '/admin/usuarios', icon: '👥', label: 'Usuários & Acessos' },
      { to: '/admin/lojas', icon: '🏬', label: 'Unidades / Filiais' },
      { to: '/admin/configuracoes', icon: '🛠️', label: 'Configurações' },
      { to: '/admin/auditoria', icon: '🔍', label: 'Auditoria' },
    ],
  },
  {
    label: 'Grupo Palatare', aberto: true,
    items: [
      { to: '/admin/pizzaria', icon: '🍕', label: 'Palatare Pizzaria & Restaurante' },
      { to: '/admin/concreto', icon: '🚚', label: 'Serrano Concreto Usinado' },
      { to: '/admin/concreto?secao=empresa-holding', icon: '🏢', label: 'Holding Grupo Palatare' },
      { to: '/admin/consolidacao-grupo', icon: '🏛️', label: 'Consolidação Holding' },
    ],
  },
]

export const NAV_HOLDING_GROUPS = [
  {
    label: "Holding Corporativa", aberto: true,
    items: [
      { to: "/admin/concreto?secao=empresa-holding", icon: "🏢", label: "Painel Geral da Holding" },
      { to: "/admin/concreto?secao=empresa-holding&aba=dre", icon: "📊", label: "DRE Consolidada & Cash Pooling" },
      { to: "/admin/concreto?secao=empresa-holding", icon: "🤝", label: "Hub de Sinergias B2B (Concreto & Sabor)" },
      { to: "/admin/concreto?secao=empresa-holding", icon: "🌱", label: "Governança ESG & Economia Circular" },
      { to: "/admin/concreto?secao=empresa-holding&aba=dividendos", icon: "💎", label: "Dividendos & Remuneração Acionária" },
      { to: "/admin/concreto?secao=empresa-holding", icon: "🤖", label: "Copilot KyttoIA de Expansão" },
      { to: "/admin/consolidacao-grupo", icon: "🏛️", label: "Consolidação Geral dos Negócios" },
      { to: "/admin/cockpit-360", icon: "🌐", label: "Cockpit Executivo 360" },
    ],
  },
  {
    label: "Empresas Controladas", aberto: true,
    items: [
      { to: "/admin/pizzaria", icon: "🍕", label: "Palatare Pizzaria & Restaurante" },
      { to: "/admin/pizzaria?tab=hub_delivery", icon: "🛵", label: "Hub Delivery Palatare (iFood · Keeta)" },
      { to: "/admin/concreto", icon: "🚚", label: "Serrano Concreto Usinado & Mineração" },
      { to: "/admin/concreto?secao=app-campo-assinatura", icon: "📱", label: "Serrano App de Campo & Canhoto (PWA)" },
    ],
  },
  {
    label: "Administração & Finanças", aberto: true,
    items: [
      { to: "/admin/financeiro", icon: "💰", label: "Financeiro & Contas da Holding" },
      { to: "/admin/notas", icon: "🧾", label: "Barramento Fiscal & Notas" },
      { to: "/admin/empresas", icon: "🏢", label: "Cadastro de Empresas do Grupo" },
      { to: "/admin/cadastros-mestres", icon: "🗂️", label: "Sócios & Fornecedores Globais" },
      { to: "/admin/configuracoes", icon: "⚙️", label: "Configurações da Holding" },
    ],
  },
];

const NAV_HOLDING_PUBLIC = [
  { to: '/admin/concreto?secao=empresa-holding', icon: '🏢', label: 'Portal Corporativo' },
  { to: '/concreto/app', icon: '📱', label: 'App Serrano de Campo' },
  { to: '/mesa/palatare-m4', icon: '🍽️', label: 'Cardápio Digital Palatare' },
  { to: '/admin/consolidacao-grupo', icon: '🏛️', label: 'Transparência & Consolidação' },
];

export const NAV_CONCRETO_GROUPS = [
  {
    label: "Operação", aberto: true,
    items: [
      { to: "/admin/concreto?secao=operacao-despacho", icon: "🚚", label: "Despacho ao Vivo" },
      { to: "/admin/concreto?secao=torre-pesagem", icon: "🗼", label: "Torre de Controle & Balança" },
      { to: "/admin/concreto?secao=app-campo-assinatura", icon: "📱", label: "App PWA & Canhoto em Campo" },
      { to: "/admin/concreto?secao=operacao-programacao", icon: "📅", label: "Programação de Cargas" },
      { to: "/admin/concreto?secao=operacao-frota", icon: "🚛", label: "Frota & Telemetria" },
      { to: "/pdv", icon: "⚖️", label: "Balança Rodoviária 80t" },
      { to: "/admin/concreto?secao=cameras-cftv", icon: "📹", label: "Câmeras & Vision AI" },
    ],
  },
  {
    label: "Produção", aberto: true,
    items: [
      { to: "/admin/concreto?secao=producao-central", icon: "🏭", label: "Central Dosadora (NBR 7212)" },
      { to: "/admin/concreto?secao=producao-op", icon: "📋", label: "Ordens de Produção" },
      { to: "/admin/concreto?secao=producao-laboratorio", icon: "🔬", label: "Laboratório & CPs (NBR 5739)" },
      { to: "/admin/fichas-tecnicas", icon: "🧪", label: "Traços & Fichas Técnicas FCK" },
    ],
  },
  {
    label: "Suprimentos", aberto: true,
    items: [
      { to: "/admin/concreto?secao=suprimentos-silos", icon: "⛏️", label: "Mineração & Silos 96t" },
      { to: "/admin/concreto?secao=suprimentos-compras", icon: "📦", label: "Compras de Insumos" },
      { to: "/admin/estoque", icon: "📦", label: "Estoque Geral da Usina" },
      { to: "/admin/perdas-inventario", icon: "🧾", label: "Perdas & Inventário" },
    ],
  },
  {
    label: "Comercial", aberto: true,
    items: [
      { to: "/admin/concreto?secao=comercial-propostas", icon: "💼", label: "Orçamentos & Propostas" },
      { to: "/admin/concreto?secao=comercial-custos", icon: "📊", label: "Custos & Preços (FCK)" },
      { to: "/admin/clientes", icon: "🏗️", label: "Construtoras & Obras" },
      { to: "/admin/whatsapp", icon: "💬", label: "WhatsApp Usina & Despacho" },
    ],
  },
  {
    label: "Empresa", aberto: true,
    items: [
      { to: "/admin/concreto?secao=empresa-holding", icon: "🏢", label: "Grupo Palatare · Holding & Fiscais" },
      { to: "/admin/pizzaria", icon: "🍕", label: "Palatare Pizzaria & Restaurante" },
      { to: "/admin/concreto?secao=financeiro-usina", icon: "💰", label: "Financeiro, Fluxo & Medições de Obras" },
      { to: "/admin/notas", icon: "🧾", label: "Notas Fiscais (NF-e / MDF-e)" },
      { to: "/admin/cadastros-mestres", icon: "🗂️", label: "Motoristas & Fornecedores" },
      { to: "/admin/configuracoes", icon: "⚙️", label: "Configurações" },
    ],
  },
];

const NAV_PALATARE_PUBLIC = [
  { to: '/mesa/palatare-m4', icon: '🍽️', label: 'Cardápio Digital Mesa' },
  { to: 'https://www.instagram.com/palataretga/', icon: '↗', label: 'Instagram @palataretga', novaGuia: true },
  { to: 'https://wa.me/message/QYC36PECPJISF1', icon: '🛵', label: 'WhatsApp Pedidos', novaGuia: true },
]

const NAV_CONCRETO_PUBLIC = [
  { to: '/concreto/app', icon: '📱', label: 'App PWA Motorista & Cliente' },
  { to: '/api/public/concreto/download-apk', icon: '📥', label: 'Baixar APK Android', novaGuia: true },
  { to: '/admin/concreto', icon: '🚚', label: 'Painel da Usina' },
]

const NAV_DINO_PUBLIC = [
  { to: '/perfumaria/dino', icon: '↗', label: 'Abrir loja Dino' },
  { to: '/sorteios/dino', icon: '🎁', label: 'Consultar Sorteios' },
  { to: '/agendar/dino', icon: '▣', label: 'Agendamento público' },
]

// Lista plana para compatibilidade
const NAV_ADMIN = NAV_ADMIN_GROUPS.flatMap(g => g.items)

const NAV_PLATFORM = [
  { to: '/admin/plataforma', icon: '🏢', label: 'Empresas e Módulos' },
  { to: '/admin/negocios-modulos', icon: '⚡', label: 'Governança de Negócios' },
  { to: '/admin/plataforma/conciliacao-financeira', icon: '⚖️', label: 'Conciliação financeira' },
  { to: '/admin/licenciamento', icon: '🛡️', label: 'Licenciamento & Instâncias' },
  { to: '/admin/ia-advisor', icon: '✦', label: 'Kytto Advisor (Copilot IA)' },
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
  ['/admin/cadastros-mestres', 'cadastros'], ['/admin/clientes', 'clientes'], ['/admin/contas-receber', 'financeiro'], ['/admin/contas-pagar', 'financeiro'],
  ['/admin/fechamento-diario', 'financeiro'], ['/admin/cupons', 'pdv'], ['/admin/pdv-offline', 'pdv'],
  ['/admin/omnichannel', 'delivery'], ['/admin/erp', 'erp'], ['/admin/propostas', 'erp'], ['/admin/ordens-servico', 'erp'], ['/admin/expedicao', 'erp'], ['/admin/patrimonio', 'erp'], ['/admin/ecommerce', 'ecommerce'],
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

function itemDisponivel(item, isPlatformAdmin, empresa, usuarioDeEmpresa = false, permissoes = null, modulosOcultos = null) {
  // telas sem backend em produção somem para todos; as do banco global do evento, para usuário de
  // empresa; as do backoffice cuja permissão a pessoa não tem, para ela
  if (!rotaVisivel(item.to, { isPlatformAdmin, usuarioDeEmpresa, permissoes, modulosOcultos })) return false
  // Não exibir Supermercado para negócios do tipo Barbearia (ex.: Dino)
  if ((isDinoBrandContext(empresa) || empresa?.tipo_negocio === "barbearia") && (item.to === "/admin/supermercado" || item.to.startsWith("/admin/supermercado"))) {
    return false
  }
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

function NavItem({ to, icon, label, end, onClick, badgeCount, sidebarCollapsed = false, tag = null, tagTitle = '', novaGuia = false }) {
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
      to={novaGuia ? `${to}${String(to).includes('?') ? '&' : '?'}tela=cheia` : to}
      {...(novaGuia ? { target: '_blank', rel: 'noopener' } : {})}
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
      {!sidebarCollapsed && novaGuia && <span aria-label="abre em nova guia" title="Abre em nova guia" style={{ fontSize: 11, color: 'var(--muted)' }}>↗</span>}
      {!sidebarCollapsed && tag && <span className={`nav-estado nav-estado-${tag}`} title={tagTitle} style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px', padding: '2px 6px', borderRadius: 999, border: '1px solid var(--line)', color: tag === 'em_implantacao' ? 'var(--gold, #C9A656)' : 'var(--muted)', whiteSpace: 'nowrap' }}>{ESTADOS[tag]?.rotulo || tag}</span>}
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
  const { permissoes, modulosOcultos, perfil } = useAuth()
  // itens do Financeiro novo (a receber, fechamento do dia) só com ele ligado: antes disso essas
  // telas são as do A2 e a empresa veria dois "a receber" diferentes
  const razaoAtivo = useRazaoAtivo()
  // menu compacto: só os grupos do dia a dia abertos; o grupo da tela atual abre sozinho
  const naRota = (g) => g.items.some((item) => {
    const p = String(item.to).split('?')[0]
    return item.end ? location.pathname === p : location.pathname === p || location.pathname.startsWith(`${p}/`)
  })
  return (
    <>
      {groups.map(g => ({ ...g, items: g.items.filter((item) => itemVisivelNoPerfil(item.to, perfil) && (!item.razao || razaoAtivo === true) && itemDisponivel(item, isPlatformAdmin, empresa, usuarioDeEmpresa, permissoes, modulosOcultos)) }))
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

// Seção só da administração da plataforma: o catálogo inteiro de módulos, de qualquer marca,
// com o estado de cada um na empresa ativa (no ar, em implantação, não contratado, evento).
function BackofficePlataforma({ empresa, onNavClick, sidebarCollapsed = false }) {
  const [aberto, setAberto] = useState(false)
  const grupos = catalogoPorArea(empresa)
  const contagem = contagemPorEstado(empresa)
  if (sidebarCollapsed) return null
  return (
    <div style={{ padding: '4px 0', borderBottom: '1px solid var(--line)' }} data-testid="backoffice-plataforma">
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        aria-expanded={aberto}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 10, fontWeight: 800, color: 'var(--muted)', padding: '6px 16px 4px', textTransform: 'uppercase', letterSpacing: '.8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>Backoffice da plataforma</span>
        <span style={{ fontSize: 9 }}>{aberto ? '▼' : '▶'}</span>
      </button>
      {!aberto && (
        <div style={{ padding: '0 16px 6px', fontSize: 11, color: 'var(--muted)' }}>
          {contagem.no_ar || 0} no ar{contagem.homologacao ? ` · ${contagem.homologacao} em homologação` : ''} · {contagem.em_implantacao || 0} em implantação{contagem.nao_contratado ? ` · ${contagem.nao_contratado} fora do contrato` : ''}
        </div>
      )}
      {aberto && grupos.map((grupo) => (
        <Section
          key={grupo.area}
          label={grupo.area}
          items={grupo.itens.map((item) => ({ ...item, tag: item.estado === 'no_ar' ? null : item.estado, tagTitle: ESTADOS[item.estado]?.descricao || '' }))}
          onNavClick={onNavClick}
          collapsible
          startCollapsed
        />
      ))}
    </div>
  )
}

export default function Sidebar() {
  const { user, logout, isOrg, isStaff, isAtleta, isPlatformAdmin, empresaAtiva, empresasAcessiveis, lojaAtiva, lojasAcessiveis, trocarEmpresa, trocarLoja, permissoes, modulosOcultos, atualizarContextoLojas } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  // Computador: o menu fica sempre recolhido e abre por cima da tela só enquanto o mouse está
  // nele (ou enquanto um seletor dele está em uso). Toque/tela estreita: gaveta pelo botão ☰.
  const [hovered, setHovered] = useState(false)
  const [focado, setFocado] = useState(false)
  const timerAbrir = useRef(null)
  const isMobile = useMenuEmGaveta()
  const recolhido = !isMobile && !hovered && !focado
  const pendentes = usePendingOrders(isStaff)
  const location = useLocation()
  const naRotaConcreto = location.pathname.startsWith('/admin/concreto') || location.pathname.startsWith('/admin/usina-concreto')
  const naRotaHolding = (naRotaConcreto && location.search.includes('secao=empresa-holding')) || location.pathname.startsWith('/admin/consolidacao-grupo')
  const naRotaPizzaria = location.pathname.startsWith('/admin/pizzaria')

  // Contexto de Marca com Prioridade Correta:
  const isHolding = (empresaAtiva?.id === HOLDING_PALATARE_EMPRESA_ID || empresaAtiva?.tipoNegocio === 'holding' || naRotaHolding)
  const isRestaurante = !isHolding && (empresaAtiva?.id === PALATARE_PIZZARIA_EMPRESA_ID || isRestauranteBrandContext(empresaAtiva) || naRotaPizzaria)
  const isConcreto = !isHolding && !isRestaurante && (empresaAtiva?.id === SERRANO_CONCRETO_EMPRESA_ID || isConcretoBrandContext(empresaAtiva) || naRotaConcreto)
  const isGrupoPalatareAtivo = isHolding || isRestaurante || isConcreto || isGrupoPalatareEmpresa(empresaAtiva?.id)
  const isDino = !isGrupoPalatareAtivo && (isDinoDedicatedHost() || isDinoBrandContext(empresaAtiva))
  const isStallone = !isGrupoPalatareAtivo && !isDino && isStalloneBrandContext(empresaAtiva)
  const isClube = !isGrupoPalatareAtivo && !isDino && !isStallone && isClubeBrandContext(empresaAtiva)

  // Sincroniza a empresaAtiva ao navegar entre as empresas do Grupo Palatare
  useEffect(() => {
    if (naRotaHolding && empresaAtiva?.id !== HOLDING_PALATARE_EMPRESA_ID) {
      trocarEmpresa(HOLDING_PALATARE_EMPRESA_ID)
    } else if (naRotaConcreto && !naRotaHolding && empresaAtiva?.id !== SERRANO_CONCRETO_EMPRESA_ID) {
      trocarEmpresa(SERRANO_CONCRETO_EMPRESA_ID)
    } else if (naRotaPizzaria && empresaAtiva?.id !== PALATARE_PIZZARIA_EMPRESA_ID) {
      trocarEmpresa(PALATARE_PIZZARIA_EMPRESA_ID)
    }
  }, [location.pathname, location.search, empresaAtiva?.id])

  const [themeMode, setThemeMode] = useState(() => storedThemeMode())
  const contextoSemUnidade = Boolean(user && isStaff && empresaAtiva?.id) && (empresaSemUnidade(lojasAcessiveis, empresaAtiva?.id) || !lojaAtiva?.id)
  // Corrige no carregamento o contexto antigo do navegador em que a unidade perdeu o
  // vínculo com a empresa; o servidor (memberships) é a fonte da verdade.
  useEffect(() => {
    if (!contextoSemUnidade) return
    sincronizarContextoComercial({ cliente: api, lojasAcessiveis, atualizarContextoLojas })
  }, [contextoSemUnidade, empresaAtiva?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const opVisiveis = (itens) => itens.filter((item) => rotaVisivel(item.to, { isPlatformAdmin, usuarioDeEmpresa, permissoes, modulosOcultos }))
  const lojasContexto = isDino && !lojasAcessiveis.some((loja) => loja.id === DINO_STORE.id)
    ? [...lojasAcessiveis, DINO_STORE]
    : lojasAcessiveis
  // lojas da empresa ativa (id legado ou do Commerce); no host da Dino a unidade Dino sempre aparece
  const lojasDaEmpresa = [
    ...lojasDaEmpresaAtiva(lojasContexto.filter((loja) => !(isDino && loja.id === DINO_STORE.id)), empresaAtiva?.id),
    ...(isDino ? lojasContexto.filter((loja) => loja.id === DINO_STORE.id) : []),
  ]

  useEffect(() => {
    if (!isMobile) setOpen(false)
  }, [isMobile])
  useEffect(() => () => clearTimeout(timerAbrir.current), [])

  const abrirNoHover = () => {
    clearTimeout(timerAbrir.current)
    // Pequena espera: passar o mouse de raspão pela borda não abre o menu.
    timerAbrir.current = setTimeout(() => setHovered(true), 120)
  }
  const fecharNoHover = () => {
    clearTimeout(timerAbrir.current)
    setHovered(false)
  }

  // Escolheu um item: fecha a gaveta (toque) ou recolhe o menu (computador).
  const handleNavClick = () => {
    if (isMobile) setOpen(false)
    else {
      fecharNoHover()
      setFocado(false)
      if (typeof document !== 'undefined') document.activeElement?.blur?.()
    }
  }

  const changeThemeMode = (mode) => {
    setThemeMode(applyThemeMode(mode, { persist: true }))
  }

  const sidebarStyle = {
    width: recolhido ? 78 : 256,
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
    transition: 'transform .25s ease, width .2s ease, box-shadow .2s ease',
    boxShadow: (!isMobile && !recolhido) || (isMobile && open) ? '12px 0 32px rgba(18,40,63,.18)' : 'none',
    ...(isMobile && !open ? { transform: 'translateX(-100%)' } : { transform: 'translateX(0)' }),
  }

  return (
    <>
      {/* Hamburger button — mobile only */}
      {/* Com a gaveta aberta o ☰ some: o ✕ da própria gaveta fecha, e o botão não cobre a logo. */}
      {isMobile && !open && (
        <button
          className="hamburger"
          style={{ display: 'flex' }}
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={open}
        >
          ☰
        </button>
      )}

      {/* Overlay */}
      <div
        className={`sidebar-overlay${open ? ' open' : ''}`}
        style={isMobile && open ? { display: 'block' } : undefined}
        onClick={() => setOpen(false)}
      />

      <nav
        style={sidebarStyle}
        aria-label="Menu principal"
        onMouseEnter={isMobile ? undefined : abrirNoHover}
        onMouseLeave={isMobile ? undefined : fecharNoHover}
        // Seletor de empresa/unidade aberto: a lista nativa sai da área do menu e não pode recolhê-lo.
        onFocus={(event) => { if (!isMobile && event.target?.tagName === 'SELECT') setFocado(true) }}
        onBlur={(event) => { if (!isMobile && event.target?.tagName === 'SELECT') setFocado(false) }}
      >
        {/* Logo + close button (mobile) */}
        <div className={`sidebar-brand-header${recolhido ? ' is-collapsed' : ''}`} style={{
          padding: recolhido ? '14px 10px' : '20px 18px 18px',
          background: 'var(--brand-header)',
          borderBottom: '4px solid var(--brand-header-accent)',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 20px rgba(18,40,63,.14)',
        }}>
          <div style={{ flex: 1, minWidth: 0, display: recolhido ? 'none' : 'block' }}>
            <img
              src="/brand/kytto-negativo.svg"
              alt="Kytto — Sistemas inteligentes para negócios"
              className="kytto-mark sidebar-brand-kytto"
              style={{ width: 184, height: 52, objectFit: 'contain', objectPosition: 'left center' }}
            />
            {isDino && (
              <img
                src={DINO_BARBERSHOP_LOGO}
                alt="Barbearia Dino — desde 1997"
                className="sidebar-brand-dino"
              />
            )}
            {isHolding && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "linear-gradient(135deg, #C5A059 0%, #E5C378 100%)",
                  color: "#16181B", display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 900, fontSize: 18, boxShadow: "0 2px 8px rgba(197, 160, 89, 0.4)"
                }}>
                  🏢
                </div>
                <div>
                  <div style={{ color: "#FFFFFF", fontWeight: 900, fontSize: 13.5, lineHeight: 1.15, letterSpacing: "0.3px" }}>
                    GRUPO PALATARE
                  </div>
                  <div style={{ color: "#F3E5AB", fontWeight: 800, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.7px" }}>
                    Holding Controladora S/A
                  </div>
                </div>
              </div>
            )}
            {isRestaurante && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <img
                  src="/palatare-logo.png"
                  alt="Palatare Pizzaria"
                  style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #C5A059", background: "#000", objectFit: "contain" }}
                />
                <div>
                  <div style={{ color: "#FFFFFF", fontWeight: 900, fontSize: 13.5, lineHeight: 1.15, letterSpacing: "0.3px" }}>
                    PALATARE
                  </div>
                  <div style={{ color: "#F3E5AB", fontWeight: 800, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.7px" }}>
                    Pizzaria & Restaurante
                  </div>
                </div>
              </div>
            )}
            {isConcreto && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "linear-gradient(135deg, #FF6B2C 0%, #EA580C 100%)",
                  color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 900, fontSize: 16, boxShadow: "0 2px 8px rgba(234, 88, 12, 0.4)"
                }}>
                  SC
                </div>
                <div>
                  <div style={{ color: "#FFFFFF", fontWeight: 900, fontSize: 13.5, lineHeight: 1.15, letterSpacing: "0.3px" }}>
                    SERRANO CONCRETO
                  </div>
                  <div style={{ color: "#FFB088", fontWeight: 800, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.7px" }}>
                    Usinado & Mineração
                  </div>
                </div>
              </div>
            )}
            <div className="sidebar-brand-subtitle" style={{
              marginTop: 8, color: 'var(--brand-header-text)', fontFamily: 'var(--font-mono)',
              fontSize: 9, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', opacity: .92,
            }}>
              Plataforma multinegócio
            </div>
          </div>
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

        {user && !recolhido && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'grid', gap: 10 }}>
            {empresasAcessiveis.length >= 1 && (() => {
              const empresasDeduplicadas = deduplicarEmpresas(empresasAcessiveis);
              const empresasPalatare = empresasDeduplicadas.filter(e => isGrupoPalatareEmpresa(e.id) || isGrupoPalatareEmpresa(e.nome));
              const outrasEmpresas = empresasDeduplicadas.filter(e => !isGrupoPalatareEmpresa(e.id) && !isGrupoPalatareEmpresa(e.nome));
              return (
                <label htmlFor="empresa-ativa" style={{ display: 'grid', gap: 6, fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.8px' }}>
                  Empresa ativa
                  <select
                    id="empresa-ativa"
                    value={empresaAtiva?.id || ''}
                    onChange={(event) => {
                      const novaId = event.target.value;
                      trocarEmpresa(novaId);
                      if (novaId === HOLDING_PALATARE_EMPRESA_ID) {
                        navigate('/admin/concreto?secao=empresa-holding');
                      } else if (novaId === PALATARE_PIZZARIA_EMPRESA_ID) {
                        navigate('/admin/pizzaria');
                      } else if (novaId === SERRANO_CONCRETO_EMPRESA_ID) {
                        navigate('/admin/concreto');
                      } else {
                        navigate('/admin');
                      }
                    }}
                    style={{
                      width: '100%', padding: '8px 9px', borderRadius: 7,
                      border: '1px solid var(--line)', background: 'var(--surface-2)',
                      color: 'var(--cream)', fontSize: 12, fontWeight: 700
                    }}
                  >
                    {empresasPalatare.length > 0 ? (
                      <>
                        <optgroup label="🏢 GRUPO PALATARE (HOLDING)">
                          {empresasPalatare.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.id === HOLDING_PALATARE_EMPRESA_ID ? '🏢 ' : emp.id === PALATARE_PIZZARIA_EMPRESA_ID ? '🍕 ' : '🚚 '}
                              {emp.nome || emp.nomeFantasia || emp.razaoSocial}
                              {emp.id === HOLDING_PALATARE_EMPRESA_ID ? ' (Controladora)' : ''}
                            </option>
                          ))}
                        </optgroup>
                        {outrasEmpresas.length > 0 && (
                          <optgroup label="OUTRAS EMPRESAS">
                            {outrasEmpresas.map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.nome || emp.slug || emp.id}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    ) : (
                      empresasDeduplicadas.map((empresa) => (
                        <option key={empresa.id} value={empresa.id}>
                          {empresa.nome || empresa.slug || empresa.id}
                        </option>
                      ))
                    )}
                  </select>
                </label>
              );
            })()}

            {/* Switcher Rápido Multinegócio do Grupo Palatare */}
            {(isRestaurante || isConcreto || isHolding || isGrupoPalatareEmpresa(empresaAtiva?.id)) && (
              <div style={{
                background: 'linear-gradient(180deg, #16181B 0%, #1A1D21 100%)',
                border: '1px solid rgba(197, 160, 89, 0.45)',
                borderRadius: 10,
                padding: '10px 12px',
                display: 'grid',
                gap: 8,
                boxShadow: '0 4px 14px rgba(0,0,0,0.35)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>🏛️</span>
                    <span style={{ fontSize: 11.5, fontWeight: 900, color: '#E5C378', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                      Grupo Palatare
                    </span>
                  </div>
                  <span style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: '#34d399',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(52, 211, 153, 0.4)',
                    padding: '2px 6px',
                    borderRadius: 4
                  }}>
                    ● Síncrono A2
                  </span>
                </div>
                <div style={{ fontSize: 10.5, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>Controle:</span>
                  <b style={{ color: '#F3E5AB' }}>Alexandre Palatare</b>
                </div>

                {/* Lista Vertical de Empresas com Hierarquia Visual de Grupo */}
                <div style={{ display: 'grid', gap: 6 }}>
                  {/* 1. Holding */}
                  {(() => {
                    const ativo = (empresaAtiva?.id === HOLDING_PALATARE_EMPRESA_ID || isHolding);
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          trocarEmpresa(HOLDING_PALATARE_EMPRESA_ID);
                          navigate('/admin/concreto?secao=empresa-holding');
                        }}
                        style={{
                          background: ativo ? 'linear-gradient(90deg, rgba(197, 160, 89, 0.3) 0%, rgba(197, 160, 89, 0.15) 100%)' : 'rgba(255,255,255,0.06)',
                          border: ativo ? '1.5px solid #E5C378' : '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 8,
                          padding: '7px 9px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'all .15s ease',
                          textAlign: 'left'
                        }}
                        title="Holding Grupo Palatare (Controladora Geral de Alexandre Palatare)"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: 6,
                            background: ativo ? '#C5A059' : 'rgba(197, 160, 89, 0.25)',
                            color: ativo ? '#000' : '#E5C378',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 900
                          }}>
                            🏢
                          </div>
                          <div>
                            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2 }}>
                              Holding Grupo Palatare
                            </div>
                            <div style={{ fontSize: 9.5, color: '#F3E5AB', fontWeight: 700 }}>
                              Controladora Geral S/A
                            </div>
                          </div>
                        </div>
                        {ativo && (
                          <span style={{ fontSize: 9.5, fontWeight: 900, color: '#16181B', background: '#E5C378', padding: '2px 6px', borderRadius: 4 }}>
                            Ativa
                          </span>
                        )}
                      </button>
                    );
                  })()}

                  {/* 2. Palatare Pizzaria */}
                  {(() => {
                    const ativo = (empresaAtiva?.id === PALATARE_PIZZARIA_EMPRESA_ID || isRestaurante);
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          trocarEmpresa(PALATARE_PIZZARIA_EMPRESA_ID);
                          navigate('/admin/pizzaria');
                        }}
                        style={{
                          background: ativo ? 'linear-gradient(90deg, rgba(239, 68, 68, 0.3) 0%, rgba(239, 68, 68, 0.15) 100%)' : 'rgba(255,255,255,0.06)',
                          border: ativo ? '1.5px solid #F87171' : '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 8,
                          padding: '7px 9px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'all .15s ease',
                          textAlign: 'left'
                        }}
                        title="Palatare Pizzaria & Restaurante (100% Grupo Palatare)"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: 6,
                            background: ativo ? '#EF4444' : 'rgba(239, 68, 68, 0.25)',
                            color: '#FFF',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 900
                          }}>
                            🍕
                          </div>
                          <div>
                            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2 }}>
                              Palatare Pizzaria
                            </div>
                            <div style={{ fontSize: 9.5, color: '#FCA5A5', fontWeight: 700 }}>
                              Salão Gourmet &amp; Delivery
                            </div>
                          </div>
                        </div>
                        {ativo && (
                          <span style={{ fontSize: 9.5, fontWeight: 900, color: '#FFF', background: '#EF4444', padding: '2px 6px', borderRadius: 4 }}>
                            Ativa
                          </span>
                        )}
                      </button>
                    );
                  })()}

                  {/* 3. Serrano Concreto */}
                  {(() => {
                    const ativo = (empresaAtiva?.id === SERRANO_CONCRETO_EMPRESA_ID || isConcreto);
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          trocarEmpresa(SERRANO_CONCRETO_EMPRESA_ID);
                          navigate('/admin/concreto');
                        }}
                        style={{
                          background: ativo ? 'linear-gradient(90deg, rgba(255, 112, 0, 0.3) 0%, rgba(255, 112, 0, 0.15) 100%)' : 'rgba(255,255,255,0.06)',
                          border: ativo ? '1.5px solid #FB923C' : '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 8,
                          padding: '7px 9px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'all .15s ease',
                          textAlign: 'left'
                        }}
                        title="Serrano Concreto Usinado & Mineração (100% Grupo Palatare)"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: 6,
                            background: ativo ? '#FF7000' : 'rgba(255, 112, 0, 0.25)',
                            color: ativo ? '#FFFFFF' : '#FF7000',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 900
                          }}>
                            🚚
                          </div>
                          <div>
                            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2 }}>
                              Serrano Concreto
                            </div>
                            <div style={{ fontSize: 9.5, color: '#FDBA74', fontWeight: 700 }}>
                              Central Dosadora NBR 7212
                            </div>
                          </div>
                        </div>
                        {ativo && (
                          <span style={{ fontSize: 9.5, fontWeight: 900, color: '#FFF', background: '#FF7000', padding: '2px 6px', borderRadius: 4 }}>
                            Ativa
                          </span>
                        )}
                      </button>
                    );
                  })()}
                </div>
              </div>
            )}

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
              {deduplicarLojas(lojasDaEmpresa).map((loja) => (
                <option key={loja.id} value={loja.id}>
                  {loja.codigo ? `${loja.codigo} — ` : ''}{loja.nome || loja.nome_fantasia}
                </option>
              ))}
            </select>
            </div>}
          </div>
        )}

        {isStallone && !recolhido && (
          <div className="sidebar-brand-logo" style={{ padding: '10px 14px 4px' }}>
            <img src={STALLONE_LOGO} alt="Stallone Nutre Sport" style={{ width: '100%', maxWidth: 200, display: 'block', background: '#141416', borderRadius: 10 }} />
          </div>
        )}
        {(isDino || isStallone) && !recolhido && (
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
        {isStaff && !isDino && !isStallone && !isHolding && (
          <Section
            label={isRestaurante ? "Operação de Salão & Cozinha" : isConcreto ? "Operação da Usina" : isClube ? "Balcão, bar e portaria" : "Operações"}
            items={opVisiveis(
              isRestaurante
                ? [
                    { to: "/pdv", icon: "🛒", label: "PDV Balcão", badge: true },
                    { to: "/garcom", icon: "🧑‍🍳", label: "Modo Garçom", badge: false },
                    { to: "/kds", icon: "👨‍🍳", label: "Cozinha / KDS", badge: true },
                  ]
                : isConcreto
                ? [
                    { to: "/admin/concreto", icon: "🚚", label: "Expedição & Cargas", badge: true },
                    { to: "/admin/concreto?secao=torre-pesagem", icon: "🗼", label: "Torre de Controle", badge: false },
                    { to: "/pdv", icon: "⚖️", label: "Balança Rodoviária 80t", badge: false },
                    { to: "/admin/concreto?secao=cameras-cftv", icon: "📹", label: "Câmeras & Vision AI", badge: false },
                  ]
                : isClube
                ? NAV_OP.filter((item) => item.to !== "/loja-atendimento")
                : NAV_OP
            )}
            onNavClick={handleNavClick}
            badgesMap={badgesMap}
            sidebarCollapsed={recolhido}
          />
        )}
        {isStaff && isHolding && (
          <Section
            label="Comando do Grupo Palatare"
            items={opVisiveis([
              { to: "/admin/concreto?secao=empresa-holding", icon: "🏢", label: "Cockpit da Holding", badge: false },
              { to: "/admin/pizzaria", icon: "🍕", label: "Palatare Pizzaria", badge: false },
              { to: "/admin/concreto", icon: "🚚", label: "Serrano Concreto", badge: false },
              { to: "/admin/consolidacao-grupo", icon: "📊", label: "DRE Consolidada", badge: false },
            ])}
            onNavClick={handleNavClick}
            badgesMap={badgesMap}
            sidebarCollapsed={recolhido}
          />
        )}
        {isOrg && (
          <AdminGroups
            groups={
              isHolding
                ? NAV_HOLDING_GROUPS
                : isDino
                ? NAV_DINO_GROUPS
                : isStallone
                ? NAV_STALLONE_GROUPS
                : isRestaurante
                ? NAV_RESTAURANTE_GROUPS
                : isConcreto
                ? NAV_CONCRETO_GROUPS
                : isClube
                ? NAV_CLUBE_GROUPS
                : NAV_ADMIN_GROUPS
            }
            onNavClick={handleNavClick}
            isPlatformAdmin={isPlatformAdmin}
            empresa={empresaDoMenu}
            usuarioDeEmpresa={usuarioDeEmpresa}
            sidebarCollapsed={recolhido}
            compacto={isHolding || isClube || isRestaurante || isConcreto}
          />
        )}
        {isPlatformAdmin && <Section label="Administração da Plataforma" items={NAV_PLATFORM} onNavClick={handleNavClick} sidebarCollapsed={recolhido} />}
        {isPlatformAdmin && <BackofficePlataforma empresa={empresaDoMenu} onNavClick={handleNavClick} sidebarCollapsed={recolhido} />}
        {isAtleta && <Section label="Portal do Atleta" items={NAV_ATLETA} onNavClick={handleNavClick} sidebarCollapsed={recolhido} />}
        <Section
          label={
            isHolding ? "Holding pública" : isDino ? "Dino público" : isStallone ? "Stallone público" : isRestaurante ? "Palatare público" : isConcreto ? "Usina pública" : "Site Público"
          }
          items={
            isHolding ? NAV_HOLDING_PUBLIC : isDino ? NAV_DINO_PUBLIC : isStallone ? NAV_STALLONE_PUBLIC : isRestaurante ? NAV_PALATARE_PUBLIC : isConcreto ? NAV_CONCRETO_PUBLIC : NAV_PUBLIC
          }
          onNavClick={handleNavClick}
          sidebarCollapsed={recolhido}
        />

        {/* Bottom user area */}
        <div style={{ marginTop: 'auto', padding: recolhido ? '10px 8px' : '12px 16px', borderTop: '1px solid var(--line)' }}>
          {user ? (
            <>
              {!recolhido && <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cream)' }}>
                  {user.nome || user.user}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, textTransform: 'uppercase' }}>
                  {user.role}
                </div>
              </div>}
              {isAtleta && !recolhido && (
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
                title={recolhido ? 'Sair' : undefined}
              >
                {recolhido ? '↪' : 'Sair'}
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
