import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { 
  Zap, Calendar, Clock, Gift, Star, AlertTriangle, 
  PieChart, Users, Cpu, Play, CheckCircle2, RefreshCw,
  Search, ShieldCheck, ArrowRight, MessageSquare, DollarSign
} from 'lucide-react';

export default function Automacoes() {
  const { authFetch, empresaAtiva, isPlatformAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [executando, setExecutando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('central');
  const [dados, setDados] = useState({ automacoes: [], metricasEventos: {} });
  const [eventos, setEventos] = useState([]);
  const [planosPrevia, setPlanosPrevia] = useState([]);
  const [resumoDia, setResumoDia] = useState(null);
  const [sucessoMsg, setSucessoMsg] = useState('');
  const [erroMsg, setErroMsg] = useState('');

  const carregarDados = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/admin/automacoes/status');
      if (res.ok) {
        const json = await res.json();
        setDados(json);
      }
    } catch (err) {
      console.error('Erro ao carregar automações:', err);
    } finally {
      setLoading(false);
    }
  };

  const carregarEventos = async () => {
    try {
      const res = await authFetch('/api/admin/automacoes/eventos?limite=30');
      if (res.ok) {
        const json = await res.json();
        setEventos(json.eventos || []);
      }
    } catch (err) {
      console.error('Erro ao carregar eventos:', err);
    }
  };

  const carregarPlanosPrevia = async () => {
    try {
      const res = await authFetch('/api/admin/automacoes/planos/previa');
      if (res.ok) {
        const json = await res.json();
        setPlanosPrevia(json.pendencias || []);
      }
    } catch (err) {
      console.error('Erro ao carregar prévia de planos:', err);
    }
  };

  const carregarResumoDia = async () => {
    try {
      const res = await authFetch('/api/admin/automacoes/resumo-dia');
      if (res.ok) {
        const json = await res.json();
        setResumoDia(json);
      }
    } catch (err) {
      console.error('Erro ao carregar resumo do dia:', err);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [empresaAtiva]);

  useEffect(() => {
    if (abaAtiva === 'eventos') carregarEventos();
    if (abaAtiva === 'planos') carregarPlanosPrevia();
    if (abaAtiva === 'resumo') carregarResumoDia();
  }, [abaAtiva]);

  const alternarAutomacao = async (id, estadoAtual) => {
    try {
      const res = await authFetch(`/api/admin/automacoes/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !estadoAtual })
      });
      if (res.ok) {
        setDados(prev => ({
          ...prev,
          automacoes: prev.automacoes.map(a => a.id === id ? { ...a, ativo: !estadoAtual } : a)
        }));
        setSucessoMsg(`Automação ${!estadoAtual ? 'ativada' : 'pausada'} com sucesso.`);
        setTimeout(() => setSucessoMsg(''), 4000);
      }
    } catch (err) {
      setErroMsg('Não foi possível alterar a automação.');
      setTimeout(() => setErroMsg(''), 4000);
    }
  };

  const executarAgora = async (id, dispararReal = false) => {
    try {
      setExecutando(true);
      const res = await authFetch(`/api/admin/automacoes/${id}/executar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disparar: dispararReal })
      });
      if (res.ok) {
        setSucessoMsg(`Execução disparada com sucesso! Evento registrado no barramento.`);
        setTimeout(() => setSucessoMsg(''), 4000);
        carregarDados();
      }
    } catch (err) {
      setErroMsg('Erro ao executar automação.');
      setTimeout(() => setErroMsg(''), 4000);
    } finally {
      setExecutando(false);
    }
  };

  const getIcone = (iconeNome) => {
    switch (iconeNome) {
      case 'calendar-check': return <Calendar className="w-5 h-5 text-amber-500" />;
      case 'clock': return <Clock className="w-5 h-5 text-blue-500" />;
      case 'gift': return <Gift className="w-5 h-5 text-pink-500" />;
      case 'star': return <Star className="w-5 h-5 text-yellow-500" />;
      case 'package-alert': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'chart-pie': return <PieChart className="w-5 h-5 text-emerald-500" />;
      case 'user-check': return <Users className="w-5 h-5 text-indigo-500" />;
      case 'cpu': return <Cpu className="w-5 h-5 text-cyan-500" />;
      default: return <Zap className="w-5 h-5 text-amber-500" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-6 text-white shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Automações & Processos Corporativos</h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Barramento de eventos internos desacoplado, réguas de relacionamento e inteligência operacional.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-800/80 px-3.5 py-2 rounded-lg border border-slate-700 text-xs">
            <span className="text-slate-400">Barramento:</span> <strong className="text-emerald-400">Ativo (100% Sincronizado)</strong>
          </div>
          <button
            onClick={() => carregarDados()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {sucessoMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {sucessoMsg}
        </div>
      )}

      {erroMsg && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {erroMsg}
        </div>
      )}

      {/* Navegação por Abas */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setAbaAtiva('central')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            abaAtiva === 'central'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Central de Automações ({dados.automacoes?.length || 8})
        </button>
        <button
          onClick={() => setAbaAtiva('planos')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            abaAtiva === 'planos'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Vencimento de Planos & PIX
        </button>
        <button
          onClick={() => setAbaAtiva('resumo')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            abaAtiva === 'resumo'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Briefing Noturno da Gestão
        </button>
        <button
          onClick={() => setAbaAtiva('eventos')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            abaAtiva === 'eventos'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Monitor de Eventos Internos (Live)
        </button>
      </div>

      {/* Conteúdo da Aba Central de Automações */}
      {abaAtiva === 'central' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dados.automacoes?.map((auto) => (
            <div
              key={auto.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 transition rounded-xl p-5 flex flex-col justify-between shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-800 rounded-lg">
                      {getIcone(auto.icone)}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">{auto.nome}</h3>
                      <span className="text-xs text-slate-400">{auto.intervalo}</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={auto.ativo}
                      onChange={() => alternarAutomacao(auto.id, auto.ativo)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>
                <p className="text-sm text-slate-300 mt-3 leading-relaxed">
                  {auto.descricao}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    auto.ativo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {auto.ativo ? '● Ativa' : '○ Pausada'}
                  </span>
                  <span className="text-xs text-slate-400">
                    Hoje: <strong>{auto.totalExecucoesHoje} execuções</strong>
                  </span>
                </div>
                <button
                  onClick={() => executarAgora(auto.id)}
                  disabled={executando}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 rounded border border-slate-700 transition"
                >
                  <Play className="w-3.5 h-3.5" />
                  Testar Agora
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Conteúdo da Aba Vencimento de Planos */}
      {abaAtiva === 'planos' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-base font-semibold text-white mb-2">Régua de Vencimento de Planos & Mensalidades</h3>
            <p className="text-sm text-slate-400 mb-4">
              O T-Rex varre os clientes com plano e envia mensagens afetuosas, lembrando do agendamento e informando a chave PIX e o link de pagamento.
            </p>
            {planosPrevia.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                Nenhum plano com vencimento imediato para os próximos 3 dias nesta unidade.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-800/60 text-xs text-slate-400 uppercase">
                    <tr>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">Telefone</th>
                      <th className="p-3">Plano</th>
                      <th className="p-3">Valor</th>
                      <th className="p-3">Vencimento</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {planosPrevia.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-3 font-medium text-white">{item.clienteNome}</td>
                        <td className="p-3 text-slate-400">{item.clienteTelefone}</td>
                        <td className="p-3">{item.planoNome}</td>
                        <td className="p-3 font-semibold text-emerald-400">{item.valorFormatado}</td>
                        <td className="p-3">{item.pagoAte}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            item.situacao === 'vence_hoje' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                          }`}>
                            {item.situacao}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conteúdo da Aba Briefing Noturno */}
      {abaAtiva === 'resumo' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">Prévia do Briefing Noturno (WhatsApp de Gestão)</h3>
            <button
              onClick={() => executarAgora('briefing_fechamento_gestao', false)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition"
            >
              Disparar Briefing Agora
            </button>
          </div>
          {resumoDia?.mensagemFormatada ? (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
              {resumoDia.mensagemFormatada}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Carregando dados consolidados do dia...</p>
          )}
        </div>
      )}

      {/* Conteúdo da Aba Monitor de Eventos Internos */}
      {abaAtiva === 'eventos' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Log de Eventos Internos do ERP Kytto</h3>
              <p className="text-xs text-slate-400">Histórico de transações desacopladas sincronizadas por evento interno.</p>
            </div>
            <button
              onClick={carregarEventos}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded border border-slate-700"
            >
              Atualizar Log
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-xs text-slate-400 uppercase">
                <tr>
                  <th className="p-3">Horário</th>
                  <th className="p-3">Tipo do Evento</th>
                  <th className="p-3">Origem</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Tempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono text-xs">
                {eventos.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-800/40">
                    <td className="p-3 text-slate-400">{new Date(evt.timestamp).toLocaleTimeString('pt-BR')}</td>
                    <td className="p-3 font-semibold text-amber-400">{evt.tipo}</td>
                    <td className="p-3 text-slate-300">{evt.origem}</td>
                    <td className="p-3 text-emerald-400">● {evt.status}</td>
                    <td className="p-3 text-slate-400">{evt.duracaoMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
