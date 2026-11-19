'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { CompetencyNodeUnlock } from '../lib/node-unlock';

export const NODE_UNLOCK_EVENT_NAME = 'econova:node-unlock';

export type NodeUnlockInput = Omit<CompetencyNodeUnlock, 'id'> & { id?: string };

export interface NodeUnlockContextValue {
  activeNode: CompetencyNodeUnlock | null;
  queueLength: number;
  triggerNodeUnlock: (input: NodeUnlockInput) => void;
  dismissActiveNode: () => void;
}

const NodeUnlockContext = createContext<NodeUnlockContextValue | null>(null);

export function dispatchGlobalNodeUnlock(input: NodeUnlockInput): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<NodeUnlockInput>(NODE_UNLOCK_EVENT_NAME, { detail: input }));
}

export const NodeUnlockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<CompetencyNodeUnlock[]>([]);

  const triggerNodeUnlock = useCallback((input: NodeUnlockInput) => {
    const entry: CompetencyNodeUnlock = {
      ...input,
      id: input.id || `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
    setQueue((prev) => {
      if (prev.some((item) => item.id === entry.id)) {
        return prev;
      }
      return [...prev, entry];
    });
  }, []);

  const dismissActiveNode = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleCustomUnlock = (event: Event) => {
      const detail = (event as CustomEvent<NodeUnlockInput>).detail;
      if (detail && detail.title) {
        triggerNodeUnlock(detail);
      }
    };
    window.addEventListener(NODE_UNLOCK_EVENT_NAME, handleCustomUnlock);
    return () => {
      window.removeEventListener(NODE_UNLOCK_EVENT_NAME, handleCustomUnlock);
    };
  }, [triggerNodeUnlock]);

  const value: NodeUnlockContextValue = {
    activeNode: queue[0] ?? null,
    queueLength: queue.length,
    triggerNodeUnlock,
    dismissActiveNode,
  };

  return <NodeUnlockContext.Provider value={value}>{children}</NodeUnlockContext.Provider>;
};

export function useNodeUnlock(): NodeUnlockContextValue {
  const ctx = useContext(NodeUnlockContext);
  if (!ctx) {
    throw new Error('useNodeUnlock must be used inside a NodeUnlockProvider.');
  }
  return ctx;
}
