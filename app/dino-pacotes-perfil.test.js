import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
process.env.DB_PATH=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'dino-pacotes-')),'db.json');
const bar=await import('./barbearia-erp-kytto.js'),cap=await import('./dino-captacao-kytto.js'),clientes=await import('./clientes-contas-kytto.js');
const {subscriptionCycle,anniversaryBoundary,subscriptionStart}=await import('./core/subscription-calendar.js');
const at=value=>({agora:new Date(value)});
function fixture({inicio='2026-01-10',sessoes=4,pago=true}={}){
 const emp=randomUUID(),servico=bar.criarServico(emp,{nome:'Corte',preco:50,grupoServico:'convencionais'}),extra=bar.criarServico(emp,{nome:'Sobrancelha',preco:20,grupoServico:'extras',categoria:'Sobrancelha'});
 const cliente=clientes.criarCliente(emp,{nome:'Cliente sintético',telefone:'65988880001'});
 const plano=bar.criarPlano(emp,{nome:'Pacote teste',preco:180,ciclo:'mensal',regraRenovacao:'aniversario',sessoesIncluidas:sessoes,servicosIds:[servico.id]});
 const ass=bar.criarAssinatura(emp,{clienteId:cliente.id,clienteNome:cliente.nome,planoId:plano.id,inicio});
 bar.alterarStatusAssinatura(emp,ass.id,'ativa',{confirmadoSemCobranca:true,pagamentoConfirmado:pago});
 return {emp,servico,extra,cliente,plano,ass};
}
test('aniversário mensal mantém dia 10 no fuso da Dino e não soma 30 dias',()=>{
 const ass={inicio:subscriptionStart('2026-01-10')},plano={regraRenovacao:'aniversario',ciclo:'mensal'};
 assert.equal(new Date(subscriptionCycle(ass,plano,new Date('2026-02-10T04:00:00Z').valueOf()).fim).toISOString(),'2026-03-10T04:00:00.000Z');
 assert.equal(new Date(anniversaryBoundary('2026-01-11T03:30:00Z',1)).toISOString(),'2026-02-11T03:30:00.000Z');
 assert.throws(()=>subscriptionStart('2026-02-30'),/inválida/);
});
test('fim de mês e ano bissexto não deslocam aniversário original',()=>{
 const inicio=subscriptionStart('2024-01-31');
 assert.equal(new Date(anniversaryBoundary(inicio,1)).toISOString(),'2024-02-29T04:00:00.000Z');
 assert.equal(new Date(anniversaryBoundary(inicio,2)).toISOString(),'2024-03-31T04:00:00.000Z');
 assert.equal(new Date(anniversaryBoundary(subscriptionStart('2024-02-29'),1,'anual')).toISOString(),'2025-02-28T04:00:00.000Z');
 assert.equal(new Date(anniversaryBoundary(inicio,1,'trimestral')).toISOString(),'2024-04-30T04:00:00.000Z');
});
test('limite do pagamento é exclusivo: vence no dia da renovação e bloqueia uso',()=>{
 const f=fixture();assert.equal(cap.resumoAssinatura(f.emp,f.ass.id,at('2026-02-10T03:59:59Z')).situacaoPagamento,'em_dia');
 assert.equal(cap.resumoAssinatura(f.emp,f.ass.id,at('2026-02-10T04:00:00Z')).situacaoPagamento,'inadimplente');
 assert.throws(()=>cap.registrarUsoAssinatura(f.emp,f.ass.id,{servicoId:f.servico.id},at('2026-02-10T04:00:00Z')),{code:'ASSINATURA_INADIMPLENTE'});
 assert.throws(()=>cap.validarAgendamentoComPlano(f.emp,{clienteId:f.cliente.id,servicoId:f.servico.id,dataHora:'2026-02-11T14:00:00Z'},at('2026-01-15T12:00:00Z')),{code:'PLANO_VENCIDO'});
});
test('renovação atrasada mantém calendário, repetição é idempotente e tela desatualizada é recusada',()=>{
 const f=fixture();const dados={referencia:'recebimento-1',periodoInicio:'2026-02-10T04:00:00.000Z',valor:180};
 const r=cap.registrarPagamentoAssinatura(f.emp,f.ass.id,dados,at('2026-02-15T12:00:00Z'));assert.equal(r.pagoAte,'2026-03-10T04:00:00.000Z');
 assert.equal(cap.registrarPagamentoAssinatura(f.emp,f.ass.id,dados).repetido,true);
 assert.equal(cap.movimentosAssinatura(f.emp,f.ass.id).pagamentos.length,1);
 assert.throws(()=>cap.registrarPagamentoAssinatura(f.emp,f.ass.id,{...dados,referencia:'outro-clique'}),{code:'CICLO_ATUALIZADO'});
});
test('pacotes de 4, 6 e 8 limitam procedimentos e só cobrem os serviços contratados',()=>{
 for(const sessoes of [4,6,8]){const f=fixture({sessoes});for(let i=0;i<sessoes;i++)cap.registrarUsoAssinatura(f.emp,f.ass.id,{servicoId:f.servico.id,agendamentoId:`teste-${i}`},at('2026-01-15T12:00:00Z'));
 assert.equal(cap.resumoAssinatura(f.emp,f.ass.id,at('2026-01-15T12:00:00Z')).sessoesRestantes,0);assert.throws(()=>cap.registrarUsoAssinatura(f.emp,f.ass.id,{servicoId:f.servico.id},at('2026-01-15T12:00:00Z')),{code:'LIMITE_DO_CICLO'});}
 const f=fixture();assert.throws(()=>cap.registrarUsoAssinatura(f.emp,f.ass.id,{servicoId:f.extra.id},at('2026-01-15T12:00:00Z')),{code:'SERVICO_FORA_DO_PLANO'});
});
test('editar catálogo não altera condições, preço ou cobertura do pacote já vendido',()=>{
 const f=fixture();bar.atualizarPlano(f.emp,f.plano.id,{preco:999,sessoesIncluidas:8,servicosIds:[f.extra.id],regraRenovacao:'dias',validadeDias:1});
 const r=cap.resumoAssinatura(f.emp,f.ass.id,at('2026-01-15T12:00:00Z'));assert.equal(r.plano.preco,180);assert.equal(r.limiteNoCiclo,4);assert.deepEqual(r.plano.servicosIds,[f.servico.id]);assert.equal(r.pagoAte,'2026-02-10T04:00:00.000Z');
});
test('telefone identifica pacote ativo, vencido e pendente, sem atravessar empresas ou revelar homônimos',()=>{
 const f=fixture();assert.equal(cap.perfilDoTelefone(f.emp,'+55 (65) 98888-0001',at('2026-01-15T12:00:00Z')).perfil,'pacote_ativo');
 assert.equal(cap.perfilDoTelefone(f.emp,'65988880001',at('2026-02-15T12:00:00Z')).perfil,'pacote_vencido');
 assert.equal(cap.perfilDoTelefone(randomUUID(),'65988880001').pacotes.length,0);
 clientes.criarCliente(f.emp,{nome:'Outro titular',telefone:'65988880001'});const p=cap.perfilDoTelefone(f.emp,'65988880001');assert.equal(p.perfil,'cadastro_ambiguo');assert.deepEqual(p.pacotes,[]);
 const pending=fixture({pago:false});assert.equal(cap.perfilDoTelefone(pending.emp,'65988880001',at('2026-01-15T12:00:00Z')).perfil,'pacote_pendente');
});
test('assinatura futura não libera sessões antes da contratação',()=>{
 const f=fixture({inicio:'2027-01-10'});assert.equal(cap.resumoAssinatura(f.emp,f.ass.id,at('2026-10-25T12:00:00Z')).situacaoPagamento,'aguardando_inicio');
 assert.throws(()=>cap.registrarUsoAssinatura(f.emp,f.ass.id,{servicoId:f.servico.id},at('2026-10-25T12:00:00Z')),{code:'ASSINATURA_FORA_DA_VALIDADE'});
});
test('plano legado continua com validade em dias',()=>{
 const r=subscriptionCycle({inicio:'2026-01-10T04:00:00Z'},{validadeDias:30,ciclo:'mensal'},new Date('2026-01-15T12:00:00Z').valueOf());assert.equal(new Date(r.fim).toISOString(),'2026-02-09T04:00:00.000Z');
});
test('classificação de legado é conservadora, explícita e sem gravar os cadastros',async()=>{
 const {serviceGroup}=await import('./core/service-groups.js');
 assert.equal(serviceGroup({nome:'Corte e barba'}),'convencionais');assert.equal(serviceGroup({nome:'Pigmentação'}),'extras');
 assert.equal(serviceGroup({nome:'Corte + hidratação'}),'nao_classificado');assert.equal(serviceGroup({nome:'Procedimento especial'}),'nao_classificado');assert.equal(serviceGroup({nome:'Corte',grupoServico:'extras'}),'extras');
});
test('agendamentos pelo pacote reservam saldo e cancelamento libera a sessão',()=>{
 const f=fixture({inicio:'2027-01-10',sessoes:4});const profissional=bar.criarProfissional(f.emp,{nome:'Barbeiro sintético'});
 const opcoes=at('2027-01-11T12:00:00Z');const appointments=[];
 for(let i=0;i<4;i++)appointments.push(bar.criarAgendamento(f.emp,{clienteId:f.cliente.id,clienteNome:f.cliente.nome,servicoId:f.servico.id,profissionalId:profissional.id,usarPlano:true,dataHora:`2027-01-12T${String(10+i).padStart(2,'0')}:00:00-04:00`},opcoes));
 assert.ok(appointments.every(a=>a.assinaturaId===f.ass.id));
 assert.throws(()=>bar.criarAgendamento(f.emp,{clienteId:f.cliente.id,clienteNome:f.cliente.nome,servicoId:f.servico.id,profissionalId:profissional.id,usarPlano:true,dataHora:'2027-01-12T15:00:00-04:00'},opcoes),{code:'LIMITE_DO_CICLO'});
 bar.alterarStatusAgendamento(f.emp,appointments[0].id,'cancelado', { motivoCancelamento: 'solicitado_pelo_cliente' });
 assert.ok(bar.criarAgendamento(f.emp,{clienteId:f.cliente.id,clienteNome:f.cliente.nome,servicoId:f.servico.id,profissionalId:profissional.id,usarPlano:true,dataHora:'2027-01-12T15:00:00-04:00'},opcoes).assinaturaId);
});
test('editar regra do catálogo preserva contrato legado sem snapshot prévio',async()=>{
 const f=fixture();const {db}=await import('./db.js');const state=db().barbearias[f.emp];
 delete state.assinaturas[f.ass.id].condicoesContratadas;delete state.planos[f.plano.id].regraRenovacao;
 bar.atualizarPlano(f.emp,f.plano.id,{regraRenovacao:'aniversario',preco:900});
 const r=cap.resumoAssinatura(f.emp,f.ass.id,at('2026-01-15T12:00:00Z'));assert.equal(r.plano.preco,180);assert.equal(r.pagoAte,'2026-02-09T04:00:00.000Z');assert.equal(JSON.parse(JSON.stringify(state.assinaturas[f.ass.id].condicoesContratadas)).regraRenovacao,'dias');
});
test('recorrência considera histórico Avec vigente e não duplica procedimentos no mesmo dia',async()=>{
 const f=fixture();const {db}=await import('./db.js');const state=db().barbearias[f.emp];state.assinaturas={};
 state.historicoAtendimentos={a:{id:'a',empresaId:f.emp,clienteId:f.cliente.id,status:'concluido',dataAgenda:'2026-01-05',origem:'avec-import-20261022'},b:{id:'b',empresaId:f.emp,clienteId:f.cliente.id,status:'concluido',dataAgenda:'2026-01-05',origem:'avec-import-20261022'},c:{id:'c',empresaId:f.emp,clienteId:f.cliente.id,status:'concluido',dataAgenda:'2026-01-07',origem:'avec-import-20261022'}};
 const perfil=cap.perfilDoTelefone(f.emp,'65988880001',at('2026-01-15T12:00:00Z'));assert.equal(perfil.perfil,'recorrente');assert.equal(perfil.visitasConhecidas,2);
});
test('repetir criação com mesma chave não duplica assinatura; chave divergente e cliente de outra empresa são recusados',()=>{
 const f=fixture();const dados={clienteId:f.cliente.id,clienteNome:f.cliente.nome,planoId:f.plano.id,inicio:'2026-02-10',chaveIdempotencia:'contrato-sintetico-1'};
 const a=bar.criarAssinatura(f.emp,dados),b=bar.criarAssinatura(f.emp,dados);assert.equal(a.id,b.id);assert.equal(b.idempotente,true);assert.equal(bar.listarAssinaturas(f.emp).filter(c=>c.chaveIdempotencia===dados.chaveIdempotencia).length,1);
 assert.throws(()=>bar.criarAssinatura(f.emp,{...dados,inicio:'2026-02-11'}),/dados diferentes/);
 assert.throws(()=>bar.criarAssinatura(f.emp,{...dados,chaveIdempotencia:'outro',clienteId:'cliente-de-outra-empresa'}),/cliente ativo cadastrado nesta empresa/);
});
test('saldo reservado aparece no perfil e não pode ser consumido por outro atendimento',()=>{
 const f=fixture({inicio:'2027-01-10',sessoes:4}),prof=bar.criarProfissional(f.emp,{nome:'Barbeiro teste'}),o=at('2027-01-11T12:00:00Z');
 for(let i=0;i<4;i++)bar.criarAgendamento(f.emp,{clienteId:f.cliente.id,clienteNome:f.cliente.nome,servicoId:f.servico.id,profissionalId:prof.id,usarPlano:true,dataHora:`2027-01-12T${10+i}:00:00-04:00`},o);
 const p=cap.perfilDoTelefone(f.emp,'65988880001',o);assert.equal(p.perfil,'pacote_reservado');assert.equal(p.pacotes[0].disponiveisParaAgendar,0);assert.equal(p.pacotes[0].sessoesReservadas,4);
 assert.throws(()=>cap.registrarUsoAssinatura(f.emp,f.ass.id,{servicoId:f.servico.id},o),{code:'LIMITE_DO_CICLO'});
});
