import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  label?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ label = 'Install App' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border-2 border-slate-500 bg-white/55 px-3 py-2 text-xs font-semibold text-ink shadow-brutal-sm backdrop-blur-md transition-all hover:bg-slate-900/10 hover:border-slate-900 hover:text-slate-950 hover:shadow-[3px_3px_0px_#090D16] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent whitespace-nowrap shrink-0 dark:border-line dark:bg-elevated dark:font-medium dark:hover:border-teal/50 dark:hover:text-teal"
      >
        <Download className="h-3.5 w-3.5 text-teal" aria-hidden="true" />
        <span>{label}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border-2 border-slate-500 bg-white/55 px-3 py-2 text-xs font-semibold text-ink shadow-brutal-sm backdrop-blur-md transition-all hover:bg-slate-900/10 hover:border-slate-900 hover:text-slate-950 hover:shadow-[3px_3px_0px_#090D16] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent whitespace-nowrap shrink-0 dark:border-line dark:bg-elevated dark:font-medium dark:hover:border-teal/50 dark:hover:text-teal"
        >
          <Smartphone className="h-3.5 w-3.5 text-teal" aria-hidden="true" />
          <span>{label}</span>
        </button>

        {showGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          >
            <div className="w-full max-w-sm rounded-xl border-2 border-slate-500 bg-white/30 p-6 text-ink shadow-[8px_8px_0px_#000000] backdrop-blur-3xl dark:border-[#222B3D] dark:bg-[#101522]/30">
              <div className="flex items-start justify-between gap-4">
                <h3 id="ios-install-title" className="text-base font-semibold">
                  Install ECONOVA on iOS
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="Close installation guide"
                  className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="mt-4 space-y-2 text-sm text-muted">
                <li>1. Tap the Safari Share button in your browser toolbar.</li>
                <li>2. Scroll down and select Add to Home Screen.</li>
                <li>3. Launch ECONOVA directly from your home screen.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-5 w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-accent-ink hover:bg-accent-hover"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
