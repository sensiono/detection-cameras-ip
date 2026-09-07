import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { ConfirmService } from '../core/confirm';
import { I18nService } from '../core/i18n';
import { Camera } from '../core/models';
import { StreamService } from '../core/stream';
import { ToastService } from '../core/toast';

@Component({
  selector: 'app-cameras',
  imports: [FormsModule],
  template: `
    <!-- Page Header -->
    <div class="cams-page-head">
      <div>
        <div class="title-row">
          <h1>{{ i18n.t('nav.cameras', 'Caméras') }}</h1>
          <span class="count-badge">{{ filteredCameras().length }}</span>
        </div>
        <p class="muted">Surveillance temps réel et administration des flux vidéo connectés</p>
      </div>

      <div class="page-head-actions">
        @if (auth.canEdit) {
          <button type="button" class="btn-primary-add" (click)="openNewCamModal()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>Ajouter une caméra</span>
          </button>
        }
      </div>
    </div>

    <!-- Summary KPI Pills -->
    <div class="cams-summary-pills">
      <div class="summary-pill total">
        <span class="pill-label">Total Caméras :</span>
        <strong class="pill-val">{{ cameras().length }}</strong>
      </div>
      <div class="summary-pill ok">
        <span class="dot-ok"></span>
        <span class="pill-label">Actives en ligne :</span>
        <strong class="pill-val">{{ activeCount() }}</strong>
      </div>
      <div class="summary-pill warn">
        <span class="dot-warn"></span>
        <span class="pill-label">Désactivées :</span>
        <strong class="pill-val">{{ inactiveCount() }}</strong>
      </div>
    </div>

    <!-- Filter Toolbar -->
    <div class="cams-filter-bar">
      <!-- Search -->
      <div class="filter-search-box">
        <svg class="search-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          type="text"
          class="filter-search-input"
          [(ngModel)]="searchQuery"
          placeholder="Rechercher par nom, ID ou emplacement..."
        />
        @if (searchQuery()) {
          <button class="clear-search-btn" (click)="searchQuery.set('')">✕</button>
        }
      </div>

      <!-- Task Filter -->
      <div class="filter-select-wrap">
        <label>Tâche :</label>
        <select [(ngModel)]="taskFilter" class="filter-select">
          <option value="all">Toutes les tâches</option>
          <option value="attendance">👤 Pointage Facial</option>
          <option value="anpr">🚗 LAPI / Barrière</option>
        </select>
      </div>

      <!-- Status Filter -->
      <div class="filter-select-wrap">
        <label>Statut :</label>
        <select [(ngModel)]="statusFilter" class="filter-select">
          <option value="all">Tous les statuts</option>
          <option value="enabled">En ligne (Actives)</option>
          <option value="disabled">Désactivées</option>
        </select>
      </div>

      @if (searchQuery() || taskFilter() !== 'all' || statusFilter() !== 'all') {
        <button type="button" class="btn-reset-filters" (click)="resetFilters()">
          Réinitialiser
        </button>
      }
    </div>

    <!-- Cameras Grid -->
    <div class="cams-grid-viewport">
      @for (c of filteredCameras(); track c.id; let idx = $index) {
        <div class="cctv-card" [class.disabled-card]="!c.enabled" (click)="openStream(c.cam_id, c.name)">
          <!-- Card Header -->
          <div class="cctv-card-header">
            <div class="cctv-title-group">
              <span class="cctv-status-dot" [class.offline]="!c.enabled"></span>
              <span class="cctv-name" [title]="c.name">{{ c.name || c.cam_id }}</span>
            </div>

            <div class="cctv-header-actions" (click)="$event.stopPropagation()">
              <!-- Three dots Dropdown -->
              <div class="cctv-menu-wrapper">
                <button type="button" class="cctv-more-btn" (click)="toggleCamMenu(c.cam_id, $event)" title="Options">•••</button>
                @if (activeCamMenuId() === c.cam_id) {
                  <div class="cctv-dropdown-menu" (click)="$event.stopPropagation()">
                    <button type="button" class="cam-menu-item" (click)="openEditCamModal(c, $event)">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                      <span>Modifier</span>
                    </button>
                    @if (auth.canEdit) {
                      <button type="button" class="cam-menu-item danger" (click)="deleteCam(c, $event)">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                        <span>Supprimer</span>
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

          <!-- Video Snapshot Viewport -->
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
            <div class="cctv-live-tag" [class.offline]="!c.enabled">
              <span class="live-dot-glow" [class.offline]="!c.enabled"></span>
              <span>{{ c.enabled ? 'DIRECT' : 'HORS LIGNE' }}</span>
            </div>
            <div class="cctv-meta-hud">
              <span>{{ c.fps || 25 }} FPS</span>
              <span>{{ c.resolution || '1080p' }}</span>
            </div>
          </div>

          <!-- Card Details Footer -->
          <div class="cctv-card-footer">
            <div class="cctv-tags-row">
              <span class="tag-task" [class.anpr]="c.task === 'anpr'">
                {{ c.task === 'anpr' ? '🚗 LAPI / Barrière' : '👤 Pointage Facial' }}
              </span>
              @if (c.location) {
                <span class="tag-loc">📍 {{ c.location }}</span>
              }
            </div>
            <div class="cctv-url-row font-mono">
              <span class="cam-id-badge">{{ c.cam_id }}</span>
              <span class="cam-url-preview" [title]="c.url">{{ c.url || 'rtsp://...' }}</span>
            </div>
          </div>
        </div>
      }
      @empty {
        <div class="cams-empty-card">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
          <h3>Aucune caméra ne correspond à vos filtres</h3>
          <p class="muted">Modifiez vos critères de recherche ou ajoutez une nouvelle caméra IP.</p>
          @if (auth.canEdit) {
            <button type="button" class="btn-primary-add" (click)="openNewCamModal()">+ Ajouter une caméra</button>
          }
        </div>
      }
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
                  DIRECT
                </span>
                <span class="hud-chip">1920x1080</span>
                <span class="hud-chip">28.4 FPS</span>
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
    .cams-page-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .title-row h1 {
      font-size: 1.6rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0;
      color: var(--fg);
    }

    .count-badge {
      background: var(--brand-light);
      color: var(--brand);
      font-weight: 800;
      font-size: 0.8rem;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
    }

    .btn-primary-add {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.55rem 1.15rem;
      border-radius: var(--radius-sm);
      background: var(--brand);
      color: #fff;
      font-weight: 700;
      font-size: 0.84rem;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(80, 70, 229, 0.3);
      transition: all 0.15s ease;
    }

    .btn-primary-add:hover {
      background: var(--brand-hover);
      transform: translateY(-1px);
    }

    /* Summary KPI Pills */
    .cams-summary-pills {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }

    .summary-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-sm);
      font-size: 0.84rem;
    }

    .pill-label {
      color: var(--fg-secondary);
      font-weight: 500;
    }

    .pill-val {
      color: var(--fg);
      font-weight: 800;
    }

    .dot-ok {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
    }

    .dot-warn {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #f59e0b;
      box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.25);
    }

    /* Filter Toolbar */
    .cams-filter-bar {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
      padding: 0.85rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 1.25rem;
      margin-bottom: 1.75rem;
      box-shadow: var(--shadow-sm);
      flex-wrap: wrap;
    }

    .filter-search-box {
      position: relative;
      flex: 1;
      min-width: 240px;
      display: flex;
      align-items: center;
    }

    .search-ico {
      position: absolute;
      left: 12px;
      color: var(--muted);
      pointer-events: none;
    }

    .filter-search-input {
      width: 100%;
      padding: 0.55rem 2rem 0.55rem 2.3rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--surface-border);
      background: var(--surface);
      color: var(--fg);
      font-size: 0.84rem;
      outline: none;
      transition: all 0.15s ease;
    }

    .filter-search-input:focus {
      border-color: var(--brand);
      box-shadow: 0 0 0 3px var(--brand-glow);
    }

    .clear-search-btn {
      position: absolute;
      right: 10px;
      background: transparent;
      border: none;
      color: var(--muted);
      cursor: pointer;
      font-size: 0.8rem;
    }

    .filter-select-wrap {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .filter-select-wrap label {
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--fg-secondary);
      white-space: nowrap;
    }

    .filter-select {
      padding: 0.5rem 0.85rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--surface-border);
      background: var(--surface);
      color: var(--fg);
      font-size: 0.82rem;
      outline: none;
      cursor: pointer;
    }

    .btn-reset-filters {
      padding: 0.5rem 0.85rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--surface-border);
      background: var(--surface-hover);
      color: var(--fg);
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
    }

    /* Grid */
    .cams-grid-viewport {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem;
      margin-bottom: 3rem;
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

    .cctv-card.disabled-card {
      opacity: 0.75;
    }

    .cctv-card-header {
      padding: 0.8rem 1rem;
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
      width: 8px;
      height: 8px;
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
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--fg);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cctv-header-actions {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      flex-shrink: 0;
    }

    .cctv-more-btn {
      background: transparent;
      border: none;
      color: var(--muted);
      font-size: 1.15rem;
      font-weight: 400;
      line-height: 1;
      padding: 0 0.4rem;
      cursor: pointer;
      letter-spacing: 1px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s ease;
    }

    .cctv-more-btn:hover {
      color: var(--fg);
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
      top: calc(100% + 4px);
      right: 0;
      min-width: 140px;
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-md);
      z-index: 120;
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
      gap: 0.55rem !important;
      padding: 0.45rem 0.75rem !important;
      border-radius: 6px !important;
      border: none !important;
      background: transparent !important;
      box-shadow: none !important;
      color: var(--fg) !important;
      font-size: 0.8rem !important;
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

    .cctv-live-tag.offline {
      background: rgba(239, 68, 68, 0.8);
    }

    .live-dot-glow {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 6px #10b981;
    }

    .live-dot-glow.offline {
      background: #fff;
      box-shadow: none;
    }

    .cctv-meta-hud {
      position: absolute;
      bottom: 8px;
      right: 8px;
      display: flex;
      gap: 0.4rem;
      font-size: 0.65rem;
      font-family: var(--font-mono);
      background: rgba(0, 0, 0, 0.65);
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      color: rgba(255, 255, 255, 0.85);
    }

    .cctv-card-footer {
      padding: 0.85rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      background: var(--surface-card);
      border-bottom-left-radius: var(--radius-md);
      border-bottom-right-radius: var(--radius-md);
    }

    .cctv-tags-row {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex-wrap: wrap;
    }

    .tag-task {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.18rem 0.5rem;
      border-radius: 4px;
      background: var(--brand-light);
      color: var(--brand);
    }

    .tag-task.anpr {
      background: var(--ok-bg);
      color: var(--ok);
    }

    .tag-loc {
      font-size: 0.72rem;
      color: var(--muted);
    }

    .cctv-url-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.72rem;
      overflow: hidden;
    }

    .cam-id-badge {
      background: var(--surface-hover);
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      border: 1px solid var(--surface-border);
      color: var(--fg);
      font-weight: 600;
      flex-shrink: 0;
    }

    .cam-url-preview {
      color: var(--muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cams-empty-card {
      grid-column: 1 / -1;
      background: var(--surface-card);
      border: 1px dashed var(--surface-border);
      border-radius: var(--radius-md);
      padding: 3.5rem 2rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.85rem;
    }

    .cams-empty-card svg {
      color: var(--muted);
    }

    .cams-empty-card h3 {
      font-size: 1.15rem;
      margin: 0;
      color: var(--fg);
    }

    /* Stream Modal */
    .stream-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 2000;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      display: grid;
      place-items: center;
      padding: 1.5rem;
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

    /* Add/Edit Modal */
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
export class CamerasPage implements OnInit, OnDestroy {
  private api = inject(Api);
  private stream = inject(StreamService);
  private toast = inject(ToastService);
  private confirmService = inject(ConfirmService);
  auth = inject(Auth);
  i18n = inject(I18nService);

  readonly cameras = signal<Camera[]>([]);
  readonly searchQuery = signal<string>('');
  readonly taskFilter = signal<string>('all');
  readonly statusFilter = signal<string>('all');

  readonly activeCamMenuId = signal<string | null>(null);

  readonly activeCount = computed(() => this.cameras().filter((c) => c.enabled).length);
  readonly inactiveCount = computed(() => this.cameras().filter((c) => !c.enabled).length);

  readonly filteredCameras = computed(() => {
    const list = this.cameras();
    const q = this.searchQuery().toLowerCase().trim();
    const task = this.taskFilter();
    const status = this.statusFilter();

    return list.filter((c) => {
      // Search
      if (q) {
        const matchesName = (c.name || '').toLowerCase().includes(q);
        const matchesId = (c.cam_id || '').toLowerCase().includes(q);
        const matchesLoc = (c.location || '').toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesLoc) return false;
      }
      // Task
      if (task !== 'all' && c.task !== task) return false;
      // Status
      if (status === 'enabled' && !c.enabled) return false;
      if (status === 'disabled' && c.enabled) return false;

      return true;
    });
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

  readonly snapshotTimestamp = signal<number>(Date.now());
  private sub: Subscription | null = null;
  private timer: any = null;
  private snapshotTimer: any = null;

  ngOnInit(): void {
    this.load();
    this.sub = this.stream.updates$.subscribe(() => {
      this.load();
    });
    this.timer = setInterval(() => {
      this.streamTime.set(new Date().toLocaleTimeString());
    }, 1000);

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

  load(): void {
    this.api.cameras().subscribe({
      next: (page) => this.cameras.set(page.results || []),
      error: () => {},
    });
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.taskFilter.set('all');
    this.statusFilter.set('all');
  }

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
    img.style.opacity = '0';
    setTimeout(() => {
      const active = this.activeStream();
      if (active) {
        img.src = `/api/cameras/${active.id}/stream/?t=${Date.now()}`;
        img.style.opacity = '1';
      }
    }, 1500);
  }

  toggleCamMenu(camId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.activeCamMenuId() === camId) {
      this.activeCamMenuId.set(null);
    } else {
      this.activeCamMenuId.set(camId);
    }
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
        this.load();
      },
      error: (err) => {
        this.isSavingCam.set(false);
        const msg = err.error?.error?.message || err.error?.cam_id?.[0] || "Erreur d'enregistrement";
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
          this.load();
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

export const Cameras = CamerasPage;
