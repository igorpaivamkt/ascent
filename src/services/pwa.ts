/**
 * Registro do service worker (PWA). Isolado aqui para não misturar APIs do navegador com regras de negócio.
 * No empacotamento Capacitor o app é servido localmente; o service worker é opcional e é ignorado com segurança.
 */
export function registerServiceWorker(): void {
  if (__DEV__) return;
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* Sem service worker: o app continua funcionando online. */
    });
  });
}
