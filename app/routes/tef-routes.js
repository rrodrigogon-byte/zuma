/**
 * Rotas de TEF e Maquininhas de Cartão do Brasil
 */

import { Router } from 'express';
import {
  ADQUIRENTES_BRASIL,
  BANDEIRAS_BRASIL,
  CONFIGURACAO_PADRAO_DINO,
  obterConfiguracoesTef,
  salvarConfiguracoesTef,
  listarTerminaisTef,
  adicionarTerminalTef,
  atualizarTerminalTef,
  excluirTerminalTef,
  testarConexaoTerminal,
  processarTransacaoTef,
  listarTransacoesTef,
  excluirTransacaoTef,
  expurgarTransacoesSimuladas,
  conciliarLoteTefComExtrato,
  resumoPrevisaoRecebiveis
} from '../core/tef-multimaquininhas-brasil.js';
import { BANCOS_BRASIL, identificarBanco, categorizarLinhaBancaria } from '../core/bancos-brasil-catalogo.js';

export function createTefRouter({ obterEmpresaId }) {
  const router = Router();

  function resolverEmpresa(req) {
    if (obterEmpresaId) {
      const id = obterEmpresaId(req);
      if (id) return id;
    }
    return req.headers['x-empresa-id'] || req.user?.empresaId || req.user?.empresa_id || null;
  }

  // Listar catálogo de bancos do Brasil
  router.get('/bancos', (req, res) => {
    res.json({ ok: true, bancos: BANCOS_BRASIL });
  });

  // Identificar banco por termo ou código
  router.get('/bancos/identificar', (req, res) => {
    const { termo } = req.query;
    const banco = identificarBanco(termo);
    res.json({ ok: true, banco });
  });

  // Categorizar linha bancária
  router.post('/bancos/categorizar-linha', (req, res) => {
    const { descricao, valor } = req.body;
    const resultado = categorizarLinhaBancaria(descricao, Number(valor));
    res.json({ ok: true, ...resultado });
  });

  // Listar catálogo de adquirentes e máquinas
  router.get('/adquirentes', (req, res) => {
    res.json({ ok: true, adquirentes: ADQUIRENTES_BRASIL });
  });

  // Listar catálogo de bandeiras
  router.get('/bandeiras', (req, res) => {
    res.json({ ok: true, bandeiras: BANDEIRAS_BRASIL });
  });

  // Obter configurações TEF da empresa
  router.get('/configuracoes', (req, res) => {
    const empresaId = resolverEmpresa(req);
    const config = obterConfiguracoesTef(empresaId);
    res.json({ ok: true, config });
  });

  // Salvar configurações TEF da empresa
  router.put('/configuracoes', (req, res) => {
    const empresaId = resolverEmpresa(req);
    const config = salvarConfiguracoesTef(empresaId, req.body || {});
    res.json({ ok: true, config, mensagem: 'Configurações do TEF salvas com sucesso.' });
  });

  // Restaurar padrões oficiais da Barbearia Dino
  router.post('/restaurar-padrao-dino', (req, res) => {
    const empresaId = resolverEmpresa(req);
    const config = salvarConfiguracoesTef(empresaId, JSON.parse(JSON.stringify(CONFIGURACAO_PADRAO_DINO)));
    res.json({ ok: true, config, mensagem: 'Configurações oficiais da Barbearia Dino restauradas com sucesso.' });
  });

  // Gestão de Terminais Pinpad
  router.get('/terminais', (req, res) => {
    const empresaId = resolverEmpresa(req);
    const terminais = listarTerminaisTef(empresaId);
    res.json({ ok: true, total: terminais.length, terminais });
  });

  router.post('/terminais', (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const terminal = adicionarTerminalTef(empresaId, req.body || {});
      res.status(201).json({ ok: true, terminal, mensagem: 'Terminal pinpad cadastrado com sucesso.' });
    } catch (err) {
      res.status(400).json({ ok: false, erro: err.message });
    }
  });

  router.put('/terminais/:id', (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const terminal = atualizarTerminalTef(empresaId, req.params.id, req.body || {});
      res.json({ ok: true, terminal, mensagem: 'Terminal pinpad atualizado com sucesso.' });
    } catch (err) {
      res.status(404).json({ ok: false, erro: err.message });
    }
  });

  router.delete('/terminais/:id', (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = excluirTerminalTef(empresaId, req.params.id);
      res.json({ ok: true, ...resultado });
    } catch (err) {
      res.status(404).json({ ok: false, erro: err.message });
    }
  });

  router.post('/terminais/:id/testar-conexao', (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = testarConexaoTerminal(empresaId, req.params.id);
      res.json({ ok: true, ...resultado });
    } catch (err) {
      res.status(400).json({ ok: false, erro: err.message });
    }
  });

  // Listar transações TEF da empresa
  router.get('/transacoes', (req, res) => {
    const empresaId = resolverEmpresa(req);
    const transacoes = listarTransacoesTef(empresaId, req.query);
    res.json({ ok: true, total: transacoes.length, transacoes });
  });

  // Excluir transação TEF específica
  router.delete('/transacoes/:id', (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = excluirTransacaoTef(empresaId, req.params.id);
      res.json({ ok: true, ...resultado });
    } catch (err) {
      res.status(404).json({ ok: false, erro: err.message });
    }
  });

  // Expurgar todas as transações simuladas da empresa
  router.post('/transacoes/expurgar-simuladas', (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = expurgarTransacoesSimuladas(empresaId);
      res.json({ ok: true, ...resultado });
    } catch (err) {
      res.status(500).json({ ok: false, erro: err.message });
    }
  });

  // Processar / Simular transação TEF
  router.post('/processar', (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const {
        valor,
        modalidade,
        parcelas,
        adquirenteId,
        bandeiraId,
        terminalId,
        referenciaVenda,
        clienteNome,
        operador
      } = req.body;

      if (!valor || Number(valor) <= 0) {
        return res.status(400).json({ ok: false, erro: 'Valor da transação deve ser maior que zero.' });
      }

      const transacao = processarTransacaoTef({
        empresaId,
        valor: Number(valor),
        modalidade: modalidade || 'debito',
        parcelas: Number(parcelas) || 1,
        adquirenteId: adquirenteId || 'stone',
        bandeiraId: bandeiraId || 'visa',
        terminalId,
        referenciaVenda,
        clienteNome,
        operador
      });

      res.status(201).json({
        ok: true,
        mensagem: 'Transação TEF autorizada com sucesso pela adquirente.',
        transacao
      });
    } catch (err) {
      res.status(500).json({ ok: false, erro: err.message });
    }
  });

  // Conciliar lote TEF com extrato bancário
  router.post('/conciliar-lote', (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const { extratoLinhaId, adquirenteId, dataDeposito, valorDeposito } = req.body;

      if (!valorDeposito || Number(valorDeposito) <= 0) {
        return res.status(400).json({ ok: false, erro: 'Valor do depósito no extrato deve ser maior que zero.' });
      }

      const resultado = conciliarLoteTefComExtrato(empresaId, {
        extratoLinhaId,
        adquirenteId,
        dataDeposito,
        valorDeposito: Number(valorDeposito)
      });

      res.json({ ok: true, ...resultado });
    } catch (err) {
      res.status(500).json({ ok: false, erro: err.message });
    }
  });

  // Resumo de previsões de recebíveis futuros
  router.get('/resumo-previsoes', (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resumo = resumoPrevisaoRecebiveis(empresaId);
      res.json({ ok: true, resumo });
    } catch (err) {
      res.status(500).json({ ok: false, erro: err.message });
    }
  });

  return router;
}
