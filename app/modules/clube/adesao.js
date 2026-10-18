// Adesão em um passo (recepção): cadastra o sócio/aluno (e o responsável, se menor), matricula no
// plano, manda o contrato para aceite no WhatsApp e gera o Pix da 1ª mensalidade.
// Cada etapa depois da matrícula é independente: se o WhatsApp falhar, a matrícula fica e o
// resultado diz o que faltou (com o link para a recepção copiar).
import express from 'express';
import { ErroDominio, exigirUuid, exigirData, exigirTexto, responderErro, transacao } from '../acesso/banco.js';
import * as acessoRepo from '../acesso/repositorio.js';
import * as contratos from '../contratos/servico.js';
import * as retencao from '../retencao/servico.js';
import { criarClientePadrao } from '../parceiros/servico.js';
import { obterConfig as configCobranca } from '../cobrancas/servico.js';

const reais = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
const somarDias = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

async function pessoa(db, empresaId, dados, origem) {
  if (dados?.customerId) {
    const id = exigirUuid(dados.customerId, 'cliente');
    const r = await db.query('SELECT id, nome, telefone FROM commerce_customers WHERE empresa_id = $1 AND id = $2', [empresaId, id]);
    if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Cliente não encontrado nesta empresa', 404);
    return { ...r.rows[0], criado: false };
  }
  const nome = exigirTexto(dados?.nome, 'nome', { min: 3, max: 240 });
  const c = await transacao(db, (q) => criarClientePadrao(q, {
    empresaId, nome, telefone: dados?.telefone || null, email: dados?.email || null, origem,
  }));
  const r = await db.query('SELECT id, nome, telefone FROM commerce_customers WHERE empresa_id = $1 AND id = $2', [empresaId, c.id]);
  return { ...r.rows[0], criado: c.criado };
}

/**
 * @param {object} d
 * @returns resumo com o que foi feito e o que ficou pendente
 */
