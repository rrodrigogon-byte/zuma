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
const temp = mkdtempSync(join(web, '.checkout-test-'))
after(() => rmSync(temp, { recursive: true, force: true }))
await build({
  entryPoints: {checkout: join(web, 'src/pages/public/CommerceCheckout.jsx'), ecommerce: join(web, 'src/pages/public/Ecommerce.jsx')}, outdir: temp, outExtension: {'.js':'.cjs'}, loader: {'.css':'empty'},
  bundle: true, format: 'cjs', platform: 'node', jsx: 'automatic', packages: 'external',
  plugins: [{ name: 'isolated-fixtures', setup(build) {
    build.onResolve({ filter: /\/lib\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }))
    build.onResolve({ filter: /^react-router-dom$/ }, () => ({ path: 'router', namespace: 'fixture' }))
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: path === 'api'
      ? 'export const api = {get: (...a)=>globalThis.testApi.get(...a),post: (...a)=>globalThis.testApi.post(...a)}; export const fmtR = value => `R$ ${Number(value).toFixed(2)}`'
      : 'import React from "react"; export const useNavigate = () => () => {}; export const useParams = () => ({}); export const useSearchParams = () => [new URLSearchParams()]; export const Link = props => React.createElement("a", props, props.children);', resolveDir: web }))
  } }],
})
const Checkout = createRequire(import.meta.url)(join(temp, 'checkout.cjs')).default
const Ecommerce = createRequire(import.meta.url)(join(temp, 'ecommerce.cjs')).default
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b }); return { promise, resolve, reject } }
const text = node => typeof node === 'string' ? node : (node.children || []).map(text).join(' ')
const storage = () => { const items = new Map(); return { getItem: k => items.get(k) || null, setItem: (k,v) => { items.set(k,String(v)) }, removeItem: k => { items.delete(k) } } }

async function fixture({Component = Checkout, pickup = true, paymentMethods = [{provider:'infinitepay',method:'pix'}], storefront = {nome:'Loja teste'}} = {}) {
  globalThis.localStorage = storage(); globalThis.sessionStorage = storage()
  localStorage.setItem('kytto_commerce_cart:host', JSON.stringify([{produtoId:'p1',variantId:'v1',nome:'Produto teste',qtd:1,preco:100}]))
  let timerId=0; const timers = new Map(), listeners = new Map(), postal = [], quotes = [], posts = []
  globalThis.window = { location: { origin: 'https://fixture.invalid', hostname: 'fixture.invalid' }, localStorage,
    setTimeout: (callback, delay) => { timers.set(++timerId,{callback,delay}); return timerId }, clearTimeout: id => timers.delete(id),
    addEventListener: (name,fn) => listeners.set(name,fn), removeEventListener: name => listeners.delete(name) }
  globalThis.document = { title:'Teste', documentElement:{dataset:{}}, body:{style:{}}, querySelectorAll: () => [] }
  globalThis.testApi = {
    get: async path => {
      if(path.endsWith('/context')) return { capabilities:{checkout:true},storefront }
      if(path.includes('/products')) return {items:[{id:'p1',nome:'Produto teste',variants:[{id:'v1',estoque:2,prices:[{preco:100}]}]}]}
      if(path.endsWith('/shipping-methods')) return {items:[...(pickup ? [{id:'pickup',tipo:'pickup'}] : []),{id:'delivery',tipo:'delivery',quoteEnabled:true}]}
      if(path.endsWith('/payment-methods')) return {items:paymentMethods}
      if(path.includes('/shipping/address/')) { const d=deferred(); postal.push({path,...d}); return d.promise }
      throw new Error(`GET inesperado: ${path}`)
    },
    post: async (path,body) => { posts.push({path,body}); if(path.endsWith('/shipping/quotes/available')) { const d=deferred(); quotes.push(d); return d.promise }; if(path.endsWith('/cart')) return {}; throw new Error(`POST proibido no teste: ${path}`) },
  }
  let render; await act(async () => { render = Renderer.create(React.createElement(Component)) })
  const button = label => render.root.findAllByType('button').find(n=>text(n).includes(label))
  const cep = () => render.root.findAllByType('input').find(n=>n.props.placeholder==='00000-000')
  const click = async label => { await act(async () => { button(label).props.onClick() }) }
  const changeCep = async value => { await act(async () => { cep().props.onChange({target:{value}}) }) }
  const consult = async () => { await act(async () => { cep().props.onBlur() }) }
  const finishPostal = async (index, value) => { await act(async () => { postal[index].resolve({cep:value,logradouro:'Rua teste',bairro:'Centro',cidade:'São Paulo',estado:'SP'}) }) }
  return {render,button,cep,click,changeCep,consult,finishPostal,postal,quotes,posts,listeners,timers,close:()=>act(()=>render.unmount())}
}

