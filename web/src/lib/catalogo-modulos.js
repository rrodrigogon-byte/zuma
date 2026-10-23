// Catálogo único dos módulos do backoffice Kytto.
//
// É a fonte da seção "Backoffice da plataforma" do menu: o administrador da plataforma vê aqui todos
// os módulos, de qualquer marca, com o estado de cada um na empresa ativa. Os menus das marcas
// (clube, Dino, Stallone) continuam com nomes e ordem próprios, mas a disponibilidade de cada item
// vem das mesmas regras (disponibilidade.js e o contrato de módulos da empresa).
//
// `contrato` é a chave do módulo no contrato da empresa (tela Empresas e Módulos).
import { ehGlobalDoEvento, moduloEmImplantacao } from './disponibilidade.js'

export const AREAS = [
  'Visão geral',
  'Financeiro',
  'Compras e estoque',
  'Fiscal',
  'Vendas e operação',
  'Clientes e WhatsApp',
  'Clube e academia',
  'Barbearia',
  'Loja online',
  'Verticais de varejo',
  'Evento Agro Open',
  'Plataforma',
]

// Em que onda do plano cada tela em implantação entra e o que falta.
export const PLANO_IMPLANTACAO = {
  '/admin/supermercado': { onda: 5, falta: 'promoções, etiquetas, lotes e transferências por unidade' },
  '/admin/varejo': { onda: 5, falta: 'orçamento, pedido e entrega; entra quando houver empresa de varejo' },
  '/admin/loja-moda': { onda: 5, falta: 'grade, condicional, crediário e vale; entra quando houver loja de moda' },
  '/admin/oficina': { onda: 5, falta: 'ordem de serviço com aprovação por WhatsApp; entra quando houver oficina' },
  '/admin/agropecuaria': { onda: 5, falta: 'pets, receituário e fracionamento; entra quando houver loja agro' },
}

const M = (to, label, icon, area, contrato = null, extra = {}) => ({ to, label, icon, area, contrato, ...extra })

