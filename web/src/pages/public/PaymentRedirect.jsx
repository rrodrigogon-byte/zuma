import { useEffect } from 'react';
export default function PaymentRedirect() {
  useEffect(() => {
    window.location.reload();
  }, []);
  return null;
}
