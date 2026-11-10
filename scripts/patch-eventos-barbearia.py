with open('app/barbearia-erp-kytto.js', 'r', encoding='utf8') as f:
    code = f.read()

# Import
import_target = "import { executeDinoReversal, getDinoReversalMemoryAdapter } from './core/dino-reversal-coordinator.js';"
import_replacement = """import { executeDinoReversal, getDinoReversalMemoryAdapter } from './core/dino-reversal-coordinator.js';
import { kyttoEventBus } from './core/kytto-event-bus.js';"""

if "kytto-event-bus.js" not in code:
    code = code.replace(import_target, import_replacement, 1)

# Ponto 1: faturamento de comanda
save_target = """    if (credito) {
      comanda.fidelidadeValorPontuado = Number((Number(comanda.fidelidadeValorPontuado || 0) + valorElegivel).toFixed(2));
      comanda.fidelidadeMovimentoId = credito.movimento?.id || comanda.fidelidadeMovimentoId || null;
    }
  }
  save();
  return copiarComandaBarbearia(comanda);"""

save_replacement = """    if (credito) {
      comanda.fidelidadeValorPontuado = Number((Number(comanda.fidelidadeValorPontuado || 0) + valorElegivel).toFixed(2));
      comanda.fidelidadeMovimentoId = credito.movimento?.id || comanda.fidelidadeMovimentoId || null;
    }
  }
  save();
  if (faturada) {
    try {
      kyttoEventBus.emitir('comanda.fechada', {
        comandaId: comanda.id,
        clienteId: comanda.clienteId,
        clienteNome: comanda.clienteNome,
        total: comanda.totalFaturado,
        totalPago: comanda.totalPago,
        itens: comanda.itens,
        pagamentos: comanda.pagamentos
      }, { empresaId, lojaId: comanda.lojaId, usuario: dados.usuario || 'operador' });
    } catch (e) {
      console.warn('[EventBus] Falha ao emitir comanda.fechada:', e.message);
    }
  }
  return copiarComandaBarbearia(comanda);"""

code = code.replace(save_target, save_replacement, 1)

# Ponto 2: fechamento de comanda coberta pelo plano
plano_save_target = """    comanda.fechadaEm = comanda.atualizadoEm;
    save();
    return copiarComandaBarbearia(comanda);"""

plano_save_replacement = """    comanda.fechadaEm = comanda.atualizadoEm;
    save();
    try {
      kyttoEventBus.emitir('comanda.fechada', {
        comandaId: comanda.id,
        clienteId: comanda.clienteId,
        clienteNome: comanda.clienteNome,
        total: 0,
        totalPago: 0,
        fechadaPeloPlano: true,
        itens: comanda.itens
      }, { empresaId, lojaId: comanda.lojaId, usuario: dados.usuario || 'operador' });
    } catch (e) {
      console.warn('[EventBus] Falha ao emitir comanda.fechada:', e.message);
    }
    return copiarComandaBarbearia(comanda);"""

code = code.replace(plano_save_target, plano_save_replacement, 1)

with open('app/barbearia-erp-kytto.js', 'w', encoding='utf8') as f:
    f.write(code)

print("barbearia-erp-kytto.js atualizado com sucesso com kyttoEventBus!")
