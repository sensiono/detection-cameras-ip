import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

import { Api } from '../core/api';
import { I18nService } from '../core/i18n';
import { ModalService } from '../core/modal';
import { Attendance as Row, AttendanceAudit, User } from '../core/models';
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
  selector: 'app-attendance',
  imports: [FormsModule],
  template: `
    <div class="page-head">
      <div>
        <div class="title-row">
          <h1>{{ i18n.t('att.title') }}</h1>
          <span class="live-pulse-badge">
            <span class="pulse-dot"></span>
            {{ i18n.t('common.live') }}
          </span>
        </div>
        <p class="muted">{{ i18n.t('att.subtitle') }}</p>
      </div>
      <div class="export-actions">
        <button class="secondary schedule-btn" (click)="openScheduleModal()" [title]="i18n.t('att.config_schedule')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>{{ i18n.t('att.config_schedule') }} : <strong>{{ lateAfter() }}</strong></span>
        </button>
        <button class="secondary" (click)="download('xlsx')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="8" x2="16" y1="13" y2="13"/><line x1="8" x2="16" y1="17" y2="17"/><line x1="10" x2="10" y1="9" y2="9"/></svg>
          {{ i18n.t('common.export_excel') }}
        </button>
        <button class="secondary" (click)="download('pdf')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          {{ i18n.t('common.export_pdf') }}
        </button>
      </div>
    </div>

    <!-- Quick View Mode Tabs -->
    <div class="view-tabs">
      <button
        type="button"
        class="tab-btn"
        [class.active]="viewMode() === 'all'"
        (click)="switchView('all')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
        {{ i18n.t('att.all_tab') }}
        <span class="tab-pill">{{ allRows().length }}</span>
      </button>

      <button
        type="button"
        class="tab-btn"
        [class.active]="viewMode() === 'today'"
        (click)="switchView('today')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        {{ i18n.t('att.today_tab') }} ({{ todayDate }})
        <span class="tab-pill" [class.highlight]="todayCount() > 0">{{ todayCount() }}</span>
      </button>

      <button
        type="button"
        class="tab-btn"
        [class.active]="viewMode() === 'history'"
        (click)="switchView('history')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>
        {{ i18n.t('att.history_tab') }}
        <span class="tab-pill">{{ historyCount() }}</span>
      </button>
    </div>

    <!-- Quick Date Preset Chips -->
    <div class="preset-chips-bar">
      <span class="preset-chip-label">{{ i18n.t('common.shortcuts') }}</span>
      <button type="button" class="preset-chip" [class.active]="preset() === 'today'" (click)="applyPreset('today')">{{ i18n.t('common.today') }}</button>
      <button type="button" class="preset-chip" [class.active]="preset() === 'month'" (click)="applyPreset('month')">{{ i18n.t('common.this_month') }}</button>
      <button type="button" class="preset-chip" [class.active]="preset() === 'year'" (click)="applyPreset('year')">{{ i18n.t('common.this_year') }}</button>
      <button type="button" class="preset-chip" [class.active]="preset() === 'all'" (click)="applyPreset('all')">{{ i18n.t('common.all') }}</button>
    </div>

    <!-- Filters Section -->
    <div class="filters">
      <!-- Search Input -->
      <label class="search-box">
        <span>{{ i18n.t('common.search') }}</span>
        <div class="search-input-wrapper">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event); currentPage.set(1)"
            [placeholder]="i18n.t('common.search_placeholder')"
          />
        </div>
      </label>

      @if (viewMode() === 'history' || viewMode() === 'all') {
        <label>
          <span>{{ i18n.t('common.year') }}</span>
          <select [ngModel]="selectedYear()" (ngModelChange)="selectedYear.set($event); selectedExactDate.set(''); currentPage.set(1)">
            <option value="">{{ i18n.t('common.all') }}</option>
            @for (y of availableYears(); track y) {
              <option [value]="y">{{ y }}</option>
            }
          </select>
        </label>
        <label>
          <span>{{ i18n.t('common.month') }}</span>
          <select [ngModel]="selectedMonth()" (ngModelChange)="selectedMonth.set($event); selectedExactDate.set(''); currentPage.set(1)">
            <option value="">{{ i18n.t('common.all') }}</option>
            <option value="01">01 - Jan</option>
            <option value="02">02 - Fév</option>
            <option value="03">03 - Mar</option>
            <option value="04">04 - Avr</option>
            <option value="05">05 - Mai</option>
            <option value="06">06 - Juin</option>
            <option value="07">07 - Juil</option>
            <option value="08">08 - Août</option>
            <option value="09">09 - Sept</option>
            <option value="10">10 - Oct</option>
            <option value="11">11 - Nov</option>
            <option value="12">12 - Déc</option>
          </select>
        </label>
        <label>
          <span>{{ i18n.t('common.day') }}</span>
          <input type="date" [ngModel]="selectedExactDate()" (ngModelChange)="selectedExactDate.set($event); selectedYear.set(''); selectedMonth.set(''); currentPage.set(1)" />
        </label>
      }

      <label>
        <span>{{ i18n.t('common.status') }}</span>
        <select [ngModel]="statut()" (ngModelChange)="statut.set($event); currentPage.set(1)">
          <option value="">{{ i18n.t('common.all_status') }}</option>
          <option value="present">{{ i18n.t('att.present') }}</option>
          <option value="late">{{ i18n.t('att.late') }}</option>
        </select>
      </label>

      <label>
        <span>{{ i18n.t('att.collaborator') }}</span>
        <select [ngModel]="user()" (ngModelChange)="user.set($event); currentPage.set(1)">
          <option value="">{{ i18n.t('att.all_members') }}</option>
          @for (m of members(); track m.id) {
            <option [value]="m.id">{{ m.nom }} {{ m.prenom }}</option>
          }
        </select>
      </label>

      <span class="spacer"></span>

      <!-- Active filter reset button with icon -->
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

    <!-- Table Container -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>{{ i18n.t('common.date') }}</th>
            <th>{{ i18n.t('att.collaborator') }}</th>
            <th>{{ i18n.t('att.check_in') }}</th>
            <th>{{ i18n.t('att.check_out') }}</th>
            <th>{{ i18n.t('att.audit_captures') }}</th>
            <th>{{ i18n.t('common.status') }}</th>
            <th>{{ i18n.t('common.camera') }}</th>
            <th>{{ i18n.t('common.capture') }}</th>
          </tr>
        </thead>
        <tbody>
          @for (r of paginatedRows(); track r.id) {
            <tr>
              <td><span class="font-mono date-cell">{{ r.date }}</span></td>
              <td>
                <div class="user-cell clickable-member" (click)="openMemberDrawer(r)" [title]="i18n.t('att.drawer_title')">
                  <div class="avatar-sm">{{ (r.user_name || 'U')[0].toUpperCase() }}</div>
                  <strong>{{ r.user_name }}</strong>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="drawer-arrow"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </td>
              <td>
                <span class="time-tag in">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  {{ formatTime(r.check_in) }}
                </span>
              </td>
              <td>
                @if (r.check_out) {
                  <span class="time-tag out">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                    {{ formatTime(r.check_out) }}
                  </span>
                } @else {
                  <span class="muted font-mono">—</span>
                }
              </td>
              <td>
                <button
                  type="button"
                  class="audit-badge-btn"
                  (click)="openMemberDrawer(r)"
                  [title]="i18n.t('att.timeline_title')"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                  <span>{{ (r.audits?.length || 1) }} {{ i18n.t('att.captures_count') }}</span>
                </button>
              </td>
              <td>
                <span class="pill" [class.warn]="r.statut === 'late'">
                  {{ r.statut === 'late' ? i18n.t('att.late') : i18n.t('att.present') }}
                </span>
              </td>

              <td><code class="cam-tag">{{ r.camera_id }}</code></td>
              <td>
                @if (r.snapshot) {
                  <img
                    [src]="r.snapshot"
                    class="snapshot-thumb"
                    alt="Capture pointage"
                    [title]="i18n.t('common.capture')"
                    (click)="previewSnapshot(r)"
                  />
                } @else {
                  <span class="muted text-xs">N/A</span>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="8" class="empty-cell">
                <div class="empty-box">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <h4>{{ i18n.t('common.no_results') }}</h4>
                  <p class="muted">{{ i18n.t('common.no_results_sub') }}</p>
                  <button type="button" class="secondary btn-sm" (click)="resetFilters()">
                    {{ i18n.t('common.clear_filters') }}
                  </button>
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
          {{ i18n.t('common.displaying') }} <strong>{{ paginatedRows().length }}</strong> {{ i18n.t('common.of') }} <strong>{{ totalRows() }}</strong> {{ i18n.t('common.records') }}
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
          (click)="setPage(currentPage() - 1)"
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
          (click)="setPage(currentPage() + 1)"
        >
          {{ i18n.t('common.next') }}
        </button>
      </div>
    </div>

    <!-- Member Profile & Detection Audit Trail Drawer -->
    @if (selectedMember(); as m) {
      <div class="drawer-backdrop" (click)="closeMemberDrawer()">
        <div class="drawer-panel" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <div>
              <h3>{{ i18n.t('att.drawer_title') }}</h3>
              <small class="muted">{{ i18n.t('att.drawer_subtitle') }}</small>
            </div>
            <button class="modal-close" (click)="closeMemberDrawer()" [title]="i18n.t('common.close')">✕</button>
          </div>

          <div class="drawer-body">
            <div class="member-hero">
              <div class="hero-avatar">{{ m.name[0].toUpperCase() }}</div>
              <div class="hero-meta">
                <h2>{{ m.name }}</h2>
                <span class="pill">{{ i18n.t('att.enrolled_member') }}</span>
              </div>
            </div>

            <!-- Stats Grid -->
            <div class="drawer-stats">
              <div class="stat-box">
                <span class="stat-num">{{ m.total }}</span>
                <span class="stat-lbl">{{ i18n.t('att.total_checkins') }}</span>
              </div>
              <div class="stat-box ok">
                <span class="stat-num">{{ m.onTime }}</span>
                <span class="stat-lbl">{{ i18n.t('att.on_time') }}</span>
              </div>
              <div class="stat-box warn">
                <span class="stat-num">{{ m.lates }}</span>
                <span class="stat-lbl">{{ i18n.t('att.lates') }}</span>
              </div>
              <div class="stat-box">
                <span class="stat-num">{{ m.punctuality }}%</span>
                <span class="stat-lbl">{{ i18n.t('att.punctuality') }}</span>
              </div>
            </div>

            <!-- Detection Passages Audit Trail Timeline -->
            <div class="member-audit-section">
              <div class="audit-header">
                <h4>{{ i18n.t('att.timeline_title') }}</h4>
                <span class="pill audit-count-pill">{{ m.audits.length }} {{ i18n.t('att.captures_count') }}</span>
              </div>


              @if (m.audits.length) {
                <div class="audit-timeline">
                  @for (a of m.audits; track a.id) {
                    <div class="audit-event-card">
                      <div class="audit-media" (click)="previewAuditSnapshot(a)">
                        @if (a.snapshot) {
                          <img [src]="a.snapshot" class="audit-thumb" alt="Preuve passage" [title]="i18n.t('common.capture')" />
                        } @else {
                          <div class="audit-no-img">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                          </div>
                        }
                      </div>

                      <div class="audit-info">
                        <div class="audit-top">
                          <span class="pill" [class.ok]="a.event_type === 'check_in'" [class.warn]="a.event_type === 'departure_update'">
                            {{ a.event_type === 'check_in' ? i18n.t('att.check_in') : i18n.t('att.departure_update') }}
                          </span>
                          <span class="font-mono audit-time">{{ formatTime(a.heure) }}</span>
                        </div>

                        <div class="audit-bottom">
                          <span class="cam-tag">{{ a.camera_id }}</span>
                          <span class="muted font-mono text-xs">{{ a.date }}</span>
                          <span class="conf-badge">{{ (a.confidence * 100).toFixed(0) }}%</span>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              } @else {
                <div class="empty-audit-box">
                  <p class="muted">{{ i18n.t('common.no_results') }}</p>
                </div>
              }
            </div>

            <!-- Daily Attendance History Summary -->
            <div class="member-history">
              <h4>{{ i18n.t('att.history_summary') }}</h4>
              <div class="history-list">
                @for (h of m.history; track h.id) {
                  <div class="history-item">
                    <div class="h-date">{{ h.date }}</div>
                    <div class="h-times">
                      <span class="time-tag in">{{ formatTime(h.check_in) }}</span>
                      @if (h.check_out) {
                        <span class="time-tag out">{{ formatTime(h.check_out) }}</span>
                      }
                    </div>
                    <span class="pill" [class.warn]="h.statut === 'late'">
                      {{ h.statut === 'late' ? i18n.t('att.late') : i18n.t('att.present') }}
                    </span>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Company Schedule Configuration Modal -->
    @if (showScheduleModal()) {
      <div class="modal-backdrop" (click)="showScheduleModal.set(false)">
        <div class="modal-dialog" style="max-width: 460px;" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <h3 class="modal-title">{{ i18n.t('att.config_schedule') }}</h3>
            </div>
            <button class="modal-close" (click)="showScheduleModal.set(false)" [title]="i18n.t('common.close')">✕</button>
          </div>

          <div class="modal-body">
            <p class="muted" style="margin: 0; font-size: 0.85rem; line-height: 1.4;">
              {{ i18n.t('att.late_threshold_desc') }}
            </p>

            <div class="input-group">
              <label for="lateInput" style="font-weight: 600; font-size: 0.85rem;">
                {{ i18n.t('att.late_threshold') }} (HH:MM)
              </label>
              <input
                id="lateInput"
                type="time"
                style="padding: 0.6rem 0.8rem; font-size: 1.15rem; font-weight: 700; text-align: center; border-radius: var(--radius-sm);"
                [ngModel]="editLateAfter()"
                (ngModelChange)="editLateAfter.set($event)"
              />
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.4rem;">
              <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--muted); letter-spacing: 0.05em;">
                Horaires d'arrivée usuels :
              </span>
              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                @for (preset of ['08:00', '08:15', '08:30', '08:45', '09:00', '09:30']; track preset) {
                  <button
                    type="button"
                    class="secondary btn-sm"
                    [style.border-color]="editLateAfter() === preset ? 'var(--brand)' : ''"
                    [style.background]="editLateAfter() === preset ? 'var(--brand-muted)' : ''"
                    [style.color]="editLateAfter() === preset ? 'var(--brand)' : ''"
                    (click)="editLateAfter.set(preset)"
                  >
                    {{ preset }}
                  </button>
                }
              </div>
            </div>
          </div>

          <div class="modal-footer" style="padding: 1rem 1.25rem; display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--surface-border); background: var(--surface);">
            <button type="button" class="secondary" (click)="showScheduleModal.set(false)">
              {{ i18n.t('common.cancel') }}
            </button>
            <button type="button" class="primary" (click)="saveSchedule()">
              {{ i18n.t('common.save') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .page-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 1.25rem;
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
    .export-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .schedule-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 600;
      border-color: var(--surface-border);
    }
    .schedule-btn strong {
      color: var(--brand);
      font-family: var(--font-mono);
      font-weight: 800;
    }
    .view-tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      flex-wrap: wrap;
    }
    .tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.55rem 0.95rem;
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
      font-weight: 700;
      background: var(--surface);
      border: 1px solid var(--surface-border);
      color: var(--fg-secondary);
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      transition: all 0.2s ease;
    }
    .tab-btn:hover {
      background: var(--surface-hover);
      color: var(--fg);
    }
    .tab-btn.active {
      background: var(--brand);
      color: #fff;
      border-color: var(--brand);
      box-shadow: 0 2px 8px var(--brand-glow);
    }
    .tab-pill {
      font-size: 0.72rem;
      padding: 0.1rem 0.45rem;
      border-radius: 9999px;
      background: rgba(0, 0, 0, 0.08);
      color: var(--fg-secondary);
      font-weight: 800;
    }
    .tab-btn.active .tab-pill {
      background: rgba(255, 255, 255, 0.25);
      color: #fff;
    }
    .tab-pill.highlight {
      background: var(--ok-bg);
      color: var(--ok);
    }
    .search-box {
      min-width: 170px;
    }
    .search-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }
    .search-input-wrapper svg {
      position: absolute;
      left: 10px;
      color: var(--muted);
      pointer-events: none;
    }
    .search-input-wrapper input {
      padding-left: 2rem;
      width: 100%;
    }
    .reset-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      margin-top: auto;
      position: relative;
    }
    .reset-btn.has-filters {
      border-color: var(--brand);
      color: var(--brand);
    }
    .active-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--brand);
    }
    .font-mono { font-family: var(--font-mono); font-size: 0.85rem; }
    .date-cell { font-weight: 600; color: var(--fg); }
    .user-cell {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .clickable-member {
      cursor: pointer;
      padding: 0.25rem 0.4rem;
      border-radius: var(--radius-sm);
      transition: background 0.15s ease;
    }
    .clickable-member:hover {
      background: var(--surface-hover);
    }
    .clickable-member:hover strong {
      color: var(--brand);
      text-decoration: underline;
    }
    .drawer-arrow {
      color: var(--muted);
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    .clickable-member:hover .drawer-arrow {
      opacity: 1;
    }
    .avatar-sm {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      color: #fff;
      font-weight: 700;
      font-size: 0.75rem;
      display: grid;
      place-items: center;
    }
    .time-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-family: var(--font-mono);
      font-size: 0.82rem;
      font-weight: 700;
    }
    .time-tag.in { background: var(--ok-bg); color: var(--ok); }
    .time-tag.out { background: var(--brand-glow); color: var(--brand); }
    .audit-badge-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.75rem;
      font-size: 0.78rem;
      font-weight: 700;
      border-radius: 9999px;
      background: var(--surface);
      border: 1px solid var(--surface-border);
      color: var(--fg-secondary);
      cursor: pointer;
      box-shadow: none;
      white-space: nowrap;
      flex-shrink: 0;
      min-width: max-content;
      transition: all 0.15s ease;
    }
    .audit-badge-btn:hover {
      border-color: var(--brand);
      color: var(--brand);
      background: var(--brand-glow);
    }

    .cam-tag {
      font-family: var(--font-mono);
      font-size: 0.78rem;
      color: var(--fg-secondary);
      background: var(--surface-hover);
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      border: 1px solid var(--surface-border);
    }
    .conf-badge {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--ok);
    }
    .empty-cell {
      text-align: center;
      padding: 2.5rem !important;
    }
    .empty-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      color: var(--muted);
    }
    .empty-box h4 {
      margin: 0;
      color: var(--fg);
      font-size: 1rem;
    }
    .pagination-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 1rem;
      flex-wrap: wrap;
      gap: 1rem;
      background: var(--surface-card);
      padding: 0.75rem 1.25rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--surface-border);
    }
    .pagination-info {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      font-size: 0.85rem;
    }
    .page-size-selector {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.82rem;
      color: var(--fg-secondary);
    }
    .page-size-selector select {
      padding: 0.25rem 0.5rem;
      font-size: 0.82rem;
    }
    .pagination-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .page-number-text {
      font-size: 0.85rem;
      color: var(--fg-secondary);
      font-family: var(--font-mono);
    }
    .btn-sm {
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
    }
    /* Member Flyout Drawer styles */
    .member-hero {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--surface-border);
    }
    .hero-avatar {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      color: #fff;
      font-size: 1.5rem;
      font-weight: 800;
      display: grid;
      place-items: center;
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
    }
    .hero-meta h2 {
      margin: 0 0 0.25rem 0;
      font-size: 1.25rem;
    }
    .drawer-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
    }
    .stat-box {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm);
      padding: 0.85rem;
      display: flex;
      flex-direction: column;
    }
    .stat-num {
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--fg);
    }
    .stat-lbl {
      font-size: 0.75rem;
      color: var(--fg-secondary);
      font-weight: 600;
    }
    .stat-box.ok .stat-num { color: var(--ok); }
    .stat-box.warn .stat-num { color: var(--warn); }

    /* Audit Trail Timeline */
    .member-audit-section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .audit-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
    }
    .audit-header h4 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 700;
    }
    .audit-count-pill {
      white-space: nowrap;
      flex-shrink: 0;
      min-width: max-content;
      padding: 0.25rem 0.75rem;
      font-size: 0.78rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      line-height: 1.2;
    }

    .audit-timeline {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    .audit-event-card {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.6rem 0.75rem;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm);
      transition: transform 0.15s ease;
    }
    .audit-event-card:hover {
      transform: translateX(2px);
      border-color: var(--brand);
    }
    .audit-media {
      width: 48px;
      height: 48px;
      border-radius: 6px;
      overflow: hidden;
      cursor: pointer;
      flex-shrink: 0;
      background: var(--surface-hover);
      border: 1px solid var(--surface-border);
    }
    .audit-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .audit-no-img {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      color: var(--muted);
    }
    .audit-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .audit-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .audit-time {
      font-weight: 700;
      color: var(--fg);
      font-size: 0.85rem;
    }
    .audit-bottom {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .member-history h4 {
      margin: 0 0 0.75rem 0;
      font-size: 0.95rem;
    }
    .history-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .history-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem 0.85rem;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
    }
    .h-date {
      font-family: var(--font-mono);
      font-weight: 600;
    }
    .h-times {
      display: flex;
      gap: 0.35rem;
    }
    .text-xs { font-size: 0.75rem; }
  `,
})
export class AttendancePage implements OnInit, OnDestroy {
  private api = inject(Api);
  private modal = inject(ModalService);
  private stream = inject(StreamService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  i18n = inject(I18nService);

  private sub: Subscription | null = null;

  readonly allRows = signal<Row[]>([]);
  readonly members = signal<User[]>([]);
  readonly todayDate = getLocalToday();

  readonly viewMode = signal<'all' | 'today' | 'history'>('all');
  readonly preset = signal<'today' | 'month' | 'year' | 'all'>('all');
  readonly searchQuery = signal('');
  readonly selectedYear = signal('');
  readonly selectedMonth = signal('');
  readonly selectedExactDate = signal('');
  readonly statut = signal('');
  readonly user = signal('');

  readonly pageSize = signal(10);
  readonly currentPage = signal(1);

  readonly lateAfter = signal('08:30');
  readonly showScheduleModal = signal(false);
  readonly editLateAfter = signal('08:30');


  readonly selectedMember = signal<{
    name: string;
    total: number;
    onTime: number;
    lates: number;
    punctuality: number;
    history: Row[];
    audits: AttendanceAudit[];
  } | null>(null);

  readonly availableYears = computed(() => {
    const years = new Set<string>();
    this.allRows().forEach((r) => {
      if (r.date) years.add(r.date.split('-')[0]);
    });
    years.add(new Date().getFullYear().toString());
    return Array.from(years).sort().reverse();
  });

  readonly filteredRows = computed(() => {
    let list = this.allRows();

    const vm = this.viewMode();
    const exact = this.selectedExactDate();
    const yr = this.selectedYear();
    const mo = this.selectedMonth();
    const st = this.statut();
    const usr = this.user();
    const q = this.searchQuery().toLowerCase().trim();

    if (vm === 'today') {
      list = list.filter((r) => r.date === this.todayDate);
    } else if (vm === 'history') {
      list = list.filter((r) => r.date !== this.todayDate);
      if (exact) {
        list = list.filter((r) => r.date === exact);
      } else {
        if (yr) {
          list = list.filter((r) => r.date && r.date.startsWith(yr));
        }
        if (mo) {
          list = list.filter((r) => {
            const parts = r.date ? r.date.split('-') : [];
            return parts.length >= 2 && parts[1] === mo;
          });
        }
      }
    } else {
      if (exact) {
        list = list.filter((r) => r.date === exact);
      } else {
        if (yr) {
          list = list.filter((r) => r.date && r.date.startsWith(yr));
        }
        if (mo) {
          list = list.filter((r) => {
            const parts = r.date ? r.date.split('-') : [];
            return parts.length >= 2 && parts[1] === mo;
          });
        }
      }
    }

    if (st) {
      list = list.filter((r) => r.statut === st);
    }

    if (usr) {
      list = list.filter((r) => r.user === Number(usr) || String(r.user_name).includes(usr));
    }

    if (q) {
      list = list.filter((r) =>
        (r.user_name && r.user_name.toLowerCase().includes(q)) ||
        (r.camera_id && r.camera_id.toLowerCase().includes(q)) ||
        (r.date && r.date.includes(q)) ||
        (r.statut && r.statut.toLowerCase().includes(q))
      );
    }

    return list;
  });

  readonly todayCount = computed(() => {
    return this.allRows().filter((r) => r.date === this.todayDate).length;
  });

  readonly historyCount = computed(() => {
    return this.allRows().filter((r) => r.date !== this.todayDate).length;
  });

  readonly totalRows = computed(() => this.filteredRows().length);

  readonly totalPages = computed(() => {
    return Math.ceil(this.totalRows() / this.pageSize()) || 1;
  });

  readonly paginatedRows = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredRows().slice(start, start + this.pageSize());
  });

  constructor() {
    this.load();
  }

  ngOnInit(): void {
    this.api.members().subscribe((page) => this.members.set(page.results));

    this.api.getSettings().subscribe({
      next: (s) => {
        if (s?.late_after) {
          this.lateAfter.set(s.late_after);
          this.editLateAfter.set(s.late_after);
        }
      },
      error: () => {},
    });

    this.route.queryParams.subscribe((params) => {
      if (params['statut']) this.statut.set(params['statut']);
      if (params['period'] === 'today') {
        this.viewMode.set('today');
      } else if (params['period'] === 'history') {
        this.viewMode.set('history');
      }
    });

    this.sub = this.stream.updates$.subscribe(() => {
      this.load();
    });
  }

  openScheduleModal(): void {
    this.editLateAfter.set(this.lateAfter());
    this.showScheduleModal.set(true);
  }

  saveSchedule(): void {
    const val = this.editLateAfter().trim();
    if (!val) return;
    this.api.updateSettings({ late_after: val }).subscribe({
      next: (res) => {
        this.lateAfter.set(res.late_after);
        this.showScheduleModal.set(false);
        this.toast.success(this.i18n.t('att.schedule_saved'));
        this.load();
      },
      error: (err) => {
        const msg = err?.error?.detail || "Erreur lors de l'enregistrement de l'horaire.";
        this.toast.error(msg);
      },
    });
  }


  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  load(): void {
    this.api.attendance().subscribe((page) => {
      this.allRows.set(page.results);
    });
  }

  switchView(mode: 'all' | 'today' | 'history'): void {
    this.viewMode.set(mode);
    this.preset.set(mode === 'today' ? 'today' : 'all');
    this.selectedYear.set('');
    this.selectedMonth.set('');
    this.selectedExactDate.set('');
    this.currentPage.set(1);
  }

  applyPreset(preset: 'today' | 'month' | 'year' | 'all'): void {
    this.preset.set(preset);
    this.selectedExactDate.set('');
    this.selectedYear.set('');
    this.selectedMonth.set('');

    const d = new Date();
    if (preset === 'today') {
      this.viewMode.set('today');
    } else if (preset === 'month') {
      this.viewMode.set('all');
      this.selectedMonth.set(String(d.getMonth() + 1).padStart(2, '0'));
      this.selectedYear.set(String(d.getFullYear()));
    } else if (preset === 'year') {
      this.viewMode.set('all');
      this.selectedYear.set(String(d.getFullYear()));
    } else {
      this.viewMode.set('all');
    }
    this.currentPage.set(1);
  }

  hasActiveFilters(): boolean {
    return !!(
      this.searchQuery() ||
      this.selectedYear() ||
      this.selectedMonth() ||
      this.selectedExactDate() ||
      this.statut() ||
      this.user()
    );
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.selectedYear.set('');
    this.selectedMonth.set('');
    this.selectedExactDate.set('');
    this.statut.set('');
    this.user.set('');
    this.preset.set('all');
    this.viewMode.set('all');
    this.currentPage.set(1);
    this.toast.info(this.i18n.t('common.clear_filters'));
  }

  openMemberDrawer(r: Row): void {
    const memberRows = this.allRows().filter(
      (item) => item.user_name === r.user_name || (r.user && item.user === r.user)
    );
    const total = memberRows.length;
    const lates = memberRows.filter((item) => item.statut === 'late').length;
    const onTime = total - lates;
    const punctuality = total > 0 ? Math.round((onTime / total) * 100) : 100;

    const audits: AttendanceAudit[] = [];
    memberRows.forEach((row) => {
      if (row.audits && row.audits.length > 0) {
        audits.push(...row.audits);
      }
    });

    this.selectedMember.set({
      name: r.user_name || 'Collaborateur',
      total,
      onTime,
      lates,
      punctuality,
      history: memberRows,
      audits,
    });

    if (r.user) {
      this.api.attendanceAudits({ user: String(r.user) }).subscribe({
        next: (page) => {
          if (page.results && page.results.length > 0) {
            this.selectedMember.update((m) => (m ? { ...m, audits: page.results } : null));
          }
        },
      });
    }
  }

  closeMemberDrawer(): void {
    this.selectedMember.set(null);
  }

  previewSnapshot(r: Row): void {
    if (r.snapshot) {
      this.modal.open({
        imageSrc: r.snapshot,
        title: `${this.i18n.t('att.check_in')} : ${r.user_name}`,
        subtitle: `${r.date} à ${this.formatTime(r.check_in)} · ${r.camera_id} (${(r.confidence * 100).toFixed(0)}% ${this.i18n.t('common.score')})`,
      });
    }
  }

  previewAuditSnapshot(a: AttendanceAudit): void {
    if (a.snapshot) {
      this.modal.open({
        imageSrc: a.snapshot,
        title: `${this.i18n.t('att.audit_captures')} : ${a.user_name || 'Collaborateur'}`,
        subtitle: `${a.date} à ${this.formatTime(a.heure)} · ${a.camera_id} (${a.event_type === 'check_in' ? this.i18n.t('att.check_in') : this.i18n.t('att.departure_update')})`,
      });
    }
  }

  formatTime(t: string | null | undefined): string {
    return t ? t.split('.')[0] : '—';
  }

  download(fmt: 'xlsx' | 'pdf'): void {
    this.toast.info(
      `Export ${fmt.toUpperCase()}`,
      'Génération du rapport...'
    );
    const filters: Record<string, string | undefined> = {};
    if (this.viewMode() === 'today') {
      filters['from'] = this.todayDate;
      filters['to'] = this.todayDate;
    } else if (this.selectedExactDate()) {
      filters['from'] = this.selectedExactDate();
      filters['to'] = this.selectedExactDate();
    }
    this.api.downloadReport(fmt, filters);
  }
}

export const Attendance = AttendancePage;

