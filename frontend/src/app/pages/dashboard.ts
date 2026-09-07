import { DatePipe } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { ConfirmService } from '../core/confirm';
import { I18nService } from '../core/i18n';
import { ModalService } from '../core/modal';
import { AccessLog, Attendance, Camera, Stats } from '../core/models';
import { StreamService } from '../core/stream';
import { ToastService } from '../core/toast';

function getLocalToday(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, FormsModule],
  template: `
    <!-- Top Filter Row: Date Selector (filters all dashboard metrics) -->
    <div class="dash-top-bar">
      <div class="date-chip-selector" (click)="openDatePicker(datePickerInput)" title="Filtrer par date">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span class="date-chip-label">{{ formattedSelectedDate() }}</span>
        <svg class="chevron-down" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
        <input
          #datePickerInput
          type="date"
          class="date-native-overlay"
          [ngModel]="selectedDate()"
          (ngModelChange)="onDateFilterChange($event)"
          title="Sélectionner une date"
        />
      </div>
    </div>

    <!-- 4 SafeWatch KPI Stat Cards -->
    <div class="safewatch-kpi-grid">
      <!-- Card 1: Caméras actives -->
      <div class="sw-kpi-card" (click)="scrollToSection('cameras-grid')">
        <div class="sw-kpi-top">
          <span class="sw-kpi-label">{{ i18n.t('dash.active_cams', 'Caméras actives') }}</span>
          <div class="sw-kpi-icon-box purple">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 7l-7 5 7 5V7z"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </div>
        </div>
        <div class="sw-kpi-value">{{ activeCamerasCount() }}</div>
        <div class="sw-kpi-bottom" [class.ok-status]="activeCamerasCount() > 0" [class.alert-status]="activeCamerasCount() === 0">
          <span class="pulse-green-dot" [class.offline]="activeCamerasCount() === 0"></span>
          <span>
            @if (activeCamerasCount() === cameras().length && cameras().length > 0) {
              {{ i18n.t('dash.all_online', 'Toutes en ligne') }}
            } @else {
              {{ activeCamerasCount() }} / {{ cameras().length }} en ligne
            }
          </span>
        </div>
      </div>

      <!-- Card 2: Enregistrements (Pointages du jour filtré) -->
      <a class="sw-kpi-card" routerLink="/attendance" [queryParams]="{ date: selectedDate() }">
        <div class="sw-kpi-top">
          <span class="sw-kpi-label">{{ i18n.t('dash.recordings', 'Enregistrements') }}</span>
          <div class="sw-kpi-icon-box green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 7l-7 5 7 5V7z"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </div>
        </div>
        <div class="sw-kpi-value">{{ recordingsCount() }}</div>
        <div class="sw-kpi-bottom muted-status">
          <span>{{ selectedDate() === todayDate ? i18n.t('dash.today', "Aujourd'hui") : selectedDate() }}</span>
        </div>
      </a>

      <!-- Card 3: Alertes (Alertes de la date sélectionnée) -->
      <a class="sw-kpi-card" routerLink="/alerts">
        <div class="sw-kpi-top">
          <span class="sw-kpi-label">{{ i18n.t('dash.alerts', 'Alertes') }}</span>
          <div class="sw-kpi-icon-box orange">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
        </div>
        <div class="sw-kpi-value">{{ alertsCount() }}</div>
        <div class="sw-kpi-bottom alert-status">
          <span>{{ alertsCount() }} {{ i18n.t('dash.unread', 'non lues') }}</span>
        </div>
      </a>

      <!-- Card 4: Utilisateurs (Collaborateurs actifs) -->
      <a class="sw-kpi-card" routerLink="/members">
        <div class="sw-kpi-top">
          <span class="sw-kpi-label">{{ i18n.t('dash.users', 'Utilisateurs') }}</span>
          <div class="sw-kpi-icon-box blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
        </div>
        <div class="sw-kpi-value">{{ usersCount() }}</div>
        <div class="sw-kpi-bottom muted-status">
          <span>{{ i18n.t('dash.active', 'Actifs') }}</span>
        </div>
      </a>
    </div>

    <!-- Charts Row: Activité des caméras (Line) + Répartition des événements (Donut) -->
    <div class="charts-row">
      <!-- Line Chart: Activité des caméras -->
      <div class="chart-card line-chart-card">
        <div class="chart-header">
          <h3 class="chart-title">{{ i18n.t('dash.chart_activity', 'Activité des caméras') }}</h3>
          <div class="chart-legend-pill">
            <span class="legend-line-dot"></span>
            <span>{{ i18n.t('dash.cams_online', 'Caméras en ligne') }}</span>
          </div>
        </div>
        <div class="chart-body-modern">
          <div class="chart-plot-container">
            <!-- HTML Y-Axis Labels (always crisp, never stretched) -->
            <div class="chart-y-axis">
              <span class="y-label">{{ lineMaxY() }}</span>
              <span class="y-label">{{ line3QuarterY() }}</span>
              <span class="y-label">{{ lineHalfY() }}</span>
              <span class="y-label">{{ lineQuarterY() }}</span>
              <span class="y-label">0</span>
            </div>

            <!-- SVG Grid & Curve Area -->
            <div class="chart-svg-wrap">
              <svg class="line-chart-svg" viewBox="0 0 600 160" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#5046e5" stop-opacity="0.30" />
                    <stop offset="100%" stop-color="#5046e5" stop-opacity="0.0" />
                  </linearGradient>
                </defs>

                <!-- Y Axis Horizontal Grid Lines -->
                <line x1="0" y1="10" x2="600" y2="10" class="chart-grid-line" />
                <line x1="0" y1="45" x2="600" y2="45" class="chart-grid-line" />
                <line x1="0" y1="80" x2="600" y2="80" class="chart-grid-line" />
                <line x1="0" y1="115" x2="600" y2="115" class="chart-grid-line" />
                <line x1="0" y1="150" x2="600" y2="150" class="chart-grid-line base" />

                <!-- Gradient Area Fill -->
                <path [attr.d]="lineAreaPath()" fill="url(#chartAreaGrad)" />

                <!-- Stroke Path -->
                <path [attr.d]="lineStrokePath()" class="chart-line-stroke" />

                <!-- Data point dots -->
                @for (pt of linePoints(); track $index) {
                  <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="4.5" class="chart-dot" />
                }
              </svg>
            </div>
          </div>

          <!-- HTML X-Axis Timestamps (crisp and properly spaced) -->
          <div class="chart-x-axis">
            <span class="x-label">00:00</span>
            <span class="x-label">04:00</span>
            <span class="x-label">08:00</span>
            <span class="x-label">12:00</span>
            <span class="x-label">16:00</span>
            <span class="x-label">20:00</span>
            <span class="x-label">24:00</span>
          </div>
        </div>
      </div>

      <!-- Donut Chart: Répartition des événements -->
      <div class="chart-card donut-chart-card">
        <div class="chart-header">
          <h3 class="chart-title">{{ i18n.t('dash.chart_events', 'Répartition des événements') }}</h3>
        </div>
        <div class="donut-chart-layout">
          <div class="donut-svg-wrap">
            <svg class="donut-svg" viewBox="0 0 200 200">
              <!-- Background Ring -->
              <circle cx="100" cy="100" r="70" class="donut-bg-ring" />

              @if (eventStats().total > 0) {
                <!-- Segment 1: Détection de mouvement -->
                <circle
                  cx="100"
                  cy="100"
                  r="70"
                  class="donut-segment seg-motion"
                  [attr.stroke-dasharray]="donutDash(eventStats().pMotion)"
                  [attr.stroke-dashoffset]="donutOffset(0)"
                />

                <!-- Segment 2: Intrusion -->
                <circle
                  cx="100"
                  cy="100"
                  r="70"
                  class="donut-segment seg-intrusion"
                  [attr.stroke-dasharray]="donutDash(eventStats().pIntrusion)"
                  [attr.stroke-dashoffset]="donutOffset(eventStats().pMotion)"
                />

                <!-- Segment 3: Objet abandonné / alertes -->
                <circle
                  cx="100"
                  cy="100"
                  r="70"
                  class="donut-segment seg-object"
                  [attr.stroke-dasharray]="donutDash(eventStats().pAlerts)"
                  [attr.stroke-dashoffset]="donutOffset(eventStats().pMotion + eventStats().pIntrusion)"
                />

                <!-- Segment 4: Autres -->
                <circle
                  cx="100"
                  cy="100"
                  r="70"
                  class="donut-segment seg-other"
                  [attr.stroke-dasharray]="donutDash(eventStats().pOther)"
                  [attr.stroke-dashoffset]="donutOffset(eventStats().pMotion + eventStats().pIntrusion + eventStats().pAlerts)"
                />
              }

              <!-- Center Text -->
              <text x="100" y="96" text-anchor="middle" class="donut-center-num">{{ eventStats().total }}</text>
              <text x="100" y="117" text-anchor="middle" class="donut-center-sub">{{ i18n.t('dash.total_label', 'Total') }}</text>
            </svg>
          </div>

          <!-- Legend List -->
          <div class="donut-legend-list">
            <div class="donut-legend-item">
              <span class="legend-color-dot seg-motion"></span>
              <span class="legend-name">{{ i18n.t('dash.ev_motion', 'Détection de mouvement') }}</span>
              <span class="legend-stat">{{ eventStats().motion }} ({{ eventStats().pctMotion }}%)</span>
            </div>
            <div class="donut-legend-item">
              <span class="legend-color-dot seg-intrusion"></span>
              <span class="legend-name">{{ i18n.t('dash.ev_intrusion', 'Intrusion') }}</span>
              <span class="legend-stat">{{ eventStats().intrusion }} ({{ eventStats().pctIntrusion }}%)</span>
            </div>
            <div class="donut-legend-item">
              <span class="legend-color-dot seg-object"></span>
              <span class="legend-name">{{ i18n.t('dash.ev_abandoned', 'Objet abandonné') }}</span>
              <span class="legend-stat">{{ eventStats().alerts }} ({{ eventStats().pctAlerts }}%)</span>
            </div>
            <div class="donut-legend-item">
              <span class="legend-color-dot seg-other"></span>
              <span class="legend-name">{{ i18n.t('dash.ev_other', 'Autres') }}</span>
              <span class="legend-stat">{{ eventStats().other }} ({{ eventStats().pctOther }}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Live Cameras Section: ONLY SAVED CAMERAS -->
    <section id="cameras-grid" class="cameras-section">
      <div class="section-title-bar">
        <div class="title-with-count">
          <h2>{{ i18n.t('dash.live_cameras', 'Caméras en direct') }} ({{ cameras().length }})</h2>
        </div>
        @if (auth.canEdit) {
          <button type="button" class="btn-primary-add-cam" (click)="openNewCamModal()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>Ajouter une caméra</span>
          </button>
        }
      </div>

      <!-- Cameras Grid: only displaying what is saved in DB -->
      <div class="safewatch-cameras-grid">
        @for (c of cameras(); track c.id; let idx = $index) {
          <div class="cctv-card" (click)="openStream(c.cam_id, c.name)">
            <!-- Top bar inside camera card -->
            <div class="cctv-card-header">
              <div class="cctv-title-group">
                <span class="cctv-status-dot" [class.offline]="!c.enabled"></span>
                <span class="cctv-name" [title]="c.name">{{ c.name || c.cam_id }}</span>
              </div>
              <div class="cctv-header-actions" (click)="$event.stopPropagation()">
                <!-- Three dots Dropdown with Modifier / Supprimer -->
                <div class="cctv-menu-wrapper">
                  <button type="button" class="cctv-dots-btn" (click)="toggleCamMenu(c.cam_id, $event)" title="Options">•••</button>
                  @if (activeCamMenuId() === c.cam_id) {
                    <div class="cctv-dropdown-menu" (click)="$event.stopPropagation()">
                      <button type="button" class="cam-menu-item" (click)="openEditCamModal(c, $event)">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                        <span>{{ i18n.t('dash.edit_camera', 'Modifier') }}</span>
                      </button>
                      @if (auth.canEdit) {
                        <button type="button" class="cam-menu-item danger" (click)="deleteCam(c, $event)">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                          <span>{{ i18n.t('dash.delete_camera', 'Supprimer') }}</span>
                        </button>
                      }
                    </div>
                  }
                </div>

                <button type="button" class="cctv-icon-btn" (click)="openStream(c.cam_id, c.name); $event.stopPropagation()" title="Agrandir">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="15 3 21 3 21 9"/>
                    <polyline points="9 21 3 21 3 15"/>
                    <line x1="21" y1="3" x2="14" y2="10"/>
                    <line x1="3" y1="21" x2="10" y2="14"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- CCTV Feed Preview -->
            <div class="cctv-feed-frame">
              <img [src]="getCamImage(c, idx)" class="cctv-feed-img" [alt]="c.name" loading="lazy" (error)="onCardImgError($event, c, idx)" />
              <div class="cctv-feed-hover-overlay">
                <div class="play-stream-circle">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                </div>
                <span class="hover-play-text">Ouvrir le flux direct</span>
              </div>
              <div class="cctv-live-tag">
                <span class="live-dot-glow"></span>
                <span>DIRECT</span>
              </div>
            </div>
          </div>
        }
        @empty {
          <div class="empty-cams-card">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
            <h4>Aucune caméra enregistrée</h4>
            <p class="muted">Ajoutez votre première caméra IP RTSP pour démarrer la surveillance IA SafeWatch.</p>
            @if (auth.canEdit) {
              <button type="button" class="btn-primary-add-cam" (click)="openNewCamModal()">
                + Ajouter une caméra
              </button>
            }
          </div>
        }
      </div>
    </section>

    <!-- Collapsible / Quick Access Panels (Attendance & LAPI Logs) -->
    <div class="recent-feeds-section">
      <div class="feeds-grid">
        <!-- Recent Attendances for selected date -->
        <div class="feed-panel">
          <div class="panel-header">
            <h3>{{ i18n.t('dash.quick_attendance', 'Derniers Pointages Présences') }}</h3>
            <a routerLink="/attendance" [queryParams]="{ date: selectedDate() }" class="see-all">{{ i18n.t('dash.see_all', 'Tout voir →') }}</a>
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
                      {{ p.statut === 'late' ? i18n.t('att.late', 'En retard') : i18n.t('att.present', 'Présent') }}
                    </span>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-state">{{ i18n.t('common.no_results', 'Aucun résultat pour cette date') }}</div>
            }
          </div>
        </div>

        <!-- Recent Gate Passes for selected date -->
        <div class="feed-panel">
          <div class="panel-header">
            <h3>{{ i18n.t('dash.quick_access', 'Derniers Passages Véhicules (LAPI)') }}</h3>
            <a routerLink="/logs" [queryParams]="{ date: selectedDate() }" class="see-all">{{ i18n.t('dash.see_all', 'Tout voir →') }}</a>
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
                      {{ l.statut === 'autorise' ? i18n.t('logs.authorized', 'Autorisé') : i18n.t('logs.refused', 'Refusé') }}
                    </span>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-state">{{ i18n.t('common.no_results', 'Aucun passage pour cette date') }}</div>
            }
          </div>
        </div>
      </div>
    </div>

    <!-- Live Stream Modal -->
    @if (activeStream(); as stream) {
      <div class="stream-modal-backdrop" (click)="closeStream()">
        <div class="stream-modal-dialog" (click)="$event.stopPropagation()">
          <div class="stream-modal-header">
            <div>
              <h3>{{ stream.name }}</h3>
              <small class="muted font-mono">{{ stream.id }} · Flux HD H.264</small>
            </div>
            <button class="modal-close" (click)="closeStream()" title="Fermer">✕</button>
          </div>
          <div class="stream-modal-body">
            <div class="stream-viewport">
              <div class="stream-hud top-left">
                <span class="live-badge-glow">
                  <span class="pulse-dot"></span>
                  {{ i18n.t('common.live', 'DIRECT') }}
                </span>
                <span class="hud-chip">1920x1080</span>
                <span class="hud-chip">28.4 {{ i18n.t('dash.fps', 'FPS') }}</span>
              </div>
              <div class="stream-hud top-right font-mono text-xs">
                {{ streamTime() }}
              </div>
              <div class="stream-simulated-canvas">
                <img
                  [src]="'/api/cameras/' + stream.id + '/stream/'"
                  class="stream-live-img"
                  [alt]="stream.name"
                  (error)="onStreamImgError($event)"
                />
                <div class="ai-crosshair"></div>
                <div class="stream-watermark stream-fallback-overlay">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  <p>En attente du flux direct {{ stream.id }}...</p>
                  <small style="color: rgba(255,255,255,0.4);">Lancez : <code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">python -m vision.cli run {{ stream.id }}</code></small>
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
                <small class="muted">Configuration du flux vidéo et de l'analyse IA SafeWatch</small>
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
                      placeholder="ex: cam-03-couloir"
                      [disabled]="!!camDraft.id"
                      class="custom-input"
                    />
                    <small class="field-hint">Identifiant système pour les alertes et flux.</small>
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
                      placeholder="ex: Caméra 03 - Couloir A"
                      class="custom-input"
                    />
                    <small class="field-hint">Nom affiché sur le tableau de bord SafeWatch.</small>
                  </div>
                </div>

                <div class="form-field full-width">
                  <label class="field-label">
                    <span>Tâche d'analyse Vision assignée *</span>
                  </label>
                  <select [(ngModel)]="camDraft.task" name="task" required class="custom-select">
                    <option value="attendance">👤 Pointage Facial & Surveillance collaborateurs</option>
                    <option value="anpr">🚗 Portail & Barrière — Lecture plaques LAPI</option>
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
                  <small class="field-hint">Compatible RTSP H.264 / H.265, Webcams USB (<code class="code-pill">0</code>, <code class="code-pill">1</code>) ou fichiers vidéo MP4.</small>
                </div>
              </div>

              <!-- Section 3: Emplacement -->
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

              <!-- Section 4: Activation -->
              <div class="form-toggle-card">
                <label class="toggle-switch-label">
                  <input type="checkbox" [(ngModel)]="camDraft.enabled" name="enabled" class="toggle-checkbox" />
                  <div class="toggle-text-wrap">
                    <strong>Activer la caméra pour le traitement direct SafeWatch</strong>
                    <span class="muted text-xs">Le flux sera analysé et affiché dans la grille en direct.</span>
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
  `,
  styles: `
    /* Top Bar with Date Selector */
    /* Date Chip Selector */
    .dash-top-bar {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      margin-bottom: 1.25rem;
    }

    .date-chip-selector {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.45rem 1rem;
      border-radius: 999px;
      background: var(--surface);
      border: 1px solid var(--surface-border);
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--fg);
      box-shadow: var(--shadow-sm);
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease;
    }

    .date-chip-selector:hover {
      background: var(--surface-hover);
      border-color: var(--brand);
    }

    .date-chip-label {
      font-weight: 700;
      color: var(--fg);
      pointer-events: none;
    }

    .date-native-overlay {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
      border: none;
      padding: 0;
      margin: 0;
    }

    .date-native-overlay::-webkit-calendar-picker-indicator {
      display: none;
      -webkit-appearance: none;
    }

    .chevron-down {
      color: var(--muted);
      pointer-events: none;
    }

    /* Modern Line Chart Layout */
    .chart-body-modern {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      width: 100%;
      padding-top: 0.5rem;
    }

    .chart-plot-container {
      display: flex;
      align-items: stretch;
      gap: 0.75rem;
      height: 160px;
      width: 100%;
    }

    .chart-y-axis {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: flex-end;
      width: 24px;
      padding-bottom: 2px;
      user-select: none;
    }

    .y-label {
      font-size: 0.76rem;
      font-weight: 600;
      color: var(--muted);
      font-family: var(--font-main);
      line-height: 1;
    }

    .chart-svg-wrap {
      flex: 1;
      position: relative;
      width: 100%;
      height: 100%;
    }

    .line-chart-svg {
      width: 100%;
      height: 100%;
      overflow: visible;
      display: block;
    }

    .chart-x-axis {
      display: flex;
      justify-content: space-between;
      padding-left: 2.2rem;
      padding-right: 0.2rem;
      margin-top: 0.25rem;
      user-select: none;
    }

    .x-label {
      font-size: 0.74rem;
      font-weight: 600;
      color: var(--muted);
      font-family: var(--font-main);
    }

    /* 4 SafeWatch KPI Grid */
    .safewatch-kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.25rem;
      margin-bottom: 1.5rem;
    }

    @media (max-width: 1024px) {
      .safewatch-kpi-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 600px) {
      .safewatch-kpi-grid {
        grid-template-columns: 1fr;
      }
    }

    .sw-kpi-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
      padding: 1.25rem 1.35rem;
      display: flex;
      flex-direction: column;
      text-decoration: none;
      color: inherit;
      box-shadow: var(--shadow-sm);
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
      cursor: pointer;
    }

    .sw-kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
      border-color: var(--brand);
    }

    .sw-kpi-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.6rem;
    }

    .sw-kpi-label {
      font-size: 0.88rem;
      font-weight: 600;
      color: var(--fg-secondary);
    }

    .sw-kpi-icon-box {
      width: 42px;
      height: 42px;
      border-radius: 11px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .sw-kpi-icon-box.purple {
      background: #ede9fe;
      color: #5046e5;
    }

    .sw-kpi-icon-box.green {
      background: #dcfce7;
      color: #16a34a;
    }

    .sw-kpi-icon-box.orange {
      background: #ffedd5;
      color: #ea580c;
    }

    .sw-kpi-icon-box.blue {
      background: #e0f2fe;
      color: #0284c7;
    }

    [data-theme="dark"] .sw-kpi-icon-box.purple {
      background: rgba(99, 102, 241, 0.18);
      color: #818cf8;
    }
    [data-theme="dark"] .sw-kpi-icon-box.green {
      background: rgba(16, 185, 129, 0.18);
      color: #34d399;
    }
    [data-theme="dark"] .sw-kpi-icon-box.orange {
      background: rgba(245, 158, 11, 0.18);
      color: #fbbf24;
    }
    [data-theme="dark"] .sw-kpi-icon-box.blue {
      background: rgba(56, 189, 248, 0.18);
      color: #38bdf8;
    }

    .sw-kpi-value {
      font-size: 2.15rem;
      font-weight: 800;
      color: var(--fg);
      letter-spacing: -0.03em;
      line-height: 1.1;
      margin-bottom: 0.5rem;
    }

    .sw-kpi-bottom {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .sw-kpi-bottom.ok-status {
      color: #10b981;
    }

    .sw-kpi-bottom.alert-status {
      color: #ea580c;
    }

    [data-theme="dark"] .sw-kpi-bottom.alert-status {
      color: #fb923c;
    }

    .sw-kpi-bottom.muted-status {
      color: var(--muted);
    }

    .pulse-green-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 0 2.5px rgba(16, 185, 129, 0.25);
    }

    .pulse-green-dot.offline {
      background: #ef4444;
      box-shadow: 0 0 0 2.5px rgba(239, 68, 68, 0.25);
    }

    /* Charts Row */
    .charts-row {
      display: grid;
      grid-template-columns: 1.8fr 1.2fr;
      gap: 1.25rem;
      margin-bottom: 2rem;
    }

    @media (max-width: 960px) {
      .charts-row {
        grid-template-columns: 1fr;
      }
    }

    .chart-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
      padding: 1.25rem 1.4rem;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.2rem;
    }

    .chart-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--fg);
      letter-spacing: -0.01em;
      margin: 0;
    }

    .chart-legend-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--fg-secondary);
    }

    .legend-line-dot {
      width: 14px;
      height: 3px;
      border-radius: 2px;
      background: #5046e5;
    }

    [data-theme="dark"] .legend-line-dot {
      background: #6366f1;
    }

    .line-chart-svg {
      width: 100%;
      height: 210px;
      overflow: visible;
    }

    .chart-grid-line {
      stroke: var(--surface-border);
      stroke-width: 1;
      stroke-dasharray: 4 4;
    }

    .chart-grid-line.base {
      stroke-dasharray: none;
      stroke: var(--surface-border);
    }

    .chart-axis-label {
      font-size: 11px;
      font-weight: 600;
      fill: var(--muted);
      font-family: var(--font-main);
    }

    .chart-line-stroke {
      fill: none;
      stroke: #5046e5;
      stroke-width: 3.2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    [data-theme="dark"] .chart-line-stroke {
      stroke: #6366f1;
    }

    .chart-dot {
      fill: #5046e5;
      stroke: #ffffff;
      stroke-width: 2.5;
      transition: r 0.15s ease;
      cursor: pointer;
    }

    [data-theme="dark"] .chart-dot {
      fill: #6366f1;
      stroke: #171f33;
    }

    .chart-dot:hover {
      r: 6.5;
    }

    /* Donut Chart Layout */
    .donut-chart-layout {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
      flex: 1;
    }

    @media (max-width: 600px) {
      .donut-chart-layout {
        flex-direction: column;
      }
    }

    .donut-svg-wrap {
      width: 170px;
      height: 170px;
      flex-shrink: 0;
    }

    .donut-svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    .donut-bg-ring {
      fill: none;
      stroke: var(--surface-border);
      stroke-width: 24;
    }

    .donut-segment {
      fill: none;
      stroke-width: 24;
      stroke-linecap: round;
      transition: stroke-width 0.2s ease;
    }

    .donut-segment.seg-motion { stroke: #5046e5; }
    .donut-segment.seg-intrusion { stroke: #06b6d4; }
    .donut-segment.seg-object { stroke: #f59e0b; }
    .donut-segment.seg-other { stroke: #a855f7; }

    [data-theme="dark"] .donut-segment.seg-motion { stroke: #6366f1; }
    [data-theme="dark"] .donut-segment.seg-intrusion { stroke: #22d3ee; }
    [data-theme="dark"] .donut-segment.seg-object { stroke: #fbbf24; }
    [data-theme="dark"] .donut-segment.seg-other { stroke: #c084fc; }

    .donut-center-num {
      transform: rotate(90deg);
      transform-origin: 100px 100px;
      font-size: 26px;
      font-weight: 800;
      fill: var(--fg);
      font-family: var(--font-main);
    }

    .donut-center-sub {
      transform: rotate(90deg);
      transform-origin: 100px 100px;
      font-size: 12px;
      font-weight: 600;
      fill: var(--muted);
      font-family: var(--font-main);
    }

    .donut-legend-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      flex: 1;
    }

    .donut-legend-item {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      font-size: 0.82rem;
    }

    .legend-color-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .legend-color-dot.seg-motion { background: #5046e5; }
    .legend-color-dot.seg-intrusion { background: #06b6d4; }
    .legend-color-dot.seg-object { background: #f59e0b; }
    .legend-color-dot.seg-other { background: #a855f7; }

    [data-theme="dark"] .legend-color-dot.seg-motion { background: #6366f1; }
    [data-theme="dark"] .legend-color-dot.seg-intrusion { background: #22d3ee; }
    [data-theme="dark"] .legend-color-dot.seg-object { background: #fbbf24; }
    [data-theme="dark"] .legend-color-dot.seg-other { background: #c084fc; }

    .legend-name {
      color: var(--fg-secondary);
      font-weight: 500;
      flex: 1;
    }

    .legend-stat {
      color: var(--fg);
      font-weight: 700;
      font-size: 0.8rem;
    }

    /* Cameras Section */
    .cameras-section {
      margin-bottom: 2.5rem;
    }

    .section-title-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
    }

    .section-title-bar h2 {
      font-size: 1.2rem;
      font-weight: 800;
      color: var(--fg);
      letter-spacing: -0.01em;
      margin: 0;
    }

    .btn-primary-add-cam {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: var(--radius-sm);
      background: var(--brand);
      color: #fff;
      font-size: 0.82rem;
      font-weight: 700;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(80, 70, 229, 0.25);
      transition: all 0.15s ease;
    }

    .btn-primary-add-cam:hover {
      background: var(--brand-hover);
      transform: translateY(-1px);
    }

    /* Cameras Grid */
    .safewatch-cameras-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.25rem;
    }

    .cctv-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
      overflow: visible;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    }

    .cctv-card:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-md);
      border-color: var(--brand);
    }

    .cctv-card-header {
      padding: 0.75rem 0.9rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      background: var(--surface-card);
      border-bottom: 1px solid var(--surface-border);
      border-top-left-radius: var(--radius-md);
      border-top-right-radius: var(--radius-md);
      position: relative;
      z-index: 10;
    }

    .cctv-title-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      overflow: hidden;
    }

    .cctv-status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.3);
      flex-shrink: 0;
    }

    .cctv-status-dot.offline {
      background: #ef4444;
      box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.3);
    }

    .cctv-name {
      font-size: 0.84rem;
      font-weight: 700;
      color: var(--fg);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

        .cctv-dots-btn {
      background: transparent !important;
      border: none !important;
      color: #94a3b8 !important;
      font-size: 1.15rem !important;
      font-weight: 400 !important;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      letter-spacing: 1px;
      transition: color 0.15s ease;
    }

    .cctv-dots-btn:hover {
      color: var(--fg) !important;
      background: transparent !important;
    }

    .cctv-header-actions {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      flex-shrink: 0;
    }

    .cctv-icon-btn {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: var(--muted);
      display: grid;
      place-items: center;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.15s ease;
    }

    .cctv-icon-btn:hover {
      background: var(--surface-hover);
      color: var(--fg);
    }

    .cctv-menu-wrapper {
      position: relative;
      display: inline-block;
    }

    .cctv-dropdown-menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      min-width: 140px;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-md);
      z-index: 100;
      display: flex;
      flex-direction: column;
      padding: 0.35rem;
      gap: 0.2rem;
    }

    [dir="rtl"] .cctv-dropdown-menu {
      right: auto;
      left: 0;
    }

    button.cam-menu-item {
      display: flex !important;
      align-items: center !important;
      gap: 0.5rem !important;
      padding: 0.45rem 0.65rem !important;
      border-radius: 6px !important;
      border: none !important;
      background: transparent !important;
      box-shadow: none !important;
      color: var(--fg) !important;
      font-size: 0.78rem !important;
      font-weight: 500 !important;
      cursor: pointer !important;
      width: 100% !important;
      text-align: left !important;
      transform: none !important;
      transition: background 0.15s ease, color 0.15s ease !important;
    }

    button.cam-menu-item:hover {
      background: var(--surface-hover) !important;
      color: var(--brand) !important;
      transform: none !important;
      box-shadow: none !important;
    }

    button.cam-menu-item.danger {
      color: var(--bad) !important;
      background: transparent !important;
      box-shadow: none !important;
    }

    button.cam-menu-item.danger:hover {
      background: var(--bad-bg) !important;
      color: var(--bad) !important;
      transform: none !important;
      box-shadow: none !important;
    }

    .cctv-feed-frame {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #000;
      overflow: hidden;
      border-bottom-left-radius: var(--radius-md);
      border-bottom-right-radius: var(--radius-md);
    }

    .cctv-feed-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.35s ease;
    }

    .cctv-card:hover .cctv-feed-img {
      transform: scale(1.04);
    }

    .cctv-feed-hover-overlay {
      position: absolute;
      inset: 0;
      background: rgba(15, 20, 34, 0.65);
      backdrop-filter: blur(2px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .cctv-card:hover .cctv-feed-hover-overlay {
      opacity: 1;
    }

    .play-stream-circle {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--brand);
      color: #fff;
      display: grid;
      place-items: center;
      box-shadow: 0 4px 14px rgba(80, 70, 229, 0.5);
    }

    .hover-play-text {
      color: #fff;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .cctv-live-tag {
      position: absolute;
      bottom: 8px;
      left: 8px;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(4px);
      color: #fff;
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.04em;
    }

    .live-dot-glow {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 6px #10b981;
    }

    .empty-cams-card {
      grid-column: 1 / -1;
      background: var(--surface-card);
      border: 1px dashed var(--surface-border);
      border-radius: var(--radius-md);
      padding: 3rem 2rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }

    .empty-cams-card svg {
      color: var(--muted);
      margin-bottom: 0.25rem;
    }

    .empty-cams-card h4 {
      font-size: 1.05rem;
      margin: 0;
      color: var(--fg);
    }

    /* Quick Access Feeds Grid */
    .recent-feeds-section {
      margin-top: 1rem;
      border-top: 1px solid var(--surface-border);
      padding-top: 2rem;
    }

    .feeds-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
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
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--surface-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .panel-header h3 {
      font-size: 0.95rem;
      font-weight: 700;
      margin: 0;
      color: var(--fg);
    }

    .panel-header .see-all {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--brand);
      text-decoration: none;
    }

    .panel-header .see-all:hover {
      text-decoration: underline;
    }

    .panel-body {
      padding: 0.75rem 1.25rem;
    }

    .activity-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .activity-item {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.4rem 0;
    }

    .activity-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--surface-hover);
      color: var(--fg);
      display: grid;
      place-items: center;
      font-weight: 700;
      font-size: 0.82rem;
      border: 1px solid var(--surface-border);
    }

    .plate-badge {
      padding: 0.3rem 0.6rem;
      background: var(--surface);
      border: 1.5px solid var(--surface-border);
      border-radius: 6px;
      font-family: var(--font-mono);
      font-weight: 800;
      font-size: 0.8rem;
      color: var(--fg);
      box-shadow: var(--shadow-sm);
    }

    .activity-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }

    .activity-info strong {
      font-size: 0.86rem;
      color: var(--fg);
    }

    .activity-meta {
      font-size: 0.75rem;
      color: var(--muted);
    }

    .pill {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 999px;
      background: var(--ok-bg);
      color: var(--ok);
      border: 1px solid var(--ok-border);
    }

    .pill.warn {
      background: var(--warn-bg);
      color: var(--warn);
      border-color: var(--warn-border);
    }

    .pill.bad {
      background: var(--bad-bg);
      color: var(--bad);
      border-color: var(--bad-border);
    }

    .empty-state {
      padding: 2rem;
      text-align: center;
      color: var(--muted);
      font-size: 0.85rem;
    }

    /* Live Stream Modal */
    .stream-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 2000;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      display: grid;
      place-items: center;
      padding: 1.5rem;
      animation: fadeIn 0.15s ease-out;
    }

    .stream-modal-dialog {
      width: 100%;
      max-width: 900px;
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-lg);
    }

    .stream-modal-header {
      padding: 1rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--surface-border);
    }

    .stream-modal-header h3 {
      font-size: 1.1rem;
      margin: 0;
      color: var(--fg);
    }

    .modal-close {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: var(--surface-hover);
      color: var(--fg-secondary);
      font-size: 1rem;
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: all 0.15s ease;
    }

    .modal-close:hover {
      background: var(--bad-bg);
      color: var(--bad);
    }

    .stream-modal-body {
      padding: 1.25rem;
      background: #000;
    }

    .stream-viewport {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #0a0d16;
      border-radius: var(--radius-sm);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .stream-hud {
      position: absolute;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      color: #fff;
    }

    .stream-hud.top-left { top: 0; left: 0; }
    .stream-hud.top-right { top: 0; right: 0; }
    .stream-hud.bottom-left { bottom: 0; left: 0; }

    .live-badge-glow {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      background: #ef4444;
      color: #fff;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.05em;
    }

    .pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 0 6px #fff;
    }

    .hud-chip {
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.6);
      font-size: 0.72rem;
      font-family: var(--font-mono);
    }

    .hud-chip.ok {
      color: #10b981;
    }

    .stream-simulated-canvas {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.4);
      overflow: hidden;
      background: #000;
    }

    .stream-live-img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      z-index: 5;
    }

    .stream-fallback-overlay {
      position: absolute;
      z-index: 1;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }

    .stream-watermark svg {
      opacity: 0.5;
    }

    .stream-watermark p {
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.85rem;
    }

    /* Cam Modal Form */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 2000;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: grid;
      place-items: center;
      padding: 1.5rem;
    }

    .modal-dialog.modal-cam-dialog {
      width: 100%;
      max-width: 650px;
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      max-height: 90vh;
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--surface-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-title-wrap {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .modal-icon-badge {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: var(--brand-light);
      color: var(--brand);
      display: grid;
      place-items: center;
    }

    .modal-main-title {
      font-size: 1.15rem;
      font-weight: 800;
      margin: 0;
      color: var(--fg);
    }

    .modal-cam-body {
      padding: 1.5rem;
      overflow-y: auto;
    }

    .form-section-card {
      background: var(--surface-hover);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
      padding: 1.25rem;
      margin-bottom: 1rem;
      position: relative;
    }

    .section-badge {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--brand);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 0.85rem;
    }

    .form-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 0.85rem;
    }

    .form-row-3 {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 0.75rem;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .field-label {
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--fg);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .label-tag {
      font-size: 0.68rem;
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      background: var(--surface-border);
      color: var(--fg-secondary);
    }

    .custom-input, .custom-select {
      padding: 0.55rem 0.85rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--surface-border);
      background: var(--surface);
      color: var(--fg);
      font-size: 0.84rem;
      outline: none;
      transition: all 0.15s ease;
    }

    .custom-input:focus, .custom-select:focus {
      border-color: var(--brand);
      box-shadow: 0 0 0 3px var(--brand-glow);
    }

    .input-with-icon {
      position: relative;
      display: flex;
      align-items: center;
    }

    .input-with-icon svg {
      position: absolute;
      left: 10px;
      color: var(--muted);
      pointer-events: none;
    }

    .custom-input.with-left-icon {
      padding-left: 2.2rem;
      width: 100%;
    }

    .field-hint {
      font-size: 0.72rem;
      color: var(--muted);
    }

    .form-toggle-card {
      background: var(--surface-hover);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
      padding: 0.85rem 1.25rem;
      margin-bottom: 1rem;
    }

    .toggle-switch-label {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      cursor: pointer;
    }

    .toggle-checkbox {
      width: 18px;
      height: 18px;
      accent-color: var(--brand);
    }

    .toggle-text-wrap {
      display: flex;
      flex-direction: column;
    }

    .toggle-text-wrap strong {
      font-size: 0.85rem;
      color: var(--fg);
    }

    .modal-footer-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--surface-border);
    }

    .btn-cancel {
      padding: 0.6rem 1.2rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--surface-border);
      background: var(--surface);
      color: var(--fg);
      font-weight: 600;
      font-size: 0.84rem;
      cursor: pointer;
    }

    .btn-submit {
      padding: 0.6rem 1.4rem;
      border-radius: var(--radius-sm);
      border: none;
      background: var(--brand);
      color: #fff;
      font-weight: 700;
      font-size: 0.84rem;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(80, 70, 229, 0.3);
    }

    .btn-submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .font-mono { font-family: var(--font-mono); }
    .text-xs { font-size: 0.75rem; }
    .text-center { text-align: center; }
  `,
})
export class DashboardPage implements OnInit, OnDestroy {
  private api = inject(Api);
  private stream = inject(StreamService);
  private toast = inject(ToastService);
  private confirmService = inject(ConfirmService);
  private router = inject(Router);
  auth = inject(Auth);
  modal = inject(ModalService);
  i18n = inject(I18nService);

