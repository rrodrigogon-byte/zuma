import test from 'node:test';
import assert from 'node:assert/strict';
import { db, reset } from './db.js';
import { criarComandaBarbearia, listarComandasBarbearia, obterComandaBarbearia } from './barbearia-erp-kytto.js';
test('caixa reúne pendências antigas, exclui faturadas e isola unidade/empresa', () => {
 reset();
 const antiga=criarComandaBarbearia('e1',{lojaId:'a',clienteNome:'Cliente',clienteId:'cli1'});
 criarComandaBarbearia('e1',{lojaId:'b',clienteNome:'Outra unidade'});
 criarComandaBarbearia('e2',{lojaId:'a',clienteNome:'Outra empresa'});
 const raw=db().barbearias.e1.comandas[antiga.id];
 raw.criadoEm='2020-01-01T12:00:00Z';raw.dataAtendimento='2020-01-01';
 db().clientesKytto ||= {empresas:{}}; db().clientesKytto.empresas ||= {};db().clientesKytto.empresas.e1={clientes:{cli1:{id:'cli1',empresaId:'e1',nome:'Ana Souza'}}};
 assert.equal(listarComandasBarbearia('e1',{lojaId:'a',pendentes:true}).length,1);
 assert.equal(obterComandaBarbearia('e1',antiga.id).clienteNome,'Ana Souza');
 for(const status of ['aberta','aguardando_pagamento','parcialmente_paga']) {raw.status=status;assert.equal(listarComandasBarbearia('e1',{lojaId:'a',pendentes:true}).length,1)}
 for(const status of ['paga','em_conta','cancelada']) {raw.status=status;assert.equal(listarComandasBarbearia('e1',{lojaId:'a',pendentes:true}).length,0)}
 reset();
});
