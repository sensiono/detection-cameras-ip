import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { ConfirmService } from '../core/confirm';
import { I18nService } from '../core/i18n';
import { ModalService } from '../core/modal';
import { AccessLog, Attendance, Camera, Stats } from '../core/models';
import { StreamService } from '../core/stream';
import { ToastService } from '../core/toast';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, FormsModule],

  template: `

    <div class="dashboard-head">
      <div>
        <h1>{{ i18n.t('dash.title') }}</h1>
        <p class="muted">{{ i18n.t('dash.subtitle') }}</p>
      </div>
      @if (stats(); as s) {
        <div class="date-badge">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {{ s.date }}
        </div>
      }
    </div>

    @if (stats(); as s) {
      <div class="kpi-grid">
        <!-- Présents -->
        <a class="kpi-card ok clickable" routerLink="/attendance" [queryParams]="{ statut: 'present', period: 'today' }" [title]="i18n.t('dash.present_today')">
          <div class="kpi-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-value">{{ s.presents }}</span>
            <span class="kpi-label">{{ i18n.t('dash.present_today') }}</span>
          </div>
          <div class="card-arrow">→</div>
        </a>

        <!-- Retards -->
        <a class="kpi-card warn clickable" routerLink="/attendance" [queryParams]="{ statut: 'late', period: 'today' }" [title]="i18n.t('dash.late_today')">
          <div class="kpi-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-value">{{ s.retards }}</span>
            <span class="kpi-label">{{ i18n.t('dash.late_today') }}</span>
          </div>
          <div class="card-arrow">→</div>
        </a>

        <!-- Absents -->
        <a class="kpi-card bad clickable" routerLink="/attendance" [queryParams]="{ view: 'absent', period: 'today' }" [title]="i18n.t('dash.absent_today')">
          <div class="kpi-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-value">{{ s.absents }}</span>
            <span class="kpi-label">{{ i18n.t('dash.absent_today') }}</span>
          </div>
          <div class="card-arrow">→</div>
        </a>

        <!-- Véhicules Autorisés -->
        <a class="kpi-card cyan clickable" routerLink="/logs" [queryParams]="{ statut: 'autorise', period: 'today' }" [title]="i18n.t('dash.auth_vehicles')">
          <div class="kpi-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-value">{{ s.autorises }}</span>
            <span class="kpi-label">{{ i18n.t('dash.auth_vehicles') }}</span>
          </div>
          <div class="card-arrow">→</div>
        </a>

        <!-- Véhicules Refusés -->
        <a class="kpi-card bad clickable" routerLink="/logs" [queryParams]="{ statut: 'refuse', period: 'today' }" [title]="i18n.t('dash.refused_vehicles')">
          <div class="kpi-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-value">{{ s.refuses }}</span>
            <span class="kpi-label">{{ i18n.t('dash.refused_vehicles') }}</span>
          </div>
          <div class="card-arrow">→</div>
        </a>

        <!-- Alertes non vues -->
        <a class="kpi-card purple clickable" routerLink="/alerts" [queryParams]="{ unread: 'true' }" [title]="i18n.t('dash.unseen_alerts')">
          <div class="kpi-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none"/></svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-value">{{ s.alertes_non_vues }}</span>
            <span class="kpi-label">{{ i18n.t('dash.unseen_alerts') }}</span>
          </div>
          <div class="card-arrow">→</div>
        </a>
      </div>
    }

    <!-- Camera Surveillance Grid -->
    <div class="camera-stream-section">
      <div class="section-header">
        <div>
          <h3>{{ i18n.t('dash.stream_cams') }}</h3>
          <small class="muted">Caméras actives connectées au moteur de vision IA ({{ activeCamerasCount() }} actives sur {{ cameras().length }})</small>
        </div>
        @if (auth.canEdit) {
          <button type="button" class="btn-add-cam" (click)="openNewCamModal()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Ajouter une caméra</span>
          </button>
        }
      </div>

      <div class="camera-grid">
        @for (cam of cameras(); track cam.id) {
          <div class="camera-card" [class.cam-disabled]="!cam.enabled" (click)="cam.enabled ? openStream(cam.cam_id, cam.name) : null">
            <div class="cam-feed-preview" [class.gate-cam]="cam.task === 'anpr'">
              <div class="live-tag" [class.offline-tag]="!cam.enabled">
                <span class="live-dot" [class.offline-dot]="!cam.enabled"></span>
                {{ cam.enabled ? i18n.t('common.live') : 'Désactivée' }}
              </div>
              <div class="cam-overlay-stats">
                <span class="hud-stat">{{ cam.fps || 25 }} {{ i18n.t('dash.fps') }}</span>
                <span class="hud-stat">{{ cam.resolution || '1080p' }}</span>
              </div>
              @if (cam.enabled) {
                <div class="cam-play-hint">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                  <span>Ouvrir le flux</span>
                </div>
              } @else {
                <div class="cam-offline-hint">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1"/><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 7.5V6a2 2 0 0 0-2-2H9"/></svg>
                  <span>Flux inactif</span>
                </div>
              }
            </div>
            <div class="cam-info">
              <div class="cam-header-row">
                <div class="cam-name">
                  <strong>{{ cam.cam_id }}</strong>
                  <span class="pill" [class.ok]="cam.enabled" [class.bad]="!cam.enabled">
                    {{ cam.enabled ? i18n.t('dash.online') : 'Inactif' }}
                  </span>
                </div>
                @if (auth.canEdit) {
                  <div class="cam-card-actions" (click)="$event.stopPropagation()">
                    <button type="button" class="cam-action-btn" (click)="openEditCamModal(cam, $event)" title="Modifier la caméra">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                    </button>
                    <button type="button" class="cam-action-btn danger" (click)="deleteCam(cam, $event)" title="Supprimer la caméra">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                }
              </div>
              <span class="cam-desc muted">{{ cam.name }}</span>
              <div class="cam-badges-row">
                <span class="cam-task-badge" [class.anpr-badge]="cam.task === 'anpr'">
                  {{ cam.task === 'anpr' ? '🚗 LAPI / Barrière' : '👤 Pointage Facial' }}
                </span>
                @if (cam.location) {
                  <span class="cam-loc-badge">📍 {{ cam.location }}</span>
                }
              </div>
            </div>
          </div>
        }
        @empty {
          <div class="empty-cams-card">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
            <h4>Aucune caméra configurée</h4>
            <p class="muted">Ajoutez vos caméras IP RTSP ou webcams pour démarrer la surveillance IA.</p>
            @if (auth.canEdit) {
              <button type="button" class="btn-add-cam" (click)="openNewCamModal()">+ Ajouter une caméra</button>
            }
          </div>
        }
      </div>
    </div>

    <!-- Live Stream Modal -->
    @if (activeStream(); as stream) {
      <div class="stream-modal-backdrop" (click)="closeStream()">
        <div class="stream-modal-dialog" (click)="$event.stopPropagation()">
          <div class="stream-modal-header">
            <div>
              <h3>{{ stream.name }}</h3>
              <small class="muted font-mono">{{ stream.id }} · Flux RTSP H.264</small>
            </div>
            <button class="modal-close" (click)="closeStream()" title="Fermer">✕</button>
          </div>
          <div class="stream-modal-body">
            <div class="stream-viewport">
              <div class="stream-hud top-left">
                <span class="live-badge-glow">
                  <span class="pulse-dot"></span>
                  {{ i18n.t('common.live') }}
                </span>
                <span class="hud-chip">1920x1080</span>
                <span class="hud-chip">28.4 {{ i18n.t('dash.fps') }}</span>
              </div>
              <div class="stream-hud top-right font-mono text-xs">
                {{ streamTime() }}
              </div>
              <div class="stream-simulated-canvas">
                <div class="ai-crosshair"></div>
                <div class="stream-watermark">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  <p>Traitement IA Temps Réel Actif (YOLOv8 + ONNX)</p>
                </div>
              </div>
              <div class="stream-hud bottom-left">
                <span class="hud-chip ok">Moteur Vision: Nominal (12ms)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Camera Configuration Modal -->
    @if (isCamModalOpen()) {
      <div class="modal-backdrop" (click)="closeCamModal()">
        <div class="modal-dialog modal-cam-dialog" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title-wrap">
              <div class="modal-icon-badge">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              </div>
              <div>
                <h3 class="modal-main-title">{{ camDraft.id ? 'Modifier la caméra' : 'Ajouter une nouvelle caméra IP' }}</h3>
                <small class="muted">Configuration du flux vidéo et de l'analyse IA</small>
              </div>
            </div>
            <button type="button" class="modal-close" (click)="closeCamModal()">✕</button>
          </div>

          <div class="modal-body modal-cam-body">
            <form (ngSubmit)="saveCam()" class="cam-form">
              <!-- Section 1: Identification & Tâche -->
              <div class="form-section-card">
                <div class="section-badge">1. Identification & Moteur IA</div>
                
                <div class="form-row-2">
                  <div class="form-field">
                    <label class="field-label">
                      <span>ID Caméra IA *</span>
                      <span class="label-tag">Unique</span>
                    </label>
                    <input
                      type="text"
                      [(ngModel)]="camDraft.cam_id"
                      name="cam_id"
                      required
                      placeholder="ex: cam-parking-nord"
                      [disabled]="!!camDraft.id"
                      class="custom-input"
                    />
                    <small class="field-hint">Identifiant système pour les alertes et logs.</small>
                  </div>

                  <div class="form-field">
                    <label class="field-label">
                      <span>Nom d'affichage *</span>
                    </label>
                    <input
                      type="text"
                      [(ngModel)]="camDraft.name"
                      name="name"
                      required
                      placeholder="ex: Portail Principal & Barrière"
                      class="custom-input"
                    />
                    <small class="field-hint">Nom clair affiché sur le tableau de bord.</small>
                  </div>
                </div>

                <div class="form-field full-width">
                  <label class="field-label">
                    <span>Tâche d'analyse Vision IA assignée *</span>
                  </label>
                  <select [(ngModel)]="camDraft.task" name="task" required class="custom-select">
                    <option value="attendance">👤 Pointage Facial — Reconnaissance des collaborateurs & détection d'usurpation</option>
                    <option value="anpr">🚗 Portail & Barrière — Lecture automatique des plaques d'immatriculation (LAPI)</option>
                  </select>
                </div>
              </div>

              <!-- Section 2: Flux Vidéo RTSP -->
              <div class="form-section-card">
                <div class="section-badge">2. Connexion & Flux Vidéo</div>

                <div class="form-field full-width">
                  <label class="field-label">
                    <span>URL du flux Vidéo RTSP ou périphérique *</span>
                  </label>
                  <div class="input-with-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                    <input
                      type="text"
                      [(ngModel)]="camDraft.url"
                      name="url"
                      required
                      placeholder="rtsp://admin:pass@192.168.1.50:554/stream1"
                      class="custom-input with-left-icon font-mono"
                    />
                  </div>
                  <small class="field-hint">Compatible RTSP H.264 / H.265, Webcams USB (<code class="code-pill">0</code>, <code class="code-pill">1</code>) ou fichiers vidéo MP4 de test.</small>
                </div>
              </div>

              <!-- Section 3: Emplacement & Paramètres Matériels -->
              <div class="form-section-card">
                <div class="section-badge">3. Emplacement & Paramètres Flux</div>

                <div class="form-row-3">
                  <div class="form-field flex-2">
                    <label class="field-label">
                      <span>Emplacement physique</span>
                    </label>
                    <input
                      type="text"
                      [(ngModel)]="camDraft.location"
                      name="location"
                      placeholder="ex: Bâtiment A · Accès Nord"
                      class="custom-input"
                    />
                  </div>

                  <div class="form-field">
                    <label class="field-label">
                      <span>Résolution</span>
                    </label>
                    <select [(ngModel)]="camDraft.resolution" name="resolution" class="custom-select">
                      <option value="1080p">1080p FHD</option>
                      <option value="720p">720p HD</option>
                      <option value="4K">4K UHD</option>
                    </select>
                  </div>

                  <div class="form-field">
                    <label class="field-label">
                      <span>Cadence (FPS)</span>
                    </label>
                    <input
                      type="number"
                      [(ngModel)]="camDraft.fps"
                      name="fps"
                      min="5"
                      max="60"
                      class="custom-input text-center"
                      placeholder="25"
                    />
                  </div>
                </div>
              </div>

              <!-- Section 4: Statut d'activation -->
              <div class="form-toggle-card">
                <label class="toggle-switch-label">
                  <input type="checkbox" [(ngModel)]="camDraft.enabled" name="enabled" class="toggle-checkbox" />
                  <div class="toggle-text-wrap">
                    <strong>Activer la caméra pour le traitement IA en direct</strong>
                    <span class="muted text-xs">Le flux sera immédiatement analysé et affiché sur le tableau de bord.</span>
                  </div>
                </label>
              </div>

              <!-- Modal Actions Footer -->
              <div class="modal-footer-actions">
                <button type="button" class="secondary btn-cancel" (click)="closeCamModal()">Annuler</button>
                <button
                  type="submit"
                  class="primary btn-submit"
                  [disabled]="!camDraft.cam_id || !camDraft.name || !camDraft.url || isSavingCam()"
                >
                  @if (isSavingCam()) {
                    <span>Enregistrement en cours...</span>
                  } @else {
                    <span>{{ camDraft.id ? 'Mettre à jour la caméra' : 'Enregistrer la caméra' }}</span>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }



    <!-- Recent Feeds Grid -->
    <div class="feeds-grid">
      <!-- Recent Attendances -->
      <div class="feed-panel">
        <div class="panel-header">
          <h3>{{ i18n.t('dash.quick_attendance') }}</h3>
          <a routerLink="/attendance" class="see-all">{{ i18n.t('dash.see_all') }}</a>
        </div>
        <div class="panel-body">
          @if (recentAttendance().length) {
            <div class="activity-list">
              @for (p of recentAttendance(); track p.id) {
                <div class="activity-item">
                  <div class="activity-avatar">{{ (p.user_name || 'U')[0].toUpperCase() }}</div>
                  <div class="activity-info">
                    <strong>{{ p.user_name }}</strong>
                    <span class="activity-meta font-mono">{{ p.check_in }} · {{ p.camera_id }}</span>
                  </div>
                  <span class="pill" [class.warn]="p.statut === 'late'">
                    {{ p.statut === 'late' ? i18n.t('att.late') : i18n.t('att.present') }}
                  </span>
                </div>
              }
            </div>
          } @else {
            <div class="empty-state">{{ i18n.t('common.no_results') }}</div>
          }
        </div>
      </div>

      <!-- Recent Gate Passes -->
      <div class="feed-panel">
        <div class="panel-header">
          <h3>{{ i18n.t('dash.quick_access') }}</h3>
          <a routerLink="/logs" class="see-all">{{ i18n.t('dash.see_all') }}</a>
        </div>
        <div class="panel-body">
          @if (recentLogs().length) {
            <div class="activity-list">
              @for (l of recentLogs(); track l.id) {
                <div class="activity-item">
                  <div class="plate-badge">{{ l.plaque }}</div>
                  <div class="activity-info">
                    <span class="activity-meta font-mono">{{ l.heure }} · {{ l.camera_id }}</span>
                  </div>
                  <span class="pill" [class.bad]="l.statut === 'refuse'">
                    {{ l.statut === 'autorise' ? i18n.t('logs.authorized') : i18n.t('logs.refused') }}
                  </span>
                </div>
              }
            </div>
          } @else {
            <div class="empty-state">{{ i18n.t('common.no_results') }}</div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .dashboard-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .date-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: var(--radius-sm);
      background: var(--surface);
      border: 1px solid var(--surface-border);
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--fg-secondary);
      box-shadow: var(--shadow-sm);
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2.5rem;
    }
    .kpi-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
      padding: 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      box-shadow: var(--shadow-sm);
      text-decoration: none;
      color: inherit;
      position: relative;
      overflow: hidden;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .kpi-card:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-md);
      border-color: rgba(37, 99, 235, 0.3);
    }
    .kpi-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-sm);
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .kpi-card.ok .kpi-icon { background: var(--ok-bg); color: var(--ok); }
    .kpi-card.warn .kpi-icon { background: var(--warn-bg); color: var(--warn); }
    .kpi-card.bad .kpi-icon { background: var(--bad-bg); color: var(--bad); }
    .kpi-card.cyan .kpi-icon { background: rgba(8, 145, 178, 0.1); color: var(--accent-cyan); }
    .kpi-card.purple .kpi-icon { background: rgba(124, 58, 237, 0.1); color: var(--accent-purple); }
    .kpi-content {
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .kpi-value {
      font-size: 1.85rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.1;
      color: var(--fg);
    }
    .kpi-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--fg-secondary);
      margin-top: 0.25rem;
    }
    .card-arrow {
      color: var(--muted);
      opacity: 0;
      transform: translateX(-6px);
      transition: all 0.2s ease;
      font-size: 1.2rem;
    }
    .kpi-card:hover .card-arrow {
      opacity: 1;
      transform: translateX(0);
      color: var(--brand);
    }
    .camera-stream-section {
      margin-bottom: 2.5rem;
    }
    .camera-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.5rem;
      margin-top: 1rem;
    }
    .camera-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
      overflow: hidden;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      transition: all 0.2s ease;
    }
    .camera-card:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-md);
      border-color: var(--brand);
    }
    .cam-feed-preview {
      height: 180px;
      background: linear-gradient(135deg, #0f172a, #1e293b);
      position: relative;
      display: grid;
      place-items: center;
    }
    .cam-feed-preview.gate-cam {
      background: linear-gradient(135deg, #111827, #1f2937);
    }
    .live-tag {
      position: absolute;
      top: 10px;
      left: 10px;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #fff;
      padding: 0.2rem 0.55rem;
      border-radius: 9999px;
      font-size: 0.7rem;
      font-weight: 800;
    }
    .live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #ef4444;
      animation: pulse 1.5s infinite;
    }
    .cam-overlay-stats {
      position: absolute;
      bottom: 10px;
      right: 10px;
      display: flex;
      gap: 0.4rem;
    }
    .hud-stat {
      background: rgba(0, 0, 0, 0.7);
      color: #94a3b8;
      font-family: var(--font-mono);
      font-size: 0.7rem;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
    }
    .cam-play-hint {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      color: rgba(255, 255, 255, 0.8);
      font-size: 0.85rem;
      font-weight: 700;
      transition: transform 0.2s ease;
    }
    .camera-card:hover .cam-play-hint {
      transform: scale(1.1);
      color: #fff;
    }
    .cam-info {
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .cam-name {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .cam-desc {
      font-size: 0.78rem;
    }
    .stream-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(6px);
      z-index: 1300;
      display: grid;
      place-items: center;
      padding: 1.5rem;
      animation: fadeIn 0.2s ease-out;
    }
    .stream-modal-dialog {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-lg);
      width: 100%;
      max-width: 860px;
      box-shadow: var(--shadow-lg);
      overflow: hidden;
    }
    .stream-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--surface-border);
    }
    .stream-viewport {
      height: 440px;
      background: #020617;
      position: relative;
      overflow: hidden;
    }
    .stream-hud {
      position: absolute;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #fff;
    }
    .stream-hud.top-left { top: 14px; left: 14px; }
    .stream-hud.top-right { top: 14px; right: 14px; color: #94a3b8; }
    .stream-hud.bottom-left { bottom: 14px; left: 14px; }
    .hud-chip {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 0.25rem 0.6rem;
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 0.75rem;
    }
    .hud-chip.ok { color: var(--ok); border-color: rgba(5, 150, 105, 0.3); }
    .live-badge-glow {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.5);
      color: #ef4444;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      font-weight: 800;
      font-size: 0.75rem;
    }
    .stream-simulated-canvas {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      position: relative;
      background: radial-gradient(circle at center, #0f172a 0%, #020617 100%);
    }
    .ai-crosshair {
      position: absolute;
      width: 160px;
      height: 160px;
      border: 2px dashed rgba(59, 130, 246, 0.5);
      border-radius: 8px;
      animation: pulse 2s infinite;
    }
    .stream-watermark {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6rem;
      color: #64748b;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .feeds-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 1.5rem;
    }
    .feed-panel {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
    }
    .panel-header {
      padding: 1.25rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--surface-border);
    }
    .panel-header h3 { margin: 0; font-size: 1.05rem; }
    .see-all {
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--brand);
      text-decoration: none;
    }
    .panel-body { padding: 0.75rem; }
    .activity-list { display: flex; flex-direction: column; gap: 0.4rem; }
    .activity-item {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.65rem 0.85rem;
      border-radius: var(--radius-sm);
      transition: background 0.15s ease;
    }
    .activity-item:hover { background: var(--surface-hover); }
    .activity-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      color: #fff;
      font-weight: 700;
      font-size: 0.8rem;
      display: grid;
      place-items: center;
    }
    .plate-badge {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      font-weight: 800;
      background: var(--surface);
      border: 1px solid var(--surface-border);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      color: var(--fg);
    }
    .activity-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }
    .activity-meta { font-size: 0.75rem; color: var(--muted); }
    .empty-state { text-align: center; padding: 2rem; color: var(--muted); font-size: 0.85rem; }
    .btn-add-cam {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.4rem 0.85rem;
      border-radius: var(--radius-sm);
      background: var(--brand);
      color: #fff;
      font-size: 0.8rem;
      font-weight: 700;
      border: none;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      transition: all 0.15s ease;
    }
    .btn-add-cam:hover {
      background: var(--brand-hover, #1d4ed8);
      transform: translateY(-1px);
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }
    .camera-card.cam-disabled {
      opacity: 0.7;
      border-style: dashed;
      cursor: default;
    }
    .camera-card.cam-disabled:hover {
      transform: none;
      border-color: var(--surface-border);
      box-shadow: var(--shadow-sm);
    }
    .cam-offline-hint {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
      color: #64748b;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .live-tag.offline-tag {
      background: rgba(0, 0, 0, 0.6);
      color: #94a3b8;
    }
    .live-dot.offline-dot {
      background: #94a3b8;
      animation: none;
    }
    .cam-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }
    .cam-card-actions {
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
    .cam-action-btn {
      width: 26px;
      height: 26px;
      border-radius: 4px;
      display: grid;
      place-items: center;
      background: var(--surface-hover);
      border: 1px solid var(--surface-border);
      color: var(--fg-secondary);
      cursor: pointer;
      padding: 0;
      transition: all 0.15s ease;
    }
    .cam-action-btn:hover {
      background: var(--surface-card);
      color: var(--brand);
      border-color: var(--brand);
    }
    .cam-action-btn.danger:hover {
      background: var(--bad-bg);
      color: var(--bad);
      border-color: var(--bad-border);
    }
    .cam-badges-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
      margin-top: 0.25rem;
    }
    .cam-task-badge {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      background: rgba(59, 130, 246, 0.1);
      color: var(--brand);
      border: 1px solid rgba(59, 130, 246, 0.2);
    }
    .cam-task-badge.anpr-badge {
      background: rgba(16, 185, 129, 0.1);
      color: var(--ok);
      border-color: rgba(16, 185, 129, 0.2);
    }
    .cam-loc-badge {
      font-size: 0.72rem;
      color: var(--fg-secondary);
      background: var(--surface-hover);
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      border: 1px solid var(--surface-border);
    }
    .empty-cams-card {
      grid-column: 1 / -1;
      text-align: center;
      padding: 3rem 1.5rem;
      background: var(--surface-card);
      border: 1.5px dashed var(--surface-border);
      border-radius: var(--radius-md);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      color: var(--fg-secondary);
    }
    .modal-cam-dialog {
      max-width: 720px;
      width: 95%;
      border-radius: var(--radius-lg);
      background: var(--surface);
      border: 1px solid var(--surface-border);
      box-shadow: var(--shadow-lg);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .modal-title-wrap {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }
    .modal-main-title {
      font-size: 1.15rem;
      font-weight: 800;
      color: var(--fg);
      margin: 0;
    }
    .modal-icon-badge {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-sm);
      display: grid;
      place-items: center;
      background: rgba(59, 130, 246, 0.12);
      color: var(--brand);
      border: 1px solid rgba(59, 130, 246, 0.2);
    }
    .modal-cam-body {
      padding: 1.5rem;
      background: var(--bg);
      max-height: 80vh;
      overflow-y: auto;
    }
    .cam-form {
      display: flex;
      flex-direction: column;
      gap: 1.1rem;
    }
    .form-section-card {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
      padding: 1.15rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      box-shadow: var(--shadow-sm);
    }
    .section-badge {
      font-size: 0.72rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--brand);
      margin-bottom: 0.2rem;
    }
    .form-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    .form-row-3 {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 1rem;
    }
    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      width: 100%;
    }
    .form-field.full-width {
      width: 100%;
    }
    .form-field.flex-2 {
      flex: 2;
    }
    .field-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--fg);
    }
    .label-tag {
      font-size: 0.68rem;
      font-weight: 700;
      padding: 0.1rem 0.45rem;
      border-radius: 4px;
      background: var(--surface-hover);
      color: var(--fg-secondary);
      border: 1px solid var(--surface-border);
    }
    .custom-input, .custom-select {
      width: 100%;
      box-sizing: border-box;
      padding: 0.65rem 0.85rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--surface-border);
      background: var(--surface-card);
      color: var(--fg);
      font-size: 0.9rem;
      transition: all 0.15s ease;
    }
    .custom-input:focus, .custom-select:focus {
      border-color: var(--brand);
      box-shadow: 0 0 0 3px var(--brand-glow);
      outline: none;
    }
    .input-with-icon {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }
    .input-with-icon svg {
      position: absolute;
      left: 12px;
      color: var(--muted);
      pointer-events: none;
    }
    .custom-input.with-left-icon {
      padding-left: 2.4rem;
    }
    .code-pill {
      background: var(--surface-hover);
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 0.78rem;
      border: 1px solid var(--surface-border);
    }
    .field-hint {
      display: block;
      font-size: 0.75rem;
      color: var(--fg-secondary);
      margin-top: 0.2rem;
      line-height: 1.4;
    }
    .form-toggle-card {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
      padding: 1rem 1.25rem;
      box-shadow: var(--shadow-sm);
    }
    .toggle-switch-label {
      display: flex;
      align-items: center;
      gap: 1rem;
      cursor: pointer;
    }
    .toggle-checkbox {
      width: 18px;
      height: 18px;
      accent-color: var(--brand);
      cursor: pointer;
      flex-shrink: 0;
    }
    .toggle-text-wrap {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .toggle-text-wrap strong {
      font-size: 0.88rem;
      color: var(--fg);
    }
    .modal-footer-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 0.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--surface-border);
    }
    .btn-cancel {
      padding: 0.65rem 1.25rem;
      border-radius: var(--radius-sm);
      font-weight: 600;
      font-size: 0.88rem;
    }
    .btn-submit {
      padding: 0.65rem 1.4rem;
      border-radius: var(--radius-sm);
      font-weight: 700;
      font-size: 0.88rem;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }
    .text-center {
      text-align: center;
    }
    .font-mono { font-family: var(--font-mono); }
    .text-xs { font-size: 0.75rem; }

  `,
})
export class DashboardPage implements OnInit, OnDestroy {
  private api = inject(Api);
  private stream = inject(StreamService);
  private toast = inject(ToastService);
  private confirmService = inject(ConfirmService);
  auth = inject(Auth);
  modal = inject(ModalService);
  i18n = inject(I18nService);

