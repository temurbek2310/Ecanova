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
        className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#222B3D] bg-[#141B2B] px-3 py-2 text-xs font-medium text-[#F3F6FF] transition-colors hover:border-[#5DE1D2]/50 hover:text-[#5DE1D2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9274FF] whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5 text-[#5DE1D2]" aria-hidden="true" />
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
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#222B3D] bg-[#141B2B] px-3 py-2 text-xs font-medium text-[#F3F6FF] transition-colors hover:border-[#5DE1D2]/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9274FF] whitespace-nowrap shrink-0"
        >
          <Smartphone className="h-3.5 w-3.5 text-[#5DE1D2]" aria-hidden="true" />
          <span>{label}</span>
        </button>

        {showGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          >
            <div className="w-full max-w-sm rounded-xl border border-[#222B3D] bg-[#101522] p-6 text-[#F3F6FF]">
              <div className="flex items-start justify-between gap-4">
                <h3 id="ios-install-title" className="text-base font-semibold">
                  Install ECONOVA on iOS
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="Close installation guide"
                  className="rounded-lg p-1.5 text-[#8994AA] hover:bg-[#141B2B] hover:text-[#F3F6FF]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="mt-4 space-y-2 text-sm text-[#8994AA]">
                <li>1. Tap the Safari Share button in your browser toolbar.</li>
                <li>2. Scroll down and select Add to Home Screen.</li>
                <li>3. Launch ECONOVA directly from your home screen.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-5 w-full rounded-lg bg-[#9274FF] py-2.5 text-sm font-medium text-[#080B14] hover:bg-[#a68dff]"
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
