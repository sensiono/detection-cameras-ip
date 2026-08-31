import { Injectable, signal } from '@angular/core';

export interface ModalData {
  title?: string;
  subtitle?: string;
  imageSrc: string;
}

@Injectable({ providedIn: 'root' })
export class ModalService {
  readonly activeModal = signal<ModalData | null>(null);

  open(data: ModalData): void {
    this.activeModal.set(data);
  }

  close(): void {
    this.activeModal.set(null);
  }
}
