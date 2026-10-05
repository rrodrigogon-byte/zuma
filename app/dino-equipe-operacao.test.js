import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { reset } from './db.js';
import * as erp from './barbearia-erp-kytto.js';
import { catalogoEquipe, agendaPeriodoEquipe, lancarComandaEquipe } from './dino-equipe-operacao.js';
beforeEach(()=>reset());afterEach(()=>reset());
function base() {
 const p=erp.criarProfissional('a',{nome:'Bruno',email:'bruno@example.test'});
 const outro=erp.criarProfissional('a',{nome:'Dino',email:'dino@example.test'});
 const s=erp.criarServico('a',{nome:'Corte',preco:50,duracaoMinutos:30,profissionaisIds:[p.id]});
 const produto=erp.criarProdutoRevenda('a',{nome:'Pomada',precoVenda:30,estoqueAtual:3});
 const ctx={empresaId:'a',lojaId:'matriz',usuario:{role:'staff',email:'bruno@example.test'},profissionalId:p.id};
 const body={clienteNome:'Cliente de teste',itens:[{tipo:'servico',servicoId:s.id,quantidade:1},{tipo:'produto',produtoId:produto.id,quantidade:1}]};
 return {p,outro,s,produto,ctx,body};
}
const key='operacao-teste-123456';
test('venda recalcula preços, fica pendente e retry não duplica nem baixa estoque',()=>{
 const {ctx,body,produto}=base();body.itens[0].precoUnitario=0.01;body.profissionalId='invasor';
 const a=lancarComandaEquipe(erp,ctx,body,key),b=lancarComandaEquipe(erp,ctx,body,key);
 assert.equal(a.total,80);assert.equal(a.status,'aberta');assert.equal(a.totalPago,0);assert.equal(a.id,b.id);assert.equal(b.idempotente,true);
 assert.equal(erp.listarComandasBarbearia('a').length,1);assert.equal(erp.listarProdutosRevenda('a').find(p=>p.id===produto.id).estoqueAtual,3);
 assert.throws(()=>lancarComandaEquipe(erp,ctx,{...body,clienteNome:'Outro'},key),e=>e.code==='IDEMPOTENCIA_CONFLITO');
});
test('bloqueia outro profissional, outra empresa, serviço não habilitado e estoque agregado',()=>{
 const {ctx,body,outro,produto}=base();
 assert.throws(()=>catalogoEquipe(erp,{...ctx,profissionalId:outro.id}),e=>e.status===403);
 assert.throws(()=>catalogoEquipe(erp,{...ctx,empresaId:'b'}),e=>e.status===403);
 const fora=erp.criarServico('a',{nome:'Química',preco:100,duracaoMinutos:60,profissionaisIds:[outro.id]});
 assert.equal(catalogoEquipe(erp,ctx).servicos.some(s=>s.id===fora.id),false);
 assert.throws(()=>lancarComandaEquipe(erp,ctx,{...body,itens:[{tipo:'servico',servicoId:fora.id,quantidade:1}]},key),e=>e.code==='ITEM_INDISPONIVEL');
 assert.throws(()=>lancarComandaEquipe(erp,ctx,{...body,itens:[{tipo:'produto',produtoId:produto.id,quantidade:2},{tipo:'produto',produtoId:produto.id,quantidade:2}]},key),e=>e.code==='ESTOQUE_INSUFICIENTE');
 assert.equal(erp.listarComandasBarbearia('a').length,0);
});
test('comanda inválida não fica gravada parcialmente',()=>{
 const {ctx,p,s}=base();
 assert.throws(()=>erp.criarComandaBarbearia(ctx.empresaId,{profissionalId:p.id,itens:[{tipo:'servico',servicoId:s.id},{tipo:'produto',produtoId:'inexistente'}]}));
 assert.equal(erp.listarComandasBarbearia('a').length,0);
});
test('agenda aceita vários profissionais e exclui os demais, período do PWA respeita vínculo',()=>{
 const {p,outro,s,ctx}=base();
 const terceiro=erp.criarProfissional('a',{nome:'Carlos'});
 const livre=erp.criarServico('a',{nome:'Barba',preco:30,duracaoMinutos:30});
 for(const profissionalId of [p.id,outro.id,terceiro.id])erp.criarAgendamento('a',{clienteNome:'Teste',profissionalId,servicoId:livre.id,dataHora:'2026-10-09T14:00:00-04:00',dataAgenda:'2026-10-09',lojaId:'matriz'});
 assert.equal(erp.listarAgendamentos('a',{profissionalId:`${p.id},${outro.id}`}).length,2);
 assert.equal(agendaPeriodoEquipe(erp,ctx,'2026-10-01','2026-10-31').itens.length,1);
 assert.throws(()=>agendaPeriodoEquipe(erp,{...ctx,profissionalId:outro.id},'2026-10-01','2026-10-31'),e=>e.status===403);
 assert.throws(()=>agendaPeriodoEquipe(erp,ctx,'2026-02-30','2026-03-01'));
});
test('itens adicionais entram na mesma comanda uma única vez e recusam agendamento de outra unidade',()=>{
 const {p,s,ctx,body}=base();
 const a=erp.criarAgendamento('a',{clienteNome:'Teste',profissionalId:p.id,servicoId:s.id,dataHora:'2026-10-09T14:00:00-04:00',dataAgenda:'2026-10-09',lojaId:'matriz'});
 body.agendamentoId=a.id;
 const primeira=lancarComandaEquipe(erp,ctx,body,key);
 const extra={...body,itens:[{tipo:'servico',servicoId:s.id,quantidade:1}]};
 const segunda=lancarComandaEquipe(erp,ctx,extra,key+'extra');const repetida=lancarComandaEquipe(erp,ctx,extra,key+'extra');
 assert.equal(segunda.id,primeira.id);assert.equal(segunda.itens.length,3);assert.equal(repetida.itens.length,3);assert.equal(repetida.idempotente,true);
 assert.throws(()=>lancarComandaEquipe(erp,{...ctx,lojaId:'outra'},body,key+'outra'),e=>e.code==='AGENDAMENTO_FORA_ESCOPO');
});
