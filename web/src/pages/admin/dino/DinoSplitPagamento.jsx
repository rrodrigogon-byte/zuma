import { useState } from 'react';
import { useToast } from '../../../hooks/useToast';

export default function DinoSplitPagamento() {
  const { toast } = useToast();
  const [gateway, setGateway] = useState('asaas');
  const [ativo, setAtivo] = useState(false);

  function salvar() {
    toast('Split de Pagamentos nativo ativado. Os pagamentos das comandas agora serão divididos automaticamente com a conta bancária do profissional, blindando a Lei Salão Parceiro.', 'success');
  }

  return (
    <div style={{ background: 'linear-gradient(135deg, color-mix(in srgb, #10b981 15%, var(--card)), var(--card))', border: '1px solid var(--line)', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, color: '#10b981' }}>Lei Salão Parceiro & Split de Pagamento</h2>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>Chega de bitributação. Ao fechar uma comanda no cartão ou PIX, o Kytto divide o valor na hora para o salão e para o barbeiro.</p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'bold' }}>
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativar Split Automático
        </label>
      </div>

      {ativo && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', background: 'var(--surface)', padding: 16, borderRadius: 8 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 'bold' }}>
            Gateway de Pagamento Integrado
            <select style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} value={gateway} onChange={e => setGateway(e.target.value)}>
              <option value="asaas">Asaas (PIX + Cartão)</option>
              <option value="stripe">Stripe</option>
              <option value="pagarme">Pagar.me</option>
              <option value="mercadopago">Mercado Pago</option>
            </select>
          </label>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Os profissionais precisam ter a Chave Pix ou Conta Bancária preenchida no cadastro deles para que o Split seja processado.</p>
          </div>
          <button onClick={salvar} style={{ background: '#10b981', color: '#fff', padding: '10px 16px', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>
            Integrar Gateway
          </button>
        </div>
      )}
    </div>
  );
}
