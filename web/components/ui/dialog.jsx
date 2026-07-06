'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

// Minimal dialog (no portal/radix): overlay + centered panel, closes on
// overlay click or Escape.
function Dialog({ open, onClose, children, className }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cn(
          'relative w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg',
          className
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

function DialogTitle({ className, ...props }) {
  return <h2 className={cn('mb-1 text-lg font-semibold', className)} {...props} />;
}

function DialogDescription({ className, ...props }) {
  return <p className={cn('mb-4 text-sm text-muted-foreground', className)} {...props} />;
}

export { Dialog, DialogTitle, DialogDescription };
