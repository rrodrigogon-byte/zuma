/**
 * Definições Oficiais e Canônicas do Grupo Palatare (Holding e Empresas Controladas)
 * Fundador, Diretor-Presidente & Sócio-Controlador: Alexandre Palatare
 * Localização: Tangará da Serra/MT
 */

export const HOLDING_PALATARE_EMPRESA_ID = 'c0c0ac01-8e50-4b61-8c79-de4aaa916da0';
export const HOLDING_PALATARE_LOJA_ID = 'c0c0ac01-8e50-4b61-8c79-de4aaa916da1';

export const PALATARE_PIZZARIA_EMPRESA_ID = 'c1c1ac01-8e50-4b61-8c79-de4aaa916da9';
export const PALATARE_PIZZARIA_LOJA_ID = 'c1c1ac01-8e50-4b61-8c79-de4aaa916da0';

export const SERRANO_CONCRETO_EMPRESA_ID = 'c2c2ac01-8e50-4b61-8c79-de4aaa916da2';
export const SERRANO_CONCRETO_LOJA_ID = 'c2c2ac01-8e50-4b61-8c79-de4aaa916da0';

export const GRUPO_PALATARE_ID = 'grp-serrano-palatare-03';
export const GRUPO_PALATARE_NOME = 'Grupo Palatare';

export const HOLDING_PALATARE_EMPRESA = {
  id: HOLDING_PALATARE_EMPRESA_ID,
  nome: 'Holding Grupo Palatare',
  nomeFantasia: 'Grupo Palatare',
  razaoSocial: 'Holding Grupo Palatare Participações S/A',
  cnpj: '51.499.928/0001-01',
  cnpjNormalizado: '51499928000101',
  inscricaoEstadual: '14.229.191-9',
  inscricaoMunicipal: '92.381',
  tipoNegocio: 'holding',
  segmento: 'holding_corporativa',
  grupoId: GRUPO_PALATARE_ID,
  grupoNome: GRUPO_PALATARE_NOME,
  isHolding: true,
  fundador: 'Alexandre Palatare',
  responsavel: 'Alexandre Palatare (Fundador & Diretor-Presidente)',
  brandKey: 'holding_palatare',
  icone: '🏢',
  rotaPadrao: '/admin/concreto?secao=empresa-holding',
  descricao: 'Holding controladora fundada por Alexandre Palatare, proprietária integral da Palatare Pizzaria e Serrano Concreto.',
  ativa: true,
  lojaPadraoId: HOLDING_PALATARE_LOJA_ID,
};

export const PALATARE_PIZZARIA_EMPRESA = {
  id: PALATARE_PIZZARIA_EMPRESA_ID,
  nome: 'Palatare Pizzaria & Restaurante',
  nomeFantasia: 'Palatare Pizzaria',
  razaoSocial: 'Palatare Restaurante e Pizzaria LTDA',
  cnpj: '31.002.650/0001-08',
  cnpjNormalizado: '31002650000108',
  inscricaoEstadual: '13.782.901-4',
  inscricaoMunicipal: '84.192',
  tipoNegocio: 'restaurante',
  segmento: 'alimentacao',
  grupoId: GRUPO_PALATARE_ID,
  grupoNome: GRUPO_PALATARE_NOME,
  empresaPaiId: HOLDING_PALATARE_EMPRESA_ID,
  brandKey: 'palatare',
  icone: '🍕',
  rotaPadrao: '/admin/pizzaria',
  descricao: 'Pizzaria gourmet, forno a lenha napolitano a 400°C, rodízio premium e delivery em Tangará da Serra/MT.',
  ativa: true,
  lojaPadraoId: PALATARE_PIZZARIA_LOJA_ID,
};

export const SERRANO_CONCRETO_EMPRESA = {
  id: SERRANO_CONCRETO_EMPRESA_ID,
  nome: 'Serrano Concreto Usinado',
  nomeFantasia: 'Serrano Concreto & Mineração',
  razaoSocial: 'SERRANO CONCRETO USINADO & MINERAÇÃO LTDA',
  cnpj: '53.798.485/0001-77',
  cnpjNormalizado: '53798485000177',
  inscricaoEstadual: '14.229.191-9',
  inscricaoMunicipal: '92.381',
  tipoNegocio: 'concreto',
  segmento: 'industria_concreto',
  grupoId: GRUPO_PALATARE_ID,
  grupoNome: GRUPO_PALATARE_NOME,
  empresaPaiId: HOLDING_PALATARE_EMPRESA_ID,
  brandKey: 'concreto',
  icone: '🚚',
  rotaPadrao: '/admin/concreto',
  descricao: 'Central dosadora Convicta 80m³/h NBR 7212, silos de 96t, mineração Sepotuba e frota de betoneiras e bombas lança.',
  ativa: true,
  lojaPadraoId: SERRANO_CONCRETO_LOJA_ID,
};

export const GRUPO_PALATARE_EMPRESAS = [
  HOLDING_PALATARE_EMPRESA,
  PALATARE_PIZZARIA_EMPRESA,
  SERRANO_CONCRETO_EMPRESA,
];

export const GRUPO_PALATARE_LOJAS = [
  {
    id: HOLDING_PALATARE_LOJA_ID,
    empresaId: HOLDING_PALATARE_EMPRESA_ID,
    codigo: 'HOLDING-01',
    nome: 'Sede Corporativa Grupo Palatare',
    ativa: true
  },
  {
    id: PALATARE_PIZZARIA_LOJA_ID,
    empresaId: PALATARE_PIZZARIA_EMPRESA_ID,
    codigo: 'PALATARE-MATRIZ',
    nome: 'Palatare - Centro (Salão & Delivery)',
    ativa: true
  },
  {
    id: SERRANO_CONCRETO_LOJA_ID,
    empresaId: SERRANO_CONCRETO_EMPRESA_ID,
    codigo: 'USINA-01',
    nome: 'Serrano Concreto · Usina Matriz',
    ativa: true
  }
];

export const GRUPO_PALATARE_IDS = [
  HOLDING_PALATARE_EMPRESA_ID,
  PALATARE_PIZZARIA_EMPRESA_ID,
  SERRANO_CONCRETO_EMPRESA_ID,
];

export function isGrupoPalatareEmpresa(id) {
  if (!id) return false;
  const s = String(id).toLowerCase();
  return GRUPO_PALATARE_IDS.some(x => x.toLowerCase() === s) || s.includes('palatare') || s.includes('serrano') || s.includes('concreto');
}
