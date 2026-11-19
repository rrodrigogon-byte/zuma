import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, fmtR } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';

const COR = {
  verde: '#16a34a',
  verdeClaro: '#dcfce7',
  verdeEscuro: '#15803d',
  azul: '#2563eb',
  azulClaro: '#dbeafe',
  laranja: '#f59e0b',
  laranjaClaro: '#fef3c7',
  roxo: '#8b5cf6',
  roxoClaro: '#f3e8ff',
  vermelho: '#dc2626',
  vermelhoClaro: '#fee2e2',
  dourado: '#c99a2e',
  douradoClaro: '#fdf3dc',
  card: 'var(--card, #fff)',
  line: 'var(--line, #e2e8f0)',
  fg: 'var(--fg, #0f172a)',
  muted: 'var(--muted, #64748b)',
};

const EMPRESAS_CANONICAS = [
  { id: 'dino', nome: 'Barbearia Dino', icone: '💈', segmento: 'Barbearia & Salão Masculino' },
  { id: 'stallone', nome: 'Stallone Nutre Sport', icone: '💪', segmento: 'Suplementos, Fitness & Saúde' },
  { id: 'agroopen', nome: 'Agro Open Insumos', icone: '🌱', segmento: 'Agronegócio, Pecuária & Insumos' },
  { id: 'supermercado', nome: 'Supermercado Kytto', icone: '🛒', segmento: 'Alimentos, Bebidas & Atacarejo' },
];

function mapearIcone(nome = '') {
  const n = String(nome).toLowerCase();
  if (n.includes('dino')) return '💈';
  if (n.includes('stallone')) return '💪';
  if (n.includes('agro')) return '🌱';
  if (n.includes('supermercado')) return '🛒';
  return '🏢';
}

