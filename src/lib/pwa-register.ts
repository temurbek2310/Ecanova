import { registerSW } from 'virtual:pwa-register';

export function initPwaServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      window.dispatchEvent(new CustomEvent('econova:sw-updated'));
      if (registration?.installing) {
        registration.installing.addEventListener('statechange', () => {
          window.dispatchEvent(new CustomEvent('econova:sw-updated'));
        });
      }
    },
    onRegisterError() {
      window.dispatchEvent(new CustomEvent('econova:sw-error'));
    },
  });
}
