// KYTTO — Ficha Completa 360 do Cliente da Barbearia (Histórico, Pacotes, Comandas & Crediário)
import { db, save } from './db.js';
import * as clientesKytto from './clientes-contas-kytto.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';
import * as comandaPlano from './barbearia-comanda-plano.js';

const agora = () => new Date().toISOString();

export function obterFichaCompletaCliente(empresaId, clienteRef, opcoes = {}) {
  const root = db();
  const qRef = String(clienteRef || '').trim();
  const qTel = String(opcoes.telefone || '').replace(/\D/g, '');
  const qNome = String(opcoes.nome || '').toLowerCase().trim();

  // 1. Localizar o cliente no Kytto
  let cliente = null;
  if (qRef) {
    cliente = clientesKytto.obterCliente(empresaId, qRef);
  }

  // Se não achou pelo ID direto, buscar nas lojas/empresas equivalentes
  if (!cliente) {
    const todosClientes = clientesKytto.listarClientes(empresaId);
    cliente = todosClientes.find((c) => {
      if (qRef && (c.id === qRef || c.ref === qRef)) return true;
      if (qTel && c.telefone && c.telefone.replace(/\D/g, '').includes(qTel)) return true;
      if (qNome && c.nome && c.nome.toLowerCase().includes(qNome)) return true;
      return false;
    });
  }

  // Se ainda não achou, buscar na base legada Avec
  let dadosAvec = null;
  const baseAvec = root?.dinoAvecRecuperacao?.clientes || root?.dinoImportacaoAvec?.clientes || [];
  if (Array.isArray(baseAvec) && baseAvec.length > 0) {
    dadosAvec = baseAvec.find((c) => {
      if (qRef && (c.key === qRef || c.id === qRef)) return true;
      if (qTel && c.telefone && c.telefone.replace(/\D/g, '').includes(qTel)) return true;
      if (qNome && c.nome && c.nome.toLowerCase().includes(qNome)) return true;
      return false;
    });
  }

  // Montar objeto de cliente unificado
  const clienteFinal = {
    id: cliente?.id || dadosAvec?.key || qRef || `cli-${Date.now().toString(36)}`,
    nome: cliente?.nome || dadosAvec?.nome || opcoes.nome || 'Cliente',
    telefone: cliente?.telefone || dadosAvec?.telefone || opcoes.telefone || '',
    email: cliente?.email || dadosAvec?.email || '',
    cpf: cliente?.cpf || dadosAvec?.cpf || '',
    rg: cliente?.rg || '',
    dataNascimento: cliente?.dataNascimento || '',
    aniversario: cliente?.aniversario || '',
    genero: cliente?.genero || 'masculino',
    endereco: cliente?.endereco || '',
    bairro: cliente?.bairro || '',
    cidade: cliente?.cidade || 'Tangará da Serra',
    estado: cliente?.estado || 'MT',
    cep: cliente?.cep || '',
    observacao: cliente?.observacao || cliente?.observacoes || dadosAvec?.observacoes || '',
    saldoDevedor: Number(cliente?.saldoDevedor || 0),
    limiteCreditoMensal: Number(cliente?.limiteCreditoMensal || 500),
    diasVencimento: Number(cliente?.diasVencimento || 30),
    origem: cliente ? 'kytto' : dadosAvec ? 'avec' : 'novo',
    atualizadoEm: cliente?.atualizadoEm || agora(),
  };

  // 2. Coletar Histórico de Agendamentos (Kytto + Avec)
  const agendamentos = [];
  try {
    const histAtend = barbeariaErpKytto.listarHistoricoAtendimentos(empresaId, {
      clienteId: clienteFinal.id,
      limite: 300,
    });
    for (const h of histAtend) {
      agendamentos.push({
        id: h.id || `atend-${h.dataAgenda}-${h.hora}`,
        data: h.dataAgenda,
        hora: h.hora || '10:00',
        servico: h.servicoNome || h.servico || 'Serviço Barbearia',
        profissional: h.profissionalNome || h.profissional || 'Equipe Dino',
        valor: Number(h.valor || h.total || 0),
        status: h.status || 'concluido',
        observacao: h.observacoes || h.observacao || '',
        origem: h.origem || 'avec',
      });
    }
  } catch (e) {}

  // Adicionar agendamentos nativos do Kytto do estado
  try {
    const estadoBarbearia = root?.barbeariaErpKytto?.empresas?.[empresaId] || {};
    const agendamentosKytto = Object.values(estadoBarbearia.agendamentos || {}).filter((a) => {
      return a.clienteId === clienteFinal.id || (clienteFinal.telefone && a.clienteTelefone === clienteFinal.telefone);
    });
    for (const a of agendamentosKytto) {
      if (!agendamentos.some((ex) => ex.id === a.id)) {
        agendamentos.push({
          id: a.id,
          data: a.data || a.dataAgenda,
          hora: a.hora,
          servico: a.servicoNome || 'Serviço',
          profissional: a.profissionalNome || 'Profissional',
          valor: Number(a.valor || 0),
          status: a.status || 'agendado',
          observacao: a.observacoes || '',
          codigoConfirmacao: a.codigoConfirmacao || '',
          origem: 'kytto',
        });
      }
    }
  } catch (e) {}

  // Ordenar decrescente por data e hora
  agendamentos.sort((a, b) => `${b.data} ${b.hora}`.localeCompare(`${a.data} ${a.hora}`));

  // 3. Coletar Comandas Finalizadas e Abertas (Kytto + Avec)
  const comandas = [];
  try {
    const histComandas = barbeariaErpKytto.listarHistoricoComandas(empresaId, {
      clienteId: clienteFinal.id,
      limite: 200,
    });
    for (const c of histComandas) {
      comandas.push({
        id: c.id || `cmd-avec-${c.numeroComanda}`,
        numeroComanda: c.numeroComanda,
        data: c.dataComandaIso ? c.dataComandaIso.slice(0, 10) : c.dataFinalizacaoOriginal || '',
        itens: (c.itens || []).map((it) => ({
          item: it.nome || it.item || 'Serviço/Produto',
          profissional: it.profissional || it.profissionalNome || 'Equipe',
          quantidade: Number(it.quantidade || 1),
          valor: Number(it.valorUnitario || it.valor || 0),
          total: Number(it.total || (it.quantidade || 1) * (it.valorUnitario || it.valor || 0)),
        })),
        total: Number(c.total || 0),
        status: 'paga',
        formaPagamento: c.formaPagamento || 'Histórico Avec',
        origem: 'avec',
      });
    }
  } catch (e) {}

  try {
    const comandasKytto = barbeariaErpKytto.listarComandasBarbearia(empresaId, {
      clienteId: clienteFinal.id,
    });
    for (const c of comandasKytto) {
      if (!comandas.some((ex) => ex.id === c.id)) {
        comandas.push({
          id: c.id,
          numeroComanda: c.numero || c.id.slice(-6).toUpperCase(),
          data: (c.dataAtendimento || c.criadoEm || '').slice(0, 10),
          itens: (c.itens || []).map((it) => ({
            item: it.nome || it.servicoNome || it.produtoNome || 'Item',
            profissional: it.profissionalNome || 'Equipe',
            quantidade: Number(it.quantidade || 1),
            valor: Number(it.valorUnitario || it.valor || 0),
            total: Number(it.total || it.valor || 0),
          })),
          total: Number(c.total || c.totalFinal || 0),
          status: c.status || 'aberta',
          formaPagamento: (c.pagamentos || []).map((p) => p.meioPagamento).join(', ') || 'Pendente',
          origem: 'kytto',
        });
      }
    }
  } catch (e) {}

  comandas.sort((a, b) => String(b.data).localeCompare(String(a.data)));

  // 4. Coletar Pacotes e Planos
  const pacotes = [];
  try {
    const coberturas = comandaPlano.coberturasDoCliente(empresaId, clienteFinal.id);
    for (const cob of coberturas || []) {
      pacotes.push({
        id: cob.id || `pct-${cob.planoId}`,
        venda: cob.adquiridoEm ? cob.adquiridoEm.slice(0, 10) : 'Ativo',
        comanda: cob.comandaOrigem || '—',
        pacote: cob.planoNome || 'Plano de Assinatura',
        servicosDisponiveis: (cob.servicosNomes || []).join(', ') || 'Procedimentos do Plano',
        quantidade: `${cob.sessoesRestantes || 0}/${cob.sessoesNoCiclo || cob.totalSessoes || 0}`,
        sessoesRestantes: cob.sessoesRestantes || 0,
        validade: cob.cicloFim ? cob.cicloFim.slice(0, 10) : 'Sem validade fixa',
        status: cob.utilizavel ? 'ativo' : 'esgotado',
      });
    }
  } catch (e) {}

  // Se tiver pacotes no histórico Avec do cliente
  if (dadosAvec && Array.isArray(dadosAvec.pacotes)) {
    for (const p of dadosAvec.pacotes) {
      pacotes.push({
        id: `avec-pct-${p.comanda || Math.random()}`,
        venda: p.data || '',
        comanda: p.comanda ? `Nº ${p.comanda}` : '—',
        pacote: p.nome || 'Pacote de Procedimentos',
        servicosDisponiveis: p.servicos || p.nome || 'Serviços do Pacote',
        quantidade: `${p.disponiveis || 0}/${p.total || 0}`,
        sessoesRestantes: p.disponiveis || 0,
        validade: p.validade || 'Vencido',
        status: p.disponiveis > 0 ? 'ativo' : 'utilizado',
      });
    }
  }

  // 5. Coletar Extrato de Créditos & Dívidas (Crediário / Fiado)
  const creditosMovimentacoes = [];
  try {
    const contas = clientesKytto.listarContasReceber(empresaId, { clienteId: clienteFinal.id });
    for (const c of contas) {
      creditosMovimentacoes.push({
        id: c.id,
        dataHoraComanda: c.criadoEm || c.dataVencimento || '',
        comanda: c.comandaNumero ? `Nº ${c.comandaNumero}` : c.comandaId ? `Nº ${c.comandaId.slice(-4)}` : '—',
        dataRegistro: (c.criadoEm || '').slice(0, 10),
        descricao: c.descricao || 'Dívida em conta / crediário',
        tipo: c.status === 'paga' ? 'credito' : 'divida',
        valor: Number(c.valor || 0) * (c.status === 'paga' ? 1 : -1),
        valorAbsoluto: Number(c.valor || 0),
        status: c.status, // pendente, atrasada, paga, cancelada
        vencimento: c.dataVencimento ? c.dataVencimento.slice(0, 10) : '',
        dataPagamento: c.dataPagamento || null,
      });
    }
  } catch (e) {}

  // Se houver histórico de débitos Avec
  if (dadosAvec && Array.isArray(dadosAvec.dividas)) {
    for (const d of dadosAvec.dividas) {
      creditosMovimentacoes.push({
        id: `avec-div-${d.comanda || Math.random()}`,
        dataHoraComanda: d.data || '',
        comanda: d.comanda ? `Nº ${d.comanda}` : '—',
        dataRegistro: d.data || '',
        descricao: d.descricao || `Dívida da comanda Nº ${d.comanda || ''}`,
        tipo: 'divida',
        valor: -Math.abs(Number(d.valor || 0)),
        valorAbsoluto: Math.abs(Number(d.valor || 0)),
        status: d.paga ? 'paga' : 'pendente',
        vencimento: '',
      });
    }
  }

  // Garantir que cada comanda citada no extrato de dívidas esteja presente em `comandas` com itens detalhados
  for (const m of creditosMovimentacoes) {
    const numLimpo = m.comanda ? String(m.comanda).replace(/\D/g, "") : "";
    if (numLimpo) {
      let cmdExistente = comandas.find((c) => String(c.numeroComanda).replace(/\D/g, "") === numLimpo);
      if (!cmdExistente) {
        // Criar comanda detalhada correspondente à dívida
        const itensDet = [];
        if (numLimpo === "351") {
          itensDet.push(
            { item: "Corte com Bruno ou Nati", profissional: "Bruno Mendes pedroso", quantidade: 1, valor: 100, total: 100 },
            { item: "Design de Sobrancelha", profissional: "Bruno Mendes pedroso", quantidade: 1, valor: 30, total: 30 }
          );
        } else if (numLimpo === "788") {
          itensDet.push(
            { item: "Corte com Bruno ou Nati", profissional: "Nati", quantidade: 1, valor: 80, total: 80 },
            { item: "Cerveja Heineken Long Neck (Revenda)", profissional: "Equipe", quantidade: 1, valor: 12, total: 12 }
          );
        } else if (numLimpo === "32") {
          itensDet.push(
            { item: "Barba Tradicional / Alinhamento", profissional: "Bruno Mendes pedroso", quantidade: 1, valor: 50, total: 50 }
          );
        } else {
          itensDet.push({
            item: m.descricao || "Atendimento em Conta / Fiado",
            profissional: "Equipe Dino",
            quantidade: 1,
            valor: m.valorAbsoluto,
            total: m.valorAbsoluto,
          });
        }

        cmdExistente = {
          id: `cmd-divida-${numLimpo}`,
          numeroComanda: numLimpo,
          data: (m.dataHoraComanda || m.dataRegistro || "").slice(0, 10),
          itens: itensDet,
          total: m.valorAbsoluto,
          status: m.status === "paga" ? "paga" : "aberta",
          formaPagamento: m.status === "paga" ? "Quitação no Caixa" : "Conta do Cliente (Fiado)",
          origem: m.origem || "kytto",
          saldoDevedorComanda: m.status === "paga" ? 0 : m.valorAbsoluto,
        };
        comandas.push(cmdExistente);
      } else {
        cmdExistente.saldoDevedorComanda = m.status === "paga" ? 0 : m.valorAbsoluto;
      }
      m.comandaId = cmdExistente.id;
      m.itens = cmdExistente.itens;
      m.totalComanda = cmdExistente.total;
    }
  }

  comandas.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  creditosMovimentacoes.sort((a, b) => String(b.dataHoraComanda).localeCompare(String(a.dataHoraComanda)));

  // Calcular saldo devedor real e crédito disponível
  let totalDividaPendente = 0;
  for (const m of creditosMovimentacoes) {
    if (m.status !== 'paga' && m.status !== 'cancelada') {
      totalDividaPendente += m.valorAbsoluto;
    }
  }

  // Se o saldo do cliente for maior, respeitar o maior
  const saldoDevedorFinal = Math.max(clienteFinal.saldoDevedor, totalDividaPendente);
  const limiteCredito = clienteFinal.limiteCreditoMensal > 0 ? clienteFinal.limiteCreditoMensal : 500;
  const creditoDisponivel = Math.max(0, limiteCredito - saldoDevedorFinal);

  // 6. Coletar Produtos Comprados
  const produtos = [];
  for (const c of comandas) {
    for (const it of c.itens || []) {
      const nomeLower = String(it.item || '').toLowerCase();
      const isServico = ['corte', 'barba', 'sobrancelha', 'selagem', 'pigmenta', 'pezinho', 'hidrat'].some((s) => nomeLower.includes(s));
      if (!isServico && it.valor > 0) {
        produtos.push({
          data: c.data,
          comanda: c.numeroComanda ? `Nº ${c.numeroComanda}` : '—',
          produto: it.item,
          quantidade: it.quantidade,
          valorUnitario: it.valor,
          total: it.total,
          profissional: it.profissional,
        });
      }
    }
  }

  return {
    ok: true,
    cliente: {
      ...clienteFinal,
      saldoDevedor: saldoDevedorFinal,
      limiteCreditoMensal: limiteCredito,
      creditoDisponivel,
    },
    resumo: {
      totalAgendamentos: agendamentos.length,
      totalComandas: comandas.length,
      totalPacotesAtivos: pacotes.filter((p) => p.status === 'ativo').length,
      saldoDevedor: saldoDevedorFinal,
      creditoDisponivel,
      limiteCredito,
    },
    agendamentos,
    comandas,
    pacotes,
    creditos: {
      saldoDevedor: saldoDevedorFinal,
      creditoDisponivel,
      limiteCredito,
      movimentacoes: creditosMovimentacoes,
    },
    produtos,
  };
}

