// ============================================================================
// MOTOR DE VENDAS & PACOTES MENSAIS DO T-REX (KYTTOIA 2.5 FLASH)
// Implementa inteligência de vendas ativa, cálculo de economia de pacotes mensais,
// enriquecimento de redes sociais (Instagram/LinkedIn), aniversários e upsell.
// ============================================================================

import { db } from './database.js';

export const REGRAS_DESCONTO_PACOTES = [
  { sessoes: 4, descontoPercentual: 10, label: 'Pacote 4 Procedimentos (10% OFF)' },
  { sessoes: 6, descontoPercentual: 15, label: 'Pacote 6 Procedimentos (15% OFF)' },
  { sessoes: 8, descontoPercentual: 20, label: 'Pacote 8 Procedimentos (20% OFF - VIP)' },
];

/**
 * Calcula a tabela de pacotes mensais para um serviço e profissional específico
 * @param {Object} params
 * @param {string} params.profissionalNome Nome do barbeiro
 * @param {number} params.valorServico Preço unitário do corte/barba
 * @param {string} params.servicoNome Nome do procedimento
 */
export function calcularPacotesMensais({
  profissionalNome = 'Equipe Titular',
  valorServico = 100.0,
  servicoNome = 'Corte Masculino Premium',
} = {}) {
  const preco = Number(valorServico) || 100.0;
  
  const pacotes = REGRAS_DESCONTO_PACOTES.map((regra) => {
    const valorCheio = preco * regra.sessoes;
    const valorDesconto = (valorCheio * regra.descontoPercentual) / 100.0;
    const valorFinal = valorCheio - valorDesconto;
    const valorPorSessao = valorFinal / regra.sessoes;

    return {
      sessoes: regra.sessoes,
      descontoPercentual: regra.descontoPercentual,
      valorCheio,
      valorDesconto,
      valorFinal,
      valorPorSessao,
      economiaRealFormatada: `R$ ${valorDesconto.toFixed(2).replace('.', ',')}`,
      valorFinalFormatado: `R$ ${valorFinal.toFixed(2).replace('.', ',')}`,
      valorCheioFormatado: `R$ ${valorCheio.toFixed(2).replace('.', ',')}`,
      valorPorSessaoFormatado: `R$ ${valorPorSessao.toFixed(2).replace('.', ',')}`,
    };
  });

  return {
    profissionalNome,
    servicoNome,
    valorUnitario: preco,
    valorUnitarioFormatado: `R$ ${preco.toFixed(2).replace('.', ',')}`,
    pacotes,
  };
}

/**
 * Gera o texto persuasivo e natural do T-Rex para oferta de pacote mensal
 */
export function gerarScriptVendaPacotes({
  clienteNome = 'Amigo',
  frequenciaDias = 15,
  profissionalNome = 'Nati',
  valorServico = 100.0,
  servicoNome = 'Corte Premium',
} = {}) {
  const primeiroNome = String(clienteNome || 'Amigo').trim().split(/\s+/)[0];
  const calculo = calcularPacotesMensais({ profissionalNome, valorServico, servicoNome });
  
  const p4 = calculo.pacotes.find((p) => p.sessoes === 4);
  const p6 = calculo.pacotes.find((p) => p.sessoes === 6);
  const p8 = calculo.pacotes.find((p) => p.sessoes === 8);

  return (
    `Show, ${primeiroNome}! Horário garantido. 💈\n\n` +
    `Como você costuma cortar o cabelo a cada ${frequenciaDias} dias, você sabia que temos nossos *Pacotes Mensais VIP do Dino* pra você economizar e já travar seus horários no mês com a ${profissionalNome}?\n\n` +
    `• *4 procedimentos (10% OFF):* de ${p4.valorCheioFormatado} por apenas *${p4.valorFinalFormatado}* (Economia de *${p4.economiaRealFormatada}*!)\n` +
    `• *6 procedimentos (15% OFF):* de ${p6.valorCheioFormatado} por apenas *${p6.valorFinalFormatado}* (Economia de *${p6.economiaRealFormatada}*!)\n` +
    `• *8 procedimentos (20% OFF):* de ${p8.valorCheioFormatado} por apenas *${p8.valorFinalFormatado}* (Economia de *${p8.economiaRealFormatada}*!)\n\n` +
    `Se você quiser, já deixo o pacote ativado no seu cadastro e reservo suas próximas quinzenas com prioridade. O que acha?`
  );
}

/**
 * Gera mensagem de aniversário no estilo caloroso do Dino
 */
