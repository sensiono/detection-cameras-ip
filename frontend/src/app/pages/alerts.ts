import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { Api } from '../core/api';
import { I18nService } from '../core/i18n';
import { ModalService } from '../core/modal';
import { Alert } from '../core/models';
import { StreamService } from '../core/stream';
import { ToastService } from '../core/toast';

@Component({
  selector: 'app-alerts',
  imports: [DatePipe],
  template: `
    <div class="page-head">
      <div>
        <div class="title-row">
          <h1>{{ i18n.t('alerts.title') }}</h1>
          <span class="live-pulse-badge">
            <span class="pulse-dot"></span>
            {{ i18n.t('common.live') }}
          </span>
          @if (unseen() > 0) {
            <span class="pill bad">{{ unseen() }} {{ i18n.t('dash.unseen_alerts') }}</span>
          } @else {
            <span class="pill ok">Système sécurisé</span>
          }
        </div>
        <p class="muted">{{ i18n.t('alerts.subtitle') }}</p>
      </div>

      <div class="head-actions">
        @if (unseen() > 0) {
          <button class="secondary mark-all-btn" (click)="acknowledgeAll()" [title]="i18n.t('alerts.mark_all_read')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/><line x1="4" y1="12" x2="9" y2="17"/><line x1="15" y1="6" x2="20" y2="11"/></svg>
            <span>{{ i18n.t('alerts.mark_all_read') }} ({{ unseen() }})</span>
          </button>
        }
      </div>
    </div>

    <div class="alerts-grid">
      @for (a of rows(); track a.id) {
        <article class="alert-card" [class.seen]="a.seen">
          <div class="card-media" (click)="previewSnapshot(a)" [style.cursor]="a.snapshot ? 'pointer' : 'default'">
            @if (a.snapshot) {
              <img [src]="a.snapshot" alt="Capture de l'alerte" class="alert-img" [title]="i18n.t('common.capture')" />
              <div class="media-overlay">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              </div>
            } @else {
              <div class="nophoto">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                <span>Sans capture</span>
              </div>
            }
            <div class="kind-tag" [class.bad]="a.kind === 'refused_plate' || a.kind === 'spoof_attempt'">
              {{ getKindLabel(a.kind) }}
            </div>
          </div>

          <div class="card-body">
            <p class="alert-text">{{ a.message }}</p>
            
            <div class="meta-row">
              <span class="cam-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                {{ a.camera_id || 'caméra' }}
              </span>
              <span class="time-text">{{ a.created_at | date: 'dd/MM HH:mm:ss' }}</span>
            </div>

            <div class="action-row">
              @if (!a.seen) {
                <button class="ack-btn" (click)="acknowledge(a)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  {{ i18n.t('alerts.acknowledge') }}
                </button>
              } @else {
                <span class="seen-indicator">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  {{ i18n.t('alerts.acknowledged') }}
                </span>
              }
            </div>
          </div>
        </article>
      } @empty {
        <div class="empty-state glass-card">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <h3>{{ i18n.t('common.no_results') }}</h3>
          <p class="muted">Toutes les détections sont normales et sécurisées.</p>
        </div>
      }
    </div>
  `,
  styles: `
    .page-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 1.75rem;
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .live-pulse-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.2rem 0.65rem;
      border-radius: 9999px;
      background: var(--ok-bg);
      border: 1px solid var(--ok-border);
      color: var(--ok);
      font-size: 0.75rem;
      font-weight: 700;
    }
    .pulse-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--ok);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.3; transform: scale(0.8); }
    }
    .head-actions {
      display: flex;
      gap: 0.75rem;
    }
    .mark-all-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 700;
      color: var(--brand);
      border-color: var(--brand);
    }
    .mark-all-btn:hover {
      background: var(--brand-glow);
    }
    .alerts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.25rem;
    }
    .alert-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-sm);
      transition: all 0.2s ease;
    }
    .alert-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }
    .alert-card.seen {
      opacity: 0.7;
      background: var(--surface);
    }
    .card-media {
      height: 180px;
      background: #0f172a;
      position: relative;
      overflow: hidden;
    }
    .alert-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.25s ease;
    }
    .card-media:hover .alert-img {
      transform: scale(1.04);
    }
    .media-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.35);
      display: grid;
      place-items: center;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .card-media:hover .media-overlay {
      opacity: 1;
    }
    .nophoto {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      color: #64748b;
      font-size: 0.8rem;
    }
    .kind-tag {
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #fff;
      padding: 0.25rem 0.6rem;
      border-radius: 4px;
      font-size: 0.72rem;
      font-weight: 700;
    }
    .kind-tag.bad {
      background: var(--bad);
      border-color: var(--bad);
    }
    .card-body {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      flex: 1;
    }
    .alert-text {
      margin: 0;
      font-size: 0.92rem;
      font-weight: 600;
      color: var(--fg);
      line-height: 1.4;
    }
    .meta-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.78rem;
      color: var(--muted);
    }
    .cam-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-family: var(--font-mono);
    }
    .time-text {
      font-family: var(--font-mono);
    }
    .action-row {
      margin-top: auto;
      padding-top: 0.5rem;
      border-top: 1px solid var(--surface-border);
    }
    .ack-btn {
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.45rem 0.85rem;
      font-size: 0.82rem;
      background: var(--surface-hover);
      color: var(--fg);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-weight: 700;
      transition: all 0.15s ease;
    }
    .ack-btn:hover {
      background: var(--ok-bg);
      color: var(--ok);
      border-color: var(--ok-border);
    }
    .seen-indicator {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--ok);
    }
    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 3rem 2rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }
    .empty-state h3 { margin: 0; }
  `,
})
export class AlertsPage implements OnInit, OnDestroy {
  private api = inject(Api);
  private modal = inject(ModalService);
  private stream = inject(StreamService);
  private toast = inject(ToastService);
  i18n = inject(I18nService);

