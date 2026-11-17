'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** The cancel button; defaults to closing. Escape and the scrim still call `onOpenChange`. */
  onCancel?: () => void;
  pending?: boolean;
  /** Extra content under the description, such as a list of affected items. */
  children?: ReactNode;
  className?: string;
  /** The confirm button uses the destructive colour. */
  destructive?: boolean;
  /** One column with the confirm button on top, for screens where a thumb reaches the top first. */
  stacked?: boolean;
  /** The cancel button style; stacked dialogs default to secondary. */
  cancelVariant?: 'secondary' | 'ghost';
}

/** A yes/no dialog whose buttons share the width and wrap long labels instead of overflowing. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  pending,
  children,
  className,
  destructive,
  stacked,
  cancelVariant = 'secondary',
}: ConfirmDialogProps) {
  const cancel = (
    <Button
      key="cancel"
      variant={cancelVariant}
      className="h-auto min-h-12 w-full py-2 whitespace-normal"
      onClick={onCancel ?? (() => onOpenChange(false))}
    >
      {cancelLabel}
    </Button>
  );
  const confirm = (
    <Button
      key="confirm"
      variant={destructive ? 'destructive' : 'primary'}
      className="h-auto min-h-12 w-full py-2 whitespace-normal"
      disabled={pending}
      onClick={onConfirm}
    >
      {confirmLabel}
    </Button>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('gap-5 rounded-xl p-5 sm:max-w-md', className)}>
        <DialogHeader className="pr-8">
          <DialogTitle className="text-lg font-extrabold">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter
          className={cn(
            '-mx-5 -mb-5 grid grid-cols-1 rounded-b-xl p-5',
            // Stacked dialogs are one surface (session and log out designs), with no footer band.
            stacked ? 'gap-2 border-t-0 bg-transparent pt-1' : 'sm:grid-cols-2',
          )}
        >
          {stacked ? [confirm, cancel] : [cancel, confirm]}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