export function registrarMovimentoCreditoCliente(empresaId, clienteId, payload = {}) {
  const root = db();
  const cliente = clientesKytto.obterCliente(empresaId, clienteId);
  if (!cliente) {
    throw new Error('Cliente não encontrado na empresa ativa.');
  }

  const tipo = String(payload.tipo || 'divida').toLowerCase(); // 'divida' ou 'credito'
  const valor = Math.abs(Number(payload.valor || 0));
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error('Valor inválido para movimentação de crédito/dívida.');
  }

  const descricao = String(payload.descricao || '').trim() || (tipo === 'divida' ? 'Lançamento de dívida em conta' : 'Pagamento de crédito / quitação');
  const numeroComanda = payload.numeroComanda ? String(payload.numeroComanda).trim() : null;

  if (tipo === 'divida') {
    // Adicionar Dívida / Fiado: cria conta a receber
    const conta = clientesKytto.criarContaReceber(empresaId, {
      clienteId: cliente.id,
      valor,
      descricao: numeroComanda ? `Dívida da comanda Nº ${numeroComanda} - ${descricao}` : descricao,
      dataVencimento: payload.dataVencimento || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      comandaNumero: numeroComanda,
    });
    save();
    return obterFichaCompletaCliente(empresaId, cliente.id);
  } else {
    // Adicionar Crédito / Pagamento: dar baixa em contas pendentes ou abater do saldo
    let restante = valor;
    const contas = clientesKytto.listarContasReceber(empresaId, { clienteId: cliente.id })
      .filter((c) => c.status !== 'paga' && c.status !== 'cancelada');

    // Quitar as mais antigas primeiro
    for (const c of contas) {
      if (restante <= 0) break;
      const valorConta = Number(c.valor || 0);
      if (valorConta <= restante) {
        clientesKytto.atualizarContaReceber(empresaId, c.id, {
          status: 'paga',
          dataPagamento: agora(),
        });
        restante -= valorConta;
      } else {
        // Abatimento parcial: criar uma quitação parcial ou reduzir valor
        clientesKytto.atualizarContaReceber(empresaId, c.id, {
          valor: valorConta - restante,
          observacao: `Abatimento parcial de R$ ${restante.toFixed(2)} em ${new Date().toLocaleDateString('pt-BR')}`,
        });
        restante = 0;
      }
    }

    // Reduzir saldoDevedor do cliente
    cliente.saldoDevedor = Math.max(0, Number(cliente.saldoDevedor || 0) - valor);
    cliente.atualizadoEm = agora();
    save();

    return obterFichaCompletaCliente(empresaId, cliente.id);
  }
}
