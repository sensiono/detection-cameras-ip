import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  type: 'success' | 'info' | 'warn' | 'error';
  title: string;
  message?: string;
  timeout?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private counter = 0;

  show(type: 'success' | 'info' | 'warn' | 'error', title: string, message?: string, duration = 3500): void {
    const id = ++this.counter;
    const toast: Toast = { id, type, title, message };
    this.toasts.update((list) => [...list, toast]);

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  success(title: string, message?: string): void {
    this.show('success', title, message);
  }

  ok(title: string, message?: string): void {
    this.success(title, message);
  }

  info(title: string, message?: string): void {
    this.show('info', title, message);
  }

  warn(title: string, message?: string): void {
    this.show('warn', title, message);
  }

  error(title: string, message?: string): void {
    this.show('error', title, message, 5000);
  }

  bad(title: string, message?: string): void {
    this.error(title, message);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

}