export const CATALOGO = [
  M('/admin', 'Painel', '📊', 'Visão geral', null, { end: true }),
  M('/admin/bi', 'BI e indicadores', '📉', 'Visão geral', 'bi'),
  M('/admin/relatorios-operacionais', 'Relatórios operacionais', '📄', 'Visão geral', 'relatorios'),

  M('/admin/financeiro', 'Financeiro', '💰', 'Financeiro', 'financeiro'),
  M('/admin/contas-receber', 'Contas a receber', '📥', 'Financeiro', 'financeiro'),
  M('/admin/fechamento-diario', 'Fechamento do dia', '🧮', 'Financeiro', 'financeiro'),
  M('/admin/cupons', 'Cupons', '🏷️', 'Financeiro', 'pdv'),

  M('/admin/compras', 'Compras e fornecedores', '🚚', 'Compras e estoque', 'compras'),
  M('/admin/estoque', 'Estoque', '📦', 'Compras e estoque', 'estoque'),
  M('/admin/perdas-inventario', 'Perdas e inventário', '🧾', 'Compras e estoque', 'estoque'),
  M('/admin/fichas-tecnicas', 'Fichas técnicas', '🧪', 'Compras e estoque', 'estoque'),
  M('/admin/cadastros-mestres', 'Fornecedores e funcionários', '🗂️', 'Compras e estoque', 'cadastros'),

  M('/admin/notas', 'Notas fiscais', '🧾', 'Fiscal', 'fiscal'),
  M('/admin/fiscal/config', 'Configuração fiscal', '⚙️', 'Fiscal', 'fiscal'),
  M('/admin/fiscal/classificacao', 'Classificação fiscal', '🏷️', 'Fiscal', 'fiscal'),

  M('/admin/pdv', 'PDV', '🛒', 'Vendas e operação', 'pdv'),
  M('/admin/mesas', 'Mesas', '🪑', 'Vendas e operação', 'mesas'),
  M('/admin/cardapio', 'Cardápio', '🍽️', 'Vendas e operação', 'cardapio'),
  M('/admin/modificadores-combos', 'Adicionais e combos', '➕', 'Vendas e operação', 'cardapio'),
  M('/admin/kds', 'Cozinha (KDS)', '🖨️', 'Vendas e operação', 'kds'),
  M('/admin/reservas', 'Reservas de mesa e fila', '📅', 'Vendas e operação', 'mesas'),
  M('/admin/pdv-offline', 'PDV offline e periféricos', '🔌', 'Vendas e operação', 'pdv'),
  M('/admin/lojas', 'Unidades', '🏬', 'Vendas e operação', 'loja'),

  M('/admin/clientes-360', 'Clientes 360', '👥', 'Clientes e WhatsApp', 'clientes'),
  M('/admin/clientes', 'Clientes e contas', '🧑‍💼', 'Clientes e WhatsApp', 'clientes'),
  M('/admin/crm', 'CRM', '📇', 'Clientes e WhatsApp', 'crm'),
  M('/admin/omnichannel', 'Canais, delivery e fidelidade', '🔁', 'Clientes e WhatsApp', 'delivery'),
  M('/admin/whatsapp-central', 'Central de conexões', '🧭', 'Clientes e WhatsApp'),
  M('/admin/whatsapp', 'WhatsApp', '💬', 'Clientes e WhatsApp'),
  M('/admin/whatsapp-gestao', 'WhatsApp gestão', '▣', 'Clientes e WhatsApp'),
  M('/admin/whatsapp-lancamentos', 'WhatsApp lançamentos', '🧾', 'Clientes e WhatsApp'),
  M('/admin/cerebro-ia', 'Cérebro do atendente', '🧠', 'Clientes e WhatsApp'),

  M('/admin/clube/recepcao', 'Recepção e catraca', '🚪', 'Clube e academia', 'clube'),
  M('/admin/clube/alunos', 'Sócios e alunos', '🎾', 'Clube e academia', 'clube'),
  M('/admin/clube/aulas', 'Aulas', '🏋️', 'Clube e academia', 'clube'),
  M('/admin/clube/quadras', 'Reservas de quadras', '📅', 'Clube e academia', 'clube'),
  M('/admin/clube/contratos', 'Contratos digitais', '✍️', 'Clube e academia', 'clube'),
  M('/admin/clube/cobrancas', 'Cobranças Pix', '💠', 'Clube e academia', 'clube'),
  M('/admin/clube/retencao', 'Retenção (IA)', '🤝', 'Clube e academia', 'clube'),
  M('/admin/clube/parceiros', 'Wellhub e TotalPass', '🔗', 'Clube e academia', 'clube'),
  M('/admin/clube/ajustes', 'Quadras, catracas e planos', '⚙️', 'Clube e academia', 'clube'),

  M('/admin/barbearia-erp', 'Barbearia', '✂️', 'Barbearia', 'barbearia'),

  M('/admin/ecommerce', 'Loja online', '🛍️', 'Loja online', 'ecommerce'),
  M('/admin/loja', 'Loja do evento', '🎽', 'Loja online', 'loja'),

  M('/admin/erp', 'Hub ERP', '🧩', 'Verticais de varejo', 'erp'),
  M('/admin/supermercado', 'Supermercado', '🛒', 'Verticais de varejo', 'supermercado'),
  M('/admin/varejo', 'Varejo geral', '🏪', 'Verticais de varejo', 'varejo'),
  M('/admin/loja-moda', 'Loja de moda', '👗', 'Verticais de varejo', 'loja_moda'),
  M('/admin/oficina', 'Oficina mecânica', '🔧', 'Verticais de varejo', 'oficina'),
  M('/admin/agropecuaria', 'Agropecuária e pet', '🐾', 'Verticais de varejo', 'agropecuaria'),

  M('/admin/torneios', 'Torneios', '🎾', 'Evento Agro Open', 'torneios'),
  M('/admin/inscricoes', 'Inscrições', '📋', 'Evento Agro Open', 'torneios'),
  M('/admin/agenda', 'Agenda / OoP', '📅', 'Evento Agro Open', 'torneios'),
  M('/admin/sumula', 'Súmula', '📝', 'Evento Agro Open', 'torneios'),
  M('/admin/quadras', 'Quadras do torneio', '🏟️', 'Evento Agro Open', 'quadras'),
  M('/admin/ranking', 'Ranking', '🏆', 'Evento Agro Open', 'torneios'),
  M('/admin/pontos', 'Pontos e Elo', '⭐', 'Evento Agro Open', 'pontos'),
  M('/admin/ligas', 'Ligas de ranking', '🏅', 'Evento Agro Open', 'ligas'),
  M('/admin/pagamentos', 'Pagamentos do evento', '💳', 'Evento Agro Open', 'pagamentos'),
  M('/admin/socios', 'Sócios (cadastro antigo)', '🪪', 'Evento Agro Open', 'socios'),
  M('/admin/mensalidades', 'Mensalidades (antigo)', '📆', 'Evento Agro Open', 'socios'),
  M('/admin/noticias', 'Notícias', '📰', 'Evento Agro Open', 'conteudo'),
  M('/admin/contatos', 'Contatos', '📞', 'Evento Agro Open', 'conteudo'),

  M('/admin/plataforma', 'Empresas e módulos', '🏢', 'Plataforma'),
  M('/admin/usuarios', 'Usuários e acessos', '👤', 'Plataforma', 'usuarios'),
  M('/admin/auditoria', 'Auditoria', '🛡️', 'Plataforma'),
  M('/admin/configuracoes', 'Configurações', '⚙️', 'Plataforma'),
]

export const ESTADOS = {
  no_ar: { rotulo: 'no ar', descricao: 'Funcionando nesta empresa' },
  em_implantacao: { rotulo: 'em implantação', descricao: 'Tela pronta, backend ainda não está no ar' },
  nao_contratado: { rotulo: 'não contratado', descricao: 'No ar, mas fora do contrato desta empresa' },
  evento: { rotulo: 'evento', descricao: 'Usa os dados globais do evento Agro Open, sem separação por empresa' },
}

const caminho = (to) => String(to || '').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'

export function modulosContratados(empresa) {
  return Array.isArray(empresa?.modulos) ? empresa.modulos.map((modulo) => String(modulo).toLowerCase()) : null
}

/** Estado de um item do catálogo para a empresa ativa. */
export function estadoDoModulo(item, empresa = null) {
  if (moduloEmImplantacao(item.to)) return 'em_implantacao'
  if (ehGlobalDoEvento(item.to)) return 'evento'
  const contratados = modulosContratados(empresa)
  if (item.contrato && contratados && !contratados.includes(String(item.contrato).toLowerCase())) return 'nao_contratado'
  return 'no_ar'
}

export function planoDaRota(to) {
  return PLANO_IMPLANTACAO[caminho(to)] || null
}

/** Catálogo agrupado por área, com o estado de cada módulo na empresa ativa. */
export function catalogoPorArea(empresa = null) {
  return AREAS.map((area) => ({
    area,
    itens: CATALOGO.filter((item) => item.area === area).map((item) => ({ ...item, estado: estadoDoModulo(item, empresa) })),
  })).filter((grupo) => grupo.itens.length > 0)
}

export function contagemPorEstado(empresa = null) {
  return CATALOGO.reduce((acc, item) => {
    const estado = estadoDoModulo(item, empresa)
    acc[estado] = (acc[estado] || 0) + 1
    return acc
  }, {})
}
