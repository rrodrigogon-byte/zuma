const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaERP.jsx', 'utf8');

const oldPayloadMulti = `                  dataAgenda: payload.dataAgenda,
                  observacoes: payload.observacoes,
                  usarPlano: payload.usarPlano === true,
                  origem: 'admin',
                  ...(payload.forcarEncaixe ? { encaixe: true } : {}),
                }`;

const newPayloadMulti = `                  dataAgenda: payload.dataAgenda,
                  observacoes: payload.observacoes,
                  duracaoMinutos: linha.duracaoMinutos,
                  valor: linha.valor,
                  usarPlano: payload.usarPlano === true,
                  origem: 'admin',
                  ...(payload.forcarEncaixe ? { encaixe: true } : {}),
                }`;

const oldPayloadSingle = `                dataAgenda: payload.dataAgenda,
                observacoes: payload.observacoes,
                usarPlano: payload.usarPlano === true,
                origem: 'admin',
                ...(payload.forcarEncaixe ? { encaixe: true } : {}),
              }`;

const newPayloadSingle = `                dataAgenda: payload.dataAgenda,
                observacoes: payload.observacoes,
                duracaoMinutos: payload.duracaoMinutos,
                valor: payload.valor,
                usarPlano: payload.usarPlano === true,
                origem: 'admin',
                ...(payload.forcarEncaixe ? { encaixe: true } : {}),
              }`;

code = code.replace(oldPayloadMulti, newPayloadMulti);
code = code.replace(oldPayloadSingle, newPayloadSingle);

fs.writeFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaERP.jsx', code, 'utf8');
console.log('Patched BarbeariaERP.jsx payloads');
