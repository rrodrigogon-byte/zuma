import { useRef, useState } from 'react'
import { CheckCircle2, ShoppingBag, X } from 'lucide-react'
import useDialogFocus from './useDialogFocus'

function Thumb({ item }) {
  const [broken, setBroken] = useState(false)
  if (item?.imagem && !broken) return <img src={item.imagem} alt="" width="64" height="64" onError={() => setBroken(true)} />
  return <span className="sf-thumb-fallback" aria-hidden="true"><ShoppingBag size={22} /></span>
}

// Confirmação explícita exibida somente depois que o item entrou de fato no carrinho.
export default function AddToCartSuccess({ item, onClose, onViewCart }) {
  const viewCartRef = useRef(null)
  const open = Boolean(item)
  const dialogRef = useDialogFocus(open, onClose, viewCartRef)
  if (!item) return null
  const added = Number(item.added || 1)
  return <div className="sf-popup-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={dialogRef} className="sf-popup" role="dialog" aria-modal="true" aria-labelledby="sf-popup-title" aria-describedby="sf-popup-desc">
      <button type="button" className="sf-icon-button sf-popup-close" onClick={onClose} aria-label="Fechar confirmação"><X size={18} /></button>
      <p id="sf-popup-title" className="sf-popup-title" aria-live="assertive"><CheckCircle2 size={20} aria-hidden="true" /> Produto adicionado ao carrinho</p>
      <div className="sf-popup-product">
        <Thumb item={item} />
        <div id="sf-popup-desc">
          <strong>{item.nome}</strong>
          <span>{added === 1 ? '1 unidade adicionada' : `${added} unidades adicionadas`}{item.quantity > added ? ` · ${item.quantity} no carrinho` : ''}</span>
        </div>
      </div>
      <div className="sf-popup-actions">
        <button type="button" className="sf-btn sf-btn-secondary" onClick={onClose}>Continuar comprando</button>
        <button type="button" ref={viewCartRef} className="sf-btn sf-btn-primary" onClick={onViewCart}><ShoppingBag size={16} aria-hidden="true" /> Ver carrinho</button>
      </div>
    </div>
  </div>
}
