import { Injectable, signal } from '@angular/core';

export interface ConfirmDialogData {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  resolve: (result: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly activeDialog = signal<ConfirmDialogData | null>(null);

  confirm(options: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
  }): Promise<boolean> {
    return new Promise((resolve) => {
      this.activeDialog.set({
        title: options.title || 'Confirmation',
        message: options.message,
        confirmText: options.confirmText || 'Confirmer',
        cancelText: options.cancelText || 'Annuler',
        danger: options.danger !== false,
        resolve: (result: boolean) => {
          this.activeDialog.set(null);
          resolve(result);
        },
      });
    });
  }

  handle(result: boolean): void {
    const dialog = this.activeDialog();
    if (dialog) {
      dialog.resolve(result);
    }
  }
}