export function gerarMensagemAniversariante({
  clienteNome = 'Amigo',
  profissionalFavorito = 'Nati ou Bruno',
} = {}) {
  const primeiroNome = String(clienteNome || 'Amigo').trim().split(/\s+/)[0];

  return {
    texto:
      `Fala, ${primeiroNome}! Grande abraço aqui do T-Rex e de toda a equipe da Barbearia Dino! 🎉🎂\n\n` +
      `Hoje é o seu aniversário e a gente não podia deixar passar em branco: o Dino mandou avisar que no seu corte dessa semana você tem direito a um *Café Espresso Duplo Gourmet* ou um *Chope Artesanal bem gelado* por nossa conta no bar, além de um *giro extra na Roleta de Prêmios*! 💈🍺\n\n` +
      `Bora garantir seu horário com o ${profissionalFavorito} pra comemorar alinhado? É só me falar o dia que eu já reservo pra você!`,
    brindes: ['Chope Artesanal', 'Café Espresso Gourmet', 'Giro Extra na Roleta'],
  };
}

/**
 * Extrai perfis sociais (Instagram / LinkedIn) e data de aniversário da mensagem
 */
export function extrairSocialCrm(texto = '') {
  const cleanText = String(texto || '').trim();
  const dados = {};

  // 1. Extração de Instagram
  // Ex: @rodrigo_silva, instagram.com/rodrigo_silva, insta: @rodrigo
  const instaRegex = /(?:@|(?:https?:\/\/)?(?:www\.)?instagram\.com\/|insta(?:\s*:\s*|\s+))([a-zA-Z0-9._]{2,30})/i;
  const matchInsta = cleanText.match(instaRegex);
  if (matchInsta && matchInsta[1]) {
    const handle = matchInsta[1].replace(/^@/, '');
    if (!['dino', 'dino_barbearia', 'barbearia', 'gmail', 'hotmail'].includes(handle.toLowerCase())) {
      dados.instagram = `@${handle}`;
    }
  }

  // 2. Extração de LinkedIn
  // Ex: linkedin.com/in/rodrigo-goncalves
  const linkedinRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]{3,50})/i;
  const matchLinkedin = cleanText.match(linkedinRegex);
  if (matchLinkedin && matchLinkedin[1]) {
    dados.linkedin = `https://www.linkedin.com/in/${matchLinkedin[1]}`;
  }

  // 3. Extração de Aniversário
  // Ex: "faço dia 15/08", "aniversario 20 de maio", "meu niver é 05/11", "nasci 12/04/1990"
  const aniverRegex1 = /(?:anivers[aá]rio|niver|nasci|fa[cç]o\s+(?:anos|dia)?)\s*(?:[eé:]|\s+no\s+dia|\s+dia)?\s*(\d{1,2})[\/\-](\d{1,2})/i;
  const matchAniver1 = cleanText.match(aniverRegex1);
  if (matchAniver1) {
    const dia = matchAniver1[1].padStart(2, '0');
    const mes = matchAniver1[2].padStart(2, '0');
    dados.aniversario = `${dia}/${mes}`;
  } else {
    const meses = {
      janeiro: '01', fevereiro: '02', marco: '03', março: '03', abril: '04',
      maio: '05', junho: '06', julho: '07', agosto: '08', setembro: '09',
      outubro: '10', novembro: '11', dezembro: '12'
    };
    const aniverRegex2 = new RegExp(`(?:anivers[aá]rio|niver|fa[cç]o|dia)\\s*(\\d{1,2})\\s+de\\s+(${Object.keys(meses).join('|')})`, 'i');
    const matchAniver2 = cleanText.match(aniverRegex2);
    if (matchAniver2) {
      const dia = matchAniver2[1].padStart(2, '0');
      const mes = meses[matchAniver2[2].toLowerCase()];
      dados.aniversario = `${dia}/${mes}`;
    }
  }

  return dados;
}

/**
 * Salva metadados enriquecidos no cadastro do cliente no PostgreSQL
 */
export async function salvarSocialCrmNoCliente(empresaId, telefone, dados = {}) {
  if (!empresaId || !telefone || Object.keys(dados).length === 0) return { ok: false };

  try {
    const tagsParaAdicionar = [];
    if (dados.instagram) tagsParaAdicionar.push(`instagram:${dados.instagram}`);
    if (dados.linkedin) tagsParaAdicionar.push(`linkedin:${dados.linkedin}`);
    if (dados.aniversario) tagsParaAdicionar.push(`aniversario:${dados.aniversario}`);

    if (tagsParaAdicionar.length > 0 && typeof db?.query === 'function') {
      await db.query(
        `UPDATE clientes
            SET tags = COALESCE(tags, '[]'::jsonb) || $1::jsonb
          WHERE empresa_id = $2 AND right(regexp_replace(telefone, '\\D', '', 'g'), 8) = right(regexp_replace($3, '\\D', '', 'g'), 8)`,
        [JSON.stringify(tagsParaAdicionar), empresaId, telefone]
      );
    }
    return { ok: true, tagsAdicionadas: tagsParaAdicionar };
  } catch (err) {
    return { ok: false, erro: err.message };
  }
}