  readonly stats = signal<Stats | null>(null);
  readonly recentAttendance = signal<Attendance[]>([]);
  readonly recentLogs = signal<AccessLog[]>([]);
  readonly cameras = signal<Camera[]>([]);
  readonly activeCamerasCount = computed(() => this.cameras().filter((c) => c.enabled).length);

  readonly activeStream = signal<{ id: string; name: string } | null>(null);
  readonly streamTime = signal<string>('');

  readonly isCamModalOpen = signal<boolean>(false);
  readonly isSavingCam = signal<boolean>(false);

  camDraft: Camera = {
    cam_id: '',
    name: '',
    url: '',
    task: 'attendance',
    enabled: true,
    location: '',
    resolution: '1080p',
    fps: 25,
  };

  private sub: Subscription | null = null;
  private timer: any = null;

  ngOnInit(): void {
    this.load();
    this.sub = this.stream.updates$.subscribe(() => {
      this.load();
    });
    this.timer = setInterval(() => {
      this.streamTime.set(new Date().toLocaleTimeString());
    }, 1000);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.timer) clearInterval(this.timer);
  }

  load(): void {
    this.api.stats().subscribe({
      next: (s) => this.stats.set(s),
      error: () => this.toast.error('Erreur de chargement du tableau de bord'),
    });

    this.api.attendance().subscribe({
      next: (page) => this.recentAttendance.set(page.results.slice(0, 5)),
    });

    this.api.logs().subscribe({
      next: (page) => this.recentLogs.set(page.results.slice(0, 5)),
    });

    this.api.cameras().subscribe({
      next: (page) => this.cameras.set(page.results || []),
    });
  }

  openStream(id: string, name: string): void {
    this.activeStream.set({ id, name });
  }

  closeStream(): void {
    this.activeStream.set(null);
  }

  openNewCamModal(): void {
    this.camDraft = {
      cam_id: '',
      name: '',
      url: '',
      task: 'attendance',
      enabled: true,
      location: '',
      resolution: '1080p',
      fps: 25,
    };
    this.isCamModalOpen.set(true);
  }

  openEditCamModal(c: Camera, e: MouseEvent): void {
    e.stopPropagation();
    this.camDraft = { ...c };
    this.isCamModalOpen.set(true);
  }

  closeCamModal(): void {
    this.isCamModalOpen.set(false);
  }

  saveCam(): void {
    if (!this.camDraft.cam_id || !this.camDraft.name || !this.camDraft.url) return;
    this.isSavingCam.set(true);

    this.api.saveCamera(this.camDraft).subscribe({
      next: (c) => {
        this.isSavingCam.set(false);
        this.toast.ok('Succès', `Caméra ${c.cam_id} enregistrée`);
        this.closeCamModal();
        this.load();
      },
      error: (err) => {
        this.isSavingCam.set(false);
        const msg = err.error?.error?.message || err.error?.cam_id?.[0] || "Erreur d'enregistrement de la caméra";
        this.toast.bad('Erreur', msg);
      },
    });
  }

  async deleteCam(c: Camera, e: MouseEvent): Promise<void> {
    e.stopPropagation();
    if (!c.id) return;

    const ok = await this.confirmService.confirm({
      title: 'Supprimer la caméra',
      message: `Êtes-vous sûr de vouloir supprimer définitivement la caméra ${c.name} (${c.cam_id}) ? Les flux associés seront arrêtés.`,
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true,
    });

    if (ok) {
      this.api.deleteCamera(c.id).subscribe({
        next: () => {
          this.toast.info('Supprimé', `Caméra ${c.cam_id} retirée`);
          this.load();
        },
        error: () => this.toast.bad('Erreur de suppression'),
      });
    }
  }
}

export const Dashboard = DashboardPage;


