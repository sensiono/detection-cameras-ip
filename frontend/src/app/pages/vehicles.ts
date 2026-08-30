import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { Vehicle } from '../core/models';

const EMPTY: Vehicle = { plaque: '', proprietaire: '', type: 'car', autorise: true, user: null };

@Component({
  selector: 'app-vehicles',
  imports: [FormsModule],
  template: `
    <h1>Véhicules autorisés</h1>
    <p class="muted">
      C'est cette liste qui décide, au portail, entre autorisé et refusé.
    </p>

    @if (auth.canEdit) {
      <form class="row" (ngSubmit)="save()">
        <input name="plaque" [(ngModel)]="draft.plaque" placeholder="123 TN 4567" required />
        <input name="proprietaire" [(ngModel)]="draft.proprietaire" placeholder="Propriétaire" />
        <select name="type" [(ngModel)]="draft.type">
          <option value="bus">Bus</option>
          <option value="car">Voiture</option>
          <option value="other">Autre</option>
        </select>
        <label class="check">
          <input type="checkbox" name="autorise" [(ngModel)]="draft.autorise" /> Autorisé
        </label>
        <button type="submit">{{ draft.id ? 'Enregistrer' : 'Ajouter' }}</button>
        @if (draft.id) { <button type="button" (click)="reset()">Annuler</button> }
      </form>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    }

    <table>
      <tr><th>Plaque</th><th>Propriétaire</th><th>Type</th><th>Statut</th>
          @if (auth.canEdit) { <th></th> }</tr>
      @for (v of rows(); track v.id) {
        <tr>
          <td><code>{{ v.plaque }}</code></td>
          <td>{{ v.proprietaire || '—' }}</td>
          <td>{{ v.type }}</td>
          <td><span class="pill" [class.bad]="!v.autorise">
            {{ v.autorise ? 'Autorisé' : 'Bloqué' }}</span></td>
          @if (auth.canEdit) {
            <td class="actions">
              <button (click)="edit(v)">Modifier</button>
              <button class="danger" (click)="remove(v)">Supprimer</button>
            </td>
          }
        </tr>
      } @empty {
        <tr><td colspan="5" class="muted">Aucun véhicule enregistré.</td></tr>
      }
    </table>
  `,
  styles: `
    .row { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .check { display: flex; align-items: center; gap: .3rem; font-size: .85rem; }
    .actions { display: flex; gap: .4rem; }
    code { letter-spacing: .05em; }
  `,
})
export class Vehicles {
  private api = inject(Api);
  readonly auth = inject(Auth);
  readonly rows = signal<Vehicle[]>([]);
  readonly error = signal('');

  draft: Vehicle = { ...EMPTY };

  constructor() {
    this.load();
  }

  load(): void {
    this.api.vehicles().subscribe((page) => this.rows.set(page.results));
  }

  save(): void {
    this.error.set('');
    this.api.saveVehicle(this.draft).subscribe({
      next: () => {
        this.reset();
        this.load();
      },
      // The server canonicalises plates, so the usual failure is a duplicate.
      error: () => this.error.set('Enregistrement refusé : plaque invalide ou déjà présente.'),
    });
  }

  edit(vehicle: Vehicle): void {
    this.draft = { ...vehicle };
  }

  remove(vehicle: Vehicle): void {
    if (vehicle.id && confirm(`Supprimer ${vehicle.plaque} ?`)) {
      this.api.deleteVehicle(vehicle.id).subscribe(() => this.load());
    }
  }

  reset(): void {
    this.draft = { ...EMPTY };
  }
}
