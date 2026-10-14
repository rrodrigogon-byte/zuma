import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {db,reset} from './db.js';
import * as caixa from './caixa-diario-kytto.js';
import * as barbearia from './barbearia-erp-kytto.js';
const EMP='business-day-fixture',UNIT='unit-fixture';
const originalTimezone=process.env.KYTTO_TIMEZONE;
beforeEach(t=>{reset();process.env.KYTTO_TIMEZONE='America/Cuiaba';t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-14T01:00:00Z')})});
afterEach(()=>{reset();if(originalTimezone===undefined)delete process.env.KYTTO_TIMEZONE;else process.env.KYTTO_TIMEZONE=originalTimezone});
function fixture(){const service=barbearia.criarServico(EMP,{nome:'Serviço sintético',preco:1,duracaoMinutos:30});const comanda=barbearia.criarComandaBarbearia(EMP,{lojaId:UNIT,clienteNome:'Cliente sintético',itens:[{tipo:'servico',servicoId:service.id}]});const till=caixa.abrirCaixa(EMP,{lojaId:UNIT,numeroCaixa:1,valorAbertura:0,confirmado:true});return {comanda,till}}
// Executa a função de produção extraída, sem clonar sua lógica e sem iniciar servidor.
function summary(req={query:{}}){const s=readFileSync(new URL('./server.js',import.meta.url),'utf8');const start=s.indexOf('function resumoOperacaoBarbearia(req) {');const end=s.indexOf("app.get('/api/admin/barbearia/operacao/resumo'",start);assert.ok(start>0&&end>start);const fn=new Function('legacyEmpresaId','legacyLojaId','caixaKytto','barbeariaErpKytto',`${s.slice(start,end)};return resumoOperacaoBarbearia;`)(()=>EMP,()=>UNIT,caixa,barbearia);return fn(req)}
test('01h UTC ainda pertence ao dia anterior em Cuiabá, sem mudar timestamps persistidos',()=>{
 const {comanda,till}=fixture();const before=JSON.stringify(db());assert.equal(caixa.dataDia(),'2026-10-13');assert.equal(till.data,'2026-10-13');assert.equal(caixa.dataDia('2026-10-14'),'2026-10-14');assert.equal(barbearia.listarComandasBarbearia(EMP,{data:'2026-10-13',lojaId:UNIT})[0].id,comanda.id);assert.equal(barbearia.listarComandasBarbearia(EMP,{data:'2026-10-14',lojaId:UNIT}).length,0);assert.equal(JSON.stringify(db()),before);
});
test('resumo real usa o mesmo dia do caixa e da comanda; data explícita e isolamento continuam preservados',()=>{
 fixture();const before=JSON.stringify(db());const today=summary();assert.equal(today.data,'2026-10-13');assert.equal(today.caixas.length,1);assert.equal(today.comandasAbertas,1);const tomorrow=summary({query:{data:'2026-10-14'}});assert.equal(tomorrow.data,'2026-10-14');assert.equal(tomorrow.caixas.length,0);assert.equal(tomorrow.comandasAbertas,0);assert.equal(barbearia.listarComandasBarbearia(EMP,{data:'2026-10-13',lojaId:'another-unit'}).length,0);assert.equal(JSON.stringify(db()),before);
});
test('fuso UTC explícito continua respeitado e data malformada é rejeitada sem escrita',()=>{
 process.env.KYTTO_TIMEZONE='UTC';fixture();const before=JSON.stringify(db());assert.equal(caixa.dataDia(),'2026-10-14');assert.equal(summary().caixas.length,1);assert.equal(summary().comandasAbertas,1);assert.throws(()=>summary({query:{data:'data-invalid-fixture'}}),/Data operacional inválida/);assert.equal(JSON.stringify(db()),before);
});
