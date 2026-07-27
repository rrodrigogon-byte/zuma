import React, { useState } from 'react';

const STATUS_CORES = {
  pago: 'bg-green-100 text-green-700',
  pendente: 'bg-yellow-100 text-yellow-700',
  vencido: 'bg-red-100 text-red-700',
  cancelado: 'bg-gray-100 text-gray-500',
};

const mockCliente = {
  nome: 'João da Silva',
  cpf: '123.456.789-00',
  email: 'joao@email.com',
  telefone: '(65) 99999-0000',
  pontos: 1250,
  nivel: 'Ouro',
  saldo_credito: 150.00,
};

const mockParcelas = [
  { id: 1, descricao: 'Compra 15/06/2026 — Calça Jeans + Camiseta', vencimento: '2026-07-15', valor: 185.00, status: 'pago', parcela: '1/3' },
  { id: 2, descricao: 'Compra 15/06/2026 — Calça Jeans + Camiseta', vencimento: '2026-08-15', valor: 185.00, status: 'pendente', parcela: '2/3' },
  { id: 3, descricao: 'Compra 15/06/2026 — Calça Jeans + Camiseta', vencimento: '2026-09-15', valor: 185.00, status: 'pendente', parcela: '3/3' },
  { id: 4, descricao: 'Compra 20/05/2026 — Tênis Esportivo', vencimento: '2026-06-20', valor: 220.00, status: 'vencido', parcela: '2/2' },
];

const mockAgendamentos = [
  { id: 1, servico: 'Corte + Barba', profissional: 'Carlos', data: '2026-07-28', hora: '14:00', status: 'confirmado', valor: 65 },
  { id: 2, servico: 'Hidratação', profissional: 'Ana', data: '2026-08-05', hora: '10:30', status: 'pendente', valor: 80 },
];

const mockHistorico = [
  { id: 1, data: '2026-07-20', descricao: 'Compra PDV — 3 itens', valor: 555.00, tipo: 'compra', nf: 'NFC-e 000123' },
  { id: 2, data: '2026-07-15', descricao: 'Pagamento parcela 1/3', valor: -185.00, tipo: 'pagamento', nf: null },
  { id: 3, data: '2026-07-10', descricao: 'Serviço — Corte + Barba', valor: 65.00, tipo: 'servico', nf: 'NFS-e 000045' },
  { id: 4, data: '2026-06-28', descricao: 'Compra PDV — 2 itens', valor: 440.00, tipo: 'compra', nf: 'NFC-e 000098' },
];

