import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { Auth } from '../core/auth';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="login">
      <form (ngSubmit)="submit()" class="card">
        <h1>Supervision</h1>
        <p class="muted">Système de détection par caméras IP</p>

        <label for="u">Identifiant</label>
        <input id="u" name="username" [(ngModel)]="username" autocomplete="username" required />

        <label for="p">Mot de passe</label>
        <input id="p" name="password" type="password" [(ngModel)]="password"
               autocomplete="current-password" required />

        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

        <button type="submit" [disabled]="busy()">
          {{ busy() ? 'Connexion…' : 'Se connecter' }}
        </button>
      </form>
    </div>
  `,
  styles: `
    .login { display: grid; place-items: center; min-height: 100vh; }
    .card { display: grid; gap: .5rem; width: min(22rem, 90vw); padding: 2rem;
            background: var(--surface); border-radius: 12px; box-shadow: 0 8px 30px #0002; }
    h1 { margin: 0; font-size: 1.4rem; }
    .muted { margin: 0 0 1rem; color: var(--muted); font-size: .85rem; }
    label { font-size: .8rem; color: var(--muted); }
    button { margin-top: 1rem; }
  `,
})
export class Login {
  private auth = inject(Auth);
  private router = inject(Router);

  username = '';
  password = '';
  readonly busy = signal(false);
  readonly error = signal('');

  submit(): void {
    this.busy.set(true);
    this.error.set('');
    this.auth.login(this.username, this.password).subscribe({
      next: () => this.auth.loadUser().subscribe(() => this.router.navigate(['/'])),
      error: () => {
        this.error.set('Identifiants invalides.');
        this.busy.set(false);
      },
    });
  }
}