  readonly rows = signal<Alert[]>([]);
  readonly unseen = computed(() => this.rows().filter((a) => !a.seen).length);
  private sub: Subscription | null = null;

  ngOnInit(): void {
    this.load();
    this.sub = this.stream.updates$.subscribe(() => {
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  load(): void {
    this.api.alerts().subscribe({
      next: (page) => this.rows.set(page.results),
      error: () => this.toast.bad('Erreur de chargement des alertes'),
    });
  }

  getKindLabel(kind: string): string {
    if (kind === 'refused_plate') return this.i18n.t('alerts.kind_refused_plate');
    if (kind === 'unknown_face') return this.i18n.t('alerts.kind_unknown_face');
    if (kind === 'spoof_attempt') return this.i18n.t('alerts.kind_spoof_attempt');
    if (kind === 'signal_loss') return this.i18n.t('alerts.kind_signal_loss');
    if (kind === 'tamper_attempt') return this.i18n.t('alerts.kind_tamper_attempt');
    return kind;
  }


  acknowledge(a: Alert): void {
    this.api.markSeen(a.id).subscribe({
      next: (updated) => {
        this.rows.update((rows) => rows.map((r) => (r.id === a.id ? updated : r)));
        this.toast.ok('Alerte acquittée');
      },
      error: () => this.toast.bad("Impossible d'acquitter l'alerte"),
    });
  }

  acknowledgeAll(): void {
    this.api.markAllSeen().subscribe({
      next: () => {
        this.rows.update((rows) => rows.map((r) => ({ ...r, seen: true })));
        this.toast.ok('Toutes les alertes ont été acquittées');
      },
      error: () => this.toast.bad("Erreur lors de l'acquittement global"),
    });
  }

  previewSnapshot(a: Alert): void {
    if (a.snapshot) {
      this.modal.open({
        imageSrc: a.snapshot,
        title: `Alerte : ${this.getKindLabel(a.kind)}`,
        subtitle: `${a.message} · ${a.camera_id}`,
      });
    }
  }
}

export const Alerts = AlertsPage;

