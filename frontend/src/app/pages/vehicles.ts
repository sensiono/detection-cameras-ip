import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { ConfirmService } from '../core/confirm';
import { I18nService } from '../core/i18n';
import { User, Vehicle } from '../core/models';
import { ToastService } from '../core/toast';


const EMPTY: Vehicle = { plaque: '', proprietaire: '', type: 'car', autorise: true, user: null };

@Component({
  selector: 'app-vehicles',
  imports: [FormsModule],
  template: `
    <div class="page-head">
      <div>
        <h1>{{ i18n.t('veh.title') }}</h1>
        <p class="muted">{{ i18n.t('veh.subtitle') }}</p>
      </div>

      @if (auth.canEdit) {
        <button type="button" class="btn-add" (click)="openAddModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>{{ i18n.t('veh.add') }}</span>
        </button>
      }
    </div>

    <!-- Status Tabs -->
    <div class="tab-pills-row">
      <button
        type="button"
        class="tab-pill"
        [class.active]="selectedTab() === 'all'"
        (click)="selectedTab.set('all'); currentPage.set(1)"
      >
        <span>Tous les véhicules</span>
        <span class="count-badge">{{ rows().length }}</span>
      </button>

      <button
        type="button"
        class="tab-pill"
        [class.active]="selectedTab() === 'autorise'"
        (click)="selectedTab.set('autorise'); currentPage.set(1)"
      >
        <span>{{ i18n.t('logs.authorized') }}</span>
        <span class="count-badge ok">{{ countAuthorized() }}</span>
      </button>

      <button
        type="button"
        class="tab-pill"
        [class.active]="selectedTab() === 'refuse'"
        (click)="selectedTab.set('refuse'); currentPage.set(1)"
      >
        <span>{{ i18n.t('logs.refused') }}</span>
        <span class="count-badge bad">{{ countRefused() }}</span>
      </button>
    </div>

    <!-- Filters Section -->
    <div class="filters">
      <!-- Search Input -->
      <label class="search-box">
        <span>{{ i18n.t('common.quick_search') }}</span>
        <div class="search-input-wrapper">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event); currentPage.set(1)"
            placeholder="Plaque, propriétaire..."
          />
        </div>
      </label>

      <label>
        <span>{{ i18n.t('veh.type') }}</span>
        <select [ngModel]="selectedType()" (ngModelChange)="selectedType.set($event); currentPage.set(1)">
          <option value="all">Tous les types</option>
          <option value="car">{{ i18n.t('veh.car') }}</option>
          <option value="bus">{{ i18n.t('veh.bus') }}</option>
          <option value="other">{{ i18n.t('veh.other') }}</option>
        </select>
      </label>

      <span class="spacer"></span>

      <!-- Active filter reset button with icon on the right side -->
      <button
        type="button"
        class="secondary reset-btn"
        (click)="resetFilters()"
        [title]="i18n.t('common.clear_filters')"
        [class.has-filters]="hasActiveFilters()"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        <span>{{ i18n.t('common.reset') }}</span>
        @if (hasActiveFilters()) {
          <span class="active-dot"></span>
        }
      </button>
    </div>


    <!-- Vehicles Table -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>{{ i18n.t('logs.plate') }}</th>
            <th>{{ i18n.t('veh.owner') }}</th>
            <th>{{ i18n.t('veh.type') }}</th>
            <th>{{ i18n.t('veh.access') }}</th>
            @if (auth.canEdit) { <th>{{ i18n.t('common.actions') }}</th> }
          </tr>
        </thead>
        <tbody>
          @for (v of paginatedRows(); track v.id) {
            <tr>
              <td>
                <span class="tn-plate">{{ v.plaque }}</span>
              </td>
              <td>
                <div class="owner-cell">
                  <div class="owner-avatar">{{ (v.proprietaire || '?')[0].toUpperCase() }}</div>
                  <div class="owner-text">
                    <strong>{{ v.proprietaire || 'Visiteur non renseigné' }}</strong>
                    @if (v.user) {
                      <span class="collaborator-badge">Collaborateur</span>
                    }
                  </div>
                </div>
              </td>
              <td>
                <span class="type-tag">{{ v.type === 'car' ? i18n.t('veh.car') : (v.type === 'bus' ? i18n.t('veh.bus') : i18n.t('veh.other')) }}</span>
              </td>
              <td>
                <span class="pill" [class.bad]="!v.autorise" [class.ok]="v.autorise">
                  {{ v.autorise ? i18n.t('logs.authorized') : i18n.t('logs.refused') }}
                </span>
              </td>
              @if (auth.canEdit) {
                <td>
                  <div class="action-btns">
                    <button class="icon-btn edit-btn" (click)="edit(v)" title="Modifier">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <button class="icon-btn del-btn" (click)="remove(v)" title="Supprimer">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </div>
                </td>
              }
            </tr>
          } @empty {
            <tr>
              <td colspan="5" class="empty-cell">
                <div class="empty-box">
                  <h4>{{ i18n.t('common.no_results') }}</h4>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <!-- Pagination Controls -->
    <div class="pagination-bar">
      <div class="pagination-info">
        <span class="muted">
          {{ i18n.t('common.displaying') }} <strong>{{ paginatedRows().length }}</strong> {{ i18n.t('common.of') }} <strong>{{ filteredRows().length }}</strong> {{ i18n.t('common.records') }}
        </span>
        <label class="page-size-selector">
          <span>{{ i18n.t('common.rows_per_page') }}</span>
          <select [ngModel]="pageSize()" (ngModelChange)="pageSize.set($event); currentPage.set(1)">
            <option [ngValue]="10">10</option>
            <option [ngValue]="25">25</option>
            <option [ngValue]="50">50</option>
          </select>
        </label>
      </div>

      <div class="pagination-actions">
        <button
          type="button"
          class="secondary btn-sm"
          [disabled]="currentPage() <= 1"
          (click)="currentPage.set(currentPage() - 1)"
        >
          {{ i18n.t('common.previous') }}
        </button>
        
        <span class="page-number-text">
          {{ i18n.t('common.page') }} <strong>{{ currentPage() }}</strong> / {{ totalPages() || 1 }}
        </span>

        <button
          type="button"
          class="secondary btn-sm"
          [disabled]="currentPage() >= totalPages()"
          (click)="currentPage.set(currentPage() + 1)"
        >
          {{ i18n.t('common.next') }}
        </button>
      </div>
    </div>

    <!-- Add / Edit Vehicle Modal Dialog -->
    @if (isModalOpen()) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="modal-dialog vehicle-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="modal-title">
              {{ draft.id ? "Modifier l'autorisation du véhicule" : i18n.t('veh.add') }}
            </h3>
            <button class="modal-close" (click)="closeModal()" [title]="i18n.t('common.close')">✕</button>
          </div>

          <form (ngSubmit)="save()">
            <div class="modal-body">
              <div class="input-group">
                <label>{{ i18n.t('logs.plate') }} *</label>
                <input
                  name="plaque"
                  [(ngModel)]="draft.plaque"
                  placeholder="Ex: 159TN8950 ou RS 1234"
                  class="font-mono text-base"
                  required
                />
              </div>

              @if (draft.plaque) {
                <div class="plate-preview-box">
                  <span class="preview-lbl">Aperçu badge :</span>
                  <span class="tn-plate">{{ draft.plaque }}</span>
                </div>
              }

              <!-- Combobox: Free-Text Typing + Real-time Interactive Filter Dropdown -->
              <div class="input-group">
                <label>{{ i18n.t('veh.owner') }}</label>
                
                <div class="combobox-wrap">
                  <div class="input-with-arrow">
                    <input
                      type="text"
                      name="proprietaire"
                      [ngModel]="ownerQuery()"
                      (ngModelChange)="onOwnerChange($event)"
                      (focus)="isDropdownOpen.set(true)"
                      placeholder="Nom du collaborateur ou visiteur"
                      autocomplete="off"
                    />

                    <button
                      type="button"
                      class="combo-arrow-btn"
                      (click)="toggleDropdown($event)"
                      tabindex="-1"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                  </div>

                  @if (isDropdownOpen()) {
                    <div class="combobox-menu">
                      <div class="combobox-header">Collaborateurs enregistrés</div>
                      @for (u of filteredSuggestedUsers(); track u.id) {
                        <div class="combobox-item" (click)="selectUser(u)">
                          <div class="combo-avatar">{{ (u.prenom || u.nom || u.username)[0].toUpperCase() }}</div>
                          <div class="combo-info">
                            <div class="combo-name">{{ u.prenom }} {{ u.nom }}</div>
                            <div class="combo-sub">{{ u.username }} • {{ u.role === 'admin' ? 'Administrateur' : (u.role === 'supervisor' ? 'Superviseur' : 'Collaborateur') }}</div>
                          </div>
                        </div>
                      } @empty {
                        <div class="combobox-empty">
                          <span>Aucun collaborateur trouvé</span>
                          <small class="muted">La saisie sera enregistrée pour un visiteur externe</small>
                        </div>
                      }
                    </div>
                  }
                </div>

                <small class="field-hint">
                  Sélectionnez un collaborateur dans la liste déroulante ou saisissez librement le nom d'un visiteur externe.
                </small>
              </div>

              <div class="input-group">
                <label>{{ i18n.t('veh.type') }}</label>
                <select name="type" [(ngModel)]="draft.type">
                  <option value="car">{{ i18n.t('veh.car') }}</option>
                  <option value="bus">{{ i18n.t('veh.bus') }}</option>
                  <option value="other">{{ i18n.t('veh.other') }}</option>
                </select>
              </div>

              <div class="input-group check-group">
                <label class="toggle-switch">
                  <input type="checkbox" name="autorise" [(ngModel)]="draft.autorise" />
                  <span class="slider"></span>
                  <span class="toggle-label">{{ draft.autorise ? i18n.t('logs.authorized') : i18n.t('logs.refused') }}</span>
                </label>
              </div>

              @if (error()) {
                <p class="error" role="alert">{{ error() }}</p>
              }
            </div>

            <div class="modal-actions-bar">
              <button type="button" class="secondary" (click)="closeModal()">{{ i18n.t('common.cancel') }}</button>
              <button type="submit" class="btn-save">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                <span>{{ i18n.t('common.save') }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: `
    .btn-add {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.1rem;
      background: var(--brand);
      color: #fff;
      font-weight: 700;
      border-radius: var(--radius-sm);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
      transition: all 0.15s ease;
    }
    .btn-add:hover {
      background: var(--brand-hover);
      transform: translateY(-1px);
    }

    /* Tab Pills Row */
    .tab-pills-row {
      display: flex;
      gap: 0.6rem;
      margin-bottom: 1rem;
      overflow-x: auto;
      padding-bottom: 0.25rem;
    }
    .tab-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.55rem 1rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 600;
      border: 1px solid var(--surface-border);
      background: var(--surface);
      color: var(--fg-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
      box-shadow: var(--shadow-sm);
    }
    .tab-pill:hover {
      background: var(--surface-hover);
      color: var(--fg);
    }
    .tab-pill.active {
      background: var(--brand);
      color: #fff;
      border-color: var(--brand);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
    }
    .count-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      background: rgba(0, 0, 0, 0.12);
    }
    .tab-pill.active .count-badge {
      background: rgba(255, 255, 255, 0.25);
      color: #fff;
    }
    .count-badge.ok { background: var(--ok-bg); color: var(--ok); }
    .count-badge.bad { background: var(--bad-bg); color: var(--bad); }

    /* Filters Bar */
    .filter-card {
      margin-bottom: 1.25rem;
      padding: 1rem 1.25rem;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
    }
    .filter-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: flex-end;
    }
    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .filter-group label {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--fg-secondary);
    }
    .filter-group select {
      min-width: 160px;
      padding: 0.5rem 0.75rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--surface-border);
      background: var(--surface);
      color: var(--fg);
    }
    .search-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
      min-width: 240px;
    }
    .search-icon {
      position: absolute;
      left: 10px;
      color: var(--muted);
      pointer-events: none;
    }
    .search-input-wrap input {
      width: 100%;
      padding-left: 2rem;
      padding-right: 2rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--surface-border);
      background: var(--surface);
      color: var(--fg);
      height: 38px;
    }
    .clear-btn {
      position: absolute;
      right: 8px;
      background: transparent;
      border: none;
      color: var(--muted);
      cursor: pointer;
      padding: 2px 6px;
      font-size: 0.8rem;
    }
    .reset-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      height: 38px;
      padding: 0 0.9rem;
      font-size: 0.82rem;
      font-weight: 600;
      border-radius: var(--radius-sm);
    }

    /* Owner Cell */
    .owner-cell {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }
    .owner-text {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .collaborator-badge {
      font-size: 0.7rem;
      color: var(--brand);
      font-weight: 700;
    }
    .owner-avatar {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, #6366f1, #3b82f6);
      color: #fff;
      font-weight: 700;
      font-size: 0.85rem;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    /* Tunisian Plate Authentic Badge */
    .tn-plate {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.28rem 0.75rem;
      background: #0f172a;
      color: #ffffff !important;
      border: 1.5px solid #334155;
      border-radius: 6px;
      font-family: var(--font-mono);
      font-weight: 800;
      font-size: 0.92rem;
      letter-spacing: 0.08em;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      white-space: nowrap;
    }

    .type-tag {
      font-size: 0.8rem;
      color: var(--fg-secondary);
      background: var(--surface-hover);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-weight: 600;
    }
    .action-btns {
      display: flex;
      gap: 0.4rem;
    }
    .icon-btn {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      display: grid;
      place-items: center;
      cursor: pointer;
      border: 1px solid var(--surface-border);
      background: var(--surface);
      color: var(--fg-secondary);
      padding: 0;
      transition: all 0.15s ease;
    }
    .edit-btn:hover {
      background: var(--brand-glow);
      color: var(--brand);
      border-color: var(--brand);
    }
    .del-btn:hover {
      background: var(--bad-bg);
      color: var(--bad);
      border-color: var(--bad-border);
    }

    /* Modal Form Styles */
    .vehicle-modal {
      max-width: 520px;
    }
    .plate-preview-box {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 0.85rem;
      background: var(--surface-hover);
      border-radius: var(--radius-sm);
      border: 1px dashed var(--surface-border);
    }
    .preview-lbl {
      font-size: 0.8rem;
      color: var(--fg-secondary);
      font-weight: 600;
    }

    /* Combobox Styles */
    .combobox-wrap {
      position: relative;
      width: 100%;
    }
    .input-with-arrow {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }
    .input-with-arrow input {
      width: 100%;
      padding-right: 2.2rem;
    }
    .combo-arrow-btn {
      position: absolute;
      right: 8px;
      background: transparent;
      border: none;
      color: var(--muted);
      cursor: pointer;
      padding: 4px;
      display: grid;
      place-items: center;
      box-shadow: none;
    }
    .combo-arrow-btn:hover {
      color: var(--fg);
      background: transparent;
      transform: none;
    }
    .combobox-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      max-height: 220px;
      overflow-y: auto;
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-lg);
      z-index: 100;
    }
    .combobox-header {
      padding: 0.4rem 0.75rem;
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--surface-border);
      background: var(--surface-hover);
    }
    .combobox-item {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.5rem 0.75rem;
      cursor: pointer;
      transition: background 0.15s ease;
      border-bottom: 1px solid var(--surface-border);
    }
    .combobox-item:last-child {
      border-bottom: none;
    }
    .combobox-item:hover {
      background: var(--surface-hover);
    }
    .combo-avatar {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      color: #fff;
      font-weight: 700;
      font-size: 0.78rem;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .combo-info {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }
    .combo-name {
      font-size: 0.84rem;
      font-weight: 600;
      color: var(--fg);
    }
    .combo-sub {
      font-size: 0.72rem;
      color: var(--fg-secondary);
    }
    .combobox-empty {
      padding: 0.85rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      font-size: 0.8rem;
      color: var(--fg-secondary);
    }

    .field-hint {
      font-size: 0.76rem;
      color: var(--fg-secondary);
      margin-top: 0.25rem;
      line-height: 1.35;
    }
    .toggle-switch {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
    }
    .toggle-switch input { display: none; }
    .slider {
      width: 44px;
      height: 24px;
      background: var(--surface-border);
      border-radius: 9999px;
      position: relative;
      transition: background 0.2s ease;
    }
    .slider::after {
      content: '';
      position: absolute;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #fff;
      top: 3px;
      left: 3px;
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: var(--shadow-sm);
    }
    .toggle-switch input:checked + .slider { background: var(--ok); }
    .toggle-switch input:checked + .slider::after { transform: translateX(20px); }
    .toggle-label {
      font-size: 0.85rem;
      font-weight: 700;
    }
    .modal-actions-bar {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      border-top: 1px solid var(--surface-border);
      background: var(--surface-hover);
    }
    .btn-save {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.55rem 1.2rem;
      background: var(--brand);
      color: #fff;
      font-weight: 700;
      border-radius: var(--radius-sm);
      border: none;
      cursor: pointer;
    }

    /* Pagination */
    .pagination-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      padding: 1rem 0.25rem;
    }
    .pagination-info {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      font-size: 0.85rem;
    }
    .page-size-selector select {
      margin-left: 0.4rem;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      border: 1px solid var(--surface-border);
      background: var(--surface);
      color: var(--fg);
    }
    .pagination-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .page-number-text {
      font-size: 0.85rem;
    }
    .btn-sm {
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
    }
    .empty-cell {
      text-align: center;
      padding: 3rem !important;
    }
    .empty-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      color: var(--muted);
    }
  `,
})
export class VehiclesPage implements OnInit {
  private api = inject(Api);
  private toast = inject(ToastService);
  private confirmService = inject(ConfirmService);
  auth = inject(Auth);
  i18n = inject(I18nService);


  readonly rows = signal<Vehicle[]>([]);
  readonly users = signal<User[]>([]);
  readonly error = signal<string | null>(null);
  readonly isModalOpen = signal<boolean>(false);
  readonly isDropdownOpen = signal<boolean>(false);

  // Filters and Pagination
  readonly searchQuery = signal<string>('');
  readonly selectedTab = signal<'all' | 'autorise' | 'refuse'>('all');
  readonly selectedType = signal<string>('all');
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);

  draft: Vehicle = { ...EMPTY };

  readonly ownerQuery = signal<string>('');

  readonly countAuthorized = computed(() => this.rows().filter((v) => v.autorise).length);
  readonly countRefused = computed(() => this.rows().filter((v) => !v.autorise).length);

  readonly filteredSuggestedUsers = computed(() => {
    const q = this.ownerQuery().trim().toLowerCase();
    const list = this.users();
    if (!q) return list;
    return list.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.nom && u.nom.toLowerCase().includes(q)) ||
        (u.prenom && u.prenom.toLowerCase().includes(q)) ||
        `${u.prenom || ''} ${u.nom || ''}`.toLowerCase().includes(q)
    );
  });

  readonly filteredRows = computed(() => {
    let list = this.rows();
    const tab = this.selectedTab();
    if (tab === 'autorise') list = list.filter((v) => v.autorise);
    else if (tab === 'refuse') list = list.filter((v) => !v.autorise);

    const type = this.selectedType();
    if (type !== 'all') list = list.filter((v) => v.type === type);

    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(
        (v) =>
          v.plaque.toLowerCase().includes(q) ||
          (v.proprietaire && v.proprietaire.toLowerCase().includes(q))
      );
    }
    return list;
  });

  readonly totalPages = computed(() => Math.ceil(this.filteredRows().length / this.pageSize()) || 1);

  readonly paginatedRows = computed(() => {
    const list = this.filteredRows();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  ngOnInit(): void {
    this.load();
    this.loadUsers();
  }

  load(): void {
    this.api.vehicles().subscribe({
      next: (page) => this.rows.set(page.results),
      error: () => this.toast.bad('Erreur de chargement des véhicules'),
    });
  }

  loadUsers(): void {
    this.api.users().subscribe({
      next: (page) => this.users.set(page.results),
      error: () => {},
    });
  }

  toggleDropdown(event: Event): void {
    event.stopPropagation();
    this.isDropdownOpen.set(!this.isDropdownOpen());
  }

  selectUser(u: User): void {
    const fullName = `${u.prenom || ''} ${u.nom || ''}`.trim() || u.username;
    this.draft.proprietaire = fullName;
    this.ownerQuery.set(fullName);
    this.draft.user = u.id;
    this.isDropdownOpen.set(false);
  }

  onOwnerChange(val: string): void {
    this.ownerQuery.set(val);
    this.draft.proprietaire = val;
    this.isDropdownOpen.set(true);

    const query = val.trim().toLowerCase();
    if (!query) {
      this.draft.user = null;
      return;
    }
    const matchedUser = this.users().find((u) => {
      const fullName = `${u.prenom || ''} ${u.nom || ''}`.trim().toLowerCase();
      return fullName === query || u.username.toLowerCase() === query;
    });
    this.draft.user = matchedUser ? matchedUser.id : null;
  }

  openAddModal(): void {
    this.draft = { ...EMPTY };
    this.ownerQuery.set('');
    this.error.set(null);
    this.isDropdownOpen.set(false);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.isDropdownOpen.set(false);
    this.draft = { ...EMPTY };
    this.ownerQuery.set('');
    this.error.set(null);
  }

  edit(v: Vehicle): void {
    this.draft = { ...v };
    this.ownerQuery.set(v.proprietaire || '');
    this.error.set(null);
    this.isDropdownOpen.set(false);
    this.isModalOpen.set(true);
  }


  hasActiveFilters(): boolean {
    return Boolean(
      this.searchQuery() ||
      this.selectedType() !== 'all' ||
      this.selectedTab() !== 'all'
    );
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.selectedTab.set('all');
    this.selectedType.set('all');
    this.currentPage.set(1);
    this.toast.info(this.i18n.t('common.clear_filters'));
  }


  save(): void {
    this.error.set(null);
    this.api.saveVehicle(this.draft).subscribe({
      next: () => {
        this.toast.ok('Succès', 'Véhicule enregistré');
        this.closeModal();
        this.load();
      },
      error: (err) => {
        const msg = err.error?.error?.message || 'Erreur lors de la sauvegarde';
        this.error.set(msg);
        this.toast.bad('Erreur', msg);
      },
    });
  }

  async remove(v: Vehicle): Promise<void> {
    if (!v.id) return;
    const ok = await this.confirmService.confirm({
      title: 'Supprimer le véhicule',
      message: `Êtes-vous sûr de vouloir supprimer définitivement le véhicule ${v.plaque} de la liste ?`,
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true,
    });
    if (ok) {
      this.api.deleteVehicle(v.id).subscribe({
        next: () => {
          this.toast.info('Supprimé', `Véhicule ${v.plaque} retiré`);
          this.load();
        },
        error: () => this.toast.bad('Erreur de suppression'),
      });
    }
  }

}

export const Vehicles = VehiclesPage;
