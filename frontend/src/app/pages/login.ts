import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Auth } from '../core/auth';
import { I18nService, Lang } from '../core/i18n';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="login-wrapper">
      <div class="login-backdrop"></div>

      <!-- Language selector at top right of login screen -->
      <div class="login-lang-bar">
        <div class="lang-selector">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          <select [ngModel]="i18n.currentLang()" (ngModelChange)="i18n.setLang($event)">
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </div>
      </div>
      
      <form (ngSubmit)="submit()" class="glass-card login-card">
        <div class="brand-header">
          <div class="logo-circle">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7V12C3 17.52 6.84 22.74 12 24C17.16 22.74 21 17.52 21 12V7L12 2Z" fill="#ffffff" />
              <path d="M12 5.2L5.5 8.4V12C5.5 15.8 8.2 19.3 12 20.4C15.8 19.3 18.5 15.8 18.5 12V8.4L12 5.2Z" fill="#5046e5" />
              <path d="M10 8.8H13C13.8 8.8 14.5 9.5 14.5 10.3C14.5 10.9 14.2 11.4 13.7 11.6C14.4 11.9 14.8 12.6 14.8 13.3C14.8 14.3 14 15 13 15H10V8.8ZM11.4 11.2H12.8C13.2 11.2 13.4 11 13.4 10.6C13.4 10.3 13.2 10.1 12.8 10.1H11.4V11.2ZM11.4 13.7H12.9C13.3 13.7 13.6 13.4 13.6 13C13.6 12.7 13.3 12.4 12.9 12.4H11.4V13.7Z" fill="#ffffff"/>
            </svg>
          </div>
          <h1>SafeWatch</h1>
          <p class="subtitle">{{ i18n.t('nav.tagline') || 'Surveillance intelligente' }}</p>
        </div>

        @if (isSignup) {
          <div class="row-2">
            <div class="input-field">
              <label for="fn">{{ i18n.t('members.firstname') }}</label>
              <input id="fn" name="prenom" [(ngModel)]="prenom" autocomplete="given-name" />
            </div>
            <div class="input-field">
              <label for="ln">{{ i18n.t('members.lastname') }}</label>
              <input id="ln" name="nom" [(ngModel)]="nom" autocomplete="family-name" />
            </div>
          </div>
          <div class="input-field">
            <label for="em">{{ i18n.t('signup.email') }}</label>
            <input id="em" name="email" type="email" [(ngModel)]="email" autocomplete="email" />
          </div>
          <div class="input-field">
            <label for="role">{{ i18n.t('members.role') }}</label>
            <select id="role" name="role" [(ngModel)]="role">
              <option value="supervisor">{{ i18n.t('members.role_supervisor') }}</option>
              <option value="admin">{{ i18n.t('members.role_admin') }}</option>
            </select>
          </div>
        }

        <div class="input-field">
          <label for="u">{{ i18n.t('login.username') }}</label>
          <div class="input-container">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <input id="u" name="username" [(ngModel)]="username" autocomplete="username" placeholder="admin" required />
          </div>
        </div>

        <div class="input-field">
          <label for="p">{{ i18n.t('login.password') }}</label>
          <div class="input-container">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <input id="p" name="password" type="password" [(ngModel)]="password"
                   [attr.autocomplete]="isSignup ? 'new-password' : 'current-password'" placeholder="••••••••" required />
          </div>
        </div>

        @if (isSignup) {
          <div class="input-field">
            <label for="p2">{{ i18n.t('signup.confirm') }}</label>
            <input id="p2" name="confirm" type="password" [(ngModel)]="confirm" autocomplete="new-password" placeholder="••••••••" required />
          </div>
        }

        @if (notice()) {
          <div class="notice-banner" role="status">{{ notice() }}</div>
        }

        @if (error()) {
          <div class="error-banner" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.9" fill="currentColor" stroke="none"/></svg>
            <span>{{ error() }}</span>
          </div>
        }

        <button type="submit" [disabled]="busy()" class="submit-btn">
          @if (busy()) {
            <span class="btn-loader"></span>
            <span>...</span>
          } @else {
            <span>{{ i18n.t(isSignup ? 'signup.submit' : 'login.submit') }}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          }
        </button>

        <p class="switch-mode">
          @if (isSignup) {
            {{ i18n.t('login.have_account') }} <a routerLink="/login">{{ i18n.t('login.submit') }}</a>
          } @else {
            {{ i18n.t('login.no_account') }} <a routerLink="/signup">{{ i18n.t('signup.link') }}</a>
          }
        </p>

        <div class="login-footer">
          <span class="muted text-xs">Moteur Vision Edge & Architecture Décentralisée · v2.0</span>
        </div>
      </form>
    </div>
  `,
  styles: `
    .login-wrapper {
      min-height: 80vh;
      display: grid;
      place-items: center;
      position: relative;
      padding: 1.5rem;
    }
    .login-lang-bar {
      position: absolute;
      top: 1rem;
      right: 1.5rem;
      z-index: 10;
    }
    [dir="rtl"] .login-lang-bar {
      right: auto;
      left: 1.5rem;
    }
    .login-backdrop {
      position: absolute;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(37, 99, 235, 0.15) 0%, rgba(99, 102, 241, 0.05) 50%, transparent 70%);
      filter: blur(40px);
      z-index: 0;
      pointer-events: none;
    }
    .login-card {
      width: 100%;
      max-width: 400px;
      padding: 2.25rem;
      position: relative;
      z-index: 1;
      box-shadow: var(--shadow-lg);
      border-radius: var(--radius-lg);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .brand-header {
      text-align: center;
      margin-bottom: 0.5rem;
    }
    .logo-circle {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: linear-gradient(135deg, #2563eb, #6366f1);
      color: #fff;
      display: grid;
      place-items: center;
      margin: 0 auto 1rem;
      box-shadow: 0 0 20px var(--brand-glow);
    }
    .brand-header h1 {
      font-size: 1.5rem;
      margin: 0 0 0.25rem 0;
      letter-spacing: -0.02em;
    }
    .subtitle {
      font-size: 0.85rem;
      color: var(--muted);
      margin: 0;
    }
    .input-field {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .input-field label {
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--fg-secondary);
    }
    .input-container {
      position: relative;
      display: flex;
      align-items: center;
    }
    .input-container svg {
      position: absolute;
      left: 12px;
      color: var(--muted);
      pointer-events: none;
    }
    [dir="rtl"] .input-container svg {
      left: auto;
      right: 12px;
    }
    .input-container input {
      width: 100%;
      padding-left: 2.35rem;
    }
    [dir="rtl"] .input-container input {
      padding-left: 0.75rem;
      padding-right: 2.35rem;
    }
    .error-banner {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-sm);
      background: var(--bad-bg);
      border: 1px solid var(--bad-border);
      color: var(--bad);
      font-size: 0.85rem;
      font-weight: 600;
      animation: shake 0.3s ease-in-out;
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%, 60% { transform: translateX(-4px); }
      40%, 80% { transform: translateX(4px); }
    }
    .submit-btn {
      margin-top: 0.5rem;
      padding: 0.85rem 1.25rem;
      font-size: 0.95rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    .btn-loader {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .login-footer {
      text-align: center;
      margin-top: 0.5rem;
    }
    .text-xs { font-size: 0.75rem; }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .notice-banner {
      padding: 0.75rem 1rem;
      border-radius: var(--radius-sm);
      background: var(--ok-bg);
      color: var(--ok);
      font-size: 0.85rem;
      font-weight: 600;
    }
    .switch-mode { text-align: center; font-size: 0.85rem; color: var(--muted); margin: 0; }
    .switch-mode a { color: var(--brand); font-weight: 700; }
  `,
})
export class LoginPage {
  private auth = inject(Auth);
  private router = inject(Router);
  i18n = inject(I18nService);

  readonly isSignup = !!inject(ActivatedRoute).snapshot.data['signup'];

  username = '';
  password = '';
  confirm = '';
  email = '';
  nom = '';
  prenom = '';
  role = 'supervisor';
  busy = signal(false);
  error = signal<string | null>(null);
  notice = signal<string | null>(null);

  submit(): void {
    if (!this.username || !this.password) return;
    if (this.isSignup) return this.signup();
    this.busy.set(true);
    this.error.set(null);
    this.auth.login(this.username, this.password).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (err) => {
        this.busy.set(false);
        const serverMsg = err.error?.error?.message;
        this.error.set(serverMsg || this.i18n.t('login.error'));
      },
    });
  }

  private signup(): void {
    if (this.password !== this.confirm) {
      this.error.set(this.i18n.t('signup.mismatch'));
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    const { username, password, email, nom, prenom, role } = this;
    this.auth.signup({ username, password, email, nom, prenom, role }).subscribe({
      next: () => {
        this.busy.set(false);
        this.password = this.confirm = '';
        this.notice.set(this.i18n.t('signup.pending'));
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err.error?.error?.message || this.i18n.t('signup.error'));
      },
    });
  }
}

export const Login = LoginPage;

