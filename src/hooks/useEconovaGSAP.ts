'use client';

import React from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export type GSAPAnimationCallback = (
  context: gsap.Context,
  contextSafe?: <T extends (...args: unknown[]) => unknown>(fn: T) => T
) => void | (() => void);

export interface UseEconovaGSAPConfig {
  scope?: React.RefObject<HTMLElement | SVGElement | null>;
  dependencies?: unknown[];
  revertOnUpdate?: boolean;
  extraDependents?: unknown[];
}

/**
 * Custom GSAP hook for ECONOVA components.
 * Wraps `@gsap/react`'s `useGSAP` with strict null checks on the container scope ref
 * to completely eliminate "Invalid scope" warnings and runtime errors.
 */
export function useEconovaGSAP(
  scopeRef: React.RefObject<HTMLElement | SVGElement | null>,
  callback: GSAPAnimationCallback,
  config?: unknown[] | UseEconovaGSAPConfig
): void;
export function useEconovaGSAP(
  callback: GSAPAnimationCallback,
  config?: UseEconovaGSAPConfig
): void;
export function useEconovaGSAP(
  scopeRefOrCallback:
    | React.RefObject<HTMLElement | SVGElement | null>
    | GSAPAnimationCallback,
  callbackOrConfig?: GSAPAnimationCallback | unknown[] | UseEconovaGSAPConfig,
  maybeConfig?: unknown[] | UseEconovaGSAPConfig
): void {
  const isFirstParamRef =
    typeof scopeRefOrCallback === 'object' &&
    scopeRefOrCallback !== null &&
    'current' in scopeRefOrCallback;

  const targetScopeRef: React.RefObject<HTMLElement | SVGElement | null> | undefined =
    isFirstParamRef
      ? (scopeRefOrCallback as React.RefObject<HTMLElement | SVGElement | null>)
      : typeof callbackOrConfig === 'object' &&
        callbackOrConfig !== null &&
        'scope' in callbackOrConfig
      ? ((callbackOrConfig as UseEconovaGSAPConfig).scope as React.RefObject<
          HTMLElement | SVGElement | null
        >)
      : undefined;

  const animationCallback: GSAPAnimationCallback = (
    isFirstParamRef ? callbackOrConfig : scopeRefOrCallback
  ) as GSAPAnimationCallback;

  const rawConfig = isFirstParamRef ? maybeConfig : (callbackOrConfig as UseEconovaGSAPConfig);

  const normalizedConfig: {
    scope?: React.RefObject<HTMLElement | SVGElement | null>;
    dependencies?: unknown[];
    revertOnUpdate?: boolean;
  } = Array.isArray(rawConfig)
    ? { scope: targetScopeRef, dependencies: rawConfig }
    : {
        scope: targetScopeRef ?? rawConfig?.scope,
        dependencies: rawConfig?.dependencies,
        revertOnUpdate: rawConfig?.revertOnUpdate,
      };

  useGSAP(
    (context, contextSafe) => {
      // Crucial strict null check on scope ref before executing animations
      if (!targetScopeRef || !targetScopeRef.current) {
        return;
      }

      return animationCallback(context, contextSafe);
    },
    normalizedConfig
  );
}

export default useEconovaGSAP;