export default function PortalCliente() {
  const [aba, setAba] = useState('inicio');
  const [logado, setLogado] = useState(false);
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');

  if (!logado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl font-bold">S</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Portal do Cliente</h1>
            <p className="text-gray-500 text-sm mt-1">Acesse seu extrato, parcelas e agendamentos</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
              <input type="text" value={cpf} onChange={e => setCpf(e.target.value)}
                placeholder="000.000.000-00"
                className="w-full border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha / Data de Nascimento</label>
              <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <button onClick={() => setLogado(true)}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
              Entrar
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">Primeiro acesso? Use sua data de nascimento como senha.</p>
            <button className="text-indigo-600 text-sm mt-2 hover:underline">Esqueci minha senha</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-indigo-600 text-white px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold">
              {mockCliente.nome[0]}
            </div>
            <div>
              <p className="font-semibold text-sm">{mockCliente.nome}</p>
              <p className="text-indigo-200 text-xs">⭐ {mockCliente.nivel} · {mockCliente.pontos} pontos</p>
            </div>
          </div>
          <button onClick={() => setLogado(false)} className="text-indigo-200 text-sm hover:text-white">Sair</button>
        </div>
      </div>

      {/* Saldo Crediário */}
      {mockCliente.saldo_credito > 0 && (
        <div className="bg-red-500 text-white px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">⚠️ Parcela vencida em aberto</p>
              <p className="text-xs text-red-100">Regularize para continuar comprando no crediário</p>
            </div>
            <button className="bg-white text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold">
              Pagar Agora
            </button>
          </div>
        </div>
      )}

      {/* Navegação */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex">
          {[
            { id: 'inicio', label: '🏠 Início' },
            { id: 'crediario', label: '💳 Crediário' },
            { id: 'agendamentos', label: '📅 Agenda' },
            { id: 'historico', label: '📋 Histórico' },
          ].map(a => (
            <button key={a.id} onClick={() => setAba(a.id)}
              className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors ${aba === a.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">

        {/* INÍCIO */}
        {aba === 'inicio' && (
          <div className="space-y-4">
            {/* Cards de resumo */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-gray-500">Parcelas em Aberto</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">R$ 370,00</p>
                <p className="text-xs text-gray-400 mt-1">2 parcelas</p>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-gray-500">Próximo Agendamento</p>
                <p className="text-lg font-bold text-indigo-600 mt-1">28/07 14h</p>
                <p className="text-xs text-gray-400 mt-1">Corte + Barba</p>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-gray-500">Pontos Acumulados</p>
                <p className="text-2xl font-bold text-green-600 mt-1">1.250 pts</p>
                <p className="text-xs text-gray-400 mt-1">Nível {mockCliente.nivel}</p>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-gray-500">Total Comprado (2026)</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">R$ 1.060</p>
                <p className="text-xs text-gray-400 mt-1">4 compras</p>
              </div>
            </div>

            {/* Ações rápidas */}
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Ações Rápidas</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: '💳', label: 'Pagar Parcela', action: () => setAba('crediario') },
                  { icon: '📅', label: 'Agendar', action: () => setAba('agendamentos') },
                  { icon: '📄', label: 'Notas Fiscais', action: () => setAba('historico') },
                ].map((a, i) => (
                  <button key={i} onClick={a.action}
                    className="flex flex-col items-center gap-1 p-3 bg-gray-50 rounded-xl hover:bg-indigo-50 transition-colors">
                    <span className="text-2xl">{a.icon}</span>
                    <span className="text-xs text-gray-600 text-center">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Últimas movimentações */}
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Últimas Movimentações</h3>
              {mockHistorico.slice(0,3).map((h, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{h.descricao}</p>
                    <p className="text-xs text-gray-400">{new Date(h.data).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className={`text-sm font-bold ${h.tipo === 'pagamento' ? 'text-green-600' : 'text-gray-900'}`}>
                    {h.tipo === 'pagamento' ? '-' : '+'} R$ {Math.abs(h.valor).toLocaleString('pt-BR', {minimumFractionDigits:2})}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CREDIÁRIO */}
        {aba === 'crediario' && (
          <div className="space-y-3">
            <div className="bg-white rounded-xl border p-4 flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Total em Aberto</p>
                <p className="text-2xl font-bold text-gray-900">R$ 590,00</p>
              </div>
              <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium">
                Pagar Tudo
              </button>
            </div>
            {mockParcelas.map((p, i) => (
              <div key={i} className="bg-white rounded-xl border p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{p.descricao}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Parcela {p.parcela} · Vence {new Date(p.vencimento).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ml-2 ${STATUS_CORES[p.status]}`}>
                    {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-lg font-bold text-gray-900">R$ {p.valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
                  {p.status !== 'pago' && p.status !== 'cancelado' && (
                    <div className="flex gap-2">
                      <button className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50">
                        PIX
                      </button>
                      <button className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700">
                        Pagar
                      </button>
                    </div>
                  )}
                  {p.status === 'pago' && (
                    <span className="text-green-600 text-xs font-medium">✓ Pago</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AGENDAMENTOS */}
        {aba === 'agendamentos' && (
          <div className="space-y-3">
            <button className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700">
              + Novo Agendamento
            </button>
            {mockAgendamentos.map((ag, i) => (
              <div key={i} className="bg-white rounded-xl border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{ag.servico}</p>
                    <p className="text-sm text-gray-500 mt-0.5">com {ag.profissional}</p>
                    <p className="text-sm text-indigo-600 mt-1 font-medium">
                      📅 {new Date(ag.data).toLocaleDateString('pt-BR')} às {ag.hora}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${ag.status === 'confirmado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {ag.status === 'confirmado' ? '✓ Confirmado' : '⏳ Pendente'}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <p className="text-sm text-gray-500">R$ {ag.valor},00</p>
                  <div className="flex gap-2">
                    <button className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50">
                      Reagendar
                    </button>
                    <button className="border border-red-300 text-red-600 px-3 py-1.5 rounded-lg text-xs hover:bg-red-50">
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* HISTÓRICO */}
        {aba === 'historico' && (
          <div className="space-y-2">
            {mockHistorico.map((h, i) => (
              <div key={i} className="bg-white rounded-xl border p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg
                    ${h.tipo === 'compra' ? 'bg-blue-100' : h.tipo === 'pagamento' ? 'bg-green-100' : 'bg-purple-100'}`}>
                    {h.tipo === 'compra' ? '🛍️' : h.tipo === 'pagamento' ? '💳' : '✂️'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{h.descricao}</p>
                    <p className="text-xs text-gray-400">{new Date(h.data).toLocaleDateString('pt-BR')}</p>
                    {h.nf && (
                      <button className="text-xs text-indigo-600 hover:underline mt-0.5">
                        📄 {h.nf}
                      </button>
                    )}
                  </div>
                </div>
                <p className={`text-sm font-bold ${h.tipo === 'pagamento' ? 'text-green-600' : 'text-gray-900'}`}>
                  R$ {h.valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