  readonly todayDate = getLocalToday();
  readonly selectedDate = signal<string>(this.todayDate);

  readonly stats = signal<Stats | null>(null);
  readonly recentAttendance = signal<Attendance[]>([]);
  readonly recentLogs = signal<AccessLog[]>([]);
  readonly cameras = signal<Camera[]>([]);
  readonly alertsDayCount = signal<number>(0);

  // Active camera menu id for dropdown (•••)
  readonly activeCamMenuId = signal<string | null>(null);

  readonly activeCamerasCount = computed(() => this.cameras().filter((c) => c.enabled).length);
  readonly recordingsCount = computed(() => this.stats()?.presents ?? this.recentAttendance().length);
  readonly alertsCount = computed(() => (this.stats() as any)?.alertes_jour ?? this.alertsDayCount() ?? this.stats()?.alertes_non_vues ?? 0);
  readonly usersCount = computed(() => {
    const s = this.stats();
    if (s?.membres) return s.membres;
    const p = s?.presents ?? 0;
    const a = s?.absents ?? 0;
    return (p + a) > 0 ? (p + a) : 12;
  });

  // Event stats for Donut Chart
  readonly eventStats = computed(() => {
    const s = this.stats();
    const motion = s?.presents ?? 0;
    const intrusion = s?.refuses ?? 0;
    const alerts = (s as any)?.alertes_jour ?? s?.alertes_non_vues ?? 0;
    const other = s?.autorises ?? 0;
    const total = motion + intrusion + alerts + other;

    if (total === 0) {
      return {
        total: 0,
        motion: 0,
        intrusion: 0,
        alerts: 0,
        other: 0,
        pMotion: 0,
        pIntrusion: 0,
        pAlerts: 0,
        pOther: 0,
        pctMotion: 0,
        pctIntrusion: 0,
        pctAlerts: 0,
        pctOther: 0,
      };
    }

    return {
      total,
      motion,
      intrusion,
      alerts,
      other,
      pMotion: motion / total,
      pIntrusion: intrusion / total,
      pAlerts: alerts / total,
      pOther: other / total,
      pctMotion: Math.round((motion / total) * 100),
      pctIntrusion: Math.round((intrusion / total) * 100),
      pctAlerts: Math.round((alerts / total) * 100),
      pctOther: Math.round((other / total) * 100),
    };
  });

