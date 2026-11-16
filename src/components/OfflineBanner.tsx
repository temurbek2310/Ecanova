import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface OfflineBannerProps {
  message: string;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ message }) => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 border-b border-[#FFC96B]/30 bg-[#141B2B] px-4 py-2 text-xs font-medium text-[#FFC96B]"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
};
