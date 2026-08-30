import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Api } from '../core/api';
import { Attendance as Row, User } from '../core/models';

@Component({
  selector: 'app-attendance',
  imports: [FormsModule],
  template: `
    <h1>Présences</h1>

    <div class="filters">
      <label>Du <input type="date" [(ngModel)]="from" (change)="load()" /></label>
      <label>Au <input type="date" [(ngModel)]="to" (change)="load()" /></label>
      <label>Personne
        <select [(ngModel)]="user" (change)="load()">
          <option value="">Toutes</option>
          @for (m of members(); track m.id) {
            <option [value]="m.id">{{ m.nom }} {{ m.prenom }}</option>
          }
        </select>
      </label>
      <span class="spacer"></span>
      <button (click)="download('xlsx')">Excel</button>
      <button (click)="download('pdf')">PDF</button>
    </div>

    <table>
      <tr><th>Date</th><th>Personne</th><th>Arrivée</th><th>Départ</th><th>Statut</th>
          <th>Caméra</th><th>Photo</th></tr>
      @for (r of rows(); track r.id) {
        <tr>
          <td>{{ r.date }}</td>
          <td>{{ r.user_name }}</td>
          <td>{{ r.check_in }}</td>
          <td>{{ r.check_out ?? '—' }}</td>
          <td><span class="pill" [class.warn]="r.statut === 'late'">
            {{ r.statut === 'late' ? 'En retard' : 'Présent' }}</span></td>
          <td>{{ r.camera_id }}</td>
          <td>@if (r.snapshot) { <img [src]="r.snapshot" alt="Capture" /> }</td>
        </tr>
      } @empty {
        <tr><td colspan="7" class="muted">Aucune présence sur la période.</td></tr>
      }
    </table>
    <p class="muted">{{ count() }} enregistrement(s). Les absences figurent dans le rapport exporté.</p>
  `,
  styles: `
    img { height: 2.2rem; border-radius: 4px; }
  `,
})
export class AttendancePage {
  private api = inject(Api);
  readonly rows = signal<Row[]>([]);
  readonly members = signal<User[]>([]);
  readonly count = signal(0);

  from = '';
  to = '';
  user = '';

  constructor() {
    this.api.members().subscribe((page) => this.members.set(page.results));
    this.load();
  }

  private filters() {
    return { from: this.from, to: this.to, user: this.user };
  }

  load(): void {
    this.api.attendance(this.filters()).subscribe((page) => {
      this.rows.set(page.results);
      this.count.set(page.count);
    });
  }

  download(fmt: 'xlsx' | 'pdf'): void {
    this.api.downloadReport(fmt, { from: this.from, to: this.to });
  }
}
