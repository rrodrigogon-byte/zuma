// Calendário contratual da Dino: aniversário preservado no fuso operacional.
const zone = 'America/Cuiaba';
const formatter = new Intl.DateTimeFormat('en-CA', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function parts(ms) {return Object.fromEntries(formatter.formatToParts(new Date(ms)).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));}
function zoned(p, milliseconds=0) {
  const wall=Date.UTC(p.year,p.month-1,p.day,p.hour||0,p.minute||0,p.second||0,milliseconds);
  let result=wall;
  for(let i=0;i<3;i++){const actual=parts(result);const offset=Date.UTC(actual.year,actual.month-1,actual.day,actual.hour,actual.minute,actual.second)-Math.floor(result/1000)*1000;result=wall-offset;}
  return result;
}
export function subscriptionStart(value) {
  if(/^\d{4}-\d{2}-\d{2}$/.test(String(value))){const [year,month,day]=value.split('-').map(Number);const ms=zoned({year,month,day});const p=parts(ms);if(p.year!==year||p.month!==month||p.day!==day)throw new Error('Data de início inválida.');return new Date(ms).toISOString();}
  const ms=new Date(value).valueOf();if(!Number.isFinite(ms))throw new Error('Data de início inválida.');return new Date(ms).toISOString();
}
export function anniversaryBoundary(inicio, index, ciclo='mensal') {
  const ms=new Date(inicio).valueOf(),p=parts(ms),step=ciclo==='anual'?12:ciclo==='trimestral'?3:1;
  const total=p.year*12+p.month-1+index*step,year=Math.floor(total/12),month=total%12+1;
  const day=Math.min(p.day,new Date(Date.UTC(year,month,0)).getUTCDate());
  return zoned({...p,year,month,day},((ms%1000)+1000)%1000);
}
export function subscriptionCycle(assinatura,plano,ms) {
  const inicio=new Date(assinatura.inicio).valueOf();
  if(plano?.regraRenovacao!=='aniversario'){
    const span=Math.max(1,Number(plano?.validadeDias)||30)*86400000,indice=Number.isFinite(inicio)&&ms>=inicio?Math.floor((ms-inicio)/span):0;
    const start=Number.isFinite(inicio)?inicio:ms;return {indice,inicio:start+indice*span,fim:start+(indice+1)*span};
  }
  const start=parts(inicio),now=parts(ms),step=plano.ciclo==='anual'?12:plano.ciclo==='trimestral'?3:1;
  let indice=Math.max(0,Math.floor(((now.year-start.year)*12+now.month-start.month)/step));
  if(indice>0&&ms<anniversaryBoundary(assinatura.inicio,indice,plano.ciclo))indice--;
  return {indice,inicio:anniversaryBoundary(assinatura.inicio,indice,plano.ciclo),fim:anniversaryBoundary(assinatura.inicio,indice+1,plano.ciclo)};
}
