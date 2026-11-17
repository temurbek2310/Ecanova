import { useCallback, useEffect, useState } from 'react';
import {
  inspectPwaOfflineCache,
  type ServiceWorkerAvailability,
} from '../lib/offline-cache';

export function useCourseOfflineCache() {
  const [swStatus, setSwStatus] = useState<ServiceWorkerAvailability>(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return 'unsupported';
    }
    return navigator.serviceWorker.controller ? 'active' : 'registering';
  });
  const [hasCatalog, setHasCatalog] = useState(false);
  const [cachedEditionKeys, setCachedEditionKeys] = useState<Set<string>>(() => new Set());

  const refresh = useCallback(async () => {
    const result = await inspectPwaOfflineCache();
    setSwStatus(result.swStatus);
    setHasCatalog(result.hasCatalog);
    setCachedEditionKeys(result.cachedEditionKeys);
  }, []);

  useEffect(() => {
    let active = true;
    const runRefresh = () => {
      if (active) {
        void refresh();
      }
    };

    runRefresh();

    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return () => {
        active = false;
      };
    }

    let trackedWorker: ServiceWorker | null = null;
    const onWorkerStateChange = () => {
      if (trackedWorker?.state === 'activated') {
        runRefresh();
      }
    };

    void navigator.serviceWorker.getRegistration().then((reg) => {
      if (!active || !reg) return;
      const pending = reg.installing || reg.waiting;
      if (pending) {
        trackedWorker = pending;
        pending.addEventListener('statechange', onWorkerStateChange);
      }
      runRefresh();
    });

    void navigator.serviceWorker.ready.then(() => {
      runRefresh();
    });

    const onSwEvent = () => runRefresh();
    const onSwError = () => {
      if (active) setSwStatus('error');
    };

    navigator.serviceWorker.addEventListener('controllerchange', onSwEvent);
    window.addEventListener('econova:sw-updated', onSwEvent);
    window.addEventListener('econova:sw-error', onSwError);
    window.addEventListener('online', onSwEvent);
    window.addEventListener('offline', onSwEvent);
    window.addEventListener('focus', onSwEvent);

    return () => {
      active = false;
      trackedWorker?.removeEventListener('statechange', onWorkerStateChange);
      navigator.serviceWorker.removeEventListener('controllerchange', onSwEvent);
      window.removeEventListener('econova:sw-updated', onSwEvent);
      window.removeEventListener('econova:sw-error', onSwError);
      window.removeEventListener('online', onSwEvent);
      window.removeEventListener('offline', onSwEvent);
      window.removeEventListener('focus', onSwEvent);
    };
  }, [refresh]);

  return {
    swStatus,
    hasCatalog,
    cachedEditionKeys,
    refresh,
  };
}
