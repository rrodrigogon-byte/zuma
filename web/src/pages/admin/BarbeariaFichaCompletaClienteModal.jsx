import { useEffect, useMemo, useState } from 'react';
import { api, fmtDateOnly, fmtR } from '../../lib/api';

export default function BarbeariaFichaCompletaClienteModal({
  aberto,
  onClose,
  clienteId,
  telefone = '',
  nome = '',
  onClienteAtualizado,
}) {
  const [tab, setTab] = useState('cadastro'); // 'cadastro', 'agendamentos', 'comandas', 'pacotes', 'creditos', 'produtos'
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState(null);

  // Estados de Edição do Cadastro
  const [modoEdicao, setModoEdicao] = useState(true);
  const [formCadastro, setFormCadastro] = useState({});
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState('');

  // Estados de Paginação e Busca para as Tabelas
  const [buscaTabela, setBuscaTabela] = useState('');
  const [itensPorPagina, setItensPorPagina] = useState(10);
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Modais de Ação Rápida
  const [modalMovimento, setModalMovimento] = useState(null); // 'divida' | 'credito' | 'editar' | null
  const [formMovimento, setFormMovimento] = useState({ id: null, valor: '', descricao: '', numeroComanda: '', status: 'pendente' });
  const [salvandoMovimento, setSalvandoMovimento] = useState(false);

  const [modalNovoPacote, setModalNovoPacote] = useState(false);
  const [formNovoPacote, setFormNovoPacote] = useState({ pacoteNome: 'Pacote 2 procedimentos', servicosDisponiveis: 'Procedimento Pacote (Corte / Barba)', sessoesTotal: 2, numeroComanda: '' });
  const [salvandoPacote, setSalvandoPacote] = useState(false);
  // Modal de Detalhes da Comanda (O que foi lançado naquela comanda)
  const [comandaDetalhe, setComandaDetalhe] = useState(null);

  // Carregar dados da Ficha 360
  function carregarFicha() {
    if (!clienteId && !telefone && !nome) return;
    setCarregando(true);
    setErro('');
    const params = new URLSearchParams();
    if (telefone) params.set('telefone', telefone);
    if (nome) params.set('nome', nome);
    const ref = clienteId || 'busca';

    api
      .get(`/api/admin/barbearia/clientes/${encodeURIComponent(ref)}/ficha-completa?${params.toString()}`)
      .then((resp) => {
        setDados(resp);
        if (resp?.cliente) {
          setFormCadastro({
            nome: resp.cliente.nome || '',
            telefone: resp.cliente.telefone || '',
            email: resp.cliente.email || '',
            cpf: resp.cliente.cpf || '',
            rg: resp.cliente.rg || '',
            dataNascimento: resp.cliente.dataNascimento || '',
            genero: resp.cliente.genero || 'masculino',
            endereco: resp.cliente.endereco || '',
            bairro: resp.cliente.bairro || '',
            cidade: resp.cliente.cidade || 'Tangará da Serra',
            estado: resp.cliente.estado || 'MT',
            cep: resp.cliente.cep || '',
            limiteCreditoMensal: resp.cliente.limiteCreditoMensal || 500,
            observacao: resp.cliente.observacao || '',
          });
        }
      })
      .catch((err) => {
        setErro(err?.message || 'Erro ao carregar a ficha do cliente.');
      })
      .finally(() => {
        setCarregando(false);
      });
  }

  useEffect(() => {
    if (aberto) {
      carregarFicha();
      setPaginaAtual(1);
      setBuscaTabela('');
    }
  }, [aberto, clienteId, telefone, nome]);

  useEffect(() => {
    setPaginaAtual(1);
    setBuscaTabela('');
  }, [tab]);


  const cli = dados?.cliente || {};
  const agendamentos = dados?.agendamentos || [];
  const comandas = dados?.comandas || [];
  const pacotes = dados?.pacotes || [];
  const creditos = dados?.creditos || { saldoDevedor: 0, creditoDisponivel: 500, limiteCredito: 500, movimentacoes: [] };
  const produtos = dados?.produtos || [];

  const whatsNum = String(cli.telefone || '').replace(/\D/g, '');
  const whatsLink = whatsNum ? `https://wa.me/55${whatsNum}` : null;

  // Abrir o dia da comanda e ver o que foi lançado
  function abrirComandaPorNumero(numeroOuObj, movimentoRef = null) {
    if (!numeroOuObj && !movimentoRef) return;
    const numLimpo = typeof numeroOuObj === 'object' && numeroOuObj?.numeroComanda
      ? String(numeroOuObj.numeroComanda).replace(/\D/g, '')
      : String(numeroOuObj || '').replace(/\D/g, '');

    let encontrada = comandas.find((c) => String(c.numeroComanda).replace(/\D/g, '') === numLimpo);
    if (!encontrada && typeof numeroOuObj === 'object' && numeroOuObj?.itens) {
      encontrada = numeroOuObj;
    }

    if (!encontrada && movimentoRef) {
      encontrada = {
        id: movimentoRef.comandaId || `cmd-${numLimpo || 'divida'}`,
        numeroComanda: numLimpo || (movimentoRef.comanda ? String(movimentoRef.comanda).replace(/\D/g, '') : '—'),
        data: (movimentoRef.dataHoraComanda || movimentoRef.dataRegistro || '').slice(0, 10),
        itens: movimentoRef.itens || [
          { item: movimentoRef.descricao || 'Atendimento em Conta / Fiado', profissional: 'Equipe Dino', quantidade: 1, valor: movimentoRef.valorAbsoluto, total: movimentoRef.valorAbsoluto }
        ],
        total: movimentoRef.valorAbsoluto,
        status: movimentoRef.status === 'paga' ? 'paga' : 'aberta',
        formaPagamento: movimentoRef.status === 'paga' ? 'Quitação no Caixa' : 'Conta do Cliente (Fiado)',
        origem: movimentoRef.origem || 'kytto',
        movimentoOriginal: movimentoRef,
      };
    }

    if (encontrada) {
      setComandaDetalhe({
        ...encontrada,
        movimentoOriginal: movimentoRef || encontrada.movimentoOriginal || null,
      });
    } else {
      alert(`Comanda Nº ${numLimpo || numeroOuObj}: detalhes não localizados no acervo.`);
    }
  }

  // Ações de Cadastro
  async function salvarCadastro(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!cli.id) return;
    setSalvandoCadastro(true);
    setMensagemSucesso('');
    try {
      const resp = await api.patch(`/api/admin/barbearia/clientes/${cli.id}`, formCadastro);
      if (resp?.cliente) {
        setDados((prev) => ({
          ...prev,
          cliente: { ...prev.cliente, ...resp.cliente },
        }));
        if (onClienteAtualizado) onClienteAtualizado(resp.cliente);
        setMensagemSucesso('Dados do cliente salvos com sucesso!');
        setTimeout(() => setMensagemSucesso(''), 4000);
      }
    } catch (err) {
      alert(`Erro ao salvar cadastro: ${err.message}`);
    } finally {
      setSalvandoCadastro(false);
    }
  }

  function cancelarEdicaoCadastro() {
    if (dados?.cliente) {
      setFormCadastro({
        nome: dados.cliente.nome || '',
        telefone: dados.cliente.telefone || '',
        email: dados.cliente.email || '',
        cpf: dados.cliente.cpf || '',
        rg: dados.cliente.rg || '',
        dataNascimento: dados.cliente.dataNascimento || '',
        genero: dados.cliente.genero || 'masculino',
        endereco: dados.cliente.endereco || '',
        bairro: dados.cliente.bairro || '',
        cidade: dados.cliente.cidade || 'Tangará da Serra',
        estado: dados.cliente.estado || 'MT',
        cep: dados.cliente.cep || '',
        limiteCreditoMensal: dados.cliente.limiteCreditoMensal || 500,
        observacao: dados.cliente.observacao || '',
      });
      setMensagemSucesso('Alterações canceladas.');
      setTimeout(() => setMensagemSucesso(''), 3000);
    }
  }

  // Ações de Crediário / Dívida
  async function salvarMovimentoCredito(e) {
    e.preventDefault();
    if (!cli.id) return;
    const v = Number(String(formMovimento.valor).replace(',', '.'));
    if (!v || v <= 0) {
      alert('Informe um valor válido e positivo.');
      return;
    }
    setSalvandoMovimento(true);
    try {
      let resp;
      if (modalMovimento === 'editar' && formMovimento.id) {
        resp = await api.put(`/api/admin/barbearia/clientes/${cli.id}/movimento-credito/${formMovimento.id}`, {
          valor: v,
          descricao: formMovimento.descricao,
          numeroComanda: formMovimento.numeroComanda,
          status: formMovimento.status,
        });
      } else {
        resp = await api.post(`/api/admin/barbearia/clientes/${cli.id}/movimento-credito`, {
          tipo: modalMovimento,
          valor: v,
          descricao: formMovimento.descricao,
          numeroComanda: formMovimento.numeroComanda,
        });
      }
      if (resp) {
        setDados(resp);
        setModalMovimento(null);
        setFormMovimento({ id: null, valor: '', descricao: '', numeroComanda: '', status: 'pendente' });
      }
    } catch (err) {
      alert(`Erro ao registrar movimentação: ${err.message}`);
    } finally {
      setSalvandoMovimento(false);
    }
  }

  async function quitarMovimento(mov) {
    if (!confirm(`Deseja registrar o pagamento e quitar o débito de ${fmtR(mov.valorAbsoluto)} da comanda ${mov.comanda}?`)) return;
    try {
      const resp = await api.post(`/api/admin/barbearia/clientes/${cli.id}/movimento-credito`, {
        tipo: 'credito',
        valor: mov.valorAbsoluto,
        descricao: `Quitação no caixa do débito ${mov.comanda}`,
        numeroComanda: mov.comanda ? String(mov.comanda).replace(/\D/g, '') : '',
      });
      if (resp) setDados(resp);
    } catch (err) {
      alert(`Erro ao quitar débito: ${err.message}`);
    }
  }

  async function excluirMovimento(mov) {
    if (!confirm(`Deseja realmente estornar/excluir este lançamento de ${fmtR(mov.valorAbsoluto)}?`)) return;
    try {
      const resp = await api.delete(`/api/admin/barbearia/clientes/${cli.id}/movimento-credito/${mov.id}`);
      if (resp) setDados(resp);
    } catch (err) {
      alert(`Erro ao estornar lançamento: ${err.message}`);
    }
  }

  // Ações de Pacotes
  async function consumirProcedimentoPacote(pacote) {
    if (!confirm(`Deseja lançar e consumir 1 procedimento do "${pacote.pacote || pacote.servicosDisponiveis}" para o cliente?`)) return;
    try {
      const resp = await api.post(`/api/admin/barbearia/clientes/${cli.id}/pacotes/${pacote.id}/consumir`, {});
      if (resp) {
        setDados(resp);
        alert('Procedimento consumido com sucesso! Saldo de sessões atualizado.');
      }
    } catch (err) {
      alert(`Erro ao consumir procedimento: ${err.message}`);
    }
  }

  async function salvarNovoPacote(e) {
    e.preventDefault();
    setSalvandoPacote(true);
    try {
      const resp = await api.post(`/api/admin/barbearia/clientes/${cli.id}/pacotes`, formNovoPacote);
      if (resp) {
        setDados(resp);
        setModalNovoPacote(false);
        setFormNovoPacote({ pacoteNome: 'Pacote 2 procedimentos', servicosDisponiveis: 'Procedimento Pacote (Corte / Barba)', sessoesTotal: 2, numeroComanda: '' });
        alert('Pacote atribuído ao cliente com sucesso!');
      }
    } catch (err) {
      alert(`Erro ao criar pacote: ${err.message}`);
    } finally {
      setSalvandoPacote(false);
    }
  }

  // Ações de Agendamento
  async function alterarStatusAgendamento(agendamento, novoStatus) {
    if (!confirm(`Deseja alterar o agendamento para "${novoStatus}"?`)) return;
    try {
      const resp = await api.post(`/api/admin/barbearia/clientes/${cli.id}/agendamentos/${agendamento.id}/status`, { status: novoStatus });
      if (resp) setDados(resp);
    } catch (err) {
      alert(`Erro ao atualizar status: ${err.message}`);
    }
  }

  // Exportações (Print, Excel, PDF)
  function exportarTabela(formato) {
    if (formato === 'print' || formato === 'pdf') {
      window.print();
    } else if (formato === 'excel') {
      let csv = '';
      if (tab === 'agendamentos') {
        csv = 'Data;Hora;Servico;Profissional;Valor;Status;Observacao\n';
        agendamentos.forEach((a) => {
          csv += `"${a.data}";"${a.hora}";"${a.servico}";"${a.profissional}";"${a.valor}";"${a.status}";"${a.observacao}"\n`;
        });
      } else if (tab === 'comandas') {
        csv = 'Data;Comanda;Total;Status;FormaPagamento\n';
        comandas.forEach((c) => {
          csv += `"${c.data}";"${c.numeroComanda}";"${c.total}";"${c.status}";"${c.formaPagamento}"\n`;
        });
      } else if (tab === 'pacotes') {
        csv = 'Venda;Comanda;Pacote;Procedimento;Quantidade;Validade;Status\n';
        pacotes.forEach((p) => {
          csv += `"${p.venda}";"${p.comanda}";"${p.pacote}";"${p.servicosDisponiveis}";"${p.quantidade}";"${p.validade}";"${p.status}"\n`;
        });
      } else if (tab === 'creditos') {
        csv = 'DataComanda;Comanda;DataRegistro;Descricao;Valor;Status\n';
        creditos.movimentacoes.forEach((m) => {
          csv += `"${m.dataHoraComanda}";"${m.comanda}";"${m.dataRegistro}";"${m.descricao}";"${m.valor}";"${m.status}"\n`;
        });
      } else if (tab === 'produtos') {
        csv = 'Data;Comanda;Produto;Profissional;Quantidade;ValorUnitario;Total\n';
        produtos.forEach((pr) => {
          csv += `"${pr.data}";"${pr.comanda}";"${pr.produto}";"${pr.profissional}";"${pr.quantidade}";"${pr.valorUnitario}";"${pr.total}"\n`;
        });
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `kytto-${tab}-${cli.nome || 'cliente'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // Filtragem e Paginação da Tabela Ativa
  const listaFiltrada = useMemo(() => {
    let base = [];
    if (tab === 'agendamentos') base = agendamentos;
    else if (tab === 'comandas') base = comandas;
    else if (tab === 'pacotes') base = pacotes;
    else if (tab === 'creditos') base = creditos.movimentacoes;
    else if (tab === 'produtos') base = produtos;

    if (!buscaTabela) return base;
    const q = buscaTabela.toLowerCase().trim();
    return base.filter((item) => JSON.stringify(item).toLowerCase().includes(q));
  }, [tab, agendamentos, comandas, pacotes, creditos.movimentacoes, produtos, buscaTabela]);

  const totalRegistros = listaFiltrada.length;
  const totalPaginas = Math.ceil(totalRegistros / itensPorPagina) || 1;
  const inicioReg = (paginaAtual - 1) * itensPorPagina;
  const fimReg = Math.min(inicioReg + itensPorPagina, totalRegistros);
  const itensPaginados = listaFiltrada.slice(inicioReg, fimReg);
  if (!aberto) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: 'var(--card, #1e293b)',
          color: 'var(--fg, #f8fafc)',
          width: '100%',
          maxWidth: '1100px',
          maxHeight: '94vh',
          borderRadius: '16px',
          border: '1px solid var(--border, #334155)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* HEADER EXECUTIVO DO CLIENTE */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border, #334155)',
            background: 'var(--surface, #0f172a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0284c7, #6366f1)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 800,
                boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)',
              }}
            >
              {(cli.nome || 'C').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 800 }}>{cli.nome || 'Carregando...'}</h2>
                {whatsLink && (
                  <a
                    href={whatsLink}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      background: 'rgba(37, 211, 102, 0.15)',
                      color: '#25D366',
                      border: '1px solid rgba(37, 211, 102, 0.3)',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      fontWeight: 700,
                    }}
                  >
                    💬 {cli.telefone}
                  </a>
                )}
                {cli.saldoDevedor > 0 ? (
                  <span
                    style={{
                      fontSize: '12px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontWeight: 700,
                    }}
                  >
                    🔴 Dívida: - {fmtR(cli.saldoDevedor)}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '12px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontWeight: 700,
                    }}
                  >
                    🟢 Em dia (Crédito: {fmtR(cli.creditoDisponivel || 500)})
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted, #94a3b8)', marginTop: '4px' }}>
                {cli.cpf ? `CPF: ${cli.cpf} · ` : ''}
                {cli.dataNascimento ? `Nascimento: ${cli.dataNascimento} · ` : ''}
                Origem: <strong style={{ textTransform: 'uppercase' }}>{cli.origem || 'Kytto'}</strong>
              </div>
            </div>
          </div>

          {/* BOTÕES DE TOPO DO MODAL */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={carregarFicha}
              title="Recarregar Ficha"
              style={{
                background: 'transparent',
                border: '1px solid var(--border, #334155)',
                color: 'var(--fg, #f8fafc)',
                padding: '6px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              🔄 Atualizar
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              title="Imprimir Ficha Completa"
              style={{
                background: 'transparent',
                border: '1px solid var(--border, #334155)',
                color: 'var(--fg, #f8fafc)',
                padding: '6px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              🖨 Imprimir
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '6px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 800,
              }}
            >
              ✕ Fechar
            </button>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS (6 ABAS INTEGRADAS) */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border, #334155)',
            background: 'rgba(15, 23, 42, 0.6)',
            overflowX: 'auto',
          }}
        >
          {[
            { id: 'cadastro', label: 'Cadastro', icone: '👤' },
            { id: 'agendamentos', label: `Agendamentos (${agendamentos.length})`, icone: '📅' },
            { id: 'comandas', label: `Comandas (${comandas.length})`, icone: '🧾' },
            { id: 'pacotes', label: `Pacotes (${pacotes.length})`, icone: '📦' },
            { id: 'creditos', label: `Créditos & Dívidas`, icone: '💳' },
            { id: 'produtos', label: `Produtos (${produtos.length})`, icone: '🧴' },
          ].map((item) => {
            const ativo = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                style={{
                  padding: '12px 18px',
                  background: ativo ? 'var(--card, #1e293b)' : 'transparent',
                  color: ativo ? '#38bdf8' : 'var(--muted, #94a3b8)',
                  border: 'none',
                  borderBottom: ativo ? '2px solid #38bdf8' : '2px solid transparent',
                  cursor: 'pointer',
                  fontWeight: ativo ? 700 : 500,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{item.icone}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* CONTEÚDO PRINCIPAL DO MODAL */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {carregando && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
              Carregando histórico unificado e movimentações financeiras...
            </div>
          )}

          {erro && (
            <div
              style={{
                padding: '16px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                marginBottom: '16px',
              }}
            >
              {erro}
            </div>
          )}

          {mensagemSucesso && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34d399',
                fontWeight: 700,
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              ✓ {mensagemSucesso}
            </div>
          )}

          {!carregando && !erro && (
            <>
              {/* ========================================================================= */}
              {/* ABA 1: CADASTRO COM EDIÇÃO COMPLETA, SALVAR E CANCELAR                    */}
              {/* ========================================================================= */}
              {tab === 'cadastro' && (
                <form onSubmit={salvarCadastro}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                      Formulário cadastral completo do cliente com atualização em tempo real.
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={cancelarEdicaoCadastro}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: '1px solid var(--border, #334155)',
                          background: 'transparent',
                          color: 'inherit',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={salvandoCadastro}
                        style={{
                          padding: '6px 18px',
                          borderRadius: '6px',
                          background: '#0284c7',
                          color: '#fff',
                          border: 'none',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {salvandoCadastro ? 'Salvando...' : '💾 Salvar'}
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: '16px',
                      background: 'rgba(15, 23, 42, 0.4)',
                      padding: '20px',
                      borderRadius: '12px',
                      border: '1px solid var(--border, #334155)',
                    }}
                  >
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Nome Conforme Documento (Obrigatório)*
                      </label>
                      <input
                        type="text"
                        required
                        value={formCadastro.nome || ''}
                        onChange={(e) => setFormCadastro({ ...formCadastro, nome: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Celular / WhatsApp*
                      </label>
                      <input
                        type="text"
                        required
                        value={formCadastro.telefone || ''}
                        onChange={(e) => setFormCadastro({ ...formCadastro, telefone: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Data de Aniversário / Nascimento
                      </label>
                      <input
                        type="text"
                        placeholder="DD/MM/AAAA ou DD/MM"
                        value={formCadastro.dataNascimento || ''}
                        onChange={(e) => setFormCadastro({ ...formCadastro, dataNascimento: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        CPF
                      </label>
                      <input
                        type="text"
                        value={formCadastro.cpf || ''}
                        onChange={(e) => setFormCadastro({ ...formCadastro, cpf: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        RG
                      </label>
                      <input
                        type="text"
                        value={formCadastro.rg || ''}
                        onChange={(e) => setFormCadastro({ ...formCadastro, rg: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        E-mail
                      </label>
                      <input
                        type="email"
                        value={formCadastro.email || ''}
                        onChange={(e) => setFormCadastro({ ...formCadastro, email: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Limite de Crediário Mensal (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formCadastro.limiteCreditoMensal || 500}
                        onChange={(e) => setFormCadastro({ ...formCadastro, limiteCreditoMensal: Number(e.target.value) })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #38bdf8', background: 'var(--surface, #0f172a)', color: '#38bdf8', fontWeight: 700, fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        CEP
                      </label>
                      <input
                        type="text"
                        value={formCadastro.cep || ''}
                        onChange={(e) => setFormCadastro({ ...formCadastro, cep: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Endereço / Logradouro
                      </label>
                      <input
                        type="text"
                        value={formCadastro.endereco || ''}
                        onChange={(e) => setFormCadastro({ ...formCadastro, endereco: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Bairro
                      </label>
                      <input
                        type="text"
                        value={formCadastro.bairro || ''}
                        onChange={(e) => setFormCadastro({ ...formCadastro, bairro: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Cidade / UF
                      </label>
                      <input
                        type="text"
                        value={`${formCadastro.cidade || 'Tangará da Serra'} / ${formCadastro.estado || 'MT'}`}
                        onChange={(e) => {
                          const [c, uf] = e.target.value.split('/');
                          setFormCadastro({ ...formCadastro, cidade: c?.trim() || '', estado: uf?.trim() || 'MT' });
                        }}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Observações Internas da Barbearia
                      </label>
                      <textarea
                        rows={2}
                        value={formCadastro.observacao || ''}
                        onChange={(e) => setFormCadastro({ ...formCadastro, observacao: e.target.value })}
                        placeholder="Alergias, preferências de corte, bebidas favoritas..."
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  {/* RODAPÉ DO CADASTRO (PADRÃO AVEC COM DATA, AUDITORIA, CANCELAR E SALVAR) */}
                  <div
                    style={{
                      marginTop: '20px',
                      padding: '12px 16px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      borderRadius: '8px',
                      border: '1px solid var(--border, #334155)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)' }}>
                      <span style={{ fontSize: '16px' }}>🖨</span>
                      <span>
                        Data de cadastro: 00:00 · Última modificação: {fmtDateOnly(cli.atualizadoEm || new Date().toISOString())} por <strong>{cli.modificadoPor || 'Ester (Recepção)'}</strong>
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={cancelarEdicaoCadastro}
                        style={{
                          padding: '8px 20px',
                          borderRadius: '6px',
                          border: '1px solid var(--border, #334155)',
                          background: 'transparent',
                          color: 'inherit',
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={salvandoCadastro}
                        style={{
                          padding: '8px 24px',
                          borderRadius: '6px',
                          background: '#1d4ed8',
                          color: '#fff',
                          border: 'none',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 4px 10px rgba(29, 78, 216, 0.4)',
                        }}
                      >
                        {salvandoCadastro ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* ========================================================================= */}
              {/* BARRA DE FERRAMENTAS CLÁSSICA (PRINT, EXCEL, PDF, BUSCA, PAGINAÇÃO)       */}
              {/* ========================================================================= */}
              {tab !== 'cadastro' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                    gap: '12px',
                    flexWrap: 'wrap',
                    background: 'rgba(15, 23, 42, 0.4)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border, #334155)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Mostrar</span>
                    <select
                      value={itensPorPagina}
                      onChange={(e) => {
                        setItensPorPagina(Number(e.target.value));
                        setPaginaAtual(1);
                      }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'inherit',
                        fontSize: '12px',
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>por página</span>

                    {/* BOTÕES DE EXPORTAÇÃO */}
                    <div style={{ display: 'flex', gap: '4px', marginLeft: '12px' }}>
                      <button
                        type="button"
                        onClick={() => exportarTabela('print')}
                        style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit', fontSize: '12px', cursor: 'pointer' }}
                      >
                        🖨 Print
                      </button>
                      <button
                        type="button"
                        onClick={() => exportarTabela('excel')}
                        style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit', fontSize: '12px', cursor: 'pointer' }}
                      >
                        📊 Excel
                      </button>
                      <button
                        type="button"
                        onClick={() => exportarTabela('pdf')}
                        style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit', fontSize: '12px', cursor: 'pointer' }}
                      >
                        📄 PDF
                      </button>
                    </div>
                  </div>

                  {/* CAMPO DE BUSCA INSTANTÂNEA */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Buscar:</span>
                    <input
                      type="text"
                      placeholder="Pesquisar..."
                      value={buscaTabela}
                      onChange={(e) => {
                        setBuscaTabela(e.target.value);
                        setPaginaAtual(1);
                      }}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'inherit',
                        fontSize: '12px',
                        width: '180px',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* ABA 2: AGENDAMENTOS COM BOTÕES DE AÇÃO (CONFIRMAR, CANCELAR, REMARCAR)   */}
              {/* ========================================================================= */}
              {tab === 'agendamentos' && (
                <div>
                  {itensPaginados.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>
                      Nenhum agendamento encontrado para este cliente.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'var(--surface, #0f172a)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '10px 14px' }}>Data/Hora</th>
                            <th style={{ padding: '10px 14px' }}>Serviço</th>
                            <th style={{ padding: '10px 14px' }}>Profissional</th>
                            <th style={{ padding: '10px 14px' }}>Observações</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center' }}>Status</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center' }}>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itensPaginados.map((a, idx) => {
                            const isCancelado = String(a.status || '').toLowerCase().includes('cancel');
                            const isPago = String(a.status || '').toLowerCase().includes('pago') || a.status === 'concluido';
                            const isConfirmado = String(a.status || '').toLowerCase().includes('confirma');

                            return (
                              <tr key={a.id || idx} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                  <strong>{fmtDateOnly(a.data)}</strong> <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{a.hora}</span>
                                </td>
                                <td style={{ padding: '10px 14px' }}>{a.servico}</td>
                                <td style={{ padding: '10px 14px', color: '#38bdf8', fontWeight: 600 }}>{a.profissional}</td>
                                <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: '12px' }}>{a.observacao || '—'}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                  {isCancelado ? (
                                    <span style={{ fontSize: '11px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                      Cancelado
                                    </span>
                                  ) : isPago ? (
                                    <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                      Pago
                                    </span>
                                  ) : isConfirmado ? (
                                    <span style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                      Confirmado
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '11px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                      Agendado
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  <div style={{ display: 'inline-flex', gap: '4px' }}>
                                    {!isConfirmado && !isPago && !isCancelado && (
                                      <button
                                        type="button"
                                        onClick={() => alterarStatusAgendamento(a, 'confirmado')}
                                        title="Confirmar Agendamento"
                                        style={{ padding: '3px 7px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#34d399', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
                                      >
                                        ✓ Confirmar
                                      </button>
                                    )}
                                    {!isCancelado && !isPago && (
                                      <button
                                        type="button"
                                        onClick={() => alterarStatusAgendamento(a, 'cancelado')}
                                        title="Cancelar Agendamento"
                                        style={{ padding: '3px 7px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#f87171', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
                                      >
                                        ✕ Cancelar
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================================= */}
              {/* ABA 3: COMANDAS COM BOTÃO DE DETALHES E CUPOM                             */}
              {/* ========================================================================= */}
              {tab === 'comandas' && (
                <div>
                  {itensPaginados.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>Nenhuma comanda encontrada.</div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'var(--surface, #0f172a)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '10px 14px' }}>Data</th>
                            <th style={{ padding: '10px 14px' }}>Comanda</th>
                            <th style={{ padding: '10px 14px' }}>Item / Procedimento</th>
                            <th style={{ padding: '10px 14px' }}>Profissional</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center' }}>Qtd.</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>Valor</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center' }}>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itensPaginados.map((c, idx) => {
                            const itens = c.itens && c.itens.length > 0 ? c.itens : [{ item: 'Atendimento Comanda', profissional: 'Equipe', quantidade: 1, valor: c.total, total: c.total }];
                            return itens.map((it, itIdx) => (
                              <tr key={`${c.id}-${itIdx}`} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{fmtDateOnly(c.data)}</td>
                                <td style={{ padding: '10px 14px' }}>
                                  <button
                                    type="button"
                                    onClick={() => abrirComandaPorNumero(c)}
                                    style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '13px' }}
                                    title="Clique para ver o que foi lançado na Comanda Nº {c.numeroComanda}"
                                  >
                                    Nº {c.numeroComanda} ↗
                                  </button>
                                </td>
                                <td style={{ padding: '10px 14px' }}>{it.item}</td>
                                <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{it.profissional}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'center' }}>{it.quantidade}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{fmtR(it.total)}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => abrirComandaPorNumero(c)}
                                    style={{ padding: '4px 10px', borderRadius: '5px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', color: '#38bdf8', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
                                    title="Abrir detalhes completos do que foi lançado nesta comanda"
                                  >
                                    🔍 Ver Comanda
                                  </button>
                                </td>
                              </tr>
                            ));
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================================= */}
              {/* ABA 4: PACOTES COM BOTÃO DE USAR PROCEDIMENTO E NOVO PACOTE               */}
              {/* ========================================================================= */}
              {tab === 'pacotes' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                      Serviços e planos adquiridos pelo cliente como pacotes de procedimentos.
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalNovoPacote(true)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        background: '#0284c7',
                        color: '#fff',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      ➕ Novo Pacote
                    </button>
                  </div>

                  {modalNovoPacote && (
                    <form
                      onSubmit={salvarNovoPacote}
                      style={{
                        background: 'var(--surface, #0f172a)',
                        border: '1px solid #38bdf8',
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '16px',
                      }}
                    >
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Atribuir Novo Pacote ao Cliente</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Nome do Pacote</label>
                          <input
                            type="text"
                            required
                            value={formNovoPacote.pacoteNome}
                            onChange={(e) => setFormNovoPacote({ ...formNovoPacote, pacoteNome: e.target.value })}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card)', color: 'inherit' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Procedimento Coberto</label>
                          <input
                            type="text"
                            required
                            value={formNovoPacote.servicosDisponiveis}
                            onChange={(e) => setFormNovoPacote({ ...formNovoPacote, servicosDisponiveis: e.target.value })}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card)', color: 'inherit' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Qtd. de Sessões</label>
                          <input
                            type="number"
                            min={1}
                            value={formNovoPacote.sessoesTotal}
                            onChange={(e) => setFormNovoPacote({ ...formNovoPacote, sessoesTotal: Number(e.target.value) })}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card)', color: 'inherit' }}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setModalNovoPacote(false)}
                          style={{ padding: '6px 12px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'inherit', cursor: 'pointer' }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={salvandoPacote}
                          style={{ padding: '6px 16px', borderRadius: '6px', background: '#0284c7', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                        >
                          {salvandoPacote ? 'Salvando...' : 'Confirmar Pacote'}
                        </button>
                      </div>
                    </form>
                  )}

                  {itensPaginados.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>Nenhum pacote ativo ou histórico de planos.</div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'var(--surface, #0f172a)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '10px 14px' }}>Venda</th>
                            <th style={{ padding: '10px 14px' }}>Comanda</th>
                            <th style={{ padding: '10px 14px' }}>Serviços Disponíveis</th>
                            <th style={{ padding: '10px 14px' }}>Pacote</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center' }}>Quantidade</th>
                            <th style={{ padding: '10px 14px' }}>Validade</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center' }}>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itensPaginados.map((p, idx) => (
                            <tr key={p.id || idx} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{p.venda ? fmtDateOnly(p.venda) : 'Ativo'}</td>
                              <td style={{ padding: '10px 14px' }}>
                                <button
                                  type="button"
                                  onClick={() => abrirComandaPorNumero(p.comanda)}
                                  style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '13px' }}
                                  title="Clique para ver a comanda de aquisição deste pacote"
                                >
                                  {p.comanda} ↗
                                </button>
                              </td>
                              <td style={{ padding: '10px 14px' }}>{p.servicosDisponiveis}</td>
                              <td style={{ padding: '10px 14px', fontWeight: 600 }}>{p.pacote}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>
                                <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', padding: '2px 8px', borderRadius: '4px' }}>
                                  {p.quantidade}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: '12px' }}>{p.validade ? fmtDateOnly(p.validade) : '—'}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => consumirProcedimentoPacote(p)}
                                  title="Baixar 1 procedimento realizado"
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    background: '#16a34a',
                                    color: '#fff',
                                    border: 'none',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  ✂ Usar Procedimento
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================================= */}
              {/* ABA 5: CRÉDITOS & DÍVIDAS COM CARDS E BOTÕES DE AÇÃO                     */}
              {/* ========================================================================= */}
              {tab === 'creditos' && (
                <div>
                  <div style={{ marginBottom: '14px', fontSize: '13px', color: 'var(--muted)' }}>
                    Abaixo estão listados os créditos e dívidas do cliente que foram gerados ao finalizar uma comanda.
                  </div>

                  {/* 3 CARDS EXECUTIVOS */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: '16px',
                      marginBottom: '20px',
                    }}
                  >
                    <div
                      style={{
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        borderRadius: '12px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>Crédito Disponível</span>
                      <strong style={{ fontSize: '24px', color: '#10b981', fontWeight: 800 }}>{fmtR(creditos.creditoDisponivel)}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Saldo livre para consumir em novos serviços</span>
                    </div>

                    <div
                      style={{
                        background: creditos.saldoDevedor > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(148, 163, 184, 0.05)',
                        border: `1px solid ${creditos.saldoDevedor > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(148, 163, 184, 0.2)'}`,
                        borderRadius: '12px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <span style={{ fontSize: '12px', color: creditos.saldoDevedor > 0 ? '#f87171' : 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                        Dívida em Aberto (Fiado)
                      </span>
                      <strong style={{ fontSize: '24px', color: creditos.saldoDevedor > 0 ? '#f87171' : 'var(--muted)', fontWeight: 800 }}>
                        {creditos.saldoDevedor > 0 ? `- ${fmtR(creditos.saldoDevedor)}` : 'R$ 0,00'}
                      </strong>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Comandas fechadas na conta pendentes de pagamento</span>
                    </div>

                    <div
                      style={{
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        borderRadius: '12px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase' }}>Limite de Crediário</span>
                      <strong style={{ fontSize: '24px', color: '#60a5fa', fontWeight: 800 }}>{fmtR(creditos.limiteCredito)}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Teto seguro aprovado (Saldo livre: {fmtR(Math.max(0, creditos.limiteCredito - creditos.saldoDevedor))})</span>
                    </div>
                  </div>

                  {/* BOTÕES DE AÇÃO RÁPIDA */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setFormMovimento({ id: null, valor: '', descricao: '', numeroComanda: '', status: 'pendente' });
                        setModalMovimento('divida');
                      }}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        background: '#1e3a8a',
                        color: '#93c5fd',
                        border: '1px solid #3b82f6',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      ⬇ Adicionar Dívida
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormMovimento({ id: null, valor: '', descricao: '', numeroComanda: '', status: 'paga' });
                        setModalMovimento('credito');
                      }}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        background: '#0284c7',
                        color: '#bae6fd',
                        border: '1px solid #38bdf8',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      ⬆ Adicionar Crédito / Quitação
                    </button>
                    {whatsLink && (
                      <a
                        href={`https://wa.me/55${whatsNum}?text=${encodeURIComponent(`Olá ${cli.nome}, tudo bem? Passando para compartilhar o extrato da sua conta na Barbearia Dino. Saldo devedor atual: ${fmtR(creditos.saldoDevedor)}. Gostaria que enviássemos a chave PIX para acerto? Obrigado!`)}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: '10px 16px',
                          borderRadius: '8px',
                          background: 'rgba(37, 211, 102, 0.15)',
                          color: '#25D366',
                          border: '1px solid rgba(37, 211, 102, 0.3)',
                          fontSize: '13px',
                          fontWeight: 700,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        💬 Notificar Cobrança no WhatsApp
                      </a>
                    )}
                  </div>

                  {/* POPUP DE LANÇAMENTO / EDIÇÃO */}
                  {modalMovimento && (
                    <form
                      onSubmit={salvarMovimentoCredito}
                      style={{
                        background: 'var(--surface, #0f172a)',
                        border: `1px solid ${modalMovimento === 'divida' ? '#ef4444' : '#38bdf8'}`,
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '16px',
                      }}
                    >
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: modalMovimento === 'divida' ? '#f87171' : '#38bdf8' }}>
                        {modalMovimento === 'divida'
                          ? 'Registrar Nova Dívida em Conta (Fiado)'
                          : modalMovimento === 'editar'
                          ? 'Editar Lançamento Financeiro'
                          : 'Registrar Pagamento / Quitação de Dívida'}
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Valor (R$)*</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            placeholder="0,00"
                            value={formMovimento.valor}
                            onChange={(e) => setFormMovimento({ ...formMovimento, valor: e.target.value })}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card)', color: 'inherit' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Nº da Comanda (opcional)</label>
                          <input
                            type="text"
                            placeholder="Ex: 351"
                            value={formMovimento.numeroComanda}
                            onChange={(e) => setFormMovimento({ ...formMovimento, numeroComanda: e.target.value })}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card)', color: 'inherit' }}
                          />
                        </div>

                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Descrição*</label>
                          <input
                            type="text"
                            required
                            placeholder={modalMovimento === 'divida' ? 'Ex: Dívida da comanda Nº 351' : 'Ex: Pagamento parcial da dívida comanda Nº 351'}
                            value={formMovimento.descricao}
                            onChange={(e) => setFormMovimento({ ...formMovimento, descricao: e.target.value })}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card)', color: 'inherit' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setModalMovimento(null)}
                          style={{ padding: '8px 16px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'inherit', cursor: 'pointer' }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={salvandoMovimento}
                          style={{
                            padding: '8px 18px',
                            borderRadius: '6px',
                            background: modalMovimento === 'divida' ? '#ef4444' : '#10b981',
                            color: '#fff',
                            border: 'none',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {salvandoMovimento ? 'Gravando...' : 'Confirmar Lançamento'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* TABELA DE EXTRATO COM AÇÕES POR LINHA */}
                  {itensPaginados.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>Nenhum histórico de movimentação para este cliente.</div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'var(--surface, #0f172a)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '10px 14px' }}>Data/Hora da Comanda</th>
                            <th style={{ padding: '10px 14px' }}>Comanda</th>
                            <th style={{ padding: '10px 14px' }}>Data/Hora do Registro</th>
                            <th style={{ padding: '10px 14px' }}>Descrição</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>Valor</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center' }}>Status</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center' }}>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itensPaginados.map((m, idx) => {
                            const isDivida = m.valor < 0 || m.tipo === 'divida';
                            const isPaga = m.status === 'paga';

                            return (
                              <tr key={m.id || idx} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{m.dataHoraComanda ? fmtDateOnly(m.dataHoraComanda) : '—'}</td>
                                <td style={{ padding: '10px 14px' }}>
                                  <button
                                    type="button"
                                    onClick={() => abrirComandaPorNumero(m.comanda, m)}
                                    style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '13px' }}
                                    title="Clique para abrir o dia da comanda e ver o que foi lançado"
                                  >
                                    {m.comanda} ↗
                                  </button>
                                </td>
                                <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{m.dataRegistro ? fmtDateOnly(m.dataRegistro) : '—'}</td>
                                <td style={{ padding: '10px 14px' }}>{m.descricao}</td>
                                <td
                                  style={{
                                    padding: '10px 14px',
                                    textAlign: 'right',
                                    fontWeight: 800,
                                    color: isDivida ? '#f87171' : '#34d399',
                                  }}
                                >
                                  {isDivida ? `- ${fmtR(m.valorAbsoluto)}` : `+ ${fmtR(m.valorAbsoluto)}`}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      background: isPaga ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                      color: isPaga ? '#34d399' : '#f87171',
                                      border: `1px solid ${isPaga ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    {m.status || 'pendente'}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  <div style={{ display: 'inline-flex', gap: '4px' }}>
                                    <button
                                      type="button"
                                      onClick={() => abrirComandaPorNumero(m.comanda, m)}
                                      title="Abrir o dia da comanda e ver o que foi lançado"
                                      style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', color: '#38bdf8', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
                                    >
                                      📄 Ver Comanda
                                    </button>
                                    {!isPaga && (
                                      <button
                                        type="button"
                                        onClick={() => quitarMovimento(m)}
                                        title="Registrar Quitação da Comanda"
                                        style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#34d399', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
                                      >
                                        ✓ Quitar
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFormMovimento({
                                          id: m.id,
                                          valor: String(m.valorAbsoluto),
                                          descricao: m.descricao,
                                          numeroComanda: m.comanda ? String(m.comanda).replace(/\D/g, '') : '',
                                          status: m.status,
                                        });
                                        setModalMovimento('editar');
                                      }}
                                      title="Editar Lançamento"
                                      style={{ padding: '3px 7px', borderRadius: '4px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'inherit', fontSize: '11px', cursor: 'pointer' }}
                                    >
                                      ✏
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => excluirMovimento(m)}
                                      title="Estornar Lançamento"
                                      style={{ padding: '3px 7px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '11px', cursor: 'pointer' }}
                                    >
                                      🗑
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================================= */}
              {/* ABA 6: PRODUTOS DE REVENDA E BEBIDAS                                      */}
              {/* ========================================================================= */}
              {tab === 'produtos' && (
                <div>
                  <div style={{ marginBottom: '14px', fontSize: '13px', color: 'var(--muted)' }}>
                    Histórico de cosméticos, pomadas e bebidas adquiridas pelo cliente na barbearia.
                  </div>

                  {itensPaginados.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>Nenhum produto registrado no histórico deste cliente.</div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'var(--surface, #0f172a)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '10px 14px' }}>Data</th>
                            <th style={{ padding: '10px 14px' }}>Comanda</th>
                            <th style={{ padding: '10px 14px' }}>Produto</th>
                            <th style={{ padding: '10px 14px' }}>Vendedor / Profissional</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center' }}>Qtd.</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>Valor Unit.</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itensPaginados.map((pr, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{fmtDateOnly(pr.data)}</td>
                              <td style={{ padding: '10px 14px', color: '#38bdf8', fontWeight: 700 }}>{pr.comanda}</td>
                              <td style={{ padding: '10px 14px', fontWeight: 600 }}>{pr.produto}</td>
                              <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{pr.profissional}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>{pr.quantidade}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'right' }}>{fmtR(pr.valorUnitario)}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{fmtR(pr.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================================= */}
              {/* RODAPÉ DE PAGINAÇÃO DAS TABELAS (AVEC CLASSIC)                            */}
              {/* ========================================================================= */}
              {tab !== 'cadastro' && totalRegistros > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '16px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    color: 'var(--muted)',
                    borderTop: '1px solid var(--border, #334155)',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div>
                    Mostrando {totalRegistros === 0 ? 0 : inicioReg + 1} a {fimReg} de {totalRegistros} Registros
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      disabled={paginaAtual <= 1}
                      onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'inherit',
                        cursor: paginaAtual <= 1 ? 'not-allowed' : 'pointer',
                        opacity: paginaAtual <= 1 ? 0.5 : 1,
                      }}
                    >
                      ← Anterior
                    </button>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        background: '#0284c7',
                        color: '#fff',
                        fontWeight: 700,
                      }}
                    >
                      {paginaAtual}
                    </span>
                    <button
                      type="button"
                      disabled={paginaAtual >= totalPaginas}
                      onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'inherit',
                        cursor: paginaAtual >= totalPaginas ? 'not-allowed' : 'pointer',
                        opacity: paginaAtual >= totalPaginas ? 0.5 : 1,
                      }}
                    >
                      Próximo →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MODAL DETALHES DA COMANDA (O QUE FOI LANÇADO NA COMANDA) */}
      {comandaDetalhe && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(6px)',
            zIndex: 100020,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              background: '#0f172a',
              border: '1px solid #38bdf8',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
            }}
          >
            {/* Header do Modal de Comanda */}
            <div
              style={{
                padding: '16px 20px',
                background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>📄</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#38bdf8' }}>
                    Comanda Nº {comandaDetalhe.numeroComanda}
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    Atendimento realizado em {fmtDateOnly(comandaDetalhe.data)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setComandaDetalhe(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--muted)',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Corpo dos Detalhes da Comanda */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Badges e Informações da Comanda */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                }}
              >
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)' }}>Cliente</span>
                  <strong style={{ fontSize: '13px' }}>{cli.nome}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)' }}>Profissional</span>
                  <strong style={{ fontSize: '13px', color: '#60a5fa' }}>
                    {comandaDetalhe.itens?.[0]?.profissional || 'Equipe Dino'}
                  </strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)' }}>Forma de Fechamento</span>
                  <strong style={{ fontSize: '13px' }}>{comandaDetalhe.formaPagamento || 'Conta do Cliente (Fiado)'}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)' }}>Situação</span>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      marginTop: '2px',
                      background: comandaDetalhe.status === 'paga' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: comandaDetalhe.status === 'paga' ? '#34d399' : '#f87171',
                      border: `1px solid ${comandaDetalhe.status === 'paga' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    }}
                  >
                    {comandaDetalhe.status === 'paga' ? '🟢 Paga / Quitada' : '🔴 Dívida em Aberto (Fiado)'}
                  </span>
                </div>
              </div>

              {/* Tabela de Procedimentos e Produtos Lançados */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Itens e Procedimentos Lançados nesta Comanda:
                </h4>
                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#1e293b', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '8px 12px' }}>Procedimento / Produto</th>
                        <th style={{ padding: '8px 12px' }}>Barbeiro</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qtd</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Valor Unit.</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(comandaDetalhe.itens || []).map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{it.item}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{it.profissional || 'Equipe'}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>{it.quantidade || 1}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmtR(it.valor || it.total)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>{fmtR(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'rgba(56, 189, 248, 0.08)', fontWeight: 800 }}>
                        <td colSpan={4} style={{ padding: '12px', textAlign: 'right', fontSize: '14px' }}>
                          Total Geral da Comanda:
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: '16px', color: '#38bdf8' }}>
                          {fmtR(comandaDetalhe.total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Bloco de Ação se for Comanda com Dívida em Aberto */}
              {comandaDetalhe.status !== 'paga' && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div>
                    <strong style={{ color: '#f87171', display: 'block', fontSize: '13px' }}>
                      ⚠️ Dívida Pendente: {fmtR(comandaDetalhe.total)}
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Esta comanda foi fechada na conta do cliente (fiado) e ainda não foi quitada.
                    </span>
                  </div>
                  {comandaDetalhe.movimentoOriginal && (
                    <button
                      type="button"
                      onClick={async () => {
                        await quitarMovimento(comandaDetalhe.movimentoOriginal);
                        setComandaDetalhe({
                          ...comandaDetalhe,
                          status: 'paga',
                          formaPagamento: 'Quitação no Caixa',
                        });
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        background: '#10b981',
                        color: '#fff',
                        border: 'none',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      ✓ Quitar esta Comanda agora no Caixa
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Rodapé do Modal de Comanda */}
            <div
              style={{
                padding: '12px 20px',
                background: '#1e293b',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'inherit',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                🖨 Imprimir Comprovante
              </button>
              <button
                type="button"
                onClick={() => setComandaDetalhe(null)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

