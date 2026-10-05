import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import React from 'react'
import Renderer, { act } from 'react-test-renderer'
const web = dirname(dirname(fileURLToPath(import.meta.url)))
const temp = mkdtempSync(join(web, '.agenda-test-'))
after(() => rmSync(temp, { recursive: true, force: true }))
await build({ entryPoints: { calendar: join(web, 'src/pages/admin/BarbeariaAgendaPeriodo.jsx'), board: join(web, 'src/pages/admin/BarbeariaAgendaBoard.jsx') }, outdir: temp, outExtension: { '.js': '.cjs' }, loader: { '.css': 'empty' }, bundle: true, format: 'cjs', platform: 'node', jsx: 'automatic', packages: 'external', plugins: [{ name: 'api-fixture', setup(b) {
  b.onResolve({ filter: /\/lib\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }))
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const api={get:(...a)=>globalThis.agendaApi(...a)}' }))
} }] })
const require = createRequire(import.meta.url)
const Calendar = require(join(temp, 'calendar.cjs')).default
const Board = require(join(temp, 'board.cjs')).default
const text = n => typeof n === 'string' ? n : (n.children || []).map(text).join(' ')
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b}); return {promise,resolve,reject} }
async function fixture() {
  const calls = [], picked = [], dates = []
  globalThis.agendaApi = path => { const d=deferred(); calls.push({path,...d}); return d.promise }
  const props = { dataSelecionada: '2026-10-05', profissionais: [{ id:'b',nome:'Bruno' }, {id:'d',nome:'Dino'}], servicos: [{id:'s1',nome:'Corte'}, {id:'s2',nome:'Hidratação'}], onPickSlot: s => picked.push(s), onDateChange: d => dates.push(d) }
  let render; await act(async () => {render=Renderer.create(React.createElement(Calendar,props))})
  const button = label => render.root.findAllByType('button').find(n=>text(n)===label || n.props['aria-label']===label)
  const click = async label => {await act(async () => {button(label).props.onClick()})}
  const change = async (type,index,value) => {await act(async () => {render.root.findAllByType(type)[index].props.onChange({target:{value}})})}
  const update = async p => {Object.assign(props,p);await act(async () => {render.update(React.createElement(Calendar,props))})}
  const finish = async (index,data) => {await act(async () => {calls[index].resolve(data)})}
  const close = () => act(()=>render.unmount())
  return {calls,picked,dates,render,button,click,change,update,finish,close}
}
test('resposta antiga nunca substitui a agenda do profissional selecionado', async () => {
  const f=await fixture(); try {
    await f.update({profissionalId:'b'})
    await f.finish(1,{itens:[{id:'novo',dataAgenda:'2026-10-09',horaLocal:'18:00',clienteNome:'Atual',status:'agendado'}]})
    await f.finish(0,{itens:[{id:'velho',dataAgenda:'2026-10-09',clienteNome:'Antigo'}]})
    assert.match(text(f.render.toJSON()),/Atual/); assert.doesNotMatch(text(f.render.toJSON()),/Antigo/)
  } finally {f.close()}
})
test('troca de serviço invalida vaga antiga e a seleção preserva o serviço consultado', async () => {
  const f=await fixture(); try {
    await f.finish(0,{itens:[]}); await f.change('select',1,'s1'); await f.click('Ver horários livres')
    await f.change('select',1,'s2')
    await f.finish(1,{itens:[{data:'2026-10-09',profissionalId:'b',profissionalNome:'Bruno',horarios:['18:00']}]})
    assert.equal(f.button('18:00'),undefined)
    await f.click('Ver horários livres')
    await f.finish(2,{itens:[{data:'2026-10-09',profissionalId:'b',profissionalNome:'Bruno',horarios:['19:00']}]})
    await f.click('19:00')
    assert.deepEqual(f.picked,[{data:'2026-10-09',hora:'19:00',profissionalId:'b',servicoId:'s2'}])
    await f.update({refreshKey:1}); assert.equal(f.button('19:00'),undefined)
  } finally {f.close()}
})
test('calendário mantém filtro ao atualizar, mostra dias vazios e sincroniza o dia clicado', async () => {
  const f=await fixture(); try {
    await f.finish(0,{itens:[]})
    assert.equal(f.render.root.findAll(n=>n.props.className==='dino-cal-day').length,7)
    await f.click('Ver sex., 09/10 na linha do tempo'); assert.equal(f.dates.at(-1),'2026-10-09')
    await f.click('Mês'); await f.finish(1,{itens:[]})
    assert.equal(f.render.root.findAll(n=>n.props.className==='dino-cal-day').length,31)
    await f.update({refreshKey:1}); await f.finish(2,{itens:[]})
    assert.equal(f.button('Mês').props['aria-pressed'],true)
    await f.change('select',1,'s1'); assert.equal(f.button('Ver horários livres').props.disabled,true)
    assert.match(text(f.render.toJSON()),/até 14 dias/)
  } finally {f.close()}
})
test('falha de consulta não mostra agenda vazia como sucesso e permite nova tentativa', async () => {
  const f=await fixture(); try {
    await act(async()=>f.calls[0].reject(new Error('Falha de conexão')))
    assert.match(text(f.render.toJSON()),/Falha de conexão/)
    assert.equal(f.render.root.findAll(n=>n.props.className==='dino-cal-day').length,0)
    await f.click('Atualizar calendário'); await f.finish(1,{itens:[]})
    assert.equal(f.render.root.findAll(n=>n.props.className==='dino-cal-day').length,7)
  } finally {f.close()}
})
test('Hoje da linha do tempo volta à data de Cuiabá e data inválida não derruba a tela', async () => {
  const dates=[]; let render
  await act(async()=>{render=Renderer.create(React.createElement(Board,{data:'2020-01-01',onDateChange:d=>dates.push(d),agendamentos:[{id:'a',dataHora:'invalida'}]}))})
  try {await act(async()=>render.root.findAllByType('button').find(n=>text(n)==='Hoje').props.onClick()); assert.notEqual(dates[0],'2020-01-01'); assert.match(dates[0],/^\d{4}-\d{2}-\d{2}$/)} finally {act(()=>render.unmount())}
})
