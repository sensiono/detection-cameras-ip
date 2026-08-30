import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';

import { Api } from '../core/api';
import { ALERT_LABELS, Alert } from '../core/models';

@Component({
  selector: 'app-alerts',
  imports: [DatePipe],
  template: `
    <h1>Alertes <span class="pill bad">{{ unseen() }} non vue(s)</span></h1>
    <p class="muted">
      Plaques refusées au portail, visages non reconnus, et photos présentées
      devant l'objectif à la place d'un visage.
    </p>

    <div class="grid">
      @for (a of rows(); track a.id) {
        <article class="card" [class.seen]="a.seen">
          @if (a.snapshot) {
            <img [src]="a.snapshot" alt="Capture de l'alerte" />
          } @else {
            <div class="nophoto">Sans capture</div>
          }
          <div class="body">
            <strong>{{ labels[a.kind] }}</strong>
            <span>{{ a.message }}</span>
            <small class="muted">
              {{ a.created_at | date: 'dd/MM/yyyy HH:mm' }} · {{ a.camera_id || 'caméra inconnue' }}
            </small>
            @if (!a.seen) { <button (click)="acknowledge(a)">Marquer comme vue</button> }
          </div>
        </article>
      } @empty {
        <p class="muted">Aucune alerte.</p>
      }
    </div>
  `,
  styles: `
    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); }
    .card { background: var(--surface); border-radius: 10px; overflow: hidden;
            border-left: 4px solid var(--bad); }
    .card.seen { border-left-color: var(--muted); opacity: .6; }
    .card img, .nophoto { width: 100%; height: 8rem; object-fit: cover; background: #0001; }
    .nophoto { display: grid; place-items: center; color: var(--muted); font-size: .8rem; }
    .body { display: grid; gap: .3rem; padding: .8rem; }
  `,
})
export class Alerts {
  private api = inject(Api);
  readonly labels = ALERT_LABELS;
  readonly rows = signal<Alert[]>([]);
  readonly unseen = computed(() => this.rows().filter((a) => !a.seen).length);

  constructor() {
    this.api.alerts().subscribe((page) => this.rows.set(page.results));
  }

  acknowledge(alert: Alert): void {
    this.api.markSeen(alert.id).subscribe((updated) =>
      this.rows.update((rows) => rows.map((a) => (a.id === alert.id ? updated : a))),
    );
  }
}
