import test from 'node:test';
import assert from 'node:assert/strict';
import {
  simularMelhorAdquirente,
  gerarArquivoDimp,
  ADQUIRENTES_BRASIL
} from './tef-multimaquininhas-brasil.js';
import {
  manifestarNotasEmLote,
  gerarLivroRegistroEntradas,
  manifestarNota,
  repositorioDFe
} from './manifestacao-destinatario-mde.js';
import {
  despacharBoxAssinatura,
  gerarExtratoCashback,
  gerarMensagemWhatsAppBoxPronto,
  exportarAssinaturasCsv,
  criarAssinaturaStalloneClub,
  processarCobrancaCicloAssinatura,
  STALLONE_EMPRESA_ID
} from './stallone-club-assinaturas.js';

test('1. TEF: Simulador de Economia de Taxas MDR entre Adquirentes', () => {
  const resDebito = simularMelhorAdquirente({ valor: 250, modalidade: 'debito' });
  assert.equal(resDebito.sucesso, true);
  assert.equal(resDebito.valorBruto, 250);
  assert.ok(resDebito.melhorOpcao, 'Deve eleger a melhor adquirente');
  assert.ok(resDebito.comparativo.length >= 6, 'Deve comparar pelo menos 6 adquirentes');
  assert.ok(resDebito.melhorOpcao.valorLiquido > 0);
  assert.ok(resDebito.economiaMaxima >= 0);

  const resParcelado = simularMelhorAdquirente({ valor: 500, modalidade: 'credito_parcelado', parcelas: 6 });
  assert.equal(resParcelado.sucesso, true);
  assert.equal(resParcelado.parcelas, 6);
  assert.ok(resParcelado.comparativo[0].valorLiquido >= resParcelado.comparativo[1].valorLiquido);
});

test('2. TEF: Geração de Arquivo DIMP Oficial COTEPE/SEFAZ-MT', () => {
  const transacoesMock = [
    {
      id: 'tef-t1',
      valor: 200,
      valorLiquido: 196.40,
      valorTaxaMdr: 3.60,
      adquirenteId: 'stone',
      bandeira: 'visa',
      tipoOperacao: 'debito',
      status: 'autorizada',
      nsu: '123456',
      codigoAutorizacao: 'AUT999',
      data: '2026-11-15T10:00:00.000Z'
    },
    {
      id: 'tef-t2',
      valor: 350,
      valorLiquido: 341.25,
      valorTaxaMdr: 8.75,
      adquirenteId: 'vero_sicredi',
      bandeira: 'mastercard',
      tipoOperacao: 'credito_avista',
      status: 'autorizada',
      nsu: '654321',
      codigoAutorizacao: 'AUT888',
      data: '2026-11-15T11:00:00.000Z'
    }
  ];

  const dimp = gerarArquivoDimp({ mesAno: '2026-11', transacoes: transacoesMock });
  assert.equal(dimp.sucesso, true);
  assert.equal(dimp.totalOperacoes, 2);
  assert.equal(dimp.totalBruto, 550);
  assert.equal(dimp.totalTaxasRetidas, 12.35);
  assert.match(dimp.conteudoArquivo, /^0000\|DIMP\|1.0\|56099531000138/);
  assert.match(dimp.conteudoArquivo, /9999\|2\|550.00\|12.35\|537.65$/);
});

test('3. MDE: Manifestação de Notas em Lote e Livro de Entradas', async () => {
  const chave1 = '51261156099531000138550010000088881234567890';
  const chave2 = '51261156099531000138550010000088891234567891';

  manifestarNota({ chaveAcesso: chave1, tipoEvento: '210210' });
  manifestarNota({ chaveAcesso: chave2, tipoEvento: '210210' });

  const resLote = await manifestarNotasEmLote({
    empresaId: STALLONE_EMPRESA_ID,
    chavesAcesso: [chave1, chave2],
    tipoEvento: '210200',
    usuario: 'Auditor Fiscal Teste'
  });

  assert.equal(resLote.sucesso, true);
  assert.equal(resLote.totalProcessadas, 2);
  assert.equal(resLote.sucessos, 2);

  const livro = await gerarLivroRegistroEntradas({ empresaId: STALLONE_EMPRESA_ID });
  assert.equal(livro.sucesso, true);
  assert.ok(livro.totalDocumentos >= 2);
  assert.ok(livro.conteudoCsv.includes('Ordem;Data;Chave de Acesso'));
});

test('4. Stallone VIP Club: Despacho de Box, Extrato de Cashback e WhatsApp', async () => {
  const cpfDinamico = `012.${Math.floor(100 + Math.random() * 899)}.${Math.floor(100 + Math.random() * 899)}-${Math.floor(10 + Math.random() * 89)}`;
  const resAssinatura = criarAssinaturaStalloneClub({
    empresaId: STALLONE_EMPRESA_ID,
    clienteNome: 'Marcos Vinicius Pro',
    clienteCpf: cpfDinamico,
    clienteTelefone: '65998877665',
    planoCodigo: 'performance'
  });
  assert.equal(resAssinatura.sucesso, true);
  const id = resAssinatura.assinatura.id;

  // Processa ciclo para gerar cashback
  processarCobrancaCicloAssinatura(STALLONE_EMPRESA_ID, id);

  // Despacha o box
  const resDespacho = despacharBoxAssinatura(STALLONE_EMPRESA_ID, id, {
    modalidade: 'retirada_balcao',
    observacoes: 'Separado por Rodrigo na loja física de Tangará'
  });
  assert.equal(resDespacho.sucesso, true);
  assert.equal(resDespacho.envio.statusEnvio, 'pronto_para_retirada_ou_envio');
  assert.ok(resDespacho.envio.protocolo.startsWith('BOX-'));

  // Extrato de cashback
  const extrato = gerarExtratoCashback(STALLONE_EMPRESA_ID, id);
  assert.equal(extrato.sucesso, true);
  assert.equal(extrato.clienteNome, 'Marcos Vinicius Pro');
  assert.equal(extrato.saldoAtual, 27.90);
  assert.equal(extrato.totalLancamentos, 1);

  // Mensagem WhatsApp
  const zap = gerarMensagemWhatsAppBoxPronto(STALLONE_EMPRESA_ID, id);
  assert.equal(zap.sucesso, true);
  assert.match(zap.mensagem, /Marcos Vinicius Pro/);
  assert.match(zap.mensagem, /Stallone VIP Club/);
  assert.match(zap.mensagem, /R\$ 27.90/);

  // Exportar CSV
  const csv = await exportarAssinaturasCsv(STALLONE_EMPRESA_ID);
  assert.equal(csv.sucesso, true);
  assert.ok(csv.totalAssinantes >= 1);
  assert.ok(csv.conteudoCsv.includes('Marcos Vinicius Pro'));
});
