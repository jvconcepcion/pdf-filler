"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";

/*
  Generic modal: header (title + close), body, footer slot for actions. Purpose-
  specific modals compose this; keep it header/body/footer, not feature-specific.
  Controlled via open/onOpenChange. The close control uses Icons.close and simply
  requests close, so the default Dialog close button is turned off to avoid two.
*/
export interface ModalShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function ModalShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: ModalShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle>{title}</DialogTitle>
            <IconButton
              icon="close"
              aria-label="Close"
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
            />
          </div>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div>{children}</div>

        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
