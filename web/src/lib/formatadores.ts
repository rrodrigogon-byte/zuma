/**
 * Formatação, validação de dígitos verificadores e consultas BrasilAPI (Frontend Kytto)
 */

export const FUSO_PADRAO_BRASIL = 'America/Cuiaba';

const fmtMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmtPercentual = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const fmtBalanca = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const fmtDataCuiaba = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_PADRAO_BRASIL,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const fmtDataHoraCuiaba = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_PADRAO_BRASIL,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatarMoeda(valor: unknown): string {
  const num = Number(valor);
  if (!Number.isFinite(num)) return fmtMoeda.format(0);
  return fmtMoeda.format(num);
}

export function formatarPercentual(valor: unknown): string {
  const num = Number(valor);
  if (!Number.isFinite(num)) return `${fmtPercentual.format(0)}%`;
  return `${fmtPercentual.format(num)}%`;
}

export function formatarQuantidadeBalanca(valor: unknown, unidade = ''): string {
  const num = Number(valor);
  const formatado = fmtBalanca.format(Number.isFinite(num) ? num : 0);
  return unidade ? `${formatado} ${unidade}` : formatado;
}

export function formatarDataCuiaba(valor: unknown): string {
  if (!valor) return '—';
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor.trim())) {
    const [ano, mes, dia] = valor.trim().split('-');
    return `${dia}/${mes}/${ano}`;
  }
  const dt = valor instanceof Date ? valor : new Date(String(valor));
  if (Number.isNaN(dt.valueOf())) return '—';
  return fmtDataCuiaba.format(dt);
}

export function formatarDataHoraCuiaba(valor: unknown): string {
  if (!valor) return '—';
  const dt = valor instanceof Date ? valor : new Date(String(valor));
  if (Number.isNaN(dt.valueOf())) return '—';
  return fmtDataHoraCuiaba.format(dt).replace(', ', ' às ');
}

export function validarCpf(cpf: string): boolean {
  const limpo = String(cpf || '').replace(/\D/g, '');
  if (limpo.length !== 11 || /^(\d)\1{10}$/.test(limpo)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(limpo[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(limpo[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(limpo[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === Number(limpo[10]);
}

export function mascararCpf(cpf: string): string {
  const d = String(cpf || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

export function validarCnpj(cnpj: string): boolean {
  const limpo = String(cnpj || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (limpo.length !== 14 || !/^[0-9A-Z]{12}\d{2}$/.test(limpo) || /^([0-9A-Z])\1{13}$/.test(limpo)) return false;
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const valorChar = (ch: string) => ch.charCodeAt(0) - 48;
  let soma1 = 0;
  for (let i = 0; i < 12; i++) soma1 += valorChar(limpo[i]) * pesos1[i];
  const resto1 = soma1 % 11;
  const dv1 = resto1 < 2 ? 0 : 11 - resto1;
  if (dv1 !== Number(limpo[12])) return false;
  let soma2 = 0;
  for (let i = 0; i < 13; i++) soma2 += valorChar(limpo[i]) * pesos2[i];
  const resto2 = soma2 % 11;
  const dv2 = resto2 < 2 ? 0 : 11 - resto2;
  return dv2 === Number(limpo[13]);
}

export function mascararCnpj(cnpj: string): string {
  const d = String(cnpj || '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

export function validarCep(cep: string): boolean {
  return /^\d{8}$/.test(String(cep || '').replace(/\D/g, ''));
}

export function mascararCep(cep: string): string {
  const d = String(cep || '').replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function validarTelefone(telefone: string): boolean {
  const d = String(telefone || '').replace(/\D/g, '');
  const local = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d;
  return /^[1-9]{2}(?:9\d{8}|[2-5]\d{7})$/.test(local);
}

export function mascararTelefone(telefone: string): string {
  let d = String(telefone || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function validarPlacaMercosul(placa: string): boolean {
  const limpo = String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(limpo);
}

export function validarChavePix(chave: string): boolean {
  const valor = String(chave || '').trim();
  if (!valor) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return true;
  if (/^\+55\d{10,11}$/.test(valor)) return true;
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length === 11 && (validarCpf(digitos) || validarTelefone(digitos))) return true;
  if (valor.replace(/[^0-9A-Za-z]/g, '').length === 14 && validarCnpj(valor)) return true;
  return false;
}

export function validarChaveAcessoNfe(chave: string): boolean {
  const d = String(chave || '').replace(/\D/g, '');
  if (d.length !== 44) return false;
  let peso = 2;
  let soma = 0;
  for (let i = 42; i >= 0; i--) {
    soma += Number(d[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto === 0 || resto === 1 ? 0 : 11 - resto;
  return dv === Number(d[43]);
}

export function validarNcm(ncm: string): boolean {
  return /^\d{8}$/.test(String(ncm || '').replace(/\D/g, ''));
}

export function validarCest(cest: string): boolean {
  return /^\d{7}$/.test(String(cest || '').replace(/\D/g, ''));
}
