// Use sempre a mesma expressão nas projeções de pagamento e revisão: uma
// tentativa mais recente falha não oculta captura tardia que requer estorno.
// O alias `o` é a linha já escopada por empresa, vitrine e código público.
export const lateCaptureReviewExistsSql = `EXISTS (
  SELECT 1 FROM commerce_payments p
   WHERE p.empresa_id = o.empresa_id AND p.order_id = o.id
     AND p.status = 'captured'
     AND p.metadata #>> '{lateCapture,state}' = 'refund_required'
)`;
