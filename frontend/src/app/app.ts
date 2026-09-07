import { DatePipe } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { Api } from './core/api';
import { Auth } from './core/auth';
import { ConfirmService } from './core/confirm';
import { I18nService, Lang } from './core/i18n';
import { ModalService } from './core/modal';
import { Alert } from './core/models';
import { StreamService } from './core/stream';
import { ThemeService } from './core/theme';
import { ToastService } from './core/toast';



@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, DatePipe],
  template: `
    @if (auth.token()) {
      <div class="safewatch-shell">
        <!-- SafeWatch Left Sidebar -->
        <aside class="safewatch-sidebar">
          <!-- Brand Header -->
          <div class="sidebar-brand">
            <div class="brand-shield-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 7V12C3 17.52 6.84 22.74 12 24C17.16 22.74 21 17.52 21 12V7L12 2Z" fill="#ffffff" />
                <path d="M12 5.2L5.5 8.4V12C5.5 15.8 8.2 19.3 12 20.4C15.8 19.3 18.5 15.8 18.5 12V8.4L12 5.2Z" fill="#5046e5" />
                <path d="M10 8.8H13C13.8 8.8 14.5 9.5 14.5 10.3C14.5 10.9 14.2 11.4 13.7 11.6C14.4 11.9 14.8 12.6 14.8 13.3C14.8 14.3 14 15 13 15H10V8.8ZM11.4 11.2H12.8C13.2 11.2 13.4 11 13.4 10.6C13.4 10.3 13.2 10.1 12.8 10.1H11.4V11.2ZM11.4 13.7H12.9C13.3 13.7 13.6 13.4 13.6 13C13.6 12.7 13.3 12.4 12.9 12.4H11.4V13.7Z" fill="#ffffff"/>
              </svg>
            </div>
            <div class="brand-titles">
              <h2 class="brand-name">SafeWatch</h2>
              <span class="brand-tagline">Surveillance intelligente</span>
            </div>
          </div>

          <!-- Navigation Links -->
          <nav class="sidebar-nav">
            <!-- 1. Tableau de bord -->
            <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="nav-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span class="nav-item-label">{{ i18n.t('nav.dashboard') }}</span>
              <span class="active-indicator"></span>
            </a>

            <!-- 2. Caméras -->
            <a routerLink="/cameras" routerLinkActive="active" class="nav-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              <span class="nav-item-label">{{ i18n.t('nav.cameras') }}</span>
              <span class="active-indicator"></span>
            </a>

            <!-- 3. Enregistrements (Présences) -->
            <a routerLink="/attendance" routerLinkActive="active" class="nav-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span class="nav-item-label">{{ i18n.t('nav.recordings') }}</span>
              <span class="active-indicator"></span>
            </a>

            <!-- 4. Événements (Logs) -->
            <a routerLink="/logs" routerLinkActive="active" class="nav-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span class="nav-item-label">{{ i18n.t('nav.events') }}</span>
              <span class="active-indicator"></span>
            </a>

            <!-- 5. Alertes -->
            <a routerLink="/alerts" routerLinkActive="active" class="nav-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none"/></svg>
              <span class="nav-item-label">{{ i18n.t('nav.alerts') }}</span>
              @if (unreadAlertsCount() > 0) {
                <span class="nav-item-badge">{{ unreadAlertsCount() }}</span>
              }
              <span class="active-indicator"></span>
            </a>

            <!-- 6. Rapports (Vehicles/Reports) -->
            <a routerLink="/vehicles" routerLinkActive="active" class="nav-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>
              <span class="nav-item-label">{{ i18n.t('nav.reports') }}</span>
              <span class="active-indicator"></span>
            </a>

            <!-- 7. Utilisateurs (Membres) -->
            <a routerLink="/members" routerLinkActive="active" class="nav-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span class="nav-item-label">{{ i18n.t('nav.users') }}</span>
              <span class="active-indicator"></span>
            </a>

            <!-- 8. Paramètres -->
            <button type="button" class="nav-item nav-btn-item" (click)="openSettingsModal()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              <span class="nav-item-label">{{ i18n.t('nav.settings') }}</span>
            </button>
          </nav>

          <!-- Sidebar Footer with Logout -->
          <div class="sidebar-footer">
            <button type="button" class="logout-action-btn" (click)="auth.logout()" [title]="i18n.t('nav.logout')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" y2="12"/>
              </svg>
              <span>{{ i18n.t('nav.logout') }}</span>
            </button>
          </div>
        </aside>

        <!-- Right Content Area -->
        <div class="safewatch-content-wrap">
          <!-- Topbar -->
          <header class="safewatch-topbar">
            <div class="topbar-welcome">
              <h1 class="topbar-title">{{ pageTitle() }}</h1>
              <p class="topbar-subtitle">{{ pageSubtitle() }}</p>
            </div>

            <div class="topbar-controls">
              <!-- Notifications Dropdown (List without images) -->
              <div class="topbar-alert-wrapper">
                <button type="button" class="topbar-icon-btn" (click)="toggleAlertsDropdown($event)" title="Alertes">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  @if (unreadAlertsCount() > 0) {
                    <span class="notif-badge">{{ unreadAlertsCount() }}</span>
                  }
                </button>

                @if (showAlertsDropdown()) {
                  <div class="alerts-dropdown-menu" (click)="$event.stopPropagation()">
                    <div class="alerts-dropdown-header">
                      <div class="alerts-dd-title">
                        <strong>{{ i18n.t('nav.alerts') || 'Alertes' }}</strong>
                        @if (unreadAlertsCount() > 0) {
                          <span class="badge-count">{{ unreadAlertsCount() }}</span>
                        }
                      </div>
                      @if (unreadAlertsCount() > 0) {
                        <button type="button" class="btn-mark-all" (click)="markAllAlertsSeen()">Tout marquer lu</button>
                      }
                    </div>

                    <div class="alerts-dropdown-list">
                      @for (alert of recentAlertsList(); track alert.id) {
                        <div class="alert-dropdown-item" [class.unseen]="!alert.seen" (click)="onAlertItemClick(alert)">
                          <div class="alert-dd-icon" [class.danger]="alert.kind === 'spoof_attempt' || alert.kind === 'refused_plate'">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                              <line x1="12" y1="9" x2="12" y2="13"/>
                              <circle cx="12" cy="17" r="0.8" fill="currentColor"/>
                            </svg>
                          </div>
                          <div class="alert-dd-body">
                            <div class="alert-dd-msg">{{ alert.message }}</div>
                            <div class="alert-dd-meta font-mono">
                              <span>{{ alert.camera_id || 'Caméra' }}</span>
                              <span>·</span>
                              <span>{{ alert.created_at ? (alert.created_at | date:'HH:mm:ss') : 'Récemment' }}</span>
                            </div>
                          </div>
                          @if (!alert.seen) {
                            <span class="unread-dot"></span>
                          }
                        </div>
                      }
                      @empty {
                        <div class="empty-alerts-text">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                          </svg>
                          <p>{{ i18n.t('dash.no_alerts') || 'Aucune alerte enregistrée' }}</p>
                        </div>
                      }
                    </div>

                    <div class="alerts-dropdown-footer">
                      <button type="button" class="btn-all-alerts" (click)="goToAllAlerts()">
                        <span>{{ i18n.t('dash.all_alerts') || 'Voir toutes les alertes' }}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                }
              </div>

              <!-- Theme Toggle Button (Light/Dark) -->
              <button class="topbar-icon-btn" (click)="theme.toggle()" [title]="theme.mode() === 'light' ? 'Mode sombre' : 'Mode clair'">
                @if (theme.mode() === 'light') {
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                } @else {
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                }
              </button>

              <!-- Language Selector -->
              <div class="lang-selector-pill" title="Changer la langue / Change language / تغيير اللغة">
                <select [ngModel]="i18n.currentLang()" (ngModelChange)="onLangChange($event)">
                  <option value="fr">FR</option>
                  <option value="en">EN</option>
                  <option value="ar">العربية</option>
                </select>
              </div>

              <!-- User Profile Badge -->
              <div class="topbar-user-pill" (click)="openSettingsModal()" [title]="i18n.t('settings.title')">
                <div class="user-avatar-circle">
                  {{ (auth.user()?.username || 'A')[0].toUpperCase() }}
                </div>
                <div class="user-info-text">
                  <span class="user-name-display">{{ auth.user()?.username || 'Admin' }}</span>
                  <span class="user-role-display">{{ auth.user()?.role === 'admin' ? 'Superviseur' : (auth.user()?.role || 'Utilisateur') }}</span>
                </div>
                <svg class="chevron-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
          </header>

          <!-- Main Page Body -->
          <main class="safewatch-page-viewport">
            <router-outlet />
          </main>
        </div>
      </div>
    } @else {
      <main class="auth-only-viewport">
        <router-outlet />
      </main>
    }

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

    <!-- User Settings & Profile Modal -->
    @if (showSettingsModal()) {
      <div class="modal-backdrop" (click)="closeSettingsModal()">
        <div class="modal-dialog settings-modal-dialog" (click)="$event.stopPropagation()">
          <div class="settings-header-redesign">
            <div class="settings-modal-title">
              <div class="settings-icon-circle">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </div>
              <div>
                <h3>{{ i18n.t('settings.title') }}</h3>
                <p class="settings-subtitle">Configuration du compte utilisateur & règles d'horaires</p>
              </div>
            </div>
            <button class="modal-close" (click)="closeSettingsModal()" [title]="i18n.t('common.close')">✕</button>
          </div>

          <!-- Inline Top Alert if action succeeded -->
          @if (settingsSuccessMsg()) {
            <div class="settings-alert-success">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span>{{ settingsSuccessMsg() }}</span>
            </div>
          }

          <!-- Segmented Tab Bar (No scrollbar) -->
          <div class="settings-segmented-bar">
            <button
              type="button"
              class="settings-segment-btn"
              [class.active]="settingsTab() === 'profile'"
              (click)="settingsTab.set('profile')"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.38 8.38 0 0 1 13 0"/></svg>
              <span>{{ i18n.t('settings.tab_profile') }}</span>
            </button>
            <button
              type="button"
              class="settings-segment-btn"
              [class.active]="settingsTab() === 'security'"
              (click)="settingsTab.set('security')"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span>{{ i18n.t('settings.tab_security') }}</span>
            </button>
            @if (auth.canEdit) {
              <button
                type="button"
                class="settings-segment-btn"
                [class.active]="settingsTab() === 'company'"
                (click)="settingsTab.set('company')"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>{{ i18n.t('settings.tab_company') }}</span>
              </button>
            }
          </div>

          <div class="settings-modal-body">
            <!-- TAB 1: User Profile Form -->
            @if (settingsTab() === 'profile') {
              <div class="user-hero-card">
                <div class="hero-avatar-large">{{ (formUsername() || 'U')[0].toUpperCase() }}</div>
                <div class="hero-details">
                  <div class="hero-name-row">
                    <h4>{{ formPrenom() || 'Utilisateur' }} {{ formNom() }}</h4>
                    <span class="role-badge">{{ auth.user()?.role }}</span>
                  </div>
                  <span class="hero-email">{{ formEmail() || 'Aucune adresse e-mail renseignée' }}</span>
                </div>
              </div>

              <div class="form-grid-2col">
                <div class="form-field">
                  <label>{{ i18n.t('settings.username') }}</label>
                  <input
                    type="text"
                    class="clean-input"
                    [ngModel]="formUsername()"
                    (ngModelChange)="formUsername.set($event)"
                    placeholder="Nom d'utilisateur"
                  />
                </div>

                <div class="form-field">
                  <label>{{ i18n.t('settings.email') }}</label>
                  <input
                    type="email"
                    class="clean-input"
                    [ngModel]="formEmail()"
                    (ngModelChange)="formEmail.set($event)"
                    placeholder="nom@entreprise.tn"
                  />
                </div>

                <div class="form-field">
                  <label>{{ i18n.t('settings.firstname') }}</label>
                  <input
                    type="text"
                    class="clean-input"
                    [ngModel]="formPrenom()"
                    (ngModelChange)="formPrenom.set($event)"
                    placeholder="Prénom"
                  />
                </div>

                <div class="form-field">
                  <label>{{ i18n.t('settings.lastname') }}</label>
                  <input
                    type="text"
                    class="clean-input"
                    [ngModel]="formNom()"
                    (ngModelChange)="formNom.set($event)"
                    placeholder="Nom"
                  />
                </div>
              </div>

              <div class="settings-modal-footer">
                <button type="button" class="secondary" (click)="closeSettingsModal()">{{ i18n.t('common.cancel') }}</button>
                <button type="button" class="primary save-btn" (click)="saveProfile()">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  {{ i18n.t('settings.save_profile') }}
                </button>
              </div>
            }

            <!-- TAB 2: Change Password Form -->
            @if (settingsTab() === 'security') {
              <div class="form-fields-vertical">
                <div class="form-field">
                  <label>{{ i18n.t('settings.old_password') }}</label>
                  <input
                    type="password"
                    class="clean-input"
                    [ngModel]="formOldPassword()"
                    (ngModelChange)="formOldPassword.set($event)"
                    placeholder="Mot de passe actuel"
                  />
                </div>

                <div class="form-field">
                  <label>{{ i18n.t('settings.new_password') }}</label>
                  <input
                    type="password"
                    class="clean-input"
                    [ngModel]="formNewPassword()"
                    (ngModelChange)="formNewPassword.set($event)"
                    placeholder="Nouveau mot de passe"
                  />
                </div>

                <div class="form-field">
                  <label>{{ i18n.t('settings.confirm_password') }}</label>
                  <input
                    type="password"
                    class="clean-input"
                    [ngModel]="formConfirmPassword()"
                    (ngModelChange)="formConfirmPassword.set($event)"
                    placeholder="Confirmez le nouveau mot de passe"
                  />
                </div>

                <div class="security-hint-box">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span>Le mot de passe doit comporter un minimum de 6 caractères.</span>
                </div>
              </div>

              <div class="settings-modal-footer">
                <button type="button" class="secondary" (click)="closeSettingsModal()">{{ i18n.t('common.cancel') }}</button>
                <button type="button" class="primary save-btn" (click)="savePassword()">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  {{ i18n.t('settings.change_password') }}
                </button>
              </div>
            }

            <!-- TAB 3: Company Settings (Admin & Supervisor) -->
            @if (settingsTab() === 'company') {
              <div class="form-fields-vertical">
                <div class="form-field">
                  <label>{{ i18n.t('settings.company_name') }}</label>
                  <input
                    type="text"
                    class="clean-input"
                    [ngModel]="formCompanyName()"
                    (ngModelChange)="formCompanyName.set($event)"
                    placeholder="Nom de l'entreprise"
                  />
                </div>

                <div class="highlight-schedule-card">
                  <div class="schedule-card-header">
                    <div class="schedule-icon-pill">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div>
                      <span class="schedule-card-title">{{ i18n.t('att.late_threshold') }}</span>
                      <p class="schedule-card-desc">{{ i18n.t('att.late_threshold_desc') }}</p>
                    </div>
                  </div>

                  <div class="time-picker-wrapper">
                    <input
                      type="time"
                      class="clean-time-input"
                      [ngModel]="formLateAfter()"
                      (ngModelChange)="formLateAfter.set($event)"
                    />
                  </div>

                  <div class="presets-section">
                    <span class="presets-title">⚡ Raccourcis horaires usuels :</span>
                    <div class="presets-flex">
                      @for (preset of ['08:00', '08:15', '08:30', '08:45', '09:00', '09:30']; track preset) {
                        <button
                          type="button"
                          class="preset-button"
                          [class.active]="formLateAfter() === preset"
                          (click)="formLateAfter.set(preset)"
                        >
                          {{ preset }}
                        </button>
                      }
                    </div>
                  </div>
                </div>
              </div>

              <div class="settings-modal-footer">
                <button type="button" class="secondary" (click)="closeSettingsModal()">{{ i18n.t('common.cancel') }}</button>
                <button type="button" class="primary save-btn" (click)="saveCompanySettings()">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  {{ i18n.t('settings.save_company') }}
                </button>
              </div>
            }
          </div>
        </div>
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
      white-space: nowrap;
      flex-shrink: 0;
    }
    .cam-text {
      white-space: nowrap;
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
      padding: 0.25rem 0.55rem;
      border-radius: var(--radius-sm);
      background: var(--surface);
      border: 1px solid var(--surface-border);
    }
    .user-badge.clickable {
      cursor: pointer;
      user-select: none;
      transition: all 0.2s ease;
    }
    .user-badge.clickable:hover {
      background: var(--surface-hover);
      border-color: var(--brand);
      box-shadow: 0 0 10px var(--brand-glow);
    }
    .gear-icon {
      color: var(--muted);
      transition: transform 0.25s ease, color 0.2s ease;
      margin-left: 0.15rem;
    }
    .user-badge.clickable:hover .gear-icon {
      color: var(--brand);
      transform: rotate(60deg);
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

    /* Redesigned Settings Modal Styles */
    .settings-modal-dialog {
      max-width: 580px;
      width: 100%;
      border-radius: var(--radius-lg);
      background: var(--surface);
      border: 1px solid var(--surface-border);
      box-shadow: var(--shadow-lg);
      overflow: hidden;
      animation: scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .settings-header-redesign {
      padding: 1.25rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--surface-border);
      background: var(--surface);
    }
    .settings-icon-circle {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: var(--brand-muted);
      color: var(--brand);
      display: grid;
      place-items: center;
      flex-shrink: 0;
      box-shadow: 0 0 15px var(--brand-glow);
    }
    .settings-modal-title {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }
    .settings-modal-title h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .settings-subtitle {
      margin: 0.15rem 0 0 0;
      font-size: 0.78rem;
      color: var(--muted);
    }
    .settings-alert-success {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin: 1rem 1.5rem 0 1.5rem;
      padding: 0.75rem 1rem;
      background: var(--ok-bg);
      border: 1px solid var(--ok);
      color: var(--ok);
      border-radius: var(--radius-md);
      font-size: 0.85rem;
      font-weight: 600;
      animation: fadeIn 0.2s ease;
    }
    .settings-segmented-bar {
      display: flex;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
      padding: 0.35rem;
      margin: 1.25rem 1.5rem 0 1.5rem;
      gap: 0.35rem;
    }
    .settings-segment-btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.55rem 0.75rem;
      font-size: 0.84rem;
      font-weight: 600;
      color: var(--fg-secondary);
      background: transparent;
      border: none;
      cursor: pointer;
      border-radius: var(--radius-sm);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      white-space: nowrap;
    }
    .settings-segment-btn:hover {
      color: var(--fg);
      background: var(--surface-hover);
    }
    .settings-segment-btn.active {
      color: var(--brand);
      background: var(--surface);
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
    .settings-modal-body {
      padding: 1.25rem 1.5rem 0 1.5rem;
      background: var(--surface);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .user-hero-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.85rem 1.15rem;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
    }
    .hero-avatar-large {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2563eb, #6366f1);
      color: #fff;
      font-size: 1.25rem;
      font-weight: 800;
      display: grid;
      place-items: center;
      box-shadow: 0 4px 12px var(--brand-glow);
      flex-shrink: 0;
    }
    .hero-details {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .hero-name-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .hero-name-row h4 {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
    }
    .role-badge {
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
      background: var(--brand-muted);
      color: var(--brand);
    }
    .hero-email {
      font-size: 0.8rem;
      color: var(--muted);
    }
    .form-grid-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.85rem;
    }
    .form-fields-vertical {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .form-field label {
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--fg);
    }
    .clean-input {
      width: 100%;
      padding: 0.65rem 0.85rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--surface-border);
      background: var(--surface-card);
      color: var(--fg);
      font-size: 0.88rem;
      transition: all 0.15s ease;
      outline: none;
    }
    .clean-input:focus {
      border-color: var(--brand);
      background: var(--surface);
      box-shadow: 0 0 0 3px var(--brand-muted);
    }
    .security-hint-box {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.65rem 0.85rem;
      border-radius: var(--radius-sm);
      background: var(--surface-card);
      border: 1px dashed var(--surface-border);
      color: var(--muted);
      font-size: 0.78rem;
    }
    .highlight-schedule-card {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      padding: 1.15rem;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
    }
    .schedule-card-header {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }
    .schedule-icon-pill {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: var(--brand-muted);
      color: var(--brand);
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .schedule-card-title {
      font-size: 0.92rem;
      font-weight: 700;
      color: var(--fg);
    }
    .schedule-card-desc {
      margin: 0.15rem 0 0 0;
      font-size: 0.78rem;
      color: var(--muted);
      line-height: 1.35;
    }
    .time-picker-wrapper {
      display: flex;
      justify-content: center;
      padding: 0.35rem 0;
    }
    .clean-time-input {
      padding: 0.6rem 1.25rem;
      font-size: 1.25rem;
      font-weight: 800;
      text-align: center;
      font-family: var(--font-mono);
      border-radius: var(--radius-sm);
      border: 1.5px solid var(--brand);
      background: var(--surface);
      color: var(--fg);
      box-shadow: 0 0 12px var(--brand-muted);
      outline: none;
    }
    .presets-section {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin-top: 0.2rem;
    }
    .presets-title {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
    }
    .presets-flex {
      display: flex;
      gap: 0.45rem;
      flex-wrap: wrap;
    }
    .preset-button {
      padding: 0.4rem 0.75rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--surface-border);
      background: var(--surface);
      color: var(--fg-secondary);
      font-size: 0.82rem;
      font-weight: 700;
      font-family: var(--font-mono);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .preset-button:hover {
      background: var(--surface-hover);
      color: var(--fg);
      border-color: var(--brand);
    }
    .preset-button.active {
      border-color: var(--brand);
      background: var(--brand);
      color: #fff;
      box-shadow: 0 2px 8px var(--brand-glow);
    }
    .settings-modal-footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.5rem 1.25rem 1.5rem;
      border-top: 1px solid var(--surface-border);
      background: var(--surface);
      margin-top: 1rem;
    }
    .save-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
    }
  `,
})
export class App implements OnInit, OnDestroy {
  private api = inject(Api);
  private stream = inject(StreamService);
  private router = inject(Router);
  auth = inject(Auth);
  modal = inject(ModalService);
  confirmService = inject(ConfirmService);
  theme = inject(ThemeService);
  toast = inject(ToastService);
  i18n = inject(I18nService);

