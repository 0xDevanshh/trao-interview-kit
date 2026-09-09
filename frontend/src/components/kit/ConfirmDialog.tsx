"use client";

import type { ReactElement, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
  /** Omit when the dialog is externally controlled via `open`/`onOpenChange`
   * (e.g. triggered from a DropdownMenuItem — nesting a DialogTrigger
   * inside a menu item is unsafe, since selecting the item unmounts the
   * menu, and the trigger, before the dialog has a chance to open). */
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

/** Shared confirm-before-you-do-it dialog: used for deletes, category
 * regenerates, and the company-brief regenerate's "this will overwrite
 * your edits" warning. Base-ui's Dialog traps focus and restores it to the
 * trigger on close, and both buttons are reachable by Tab. */
export function ConfirmDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <DialogClose render={<Button variant={destructive ? "destructive" : "default"} onClick={onConfirm} />}>
            {confirmLabel}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
