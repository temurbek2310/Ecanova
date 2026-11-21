import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface OverflowMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}

export interface OverflowMenuProps {
  items: OverflowMenuItem[];
  /** Accessible label for the toggle button */
  label?: string;
  /** data-testid for the toggle */
  testId?: string;
}

/**
 * A compact "…" overflow menu for secondary row actions (edit, archive, delete,
 * etc.) so tables and lists stay uncluttered. Renders a popover aligned to the
 * bottom-end of the trigger. Click-outside or Escape closes it.
 */
export const OverflowMenu: React.FC<OverflowMenuProps> = ({
  items,
  label = 'More actions',
  testId,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, close]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, close]);

  if (items.length === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={label}
        aria-expanded={open}
        data-testid={testId}
        className="admin-overflow-trigger"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div className="admin-overflow-popover" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              title={item.title}
              disabled={item.disabled}
              onClick={() => {
                item.onClick();
                close();
              }}
              className={`admin-overflow-item${item.danger ? ' admin-overflow-item--danger' : ''}`}
            >
              {item.icon ? (
                <span className="admin-overflow-item-icon" aria-hidden="true">
                  {item.icon}
                </span>
              ) : null}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
