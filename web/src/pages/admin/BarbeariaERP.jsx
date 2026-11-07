import BarbeariaNovoAgendamentoModal from "./BarbeariaNovoAgendamentoModal";
import BarbeariaComandasAbertas from "./BarbeariaComandasAbertas";
import BarbeariaAtendimentoBoard from "./BarbeariaAtendimentoBoard";
import BarbeariaPlanosAssinaturasPanel from "./BarbeariaPlanosAssinaturasPanel";
import BarbeariaHistoricoCliente from "./BarbeariaHistoricoCliente";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, fmtDate, fmtDateOnly, fmtR } from "../../lib/api";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../lib/auth";
import { ABAS_DO_OPERADOR } from "../../lib/perfis-menu";
import { isDinoBrandContext } from "../../lib/brand";
import { whatsappIntegrationStatus } from "../../lib/whatsapp-integration-status";
import BarbeariaAgendaBoard, {
  agendaBoardColumns,
} from "./BarbeariaAgendaBoard";
import BarbeariaAgendaPeriodo from "./BarbeariaAgendaPeriodo";
import AgendaProfissionais, {
  profissionaisSelecionados,
} from "./AgendaProfissionais";
import { lerAgenda, erroAgenda } from "../../lib/agenda-read";
import { hojeAgenda } from "../../lib/barbearia-calendar";
import BarbeariaOperacaoPanel from "./BarbeariaOperacaoPanel";
import BarbeariaCaixaPrevia from "./BarbeariaCaixaPrevia";
function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
import { NfseComandaAcoes, NfseConfigCard } from "./BarbeariaNfsePanel";
import DinoComprasEstoqueHub from "./dino/DinoComprasEstoqueHub";
import { ComprasPanel, CurvaAbcPanel } from "./dino/ComprasPanels";
import { RepassesPanel, ReguaClubePanel } from "./dino/RepassesPanel";

// Lazy loading dos módulos analíticos e relatórios para acelerar o carregamento inicial da Barbearia
const MetasComissoesPanel = lazy(() => import("./dino/MetasComissoesPanel"));
const DinoCarteiraClientesPanel = lazy(
  () => import("./dino/DinoCarteiraClientesPanel"),
);
const DinoRecuperacaoAvecPanel = lazy(
  () => import("./dino/DinoRecuperacaoAvecPanel"),
);
const FiscalPanel = lazy(() => import("./fiscal/Fiscal"));
const DinoBusinessDashboard = lazy(() => import("./DinoBusinessDashboard"));
const DinoDashboardKytto = lazy(() => import("./dino/DinoDashboardKytto?v=2"));
const DinoCampaignsPanel = lazy(() => import("./DinoCampaignsPanel"));
const DinoCRMPreditivo = lazy(() => import("./dino/DinoCRMPreditivo"));
const DinoPrecoDinamico = lazy(() => import("./dino/DinoPrecoDinamico"));
const DinoSplitPagamento = lazy(() => import("./dino/DinoSplitPagamento"));
const DinoEquipeDesempenho = lazy(() => import("./DinoEquipeDesempenho"));
const BIBarbearia = lazy(() => import("./dino/BIBarbearia"));
const ProjecaoFaturamentoPanel = lazy(
  () => import("./dino/ProjecaoFaturamentoPanel"),
);
const DinoMetasRoletaPanel = lazy(() => import("./dino/DinoMetasRoletaPanel"));
import ComandaNova, {
  AdicionarItensComanda,
  BuscaCliente,
} from "./dino/ComandaNova";
import {
  abrirHistoricoEmNovaGuia,
  refHistoricoCliente,
  urlHistoricoCliente,
} from "./dino/historico-cliente";
import ClienteRelacionamento, {
  RELACIONAMENTO_VAZIO,
  relacionamentoDoCliente,
  relacionamentoParaApi,
} from "./dino/ClienteRelacionamento";
import {
  CanaisPanel,
  ClubeSaudePanel,
  CobrancasPanel,
  IndicacoesPanel,
  ListaEsperaPanel,
  NpsPanel,
  OcupacaoMetasPanel,
  ReceitaIaPanel,
  ResumoDiarioPanel,
  RetornosPanel,
  UnidadesPanel,
  ValesPanel,
} from "./dino/CaptacaoPanels";

const TABS = [
  ["Visão geral", "Resumo da operação"],
  ["Agenda", "Reservas e horários"],
  ["Atendimento", "Fila e status"],
  ["Caixa e fechamento", "Abertura, movimentos e encerramento"],
  ["Prévia taxas e materiais", "Simulação somente leitura antes de gravar"],
  [
    "Carteira por barbeiro",
    "Base de clientes exclusiva por profissional (Dino, Nat, Bruno, etc.)",
  ],
  [
    "Recuperação de clientes (Avec)",
    "Resgate estratégico de clientes inativos, coorte de reajuste e modelos Essencial/Premium",
  ],
  ["Clientes", "CRM da unidade"],
  ["Profissionais", "Equipe e repasse"],
  ["Serviços", "Catálogo de serviços"],
  ["Comissões", "Apuração indicativa"],
  ["Fila e bloqueios", "Espera e indisponibilidades"],
  ["Planos e assinaturas", "Pacotes sem cobrança automática"],
  ["Fidelidade", "Pontos do CRM"],
  ["Estoque de revenda", "Produtos e movimentos manuais"],
  [
    "Metas e comissões",
    "Controle individual de metas, bonificações e relatórios por profissional",
  ],
  [
    "Notas fiscais",
    "Central fiscal completa (NFC-e, NF-e, NFS-e e contingência)",
  ],
  [
    "Desempenho da equipe",
    "Resultado, comissão, horários e melhoria por profissional",
  ],
  ["Vendas de revenda", "Venda, pagamento e baixa auditáveis"],
  ["Relatórios", "Indicadores operacionais"],
  ["Integrações", "WhatsApp e assistente IA"],
  ["Configuração", "Horários e políticas"],
  ["Retorno previsto", "Quem está para voltar e quem atrasou"],
  ["Lista de espera", "Pedidos de horário e avisos de vaga"],
  ["Indicações", "Indique um amigo com recompensa"],
  ["Saúde do clube", "Uso, margem e candidatos ao clube"],
  ["Metas & Roleta", "Metas diárias, semanais de produtos e roleta de prêmios"],
  ["Projeção inteligente", "Cenários, tendências e ações para faturamento"],
  ["Painel de gestão", "Painel executivo de resultados"],
  ["Ocupação e metas", "Ocupação da agenda e metas por barbeiro"],
  ["Avaliações (NPS)", "Notas e indicadores no próprio sistema"],
  ["Origem dos clientes", "Agendamentos e clientes novos por canal"],
  ["Cobranças e cashback", "Sinal, mensalidade do clube e cashback"],
  ["Receita da IA", "Receita atribuída à IA e à captação"],
  ["Resumo diário", "Fechamento do dia no WhatsApp do dono"],
  ["Vale-presente", "Venda, consulta e saldo dos vales"],
  ["Unidades", "Comparativo entre unidades"],
  ["Compras e fornecedores", "NF-e de entrada, pedidos e reposição"],
  ["Perdas e inventário", "Baixas manuais, contagem cíclica e acuracidade"],
  ["Fichas técnicas", "Composição de insumos e custo por serviço"],
  ["Fornecedores e funcionários", "Cadastros mestres da operação"],
  ["Curva ABC", "Margem, giro e itens parados"],
  ["Extrato e repasses", "Extrato, vales, recibos e pote dos planos"],
];

const AREAS = [
  {
    id: "operacao",
    label: "Operação",
    short: "Hoje, agenda, atendimento e caixa",
    tabs: [
      "Visão geral",
      "Agenda",
      "Atendimento",
      "Caixa e fechamento",
      "Prévia taxas e materiais",
      "Fila e bloqueios",
    ],
  },
  {
    id: "relacionamento",
    label: "Relacionamento",
    short: "Clientes, retorno e indicação",
    tabs: [
      "Carteira por barbeiro",
      "Recuperação de clientes (Avec)",
      "Clientes",
      "Retorno previsto",
      "Lista de espera",
      "Indicações",
      "Avaliações (NPS)",
      "Origem dos clientes",
      "Fidelidade",
    ],
  },
  {
    id: "catalogo",
    label: "Catálogo e equipe",
    short: "Serviços, planos e revenda",
    tabs: [
      "Profissionais",
      "Serviços",
      "Planos e assinaturas",
      "Saúde do clube",
      "Estoque de revenda",
      "Compras e fornecedores",
      "Perdas e inventário",
      "Fichas técnicas",
      "Fornecedores e funcionários",
      "Curva ABC",
      "Vendas de revenda",
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    short: "Comissões, metas e regras",
    tabs: [
      "Recuperação de clientes (Avec)",
      "Metas & Roleta",
      "Metas e comissões",
      "Notas fiscais",
      "Desempenho da equipe",
      "Comissões",
      "Extrato e repasses",
      "Projeção inteligente",
      "Painel de gestão",
      "Ocupação e metas",
      "Cobranças e cashback",
      "Vale-presente",
      "Receita da IA",
      "Resumo diário",
      "Unidades",
      "Relatórios",
      "Configuração",
    ],
  },
  {
    id: "integracoes",
    label: "Integrações",
    short: "WhatsApp e IA controlados",
    tabs: ["Integrações"],
  },
];

const TAB_AREA = Object.fromEntries(
  AREAS.flatMap((area) => area.tabs.map((tab) => [tab, area.id])),
);
const TAB_DESCRICAO = Object.fromEntries(TABS);

const STATUS = {
  agendado: { label: "Agendado", color: "#8b5cf6" },
  confirmado: { label: "Confirmado", color: "#8b5cf6" },
  aguardando_confirmacao: { label: "Aguardando confirmação", color: "#e0b24b" },
  cancelado_falta_confirmacao: {
    label: "Cancelado por falta de confirmação",
    color: "#e05c5c",
  },
  em_atendimento: { label: "Em atendimento", color: "#8b5cf6" },
  concluido: { label: "Concluído", color: "#14b87a" },
  cancelado: { label: "Cancelado", color: "#e05c5c" },
  nao_compareceu: { label: "Não compareceu", color: "#888" },
  aguardando: { label: "Aguardando", color: "#8b5cf6" },
  chamado: { label: "Chamado", color: "#f59e0b" },
  atendido: { label: "Atendido", color: "#14b87a" },
  ausente: { label: "Ausente", color: "#888" },
  configurado: { label: "Configurado", color: "#14b87a" },
  pendente_configuracao: { label: "Configuração pendente", color: "#f59e0b" },
  nao_verificado: { label: "Conexão não verificada", color: "#f59e0b" },
  pendente_ativacao: { label: "Pendente de ativação", color: "#f59e0b" },
  pausada: { label: "Pausada", color: "#888" },
  expirada: { label: "Expirada", color: "#e05c5c" },
  aberta: { label: "Aberta", color: "#8b5cf6" },
  aguardando_pagamento: { label: "Aguardando pagamento", color: "#f59e0b" },
  parcialmente_paga: { label: "Parcialmente paga", color: "#f59e0b" },
  em_conta: { label: "Em conta", color: "#8b5cf6" },
  paga: { label: "Paga", color: "#14b87a" },
  cancelada: { label: "Cancelada", color: "#e05c5c" },
  operacional: { label: "Operacional", color: "#14b87a" },
  configuracao_pendente: { label: "Configuração pendente", color: "#f59e0b" },
  aguardando_provisionamento: {
    label: "Aguardando provisionamento",
    color: "#4a9eff",
  },
  sem_membership: { label: "Tenant sem vínculo", color: "#f59e0b" },
  sem_permissao: { label: "Sem permissão Commerce", color: "#f59e0b" },
  temporariamente_indisponivel: {
    label: "Temporariamente indisponível",
    color: "#e05c5c",
  },
  indisponivel: { label: "Indisponível", color: "#e05c5c" },
  desativado: { label: "Desativado", color: "#888" },
};

const TRANSICOES = {
  agendado: ["confirmado", "em_atendimento", "cancelado", "nao_compareceu"],
  confirmado: ["agendado", "em_atendimento", "cancelado", "nao_compareceu"],
  em_atendimento: [
    "confirmado",
    "agendado",
    "concluido",
    "cancelado",
    "nao_compareceu",
  ],
  concluido: ["em_atendimento"],
  cancelado: ["agendado", "confirmado"],
  nao_compareceu: ["agendado", "confirmado"],
};

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function hojeLocal() {
  return hojeAgenda();
}

function moeda(value) {
  return fmtR(Number(value || 0));
}

function avisoPesquisa(estado) {
  if (Number(estado?.queued) > 0)
    return {
      texto:
        "Pesquisa Dino programada para WhatsApp; o envio ainda não foi confirmado.",
      tipo: "success",
    };
  if (estado?.skipped === false)
    return {
      texto: "Pesquisa já estava na fila; o envio ainda não foi confirmado.",
      tipo: "success",
    };
  const motivo =
    {
      already_reviewed: "este atendimento já foi avaliado",
      service_consent_required:
        "falta consentimento de atendimento por WhatsApp",
      customer_not_registered: "falta cliente cadastrado no atendimento",
      customer_not_found: "cliente vinculado não foi encontrado",
      phone_unavailable: "telefone do cliente indisponível",
      appointment_phone_mismatch:
        "o telefone do cadastro difere do telefone da reserva",
      review_outside_window:
        "data do atendimento fora do prazo da pesquisa (até 30 dias)",
      whatsapp_channel_inactive: "o canal WhatsApp da unidade não está ativo",
      review_link_unavailable:
        "link público de pesquisa não está configurado para esta empresa",
      commerce_scope_unavailable: "empresa ou unidade sem escopo válido",
      tenant_scope_mismatch: "empresa do atendimento não confere",
      store_scope_mismatch: "a unidade do agendamento não confere",
      queue_unavailable: "fila temporariamente indisponível",
    }[estado?.reason] || "confira o estado da fila e a configuração do canal";
  return {
    texto: `Pesquisa não programada: ${motivo}. Não presuma que a mensagem foi enviada.`,
    tipo: "error",
  };
}

function horario(value) {
  if (!value) return "—";
  const data = new Date(value);
  return Number.isNaN(data.valueOf())
    ? String(value)
    : data.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Cuiaba",
      });
}

function iniciais(nome) {
  return String(nome || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item[0])
    .join("")
    .toUpperCase();
}

function statusVisualAgendamento(agendamento = {}, automaticoAtivo = true) {
  if (
    agendamento.motivoCancelamento === "falta_confirmacao" ||
    agendamento.confirmacaoAutomatica?.status === "cancelado_falta_confirmacao"
  )
    return "cancelado_falta_confirmacao";
  if (
    agendamento.status === "confirmado" ||
    agendamento.confirmacaoAutomatica?.status === "confirmado"
  )
    return "confirmado";
  if (
    automaticoAtivo &&
    agendamento.status === "agendado" &&
    agendamento.confirmacaoAutomatica?.ativa === true &&
    ["aguardando", "primeira_enviada", "segunda_enviada"].includes(
      agendamento.confirmacaoAutomatica.status,
    )
  )
    return "aguardando_confirmacao";
  return agendamento.status || "";
}

function Badge({ status }) {
  const item = STATUS[status] || {
    label: status || "Sem status",
    color: "#888",
  };
  return (
    <span
      style={{
        background: `${item.color}20`,
        color: item.color,
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {item.label}
    </span>
  );
}

function Kpi({ label, value, note, color = "var(--accent)" }) {
  return (
    <Card style={{ padding: 18, minHeight: 112 }}>
      <div
        style={{
          color: "var(--muted)",
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: ".04em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 28,
          lineHeight: 1,
          fontWeight: 800,
          color,
        }}
      >
        {value}
      </div>
      {note && (
        <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>
          {note}
        </div>
      )}
    </Card>
  );
}

function Modal({ title, children, onClose, wide = false, xl = false, zIndex = 1000 }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="barbearia-modal-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      tabIndex={-1}
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        background: "rgba(0,0,0,.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "var(--bg)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: xl ? 1120 : wide ? 760 : 560,
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 22px 80px rgba(0,0,0,.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 22,
          }}
        >
          <h2 id="barbearia-modal-title" style={{ margin: 0, fontSize: 20 }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={styles.iconButton}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, full = false, hint }) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        gridColumn: full ? "1 / -1" : undefined,
      }}
    >
      <span style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700 }}>
        {label}
      </span>
      {children}
      {hint && (
        <small style={{ color: "var(--muted)", fontSize: 11 }}>{hint}</small>
      )}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 9,
  border: "1px solid var(--line)",
  background: "var(--card)",
  color: "var(--fg)",
  font: "inherit",
};

// Mostra a data de nascimento como DD/MM/AAAA (ou DD/MM quando o ano não foi informado).
function nascimentoParaCampo(cliente) {
  if (cliente?.dataNascimento) {
    const [a, m, d] = cliente.dataNascimento.split("-");
    return `${d}/${m}/${a}`;
  }
  if (cliente?.aniversario) {
    const [m, d] = cliente.aniversario.split("-");
    return `${d}/${m}`;
  }
  return "";
}

// Preço como o cliente vê: valor fixo, "a partir de" ou "sob consulta".
function rotuloPreco(servico) {
  if (servico?.tipoPreco === "sob_consulta") return "Sob consulta";
  const valor = Number(servico?.preco || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  return servico?.tipoPreco === "a_partir_de" ? `A partir de ${valor}` : valor;
}

// Abas que não dependem da visão geral da barbearia (cada uma busca seus próprios dados).
const TABS_AUTONOMAS = new Set([
  "Painel de gestão",
  "Desempenho da equipe",
  "Retorno previsto",
  "Lista de espera",
  "Saúde do clube",
  "Curva ABC",
  "Metas & Roleta",
  "Projeção inteligente",
  "Ocupação e metas",
  "Avaliações (NPS)",
  "Origem dos clientes",
  "Cobranças e cashback",
  "Receita da IA",
  "Resumo diário",
  "Vale-presente",
  "Metas e comissões",
  "Notas fiscais",
]);

export default function BarbeariaERP() {
  const { toast } = useToast();
  const { user, empresaAtiva, lojaAtiva, lojasAcessiveis, perfil } = useAuth();
  // operador: só as abas da operação do dia (comissões, metas e indicadores ficam com a administração)
  const operador = perfil === "operador";
  const areasVisiveis = operador
    ? AREAS.map((area) => ({
        ...area,
        tabs: area.tabs.filter((nome) => ABAS_DO_OPERADOR.has(nome)),
      })).filter((area) => area.tabs.length)
    : AREAS;
  const podeAlterarConfirmacaoAutomatica = [
    "admin",
    "organizador",
    "gerente",
  ].includes(String(user?.role || "").toLowerCase());
  const isDinoBrand = isDinoBrandContext(
    empresaAtiva,
    user?.empresaAtiva,
    user?.empresa,
    user?.tenant,
  );
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // apelidos de links antigos/externos (ex.: ?tab=Fiscal) para o nome real da aba
  const requestedTab = { Fiscal: "Notas fiscais", fiscal: "Notas fiscais" }[searchParams.get("tab")] || searchParams.get("tab");
  const requestedArea = searchParams.get("area");
  const validRequestedTab =
    TABS.some(([name]) => name === requestedTab) &&
    (!operador || ABAS_DO_OPERADOR.has(requestedTab))
      ? requestedTab
      : null;
  const validRequestedArea =
    areasVisiveis.find((area) => area.id === requestedArea) || null;
  const tab =
    validRequestedTab ||
    validRequestedArea?.tabs[0] ||
    (operador ? "Agenda" : "Visão geral");

  function navegarParaTab(nome) {
    setBusca("");
    const area = TAB_AREA[nome] || "operacao";
    if (searchParams.get("area") === area && searchParams.get("tab") === nome)
      return;
    setSearchParams({ area, tab: nome }, { replace: true });
  }
  const [dataSelecionada, setDataSelecionada] = useState(hojeLocal);
  const [statusFiltro, setStatusFiltro] = useState("");
  const [profissionalFiltro, setProfissionalFiltro] = useState("");
  const [agendaModo, setAgendaModo] = useState("timeline");
  const [busca, setBusca] = useState("");
  const [buscaGlobal, setBuscaGlobal] = useState("");
  const [filtroClientes, setFiltroClientes] = useState("todos");
  const [subAbaClientes, setSubAbaClientes] = useState("carteira");
  const [dashboard, setDashboard] = useState(null);
  const [agendamentos, setAgendamentos] = useState([]);
  const [agendaRevisao, setAgendaRevisao] = useState(0);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const pedidoOverview = useRef(0);
  const [profissionais, setProfissionais] = useState([]);
  const [profissionalLinkModal, setProfissionalLinkModal] = useState(null);
  const [servicos, setServicos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [configuracao, setConfiguracao] = useState(null);
  const [configuracaoUnidade, setConfiguracaoUnidade] = useState(null);
  const [fila, setFila] = useState([]);
  const [bloqueios, setBloqueios] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [assinaturas, setAssinaturas] = useState([]);
  const [fidelidade, setFidelidade] = useState({
    regra: {},
    membros: [],
    movimentos: [],
  });
  const [formFidelidade, setFormFidelidade] = useState({
    pontosPorReal: 1,
    valorPonto: 0.01,
    ativa: true,
  });
  const [clienteFidelidadeId, setClienteFidelidadeId] = useState("");
  const [formCreditoFidelidade, setFormCreditoFidelidade] = useState({
    valor: "",
  });
  const [relatorio, setRelatorio] = useState(null);
  const [comissoes, setComissoes] = useState(null);
  const [integracoes, setIntegracoes] = useState(null);
  const whatsappAi =
    integracoes?.whatsapp?.ai || integracoes?.ia?.whatsapp || {};
  const scopeKey = `${empresaAtiva?.id || ""}:${lojaAtiva?.id || ""}`;
  const activeScopeRef = useRef(scopeKey);
  activeScopeRef.current = scopeKey;
  const activeTabRef = useRef(tab);
  activeTabRef.current = tab;
  const [notificacoesAgenda, setNotificacoesAgenda] = useState({
    queued: 0,
    sent: 0,
    failed: 0,
    canceled: 0,
  });
  const [assistenteResposta, setAssistenteResposta] = useState(null);
  const [assistentePergunta, setAssistentePergunta] = useState("");
  const [consultandoAssistente, setConsultandoAssistente] = useState(false);
  const [produtosRevenda, setProdutosRevenda] = useState([]);
  const [vendasRevenda, setVendasRevenda] = useState([]);
  const [comandas, setComandas] = useState([]);
  const [documentosFiscais, setDocumentosFiscais] = useState([]);
  const [resumoComandas, setResumoComandas] = useState(null);
  const [operacao, setOperacao] = useState(null);
  const [relacionamento, setRelacionamento] = useState(null);
  const [formComanda, setFormComanda] = useState({
    clienteId: "",
    clienteNome: "",
    clienteTelefone: "",
    profissionalId: "",
    agendamentoId: "",
    itemTipo: "servico",
    itemId: "",
    quantidade: 1,
    gorjeta: "",
    desconto: "",
    descontoMotivo: "",
    observacoes: "",
  });
  const [formPagamentoComanda, setFormPagamentoComanda] = useState({
    meioPagamento: "pix",
    valor: "",
    clienteId: "",
    caixaId: "",
  });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [modal, setModal] = useState(null);
  const [modalItemValor, setModalItemValor] = useState(null);
  const [modalReabrir, setModalReabrir] = useState(null);
  const [fechamentoDetalhado, setFechamentoDetalhado] = useState(null);

  // Id do cadastro em edição nos modais de serviço, plano e produto (null = novo cadastro).
  const [edicaoId, setEdicaoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [nfceConfirmando, setNfceConfirmando] = useState(null);
  const [formProf, setFormProf] = useState({
    nome: "",
    telefone: "",
    email: "",
    especialidade: "Barbeiro",
    tipo: "parceiro",
    percentualComissao: 50,
    percentualComissaoProduto: 30,
    horarioInicio: "08:00",
    horarioFim: "18:00",
    diasTrabalho: [1, 2, 3, 4, 5, 6],
  });
  const [intervaloServicoDrafts, setIntervaloServicoDrafts] = useState({});
  const [intervaloProdutoDrafts, setIntervaloProdutoDrafts] = useState({});
  const [formServico, setFormServico] = useState({
    nome: "",
    descricao: "",
    categoria: "Geral",
    grupoServico: "convencionais",
    duracaoMinutos: 30,
    preco: "",
    tipoPreco: "fixo",
    intervaloRecomendacaoDias: 0,
    permiteAgendamentoOnline: true,
    consumoInterno: [],
  });
  const [formCliente, setFormCliente] = useState({
    nome: "",
    telefone: "",
    email: "",
    dataNascimento: "",
    limiteCreditoMensal: 500,
    diasVencimento: 30,
    observacao: "",
  });
  const [formAgenda, setFormAgenda] = useState({
    clienteId: "",
    clienteNome: "",
    clienteTelefone: "",
    profissionalId: "",
    servicoId: "",
    data: hojeLocal(),
    hora: "10:00",
    observacoes: "",
  });
  const [formRecebimento, setFormRecebimento] = useState({
    meioPagamento: "pix",
    usarCashback: "",
    valeCodigo: "",
    valeValor: "",
  });
  const [saldoCashbackCliente, setSaldoCashbackCliente] = useState(null);
  const [conferindoSinal, setConferindoSinal] = useState(false);
  const [formConfig, setFormConfig] = useState({});
  const [formFila, setFormFila] = useState({
    clienteId: "",
    clienteNome: "",
    clienteTelefone: "",
    servicoId: "",
    preferenciaProfissionalId: "",
    previsaoMinutos: 30,
    observacoes: "",
  });
  const [formFilaChamada, setFormFilaChamada] = useState({ mesaOuPosicao: "" });
  const [formBloqueio, setFormBloqueio] = useState({
    titulo: "",
    motivo: "",
    dataInicio: "",
    dataFim: "",
    diaTodo: false,
    inicioHora: "08:00",
    fimHora: "20:00",
    profissionalId: "",
    periodo: "apenas_dia",
    dataFimRepeticao: "",
    diasSemana: [1, 2, 3, 4, 5, 6],
  });
  const [filtroBloqueioProf, setFiltroBloqueioProf] = useState("");
  const [grupoServicos, setGrupoServicos] = useState("todos");
  const [formPlano, setFormPlano] = useState({
    nome: "",
    descricao: "",
    ciclo: "mensal",
    regraRenovacao: "aniversario",
    preco: "",
    sessoesIncluidas: 4,
    validadeDias: 30,
    servicosIds: [],
  });
  const pedidoAssinatura = useRef(null);
  const [formAssinatura, setFormAssinatura] = useState({
    clienteId: "",
    clienteNome: "",
    planoId: "",
    regraRenovacao: "aniversario",
    inicio: hojeLocal(),
    observacoes: "",
  });
  const [formProdutoRevenda, setFormProdutoRevenda] = useState({
    nome: "",
    sku: "",
    categoria: "Revenda",
    unidade: "un",
    precoVenda: "",
    custoUnitario: "",
    estoqueAtual: 0,
    estoqueMinimo: 0,
    intervaloRecompraDias: 30,
  });
  const [formMovimentoRevenda, setFormMovimentoRevenda] = useState({
    quantidade: 1,
    observacao: "Movimento manual no módulo Barbearia.",
  });
  const [formVendaRevenda, setFormVendaRevenda] = useState({
    clienteId: "",
    clienteNome: "",
    profissionalId: "",
    observacao: "",
    produtoId: "",
    quantidade: 1,
  });
  const [formPagamentoVendaRevenda, setFormPagamentoVendaRevenda] = useState({
    meioPagamento: "pix",
  });
  const [formWhatsApp, setFormWhatsApp] = useState({
    clienteId: "",
    finalidade: "atendimento",
    telefone: "",
    mensagem: "",
    consentimentoConfirmado: false,
  });
  const [formWhatsappAi, setFormWhatsappAi] = useState({
    instance: "dino",
    displayName: "Atendimento WhatsApp",
    humanized: true,
    captureLeads: true,
    operateStore: true,
    manageAppointments: true,
    sendPromotions: false,
    reminders: true,
    humanHandoff: true,
  });
  const [formWhatsappAiPolicy, setFormWhatsappAiPolicy] = useState({
    personalizationEnabled: false,
    opportunitiesEnabled: false,
    cooldownDays: 30,
    privacyNotice: "",
  });
  const [formWhatsappAiHandoff, setFormWhatsappAiHandoff] = useState({
    notifyEmail: "",
    attendantPhone: "",
    salesPhone: "",
  });
  const [confirmandoHandoff, setConfirmandoHandoff] = useState(false);
  const [formPersona, setFormPersona] = useState({
    ativo: true,
    nome: "T-Rex",
    mensagensCurtas: true,
    figurinhas: true,
    revelarIa: "quando_perguntado",
  });
  const [whatsappAiSessions, setWhatsappAiSessions] = useState([]);
  const [itensVendaRevenda, setItensVendaRevenda] = useState([]);

  const carregar = useCallback(async () => {
    const pedido = ++pedidoOverview.current;
    const isCurrent = () =>
      pedido === pedidoOverview.current && activeScopeRef.current === scopeKey;
    setLoading(true);
    setErro("");
    try {
      const query = new URLSearchParams({ data: dataSelecionada });
      if (statusFiltro) query.set("status", statusFiltro);
      if (profissionalFiltro) query.set("profissionalId", profissionalFiltro);
      const payload = await lerAgenda(
        () => api.get(`/api/admin/barbearia/overview?${query.toString()}`),
        { ativo: isCurrent },
      );
      if (!payload || !isCurrent()) return;
      const aiSessions = await api
        .get("/api/admin/commerce/whatsapp-ai/sessions?limit=20")
        .catch(() => ({ items: [] }));
      if (!isCurrent()) return;
      setDadosCarregados(true);
      setAgendaRevisao((n) => n + 1);
      setWhatsappAiSessions(
        Array.isArray(aiSessions?.items) ? aiSessions.items : [],
      );
      setDashboard(payload?.dashboard || {});
      setAgendamentos(
        Array.isArray(payload?.agendamentos) ? payload.agendamentos : [],
      );
      setProfissionais(
        Array.isArray(payload?.profissionais) ? payload.profissionais : [],
      );
      setServicos(Array.isArray(payload?.servicos) ? payload.servicos : []);
      setClientes(Array.isArray(payload?.clientes) ? payload.clientes : []);
      setConfiguracao(payload?.configuracao || null);
      setFormConfig(payload?.configuracao || {});
      setFila(Array.isArray(payload?.fila) ? payload.fila : []);
      setBloqueios(Array.isArray(payload?.bloqueios) ? payload.bloqueios : []);
      setPlanos(Array.isArray(payload?.planos) ? payload.planos : []);
      setAssinaturas(
        Array.isArray(payload?.assinaturas) ? payload.assinaturas : [],
      );
      setFidelidade(payload?.fidelidade || { regra: {}, membros: [] });
      setFormFidelidade(
        payload?.fidelidade?.regra || {
          pontosPorReal: 1,
          valorPonto: 0.01,
          ativa: true,
        },
      );
      setConfiguracaoUnidade(payload?.configuracaoUnidade || null);
      setRelatorio(payload?.relatorio || null);
      setComissoes(payload?.comissoes || null);
      setProdutosRevenda(
        Array.isArray(payload?.produtos) ? payload.produtos : [],
      );
      setVendasRevenda(Array.isArray(payload?.vendas) ? payload.vendas : []);
      setComandas(Array.isArray(payload?.comandas) ? payload.comandas : []);
      setDocumentosFiscais(
        Array.isArray(payload?.documentosFiscais)
          ? payload.documentosFiscais
          : [],
      );
      setResumoComandas(payload?.resumoComandas || null);
      setOperacao(payload?.operacao || null);
      setRelacionamento(payload?.relacionamento || null);
      if (activeTabRef.current !== "Integrações")
        setIntegracoes(payload?.integracoes || null);
      setNotificacoesAgenda(
        payload?.notificacoesAgenda || {
          queued: 0,
          sent: 0,
          failed: 0,
          canceled: 0,
        },
      );
      const whatsappAi = payload?.integracoes?.whatsapp?.ai;
      if (whatsappAi?.channel)
        setFormWhatsappAi((atual) => ({
          ...atual,
          instance: whatsappAi.channel.instance || atual.instance,
          displayName: whatsappAi.channel.nome || atual.displayName,
          ...(whatsappAi.channel.capabilities || {}),
        }));
      if (whatsappAi?.channel?.persona)
        setFormPersona({
          ativo:
            whatsappAi.channel.persona.ativa === true ||
            whatsappAi.channel.persona.origem === "nenhuma",
          nome: whatsappAi.channel.persona.nome || "T-Rex",
          mensagensCurtas: whatsappAi.channel.persona.mensagensCurtas !== false,
          figurinhas: whatsappAi.channel.persona.figurinhas !== false,
          revelarIa:
            whatsappAi.channel.persona.revelarIa || "quando_perguntado",
        });
      if (whatsappAi?.policy)
        setFormWhatsappAiPolicy({
          personalizationEnabled:
            whatsappAi.policy.personalizationEnabled === true,
          opportunitiesEnabled: whatsappAi.policy.opportunitiesEnabled === true,
          cooldownDays: Number(whatsappAi.policy.cooldownDays || 30),
          privacyNotice: whatsappAi.policy.privacyNotice || "",
        });
      if (whatsappAi?.channel?.handoff)
        setFormWhatsappAiHandoff({
          notifyEmail: whatsappAi.channel.handoff.notifyEmail || "",
          attendantPhone: whatsappAi.channel.handoff.attendantPhone || "",
          salesPhone: whatsappAi.channel.handoff.salesPhone || "",
        });
    } catch (error) {
      if (!isCurrent()) return;
      setDashboard(null);
      setAgendamentos([]);
      setBloqueios([]);
      setErro(erroAgenda(error));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [dataSelecionada, profissionalFiltro, statusFiltro, scopeKey]);

  useLayoutEffect(() => {
    pedidoOverview.current += 1;
    setDadosCarregados(false);
    setDashboard(null);
    setAgendamentos([]);
    setClientes([]);
    setFila([]);
    setIntegracoes(null);
    setWhatsappAiSessions([]);
    setRelacionamento(null);
    setRelatorio(null);
  }, [scopeKey]);

  // Painéis autônomos buscam os próprios dados: a visão geral (pesada) não bloqueia a tela
  // nem disputa o servidor com eles — é adiada e só carrega em segundo plano.
  const tabAutonoma = TABS_AUTONOMAS.has(tab);
  const adiarVisaoGeral = tabAutonoma && !dadosCarregados;
  const visaoGeralPedida = useRef(null);
  useEffect(() => {
    if (visaoGeralPedida.current === carregar) return undefined;
    const pedir = () => {
      visaoGeralPedida.current = carregar;
      carregar();
    };
    if (!adiarVisaoGeral) {
      pedir();
      return undefined;
    }
    const timer = setTimeout(pedir, 3000);
    return () => clearTimeout(timer);
  }, [carregar, adiarVisaoGeral]);

  useEffect(() => {
    if (tab !== "Integrações") return undefined;
    let active = true;
    setIntegracoes(null);
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const status = await api.get("/api/admin/barbearia/integracoes");
        if (active && activeScopeRef.current === scopeKey)
          setIntegracoes(status);
      } catch {
        if (active && activeScopeRef.current === scopeKey)
          setIntegracoes((previous) => ({
            ...previous,
            whatsapp: {
              ...previous?.whatsapp,
              ai: {
                unavailable: true,
                error: "Status da unidade temporariamente indisponível.",
              },
            },
          }));
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [tab, scopeKey]);

  const indicadores = dashboard?.indicadores || {};
  const areaAtual =
    areasVisiveis.find((area) => area.id === TAB_AREA[tab]) || areasVisiveis[0];
  // Nome da unidade (código + nome) em vez do identificador técnico.
  // No host Dino, a sessão usa o UUID Commerce enquanto a configuração
  // legada mantém o ID interno; ambos já foram validados pelo backend.
  const escopoDinoComLoja = isDinoBrand && Boolean(lojaAtiva?.id);
  const nomeLojaAtiva =
    lojaAtiva &&
    (escopoDinoComLoja ||
      !configuracaoUnidade?.lojaId ||
      lojaAtiva.id === configuracaoUnidade.lojaId)
      ? `${lojaAtiva.codigo ? `${lojaAtiva.codigo} — ` : ""}${lojaAtiva.nome || lojaAtiva.nome_fantasia || ""}`.trim()
      : "";
  const unidadeLabel =
    nomeLojaAtiva ||
    (configuracaoUnidade?.lojaId
      ? "Unidade da sessão"
      : "Unidade definida pela sessão");
  const relacionamentoPorCliente = useMemo(
    () =>
      Object.fromEntries(
        (relacionamento?.porCliente || []).map((item) => [
          item.clienteId,
          item,
        ]),
      ),
    [relacionamento],
  );
  const listaBuscaClientes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const membros = new Set(
      (fidelidade?.membros || []).map((item) => item.clienteId),
    );
    return clientes.filter((cliente) => {
      const resumo = relacionamentoPorCliente[cliente.id] || {};
      const consentimentos = cliente.consentimentos || {};
      const temConsentimento = ["whatsapp", "email"].some((canal) =>
        ["atendimento", "marketing"].some(
          (finalidade) =>
            consentimentos[canal]?.[finalidade]?.concedido === true,
        ),
      );
      const temVisita = Number(resumo.visitas || 0) > 0;
      const passaFiltro =
        filtroClientes === "todos" ||
        (filtroClientes === "ativos" && temVisita) ||
        (filtroClientes === "fidelidade" && membros.has(cliente.id)) ||
        (filtroClientes === "consentimento" && temConsentimento) ||
        (filtroClientes === "inativos" && !temVisita);
      const passaBusca =
        !termo ||
        [cliente.nome, cliente.telefone, cliente.email].some((item) =>
          String(item || "")
            .toLowerCase()
            .includes(termo),
        );
      return passaFiltro && passaBusca;
    });
  }, [clientes, busca, filtroClientes, fidelidade, relacionamentoPorCliente]);
  const listaBuscaProfissionais = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return profissionais
      .filter((profissional) => !profissional.removidoEm)
      .filter(
        (profissional) =>
          !termo ||
          [
            profissional.nome,
            profissional.especialidade,
            profissional.email,
          ].some((item) =>
            String(item || "")
              .toLowerCase()
              .includes(termo),
          ),
      );
  }, [profissionais, busca]);
  const listaBuscaServicos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return servicos
      .filter((servico) => !servico.removidoEm)
      .filter(
        (servico) =>
          !termo ||
          [servico.nome, servico.categoria, servico.descricao].some((item) =>
            String(item || "")
              .toLowerCase()
              .includes(termo),
          ),
      );
  }, [servicos, busca]);
  const resultadosBuscaGlobal = useMemo(() => {
    const termo = buscaGlobal.trim().toLowerCase();
    if (!termo) return [];
    const candidatos = [
      ...clientes.map((item) => ({
        id: `cliente-${item.id}`,
        tipo: "Cliente",
        nome: item.nome,
        meta: item.telefone || item.email || "CRM",
        tab: "Clientes",
        item,
      })),
      ...profissionais.map((item) => ({
        id: `profissional-${item.id}`,
        tipo: "Atendente",
        nome: item.nome,
        meta: item.especialidade || "Equipe",
        tab: "Profissionais",
        item,
      })),
      ...servicos.map((item) => ({
        id: `servico-${item.id}`,
        tipo: "Serviço",
        nome: item.nome,
        meta: `${item.categoria || "Geral"} · ${rotuloPreco(item)}`,
        tab: "Serviços",
        item,
      })),
      ...produtosRevenda.map((item) => ({
        id: `produto-${item.id}`,
        tipo: "Revenda",
        nome: item.nome,
        meta: `${item.sku || "Sem SKU"} · estoque ${item.estoqueAtual ?? 0}`,
        tab: "Estoque de revenda",
        item,
      })),
      ...agendamentos.map((item) => ({
        id: `agenda-${item.id}`,
        tipo: "Agenda",
        nome: item.clienteNome || item.cliente_nome || "Cliente sem nome",
        meta: `${horario(item.dataHora)} · ${item.servicoNome || item.servico_nome || "Serviço"}`,
        tab: "Agenda",
        item,
      })),
    ];
    return candidatos
      .filter((item) =>
        [item.nome, item.meta, item.tipo].some((valor) =>
          String(valor || "")
            .toLowerCase()
            .includes(termo),
        ),
      )
      .slice(0, 8);
  }, [
    agendamentos,
    buscaGlobal,
    clientes,
    profissionais,
    produtosRevenda,
    servicos,
  ]);

  function abrirResultadoBusca(resultado) {
    setBuscaGlobal("");
    if (resultado.tipo === "Agenda") {
      conferirComandaDoAtendimento(resultado.item);
      return;
    }
    navegarParaTab(resultado.tab);
    setBusca(resultado.nome);
  }

  async function executar(operacao, sucesso, { mostrarPesquisa = false } = {}) {
    setSalvando(true);
    try {
      const resposta = await operacao();
      toast(sucesso, "success");
      if (mostrarPesquisa) {
        const aviso = avisoPesquisa(resposta?.avaliacao);
        toast(aviso.texto, aviso.tipo);
      }
      setModal(null);
      await carregar();
    } catch (error) {
      toast(error.message || "Operação não concluída.", "error");
    } finally {
      setSalvando(false);
    }
  }

  function abrirCaixaOperacao(dados) {
    return executar(
      () => api.post("/api/admin/barbearia/operacao/caixas", dados),
      "Caixa aberto para a unidade ativa.",
    );
  }

  function movimentarCaixaOperacao(caixa, dados) {
    return executar(
      () =>
        api.post(
          `/api/admin/barbearia/operacao/caixas/${caixa.id}/movimentos`,
          dados,
        ),
      "Movimentação registrada no caixa.",
    );
  }

  function fecharCaixaOperacao(caixa, dados) {
    return executar(
      () =>
        api.post(
          `/api/admin/barbearia/operacao/caixas/${caixa.id}/fechamento`,
          dados,
        ),
      "Caixa fechado com resumo de conferência.",
    );
  }

  async function fecharDiaOperacao(data) {
    if (
      !window.confirm(
        `Confirmar fechamento financeiro do dia ${fmtDateOnly(data)}? Esta ação consolida o livro financeiro e não cria pagamentos.`,
      )
    )
      return;
    try {
      setSalvando(true);
      const res = await api.post("/api/admin/barbearia/operacao/fechar-dia", {
        data,
        confirmado: true,
      });
      setFechamentoDetalhado(res.fechamento);
      setModal("fechamentoDia");
      carregar();
      if (toast)
        toast("Fechamento financeiro diário concluído com sucesso!", "success");
    } catch (error) {
      if (toast)
        toast(error.response?.data?.error || error.message || "Erro", "error");
    } finally {
      setSalvando(false);
    }
  }

  function abrirNovoAgendamento() {
    setFormAgenda({
      clienteId: "",
      clienteNome: "",
      clienteTelefone: "",
      profissionalId:
        profissionaisSelecionados(profissionalFiltro).length === 1
          ? profissionalFiltro
          : "",
      servicoId: servicos[0]?.id || "",
      data: dataSelecionada,
      hora: "10:00",
      observacoes: "",
    });
    setModal("agenda");
  }

  // Clique num horário livre (Agenda por período): abre o agendamento já preenchido.
  function abrirAgendamentoNoHorario({
    data,
    hora,
    profissionalId,
    servicoId,
    abrirBloqueio,
  }) {
    setDataSelecionada(data);
    if (abrirBloqueio) {
      setFormBloqueio({
        titulo: "Ausência / Folga",
        motivo: "",
        dataInicio: data || dataSelecionada,
        dataFim: data || dataSelecionada,
        diaTodo: true,
        inicioHora: "00:00",
        fimHora: "23:59",
        profissionalId: profissionalId || "",
        periodo: "dia_todo",
        diasSemana: [1, 2, 3, 4, 5, 6],
      });
      setModal("bloqueioAgenda");
      return;
    }
    setFormAgenda({
      clienteId: "",
      clienteNome: "",
      clienteTelefone: "",
      profissionalId: profissionalId || "",
      servicoId: servicoId || servicos[0]?.id || "",
      data,
      hora,
      observacoes: "",
    });
    setModal("agenda");
  }

  function abrirEdicaoAgendamento(agendamento) {
    setFormAgenda({
      clienteId: agendamento.clienteId || "",
      clienteNome: agendamento.clienteId
        ? ""
        : agendamento.clienteNome || agendamento.cliente_nome || "",
      clienteTelefone:
        agendamento.clienteTelefone || agendamento.cliente_telefone || "",
      profissionalId: agendamento.profissionalId || "",
      servicoId: agendamento.servicoId || "",
      data: String(
        agendamento.dataAgenda || agendamento.dataHora || dataSelecionada,
      ).slice(0, 10),
      hora: horario(agendamento.dataHora),
      observacoes: agendamento.observacoes || "",
      usarPlano: agendamento.usarPlano === true,
    });
    setModal({ tipo: "editarAgenda", agendamento });
  }

  // Histórico completo do cliente (consumo, família, gostos e sugestões) em nova guia.
  function abrirHistoricoCliente(item) {
    if (!abrirHistoricoEmNovaGuia(item))
      toast(
        "Este agendamento não tem cliente cadastrado nem telefone com DDD: não há histórico para abrir.",
        "warning",
      );
  }

  function abrirCliente(cliente) {
    setModal({ tipo: "detalheCliente", cliente });
  }

  function abrirEdicaoCliente(cliente) {
    setFormCliente({
      nome: cliente.nome || "",
      telefone: cliente.telefone || "",
      email: cliente.email || "",
      dataNascimento: nascimentoParaCampo(cliente),
      limiteCreditoMensal: Number(cliente.limiteCreditoMensal || 0),
      diasVencimento: Number(cliente.diasVencimento || 30),
      observacao: cliente.observacao || "",
      relacionamento: relacionamentoDoCliente(cliente),
    });
    setModal({ tipo: "editarCliente", cliente });
  }

  function agendarParaCliente(cliente) {
    setFormAgenda({
      clienteId: cliente.id,
      clienteNome: "",
      clienteTelefone: cliente.telefone || "",
      profissionalId:
        profissionaisSelecionados(profissionalFiltro).length === 1
          ? profissionalFiltro
          : "",
      servicoId: servicos.find((item) => item.ativo !== false)?.id || "",
      data: dataSelecionada,
      hora: "10:00",
      observacoes: "",
    });
    navegarParaTab("Agenda");
    setModal("agenda");
  }

  // Vindo da ficha Customer 360: abre a agenda já com o cliente selecionado.
  const agendarClienteParam = searchParams.get("agendarCliente");
  const editarClienteParam = searchParams.get("editarCliente");
  useEffect(() => {
    if (editarClienteParam && clientes.length) {
      const cliente = clientes.find((item) => item.id === editarClienteParam);
      if (cliente) {
        abrirEdicaoCliente(cliente);
        setSearchParams((current) => {
          const next = new URLSearchParams(current);
          next.delete("editarCliente");
          return next;
        }, { replace: true });
      }
    }
    if (!agendarClienteParam || !clientes.length) return;
    const cliente = clientes.find((item) => item.id === agendarClienteParam);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("agendarCliente");
        return next;
      },
      { replace: true },
    );
    if (cliente) agendarParaCliente(cliente);
  }, [agendarClienteParam, clientes]); // eslint-disable-line react-hooks/exhaustive-deps

  function abrirRecebimento(agendamento) {
    setFormRecebimento({
      meioPagamento: "pix",
      usarCashback: "",
      valeCodigo: "",
      valeValor: "",
    });
    setSaldoCashbackCliente(null);
    setModal({ tipo: "recebimento", agendamento });
    // Sinal já pago entra como receita na hora do pagamento: o recebimento do dia é só o restante.
    setConferindoSinal(true);
    api
      .get(`/api/admin/barbearia/agenda/${agendamento.id}/sinal`)
      .then((resposta) => {
        const sinal = resposta?.sinal;
        if (sinal?.status === "paga") {
          setSaldoCashbackCliente((atual) => ({
            ...(atual || {}),
            sinalPago: sinal.valor,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setConferindoSinal(false));
    const telefone =
      agendamento.clienteTelefone || agendamento.cliente_telefone;
    if (telefone)
      api
        .post("/api/admin/barbearia/cashback/consulta", { telefone })
        .then((resposta) =>
          setSaldoCashbackCliente((atual) => ({
            ...(atual || {}),
            ...resposta.cashback,
          })),
        )
        .catch(() => {});
  }

  function abrirNovaComanda(agendamento = null) {
    const cliente = agendamento?.clienteId
      ? clientes.find((item) => item.id === agendamento.clienteId)
      : null;
    setFormComanda({
      clienteId: agendamento?.clienteId || "",
      clienteNome: cliente ? "" : agendamento?.clienteNome || "",
      clienteTelefone: cliente?.telefone || agendamento?.clienteTelefone || "",
      profissionalId:
        agendamento?.profissionalId ||
        (profissionaisSelecionados(profissionalFiltro).length === 1
          ? profissionalFiltro
          : ""),
      agendamentoId: agendamento?.id || "",
      agendamentoObj: agendamento || null,
      itemTipo: "servico",
      itemId:
        agendamento?.servicoId ||
        servicos.find((item) => item.ativo !== false)?.id ||
        "",
      quantidade: 1,
      gorjeta: "",
      desconto: "",
      descontoMotivo: "",
      observacoes: agendamento?.observacoes || "",
    });
    setModal("novaComanda");
  }

  async function atualizarComandaNaTela(operacao, sucesso) {
    setSalvando(true);
    try {
      const resposta = await operacao();
      const comanda = resposta?.comanda || resposta;
      toast(sucesso, "success");
      setModal(comanda?.id ? { tipo: "comanda", comanda } : null);
      await carregar();
    } catch (error) {
      toast(error.message || "Comanda não atualizada.", "error");
    } finally {
      setSalvando(false);
    }
  }

  async function conferirComandaDoAtendimento(agendamento) {
    const escopo = scopeKey;
    try {
      let comanda = null;
      if (agendamento.clienteId) {
        const resp = await api.get(`/api/admin/barbearia/comandas?clienteId=${encodeURIComponent(agendamento.clienteId)}&pendentes=1`);
        if (activeScopeRef.current !== escopo) return;
        comanda = (resp?.comandas || []).find((c) => c.status !== "cancelada" && (c.status === "aberta" || c.status === "aguardando_pagamento"));
      }
      if (!comanda) {
        const resposta = await api.get(`/api/admin/barbearia/comandas?agendamentoId=${encodeURIComponent(agendamento.id)}`);
        if (activeScopeRef.current !== escopo) return;
        comanda = (resposta?.comandas || []).find((c) => c.agendamentoId === agendamento.id && c.status !== "cancelada");
      }
      if (comanda) await abrirComanda(comanda);
      else abrirNovaComanda(agendamento);
    } catch (error) {
      toast(
        error.message ||
          "Não foi possível conferir a comanda. Tente novamente.",
        "error",
      );
    }
  }

  async function removerItemComanda(comandaId, itemId) {
    if (!window.confirm("Tem certeza que deseja remover este item da comanda?"))
      return;
    try {
      const resposta = await api.delete(
        `/api/admin/barbearia/comandas/${comandaId}/itens/${itemId}`,
      );
      toast("Item removido com sucesso.", "success");
      setModal((m) =>
        m?.tipo === "comanda"
          ? { ...m, comanda: resposta.comanda || resposta }
          : m,
      );
      await carregar();
    } catch (e) {
      toast(e.message || "Erro ao remover item.", "error");
    }
  }

  function abrirModalAlterarValorItem(comandaAlvo, itemAlvo, idFallback, precoFallback) {
    const c = comandaAlvo || modal?.comanda;
    if (!c) return;
    const item = itemAlvo || (c.itens || [])[0];
    const itemId = item?.id || idFallback || (item ? `${item.tipo}-0` : "");
    const valor = item?.precoUnitario ?? item?.preco ?? precoFallback ?? 0;
    setModalItemValor({
      comanda: c,
      itemId,
      itemNome: item?.nome || "Item da comanda",
      itemTipo: item?.tipo === "produto" ? "Produto de revenda" : "Serviço",
      quantidade: item?.quantidade || item?.qtd || 1,
      valorAtual: valor,
      novoValor: valor,
      senhaGerente: "",
      motivo: "Ajuste de valor incorreto cobrado no atendimento",
      salvando: false,
    });
  }

  function abrirModalReabrirComanda(comandaAlvo) {
    const c = comandaAlvo || modal?.comanda;
    if (!c) return;
    setModalReabrir({
      comanda: c,
      senhaGerente: "",
      motivo: "Reabertura autorizada para ajuste de itens",
      salvando: false,
    });
  }

  async function confirmarAlteracaoValorItem() {
    if (!modalItemValor) return;
    const { comanda, itemId, novoValor, senhaGerente, motivo } = modalItemValor;
    const valNum = parseFloat(String(novoValor).replace(",", "."));
    if (isNaN(valNum) || valNum < 0) {
      return toast("Informe um valor numérico válido (ex: 20.00).", "error");
    }
    const ehFinalizada = ["paga", "em_conta"].includes(comanda.status);
    if (ehFinalizada && (!senhaGerente || !senhaGerente.trim())) {
      return toast("A senha do gerente é obrigatória para autorizar a alteração em comanda finalizada.", "error");
    }

    setModalItemValor((prev) => ({ ...prev, salvando: true }));
    try {
      const resposta = await api.patch(
        `/api/admin/barbearia/comandas/${comanda.id}/itens/${itemId}`,
        {
          valor: valNum,
          precoUnitario: valNum,
          preco: valNum,
          senhaGerente: senhaGerente?.trim() || "",
          motivo: motivo?.trim() || "Ajuste de valor de item faturado",
        }
      );
      const atualizada = resposta.comanda || resposta;
      toast(`Valor atualizado para ${moeda(valNum)} com sucesso! Comanda refinalizada.`, "success");
      setModalItemValor(null);
      setModal({ tipo: "comanda", comanda: atualizada });
      await carregar();
    } catch (erro) {
      toast(erro.message || "Erro ao alterar valor do item.", "error");
      setModalItemValor((prev) => ({ ...prev, salvando: false }));
    }
  }

  async function confirmarReaberturaComanda() {
    if (!modalReabrir) return;
    const { comanda, senhaGerente, motivo } = modalReabrir;
    if (!senhaGerente || !senhaGerente.trim()) {
      return toast("A senha do gerente é obrigatória para reabrir a comanda.", "error");
    }
    setModalReabrir((prev) => ({ ...prev, salvando: true }));
    try {
      const r = await api.post(`/api/admin/barbearia/comandas/${comanda.id}/reabrir`, {
        senhaGerente: senhaGerente.trim(),
        motivo: motivo?.trim() || "Reabertura autorizada para ajuste de itens",
      });
      toast("Comanda reaberta com sucesso! Ajuste os itens e finalize novamente.", "success");
      setModalReabrir(null);
      setModal({ tipo: "comanda", comanda: r.comanda || r });
      await carregar();
    } catch (erro) {
      toast(erro.message || "Erro ao reabrir comanda.", "error");
      setModalReabrir((prev) => ({ ...prev, salvando: false }));
    }
  }

  function alterarValorItemComanda(comandaId, itemId, valorAtual) {
    abrirModalAlterarValorItem(modal?.comanda, null, itemId, valorAtual);
  }

  async function abrirComanda(comanda) {
    try {
      const resposta = await api.get(
        `/api/admin/barbearia/comandas/${comanda.id}`,
      );
      const atual = resposta?.comanda || resposta;
      setFormPagamentoComanda({
        meioPagamento: "pix",
        valor: String(atual?.saldoPendente || atual?.total || ""),
        clienteId: atual?.clienteId || "",
        caixaId: "",
      });
      setFormComanda((formAtual) => ({
        ...formAtual,
        clienteId: atual?.clienteId || "",
        clienteNome: atual?.clienteNome || "",
        clienteTelefone: atual?.clienteTelefone || "",
        profissionalId: atual?.profissionalId || "",
        agendamentoId: atual?.agendamentoId || "",
        gorjeta: String(atual?.gorjeta || ""),
        desconto: String(atual?.desconto || ""),
        descontoMotivo: atual?.descontoMotivo || "",
        observacoes: atual?.observacoes || "",
        itemId: "",
        quantidade: 1,
      }));
      setModal({ tipo: "comanda", comanda: atual });
    } catch (error) {
      toast(error.message || "Não foi possível carregar a comanda.", "error");
    }
  }

  async function criarComanda(event) {
    event.preventDefault();
    const cliente = clientes.find((item) => item.id === formComanda.clienteId);
    const item =
      formComanda.itemTipo === "servico"
        ? servicos.find((itemServico) => itemServico.id === formComanda.itemId)
        : produtosRevenda.find(
            (itemProduto) => itemProduto.id === formComanda.itemId,
          );
    if (!item) {
      toast("Selecione ao menos um serviço ou produto.", "error");
      return;
    }
    const payload = {
      clienteId: formComanda.clienteId,
      clienteNome: cliente?.nome || formComanda.clienteNome,
      clienteTelefone: cliente?.telefone || formComanda.clienteTelefone,
      profissionalId: formComanda.profissionalId,
      agendamentoId: formComanda.agendamentoId,
      gorjeta: Number(formComanda.gorjeta || 0),
      desconto: Number(formComanda.desconto || 0),
      descontoMotivo: formComanda.descontoMotivo,
      observacoes: formComanda.observacoes,
      itens: [
        {
          tipo: formComanda.itemTipo,
          [formComanda.itemTipo === "servico" ? "servicoId" : "produtoId"]:
            formComanda.itemId,
          quantidade: Number(formComanda.quantidade || 1),
          profissionalId: formComanda.profissionalId,
        },
      ],
    };
    await atualizarComandaNaTela(
      () => api.post("/api/admin/barbearia/comandas", payload),
      "Comanda aberta.",
    );
  }

  async function adicionarItemComanda(event) {
    event.preventDefault();
    const comanda = modal?.comanda;
    if (!comanda || !formComanda.itemId) return;
    const item =
      formComanda.itemTipo === "servico"
        ? servicos.find((itemServico) => itemServico.id === formComanda.itemId)
        : produtosRevenda.find(
            (itemProduto) => itemProduto.id === formComanda.itemId,
          );
    if (!item) return;
    await atualizarComandaNaTela(
      () =>
        api.post(`/api/admin/barbearia/comandas/${comanda.id}/itens`, {
          itens: [
            {
              tipo: formComanda.itemTipo,
              [formComanda.itemTipo === "servico" ? "servicoId" : "produtoId"]:
                formComanda.itemId,
              quantidade: Number(formComanda.quantidade || 1),
              profissionalId:
                formComanda.profissionalId || comanda.profissionalId,
            },
          ],
        }),
      "Item adicionado à comanda.",
    );
    setFormComanda((atual) => ({ ...atual, itemId: "", quantidade: 1 }));
  }

  async function salvarDetalhesComanda(event) {
    event.preventDefault();
    const comanda = modal?.comanda;
    if (!comanda) return;
    await atualizarComandaNaTela(
      () =>
        api.patch(`/api/admin/barbearia/comandas/${comanda.id}`, {
          gorjeta: Number(formComanda.gorjeta || 0),
          desconto: Number(formComanda.desconto || 0),
          descontoMotivo: formComanda.descontoMotivo,
          observacoes: formComanda.observacoes,
        }),
      "Comanda atualizada.",
    );
  }

  async function aguardarPagamentoComanda() {
    const comanda = modal?.comanda;
    if (!comanda) return;
    await atualizarComandaNaTela(
      () =>
        api.post(
          `/api/admin/barbearia/comandas/${comanda.id}/aguardar-pagamento`,
          {},
        ),
      "Comanda encaminhada para pagamento.",
    );
  }

  async function cancelarComanda() {
    const comanda = modal?.comanda;
    if (
      !comanda ||
      !window.confirm(
        `Cancelar a comanda de ${comanda.clienteNome || "cliente eventual"}?`,
      )
    )
      return;
    await atualizarComandaNaTela(
      () =>
        api.post(`/api/admin/barbearia/comandas/${comanda.id}/cancelar`, {
          motivo: "Cancelamento manual confirmado pelo operador.",
        }),
      "Comanda cancelada.",
    );
  }

  async function cancelarComandaFinalizada(comanda, dados = {}) {
    const target = comanda || modal?.comanda;
    if (!target) return;
    await atualizarComandaNaTela(
      () =>
        api.post(`/api/admin/barbearia/comandas/${target.id}/cancelar-finalizada`, {
          ...dados,
          confirmado: true,
        }),
      "Comanda finalizada cancelada e estornada com sucesso.",
    );
    await carregar();
  }

  async function pagarComanda() {
    const comanda = modal?.comanda;
    const valor = Number(
      formPagamentoComanda.valor || comanda?.saldoPendente || 0,
    );
    if (!comanda || !Number.isFinite(valor) || valor <= 0) {
      toast("Informe um valor positivo para o recebimento.", "error");
      return;
    }
    if (
      formPagamentoComanda.meioPagamento === "conta" &&
      !formPagamentoComanda.clienteId &&
      !comanda.clienteId
    ) {
      toast("Selecione um cliente cadastrado para lançar em conta.", "error");
      return;
    }
    if (
      !window.confirm(
        `Confirmar recebimento de ${moeda(valor)} nesta comanda? A confirmação poderá registrar financeiro e baixar produtos.`,
      )
    )
      return;
    const chaveIdempotencia = `barbearia-comanda:${comanda.id}:${formPagamentoComanda.meioPagamento}:${valor.toFixed(2)}`;
    await atualizarComandaNaTela(
      () =>
        api.post(`/api/admin/barbearia/comandas/${comanda.id}/pagamentos`, {
          confirmado: true,
          clienteId: formPagamentoComanda.clienteId || comanda.clienteId,
         pagamentos: [
           {
             meio: formPagamentoComanda.meioPagamento,
             bandeira: formPagamentoComanda.bandeira || undefined,
             valor,
             caixaId: formPagamentoComanda.caixaId || undefined,
           },
          ],
          chaveIdempotencia,
        }),
      "Recebimento confirmado.",
    );
  }

  async function mudarStatus(agendamento, novoStatus, opcoes = {}) {
    const label = STATUS[novoStatus]?.label || novoStatus;
    if (
      novoStatus === "cancelado" &&
      !opcoes.motivo &&
      !window.confirm(
        `Cancelar o atendimento de ${agendamento.clienteNome || agendamento.cliente_nome || "cliente"}?`,
      )
    )
      return;
    await executar(
      () =>
        api.patch(`/api/admin/barbearia/agenda/${agendamento.id}/status`, {
          status: novoStatus,
          registrarFinanceiro: false,
          ...(novoStatus === "cancelado"
            ? {
                origem: "atendente",
                canceladoPor: "atendente",
                motivoCancelamento:
                  opcoes.motivo || "Cancelado pela equipe da barbearia",
                notificarCliente: opcoes.notificarCliente !== false,
              }
            : {}),
        }),
      `Atendimento marcado como ${label.toLowerCase()}.`,
      { mostrarPesquisa: novoStatus === "concluido" },
    );
  }

  async function mudarStatusAtendimento(agendamento, novoStatus, opcoes = {}) {
    if (agendamento.status === novoStatus) return;
    const statusAnterior = agendamento.status;

    // Atualização otimista imediata para resposta instantânea ao arrastar
    setAgendamentos((prev) =>
      prev.map((item) =>
        item.id === agendamento.id ? { ...item, status: novoStatus } : item,
      ),
    );

    // Se for transição direta de agendado para concluído, passa por em_atendimento
    if (statusAnterior === "agendado" && novoStatus === "concluido") {
      try {
        await api.patch(
          `/api/admin/barbearia/agenda/${agendamento.id}/status`,
          { status: "em_atendimento", registrarFinanceiro: false },
        );
        await api.patch(
          `/api/admin/barbearia/agenda/${agendamento.id}/status`,
          { status: "concluido", registrarFinanceiro: false },
        );
        toast("Atendimento concluído com sucesso.", "success");
        await carregar();
        return;
      } catch (err) {
        setAgendamentos((prev) =>
          prev.map((item) =>
            item.id === agendamento.id
              ? { ...item, status: statusAnterior }
              : item,
          ),
        );
        toast(err.message || "Falha ao concluir atendimento.", "error");
        return;
      }
    }

    try {
      await mudarStatus(agendamento, novoStatus, opcoes);
    } catch (err) {
      setAgendamentos((prev) =>
        prev.map((item) =>
          item.id === agendamento.id
            ? { ...item, status: statusAnterior }
            : item,
        ),
      );
    }
  }

  async function reatribuirBarbeiroAtendimento(
    agendamento,
    novoProfissionalId,
  ) {
    const prof = profissionais.find((p) => p.id === novoProfissionalId);
    const dataAgenda =
      agendamento.dataAgenda || String(agendamento.dataHora || "").slice(0, 10);
    await executar(
      () =>
        api.patch(`/api/admin/barbearia/agenda/${agendamento.id}`, {
          profissionalId: novoProfissionalId,
          dataAgenda,
          dataHora: agendamento.dataHora,
          servicoId: agendamento.servicoId,
          origem: "admin",
          encaixe: true,
        }),
      `Atendimento reatribuído para ${prof?.nome || "profissional"}.`,
    );
  }

  async function criarEncaixeRapido(dados) {
    const dataAgenda = dataSelecionada;
    const payload = {
      clienteId: dados.clienteId || "",
      clienteNome: dados.clienteNome,
      clienteTelefone: dados.clienteTelefone,
      profissionalId: dados.profissionalId,
      servicoId: dados.servicoId,
      dataHora: new Date().toISOString(),
      dataAgenda,
      observacoes: dados.observacoes || "Encaixe rápido / walk-in",
      origem: "admin",
      encaixe: true,
    };
    await executar(async () => {
      const resp = await api.post("/api/admin/barbearia/agenda", payload);
      const novoAgendamento = resp?.agendamento || resp;
      if (dados.iniciarImediato && novoAgendamento?.id) {
        await api.patch(
          `/api/admin/barbearia/agenda/${novoAgendamento.id}/status`,
          {
            status: "em_atendimento",
            registrarFinanceiro: false,
          },
        );
      }
      return resp;
    }, "Encaixe rápido registrado com sucesso.");
  }

  async function adicionarItemComandaRapido(
    comandaId,
    { tipo, id, quantidade = 1, profissionalId },
  ) {
    await executar(
      () =>
        api.post(`/api/admin/barbearia/comandas/${comandaId}/itens`, {
          itens: [
            {
              tipo,
              [tipo === "servico" ? "servicoId" : "produtoId"]: id,
              quantidade: Number(quantidade || 1),
              profissionalId,
            },
          ],
        }),
      "Item adicionado à comanda.",
    );
  }

  function valorDevidoRecebimento(agendamento) {
    const total = Number(agendamento?.valor || 0);
    const devido =
      total -
      Number(saldoCashbackCliente?.sinalPago || 0) -
      Number(formRecebimento.usarCashback || 0) -
      (formRecebimento.valeCodigo ? Number(formRecebimento.valeValor || 0) : 0);
    return Math.round(Math.max(0, devido) * 100) / 100;
  }

  async function concluirEReceber() {
    const agendamento = modal?.agendamento;
    if (!agendamento) return;
    // O valor do dia é calculado (e conferido no servidor): serviço − sinal pago − cashback usado.
    const valor = valorDevidoRecebimento(agendamento);
    if (
      !formRecebimento.meioPagamento ||
      !Number.isFinite(valor) ||
      valor < 0 ||
      Number(agendamento.valor) <= 0
    ) {
      toast(
        "Verifique o preço do serviço e informe o meio de pagamento.",
        "error",
      );
      return;
    }
    const usarCashback = Number(formRecebimento.usarCashback || 0);
    if (
      usarCashback < 0 ||
      (usarCashback > 0 &&
        usarCashback > Number(saldoCashbackCliente?.saldo || 0))
    ) {
      toast("O cashback usado não pode passar do saldo do cliente.", "error");
      return;
    }
    await executar(
      () =>
        api.patch(`/api/admin/barbearia/agenda/${agendamento.id}/status`, {
          status: "concluido",
          registrarFinanceiro: true,
          confirmado: true,
          meioPagamento: formRecebimento.meioPagamento,
          valorRecebido: valor,
          ...(usarCashback > 0 ? { usarCashback } : {}),
          ...(formRecebimento.valeCodigo &&
          Number(formRecebimento.valeValor) > 0
            ? {
                usarVale: {
                  codigo: formRecebimento.valeCodigo,
                  valor: Number(formRecebimento.valeValor),
                },
              }
            : {}),
        }),
      "Atendimento concluído e recebimento registrado no financeiro central.",
      { mostrarPesquisa: true },
    );
  }

  async function salvarAgenda(event) {
    event.preventDefault();
    const cliente = clientes.find((item) => item.id === formAgenda.clienteId);
    const dataAgenda = formAgenda.data || dataSelecionada;
    const payload = {
      clienteId: formAgenda.clienteId,
      clienteNome: cliente?.nome || formAgenda.clienteNome,
      clienteTelefone: cliente?.telefone || formAgenda.clienteTelefone,
      profissionalId: formAgenda.profissionalId,
      servicoId: formAgenda.servicoId,
      dataHora: new Date(`${dataAgenda}T${formAgenda.hora}:00`).toISOString(),
      dataAgenda,
      observacoes: formAgenda.observacoes,
      usarPlano: formAgenda.usarPlano === true,
      origem: "admin",
      ...(formAgenda.encaixe ? { encaixe: true } : {}),
    };
    const editando = modal?.tipo === "editarAgenda";
    if (
      editando &&
      !window.confirm(
        `Confirmar a remarcação para ${fmtDateOnly(dataAgenda)} às ${formAgenda.hora}?`,
      )
    )
      return;
    await executar(
      () =>
        editando
          ? api.patch(
              `/api/admin/barbearia/agenda/${modal.agendamento.id}`,
              payload,
            )
          : api.post("/api/admin/barbearia/agenda", payload),
      editando ? "Agendamento remarcado." : "Agendamento criado.",
    );
    if (editando && dataAgenda !== dataSelecionada)
      setDataSelecionada(dataAgenda);
  }

  function novoFormProfissional(profissional = {}) {
    const nome = profissional.nome || "";
    const isDinoAuto =
      nome.toLowerCase().includes("dino") ||
      nome.toLowerCase().includes("guilherme cunha");
    const atendimento24x7 = profissional.atendimento24x7 ?? isDinoAuto;
    return {
      nome,
      telefone: profissional.telefone || "",
      email: profissional.email || "",
      especialidade: profissional.especialidade || "Barbeiro",
      tipo: profissional.tipo || "parceiro",
      duracaoAtendimentoMinutos: profissional.duracaoAtendimentoMinutos || "",
      percentualComissao: profissional.percentualComissao ?? 50,
      percentualComissaoProduto: profissional.percentualComissaoProduto ?? 30,
      comissoesPorServico: { ...(profissional.comissoesPorServico || {}) },
      descontaTaxaMaquininha: profissional.descontaTaxaMaquininha !== false,
      descontaMaterial: profissional.descontaMaterial === true,
      atendimento24x7,
      horarioInicio:
        profissional.horarioInicio || (atendimento24x7 ? "00:00" : "08:00"),
      horarioFim:
        profissional.horarioFim || (atendimento24x7 ? "23:59" : "18:00"),
      diasTrabalho: Array.isArray(profissional.diasTrabalho)
        ? [...profissional.diasTrabalho]
        : atendimento24x7
          ? [0, 1, 2, 3, 4, 5, 6]
          : [1, 2, 3, 4, 5, 6],
      ativo: profissional.ativo !== false,
      fotoUrl: profissional.fotoUrl || "",
      faixasComissaoServico: Array.isArray(profissional.faixasComissaoServico)
        ? [...profissional.faixasComissaoServico]
        : [],
      faixasComissaoProduto: Array.isArray(profissional.faixasComissaoProduto)
        ? [...profissional.faixasComissaoProduto]
        : [],
    };
  }

  function abrirNovoProfissional() {
    setFormProf(novoFormProfissional());
    setModal({ tipo: "profissional", profissionalId: null });
  }

  function editarProfissional(profissional) {
    setFormProf(novoFormProfissional(profissional));
    setModal({ tipo: "profissional", profissionalId: profissional.id });
  }

  async function salvarProfissional(event) {
    event.preventDefault();
    const profissionalId =
      modal?.tipo === "profissional" ? modal.profissionalId : null;
    const payload = {
      ...formProf,
      percentualComissao: Number(formProf.percentualComissao),
      percentualComissaoProduto: Number(formProf.percentualComissaoProduto),
      duracaoAtendimentoMinutos: formProf.duracaoAtendimentoMinutos
        ? Number(formProf.duracaoAtendimentoMinutos)
        : null,
      // Só envia exceções preenchidas; campo vazio volta ao percentual padrão.
      comissoesPorServico: Object.fromEntries(
        Object.entries(formProf.comissoesPorServico || {})
          .filter(
            ([, valor]) =>
              valor !== "" && valor !== null && valor !== undefined,
          )
          .map(([id, valor]) => [id, Number(valor)]),
      ),
      atendimento24x7: Boolean(formProf.atendimento24x7),
      diasTrabalho: Array.isArray(formProf.diasTrabalho)
        ? formProf.diasTrabalho
        : [],
      faixasComissaoServico: Array.isArray(formProf.faixasComissaoServico)
        ? formProf.faixasComissaoServico
        : [],
      faixasComissaoProduto: Array.isArray(formProf.faixasComissaoProduto)
        ? formProf.faixasComissaoProduto
        : [],
    };
    await executar(
      () =>
        profissionalId
          ? api.patch(
              `/api/admin/barbearia/profissionais/${profissionalId}`,
              payload,
            )
          : api.post("/api/admin/barbearia/profissionais", payload),
      profissionalId ? "Profissional atualizado." : "Profissional cadastrado.",
    );
  }

  async function alternarProfissional(profissional) {
    const ativo = profissional.ativo === false;
    await executar(
      () =>
        api.patch(`/api/admin/barbearia/profissionais/${profissional.id}`, {
          ativo,
        }),
      ativo ? "Profissional reativado." : "Profissional desativado.",
    );
  }

  async function excluirProfissional(profissional) {
    await excluirCadastro(
      "profissionais",
      profissional,
      "Profissional",
      "agenda, comandas, comissões e o histórico de serviços",
    );
  }

  // Exclusão lógica: o cadastro sai das listas e das novas operações, mas o histórico
  // (agenda, comandas, vendas, comissões, assinaturas, Avec) continua intacto e pode ser restaurado.
  async function excluirCadastro(rota, item, rotulo, historico) {
    if (
      !window.confirm(
        `Excluir ${item.nome}? ${rotulo} sai da lista e das novas operações. ${historico[0].toUpperCase()}${historico.slice(1)} continuam preservados, e o cadastro pode ser restaurado em "Excluídos".`,
      )
    )
      return;
    await executar(
      () => api.delete(`/api/admin/barbearia/${rota}/${item.id}`),
      `${rotulo} excluído. O histórico foi preservado.`,
    );
  }

  async function restaurarCadastro(rota, item, rotulo) {
    await executar(
      () =>
        api.patch(`/api/admin/barbearia/${rota}/${item.id}`, { ativo: true }),
      `${rotulo} restaurado.`,
    );
  }

  function renderExcluidos(itens, rota, rotulo) {
    const excluidos = itens.filter((item) => item.removidoEm);
    if (!excluidos.length) return null;
    return (
      <Card style={{ padding: 16 }}>
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>
            Excluídos ({excluidos.length})
          </summary>
          <p style={styles.sub}>
            Fora das listas e das novas operações; o histórico continua
            preservado.
          </p>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {excluidos.map((item) => (
              <div key={item.id} style={styles.listRow}>
                <div>
                  <strong>{item.nome}</strong>
                  <div style={styles.sub}>
                    Excluído em {fmtDate(item.removidoEm)}
                  </div>
                </div>
                <button
                  type="button"
                  style={styles.small}
                  disabled={salvando}
                  onClick={() => restaurarCadastro(rota, item, rotulo)}
                >
                  Restaurar
                </button>
              </div>
            ))}
          </div>
        </details>
      </Card>
    );
  }

  function botoesCadastro({ item, rota, rotulo, historico, onEditar }) {
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button
          type="button"
          style={{ ...styles.secondary, flex: "1 1 110px" }}
          disabled={salvando}
          onClick={onEditar}
        >
          Editar
        </button>
        <button
          type="button"
          style={{ ...styles.secondary, flex: "1 1 110px" }}
          disabled={salvando}
          onClick={() =>
            executar(
              () =>
                api.patch(`/api/admin/barbearia/${rota}/${item.id}`, {
                  ativo: item.ativo === false,
                }),
              item.ativo === false
                ? `${rotulo} reativado.`
                : `${rotulo} desativado.`,
            )
          }
        >
          {item.ativo === false ? "Reativar" : "Desativar"}
        </button>
        <button
          type="button"
          style={{
            ...styles.small,
            flex: "0 1 auto",
            color: "#e05c5c",
            borderColor: "color-mix(in srgb, #e05c5c 45%, var(--line))",
          }}
          disabled={salvando}
          onClick={() => excluirCadastro(rota, item, rotulo, historico)}
        >
          Excluir
        </button>
      </div>
    );
  }

  function abrirServico(servico = null) {
    setEdicaoId(servico?.id || null);
    setFormServico(
      servico
        ? {
            ...servico,
            preco: servico.preco ?? "",
            custoMaterial: servico.custoMaterial ?? "",
            consumoInterno: Array.isArray(servico.consumoInterno)
              ? servico.consumoInterno.map((item) => ({ ...item }))
              : [],
          }
        : {
            nome: "",
            descricao: "",
            categoria: "Geral",
            grupoServico: "convencionais",
            duracaoMinutos: 30,
            preco: "",
            intervaloRecomendacaoDias: 0,
            permiteAgendamentoOnline: true,
            consumoInterno: [],
          },
    );
    setModal("servico");
  }

  function abrirPlano(plano = null) {
    setEdicaoId(plano?.id || null);
    setFormPlano(
      plano
        ? { ...plano, servicosIds: [...(plano.servicosIds || [])] }
        : {
            nome: "",
            descricao: "",
            ciclo: "mensal",
            regraRenovacao: "aniversario",
            preco: "",
            sessoesIncluidas: 4,
            validadeDias: 30,
            servicosIds: [],
          },
    );
    setModal("plano");
  }

  function abrirProdutoRevenda(produto = null) {
    setEdicaoId(produto?.id || null);
    setFormProdutoRevenda(
      produto
        ? { ...produto, custoUnitario: produto.custoUnitario ?? "" }
        : {
            nome: "",
            sku: "",
            categoria: "Revenda",
            unidade: "un",
            precoVenda: "",
            custoUnitario: "",
            estoqueAtual: 0,
            estoqueMinimo: 0,
            intervaloRecompraDias: 30,
          },
    );
    setModal("produtoRevenda");
  }

  async function alterarStatusAssinatura(assinatura, status) {
    const textos = {
      pausada: [
        "Pausar esta assinatura? As sessões ficam congeladas até retomar.",
        "Assinatura pausada.",
      ],
      ativa: [
        "Retomar esta assinatura sem cobrança automática?",
        "Assinatura retomada.",
      ],
      cancelada: [
        `Cancelar a assinatura de ${assinatura.clienteNome || "cliente"}? Ela deixa de valer, mas sessões usadas, pagamentos e histórico continuam preservados. O cancelamento não pode ser desfeito.`,
        "Assinatura cancelada. O histórico foi preservado.",
      ],
    };
    const [pergunta, sucesso] = textos[status];
    if (!window.confirm(pergunta)) return;
    await executar(
      () =>
        api.patch(
          `/api/admin/barbearia/assinaturas/${assinatura.id}/status`,
          status === "ativa"
            ? {
                status,
                confirmadoSemCobranca: true,
                pagamentoConfirmado: Boolean(assinatura.pagamentoConfirmado),
              }
            : { status },
        ),
      sucesso,
    );
  }

  async function salvarServico(event) {
    event.preventDefault();
    const consumoInterno = (formServico.consumoInterno || [])
      .filter((item) => item.produtoId)
      .map((item) => ({
        produtoId: item.produtoId,
        quantidade: Number(item.quantidade) || 1,
      }));
    const servicoPayload = (corpo) =>
      edicaoId
        ? api.patch(`/api/admin/barbearia/servicos/${edicaoId}`, corpo)
        : api.post("/api/admin/barbearia/servicos", corpo);
    await executar(
      () =>
        servicoPayload({
          ...formServico,
          custoMaterial:
            formServico.custoMaterial === "" ||
            formServico.custoMaterial === undefined
              ? null
              : Number(formServico.custoMaterial),
          preco: Number(formServico.preco || 0),
          permiteAgendamentoOnline: Boolean(
            formServico.permiteAgendamentoOnline,
          ),
          consumoInterno,
        }),
      edicaoId ? "Serviço atualizado." : "Serviço cadastrado.",
    );
  }

  async function alternarProfissionalDoServico(servico, profissionalId) {
    const atuais = new Set(servico.profissionaisIds || []);
    if (atuais.has(profissionalId)) atuais.delete(profissionalId);
    else atuais.add(profissionalId);
    await executar(
      () =>
        api.patch(`/api/admin/barbearia/servicos/${servico.id}`, {
          ...servico,
          profissionaisIds: [...atuais],
        }),
      atuais.size
        ? "Profissionais do serviço atualizados."
        : "Serviço liberado para todos os profissionais.",
    );
  }

  async function salvarPeriodicidadeServico(servico) {
    const intervaloRecomendacaoDias = Number(
      intervaloServicoDrafts[servico.id] ??
        servico.intervaloRecomendacaoDias ??
        0,
    );
    if (
      !Number.isInteger(intervaloRecomendacaoDias) ||
      intervaloRecomendacaoDias < 0 ||
      intervaloRecomendacaoDias > 3650
    )
      return toast("Informe um intervalo entre 0 e 3650 dias.", "error");
    await executar(
      () =>
        api.patch(`/api/admin/barbearia/servicos/${servico.id}`, {
          intervaloRecomendacaoDias,
        }),
      "Intervalo de recomendação salvo.",
    );
  }

  async function salvarCliente(event) {
    event.preventDefault();
    const { relacionamento, ...dadosCliente } = formCliente;
    const payload = {
      ...dadosCliente,
      ...relacionamentoParaApi(relacionamento || RELACIONAMENTO_VAZIO),
      limiteCreditoMensal: Number(formCliente.limiteCreditoMensal || 0),
      diasVencimento: Number(formCliente.diasVencimento || 30),
    };
    const editando = modal?.tipo === "editarCliente";
    await executar(
      () =>
        editando
          ? api.patch(
              `/api/admin/barbearia/clientes/${modal.cliente.id}`,
              payload,
            )
          : api.post("/api/admin/barbearia/clientes", payload),
      editando
        ? "Cliente e política de crédito atualizados."
        : "Cliente cadastrado no CRM.",
    );
  }

  async function salvarConfiguracao(event) {
    event.preventDefault();
    if (
      formConfig.confirmacaoAutomaticaAtiva === true &&
      configuracao?.confirmacaoAutomaticaAtiva !== true &&
      !window.confirm(
        "Ativar confirmações automáticas para a empresa ativa? O WhatsApp só será enviado a clientes com consentimento de atendimento. A segunda mensagem sai cerca de 2h15 antes; sem resposta por 1 hora, o agendamento é cancelado pelo menos 1h15 antes do horário. Agendamentos com menos de 3h15 de antecedência não entram nesta regra.",
      )
    )
      return;
    await executar(
      () => api.patch("/api/admin/barbearia/configuracoes", formConfig),
      "Configurações atualizadas.",
    );
  }

  function atualizarTaxaPagamento(meio, campo, valor) {
    setFormConfig((atual) => ({
      ...atual,
      taxasPagamento: {
        ...(atual.taxasPagamento || {}),
        [meio]: { ...(atual.taxasPagamento?.[meio] || {}), [campo]: valor },
      },
    }));
  }

  async function prepararFiscalComanda(comanda) {
    if (
      !comanda ||
      !window.confirm(
        `Preparar rascunho fiscal da comanda ${comanda.id}? Esta ação não emite nem transmite documento.`,
      )
    )
      return;
    await executar(
      () =>
        api.post(
          `/api/admin/barbearia/comandas/${comanda.id}/fiscal/rascunho`,
          {
            confirmado: true,
            chaveIdempotencia: `barbearia:fiscal:${comanda.id}`,
          },
        ),
      "Rascunho fiscal preparado; emissão externa continua pendente.",
    );
  }

  async function salvarConfiguracaoUnidade(event) {
    event.preventDefault();
    if (!configuracaoUnidade?.calendario) return;
    if (
      !window.confirm("Confirmar a atualização do calendário da unidade ativa?")
    )
      return;
    await executar(
      () =>
        api.patch(
          "/api/admin/barbearia/configuracoes/unidade-ativa",
          configuracaoUnidade.calendario,
        ),
      "Calendário da unidade atualizado.",
    );
  }

  async function salvarFila(event) {
    event.preventDefault();
    const cliente = clientes.find((item) => item.id === formFila.clienteId);
    const payload = {
      ...formFila,
      clienteNome: cliente?.nome || formFila.clienteNome,
      clienteTelefone: cliente?.telefone || formFila.clienteTelefone,
      previsaoMinutos: Number(formFila.previsaoMinutos),
    };
    await executar(
      () => api.post("/api/admin/barbearia/fila", payload),
      "Cliente adicionado à fila.",
    );
  }

  function alterarFila(item, status) {
    if (status === "chamado") {
      setFormFilaChamada({ mesaOuPosicao: item.mesaOuPosicao || "" });
      setModal({ tipo: "filaChamada", item });
      return;
    }
    return executar(
      () =>
        api.patch(`/api/admin/barbearia/fila/${item.id}/status`, {
          status,
          mesaOuPosicao: item.mesaOuPosicao || "",
        }),
      `Fila atualizada para ${status}.`,
    );
  }

  async function concluirChamadaFila(event) {
    event.preventDefault();
    const item = modal?.item;
    const mesaOuPosicao = formFilaChamada.mesaOuPosicao.trim();
    if (!item || !mesaOuPosicao) return;
    await executar(
      () =>
        api.patch(`/api/admin/barbearia/fila/${item.id}/status`, {
          status: "chamado",
          mesaOuPosicao,
        }),
      "Cliente chamado e posição registrada.",
    );
  }

  async function salvarBloqueio(event, overrideData = null) {
    if (event?.preventDefault) event.preventDefault();
    const dados = overrideData || formBloqueio;
    const dataInicio = dados.dataInicio || dados.data || dataSelecionada || new Date().toISOString().slice(0, 10);
    const dataFim = dados.dataFim || dados.dataFimRepeticao || dataInicio;
    const ehDiaTodo = dados.diaTodo === true || dados.periodo === "dia_todo";
    const inicioH = ehDiaTodo ? "00:00" : (dados.inicioHora || "08:00");
    const fimH = ehDiaTodo ? "23:59" : (dados.fimHora || "20:00");

    const isSingleDay = dataFim <= dataInicio && ["apenas_dia", "dia_todo", "30_min", "1_hora", "2_horas", "3_horas"].includes(dados.periodo || "apenas_dia");

    if (isSingleDay) {
      const inicio = new Date(`${dataInicio}T${inicioH}:00`).toISOString();
      const fim = new Date(`${dataInicio}T${fimH}:59`).toISOString();
      await executar(
        () =>
          api.post("/api/admin/barbearia/bloqueios", {
            titulo: dados.titulo || "Bloqueio de agenda",
            motivo: dados.motivo || "",
            inicio,
            fim,
            profissionalId: dados.profissionalId || "",
          }),
        "Bloqueio criado com sucesso na agenda.",
      );
    } else {
      let diasLimite = 1;
      if (dados.periodo === "uma_semana") diasLimite = 7;
      else if (dados.periodo === "15_dias") diasLimite = 15;
      else if (dados.periodo === "30_dias") diasLimite = 30;
      else if (dados.periodo === "60_dias") diasLimite = 60;
      else if (dados.periodo === "1_ano") diasLimite = 365;
      else if (dados.periodo === "indeterminado") diasLimite = 1825;
      else if (dataFim > dataInicio) {
        const diffMs = new Date(`${dataFim}T12:00:00`).getTime() - new Date(`${dataInicio}T12:00:00`).getTime();
        diasLimite = Math.max(1, Math.round(diffMs / 86400000) + 1);
      }

      const lote = [];
      let dataCursor = new Date(`${dataInicio}T12:00:00`);
      let count = 0;
      let dataFimObj = new Date(`${dataFim}T12:00:00`);

      const diasSemanaValidos = Array.isArray(dados.diasSemana) && dados.diasSemana.length > 0
        ? dados.diasSemana
        : [0, 1, 2, 3, 4, 5, 6];

      while (count < diasLimite && dataCursor <= dataFimObj) {
        if (diasSemanaValidos.includes(dataCursor.getDay())) {
          const isoDia = dataCursor.toISOString().slice(0, 10);
          const inicio = new Date(`${isoDia}T${inicioH}:00`).toISOString();
          const fim = new Date(`${isoDia}T${fimH}:59`).toISOString();
          lote.push({
            titulo: dados.titulo || "Bloqueio de agenda",
            motivo: dados.motivo || "",
            inicio,
            fim,
            profissionalId: dados.profissionalId || "",
          });
        }
        dataCursor.setDate(dataCursor.getDate() + 1);
        count++;
      }

      if (lote.length === 0) {
        const inicio = new Date(`${dataInicio}T${inicioH}:00`).toISOString();
        const fim = new Date(`${dataInicio}T${fimH}:59`).toISOString();
        lote.push({
          titulo: dados.titulo || "Bloqueio de agenda",
          motivo: dados.motivo || "",
          inicio,
          fim,
          profissionalId: dados.profissionalId || "",
        });
      }

      if (lote.length > 300 && !window.confirm(`Você está prestes a criar ${lote.length} bloqueios. Continuar?`)) return;

      await executar(
        () => api.post("/api/admin/barbearia/bloqueios", { lote }),
        `${lote.length} bloqueio(s) criado(s) com sucesso na agenda.`,
      );
    }
    setModal(null);
  }

  async function desativarBloqueio(bloqueio) {
    if (!window.confirm(`Desativar o bloqueio “${bloqueio.titulo}”?`)) return;
    await executar(
      () => api.delete(`/api/admin/barbearia/bloqueios/${bloqueio.id}`),
      "Bloqueio desativado.",
    );
  }

  async function salvarPlano(event) {
    event.preventDefault();
    const planoPayload = (corpo) =>
      edicaoId
        ? api.patch(`/api/admin/barbearia/planos/${edicaoId}`, corpo)
        : api.post("/api/admin/barbearia/planos", corpo);
    await executar(
      () =>
        planoPayload({
          ...formPlano,
          percentualPote: Number(formPlano.percentualPote || 0),
          rateioPote: formPlano.rateioPote || "valor_tabela",
          valorFixoPorUso: Number(formPlano.valorFixoPorUso || 0),
          preco: Number(formPlano.preco),
          sessoesIncluidas: Number(formPlano.sessoesIncluidas),
          validadeDias: Number(formPlano.validadeDias),
        }),
      edicaoId ? "Plano atualizado." : "Plano criado.",
    );
  }

  async function salvarAssinatura(event) {
    event.preventDefault();
    const cliente = clientes.find(
      (item) => item.id === formAssinatura.clienteId,
    );
    const dados = {
      ...formAssinatura,
      clienteNome: cliente?.nome || formAssinatura.clienteNome,
    };
    const conteudo = JSON.stringify(dados);
    if (pedidoAssinatura.current?.conteudo !== conteudo)
      pedidoAssinatura.current = { conteudo, chave: crypto.randomUUID() };
    const chaveIdempotencia = pedidoAssinatura.current.chave;
    await executar(async () => {
      const resposta = await api.post("/api/admin/barbearia/assinaturas", {
        ...dados,
        chaveIdempotencia,
      });
      setFormAssinatura({
        clienteId: "",
        clienteNome: "",
        planoId: "",
        regraRenovacao: "aniversario",
        inicio: hojeLocal(),
        observacoes: "",
      });
      pedidoAssinatura.current = null;
      return resposta;
    }, "Assinatura criada como pendente de ativação.");
  }

  async function ativarAssinatura(assinatura) {
    if (
      !window.confirm(
        "Ativar esta assinatura sem cobrança automática? Confirme apenas se a contratação foi validada fora deste fluxo.",
      )
    )
      return;
    await executar(
      () =>
        api.patch(`/api/admin/barbearia/assinaturas/${assinatura.id}/status`, {
          status: "ativa",
          confirmadoSemCobranca: true,
          pagamentoConfirmado: false,
        }),
      "Assinatura ativada sem cobrança automática.",
    );
  }

  async function aderirFidelidade(cliente) {
    if (
      !window.confirm(
        `Confirmar adesão de ${cliente.nome} ao programa de fidelidade?`,
      )
    )
      return;
    await executar(
      () =>
        api.post("/api/admin/barbearia/fidelidade/membros", {
          clienteId: cliente.id,
        }),
      "Cliente aderiu ao programa de fidelidade.",
    );
  }

  async function salvarRegraFidelidade(event) {
    event.preventDefault();
    if (
      !window.confirm(
        "Confirmar a alteração da regra de pontos para a empresa ativa?",
      )
    )
      return;
    await executar(
      () => api.patch("/api/admin/barbearia/fidelidade/regra", formFidelidade),
      "Regra de fidelidade atualizada.",
    );
  }

  function abrirCreditoFidelidade(membro) {
    setFormCreditoFidelidade({ valor: "" });
    setModal({ tipo: "creditoFidelidade", membro });
  }

  async function creditarFidelidade(event) {
    event.preventDefault();
    const membro = modal?.membro;
    const valor = Number(formCreditoFidelidade.valor);
    if (!membro || !Number.isFinite(valor) || valor <= 0) return;
    if (
      !window.confirm(
        `Confirmar crédito de pontos com base em R$ ${valor.toFixed(2)} para ${membro.nome}?`,
      )
    )
      return;
    await executar(
      () =>
        api.post("/api/admin/barbearia/fidelidade/creditar", {
          clienteId: membro.clienteId,
          valor,
          origem: "barbearia_atendimento",
          confirmado: true,
        }),
      "Pontos creditados.",
    );
  }

  async function atualizarConsentimento(cliente, canal, finalidade, concedido) {
    const estado = concedido ? "conceder" : "revogar";
    if (
      !window.confirm(
        `Confirmar ${estado} do consentimento de ${cliente.nome} para ${finalidade} por ${canal}?`,
      )
    )
      return;
    await executar(
      () =>
        api.patch(
          `/api/admin/barbearia/clientes/${cliente.id}/consentimentos`,
          {
            canal,
            finalidade,
            concedido,
            confirmado: true,
            origem: "painel_barbearia",
          },
        ),
      "Consentimento atualizado e auditado.",
    );
  }

  async function salvarProdutoRevenda(event) {
    event.preventDefault();
    const corpo = {
      ...formProdutoRevenda,
      precoVenda: Number(formProdutoRevenda.precoVenda),
      custoUnitario: Number(formProdutoRevenda.custoUnitario || 0),
      estoqueAtual: Number(formProdutoRevenda.estoqueAtual || 0),
      estoqueMinimo: Number(formProdutoRevenda.estoqueMinimo || 0),
      intervaloRecompraDias: Number(
        formProdutoRevenda.intervaloRecompraDias ?? 30,
      ),
    };
    if (edicaoId) {
      // Na edição o saldo não muda: entradas e saídas passam pelos movimentos, que guardam o histórico.
      const { estoqueAtual, statusEstoque, ...semSaldo } = corpo;
      await executar(
        () =>
          api.patch(
            `/api/admin/barbearia/estoque-revenda/${edicaoId}`,
            semSaldo,
          ),
        "Produto de revenda atualizado.",
      );
      return;
    }
    await executar(
      () => api.post("/api/admin/barbearia/estoque-revenda", corpo),
      "Produto de revenda cadastrado.",
    );
  }

  async function salvarPeriodicidadeProduto(produto) {
    const intervaloRecompraDias = Number(
      intervaloProdutoDrafts[produto.id] ?? produto.intervaloRecompraDias ?? 30,
    );
    if (
      !Number.isInteger(intervaloRecompraDias) ||
      intervaloRecompraDias < 0 ||
      intervaloRecompraDias > 3650
    )
      return toast("Informe um intervalo entre 0 e 3650 dias.", "error");
    await executar(
      () =>
        api.patch(`/api/admin/barbearia/estoque-revenda/${produto.id}`, {
          intervaloRecompraDias,
        }),
      "Intervalo de recompra salvo.",
    );
  }

  function movimentarProdutoRevenda(produto, tipo) {
    setFormMovimentoRevenda({
      quantidade: 1,
      observacao: "Movimento manual no módulo Barbearia.",
    });
    setModal({ tipo: "movimentoRevenda", produto, movimentoTipo: tipo });
  }

  async function concluirMovimentoRevenda(event) {
    event.preventDefault();
    const produto = modal?.produto;
    const tipo = modal?.movimentoTipo;
    const quantidade = Number(formMovimentoRevenda.quantidade);
    const movimentoLabel =
      tipo === "entrada"
        ? "entrada"
        : tipo === "saida_manual"
          ? "saída manual"
          : "ajuste";
    if (!produto || !tipo || !Number.isInteger(quantidade) || quantidade <= 0)
      return;
    if (
      !window.confirm(
        `Confirmar ${movimentoLabel} de ${quantidade} ${produto.unidade || "un"} em ${produto.nome}?`,
      )
    )
      return;
    await executar(
      () =>
        api.post(
          `/api/admin/barbearia/estoque-revenda/${produto.id}/movimentos`,
          {
            tipo,
            quantidade,
            confirmado: true,
            observacao:
              formMovimentoRevenda.observacao.trim() ||
              "Movimento manual no módulo Barbearia.",
          },
        ),
      "Movimento de estoque registrado.",
    );
  }

  function adicionarItemVendaRevenda(event) {
    event.preventDefault();
    const produto = produtosRevenda.find(
      (item) => item.id === formVendaRevenda.produtoId,
    );
    const quantidade = Number(formVendaRevenda.quantidade);
    if (!produto || !Number.isInteger(quantidade) || quantidade <= 0) return;
    setItensVendaRevenda((itens) => {
      const existente = itens.find((item) => item.produtoId === produto.id);
      if (existente)
        return itens.map((item) =>
          item.produtoId === produto.id
            ? { ...item, quantidade: item.quantidade + quantidade }
            : item,
        );
      return [
        ...itens,
        {
          produtoId: produto.id,
          nome: produto.nome,
          unidade: produto.unidade,
          precoUnitario: produto.precoVenda,
          quantidade,
        },
      ];
    });
    setFormVendaRevenda((atual) => ({
      ...atual,
      produtoId: "",
      quantidade: 1,
    }));
  }

  async function salvarVendaRevenda(event) {
    event.preventDefault();
    if (itensVendaRevenda.length === 0) return;
    await executar(
      () =>
        api.post("/api/admin/barbearia/vendas-revenda", {
          clienteId: formVendaRevenda.clienteId,
          clienteNome: formVendaRevenda.clienteNome,
          profissionalId: formVendaRevenda.profissionalId,
          observacao: formVendaRevenda.observacao,
          itens: itensVendaRevenda.map(({ produtoId, quantidade }) => ({
            produtoId,
            quantidade,
          })),
        }),
      "Venda de revenda criada como pendente.",
    );
    setItensVendaRevenda([]);
    setFormVendaRevenda({
      clienteId: "",
      clienteNome: "",
      profissionalId: "",
      observacao: "",
      produtoId: "",
      quantidade: 1,
    });
  }

  async function configurarWhatsappAi(status) {
    if (
      status === "ativo" &&
      !window.confirm(
        "Confirmar a ativação do atendente IA no WhatsApp desta unidade? Mensagens recebidas passarão a ser processadas pelo Gemini e poderão preparar ações sujeitas a confirmação do cliente.",
      )
    )
      return;
    await executar(
      () =>
        api.post("/api/admin/commerce/whatsapp-ai/channel", {
          instance: formWhatsappAi.instance,
          displayName: formWhatsappAi.displayName,
          status,
          confirmed: status === "ativo",
          webhookSecretEnv: "WHATSAPP_AI_WEBHOOK_SECRET",
          webhookHeader: "x-setpoint-webhook-token",
          capabilities: {
            humanized: formWhatsappAi.humanized === true,
            captureLeads: formWhatsappAi.captureLeads === true,
            operateStore: formWhatsappAi.operateStore === true,
            manageAppointments: formWhatsappAi.manageAppointments === true,
            sendPromotions: formWhatsappAi.sendPromotions === true,
            reminders: formWhatsappAi.reminders === true,
            humanHandoff: formWhatsappAi.humanHandoff !== false,
          },
        }),
      status === "ativo"
        ? "Atendente WhatsApp ativado."
        : "Configuração do canal salva.",
    );
  }

  async function salvarPoliticaWhatsappAi() {
    if (!whatsappAi?.channel) {
      toast("Salve primeiro o canal WhatsApp em rascunho.", "error");
      return;
    }
    if (
      formWhatsappAiPolicy.opportunitiesEnabled &&
      !formWhatsappAiPolicy.personalizationEnabled
    ) {
      toast("Oportunidades exigem personalização habilitada.", "error");
      return;
    }
    const resumo = formWhatsappAiPolicy.opportunitiesEnabled
      ? "Confirmar política com personalização e oportunidades? Isso não ativa o canal nem envia mensagens, mas permitirá esses recursos quando o atendente for ativado separadamente."
      : "Confirmar a política de atendimento desta unidade? Isso não ativa o canal nem envia mensagens.";
    if (!window.confirm(resumo)) return;
    await executar(
      () =>
        api.patch("/api/admin/commerce/whatsapp-ai/policy", {
          personalizationEnabled: formWhatsappAiPolicy.personalizationEnabled,
          opportunitiesEnabled: formWhatsappAiPolicy.opportunitiesEnabled,
          cooldownDays: Number(formWhatsappAiPolicy.cooldownDays || 30),
          privacyNotice: formWhatsappAiPolicy.privacyNotice.trim(),
          confirmed: true,
        }),
      "Política do atendente atualizada e auditada.",
    );
  }

  async function salvarPersonaWhatsappAi() {
    if (!whatsappAi?.channel) {
      toast("Salve primeiro o canal WhatsApp em rascunho.", "error");
      return;
    }
    const nome = formPersona.nome.trim();
    if (!nome) {
      toast("Informe o nome do atendente.", "error");
      return;
    }
    if (/^dino$/i.test(nome)) {
      toast(
        "O atendente não pode se chamar Dino: é o nome do barbeiro master.",
        "error",
      );
      return;
    }
    const resumo = formPersona.ativo
      ? `Confirmar o atendente "${nome}"? Muda só o jeito de falar (mensagens curtas, figurinhas). Agenda, confirmações e travas continuam iguais.`
      : "Desligar a persona e voltar ao texto padrão do atendente?";
    if (!window.confirm(resumo)) return;
    await executar(
      () =>
        api.patch("/api/admin/commerce/whatsapp-ai/persona", {
          id: "trex",
          ativo: formPersona.ativo,
          nome,
          mensagensCurtas: formPersona.mensagensCurtas,
          figurinhas: formPersona.figurinhas,
          revelarIa: formPersona.revelarIa,
          confirmed: true,
        }),
      formPersona.ativo
        ? `Atendente ${nome} salvo e auditado.`
        : "Persona desligada.",
    );
  }

  async function salvarHandoffWhatsappAi() {
    if (!whatsappAi?.channel) {
      toast("Salve primeiro o canal WhatsApp em rascunho.", "error");
      return;
    }
    const email = formWhatsappAiHandoff.notifyEmail.trim();
    const telefone = formWhatsappAiHandoff.attendantPhone.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast("E-mail de notificação inválido.", "error");
      return;
    }
    // Confirmação na própria tela: com as caixas de diálogo bloqueadas no navegador, o window.confirm
    // devolvia "não" sem aparecer e o botão parecia não fazer nada.
    if (!confirmandoHandoff) {
      setConfirmandoHandoff(true);
      return;
    }
    setConfirmandoHandoff(false);
    await executar(
      () =>
        api.patch("/api/admin/commerce/whatsapp-ai/handoff", {
          notifyEmail: email,
          attendantPhone: telefone,
          salesPhone: formWhatsappAiHandoff.salesPhone.trim(),
          confirmed: true,
        }),
      "Notificação de handoff salva e auditada.",
    );
  }

  async function sincronizarWhatsappAi() {
    if (
      !window.confirm(
        "Confirmar a sincronização do webhook no provedor de WhatsApp? Essa ação altera a configuração externa da instância informada.",
      )
    )
      return;
    await executar(async () => {
      const resultado = await api.post(
        "/api/admin/commerce/whatsapp-ai/channel/sync-webhook",
        { confirmed: true },
      );
      if (resultado?.manual && resultado.instructions)
        window.alert(resultado.instructions);
      return resultado;
    }, "Webhook do WhatsApp sincronizado.");
  }

  async function testarGeminiWhatsappAi() {
    if (
      !window.confirm(
        "Executar um diagnóstico curto do Gemini? O teste consome uma chamada mínima e não envia mensagem nem executa ferramentas.",
      )
    )
      return;
    await executar(
      () =>
        api.post("/api/admin/commerce/whatsapp-ai/diagnostics/gemini", {
          confirmed: true,
        }),
      "Gemini respondeu ao diagnóstico com sucesso.",
    );
  }

  async function assumirSessaoWhatsappAi(sessionId) {
    if (
      !window.confirm(
        "Assumir esta conversa na fila humana? A automação continuará pausada.",
      )
    )
      return;
    await executar(
      () =>
        api.post(
          `/api/admin/commerce/whatsapp-ai/sessions/${sessionId}/claim`,
          {},
        ),
      "Conversa atribuída ao operador.",
    );
  }

  async function liberarSessaoWhatsappAi(sessionId, pausaDaEquipe) {
    if (
      !window.confirm(
        pausaDaEquipe
          ? "A equipe terminou esta conversa no celular? A IA volta a responder este cliente agora."
          : "Retomar o atendimento automático desta conversa após concluir o handoff humano?",
      )
    )
      return;
    await executar(
      () =>
        api.post(
          `/api/admin/commerce/whatsapp-ai/sessions/${sessionId}/release`,
          {},
        ),
      "Atendimento automático retomado.",
    );
  }

  async function encerrarSessaoWhatsappAi(sessionId) {
    if (
      !window.confirm(
        "Encerrar esta conversa humana? A ação pendente será descartada e a automação não enviará resposta nesta sessão.",
      )
    )
      return;
    await executar(
      () =>
        api.post(
          `/api/admin/commerce/whatsapp-ai/sessions/${sessionId}/close`,
          {},
        ),
      "Conversa humana encerrada.",
    );
  }

  async function enviarWhatsApp(event) {
    event.preventDefault();
    const cliente = clientes.find((item) => item.id === formWhatsApp.clienteId);
    const telefone = formWhatsApp.telefone.trim() || cliente?.telefone || "";
    const consentiu =
      cliente?.consentimentos?.whatsapp?.[formWhatsApp.finalidade]
        ?.concedido === true;
    if (!telefone || !formWhatsApp.mensagem.trim()) return;
    if (cliente && !consentiu) {
      toast(
        "O cliente ainda não possui consentimento para esta finalidade.",
        "error",
      );
      return;
    }
    if (!cliente && !formWhatsApp.consentimentoConfirmado) {
      toast("Confirme a autorização do destinatário antes de enviar.", "error");
      return;
    }
    if (
      !window.confirm(
        "Confirmar o envio desta mensagem pelo WhatsApp? O envio será feito agora para o destinatário autorizado.",
      )
    )
      return;
    await executar(
      () =>
        api.post("/api/admin/barbearia/whatsapp/enviar", {
          ...formWhatsApp,
          telefone,
          confirmado: true,
        }),
      "Mensagem enviada pelo WhatsApp.",
    );
    setFormWhatsApp({
      clienteId: "",
      finalidade: "atendimento",
      telefone: "",
      mensagem: "",
      consentimentoConfirmado: false,
    });
  }

  async function consultarAssistente(event) {
    event.preventDefault();
    if (!assistentePergunta.trim()) return;
    setConsultandoAssistente(true);
    try {
      const resposta = await api.post("/api/admin/barbearia/ia/assistente", {
        pergunta: assistentePergunta,
        data: dataSelecionada,
      });
      setAssistenteResposta(resposta);
    } catch (error) {
      setAssistenteResposta({
        erro: error.message || "Não foi possível consultar o assistente IA.",
      });
    } finally {
      setConsultandoAssistente(false);
    }
  }

  function confirmarVendaRevenda(venda) {
    setFormPagamentoVendaRevenda({ meioPagamento: "pix" });
    setModal({ tipo: "pagamentoVendaRevenda", venda });
  }

  async function concluirPagamentoVendaRevenda(event) {
    event.preventDefault();
    const venda = modal?.venda;
    if (!venda || !formPagamentoVendaRevenda.meioPagamento) return;
    if (
      !window.confirm(
        `Confirmar recebimento manual de ${moeda(venda.total)} para a venda ${venda.id}? Esta ação baixa estoque e registra receita no financeiro.`,
      )
    )
      return;
    await executar(
      () =>
        api.post(
          `/api/admin/barbearia/vendas-revenda/${venda.id}/confirmar-pagamento`,
          {
            confirmadoPagamento: true,
            meioPagamento: formPagamentoVendaRevenda.meioPagamento,
            valorRecebido: venda.total,
          },
        ),
      "Venda confirmada, estoque baixado e receita registrada.",
    );
  }

  function renderAgendaTabela(itens = agendamentos) {
    return (
      <Card style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}
        >
          <thead>
            <tr style={styles.tableHead}>
              {[
                "Horário",
                "Cliente",
                "Profissional",
                "Serviço",
                "Valor",
                "Status",
                "Ações",
              ].map((coluna) => (
                <th key={coluna} style={styles.th}>
                  {coluna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 ? (
              <tr>
                <td colSpan={7} style={styles.empty}>
                  Nenhum atendimento encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              itens.map((item) => {
                const proximas = TRANSICOES[item.status] || [];
                return (
                  <tr
                    key={item.id}
                    style={{ borderTop: "1px solid var(--line)" }}
                  >
                    <td
                      style={{
                        ...styles.td,
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {horario(item.dataHora)}
                    </td>
                    <td style={styles.td}>
                      <strong>
                        {item.clienteNome ||
                          item.cliente_nome ||
                          "Cliente não informado"}
                      </strong>
                      <div style={styles.sub}>
                        {item.clienteTelefone || item.cliente_telefone || "—"}
                      </div>
                    </td>
                    <td style={styles.td}>
                      {item.profissionalNome ||
                        item.profissional_nome ||
                        "Qualquer profissional"}
                    </td>
                    <td style={styles.td}>
                      {item.servicoNome || item.servico_nome || "—"}
                      <div style={styles.sub}>
                        {item.duracaoMinutos || item.duracao_minutos || 0} min
                      </div>
                    </td>
                    <td
                      style={{
                        ...styles.td,
                        textAlign: "right",
                        fontWeight: 800,
                      }}
                    >
                      {moeda(item.valor)}
                    </td>
                    <td style={styles.td}>
                      <Badge
                        status={statusVisualAgendamento(
                          item,
                          configuracao?.confirmacaoAutomaticaAtiva === true,
                        )}
                      />
                    </td>
                    <td style={{ ...styles.td, minWidth: 170 }}>
                      <div
                        style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
                      >
                        {proximas.slice(0, 2).map((proximo) => (
                          <button
                            key={proximo}
                            type="button"
                            style={styles.small}
                            onClick={() => mudarStatus(item, proximo)}
                          >
                            {STATUS[proximo]?.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          style={styles.small}
                          onClick={() => abrirHistoricoCliente(item)}
                          title="Abre o histórico completo do cliente em nova guia"
                        >
                          Histórico ↗
                        </button>
                        {item.status === "concluido" &&
                          !item.financeiroLancamentoId && (
                            <button
                              type="button"
                              style={{
                                ...styles.small,
                                color: "var(--accent)",
                              }}
                              onClick={() => abrirRecebimento(item)}
                            >
                              Registrar recebimento
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    );
  }

  function renderVisaoGeral() {
    const proximos = dashboard?.proximosAgendamentos || [];
    const atividadeRecente = [
      ...agendamentos.map((item) => ({
        id: `agenda-${item.id}`,
        titulo: `Atendimento · ${item.clienteNome || item.cliente_nome || "Cliente"}`,
        nota: `${item.servicoNome || item.servico_nome || "Serviço"} · ${STATUS[item.status]?.label || item.status || "Sem status"}`,
        ts: item.atualizadoEm || item.criadoEm || item.dataHora,
        status: item.status,
      })),
      ...comandas.map((item) => ({
        id: `comanda-${item.id}`,
        titulo: `Comanda ${item.id}`,
        nota: `${item.clienteNome || "Cliente eventual"} · ${moeda(item.total)} · ${STATUS[item.status]?.label || item.status || "Sem status"}`,
        ts: item.atualizadoEm || item.criadoEm,
        status: item.status,
      })),
      ...vendasRevenda.map((item) => ({
        id: `venda-${item.id}`,
        titulo: `Revenda · ${item.id}`,
        nota: `${item.clienteNome || "Venda balcão"} · ${moeda(item.total)} · ${STATUS[item.status === "pago" ? "paga" : item.status]?.label || item.status || "Sem status"}`,
        ts: item.atualizadoEm || item.criadoEm,
        status: item.status === "pago" ? "paga" : item.status,
      })),
    ]
      .filter((item) => item.ts)
      .sort((a, b) => String(b.ts).localeCompare(String(a.ts)))
      .slice(0, 6);
    const rankingAtendentes = [...(comissoes?.porProfissional || [])]
      .sort(
        (a, b) =>
          Number(b.brutoServicos || 0) +
          Number(b.brutoProdutos || 0) -
          (Number(a.brutoServicos || 0) + Number(a.brutoProdutos || 0)),
      )
      .slice(0, 5);
    return (
      <div style={{ display: "grid", gap: 20 }}>
        {isDinoBrand && <DinoBusinessDashboard onOpenTab={navegarParaTab} />}
        <Card style={styles.todayHero}>
          <div style={styles.todayHeroTop}>
            <div>
              <div style={styles.kicker}>Ritual de abertura</div>
              <h2 style={{ ...styles.h2, fontSize: 23, marginTop: 5 }}>
                Hoje na unidade
              </h2>
              <p style={{ ...styles.sub, maxWidth: 700 }}>
                Comece pela agenda, acompanhe quem está aguardando e resolva as
                pendências antes do primeiro atendimento.
              </p>
            </div>
            <div style={styles.todayStatus}>
              <span>Data operacional</span>
              <strong>{fmtDateOnly(dataSelecionada)}</strong>
              <input
                aria-label="Escolher data operacional"
                type="date"
                value={dataSelecionada}
                onChange={(event) =>
                  event.target.value && setDataSelecionada(event.target.value)
                }
                style={styles.compactDate}
              />
              <small>
                {dashboard?.caixa?.aberto
                  ? "Caixa aberto"
                  : "Caixa ainda não aberto"}
              </small>
            </div>
          </div>
          <div style={styles.quickActions} aria-label="Atalhos da operação">
            <button
              type="button"
              style={styles.primary}
              onClick={() => navegarParaTab("Agenda")}
            >
              Abrir agenda
            </button>
            <button
              type="button"
              style={styles.secondary}
              onClick={() => navegarParaTab("Atendimento")}
            >
              Abrir atendimento
            </button>
            <button
              type="button"
              style={styles.secondary}
              onClick={() => navegarParaTab("Caixa e fechamento")}
            >
              Abrir caixa
            </button>
            <button
              type="button"
              style={styles.secondary}
              onClick={() => navegarParaTab("Fila e bloqueios")}
            >
              Ver fila e bloqueios
            </button>
            <button
              type="button"
              style={styles.secondary}
              onClick={() => {
                setFormCliente({
                  nome: "",
                  telefone: "",
                  email: "",
                  dataNascimento: "",
                  observacao: "",
                });
                setModal("cliente");
              }}
            >
              Cadastrar cliente
            </button>
          </div>
        </Card>
        <div style={styles.kpiGrid}>
          <Kpi
            label="Atendimentos hoje"
            value={indicadores.agendamentosHoje || 0}
            note={`${indicadores.confirmadosHoje || 0} confirmados`}
          />
          <Kpi
            label="Em atendimento"
            value={indicadores.emAtendimento || 0}
            note="Fila operacional atual"
            color="#f59e0b"
          />
          <Kpi
            label="Concluídos hoje"
            value={indicadores.concluidosHoje || 0}
            note={moeda(indicadores.faturamentoHoje)}
            color="#14b87a"
          />
          <Kpi
            label="Clientes no CRM"
            value={indicadores.clientesAtivos || 0}
            note={`${indicadores.profissionaisAtivos || 0} profissionais ativos`}
            color="#8b5cf6"
          />
          <Kpi
            label="Fila ativa"
            value={indicadores.filaAguardando || 0}
            note="Aguardando ou chamados"
            color="#4a9eff"
          />
          <Kpi
            label="Bloqueios hoje"
            value={indicadores.bloqueiosHoje || 0}
            note={`${indicadores.assinaturasAtivas || 0} assinaturas ativas`}
            color="#f59e0b"
          />
          <Kpi
            label="Revendas pagas"
            value={indicadores.vendasRevendaHoje || 0}
            note={moeda(indicadores.receitaRevendaHoje)}
            color="#14b87a"
          />
          <Kpi
            label="Comandas em aberto"
            value={resumoComandas?.abertas || 0}
            note={`${resumoComandas?.aguardandoPagamento || 0} aguardando pagamento`}
            color="#f59e0b"
          />
        </div>
        <div style={styles.twoColumns}>
          <Card style={{ padding: 20 }}>
            <div style={styles.sectionTitle}>
              <div>
                <h2 style={styles.h2}>Próximos atendimentos</h2>
                <p style={styles.sub}>Agenda persistida da empresa ativa.</p>
              </div>
              <button
                type="button"
                style={styles.primary}
                onClick={abrirNovoAgendamento}
              >
                Novo agendamento
              </button>
            </div>
            {proximos.length === 0 ? (
              <div style={styles.empty}>
                A agenda está livre para os próximos horários. Nenhuma reserva
                foi criada automaticamente.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {proximos.map((item) => (
                  <div key={item.id} style={styles.listRow}>
                    <div>
                      <strong>
                        {horario(item.dataHora)} ·{" "}
                        {item.clienteNome || item.cliente_nome}
                      </strong>
                      <div style={styles.sub}>
                        {item.servicoNome || item.servico_nome} ·{" "}
                        {item.profissionalNome ||
                          item.profissional_nome ||
                          "sem profissional"}
                      </div>
                    </div>
                    <Badge
                      status={statusVisualAgendamento(
                        item,
                        configuracao?.confirmacaoAutomaticaAtiva === true,
                      )}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card style={{ padding: 20 }}>
            <div style={styles.sectionTitle}>
              <div>
                <h2 style={styles.h2}>Financeiro e caixa</h2>
                <p style={styles.sub}>Resumo em leitura do ERP central.</p>
              </div>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={styles.metricLine}>
                <span>Receitas pagas no mês</span>
                <strong>{moeda(dashboard?.financeiro?.recMes)}</strong>
              </div>
              <div style={styles.metricLine}>
                <span>A receber</span>
                <strong>{moeda(dashboard?.financeiro?.aReceber)}</strong>
              </div>
              <div style={styles.metricLine}>
                <span>Saldo acumulado</span>
                <strong>{moeda(dashboard?.financeiro?.saldo)}</strong>
              </div>
              <div style={styles.metricLine}>
                <span>Caixa do dia</span>
                <strong>
                  {dashboard?.caixa?.aberto ? "Aberto" : "Não aberto"}
                </strong>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 18,
              }}
            >
              <a href="/admin/financeiro" style={styles.secondary}>
                Abrir financeiro
              </a>
              <a href="/admin/caixa" style={styles.secondary}>
                Abrir caixa
              </a>
              <a href="/admin/crm" style={styles.secondary}>
                Abrir CRM
              </a>
              <a href="/admin/estoque" style={styles.secondary}>
                Abrir estoque
              </a>
            </div>
          </Card>
        </div>
        <div style={styles.twoColumns}>
          <Card style={{ padding: 20 }}>
            <div style={styles.sectionTitle}>
              <div>
                <div style={styles.kicker}>Recepção</div>
                <h2 style={{ ...styles.h2, marginTop: 4 }}>
                  Fila e capacidade agora
                </h2>
                <p style={styles.sub}>
                  Acompanhe a espera da unidade sem sair da visão principal.
                </p>
              </div>
              <button
                type="button"
                style={styles.secondary}
                onClick={() => navegarParaTab("Fila e bloqueios")}
              >
                Gerenciar fila
              </button>
            </div>
            {(dashboard?.filaEspera || []).length === 0 ? (
              <div style={styles.inlineEmpty}>
                <strong>Fila vazia</strong>
                <span>
                  Nenhum cliente aguardando ou chamado para a data selecionada.
                </span>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {dashboard.filaEspera.slice(0, 5).map((item) => (
                  <div key={item.id} style={styles.queueRow}>
                    <div>
                      <strong>
                        {item.senha} · {item.clienteNome || "Cliente eventual"}
                      </strong>
                      <small>{item.previsaoMinutos || 0} min de previsão</small>
                    </div>
                    <Badge
                      status={
                        item.status === "aguardando"
                          ? "agendado"
                          : "em_atendimento"
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card style={{ padding: 20 }}>
            <div style={styles.sectionTitle}>
              <div>
                <div style={styles.kicker}>Controle</div>
                <h2 style={{ ...styles.h2, marginTop: 4 }}>
                  Pendências do dia
                </h2>
                <p style={styles.sub}>
                  Ações recomendadas com base nos dados carregados.
                </p>
              </div>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {[
                [
                  indicadores.profissionaisAtivos
                    ? "Equipe cadastrada"
                    : "Cadastrar equipe",
                  indicadores.profissionaisAtivos
                    ? `${indicadores.profissionaisAtivos} atendente(s) ativo(s)`
                    : "A agenda precisa de atendentes",
                  "Profissionais",
                  indicadores.profissionaisAtivos ? "ok" : "attention",
                ],
                [
                  indicadores.servicosAtivos
                    ? "Catálogo disponível"
                    : "Cadastrar serviços",
                  indicadores.servicosAtivos
                    ? `${indicadores.servicosAtivos} serviço(s) ativo(s)`
                    : "Defina preço e duração para agendar",
                  "Serviços",
                  indicadores.servicosAtivos ? "ok" : "attention",
                ],
                [
                  dashboard?.caixa?.aberto ? "Caixa aberto" : "Conferir caixa",
                  dashboard?.caixa?.aberto
                    ? "Operação financeira em andamento"
                    : "Abra o caixa antes do primeiro recebimento",
                  "Caixa e fechamento",
                  dashboard?.caixa?.aberto ? "ok" : "attention",
                ],
              ].map(([titulo, nota, destino, estado]) => (
                <button
                  type="button"
                  key={titulo}
                  onClick={() =>
                    navegarParaTab(
                      destino === "Gestão" ? "Configuração" : destino,
                    )
                  }
                  style={{
                    ...styles.actionRow,
                    ...(estado === "attention"
                      ? styles.actionRowAttention
                      : {}),
                  }}
                >
                  <span>
                    <strong>{titulo}</strong>
                    <small>{nota}</small>
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
        <div style={styles.twoColumns}>
          <Card style={{ padding: 20 }}>
            <div style={styles.sectionTitle}>
              <div>
                <div style={styles.kicker}>Ritmo da unidade</div>
                <h2 style={styles.h2}>Atividade recente</h2>
                <p style={styles.sub}>
                  Eventos persistidos no overview, sem simulação ou atualização
                  automática.
                </p>
              </div>
              <button type="button" style={styles.secondary} onClick={carregar}>
                Atualizar
              </button>
            </div>
            {atividadeRecente.length === 0 ? (
              <div style={styles.inlineEmpty}>
                <strong>Nenhuma atividade recente</strong>
                <span>
                  Agendamentos, comandas e revendas aparecerão aqui quando
                  existirem na unidade.
                </span>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {atividadeRecente.map((item) => (
                  <div key={item.id} style={styles.feedRow}>
                    <div>
                      <strong>{item.titulo}</strong>
                      <small>{item.nota}</small>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <Badge status={item.status} />
                      <small>{fmtDate(item.ts)}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card style={{ padding: 20 }}>
            <div style={styles.sectionTitle}>
              <div>
                <div style={styles.kicker}>Desempenho</div>
                <h2 style={styles.h2}>Top atendentes</h2>
                <p style={styles.sub}>
                  Ranking indicativo por bruto apurado no recorte selecionado.
                </p>
              </div>
              <button
                type="button"
                style={styles.secondary}
                onClick={() => navegarParaTab("Comissões")}
              >
                Ver comissões
              </button>
            </div>
            {rankingAtendentes.length === 0 ? (
              <div style={styles.inlineEmpty}>
                <strong>Sem apuração ainda</strong>
                <span>
                  Conclua atendimentos ou confirme vendas para formar o ranking
                  real.
                </span>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {rankingAtendentes.map((item, indice) => (
                  <div key={item.profissionalId} style={styles.feedRow}>
                    <div>
                      <strong>
                        {indice + 1}. {item.profissionalNome}
                      </strong>
                      <small>
                        {item.atendimentos || 0} atendimento(s) ·{" "}
                        {item.vendasProdutos || 0} revenda(s)
                      </small>
                    </div>
                    <strong>
                      {moeda(
                        Number(item.brutoServicos || 0) +
                          Number(item.brutoProdutos || 0),
                      )}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
        <Card style={{ padding: 20 }}>
          <div style={styles.sectionTitle}>
            <div>
              <div style={styles.kicker}>Próximas ações</div>
              <h2 style={{ ...styles.h2, marginTop: 4 }}>
                Prontidão operacional
              </h2>
              <p style={styles.sub}>
                O módulo reutiliza cadastros e livros existentes; nenhuma venda,
                reserva ou pagamento é simulado.
              </p>
            </div>
            <span style={styles.contextPill}>
              {indicadores.profissionaisAtivos && indicadores.servicosAtivos
                ? "Base pronta"
                : "Completar cadastros"}
            </span>
          </div>
          <div style={styles.readinessGrid}>
            {[
              [
                "Profissionais",
                indicadores.profissionaisAtivos,
                "Cadastre a equipe e percentuais de comissão.",
              ],
              [
                "Serviços",
                indicadores.servicosAtivos,
                "Defina duração e preço para a agenda.",
              ],
              [
                "Clientes",
                indicadores.clientesAtivos,
                "Clientes são persistidos no CRM por empresa.",
              ],
              [
                "Financeiro",
                dashboard?.financeiro ? "Conectado" : "Indisponível",
                "Recebimentos exigem confirmação explícita.",
              ],
            ].map(([titulo, valor, nota]) => (
              <div key={titulo} style={styles.readinessItem}>
                <strong>{titulo}</strong>
                <span style={{ color: "var(--accent)", fontWeight: 800 }}>
                  {valor || 0}
                </span>
                <small style={styles.sub}>{nota}</small>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  function renderAgenda() {
    const unidade = configuracaoUnidade?.calendario;
    const atendentesAtivos = profissionais.filter(
      (item) =>
        item && item.ativo !== false && !item.removidoEm && !item.excluido,
    );

    return (
      <div style={{ display: "grid", gap: 12 }}>
        {bloqueios.length > 0 && (
          <Card
            style={{
              padding: "10px 14px",
              background: "rgba(245, 158, 11, 0.05)",
              borderColor: "rgba(245, 158, 11, 0.3)",
              borderRadius: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong
                  style={{
                    color: "#f59e0b",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  🔒 {bloqueios.length} horário(s) bloqueado(s) no dia
                </strong>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  (almoços e pausas na unidade)
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {bloqueios.map((b) => {
                  const profNome = b.profissionalId
                    ? profissionais.find((p) => p.id === b.profissionalId)
                        ?.nome || "Profissional"
                    : "Toda a unidade";
                  return (
                    <span
                      key={b.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 11.5,
                      }}
                    >
                      <strong>
                        {horario(b.inicio)}–{horario(b.fim)}
                      </strong>{" "}
                      {profNome}
                      <button
                        type="button"
                        style={{
                          background: "transparent",
                          border: 0,
                          color: "#ef4444",
                          cursor: "pointer",
                          padding: 0,
                          fontSize: 11,
                        }}
                        onClick={() => desativarBloqueio(b)}
                        title="Liberar este horário"
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
                <button
                  type="button"
                  style={{
                    ...styles.secondary,
                    padding: "3px 8px",
                    fontSize: 11.5,
                  }}
                  onClick={() => {
                    setFormBloqueio({
                      titulo: "Almoço",
                      motivo: "Horário de almoço",
                      inicioHora: "12:00",
                      fimHora: "13:00",
                      profissionalId: profissionalFiltro || "",
                      data: dataSelecionada,
                    });
                    setModal("bloqueioAgenda");
                  }}
                >
                  + Bloqueio
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* Agenda Visual Clean e Independente no Padrão Google Agenda / Avec */}
        <BarbeariaAgendaPeriodo
          profissionais={atendentesAtivos}
          servicos={servicos}
          profissionalId={profissionalFiltro}
          onProfissionalChange={setProfissionalFiltro}
          onConferirComanda={conferirComandaDoAtendimento}
          onOpenAppointment={conferirComandaDoAtendimento}
          onPickSlot={abrirAgendamentoNoHorario}
          refreshKey={agendaRevisao}
          dataSelecionada={dataSelecionada}
          onDateChange={setDataSelecionada}
          statusFiltro={statusFiltro}
          onNewAppointment={abrirNovoAgendamento}
          onBloquearAgenda={(dados) => {
            setFormBloqueio((atual) => ({
              ...atual,
              data: dados?.data || dataSelecionada,
              dataInicio: dados?.data || dataSelecionada,
              dataFim: dados?.data || dataSelecionada,
              profissionalId: dados?.profissionalId || "",
            }));
            setModal("bloqueioAgenda");
          }}
          onDesativarBloqueio={desativarBloqueio}
        />
      </div>
    );
  }

  function renderAtendimento() {
    return (
      <div style={{ display: "grid", gap: 18 }}>
        <BarbeariaComandasAbertas
          key={scopeKey}
          profissionais={profissionais}
          onOpen={abrirComanda}
          onNovaComanda={() => abrirNovaComanda(null)}
          refreshKey={agendaRevisao}
        />
        <BarbeariaAtendimentoBoard
          dataSelecionada={dataSelecionada}
          onDateChange={(novaData) => setDataSelecionada(novaData)}
          agendamentos={agendamentos}
          profissionais={profissionais}
          servicos={servicos}
          produtosRevenda={produtosRevenda}
          comandas={comandas}
          onStatusChange={mudarStatusAtendimento}
          onConferirComanda={conferirComandaDoAtendimento}
          onOpenAppointment={conferirComandaDoAtendimento}
          onOpenComanda={abrirComanda}
          onCreateComanda={(item) => abrirNovaComanda(item)}
          onNewAppointment={abrirNovoAgendamento}
          onNewComanda={() => abrirNovaComanda()}
          onOpenRecebimento={abrirRecebimento}
          onOpenHistorico={abrirHistoricoCliente}
          onReassignBarber={reatribuirBarbeiroAtendimento}
          onCreateEncaixe={criarEncaixeRapido}
          onAddItemComanda={adicionarItemComandaRapido}
          onRefresh={carregar}
          onBloquearAgenda={(dados) => {
            setFormBloqueio((atual) => ({
              ...atual,
              data: dados?.data || dataSelecionada,
              dataInicio: dados?.data || dataSelecionada,
              dataFim: dados?.data || dataSelecionada,
              profissionalId: dados?.profissionalId || "",
            }));
            setModal("bloqueioAgenda");
          }}
          loading={loading}
        />
      </div>
    );
  }

  function renderOperacao() {
    return (
      <div style={{ display: "grid", gap: 20 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card)', padding: '12px 20px', borderRadius: 12, border: '1px solid var(--line)', marginBottom: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Data da Operação:</span>
          <strong style={{ fontSize: 16 }}>{fmtDateOnly(dataSelecionada)}</strong>
          <input
            aria-label="Escolher data operacional"
            type="date"
            value={dataSelecionada}
            onChange={(event) =>
              event.target.value && setDataSelecionada(event.target.value)
            }
            style={{ ...styles.compactDate, marginLeft: 10 }}
          />
        </div>
        <BarbeariaComandasAbertas
          key={scopeKey}
          profissionais={profissionais}
          onOpen={abrirComanda}
          onNovaComanda={() => abrirNovaComanda(null)}
          refreshKey={agendaRevisao}
        />
        <BarbeariaOperacaoPanel
          data={dataSelecionada}
          operacao={operacao || {}}
          comandas={comandas}
          profissionais={profissionais}
          onOpenComanda={abrirComanda}
          onCancelarComandaFinalizada={cancelarComandaFinalizada}
          onOpenCaixa={abrirCaixaOperacao}
          onMove={movimentarCaixaOperacao}
          onClose={fecharCaixaOperacao}
          onCloseDay={fecharDiaOperacao}
         onViewDay={(fechamento) => {
           setFechamentoDetalhado(fechamento);
           setModal("fechamentoDia");
         }}
         onRefresh={carregar}
         toast={toast}
         salvando={salvando}
       />
      </div>
    );
  }

  function renderPreviaTaxasMateriais() {
    return (
      <BarbeariaCaixaPrevia
        key={scopeKey}
        servicos={servicos}
        empresaId={empresaAtiva?.id || user?.empresaId || ""}
        lojaId={lojaAtiva?.id || user?.lojaId || ""}
      />
    );
  }

  function renderClientes() {
    const indicadoresRelacionamento = relacionamento?.indicadores || {};
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            background: "var(--surface)",
            padding: 6,
            borderRadius: 12,
            border: "1px solid var(--border)",
          }}
        >
          <button
            type="button"
            onClick={() => setSubAbaClientes("carteira")}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background:
                subAbaClientes === "carteira" ? "#f59e0b" : "transparent",
              color: subAbaClientes === "carteira" ? "#000000" : "var(--text)",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            💈 Carteira de Clientes (Dino, Nat, etc.)
          </button>
          <button
            type="button"
            onClick={() => setSubAbaClientes("crm")}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: subAbaClientes === "crm" ? "#f59e0b" : "transparent",
              color: subAbaClientes === "crm" ? "#000000" : "var(--text)",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            📋 Todos os Clientes (Visão CRM 360°)
          </button>
        </div>

        {subAbaClientes === "carteira" ? (
          <Suspense
            fallback={
              <Card
                style={{
                  padding: 40,
                  textAlign: "center",
                  color: "var(--muted)",
                }}
              >
                Carregando carteira de clientes…
              </Card>
            }
          >
            <DinoCarteiraClientesPanel
              onNovoCliente={() => {
                setFormCliente({
                  nome: "",
                  telefone: "",
                  email: "",
                  dataNascimento: "",
                  limiteCreditoMensal: 500,
                  diasVencimento: 30,
                  observacao: "",
                });
                setModal("cliente");
              }}
            />
          </Suspense>
        ) : (
          <>
            <Card style={{ padding: 16 }}>
              <div style={styles.sectionTitle}>
                <div>
                  <div style={styles.kicker}>CRM 360°</div>
                  <h2 style={styles.h2}>Relacionamento da unidade</h2>
                  <p style={styles.sub}>
                    {isDinoBrand
                      ? "Visitas, receita, contas e consentimentos conectados à central governada de campanhas WhatsApp."
                      : "Uma leitura consolidada de visitas, receita, contas e permissões de contato. O painel não envia mensagens nem cria campanhas."}
                  </p>
                </div>
                <div style={styles.tableActions}>
                  <button
                    type="button"
                    style={styles.primary}
                    onClick={() => {
                      setFormCliente({
                        nome: "",
                        telefone: "",
                        email: "",
                        dataNascimento: "",
                        limiteCreditoMensal: 500,
                        diasVencimento: 30,
                        observacao: "",
                      });
                      setModal("cliente");
                    }}
                  >
                    + Novo cliente
                  </button>
                  <button
                    type="button"
                    style={styles.secondary}
                    onClick={() => navigate("/admin/clientes-360")}
                  >
                    Clientes 360
                  </button>
                </div>
              </div>
              <div style={styles.kpiGrid}>
                <Kpi
                  label="Clientes ativos"
                  value={
                    indicadoresRelacionamento.clientesAtivos || clientes.length
                  }
                  note="Empresa ativa"
                />
                <Kpi
                  label="Com visita"
                  value={indicadoresRelacionamento.clientesComVisita || 0}
                  note="Atendimento concluído"
                  color="#8b5cf6"
                />
                <Kpi
                  label="Membros fidelidade"
                  value={indicadoresRelacionamento.membrosFidelidade || 0}
                  note="Adesão registrada"
                  color="#f59e0b"
                />
                <Kpi
                  label="Receita recebida"
                  value={moeda(indicadoresRelacionamento.receitaRecebida || 0)}
                  note="Comandas e revenda pagas"
                  color="#14b87a"
                />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "end",
                  marginTop: 16,
                }}
              >
                <label style={{ flex: "1 1 280px", minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      color: "var(--muted)",
                      fontSize: 12,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    Buscar cliente
                  </span>
                  <input
                    value={busca}
                    onChange={(event) => setBusca(event.target.value)}
                    placeholder="Nome, telefone ou e-mail"
                    style={inputStyle}
                  />
                </label>
                <label style={{ flex: "0 1 230px", minWidth: 190 }}>
                  <span
                    style={{
                      display: "block",
                      color: "var(--muted)",
                      fontSize: 12,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    Segmento operacional
                  </span>
                  <select
                    value={filtroClientes}
                    onChange={(event) => setFiltroClientes(event.target.value)}
                    style={inputStyle}
                  >
                    <option value="todos">Todos os clientes</option>
                    <option value="ativos">Com visita registrada</option>
                    <option value="fidelidade">Membros de fidelidade</option>
                    <option value="consentimento">Com consentimento</option>
                    <option value="inativos">Sem visita registrada</option>
                  </select>
                </label>
              </div>
            </Card>
            {isDinoBrand && <DinoCRMPreditivo />}
            {isDinoBrand && <DinoCampaignsPanel />}
            <Card style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 980,
                }}
              >
                <thead>
                  <tr style={styles.tableHead}>
                    {[
                      "Cliente",
                      "Contato",
                      "Visitas",
                      "Receita",
                      "A receber",
                      "Consentimentos",
                      "Última atividade",
                    ].map((coluna) => (
                      <th key={coluna} style={styles.th}>
                        {coluna}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listaBuscaClientes.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={styles.empty}>
                        Nenhum cliente encontrado no CRM desta empresa.
                      </td>
                    </tr>
                  ) : (
                    listaBuscaClientes.map((cliente) => {
                      const resumo = relacionamentoPorCliente[cliente.id] || {};
                      const consentimentos = cliente.consentimentos || {};
                      const concedidos = ["whatsapp", "email"]
                        .flatMap((canal) =>
                          ["atendimento", "marketing"].map(
                            (finalidade) =>
                              consentimentos[canal]?.[finalidade]?.concedido ===
                              true,
                          ),
                        )
                        .filter(Boolean).length;
                      return (
                        <tr
                          key={cliente.id}
                          style={{ borderTop: "1px solid var(--line)" }}
                        >
                          <td style={styles.td}>
                            <a
                              href={urlHistoricoCliente(
                                refHistoricoCliente(cliente),
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: 0,
                                border: 0,
                                background: "transparent",
                                color: "#38bdf8",
                                font: "inherit",
                                fontWeight: 800,
                                cursor: "pointer",
                                textAlign: "left",
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                              title="Abrir Customer 360 e histórico em nova guia"
                            >
                              {cliente.nome} ↗
                            </a>
                            <div style={styles.sub}>
                              {cliente.tipo === "pj"
                                ? "Pessoa jurídica"
                                : "Pessoa física"}
                            </div>
                          </td>
                          <td style={styles.td}>
                            {cliente.telefone || "—"}
                            <div style={styles.sub}>{cliente.email || "—"}</div>
                          </td>
                          <td style={{ ...styles.td, fontWeight: 800 }}>
                            {resumo.visitas || 0}
                            <div style={styles.sub}>
                              {resumo.agendamentos || 0} agendamento(s)
                            </div>
                          </td>
                          <td style={{ ...styles.td, fontWeight: 800 }}>
                            {moeda(resumo.receitaRecebida || 0)}
                          </td>
                          <td
                            style={{
                              ...styles.td,
                              fontWeight: 800,
                              color:
                                Number(
                                  resumo.aReceber || cliente.saldoDevedor || 0,
                                ) > 0
                                  ? "#f59e0b"
                                  : "inherit",
                            }}
                          >
                            {moeda(
                              resumo.aReceber ?? cliente.saldoDevedor ?? 0,
                            )}
                          </td>
                          <td style={styles.td}>
                            <strong>{concedidos}/4</strong>
                            <div style={styles.sub}>
                              {concedidos
                                ? "Permissões ativas"
                                : "Nenhuma permissão"}
                            </div>
                          </td>
                          <td style={styles.td}>
                            {resumo.ultimaAtividadeEm
                              ? fmtDate(resumo.ultimaAtividadeEm)
                              : "Sem atividade"}
                            <div style={styles.tableActions}>
                              <a
                                href={urlHistoricoCliente(
                                  refHistoricoCliente(cliente),
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  ...styles.small,
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                                title="Abrir Ficha 360 e histórico em nova guia"
                              >
                                Ficha 360 ↗
                              </a>
                              <button
                                type="button"
                                style={styles.small}
                                onClick={() => abrirCliente(cliente)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                style={{
                                  ...styles.small,
                                  color: "var(--accent)",
                                }}
                                onClick={() => agendarParaCliente(cliente)}
                              >
                                Agendar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </div>
    );
  }

  function renderProfissionais() {
    const equipeAtual = profissionais.filter((item) => !item.removidoEm);
    return (
      <div style={{ display: "grid", gap: 16 }}>
        {isDinoBrand && <DinoSplitPagamento />}
        {renderProfissionaisTabela(equipeAtual)}
      </div>
    );
  }

  function renderProfissionaisTabela(equipeAtual) {
    const slugifyBarbeiro = (valor) => String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Card style={{ padding: 16 }}>
          <div style={styles.toolbar}>
            <div>
              <h2 style={styles.h2}>Equipe da unidade</h2>
              <p style={styles.sub}>
                Percentuais ficam no cadastro e podem alimentar a apuração, sem
                gerar repasse automaticamente.
              </p>
            </div>
            <button
              type="button"
              style={styles.primary}
              onClick={abrirNovoProfissional}
            >
              + Novo profissional
            </button>
          </div>
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar na equipe"
            style={{ ...inputStyle, marginTop: 14, maxWidth: 420 }}
          />
        </Card>
        <Card style={styles.teamSummary}>
          {[
            [
              "Ativos",
              profissionais.filter((item) => item.ativo !== false).length,
              "Disponíveis para agenda",
              "#14b87a",
            ],
            [
              "Atendimentos hoje",
              agendamentos.length,
              "Carga da unidade",
              "var(--accent)",
            ],
            [
              "Comissão média",
              equipeAtual.length
                ? `${Math.round(equipeAtual.reduce((soma, item) => soma + Number(item.percentualComissao || 0), 0) / equipeAtual.length)}%`
                : "—",
              "Serviços concluídos",
              "#8b5cf6",
            ],
            [
              "Sem jornada",
              equipeAtual.filter(
                (item) => !item.horarioInicio || !item.horarioFim,
              ).length,
              "Revisar disponibilidade",
              "#f59e0b",
            ],
          ].map(([label, value, note, color]) => (
            <div key={label} style={styles.teamSummaryItem}>
              <strong style={{ color }}>{value}</strong>
              <span>{label}</span>
              <small>{note}</small>
            </div>
          ))}
        </Card>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
            gap: 14,
          }}
        >
          {listaBuscaProfissionais.length === 0 ? (
            <Card style={styles.empty}>
              Nenhum profissional cadastrado na empresa ativa.
            </Card>
          ) : (
            listaBuscaProfissionais.map((profissional) => (
              <Card
                key={profissional.id}
                style={{
                  padding: 18,
                  opacity: profissional.ativo === false ? 0.62 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{ ...styles.avatar, overflow: "hidden", padding: 0 }}
                  >
                    {profissional.fotoUrl ? (
                      <img
                        src={profissional.fotoUrl}
                        alt={`Foto de ${profissional.nome}`}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      iniciais(profissional.nome)
                    )}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ fontSize: 17, overflowWrap: "anywhere" }}>
                      {profissional.nome}
                    </strong>
                    <div style={styles.sub}>
                      {profissional.especialidade} · {profissional.tipo}
                    </div>
                  </div>
                </div>
                <div style={styles.profileGrid}>
                  <div>
                    <small style={styles.sub}>Comissão serviço</small>
                    <strong>{profissional.percentualComissao}%</strong>
                  </div>
                  <div>
                    <small style={styles.sub}>Comissão produto</small>
                    <strong>{profissional.percentualComissaoProduto}%</strong>
                  </div>
                  <div>
                    <small style={styles.sub}>Horário</small>
                    <strong>
                      {profissional.horarioInicio}–{profissional.horarioFim}
                    </strong>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 5, marginTop: 14 }}>
                  {DIAS.map((dia, indice) => (
                    <span
                      key={dia}
                      style={{
                        width: 32,
                        height: 28,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 6,
                        background: (profissional.diasTrabalho || []).includes(
                          indice,
                        )
                          ? "var(--accent)"
                          : "var(--bg)",
                        color: (profissional.diasTrabalho || []).includes(
                          indice,
                        )
                          ? "#fff"
                          : "var(--muted)",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      {dia.slice(0, 3)}
                    </span>
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 15,
                  }}
                >
                  <button
                    type="button"
                    style={{ ...styles.secondary, flex: "1 1 150px" }}
                    onClick={() => editarProfissional(profissional)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    style={{
                      ...styles.primary,
                      flex: "1 1 200px",
                      background: "#6E7CE0",
                      color: "#fff",
                      fontSize: 12,
                    }}
                    onClick={() => setProfissionalLinkModal(profissional)}
                  >
                    🔗 Link Online (Bio/Zap)
                  </button>
                  <button
                    type="button"
                    style={{ ...styles.secondary, flex: "1 1 170px" }}
                    onClick={() => alternarProfissional(profissional)}
                  >
                    {profissional.ativo === false ? "Reativar" : "Desativar"}
                  </button>
                  <button
                    type="button"
                    style={{
                      ...styles.small,
                      flex: "0 1 auto",
                      color: "#e05c5c",
                      borderColor:
                        "color-mix(in srgb, #e05c5c 45%, var(--line))",
                    }}
                    onClick={() => excluirProfissional(profissional)}
                  >
                    Excluir
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>
        {renderExcluidos(profissionais, "profissionais", "Profissional")}
        {profissionalLinkModal && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: 16,
            }}
            onClick={() => setProfissionalLinkModal(null)}
          >
            <Card
              style={{
                maxWidth: 480,
                width: "100%",
                padding: 24,
                background: "var(--card)",
                border: "1.5px solid #6E7CE0",
                display: "grid",
                gap: 16,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  ✂️ Link de {profissionalLinkModal.nome}
                </h3>
                <button
                  type="button"
                  style={{ ...styles.small, background: "none", border: "none", fontSize: 18, cursor: "pointer" }}
                  onClick={() => setProfissionalLinkModal(null)}
                >
                  ✕
                </button>
              </div>

              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                Link exclusivo e responsivo para publicar no Instagram (Bio/Stories), enviar no WhatsApp e usar na bancada. O cliente navega pelos dias e vê horários livres sem expor a agenda.
              </p>

              <div
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  wordBreak: "break-all",
                  fontFamily: "monospace",
                  fontSize: 13,
                  color: "#10b981",
                }}
              >
                {`${window.location.origin}/agendar/${formConfig.slugPublico || "dino"}/${slugifyBarbeiro(profissionalLinkModal.nome)}`}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  type="button"
                  style={{ ...styles.primary, background: "#6E7CE0", color: "#fff" }}
                  onClick={() => {
                    const url = `${window.location.origin}/agendar/${formConfig.slugPublico || "dino"}/${slugifyBarbeiro(profissionalLinkModal.nome)}`;
                    navigator.clipboard?.writeText(url);
                    alert("Link copiado para a área de transferência!");
                  }}
                >
                  📋 Copiar Link
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Olá! Agende seu corte ou barba comigo direto pelo meu link exclusivo: ${window.location.origin}/agendar/${formConfig.slugPublico || "dino"}/${slugifyBarbeiro(profissionalLinkModal.nome)}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...styles.secondary, textAlign: "center", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  💬 WhatsApp
                </a>
              </div>

              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(`${typeof window !== "undefined" ? window.location.origin : "https://kytto.com.br"}/agendar/${formConfig.slugPublico || "dino"}/${slugifyBarbeiro(profissionalLinkModal.nome)}`)}`}
                  alt="QR Code do barbeiro"
                  style={{ borderRadius: 12, border: "4px solid #fff", display: "inline-block" }}
                />
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                  QR Code para imprimir ou mostrar na bancada
                </div>
              </div>

              <button
                type="button"
                style={{ ...styles.secondary, width: "100%" }}
                onClick={() => setProfissionalLinkModal(null)}
              >
                Fechar
              </button>
            </Card>
          </div>
        )}
      </div>
    );
  }

  function renderServicos() {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {isDinoBrand && <DinoPrecoDinamico />}
        {renderServicosTabela()}
      </div>
    );
  }

  function renderServicosTabela() {
    const servicosDoGrupo = listaBuscaServicos.filter(
      (s) =>
        grupoServicos === "todos" ||
        (s.grupoServico || "nao_classificado") === grupoServicos,
    );
    const categorias = [
      ...new Set(
        listaBuscaServicos.map((servico) => servico.categoria || "Geral"),
      ),
    ];
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Card
          style={{
            padding: 18,
            background:
              "linear-gradient(135deg, color-mix(in srgb, #8b5cf6 10%, var(--card)), var(--card))",
          }}
        >
          <div style={styles.sectionTitle}>
            <div>
              <div style={styles.kicker}>Catálogo comercial</div>
              <h2 style={{ ...styles.h2, fontSize: 22, marginTop: 5 }}>
                Serviços da barbearia
              </h2>
              <p style={styles.sub}>
                Veja preço, duração, categoria, descrição e disponibilidade de
                cada serviço. O mesmo catálogo alimenta a agenda e os planos.
              </p>
            </div>
            <button
              type="button"
              style={styles.primary}
              onClick={() => abrirServico()}
            >
              + Novo serviço
            </button>
          </div>
          <div style={styles.serviceSummary}>
            {[
              [
                "Serviços ativos",
                listaBuscaServicos.filter((servico) => servico.ativo !== false)
                  .length,
                "#14b87a",
              ],
              ["Categorias", categorias.length, "#8b5cf6"],
              [
                "Agendamento online",
                listaBuscaServicos.filter(
                  (servico) =>
                    servico.permiteAgendamentoOnline !== false &&
                    servico.ativo !== false,
                ).length,
                "#4a9eff",
              ],
            ].map(([label, value, color]) => (
              <div key={label} style={styles.serviceSummaryItem}>
                <strong style={{ color }}>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por nome, categoria ou descrição"
            style={{ ...inputStyle, marginTop: 16, maxWidth: 520 }}
          />
        </Card>
        <div
          role="group"
          aria-label="Grupos de serviços"
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          {[
            ["todos", "Todos"],
            ["convencionais", "Convencionais · cabelo e barba"],
            ["extras", "Extras"],
            ["nao_classificado", "A classificar"],
          ].map(([id, nome]) => (
            <button
              key={id}
              type="button"
              aria-pressed={grupoServicos === id}
              style={grupoServicos === id ? styles.primary : styles.secondary}
              onClick={() => setGrupoServicos(id)}
            >
              {nome} (
              {
                listaBuscaServicos.filter(
                  (s) =>
                    id === "todos" ||
                    (s.grupoServico || "nao_classificado") === id,
                ).length
              }
              )
            </button>
          ))}
        </div>
        {servicosDoGrupo.length === 0 ? (
          <Card style={styles.empty}>
            Nenhum serviço encontrado neste grupo ou na busca. Use “Todos” ou
            cadastre um serviço.
          </Card>
        ) : (
          <div style={styles.serviceGrid}>
            {servicosDoGrupo.map((servico) => (
              <Card
                key={servico.id}
                style={{
                  padding: 17,
                  opacity: servico.ativo === false ? 0.58 : 1,
                }}
              >
                <div style={styles.serviceCardTop}>
                  <div>
                    <span style={styles.serviceCategory}>
                      {servico.grupoServico === "convencionais"
                        ? "Convencionais"
                        : servico.grupoServico === "extras"
                          ? "Extras"
                          : "A classificar"}{" "}
                      · {servico.categoria || "Geral"}
                      {servico.grupoServicoSugerido ? " (sugestão)" : ""}
                    </span>
                    <h3 style={{ margin: "8px 0 4px", fontSize: 18 }}>
                      {servico.nome}
                    </h3>
                  </div>
                  <strong style={{ color: "var(--accent)", fontSize: 18 }}>
                    {rotuloPreco(servico)}
                  </strong>
                </div>
                <p
                  style={{
                    margin: "10px 0 14px",
                    color: "var(--muted)",
                    minHeight: 38,
                    fontSize: 13,
                  }}
                >
                  {servico.descricao || "Descrição ainda não preenchida."}
                </p>
                <div style={styles.serviceFacts}>
                  <span>
                    <strong>{servico.duracaoMinutos}</strong> min
                  </span>
                  <span>
                    {servico.permiteAgendamentoOnline !== false
                      ? "Online ativo"
                      : "Online desativado"}
                  </span>
                  <span>
                    {servico.consumoInterno?.length
                      ? `${servico.consumoInterno.length} insumo(s) por atendimento`
                      : "Sem consumo interno"}
                  </span>
                  <Badge
                    status={servico.ativo === false ? "cancelado" : "concluido"}
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 96px auto",
                    gap: 8,
                    alignItems: "end",
                    marginTop: 12,
                  }}
                >
                  <label
                    style={{
                      display: "grid",
                      gap: 5,
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    Intervalo de recomendação (dias)
                    <input
                      type="number"
                      min="0"
                      max="3650"
                      step="1"
                      aria-label={`Intervalo de recomendação de ${servico.nome} em dias`}
                      value={
                        intervaloServicoDrafts[servico.id] ??
                        servico.intervaloRecomendacaoDias ??
                        0
                      }
                      onChange={(event) =>
                        setIntervaloServicoDrafts((atual) => ({
                          ...atual,
                          [servico.id]: event.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </label>
                  <button
                    type="button"
                    style={styles.small}
                    onClick={() => salvarPeriodicidadeServico(servico)}
                  >
                    Salvar
                  </button>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      marginBottom: 6,
                    }}
                  >
                    Quem faz este serviço{" "}
                    {servico.profissionaisIds?.length
                      ? ""
                      : "· todos os profissionais"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {profissionais
                      .filter((profissional) => profissional.ativo !== false)
                      .map((profissional) => {
                        const marcado = (
                          servico.profissionaisIds || []
                        ).includes(profissional.id);
                        return (
                          <button
                            key={profissional.id}
                            type="button"
                            aria-pressed={marcado}
                            onClick={() =>
                              alternarProfissionalDoServico(
                                servico,
                                profissional.id,
                              )
                            }
                            style={{
                              ...styles.small,
                              borderColor: marcado
                                ? "var(--accent)"
                                : undefined,
                              color: marcado ? "var(--accent)" : undefined,
                              fontWeight: marcado ? 700 : 500,
                            }}
                          >
                            {marcado ? "✓ " : ""}
                            {profissional.nome}
                          </button>
                        );
                      })}
                  </div>
                </div>
                {botoesCadastro({
                  item: servico,
                  rota: "servicos",
                  rotulo: "Serviço",
                  historico:
                    "agendamentos, comandas, planos e o histórico de atendimentos",
                  onEditar: () => abrirServico(servico),
                })}
              </Card>
            ))}
          </div>
        )}
        {renderExcluidos(servicos, "servicos", "Serviço")}
        <Card style={{ padding: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>
            Como o catálogo é utilizado
          </h3>
          <div style={styles.readinessGrid}>
            <div style={styles.readinessItem}>
              <strong>Agenda</strong>
              <small style={styles.sub}>
                Duração e preço são usados na reserva e no conflito de horários.
              </small>
            </div>
            <div style={styles.readinessItem}>
              <strong>Atendimento</strong>
              <small style={styles.sub}>
                O operador visualiza o serviço no cartão do cliente.
              </small>
            </div>
            <div style={styles.readinessItem}>
              <strong>Planos</strong>
              <small style={styles.sub}>
                Os serviços ativos podem ser associados a planos sem cobrança
                automática.
              </small>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  function renderComissoes() {
    const porProfissional = comissoes?.porProfissional || [];
    const meiosTaxa = [
      ["pix", "PIX"],
      ["debito", "Débito"],
      ["credito", "Crédito"],
      ["cartao", "Cartão genérico"],
      ["transferencia", "Transferência"],
      ["tef", "TEF"],
      ["carteira", "Carteira"],
    ];
    const taxasTotal = porProfissional.reduce(
      (soma, item) => soma + Number(item.taxas || 0),
      0,
    );
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Card style={{ padding: 18 }}>
          <div style={styles.toolbar}>
            <div>
              <h2 style={styles.h2}>Comissões e rateio</h2>
              <p style={styles.sub}>
                Apuração indicativa de serviços concluídos e produtos pagos em{" "}
                {fmtDateOnly(dataSelecionada)}. Nenhuma taxa é presumida: sem
                cadastro comprovado, o repasse usa o bruto e a taxa permanece
                indisponível.
              </p>
            </div>
            <a href="/admin/financeiro" style={styles.secondary}>
              Ver livro financeiro
            </a>
          </div>
        </Card>
        <div style={styles.kpiGrid}>
          <Kpi
            label="Bruto apurado"
            value={moeda(
              porProfissional.reduce(
                (soma, item) => soma + Number(item.bruto || 0),
                0,
              ),
            )}
            note="Serviços e produtos pagos"
          />
          <Kpi
            label="Taxas comprovadas"
            value={comissoes?.taxasConfiguradas ? moeda(taxasTotal) : "—"}
            note={
              comissoes?.taxasConfiguradas
                ? "Somente regras cadastradas com fonte"
                : "Indisponível: nenhuma taxa real cadastrada"
            }
            color="#f59e0b"
          />
          <Kpi
            label="Repasse indicativo"
            value={moeda(
              porProfissional.reduce(
                (soma, item) => soma + Number(item.repasse || 0),
                0,
              ),
            )}
            note="Não é pagamento"
            color="#14b87a"
          />
          <Kpi
            label="Vendas sem profissional"
            value={comissoes?.vendasSemProfissional || 0}
            note={moeda(comissoes?.brutoSemProfissional)}
            color="#e05c5c"
          />
        </div>
        {comissoes?.meiosSemTaxaConfigurada?.length > 0 && (
          <div style={styles.notice}>
            <strong>Taxa não aplicada</strong>
            <div style={styles.sub}>
              Sem regra comprovada para:{" "}
              {comissoes.meiosSemTaxaConfigurada.join(", ")}. O sistema não
              inventou desconto e calculou a comissão sobre o bruto.
            </div>
          </div>
        )}
        <Card style={{ padding: 18 }}>
          <div style={styles.sectionTitle}>
            <div>
              <h3 style={{ margin: 0 }}>Taxas reais por meio</h3>
              <p style={styles.sub}>
                Cadastre somente percentuais e valores fixos do contrato/extrato
                da adquirente. Zerar ambos remove a regra.
              </p>
            </div>
          </div>
          <form
            onSubmit={salvarConfiguracao}
            style={{ display: "grid", gap: 10 }}
          >
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: 760,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr style={styles.tableHead}>
                    {["Meio", "%", "Fixa (R$)", "Fonte obrigatória"].map(
                      (coluna) => (
                        <th key={coluna} style={styles.th}>
                          {coluna}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {meiosTaxa.map(([meio, label]) => {
                    const regra = formConfig?.taxasPagamento?.[meio] || {};
                    return (
                      <tr
                        key={meio}
                        style={{ borderTop: "1px solid var(--line)" }}
                      >
                        <td style={styles.td}>
                          <strong>{label}</strong>
                        </td>
                        <td style={styles.td}>
                          <input
                            aria-label={`Taxa percentual ${label}`}
                            type="number"
                            min="0"
                            max="100"
                            step="0.0001"
                            value={regra.percentual ?? ""}
                            onChange={(event) =>
                              atualizarTaxaPagamento(
                                meio,
                                "percentual",
                                event.target.value,
                              )
                            }
                            style={{ ...inputStyle, minWidth: 110 }}
                          />
                        </td>
                        <td style={styles.td}>
                          <input
                            aria-label={`Taxa fixa ${label}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={regra.fixa ?? ""}
                            onChange={(event) =>
                              atualizarTaxaPagamento(
                                meio,
                                "fixa",
                                event.target.value,
                              )
                            }
                            style={{ ...inputStyle, minWidth: 110 }}
                          />
                        </td>
                        <td style={styles.td}>
                          <input
                            aria-label={`Fonte da taxa ${label}`}
                            value={regra.fonte ?? ""}
                            onChange={(event) =>
                              atualizarTaxaPagamento(
                                meio,
                                "fonte",
                                event.target.value,
                              )
                            }
                            placeholder="Contrato, extrato ou adquirente"
                            style={{ ...inputStyle, minWidth: 240 }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={styles.modalActions}>
              <button type="submit" style={styles.primary} disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar taxas comprovadas"}
              </button>
            </div>
          </form>
        </Card>
        <Card style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", minWidth: 940 }}
          >
            <thead>
              <tr style={styles.tableHead}>
                {[
                  "Profissional",
                  "Serviços",
                  "Produtos",
                  "Bruto serviços",
                  "Bruto produtos",
                  "Comissão serviços",
                  "Comissão produtos",
                  "Repasse indicativo",
                ].map((coluna) => (
                  <th key={coluna} style={styles.th}>
                    {coluna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {porProfissional.length === 0 ? (
                <tr>
                  <td colSpan={8} style={styles.empty}>
                    Ainda não há atendimentos concluídos ou vendas de produtos
                    atribuídas para apuração.
                  </td>
                </tr>
              ) : (
                porProfissional.map((item) => (
                  <tr
                    key={item.profissionalId}
                    style={{ borderTop: "1px solid var(--line)" }}
                  >
                    <td style={styles.td}>
                      <strong>{item.profissionalNome}</strong>
                      <div style={styles.sub}>
                        {item.percentualComissao}% serviços ·{" "}
                        {item.percentualComissaoProduto}% produtos
                      </div>
                    </td>
                    <td style={styles.td}>{item.atendimentos}</td>
                    <td style={styles.td}>{item.vendasProdutos}</td>
                    <td style={{ ...styles.td, fontWeight: 800 }}>
                      {moeda(item.brutoServicos)}
                    </td>
                    <td style={{ ...styles.td, fontWeight: 800 }}>
                      {moeda(item.brutoProdutos)}
                    </td>
                    <td
                      style={{
                        ...styles.td,
                        fontWeight: 800,
                        color: "#8b5cf6",
                      }}
                    >
                      {moeda(item.comissaoServicos)}
                    </td>
                    <td
                      style={{
                        ...styles.td,
                        fontWeight: 800,
                        color: "#8b5cf6",
                      }}
                    >
                      {moeda(item.comissaoProdutos)}
                    </td>
                    <td
                      style={{
                        ...styles.td,
                        fontWeight: 800,
                        color: "#14b87a",
                      }}
                    >
                      {moeda(item.repasse)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
        {(comissoes?.vendasSemProfissional || 0) > 0 && (
          <Card style={{ padding: 18 }}>
            <strong>Vendas sem profissional atribuído</strong>
            <div style={styles.sub}>
              {comissoes.vendasSemProfissional} venda(s), total de{" "}
              {moeda(comissoes.brutoSemProfissional)}. Elas não entram em
              repasse até uma atribuição operacional explícita.
            </div>
          </Card>
        )}
      </div>
    );
  }

  function renderFilaBloqueios() {
    const filaAtiva = fila.filter(
      (item) => item.status === "aguardando" || item.status === "chamado",
    );
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={styles.twoColumns}>
          <Card style={{ padding: 18 }}>
            <div style={styles.sectionTitle}>
              <div>
                <h2 style={styles.h2}>Fila de espera</h2>
                <p style={styles.sub}>
                  Senha por empresa e dia operacional; nenhum aviso externo é
                  enviado automaticamente.
                </p>
              </div>
              <strong style={{ color: "var(--accent)" }}>
                {filaAtiva.length} ativos
              </strong>
            </div>
            <form onSubmit={salvarFila} style={{ display: "grid", gap: 14 }}>
              <div style={styles.formGrid}>
                <Field label="Cliente cadastrado">
                  <select
                    value={formFila.clienteId}
                    onChange={(event) =>
                      setFormFila((atual) => ({
                        ...atual,
                        clienteId: event.target.value,
                        clienteNome: "",
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="">Selecionar cliente</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Nome eventual">
                  <input
                    value={formFila.clienteNome}
                    onChange={(event) =>
                      setFormFila((atual) => ({
                        ...atual,
                        clienteNome: event.target.value,
                        clienteId: "",
                      }))
                    }
                    style={inputStyle}
                    placeholder="Se não estiver no CRM"
                  />
                </Field>
                <Field label="Serviço">
                  <select
                    value={formFila.servicoId}
                    onChange={(event) =>
                      setFormFila((atual) => ({
                        ...atual,
                        servicoId: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="">Qualquer serviço</option>
                    {servicos
                      .filter((item) => item.ativo !== false)
                      .map((servico) => (
                        <option key={servico.id} value={servico.id}>
                          {servico.nome}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Preferência de profissional">
                  <select
                    value={formFila.preferenciaProfissionalId}
                    onChange={(event) =>
                      setFormFila((atual) => ({
                        ...atual,
                        preferenciaProfissionalId: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="">Qualquer profissional</option>
                    {profissionais
                      .filter((item) => item.ativo !== false)
                      .map((profissional) => (
                        <option key={profissional.id} value={profissional.id}>
                          {profissional.nome}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Previsão (min.)">
                  <input
                    type="number"
                    min="0"
                    max="720"
                    value={formFila.previsaoMinutos}
                    onChange={(event) =>
                      setFormFila((atual) => ({
                        ...atual,
                        previsaoMinutos: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>
                <Field label="Telefone eventual">
                  <input
                    value={formFila.clienteTelefone}
                    onChange={(event) =>
                      setFormFila((atual) => ({
                        ...atual,
                        clienteTelefone: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>
              </div>
              <button type="submit" style={styles.primary} disabled={salvando}>
                Adicionar à fila
              </button>
            </form>
          </Card>
          <Card style={{ padding: 18 }}>
            <div style={styles.sectionTitle}>
              <div>
                <h2 style={styles.h2}>Bloqueios da agenda</h2>
                <p style={styles.sub}>
                  Bloqueie horários ou dias inteiros para o Dino ou equipe. A IA T-Rex e o link público recusam reservas nestes intervalos.
                </p>
              </div>
              <strong style={{ color: "#f59e0b" }}>
                {bloqueios.length} ativos
              </strong>
            </div>

            {/* Presets Rápidos de 1 Clique */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, padding: "10px 12px", background: "rgba(245, 158, 11, 0.08)", borderRadius: 8, border: "1px dashed rgba(245, 158, 11, 0.3)" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", alignSelf: "center", marginRight: 4 }}>
                ⚡ Ações Rápidas:
              </span>
              <button
                type="button"
                style={{ padding: "6px 12px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                onClick={() => {
                  const dino = profissionais.find(p => /dino/i.test(p.nome));
                  setFormBloqueio({
                    titulo: "Ausência / Viagem Dino",
                    motivo: "Dino ausente (segunda e terça - agenda bloqueada)",
                    dataInicio: "2026-11-09",
                    dataFim: "2026-11-10",
                    diaTodo: true,
                    inicioHora: "00:00",
                    fimHora: "23:59",
                    profissionalId: dino ? dino.id : "",
                    periodo: "escolher_data",
                    diasSemana: [1, 2],
                  });
                }}
              >
                👑 Bloquear Seg e Ter (Dino)
              </button>
              <button
                type="button"
                style={{ padding: "6px 12px", background: "var(--bg-card)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
                onClick={() => {
                  const hoje = new Date().toISOString().slice(0, 10);
                  setFormBloqueio(atual => ({
                    ...atual,
                    dataInicio: hoje,
                    dataFim: hoje,
                    diaTodo: true,
                    inicioHora: "00:00",
                    fimHora: "23:59",
                    titulo: atual.titulo || "Folga / Ausência",
                  }));
                }}
              >
                📅 Bloquear Hoje (Dia Todo)
              </button>
              <button
                type="button"
                style={{ padding: "6px 12px", background: "var(--bg-card)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
                onClick={() => {
                  const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
                  setFormBloqueio(atual => ({
                    ...atual,
                    dataInicio: amanha,
                    dataFim: amanha,
                    diaTodo: true,
                    inicioHora: "00:00",
                    fimHora: "23:59",
                    titulo: atual.titulo || "Folga / Ausência",
                  }));
                }}
              >
                ⏭️ Bloquear Amanhã (Dia Todo)
              </button>
            </div>

            <form
              onSubmit={salvarBloqueio}
              style={{ display: "grid", gap: 14 }}
            >
              <div style={styles.formGrid}>
                <Field label="Profissional *">
                  <select
                    value={formBloqueio.profissionalId}
                    onChange={(event) =>
                      setFormBloqueio((atual) => ({
                        ...atual,
                        profissionalId: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="">🏢 Toda a unidade (bloqueio geral)</option>
                    {profissionais
                      .filter((item) => item.ativo !== false)
                      .map((profissional) => (
                        <option key={profissional.id} value={profissional.id}>
                          {/dino/i.test(profissional.nome) ? ("👑 " + profissional.nome + " (Dino)") : ("💈 " + profissional.nome)}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Título do Bloqueio *">
                  <input
                    required
                    value={formBloqueio.titulo}
                    onChange={(event) =>
                      setFormBloqueio((atual) => ({
                        ...atual,
                        titulo: event.target.value,
                      }))
                    }
                    style={inputStyle}
                    placeholder="Ex: Ausência Dino, Folga, Almoço, Manutenção…"
                  />
                </Field>
                <Field label="Data Início *">
                  <input
                    type="date"
                    required
                    value={formBloqueio.dataInicio || formBloqueio.data || dataSelecionada}
                    onChange={(event) => {
                      const v = event.target.value;
                      setFormBloqueio((atual) => ({
                        ...atual,
                        dataInicio: v,
                        dataFim: atual.dataFim && atual.dataFim >= v ? atual.dataFim : v,
                      }));
                    }}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Data Término (para períodos)">
                  <input
                    type="date"
                    value={formBloqueio.dataFim || formBloqueio.dataInicio || dataSelecionada}
                    onChange={(event) =>
                      setFormBloqueio((atual) => ({
                        ...atual,
                        dataFim: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>
                <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(0,0,0,0.02)", borderRadius: 6, border: "1px solid var(--border)" }}>
                  <input
                    type="checkbox"
                    id="chkDiaTodo"
                    checked={formBloqueio.diaTodo || formBloqueio.periodo === "dia_todo"}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormBloqueio(atual => ({
                        ...atual,
                        diaTodo: checked,
                        periodo: checked ? "dia_todo" : "apenas_dia",
                        inicioHora: checked ? "00:00" : (atual.inicioHora === "00:00" ? "08:00" : atual.inicioHora),
                        fimHora: checked ? "23:59" : (atual.fimHora === "23:59" ? "20:00" : atual.fimHora),
                      }));
                    }}
                    style={{ width: 18, height: 18, cursor: "pointer" }}
                  />
                  <label htmlFor="chkDiaTodo" style={{ fontSize: 13, fontWeight: 600, cursor: "pointer", margin: 0 }}>
                    Bloquear o dia todo (00:00 às 23:59) - Sem atendimentos nesta(s) data(s)
                  </label>
                </div>
                {!(formBloqueio.diaTodo || formBloqueio.periodo === "dia_todo") && (
                  <>
                    <Field label="Horário Início">
                      <input
                        type="time"
                        required
                        value={formBloqueio.inicioHora}
                        onChange={(event) =>
                          setFormBloqueio((atual) => ({
                            ...atual,
                            inicioHora: event.target.value,
                          }))
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Horário Fim">
                      <input
                        type="time"
                        required
                        value={formBloqueio.fimHora}
                        onChange={(event) =>
                          setFormBloqueio((atual) => ({
                            ...atual,
                            fimHora: event.target.value,
                          }))
                        }
                        style={inputStyle}
                      />
                    </Field>
                  </>
                )}
                <Field label="Motivo / Observações" full>
                  <input
                    value={formBloqueio.motivo}
                    onChange={(event) =>
                      setFormBloqueio((atual) => ({
                        ...atual,
                        motivo: event.target.value,
                      }))
                    }
                    style={inputStyle}
                    placeholder="Opcional: motivo da ausência ou aviso interno"
                  />
                </Field>
              </div>
              <button type="submit" style={styles.primary} disabled={salvando}>
                🔒 Criar e Salvar Bloqueio na Agenda
              </button>
            </form>
          </Card>
        </div>
        <Card style={{ padding: 18 }}>
          <div style={styles.sectionTitle}>
            <div>
              <h2 style={styles.h2}>
                Fila ativa de {fmtDateOnly(dataSelecionada)}
              </h2>
              <p style={styles.sub}>
                Chamar, marcar como atendido, ausente ou cancelar são ações
                manuais.
              </p>
            </div>
          </div>
          {fila.length === 0 ? (
            <div style={styles.empty}>
              Nenhuma senha registrada para esta data.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {fila.map((item) => (
                <div key={item.id} style={styles.listRow}>
                  <div>
                    <strong>
                      {item.senha} · {item.clienteNome || "Cliente eventual"}
                    </strong>
                    <div style={styles.sub}>
                      {item.servicoId
                        ? servicos.find(
                            (servico) => servico.id === item.servicoId,
                          )?.nome || "Serviço"
                        : "Qualquer serviço"}{" "}
                      · previsão {item.previsaoMinutos} min
                      {item.mesaOuPosicao ? ` · ${item.mesaOuPosicao}` : ""}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    <Badge
                      status={
                        item.status === "aguardando"
                          ? "agendado"
                          : item.status === "chamado"
                            ? "em_atendimento"
                            : item.status
                      }
                    />
                    <>
                      {item.status === "aguardando" && (
                        <button
                          type="button"
                          style={styles.small}
                          onClick={() => alterarFila(item, "chamado")}
                        >
                          Chamar
                        </button>
                      )}
                      {item.status === "chamado" && (
                        <button
                          type="button"
                          style={styles.small}
                          onClick={() => alterarFila(item, "atendido")}
                        >
                          Atendido
                        </button>
                      )}
                      {["aguardando", "chamado"].includes(item.status) && (
                        <button
                          type="button"
                          style={styles.small}
                          onClick={() => alterarFila(item, "cancelado")}
                        >
                          Cancelar
                        </button>
                      )}
                    </>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card style={{ padding: 18 }}>
          <div style={styles.sectionTitle}>
            <div>
              <h2 style={styles.h2}>Bloqueios ativos da agenda ({bloqueios.length})</h2>
              <p style={styles.sub}>
                A agenda e a IA T-Rex recusam reservas que sobreponham estes intervalos.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                value={filtroBloqueioProf}
                onChange={(e) => setFiltroBloqueioProf(e.target.value)}
                style={{ ...inputStyle, width: "auto", fontSize: 12, padding: "4px 8px" }}
              >
                <option value="">Todos os profissionais</option>
                {profissionais.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          </div>
          {bloqueios.filter(b => !filtroBloqueioProf || b.profissionalId === filtroBloqueioProf).length === 0 ? (
            <div style={styles.empty}>Nenhum bloqueio cadastrado para os filtros selecionados.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {bloqueios
                .filter(b => !filtroBloqueioProf || b.profissionalId === filtroBloqueioProf)
                .map((item) => {
                  const prof = item.profissionalId ? profissionais.find(p => p.id === item.profissionalId) : null;
                  const ehDiaTodo = (item.inicio && item.fim && item.inicio.slice(11, 16) === "00:00" && item.fim.slice(11, 16) === "23:59") || (horario(item.inicio) === "00:00" && (horario(item.fim) === "23:59" || horario(item.fim) === "00:00"));
                  return (
                    <div key={item.id} style={{ ...styles.listRow, borderLeft: prof && /dino/i.test(prof.nome) ? "4px solid #f59e0b" : "4px solid var(--accent)" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <strong style={{ fontSize: 14 }}>{item.titulo}</strong>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: prof && /dino/i.test(prof.nome) ? "rgba(245, 158, 11, 0.15)" : "rgba(37, 99, 235, 0.1)", color: prof && /dino/i.test(prof.nome) ? "#b45309" : "var(--accent)", fontWeight: 600 }}>
                            {prof ? (/dino/i.test(prof.nome) ? ("👑 " + prof.nome) : ("💈 " + prof.nome)) : "🏢 Toda a Unidade"}
                          </span>
                          {ehDiaTodo && (
                            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "rgba(239, 68, 68, 0.1)", color: "#b91c1c", fontWeight: 600 }}>
                              Dia Todo
                            </span>
                          )}
                        </div>
                        <div style={styles.sub}>
                          📅 {fmtDateOnly(item.inicio.slice(0, 10))} {item.inicio.slice(0, 10) !== item.fim.slice(0, 10) ? (" até " + fmtDateOnly(item.fim.slice(0, 10))) : ""} · 🕒 {horario(item.inicio)}–{horario(item.fim)}
                          {item.motivo ? (" · Motivo: " + item.motivo) : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        style={{ ...styles.small, color: "#dc2626", borderColor: "#fca5a5", cursor: "pointer" }}
                        onClick={() => desativarBloqueio(item)}
                      >
                        🗑️ Desbloquear
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      </div>
    );
  }

  function renderPlanosAssinaturas() {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <BarbeariaPlanosAssinaturasPanel
          planos={planos}
          assinaturas={assinaturas}
          profissionais={profissionais}
          clientes={clientes}
          servicos={servicos}
          salvando={salvando}
          onSalvarPlano={async (corpo) => {
            const payload = corpo.id
              ? api.patch(`/api/admin/barbearia/planos/${corpo.id}`, corpo)
              : api.post("/api/admin/barbearia/planos", corpo);
            await executar(
              () => payload,
              corpo.id
                ? "Plano atualizado com sucesso."
                : "Plano VIP/Recorrência criado com sucesso.",
            );
          }}
          onSalvarAssinatura={async (dados) => {
            const conteudo = JSON.stringify(dados);
            if (pedidoAssinatura.current?.conteudo !== conteudo) {
              pedidoAssinatura.current = {
                conteudo,
                chave: crypto.randomUUID(),
              };
            }
            const chaveIdempotencia = pedidoAssinatura.current.chave;
            await executar(async () => {
              const resposta = await api.post(
                "/api/admin/barbearia/assinaturas",
                { ...dados, chaveIdempotencia },
              );
              pedidoAssinatura.current = null;
              return resposta;
            }, "Assinatura criada e vinculada ao profissional com sucesso.");
          }}
          onAlterarStatusAssinatura={alterarStatusAssinatura}
          onAtivarAssinatura={ativarAssinatura}
          onExcluirPlano={(plano) =>
            excluirCadastro(
              "planos",
              plano,
              "Plano",
              "as assinaturas já vendidas, sessões usadas e pagamentos",
            )
          }
          onReativarPlano={(plano) =>
            restaurarCadastro("planos", plano, "Plano")
          }
        />
        {renderExcluidos(planos, "planos", "Plano")}
      </div>
    );
  }

  function renderFidelidade() {
    const membrosIds = new Set(
      (fidelidade.membros || []).map((membro) => membro.clienteId),
    );
    const disponiveis = clientes.filter(
      (cliente) => !membrosIds.has(cliente.id),
    );
    const pontosTotais = (fidelidade.membros || []).reduce(
      (total, membro) => total + Number(membro.pontos || 0),
      0,
    );
    const movimentosRecentes = (fidelidade.movimentos || []).slice(0, 8);
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Card style={{ padding: 18 }}>
          <div style={styles.sectionTitle}>
            <div>
              <div style={styles.kicker}>Retenção</div>
              <h2 style={styles.h2}>Programa de fidelidade</h2>
              <p style={styles.sub}>
                Pontos vinculados ao CRM da empresa ativa. O crédito automático
                ocorre somente após uma comanda integralmente paga; ajustes
                manuais exigem confirmação.
              </p>
            </div>
            <Badge
              status={
                fidelidade.regra?.ativa === false ? "cancelado" : "concluido"
              }
            />
          </div>
          <div style={styles.kpiGrid}>
            <Kpi
              label="Membros"
              value={fidelidade.membros?.length || 0}
              note="Clientes aderidos"
              color="#8b5cf6"
            />
            <Kpi
              label="Pontos em carteira"
              value={pontosTotais}
              note="Saldo disponível"
              color="#f59e0b"
            />
            <Kpi
              label="Créditos registrados"
              value={fidelidade.movimentos?.length || 0}
              note="Ledger da empresa"
              color="#14b87a"
            />
            <Kpi
              label="Ponto estimado"
              value={moeda(fidelidade.regra?.valorPonto || 0)}
              note="Não é dinheiro disponível"
            />
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const cliente = clientes.find(
                (item) => item.id === clienteFidelidadeId,
              );
              if (cliente) aderirFidelidade(cliente);
            }}
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "end",
              marginTop: 16,
            }}
          >
            <Field label="Adicionar cliente">
              <select
                value={clienteFidelidadeId}
                onChange={(event) => setClienteFidelidadeId(event.target.value)}
                style={{ ...inputStyle, minWidth: 260 }}
              >
                <option value="">Selecionar cliente do CRM</option>
                {disponiveis.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="submit"
              style={styles.primary}
              disabled={!clienteFidelidadeId || salvando}
            >
              Aderir ao programa
            </button>
          </form>
        </Card>
        <Card style={{ padding: 18 }}>
          <div style={styles.sectionTitle}>
            <div>
              <h2 style={styles.h2}>Regra de pontos</h2>
              <p style={styles.sub}>
                A configuração não altera caixa nem financeiro e vale para novos
                créditos.
              </p>
            </div>
          </div>
          <form
            onSubmit={salvarRegraFidelidade}
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              alignItems: "end",
            }}
          >
            <Field label="Pontos por R$ 1,00">
              <input
                type="number"
                min="0"
                value={formFidelidade.pontosPorReal ?? 0}
                onChange={(event) =>
                  setFormFidelidade((atual) => ({
                    ...atual,
                    pontosPorReal: event.target.value,
                  }))
                }
                style={{ ...inputStyle, width: 160 }}
              />
            </Field>
            <Field label="Valor estimado do ponto">
              <input
                type="number"
                min="0"
                step="0.01"
                value={formFidelidade.valorPonto ?? 0}
                onChange={(event) =>
                  setFormFidelidade((atual) => ({
                    ...atual,
                    valorPonto: event.target.value,
                  }))
                }
                style={{ ...inputStyle, width: 160 }}
              />
            </Field>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                paddingBottom: 10,
              }}
            >
              <input
                type="checkbox"
                checked={formFidelidade.ativa !== false}
                onChange={(event) =>
                  setFormFidelidade((atual) => ({
                    ...atual,
                    ativa: event.target.checked,
                  }))
                }
              />{" "}
              Programa ativo
            </label>
            <button type="submit" style={styles.primary} disabled={salvando}>
              Salvar regra
            </button>
          </form>
        </Card>
        <Card style={{ padding: 18 }}>
          <div style={styles.sectionTitle}>
            <div>
              <h2 style={styles.h2}>Membros</h2>
              <p style={styles.sub}>
                {fidelidade.membros?.length || 0} clientes aderidos.
              </p>
            </div>
          </div>
          {!fidelidade.membros?.length ? (
            <div style={styles.empty}>Nenhum cliente aderiu ao programa.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {fidelidade.membros.map((membro) => (
                <div key={membro.id} style={styles.listRow}>
                  <div>
                    <strong>{membro.nome}</strong>
                    <div style={styles.sub}>
                      {membro.pontos || 0} pontos · nível{" "}
                      {membro.nivel || "bronze"} ·{" "}
                      {membro.pontosAcumulados || membro.pontos || 0} acumulados
                    </div>
                  </div>
                  <button
                    type="button"
                    style={styles.small}
                    onClick={() => abrirCreditoFidelidade(membro)}
                  >
                    Ajuste manual
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card style={{ padding: 18 }}>
          <div style={styles.sectionTitle}>
            <div>
              <h2 style={styles.h2}>Últimos créditos</h2>
              <p style={styles.sub}>
                Trilha operacional; repetições com a mesma chave não duplicam
                pontos.
              </p>
            </div>
          </div>
          {!movimentosRecentes.length ? (
            <div style={styles.empty}>
              Nenhum crédito registrado. Pagamentos elegíveis aparecerão aqui
              quando houver membro aderido.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {movimentosRecentes.map((movimento) => (
                <div key={movimento.id} style={styles.listRow}>
                  <div>
                    <strong>
                      {clientes.find(
                        (cliente) => cliente.id === movimento.clienteId,
                      )?.nome || "Cliente"}
                    </strong>
                    <div style={styles.sub}>
                      {movimento.origem || "venda"} ·{" "}
                      {movimento.criadoEm ? fmtDate(movimento.criadoEm) : "—"}
                    </div>
                  </div>
                  <strong style={{ color: "#14b87a" }}>
                    +{movimento.pontos} pts
                  </strong>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  function renderEstoqueRevenda() {
    const baixos = produtosRevenda.filter(
      (produto) => produto.ativo !== false && produto.statusEstoque !== "ok",
    );
    const termo = busca.trim().toLowerCase();
    const produtosVisiveis = produtosRevenda
      .filter((produto) => !produto.removidoEm)
      .filter(
        (produto) =>
          !termo ||
          [produto.nome, produto.sku, produto.categoria].some((item) =>
            String(item || "")
              .toLowerCase()
              .includes(termo),
          ),
      );
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Card style={{ padding: 18 }}>
          <div style={styles.sectionTitle}>
            <div>
              <div style={styles.kicker}>Revenda independente</div>
              <h2 style={styles.h2}>Estoque de revenda</h2>
              <p style={styles.sub}>
                Catálogo exclusivo da empresa ativa. Não é o estoque de cardápio
                e não se conecta automaticamente ao Commerce.
              </p>
            </div>
            <button
              type="button"
              style={styles.primary}
              onClick={() => abrirProdutoRevenda()}
            >
              + Novo produto
            </button>
          </div>
          <div style={styles.kpiGrid}>
            <Kpi
              label="Produtos ativos"
              value={
                produtosRevenda.filter((produto) => produto.ativo !== false)
                  .length
              }
            />
            <Kpi
              label="Abaixo do mínimo"
              value={baixos.length}
              color={baixos.length ? "#f59e0b" : "#14b87a"}
            />
            <Kpi
              label="Sem estoque"
              value={
                produtosRevenda.filter(
                  (produto) => produto.statusEstoque === "sem_estoque",
                ).length
              }
              color="#e05c5c"
            />
          </div>
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar produto por nome, SKU ou categoria"
            style={{ ...inputStyle, marginTop: 16, maxWidth: 520 }}
          />
        </Card>
        {baixos.length > 0 && (
          <Card style={styles.attentionPanel}>
            <div style={styles.sectionTitle}>
              <div>
                <h2 style={styles.h2}>Atenção de estoque</h2>
                <p style={styles.sub}>
                  Estes produtos estão abaixo do mínimo ou sem saldo. A tela não
                  cria compras automaticamente.
                </p>
              </div>
              <button
                type="button"
                style={styles.secondary}
                onClick={() => setBusca("")}
              >
                Mostrar todos
              </button>
            </div>
            <div style={styles.alertList}>
              {baixos.slice(0, 6).map((produto) => (
                <div key={produto.id} style={styles.alertRow}>
                  <span>
                    <strong>{produto.nome}</strong>
                    <small>
                      {produto.estoqueAtual} disponíveis · mínimo{" "}
                      {produto.estoqueMinimo}
                    </small>
                  </span>
                  <Badge
                    status={
                      produto.statusEstoque === "baixo"
                        ? "chamado"
                        : "cancelado"
                    }
                  />
                </div>
              ))}
            </div>
          </Card>
        )}
        <Card style={{ padding: 18, overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}
          >
            <thead>
              <tr style={styles.tableHead}>
                {[
                  "Produto",
                  "Categoria",
                  "Preço",
                  "Saldo",
                  "Mínimo",
                  "Recompra (dias)",
                  "Situação",
                  "Movimento",
                  "Cadastro",
                ].map((coluna) => (
                  <th key={coluna} style={styles.th}>
                    {coluna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {produtosVisiveis.length === 0 ? (
                <tr>
                  <td colSpan={9} style={styles.empty}>
                    {produtosRevenda.length === 0
                      ? "Nenhum produto de revenda cadastrado."
                      : "Nenhum produto corresponde à busca."}
                  </td>
                </tr>
              ) : (
                produtosVisiveis.map((produto) => (
                  <tr
                    key={produto.id}
                    style={{
                      borderTop: "1px solid var(--line)",
                      opacity: produto.ativo === false ? 0.58 : 1,
                    }}
                  >
                    <td style={styles.td}>
                      <strong>{produto.nome}</strong>
                      <div style={styles.sub}>
                        {produto.sku || "Sem SKU"} · {produto.unidade || "un"}
                      </div>
                    </td>
                    <td style={styles.td}>{produto.categoria}</td>
                    <td style={{ ...styles.td, fontWeight: 800 }}>
                      {moeda(produto.precoVenda)}
                    </td>
                    <td style={{ ...styles.td, fontWeight: 800 }}>
                      {produto.estoqueAtual}
                    </td>
                    <td style={styles.td}>{produto.estoqueMinimo}</td>
                    <td style={styles.td}>
                      <div
                        style={{
                          display: "flex",
                          gap: 5,
                          alignItems: "center",
                        }}
                      >
                        <input
                          type="number"
                          min="0"
                          max="3650"
                          step="1"
                          aria-label={`Intervalo de recompra de ${produto.nome} em dias`}
                          value={
                            intervaloProdutoDrafts[produto.id] ??
                            produto.intervaloRecompraDias ??
                            30
                          }
                          onChange={(event) =>
                            setIntervaloProdutoDrafts((atual) => ({
                              ...atual,
                              [produto.id]: event.target.value,
                            }))
                          }
                          style={{
                            ...inputStyle,
                            minWidth: 74,
                            padding: "7px 8px",
                          }}
                        />
                        <button
                          type="button"
                          style={styles.small}
                          onClick={() => salvarPeriodicidadeProduto(produto)}
                        >
                          Salvar
                        </button>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <Badge
                        status={
                          produto.statusEstoque === "ok"
                            ? "concluido"
                            : produto.statusEstoque === "baixo"
                              ? "chamado"
                              : "cancelado"
                        }
                      />
                    </td>
                    <td style={styles.td}>
                      <div
                        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                      >
                        <button
                          type="button"
                          style={styles.small}
                          onClick={() =>
                            movimentarProdutoRevenda(produto, "entrada")
                          }
                        >
                          Entrada
                        </button>
                        <button
                          type="button"
                          style={styles.small}
                          onClick={() =>
                            movimentarProdutoRevenda(produto, "saida_manual")
                          }
                        >
                          Saída manual
                        </button>
                      </div>
                    </td>
                    <td style={{ ...styles.td, minWidth: 250 }}>
                      {botoesCadastro({
                        item: produto,
                        rota: "estoque-revenda",
                        rotulo: "Produto",
                        historico: "vendas, movimentos de estoque e comissões",
                        onEditar: () => abrirProdutoRevenda(produto),
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p style={{ ...styles.sub, marginBottom: 0 }}>
            A saída manual não registra venda, pagamento ou receita. Para
            vender, use a aba <strong>Vendas de revenda</strong>, que separa
            pedido pendente de confirmação financeira.
          </p>
        </Card>
        {renderExcluidos(produtosRevenda, "estoque-revenda", "Produto")}
      </div>
    );
  }

  function renderVendasRevenda() {
    const total = itensVendaRevenda.reduce(
      (soma, item) =>
        soma + Number(item.precoUnitario || 0) * Number(item.quantidade || 0),
      0,
    );
    const vendasOrdenadas = [...vendasRevenda].sort((a, b) =>
      String(b.criadoEm).localeCompare(String(a.criadoEm)),
    );
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={styles.twoColumns}>
          <Card style={{ padding: 18 }}>
            <div style={styles.sectionTitle}>
              <div>
                <h2 style={styles.h2}>Nova venda de revenda</h2>
                <p style={styles.sub}>
                  Crie o pedido pendente e confirme o recebimento somente depois
                  de o pagamento ser verificado.
                </p>
              </div>
            </div>
            <form
              onSubmit={adicionarItemVendaRevenda}
              style={{ display: "grid", gap: 14 }}
            >
              <Field label="Produto disponível">
                <select
                  required
                  value={formVendaRevenda.produtoId}
                  onChange={(event) =>
                    setFormVendaRevenda((atual) => ({
                      ...atual,
                      produtoId: event.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="">Selecionar produto</option>
                  {produtosRevenda
                    .filter(
                      (produto) =>
                        produto.ativo !== false &&
                        Number(produto.estoqueAtual || 0) > 0,
                    )
                    .map((produto) => (
                      <option key={produto.id} value={produto.id}>
                        {produto.nome} · {produto.estoqueAtual} disponíveis ·{" "}
                        {moeda(produto.precoVenda)}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Quantidade">
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={formVendaRevenda.quantidade}
                  onChange={(event) =>
                    setFormVendaRevenda((atual) => ({
                      ...atual,
                      quantidade: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <button
                type="submit"
                style={styles.secondary}
                disabled={
                  produtosRevenda.filter(
                    (produto) =>
                      produto.ativo !== false &&
                      Number(produto.estoqueAtual || 0) > 0,
                  ).length === 0
                }
              >
                Adicionar item
              </button>
            </form>
            {itensVendaRevenda.length === 0 ? (
              <div style={styles.empty}>Nenhum item adicionado à venda.</div>
            ) : (
              <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
                {itensVendaRevenda.map((item) => (
                  <div key={item.produtoId} style={styles.listRow}>
                    <div>
                      <strong>{item.nome}</strong>
                      <div style={styles.sub}>
                        {item.quantidade} {item.unidade || "un"} ·{" "}
                        {moeda(item.precoUnitario)} cada
                      </div>
                    </div>
                    <div
                      style={{ display: "flex", gap: 10, alignItems: "center" }}
                    >
                      <strong>
                        {moeda(
                          Number(item.precoUnitario || 0) *
                            Number(item.quantidade || 0),
                        )}
                      </strong>
                      <button
                        type="button"
                        style={styles.small}
                        onClick={() =>
                          setItensVendaRevenda((itens) =>
                            itens.filter(
                              (linha) => linha.produtoId !== item.produtoId,
                            ),
                          )
                        }
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <form
              onSubmit={salvarVendaRevenda}
              style={{
                display: "grid",
                gap: 14,
                marginTop: 18,
                paddingTop: 18,
                borderTop: "1px solid var(--line)",
              }}
            >
              <div style={styles.formGrid}>
                <Field label="Cliente cadastrado">
                  <select
                    value={formVendaRevenda.clienteId}
                    onChange={(event) =>
                      setFormVendaRevenda((atual) => ({
                        ...atual,
                        clienteId: event.target.value,
                        clienteNome: "",
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="">Venda balcão</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Nome eventual">
                  <input
                    value={formVendaRevenda.clienteNome}
                    onChange={(event) =>
                      setFormVendaRevenda((atual) => ({
                        ...atual,
                        clienteNome: event.target.value,
                        clienteId: "",
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>
                <Field label="Profissional responsável">
                  <select
                    value={formVendaRevenda.profissionalId}
                    onChange={(event) =>
                      setFormVendaRevenda((atual) => ({
                        ...atual,
                        profissionalId: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="">Sem repasse atribuído</option>
                    {profissionais
                      .filter((item) => item.ativo !== false)
                      .map((profissional) => (
                        <option key={profissional.id} value={profissional.id}>
                          {profissional.nome}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Observação" full>
                  <textarea
                    rows={2}
                    value={formVendaRevenda.observacao}
                    onChange={(event) =>
                      setFormVendaRevenda((atual) => ({
                        ...atual,
                        observacao: event.target.value,
                      }))
                    }
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </Field>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <strong>Total: {moeda(total)}</strong>
                <button
                  type="submit"
                  style={styles.primary}
                  disabled={salvando || itensVendaRevenda.length === 0}
                >
                  Salvar venda pendente
                </button>
              </div>
            </form>
          </Card>
          <Card style={{ padding: 18 }}>
            <div style={styles.sectionTitle}>
              <div>
                <h2 style={styles.h2}>Controles da operação</h2>
                <p style={styles.sub}>
                  A venda é separada do PDV global porque o estoque legado do
                  Bar ainda não é tenant-aware.
                </p>
              </div>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={styles.notice}>
                <strong>Pedido pendente</strong>
                <div style={styles.sub}>
                  Não baixa estoque e não cria receita.
                </div>
              </div>
              <div style={styles.notice}>
                <strong>Pagamento confirmado</strong>
                <div style={styles.sub}>
                  Baixa estoque da revenda, gera histórico e registra uma
                  receita idempotente em <code>barbearia_revenda</code>.
                </div>
              </div>
              <div style={styles.notice}>
                <strong>Sem cobrança simulada</strong>
                <div style={styles.sub}>
                  A tela pede confirmação manual e o meio de pagamento; não
                  chama gateway externo nesta etapa.
                </div>
              </div>
            </div>
          </Card>
        </div>
        <Card style={{ padding: 18 }}>
          <div style={styles.sectionTitle}>
            <div>
              <h2 style={styles.h2}>Vendas registradas</h2>
              <p style={styles.sub}>
                Pedidos desta empresa; a confirmação de pendentes é uma mutação
                operacional explícita.
              </p>
            </div>
          </div>
          {vendasOrdenadas.length === 0 ? (
            <div style={styles.empty}>Nenhuma venda de revenda registrada.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {vendasOrdenadas.map((venda) => (
                <div key={venda.id} style={styles.listRow}>
                  <div>
                    <strong>
                      {venda.id} · {venda.clienteNome || "Venda balcão"}
                    </strong>
                    <div style={styles.sub}>
                      {venda.itens
                        .map((item) => `${item.quantidade}× ${item.nome}`)
                        .join(" · ")}{" "}
                      · {moeda(venda.total)}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    <Badge
                      status={
                        venda.status === "pago" ? "concluido" : venda.status
                      }
                    />
                    {venda.status === "aguardando_pagamento" && (
                      <button
                        type="button"
                        style={styles.small}
                        onClick={() => confirmarVendaRevenda(venda)}
                      >
                        Confirmar recebimento
                      </button>
                    )}
                    {venda.status === "pago" && (
                      <span style={styles.sub}>
                        Estoque e financeiro registrados
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  function renderRelatorios() {
    return (
      <BIBarbearia
        embedded
        onOpenPerformance={() => navegarParaTab("Desempenho da equipe")}
      />
    );
  }

  function renderConfiguracao() {
    const diasSelecionados = formConfig.diasFuncionamento || [];
    const unidade = configuracaoUnidade?.calendario;
    const diasUnidade = unidade?.diasFuncionamento || [];
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Card style={{ padding: 20, maxWidth: 760 }}>
          <form
            onSubmit={salvarConfiguracao}
            style={{ display: "grid", gap: 18 }}
          >
            <div>
              <h2 style={styles.h2}>Agendamento público Dino</h2>
              <p style={styles.sub}>
                Defina a identidade exibida no link compartilhável. A publicação
                pode ser desativada sem apagar agenda, serviços ou
                profissionais.
              </p>
            </div>
            <div style={styles.formGrid}>
              <Field label="Slug público">
                <input
                  value={formConfig.slugPublico || ""}
                  onChange={(event) =>
                    setFormConfig((atual) => ({
                      ...atual,
                      slugPublico: event.target.value,
                    }))
                  }
                  style={inputStyle}
                  placeholder="dino"
                  pattern="[a-zA-Z0-9-]+"
                />
              </Field>
              <Field label="Nome público">
                <input
                  value={formConfig.nomePublico || ""}
                  onChange={(event) =>
                    setFormConfig((atual) => ({
                      ...atual,
                      nomePublico: event.target.value,
                    }))
                  }
                  style={inputStyle}
                  placeholder="Dino Barbearia & Perfumaria"
                  maxLength={160}
                />
              </Field>
              <Field label="WhatsApp público">
                <input
                  value={formConfig.whatsappPublico || ""}
                  onChange={(event) =>
                    setFormConfig((atual) => ({
                      ...atual,
                      whatsappPublico: event.target.value,
                    }))
                  }
                  style={inputStyle}
                  placeholder="(65) 99999-9999"
                  maxLength={30}
                />
              </Field>
              <Field label="Endereço público" full>
                <input
                  value={formConfig.enderecoPublico || ""}
                  onChange={(event) =>
                    setFormConfig((atual) => ({
                      ...atual,
                      enderecoPublico: event.target.value,
                    }))
                  }
                  style={inputStyle}
                  maxLength={240}
                />
              </Field>
              <Field label="Publicação" full>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    color: "var(--fg)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formConfig.agendamentoPublicoAtivo !== false}
                    onChange={(event) =>
                      setFormConfig((atual) => ({
                        ...atual,
                        agendamentoPublicoAtivo: event.target.checked,
                      }))
                    }
                    style={{ width: 18, height: 18 }}
                  />
                  <span>Agendamento público ativo</span>
                </label>
              </Field>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <a
                href={`/agendar/${formConfig.slugPublico || "dino"}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...styles.secondary, textDecoration: "none" }}
              >
                Abrir link público
              </a>
              <button type="submit" style={styles.primary} disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar identidade pública"}
              </button>
            </div>
          </form>
        </Card>
        <Card style={{ padding: 20, maxWidth: 760 }}>
          <form
            onSubmit={salvarConfiguracao}
            style={{ display: "grid", gap: 18 }}
          >
            <div>
              <h2 style={styles.h2}>Confirmação automática de agendamentos</h2>
              <p style={styles.sub}>
                Opt-in da empresa: confirmação na véspera (ou assim que houver
                tempo seguro), segunda mensagem cerca de 2h15 antes e prazo de
                resposta de 1 hora; o horário é liberado pelo menos 1h15 antes
                do atendimento.
              </p>
            </div>
            <Field label="Automação" full>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  color: "var(--fg)",
                }}
              >
                <input
                  type="checkbox"
                  checked={formConfig.confirmacaoAutomaticaAtiva === true}
                  onChange={(event) =>
                    setFormConfig((atual) => ({
                      ...atual,
                      confirmacaoAutomaticaAtiva: event.target.checked,
                    }))
                  }
                  disabled={!podeAlterarConfirmacaoAutomatica || salvando}
                  title={
                    !podeAlterarConfirmacaoAutomatica
                      ? "Somente admin, organizador ou gerente pode alterar esta política."
                      : undefined
                  }
                  style={{ width: 18, height: 18 }}
                />
                <span>
                  Ativar duas confirmações e cancelamento após o prazo
                </span>
              </label>
            </Field>
            <div style={styles.sub}>
              Somente admin, organizador ou gerente pode alterar a política de
              cancelamento.
            </div>
            <div style={styles.notice}>
              <strong>Proteções</strong>
              <div style={styles.sub}>
                Desativado por padrão; WhatsApp só para clientes com
                consentimento de atendimento; agendamentos com menos de 3h15 de
                antecedência ficam fora da regra; cada cancelamento recebe
                motivo auditável “falta de confirmação”.
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" style={styles.primary} disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar política de confirmação"}
              </button>
            </div>
          </form>
        </Card>
        <Card style={{ padding: 20, maxWidth: 760 }}>
          <form
            onSubmit={salvarConfiguracao}
            style={{ display: "grid", gap: 18 }}
          >
            <div>
              <h2 style={styles.h2}>Horários corporativos</h2>
              <p style={styles.sub}>
                A configuração da empresa serve como padrão para unidades que
                não possuem uma regra própria.
              </p>
            </div>
            <div style={styles.formGrid}>
              <Field label="Abertura">
                <input
                  type="time"
                  value={formConfig.horarioAbertura || ""}
                  onChange={(event) =>
                    setFormConfig((atual) => ({
                      ...atual,
                      horarioAbertura: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Fechamento">
                <input
                  type="time"
                  value={formConfig.horarioFechamento || ""}
                  onChange={(event) =>
                    setFormConfig((atual) => ({
                      ...atual,
                      horarioFechamento: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field
                label="Intervalo da agenda (min)"
                hint="Recomendado: 15 minutos"
              >
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="number"
                    min="5"
                    max="240"
                    value={formConfig.intervaloMinutos ?? 15}
                    onChange={(event) =>
                      setFormConfig((atual) => ({
                        ...atual,
                        intervaloMinutos: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                  <div style={{ display: "flex", gap: 4 }}>
                    {[15, 30, 45, 60].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          setFormConfig((atual) => ({
                            ...atual,
                            intervaloMinutos: t,
                          }))
                        }
                        style={{
                          ...styles.small,
                          padding: "4px 8px",
                          fontSize: 11,
                          background:
                            Number(formConfig.intervaloMinutos ?? 15) === t
                              ? "var(--accent)"
                              : "var(--card2)",
                          color:
                            Number(formConfig.intervaloMinutos ?? 15) === t
                              ? "#fff"
                              : "var(--fg)",
                        }}
                      >
                        {t}m
                      </button>
                    ))}
                  </div>
                </div>
              </Field>
              <Field
                label="Tempo de atendimento do Dino (minutos)"
                hint="Duração desejada por atendimento com o Dino na agenda (ex.: 15, 30, 45 ou 60 min)."
              >
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="number"
                    min="5"
                    max="480"
                    placeholder="Ex.: 30"
                    value={formConfig.tempoAtendimentoDinoMinutos ?? ""}
                    onChange={(event) =>
                      setFormConfig((atual) => ({
                        ...atual,
                        tempoAtendimentoDinoMinutos: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                  <div style={{ display: "flex", gap: 4 }}>
                    {[15, 30, 45, 60].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          setFormConfig((atual) => ({
                            ...atual,
                            tempoAtendimentoDinoMinutos: t,
                          }))
                        }
                        style={{
                          ...styles.small,
                          padding: "4px 8px",
                          fontSize: 11,
                          background:
                            Number(formConfig.tempoAtendimentoDinoMinutos) === t
                              ? "var(--accent)"
                              : "var(--card2)",
                          color:
                            Number(formConfig.tempoAtendimentoDinoMinutos) === t
                              ? "#fff"
                              : "var(--fg)",
                        }}
                      >
                        {t}m
                      </button>
                    ))}
                  </div>
                </div>
              </Field>
              <Field label="Antecedência mínima (min)">
                <input
                  type="number"
                  min="0"
                  value={formConfig.antecedenciaMinutos ?? ""}
                  onChange={(event) =>
                    setFormConfig((atual) => ({
                      ...atual,
                      antecedenciaMinutos: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Janela de reservas (dias)">
                <input
                  type="number"
                  min="1"
                  value={formConfig.janelaReservaDias ?? ""}
                  onChange={(event) =>
                    setFormConfig((atual) => ({
                      ...atual,
                      janelaReservaDias: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Cancelamento sem penalidade (horas)">
                <input
                  type="number"
                  min="0"
                  value={formConfig.politicaCancelamentoHoras ?? ""}
                  onChange={(event) =>
                    setFormConfig((atual) => ({
                      ...atual,
                      politicaCancelamentoHoras: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Dias de funcionamento" full>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {DIAS.map((dia, indice) => (
                    <button
                      type="button"
                      key={dia}
                      onClick={() =>
                        setFormConfig((atual) => ({
                          ...atual,
                          diasFuncionamento: diasSelecionados.includes(indice)
                            ? diasSelecionados.filter((item) => item !== indice)
                            : [...diasSelecionados, indice].sort(),
                        }))
                      }
                      style={{
                        ...styles.small,
                        background: diasSelecionados.includes(indice)
                          ? "var(--accent)"
                          : "var(--card2)",
                        color: diasSelecionados.includes(indice)
                          ? "#fff"
                          : "var(--fg)",
                      }}
                    >
                      {dia}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
            >
              <button type="submit" style={styles.primary} disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar configuração corporativa"}
              </button>
            </div>
          </form>
        </Card>
        <Card style={{ padding: 20, maxWidth: 760 }}>
          <form
            onSubmit={salvarConfiguracaoUnidade}
            style={{ display: "grid", gap: 18 }}
          >
            <div>
              <h2 style={styles.h2}>Calendário da unidade ativa</h2>
              <p style={styles.sub}>
                {unidade
                  ? `${unidadeLabel}. ${configuracaoUnidade.herdadaDaEmpresa ? "No momento, ela herda o padrão corporativo." : "Esta unidade possui regras próprias."}`
                  : "A sessão atual não informou uma unidade no JWT; a configuração específica não está disponível."}
              </p>
            </div>
            {!unidade ? (
              <div style={styles.empty}>
                Selecione uma unidade na sessão do SetPoint para editar este
                calendário.
              </div>
            ) : (
              <>
                <div style={styles.formGrid}>
                  <Field label="Abertura">
                    <input
                      type="time"
                      value={unidade.horarioAbertura || ""}
                      onChange={(event) =>
                        setConfiguracaoUnidade((atual) => ({
                          ...atual,
                          calendario: {
                            ...atual.calendario,
                            horarioAbertura: event.target.value,
                          },
                        }))
                      }
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Fechamento">
                    <input
                      type="time"
                      value={unidade.horarioFechamento || ""}
                      onChange={(event) =>
                        setConfiguracaoUnidade((atual) => ({
                          ...atual,
                          calendario: {
                            ...atual.calendario,
                            horarioFechamento: event.target.value,
                          },
                        }))
                      }
                      style={inputStyle}
                    />
                  </Field>
                  <Field
                    label="Intervalo da agenda (min)"
                    hint="Recomendado: 15 minutos"
                  >
                    <div
                      style={{ display: "flex", gap: 6, alignItems: "center" }}
                    >
                      <input
                        type="number"
                        min="5"
                        max="240"
                        value={unidade.intervaloMinutos ?? 15}
                        onChange={(event) =>
                          setConfiguracaoUnidade((atual) => ({
                            ...atual,
                            calendario: {
                              ...atual.calendario,
                              intervaloMinutos: event.target.value,
                            },
                          }))
                        }
                        style={inputStyle}
                      />
                      <div style={{ display: "flex", gap: 4 }}>
                        {[15, 30, 45, 60].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() =>
                              setConfiguracaoUnidade((atual) => ({
                                ...atual,
                                calendario: {
                                  ...atual.calendario,
                                  intervaloMinutos: t,
                                },
                              }))
                            }
                            style={{
                              ...styles.small,
                              padding: "4px 8px",
                              fontSize: 11,
                              background:
                                Number(unidade.intervaloMinutos ?? 15) === t
                                  ? "var(--accent)"
                                  : "var(--card2)",
                              color:
                                Number(unidade.intervaloMinutos ?? 15) === t
                                  ? "#fff"
                                  : "var(--fg)",
                            }}
                          >
                            {t}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </Field>
                  <Field
                    label="Tempo de atendimento do Dino (minutos)"
                    hint="Duração desejada para atendimentos com o Dino nesta unidade."
                  >
                    <div
                      style={{ display: "flex", gap: 6, alignItems: "center" }}
                    >
                      <input
                        type="number"
                        min="5"
                        max="480"
                        placeholder="Ex.: 30"
                        value={unidade.tempoAtendimentoDinoMinutos ?? ""}
                        onChange={(event) =>
                          setConfiguracaoUnidade((atual) => ({
                            ...atual,
                            calendario: {
                              ...atual.calendario,
                              tempoAtendimentoDinoMinutos: event.target.value,
                            },
                          }))
                        }
                        style={inputStyle}
                      />
                      <div style={{ display: "flex", gap: 4 }}>
                        {[15, 30, 45, 60].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() =>
                              setConfiguracaoUnidade((atual) => ({
                                ...atual,
                                calendario: {
                                  ...atual.calendario,
                                  tempoAtendimentoDinoMinutos: t,
                                },
                              }))
                            }
                            style={{
                              ...styles.small,
                              padding: "4px 8px",
                              fontSize: 11,
                              background:
                                Number(unidade.tempoAtendimentoDinoMinutos) ===
                                t
                                  ? "var(--accent)"
                                  : "var(--card2)",
                              color:
                                Number(unidade.tempoAtendimentoDinoMinutos) ===
                                t
                                  ? "#fff"
                                  : "var(--fg)",
                            }}
                          >
                            {t}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </Field>
                  <Field
                    label="Feriados (AAAA-MM-DD, separados por vírgula)"
                    full
                  >
                    <input
                      value={(unidade.feriados || []).join(", ")}
                      onChange={(event) =>
                        setConfiguracaoUnidade((atual) => ({
                          ...atual,
                          calendario: {
                            ...atual.calendario,
                            feriados: event.target.value
                              .split(",")
                              .map((item) => item.trim())
                              .filter(Boolean),
                          },
                        }))
                      }
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Dias de funcionamento" full>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {DIAS.map((dia, indice) => (
                        <button
                          type="button"
                          key={dia}
                          onClick={() =>
                            setConfiguracaoUnidade((atual) => ({
                              ...atual,
                              calendario: {
                                ...atual.calendario,
                                diasFuncionamento: diasUnidade.includes(indice)
                                  ? diasUnidade.filter(
                                      (item) => item !== indice,
                                    )
                                  : [...diasUnidade, indice].sort(),
                              },
                            }))
                          }
                          style={{
                            ...styles.small,
                            background: diasUnidade.includes(indice)
                              ? "var(--accent)"
                              : "var(--card2)",
                            color: diasUnidade.includes(indice)
                              ? "#fff"
                              : "var(--fg)",
                          }}
                        >
                          {dia}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                  }}
                >
                  <button
                    type="submit"
                    style={styles.primary}
                    disabled={salvando}
                  >
                    {salvando ? "Salvando…" : "Salvar calendário da unidade"}
                  </button>
                </div>
              </>
            )}
          </form>
        </Card>
      </div>
    );
  }

  function renderModal() {
    if (modal === "bloqueioAgenda") {
      const atalhos = [
        {
          rotulo: "👑 Seg e Ter (Dino)",
          titulo: "Ausência Dino",
          motivo: "Dino ausente (segunda e terça - agenda bloqueada)",
          inicio: "00:00",
          fim: "23:59",
          diaTodo: true,
          dataInicio: "2026-11-09",
          dataFim: "2026-11-10",
          periodo: "escolher_data",
          diasSemana: [1, 2],
          dinoAuto: true,
        },
        {
          rotulo: "✈️ Viagem Nati (17 e 18/11)",
          titulo: "Viagem Nati",
          motivo: "Nati em viagem (17 e 18 de novembro) - agenda bloqueada",
          inicio: "00:00",
          fim: "23:59",
          diaTodo: true,
          dataInicio: "2026-11-17",
          dataFim: "2026-11-18",
          periodo: "escolher_data",
          diasSemana: [0, 1, 2, 3, 4, 5, 6],
          natiAuto: true,
        },
        {
          rotulo: "🥪 Almoço (12h às 13h)",
          titulo: "Almoço",
          motivo: "Horário de almoço",
          inicio: "12:00",
          fim: "13:00",
        },
        {
          rotulo: "🥗 Almoço (13h às 14h)",
          titulo: "Almoço",
          motivo: "Horário de almoço",
          inicio: "13:00",
          fim: "14:00",
        },
        {
          rotulo: "☕ Pausa (30 min)",
          titulo: "Pausa rápida",
          motivo: "Intervalo café / descanso",
          inicio: "15:30",
          fim: "16:00",
        },
        {
          rotulo: "🏥 Compromisso Pessoal",
          titulo: "Compromisso",
          motivo: "Consulta / Assunto pessoal",
          inicio: "16:00",
          fim: "17:00",
        },
        {
          rotulo: "📋 Reunião / Treinamento",
          titulo: "Reunião",
          motivo: "Treinamento e alinhamento interno",
          inicio: "08:00",
          fim: "09:00",
        },
        {
          rotulo: "🏖️ Folga (Dia Todo)",
          titulo: "Folga",
          motivo: "Dia de folga do profissional",
          inicio: "08:00",
          fim: "19:00",
        },
      ];
      return (
        <Modal
          title="🔒 Bloquear Horário na Agenda"
          onClose={() => setModal(null)}
          wide
        >
          <form onSubmit={salvarBloqueio} style={{ display: "grid", gap: 16 }}>
            <div>
              <span
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--muted)",
                  marginBottom: 8,
                }}
              >
                Atalhos rápidos de 1 toque:
              </span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {atalhos.map((at) => (
                  <button
                    key={at.rotulo}
                    type="button"
                    style={{
                      ...styles.secondary,
                      padding: "6px 12px",
                      fontSize: 12,
                      borderRadius: 8,
                    }}
                    onClick={() =>
                    {
                      const dino = at.dinoAuto ? profissionais.find((p) => /dino/i.test(p.nome)) : null;
                      const nati = at.natiAuto ? profissionais.find((p) => /nati|natani/i.test(p.nome) || /nati|natani/i.test(p.apelido || "")) : null;
                      const profAlvo = dino ? dino.id : (nati ? nati.id : atual.profissionalId);
                      setFormBloqueio((atual) => ({
                        ...atual,
                        titulo: at.titulo,
                        motivo: at.motivo,
                        inicioHora: at.inicio,
                        fimHora: at.fim,
                        diaTodo: at.diaTodo || false,
                        dataInicio: at.dataInicio || atual.dataInicio,
                        dataFim: at.dataFim || atual.dataFim,
                        periodo: at.periodo || atual.periodo,
                        diasSemana: at.diasSemana || atual.diasSemana,
                        profissionalId: profAlvo,
                      }))
                    }
                    }
                  >
                    {at.rotulo}
                  </button>
                ))}
              </div>
            </div>
            <div style={styles.formGrid}>
              <Field label="Profissional">
                <select
                  value={formBloqueio.profissionalId || ""}
                  onChange={(e) =>
                    setFormBloqueio((atual) => ({
                      ...atual,
                      profissionalId: e.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="">Toda a unidade / Equipe</option>
                  {profissionais
                    .filter((p) => p.ativo !== false)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} ({p.apelido || p.nome.split(" ")[0]})
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Data de Início *">
                <input
                  type="date"
                  required
                  value={formBloqueio.data || dataSelecionada}
                  onChange={(e) => {
                    const d = e.target.value;
                    setFormBloqueio((atual) => ({ ...atual, data: d }));
                    if (d) setDataSelecionada(d);
                  }}
                  style={inputStyle}
                />
              </Field>
              <Field label="Período de Bloqueio">
                <select
                  value={formBloqueio.periodo}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormBloqueio((atual) => {
                      let fim = atual.fimHora;
                      let inicio = atual.inicioHora;
                      if (val === "dia_todo") {
                        inicio = "00:00";
                        fim = "23:59";
                      } else if (val === "30_min" && inicio) {
                        const [h, m] = inicio.split(":");
                        const d = new Date(0, 0, 0, h, m);
                        d.setMinutes(d.getMinutes() + 30);
                        fim = d.toTimeString().slice(0, 5);
                      } else if (val === "1_hora" && inicio) {
                        const [h, m] = inicio.split(":");
                        const d = new Date(0, 0, 0, h, m);
                        d.setHours(d.getHours() + 1);
                        fim = d.toTimeString().slice(0, 5);
                      } else if (val === "2_horas" && inicio) {
                        const [h, m] = inicio.split(":");
                        const d = new Date(0, 0, 0, h, m);
                        d.setHours(d.getHours() + 2);
                        fim = d.toTimeString().slice(0, 5);
                      } else if (val === "3_horas" && inicio) {
                        const [h, m] = inicio.split(":");
                        const d = new Date(0, 0, 0, h, m);
                        d.setHours(d.getHours() + 3);
                        fim = d.toTimeString().slice(0, 5);
                      }
                      return {
                        ...atual,
                        periodo: val,
                        inicioHora: inicio,
                        fimHora: fim,
                      };
                    });
                  }}
                  style={inputStyle}
                >
                  <option value="apenas_dia">Apenas este dia</option>
                  <option value="30_min">30 Minutos</option>
                  <option value="1_hora">1 Hora</option>
                  <option value="2_horas">2 Horas</option>
                  <option value="3_horas">3 Horas</option>
                  <option value="dia_todo">Dia todo (00:00 às 23:59)</option>
                  <option value="uma_semana">Uma semana</option>
                  <option value="15_dias">15 dias</option>
                  <option value="30_dias">30 dias</option>
                  <option value="60_dias">60 dias</option>
                  <option value="1_ano">1 ano</option>
                  <option value="indeterminado">Tempo indeterminado</option>
                  <option value="escolher_data">Escolher uma data final</option>
                </select>
              </Field>
              {formBloqueio.periodo === "escolher_data" && (
                <Field label="Data Final *">
                  <input
                    type="date"
                    required
                    value={formBloqueio.dataFimRepeticao}
                    onChange={(e) =>
                      setFormBloqueio((atual) => ({
                        ...atual,
                        dataFimRepeticao: e.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>
              )}
              {formBloqueio.periodo !== "apenas_dia" && (
                <Field label="Dias da semana" full>
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      flexWrap: "wrap",
                      marginTop: 4,
                    }}
                  >
                    {[
                      { id: 1, label: "Seg" },
                      { id: 2, label: "Ter" },
                      { id: 3, label: "Qua" },
                      { id: 4, label: "Qui" },
                      { id: 5, label: "Sex" },
                      { id: 6, label: "Sáb" },
                      { id: 0, label: "Dom" },
                    ].map((d) => (
                      <label
                        key={d.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          cursor: "pointer",
                          fontSize: 14,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={formBloqueio.diasSemana.includes(d.id)}
                          onChange={(e) => {
                            const val = e.target.checked
                              ? [...formBloqueio.diasSemana, d.id]
                              : formBloqueio.diasSemana.filter(
                                  (id) => id !== d.id,
                                );
                            setFormBloqueio((atual) => ({
                              ...atual,
                              diasSemana: val,
                            }));
                          }}
                        />
                        {d.label}
                      </label>
                    ))}
                  </div>
                </Field>
              )}
              <Field label="Início *">
                <input
                  type="time"
                  required
                  value={formBloqueio.inicioHora}
                  onChange={(e) =>
                    setFormBloqueio((atual) => ({
                      ...atual,
                      inicioHora: e.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Término *">
                <input
                  type="time"
                  required
                  value={formBloqueio.fimHora}
                  onChange={(e) =>
                    setFormBloqueio((atual) => ({
                      ...atual,
                      fimHora: e.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Título / Motivo Principal *">
                <input
                  required
                  placeholder="Ex: Almoço, Médico, Folga..."
                  value={formBloqueio.titulo}
                  onChange={(e) =>
                    setFormBloqueio((atual) => ({
                      ...atual,
                      titulo: e.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Observação / Detalhe" full>
                <input
                  placeholder="Ex: Almoço com a família, dentista às 16h..."
                  value={formBloqueio.motivo}
                  onChange={(e) =>
                    setFormBloqueio((atual) => ({
                      ...atual,
                      motivo: e.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
              🔒 Enquanto o horário estiver bloqueado, o sistema rejeitará
              agendamentos sobrepostos tanto no painel quanto no agendamento
              online público.
            </p>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.secondary}
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{
                  ...styles.primary,
                  background: "#f59e0b",
                  color: "#000000",
                  fontWeight: 800,
                }}
                disabled={salvando}
              >
                {salvando ? "Bloqueando…" : "Salvar Bloqueio"}
              </button>
            </div>
          </form>
        </Modal>
      );
    }
    if (modal?.tipo === "filaChamada") {
      const item = modal.item;
      return (
        <Modal title={`Chamar ${item.senha}`} onClose={() => setModal(null)}>
          <form
            onSubmit={concluirChamadaFila}
            style={{ display: "grid", gap: 16 }}
          >
            <div style={styles.notice}>
              <strong>{item.clienteNome || "Cliente eventual"}</strong>
              <div style={styles.sub}>
                Registre a cadeira, posição ou estação antes de atualizar o
                status da fila.
              </div>
            </div>
            <Field
              label="Cadeira ou posição *"
              full
              hint="Exemplos: Cadeira 2, Estação A, Sala 1"
            >
              <input
                required
                autoFocus
                value={formFilaChamada.mesaOuPosicao}
                onChange={(event) =>
                  setFormFilaChamada({ mesaOuPosicao: event.target.value })
                }
                style={inputStyle}
                placeholder="Cadeira 2"
              />
            </Field>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.secondary}
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={styles.primary}
                disabled={salvando || !formFilaChamada.mesaOuPosicao.trim()}
              >
                {salvando ? "Atualizando…" : "Confirmar chamada"}
              </button>
            </div>
          </form>
        </Modal>
      );
    }
    if (modal?.tipo === "movimentoRevenda") {
      const produto = modal.produto;
      const movimentoLabel =
        modal.movimentoTipo === "entrada"
          ? "Entrada"
          : modal.movimentoTipo === "saida_manual"
            ? "Saída manual"
            : "Ajuste";
      return (
        <Modal
          title={`${movimentoLabel} de estoque`}
          onClose={() => setModal(null)}
        >
          <form
            onSubmit={concluirMovimentoRevenda}
            style={{ display: "grid", gap: 16 }}
          >
            <div style={styles.notice}>
              <strong>{produto.nome}</strong>
              <div style={styles.sub}>
                Saldo atual: {produto.estoqueAtual} {produto.unidade || "un"}. A
                saída manual não registra venda, pagamento ou receita.
              </div>
            </div>
            <Field label="Quantidade *">
              <input
                required
                autoFocus
                type="number"
                min="1"
                step="1"
                value={formMovimentoRevenda.quantidade}
                onChange={(event) =>
                  setFormMovimentoRevenda((atual) => ({
                    ...atual,
                    quantidade: event.target.value,
                  }))
                }
                style={inputStyle}
              />
            </Field>
            <Field label="Observação" full>
              <textarea
                rows={3}
                value={formMovimentoRevenda.observacao}
                onChange={(event) =>
                  setFormMovimentoRevenda((atual) => ({
                    ...atual,
                    observacao: event.target.value,
                  }))
                }
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </Field>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.secondary}
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={styles.primary}
                disabled={
                  salvando ||
                  !Number.isInteger(Number(formMovimentoRevenda.quantidade)) ||
                  Number(formMovimentoRevenda.quantidade) <= 0
                }
              >
                {salvando
                  ? "Registrando…"
                  : `Confirmar ${movimentoLabel.toLowerCase()}`}
              </button>
            </div>
          </form>
        </Modal>
      );
    }
    if (modal?.tipo === "profissional")
      return (
        <Modal
          title={
            modal.profissionalId ? "Editar profissional" : "Novo profissional"
          }
          onClose={() => setModal(null)}
          wide
        >
          <form
            onSubmit={salvarProfissional}
            style={{ display: "grid", gap: 16 }}
          >
            <div style={styles.formGrid}>
              <Field label="Nome *" full>
                <input
                  required
                  value={formProf.nome}
                  onChange={(event) =>
                    setFormProf((atual) => ({
                      ...atual,
                      nome: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Telefone">
                <input
                  value={formProf.telefone}
                  onChange={(event) =>
                    setFormProf((atual) => ({
                      ...atual,
                      telefone: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="E-mail do login (Modo barbeiro)">
                <input
                  type="email"
                  value={formProf.email}
                  onChange={(event) =>
                    setFormProf((atual) => ({
                      ...atual,
                      email: event.target.value,
                    }))
                  }
                  style={inputStyle}
                  placeholder="o mesmo e-mail que o profissional usa para entrar"
                />
              </Field>
              <Field label="Especialidade">
                <input
                  value={formProf.especialidade}
                  onChange={(event) =>
                    setFormProf((atual) => ({
                      ...atual,
                      especialidade: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Tipo">
                <select
                  value={formProf.tipo}
                  onChange={(event) =>
                    setFormProf((atual) => ({
                      ...atual,
                      tipo: event.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="parceiro">Parceiro</option>
                  <option value="funcionario">Funcionário</option>
                  <option value="autonomo">Autônomo</option>
                </select>
              </Field>
              <Field label="Comissão de serviços (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formProf.percentualComissao}
                  onChange={(event) =>
                    setFormProf((atual) => ({
                      ...atual,
                      percentualComissao: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Comissão de produtos (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formProf.percentualComissaoProduto}
                  onChange={(event) =>
                    setFormProf((atual) => ({
                      ...atual,
                      percentualComissaoProduto: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field
                label="Comissão por serviço (exceções)"
                full
                hint="Deixe em branco para usar a comissão de serviços acima."
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
                    gap: 8,
                  }}
                >
                  {servicos
                    .filter(
                      (servico) =>
                        servico.ativo !== false &&
                        (!servico.profissionaisIds?.length ||
                          !modal?.profissionalId ||
                          servico.profissionaisIds.includes(
                            modal.profissionalId,
                          )),
                    )
                    .map((servico) => (
                      <label
                        key={servico.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1fr) 76px",
                          gap: 6,
                          alignItems: "center",
                          fontSize: 13,
                        }}
                      >
                        <span style={{ overflowWrap: "anywhere" }}>
                          {servico.nome}
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          placeholder={String(
                            formProf.percentualComissao ?? "",
                          )}
                          value={
                            formProf.comissoesPorServico?.[servico.id] ?? ""
                          }
                          onChange={(event) =>
                            setFormProf((atual) => ({
                              ...atual,
                              comissoesPorServico: {
                                ...(atual.comissoesPorServico || {}),
                                [servico.id]: event.target.value,
                              },
                            }))
                          }
                          style={inputStyle}
                          aria-label={`Comissão de ${servico.nome} (%)`}
                        />
                      </label>
                    ))}
                </div>
              </Field>
              <Field label="Taxa da maquininha">
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    minHeight: 42,
                    color: "var(--fg)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formProf.descontaTaxaMaquininha !== false}
                    onChange={(event) =>
                      setFormProf((atual) => ({
                        ...atual,
                        descontaTaxaMaquininha: event.target.checked,
                      }))
                    }
                    style={{ width: 18, height: 18 }}
                  />{" "}
                  Descontar no cálculo
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: "var(--muted)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formProf.descontaMaterial === true}
                    onChange={(event) =>
                      setFormProf((atual) => ({
                        ...atual,
                        descontaMaterial: event.target.checked,
                      }))
                    }
                    style={{ width: 18, height: 18 }}
                  />{" "}
                  Descontar material do serviço da base
                </label>
              </Field>
              <Field label="Início">
                <input
                  type="time"
                  value={formProf.horarioInicio}
                  onChange={(event) =>
                    setFormProf((atual) => ({
                      ...atual,
                      horarioInicio: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Fim">
                <input
                  type="time"
                  value={formProf.horarioFim}
                  onChange={(event) =>
                    setFormProf((atual) => ({
                      ...atual,
                      horarioFim: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field
                label="Tempo por atendimento (min)"
                full
                hint="Duração desejada para este profissional. Dino ou qualquer barbeiro pode ter tempo próprio (ex.: 15, 30, 45 ou 60 min). Deixe vazio para usar a duração do serviço."
              >
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="number"
                    min="5"
                    max="480"
                    placeholder="Padrão do serviço (30 min)"
                    value={formProf.duracaoAtendimentoMinutos || ""}
                    onChange={(event) =>
                      setFormProf((atual) => ({
                        ...atual,
                        duracaoAtendimentoMinutos: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                  <div style={{ display: "flex", gap: 4 }}>
                    {[15, 30, 45, 60].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          setFormProf((atual) => ({
                            ...atual,
                            duracaoAtendimentoMinutos: t,
                          }))
                        }
                        style={{
                          ...styles.small,
                          padding: "5px 9px",
                          fontSize: 11,
                          background:
                            Number(formProf.duracaoAtendimentoMinutos) === t
                              ? "var(--accent)"
                              : "var(--card2)",
                          color:
                            Number(formProf.duracaoAtendimentoMinutos) === t
                              ? "#fff"
                              : "var(--fg)",
                        }}
                      >
                        {t}m
                      </button>
                    ))}
                  </div>
                </div>
              </Field>
              <Field label="Foto ou avatar (URL)" full>
                <input
                  type="url"
                  value={formProf.fotoUrl}
                  onChange={(event) =>
                    setFormProf((atual) => ({
                      ...atual,
                      fotoUrl: event.target.value,
                    }))
                  }
                  style={inputStyle}
                  placeholder="https://…"
                />
              </Field>
              <Field label="Disponibilidade 24x7 (Dino / Plantão VIP)" full>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    minHeight: 42,
                    color: "var(--fg)",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formProf.atendimento24x7 === true}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setFormProf((atual) => ({
                        ...atual,
                        atendimento24x7: checked,
                        ...(checked
                          ? {
                              horarioInicio: "00:00",
                              horarioFim: "23:59",
                              diasTrabalho: [0, 1, 2, 3, 4, 5, 6],
                            }
                          : {}),
                      }));
                    }}
                    style={{ width: 18, height: 18 }}
                  />{" "}
                  Agenda 24x7 Liberada Full (atende 24h/dia, incluindo noites,
                  madrugadas e finais de semana)
                </label>
              </Field>
              <Field label="Dias de trabalho" full>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {DIAS.map((dia, indice) => (
                    <button
                      type="button"
                      key={dia}
                      onClick={() =>
                        setFormProf((atual) => ({
                          ...atual,
                          diasTrabalho: atual.diasTrabalho.includes(indice)
                            ? atual.diasTrabalho.filter(
                                (item) => item !== indice,
                              )
                            : [...atual.diasTrabalho, indice].sort(),
                        }))
                      }
                      style={{
                        ...styles.small,
                        background: formProf.diasTrabalho.includes(indice)
                          ? "var(--accent)"
                          : "var(--card2)",
                        color: formProf.diasTrabalho.includes(indice)
                          ? "#fff"
                          : "var(--fg)",
                      }}
                    >
                      {dia.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.secondary}
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
              <button type="submit" style={styles.primary} disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar profissional"}
              </button>
            </div>
          </form>
        </Modal>
      );
    if (modal === "servico")
      return (
        <Modal
          title={edicaoId ? "Editar serviço" : "Novo serviço"}
          onClose={() => setModal(null)}
        >
          <form onSubmit={salvarServico} style={{ display: "grid", gap: 16 }}>
            <div style={styles.formGrid}>
              <Field label="Nome *" full>
                <input
                  required
                  value={formServico.nome}
                  onChange={(event) =>
                    setFormServico((atual) => ({
                      ...atual,
                      nome: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Grupo comercial">
                <select
                  value={formServico.grupoServico || "nao_classificado"}
                  onChange={(e) =>
                    setFormServico((atual) => ({
                      ...atual,
                      grupoServico: e.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="nao_classificado">A classificar</option>
                  <option value="convencionais">
                    Serviços convencionais · cabelo e barba
                  </option>
                  <option value="extras">Serviços extras</option>
                </select>
              </Field>
              <Field
                label="Categoria ou procedimento"
                hint="Ex.: cabelo, barba, sobrancelha, tintura, pigmentação, hidratação, selagem ou unhas."
              >
                <input
                  value={formServico.categoria}
                  onChange={(event) =>
                    setFormServico((atual) => ({
                      ...atual,
                      categoria: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Tipo de preço">
                <select
                  value={formServico.tipoPreco || "fixo"}
                  onChange={(event) =>
                    setFormServico((atual) => ({
                      ...atual,
                      tipoPreco: event.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="fixo">Preço fixo</option>
                  <option value="a_partir_de">A partir de</option>
                  <option value="sob_consulta">Sob consulta</option>
                </select>
              </Field>
              <Field
                label={
                  formServico.tipoPreco === "sob_consulta"
                    ? "Preço de referência (R$)"
                    : formServico.tipoPreco === "a_partir_de"
                      ? "Preço mínimo (R$) *"
                      : "Preço (R$) *"
                }
              >
                <input
                  required={formServico.tipoPreco !== "sob_consulta"}
                  type="number"
                  min="0"
                  step="0.01"
                  value={formServico.preco}
                  onChange={(event) =>
                    setFormServico((atual) => ({
                      ...atual,
                      preco: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field
                label="Material por atendimento (R$)"
                hint="Vazio = custo dos insumos da ficha técnica"
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formServico.custoMaterial ?? ""}
                  onChange={(event) =>
                    setFormServico((atual) => ({
                      ...atual,
                      custoMaterial: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Duração (minutos)">
                <input
                  required
                  type="number"
                  min="5"
                  value={formServico.duracaoMinutos}
                  onChange={(event) =>
                    setFormServico((atual) => ({
                      ...atual,
                      duracaoMinutos: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field
                label="Intervalo de recomendação (dias)"
                hint="0 desativa sugestões automáticas para este serviço."
              >
                <input
                  type="number"
                  min="0"
                  max="3650"
                  step="1"
                  value={formServico.intervaloRecomendacaoDias ?? 0}
                  onChange={(event) =>
                    setFormServico((atual) => ({
                      ...atual,
                      intervaloRecomendacaoDias: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Descrição" full>
                <textarea
                  rows={4}
                  value={formServico.descricao}
                  onChange={(event) =>
                    setFormServico((atual) => ({
                      ...atual,
                      descricao: event.target.value,
                    }))
                  }
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </Field>
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "var(--muted)",
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={formServico.permiteAgendamentoOnline !== false}
                onChange={(event) =>
                  setFormServico((atual) => ({
                    ...atual,
                    permiteAgendamentoOnline: event.target.checked,
                  }))
                }
              />{" "}
              Permitir este serviço nos canais de agendamento online
            </label>
            <div style={styles.notice}>
              <strong>Ficha técnica e consumo interno</strong>
              <div style={styles.sub}>
                Ao faturar integralmente uma comanda, o estoque de revenda baixa
                os insumos configurados. Essa baixa não cria venda, pagamento ou
                vínculo com o Commerce.
              </div>
              {(formServico.consumoInterno || []).map((insumo, indice) => (
                <div
                  key={`${insumo.produtoId || "novo"}-${indice}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 110px auto",
                    gap: 8,
                    alignItems: "end",
                    marginTop: 10,
                  }}
                >
                  <select
                    aria-label={`Produto de consumo ${indice + 1}`}
                    value={insumo.produtoId}
                    onChange={(event) =>
                      setFormServico((atual) => ({
                        ...atual,
                        consumoInterno: atual.consumoInterno.map(
                          (item, index) =>
                            index === indice
                              ? { ...item, produtoId: event.target.value }
                              : item,
                        ),
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="">Selecionar produto</option>
                    {produtosRevenda
                      .filter((produto) => produto.ativo !== false)
                      .map((produto) => (
                        <option key={produto.id} value={produto.id}>
                          {produto.nome} · {produto.unidade || "un"}
                        </option>
                      ))}
                  </select>
                  <input
                    aria-label={`Quantidade de consumo ${indice + 1}`}
                    type="number"
                    min="1"
                    step="1"
                    value={insumo.quantidade}
                    onChange={(event) =>
                      setFormServico((atual) => ({
                        ...atual,
                        consumoInterno: atual.consumoInterno.map(
                          (item, index) =>
                            index === indice
                              ? { ...item, quantidade: event.target.value }
                              : item,
                        ),
                      }))
                    }
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    style={styles.small}
                    onClick={() =>
                      setFormServico((atual) => ({
                        ...atual,
                        consumoInterno: atual.consumoInterno.filter(
                          (_, index) => index !== indice,
                        ),
                      }))
                    }
                  >
                    Remover
                  </button>
                </div>
              ))}
              <button
                type="button"
                style={{ ...styles.secondary, marginTop: 10 }}
                onClick={() =>
                  setFormServico((atual) => ({
                    ...atual,
                    consumoInterno: [
                      ...(atual.consumoInterno || []),
                      { produtoId: "", quantidade: 1 },
                    ],
                  }))
                }
                disabled={
                  produtosRevenda.filter((produto) => produto.ativo !== false)
                    .length === 0
                }
              >
                + Adicionar insumo
              </button>
            </div>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.secondary}
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
              <button type="submit" style={styles.primary} disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar serviço"}
              </button>
            </div>
          </form>
        </Modal>
      );
    if (modal === "cliente" || modal?.tipo === "editarCliente")
      return (
        <Modal
          title={
            modal?.tipo === "editarCliente"
              ? "Editar cliente e crédito"
              : "Novo cliente no CRM"
          }
          onClose={() => setModal(null)}
          xl
        >
          <form onSubmit={salvarCliente} style={{ display: "grid", gap: 16 }}>
            <div style={styles.formGrid}>
              <Field label="Nome *" full>
                <input
                  required
                  value={formCliente.nome}
                  onChange={(event) =>
                    setFormCliente((atual) => ({
                      ...atual,
                      nome: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Telefone">
                <input
                  value={formCliente.telefone}
                  onChange={(event) =>
                    setFormCliente((atual) => ({
                      ...atual,
                      telefone: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="E-mail">
                <input
                  type="email"
                  value={formCliente.email}
                  onChange={(event) =>
                    setFormCliente((atual) => ({
                      ...atual,
                      email: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Aniversário" hint="DD/MM/AAAA ou só DD/MM.">
                <input
                  inputMode="numeric"
                  placeholder="DD/MM/AAAA"
                  value={formCliente.dataNascimento || ""}
                  onChange={(event) =>
                    setFormCliente((atual) => ({
                      ...atual,
                      dataNascimento: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field
                label="Limite para pagar na conta (R$)"
                hint="Zero mantém o crediário bloqueado."
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formCliente.limiteCreditoMensal}
                  onChange={(event) =>
                    setFormCliente((atual) => ({
                      ...atual,
                      limiteCreditoMensal: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Vencimento após a compra (dias)">
                <input
                  type="number"
                  min="1"
                  max="90"
                  step="1"
                  value={formCliente.diasVencimento}
                  onChange={(event) =>
                    setFormCliente((atual) => ({
                      ...atual,
                      diasVencimento: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Observação" full>
                <textarea
                  rows={4}
                  value={formCliente.observacao}
                  onChange={(event) =>
                    setFormCliente((atual) => ({
                      ...atual,
                      observacao: event.target.value,
                    }))
                  }
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </Field>
              <ClienteRelacionamento
                valor={formCliente.relacionamento || RELACIONAMENTO_VAZIO}
                onChange={(relacionamento) =>
                  setFormCliente((atual) => ({ ...atual, relacionamento }))
                }
                profissionais={profissionais}
              />
            </div>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.secondary}
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
              <button type="submit" style={styles.primary} disabled={salvando}>
                {salvando
                  ? "Salvando…"
                  : modal?.tipo === "editarCliente"
                    ? "Salvar cliente e crédito"
                    : "Salvar cliente"}
              </button>
            </div>
          </form>
        </Modal>
      );
    if (modal === "agenda" || modal?.tipo === "editarAgenda") {
      const editando = modal?.tipo === "editarAgenda";
      return (
        <BarbeariaNovoAgendamentoModal
          aberto={true}
          onClose={() => setModal(null)}
          dataInicial={formAgenda.data || dataSelecionada}
          horaInicial={formAgenda.hora || "10:00"}
          profissionalInicialId={formAgenda.profissionalId}
          servicoInicialId={formAgenda.servicoId || servicos[0]?.id}
          clienteInicialId={formAgenda.clienteId}
          clienteInicialNome={formAgenda.clienteNome}
          clienteInicialTelefone={formAgenda.clienteTelefone}
          editando={editando}
          agendamentoEdicao={editando ? modal.agendamento : null}
          clientes={clientes}
          profissionais={profissionais}
          servicos={servicos}
          planos={planos}
          assinaturas={assinaturas}
          salvando={salvando}
          onCadastrarClienteRapido={async (dados) => {
            const resp = await api.post("/api/admin/barbearia/clientes", dados);
            if (resp?.cliente) {
              setClientes((atuais) => [resp.cliente, ...atuais]);
              return resp.cliente;
            }
            return null;
          }}
          onSalvar={async (payload) => {
            if (
              editando &&
              !window.confirm(
                `Confirmar a remarcação para ${fmtDateOnly(payload.dataAgenda)} às ${payload.hora}?`,
              )
            )
              return;

            // Suporte a múltiplos serviços encadeados ou serviço único
            if (payload.linhasServicos && payload.linhasServicos.length > 1) {
              for (const linha of payload.linhasServicos) {
                const itemPayload = {
                  clienteId: payload.clienteId,
                  clienteNome: payload.clienteNome,
                  clienteTelefone: payload.clienteTelefone,
                  profissionalId: linha.profissionalId,
                  servicoId: linha.servicoId,
                  dataHora: new Date(
                    `${payload.dataAgenda}T${linha.horaInicio}:00`,
                  ).toISOString(),
                  dataAgenda: payload.dataAgenda,
                  observacoes: payload.observacoes,
                  duracaoMinutos: linha.duracaoMinutos,
                  valor: linha.valor,
                  usarPlano: payload.usarPlano === true,
                  origem: "admin",
                  ...(payload.forcarEncaixe ? { encaixe: true } : {}),
                };
                await executar(
                  () => api.post("/api/admin/barbearia/agenda", itemPayload),
                  "Serviço agendado.",
                );
              }
            } else {
              const itemPayload = {
                clienteId: payload.clienteId,
                clienteNome: payload.clienteNome,
                clienteTelefone: payload.clienteTelefone,
                profissionalId: payload.profissionalId,
                servicoId: payload.servicoId,
                dataHora: new Date(
                  `${payload.dataAgenda}T${payload.hora}:00`,
                ).toISOString(),
                dataAgenda: payload.dataAgenda,
                observacoes: payload.observacoes,
                duracaoMinutos: payload.duracaoMinutos,
                valor: payload.valor,
                usarPlano: payload.usarPlano === true,
                origem: "admin",
                ...(payload.forcarEncaixe ? { encaixe: true } : {}),
              };
              await executar(
                () =>
                  editando
                    ? api.patch(
                        `/api/admin/barbearia/agenda/${modal.agendamento.id}`,
                        itemPayload,
                      )
                    : api.post("/api/admin/barbearia/agenda", itemPayload),
                editando ? "Agendamento remarcado." : "Agendamento criado.",
              );
            }
            if (editando && payload.dataAgenda !== dataSelecionada)
              setDataSelecionada(payload.dataAgenda);
            setModal(null);
            await carregar();
          }}
        />
      );
    }
    if (modal?.tipo === "buscarHistorico")
      return (
        <Modal title="Histórico do cliente" onClose={() => setModal(null)}>
          <div className="cn-form">
            <p style={styles.sub}>
              Busque pelo nome, telefone ou e-mail. A ficha completa (consumo,
              compras, família, gostos e sugestões de venda) abre em uma nova
              guia.
            </p>
            <div
              className="cn-campo"
              role="group"
              aria-labelledby="cn-rotulo-cliente"
            >
              <span id="cn-rotulo-cliente">Cliente</span>
              <BuscaCliente
                clientes={clientes}
                clienteId=""
                onSelecionar={(cliente) => {
                  if (cliente) {
                    abrirHistoricoCliente({ clienteId: cliente.id });
                    setModal(null);
                  }
                }}
                onNomeEventual={() => {}}
                permitirEventual={false}
              />
            </div>
          </div>
        </Modal>
      );
    if (modal === "novaComanda") {
      const agendamentoComanda = formComanda.agendamentoId
        ? agendamentos.find((a) => a.id === formComanda.agendamentoId) ||
          formComanda.agendamentoObj ||
          null
        : null;
      const proximasAg = agendamentoComanda
        ? TRANSICOES[agendamentoComanda.status] || []
        : [];
      return (
        <Modal
          title="Abrir comanda de atendimento"
          onClose={() => setModal(null)}
          xl
        >
          {agendamentoComanda && (
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <strong style={{ fontSize: 13, color: "var(--muted)" }}>
                Status da agenda:
              </strong>
              {proximasAg.map((proximo) => (
                <button
                  key={proximo}
                  type="button"
                  style={{
                    ...styles.secondary,
                    padding: "4px 10px",
                    fontSize: 12,
                  }}
                  onClick={() => {
                    mudarStatusAtendimento(agendamentoComanda, proximo);
                  }}
                >
                  Mudar para {STATUS[proximo]?.label}
                </button>
              ))}
              {!["concluido", "cancelado", "nao_compareceu"].includes(
                agendamentoComanda.status,
              ) && (
                <button
                  type="button"
                  style={{
                    ...styles.secondary,
                    padding: "4px 10px",
                    fontSize: 12,
                  }}
                  onClick={() => abrirEdicaoAgendamento(agendamentoComanda)}
                >
                  📅 Alterar horário / Trocar profissional
                </button>
              )}
              <button
                type="button"
                style={{
                  ...styles.secondary,
                  padding: "4px 10px",
                  fontSize: 12,
                }}
                onClick={() =>
                  setModal({
                    tipo: "detalheAgenda",
                    agendamento: agendamentoComanda,
                  })
                }
              >
                📋 Detalhes do atendimento
              </button>
            </div>
          )}
          <ComandaNova
            clientes={clientes}
            profissionais={profissionais}
            servicos={servicos}
            produtosRevenda={produtosRevenda}
            catalogoPlanos={planos}
            agendamentos={agendamentos}
            agendamentoId={formComanda.agendamentoId}
            clienteInicial={formComanda.clienteId}
            nomeInicial={formComanda.clienteNome}
            telefoneInicial={formComanda.clienteTelefone}
            profissionalInicial={formComanda.profissionalId}
            servicoInicialId={formComanda.itemId}
            observacoesIniciais={formComanda.observacoes}
            toast={toast}
            onCancelar={() => setModal(null)}
            onCriada={async (comanda, avisos) => {
              toast(
                avisos?.length
                  ? `Comanda aberta. ${avisos.join(" ")}`
                  : "Comanda aberta.",
                avisos?.length ? "warning" : "success",
              );
              setModal(comanda?.id ? { tipo: "comanda", comanda } : null);
              await carregar();
            }}
          />
        </Modal>
      );
    }
    if (modal?.tipo === "comanda") {
      const comanda = modal.comanda;
      const agendamentoComanda = comanda.agendamentoId
        ? agendamentos.find((a) => a.id === comanda.agendamentoId) ||
          modal.agendamento ||
          formComanda.agendamentoObj ||
          null
        : null;
      const proximasAg = agendamentoComanda
        ? TRANSICOES[agendamentoComanda.status] || []
        : [];
      const subtotal = Number(
        comanda.subtotal ??
          (comanda.itens || []).reduce(
            (soma, item) =>
              soma +
              Number(
                item.subtotal ??
                  Number(item.precoUnitario || 0) *
                    Number(item.quantidade || item.qtd || 1),
              ),
            0,
          ),
      );
      const totalPago = Number(comanda.totalPago || 0);
      const saldoPendente = Number(
        comanda.saldoPendente ??
          Math.max(0, Number(comanda.total || 0) - totalPago),
      );
      const podeEditar = [
        "aberta",
        "aguardando_pagamento",
        "parcialmente_paga",
      ].includes(comanda.status);
      const clienteCredito = clientes.find(
        (cliente) =>
          cliente.id === (formPagamentoComanda.clienteId || comanda.clienteId),
      );
      const _lim = Number(clienteCredito?.limiteCreditoMensal || 0);
      const limiteCredito = _lim > 0 ? _lim : 500;
      const saldoDevedor = Number(clienteCredito?.saldoDevedor || 0);
      const creditoDisponivel = Math.max(0, limiteCredito - saldoDevedor);
      const valorConta = Number(
        formPagamentoComanda.valor || saldoPendente || 0,
      );
      const contaPermitida =
        formPagamentoComanda.meioPagamento !== "conta" ||
        Boolean(
          clienteCredito &&
          !clienteCredito.padrao &&
          limiteCredito > 0 &&
          valorConta <= creditoDisponivel + 0.005,
        );
      const documentoFiscal = documentosFiscais.find(
        (documento) =>
          documento.origemTipo === "comanda" &&
          documento.origemId === comanda.id,
      );
      return (
        <Modal
          title={`Comanda ${comanda.id}`}
          onClose={() => setModal(null)}
          wide
        >
          <div style={{ display: "grid", gap: 16 }}>
            <div style={styles.detailHero}>
              <div style={styles.avatar}>
                {iniciais(comanda.clienteNome || "Cliente")}
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 20 }}>
                  {comanda.clienteNome || "Cliente eventual"}
                </strong>
                <div style={styles.sub}>
                  {comanda.profissionalNome || "Sem profissional atribuído"} ·{" "}
                  {comanda.agendamentoId
                    ? "vinculada à agenda"
                    : "comanda avulsa"}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
    <Badge status={comanda.status} />
    {comanda.status === "aberta" && (comanda.itens?.length > 0 || totalPago > 0) && (
      <button type="button" style={{ ...styles.primary, padding: '4px 12px', fontSize: 12 }} disabled={salvando} onClick={aguardarPagamentoComanda}>Enviar p/ pagamento</button>
    )}
    {["aguardando_pagamento", "parcialmente_paga"].includes(comanda.status) && saldoPendente > 0 && (
      <button type="button" style={{ ...styles.primary, padding: '4px 12px', fontSize: 12 }} disabled={salvando || !contaPermitida} onClick={pagarComanda}>Receber e fechar</button>
    )}
  </div>
            </div>
            {agendamentoComanda && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <strong style={{ fontSize: 13, color: "var(--muted)" }}>
                  Status da agenda:
                </strong>
                {proximasAg.map((proximo) => (
                  <button
                    key={proximo}
                    type="button"
                    style={{
                      ...styles.secondary,
                      padding: "4px 10px",
                      fontSize: 12,
                    }}
                    onClick={() => {
                      mudarStatusAtendimento(agendamentoComanda, proximo);
                    }}
                  >
                    Mudar para {STATUS[proximo]?.label}
                  </button>
                ))}
                {!["concluido", "cancelado", "nao_compareceu"].includes(
                  agendamentoComanda.status,
                ) && (
                  <button
                    type="button"
                    style={{
                      ...styles.secondary,
                      padding: "4px 10px",
                      fontSize: 12,
                    }}
                    onClick={() => abrirEdicaoAgendamento(agendamentoComanda)}
                  >
                    📅 Alterar horário / Trocar profissional
                  </button>
                )}
                <button
                  type="button"
                  style={{
                    ...styles.secondary,
                    padding: "4px 10px",
                    fontSize: 12,
                  }}
                  onClick={() =>
                    setModal({
                      tipo: "detalheAgenda",
                      agendamento: agendamentoComanda,
                    })
                  }
                >
                  📋 Detalhes do atendimento
                </button>
              </div>
            )}
            <div style={styles.comandaMetrics}>
              <div>
                <small>Subtotal</small>
                <strong>{moeda(subtotal)}</strong>
              </div>
              <div>
                <small>Desconto</small>
                <strong>{moeda(comanda.desconto || 0)}</strong>
              </div>
              <div>
                <small>Gorjeta</small>
                <strong>{moeda(comanda.gorjeta || 0)}</strong>
              </div>
              <div>
                <small>Pago</small>
                <strong>{moeda(totalPago)}</strong>
              </div>
              <div>
                <small>Saldo</small>
                <strong
                  style={{ color: saldoPendente > 0 ? "#f59e0b" : "#14b87a" }}
                >
                  {moeda(saldoPendente)}
                </strong>
              </div>
            </div>
            <Card style={{ padding: 14 }}>
              <div style={styles.sectionTitle}>
                <div>
                  <h3 style={{ margin: 0 }}>Itens da comanda</h3>
                  <p style={styles.sub}>
                    Serviços não baixam estoque; produtos usam exclusivamente o
                    estoque de revenda da Barbearia.
                  </p>
                </div>
                <strong>{moeda(comanda.total || 0)}</strong>
              </div>
              {!comanda.itens?.length ? (
                <div style={styles.inlineEmpty}>Nenhum item adicionado.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {comanda.itens.map((item, indice) => (
                    <div
                      key={item.id || `${item.tipo}-${indice}`}
                      style={styles.comandaItemRow}
                    >
                      <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                        <strong>{item.nome}</strong>
                        <small style={{ color: "var(--muted)" }}>
                          {item.tipo === "produto"
                            ? "Produto de revenda"
                            : item.tipo === "loja"
                              ? `Loja Dino${item.estoqueLoja?.status === "baixado" ? " · estoque baixado" : ""}`
                              : "Serviço"}{" "}
                          · {item.quantidade || item.qtd || 1} ×{" "}
                          {moeda(item.precoUnitario || item.preco || 0)}
                          {item.coberturaPlano
                            ? ` · coberto pelo ${item.coberturaPlano.planoNome}${item.coberturaPlano.usoId ? " (sessão registrada)" : ""}${item.coberturaPlano.erro ? ` — atenção: ${item.coberturaPlano.erro}` : ""}`
                            : ""}
                        </small>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <strong>
                          {item.coberturaPlano ? (
                            <span style={{ color: "#2e9e7b" }}>
                              Plano ·{" "}
                              <s
                                style={{
                                  color: "var(--muted)",
                                  fontWeight: 400,
                                }}
                              >
                                {moeda(item.coberturaPlano.valorAbatido)}
                              </s>
                            </span>
                          ) : (
                            moeda(
                              item.subtotal ??
                                Number(item.precoUnitario || item.preco || 0) *
                                  Number(item.quantidade || item.qtd || 1),
                            )
                          )}
                        </strong>
                        {(podeEditar || ["paga", "em_conta"].includes(comanda.status)) && !item.coberturaPlano && (
                          <button
                            type="button"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "4px 10px",
                              fontSize: 12,
                              fontWeight: 700,
                              borderRadius: 6,
                              background: "rgba(2, 132, 199, 0.08)",
                              color: "#0284c7",
                              border: "1px solid rgba(2, 132, 199, 0.4)",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              transition: "all 0.15s ease",
                            }}
                            title={["paga", "em_conta"].includes(comanda.status) ? "Alterar valor do item e re-fechar comanda" : "Alterar valor do item"}
                            onClick={() =>
                              abrirModalAlterarValorItem(
                                comanda,
                                item,
                                item.id || `${item.tipo}-${indice}`,
                                item.precoUnitario || item.preco || 0,
                              )
                            }
                          >
                            ✏️ Alterar valor
                          </button>
                        )}
                        {podeEditar && (
                          <button
                            type="button"
                            style={{
                              ...styles.small,
                              padding: "2px 6px",
                              fontSize: 11,
                              color: "#ef4444",
                            }}
                            onClick={() =>
                              removerItemComanda(
                                comanda.id,
                                item.id || `${item.tipo}-${indice}`,
                              )
                            }
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {podeEditar &&
                (comanda.itens || []).length > 0 &&
                (comanda.itens || []).every((item) => item.coberturaPlano) &&
                Number(comanda.total || 0) === 0 && (
                  <div
                    style={{
                      ...styles.notice,
                      marginTop: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong>Tudo coberto pelo plano</strong>
                      <div style={styles.sub}>
                        Não há valor a receber. Fechar registra o uso das
                        sessões e baixa os insumos.
                      </div>
                    </div>
                    <button
                      type="button"
                      style={styles.primary}
                      disabled={salvando}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Fechar a comanda pelo plano do cliente, sem recebimento?",
                          )
                        )
                          atualizarComandaNaTela(
                            () =>
                              api.post(
                                `/api/admin/barbearia/comandas/${comanda.id}/fechar-plano`,
                                { confirmado: true },
                              ),
                            "Comanda fechada pelo plano.",
                          );
                      }}
                    >
                      Fechar pelo plano
                    </button>
                  </div>
                )}
              {podeEditar && (
                <AdicionarItensComanda
                  comanda={comanda}
                  clientes={clientes}
                  profissionais={profissionais}
                  servicos={servicos}
                  produtosRevenda={produtosRevenda}
                  catalogoPlanos={planos}
                  agendamentos={agendamentos}
                  toast={toast}
                  onAdicionados={async (atualizada, avisos) => {
                    toast(
                      avisos?.length
                        ? `Itens adicionados. ${avisos.join(" ")}`
                        : "Itens adicionados à comanda.",
                      avisos?.length ? "warning" : "success",
                    );
                    setModal(
                      atualizada?.id
                        ? { tipo: "comanda", comanda: atualizada }
                        : null,
                    );
                    await carregar();
                  }}
                />
              )}
              {["paga", "em_conta"].includes(comanda.status) &&
                (comanda.itens || []).some(
                  (item) =>
                    item.tipo === "loja" &&
                    item.estoqueLoja?.status !== "baixado",
                ) && (
                  <div
                    style={{
                      ...styles.notice,
                      marginTop: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong>Baixa de estoque da loja pendente</strong>
                      <div style={styles.sub}>
                        {(comanda.itens || []).find(
                          (item) =>
                            item.tipo === "loja" && item.estoqueLoja?.erro,
                        )?.estoqueLoja?.erro ||
                          "O recebimento foi registrado; falta baixar o produto no estoque da loja virtual."}
                      </div>
                    </div>
                    <button
                      type="button"
                      style={styles.secondary}
                      disabled={salvando}
                      onClick={() =>
                        atualizarComandaNaTela(
                          () =>
                            api.post(
                              `/api/admin/barbearia/comandas/${comanda.id}/loja/baixar`,
                              {},
                            ),
                          "Estoque da loja atualizado.",
                        )
                      }
                    >
                      Baixar estoque da loja
                    </button>
                  </div>
                )}
            </Card>
            {podeEditar && (
              <form
                onSubmit={salvarDetalhesComanda}
                style={{ display: "grid", gap: 12 }}
              >
                <div style={styles.formGrid}>
                  <Field label="Gorjeta (R$)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formComanda.gorjeta}
                      onChange={(event) =>
                        setFormComanda((atual) => ({
                          ...atual,
                          gorjeta: event.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Desconto (R$)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formComanda.desconto}
                      onChange={(event) =>
                        setFormComanda((atual) => ({
                          ...atual,
                          desconto: event.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Motivo do desconto">
                    <input
                      value={formComanda.descontoMotivo}
                      onChange={(event) =>
                        setFormComanda((atual) => ({
                          ...atual,
                          descontoMotivo: event.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Observações" full>
                    <textarea
                      rows={2}
                      value={formComanda.observacoes}
                      onChange={(event) =>
                        setFormComanda((atual) => ({
                          ...atual,
                          observacoes: event.target.value,
                        }))
                      }
                      style={{ ...inputStyle, resize: "vertical" }}
                    />
                  </Field>
                </div>
                <div style={styles.modalActions}>
                  <button
                    type="submit"
                    style={styles.secondary}
                    disabled={salvando}
                  >
                    Salvar ajustes
                  </button>
                  {comanda.status === "aberta" && (
                    <button
                      type="button"
                      style={styles.primary}
                      disabled={salvando || !comanda.itens?.length}
                      onClick={aguardarPagamentoComanda}
                    >
                      Enviar para pagamento
                    </button>
                  )}
                  {[
                    "aberta",
                    "aguardando_pagamento",
                    "parcialmente_paga",
                  ].includes(comanda.status) && (
                    <button
                      type="button"
                      style={{ ...styles.secondary, color: "#e05c5c" }}
                      disabled={salvando}
                      onClick={cancelarComanda}
                    >
                      Cancelar comanda
                    </button>
                  )}
                </div>
              </form>
            )}
            
            {!["paga", "cancelada", "em_conta"].includes(comanda.status) && saldoPendente <= 0 && comanda.itens?.length > 0 && (
                <div style={{ ...styles.modalActions, marginTop: 12, padding: 20, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontWeight: 600, color: '#334155' }}>A comanda não possui pendências financeiras.</div>
                  <button
                    type="button"
                    style={{ ...styles.primary, width: '100%', maxWidth: 300, background: '#10b981', borderColor: '#059669' }}
                    disabled={salvando}
                    onClick={() => {
                      if (window.confirm("Finalizar comanda sem recebimento?")) {
                        atualizarComandaNaTela(
                          () => api.post(`/api/admin/barbearia/comandas/${comanda.id}/fechar-plano`, { confirmado: true }),
                          "Comanda finalizada."
                        );
                      }
                    }}
                  >
                    Finalizar comanda (R$ 0,00)
                  </button>
                </div>
            )}
            
            {comanda.status === "aguardando_pagamento" && (comanda.statusAnteriorReabertura === "em_conta" || comanda.pagamentos?.some((p) => p.meio === "conta")) && (
              <div style={{ marginTop: 12, padding: 14, borderRadius: 10, background: "rgba(20, 184, 122, 0.08)", border: "1px solid rgba(20, 184, 122, 0.3)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <strong style={{ color: "#14b87a", display: "block" }}>Comanda Reaberta para Edição</strong>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>Após ajustar os itens acima, clique para refinalizar e lançar o novo total ({moeda(comanda.total)}) em conta do cliente.</span>
                </div>
                <button
                  type="button"
                  style={{ ...styles.primary, background: "#14b87a" }}
                  disabled={salvando}
                  onClick={async () => {
                    try {
                      const r = await api.post(`/api/admin/barbearia/comandas/${comanda.id}/refechar-conta`, {});
                      toast(`Comanda finalizada novamente em conta! Total: ${moeda(r.comanda?.total || comanda.total)}`, "success");
                      setModal({ tipo: "comanda", comanda: r.comanda || r });
                      await carregar();
                    } catch (e) {
                      toast(e.message || "Erro ao refinalizar comanda em conta.", "error");
                    }
                  }}
                >
                  💾 Finalizar Novamente em Conta ({moeda(comanda.total)})
                </button>
              </div>
            )}

            {!["paga", "cancelada", "em_conta"].includes(comanda.status) &&
              saldoPendente > 0 && (
                <Card style={styles.paymentPanel}>
                  <div style={styles.sectionTitle}>
                    <div>
                      <h3 style={{ margin: 0 }}>Receber comanda</h3>
                      <p style={styles.sub}>
                        A confirmação registra o financeiro idempotente e baixa
                        produtos uma única vez.
                      </p>
                    </div>
                  </div>
                  <div style={styles.formGrid}>
                    <Field label="Meio de pagamento">
                      <select
                        value={formPagamentoComanda.meioPagamento}
                        onChange={(event) =>
                          setFormPagamentoComanda((atual) => ({
                            ...atual,
                            meioPagamento: event.target.value,
                          }))
                        }
                        style={inputStyle}
                      >
                        <option value="pix">PIX</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="debito">Cartão de débito</option>
                        <option value="credito">Cartão de crédito</option>
                       <option value="transferencia">Transferência</option>
                       <option value="conta">Conta do cliente</option>
                     </select>
                   </Field>
                   {['debito', 'credito'].includes(formPagamentoComanda.meioPagamento) && (
                     <Field label="Bandeira do Cartão">
                       <select
                         value={formPagamentoComanda.bandeira || ''}
                         onChange={(event) =>
                           setFormPagamentoComanda((atual) => ({
                             ...atual,
                             bandeira: event.target.value,
                           }))
                         }
                         style={inputStyle}
                       >
                         <option value="">(Selecione a bandeira / Padrão)</option>
                         <option value="MasterCard">MasterCard</option>
                         <option value="Visa">Visa</option>
                         <option value="ELO">ELO</option>
                         <option value="Hipercard">Hipercard</option>
                         <option value="American Express">American Express</option>
                       </select>
                     </Field>
                   )}
                   <Field label="Valor recebido (R$)">
                     <input
                       type="number"
                        min="0.01"
                        max={saldoPendente}
                        step="0.01"
                        value={formPagamentoComanda.valor}
                        onChange={(event) =>
                          setFormPagamentoComanda((atual) => ({
                            ...atual,
                            valor: event.target.value,
                          }))
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field
                      label="Cliente para conta"
                      hint={
                        formPagamentoComanda.meioPagamento === "conta"
                          ? "O servidor valida limite, saldo e vencimento antes de faturar."
                          : undefined
                      }
                    >
                      <select
                        value={formPagamentoComanda.clienteId}
                        onChange={(event) =>
                          setFormPagamentoComanda((atual) => ({
                            ...atual,
                            clienteId: event.target.value,
                          }))
                        }
                        style={inputStyle}
                      >
                        <option value="">Usar cliente da comanda</option>
                        {clientes
                          .filter((cliente) => cliente.padrao !== true)
                          .map((cliente) => (
                            <option key={cliente.id} value={cliente.id}>
                              {cliente.nome}
                            </option>
                          ))}
                      </select>
                    </Field>
                    {formPagamentoComanda.meioPagamento === "conta" && (
                      <div style={{ ...styles.notice, gridColumn: "1 / -1" }}>
                        <strong>
                          {clienteCredito
                            ? `Crédito disponível: ${moeda(creditoDisponivel)}`
                            : "Selecione um cliente cadastrado"}
                        </strong>
                        <div style={styles.sub}>
                          {clienteCredito
                            ? `Limite ${moeda(limiteCredito)} · saldo ${moeda(saldoDevedor)} · vencimento em ${clienteCredito.diasVencimento || 30} dia(s).`
                            : "Conta do cliente não é permitida para atendimento eventual."}
                        </div>
                        {clienteCredito && !contaPermitida && (
                          <div
                            style={{
                              color: "#e05c5c",
                              fontSize: 12,
                              fontWeight: 700,
                              marginTop: 6,
                            }}
                          >
                            {limiteCredito <= 0
                              ? "Crediário bloqueado: configure um limite positivo no perfil do cliente."
                              : `Valor acima do disponível em ${moeda(Math.max(0, valorConta - creditoDisponivel))}.`}
                          </div>
                        )}
                      </div>
                    )}
                    {formPagamentoComanda.meioPagamento === "dinheiro" && (
                      <Field label="Caixa aberto">
                        <select
                          value={formPagamentoComanda.caixaId}
                          onChange={(event) =>
                            setFormPagamentoComanda((atual) => ({
                              ...atual,
                              caixaId: event.target.value,
                            }))
                          }
                          style={inputStyle}
                        >
                          <option value="">
                            Caixa aberto da unidade (automático)
                          </option>
                          {(operacao?.caixas || dashboard?.caixa?.caixas || [])
                            .filter((caixa) => caixa.status === "aberto")
                            .map((caixa) => (
                              <option key={caixa.id} value={caixa.id}>
                                Caixa {caixa.numeroCaixa}{caixa.nomeCaixa ? ` · ${caixa.nomeCaixa}` : ""} ({moeda(caixa.valorEsperadoAtual ?? caixa.valorAbertura)})
                              </option>
                            ))}
                        </select>
                      </Field>
                    )}
                  </div>
                  <div style={styles.modalActions}>
                    <button
                      type="button"
                      style={styles.primary}
                      disabled={salvando || !contaPermitida}
                      onClick={pagarComanda}
                    >
                      Confirmar recebimento
                    </button>
                  </div>
                </Card>
              )}
            {["paga", "em_conta"].includes(comanda.status) && (
              <div style={styles.notice}>
                <strong>
                  {documentoFiscal
                    ? "Rascunho fiscal preparado"
                    : "Ponte fiscal disponível"}
                </strong>
                <div style={styles.sub}>
                  {documentoFiscal
                    ? `Status: ${documentoFiscal.status}. Nenhum número fiscal foi emitido.`
                    : "Prepare um rascunho auditável para integração futura. Esta ação não emite, transmite nem numera documento fiscal."}
                </div>
                {!documentoFiscal && (
                  <button
                    type="button"
                    style={{ ...styles.secondary, marginTop: 10 }}
                    disabled={salvando}
                    onClick={() => prepararFiscalComanda(comanda)}
                  >
                    Preparar rascunho fiscal
                  </button>
                )}
                {documentoFiscal && (
                  <>
                  <NfseComandaAcoes
                    documento={documentoFiscal}
                    onToast={(m) => toast(m, "success")}
                    onAtualizado={() => carregar()}
                  />
                  {documentoFiscal.nfceEmitida && documentoFiscal.nfce ? (
                    <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "rgba(20, 184, 122, 0.08)", border: "1px solid rgba(20, 184, 122, 0.25)" }}>
                      <strong style={{ color: "#14b87a", fontSize: 13 }}>
                        NFC-e (65) {documentoFiscal.nfce.serie || 1}/{documentoFiscal.nfce.numero} · {{ autorizado: "Autorizada", validado_localmente: "XML validado (homologação, não enviado)", contingencia: "Em contingência (transmitir em até 24 h)", enviando: "Enviando" }[documentoFiscal.nfce.status] || documentoFiscal.nfce.status}{documentoFiscal.nfce.ambiente === "producao" ? "" : " · homologação"}
                      </strong>
                      {documentoFiscal.nfce.chaveAcesso && (
                        <div style={{ ...styles.sub, fontFamily: "monospace", fontSize: 11, marginTop: 4, wordBreak: "break-all" }}>
                          Chave: {documentoFiscal.nfce.chaveAcesso}
                        </div>
                      )}
                      {documentoFiscal.nfce.id && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                          <button
                            type="button"
                            style={styles.secondary}
                            onClick={async () => {
                              const w = window.open("", "_blank");
                              try {
                                const b = await api.blob(`/api/admin/fiscal/documentos/${documentoFiscal.nfce.id}/danfe`);
                                const u = URL.createObjectURL(b);
                                if (w) w.location.href = u;
                                else window.location.assign(u);
                              } catch (e) {
                                w?.close();
                                toast(e.message, "error");
                              }
                            }}
                          >
                            Imprimir DANFE (NFC-e)
                          </button>
                          <button
                            type="button"
                            style={styles.secondary}
                            onClick={async () => {
                              try {
                                const b = await api.blob(`/api/admin/fiscal/documentos/${documentoFiscal.nfce.id}/xml`);
                                const u = URL.createObjectURL(b);
                                const a = document.createElement("a");
                                a.href = u;
                                a.download = `NFCe-${documentoFiscal.nfce.serie || 1}-${documentoFiscal.nfce.numero || 1}.xml`;
                                a.click();
                                setTimeout(() => URL.revokeObjectURL(u), 30000);
                              } catch (e) {
                                toast(e.message, "error");
                              }
                            }}
                          >
                            Baixar XML (NFC-e)
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {/* confirmação na própria tela (window.confirm pode ser bloqueado pelo navegador) */}
                    <button type="button" style={styles.secondary} disabled={salvando} onClick={async () => {
                      if (nfceConfirmando !== comanda.id) { setNfceConfirmando(comanda.id); return; }
                      setNfceConfirmando(null);
                      try {
                        const r = await api.post(`/api/admin/barbearia/comandas/${comanda.id}/fiscal/nfce`, { confirmado: true });
                        const d = r?.resultado || {};
                        const situacao = { autorizado: "autorizada", validado_localmente: "validada (homologação, não enviada)", contingencia: "em contingência (transmitir em até 24 h)", rejeitado: "rejeitada" }[d.status] || d.status;
                        toast(`NFC-e ${d.numero || ""}: ${situacao}${d.status === "rejeitado" && d.mensagens?.length ? ` — ${d.mensagens.map((m) => m.mensagem).join(" · ")}` : ""}`, d.status === "rejeitado" ? "error" : "success");
                        carregar();
                      } catch (e) {
                        toast(e.message, "error");
                      }
                    }}>{nfceConfirmando === comanda.id ? "Confirmar emissão da NFC-e" : "Emitir NFC-e (produtos)"}</button>
                    {nfceConfirmando === comanda.id && <button type="button" style={styles.secondary} onClick={() => setNfceConfirmando(null)}>Voltar</button>}
                  </div>
                  )}
                  </>
                )}
              </div>
            )}
            {comanda.status === "em_conta" && (
              <div style={styles.notice}>
                <strong>Comanda lançada em conta</strong>
                <div style={styles.sub}>
                  A conta a receber foi registrada; a baixa futura deve ocorrer
                  pelo fluxo de contas/CRM, sem simular pagamento nesta tela.
                </div>
              </div>
            )}
            {comanda.pagamentos?.length > 0 && (
              <div>
                <h3 style={{ margin: "2px 0 8px" }}>Pagamentos registrados</h3>
                <div style={{ display: "grid", gap: 6 }}>
                  {comanda.pagamentos.map((pagamento) => (
                    <div key={pagamento.id} style={styles.comandaItemRow}>
                      <span>
                        {pagamento.meio} · {fmtDate(pagamento.registradoEm)}
                      </span>
                      <strong>{moeda(pagamento.valor)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {comanda.observacoes && (
              <div style={styles.notice}>
                <strong>Observações</strong>
                <div style={styles.sub}>{comanda.observacoes}</div>
              </div>
            )}
            {["paga", "em_conta"].includes(comanda.status) && !comanda.estornada && (
              <div
                style={{
                  marginTop: 14,
                  padding: 16,
                  borderRadius: 12,
                  background: "linear-gradient(135deg, rgba(2, 132, 199, 0.06), rgba(16, 185, 129, 0.06))",
                  border: "1px solid rgba(2, 132, 199, 0.3)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div>
                  <strong style={{ color: "#0284c7", fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                    ✏️ Precisa corrigir algum item ou valor?
                  </strong>
                  <span style={{ fontSize: 13, color: "var(--fg)", display: "block", marginTop: 4 }}>
                    Se o valor de algum serviço ou produto ficou incorreto (por exemplo, a sobrancelha, corte ou produto), <strong>não é necessário cancelar toda a comanda</strong>.
                    Você pode alterar o valor do item diretamente ou reabrir a comanda para ajustar tudo e finalizar novamente.
                  </span>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    style={{
                      ...styles.primary,
                      background: "#0284c7",
                      borderColor: "#0284c7",
                      fontSize: 13,
                      fontWeight: 800,
                      padding: "9px 18px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    disabled={salvando}
                    onClick={() => {
                      const itensEditaveis = (comanda.itens || []).filter((i) => !i.coberturaPlano);
                      if (itensEditaveis.length === 1) {
                        abrirModalAlterarValorItem(comanda, itensEditaveis[0]);
                      } else {
                        const itemSobrancelha = itensEditaveis.find((i) => (i.nome || "").toLowerCase().includes("sobrancelha")) || itensEditaveis[itensEditaveis.length - 1];
                        abrirModalAlterarValorItem(comanda, itemSobrancelha);
                      }
                    }}
                  >
                    ✏️ Alterar Valor do Item & Refinalizar
                  </button>
                  <button
                    type="button"
                    style={{
                      ...styles.secondary,
                      color: "#0284c7",
                      borderColor: "#0284c7",
                      fontSize: 13,
                      fontWeight: 700,
                      padding: "9px 18px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    disabled={salvando}
                    onClick={() => abrirModalReabrirComanda(comanda)}
                  >
                    🔄 Reabrir Comanda para Edição Completa
                  </button>
                </div>
              </div>
            )}
            {["paga", "em_conta"].includes(comanda.status) && !comanda.estornada && (
              <div style={{ marginTop: 12, padding: 14, borderRadius: 10, background: "rgba(224, 92, 92, 0.06)", border: "1px solid rgba(224, 92, 92, 0.25)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <strong style={{ color: "#e05c5c", display: "block" }}>Procedimento de Cancelamento de Comanda Finalizada</strong>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>Estorna numerário do caixa, cancela lançamentos financeiros e devolve produtos ao estoque.</span>
                </div>
                <button
                  type="button"
                  style={{ ...styles.secondary, color: "#e05c5c", borderColor: "#e05c5c", fontWeight: 800 }}
                  disabled={salvando}
                  onClick={async () => {
                    const motivo = window.prompt("Procedimento de Cancelamento de Comanda Finalizada:\nInforme a justificativa do cancelamento / estorno:");
                    if (!motivo || !motivo.trim()) return;
                    const senhaGerente = window.prompt("🔒 TRAVA DE SEGURANÇA:\nInforme a SENHA DO GERENTE / ADMINISTRADOR para autorizar este cancelamento:");
                    if (!senhaGerente || !senhaGerente.trim()) {
                      toast("A senha do gerente é obrigatória para autorizar o cancelamento.", "error");
                      return;
                    }
                    const reabrir = comanda.agendamentoId ? window.confirm("Deseja reabrir o horário do agendamento vinculado na agenda operacional?") : false;
                    await cancelarComandaFinalizada(comanda, {
                      motivo: motivo.trim(),
                      senhaGerente: senhaGerente.trim(),
                      reabrirAgendamento: reabrir,
                    });
                  }}
                >
                  🚫 Cancelar e estornar comanda
                </button>
              </div>
            )}
            {(comanda.status === "cancelada" || comanda.estornada) && (
              <div style={{ marginTop: 12, padding: 14, borderRadius: 10, background: "rgba(224, 92, 92, 0.08)", border: "1px solid rgba(224, 92, 92, 0.3)" }}>
                <strong style={{ color: "#e05c5c" }}>🚫 Comanda Cancelada / Estornada no Caixa</strong>
                <div style={{ fontSize: 12, color: "var(--fg)", marginTop: 4 }}>
                  Motivo: {comanda.cancelamentoMotivo || "Cancelamento manual de comanda faturada"}
                  {comanda.canceladoPor && ` · Operador: ${comanda.canceladoPor}`}
                </div>
              </div>
            )}
          </div>
        </Modal>
      );
    }
    if (modal?.tipo === "detalheCliente")
      return (
        <Modal
          title="Perfil operacional do cliente"
          onClose={() => setModal(null)}
        >
          <div style={{ display: "grid", gap: 16 }}>
            <div style={styles.detailHero}>
              <div style={styles.avatar}>{iniciais(modal.cliente.nome)}</div>
              <div>
                <strong style={{ fontSize: 20 }}>{modal.cliente.nome}</strong>
                <div style={styles.sub}>
                  {modal.cliente.tipo === "pj"
                    ? "Pessoa jurídica"
                    : "Pessoa física"}{" "}
                  · cadastro do CRM
                </div>
              </div>
            </div>
            <div style={styles.detailGrid}>
              <div>
                <small style={styles.sub}>Telefone</small>
                <strong>{modal.cliente.telefone || "Não informado"}</strong>
              </div>
              <div>
                <small style={styles.sub}>E-mail</small>
                <strong>{modal.cliente.email || "Não informado"}</strong>
              </div>
              <div>
                <small style={styles.sub}>Aniversário</small>
                <strong>
                  {nascimentoParaCampo(modal.cliente) || "Não informado"}
                </strong>
              </div>
              <div>
                <small style={styles.sub}>Saldo devedor</small>
                <strong>{moeda(modal.cliente.saldoDevedor)}</strong>
              </div>
              <div>
                <small style={styles.sub}>Limite na conta</small>
                <strong>{moeda(modal.cliente.limiteCreditoMensal)}</strong>
              </div>
              <div>
                <small style={styles.sub}>Crédito disponível</small>
                <strong>
                  {moeda(
                    Math.max(
                      0,
                      Number(modal.cliente.limiteCreditoMensal || 0) -
                        Number(modal.cliente.saldoDevedor || 0),
                    ),
                  )}
                </strong>
              </div>
              <div>
                <small style={styles.sub}>Vencimento</small>
                <strong>{modal.cliente.diasVencimento || 30} dia(s)</strong>
              </div>
              <div>
                <small style={styles.sub}>Atualizado em</small>
                <strong>
                  {modal.cliente.atualizadoEm
                    ? fmtDate(modal.cliente.atualizadoEm)
                    : "Sem registro"}
                </strong>
              </div>
            </div>
            {modal.cliente.observacao && (
              <div style={styles.notice}>
                <strong>Observação</strong>
                <div style={styles.sub}>{modal.cliente.observacao}</div>
              </div>
            )}
            <BarbeariaHistoricoCliente
              clienteId={modal.cliente.id}
              telefone={modal.cliente.telefone}
              nome={modal.cliente.nome}
            />
            <Card style={{ padding: 14 }}>
              <div style={styles.sectionTitle}>
                <div>
                  <h3 style={{ margin: 0 }}>Consentimentos</h3>
                  <p style={styles.sub}>
                    Cada alteração é confirmada pelo operador e registrada com
                    canal, finalidade e responsável.
                  </p>
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(210px, 100%), 1fr))",
                  gap: 10,
                }}
              >
                {[
                  ["whatsapp", "atendimento", "WhatsApp · atendimento"],
                  ["whatsapp", "marketing", "WhatsApp · marketing"],
                  ["email", "atendimento", "E-mail · atendimento"],
                  ["email", "marketing", "E-mail · marketing"],
                ].map(([canal, finalidade, label]) => {
                  const ativo =
                    modal.cliente.consentimentos?.[canal]?.[finalidade]
                      ?.concedido === true;
                  return (
                    <div key={`${canal}-${finalidade}`} style={styles.notice}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <strong>{label}</strong>
                        <span
                          style={{
                            color: ativo ? "#14b87a" : "var(--muted)",
                            fontWeight: 800,
                            fontSize: 12,
                          }}
                        >
                          {ativo ? "Concedido" : "Não concedido"}
                        </span>
                      </div>
                      <button
                        type="button"
                        style={styles.small}
                        onClick={() =>
                          atualizarConsentimento(
                            modal.cliente,
                            canal,
                            finalidade,
                            !ativo,
                          )
                        }
                      >
                        {ativo ? "Revogar" : "Conceder"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.secondary}
                onClick={() => abrirEdicaoCliente(modal.cliente)}
              >
                Editar cliente e crédito
              </button>
              <button
                type="button"
                style={styles.secondary}
                onClick={() => {
                  setModal(null);
                  agendarParaCliente(modal.cliente);
                }}
              >
                Agendar atendimento
              </button>
              <button
                type="button"
                style={styles.primary}
                onClick={() => {
                  setModal(null);
                  navegarParaTab("Fidelidade");
                }}
              >
                Ver fidelidade
              </button>
              <button
                type="button"
                style={styles.primary}
                onClick={() => {
                  const ref = `dino:${modal.cliente.id}`;
                  setModal(null);
                  navigate(`/admin/clientes-360/${encodeURIComponent(ref)}`);
                }}
              >
                Abrir Customer 360
              </button>
            </div>
          </div>
        </Modal>
      );
    if (modal?.tipo === "creditoFidelidade")
      return (
        <Modal
          title={`Ajuste de pontos · ${modal.membro?.nome || "Membro"}`}
          onClose={() => setModal(null)}
        >
          <form
            onSubmit={creditarFidelidade}
            style={{ display: "grid", gap: 16 }}
          >
            <div style={styles.notice}>
              <strong>Ajuste manual auditável</strong>
              <div style={styles.sub}>
                Use somente para corrigir ou reconhecer uma operação validada. O
                ajuste não cria receita, pagamento ou desconto.
              </div>
            </div>
            <Field label="Valor elegível para pontos (R$)">
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={formCreditoFidelidade.valor}
                onChange={(event) =>
                  setFormCreditoFidelidade({ valor: event.target.value })
                }
                style={inputStyle}
                autoFocus
              />
            </Field>
            <div style={styles.sub}>
              Regra atual: {fidelidade.regra?.pontosPorReal || 0} ponto(s) por
              R$ 1,00. O sistema calcula os pontos no servidor.
            </div>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.secondary}
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
              <button type="submit" style={styles.primary} disabled={salvando}>
                {salvando ? "Registrando…" : "Confirmar ajuste"}
              </button>
            </div>
          </form>
        </Modal>
      );
    if (modal?.tipo === "pagamentoVendaRevenda")
      return (
        <Modal
          title={`Confirmar recebimento · ${modal.venda?.id || "Venda"}`}
          onClose={() => setModal(null)}
        >
          <form
            onSubmit={concluirPagamentoVendaRevenda}
            style={{ display: "grid", gap: 16 }}
          >
            <div style={styles.notice}>
              <strong>{modal.venda?.clienteNome || "Venda balcão"}</strong>
              <div style={styles.sub}>
                {modal.venda?.itens
                  ?.map((item) => `${item.quantidade}× ${item.nome}`)
                  .join(" · ") || "Itens da venda"}{" "}
                · total {moeda(modal.venda?.total || 0)}
              </div>
            </div>
            <Field label="Meio de pagamento">
              <select
                required
                value={formPagamentoVendaRevenda.meioPagamento}
                onChange={(event) =>
                  setFormPagamentoVendaRevenda({
                    meioPagamento: event.target.value,
                  })
                }
                style={inputStyle}
              >
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="debito">Cartão de débito</option>
                <option value="credito">Cartão de crédito</option>
                <option value="transferencia">Transferência</option>
              </select>
            </Field>
            <div style={styles.notice}>
              <strong>O que será efetivado</strong>
              <div style={styles.sub}>
                A confirmação baixa o estoque tenant-aware e registra a receita
                idempotente. Nenhum gateway externo será acionado por esta tela.
              </div>
            </div>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.secondary}
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
              <button type="submit" style={styles.primary} disabled={salvando}>
                {salvando ? "Confirmando…" : "Confirmar recebimento"}
              </button>
            </div>
          </form>
        </Modal>
      );
    if (modal?.tipo === "recebimento")
      return (
        <Modal title="Registrar recebimento" onClose={() => setModal(null)}>
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                background: "var(--card)",
                borderRadius: 10,
                padding: 14,
              }}
            >
              <strong>
                {modal.agendamento.clienteNome ||
                  modal.agendamento.cliente_nome}
              </strong>
              <div style={styles.sub}>
                {modal.agendamento.servicoNome ||
                  modal.agendamento.servico_nome}{" "}
                · valor previsto {moeda(modal.agendamento.valor)}
              </div>
            </div>
            <Field label="Meio de pagamento">
              <select
                value={formRecebimento.meioPagamento}
                onChange={(event) =>
                  setFormRecebimento((atual) => ({
                    ...atual,
                    meioPagamento: event.target.value,
                  }))
                }
                style={inputStyle}
              >
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="debito">Cartão de débito</option>
                <option value="credito">Cartão de crédito</option>
                <option value="transferencia">Transferência</option>
              </select>
            </Field>
            {saldoCashbackCliente?.sinalPago > 0 && (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Sinal de {moeda(saldoCashbackCliente.sinalPago)} já pago e
                lançado no financeiro: entra como desconto abaixo.
              </div>
            )}
            {saldoCashbackCliente?.saldo > 0 && (
              <Field
                label={`Usar cashback (saldo ${moeda(saldoCashbackCliente.saldo)})`}
                hint="O valor usado sai do saldo do cliente e fica registrado na auditoria."
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={saldoCashbackCliente.saldo}
                  value={formRecebimento.usarCashback}
                  onChange={(event) =>
                    setFormRecebimento((atual) => ({
                      ...atual,
                      usarCashback: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
            )}
            <Field
              label="Vale-presente (opcional)"
              hint="Código do vale e quanto dele usar neste atendimento; o saldo é conferido no servidor."
            >
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  placeholder="ABCDE-FGHJK"
                  value={formRecebimento.valeCodigo}
                  onChange={(event) =>
                    setFormRecebimento((atual) => ({
                      ...atual,
                      valeCodigo: event.target.value.toUpperCase(),
                    }))
                  }
                  style={{ ...inputStyle, flex: 2 }}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Valor"
                  value={formRecebimento.valeValor}
                  onChange={(event) =>
                    setFormRecebimento((atual) => ({
                      ...atual,
                      valeValor: event.target.value,
                    }))
                  }
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
            </Field>
            <Field
              label="Valor a receber agora (R$)"
              hint="Valor do serviço menos sinal pago, cashback e vale usados. Para desconto ou ajuste, use a comanda com aprovação e auditoria."
            >
              <input
                type="number"
                value={valorDevidoRecebimento(modal.agendamento).toFixed(2)}
                readOnly
                aria-readonly="true"
                style={inputStyle}
              />
            </Field>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.secondary}
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                style={styles.primary}
                disabled={salvando || conferindoSinal}
                onClick={concluirEReceber}
              >
                {salvando
                  ? "Registrando…"
                  : conferindoSinal
                    ? "Conferindo sinal…"
                    : "Confirmar recebimento"}
              </button>
            </div>
          </div>
        </Modal>
      );
    if (modal?.tipo === "detalheAgenda") {
      const agendamento = modal.agendamento;
      const proximas = TRANSICOES[agendamento.status] || [];
      const clienteCrm = clientes.find(
        (c) => c.id === (agendamento.clienteCrmId || agendamento.clienteId),
      );
      return (
        <Modal title="Detalhes do atendimento" onClose={() => setModal(null)}>
          <div className="atendimento-detalhes">
            <div style={styles.detailHero}>
              <div style={styles.avatar}>
                {iniciais(agendamento.clienteNome)}
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 24 }}>
                  {agendamento.clienteNome || "Nome não informado"}
                </strong>
                <div style={styles.sub}>
                  {agendamento.clienteTelefone || "Sem telefone informado"}
                </div>
                {agendamento.clienteNomeOrigem === "crm" && (
                  <small style={styles.sub}>Nome identificado no CRM</small>
                )}
              </div>
              <Badge
                status={statusVisualAgendamento(
                  agendamento,
                  configuracao?.confirmacaoAutomaticaAtiva === true,
                )}
              />
            </div>
            {agendamento.clienteNomePendente && (
              <div className="identidade-pendente">
                <strong>Nome ainda não identificado</strong>
                <p>
                  Confira o cadastro com o cliente. Nenhum nome foi presumido.
                </p>
              </div>
            )}
            <dl>
              <div>
                <dt>Data</dt>
                <dd>
                  {fmtDateOnly(
                    agendamento.dataAgenda ||
                      String(agendamento.dataHora || "").slice(0, 10),
                  )}
                </dd>
              </div>
              <div>
                <dt>Horário e duração</dt>
                <dd>
                  {agendamento.horaLocal || horario(agendamento.dataHora)} ·{" "}
                  {agendamento.duracaoMinutos || 0} min
                </dd>
              </div>
              <div>
                <dt>Profissional</dt>
                <dd>
                  {agendamento.profissionalNome ||
                    agendamento.profissional_nome ||
                    "Sem profissional"}
                </dd>
              </div>
              <div>
                <dt>Serviço</dt>
                <dd>
                  {agendamento.servicoNome ||
                    agendamento.servico_nome ||
                    "Não informado"}
                </dd>
              </div>
              <div>
                <dt>Valor do serviço</dt>
                <dd>{moeda(agendamento.valor)}</dd>
              </div>
              <div>
                <dt>Origem</dt>
                <dd>{agendamento.origem || "Não informada"}</dd>
              </div>
            </dl>
            <small style={styles.sub}>
              Atendimento {agendamento.codigoConfirmacao || agendamento.id} · O
              valor do serviço não comprova recebimento.
            </small>
            {agendamento.observacoes && (
              <div style={styles.notice}>
                <strong>Observações</strong>
                <p>{agendamento.observacoes}</p>
              </div>
            )}
            <BarbeariaHistoricoCliente
              clienteId={agendamento.clienteId || agendamento.clienteCrmId}
              telefone={agendamento.clienteTelefone}
              nome={agendamento.clienteNome}
            />
            <div style={styles.modalActions}>
              {clienteCrm ? (
                <button
                  type="button"
                  style={styles.secondary}
                  onClick={() => abrirEdicaoCliente(clienteCrm)}
                >
                  Conferir cadastro do cliente
                </button>
              ) : (
                <button
                  type="button"
                  style={styles.secondary}
                  onClick={() => navigate("/admin/clientes-360")}
                >
                  Abrir Clientes 360
                </button>
              )}
              <button
                type="button"
                style={styles.secondary}
                onClick={() => {
                  setModal(null);
                  navegarParaTab("Caixa e fechamento");
                }}
              >
                Ver comandas do caixa
              </button>
            </div>
            <div style={styles.modalActions}>
              {!["concluido", "cancelado", "nao_compareceu"].includes(
                agendamento.status,
              ) && (
                <button
                  type="button"
                  style={styles.primary}
                  onClick={() => abrirEdicaoAgendamento(agendamento)}
                >
                  Trocar profissional ou Remarcar
                </button>
              )}
              {proximas.map((proximo) => (
                <button
                  key={proximo}
                  type="button"
                  style={styles.secondary}
                  onClick={() => {
                    setModal(null);
                    mudarStatus(agendamento, proximo);
                  }}
                >
                  {STATUS[proximo]?.label}
                </button>
              ))}
              {agendamento.status === "concluido" &&
                !agendamento.financeiroLancamentoId && (
                  <button
                    type="button"
                    style={styles.primary}
                    onClick={() => {
                      abrirRecebimento(agendamento);
                    }}
                  >
                    Registrar recebimento
                  </button>
                )}
              <button
                type="button"
                style={styles.secondary}
                onClick={() => conferirComandaDoAtendimento(agendamento)}
              >
                Conferir / abrir comanda
              </button>
              <button
                type="button"
                style={styles.secondary}
                onClick={() => abrirHistoricoCliente(agendamento)}
                title="Abre em nova guia"
              >
                Histórico do cliente ↗
              </button>
            </div>
          </div>
        </Modal>
      );
    }
    if (modal === "plano")
      return (
        <Modal
          title={
            edicaoId
              ? "Editar plano de recorrência"
              : "Novo plano de recorrência"
          }
          onClose={() => setModal(null)}
          wide
        >
          <form onSubmit={salvarPlano} style={{ display: "grid", gap: 16 }}>
            <div style={styles.formGrid}>
              <Field label="Nome *" full>
                <input
                  required
                  value={formPlano.nome}
                  onChange={(event) =>
                    setFormPlano((atual) => ({
                      ...atual,
                      nome: event.target.value,
                    }))
                  }
                  style={inputStyle}
                  placeholder="Pacote 4 procedimentos"
                />
              </Field>
              <Field label="Preço do ciclo (R$) *">
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formPlano.preco}
                  onChange={(event) =>
                    setFormPlano((atual) => ({
                      ...atual,
                      preco: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Ciclo">
                <select
                  value={formPlano.ciclo}
                  onChange={(event) =>
                    setFormPlano((atual) => ({
                      ...atual,
                      ciclo: event.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="mensal">Mensal</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="anual">Anual</option>
                </select>
              </Field>
              <Field label="Procedimentos por ciclo (4, 6, 8 ou mais)">
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginBottom: 6,
                  }}
                >
                  {[4, 6, 8].map((q) => (
                    <button
                      key={q}
                      type="button"
                      style={styles.small}
                      onClick={() =>
                        setFormPlano((atual) => ({
                          ...atual,
                          sessoesIncluidas: q,
                        }))
                      }
                    >
                      {q} procedimentos
                    </button>
                  ))}
                </div>
                <input
                  required
                  type="number"
                  min="1"
                  max="100"
                  value={formPlano.sessoesIncluidas}
                  onChange={(event) =>
                    setFormPlano((atual) => ({
                      ...atual,
                      sessoesIncluidas: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Pote de comissão (% da mensalidade)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formPlano.percentualPote ?? 0}
                  onChange={(event) =>
                    setFormPlano((atual) => ({
                      ...atual,
                      percentualPote: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Rateio do pote">
                <select
                  value={formPlano.rateioPote || "valor_tabela"}
                  onChange={(event) =>
                    setFormPlano((atual) => ({
                      ...atual,
                      rateioPote: event.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="valor_tabela">
                    Por valor de tabela dos serviços
                  </option>
                  <option value="atendimento">
                    Por atendimento (partes iguais)
                  </option>
                </select>
              </Field>
              <Field label="Valor fixo por atendimento (R$)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formPlano.valorFixoPorUso ?? 0}
                  onChange={(event) =>
                    setFormPlano((atual) => ({
                      ...atual,
                      valorFixoPorUso: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Regra de renovação">
                <select
                  value={formPlano.regraRenovacao || "dias"}
                  onChange={(e) =>
                    setFormPlano((atual) => ({
                      ...atual,
                      regraRenovacao: e.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="aniversario">
                    Mesmo dia da contratação em cada ciclo
                  </option>
                  <option value="dias">Período fixo em dias</option>
                </select>
                <small style={styles.sub}>
                  Contratou dia 10: renova dia 10. Nos meses sem o dia 29, 30 ou
                  31, vence no último dia; o aniversário original é mantido.
                </small>
              </Field>
              <Field label="Validade em dias (somente período fixo)">
                <input
                  disabled={formPlano.regraRenovacao === "aniversario"}
                  required
                  type="number"
                  min="1"
                  value={formPlano.validadeDias}
                  onChange={(event) =>
                    setFormPlano((atual) => ({
                      ...atual,
                      validadeDias: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Serviços cobertos" full>
                <select
                  required={formPlano.regraRenovacao === "aniversario"}
                  multiple
                  value={formPlano.servicosIds}
                  onChange={(event) =>
                    setFormPlano((atual) => ({
                      ...atual,
                      servicosIds: Array.from(event.target.selectedOptions).map(
                        (option) => option.value,
                      ),
                    }))
                  }
                  style={{ ...inputStyle, minHeight: 110 }}
                >
                  {servicos
                    .filter((item) => item.ativo !== false)
                    .map((servico) => (
                      <option key={servico.id} value={servico.id}>
                        {servico.nome}
                      </option>
                    ))}
                </select>
                <small style={styles.sub}>
                  Use Ctrl/Cmd para selecionar mais de um serviço.
                </small>
              </Field>
              <Field label="Descrição" full>
                <textarea
                  rows={3}
                  value={formPlano.descricao}
                  onChange={(event) =>
                    setFormPlano((atual) => ({
                      ...atual,
                      descricao: event.target.value,
                    }))
                  }
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </Field>
            </div>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.secondary}
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
              <button type="submit" style={styles.primary} disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar plano"}
              </button>
            </div>
          </form>
        </Modal>
      );

    if (modal === "fechamentoDia" && fechamentoDetalhado) {
      return (
        <Modal
          title={`Fechamento Diário — ${fmtDateOnly(fechamentoDetalhado.data)}`}
          onClose={() => setModal(null)}
          wide
        >
          <div
            id="print-fechamento"
            style={{
              background: "var(--card)",
              color: "var(--text)",
              padding: 24,
              borderRadius: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <h2 style={{ margin: 0 }}>Relatório Consolidado de Fechamento</h2>
              <div className="dadm-no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={styles.primary}
                >
                  🖨️ Imprimir / PDF
                </button>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
                marginBottom: 24,
              }}
            >
              <Card style={{ padding: 16 }}>
                <small
                  style={{
                    color: "var(--muted)",
                    display: "block",
                    marginBottom: 4,
                    fontWeight: 700,
                  }}
                >
                  Data do Movimento
                </small>
                <strong style={{ fontSize: 18 }}>
                  {fmtDateOnly(fechamentoDetalhado.data)}
                </strong>
              </Card>
              <Card style={{ padding: 16 }}>
                <small
                  style={{
                    color: "var(--muted)",
                    display: "block",
                    marginBottom: 4,
                    fontWeight: 700,
                  }}
                >
                  Responsável
                </small>
                <strong style={{ fontSize: 18 }}>
                  {fechamentoDetalhado.responsavel || "Sistema"}
                </strong>
              </Card>
              <Card style={{ padding: 16 }}>
                <small
                  style={{
                    color: "var(--muted)",
                    display: "block",
                    marginBottom: 4,
                    fontWeight: 700,
                  }}
                >
                  Data/Hora de Fechamento
                </small>
                <strong style={{ fontSize: 18 }}>
                  {new Date(fechamentoDetalhado.criadoEm).toLocaleString(
                    "pt-BR",
                  )}
                </strong>
              </Card>
            </div>
            <h3 style={{ margin: "0 0 16px 0", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
              Produção do Dia
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
              <Card style={{ padding: 16 }}>
                <small style={{ color: "var(--muted)", display: "block", marginBottom: 4, fontWeight: 700 }}>
                  Serviços Realizados
                </small>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <strong style={{ fontSize: 24 }}>{fechamentoDetalhado.resumoOperacao?.quantidadeServicos || 0}</strong>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg)' }}>{fmtR(fechamentoDetalhado.resumoOperacao?.valorServicos || 0)}</span>
                </div>
              </Card>
              <Card style={{ padding: 16 }}>
                <small style={{ color: "var(--muted)", display: "block", marginBottom: 4, fontWeight: 700 }}>
                  Produtos Vendidos
                </small>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <strong style={{ fontSize: 24 }}>{fechamentoDetalhado.resumoOperacao?.quantidadeProdutos || 0}</strong>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg)' }}>{fmtR(fechamentoDetalhado.resumoOperacao?.valorProdutos || 0)}</span>
                </div>
              </Card>
            </div>

            <h3
              style={{
                margin: "0 0 16px 0",
                paddingBottom: 8,
                borderBottom: "1px solid var(--border)",
              }}
            >
              Resumo Financeiro
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
                marginBottom: 24,
              }}
            >
              <Card style={{ padding: 16, borderLeft: "4px solid #14b87a" }}>
                <small
                  style={{
                    color: "var(--muted)",
                    display: "block",
                    marginBottom: 4,
                    fontWeight: 700,
                  }}
                >
                  Total Recebimentos
                </small>
                <strong style={{ fontSize: 24, color: "#14b87a" }}>
                  {fmtR(fechamentoDetalhado.recebimentos)}
                </strong>
              </Card>
              <Card style={{ padding: 16, borderLeft: "4px solid #e05c5c" }}>
                <small
                  style={{
                    color: "var(--muted)",
                    display: "block",
                    marginBottom: 4,
                    fontWeight: 700,
                  }}
                >
                  Total Pagamentos
                </small>
                <strong style={{ fontSize: 24, color: "#e05c5c" }}>
                  {fmtR(fechamentoDetalhado.pagamentos)}
                </strong>
              </Card>
              <Card style={{ padding: 16, borderLeft: "4px solid #f59e0b" }}>
                <small
                  style={{
                    color: "var(--muted)",
                    display: "block",
                    marginBottom: 4,
                    fontWeight: 700,
                  }}
                >
                  Pendente a Receber
                </small>
                <strong style={{ fontSize: 24, color: "#f59e0b" }}>
                  {fmtR(fechamentoDetalhado.pendenteReceber)}
                </strong>
              </Card>
              <Card style={{ padding: 16, borderLeft: "4px solid #3b82f6" }}>
                <small
                  style={{
                    color: "var(--muted)",
                    display: "block",
                    marginBottom: 4,
                    fontWeight: 700,
                  }}
                >
                  Saldo Líquido do Dia
                </small>
                <strong style={{ fontSize: 24, color: "#3b82f6" }}>
                  {fmtR(fechamentoDetalhado.saldoDia)}
                </strong>
              </Card>
            </div>
            <h3
              style={{
                margin: "0 0 16px 0",
                paddingBottom: 8,
                borderBottom: "1px solid var(--border)",
              }}
            >
              Movimento de Atividades e Vendas Consolidadas
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
                marginBottom: 24,
              }}
            >
              <Card style={{ padding: 16 }}>
                <small
                  style={{
                    color: "var(--muted)",
                    display: "block",
                    marginBottom: 4,
                    fontWeight: 700,
                  }}
                >
                  Comandas Pagas / Faturadas
                </small>
                <strong style={{ fontSize: 20 }}>
                  {fechamentoDetalhado.resumoOperacao?.comandasPagas || 0} pagas
                  / {fechamentoDetalhado.resumoOperacao?.emConta || 0} em conta
                </strong>
              </Card>
              <Card style={{ padding: 16 }}>
                <small
                  style={{
                    color: "var(--muted)",
                    display: "block",
                    marginBottom: 4,
                    fontWeight: 700,
                  }}
                >
                  Faturamento de Comandas
                </small>
                <strong style={{ fontSize: 20 }}>
                  {fmtR(
                    fechamentoDetalhado.resumoOperacao?.faturamentoComandas ||
                      0,
                  )}
                </strong>
              </Card>
              <Card style={{ padding: 16 }}>
                <small
                  style={{
                    color: "var(--muted)",
                    display: "block",
                    marginBottom: 4,
                    fontWeight: 700,
                  }}
                >
                  Faturado em Conta (Prazo)
                </small>
                <strong style={{ fontSize: 20 }}>
                  {fmtR(
                    fechamentoDetalhado.resumoOperacao?.faturadoEmConta || 0,
                  )}
                </strong>
              </Card>
            </div>

            {fechamentoDetalhado.resumoOperacao?.porMeio &&
              Object.keys(fechamentoDetalhado.resumoOperacao?.porMeio).length >
                0 && (
                <div style={{ marginBottom: 24 }}>
                  <h4
                    style={{
                      margin: "0 0 12px 0",
                      color: "var(--muted)",
                      fontSize: 13,
                      textTransform: "uppercase",
                    }}
                  >
                    Receita por Meio de Pagamento
                  </h4>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {Object.entries(
                      fechamentoDetalhado.resumoOperacao?.porMeio,
                    ).map(([meio, valor]) => (
                      <div
                        key={meio}
                        style={{
                          background: "var(--bg)",
                          border: "1px solid var(--line)",
                          borderRadius: 6,
                          padding: "8px 12px",
                        }}
                      >
                        <strong style={{ display: "block", fontSize: 14 }}>
                          {String(meio).toUpperCase()}
                        </strong>
                        <span>{fmtR(valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    margin: "0 0 16px 0",
                    paddingBottom: 8,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  Auditoria Financeira e Lacres
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <p>
                    <strong>Total de lançamentos validados:</strong>{" "}
                    {fechamentoDetalhado.totalLancamentos}
                  </p>
                  <p>
                    <strong>Operações em quarentena (análise pendente):</strong>{" "}
                    {fechamentoDetalhado.quarentenaCount}
                  </p>
                  <p>
                    <strong>Situação do arquivo:</strong>{" "}
                    <span style={{ color: "#14b87a", fontWeight: "bold" }}>
                      Fechado e lacrado (imutável)
                    </span>
                  </p>
                  <p>
                    <strong>ID do Fechamento:</strong>{" "}
                    <span style={{ fontFamily: "monospace", fontSize: 11 }}>
                      {fechamentoDetalhado.id}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <style
              dangerouslySetInnerHTML={{
                __html: `
              @media print {
                body * { visibility: hidden; }
                #print-fechamento, #print-fechamento * { visibility: visible; }
                #print-fechamento { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
                .dadm-no-print { display: none !important; }
              }
            `,
              }}
            />
          </div>
        </Modal>
      );
    }
    if (modal === "produtoRevenda")
      return (
        <Modal
          title={
            edicaoId ? "Editar produto de revenda" : "Novo produto de revenda"
          }
          onClose={() => setModal(null)}
          wide
        >
          <form
            onSubmit={salvarProdutoRevenda}
            style={{ display: "grid", gap: 16 }}
          >
            <div style={styles.formGrid}>
              <Field label="Nome *" full>
                <input
                  required
                  value={formProdutoRevenda.nome}
                  onChange={(event) =>
                    setFormProdutoRevenda((atual) => ({
                      ...atual,
                      nome: event.target.value,
                    }))
                  }
                  style={inputStyle}
                  placeholder="Pomada modeladora"
                />
              </Field>
              <Field label="Código de barras (EAN)">
                <input
                  inputMode="numeric"
                  value={formProdutoRevenda.ean || ""}
                  onChange={(event) =>
                    setFormProdutoRevenda((atual) => ({
                      ...atual,
                      ean: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="SKU">
                <input
                  value={formProdutoRevenda.sku}
                  onChange={(event) =>
                    setFormProdutoRevenda((atual) => ({
                      ...atual,
                      sku: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Categoria">
                <input
                  value={formProdutoRevenda.categoria}
                  onChange={(event) =>
                    setFormProdutoRevenda((atual) => ({
                      ...atual,
                      categoria: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Unidade">
                <input
                  value={formProdutoRevenda.unidade}
                  onChange={(event) =>
                    setFormProdutoRevenda((atual) => ({
                      ...atual,
                      unidade: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Preço de venda (R$) *">
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formProdutoRevenda.precoVenda}
                  onChange={(event) =>
                    setFormProdutoRevenda((atual) => ({
                      ...atual,
                      precoVenda: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Custo unitário (R$)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formProdutoRevenda.custoUnitario}
                  onChange={(event) =>
                    setFormProdutoRevenda((atual) => ({
                      ...atual,
                      custoUnitario: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field
                label={
                  edicaoId
                    ? "Saldo atual (altere por Entrada/Saída)"
                    : "Estoque inicial"
                }
              >
                <input
                  type="number"
                  min="0"
                  step="1"
                  disabled={Boolean(edicaoId)}
                  value={formProdutoRevenda.estoqueAtual}
                  onChange={(event) =>
                    setFormProdutoRevenda((atual) => ({
                      ...atual,
                      estoqueAtual: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Estoque mínimo">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formProdutoRevenda.estoqueMinimo}
                  onChange={(event) =>
                    setFormProdutoRevenda((atual) => ({
                      ...atual,
                      estoqueMinimo: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field
                label="Intervalo de recompra (dias)"
                hint="Usado só como sugestão; 0 desativa recompra automática."
              >
                <input
                  type="number"
                  min="0"
                  max="3650"
                  step="1"
                  value={formProdutoRevenda.intervaloRecompraDias ?? 30}
                  onChange={(event) =>
                    setFormProdutoRevenda((atual) => ({
                      ...atual,
                      intervaloRecompraDias: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
            </div>
            <p style={styles.sub}>
              O estoque inicial gera apenas um movimento de entrada inicial;
              nenhum financeiro é criado.
            </p>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.secondary}
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
              <button type="submit" style={styles.primary} disabled={salvando}>
                {salvando
                  ? "Salvando…"
                  : edicaoId
                    ? "Salvar produto"
                    : "Cadastrar produto"}
              </button>
            </div>
          </form>
        </Modal>
      );
    return null;
  }

  function renderModalItemValor() {
    if (!modalItemValor) return null;
    const { comanda, itemId, itemNome, itemTipo, quantidade, valorAtual, novoValor, senhaGerente, motivo, salvando: salvandoItem } = modalItemValor;
    const ehFinalizada = ["paga", "em_conta"].includes(comanda.status);
    const valNum = parseFloat(String(novoValor).replace(",", ".")) || 0;
    const novoSubtotalItem = valNum * Number(quantidade || 1);
    const subtotalAntigoItem = Number(valorAtual || 0) * Number(quantidade || 1);
    const diferencaEstimada = novoSubtotalItem - subtotalAntigoItem;
    const novoTotalEstimado = Math.max(0, Number(comanda.total || 0) + diferencaEstimada);

    return (
      <Modal
        title={`✏️ Alterar Valor do Item — ${itemNome}`}
        zIndex={1100}
        onClose={() => !salvandoItem && setModalItemValor(null)}
      >
        <div style={{ display: "grid", gap: 16, minWidth: 320, maxWidth: 480 }}>
          <div style={{ padding: 14, borderRadius: 10, background: "var(--card)", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <strong style={{ fontSize: 16 }}>{itemNome}</strong>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                  {itemTipo} · Quantidade: <strong>{quantidade}</strong>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 12, color: "var(--muted)", display: "block" }}>Valor cobrado atual</span>
                <strong style={{ fontSize: 16, color: "#e05c5c" }}>{moeda(valorAtual)}</strong>
              </div>
            </div>
          </div>

          {comanda.itens?.length > 1 && (
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                Item a ser alterado:
              </label>
              <select
                style={inputStyle}
                value={itemId}
                onChange={(e) => {
                  const sel = (comanda.itens || []).find((i, idx) => (i.id || `${i.tipo}-${idx}`) === e.target.value);
                  if (sel) {
                    const v = sel.precoUnitario ?? sel.preco ?? 0;
                    setModalItemValor((prev) => ({
                      ...prev,
                      itemId: sel.id || e.target.value,
                      itemNome: sel.nome,
                      itemTipo: sel.tipo === "produto" ? "Produto de revenda" : "Serviço",
                      quantidade: sel.quantidade || sel.qtd || 1,
                      valorAtual: v,
                      novoValor: v,
                    }));
                  }
                }}
              >
                {(comanda.itens || []).map((i, idx) => (
                  <option key={i.id || idx} value={i.id || `${i.tipo}-${idx}`}>
                    {i.nome} — Atual: {moeda(i.precoUnitario || i.preco || 0)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
              Novo Valor Unitário (R$):
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              autoFocus
              style={{ ...inputStyle, fontSize: 18, fontWeight: 800, color: "var(--fg)" }}
              value={novoValor}
              onChange={(e) => setModalItemValor((prev) => ({ ...prev, novoValor: e.target.value }))}
              placeholder="Ex: 20.00"
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: 13 }}>
              <span style={{ color: "var(--muted)" }}>
                Subtotal deste item: <strong>{moeda(novoSubtotalItem)}</strong>
              </span>
              <span style={{ color: "#14b87a", fontWeight: 700 }}>
                Novo Total da Comanda: {moeda(novoTotalEstimado)}
              </span>
            </div>
          </div>

          {ehFinalizada && (
            <div style={{ padding: 14, borderRadius: 10, background: "rgba(2, 132, 199, 0.07)", border: "1px solid rgba(2, 132, 199, 0.35)" }}>
              <strong style={{ color: "#0284c7", display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                🔒 Trava de Segurança — Senha de Gerente Obrigatória
              </strong>
              <span style={{ fontSize: 12, color: "var(--fg)", display: "block", margin: "4px 0 8px" }}>
                Como esta comanda já foi finalizada ({comanda.status === "em_conta" ? "Lançada em Conta" : "Paga"}), a alteração recalcula automaticamente o faturamento e o saldo do cliente e exige a senha do gerente:
              </span>
              <input
                type="password"
                placeholder="Digite a senha do gerente / administrador"
                style={{ ...inputStyle, background: "#fff", color: "#111" }}
                value={senhaGerente}
                onChange={(e) => setModalItemValor((prev) => ({ ...prev, senhaGerente: e.target.value }))}
              />
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
              Justificativa / Motivo da correção (opcional):
            </label>
            <input
              type="text"
              style={inputStyle}
              value={motivo}
              onChange={(e) => setModalItemValor((prev) => ({ ...prev, motivo: e.target.value }))}
              placeholder="Ex: Valor da sobrancelha digitado errado"
            />
          </div>

          <div style={{ ...styles.modalActions, marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              style={styles.secondary}
              disabled={salvandoItem}
              onClick={() => setModalItemValor(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              style={{ ...styles.primary, background: "#10b981", borderColor: "#059669", fontWeight: 800, fontSize: 14, padding: "10px 20px" }}
              disabled={salvandoItem}
              onClick={confirmarAlteracaoValorItem}
            >
              {salvandoItem ? "Salvando e refinalizando…" : "💾 Salvar Novo Valor & Refinalizar Comanda"}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  function renderModalReabrir() {
    if (!modalReabrir) return null;
    const { comanda, senhaGerente, motivo, salvando: salvandoReabrir } = modalReabrir;

    return (
      <Modal
        title={`🔄 Reabrir Comanda para Edição Completa (#${comanda.id})`}
        zIndex={1100}
        onClose={() => !salvandoReabrir && setModalReabrir(null)}
      >
        <div style={{ display: "grid", gap: 16, minWidth: 320, maxWidth: 480 }}>
          <div style={{ padding: 14, borderRadius: 10, background: "rgba(2, 132, 199, 0.06)", border: "1px solid rgba(2, 132, 199, 0.25)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0284c7" }}>
              Reabertura de Comanda Finalizada
            </div>
            <div style={{ fontSize: 13, marginTop: 4, color: "var(--fg)" }}>
              Cliente: <strong>{comanda.clienteNome || "Cliente Eventual"}</strong> · Total faturado atual: <strong>{moeda(comanda.total)}</strong>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
              Esta ação reabre a comanda para que você possa adicionar ou remover serviços e produtos livremente. Ao concluir a edição, basta clicar em <strong>"Finalizar Novamente em Conta"</strong>.
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
              🔒 Senha de Gerente / Administrador:
            </label>
            <input
              type="password"
              autoFocus
              placeholder="Digite a senha para autorizar a reabertura"
              style={{ ...inputStyle, background: "#fff", color: "#111" }}
              value={senhaGerente}
              onChange={(e) => setModalReabrir((prev) => ({ ...prev, senhaGerente: e.target.value }))}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
              Motivo da Reabertura:
            </label>
            <input
              type="text"
              style={inputStyle}
              value={motivo}
              onChange={(e) => setModalReabrir((prev) => ({ ...prev, motivo: e.target.value }))}
              placeholder="Ex: Ajuste de itens e serviços"
            />
          </div>

          <div style={{ ...styles.modalActions, marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              style={styles.secondary}
              disabled={salvandoReabrir}
              onClick={() => setModalReabrir(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              style={{ ...styles.primary, background: "#0284c7", borderColor: "#0284c7", fontWeight: 800, fontSize: 14, padding: "10px 20px" }}
              disabled={salvandoReabrir}
              onClick={confirmarReaberturaComanda}
            >
              {salvandoReabrir ? "Reabrindo comanda…" : "🔄 Confirmar Reabertura"}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  function renderIntegracoes() {
    const whatsapp = integracoes?.whatsapp;
    const whatsappView = integracoes
      ? whatsappIntegrationStatus(whatsapp)
      : {
          badge: "aguardando",
          label: "Atualizando status da unidade…",
          automatic: "Aguardando diagnóstico",
        };
    const ia = integracoes?.ia;
    const commerce = integracoes?.commerce || {};
    const whatsappMessagingOk = Boolean(
      whatsappAi.messagingConfigured ?? whatsappAi.evolutionConfigured,
    );
    const whatsappAiReady = Boolean(
      whatsappAi.featureEnabled &&
      whatsappAi.gemini?.configured &&
      whatsappMessagingOk,
    );
    const whatsappAiActive = whatsappAi.channel?.status === "ativo";
    const whatsappAiCircuitOpen = whatsappAi.channel?.aiCircuitOpen === true;
    const whatsappAiQueue =
      Number(whatsappAi.tasks?.pendente || 0) +
      Number(whatsappAi.tasks?.processando || 0);
    const whatsappAiFailed = Number(whatsappAi.tasks?.falha || 0);
    const whatsappAiDeadLetter = Number(whatsappAi.tasks?.deadLetter || 0);
    const whatsappAiUnknown = Number(whatsappAi.deliveries?.unknown || 0);
    const iaDisponivel = Boolean(ia?.analiseOperacionalDisponivel);
    const prontidaoCommerce = Number(commerce?.prontidao?.percentual || 0);
    const commerceDisponivel = ![
      "desativado",
      "indisponivel",
      "temporariamente_indisponivel",
      "sem_membership",
      "sem_permissao",
    ].includes(commerce?.status);
    return (
      <div style={{ display: "grid", gap: 18 }}>
        <NfseConfigCard onToast={(m) => toast(m, "success")} />
        <Card
          style={{
            padding: 20,
            background:
              "linear-gradient(135deg, color-mix(in srgb, #25d366 10%, var(--card)), var(--card))",
          }}
        >
          <div style={styles.sectionTitle}>
            <div>
              <div style={styles.kicker}>Canais e automação controlada</div>
              <h2 style={{ ...styles.h2, fontSize: 22, marginTop: 5 }}>
                Integrações da Barbearia
              </h2>
              <p style={styles.sub}>
                WhatsApp e IA operam com consentimento, limites e handoff. O
                canal permanece inerte enquanto não estiver explicitamente
                configurado e ativo.
              </p>
            </div>
            <button type="button" style={styles.secondary} onClick={carregar}>
              Atualizar status
            </button>
          </div>
          <div style={styles.integrationGrid}>
            <div style={styles.integrationCard}>
              <div style={styles.integrationHeading}>
                <div
                  style={{ ...styles.integrationIcon, background: "#25d366" }}
                >
                  W
                </div>
                <div>
                  <strong>WhatsApp da unidade</strong>
                  <span style={styles.sub}>{whatsappView.label}</span>
                </div>
                <Badge status={whatsappView.badge} />
              </div>
              <div style={styles.metricLine}>
                <span>Atendimento de mensagens recebidas</span>
                <strong>{whatsappView.automatic}</strong>
              </div>
              <div style={styles.metricLine}>
                <span>Adaptador de envio manual legado</span>
                <strong>
                  {whatsapp?.envioManualDisponivel
                    ? "Disponível"
                    : "Indisponível"}
                </strong>
              </div>
              <p style={styles.sub}>
                A IA atende por padrão quando o canal está ativo. A conversa
                passa à equipe se alguém pedir atendimento humano ou se houver
                exceção de segurança; a equipe pode retomá-la. O formulário
                abaixo é um envio manual legado independente do canal IA e exige
                consentimento e confirmação.
              </p>
              <form
                onSubmit={enviarWhatsApp}
                style={{ display: "grid", gap: 10, marginTop: 14 }}
              >
                <Field label="Cliente com consentimento">
                  <select
                    value={formWhatsApp.clienteId}
                    onChange={(event) => {
                      const cliente = clientes.find(
                        (item) => item.id === event.target.value,
                      );
                      setFormWhatsApp((atual) => ({
                        ...atual,
                        clienteId: event.target.value,
                        telefone: cliente?.telefone || atual.telefone,
                        consentimentoConfirmado: false,
                      }));
                    }}
                    style={inputStyle}
                    disabled={!whatsapp?.envioManualDisponivel}
                  >
                    <option value="">
                      Contato avulso (exige autorização abaixo)
                    </option>
                    {clientes
                      .filter((cliente) => cliente.padrao !== true)
                      .map((cliente) => (
                        <option key={cliente.id} value={cliente.id}>
                          {cliente.nome}
                          {cliente.telefone ? ` · ${cliente.telefone}` : ""}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Finalidade">
                  <select
                    value={formWhatsApp.finalidade}
                    onChange={(event) =>
                      setFormWhatsApp((atual) => ({
                        ...atual,
                        finalidade: event.target.value,
                      }))
                    }
                    style={inputStyle}
                    disabled={!whatsapp?.envioManualDisponivel}
                  >
                    <option value="atendimento">Atendimento</option>
                    <option value="marketing">Marketing</option>
                  </select>
                </Field>
                <Field label="Telefone">
                  <input
                    value={formWhatsApp.telefone}
                    onChange={(event) =>
                      setFormWhatsApp((atual) => ({
                        ...atual,
                        telefone: event.target.value,
                      }))
                    }
                    placeholder="DDD + número"
                    style={inputStyle}
                    disabled={
                      !whatsapp?.envioManualDisponivel ||
                      Boolean(formWhatsApp.clienteId)
                    }
                  />
                </Field>
                <Field label="Mensagem">
                  <textarea
                    rows={4}
                    value={formWhatsApp.mensagem}
                    onChange={(event) =>
                      setFormWhatsApp((atual) => ({
                        ...atual,
                        mensagem: event.target.value,
                      }))
                    }
                    placeholder="Escreva uma mensagem operacional…"
                    style={{ ...inputStyle, resize: "vertical" }}
                    disabled={!whatsapp?.envioManualDisponivel}
                  />
                </Field>
                {!formWhatsApp.clienteId && (
                  <label
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      color: "var(--muted)",
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formWhatsApp.consentimentoConfirmado}
                      onChange={(event) =>
                        setFormWhatsApp((atual) => ({
                          ...atual,
                          consentimentoConfirmado: event.target.checked,
                        }))
                      }
                      disabled={!whatsapp?.envioManualDisponivel}
                    />{" "}
                    Confirmo que o destinatário autorizou este contato.
                  </label>
                )}
                <button
                  type="submit"
                  style={{ ...styles.primary, background: "#25d366" }}
                  disabled={!whatsapp?.envioManualDisponivel || salvando}
                >
                  {whatsapp?.envioManualDisponivel
                    ? "Enviar manualmente"
                    : "Configurar provedor para enviar"}
                </button>
              </form>
            </div>
            <div style={styles.integrationCard}>
              <div style={styles.integrationHeading}>
                <div
                  style={{ ...styles.integrationIcon, background: "#6d5dfc" }}
                >
                  IA
                </div>
                <div>
                  <strong>Assistente IA operacional</strong>
                  <span style={styles.sub}>
                    {ia?.configurada
                      ? `Provedor disponível${ia.modelo ? ` · ${ia.modelo}` : ""}`
                      : iaDisponivel
                        ? `Modo local tenant-aware · ${ia?.modelo || "regras-dino-local"}`
                        : "Assistente indisponível"}
                  </span>
                </div>
                <Badge
                  status={
                    iaDisponivel ? "configurado" : "pendente_configuracao"
                  }
                />
              </div>
              <div style={styles.metricLine}>
                <span>Escopo da consulta</span>
                <strong>
                  Clientes, agenda, serviços, loja, vendas e promoções
                </strong>
              </div>
              <div style={styles.metricLine}>
                <span>Ações críticas</span>
                <strong>Somente após CONFIRMAR</strong>
              </div>
              <p style={styles.sub}>
                A IA capta o cliente, consulta dados reais, vende produtos de
                revenda, agenda serviços, remarca, cancela e encaminha para a
                equipe. Nenhuma ação crítica é concluída sem confirmação
                explícita.
              </p>
              <form
                onSubmit={consultarAssistente}
                style={{ display: "grid", gap: 10, marginTop: 14 }}
              >
                <Field label="Pergunta para o assistente">
                  <textarea
                    rows={4}
                    value={assistentePergunta}
                    onChange={(event) =>
                      setAssistentePergunta(event.target.value)
                    }
                    placeholder="Ex.: quais horários estão mais ocupados hoje?"
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </Field>
                <button
                  type="submit"
                  style={styles.primary}
                  disabled={consultandoAssistente}
                >
                  {consultandoAssistente
                    ? "Analisando…"
                    : "Consultar assistente"}
                </button>
              </form>
              {assistenteResposta?.resposta && (
                <div style={styles.aiResponse}>
                  <strong>Resposta do assistente</strong>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      marginTop: 8,
                      lineHeight: 1.55,
                    }}
                  >
                    {assistenteResposta.resposta}
                  </div>
                  <small style={styles.sub}>
                    Resposta gerada a partir dos dados operacionais
                    selecionados; confirme qualquer decisão manualmente.
                  </small>
                </div>
              )}
              {assistenteResposta?.erro && (
                <div style={{ ...styles.notice, borderColor: "#e05c5c" }}>
                  <strong>Consulta não disponível</strong>
                  <div style={styles.sub}>{assistenteResposta.erro}</div>
                </div>
              )}
            </div>
            <div style={{ ...styles.integrationCard, gridColumn: "1 / -1" }}>
              <div style={styles.integrationHeading}>
                <div
                  style={{ ...styles.integrationIcon, background: "#111827" }}
                >
                  AI
                </div>
                <div style={{ flex: 1 }}>
                  <strong>
                    {formWhatsappAi.displayName ||
                      "Atendente humanizado da unidade"}
                  </strong>
                  <span style={styles.sub}>
                    WhatsApp conectado à loja, agenda, clientes, vendas e
                    operação da unidade
                  </span>
                </div>
                <Badge status={whatsappView.badge} />
              </div>
              <div style={styles.readinessGrid}>
                <div style={styles.readinessItem}>
                  <strong>Feature flag</strong>
                  <span
                    style={{
                      fontWeight: 800,
                      color: whatsappAi.featureEnabled ? "#14b87a" : "#f59e0b",
                    }}
                  >
                    {whatsappAi.featureEnabled ? "Ativa" : "Desativada"}
                  </span>
                  <small style={styles.sub}>Ativação separada do deploy</small>
                </div>
                <div style={styles.readinessItem}>
                  <strong>Gemini</strong>
                  <span
                    style={{
                      fontWeight: 800,
                      color: whatsappAi.gemini?.configured
                        ? "#14b87a"
                        : "#f59e0b",
                    }}
                  >
                    {whatsappAi.gemini?.configured
                      ? whatsappAi.gemini.model
                      : "Pendente"}
                  </span>
                  <small style={styles.sub}>
                    {whatsappAiCircuitOpen
                      ? "Circuito aberto · handoff obrigatório"
                      : `${Number(whatsappAi.provider24h?.total || 0)} execução(ões) em 24h`}
                  </small>
                </div>
                <div style={styles.readinessItem}>
                  <strong>
                    {whatsappAi.messagingProvider?.label || "Provedor WhatsApp"}
                  </strong>
                  <span
                    style={{
                      fontWeight: 800,
                      color: whatsappMessagingOk ? "#14b87a" : "#f59e0b",
                    }}
                  >
                    {whatsappMessagingOk ? "Configurado" : "Pendente"}
                  </span>
                  <small style={styles.sub}>
                    <Link to="/admin/whatsapp">Conexão do número (QR) →</Link>
                  </small>
                </div>
                <div style={styles.readinessItem}>
                  <strong>Canal</strong>
                  <span style={{ fontWeight: 800 }}>
                    {whatsappAi.channel?.status || "Não criado"}
                  </span>
                  <small style={styles.sub}>
                    {whatsappAi.channel?.lastEventAt
                      ? `Último evento ${fmtDate(whatsappAi.channel.lastEventAt)}`
                      : "Sem eventos recebidos"}
                  </small>
                </div>
                <div style={styles.readinessItem}>
                  <strong>Fila humana</strong>
                  <span style={{ fontWeight: 800 }}>
                    {Number(whatsappAi.sessions?.humano || 0)}
                  </span>
                  <small style={styles.sub}>
                    {Number(whatsappAi.humanQueue?.unassigned || 0)} sem
                    responsável
                  </small>
                </div>
                <div style={styles.readinessItem}>
                  <strong>Fila técnica</strong>
                  <span style={{ fontWeight: 800 }}>{whatsappAiQueue}</span>
                  <small style={styles.sub}>
                    {whatsappAiFailed} aguardando retry · {whatsappAiDeadLetter}{" "}
                    dead-letter
                  </small>
                </div>
                <div style={styles.readinessItem}>
                  <strong>Entregas 24h</strong>
                  <span style={{ fontWeight: 800 }}>
                    {Number(whatsappAi.deliveries?.sent || 0)} enviadas
                  </span>
                  <small style={styles.sub}>
                    {whatsappAiUnknown} incerta(s) · nunca reenviadas
                    automaticamente
                  </small>
                </div>
                <div style={styles.readinessItem}>
                  <strong>Latência Gemini</strong>
                  <span style={{ fontWeight: 800 }}>
                    {Number(whatsappAi.provider24h?.avgLatencyMs || 0)} ms
                  </span>
                  <small style={styles.sub}>
                    {Number(whatsappAi.provider24h?.failed || 0)} falha(s) ·{" "}
                    {Number(whatsappAi.provider24h?.toolCalls || 0)}{" "}
                    ferramenta(s)
                  </small>
                </div>
                <div style={styles.readinessItem}>
                  <strong>Worker</strong>
                  <span style={{ fontWeight: 800 }}>
                    {whatsappAi.worker?.lastHeartbeatAt
                      ? "Observável"
                      : "Sem ciclos"}
                  </span>
                  <small style={styles.sub}>
                    {whatsappAi.worker?.lastHeartbeatAt
                      ? `Último ciclo ${fmtDate(whatsappAi.worker.lastHeartbeatAt)}`
                      : "Inerte enquanto provedores estiverem pendentes"}
                  </small>
                </div>
              </div>
              {whatsappAi.unavailable && (
                <div
                  style={{
                    ...styles.notice,
                    borderColor: "#f59e0b",
                    marginTop: 12,
                  }}
                >
                  <strong>Status indisponível</strong>
                  <div style={styles.sub}>
                    {whatsappAi.error ||
                      "A migration da IA ainda não foi aplicada."}
                  </div>
                </div>
              )}
              <form
                onSubmit={(event) => event.preventDefault()}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
                  gap: 10,
                  marginTop: 14,
                }}
              >
                <Field label="Instância do WhatsApp">
                  <input
                    value={formWhatsappAi.instance}
                    onChange={(event) =>
                      setFormWhatsappAi((atual) => ({
                        ...atual,
                        instance: event.target.value,
                      }))
                    }
                    placeholder="dino"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Nome do atendimento">
                  <input
                    value={formWhatsappAi.displayName}
                    onChange={(event) =>
                      setFormWhatsappAi((atual) => ({
                        ...atual,
                        displayName: event.target.value,
                      }))
                    }
                    placeholder="Atendimento da unidade"
                    style={inputStyle}
                  />
                </Field>
              </form>
              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  background:
                    "color-mix(in srgb, var(--card) 88%, var(--accent))",
                }}
              >
                <strong>Capacidades da operação</strong>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(min(210px, 100%), 1fr))",
                    gap: 10,
                    marginTop: 10,
                  }}
                >
                  {[
                    [
                      "humanized",
                      "Tom humanizado",
                      "Conversa natural e transparente",
                    ],
                    [
                      "captureLeads",
                      "Captação de clientes",
                      "Registra lead e interações no CRM",
                    ],
                    [
                      "operateStore",
                      "Loja e vendas",
                      "Consulta catálogo, estoque e prepara pedidos",
                    ],
                    [
                      "manageAppointments",
                      "Agenda",
                      "Consulta, agenda, remarca e cancela",
                    ],
                    [
                      "sendPromotions",
                      "Promoções",
                      "Exige opt-in e confirmação antes do envio",
                    ],
                    [
                      "reminders",
                      "Lembretes",
                      "Usa a fila governada de notificações",
                    ],
                    [
                      "humanHandoff",
                      "Handoff humano",
                      "Entrega a conversa para a equipe",
                    ],
                  ].map(([key, label, description]) => (
                    <label
                      key={key}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "flex-start",
                        padding: 10,
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        background: "var(--bg)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formWhatsappAi[key] !== false}
                        onChange={(event) =>
                          setFormWhatsappAi((atual) => ({
                            ...atual,
                            [key]: event.target.checked,
                          }))
                        }
                      />
                      <span>
                        <strong>{label}</strong>
                        <small
                          style={{
                            ...styles.sub,
                            display: "block",
                            marginTop: 3,
                          }}
                        >
                          {description}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
                <small
                  style={{ ...styles.sub, display: "block", marginTop: 10 }}
                >
                  Promoções começam desativadas. Mesmo ativadas, o cliente
                  precisa autorizar marketing e responder CONFIRMAR para cada
                  envio preparado.
                </small>
              </div>
              <div
                style={{
                  ...styles.notice,
                  marginTop: 12,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={styles.sectionTitle}>
                  <div>
                    <strong>Política de perfil e oportunidades</strong>
                    <div style={styles.sub}>
                      Inativa por padrão; consentimento de personalização é
                      separado de marketing e revogável pelo cliente.
                    </div>
                  </div>
                  <Badge
                    status={
                      whatsappAi.policy?.opportunitiesEnabled
                        ? "configurado"
                        : "rascunho"
                    }
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
                    gap: 10,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      color: "var(--muted)",
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formWhatsappAiPolicy.personalizationEnabled}
                      onChange={(event) =>
                        setFormWhatsappAiPolicy((atual) => ({
                          ...atual,
                          personalizationEnabled: event.target.checked,
                          opportunitiesEnabled: event.target.checked
                            ? atual.opportunitiesEnabled
                            : false,
                        }))
                      }
                    />{" "}
                    Usar perfil somente após consentimento específico
                  </label>
                  <label
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      color: "var(--muted)",
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formWhatsappAiPolicy.opportunitiesEnabled}
                      onChange={(event) =>
                        setFormWhatsappAiPolicy((atual) => ({
                          ...atual,
                          opportunitiesEnabled: event.target.checked,
                        }))
                      }
                      disabled={!formWhatsappAiPolicy.personalizationEnabled}
                    />{" "}
                    Permitir uma oportunidade relevante por conversa, com
                    marketing autorizado
                  </label>
                  <Field label="Cooldown após recusa (dias)">
                    <input
                      type="number"
                      min="7"
                      max="90"
                      value={formWhatsappAiPolicy.cooldownDays}
                      onChange={(event) =>
                        setFormWhatsappAiPolicy((atual) => ({
                          ...atual,
                          cooldownDays: event.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Aviso de privacidade opcional">
                    <textarea
                      rows={3}
                      value={formWhatsappAiPolicy.privacyNotice}
                      onChange={(event) =>
                        setFormWhatsappAiPolicy((atual) => ({
                          ...atual,
                          privacyNotice: event.target.value,
                        }))
                      }
                      placeholder="Vazio usa o aviso seguro padrão da unidade"
                      style={{ ...inputStyle, resize: "vertical" }}
                    />
                  </Field>
                </div>
                <div style={styles.readinessGrid}>
                  <div style={styles.readinessItem}>
                    <strong>Perfil 24h</strong>
                    <span style={{ fontWeight: 800 }}>
                      {Number(whatsappAi.policy24h?.profile_resolved || 0)}
                    </span>
                    <small style={styles.sub}>
                      {Number(whatsappAi.policy24h?.profile_ambiguous || 0)}{" "}
                      ambiguidade(s) bloqueada(s)
                    </small>
                  </div>
                  <div style={styles.readinessItem}>
                    <strong>Oportunidades 24h</strong>
                    <span style={{ fontWeight: 800 }}>
                      {Number(whatsappAi.policy24h?.opportunity_offered || 0)}
                    </span>
                    <small style={styles.sub}>
                      {Number(whatsappAi.policy24h?.opportunity_blocked || 0)}{" "}
                      bloqueada(s) pelo gate
                    </small>
                  </div>
                  <div style={styles.readinessItem}>
                    <strong>Segurança 24h</strong>
                    <span style={{ fontWeight: 800 }}>
                      {Number(whatsappAi.policy24h?.output_blocked || 0)}
                    </span>
                    <small style={styles.sub}>
                      {Number(whatsappAi.policy24h?.injection_suspected || 0)}{" "}
                      injeção(ões) suspeita(s)
                    </small>
                  </div>
                </div>
                <button
                  type="button"
                  style={styles.secondary}
                  disabled={salvando || !whatsappAi.channel}
                  onClick={salvarPoliticaWhatsappAi}
                >
                  Salvar política sem ativar o canal
                </button>
              </div>
              <div
                style={{
                  ...styles.notice,
                  marginTop: 12,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={styles.sectionTitle}>
                  <div
                    style={{ display: "flex", gap: 12, alignItems: "center" }}
                  >
                    <img
                      src="/trex/avatar-256.webp"
                      alt="Avatar do atendente T-Rex"
                      width="56"
                      height="56"
                      style={{
                        borderRadius: "50%",
                        border: "2px solid var(--line)",
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <strong>Persona do atendente</strong>
                      <div style={styles.sub}>
                        Nome, jeito de falar e figurinhas no WhatsApp. Não muda
                        o que a IA pode fazer: agenda, confirmação por SIM,
                        consentimentos e handoff seguem iguais.
                      </div>
                    </div>
                  </div>
                  <Badge
                    status={
                      whatsappAi.channel?.persona?.ativa
                        ? "configurado"
                        : "rascunho"
                    }
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
                    gap: 10,
                  }}
                >
                  <Field label="Nome do atendente">
                    <input
                      value={formPersona.nome}
                      maxLength={40}
                      onChange={(event) =>
                        setFormPersona((atual) => ({
                          ...atual,
                          nome: event.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Quando diz que é assistente">
                    <select
                      value={formPersona.revelarIa}
                      onChange={(event) =>
                        setFormPersona((atual) => ({
                          ...atual,
                          revelarIa: event.target.value,
                        }))
                      }
                      style={inputStyle}
                    >
                      <option value="quando_perguntado">
                        Só se o cliente perguntar (nunca nega)
                      </option>
                      <option value="na_apresentacao">
                        Já na apresentação
                      </option>
                    </select>
                  </Field>
                  <label
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      color: "var(--muted)",
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formPersona.ativo}
                      onChange={(event) =>
                        setFormPersona((atual) => ({
                          ...atual,
                          ativo: event.target.checked,
                        }))
                      }
                    />{" "}
                    Usar a persona neste canal
                  </label>
                  <label
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      color: "var(--muted)",
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formPersona.mensagensCurtas}
                      onChange={(event) =>
                        setFormPersona((atual) => ({
                          ...atual,
                          mensagensCurtas: event.target.checked,
                        }))
                      }
                    />{" "}
                    Mensagens curtas em bolhas (alvo de 120 caracteres; resumos
                    e links preservados)
                  </label>
                  <label
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      color: "var(--muted)",
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formPersona.figurinhas}
                      onChange={(event) =>
                        setFormPersona((atual) => ({
                          ...atual,
                          figurinhas: event.target.checked,
                        }))
                      }
                    />{" "}
                    Figurinhas do mascote (no máximo 1 por dia por cliente)
                  </label>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  {(
                    whatsappAi.channel?.persona?.figurinhasDisponiveis || [
                      "oi",
                      "agendado",
                      "um-instante",
                      "corte-na-regua",
                      "perfume-novo",
                      "valeu",
                      "promocao",
                      "foi-mal",
                      "ate-amanha",
                    ]
                  ).map((nome) => (
                    <img
                      key={nome}
                      src={`/trex/figurinhas/${nome}.webp`}
                      alt={`Figurinha ${nome}`}
                      title={nome}
                      width="56"
                      height="56"
                      loading="lazy"
                      style={{ opacity: formPersona.figurinhas ? 1 : 0.35 }}
                    />
                  ))}
                </div>
                <small style={styles.sub}>
                  {whatsappAi.channel?.persona?.figurinhasNoProvedor
                    ? "O provedor de WhatsApp aceita figurinhas."
                    : "O provedor de WhatsApp ainda não aceita figurinhas (falta CHATBOT_BACKEND_STICKER_PATH): o texto sai normal e a figurinha é pulada."}
                  {whatsappAi.channel?.persona?.origem === "ambiente"
                    ? " A persona está ligada pela variável WHATSAPP_AI_PERSONA; salve aqui para fixar no canal."
                    : ""}
                </small>
                <button
                  type="button"
                  style={styles.secondary}
                  disabled={salvando || !whatsappAi.channel}
                  onClick={salvarPersonaWhatsappAi}
                >
                  Salvar persona
                </button>
              </div>
              <div
                style={{
                  ...styles.notice,
                  marginTop: 12,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={styles.sectionTitle}>
                  <div>
                    <strong>Notificação de handoff</strong>
                    <div style={styles.sub}>
                      Quando o atendimento vai para uma pessoa, enviamos o
                      histórico por e-mail e iniciamos a conversa no WhatsApp do
                      atendente (número diferente do cliente). Deixe em branco
                      para não notificar por aquela via.
                    </div>
                  </div>
                  <Badge
                    status={
                      whatsappAi.channel?.handoff?.notifyEmail ||
                      whatsappAi.channel?.handoff?.attendantPhone
                        ? "configurado"
                        : "rascunho"
                    }
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
                    gap: 10,
                  }}
                >
                  <Field label="E-mail para o histórico">
                    <input
                      type="email"
                      value={formWhatsappAiHandoff.notifyEmail}
                      onChange={(event) =>
                        setFormWhatsappAiHandoff((atual) => ({
                          ...atual,
                          notifyEmail: event.target.value,
                        }))
                      }
                      placeholder="recepcao@suaempresa.com"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="WhatsApp do atendente humano">
                    <input
                      type="tel"
                      value={formWhatsappAiHandoff.attendantPhone}
                      onChange={(event) =>
                        setFormWhatsappAiHandoff((atual) => ({
                          ...atual,
                          attendantPhone: event.target.value,
                        }))
                      }
                      placeholder="Ex.: 65 99999-0000 (número diferente do cliente)"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="WhatsApp para aviso de venda fechada">
                    <input
                      type="tel"
                      value={formWhatsappAiHandoff.salesPhone}
                      onChange={(event) =>
                        setFormWhatsappAiHandoff((atual) => ({
                          ...atual,
                          salesPhone: event.target.value,
                        }))
                      }
                      placeholder="Ex.: 65 99999-0000 (em branco usa o do atendente)"
                      style={inputStyle}
                    />
                  </Field>
                </div>
                <small style={styles.sub}>
                  O e-mail depende de RESEND_API_KEY/EMAIL_FROM no ambiente; sem
                  a chave, o e-mail não é enviado. O WhatsApp para o atendente
                  respeita a mesma trava de envio do canal.
                </small>
                {confirmandoHandoff && (
                  <div role="alert" style={styles.sub}>
                    Confirmar? Quando o atendimento for para uma pessoa, o
                    histórico vai por e-mail e o atendente recebe a conversa no
                    WhatsApp informado. As vendas fechadas pelo T-Rex avisam o
                    WhatsApp de venda (ou o do atendente, se ficar em branco).
                    Isso não ativa o canal.
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    style={confirmandoHandoff ? styles.primary : styles.secondary}
                    disabled={salvando || !whatsappAi.channel}
                    onClick={salvarHandoffWhatsappAi}
                  >
                    {confirmandoHandoff
                      ? "Confirmar e salvar"
                      : "Salvar notificação de handoff"}
                  </button>
                  {confirmandoHandoff && (
                    <button
                      type="button"
                      style={styles.secondary}
                      onClick={() => setConfirmandoHandoff(false)}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginTop: 12,
                }}
              >
                <button
                  type="button"
                  style={styles.secondary}
                  disabled={salvando || !whatsappAi.gemini?.configured}
                  onClick={testarGeminiWhatsappAi}
                >
                  Testar Gemini
                </button>
                {!whatsappAi.channel && (
                  <button
                    type="button"
                    style={styles.secondary}
                    disabled={salvando || !formWhatsappAi.instance.trim()}
                    onClick={() => configurarWhatsappAi("rascunho")}
                  >
                    Salvar canal em rascunho
                  </button>
                )}
                {!whatsappAiActive && (
                  <button
                    type="button"
                    style={styles.primary}
                    disabled={
                      salvando ||
                      !whatsappAiReady ||
                      whatsappAiCircuitOpen ||
                      !formWhatsappAi.instance.trim()
                    }
                    onClick={() => configurarWhatsappAi("ativo")}
                  >
                    Ativar atendente IA
                  </button>
                )}
                {whatsappAiActive && (
                  <button
                    type="button"
                    style={styles.secondary}
                    disabled={salvando || !formWhatsappAi.instance.trim()}
                    onClick={() => configurarWhatsappAi("ativo")}
                  >
                    Salvar configuração do canal
                  </button>
                )}
                {whatsappAiActive && (
                  <button
                    type="button"
                    style={styles.secondary}
                    disabled={salvando}
                    onClick={() => configurarWhatsappAi("pausado")}
                  >
                    Pausar atendente
                  </button>
                )}
                <button
                  type="button"
                  style={styles.secondary}
                  disabled={salvando || !whatsappAiActive || !whatsappAiReady}
                  onClick={sincronizarWhatsappAi}
                >
                  Sincronizar webhook
                </button>
              </div>
              {whatsappAiCircuitOpen && (
                <div
                  style={{
                    ...styles.notice,
                    borderColor: "#e05c5c",
                    marginTop: 12,
                  }}
                >
                  <strong>Circuit breaker aberto</strong>
                  <div style={styles.sub}>
                    Novas conversas serão encaminhadas à equipe até{" "}
                    {whatsappAi.channel?.aiCircuitOpenUntil
                      ? fmtDate(whatsappAi.channel.aiCircuitOpenUntil)
                      : "a recuperação do provedor"}
                    .
                  </div>
                </div>
              )}
              {(whatsappAiDeadLetter > 0 || whatsappAiUnknown > 0) && (
                <div
                  style={{
                    ...styles.notice,
                    borderColor: "#f59e0b",
                    marginTop: 12,
                  }}
                >
                  <strong>Revisão humana necessária</strong>
                  <div style={styles.sub}>
                    {whatsappAiDeadLetter} tarefa(s) em dead-letter e{" "}
                    {whatsappAiUnknown} entrega(s) com resultado incerto. O
                    sistema não repete essas mensagens automaticamente.
                  </div>
                </div>
              )}
              <p style={{ ...styles.sub, marginTop: 12 }}>
                O atendimento é reativo, tenant-aware e informa que usa um
                assistente virtual. Captação, agenda e loja usam somente os
                dados reais da unidade selecionada. Pedidos, agendamentos,
                remarcações, cancelamentos e promoções só são concluídos após o
                cliente responder CONFIRMAR; pagamentos externos não são
                ativados. Falhas temporárias permitem nova tentativa. O cliente
                pode pedir para continuar com a IA em conversas sem responsável
                e sem bloqueio de segurança.
              </p>
              {whatsappAiSessions.filter((item) => item.status === "humano")
                .length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={styles.sectionTitle}>
                    <div>
                      <strong>Fila de atendimento humano</strong>
                      <div style={styles.sub}>
                        Telefones mascarados; conteúdo da conversa não é exibido
                        neste painel. Quando a equipe responde pelo celular, a
                        IA pausa sozinha naquela conversa e volta no horário
                        indicado.
                      </div>
                    </div>
                    <Badge status="pendente" />
                  </div>
                  <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
                    {whatsappAiSessions
                      .filter((item) => item.status === "humano")
                      .map((item) => (
                        <div
                          key={item.id}
                          style={{ ...styles.notice, display: "grid", gap: 8 }}
                        >
                          <div style={styles.metricLine}>
                            <span>
                              <strong>{item.nome || "Contato"}</strong> ·{" "}
                              {item.telefone || "telefone protegido"}
                            </span>
                            <strong>
                              Prioridade {Number(item.priority || 0)}
                            </strong>
                          </div>
                          <div style={styles.sub}>
                            Motivo:{" "}
                            {item.handoff_label ||
                              item.handoff_reason ||
                              "revisão humana"}{" "}
                            ·{" "}
                            {item.staff_pause_until
                              ? `IA volta sozinha às ${new Date(item.staff_pause_until).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Cuiaba" })}`
                              : `aguardando desde ${item.handoff_requested_at ? fmtDate(item.handoff_requested_at) : fmtDate(item.ultima_interacao_em)}`}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            {!item.assigned && (
                              <button
                                type="button"
                                style={styles.secondary}
                                disabled={salvando}
                                onClick={() => assumirSessaoWhatsappAi(item.id)}
                              >
                                Assumir conversa
                              </button>
                            )}
                            {item.assigned && (
                              <span
                                style={{ ...styles.sub, alignSelf: "center" }}
                              >
                                Atribuída{" "}
                                {item.assigned_at
                                  ? fmtDate(item.assigned_at)
                                  : ""}
                              </span>
                            )}
                            <button
                              type="button"
                              style={styles.secondary}
                              disabled={salvando}
                              onClick={() =>
                                liberarSessaoWhatsappAi(
                                  item.id,
                                  item.staff_pause_until,
                                )
                              }
                            >
                              {item.staff_pause_until
                                ? "Devolver à IA agora"
                                : "Retomar automação"}
                            </button>
                            <button
                              type="button"
                              style={styles.secondary}
                              disabled={salvando}
                              onClick={() => encerrarSessaoWhatsappAi(item.id)}
                            >
                              Encerrar
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              ...styles.notice,
              marginTop: 14,
              display: "grid",
              gap: 14,
            }}
          >
            <div style={styles.integrationHeading}>
              <div
                style={{
                  ...styles.integrationIcon,
                  background: "var(--accent)",
                }}
              >
                C
              </div>
              <div style={{ flex: 1 }}>
                <strong>{commerce?.storefront?.nome || "Commerce Dino"}</strong>
                <span style={styles.sub}>
                  {commerce?.storefront
                    ? `${commerce.storefront.lojaNome || "Loja da sessão"} · ${commerce.storefront.status}`
                    : "Canal digital da empresa ativa"}
                </span>
              </div>
              <Badge
                status={commerce?.status || "temporariamente_indisponivel"}
              />
              <button
                type="button"
                style={styles.iconButton}
                onClick={carregar}
                disabled={loading}
                aria-label="Atualizar status do Commerce"
                title="Atualizar status do Commerce"
              >
                ↻
              </button>
            </div>
            <small style={styles.sub}>
              Status somente leitura atualizado{" "}
              {commerce?.geradoEm ? fmtDate(commerce.geradoEm) : "agora"}.
            </small>
            <div
              aria-label={`Prontidão do Commerce: ${prontidaoCommerce}%`}
              style={{ display: "grid", gap: 6 }}
            >
              <div style={styles.metricLine}>
                <span>Prontidão comercial</span>
                <strong>{prontidaoCommerce}%</strong>
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: "var(--line)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, Math.max(0, prontidaoCommerce))}%`,
                    height: "100%",
                    background: commerce?.prontidao?.pronto
                      ? "#14b87a"
                      : "var(--accent)",
                    transition: "width .2s ease",
                  }}
                />
              </div>
            </div>
            <div style={styles.readinessGrid}>
              <div style={styles.readinessItem}>
                <strong>Catálogo publicado</strong>
                <span style={{ color: "var(--fg)", fontWeight: 800 }}>
                  {commerce?.catalogo?.publicados || 0} produto(s)
                </span>
                <small style={styles.sub}>
                  {commerce?.catalogo?.variantesPublicadas || 0} variante(s) ·{" "}
                  {commerce?.catalogo?.semPreco || 0} sem preço
                </small>
              </div>
              <div style={styles.readinessItem}>
                <strong>Estoque digital</strong>
                <span style={{ color: "var(--fg)", fontWeight: 800 }}>
                  {commerce?.estoque?.disponivel || 0} disponível(is)
                </span>
                <small style={styles.sub}>
                  {commerce?.estoque?.reservado || 0} reservado(s) ·{" "}
                  {commerce?.estoque?.estoqueBaixo || 0} em atenção
                </small>
              </div>
              <div style={styles.readinessItem}>
                <strong>Pedidos</strong>
                <span style={{ color: "var(--fg)", fontWeight: 800 }}>
                  {commerce?.pedidos?.abertos || 0} aberto(s)
                </span>
                <small style={styles.sub}>
                  {commerce?.pedidos?.total || 0} no histórico do tenant
                </small>
              </div>
              <div style={styles.readinessItem}>
                <strong>Fulfillment</strong>
                <span
                  style={{
                    color: commerce?.fulfillment?.emAtencao
                      ? "#f59e0b"
                      : "#14b87a",
                    fontWeight: 800,
                  }}
                >
                  {commerce?.fulfillment?.emAtencao || 0} em atenção
                </span>
                <small style={styles.sub}>
                  Separação, retirada, entrega e tracking
                </small>
              </div>
              <div style={styles.readinessItem}>
                <strong>Pagamentos</strong>
                <span
                  style={{
                    color: commerce?.pagamentos?.contasProntas
                      ? "#14b87a"
                      : "#f59e0b",
                    fontWeight: 800,
                  }}
                >
                  {commerce?.pagamentos?.contasProntas || 0} conta(s) pronta(s)
                </span>
                <small style={styles.sub}>
                  {commerce?.pagamentos?.aguardando || 0} pagamento(s)
                  aguardando
                </small>
              </div>
              <div style={styles.readinessItem}>
                <strong>Entrega e retirada</strong>
                <span
                  style={{
                    color: commerce?.frete?.metodosAtivos
                      ? "#14b87a"
                      : "#f59e0b",
                    fontWeight: 800,
                  }}
                >
                  {commerce?.frete?.metodosAtivos || 0} método(s) ativo(s)
                </span>
                <small style={styles.sub}>
                  {commerce?.frete?.retiradaAtiva
                    ? "Retirada ativa"
                    : `${commerce?.frete?.contasProntas || 0} conta(s) logística(s) pronta(s)`}
                </small>
              </div>
              <div style={styles.readinessItem}>
                <strong>Endereço público</strong>
                <span
                  style={{
                    color: commerce?.urlPublica ? "#14b87a" : "#f59e0b",
                    fontWeight: 800,
                  }}
                >
                  {commerce?.alias?.alias ||
                    commerce?.dominios?.principal ||
                    "Pendente"}
                </span>
                <small style={styles.sub}>
                  {commerce?.dominios?.verificados || 0} domínio(s)
                  verificado(s)
                </small>
              </div>
              <div style={styles.readinessItem}>
                <strong>Saúde do canal</strong>
                <span
                  style={{
                    color:
                      commerce?.saude?.banco === "healthy" &&
                      !commerce?.saude?.webhooksComFalha
                        ? "#14b87a"
                        : "#f59e0b",
                    fontWeight: 800,
                  }}
                >
                  {commerce?.saude?.banco === "healthy"
                    ? "Core acessível"
                    : "Core indisponível"}
                </span>
                <small style={styles.sub}>
                  {commerce?.saude?.webhooksComFalha || 0} webhook(s) com falha
                </small>
              </div>
            </div>
            <div style={styles.metricLine}>
              <span>Fonte de verdade digital</span>
              <strong>Commerce Core PostgreSQL</strong>
            </div>
            <div style={styles.metricLine}>
              <span>Estoque da revenda presencial compartilhado</span>
              <strong>Não</strong>
            </div>
            {commerce?.prontidao?.bloqueadores?.length > 0 && (
              <div style={{ ...styles.notice, borderColor: "#f59e0b" }}>
                <strong>Para ativar o canal</strong>
                <div style={{ ...styles.sub, marginTop: 6 }}>
                  {commerce.prontidao.bloqueadores
                    .map((item) => item.label)
                    .join(" · ")}
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                style={styles.primary}
                disabled={!commerceDisponivel}
                onClick={() =>
                  navigate(commerce?.links?.admin || "/admin/ecommerce")
                }
              >
                Abrir Commerce
              </button>
              <button
                type="button"
                style={styles.secondary}
                disabled={!commerceDisponivel}
                onClick={() =>
                  navigate(
                    commerce?.links?.catalogo || "/admin/ecommerce?tab=catalog",
                  )
                }
              >
                Catálogo
              </button>
              <button
                type="button"
                style={styles.secondary}
                disabled={!commerceDisponivel}
                onClick={() =>
                  navigate(
                    commerce?.links?.estoque || "/admin/ecommerce?tab=catalog",
                  )
                }
              >
                Estoque
              </button>
              <button
                type="button"
                style={styles.secondary}
                disabled={!commerceDisponivel}
                onClick={() =>
                  navigate(
                    commerce?.links?.pedidos || "/admin/ecommerce?tab=orders",
                  )
                }
              >
                Pedidos
              </button>
              <button
                type="button"
                style={styles.secondary}
                disabled={!commerceDisponivel}
                onClick={() =>
                  navigate(
                    commerce?.links?.pagamentos ||
                      "/admin/ecommerce?tab=payments",
                  )
                }
              >
                Pagamentos
              </button>
              <button
                type="button"
                style={styles.secondary}
                disabled={!commerceDisponivel}
                onClick={() =>
                  navigate(
                    commerce?.links?.frete || "/admin/ecommerce?tab=shipping",
                  )
                }
              >
                Entrega
              </button>
              <button
                type="button"
                style={styles.secondary}
                disabled={!commerceDisponivel}
                onClick={() =>
                  navigate(
                    commerce?.links?.dominios || "/admin/ecommerce?tab=domains",
                  )
                }
              >
                Domínios
              </button>
              {commerce?.urlPublica && (
                <a
                  href={commerce.urlPublica}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    ...styles.secondary,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  Abrir vitrine
                </a>
              )}
            </div>
            <p style={styles.sub}>
              A operação presencial continua na Barbearia ERP. O canal digital
              usa catálogo, preço, estoque, pedido e fulfillment próprios do
              Commerce; nenhuma sincronização automática ou baixa dupla é
              executada.
            </p>
          </div>
        </Card>
        <Card style={{ padding: 18 }}>
          <h2 style={styles.h2}>Ativações governadas</h2>
          <p style={styles.sub}>
            O atendimento automático usa o canal da unidade e provedores reais;
            o adaptador manual legado é separado. O assistente operacional
            prepara ações, mas pedidos e agendamentos exigem confirmação
            explícita. O Commerce informa os bloqueadores reais sem criar dados
            ou credenciais.
          </p>
          <div style={styles.readinessGrid}>
            <div style={styles.readinessItem}>
              <strong>WhatsApp</strong>
              <span
                style={{
                  color:
                    whatsappView.badge === "configurado"
                      ? "#14b87a"
                      : "#f59e0b",
                  fontWeight: 800,
                }}
              >
                {whatsappView.automatic}
              </span>
              <small style={styles.sub}>
                Atendimento reativo; campanhas exigem consentimento e gates
                próprios.
              </small>
            </div>
            <div style={styles.readinessItem}>
              <strong>Assistente</strong>
              <span
                style={{
                  color: iaDisponivel ? "#14b87a" : "#f59e0b",
                  fontWeight: 800,
                }}
              >
                {ia?.configurada
                  ? "Provedor externo ativo"
                  : iaDisponivel
                    ? "Análise local disponível"
                    : "Indisponível"}
              </span>
              <small style={styles.sub}>
                Ações críticas só após confirmação; handoff em exceções.
              </small>
            </div>
            <div style={styles.readinessItem}>
              <strong>Commerce</strong>
              <span
                style={{
                  color: commerce?.prontidao?.pronto ? "#14b87a" : "#f59e0b",
                  fontWeight: 800,
                }}
              >
                {commerce?.prontidao?.pronto
                  ? "Pronto para operar"
                  : `${prontidaoCommerce}% configurado`}
              </span>
              <small style={styles.sub}>
                {commerce?.prontidao?.bloqueadores?.length || 0} bloqueador(es)
                obrigatório(s).
              </small>
            </div>
            <div style={styles.readinessItem}>
              <strong>Auditoria e privacidade</strong>
              <span style={{ color: "#14b87a", fontWeight: 800 }}>Ativas</span>
              <small style={styles.sub}>
                Segredos não são exibidos e as ações críticas permanecem
                confirmadas.
              </small>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  function renderConteudo() {
    if (tab === "Visão geral") return renderVisaoGeral();
    if (tab === "Agenda") return renderAgenda();
    if (tab === "Atendimento") return renderAtendimento();
    if (tab === "Caixa e fechamento") return renderOperacao();
    if (tab === "Prévia taxas e materiais") return renderPreviaTaxasMateriais();
    if (tab === "Carteira por barbeiro") {
      return (
        <Suspense
          fallback={
            <Card
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--muted)",
              }}
            >
              Carregando carteira de clientes…
            </Card>
          }
        >
          <DinoCarteiraClientesPanel
            onNovoCliente={() => {
              setFormCliente({
                nome: "",
                telefone: "",
                email: "",
                dataNascimento: "",
                limiteCreditoMensal: 500,
                diasVencimento: 30,
                observacao: "",
              });
              setModal("cliente");
            }}
          />
        </Suspense>
      );
    }
    if (tab === "Recuperação de clientes (Avec)") {
      return (
        <Suspense
          fallback={
            <Card
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--muted)",
              }}
            >
              Carregando análise e recuperação Avec…
            </Card>
          }
        >
          <DinoRecuperacaoAvecPanel
            onAbrirAgenda={(cli) => {
              navegarParaTab("Agenda");
              setFormAgenda({
                clienteId: cli.key || "",
                clienteNome: cli.nome || "",
                clienteTelefone: cli.telefone || "",
                profissionalId: "",
                servicoId: servicos[0]?.id || "",
                data: dataSelecionada || new Date().toISOString().slice(0, 10),
                hora: "10:00",
                observacoes: `Resgate Avec: Cliente preferia ${cli.profissionalPreferido || "equipe"} (${cli.modeloRotulo || ""})`,
              });
              setModal("agenda");
            }}
          />
        </Suspense>
      );
    }
    if (tab === "Clientes") return renderClientes();
    if (tab === "Profissionais") return renderProfissionais();
    if (tab === "Serviços") return renderServicos();
    if (tab === "Comissões") return renderComissoes();
    if (tab === "Fila e bloqueios") return renderFilaBloqueios();
    if (tab === "Planos e assinaturas") return renderPlanosAssinaturas();
    if (tab === "Fidelidade") return renderFidelidade();
    if (
      tab === "Estoque de revenda" ||
      tab === "Compras e fornecedores" ||
      tab === "Perdas e inventário" ||
      tab === "Fichas técnicas" ||
      tab === "Fornecedores e funcionários"
    ) {
      return (
        <DinoComprasEstoqueHub
          tabInicial={tab}
          produtosRevenda={produtosRevenda}
          onAtualizar={carregar}
          onAbrirProduto={() => abrirProdutoRevenda()}
          onAjustarEstoque={(p) => abrirAjusteEstoque(p)}
        />
      );
    }
    if (tab === "Vendas de revenda") return renderVendasRevenda();
    if (tab === "Relatórios") {
      window.location.href = "/admin/relatorios/dino";
      return null;
    }
    if (tab === "Integrações") return renderIntegracoes();
    if (tab === "Retorno previsto") return <RetornosPanel lojaId={lojaAtiva?.id || ""} />;
    if (tab === "Lista de espera") return <ListaEsperaPanel />;
    if (tab === "Indicações") return <IndicacoesPanel clientes={clientes} />;
    if (tab === "Saúde do clube")
      return (
        <div style={{ display: "grid", gap: 16 }}>
          <ClubeSaudePanel />
          <ReguaClubePanel />
        </div>
      );
    if (tab === "Curva ABC") return <CurvaAbcPanel />;
    if (tab === "Metas e comissões")
      return (
        <Suspense
          fallback={
            <Card
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--muted)",
              }}
            >
              Carregando metas e comissões…
            </Card>
          }
        >
          <MetasComissoesPanel onOpenTab={navegarParaTab} />
        </Suspense>
      );
    if (tab === "Notas fiscais")
      return (
        <Suspense
          fallback={
            <Card
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--muted)",
              }}
            >
              Carregando central fiscal…
            </Card>
          }
        >
          <FiscalPanel />
        </Suspense>
      );
    if (tab === "Extrato e repasses")
      return (
        <RepassesPanel
          profissionais={profissionais}
          servicos={servicos}
          planos={planos}
          onCadastroMudou={carregar}
        />
      );
    if (tab === "Metas & Roleta")
      return (
        <Suspense
          fallback={
            <Card
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--muted)",
              }}
            >
              Carregando metas e roleta…
            </Card>
          }
        >
          <DinoMetasRoletaPanel />
        </Suspense>
      );
    if (tab === "Projeção inteligente")
      return (
        <Suspense
          fallback={
            <Card
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--muted)",
              }}
            >
              Carregando projeção de IA…
            </Card>
          }
        >
          <ProjecaoFaturamentoPanel onOpenTab={navegarParaTab} />
        </Suspense>
      );
    if (tab === "Painel de gestão")
      return (
        <Suspense
          fallback={
            <Card
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--muted)",
              }}
            >
              Carregando painel de gestão…
            </Card>
          }
        >
          <DinoDashboardKytto onOpenTab={navegarParaTab} />
        </Suspense>
      );

    if (tab === "Ocupação e metas") return <OcupacaoMetasPanel />;
    if (tab === "Desempenho da equipe")
      return (
        <Suspense
          fallback={
            <Card
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--muted)",
              }}
            >
              Carregando desempenho da equipe…
            </Card>
          }
        >
          <DinoEquipeDesempenho
            empresaId={empresaAtiva?.id || ""}
            lojaId={lojaAtiva?.id || ""}
            onOpenTab={navegarParaTab}
          />
        </Suspense>
      );
    if (tab === "Avaliações (NPS)")
      return (
        <NpsPanel key={`${empresaAtiva?.id || ""}:${lojaAtiva?.id || ""}`} />
      );
    if (tab === "Origem dos clientes") return <CanaisPanel />;
    if (tab === "Cobranças e cashback") return <CobrancasPanel />;
    if (tab === "Receita da IA") return <ReceitaIaPanel />;
    if (tab === "Resumo diário") return <ResumoDiarioPanel />;
    if (tab === "Vale-presente") return <ValesPanel />;
    if (tab === "Unidades")
      return <UnidadesPanel lojas={lojasAcessiveis || []} />;
    return renderConfiguracao();
  }

  // Tela cheia (aberta pelo menu em nova guia): só a seção pedida, na largura toda, sem menus.
  if (searchParams.get("tela") === "cheia") {
    const ehAgenda = tab === "Agenda";
    return (
      <div
        style={{
          padding: ehAgenda ? "10px 16px" : "16px clamp(12px, 2vw, 28px)",
          maxWidth: "none",
          margin: 0,
        }}
      >
        {!ehAgenda && (
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <div>
              <div
                style={{
                  color: "var(--accent)",
                  fontSize: 12,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                }}
              >
                Dino · {unidadeLabel || "Dino Matriz"} · visão completa
              </div>
              <h1
                style={{
                  margin: "5px 0 0",
                  fontSize: "clamp(22px, 3vw, 30px)",
                  fontFamily: "var(--font-display)",
                }}
              >
                {tab}
              </h1>
            </div>
            <div style={styles.headerActions}>
              <button type="button" style={styles.secondary} onClick={carregar}>
                Atualizar
              </button>
              {tab === "Agenda" && (
                <button
                  type="button"
                  style={styles.primary}
                  onClick={abrirNovoAgendamento}
                >
                  + Agendamento
                </button>
              )}
              <a
                href={`/admin/barbearia-erp?area=${encodeURIComponent(TAB_AREA[tab] || "operacao")}&tab=${encodeURIComponent(tab)}`}
                style={{
                  ...styles.secondary,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Abrir com o menu
              </a>
            </div>
          </header>
        )}
        {erro && (
          <Card
            style={{ padding: 16, marginBottom: 18, borderColor: "#e05c5c" }}
          >
            <strong role="status" aria-live="polite">
              Atenção no carregamento
            </strong>
            <div style={{ color: "var(--muted)", marginTop: 5 }}>{erro}</div>
          </Card>
        )}
        {loading && !dadosCarregados && !tabAutonoma ? (
          <Card
            style={{ padding: 60, textAlign: "center", color: "var(--muted)" }}
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            Carregando a agenda…
          </Card>
        ) : (
          <div aria-busy={loading && !tabAutonoma}>{renderConteudo()}</div>
        )}
        {renderModal()}
        {renderModalItemValor()}
        {renderModalReabrir()}
      </div>
    );
  }

  // Painéis analíticos usam 100% da largura; os demais mantêm leitura confortável.
  const ehAgenda = tab === "Agenda";
  const ehModuloEstoqueSuprimentos = [
    "Estoque de revenda",
    "Estoque",
    "Compras e fornecedores",
    "Perdas e inventário",
    "Fichas técnicas",
    "Fornecedores e funcionários",
    "Curva ABC",
  ].includes(tab);
  const ocultarCabecalhoOperacional = ehAgenda || ehModuloEstoqueSuprimentos;

  return (
    <div
      style={{
        padding: ehAgenda || ehModuloEstoqueSuprimentos
          ? "12px clamp(10px, 1.5vw, 20px)"
          : "24px clamp(16px, 3vw, 36px)",
        maxWidth: tab === "Desempenho da equipe" || ehAgenda || ehModuloEstoqueSuprimentos ? "none" : 1440,
        margin: "0 auto",
      }}
    >
      {!ocultarCabecalhoOperacional && (
        <>
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 20,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <div>
              <div
                style={{
                  color: "var(--accent)",
                  fontSize: 12,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                }}
              >
                {empresaAtiva?.nome || 'Empresa'} · ERP operacional · empresa ativa
              </div>
              <h1
                style={{
                  margin: "7px 0 5px",
                  fontSize: "clamp(25px, 4vw, 34px)",
                  fontFamily: "var(--font-display)",
                }}
              >
                {empresaAtiva?.nome || configuracao?.nomePublico || "Empresa"} · {configuracao?.ramo || "Barbearia & Salão"}
              </h1>
              <p style={{ margin: 0, color: "var(--muted)", maxWidth: 720 }}>
                A operação da unidade em um fluxo único: agenda, atendimento,
                relacionamento, catálogo e gestão.
              </p>
            </div>
            <div style={styles.headerActions}>
              <div style={styles.globalSearch}>
                <input
                  aria-label="Buscar na Barbearia"
                  aria-expanded={Boolean(buscaGlobal.trim())}
                  aria-controls="barbearia-global-search-results"
                  value={buscaGlobal}
                  onChange={(event) => setBuscaGlobal(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setBuscaGlobal("");
                    if (event.key === "Enter" && resultadosBuscaGlobal[0])
                      abrirResultadoBusca(resultadosBuscaGlobal[0]);
                  }}
                  placeholder="Buscar cliente, serviço ou agenda…"
                  style={{ ...inputStyle, paddingRight: 40 }}
                />
                <span aria-hidden="true" style={styles.searchIcon}>
                  ⌕
                </span>
                {buscaGlobal.trim() && (
                  <div
                    id="barbearia-global-search-results"
                    role="listbox"
                    aria-label="Resultados da busca"
                    style={styles.globalSearchResults}
                  >
                    {resultadosBuscaGlobal.length === 0 ? (
                      <div style={styles.globalSearchEmpty}>
                        Nenhum registro encontrado no overview carregado.
                      </div>
                    ) : (
                      resultadosBuscaGlobal.map((resultado) => (
                        <button
                          key={resultado.id}
                          type="button"
                          role="option"
                          style={styles.globalSearchItem}
                          onClick={() => abrirResultadoBusca(resultado)}
                        >
                          <span>
                            <strong>{resultado.nome}</strong>
                            <small>
                              {resultado.tipo} · {resultado.meta}
                            </small>
                          </span>
                          <span aria-hidden="true">›</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button type="button" style={styles.secondary} onClick={carregar}>
                Atualizar
              </button>
              <button
                type="button"
                style={styles.primary}
                onClick={() => navegarParaTab("Atendimento")}
              >
                Atender agora
              </button>
              <Link
                to={`/barbeiro/${encodeURIComponent(formConfig.slugPublico || "dino")}`}
                style={{
                  ...styles.secondary,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                }}
                title="Agenda do dia de cada profissional no celular (instalável)"
              >
                App do barbeiro
              </Link>
            </div>
          </header>
          <div style={styles.contextBar} aria-label="Contexto operacional">
            <div style={styles.contextBarItem}>
              <span>Área ativa</span>
              <strong>{areaAtual.label}</strong>
            </div>
            <div style={styles.contextBarItem}>
              <span>Unidade</span>
              <strong>{unidadeLabel}</strong>
            </div>
            <div style={styles.contextBarItem}>
              <span>Data operacional</span>
              <strong>{fmtDateOnly(dataSelecionada)}</strong>
            </div>
            <div style={styles.contextBarItem}>
              <span>Estado</span>
              <strong>
                {loading
                  ? "Atualizando…"
                  : erro
                    ? "Revisar dados"
                    : "Dados sincronizados"}
              </strong>
            </div>
          </div>
          <nav aria-label="Áreas da Barbearia" style={styles.areaNav}>
            {areasVisiveis.map((area) => (
              <button
                key={area.id}
                type="button"
                aria-current={area.id === areaAtual.id ? "page" : undefined}
                onClick={() => navegarParaTab(area.tabs[0])}
                style={{
                  ...styles.areaNavItem,
                  ...(area.id === areaAtual.id ? styles.areaNavItemActive : {}),
                }}
              >
                <strong>{area.label}</strong>
                <small>{area.short}</small>
              </button>
            ))}
          </nav>
        </>
      )}
      <nav aria-label={`Seções de ${areaAtual.label}`} style={styles.tabNav}>
        {areaAtual.tabs.map((nome) => (
          <button
            key={nome}
            type="button"
            title={TAB_DESCRICAO[nome]}
            aria-current={tab === nome ? "page" : undefined}
            onClick={() => navegarParaTab(nome)}
            style={{
              ...styles.tabNavItem,
              ...(tab === nome ? styles.tabNavItemActive : {}),
            }}
          >
            {nome}
          </button>
        ))}
      </nav>
      {erro && (
        <Card style={{ padding: 16, marginBottom: 18, borderColor: "#e05c5c" }}>
          <strong role="status" aria-live="polite">
            Atenção no carregamento
          </strong>
          <div style={{ color: "var(--muted)", marginTop: 5 }}>{erro}</div>
        </Card>
      )}
      {loading && !dadosCarregados && !tabAutonoma ? (
        <Card
          style={{ padding: 60, textAlign: "center", color: "var(--muted)" }}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          Carregando dados da empresa ativa…
        </Card>
      ) : (
        <div
          aria-busy={loading && !tabAutonoma}
          inert={loading && !tabAutonoma ? "" : undefined}
        >
          {renderConteudo()}
        </div>
      )}
      {renderModal()}
        {renderModalItemValor()}
        {renderModalReabrir()}
    </div>
  );
}

const styles = {
  primary: {
    border: 0,
    borderRadius: 9,
    padding: "10px 14px",
    background: "var(--accent)",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondary: {
    border: "1px solid var(--line)",
    borderRadius: 9,
    padding: "10px 14px",
    background: "transparent",
    color: "var(--fg)",
    fontWeight: 700,
    cursor: "pointer",
  },
  small: {
    border: "1px solid var(--line)",
    borderRadius: 8,
    padding: "7px 10px",
    background: "var(--card2)",
    color: "var(--fg)",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 12,
  },
  iconButton: {
    width: 32,
    height: 32,
    border: "1px solid var(--line)",
    borderRadius: 8,
    background: "transparent",
    color: "var(--fg)",
    fontSize: 21,
    lineHeight: 1,
    cursor: "pointer",
  },
  tableHead: {
    background: "var(--card2)",
    color: "var(--muted)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: ".04em",
  },
  th: { padding: "12px 14px", textAlign: "left", whiteSpace: "nowrap" },
  td: { padding: "13px 14px", verticalAlign: "top" },
  sub: { color: "var(--muted)", fontSize: 12, marginTop: 4 },
  empty: { padding: 42, textAlign: "center", color: "var(--muted)" },
  h2: { margin: 0, fontSize: 18 },
  sectionTitle: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    marginBottom: 18,
    flexWrap: "wrap",
  },
  headerActions: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
    minWidth: 0,
  },
  globalSearch: {
    position: "relative",
    width: "min(360px, 100%)",
    minWidth: 220,
  },
  searchIcon: {
    position: "absolute",
    right: 12,
    top: 9,
    color: "var(--muted)",
    fontSize: 20,
    lineHeight: 1,
    pointerEvents: "none",
  },
  globalSearchResults: {
    position: "absolute",
    zIndex: 40,
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    display: "grid",
    gap: 4,
    padding: 6,
    background: "var(--card)",
    border: "1px solid var(--line)",
    borderRadius: 11,
    boxShadow: "0 16px 32px rgba(0,0,0,.18)",
  },
  globalSearchItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "9px 10px",
    border: 0,
    borderRadius: 8,
    background: "transparent",
    color: "var(--fg)",
    textAlign: "left",
    font: "inherit",
    cursor: "pointer",
  },
  globalSearchEmpty: {
    padding: "10px 9px",
    color: "var(--muted)",
    fontSize: 12,
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "end",
    flexWrap: "wrap",
  },
  agendaToolbar: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))",
    gap: 12,
    alignItems: "end",
  },
  agendaMeta: {
    display: "grid",
    gap: 3,
    alignContent: "end",
    padding: "0 4px 2px",
    color: "var(--muted)",
    fontSize: 12,
  },
  viewToggle: {
    display: "grid",
    gap: 5,
    alignContent: "end",
    color: "var(--muted)",
    fontSize: 11,
    fontWeight: 800,
  },
  viewToggleButton: {
    border: "1px solid var(--line)",
    padding: "8px 10px",
    background: "var(--card)",
    color: "var(--muted)",
    cursor: "pointer",
    font: "inherit",
    fontSize: 12,
  },
  viewToggleButtonActive: {
    background: "var(--accent)",
    borderColor: "var(--accent)",
    color: "#fff",
  },
  agendaSummary: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))",
    gap: 1,
    padding: 1,
    background: "var(--line)",
    overflow: "hidden",
  },
  agendaSummaryItem: {
    display: "grid",
    gap: 3,
    padding: "13px 14px",
    background: "var(--card)",
  },
  teamSummary: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
    gap: 1,
    padding: 1,
    background: "var(--line)",
    overflow: "hidden",
  },
  teamSummaryItem: {
    display: "grid",
    gap: 3,
    padding: "13px 14px",
    background: "var(--card)",
  },
  kicker: {
    color: "var(--accent)",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".08em",
  },
  integrationGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
    gap: 14,
  },
  serviceSummary: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
    gap: 10,
    marginTop: 18,
  },
  serviceSummaryItem: {
    display: "grid",
    gap: 4,
    padding: 12,
    background: "var(--card)",
    border: "1px solid var(--line)",
    borderRadius: 10,
  },
  serviceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: 14,
  },
  serviceCardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  serviceCategory: {
    display: "inline-flex",
    padding: "4px 8px",
    borderRadius: 999,
    background: "color-mix(in srgb, #8b5cf6 14%, var(--card))",
    color: "#8b5cf6",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".05em",
  },
  serviceFacts: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    color: "var(--muted)",
    fontSize: 12,
  },
  integrationCard: {
    display: "grid",
    gap: 12,
    padding: 16,
    background: "var(--card)",
    border: "1px solid var(--line)",
    borderRadius: 12,
  },
  integrationHeading: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  integrationIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: 12,
    fontWeight: 900,
    flexShrink: 0,
  },
  detailHero: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    background: "var(--card)",
    flexWrap: "wrap",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
    gap: 12,
  },
  aiResponse: {
    marginTop: 6,
    padding: 14,
    background: "color-mix(in srgb, #6d5dfc 8%, var(--card))",
    border: "1px solid color-mix(in srgb, #6d5dfc 35%, var(--line))",
    borderRadius: 10,
  },
  notice: {
    padding: 12,
    border: "1px solid var(--line)",
    borderRadius: 10,
    background: "var(--card2)",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))",
    gap: 14,
  },
  comandaSummary: {
    display: "grid",
    gap: 3,
    minWidth: 96,
    padding: "10px 13px",
    borderRadius: 10,
    background: "var(--card2)",
    textAlign: "center",
  },
  comandaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(250px, 100%), 1fr))",
    gap: 9,
  },
  comandaCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "12px 14px",
    border: "1px solid var(--line)",
    borderRadius: 10,
    background: "var(--bg)",
    color: "var(--fg)",
    textAlign: "left",
    font: "inherit",
    cursor: "pointer",
  },
  comandaMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100px, 100%), 1fr))",
    gap: 1,
    padding: 1,
    background: "var(--line)",
    borderRadius: 10,
    overflow: "hidden",
  },
  comandaItemRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    border: "1px solid var(--line)",
    borderRadius: 8,
    background: "var(--bg)",
  },
  paymentPanel: {
    padding: 16,
    borderColor: "color-mix(in srgb, var(--accent) 35%, var(--line))",
    background: "color-mix(in srgb, var(--accent) 6%, var(--card))",
  },
  twoColumns: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))",
    gap: 16,
  },
  listRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "12px 0",
    borderBottom: "1px solid var(--line)",
  },
  feedRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid var(--line)",
  },
  metricLine: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    paddingBottom: 12,
    borderBottom: "1px solid var(--line)",
    color: "var(--muted)",
  },
  tableActions: { display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 },
  inlineEmpty: {
    display: "grid",
    gap: 4,
    padding: 16,
    borderRadius: 10,
    background: "var(--bg)",
    color: "var(--muted)",
  },
  queueRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid var(--line)",
  },
  actionRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "11px 12px",
    border: "1px solid var(--line)",
    borderRadius: 10,
    background: "var(--bg)",
    color: "var(--fg)",
    textAlign: "left",
    font: "inherit",
    cursor: "pointer",
  },
  actionRowAttention: {
    borderColor: "color-mix(in srgb, #f59e0b 45%, var(--line))",
    background: "color-mix(in srgb, #f59e0b 7%, var(--bg))",
  },
  attentionPanel: {
    padding: 18,
    borderColor: "color-mix(in srgb, #f59e0b 38%, var(--line))",
    background: "color-mix(in srgb, #f59e0b 5%, var(--card))",
  },
  alertList: { display: "grid", gap: 7 },
  alertRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid color-mix(in srgb, #f59e0b 18%, var(--line))",
  },
  readinessGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
    gap: 12,
  },
  readinessItem: {
    display: "grid",
    gap: 7,
    padding: 14,
    background: "var(--bg)",
    borderRadius: 10,
  },
  attendanceCard: {
    display: "grid",
    gap: 4,
    width: "100%",
    boxSizing: "border-box",
    padding: 12,
    border: "1px solid var(--line)",
    borderLeft: "4px solid",
    borderRadius: 10,
    background: "var(--bg)",
    color: "var(--fg)",
    textAlign: "left",
    font: "inherit",
    cursor: "pointer",
    transition: "transform 160ms ease-out, box-shadow 160ms ease-out",
  },
  attendanceMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
    color: "var(--muted)",
    fontSize: 11,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: "50%",
    background: "var(--accent)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
  },
  profileGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
    gap: 8,
    marginTop: 18,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(210px, 100%), 1fr))",
    gap: 14,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
  },
  contextBar: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
    gap: 1,
    padding: 1,
    marginBottom: 12,
    background: "var(--line)",
    borderRadius: 12,
    overflow: "hidden",
  },
  contextBarItem: {
    display: "grid",
    gap: 4,
    padding: "11px 13px",
    background: "var(--card)",
  },
  areaNav: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))",
    gap: 8,
    marginBottom: 10,
  },
  areaNavItem: {
    display: "grid",
    gap: 3,
    textAlign: "left",
    border: "1px solid var(--line)",
    borderRadius: 11,
    padding: "11px 13px",
    background: "var(--card)",
    color: "var(--muted)",
    cursor: "pointer",
    font: "inherit",
    transition:
      "transform 160ms ease-out, border-color 160ms ease-out, background 160ms ease-out",
  },
  areaNavItemActive: {
    background: "color-mix(in srgb, var(--accent) 10%, var(--card))",
    borderColor: "var(--accent)",
    color: "var(--fg)",
  },
  tabNav: {
    display: "flex",
    gap: 6,
    overflowX: "auto",
    padding: 4,
    marginBottom: 22,
    background: "var(--card2)",
    border: "1px solid var(--line)",
    borderRadius: 10,
    scrollbarWidth: "thin",
  },
  tabNavItem: {
    flex: "0 0 auto",
    border: 0,
    borderRadius: 8,
    padding: "8px 11px",
    background: "transparent",
    color: "var(--muted)",
    cursor: "pointer",
    font: "inherit",
    fontSize: 13,
    fontWeight: 650,
    whiteSpace: "nowrap",
  },
  tabNavItemActive: {
    background: "var(--accent)",
    color: "#fff",
    fontWeight: 800,
  },
  todayHero: {
    padding: 22,
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--accent) 13%, var(--card)), var(--card))",
    borderColor: "color-mix(in srgb, var(--accent) 30%, var(--line))",
    boxShadow: "0 12px 30px rgba(18, 39, 63, .07)",
  },
  todayHeroTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  todayStatus: {
    display: "grid",
    gap: 5,
    minWidth: 150,
    padding: 13,
    borderRadius: 11,
    background: "color-mix(in srgb, var(--card) 84%, transparent)",
    border: "1px solid var(--line)",
  },
  compactDate: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid var(--line)",
    borderRadius: 8,
    background: "var(--card)",
    color: "var(--fg)",
    padding: "7px 8px",
    font: "inherit",
  },
  quickActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 18,
    paddingTop: 16,
    borderTop: "1px solid color-mix(in srgb, var(--accent) 22%, var(--line))",
  },
  contextPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: "color-mix(in srgb, var(--accent) 12%, var(--card))",
    color: "var(--accent)",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
};
// Force Cache Invalidation V2
