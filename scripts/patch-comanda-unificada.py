with open('web/src/pages/admin/dino/ComandaNova.jsx', 'r', encoding='utf8') as f:
    code = f.read()

target_effect = "  useEffect(() => { setCarrinho((atual) => aplicarPreviaPlanos(planos, atual)) }, [planos])"

replacement_effect = """  useEffect(() => { setCarrinho((atual) => aplicarPreviaPlanos(planos, atual)) }, [planos])

  // Sincroniza e unifica múltiplos agendamentos do mesmo cliente/família na mesma comanda
  useEffect(() => {
    if (!clienteId || !agendamentos?.length) return;
    const agendamentosDoCliente = agendamentos.filter((a) => {
      const matchId = a.clienteId === clienteId;
      const matchTel = cliente?.telefone && a.clienteTelefone && a.clienteTelefone.replace(/\\D/g, '') === String(cliente.telefone).replace(/\\D/g, '');
      return (matchId || matchTel) && ['pendente', 'agendado', 'atrasado', 'em_atendimento', 'confirmado'].includes(a.status);
    });

    if (agendamentosDoCliente.length > 0) {
      setCarrinho((atual) => {
        const agendamentoIdsNoCarrinho = new Set(atual.map((i) => i.agendamentoId).filter(Boolean));
        const novosItens = [];
        for (const a of agendamentosDoCliente) {
          if (!agendamentoIdsNoCarrinho.has(a.id)) {
            const s = (servicos || []).find((x) => x.id === a.servicoId);
            if (s) {
              novosItens.push({
                chave: `servico-${s.id}-${a.id}-unificado-${Date.now()}`,
                tipo: 'servico',
                itemId: s.id,
                nome: s.nome,
                preco: Number(a.valor || s.preco || 0),
                quantidade: 1,
                usarPlano: true,
                profissionalId: a.profissionalId || profissionalId || '',
                agendamentoId: a.id,
                unificadoAuto: true,
              });
            }
          }
        }
        if (!novosItens.length) return atual;
        return aplicarPreviaPlanos(planos, [...atual, ...novosItens]);
      });
    }
  }, [clienteId, agendamentos, servicos, cliente?.telefone]);"""

code = code.replace(target_effect, replacement_effect, 1)

# Inserir o banner de unificação acima do carrinho
target_carrinho = '      <div className="cn-carrinho" aria-label="Itens da comanda">'
replacement_carrinho = """      {carrinho.some((i) => i.unificadoAuto || i.agendamentoId) && (
        <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#3b82f6' }}>
          <span style={{ fontSize: 16 }}>👥</span>
          <div>
            <strong>Serviços Unificados:</strong> Agendamentos reconhecidos para este cliente/família foram consolidados nesta mesma comanda. Cada procedimento mantém seu profissional responsável para fins de comissão.
          </div>
        </div>
      )}
      <div className="cn-carrinho" aria-label="Itens da comanda">"""

code = code.replace(target_carrinho, replacement_carrinho, 1)

with open('web/src/pages/admin/dino/ComandaNova.jsx', 'w', encoding='utf8') as f:
    f.write(code)

print('ComandaNova.jsx atualizado com unificacao automatica!')