test('componente ignora CEP atrasado e preserva o novo endereço', async () => {
  const f=await fixture()
  try {
    await f.click('Entrega'); await f.changeCep('01001000'); await f.consult()
    await f.changeCep('20040002'); await f.consult()
    await f.finishPostal(1,'20040002'); await f.finishPostal(0,'01001000')
    assert.equal(f.cep().props.value,'20040-002')
    assert.equal(f.button('Consultar CEP').props.disabled,false)
  } finally { f.close() }
})

test('trocar para retirada durante cotação libera avanço e rejeita resposta antiga', async () => {
  const f=await fixture()
  try {
    await f.click('Entrega'); await f.changeCep('01001000'); await f.consult(); await f.finishPostal(0,'01001000')
    await f.click('Calcular frete')
    assert.equal(f.button('Aguardando cálculo').props.disabled,true)
    await f.click('Retirada no local')
    assert.equal(f.render.root.findByProps({type:'submit'}).props.disabled,false)
    await act(async()=>{f.quotes[0].resolve({items:[{id:'old',selectionId:'old',amount:85,shippingMethodId:'delivery'}]})})
    assert.equal(f.render.root.findByProps({type:'submit'}).props.disabled,false)
    assert.equal(f.posts.some(p=>p.path.endsWith('/orders')),false)
  } finally { f.close() }
})

test('troca de CEP durante frete pendente permite nova cotação', async () => {
  const f=await fixture()
  try {
    await f.click('Entrega'); await f.changeCep('01001000'); await f.consult(); await f.finishPostal(0,'01001000'); await f.click('Calcular frete')
    await f.changeCep('20040002'); await f.consult(); await f.finishPostal(1,'20040002')
    assert.equal(f.button('Calcular frete')?.props.disabled ?? true,false)
    await f.click('Calcular frete')
    await act(async()=>{f.quotes[1].resolve({items:[{id:'new',selectionId:'new',amount:45,shippingMethodId:'delivery'}]})})
    await act(async()=>{f.quotes[0].reject(new Error('falha antiga'))})
    assert.equal(f.render.root.findByProps({type:'submit'}).props.disabled,false)
    assert.equal(JSON.stringify(f.render.toJSON()).includes('falha antiga'),false)
    assert.equal(JSON.stringify(f.render.toJSON()).includes('145.00'),true)
  } finally { f.close() }
})


test('loja somente com entrega inicia pedindo endereço, sem modo retirada oculto', async () => {
  const f=await fixture({pickup:false})
  try { assert.ok(f.cep()); assert.equal(f.button('Retirada no local'),undefined) } finally {f.close()}
})

test('vitrine envia syncVersion crescente após versão existente do checkout', async () => {
  const f=await fixture({Component:Ecommerce})
  try {
    const previous=Date.now()*1000+10000
    localStorage.setItem('kytto_commerce_cart_sync_version:host', String(previous))
    await act(async()=>{
      for(const [id,timer] of [...f.timers]) if(timer.delay===500) {f.timers.delete(id);timer.callback()}
    })
    const sync=f.posts.find(p=>p.path.endsWith('/cart'))
    assert.ok(sync, JSON.stringify({view:f.render.toJSON(), timers:[...f.timers.values()].map(t=>t.delay)}))
    assert.ok(sync.body.syncVersion>previous)
    assert.deepEqual(sync.body.items,[{variantId:'v1',quantity:1}])
  } finally {f.close()}
})


test('checkout sem pagamento publicado bloqueia criação e preserva o carrinho', async () => {
  const f = await fixture({paymentMethods: []})
  try {
    assert.equal(f.render.root.findByProps({type:'submit'}).props.disabled, true)
    assert.match(text(f.render.toJSON()), /Pagamento online indisponível/)
    await act(async () => { await f.render.root.findByType('form').props.onSubmit({preventDefault(){}}) })
    assert.equal(f.posts.some(p => p.path.endsWith('/orders')), false)
    assert.equal(JSON.parse(localStorage.getItem('kytto_commerce_cart:host')).length, 1)
  } finally { f.close() }
})

test('checkout identifica Stallone pelo contexto sem usar o símbolo Kytto', async () => {
  const f = await fixture({storefront:{nome:'Stallone Nutre Sport',codigo:'stallone-web'}})
  try {
    assert.equal(f.render.root.findByProps({alt:'Stallone Nutre Sport'}).props.src, '/brand/stallone-logo-transparent.svg')
    assert.equal(f.render.root.findAllByProps({className:'checkout-brand-mark'}).length, 0)
  } finally { f.close() }
})
