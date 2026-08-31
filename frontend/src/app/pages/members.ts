import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { ConfirmService } from '../core/confirm';
import { I18nService } from '../core/i18n';
import { User } from '../core/models';
import { StreamService } from '../core/stream';
import { ToastService } from '../core/toast';



interface PhotoItem {
  file?: File;
  previewUrl: string;
}

interface UserDraft {
  id?: number;
  username: string;
  nom: string;
  prenom: string;
  role: 'admin' | 'supervisor' | 'member';
  photos: PhotoItem[];
}

const EMPTY_DRAFT: UserDraft = {
  username: '',
  nom: '',
  prenom: '',
  role: 'member',
  photos: [],
};

@Component({
  selector: 'app-members',
  imports: [FormsModule],
  template: `
    <div class="page-head">
      <div>
        <h1>{{ i18n.t('members.title') }}</h1>
        <p class="muted">{{ i18n.t('members.subtitle') }}</p>
      </div>

      @if (auth.canEdit) {
        <button type="button" class="btn-add" (click)="openAddModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>{{ i18n.t('members.add') }}</span>
        </button>
      }
    </div>

    <!-- Status Tabs -->
    <div class="tab-pills-row">
      <button
        type="button"
        class="tab-pill"
        [class.active]="selectedRole() === 'all'"
        (click)="selectedRole.set('all'); currentPage.set(1)"
      >
        <span>Tous les profils</span>
        <span class="count-badge">{{ rows().length }}</span>
      </button>

      <button
        type="button"
        class="tab-pill"
        [class.active]="selectedRole() === 'member'"
        (click)="selectedRole.set('member'); currentPage.set(1)"
      >
        <span>{{ i18n.t('members.role_member') }}</span>
        <span class="count-badge">{{ countMembers() }}</span>
      </button>

      <button
        type="button"
        class="tab-pill"
        [class.active]="selectedRole() === 'supervisor'"
        (click)="selectedRole.set('supervisor'); currentPage.set(1)"
      >
        <span>{{ i18n.t('members.role_supervisor') }}</span>
        <span class="count-badge">{{ countSupervisors() }}</span>
      </button>

      <button
        type="button"
        class="tab-pill"
        [class.active]="selectedRole() === 'admin'"
        (click)="selectedRole.set('admin'); currentPage.set(1)"
      >
        <span>{{ i18n.t('members.role_admin') }}</span>
        <span class="count-badge bad">{{ countAdmins() }}</span>
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
            placeholder="Nom, prénom, matricule..."
          />
        </div>
      </label>

      <label>
        <span>Rôle</span>
        <select [ngModel]="selectedRole()" (ngModelChange)="selectedRole.set($event); currentPage.set(1)">
          <option value="all">Tous les rôles</option>
          <option value="member">{{ i18n.t('members.role_member') }}</option>
          <option value="supervisor">{{ i18n.t('members.role_supervisor') }}</option>
          <option value="admin">{{ i18n.t('members.role_admin') }}</option>
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


    <!-- Members Table -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Visage / Photo</th>
            <th>{{ i18n.t('members.lastname') }} & {{ i18n.t('members.firstname') }}</th>
            <th>{{ i18n.t('members.matricule') }}</th>
            <th>{{ i18n.t('members.role') }}</th>
            <th>Statut Biométrique</th>
            @if (auth.canEdit) { <th>{{ i18n.t('common.actions') }}</th> }
          </tr>
        </thead>
        <tbody>
          @for (u of paginatedRows(); track u.id) {
            <tr>
              <td>
                <div class="member-photo-wrap">
                  @if (u.photo) {
                    <img [src]="u.photo" class="member-thumb" alt="Photo membre" />
                  } @else {
                    <div class="member-avatar">{{ (u.prenom || u.nom || u.username)[0].toUpperCase() }}</div>
                  }
                </div>
              </td>
              <td>
                <div class="member-name-block">
                  <strong>{{ u.prenom }} {{ u.nom }}</strong>
                  @if (!u.nom && !u.prenom) {
                    <span class="muted">{{ u.username }}</span>
                  }
                </div>
              </td>
              <td>
                <span class="font-mono matricule-tag">{{ u.username }}</span>
              </td>
              <td>
                <span class="role-pill" [class]="u.role">
                  {{ u.role === 'admin' ? i18n.t('members.role_admin') : (u.role === 'supervisor' ? i18n.t('members.role_supervisor') : i18n.t('members.role_member')) }}
                </span>
              </td>
              <td>
                @if (u.photo) {
                  <span class="pill ok">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    {{ i18n.t('members.enrolled_badge') }}
                  </span>
                } @else {
                  <span class="pill muted">
                    {{ i18n.t('members.no_photo_badge') }}
                  </span>
                }
              </td>
              @if (auth.canEdit) {
                <td>
                  <div class="action-btns">
                    <button class="icon-btn edit-btn" (click)="edit(u)" title="Modifier et ajouter des photos">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <button class="icon-btn del-btn" (click)="remove(u)" title="Supprimer">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </div>
                </td>
              }
            </tr>
          } @empty {
            <tr>
              <td colspan="6" class="empty-cell">
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

    <!-- Add / Edit Member Modal with Multi-Photo Upload -->
    @if (isModalOpen()) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="modal-dialog member-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="modal-title">
              {{ draft.id ? "Modifier le profil collaborateur" : i18n.t('members.add') }}
            </h3>
            <button class="modal-close" (click)="closeModal()" [title]="i18n.t('common.close')">✕</button>
          </div>

          <form (ngSubmit)="save()">
            <div class="modal-body">
              <!-- Multi-Photo Upload Dropzone -->
              <div class="photo-upload-container">
                <label class="upload-label">
                  Photos du Visage (Multi-angles recommandés pour une précision optimale)
                </label>
                
                <div class="photo-dropzone" (click)="fileInput.click()">
                  <input
                    #fileInput
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    (change)="onFilesSelected($event)"
                    style="display: none;"
                  />

                  <div class="dropzone-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
                    <p class="dropzone-text">{{ i18n.t('members.photo_drop') }}</p>
                    <span class="dropzone-hint">{{ i18n.t('members.photo_hint') }}</span>
                  </div>
                </div>

                <!-- Preview Grid of Selected Photos -->
                @if (draft.photos.length) {
                  <div class="photos-preview-grid">
                    @for (p of draft.photos; track $index; let idx = $index) {
                      <div class="photo-item-card">
                        <img [src]="p.previewUrl" class="photo-preview-thumb" alt="Visage {{ idx + 1 }}" />
                        <button type="button" class="remove-photo-btn" (click)="removePhoto(idx)" title="Retirer">✕</button>
                        @if (idx === 0) {
                          <span class="primary-badge">Photo principale</span>
                        }
                      </div>
                    }
                  </div>
                  <small class="muted text-xs">{{ draft.photos.length }} {{ i18n.t('members.photos_count') }}</small>
                }
              </div>

              <div class="form-row">
                <div class="input-group">
                  <label>{{ i18n.t('members.firstname') }} *</label>
                  <input name="prenom" [(ngModel)]="draft.prenom" placeholder="Prénom" required />
                </div>

                <div class="input-group">
                  <label>{{ i18n.t('members.lastname') }} *</label>
                  <input name="nom" [(ngModel)]="draft.nom" placeholder="Nom de famille" required />
                </div>
              </div>

              <div class="form-row">
                <div class="input-group">
                  <label>{{ i18n.t('members.matricule') }} *</label>
                  <input name="username" [(ngModel)]="draft.username" placeholder="Identifiant unique (ex: sarah, m102)" required />
                </div>

                <div class="input-group">
                  <label>{{ i18n.t('members.role') }}</label>
                  <select name="role" [(ngModel)]="draft.role">
                    <option value="member">{{ i18n.t('members.role_member') }}</option>
                    <option value="supervisor">{{ i18n.t('members.role_supervisor') }}</option>
                    <option value="admin">{{ i18n.t('members.role_admin') }}</option>
                  </select>
                </div>
              </div>

              @if (error()) {
                <p class="error" role="alert">{{ error() }}</p>
              }
            </div>

            <div class="modal-actions-bar">
              <button type="button" class="secondary" (click)="closeModal()">{{ i18n.t('common.cancel') }}</button>
              <button type="submit" class="btn-save" [disabled]="isSaving()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                <span>{{ isSaving() ? 'Enregistrement & Indexation...' : i18n.t('common.save') }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: `
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
    .count-badge.bad { background: var(--bad-bg); color: var(--bad); }

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

    .member-photo-wrap { display: flex; align-items: center; }
    .member-thumb {
      width: 42px;
      height: 42px;
      border-radius: 10px;
      object-fit: cover;
      border: 1.5px solid var(--surface-border);
      box-shadow: var(--shadow-sm);
    }
    .member-avatar {
      width: 42px;
      height: 42px;
      border-radius: 10px;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      color: #fff;
      font-weight: 800;
      font-size: 1.1rem;
      display: grid;
      place-items: center;
    }
    .matricule-tag {
      font-size: 0.85rem;
      background: var(--surface-hover);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      border: 1px solid var(--surface-border);
    }
    .role-pill {
      display: inline-block;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.78rem;
      font-weight: 700;
      border: 1px solid transparent;
    }
    .role-pill.admin { background: rgba(239, 68, 68, 0.12); color: var(--bad); border-color: rgba(239, 68, 68, 0.25); }
    .role-pill.supervisor { background: rgba(245, 158, 11, 0.12); color: var(--warn); border-color: rgba(245, 158, 11, 0.25); }
    .role-pill.member { background: rgba(59, 130, 246, 0.12); color: var(--brand); border-color: rgba(59, 130, 246, 0.25); }

    .action-btns { display: flex; gap: 0.4rem; }
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
    .edit-btn:hover { background: var(--brand-glow); color: var(--brand); border-color: var(--brand); }
    .del-btn:hover { background: var(--bad-bg); color: var(--bad); border-color: var(--bad-border); }

    /* Modal Form Styles */
    .member-modal { max-width: 620px; }
    .modal-body {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .form-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }
    .input-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .input-group label {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--fg-secondary);
    }
    .photo-upload-container {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .upload-label {
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--fg);
    }
    .photo-dropzone {
      border: 2px dashed var(--surface-border);
      border-radius: var(--radius-md);
      padding: 1.25rem;
      text-align: center;
      background: var(--surface-hover);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .photo-dropzone:hover {
      border-color: var(--brand);
      background: var(--brand-glow);
    }
    .dropzone-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
      color: var(--muted);
    }
    .dropzone-text {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--fg);
      margin: 0;
    }
    .dropzone-hint {
      font-size: 0.75rem;
      color: var(--fg-secondary);
    }

    /* Multi-Photo Preview Grid */
    .photos-preview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
      gap: 0.75rem;
      margin-top: 0.5rem;
    }
    .photo-item-card {
      position: relative;
      width: 90px;
      height: 90px;
      border-radius: 12px;
      overflow: hidden;
      border: 2px solid var(--surface-border);
      box-shadow: var(--shadow-sm);
    }
    .photo-preview-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .remove-photo-btn {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 20px;
      height: 20px;
      padding: 0;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.65);
      color: #fff;
      font-size: 0.65rem;
      display: grid;
      place-items: center;
      border: none;
      cursor: pointer;
    }
    .remove-photo-btn:hover {
      background: var(--bad);
    }
    .primary-badge {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(37, 99, 235, 0.85);
      color: #fff;
      font-size: 0.6rem;
      font-weight: 700;
      text-align: center;
      padding: 1px 0;
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
    .page-number-text { font-size: 0.85rem; }
    .btn-sm {
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
    }
    .empty-cell {
      text-align: center;
      padding: 3rem !important;
    }
  `,
})
export class MembersPage implements OnInit, OnDestroy {
  private api = inject(Api);
  private toast = inject(ToastService);
  private confirmService = inject(ConfirmService);
  private stream = inject(StreamService);
  auth = inject(Auth);
  i18n = inject(I18nService);


  readonly rows = signal<User[]>([]);
  readonly error = signal<string | null>(null);
  readonly isModalOpen = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);

  // Filters & Pagination
  readonly searchQuery = signal<string>('');
  readonly selectedRole = signal<'all' | 'member' | 'supervisor' | 'admin'>('all');
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);

  draft: UserDraft = { ...EMPTY_DRAFT };
  private sub: Subscription | null = null;

  readonly countMembers = computed(() => this.rows().filter((u) => u.role === 'member').length);
  readonly countSupervisors = computed(() => this.rows().filter((u) => u.role === 'supervisor').length);
  readonly countAdmins = computed(() => this.rows().filter((u) => u.role === 'admin').length);

  readonly filteredRows = computed(() => {
    let list = this.rows();
    const role = this.selectedRole();
    if (role !== 'all') list = list.filter((u) => u.role === role);

    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.nom.toLowerCase().includes(q) ||
          u.prenom.toLowerCase().includes(q)
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
    this.sub = this.stream.updates$.subscribe(() => {
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }


  load(): void {
    this.api.users().subscribe({
      next: (page) => this.rows.set(page.results),
      error: () => this.toast.bad('Erreur de chargement des collaborateurs'),
    });
  }

  openAddModal(): void {
    this.draft = { ...EMPTY_DRAFT, photos: [] };
    this.error.set(null);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.draft = { ...EMPTY_DRAFT, photos: [] };
    this.error.set(null);
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      Array.from(input.files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.draft.photos.push({
            file,
            previewUrl: e.target?.result as string,
          });
        };
        reader.readAsDataURL(file);
      });
    }
  }

  removePhoto(index: number): void {
    this.draft.photos.splice(index, 1);
  }

  edit(u: User): void {
    const existingPhotos: PhotoItem[] = u.photo ? [{ previewUrl: u.photo }] : [];
    this.draft = {
      id: u.id,
      username: u.username,
      nom: u.nom,
      prenom: u.prenom,
      role: u.role,
      photos: existingPhotos,
    };
    this.error.set(null);
    this.isModalOpen.set(true);
  }

  hasActiveFilters(): boolean {
    return Boolean(this.searchQuery() || this.selectedRole() !== 'all');
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.selectedRole.set('all');
    this.currentPage.set(1);
    this.toast.info(this.i18n.t('common.clear_filters'));
  }


  save(): void {
    this.error.set(null);
    this.isSaving.set(true);

    const formData = new FormData();
    formData.append('username', this.draft.username);
    formData.append('nom', this.draft.nom);
    formData.append('prenom', this.draft.prenom);
    formData.append('role', this.draft.role);

    // Append all selected photos
    this.draft.photos.forEach((p) => {
      if (p.file) {
        formData.append('photos', p.file, p.file.name);
      }
    });

    this.api.saveUser(formData, this.draft.id).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.toast.ok('Succès', 'Collaborateur enregistré et galerie faciale synchronisée');
        this.closeModal();
        this.load();
      },
      error: (err) => {
        this.isSaving.set(false);
        const msg = err.error?.error?.message || 'Erreur lors de la sauvegarde';
        this.error.set(msg);
        this.toast.bad('Erreur', msg);
      },
    });
  }

  async remove(u: User): Promise<void> {
    if (!u.id) return;
    const ok = await this.confirmService.confirm({
      title: 'Supprimer le collaborateur',
      message: `Êtes-vous sûr de vouloir supprimer définitivement ${u.prenom} ${u.nom} (${u.username}) ? Ses données faciales et son profil seront retirés.`,
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true,
    });
    if (ok) {
      this.api.deleteUser(u.id).subscribe({
        next: () => {
          this.toast.info('Supprimé', `Collaborateur ${u.username} retiré`);
          this.load();
        },
        error: () => this.toast.bad('Erreur de suppression'),
      });
    }
  }

}

export const Members = MembersPage;
