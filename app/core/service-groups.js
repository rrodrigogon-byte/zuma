/** Sugestão conservadora para cadastros antigos; nunca altera o registro. */
export function serviceGroup(service={}) {
 if(['convencionais','extras','nao_classificado'].includes(service.grupoServico))return service.grupoServico;
 const text=`${service.nome||''} ${service.categoria||''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const convencional=/\b(corte|cabelo|barba|barbear|pezinho|acabamento)\b/.test(text);
 const extra=/\b(sobrancelhas?|tintura|pigmentacao|hidratacao|selagem|unhas?|manicure|pedicure|depilacao|alisamento|progressiva|platinado)\b/.test(text);
 return convencional===extra?'nao_classificado':extra?'extras':'convencionais';
}
