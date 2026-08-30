import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Api } from '../core/api';
import { ALERT_LABELS, Alert, Stats } from '../core/models';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe],
  template: `
    <h1>Tableau de bord</h1>

    @if (stats(); as s) {
      <p class="muted">Journée du {{ s.date }}</p>
      <div class="tiles">
        <div class="tile"><span>{{ s.presents }}</span><small>Présents</small></div>
        <div class="tile warn"><span>{{ s.retards }}</span><small>Retards</small></div>
        <div class="tile bad"><span>{{ s.absents }}</span><small>Absents</small></div>
        <div class="tile"><span>{{ s.autorises }}</span><small>Accès autorisés</small></div>
        <div class="tile bad"><span>{{ s.refuses }}</span><small>Accès refusés</small></div>
        <div class="tile warn"><span>{{ s.alertes_non_vues }}</span><small>Alertes</small></div>
      </div>
    } @else {
      <p class="muted">Chargement…</p>
    }

    <section>
      <h2>Dernières alertes <a routerLink="/alerts" class="more">tout voir</a></h2>
      @if (alerts().length) {
        <table>
          <tr><th>Heure</th><th>Type</th><th>Détail</th><th>Caméra</th></tr>
          @for (a of alerts(); track a.id) {
            <tr>
              <td>{{ a.created_at | date: 'HH:mm' }}</td>
              <td>{{ labels[a.kind] }}</td>
              <td>{{ a.message }}</td>
              <td>{{ a.camera_id }}</td>
            </tr>
          }
        </table>
      } @else {
        <p class="muted">Aucune alerte.</p>
      }
    </section>
  `,
  styles: `
    .tiles { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); }
    .tile { display: grid; gap: .2rem; padding: 1.2rem; background: var(--surface);
            border-radius: 10px; border-left: 4px solid var(--ok); }
    .tile.warn { border-left-color: var(--warn); }
    .tile.bad { border-left-color: var(--bad); }
    .tile span { font-size: 2rem; font-weight: 600; }
    .tile small { color: var(--muted); }
    section { margin-top: 2rem; }
    .more { float: right; font-size: .8rem; font-weight: 400; }
  `,
})
export class Dashboard {
  private api = inject(Api);
  readonly labels = ALERT_LABELS;
  readonly stats = signal<Stats | null>(null);
  readonly alerts = signal<Alert[]>([]);

  constructor() {
    this.api.stats().subscribe((s) => this.stats.set(s));
    this.api.alerts().subscribe((page) => this.alerts.set(page.results.slice(0, 5)));
  }
}