export default function DinoInteligenciaVendasIa() {
  const { user, isPlatformAdmin: authIsPlatformAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Identificação estrita por usuário:
  // - Rodrigo Gonçalves (rodrigo.goncalves / rrodrigogon / admin): Proprietário do Sistema, visualiza TODAS as empresas.
  // - Guilherme (guilherme / guicunha / dino / gui): Gestor Barbearia Dino, visualiza APENAS a Barbearia Dino.
  // - Silvester (silvester / silvestre / stallone): Gestor Stallone & Agro Open, visualiza APENAS essas duas empresas.
  // - Demais usuários: visualizam apenas a empresa vinculada.
  const ident = String(user?.email || user?.username || user?.login || '').toLowerCase().trim();
  const ehRodrigoProprietario = Boolean(
    authIsPlatformAdmin ||
    user?.platformAdmin === true ||
    user?.mainAdmin === true ||
    ident.includes('rodrigo.goncalves') ||
    ident.includes('rrodrigogon') ||
    ident === 'admin'
  );
  const ehGuilhermeDino = !ehRodrigoProprietario && (
    ident.includes('guilherme') || ident.includes('guicunha') || ident.includes('dino') || ident === 'gui'
  );
  const ehSilvester = !ehRodrigoProprietario && (
    ident.includes('silvester') || ident.includes('silvestre') || ident.includes('stallone')
  );

  const empresasIniciais = ehRodrigoProprietario
    ? EMPRESAS_CANONICAS
    : ehGuilhermeDino
      ? [EMPRESAS_CANONICAS[0]] // Apenas Barbearia Dino
      : ehSilvester
        ? [EMPRESAS_CANONICAS[1], EMPRESAS_CANONICAS[2]] // Stallone e Agro Open
        : [EMPRESAS_CANONICAS[0]];

  const [empresasAutorizadas, setEmpresasAutorizadas] = useState(empresasIniciais);
  const [ehAdminPlataforma, setEhAdminPlataforma] = useState(ehRodrigoProprietario);
  const empresaParam = searchParams.get('empresa') || searchParams.get('empresaId') || '';

  const empresaIdSeguraInicial = ehRodrigoProprietario
    ? (empresaParam || 'dino')
    : ehGuilhermeDino
      ? 'dino'
      : ehSilvester
        ? (['stallone', 'agroopen'].includes(empresaParam) ? empresaParam : 'stallone')
        : 'dino';

  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('reativacao');
  const [filtroPropensao, setFiltroPropensao] = useState('todos');
  const [empresaAtivaId, setEmpresaAtivaId] = useState(empresaIdSeguraInicial);
  const [mensagemSucesso, setMensagemSucesso] = useState('');

  // Estado das opções de mensagem selecionadas por cliente { [clienteId]: 'suave' | 'fechamento' | 'lembrete' }
  const [opcaoSelecionada, setOpcaoSelecionada] = useState({});

  // Modal de registro de conversão (Dinheiro no Caixa)
  const [modalConversaoAberto, setModalConversaoAberto] = useState(false);
  const [formConversao, setFormConversao] = useState({
    clienteNome: '',
    telefone: '',
    valor: '',
    tipo: 'reativacao',
    observacao: '',
  });

  // Formulário de Configurações Comerciais & Políticas Meta
  const [formConfig, setFormConfig] = useState(null);
  // Estados para Buracos na Agenda (Vagas Ociosas Futuras & Ações Operacionais)
  const [filtroBarbeiroBuracos, setFiltroBarbeiroBuracos] = useState('todos');
  const [filtroPrazoBuracos, setFiltroPrazoBuracos] = useState('todos');
  const [modalEncaixeAberto, setModalEncaixeAberto] = useState(false);
  const [vagaEncaixe, setVagaEncaixe] = useState(null);
  const [formEncaixe, setFormEncaixe] = useState({ clienteNome: '', clienteTelefone: '', servicoId: '', observacao: '' });
  const [bloqueandoSlotId, setBloqueandoSlotId] = useState(null);
  const [salvandoEncaixe, setSalvandoEncaixe] = useState(false);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  // Ação 1: Bloquear horário ocioso na agenda
  const handleBloquearSlot = async (vaga) => {
    if (!window.confirm(`Deseja bloquear o horário ${vaga.horario} de ${vaga.dia} com ${vaga.profissional} na agenda da Dino?`)) return;
    setBloqueandoSlotId(vaga.id);
    try {
      await api.post('/api/admin/dino/buracos-agenda/bloquear', {
        empresaId: empresaAtivaId,
        profissionalId: vaga.profissionalId,
        data: vaga.data,
        horario: vaga.horario,
        motivo: 'Bloqueio de Horário Ocioso via Painel IA',
      });
      setMensagemSucesso(`Horário ${vaga.horario} de ${vaga.dia} bloqueado com sucesso na agenda da Dino!`);
      setTimeout(() => setMensagemSucesso(''), 5000);
      carregarInteligencia(empresaAtivaId);
    } catch (e) {
      alert(e.message || 'Erro ao bloquear horário.');
    } finally {
      setBloqueandoSlotId(null);
    }
  };

  // Ação 2: Abrir modal de encaixe rápido
  const handleAbrirEncaixe = (vaga) => {
    setVagaEncaixe(vaga);
    setFormEncaixe({
      clienteNome: vaga.clienteSugerido?.nome || '',
      clienteTelefone: vaga.clienteSugerido?.telefone || '',
      servicoId: 'srv-dino-corte-001',
      observacao: `Encaixe rápido no buraco de ${vaga.horario} (${vaga.dia})`,
    });
    setModalEncaixeAberto(true);
  };

  // Ação 2b: Confirmar encaixe rápido
  const handleSalvarEncaixe = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!vagaEncaixe) return;
    setSalvandoEncaixe(true);
    try {
      await api.post('/api/admin/dino/buracos-agenda/encaixe', {
        empresaId: empresaAtivaId,
        profissionalId: vagaEncaixe.profissionalId,
        data: vagaEncaixe.data,
        horario: vagaEncaixe.horario,
        clienteNome: formEncaixe.clienteNome,
        clienteTelefone: formEncaixe.clienteTelefone,
        servicoId: formEncaixe.servicoId,
        observacoes: formEncaixe.observacao,
      });
      setModalEncaixeAberto(false);
      setVagaEncaixe(null);
      setMensagemSucesso(`Encaixe realizado com sucesso para ${formEncaixe.clienteNome || 'o cliente'}!`);
      setTimeout(() => setMensagemSucesso(''), 5000);
      carregarInteligencia(empresaAtivaId);
    } catch (err) {
      alert(err.message || 'Erro ao salvar encaixe.');
    } finally {
      setSalvandoEncaixe(false);
    }
  };

  // Ação 3: Copiar Link de Agendamento Direto
  const handleCopiarLinkVaga = (vaga) => {
    const link = vaga.linkAgendamento || `https://kytto.com.br/agendar/dino?data=${vaga.data}&hora=${vaga.horario}`;
    navigator.clipboard?.writeText(link);
    setMensagemSucesso(`Link copiado para a área de transferência!`);
    setTimeout(() => setMensagemSucesso(''), 4000);
  };

  const carregarInteligencia = useCallback(async (empId) => {
    setCarregando(true);
    setErro(null);
    try {
      const targetEmpresa = empId || empresaAtivaId || "dino";
      const qs = targetEmpresa ? `?empresaId=${encodeURIComponent(targetEmpresa)}` : "";
      const res = await api.get(`/api/admin/inteligencia-vendas${qs}`).catch(() =>
        api.get(`/api/admin/barbearia/inteligencia-vendas${qs}`)
      );
      setDados(res);
      if (res?.config) {
        setFormConfig({ ...res.config });
      }
    } catch (e) {
      console.error("Erro ao carregar inteligência de vendas:", e);
      setErro(e.message || "Erro ao carregar inteligência de vendas.");
    } finally {
      setCarregando(false);
    }
  }, [empresaAtivaId]);

  // Carrega lista autorizada de empresas
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const resAuth = await api.get('/api/admin/inteligencia-vendas/empresas-autorizadas').catch(() => null);
        if (!ativo) return;
        if (resAuth && Array.isArray(resAuth.empresas) && resAuth.empresas.length > 0) {
          setEhAdminPlataforma(Boolean(resAuth.ehAdminPlataforma));
          setEmpresasAutorizadas(resAuth.empresas);
          setEmpresaAtivaId(prev => {
            const permitida = resAuth.empresas.find(item => item.id === prev);
            return permitida ? permitida.id : resAuth.empresas[0].id;
          });
          return;
        }

        const res = await api.get('/api/admin/empresas');
        if (!ativo) return;
        const bruta = res?.empresas || res || [];
        const ehAdmin = ehRodrigoProprietario || Boolean(res?.ehAdminPlataforma);
        setEhAdminPlataforma(ehAdmin);

        const lista = (Array.isArray(bruta) ? bruta : []).filter(e => {
          const nome = String(e.nome || '').toLowerCase();
          const cnpj = String(e.cnpj || '').replace(/\D/g, '');
          return !nome.includes('imperial') && !nome.includes('homologação alterada') && cnpj !== '98765432000199';
        }).map(e => {
          const n = String(e.nome || '').toLowerCase();
          const empSlug = n.includes('stallone') ? 'stallone' :
                          n.includes('agro') ? 'agroopen' :
                          n.includes('supermercado') ? 'supermercado' : 'dino';
          return {
            id: empSlug,
            uuid: e.id,
            nome: e.nome || e.nomeFantasia || e.razaoSocial,
            icone: mapearIcone(e.nome),
            segmento: e.tipoNegocio || e.segmento || 'Operação Comercial',
            cnpj: e.cnpj || ''
          };
        });

        // Se não for Admin Global (Rodrigo), filtra estritamente por perfil do usuário
        const listaFiltrada = ehAdmin
          ? lista
          : ehGuilhermeDino
            ? lista.filter(x => x.id === 'dino')
            : ehSilvester
              ? lista.filter(x => x.id === 'stallone' || x.id === 'agroopen')
              : lista.slice(0, 1);

        if (listaFiltrada.length > 0) {
          setEmpresasAutorizadas(listaFiltrada);
          setEmpresaAtivaId(prev => {
            const achou = listaFiltrada.find(item => item.id === prev);
            return achou ? achou.id : listaFiltrada[0].id;
          });
        }
      } catch (err) {
        console.warn('Erro ao buscar empresas autorizadas:', err);
      }
    })();

    const onEmpresaAlterada = (ev) => {
      const nova = ev.detail;
      if (nova) {
        const n = String(nova.nome || '').toLowerCase();
        const empSlug = n.includes('stallone') ? 'stallone' :
                        n.includes('agro') ? 'agroopen' :
                        n.includes('supermercado') ? 'supermercado' : 'dino';
        setEmpresaAtivaId(empSlug);
        carregarInteligencia(empSlug);
      }
    };
    window.addEventListener('empresa_alterada', onEmpresaAlterada);

    return () => {
      ativo = false;
      window.removeEventListener('empresa_alterada', onEmpresaAlterada);
    };
  }, [carregarInteligencia]);

  useEffect(() => {
    carregarInteligencia(empresaParam || empresaAtivaId);
  }, [empresaParam, empresaAtivaId, carregarInteligencia]);

  const trocarEmpresa = (novaEmpresaId) => {
    const permitida = empresasAutorizadas.some(e => e.id === novaEmpresaId);
    if (!ehRodrigoProprietario && !permitida) {
      console.warn('Troca de empresa bloqueada por perfil:', novaEmpresaId);
      return;
    }
    setEmpresaAtivaId(novaEmpresaId);
    setSearchParams({ empresaId: novaEmpresaId });
    try {
      localStorage.setItem('sp_empresa_ativa', JSON.stringify({ id: novaEmpresaId }));
      localStorage.setItem('empresaAtiva', novaEmpresaId);
    } catch (_) {}
    carregarInteligencia(novaEmpresaId);
  };

  const alternarOpcaoMensagem = (clienteId, opcao) => {
    setOpcaoSelecionada(prev => ({
      ...prev,
      [clienteId]: opcao,
    }));
  };

  const obterMensagemParaEnvio = (cliente) => {
    const tipo = opcaoSelecionada[cliente.id] || 'fechamento';
    if (cliente.opcoesMensagem && cliente.opcoesMensagem[tipo]) {
      return cliente.opcoesMensagem[tipo].texto;
    }
    return cliente.mensagemIa || '';
  };

  const dispararMensagem = async (cliente, tipo) => {
    let tel = String(cliente.telefone || "").replace(/\D/g, "");
    if (tel.startsWith("55") && tel.length >= 12) {
      // Já tem DDI 55
    } else if (tel.length === 10 || tel.length === 11) {
      tel = "55" + tel;
    }
    const textoMsg = obterMensagemParaEnvio(cliente);
    const textoEncoded = encodeURIComponent(textoMsg);
    const urlWpp = tel ? `https://wa.me/${tel}?text=${textoEncoded}` : `https://wa.me/?text=${textoEncoded}`;
    window.open(urlWpp, "_blank");
    try {
      await api.post(`/api/admin/inteligencia-vendas/disparar-acao?empresaId=${encodeURIComponent(empresaAtivaId)}`, {
        tipo,
        clienteId: cliente.id,
        telefone: cliente.telefone,
        mensagem: textoMsg,
      }).catch(() =>
        api.post("/api/admin/barbearia/inteligencia-vendas/disparar-acao", {
          tipo,
          clienteId: cliente.id,
          telefone: cliente.telefone,
          mensagem: textoMsg,
        })
      );
      setMensagemSucesso(`Ação registrada para ${cliente.nome}! WhatsApp aberto com a mensagem selecionada.`);
      setTimeout(() => setMensagemSucesso(""), 6000);
      carregarInteligencia(empresaAtivaId);
    } catch (_) {}
  };

  const copiarMensagem = (texto) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(texto);
    }
    setMensagemSucesso("📋 Mensagem copiada para a área de transferência!");
    setTimeout(() => setMensagemSucesso(""), 4000);
  };

  const exportarListaCsv = () => {
    if (!listaReativacao.length) return;
    const cabecalho = ["Nome", "Telefone", "Dias Sem Comprar", "Gasto Histórico (R$)", "Tom de Voz", "Mensagem Recomendada"];
    const linhas = listaReativacao.map(c => {
      const opcaoAtual = opcaoSelecionada[c.id] || "fechamento";
      const dadosOpcao = c.opcoesMensagem ? c.opcoesMensagem[opcaoAtual] : null;
      const msg = (dadosOpcao ? dadosOpcao.texto : c.mensagemIa).replace(/"/g, "''");
      return [
        `"${c.nome}"`,
        `"${c.telefone || ""}"`,
        `"${c.diasSemVir || ""}"`,
        `"${(c.gastoTotal || 0).toFixed(2)}"`,
        `"${opcaoAtual}"`,
        `"${msg}"`
      ].join(";");
    });
    const csvContent = "\uFEFF" + [cabecalho.join(";"), ...linhas].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `oportunidades_${empresaAtivaId}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const abrirModalConversao = (cliente = null) => {
    setFormConversao({
      clienteNome: cliente?.nome || '',
      telefone: cliente?.telefone || '',
      valor: cliente?.gastoTotal ? String(cliente.gastoTotal) : (dados?.kpis?.ticketMedioAtual ? String(dados.kpis.ticketMedioAtual) : '150'),
      tipo: cliente?.tipoOferta ? 'upsell' : 'reativacao',
      observacao: cliente ? `Conversão registrada a partir da oportunidade (${cliente.nome})` : 'Venda via WhatsApp',
    });
    setModalConversaoAberto(true);
  };

  const salvarConversao = async (e) => {
    e.preventDefault();
    try {
      const valorNum = parseFloat(String(formConversao.valor).replace(',', '.'));
      if (!valorNum || isNaN(valorNum)) {
        alert('Informe um valor numérico válido.');
        return;
      }
      await api.post(`/api/admin/inteligencia-vendas/registrar-conversao?empresaId=${encodeURIComponent(empresaAtivaId)}`, {
        clienteNome: formConversao.clienteNome || 'Cliente',
        telefone: formConversao.telefone,
        valor: valorNum,
        tipo: formConversao.tipo,
        observacao: formConversao.observacao,
      });
      setModalConversaoAberto(false);
      setMensagemSucesso(`🎉 Dinheiro no Caixa! R$ ${valorNum.toFixed(2)} registrados com sucesso!`);
      setTimeout(() => setMensagemSucesso(''), 6000);
      carregarInteligencia(empresaAtivaId);
    } catch (err) {
      alert('Erro ao registrar conversão: ' + (err.message || 'Falha de comunicação.'));
    }
  };

  const salvarConfiguracoesEmpresa = async (e) => {
    e.preventDefault();
    setSalvandoConfig(true);
    try {
      await api.post(`/api/admin/inteligencia-vendas/config?empresaId=${encodeURIComponent(empresaAtivaId)}`, formConfig);
      setMensagemSucesso('Configurações de Vendas & Políticas Meta salvas com sucesso!');
      setTimeout(() => setMensagemSucesso(''), 6000);
      carregarInteligencia(empresaAtivaId);
    } catch (err) {
      alert('Erro ao salvar configurações: ' + (err.message || 'Falha de comunicação.'));
    } finally {
      setSalvandoConfig(false);
    }
  };

  const kpis = dados?.kpis || {};
  const oportunidades = dados?.oportunidades || {};
  const produtos = dados?.produtosDestaque || [];
  const simulador = dados?.simulador || {};
  const labels = dados?.labels || {};
  const metaComp = dados?.metaCompliance || {};
  const funil = dados?.funilDinheiroMesa || {};
  const icone = dados?.iconeSegmento || '🚀';
  const empresaNome = dados?.empresaNome || 'Empresa';
  const empresaSegmento = dados?.empresaSegmento || 'Comércio Inteligente Kytto';
  const agenteIa = dados?.agenteIaNome || 'Consultor IA';

  const listaReativacao = (oportunidades.reativacaoAntiChurn || []).filter(c => {
    if (filtroPropensao === 'todos') return true;
    return String(c.propensao || '').toLowerCase() === filtroPropensao;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* SELETOR RÁPIDO DE EMPRESAS (MULTI-TENANT COMPLETO) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        background: '#fff',
        padding: '12px 18px',
        borderRadius: 14,
        border: `1px solid ${COR.line}`,
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {ehRodrigoProprietario ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                padding: '4px 10px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                border: '1px solid #f59e0b',
                color: '#92400e',
                fontWeight: 800,
                fontSize: 11,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}>
                👑 Rodrigo Gonçalves · Proprietário Kytto (Acesso Global)
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: COR.muted }}>Empresa Ativa:</span>
            </div>
          ) : ehGuilhermeDino ? (
            <span style={{
              padding: '4px 10px',
              borderRadius: 8,
              background: '#dbeafe',
              border: '1px solid #3b82f6',
              color: '#1e40af',
              fontWeight: 800,
              fontSize: 11,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5
            }}>
💈 Barbearia Dino · Visão Exclusiva da Unidade ({user?.name || user?.username || "Gestor"})
            </span>
          ) : ehSilvester ? (
            <span style={{
              padding: '4px 10px',
              borderRadius: 8,
              background: '#dcfce7',
              border: '1px solid #16a34a',
              color: '#15803d',
              fontWeight: 800,
              fontSize: 11,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5
            }}>
              💪 Gestão Stallone & Agro Open (Silvester)
            </span>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 700, color: COR.muted }}>Empresa Vinculada:</span>
          )}

          {ehRodrigoProprietario && empresasAutorizadas.length > 1 ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {empresasAutorizadas.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => trocarEmpresa(emp.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    borderRadius: 10,
                    border: `1.5px solid ${empresaAtivaId === emp.id ? COR.azul : COR.line}`,
                    background: empresaAtivaId === emp.id ? COR.azulClaro : '#fff',
                    color: empresaAtivaId === emp.id ? '#1e40af' : COR.fg,
                    fontWeight: empresaAtivaId === emp.id ? 800 : 600,
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
          ) : ehSilvester && empresasAutorizadas.length > 1 ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {empresasAutorizadas.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => trocarEmpresa(emp.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    borderRadius: 10,
                    border: `1.5px solid ${empresaAtivaId === emp.id ? COR.verde : COR.line}`,
                    background: empresaAtivaId === emp.id ? COR.verdeClaro : '#fff',
                    color: empresaAtivaId === emp.id ? COR.verdeEscuro : COR.fg,
                    fontWeight: empresaAtivaId === emp.id ? 800 : 600,
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
              padding: '7px 16px',
              borderRadius: 10,
              background: COR.azulClaro,
              border: `1.5px solid ${COR.azul}`,
              color: '#1e40af',
              fontWeight: 800,
              fontSize: 13
            }}>
              <span>{empresasAutorizadas.find(e => e.id === empresaAtivaId)?.icone || '🏢'}</span>
              <span>{empresasAutorizadas.find(e => e.id === empresaAtivaId)?.nome || 'Barbearia Dino'}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => abrirModalConversao()}
            style={{
              padding: '8px 14px',
              background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
              color: '#fff',
              border: 0,
              borderRadius: 10,
              fontWeight: 800,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)'
            }}
          >
            <span>💵</span> + Registrar Dinheiro no Caixa
          </button>
          <div style={{ fontSize: 12, color: COR.muted }}>
            Multi-Empresas · Kytto Cloud
          </div>
        </div>
      </div>

      {/* AVISO DE EMPRESA SEM CONFIGURAÇÃO PRÓPRIA */}
      {dados?.configurada === false && (
        <div style={{
          padding: '16px 20px',
          borderRadius: 12,
          background: '#fef3c7',
          border: '1.5px solid #f59e0b',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div>
            <div style={{ fontWeight: 800, color: '#92400e', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚙️</span> Configure esta empresa para ativar a Inteligência de Vendas
            </div>
            <div style={{ fontSize: 13, color: '#b45309', marginTop: 4 }}>
              {dados?.aviso || 'Cadastre a chave PIX e os produtos próprios no formulário abaixo para gerar campanhas e Dinheiro na Mesa.'}
            </div>
          </div>
          <button
            onClick={() => setAbaAtiva('config')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: '#d97706',
              color: '#fff',
              border: 0,
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Configurar Agora
          </button>
        </div>
      )}

      {/* BARRA DE CONFORMIDADE META & POLÍTICAS ANTI-BAN */}
      <div style={{
        background: 'linear-gradient(90deg, #ecfdf5 0%, #f0fdf4 100%)',
        border: '1px solid #a7f3d0',
        borderRadius: 12,
        padding: '10px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🛡️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#065f46' }}>
              Proteção Ativa contra Bloqueios da Meta (WhatsApp Business Compliance)
            </div>
            <div style={{ fontSize: 11, color: '#047857' }}>
              Spintax dinâmico ativo · Frase de Opt-out (PARAR) obrigatória · Horário comercial de envio (08h às 20h)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            background: metaComp.emHorarioComercial ? '#10b981' : '#f59e0b',
            color: '#fff',
            padding: '3px 10px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 800
          }}>
            {metaComp.emHorarioComercial ? '✓ Horário de Envio Liberado' : '⚠️ Fora de Horário Comercial'}
          </span>
          <span style={{ fontSize: 11, color: '#065f46', fontWeight: 700 }}>
            Chave PIX Ativa: {dados?.config?.chavePix || 'Não informada'}
          </span>
        </div>
      </div>

      {carregando ? (
        <div style={{ padding: 40, textAlign: 'center', color: COR.muted, background: COR.card, borderRadius: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
          <h3 style={{ margin: 0, fontWeight: 700 }}>A IA está analisando a base e calculando as oportunidades de vendas...</h3>
          <p style={{ margin: '8px 0 0', fontSize: 14 }}>Processando histórico de pedidos, ticket médio, churn preditivo e giro de estoque.</p>
        </div>
      ) : erro ? (
        <div style={{ padding: 30, background: COR.vermelhoClaro, border: `1px solid ${COR.vermelho}`, borderRadius: 14, color: COR.vermelho }}>
          <h3 style={{ margin: '0 0 8px' }}>Erro ao consultar inteligência de vendas</h3>
          <p style={{ margin: 0 }}>{erro}</p>
          <button onClick={() => carregarInteligencia(empresaAtivaId)} style={{ marginTop: 12, padding: '8px 16px', background: COR.vermelho, color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          {/* HEADER DE INTELIGÊNCIA */}
          <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#fff',
            padding: '24px 28px',
            borderRadius: 18,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 26 }}>{icone}</span>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{empresaNome} - Motor de Vendas IA</h1>
                <span style={{
                  background: '#10b981',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: 20,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5
                }}>
                  {agenteIa}
                </span>
              </div>
              <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: 14 }}>
                {empresaSegmento} · Algoritmo preditivo de faturamento: combate ao churn, venda casada (cross-sell), yield management e campanhas automáticas.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                onClick={() => carregarInteligencia(empresaAtivaId)}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <span>🔄</span> Atualizar Oportunidades
              </button>
            </div>
          </div>

          {mensagemSucesso && (
            <div style={{
              background: COR.verdeClaro,
              color: '#065f46',
              border: `1px solid ${COR.verde}`,
              borderRadius: 12,
              padding: '12px 18px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}>
              <span>✅</span> {mensagemSucesso}
            </div>
          )}

          {/* PAINEL DINHEIRO NA MESA (FUNIL DE CONVERSÃO EM TEMPO REAL) */}
          <div style={{
            background: '#fff',
            border: `1.5px solid #cbd5e1`,
            borderRadius: 16,
            padding: '20px 24px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>💰</span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                  DINHEIRO NA MESA · FUNIL DE CONVERSÃO EM TEMPO REAL
                </h3>
              </div>
              <span style={{ fontSize: 12, color: COR.muted }}>
                Valores projetados e convertidos para {empresaNome}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
              {/* Estágio 1 */}
              <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#854d0e', textTransform: 'uppercase' }}>
                  1. Mapeado na Mesa
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#a16207', marginTop: 4 }}>
                  {fmtR(funil.potencialTotalMapeado || 0)}
                </div>
                <div style={{ fontSize: 11, color: '#713f12', marginTop: 4 }}>
                  Oportunidades em carteira
                </div>
              </div>

              {/* Estágio 2 */}
              <div style={{ background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
                  2. Em Negociação Ativa
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#1d4ed8', marginTop: 4 }}>
                  {fmtR(funil.emNegociacaoAtiva || 0)}
                </div>
                <div style={{ fontSize: 11, color: '#1e3a8a', marginTop: 4 }}>
                  Mensagens no WhatsApp
                </div>
              </div>

              {/* Estágio 3 */}
              <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>
                  3. Dinheiro no Caixa
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a', marginTop: 4 }}>
                  {fmtR(funil.dinheiroNoCaixa || 0)}
                </div>
                <div style={{ fontSize: 11, color: '#14532d', marginTop: 4 }}>
                  {funil.totalConversoes || 0} vendas fechadas
                </div>
              </div>

              {/* Estágio 4 */}
              <div style={{ background: '#f3e8ff', border: '1px solid #d8b4fe', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#6b21a8', textTransform: 'uppercase' }}>
                  4. Taxa de Fechamento
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#7e22ce', marginTop: 4 }}>
                  {funil.taxaConversao || 0}%
                </div>
                <div style={{ fontSize: 11, color: '#581c87', marginTop: 4 }}>
                  Eficiência comercial IA
                </div>
              </div>
            </div>

              {/* HISTÓRICO RECENTE DE DINHEIRO NO CAIXA */}
              {funil.historicoRecente && funil.historicoRecente.length > 0 && (
                <div style={{
                  gridColumn: "1 / -1",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 12,
                  padding: "12px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#166534", textTransform: "uppercase" }}>
                      🧾 Vendas Recentes Confirmadas no Caixa ({funil.totalConversoes})
                    </span>
                    <span style={{ fontSize: 11, color: "#15803d", fontWeight: 600 }}>
                      Atualizado em tempo real
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
                    {funil.historicoRecente.map((reg, idx) => (
                      <div key={reg.id || idx} style={{
                        background: "#fff",
                        border: "1px solid #86efac",
                        borderRadius: 8,
                        padding: "8px 12px",
                        minWidth: 180,
                        fontSize: 12,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
                      }}>
                        <div style={{ fontWeight: 800, color: "#14532d" }}>{reg.clienteNome}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, alignItems: "center" }}>
                          <span style={{ fontWeight: 900, color: "#16a34a", fontSize: 13 }}>{fmtR(reg.valor)}</span>
                          <span style={{ fontSize: 10, color: "#65a30d", background: "#ecfccb", padding: "1px 5px", borderRadius: 4 }}>
                            {reg.tipo || "Conversão"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}          </div>

          {/* 4 CARDS DE INDICADORES PRINCIPAIS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {/* KPI 1: TICKET MÉDIO */}
            <div style={{ background: COR.card, border: `1px solid ${COR.line}`, borderRadius: 16, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: COR.muted }}>TICKET MÉDIO ATUAL</span>
                <span style={{ fontSize: 18 }}>💳</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: COR.fg, marginTop: 8 }}>
                {fmtR(kpis.ticketMedioAtual || 0)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12 }}>
                <span style={{ background: COR.verdeClaro, color: COR.verde, padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>
                  Meta IA: {fmtR(kpis.metaTicketMedio || 0)}
                </span>
                <span style={{ color: COR.muted }}>+{fmtR(kpis.expansaoProjetadaTicket || 0)}/pedido</span>
              </div>
            </div>

            {/* KPI 2: VENDA CASADA (CROSS-SELL) */}
            <div style={{ background: COR.card, border: `1px solid ${COR.line}`, borderRadius: 16, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: COR.muted }}>TAXA DE CROSS-SELL / COMBO</span>
                <span style={{ fontSize: 18 }}>🛍️⚡</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: COR.azul, marginTop: 8 }}>
                {kpis.taxaCrossSell || 0}%
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12 }}>
                <span style={{ background: COR.azulClaro, color: COR.azul, padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>
                  Meta: {kpis.metaCrossSell || 50}%
                </span>
                <span style={{ color: COR.muted }}>Combos & Kits</span>
              </div>
            </div>

            {/* KPI 3: CLIENTES EM RISCO DE CHURN */}
            <div style={{ background: COR.card, border: `1px solid ${COR.line}`, borderRadius: 16, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: COR.muted }}>CHURN PREDITIVO</span>
                <span style={{ fontSize: 18 }}>⚠️</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: COR.vermelho, marginTop: 8 }}>
                {kpis.clientesEmRiscoChurn || 0} clientes
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12 }}>
                <span style={{ background: COR.vermelhoClaro, color: COR.vermelho, padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>
                  Prontos para resgate
                </span>
                <span style={{ color: COR.muted }}>Ciclo de {dados?.config?.cicloChurnDias || 21} dias</span>
              </div>
            </div>

            {/* KPI 4: RECEITA ADICIONAL MAPEADA PELA IA */}
            <div style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%)', border: `1px solid #fde047`, borderRadius: 16, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#854d0e' }}>POTENCIAL EXTRA / MÊS</span>
                <span style={{ fontSize: 18 }}>💰</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#a16207', marginTop: 8 }}>
                +{fmtR(kpis.receitaPotencialTotal || 0)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12, color: '#854d0e', fontWeight: 600 }}>
                <span>Oportunidades identificadas na mesa</span>
              </div>
            </div>
          </div>

          {/* ABAS INTERATIVAS */}
          <div style={{ background: COR.card, border: `1px solid ${COR.line}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: `1px solid ${COR.line}`, background: '#f8fafc', padding: '6px 12px', gap: 6, overflowX: 'auto' }}>
              {[
                { id: 'reativacao', label: labels.reativacao ? `🎯 ${labels.reativacao}` : '🎯 Reativação Anti-Churn', badge: kpis.clientesEmRiscoChurn },
                { id: 'buracos', label: labels.vagas ? `⚡ ${labels.vagas}` : '⚡ Campanhas & Yield', badge: oportunidades.vagasOciosasSemana?.length },
                { id: 'upsell', label: labels.upsell ? `🛍️ ${labels.upsell}` : '🛍️ Up-Sell & Combos', badge: oportunidades.upSellServicos?.length },
                { id: 'clube', label: labels.fidelidade ? `👑 ${labels.fidelidade}` : '👑 Assinaturas & Fidelidade', badge: oportunidades.clubeAssinaturas?.length },
                { id: 'simulador', label: '📈 Simulador Financeiro' },
                { id: 'configuracoes', label: '⚙️ Configurações & Políticas Meta' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setAbaAtiva(tab.id)}
                  style={{
                    padding: '10px 18px',
                    border: 0,
                    borderRadius: 10,
                    background: abaAtiva === tab.id ? '#fff' : 'transparent',
                    color: abaAtiva === tab.id ? '#0f172a' : COR.muted,
                    fontWeight: abaAtiva === tab.id ? 800 : 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: abaAtiva === tab.id ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                  {tab.badge != null && tab.badge > 0 && (
                    <span style={{
                      background: abaAtiva === tab.id ? '#e2e8f0' : '#cbd5e1',
                      color: '#0f172a',
                      fontSize: 11,
                      padding: '1px 7px',
                      borderRadius: 10,
                      fontWeight: 800
                    }}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div style={{ padding: 24 }}>
              {/* ABA 1: REATIVAÇÃO ANTI-CHURN COM MULTI-OPÇÕES E BOTÃO DINHEIRO NO CAIXA */}
              {abaAtiva === 'reativacao' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                        {labels.reativacao || 'Reativação Preditiva de Clientes'}
                      </h3>
                      <p style={{ margin: '4px 0 0', color: COR.muted, fontSize: 13 }}>
                        Escolha o tom de voz ideal para cada cliente: abordagem suave (Anti-Ban Meta), fechamento com PIX (Dinheiro na Mesa) ou lembrete de reposição.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setFiltroPropensao('todos')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: `1px solid ${filtroPropensao === 'todos' ? COR.azul : COR.line}`,
                          background: filtroPropensao === 'todos' ? COR.azulClaro : '#fff',
                          color: filtroPropensao === 'todos' ? COR.azul : COR.muted,
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer'
                        }}
                      >
                        Todos ({oportunidades.reativacaoAntiChurn?.length || 0})
                      </button>
                      <button
                        onClick={() => setFiltroPropensao('alta')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: `1px solid ${filtroPropensao === 'alta' ? COR.verde : COR.line}`,
                          background: filtroPropensao === 'alta' ? COR.verdeClaro : '#fff',
                          color: filtroPropensao === 'alta' ? COR.verde : COR.muted,
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer'
                        }}
                      >
                        Alta Propensão
                      </button>
                      <button
                        onClick={exportarListaCsv}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: `1px solid ${COR.line}`,
                          background: "#fff",
                          color: "#0f766e",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6
                        }}
                      >
                        <span>📥</span> Exportar CSV
                      </button>
                    </div>
                  </div>

                  {listaReativacao.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: COR.muted }}>
                      <p style={{ margin: 0 }}>Nenhum cliente em risco nesta categoria no momento. Sua base está saudável!</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {listaReativacao.map((c, i) => {
                        const opcaoAtual = opcaoSelecionada[c.id] || 'fechamento';
                        const dadosOpcao = c.opcoesMensagem ? c.opcoesMensagem[opcaoAtual] : null;
                        const textoExibido = dadosOpcao ? dadosOpcao.texto : c.mensagemIa;

                        return (
                          <div
                            key={c.id || i}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 12,
                              padding: '18px',
                              background: '#fff',
                              border: `1px solid ${COR.line}`,
                              borderRadius: 14,
                              boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                              <div>
                                <strong style={{ fontSize: 15, color: COR.fg }}>{c.nome}</strong>
                                <span style={{ fontSize: 13, color: COR.muted, marginLeft: 8 }}>{c.telefone || 'Sem telefone'}</span>
                                {c.barbeiroPreferido && (
                                  <span style={{ fontSize: 12, color: COR.azul, fontWeight: 700, marginLeft: 8 }}>
                                    · Barbeiro: {c.barbeiroPreferido}
                                  </span>
                                )}
                                {c.ultimaCompra && (
                                  <span style={{ fontSize: 12, color: COR.azul, fontWeight: 700, marginLeft: 8 }}>
                                    · Último item: {c.ultimaCompra}
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{
                                  background: c.diasSemVir > 40 ? COR.vermelhoClaro : COR.laranjaClaro,
                                  color: c.diasSemVir > 40 ? COR.vermelho : '#b45309',
                                  fontSize: 12,
                                  fontWeight: 800,
                                  padding: '3px 9px',
                                  borderRadius: 8
                                }}>
                                  {c.diasSemVir} dias sem vir
                                </span>
                                {c.gastoTotal > 0 && (
                                  <span style={{ fontSize: 12, color: COR.muted }}>
                                    Gasto histórico: {fmtR(c.gastoTotal)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* SELETOR DE ABORDAGEM DE MENSAGEM (META COMPLIANCE) */}
                            {c.opcoesMensagem && (
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: COR.muted, textTransform: 'uppercase' }}>
                                  Tom de Voz:
                                </span>
                                <button
                                  onClick={() => alternarOpcaoMensagem(c.id, 'suave')}
                                  style={{
                                    padding: '5px 10px',
                                    borderRadius: 6,
                                    border: `1px solid ${opcaoAtual === 'suave' ? COR.verde : COR.line}`,
                                    background: opcaoAtual === 'suave' ? COR.verdeClaro : '#fff',
                                    color: opcaoAtual === 'suave' ? COR.verdeEscuro : COR.muted,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  💬 1. Suave (Risco Meta Zero)
                                </button>
                                <button
                                  onClick={() => alternarOpcaoMensagem(c.id, 'fechamento')}
                                  style={{
                                    padding: '5px 10px',
                                    borderRadius: 6,
                                    border: `1px solid ${opcaoAtual === 'fechamento' ? COR.azul : COR.line}`,
                                    background: opcaoAtual === 'fechamento' ? COR.azulClaro : '#fff',
                                    color: opcaoAtual === 'fechamento' ? '#1e40af' : COR.muted,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  💰 2. Fechamento c/ PIX (Dinheiro na Mesa)
                                </button>
                                <button
                                  onClick={() => alternarOpcaoMensagem(c.id, 'lembrete')}
                                  style={{
                                    padding: '5px 10px',
                                    borderRadius: 6,
                                    border: `1px solid ${opcaoAtual === 'lembrete' ? COR.laranja : COR.line}`,
                                    background: opcaoAtual === 'lembrete' ? COR.laranjaClaro : '#fff',
                                    color: opcaoAtual === 'lembrete' ? '#b45309' : COR.muted,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  ⏰ 3. Lembrete Útil
                                </button>

                                {dadosOpcao && (
                                  <span style={{ fontSize: 11, color: dadosOpcao.corRisco || COR.verde, fontWeight: 700, marginLeft: 'auto' }}>
                                    🛡️ {dadosOpcao.riscoMeta}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* CAIXA DE MENSAGEM SUGERIDA PELA IA */}
                            <div style={{
                              background: '#f8fafc',
                              padding: '12px 16px',
                              borderRadius: 10,
                              fontSize: 13,
                              color: '#334155',
                              borderLeft: `4px solid ${opcaoAtual === 'fechamento' ? COR.azul : COR.verde}`,
                              lineHeight: 1.5,
                              whiteSpace: 'pre-wrap'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: COR.muted }}>
                                  {agenteIa} · Mensagem Pronta
                                </span>
                                <span style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                                  {dadosOpcao?.gatilho || 'Pronta para envio'}
                                </span>
                              </div>
                              {textoExibido}
                            </div>

                            {/* BOTÕES DE AÇÃO: DISPARAR WHATSAPP & MARCAR CONVERTIDO */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                              <button
                                onClick={() => copiarMensagem(textoExibido)}
                                style={{
                                  padding: "9px 14px",
                                  background: "#f8fafc",
                                  color: "#334155",
                                  border: "1.5px solid #cbd5e1",
                                  borderRadius: 8,
                                  fontWeight: 700,
                                  fontSize: 12,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6
                                }}
                              >
                                <span>📋</span> Copiar
                              </button>
                              <button
                                onClick={() => abrirModalConversao(c)}
                                style={{
                                  padding: '9px 16px',
                                  background: '#fff',
                                  color: '#047857',
                                  border: '1.5px solid #10b981',
                                  borderRadius: 8,
                                  fontWeight: 800,
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6
                                }}
                              >
                                <span>💵</span> Marcar Convertido (Dinheiro no Caixa)
                              </button>

                              <button
                                onClick={() => dispararMensagem(c, 'anti_churn')}
                                style={{
                                  padding: '9px 18px',
                                  background: '#25D366',
                                  color: '#fff',
                                  border: 0,
                                  borderRadius: 8,
                                  fontWeight: 800,
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6
                                }}
                              >
                                <span>📲</span> Enviar no WhatsApp
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ABA 2: PREENCHER VAGAS DA SEMANA / CAMPANHAS (ESTRITAMENTE DE HOJE PARA FRENTE & AÇÕES OPERACIONAIS) */}
              {abaAtiva === 'buracos' && (() => {
                const todasVagas = oportunidades.vagasOciosasSemana || [];
                const vagasFiltradas = todasVagas.filter(v => {
                  if (filtroBarbeiroBuracos !== 'todos') {
                    if (!v.profissional.toLowerCase().includes(filtroBarbeiroBuracos.toLowerCase())) return false;
                  }
                  if (filtroPrazoBuracos === 'hoje') {
                    if (v.tagPrazo !== 'hoje') return false;
                  } else if (filtroPrazoBuracos === '3dias') {
                    if (Number(v.offsetDias || 0) > 3) return false;
                  } else if (filtroPrazoBuracos === '7dias') {
                    if (Number(v.offsetDias || 0) > 7) return false;
                  }
                  return true;
                });

                return (
                  <div>
                    {/* Header da Aba com Informativo Oficial */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                            ⚡ {labels.vagas || 'Otimizador de Buracos na Agenda & Vagas Ociosas'}
                          </h3>
                          <p style={{ margin: '4px 0 0', color: COR.muted, fontSize: 13 }}>
                            Visualização em tempo real de horários ociosos a partir de <strong>HOJE para FRENTE</strong>. Tome ações imediatas com 1 clique.
                          </p>
                        </div>
                        <div style={{ padding: '6px 12px', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid #22c55e', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#15803d', fontWeight: 700 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
                          Agenda Ativa · Horários Passados Descartados Automaticamente
                        </div>
                      </div>
                    </div>

                    {/* Filtros Dinâmicos de Barbeiro e Período */}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', background: '#f8fafc', padding: '12px 16px', borderRadius: 12, border: `1px solid ${COR.line}`, marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: COR.fg }}>💈 Barbeiro:</span>
                        {['todos', 'Bruno', 'Dino', 'Nati'].map(b => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setFiltroBarbeiroBuracos(b)}
                            style={{
                              padding: '5px 11px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: filtroBarbeiroBuracos === b ? `1.5px solid ${COR.azul}` : `1px solid ${COR.line}`,
                              background: filtroBarbeiroBuracos === b ? COR.azul : '#fff',
                              color: filtroBarbeiroBuracos === b ? '#fff' : COR.fg,
                            }}
                          >
                            {b === 'todos' ? 'Todos os Barbeiros' : b}
                          </button>
                        ))}
                      </div>

                      <div style={{ height: 20, width: 1, background: COR.line }}></div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: COR.fg }}>📅 Período:</span>
                        {[
                          { id: 'todos', label: 'Todos para Frente' },
                          { id: 'hoje', label: '⚡ Apenas Hoje' },
                          { id: '3dias', label: 'Próximos 3 Dias' },
                          { id: '7dias', label: 'Próxima Semana' },
                        ].map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setFiltroPrazoBuracos(p.id)}
                            style={{
                              padding: '5px 11px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: filtroPrazoBuracos === p.id ? `1.5px solid ${COR.dourado}` : `1px solid ${COR.line}`,
                              background: filtroPrazoBuracos === p.id ? COR.dourado : '#fff',
                              color: filtroPrazoBuracos === p.id ? '#fff' : COR.fg,
                            }}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      <div style={{ marginLeft: 'auto', fontSize: 12, color: COR.muted, fontWeight: 600 }}>
                        {vagasFiltradas.length} vaga(s) ociosa(s) encontrada(s)
                      </div>
                    </div>

                    {/* Grid de Cards de Buracos na Agenda com Ações */}
                    {vagasFiltradas.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: 12, border: `1px dashed ${COR.line}` }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                        <h4 style={{ margin: 0, fontSize: 16, color: COR.fg }}>Grade 100% Preenchida neste Período!</h4>
                        <p style={{ margin: '6px 0 0', fontSize: 13, color: COR.muted }}>Nenhum horário ocioso encontrado para os filtros selecionados.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                        {vagasFiltradas.map((vaga) => {
                          const ehHoje = vaga.tagPrazo === 'hoje';
                          const ehAmanha = vaga.tagPrazo === 'amanha';

                          return (
                            <div
                              key={vaga.id}
                              style={{
                                background: '#fff',
                                border: ehHoje ? `2px solid ${COR.dourado}` : `1px solid ${COR.line}`,
                                borderRadius: 14,
                                padding: 18,
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: ehHoje ? '0 4px 14px rgba(201, 154, 46, 0.15)' : 'none',
                                position: 'relative',
                              }}
                            >
                              {/* Header do Card com Tag de Data e Horário */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <span
                                  style={{
                                    background: ehHoje ? COR.douradoClaro : ehAmanha ? COR.azulClaro : '#f1f5f9',
                                    color: ehHoje ? COR.dourado : ehAmanha ? COR.azul : '#475569',
                                    padding: '4px 10px',
                                    borderRadius: 6,
                                    fontWeight: 800,
                                    fontSize: 11,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  {ehHoje ? '⚡ HOJE' : ehAmanha ? '🌅 AMANHÃ' : '📅'} {vaga.dia}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 12, color: COR.muted }}>⏰</span>
                                  <strong style={{ fontSize: 18, color: COR.fg, letterSpacing: '-0.5px' }}>{vaga.horario}</strong>
                                </div>
                              </div>

                              {/* Dados do Barbeiro e Potencial */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, marginBottom: 12 }}>
                                <div style={{ width: 34, height: 34, borderRadius: '50%', background: COR.azul, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
                                  {vaga.profissional.slice(0, 2).toUpperCase()}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: COR.fg }}>
                                    {vaga.profissional}
                                  </div>
                                  <div style={{ fontSize: 12, color: COR.muted }}>
                                    {vaga.foco || 'Corte & Barba'}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: 11, color: COR.muted, fontWeight: 600 }}>Potencial</div>
                                  <div style={{ fontSize: 14, color: COR.verde, fontWeight: 900 }}>{fmtR(vaga.potencial)}</div>
                                </div>
                              </div>

                              {/* Card de Match Inteligente de Cliente */}
                              {vaga.clienteSugerido ? (
                                <div style={{ padding: '10px 12px', background: 'rgba(37, 99, 235, 0.05)', border: '1px dashed rgba(37, 99, 235, 0.3)', borderRadius: 8, marginBottom: 14 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: COR.azul }}>🎯 CLIENTE IDEAL PARA ESTE HORÁRIO:</span>
                                    <span style={{ fontSize: 11, color: COR.laranja, fontWeight: 700 }}>{vaga.clienteSugerido.diasSemVir} dias sem vir</span>
                                  </div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: COR.fg }}>
                                    {vaga.clienteSugerido.nome}
                                  </div>
                                  <div style={{ fontSize: 12, color: COR.muted }}>
                                    {vaga.clienteSugerido.telefone}
                                  </div>
                                </div>
                              ) : (
                                <div style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 8, marginBottom: 14, fontSize: 12, color: COR.muted }}>
                                  💡 <em>Vaga disponível para agendamento online ou envio a clientes VIPs.</em>
                                </div>
                              )}

                              {/* Barra de Ações Rápidas (4 Botões de Ação) */}
                              <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: `1px solid ${COR.line}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                  {/* Botão 1: Enviar WhatsApp */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const tel = vaga.clienteSugerido?.telefone?.replace(/\D/g, '') || '';
                                      const msg = vaga.mensagemWhatsApp || `Olá! Abriu vaga com ${vaga.profissional} ${vaga.dia} às ${vaga.horario}. Link: ${vaga.linkAgendamento}`;
                                      const url = tel ? `https://wa.me/${tel}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                                      window.open(url, '_blank');
                                    }}
                                    style={{
                                      padding: '9px 10px',
                                      background: '#22c55e',
                                      color: '#fff',
                                      border: 0,
                                      borderRadius: 8,
                                      fontWeight: 800,
                                      fontSize: 12,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: 6,
                                    }}
                                  >
                                    <span>📲</span> WhatsApp
                                  </button>

                                  {/* Botão 2: Fazer Encaixe Rápido */}
                                  <button
                                    type="button"
                                    onClick={() => handleAbrirEncaixe(vaga)}
                                    style={{
                                      padding: '9px 10px',
                                      background: COR.azul,
                                      color: '#fff',
                                      border: 0,
                                      borderRadius: 8,
                                      fontWeight: 800,
                                      fontSize: 12,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: 6,
                                    }}
                                  >
                                    <span>⚡</span> Encaixe
                                  </button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                  {/* Botão 3: Oferta Relâmpago 15% OFF */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const tel = vaga.clienteSugerido?.telefone?.replace(/\D/g, '') || '';
                                      const msg = vaga.mensagemOfertaRelampago || `Oferta Especial: 15% OFF ${vaga.dia} às ${vaga.horario} com ${vaga.profissional}! ${vaga.linkAgendamento}`;
                                      const url = tel ? `https://wa.me/${tel}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                                      window.open(url, '_blank');
                                    }}
                                    style={{
                                      padding: '8px 10px',
                                      background: 'rgba(245, 158, 11, 0.1)',
                                      color: '#d97706',
                                      border: '1px solid #f59e0b',
                                      borderRadius: 8,
                                      fontWeight: 700,
                                      fontSize: 11,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <span>🏷️</span> Oferta 15% OFF
                                  </button>

                                  {/* Botão 4: Bloquear Horário */}
                                  <button
                                    type="button"
                                    disabled={bloqueandoSlotId === vaga.id}
                                    onClick={() => handleBloquearSlot(vaga)}
                                    style={{
                                      padding: '8px 10px',
                                      background: '#fee2e2',
                                      color: '#b91c1c',
                                      border: '1px solid #fca5a5',
                                      borderRadius: 8,
                                      fontWeight: 700,
                                      fontSize: 11,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <span>🔒</span> {bloqueandoSlotId === vaga.id ? 'Bloqueando…' : 'Bloquear Slot'}
                                  </button>
                                </div>

                                {/* Link Auxiliar de Copiar URL */}
                                <button
                                  type="button"
                                  onClick={() => handleCopiarLinkVaga(vaga)}
                                  style={{
                                    padding: '6px',
                                    background: 'transparent',
                                    color: COR.muted,
                                    border: 'none',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    textDecoration: 'underline',
                                  }}
                                >
                                  📋 Copiar link direto deste horário
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Modal de Encaixe Rápido de Horário Ocioso */}
                    {modalEncaixeAberto && vagaEncaixe && (
                      <div
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: 'rgba(0,0,0,0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 9999,
                          padding: 16,
                        }}
                      >
                        <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>⚡ Fazer Encaixe Rápido</h3>
                            <button
                              type="button"
                              onClick={() => { setModalEncaixeAberto(false); setVagaEncaixe(null); }}
                              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: COR.muted }}
                            >
                              ✕
                            </button>
                          </div>

                          <div style={{ padding: '10px 14px', background: '#f1f5f9', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                            <div><strong>Profissional:</strong> {vagaEncaixe.profissional}</div>
                            <div><strong>Data:</strong> {vagaEncaixe.dia} ({vagaEncaixe.data})</div>
                            <div><strong>Horário:</strong> {vagaEncaixe.horario}</div>
                          </div>

                          <form onSubmit={handleSalvarEncaixe} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: COR.fg }}>
                                Nome do Cliente *
                              </label>
                              <input
                                type="text"
                                required
                                value={formEncaixe.clienteNome}
                                onChange={(e) => setFormEncaixe({ ...formEncaixe, clienteNome: e.target.value })}
                                placeholder="Nome completo do cliente"
                                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${COR.line}`, boxSizing: 'border-box' }}
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: COR.fg }}>
                                Telefone (WhatsApp)
                              </label>
                              <input
                                type="tel"
                                value={formEncaixe.clienteTelefone}
                                onChange={(e) => setFormEncaixe({ ...formEncaixe, clienteTelefone: e.target.value })}
                                placeholder="(65) 99999-9999"
                                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${COR.line}`, boxSizing: 'border-box' }}
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: COR.fg }}>
                                Serviço
                              </label>
                              <select
                                value={formEncaixe.servicoId}
                                onChange={(e) => setFormEncaixe({ ...formEncaixe, servicoId: e.target.value })}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${COR.line}`, boxSizing: 'border-box' }}
                              >
                                <option value="srv-dino-corte-001">Corte Masculino Dino (R$ 90)</option>
                                <option value="srv-dino-barba-002">Barba Terapia Tradicional (R$ 60)</option>
                                <option value="srv-dino-combo-003">Combo Corte & Barba Premium (R$ 140)</option>
                              </select>
                            </div>

                            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                              <button
                                type="button"
                                onClick={() => { setModalEncaixeAberto(false); setVagaEncaixe(null); }}
                                style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${COR.line}`, background: '#f8fafc', fontWeight: 700, cursor: 'pointer' }}
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                disabled={salvandoEncaixe}
                                style={{ flex: 1, padding: 12, borderRadius: 8, border: 'none', background: COR.azul, color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                              >
                                {salvandoEncaixe ? 'Confirmando…' : 'Confirmar Encaixe'}
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ABA 3: UP-SELL DE SERVIÇOS & PRODUTOS */}
              {abaAtiva === 'upsell' && (
                <div>
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                      {labels.upsell || 'Radar de Up-Sell & Combos'}
                    </h3>
                    <p style={{ margin: '4px 0 0', color: COR.muted, fontSize: 13 }}>
                      Elevação de ticket médio através de produtos complementares e combos de alta margem.
                    </p>
                  </div>

                  <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: '#334155' }}>
                    📦 Produtos Campeões Recomendados pela IA
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14, marginBottom: 24 }}>
                    {produtos.map(p => (
                      <div key={p.id} style={{ background: '#fff', border: `1px solid ${COR.line}`, borderRadius: 12, padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <strong style={{ fontSize: 13, color: COR.fg }}>{p.nome}</strong>
                          <span style={{ fontSize: 14, fontWeight: 900, color: COR.verde }}>{fmtR(p.preco)}</span>
                        </div>
                        <div style={{ fontSize: 11, color: COR.muted, marginTop: 4 }}>
                          Categoria: {p.categoria} · Estoque: {p.estoque} un.
                        </div>
                        <div style={{ marginTop: 10, background: '#f8fafc', padding: 8, borderRadius: 6, fontSize: 11, color: '#475569', fontStyle: 'italic' }}>
                          💡 {p.dicaVendaIa}
                        </div>
                      </div>
                    ))}
                  </div>

                  <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: '#334155' }}>
                    👥 Oportunidades Identificadas de Up-Sell Casado
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(oportunidades.upSellServicos || []).map((c, i) => (
                      <div
                        key={c.id || i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: 14,
                          borderRadius: 10,
                          border: `1px solid ${COR.line}`,
                          background: '#fff',
                          flexWrap: 'wrap',
                          gap: 12
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: 14, color: COR.fg }}>{c.nome}</strong>
                          <div style={{ fontSize: 12, color: COR.muted }}>{c.telefone || 'Sem telefone'}</div>
                          <div style={{ fontSize: 12, color: COR.azul, fontWeight: 700, marginTop: 4 }}>
                            Oferta Recomendada: {c.tipoOferta} (+{fmtR(c.impactoTicket)})
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => abrirModalConversao(c)}
                            style={{
                              padding: '8px 12px',
                              background: '#fff',
                              color: '#047857',
                              border: '1px solid #10b981',
                              borderRadius: 8,
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: 'pointer'
                            }}
                          >
                            💵 Fechou (+{fmtR(c.impactoTicket)})
                          </button>
                          <button
                            onClick={() => dispararMensagem(c, 'upsell')}
                            style={{
                              padding: '8px 14px',
                              background: COR.roxo,
                              color: '#fff',
                              border: 0,
                              borderRadius: 8,
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                          >
                            <span>💬</span> Propor no WhatsApp
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ABA 4: CONVERSÃO CLUBE VIP / ASSINATURAS */}
              {abaAtiva === 'clube' && (
                <div>
                  <div style={{ marginBottom: 18 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                      {labels.fidelidade || 'Candidatos para Assinatura & Fidelidade Recorrente'}
                    </h3>
                    <p style={{ margin: '4px 0 0', color: COR.muted, fontSize: 13 }}>
                      Clientes com compras contínuas. A conversão para planos recorrentes blinda sua empresa contra a concorrência e gera fluxo de caixa estável.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
                    {(oportunidades.clubeAssinaturas || []).map((c, i) => (
                      <div key={c.id || i} style={{ background: '#fff', border: `1px solid ${COR.dourado}`, borderRadius: 12, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: 15, color: COR.fg }}>{c.nome}</strong>
                          <span style={{ background: COR.douradoClaro, color: '#92400e', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 10 }}>
                            {c.visitasTotal || 4}+ Pedidos
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: COR.muted, marginTop: 4 }}>Gasto Acumulado: {fmtR(c.gastoTotal)}</div>
                        <div style={{ marginTop: 12, padding: 10, background: '#fdfbf7', borderRadius: 8, fontSize: 12, color: '#78350f' }}>
                          {c.mensagemIa}
                        </div>
                        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => abrirModalConversao(c)}
                            style={{
                              flex: 1,
                              padding: '9px',
                              background: '#fff',
                              color: '#92400e',
                              border: `1px solid ${COR.dourado}`,
                              borderRadius: 8,
                              fontWeight: 800,
                              fontSize: 12,
                              cursor: 'pointer'
                            }}
                          >
                            💵 Ativou Plano
                          </button>
                          <button
                            onClick={() => dispararMensagem(c, 'clube_vip')}
                            style={{
                              flex: 1,
                              padding: '9px',
                              background: COR.dourado,
                              color: '#fff',
                              border: 0,
                              borderRadius: 8,
                              fontWeight: 800,
                              fontSize: 12,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6
                            }}
                          >
                            <span>👑</span> Convidar no WhatsApp
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ABA 5: SIMULADOR DE IMPACTO FINANCEIRO */}
              {abaAtiva === 'simulador' && (
                <div>
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Simulador de Impacto Financeiro da IA</h3>
                    <p style={{ margin: '4px 0 0', color: COR.muted, fontSize: 13 }}>
                      Veja o impacto direto no seu caixa ao implementar as recomendações da Inteligência Artificial.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                    <div style={{ background: '#fff', border: `1px solid ${COR.line}`, borderRadius: 14, padding: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: COR.muted }}>EXPANSÃO DE TICKET MÉDIO</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: COR.verde, marginTop: 8 }}>
                        +{fmtR(simulador.impactoMais20ReaisTicket || 9600)}/mês
                      </div>
                      <p style={{ fontSize: 12, color: COR.muted, marginTop: 8 }}>
                        Apenas adicionando um item de cross-sell (ex: produto, combo ou acessório) em cada pedido.
                      </p>
                    </div>

                    <div style={{ background: '#fff', border: `1px solid ${COR.line}`, borderRadius: 14, padding: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: COR.muted }}>COMBOS DE ALTA PERFORMANCE</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: COR.azul, marginTop: 8 }}>
                        +{fmtR(simulador.impactoMais50ReaisTicket || 24000)}/mês
                      </div>
                      <p style={{ fontSize: 12, color: COR.muted, marginTop: 8 }}>
                        Aumentando a adesão aos combos e kits recomendados pela IA.
                      </p>
                    </div>

                    <div style={{ background: '#fff', border: `1px solid ${COR.line}`, borderRadius: 14, padding: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: COR.muted }}>RECUPERAÇÃO DE CLIENTES EM CHURN</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: COR.laranja, marginTop: 8 }}>
                        +{fmtR(simulador.impactoRecuperar10Clientes || 1750)}/mês
                      </div>
                      <p style={{ fontSize: 12, color: COR.muted, marginTop: 8 }}>
                        Resgatando clientes inativos com as mensagens personalizadas geradas pela IA.
                      </p>
                    </div>

                    <div style={{ background: '#fff', border: `1px solid ${COR.line}`, borderRadius: 14, padding: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: COR.muted }}>CAPACIDADE OCIOSA & CAMPANHAS</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: COR.roxo, marginTop: 8 }}>
                        +{fmtR(simulador.impactoPreencher2VagasDia || 8400)}/mês
                      </div>
                      <p style={{ fontSize: 12, color: COR.muted, marginTop: 8 }}>
                        Preenchendo horários vagos e aproveitando picos semanais com campanhas no WhatsApp.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 6: CONFIGURAÇÕES COMERCIAIS & POLÍTICAS META (DISPONÍVEL PARA TODAS AS EMPRESAS) */}
              {abaAtiva === 'configuracoes' && formConfig && (
                <div>
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                      ⚙️ Configurações Comerciais & Políticas Meta · {empresaNome}
                    </h3>
                    <p style={{ margin: '4px 0 0', color: COR.muted, fontSize: 13 }}>
                      Configure a chave PIX de fechamento rápido, links de pagamento/agendamento, parâmetros de churn e proteção Anti-Ban da Meta para este negócio.
                    </p>
                  </div>

                  <form onSubmit={salvarConfiguracoesEmpresa} style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800 }}>
                    {/* SEÇÃO 1: DADOS DE FECHAMENTO & PIX (DINHEIRO NA MESA) */}
                    <div style={{ background: '#f8fafc', padding: 20, borderRadius: 14, border: `1px solid ${COR.line}` }}>
                      <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                        💰 Dados de Fechamento Imediato (Dinheiro na Mesa)
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: COR.muted, marginBottom: 4 }}>
                            Chave PIX da Empresa (Inserida nas mensagens de fechamento)
                          </label>
                          <input
                            type="text"
                            value={formConfig.chavePix || ''}
                            onChange={e => setFormConfig({ ...formConfig, chavePix: e.target.value })}
                            placeholder="ex: 50.073.355/0001-89 ou pix@empresa.com.br"
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: 8,
                              border: `1px solid ${COR.line}`,
                              fontSize: 13
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: COR.muted, marginBottom: 4 }}>
                            Tipo da Chave PIX
                          </label>
                          <select
                            value={formConfig.chavePixTipo || 'CNPJ'}
                            onChange={e => setFormConfig({ ...formConfig, chavePixTipo: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: 8,
                              border: `1px solid ${COR.line}`,
                              fontSize: 13
                            }}
                          >
                            <option value="CNPJ">CNPJ</option>
                            <option value="CPF">CPF</option>
                            <option value="E-mail">E-mail</option>
                            <option value="Celular">Celular</option>
                            <option value="Aleatória">Chave Aleatória</option>
                          </select>
                        </div>

                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: COR.muted, marginBottom: 4 }}>
                            Link Direto de Agendamento ou Checkout da Empresa
                          </label>
                          <input
                            type="text"
                            value={formConfig.linkDireto || ''}
                            onChange={e => setFormConfig({ ...formConfig, linkDireto: e.target.value })}
                            placeholder="https://kytto.com.br/empresa"
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: 8,
                              border: `1px solid ${COR.line}`,
                              fontSize: 13
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* SEÇÃO 2: POLÍTICAS META WHATSAPP BUSINESS & ANTI-BAN */}
                    <div style={{ background: '#ecfdf5', padding: 20, borderRadius: 14, border: '1px solid #a7f3d0' }}>
                      <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: '#065f46' }}>
                        🛡️ Políticas da Meta & Prevenção de Bloqueio (WhatsApp Business)
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input
                            type="checkbox"
                            id="chkOptOut"
                            checked={!!formConfig.optOutAtivo}
                            onChange={e => setFormConfig({ ...formConfig, optOutAtivo: e.target.checked })}
                            style={{ width: 18, height: 18 }}
                          />
                          <label htmlFor="chkOptOut" style={{ fontSize: 13, fontWeight: 700, color: '#065f46', cursor: 'pointer' }}>
                            Incluir Frase de Opt-out Amigável (Evita denúncias e bloqueios no WhatsApp)
                          </label>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#047857', marginBottom: 4 }}>
                            Texto da Frase de Opt-out
                          </label>
                          <input
                            type="text"
                            value={formConfig.fraseOptOut || ''}
                            onChange={e => setFormConfig({ ...formConfig, fraseOptOut: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: 8,
                              border: '1px solid #6ee7b7',
                              fontSize: 13,
                              background: '#fff'
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input
                            type="checkbox"
                            id="chkHorario"
                            checked={!!formConfig.travaHorarioComercial}
                            onChange={e => setFormConfig({ ...formConfig, travaHorarioComercial: e.target.checked })}
                            style={{ width: 18, height: 18 }}
                          />
                          <label htmlFor="chkHorario" style={{ fontSize: 13, fontWeight: 700, color: '#065f46', cursor: 'pointer' }}>
                            Travar Envios Fora do Horário Comercial (Permitir apenas entre 08h e 20h)
                          </label>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 6 }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#047857', marginBottom: 4 }}>
                              Intervalo Seguro entre Envios (segundos)
                            </label>
                            <input
                              type="number"
                              min="15"
                              max="120"
                              value={formConfig.intervaloSegundos || 30}
                              onChange={e => setFormConfig({ ...formConfig, intervaloSegundos: Number(e.target.value) })}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #6ee7b7', background: '#fff' }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#047857', marginBottom: 4 }}>
                              Limite Diário de Disparos (Tier de Aquecimento Meta)
                            </label>
                            <input
                              type="number"
                              min="20"
                              max="500"
                              value={formConfig.limiteDiarioEnvios || 100}
                              onChange={e => setFormConfig({ ...formConfig, limiteDiarioEnvios: Number(e.target.value) })}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #6ee7b7', background: '#fff' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SEÇÃO 3: PARÂMETROS DE INTELIGÊNCIA PREDITIVA */}
                    <div style={{ background: '#f8fafc', padding: 20, borderRadius: 14, border: `1px solid ${COR.line}` }}>
                      <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                        📊 Parâmetros de Inteligência Comercial
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: COR.muted, marginBottom: 4 }}>
                            Ciclo Médio de Reposição / Churn (dias)
                          </label>
                          <input
                            type="number"
                            value={formConfig.cicloChurnDias || 21}
                            onChange={e => setFormConfig({ ...formConfig, cicloChurnDias: Number(e.target.value) })}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${COR.line}` }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: COR.muted, marginBottom: 4 }}>
                            Meta de Ticket Médio (R$)
                          </label>
                          <input
                            type="number"
                            value={formConfig.metaTicketMedio || 220}
                            onChange={e => setFormConfig({ ...formConfig, metaTicketMedio: Number(e.target.value) })}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${COR.line}` }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: COR.muted, marginBottom: 4 }}>
                            Meta de Taxa de Cross-Sell (%)
                          </label>
                          <input
                            type="number"
                            value={formConfig.metaCrossSell || 50}
                            onChange={e => setFormConfig({ ...formConfig, metaCrossSell: Number(e.target.value) })}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${COR.line}` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <button
                        type="submit"
                        disabled={salvandoConfig}
                        style={{
                          padding: '12px 24px',
                          background: COR.azul,
                          color: '#fff',
                          border: 0,
                          borderRadius: 10,
                          fontWeight: 800,
                          fontSize: 14,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          boxShadow: '0 4px 10px rgba(37, 99, 235, 0.2)'
                        }}
                      >
                        {salvandoConfig ? '💾 Salvando configurações...' : `💾 Salvar Configurações da ${empresaNome}`}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* MODAL PARA REGISTRO DE CONVERSÃO / DINHEIRO NO CAIXA */}
      {modalConversaoAberto && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 16,
            maxWidth: 480,
            width: '100%',
            padding: 24,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>💵</span>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
                  Registrar Dinheiro no Caixa
                </h3>
              </div>
              <button
                onClick={() => setModalConversaoAberto(false)}
                style={{ background: 'transparent', border: 0, fontSize: 20, cursor: 'pointer', color: COR.muted }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={salvarConversao} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: COR.muted, marginBottom: 4 }}>
                  Nome do Cliente
                </label>
                <input
                  type="text"
                  required
                  value={formConversao.clienteNome}
                  onChange={e => setFormConversao({ ...formConversao, clienteNome: e.target.value })}
                  placeholder="Nome do cliente atendido"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${COR.line}`, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: COR.muted, marginBottom: 4 }}>
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  value={formConversao.telefone}
                  onChange={e => setFormConversao({ ...formConversao, telefone: e.target.value })}
                  placeholder="(65) 99999-9999"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${COR.line}`, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: COR.verdeEscuro, marginBottom: 4 }}>
                  Valor Recebido / Fechado (R$) *
                </label>
                <input
                  type="text"
                  required
                  value={formConversao.valor}
                  onChange={e => setFormConversao({ ...formConversao, valor: e.target.value })}
                  placeholder="ex: 200.00"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${COR.verde}`, fontSize: 16, fontWeight: 800, color: COR.verdeEscuro }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: COR.muted, marginBottom: 4 }}>
                  Tipo de Fechamento
                </label>
                <select
                  value={formConversao.tipo}
                  onChange={e => setFormConversao({ ...formConversao, tipo: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${COR.line}`, fontSize: 13 }}
                >
                  <option value="reativacao">🎯 Reativação de Cliente em Churn</option>
                  <option value="upsell">🛍️ Up-Sell de Combo / Produto</option>
                  <option value="vagas">⚡ Preenchimento de Vaga / Campanha</option>
                  <option value="clube">👑 Assinatura / Clube VIP</option>
                  <option value="avulsa">💵 Venda Balcão / Outro</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: COR.muted, marginBottom: 4 }}>
                  Observações
                </label>
                <input
                  type="text"
                  value={formConversao.observacao}
                  onChange={e => setFormConversao({ ...formConversao, observacao: e.target.value })}
                  placeholder="ex: Pagamento via PIX confirmado"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${COR.line}`, fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalConversaoAberto(false)}
                  style={{ padding: '10px 16px', background: '#f1f5f9', border: 0, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    color: '#fff',
                    border: 0,
                    borderRadius: 8,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
                  }}
                >
                  Confirmar e Creditar no Caixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
