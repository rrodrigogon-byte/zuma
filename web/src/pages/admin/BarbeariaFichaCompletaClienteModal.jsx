import { useEffect, useState } from 'react';
import { api, fmtDateOnly, fmtR } from '../../lib/api';

export default function BarbeariaFichaCompletaClienteModal({
  aberto,
  onClose,
  clienteId,
  telefone = '',
  nome = '',
  onClienteAtualizado,
}) {
  const [tab, setTab] = useState('agendamentos'); // 'agendamentos', 'comandas', 'pacotes', 'creditos', 'produtos', 'cadastro'
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState(null);

  // Estados para formulário de cadastro
  const [formCadastro, setFormCadastro] = useState({});
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);

  // Estados para lançar crédito / dívida
  const [modalMovimento, setModalMovimento] = useState(null); // 'divida' | 'credito' | null
  const [formMovimento, setFormMovimento] = useState({ valor: '', descricao: '', numeroComanda: '' });
  const [salvandoMovimento, setSalvandoMovimento] = useState(false);

  // Busca de dados
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
    }
  }, [aberto, clienteId, telefone, nome]);

  if (!aberto) return null;

  async function salvarCadastro(e) {
    e.preventDefault();
    if (!dados?.cliente?.id) return;
    setSalvandoCadastro(true);
    try {
      const resp = await api.patch(`/api/admin/barbearia/clientes/${dados.cliente.id}`, formCadastro);
      if (resp?.cliente) {
        setDados((prev) => ({
          ...prev,
          cliente: { ...prev.cliente, ...resp.cliente },
        }));
        if (onClienteAtualizado) onClienteAtualizado(resp.cliente);
        alert('Cadastro do cliente atualizado com sucesso!');
      }
    } catch (err) {
      alert(`Erro ao salvar cadastro: ${err.message}`);
    } finally {
      setSalvandoCadastro(false);
    }
  }

  async function salvarMovimentoCredito(e) {
    e.preventDefault();
    if (!dados?.cliente?.id) return;
    const v = Number(String(formMovimento.valor).replace(',', '.'));
    if (!v || v <= 0) {
      alert('Informe um valor válido e positivo.');
      return;
    }
    setSalvandoMovimento(true);
    try {
      const resp = await api.post(`/api/admin/barbearia/clientes/${dados.cliente.id}/movimento-credito`, {
        tipo: modalMovimento,
        valor: v,
        descricao: formMovimento.descricao,
        numeroComanda: formMovimento.numeroComanda,
      });
      if (resp) {
        setDados(resp);
        setModalMovimento(null);
        setFormMovimento({ valor: '', descricao: '', numeroComanda: '' });
        alert(modalMovimento === 'divida' ? 'Dívida registrada com sucesso!' : 'Pagamento/crédito registrado com sucesso!');
      }
    } catch (err) {
      alert(`Erro ao registrar movimentação: ${err.message}`);
    } finally {
      setSalvandoMovimento(false);
    }
  }

  const cli = dados?.cliente || {};
  const agendamentos = dados?.agendamentos || [];
  const comandas = dados?.comandas || [];
  const pacotes = dados?.pacotes || [];
  const creditos = dados?.creditos || { saldoDevedor: 0, creditoDisponivel: 500, limiteCredito: 500, movimentacoes: [] };
  const produtos = dados?.produtos || [];

  const whatsNumber = (cli.telefone || '').replace(/\D/g, '');
  const whatsLink = whatsNumber ? `https://wa.me/55${whatsNumber}` : null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
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
          maxWidth: '1050px',
          maxHeight: '92vh',
          borderRadius: '16px',
          border: '1px solid var(--border, #334155)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out',
        }}
      >
        {/* HEADER DO CLIENTE */}
        <div
          style={{
            padding: '18px 24px',
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
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 800,
                boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)',
              }}
            >
              {(cli.nome || 'C').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>{cli.nome || 'Carregando...'}</h2>
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
                    🔴 Dívida: {fmtR(cli.saldoDevedor)}
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
                    🟢 Em dia
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted, #94a3b8)', marginTop: '4px' }}>
                {cli.email ? `${cli.email} · ` : ''}
                {cli.cidade ? `${cli.cidade}/${cli.estado} · ` : ''}
                Origem: <strong style={{ textTransform: 'uppercase' }}>{cli.origem || 'Kytto'}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={carregarFicha}
              title="Recarregar Ficha"
              style={{
                background: 'transparent',
                border: '1px solid var(--border, #334155)',
                color: 'var(--fg, #f8fafc)',
                padding: '6px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              🔄 Atualizar
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '6px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            padding: '8px 24px 0',
            borderBottom: '1px solid var(--border, #334155)',
            background: 'var(--card, #1e293b)',
            overflowX: 'auto',
          }}
        >
          {[
            { id: 'cadastro', label: 'Cadastro', icone: '📋' },
            { id: 'agendamentos', label: `Agendamentos (${agendamentos.length})`, icone: '📅' },
            { id: 'comandas', label: `Comandas (${comandas.length})`, icone: '🧾' },
            { id: 'pacotes', label: `Pacotes (${pacotes.length})`, icone: '🎁' },
            {
              id: 'creditos',
              label: `Créditos & Dívidas ${cli.saldoDevedor > 0 ? `(${fmtR(cli.saldoDevedor)})` : ''}`,
              icone: '💳',
              destaque: cli.saldoDevedor > 0,
            },
            { id: 'produtos', label: `Produtos (${produtos.length})`, icone: '🛍️' },
          ].map((item) => {
            const ativo = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  background: ativo ? 'var(--surface, #0f172a)' : 'transparent',
                  color: ativo ? (item.destaque ? '#f87171' : 'var(--accent, #38bdf8)') : 'var(--muted, #94a3b8)',
                  border: 'none',
                  borderTopLeftRadius: '8px',
                  borderTopRightRadius: '8px',
                  borderBottom: ativo ? '2px solid var(--accent, #38bdf8)' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: ativo ? 700 : 500,
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

        {/* CONTEÚDO SCROLLÁVEL */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {carregando && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>Carregando dados completos do cliente...</div>}
          {erro && <div style={{ padding: '16px', background: 'rgba(239,68,68,0.15)', color: '#f87171', borderRadius: '8px' }}>{erro}</div>}

          {!carregando && !erro && (
            <>
              {/* ABA 1: CADASTRO */}
              {tab === 'cadastro' && (
                <form onSubmit={salvarCadastro} style={{ display: 'grid', gap: '16px', maxWidth: '850px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Nome Conforme Documento (Obrigatório)
                      </label>
                      <input
                        type="text"
                        value={formCadastro.nome || ''}
                        onChange={(e) => setFormCadastro({ ...formCadastro, nome: e.target.value })}
                        required
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Celular / WhatsApp
                      </label>
                      <input
                        type="text"
                        value={formCadastro.telefone || ''}
                        onChange={(e) => setFormCadastro({ ...formCadastro, telefone: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px' }}
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
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px' }}
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
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px' }}
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
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px' }}
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
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Limite de Crediário Mensal (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formCadastro.limiteCreditoMensal || 500}
                        onChange={(e) => setFormCadastro({ ...formCadastro, limiteCreditoMensal: Number(e.target.value) })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px' }}
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
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Endereço Completo
                    </label>
                    <input
                      type="text"
                      placeholder="Rua, Número, Complemento"
                      value={formCadastro.endereco || ''}
                      onChange={(e) => setFormCadastro({ ...formCadastro, endereco: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Observações Internas
                    </label>
                    <textarea
                      rows={3}
                      value={formCadastro.observacao || ''}
                      onChange={(e) => setFormCadastro({ ...formCadastro, observacao: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)', background: 'var(--surface, #0f172a)', color: 'inherit', fontSize: '13px', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                    <button
                      type="submit"
                      disabled={salvandoCadastro}
                      style={{
                        padding: '10px 24px',
                        borderRadius: '8px',
                        background: '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {salvandoCadastro ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                  </div>
                </form>
              )}

              {/* ABA 2: AGENDAMENTOS */}
              {tab === 'agendamentos' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                      Total de <strong>{agendamentos.length}</strong> agendamento(s) registrados no histórico.
                    </div>
                  </div>

                  {agendamentos.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>Nenhum agendamento encontrado para este cliente.</div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'var(--surface, #0f172a)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '10px 14px' }}>Data/Hora</th>
                            <th style={{ padding: '10px 14px' }}>Serviço</th>
                            <th style={{ padding: '10px 14px' }}>Profissional</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>Valor</th>
                            <th style={{ padding: '10px 14px' }}>Observações</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agendamentos.map((a, idx) => {
                            const isCancelado = String(a.status || '').toLowerCase().includes('cancela');
                            const isPago = String(a.status || '').toLowerCase().includes('pago') || a.status === 'concluido';
                            const isConfirmado = String(a.status || '').toLowerCase().includes('confirma');
                            return (
                              <tr key={a.id || idx} style={{ borderBottom: '1px solid var(--border, #334155)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                  <strong>{fmtDateOnly(a.data)}</strong> <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{a.hora}</span>
                                </td>
                                <td style={{ padding: '10px 14px' }}>{a.servico}</td>
                                <td style={{ padding: '10px 14px', color: '#38bdf8' }}>{a.profissional}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{a.valor ? fmtR(a.valor) : '—'}</td>
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
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ABA 3: COMANDAS */}
              {tab === 'comandas' && (
                <div>
                  <div style={{ marginBottom: '14px', fontSize: '13px', color: 'var(--muted)' }}>
                    Abaixo estão listados os itens das comandas finalizadas pelo cliente.
                  </div>

                  {comandas.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>Nenhuma comanda encontrada para este cliente.</div>
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
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>Valor Unit.</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comandas.map((c, idx) => {
                            const itens = c.itens && c.itens.length > 0 ? c.itens : [{ item: 'Atendimento Comanda', profissional: 'Equipe', quantidade: 1, valor: c.total, total: c.total }];
                            return itens.map((it, itIdx) => (
                              <tr key={`${c.id}-${itIdx}`} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{fmtDateOnly(c.data)}</td>
                                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#38bdf8' }}>{c.numeroComanda ? `Nº ${c.numeroComanda}` : '—'}</td>
                                <td style={{ padding: '10px 14px' }}>{it.item}</td>
                                <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{it.profissional}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'center' }}>{it.quantidade}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'right' }}>{fmtR(it.valor)}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{fmtR(it.total)}</td>
                              </tr>
                            ));
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ABA 4: PACOTES */}
              {tab === 'pacotes' && (
                <div>
                  <div style={{ marginBottom: '14px', fontSize: '13px', color: 'var(--muted)' }}>
                    Abaixo estão listados os serviços adquiridos pelo cliente como pacotes.
                  </div>

                  {pacotes.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>Nenhum pacote ou assinatura ativo encontrado para este cliente.</div>
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
                            <th style={{ padding: '10px 14px', textAlign: 'center' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pacotes.map((p, idx) => (
                            <tr key={p.id || idx} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{fmtDateOnly(p.venda)}</td>
                              <td style={{ padding: '10px 14px', color: '#38bdf8', fontWeight: 700 }}>{p.comanda}</td>
                              <td style={{ padding: '10px 14px' }}>{p.servicosDisponiveis}</td>
                              <td style={{ padding: '10px 14px', fontWeight: 600 }}>{p.pacote}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: p.sessoesRestantes > 0 ? '#34d399' : 'var(--muted)' }}>
                                {p.quantidade}
                              </td>
                              <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{p.validade ? fmtDateOnly(p.validade) : '—'}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    background: p.status === 'ativo' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                    color: p.status === 'ativo' ? '#34d399' : 'var(--muted)',
                                    border: `1px solid ${p.status === 'ativo' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(148, 163, 184, 0.3)'}`,
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ABA 5: CRÉDITOS & DÍVIDAS (CREDIÁRIO / FIADO) */}
              {tab === 'creditos' && (
                <div>
                  <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--muted)' }}>
                    Abaixo estão listados os créditos e dívidas do cliente que foram gerados ao finalizar uma comanda.
                  </div>

                  {/* CARDS IDÊNTICOS E SUPERIORES À FOTO 2 */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '14px',
                      marginBottom: '20px',
                    }}
                  >
                    {/* CARD CRÉDITO DISPONÍVEL */}
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
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Saldo livre para consumir em serviços</span>
                    </div>

                    {/* CARD DÍVIDA EM ABERTO */}
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
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Comandas lançadas na conta pendentes de quitação</span>
                    </div>

                    {/* CARD LIMITE AUTORIZADO */}
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
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Teto mensal aprovado para despesas na conta</span>
                    </div>
                  </div>

                  {/* BOTÕES DE AÇÃO: ADICIONAR DÍVIDA E ADICIONAR CRÉDITO */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setModalMovimento('divida')}
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
                      onClick={() => setModalMovimento('credito')}
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
                  </div>

                  {/* FORMULÁRIO POPUP DE MOVIMENTO */}
                  {modalMovimento && (
                    <form
                      onSubmit={salvarMovimentoCredito}
                      style={{
                        background: 'var(--surface, #0f172a)',
                        border: `1px solid ${modalMovimento === 'divida' ? '#ef4444' : '#38bdf8'}`,
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '20px',
                        display: 'grid',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: modalMovimento === 'divida' ? '#f87171' : '#38bdf8' }}>
                          {modalMovimento === 'divida' ? 'Lançar Nova Dívida / Fiado' : 'Registrar Crédito / Baixa de Dívida'}
                        </strong>
                        <button type="button" onClick={() => setModalMovimento(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                          ✕
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Valor (R$)*</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            placeholder="Ex: 130.00"
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

                  {/* TABELA DE MOVIMENTAÇÕES DE CRÉDITO/DÍVIDA */}
                  {creditos.movimentacoes.length === 0 ? (
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
                          </tr>
                        </thead>
                        <tbody>
                          {creditos.movimentacoes.map((m, idx) => {
                            const isDivida = m.valor < 0 || m.tipo === 'divida';
                            return (
                              <tr key={m.id || idx} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{m.dataHoraComanda ? fmtDateOnly(m.dataHoraComanda) : '—'}</td>
                                <td style={{ padding: '10px 14px', color: '#38bdf8', fontWeight: 700 }}>{m.comanda}</td>
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
                                      background: m.status === 'paga' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                      color: m.status === 'paga' ? '#34d399' : '#f87171',
                                      border: `1px solid ${m.status === 'paga' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    {m.status || 'pendente'}
                                  </span>
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

              {/* ABA 6: PRODUTOS */}
              {tab === 'produtos' && (
                <div>
                  <div style={{ marginBottom: '14px', fontSize: '13px', color: 'var(--muted)' }}>
                    Histórico de produtos e cosméticos adquiridos pelo cliente na barbearia.
                  </div>

                  {produtos.length === 0 ? (
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
                          {produtos.map((pr, idx) => (
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
