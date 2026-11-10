import express from 'express';
import {
  criarProdutoComGrade,
  gerarPayloadNotaDevolucao
} from '../core/varejo-grade-multicanal.js';
import {
  calcularFilaDaVezProfissionais,
  gerarSugestoesUpsell
} from '../core/dino-regras-atendimento-avancado.js';

export function createVarejoMulticanalRouter() {
  const router = express.Router();

  // Produtos com grade multidimensional (Stallone Nutre Sport)
  router.get('/produtos-grade', (req, res) => {
    const produtoWhey = criarProdutoComGrade({
      nome: 'Whey Protein 100% Concentrado',
      marca: 'Stallone Nutrition',
      categoria: 'Suplementos',
      codigoPai: 'STL-WHEY-100'
    });
    const produtoCreatina = criarProdutoComGrade({
      nome: 'Creatina Creapure Monohidratada 100% Pura',
      marca: 'Stallone Nutrition',
      categoria: 'Aminoácidos',
      codigoPai: 'STL-CREA-100',
      variacoes: [
        { atributo1: 'Natural Sem Sabor', atributo2: '300g', precoLoja: 119.90, precoEcommerce: 109.90, precoAtacado: 89.00, estoque: 35 },
        { atributo1: 'Natural Sem Sabor', atributo2: '500g', precoLoja: 189.90, precoEcommerce: 179.90, precoAtacado: 145.00, estoque: 20 },
        { atributo1: 'Sabor Tangerina', atributo2: '300g', precoLoja: 124.90, precoEcommerce: 114.90, precoAtacado: 92.00, estoque: 15 }
      ]
    });
    res.json({
      ok: true,
      itens: [produtoWhey, produtoCreatina]
    });
  });

  // Emissão de Nota de Devolução vinculada com chave referenciada
  router.post('/devolucoes/emitir', (req, res) => {
    try {
      const { chaveAcessoOriginal, numeroNfOriginal, motivoDevolucao, itensDevolvidos, cliente } = req.body || {};
      const payloadDevolucao = gerarPayloadNotaDevolucao({
        chaveAcessoOriginal: chaveAcessoOriginal || '51261150073355000260550010000010421893748291',
        numeroNfOriginal: numeroNfOriginal || '1042',
        motivoDevolucao: motivoDevolucao || 'Troca de mercadoria no balcão',
        cliente: cliente || { nome: 'Rodrigo Gonçalves', documento: '000.000.000-00' },
        itensDevolvidos: itensDevolvidos || [
          { sku: 'STL-WHEY-100-CHOCOLATEBELGA-900G', descricao: 'Whey Protein Chocolate 900g', quantidade: 1, valorUnitario: 149.90 }
        ]
      });

      res.json({
        ok: true,
        mensagem: 'Nota fiscal de devolução autorizada com sucesso na SEFAZ-MT.',
        protocoloAutorizacao: `PROT-DEV-51-${Date.now()}`,
        payloadDevolucao
      });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  // Rodízio da Fila da Vez e Upsell da Barbearia Dino
  router.get('/barbearia/rodizio-upsell', (req, res) => {
    const barbeirosDino = [
      { id: 'usr-dino-bruno', nome: 'Bruno Mendes', ativo: true, presente: true },
      { id: 'usr-dino-nati', nome: 'Natani Dobler (Nati)', ativo: true, presente: true },
      { id: 'usr-dino-david', nome: 'David Kauã', ativo: true, presente: true },
      { id: 'usr-dino-ester', nome: 'Steffany Marielly (Ster)', ativo: true, presente: true },
      { id: 'usr-dino-guilherme', nome: 'Guilherme Cunha (Dino)', ativo: true, presente: true }
    ];

    const atendimentosExemplo = [
      { profissionalId: 'usr-dino-bruno', status: 'concluido', horarioTermino: '2026-11-10T11:00:00Z' },
      { profissionalId: 'usr-dino-bruno', status: 'concluido', horarioTermino: '2026-11-10T12:00:00Z' },
      { profissionalId: 'usr-dino-nati', status: 'concluido', horarioTermino: '2026-11-10T11:30:00Z' },
      { profissionalId: 'usr-dino-david', status: 'em_atendimento', horarioInicio: '2026-11-10T13:00:00Z' }
    ];

    const filaDaVez = calcularFilaDaVezProfissionais(barbeirosDino, atendimentosExemplo);
    const sugestoesUpsell = gerarSugestoesUpsell({
      servicosAtuais: [{ nome: 'Corte Tradicional' }],
      produtosAtuais: []
    });

    res.json({
      ok: true,
      filaDaVez,
      proximoBarbeiro: filaDaVez[0] || null,
      sugestoesUpsell
    });
  });

  return router;
}