  // Line Chart Dynamic Scaling
  readonly lineMaxY = computed(() => Math.max(4, this.cameras().length));
  readonly line3QuarterY = computed(() => Math.round(this.lineMaxY() * 0.75));
  readonly lineHalfY = computed(() => Math.round(this.lineMaxY() * 0.5));
  readonly lineQuarterY = computed(() => Math.round(this.lineMaxY() * 0.25));

  readonly linePoints = computed(() => {
    const maxY = this.lineMaxY();
    const active = this.activeCamerasCount();
    // 150 is 0 Y pos, 10 is maxY pos (range 140px)
    const computeY = (val: number) => 150 - (val / maxY) * 140;

    const xs = [0, 100, 200, 300, 400, 500, 600];
    return xs.map((x, i) => {
      // slight natural curve matching work hours
      let camVal = active;
      if (active > 0) {
        if (i === 0 || i === 1) camVal = Math.max(0, active - 1); // early morning
        if (i === 2 || i === 3 || i === 4) camVal = active; // peak hours
        if (i === 5 || i === 6) camVal = active;
      }
      return { x, y: computeY(camVal) };
    });
  });

  readonly lineStrokePath = computed(() => {
    const pts = this.linePoints();
    if (!pts.length) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cx = (prev.x + curr.x) / 2;
      d += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  });

