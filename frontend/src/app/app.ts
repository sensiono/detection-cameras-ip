import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Api } from './core/api';
import { Auth } from './core/auth';
import { ConfirmService } from './core/confirm';
import { I18nService, Lang } from './core/i18n';
import { ModalService } from './core/modal';
import { StreamService } from './core/stream';
import { ThemeService } from './core/theme';
import { ToastService } from './core/toast';



@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  template: `
    @if (auth.token()) {
      <header class="app-header">
        <div class="nav-container">
          <div class="brand">
            <div class="brand-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <span class="brand-text">VISION<span class="brand-badge">AI</span></span>
          </div>

          <nav class="nav-links">
            <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
              {{ i18n.t('nav.dashboard') }}
            </a>
            <a routerLink="/attendance" routerLinkActive="active">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {{ i18n.t('nav.attendance') }}
            </a>
            <a routerLink="/logs" routerLinkActive="active">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 11 2 11.5 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
              {{ i18n.t('nav.logs') }}
            </a>
            <a routerLink="/vehicles" routerLinkActive="active">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
              {{ i18n.t('nav.vehicles') }}
            </a>
            <a routerLink="/members" routerLinkActive="active">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.38 8.38 0 0 1 13 0"/></svg>
              {{ i18n.t('nav.members') }}
            </a>
            <a routerLink="/alerts" routerLinkActive="active">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none"/></svg>
              {{ i18n.t('nav.alerts') }}
            </a>

          </nav>

          <span class="spacer"></span>

          <div class="user-panel">
            <!-- Language Selector -->
            <div class="lang-selector" title="Changer la langue / Change language / تغيير اللغة">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <select [ngModel]="i18n.currentLang()" (ngModelChange)="onLangChange($event)">
                <option value="fr">FR</option>
                <option value="en">EN</option>
                <option value="ar">العربية</option>
              </select>
            </div>

            <div class="camera-status">
              <span class="pulse-dot"></span>
              <span class="cam-text">{{ activeCamerasCount() }} {{ i18n.t('nav.live_cams') }}</span>
            </div>


            <!-- Theme Toggle Button (Light/Dark) -->
            <button class="theme-toggle-btn" (click)="theme.toggle()" [title]="theme.mode() === 'light' ? 'Mode sombre' : 'Mode clair'">
              @if (theme.mode() === 'light') {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              } @else {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
              }
            </button>

            @if (auth.user(); as u) {
              <div class="user-badge">
                <div class="avatar">{{ u.username[0].toUpperCase() }}</div>
                <div class="user-meta">
                  <span class="uname">{{ u.username }}</span>
                  <span class="urole">{{ u.role }}</span>
                </div>
              </div>
            }

            <button class="logout-btn" (click)="auth.logout()" [title]="i18n.t('nav.logout')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </header>
    }
    
    <main class="app-main"><router-outlet /></main>

    <!-- Global Image Modal Popup -->
    @if (modal.activeModal(); as m) {
      <div class="modal-backdrop" (click)="modal.close()">
        <div class="modal-dialog" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="modal-title">{{ m.title || 'Capture de Contrôle' }}</h3>
            <button class="modal-close" (click)="modal.close()" title="Fermer (Échap)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <img [src]="m.imageSrc" class="modal-img" alt="Capture agrandie" />
            @if (m.subtitle) {
              <div class="modal-subtitle">{{ m.subtitle }}</div>
            }
          </div>
        </div>
      </div>
    }

    <!-- Global Confirmation Dialog Modal -->
    @if (confirmService.activeDialog(); as d) {
      <div class="modal-backdrop confirm-backdrop" (click)="confirmService.handle(false)">
        <div class="modal-dialog confirm-dialog" (click)="$event.stopPropagation()">
          <div class="confirm-icon-wrap" [class.danger]="d.danger">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </div>
          <div class="confirm-content">
            <h3 class="confirm-title">{{ d.title }}</h3>
            <p class="confirm-message">{{ d.message }}</p>
          </div>
          <div class="confirm-actions">
            <button type="button" class="confirm-btn-cancel" (click)="confirmService.handle(false)">
              {{ d.cancelText }}
            </button>
            <button type="button" class="confirm-btn-action" [class.danger]="d.danger" (click)="confirmService.handle(true)">
              {{ d.confirmText }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Global Toast Notifications Container -->
    @if (toast.toasts().length) {
      <div class="toast-container">
        @for (t of toast.toasts(); track t.id) {
          <div class="toast-card" [class]="t.type" (click)="toast.dismiss(t.id)">
            <div class="toast-icon">
              @if (t.type === 'success') {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              } @else if (t.type === 'warn') {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none"/></svg>
              } @else if (t.type === 'error') {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>
              } @else {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              }
            </div>
            <div class="toast-content">
              <div class="toast-title">{{ t.title }}</div>
              @if (t.message) {
                <div class="toast-msg">{{ t.message }}</div>
              }
            </div>
            <button class="toast-close" (click)="toast.dismiss(t.id); $event.stopPropagation()">✕</button>
          </div>
        }
      </div>
    }
  `,

  styles: `
    .app-header {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: var(--header-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--surface-border);
      box-shadow: var(--shadow-sm);
      transition: background 0.3s ease, border-color 0.3s ease;
    }
    .nav-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 1.5rem;
      height: 68px;
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      text-decoration: none;
      user-select: none;
    }
    .brand-icon {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-sm);
      background: linear-gradient(135deg, #2563eb, #6366f1);
      color: #fff;
      display: grid;
      place-items: center;
      box-shadow: 0 0 15px var(--brand-glow);
    }
    .brand-text {
      font-size: 1.2rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--fg);
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
    .brand-badge {
      font-size: 0.7rem;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      background: var(--brand);
      color: #fff;
      font-weight: 800;
      letter-spacing: 0.05em;
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .nav-links a {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.45rem 0.65rem;
      border-radius: var(--radius-sm);
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--fg-secondary);
      text-decoration: none;
      white-space: nowrap;
      transition: all 0.15s ease;
    }
    .nav-links a:hover {
      color: var(--fg);
      background: var(--surface-hover);
    }
    .nav-links a.active {
      color: var(--brand);
      background: var(--brand-glow);
    }

    .spacer { flex: 1; }
    .user-panel {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }
    .camera-status {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.3rem 0.65rem;
      border-radius: 9999px;
      background: var(--surface);
      border: 1px solid var(--surface-border);
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--fg);
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ok);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
    .theme-toggle-btn {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-sm);
      background: var(--surface);
      border: 1px solid var(--surface-border);
      color: var(--fg);
      display: grid;
      place-items: center;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      transition: all 0.2s ease;
      padding: 0;
    }
    .theme-toggle-btn:hover {
      background: var(--surface-hover);
      transform: translateY(-1px);
    }
    .user-badge {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.25rem 0.5rem;
      border-radius: var(--radius-sm);
      background: var(--surface);
      border: 1px solid var(--surface-border);
    }
    .avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      color: #fff;
      font-weight: 700;
      font-size: 0.8rem;
      display: grid;
      place-items: center;
    }
    .user-meta {
      display: flex;
      flex-direction: column;
      line-height: 1.15;
    }
    .uname {
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--fg);
    }
    .urole {
      font-size: 0.68rem;
      color: var(--muted);
      text-transform: capitalize;
    }
    .logout-btn {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-sm);
      background: var(--surface);
      border: 1px solid var(--surface-border);
      color: var(--bad);
      display: grid;
      place-items: center;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      transition: all 0.2s ease;
      padding: 0;
    }
    .logout-btn:hover {
      background: var(--bad-bg);
      border-color: var(--bad-border);
      transform: translateY(-1px);
    }
    .app-main {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem 1.5rem 4rem;
    }

    /* Platform Confirmation Dialog */
    .confirm-backdrop {
      z-index: 2500;
    }
    .confirm-dialog {
      max-width: 420px;
      padding: 1.75rem 1.5rem 1.5rem;
      border-radius: var(--radius-md);
      background: var(--surface);
      border: 1px solid var(--surface-border);
      box-shadow: var(--shadow-lg);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .confirm-icon-wrap {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      margin-bottom: 1rem;
      background: var(--surface-hover);
      color: var(--brand);
    }
    .confirm-icon-wrap.danger {
      background: var(--bad-bg);
      color: var(--bad);
      border: 1px solid var(--bad-border);
    }
    .confirm-content {
      margin-bottom: 1.5rem;
    }
    .confirm-title {
      font-size: 1.15rem;
      font-weight: 800;
      color: var(--fg);
      margin-bottom: 0.5rem;
    }
    .confirm-message {
      font-size: 0.88rem;
      color: var(--fg-secondary);
      line-height: 1.5;
      margin: 0;
    }
    .confirm-actions {
      display: flex;
      gap: 0.75rem;
      width: 100%;
    }
    .confirm-btn-cancel {
      flex: 1;
      padding: 0.65rem 1rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--surface-border);
      background: var(--surface-hover);
      color: var(--fg);
      font-weight: 600;
      font-size: 0.88rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .confirm-btn-cancel:hover {
      background: var(--surface-border);
    }
    .confirm-btn-action {
      flex: 1;
      padding: 0.65rem 1rem;
      border-radius: var(--radius-sm);
      border: none;
      background: var(--brand);
      color: #fff;
      font-weight: 700;
      font-size: 0.88rem;
      cursor: pointer;
      transition: all 0.15s ease;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }
    .confirm-btn-action.danger {
      background: var(--bad);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    }
    .confirm-btn-action:hover {
      transform: translateY(-1px);
    }
  `,
})
export class App implements OnInit, OnDestroy {
  private api = inject(Api);
  private stream = inject(StreamService);
  auth = inject(Auth);
  modal = inject(ModalService);
  confirmService = inject(ConfirmService);
  theme = inject(ThemeService);
  toast = inject(ToastService);
  i18n = inject(I18nService);

  readonly activeCamerasCount = signal<number>(2);
  private sub: any = null;

  ngOnInit(): void {
    if (this.auth.token()) {
      this.refreshCameras();
    }
    this.sub = this.stream.updates$.subscribe(() => {
      this.refreshCameras();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  refreshCameras(): void {
    this.api.cameras().subscribe({
      next: (res) => {
        const active = (res.results || []).filter((c) => c.enabled).length;
        this.activeCamerasCount.set(active);
      },
      error: () => {},
    });
  }


  onLangChange(lang: Lang): void {
    this.i18n.setLang(lang);
    const msg = lang === 'ar' ? 'تم تغيير اللغة بنجاح' : lang === 'en' ? 'Language switched to English' : 'Langue changée en Français';
    this.toast.info(msg);
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.modal.close();
  }
}


export const AppComponent = App;