export async function aderir(db, empresaId, d = {}, { enviarWhatsapp = null, urlPublica = '', gerarLinkPagamento = null, operador = 'recepcao', agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const planoId = exigirUuid(d.planoId, 'plano');
  const plano = (await db.query('SELECT id, nome, valor_mensal FROM acesso_planos WHERE empresa_id = $1 AND id = $2 AND ativo', [empresa, planoId])).rows[0];
  if (!plano) throw new ErroDominio('NOT_FOUND', 'Plano não encontrado ou inativo', 404);
  const inicio = d.inicio ? exigirData(d.inicio, 'inicio') : agora.toLocaleDateString('en-CA', { timeZone: 'America/Cuiaba' });
  const pagamento = ['pix', 'balcao', 'depois'].includes(d.pagamento) ? d.pagamento : 'pix';
  const menor = d.menor === true;
  if (menor && !d.responsavel?.customerId && !d.responsavel?.nome) throw new ErroDominio('VALIDATION_ERROR', 'Informe o responsável legal do menor');

  const aluno = await pessoa(db, empresa, d.aluno || d, 'clube_recepcao');
  const responsavel = menor ? await pessoa(db, empresa, d.responsavel, 'clube_recepcao') : null;
  const contato = responsavel || aluno; // quem recebe contrato e cobrança
  // pago na recepção: cobre o 1º mês; senão vale até a véspera do início (a tolerância do plano dá o prazo do Pix)
  const pagoAte = pagamento === 'balcao' ? somarDias(inicio, 30) : somarDias(inicio, -1);
  const matricula = await acessoRepo.criarMatricula(db, empresa, { customerId: aluno.id, planoId, pagoAte, inicio });

  const resultado = {
    aluno: { id: aluno.id, nome: aluno.nome, criado: aluno.criado },
    responsavel: responsavel ? { id: responsavel.id, nome: responsavel.nome, criado: responsavel.criado } : null,
    matricula: { id: matricula.id, plano: plano.nome, pagoAte: matricula.pagoAte },
    contrato: null, pix: null, avisos: [],
  };
  const base = String(urlPublica || '').replace(/\/$/, '');
  const enviar = async (texto) => {
    if (!enviarWhatsapp || !contato.telefone) return false;
    const r = await enviarWhatsapp({ empresaId: empresa, customerId: contato.id, telefone: contato.telefone, texto });
    return !(r && r.ok === false);
  };
  if (!contato.telefone) resultado.avisos.push('Sem telefone: contrato e Pix não vão pelo WhatsApp; use os links abaixo.');

  // autorização opcional de novidades (LGPD), registrada com quem atendeu
  if (d.aceitaNovidades === true) {
    await retencao.registrarConsentimentoMarketing(db, {
      empresaId: empresa, customerId: aluno.id, concedido: true, origem: 'recepcao', operador,
      detalhe: menor ? `autorizado pelo responsável ${responsavel.nome} na adesão` : 'autorizou na adesão',
    }).catch(() => resultado.avisos.push('Não foi possível registrar a autorização de novidades.'));
  }

  // contrato: modelo informado ou o primeiro modelo ativo da empresa
  if (d.enviarContrato !== false) {
    try {
      const modelo = d.modeloCodigo
        ? { codigo: d.modeloCodigo }
        : (await db.query('SELECT codigo FROM clube_contrato_modelos WHERE empresa_id = $1 AND ativo ORDER BY criado_em LIMIT 1', [empresa])).rows[0];
      if (!modelo) {
        resultado.avisos.push('Nenhum modelo de contrato ativo: crie um em Contratos digitais.');
      } else {
        const gerado = await contratos.gerarContrato(db, empresa, {
          customerId: aluno.id, signatarioCustomerId: responsavel?.id, modeloCodigo: modelo.codigo,
          variaveis: {
            empresa: { nome: String(d.empresaNome || 'o clube').slice(0, 160) },
            plano: { nome: plano.nome, valor: plano.valor_mensal ? Number(plano.valor_mensal).toFixed(2).replace('.', ',') : 'conforme tabela vigente' },
          },
        }, { agora });
        const link = `${base}/contrato/${gerado.token}`;
        const enviado = await enviar(contratos.mensagemDeEnvio({ nome: gerado.signatario.nome, titulo: gerado.titulo, link, destaques: gerado.destaques })).catch(() => false);
        resultado.contrato = { id: gerado.contratoId, link, enviado };
        if (!enviado && contato.telefone) resultado.avisos.push('O contrato não saiu no WhatsApp: copie o link e envie.');
      }
    } catch (error) {
      resultado.avisos.push(`Contrato não gerado: ${error.message}`);
    }
  }

  // 1ª mensalidade por Pix (na conta da academia)
  if (pagamento === 'pix') {
    if (!plano.valor_mensal) resultado.avisos.push('O plano não tem mensalidade cadastrada: Pix não gerado.');
    else if (!gerarLinkPagamento || !(await configCobranca(db, empresa)).ativo) resultado.avisos.push('Cobrança por Pix desligada: ligue em Pix a confirmar → Configurar Pix.');
    else {
      try {
        const link = await gerarLinkPagamento({ empresaId: empresa, customerId: aluno.id, valor: Number(plano.valor_mensal), descricao: `1ª mensalidade — ${plano.nome}`.slice(0, 100), origem: 'recepcao', tipo: 'mensalidade' });
        if (!link) resultado.avisos.push('Pix não gerado: confira a configuração do Pix e o endereço público (PUBLIC_BASE_URL).');
        else {
          const primeiro = String(contato.nome || '').split(' ')[0];
          const texto = `${primeiro ? `${primeiro}, ` : ''}seja bem-vindo(a) ao ${String(d.empresaNome || 'clube')}! A 1ª mensalidade do plano ${plano.nome} (${reais(plano.valor_mensal)}) pode ser paga por Pix aqui: ${link}\nAssim que a recepção confirmar, a sua entrada fica liberada.`;
          const enviado = await enviar(texto).catch(() => false);
          resultado.pix = { link, valor: Number(plano.valor_mensal), enviado };
        }
      } catch (error) {
        resultado.avisos.push(`Pix não gerado: ${error.message}`);
      }
    }
  }
  return resultado;
}

export function createAdesaoRouter({ db, empresaDaRequisicao, operadorDaRequisicao, enviarWhatsapp, urlPublica, gerarLinkPagamento }) {
  const router = express.Router();
  router.use(express.json({ limit: '32kb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.post('/', async (req, res) => {
    try {
      const empresaId = await empresaDaRequisicao(req);
      const operador = operadorDaRequisicao ? operadorDaRequisicao(req) : 'recepcao';
      res.status(201).json(await aderir(db, empresaId, req.body || {}, { enviarWhatsapp, urlPublica, gerarLinkPagamento, operador }));
    } catch (error) { responderErro(res, error); }
  });
  return router;
}
