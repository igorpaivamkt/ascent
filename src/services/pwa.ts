/**
 * Registro do service worker (PWA). Isolado aqui para não misturar APIs do navegador com regras de negócio.
 * No empacotamento Capacitor o app é servido localmente; o service worker é opcional e é ignorado com segurança.
 */
export function registerServiceWorker(): void {
  if (__DEV__) return;
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  // Versão nova publicada: o service worker novo assume e a página recarrega uma vez para usá-la.
  // (Só quando já havia uma versão instalada; na primeira instalação não recarrega.)
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void reg.update().catch(() => undefined)))
      .catch(() => {
        /* Sem service worker: o app continua funcionando online. */
      });
  });
}
