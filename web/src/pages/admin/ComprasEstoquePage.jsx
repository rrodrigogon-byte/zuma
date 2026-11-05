import { useSearchParams } from 'react-router-dom';
import DinoComprasEstoqueHub from './dino/DinoComprasEstoqueHub';

export default function ComprasEstoquePage({ abaInicial = 'estoque' }) {
  const [params] = useSearchParams();
  const tab = params.get('tab') || abaInicial;

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '16px clamp(12px, 2vw, 24px)' }}>
      <DinoComprasEstoqueHub tabInicial={tab} />
    </div>
  );
}
