import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Api } from '../core/api';
import { AccessLog } from '../core/models';

@Component({
  selector: 'app-logs',
  imports: [FormsModule],
  template: `
    <h1>Entrées / sorties</h1>

    <div class="filters">
      <label>Du <input type="date" [(ngModel)]="from" (change)="load()" /></label>
      <label>Au <input type="date" [(ngModel)]="to" (change)="load()" /></label>
      <label>Statut
        <select [(ngModel)]="statut" (change)="load()">
          <option value="">Tous</option>
          <option value="autorise">Autorisés</option>
          <option value="refuse">Refusés</option>
        </select>
      </label>
    </div>

    <table>
      <tr><th>Date</th><th>Heure</th><th>Plaque</th><th>Statut</th><th>Caméra</th>
          <th>Fiabilité</th><th>Photo</th></tr>
      @for (l of rows(); track l.id) {
        <tr>
          <td>{{ l.date }}</td>
          <td>{{ l.heure }}</td>
          <td><code>{{ l.plaque }}</code></td>
          <td><span class="pill" [class.bad]="l.statut === 'refuse'">
            {{ l.statut === 'refuse' ? 'Refusé' : 'Autorisé' }}</span></td>
          <td>{{ l.camera_id }}</td>
          <td>{{ (l.confidence * 100).toFixed(0) }} %</td>
          <td>@if (l.snapshot) { <img [src]="l.snapshot" alt="Plaque lue" /> }</td>
        </tr>
      } @empty {
        <tr><td colspan="7" class="muted">Aucun passage sur la période.</td></tr>
      }
    </table>
    <p class="muted">{{ count() }} passage(s).</p>
  `,
  styles: `img { height: 2rem; border-radius: 4px; }`,
})
export class Logs {
  private api = inject(Api);
  readonly rows = signal<AccessLog[]>([]);
  readonly count = signal(0);

  from = '';
  to = '';
  statut = '';

  constructor() {
    this.load();
  }

  load(): void {
    this.api.logs({ from: this.from, to: this.to, statut: this.statut }).subscribe((page) => {
      this.rows.set(page.results);
      this.count.set(page.count);
    });
  }
}
