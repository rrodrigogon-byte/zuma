import { useState } from 'react'
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import useDialogFocus from './useDialogFocus'
import { cartItemCount, cartItemKey, cartSubtotal } from '../../lib/storefront-catalog'

function ItemImage({ item }) {
  const [broken, setBroken] = useState(false)
  if (item.imagem && !broken) return <img src={item.imagem} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
  return <span className="sf-thumb-fallback" aria-hidden="true"><ShoppingBag size={20} /></span>
}

/**
 * Carrinho lateral (desktop) / bottom sheet (mobile).
 * `describe(item)` devolve { cod, label, available } do catálogo atual para respeitar o estoque.
 */
export default function CartDrawer({ open, cart, describe, money, onClose, onChangeQty, onRemove, onCheckout, checkoutDisabled = false }) {
  const [limitKey, setLimitKey] = useState('')
  const dialogRef = useDialogFocus(open, onClose)
  if (!open) return null
  const count = cartItemCount(cart)
  const subtotal = cartSubtotal(cart)

  function increase(item, available) {
    if (item.qtd >= available) { setLimitKey(cartItemKey(item)); return }
    setLimitKey('')
    onChangeQty(item, item.qtd + 1)
  }
  function decrease(item) {
    setLimitKey('')
    if (item.qtd > 1) onChangeQty(item, item.qtd - 1)
  }

  return <div className="sf-drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <aside ref={dialogRef} className="sf-drawer" role="dialog" aria-modal="true" aria-labelledby="sf-cart-title">
      <header className="sf-drawer-header">
        <div>
          <h2 id="sf-cart-title">Seu carrinho</h2>
          <span aria-live="polite">{count === 1 ? '1 item' : `${count} itens`}</span>
        </div>
        <button type="button" className="sf-icon-button" onClick={onClose} aria-label="Fechar carrinho"><X size={20} /></button>
      </header>

      {!cart.length ? <div className="sf-cart-empty">
        <span className="sf-cart-empty-icon" aria-hidden="true"><ShoppingBag size={30} /></span>
        <strong>Seu carrinho está vazio</strong>
        <p>Continue explorando o catálogo.</p>
        <button type="button" className="sf-btn sf-btn-primary" onClick={onClose}>Explorar produtos</button>
      </div> : <>
        <ul className="sf-cart-items">
          {cart.map(item => {
            const key = cartItemKey(item)
            const info = describe?.(item) || {}
            const available = Math.max(0, Number(info.available ?? item.qtd))
            const atLimit = item.qtd >= available
            const sku = item.cod || info.cod
            const variantLabel = item.variantLabel || info.label
            return <li key={key} className="sf-cart-item">
              <div className="sf-cart-item-image"><ItemImage item={item} /></div>
              <div className="sf-cart-item-info">
                <strong>{item.nome}</strong>
                {(sku || variantLabel) && <small>{[variantLabel, sku && `SKU ${sku}`].filter(Boolean).join(' · ')}</small>}
                <span className="sf-cart-unit">{money(item.preco)} <em>cada</em></span>
                <div className="sf-cart-item-controls">
                  <div className="sf-qty" role="group" aria-label={`Quantidade de ${item.nome}`}>
                    <button type="button" onClick={() => decrease(item)} disabled={item.qtd <= 1} aria-label="Diminuir quantidade"><Minus size={16} /></button>
                    <output aria-live="polite" aria-label="Quantidade">{item.qtd}</output>
                    <button type="button" onClick={() => increase(item, available)} disabled={atLimit} className={atLimit ? 'is-limit' : ''} aria-label={atLimit ? 'Limite de estoque atingido' : 'Aumentar quantidade'}><Plus size={16} /></button>
                  </div>
                  <button type="button" className="sf-link-danger" onClick={() => { setLimitKey(''); onRemove(item) }} aria-label={`Remover ${item.nome} do carrinho`}><Trash2 size={15} /> Remover</button>
                </div>
                {limitKey === key && <small className="sf-cart-limit" role="status">Limite de estoque atingido ({available} {available === 1 ? 'unidade' : 'unidades'}).</small>}
              </div>
              <b className="sf-cart-item-total">{money(item.qtd * Number(item.preco || 0))}</b>
            </li>
          })}
        </ul>
        <footer className="sf-drawer-footer">
          <div className="sf-cart-summary"><span>Total</span><strong>{money(subtotal)}</strong></div>
          <small>Frete e forma de pagamento são definidos na próxima etapa.</small>
          <button type="button" className="sf-btn sf-btn-primary sf-btn-block" onClick={onCheckout} disabled={checkoutDisabled}>Finalizar compra <ArrowRight size={17} aria-hidden="true" /></button>
          <button type="button" className="sf-btn sf-btn-secondary sf-btn-block" onClick={onClose}>Continuar comprando</button>
        </footer>
      </>}
    </aside>
  </div>
}