  readonly searchQuery = signal('');
  readonly unreadAlertsCount = signal<number>(5);
  readonly currentUrl = signal<string>(this.router.url);
  readonly showAlertsDropdown = signal<boolean>(false);
  readonly recentAlertsList = signal<Alert[]>([]);

  readonly pageTitle = computed(() => {
    const url = this.currentUrl();
    if (url.startsWith('/cameras')) return this.i18n.t('nav.cameras') || 'Caméras';
    if (url.startsWith('/attendance')) return this.i18n.t('nav.recordings') || 'Enregistrements';
    if (url.startsWith('/logs')) return this.i18n.t('nav.events') || 'Événements';
    if (url.startsWith('/alerts')) return this.i18n.t('nav.alerts') || 'Alertes';
    if (url.startsWith('/vehicles')) return this.i18n.t('nav.reports') || 'Rapports';
    if (url.startsWith('/members')) return this.i18n.t('nav.users') || 'Utilisateurs';
    return this.i18n.t('nav.dashboard') || 'Tableau de bord';
  });

  readonly pageSubtitle = computed(() => {
    const url = this.currentUrl();
    if (url.startsWith('/cameras')) return "Surveillance et gestion des flux vidéo en direct";
    if (url.startsWith('/attendance')) return "Registre d'émargement et pointages en temps réel";
    if (url.startsWith('/logs')) return "Journal d'accès et passages de véhicules LAPI";
    if (url.startsWith('/alerts')) return "Historique des alertes de sécurité et notifications";
    if (url.startsWith('/vehicles')) return "Rapports des véhicules enregistrés et statistiques";
    if (url.startsWith('/members')) return "Gestion des collaborateurs et autorisations";
    return "Bienvenue, Admin ! Voici un aperçu de votre système.";
  });

