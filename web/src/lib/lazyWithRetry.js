import { lazy } from 'react';

/**
 * Carrega componentes dinâmicos com auto-recuperação de cache de chunks do Vite.
 * Quando um novo deploy atualiza os hashes dos arquivos .js, evita o erro:
 * "Failed to fetch dynamically imported module".
 */
export function lazyWithRetry(componentImport) {
  return lazy(async () => {
    const RECOVERY_KEY = 'kytto_chunk_retry_timestamp';
    try {
      return await componentImport();
    } catch (error) {
      const msg = String(error?.message || '');
      const isChunkError = /failed to fetch dynamically imported module|importing a module script failed|dynamically imported module|chunkloaderror/i.test(msg);
      
      if (isChunkError && typeof window !== 'undefined') {
        const lastRetry = Number(sessionStorage.getItem(RECOVERY_KEY) || 0);
        const now = Date.now();
        // Se ainda não tentou nos últimos 10 segundos, limpa caches e recarrega
        if (now - lastRetry > 10000) {
          sessionStorage.setItem(RECOVERY_KEY, String(now));
          if ('caches' in window) {
            try {
              const keys = await caches.keys();
              await Promise.all(keys.map(k => caches.delete(k)));
            } catch (_) {}
          }
          const url = new URL(window.location.href);
          url.searchParams.set('_v', String(now));
          window.location.href = url.toString();
          return new Promise(() => {}); // Aguarda o reload
        }
      }
      throw error;
    }
  });
}

export default lazyWithRetry;
