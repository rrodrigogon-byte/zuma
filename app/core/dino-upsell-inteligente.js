/**
 * ============================================================================
 * MOTOR KYTTOIA — UPSELL & CROSS-SELL CONTEXTUAL PÓS-AGENDAMENTO
 * Barbearia Dino & Kytto ERP
 * ============================================================================
 * Analisa o perfil único do cliente (serviço recém-agendado, histórico de visitas,
 * barbeiro de preferência, assinatura Club Dino e fatos gravados no Cérebro da IA)
 * e gera uma sugestão personalizada, calorosa e de alta conversão.
 * ============================================================================
 */
import * as barbearia from '../barbearia-erp-kytto.js';
import { planoDoTelefone, perfilDoTelefone } from '../dino-captacao-kytto.js';

function primeiroNomeCliente(nomeCompleto = '') {
  const limpo = String(nomeCompleto || '').trim();
  if (!limpo || /^(cliente|whatsapp|contato|usuario|usu[aá]rio)$/i.test(limpo)) return '';
  const primeiro = limpo.split(/\s+/)[0];
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
}

function fmtMoeda(valor) {
  const num = Number(valor || 0);
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Gera a oferta contextual pós-agendamento alinhada ao perfil do cliente.
 * 
 * @param {object} params
 * @param {string} params.empresaId UUID ou código da empresa
 * @param {string} params.phone Telefone canônico do cliente
 * @param {string} params.clienteNome Nome do cliente
 * @param {string} params.servicoNome Nome do serviço agendado
 * @param {string} params.profissionalNome Nome do barbeiro alocado
 * @param {Array}  params.fatos Fatos conhecidos do cliente (ai_customer_facts)
 * @param {object} params.plano Dados do pacote/plano ativo do cliente
 * @returns {string} Mensagem calorosa de upsell formatada para WhatsApp
 */
export function gerarOfertaContextualUpsell({
  empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
  phone = '',
  clienteNome = '',
  servicoNome = '',
  profissionalNome = '',
  fatos = [],
  plano = null,
} = {}) {
  try {
    const nome = primeiroNomeCliente(clienteNome);
    const trat = nome ? `Ô ${nome}` : 'Amigo';
    const srvNorm = String(servicoNome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const prof = profissionalNome || 'a equipe';

    // 1. Checagem de dados do perfil KyttoIA CRM
    const perfilCrm = phone ? perfilDoTelefone(empresaId, phone) : null;
    const planoAtivo = plano || (phone ? planoDoTelefone(empresaId, phone) : null);
    const padrao = perfilCrm?.padraoCliente || {};
    const servicosHabituais = padrao.servicoHabitual ? String(padrao.servicoHabitual).toLowerCase() : '';

    // Mapeamento de fatos memorizados no cérebro
    const fatosLista = Array.isArray(fatos) ? fatos : [];
    const temFatoBarba = fatosLista.some((f) => /barba/i.test(String(f.valor || f.chave || f.tipo || '')));
    const temFatoPerfume = fatosLista.find((f) => f.categoria === 'produto_interesse' || f.categoria === 'familia_olfativa');
    const temFatoPomada = fatosLista.some((f) => /pomada|matte/i.test(String(f.valor || f.chave || f.tipo || '')));

    const ehCombo = srvNorm.includes('combo') || ((srvNorm.includes('corte') || srvNorm.includes('cabelo')) && srvNorm.includes('barba'));
    const ehCorte = !ehCombo && (srvNorm.includes('corte') || srvNorm.includes('cabelo'));
    const ehBarba = !ehCombo && srvNorm.includes('barba');

    // Produtos oficiais de bancada da Barbearia Dino
    const prods = barbearia.listarProdutosRevenda?.(empresaId, { incluirInativos: false }) || [];
    const pomada = prods.find((p) => p.ativo !== false && /pomada.*matte/i.test(p.nome))
      || prods.find((p) => p.ativo !== false && /pomada/i.test(p.nome))
      || { nome: 'Pomada Modeladora Efeito Matte Dino (150g)', precoVenda: 65 };
    const oleo = prods.find((p) => p.ativo !== false && /oleo|óleo/i.test(p.nome) && /barba/i.test(p.nome))
      || prods.find((p) => p.ativo !== false && /oleo|óleo/i.test(p.nome))
      || { nome: 'Óleo Hidratante de Barba Dino', precoVenda: 55 };

    // REGRA 0: Assinante do Club Dino (Benefício VIP Exclusivo de 10% de desconto em bancada)
    if (planoAtivo) {
      return `💡 *Benefício VIP Club Dino:* Como assinante do Clube, você tem 10% de desconto exclusivo em qualquer produto da bancada! Deseja que eu já separe sua *${pomada.nome}* ou *${oleo.nome}* para retirada no atendimento?`;
    }

    // REGRA 1: Cliente agendou somente CORTE
    if (ehCorte) {
      // Se costuma fazer barba, tem fato de barba ou pacote de barba
      if (temFatoBarba || servicosHabituais.includes('barba')) {
        return `💡 *Dica do T-Rex:* ${trat}, que tal já aproveitar a cadeira com ${prof} e dar aquele talento na *Barba* também pra sair 100% alinhado? Se quiser, já encaixo o combo pra você! 💈`;
      }
      if (temFatoPomada) {
        return `💡 *Dica do T-Rex:* ${trat}, quer que eu já deixe separada a nossa *${pomada.nome}* (${fmtMoeda(pomada.precoVenda)}) pra você manter o penteado alinhado em casa? É só me avisar!`;
      }
      // Se não faz barba com frequência, oferece produto de finalização ou sobrancelha
      return `💡 *Dica do T-Rex:* ${trat}, que tal já aproveitar a cadeira com ${prof} e alinhar a *Barba* ou a *Sobrancelha* também pra sair no capricho? Se quiser, já encaixo pra você! Ou prefere que eu separe a nossa *${pomada.nome}* (${fmtMoeda(pomada.precoVenda)})?`;
    }

    // REGRA 2: Cliente agendou somente BARBA
    if (ehBarba) {
      if (servicosHabituais.includes('corte') || padrao.visitasTotais > 1) {
        return `💡 *Dica do T-Rex:* ${trat}, que tal já aproveitar a vinda e dar aquele talento no *Corte de Cabelo* ou alinhar a sobrancelha junto com a barba? Quer que eu já reserve com ${prof}?`;
      }
      return `💡 *Dica do T-Rex:* Quer que eu já deixe separado o nosso *${oleo.nome}* (${fmtMoeda(oleo.precoVenda)}) pra manter a barba macia e hidratada? É só me avisar! 💈`;
    }

    // REGRA 3: Cliente agendou COMBO COMPLETO (Corte + Barba)
    if (ehCombo) {
      // Se tem interesse em perfumaria registrado no cérebro
      if (temFatoPerfume) {
        const itemPerfume = temFatoPerfume.valor || 'perfumaria importada';
        return `💡 *Dica do T-Rex:* ${trat}, chegaram novidades da nossa linha de *${itemPerfume}* na bancada! Deseja experimentar na sua vinda?`;
      }
      // Se é cliente recorrente (2+ visitas) sem plano
      if (padrao.visitasTotais >= 2) {
        return `💡 *Dica do Dino:* Sabia que você pode economizar até 30% e cortar com prioridade sendo membro do *Club Dino*? Se quiser, já te envio o link dos pacotes mensais! Ou prefere que eu separe a *${pomada.nome}* (${fmtMoeda(pomada.precoVenda)}) pra sua retirada?`;
      }
      // Experiência relaxante de bem-estar ou produto
      return `💡 *Dica do T-Rex:* Para completar a resenha, que tal adicionar um *Banho de Gelo relaxante* ou já deixar reservada a sua *${pomada.nome}* (${fmtMoeda(pomada.precoVenda)})? É só me avisar! 💈`;
    }

    // REGRA 4: Caso padrão / outros serviços
    if (planoAtivo) {
      return `💡 *Benefício Club Dino:* Como assinante, você tem 10% de desconto em qualquer produto de bancada! Deseja que eu já reserve sua *${pomada.nome}* ou *${oleo.nome}*?`;
    }

    return `💡 *Dica do Dino:* Deseja que eu já deixe separada sua *${pomada.nome}* (${fmtMoeda(pomada.precoVenda)}) ou o *${oleo.nome}* (${fmtMoeda(oleo.precoVenda)}) para retirada no atendimento? É só me avisar!`;
  } catch (err) {
    return '💡 *Dica do Dino:* Deseja que eu já separe sua Pomada Modeladora Efeito Matte Dino (150g) para retirada no atendimento? É só me avisar!';
  }
}

export default {
  gerarOfertaContextualUpsell,
};
