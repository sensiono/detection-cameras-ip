import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

import { Api } from '../core/api';
import { I18nService } from '../core/i18n';
import { ModalService } from '../core/modal';
import { AccessLog, Vehicle } from '../core/models';
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
  selector: 'app-logs',
  imports: [FormsModule],
  template: `
    <div class="page-head">
      <div>
        <div class="title-row">
          <h1>{{ i18n.t('logs.title') }}</h1>
          <span class="live-pulse-badge">
            <span class="pulse-dot"></span>
            {{ i18n.t('common.live') }}
          </span>
        </div>
        <p class="muted">{{ i18n.t('logs.subtitle') }}</p>
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
          <option value="autorise">{{ i18n.t('logs.authorized') }}</option>
          <option value="refuse">{{ i18n.t('logs.refused') }}</option>
        </select>
      </label>

      <span class="spacer"></span>

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
            <th>{{ i18n.t('common.time') }}</th>
            <th>{{ i18n.t('logs.plate') }}</th>
            <th>{{ i18n.t('common.status') }}</th>
            <th>{{ i18n.t('common.camera') }}</th>
            <th>{{ i18n.t('common.score') }}</th>
            <th>{{ i18n.t('common.capture') }}</th>
            <th>{{ i18n.t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          @for (r of paginatedRows(); track r.id) {
            <tr>
              <td><span class="font-mono date-cell">{{ r.date }}</span></td>
              <td><span class="font-mono">{{ formatTime(r.heure) }}</span></td>
              <td>
                <span class="plate-cell font-mono">{{ r.plaque }}</span>
              </td>
              <td>
                <span class="pill" [class.ok]="r.statut === 'autorise'" [class.bad]="r.statut === 'refuse'">
                  {{ r.statut === 'autorise' ? i18n.t('logs.authorized') : i18n.t('logs.refused') }}
                </span>
              </td>
              <td><code class="cam-tag">{{ r.camera_id }}</code></td>
              <td>
                <span class="conf-badge">{{ (r.confidence * 100).toFixed(0) }}%</span>
              </td>
              <td>
                @if (r.snapshot) {
                  <img
                    [src]="r.snapshot"
                    class="snapshot-thumb"
                    alt="Capture véhicule"
                    [title]="i18n.t('common.capture')"
                    (click)="previewSnapshot(r)"
                  />
                } @else {
                  <span class="muted text-xs">N/A</span>
                }
              </td>
              <td>
                @if (r.statut === 'refuse') {
                  <button
                    type="button"
                    class="whitelist-btn"
                    (click)="quickAuthorize(r)"
                    [title]="i18n.t('logs.whitelist_btn')"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>{{ i18n.t('logs.whitelist_btn') }}</span>
                  </button>
                } @else {
                  <span class="muted text-xs">—</span>
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
    .plate-cell {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      background: var(--surface-card);
      border: 1.5px solid var(--surface-border);
      border-radius: 6px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: var(--fg);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
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
    .whitelist-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.65rem;
      font-size: 0.75rem;
      font-weight: 700;
      border-radius: 6px;
      background: var(--ok-bg);
      border: 1px solid var(--ok-border);
      color: var(--ok);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .whitelist-btn:hover {
      background: var(--ok);
      color: #fff;
      transform: translateY(-1px);
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
    .text-xs { font-size: 0.75rem; }
  `,
})
export class LogsPage implements OnInit, OnDestroy {
  private api = inject(Api);
  private modal = inject(ModalService);
  private stream = inject(StreamService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  i18n = inject(I18nService);

  private sub: Subscription | null = null;

  readonly allRows = signal<AccessLog[]>([]);
  readonly todayDate = getLocalToday();

  readonly viewMode = signal<'all' | 'today' | 'history'>('all');
  readonly preset = signal<'today' | 'month' | 'year' | 'all'>('all');
  readonly searchQuery = signal('');
  readonly selectedYear = signal('');
  readonly selectedMonth = signal('');
  readonly selectedExactDate = signal('');
  readonly statut = signal('');

  readonly pageSize = signal(10);
  readonly currentPage = signal(1);

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

    if (q) {
      list = list.filter((r) =>
        (r.plaque && r.plaque.toLowerCase().includes(q)) ||
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

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  load(): void {
    this.api.logs().subscribe((page) => {
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
      this.statut()
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
    this.preset.set('all');
    this.viewMode.set('all');
    this.currentPage.set(1);
    this.toast.info(this.i18n.t('common.clear_filters'));
  }

  quickAuthorize(r: AccessLog): void {
    this.api.vehicles().subscribe({
      next: (page) => {
        const cleanTarget = r.plaque.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
        const existing = page.results.find(
          (v) => v.plaque.replace(/[^0-9A-Za-z]/g, '').toUpperCase() === cleanTarget
        );

        const vehicle: Vehicle = {
          id: existing?.id,
          plaque: existing?.plaque || r.plaque,
          proprietaire: existing?.proprietaire || 'Autorisé depuis journal',
          type: existing?.type || 'car',
          autorise: true,
          user: existing?.user || null,
        };

        this.api.saveVehicle(vehicle).subscribe({
          next: () => {
            this.toast.ok(this.i18n.t('logs.whitelisted_toast'), `Plaque : ${r.plaque}`);
            this.allRows.update((rows) =>
              rows.map((item) =>
                item.plaque === r.plaque ? { ...item, statut: 'autorise' } : item
              )
            );
          },
          error: () => {
            this.toast.bad('Erreur', "Impossible d'autoriser le véhicule");
          },
        });
      },
      error: () => {
        this.toast.bad('Erreur', "Impossible d'accéder aux autorisations");
      },
    });
  }


  previewSnapshot(r: AccessLog): void {
    if (r.snapshot) {
      this.modal.open({
        imageSrc: r.snapshot,
        title: `Passage : ${r.plaque}`,
        subtitle: `${r.date} à ${this.formatTime(r.heure)} · ${r.camera_id} (${(r.confidence * 100).toFixed(0)}% confiance)`,
      });
    }
  }

  formatTime(t: string | null | undefined): string {
    return t ? t.split('.')[0] : '—';
  }
}

export const Logs = LogsPage;

