import test from 'node:test';
import assert from 'node:assert/strict';
import { identificarCliente } from './barbearia-identidade.js';
const crm = [{ id: 'a', empresaId: 'e1', nome: 'Ana Souza', telefone: '65999998888' }];
test('substitui nome genérico pelo CRM vinculado, sem mutar o registro', () => {
 const registro = { clienteId:'a', clienteNome:'Cliente', clienteTelefone:'' };
 const atual = identificarCliente(registro,crm,'e1');
 assert.equal(atual.clienteNome,'Ana Souza'); assert.equal(atual.clienteNomeOrigem,'crm'); assert.equal(registro.clienteNome,'Cliente');
});
test('telefone normalizado resolve somente cadastro único da empresa', () => {
 assert.equal(identificarCliente({clienteNome:'Contato 8888',clienteTelefone:'+55 (65) 99999-8888'},crm,'e1').clienteNome,'Ana Souza');
 assert.equal(identificarCliente({clienteNome:'Cliente',clienteTelefone:'65999998888'},crm,'e2').clienteNomePendente,true);
 assert.equal(identificarCliente({clienteTelefone:'65999998888'},[...crm,{...crm[0],id:'b',nome:'Outra pessoa'}],'e1').clienteNomePendente,true);
});
test('não usa cadastro anonimizado, deletado ou padrão; ID inválido não recorre ao telefone', () => {
 for (const flag of [{anonimizadoEm:'2026-01-01'},{status:'deletado'},{padrao:true}]) assert.equal(identificarCliente({clienteId:'a'},[{...crm[0],...flag}],'e1').clienteNomePendente,true);
 assert.equal(identificarCliente({clienteId:'inexistente',clienteTelefone:'65999998888'},crm,'e1').clienteNomePendente,true);
});
test('preserva nome real e explicita ausência sem inventar identidade', () => {
 assert.equal(identificarCliente({clienteNome:'Beatriz',clienteId:'a'},crm,'e1').clienteNome,'Beatriz');
 const r=identificarCliente({clienteNome:'Cliente'},[],'e1'); assert.equal(r.clienteNome,'Nome não informado'); assert.equal(identificarCliente(r,[],'e1').clienteNomePendente,true);
});
