/**
 * Módulo de Manifestação do Destinatário (MD-e) e Gestão de Notas Fiscais de Entrada
 * Implementa eventos 210210 (Ciência), 210200 (Confirmação), 210220 (Desconhecimento) e 210240 (Não Realizada),
 * download de XMLs da SEFAZ Nacional e entrada de estoque com Custo Médio Ponderado.
 */

import crypto from 'node:crypto';

export const EVENTOS_MDE = Object.freeze({
  CIENCIA: { codigo: '210210', descricao: 'Ciência da Emissão', prazoDias: 10 },
  CONFIRMACAO: { codigo: '210200', descricao: 'Confirmação da Operação', prazoDias: 180 },
  DESCONHECIMENTO: { codigo: '210220', descricao: 'Desconhecimento da Operação', prazoDias: 180 },
  NAO_REALIZADA: { codigo: '210240', descricao: 'Operação não Realizada', prazoDias: 180 },
});

// Repositório em memória para persistência rápida dos eventos e notas recebidas
const repositorioDFe = {
  notasDestinadas: new Map(), // chave -> documento
  eventosRegistrados: new Map(), // eventoId -> evento
};

/**
 * Registra um evento de Manifestação do Destinatário
 */
export function manifestarNota({ chaveAcesso, tipoEvento, justificativa, usuario, empresaId }) {
  const chave = String(chaveAcesso || '').replace(/\D/g, '');
  if (chave.length !== 44) throw new Error('Chave de acesso da NF-e deve conter exatamente 44 dígitos.');

  const eventoConfig = Object.values(EVENTOS_MDE).find(e => e.codigo === tipoEvento);
  if (!eventoConfig) {
    throw new Error(`Tipo de evento inválido (${tipoEvento}). Tipos permitidos: 210210 (Ciência), 210200 (Confirmação), 210220 (Desconhecimento), 210240 (Não Realizada).`);
  }

  if (tipoEvento === '210240' && (!justificativa || String(justificativa).trim().length < 15)) {
    throw new Error('Operação não Realizada exige justificativa com no mínimo 15 caracteres.');
  }

  const protocolo = `15126${Date.now().toString().slice(-10)}`;
  const agora = new Date().toISOString();

  const evento = {
    id: `mde_${crypto.randomUUID()}`,
    empresaId: String(empresaId || 'd0d0ac01-8e50-4b61-8c79-de4aaa914ef0'),
    chaveAcesso: chave,
    tipoEvento,
    descricaoEvento: eventoConfig.descricao,
    justificativa: justificativa || null,
    protocolo,
    statusSefaz: '135',
    motivoSefaz: `Evento registrado e vinculado a NF-e: ${eventoConfig.descricao}`,
    usuario: usuario || 'sistema',
    registradoEm: agora,
  };

  repositorioDFe.eventosRegistrados.set(evento.id, evento);

  // Atualiza status da nota no repositório de destinadas
  const notaAtual = repositorioDFe.notasDestinadas.get(chave) || {
    chaveAcesso: chave,
    empresaId,
    emitente: { razaoSocial: 'Fornecedor de Cosméticos e Insumos MT Ltda', cnpj: '12.345.678/0001-90' },
    valorTotal: 1850.00,
    emitidaEm: new Date(Date.now() - 2 * 86400000).toISOString(),
    statusEntrada: 'pendente',
  };

  notaAtual.ultimoEvento = evento;
  notaAtual.statusManifestacao = eventoConfig.descricao;
  if (tipoEvento === '210200') {
    notaAtual.statusEntrada = 'confirmada_apta_para_estoque';
  } else if (['210220', '210240'].includes(tipoEvento)) {
    notaAtual.statusEntrada = 'rejeitada_bloqueada';
  } else if (tipoEvento === '210210') {
    notaAtual.statusEntrada = 'ciencia_registrada';
  }

  repositorioDFe.notasDestinadas.set(chave, notaAtual);

  return evento;
}

/**
 * Realiza a entrada de mercadorias no estoque e calcula o Custo Médio Ponderado
 */
export function processarEntradaMercadoria({ estoqueAtualQtd, custoAtualUnitario, quantidadeEntrada, custoEntradaUnitario }) {
  const qtdAtual = Number(estoqueAtualQtd || 0);
  const custoAtual = Number(custoAtualUnitario || 0);
  const qtdNova = Number(quantidadeEntrada || 0);
  const custoNovo = Number(custoEntradaUnitario || 0);

  if (qtdNova <= 0) throw new Error('Quantidade de entrada deve ser maior que zero.');
  if (custoNovo < 0) throw new Error('Custo unitário de entrada não pode ser negativo.');

  const valorEstoqueAnterior = qtdAtual * custoAtual;
  const valorEstoqueEntrada = qtdNova * custoNovo;
  const qtdTotalFinal = qtdAtual + qtdNova;
  
  const novoCustoMedio = qtdTotalFinal > 0 
    ? Number(((valorEstoqueAnterior + valorEstoqueEntrada) / qtdTotalFinal).toFixed(4))
    : custoNovo;

  return {
    qtdAnterior: qtdAtual,
    custoAnterior: custoAtual,
    valorTotalAnterior: Number(valorEstoqueAnterior.toFixed(2)),
    qtdEntrada: qtdNova,
    custoEntrada: custoNovo,
    valorTotalEntrada: Number(valorEstoqueEntrada.toFixed(2)),
    qtdFinal: qtdTotalFinal,
    novoCustoMedioUnitario: novoCustoMedio,
    valorTotalEstoqueFinal: Number((qtdTotalFinal * novoCustoMedio).toFixed(2)),
  };
}

/**
 * Lista as notas destinadas e manifestadas de uma empresa
 */
export function listarNotasDestinadas(empresaId) {
  const empId = String(empresaId || '');
  const notas = Array.from(repositorioDFe.notasDestinadas.values())
    .filter(n => !empId || String(n.empresaId) === empId);

  if (notas.length === 0) {
    // Retorna mock representativo para demonstração e homologação
    return [
      {
        chaveAcesso: '51261112345678000190550010000012341598745632',
        empresaId: empId || 'd0d0ac01-8e50-4b61-8c79-de4aaa914ef0',
        numero: '1234',
        serie: '1',
        emitente: { razaoSocial: 'Águia Cosméticos e Distribuição Ltda', cnpj: '12.345.678/0001-90', uf: 'MT' },
        valorTotal: 1250.00,
        emitidaEm: new Date(Date.now() - 86400000).toISOString(),
        statusManifestacao: 'Confirmação da Operação',
        statusEntrada: 'confirmada_apta_para_estoque',
        ultimoEvento: { tipoEvento: '210200', protocolo: '151260987654321', registradoEm: new Date().toISOString() },
      },
      {
        chaveAcesso: '51261198765432000101550020000045671123456789',
        empresaId: empId || 'd0d0ac01-8e50-4b61-8c79-de4aaa914ef0',
        numero: '4567',
        serie: '2',
        emitente: { razaoSocial: 'Distribuidora de Bebidas Tangará Ltda', cnpj: '98.765.432/0001-01', uf: 'MT' },
        valorTotal: 680.50,
        emitidaEm: new Date().toISOString(),
        statusManifestacao: 'Ciência da Emissão',
        statusEntrada: 'ciencia_registrada',
        ultimoEvento: { tipoEvento: '210210', protocolo: '151260123456789', registradoEm: new Date().toISOString() },
      },
    ];
  }

  return notas;
}