  readonly activeCamerasCount = signal<number>(8);
  private sub: any = null;
  private routerSub: any = null;

  readonly showSettingsModal = signal(false);
  readonly settingsTab = signal<'profile' | 'security' | 'company'>('profile');
  readonly settingsSuccessMsg = signal('');

  // Profile Form
  readonly formUsername = signal('');
  readonly formEmail = signal('');
  readonly formNom = signal('');
  readonly formPrenom = signal('');

  // Password Form
  readonly formOldPassword = signal('');
  readonly formNewPassword = signal('');
  readonly formConfirmPassword = signal('');

  // Company Form
  readonly formCompanyName = signal('');
  readonly formLateAfter = signal('08:30');

  ngOnInit(): void {
    if (this.auth.token()) {
      this.refreshCameras();
      this.auth.loadUser().subscribe({
        error: () => {},
      });
      this.api.stats().subscribe({
        next: (s) => {
          if (s?.alertes_non_vues != null) this.unreadAlertsCount.set(s.alertes_non_vues);
        },
        error: () => {},
      });
    }
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.currentUrl.set(e.urlAfterRedirects || e.url);
      });
    this.sub = this.stream.updates$.subscribe(() => {
      this.refreshCameras();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.routerSub?.unsubscribe();
  }

  scrollToCameras(): void {
    if (this.router.url !== '/' && !this.router.url.startsWith('/?')) {
      this.router.navigate(['/'], { queryParams: { section: 'cameras' } }).then(() => {
        setTimeout(() => {
          const el = document.getElementById('cameras-grid');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      });
    } else {
      const el = document.getElementById('cameras-grid');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
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

  openSettingsModal(): void {
    const u = this.auth.user();
    if (u) {
      this.formUsername.set(u.username || '');
      this.formEmail.set(u.email || '');
      this.formNom.set(u.nom || '');
      this.formPrenom.set(u.prenom || '');
    }
    this.formOldPassword.set('');
    this.formNewPassword.set('');
    this.formConfirmPassword.set('');
    this.settingsSuccessMsg.set('');

    this.api.getSettings().subscribe({
      next: (s) => {
        if (s?.late_after) this.formLateAfter.set(s.late_after);
        if (s?.company_name) this.formCompanyName.set(s.company_name);
      },
      error: () => {},
    });

    this.settingsTab.set('profile');
    this.showSettingsModal.set(true);
  }

  closeSettingsModal(): void {
    this.showSettingsModal.set(false);
  }

  saveProfile(): void {
    const username = this.formUsername().trim();
    const email = this.formEmail().trim();
    const nom = this.formNom().trim();
    const prenom = this.formPrenom().trim();

    if (!username) {
      this.toast.warn("Le nom d'utilisateur est obligatoire.");
      return;
    }

    if (email) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email)) {
        this.toast.warn("Format d'adresse e-mail invalide (ex: contact@entreprise.tn).");
        return;
      }
    }

    const payload = { username, email, nom, prenom };
    this.auth.updateProfile(payload).subscribe({
      next: () => {
        const msg = this.i18n.t('settings.profile_saved');
        this.toast.success(msg);
        this.settingsSuccessMsg.set(msg);
        setTimeout(() => this.settingsSuccessMsg.set(''), 4500);
      },
      error: (err) => {
        const msg = err?.error?.detail || "Erreur lors de la mise à jour du profil.";
        this.toast.error(msg);
      },
    });
  }

  savePassword(): void {
    const old_pwd = this.formOldPassword();
    const new_pwd = this.formNewPassword();
    const confirm = this.formConfirmPassword();

    if (!old_pwd) {
      this.toast.warn("Veuillez saisir votre mot de passe actuel.");
      return;
    }
    if (!new_pwd) {
      this.toast.warn("Veuillez saisir le nouveau mot de passe.");
      return;
    }
    if (new_pwd.length < 6) {
      this.toast.warn("Le nouveau mot de passe doit comporter au moins 6 caractères.");
      return;
    }
    if (old_pwd === new_pwd) {
      this.toast.warn("Le nouveau mot de passe doit être différent de l'ancien.");
      return;
    }
    if (new_pwd !== confirm) {
      this.toast.error(this.i18n.t('settings.password_mismatch'));
      return;
    }

    this.auth.changePassword({ old_password: old_pwd, new_password: new_pwd }).subscribe({
      next: () => {
        const msg = this.i18n.t('settings.password_saved');
        this.toast.success(msg);
        this.settingsSuccessMsg.set(msg);
        setTimeout(() => this.settingsSuccessMsg.set(''), 4500);
        this.formOldPassword.set('');
        this.formNewPassword.set('');
        this.formConfirmPassword.set('');
      },
      error: (err) => {
        const msg = err?.error?.detail || "Erreur lors de la modification du mot de passe.";
        this.toast.error(msg);
      },
    });
  }

  saveCompanySettings(): void {
    const payload = {
      company_name: this.formCompanyName().trim(),
      late_after: this.formLateAfter().trim(),
    };
    this.api.updateSettings(payload).subscribe({
      next: (s) => {
        if (s?.late_after) this.formLateAfter.set(s.late_after);
        if (s?.company_name) this.formCompanyName.set(s.company_name);
        const msg = this.i18n.t('settings.company_saved');
        this.toast.success(msg);
        this.settingsSuccessMsg.set(msg);
        setTimeout(() => this.settingsSuccessMsg.set(''), 4500);
      },
      error: (err) => {
        const msg = err?.error?.detail || "Erreur lors de l'enregistrement des paramètres.";
        this.toast.error(msg);
      },
    });
  }

  onLangChange(lang: Lang): void {
    this.i18n.setLang(lang);
    const msg = lang === 'ar' ? 'تم تغيير اللغة بنجاح' : lang === 'en' ? 'Language switched to English' : 'Langue changée en Français';
    this.toast.info(msg);
  }

  toggleAlertsDropdown(e?: MouseEvent): void {
    e?.stopPropagation();
    const next = !this.showAlertsDropdown();
    this.showAlertsDropdown.set(next);
    if (next) {
      this.loadAlertsDropdown();
    }
  }

  loadAlertsDropdown(): void {
    this.api.alerts().subscribe({
      next: (res) => {
        this.recentAlertsList.set((res.results || []).slice(0, 6));
        const unread = (res.results || []).filter((a) => !a.seen).length;
        this.unreadAlertsCount.set(unread);
      },
      error: () => {},
    });
  }

  markAllAlertsSeen(): void {
    this.api.markAllSeen().subscribe({
      next: () => {
        this.unreadAlertsCount.set(0);
        this.recentAlertsList.update((list) => list.map((a) => ({ ...a, seen: true })));
      },
      error: () => {},
    });
  }

  onAlertItemClick(alert: Alert): void {
    if (!alert.seen && alert.id) {
      this.api.markSeen(alert.id).subscribe({
        next: () => {
          alert.seen = true;
          this.unreadAlertsCount.update((c) => Math.max(0, c - 1));
        },
      });
    }
  }

  goToAllAlerts(): void {
    this.showAlertsDropdown.set(false);
    this.router.navigate(['/alerts']);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showAlertsDropdown.set(false);
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.modal.close();
    this.showSettingsModal.set(false);
    this.showAlertsDropdown.set(false);
  }
}



export const AppComponent = App;

