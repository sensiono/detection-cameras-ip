import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Auth } from './core/auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (auth.token()) {
      <nav>
        <span class="brand">Vision</span>
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
          Tableau de bord
        </a>
        <a routerLink="/attendance" routerLinkActive="active">Présences</a>
        <a routerLink="/logs" routerLinkActive="active">Entrées / sorties</a>
        <a routerLink="/vehicles" routerLinkActive="active">Véhicules</a>
        <a routerLink="/alerts" routerLinkActive="active">Alertes</a>
        <span class="spacer"></span>
        @if (auth.user(); as u) { <span class="muted">{{ u.username }} · {{ u.role }}</span> }
        <button (click)="auth.logout()">Déconnexion</button>
      </nav>
    }
    <main><router-outlet /></main>
  `,
  styles: `
    nav { display: flex; align-items: center; gap: 1rem; padding: .8rem 1.5rem;
          background: var(--surface); box-shadow: 0 1px 4px #0001; flex-wrap: wrap; }
    .brand { font-weight: 700; letter-spacing: .05em; }
    nav a { color: var(--muted); text-decoration: none; font-size: .9rem; }
    nav a.active { color: var(--fg); font-weight: 600; }
    main { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
  `,
})
export class App {
  readonly auth = inject(Auth);

  constructor() {
    // A page refresh keeps the token but loses the role; fetch it back.
    if (this.auth.token() && !this.auth.user()) {
      this.auth.loadUser().subscribe({ error: () => this.auth.logout() });
    }
  }
}
