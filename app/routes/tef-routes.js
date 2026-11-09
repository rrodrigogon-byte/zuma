/**
 * Rotas de TEF e Maquininhas de Cartão do Brasil
 */

import { Router } from 'express';
import {
  ADQUIRENTES_BRASIL,
  BANDEIRAS_BRASIL,
  obterConfiguracoesTef,
  salvarConfiguracoesTef,
  processarTransacaoTef,
  listarTransacoesTef,
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
    return req.headers['x-empresa-id'] || req.user?.empresaId || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
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

  // Listar transações TEF da empresa
  router.get('/transacoes', (req, res) => {
    const empresaId = resolverEmpresa(req);
    const transacoes = listarTransacoesTef(empresaId, req.query);
    res.json({ ok: true, total: transacoes.length, transacoes });
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
        return res.status(400).json({ ok: false, erro: 'Valor do depósito deve ser informado.' });
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

  // Resumo de Previsão de Recebíveis de Cartão
  router.get('/resumo-previsoes', (req, res) => {
    const empresaId = resolverEmpresa(req);
    const resumo = resumoPrevisaoRecebiveis(empresaId);
    res.json({ ok: true, resumo });
  });

  return router;
}
