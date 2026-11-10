/**
 * Rotas de Boletos Bancários Registrados e Pix Híbrido Kytto
 */

import { Router } from 'express';
import { emitirBoletoHibrido, renderizarBoletoHtml, BANCOS_BOLETO } from '../core/boleto-hibrido-brasil.js';

// Repositório em memória para persistência dos boletos
const boletosCadastrados = new Map();

export function createBoletosRouter({ auth, obterEmpresaId }) {
  const router = Router();

  if (typeof auth === 'function') {
    router.use(auth);
  }

  // Lista bancos disponíveis para emissão de boleto
  router.get('/bancos', (req, res) => {
    return res.json({
      sucesso: true,
      bancos: Object.values(BANCOS_BOLETO),
    });
  });

  // Lista boletos emitidos da empresa
  router.get('/', (req, res) => {
    const empresaId = typeof obterEmpresaId === 'function' ? obterEmpresaId(req) : req.empresaId;
    const lista = Array.from(boletosCadastrados.values())
      .filter(b => !empresaId || b.empresaId === empresaId);

    // Se estiver vazio, retorna um exemplo para demonstração
    if (lista.length === 0) {
      const exemplo = emitirBoletoHibrido({
        banco: '748',
        valor: 150.00,
        vencimento: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        pagadorNome: 'Rodrigo Ribeiro Gonçalves',
        pagadorDocumento: '123.456.789-00',
        beneficiarioNome: 'DINO BARBEARIA LTDA',
        beneficiarioCnpj: '50.073.355/0002-60',
      });
      exemplo.empresaId = empresaId || 'd0d0ac01-8e50-4b61-8c79-de4aaa914ef0';
      boletosCadastrados.set(exemplo.id, exemplo);
      lista.push(exemplo);
    }

    return res.json({
      sucesso: true,
      total: lista.length,
      boletos: lista,
    });
  });

  // Emite novo boleto bancário híbrido
  router.post('/emitir', (req, res) => {
    try {
      const empresaId = typeof obterEmpresaId === 'function' ? obterEmpresaId(req) : req.empresaId;
      const boleto = emitirBoletoHibrido({
        ...req.body,
        beneficiarioNome: req.body.beneficiarioNome || 'DINO BARBEARIA LTDA',
        beneficiarioCnpj: req.body.beneficiarioCnpj || '50.073.355/0002-60',
      });
      boleto.empresaId = empresaId;
      boletosCadastrados.set(boleto.id, boleto);

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Boleto bancário híbrido emitido com sucesso!',
        boleto,
      });
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Obter detalhes de um boleto
  router.get('/:id', (req, res) => {
    const boleto = boletosCadastrados.get(req.params.id);
    if (!boleto) {
      return res.status(404).json({ sucesso: false, erro: 'Boleto não encontrado.' });
    }
    return res.json({ sucesso: true, boleto });
  });

  // Renderizar HTML imprimível do boleto
  router.get('/:id/html', (req, res) => {
    const boleto = boletosCadastrados.get(req.params.id);
    if (!boleto) {
      return res.status(404).send('<h1>Boleto não encontrado</h1>');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderizarBoletoHtml(boleto));
  });

  return router;
}