  readonly lineAreaPath = computed(() => {
    const stroke = this.lineStrokePath();
    if (!stroke) return '';
    const pts = this.linePoints();
    const lastX = pts[pts.length - 1].x;
    const firstX = pts[0].x;
    return `${stroke} L ${lastX} 150 L ${firstX} 150 Z`;
  });

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
  private snapshotTimer: any = null;

  ngOnInit(): void {
    this.load(this.selectedDate());
    this.sub = this.stream.updates$.subscribe(() => {
      this.load(this.selectedDate());
    });
    this.timer = setInterval(() => {
      this.streamTime.set(new Date().toLocaleTimeString());
    }, 1000);

    // Refresh live camera card snapshot every 10 seconds and clear failed set to retry
    this.snapshotTimer = setInterval(() => {
      this.failedSnapshots.clear();
      this.snapshotTimestamp.set(Date.now());
    }, 10000);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.timer) clearInterval(this.timer);
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
  }

  formattedSelectedDate(): string {
    const d = this.selectedDate();
    if (!d) return '';
    const parts = d.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return d;
  }

  openDatePicker(input: any): void {
    if (!input) return;
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
      } else if (typeof input.focus === 'function') {
        input.focus();
      }
    } catch {
      if (input && typeof input.focus === 'function') {
        input.focus();
      }
    }
  }

  onDateFilterChange(newDate: string): void {
    if (!newDate) newDate = this.todayDate;
    this.selectedDate.set(newDate);
    this.load(newDate);
  }

  load(date?: string): void {
    const targetDate = date || this.selectedDate();
    this.api.stats(targetDate).subscribe({
      next: (s) => this.stats.set(s),
      error: () => {},
    });

    this.api.attendance({ date: targetDate }).subscribe({
      next: (page) => this.recentAttendance.set(page.results.slice(0, 5)),
      error: () => {},
    });

    this.api.logs({ date: targetDate }).subscribe({
      next: (page) => this.recentLogs.set(page.results.slice(0, 5)),
      error: () => {},
    });

    this.api.cameras().subscribe({
      next: (page) => this.cameras.set(page.results || []),
      error: () => {},
    });

    this.api.alerts().subscribe({
      next: (page) => {
        const matching = (page.results || []).filter((a) => {
          if (!targetDate) return true;
          return a.created_at && a.created_at.startsWith(targetDate);
        });
        this.alertsDayCount.set(matching.length);
      },
      error: () => {},
    });
  }

  readonly snapshotTimestamp = signal<number>(Date.now());
  failedSnapshots = new Set<string>();

  getCamImage(cam: Camera, index: number): string {
    if (cam.cam_id && !this.failedSnapshots.has(cam.cam_id)) {
      return `/api/cameras/${cam.cam_id}/snapshot/?t=${this.snapshotTimestamp()}`;
    }
    if (cam.task === 'anpr') return '/cameras/cam2_parking.jpg';
    const images = [
      '/cameras/cam1_entrance.jpg',
      '/cameras/cam3_hallway.jpg',
      '/cameras/cam4_office.jpg',
      '/cameras/cam5_meeting.jpg',
      '/cameras/cam6_warehouse.jpg',
      '/cameras/cam7_caisse.jpg',
      '/cameras/cam8_emergency.jpg',
      '/cameras/cam2_parking.jpg',
    ];
    return images[index % images.length];
  }

  onCardImgError(event: Event, cam: Camera, index: number): void {
    const img = event.target as HTMLImageElement;
    if (cam.cam_id) {
      this.failedSnapshots.add(cam.cam_id);
    }
    if (cam.task === 'anpr') {
      img.src = '/cameras/cam2_parking.jpg';
    } else {
      const fallbackList = [
        '/cameras/cam1_entrance.jpg',
        '/cameras/cam3_hallway.jpg',
        '/cameras/cam4_office.jpg',
        '/cameras/cam5_meeting.jpg',
        '/cameras/cam6_warehouse.jpg',
        '/cameras/cam7_caisse.jpg',
        '/cameras/cam8_emergency.jpg',
        '/cameras/cam2_parking.jpg',
      ];
      img.src = fallbackList[index % fallbackList.length];
    }
  }

  onStreamImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    // Hide briefly and retry loading after 1.5s in case camera worker was starting
    img.style.opacity = '0';
    setTimeout(() => {
      const active = this.activeStream();
      if (active) {
        img.src = `/api/cameras/${active.id}/stream/?t=${Date.now()}`;
        img.style.opacity = '1';
      }
    }, 1500);
  }

  donutDash(pct: number): string {
    const circumference = 439.82;
    const len = pct * circumference;
    return `${len} ${circumference - len}`;
  }

  donutOffset(accumulatedPct: number): number {
    const circumference = 439.82;
    return -(accumulatedPct * circumference);
  }

  toggleCamMenu(camId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.activeCamMenuId() === camId) {
      this.activeCamMenuId.set(null);
    } else {
      this.activeCamMenuId.set(camId);
    }
  }

  scrollToSection(id: string): void {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
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
    this.activeCamMenuId.set(null);
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
        this.load(this.selectedDate());
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
    this.activeCamMenuId.set(null);
    if (!c.id) return;

    const ok = await this.confirmService.confirm({
      title: 'Supprimer la caméra',
      message: `Êtes-vous sûr de vouloir supprimer définitivement la caméra ${c.name} (${c.cam_id}) ?`,
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true,
    });

    if (ok) {
      this.api.deleteCamera(c.id).subscribe({
        next: () => {
          this.toast.info('Supprimé', `Caméra ${c.cam_id} retirée`);
          this.load(this.selectedDate());
        },
        error: () => this.toast.bad('Erreur de suppression'),
      });
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.activeCamMenuId.set(null);
  }
}

export const Dashboard = DashboardPage;
