import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AccessLog, Alert, Attendance, Page, Stats, User, Vehicle } from './models';

/** Thin typed wrapper over the REST API. No caching, no store: the dashboard is
 *  read-mostly and the numbers must be current, not consistent with a cache. */
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  private params(filters: Record<string, string | undefined>): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params = params.set(key, value);
    }
    return params;
  }

  stats(): Observable<Stats> {
    return this.http.get<Stats>('/api/dashboard/');
  }

  attendance(filters: Record<string, string | undefined> = {}): Observable<Page<Attendance>> {
    return this.http.get<Page<Attendance>>('/api/attendance/', { params: this.params(filters) });
  }

  logs(filters: Record<string, string | undefined> = {}): Observable<Page<AccessLog>> {
    return this.http.get<Page<AccessLog>>('/api/logs/', { params: this.params(filters) });
  }

  vehicles(): Observable<Page<Vehicle>> {
    return this.http.get<Page<Vehicle>>('/api/vehicles/');
  }

  saveVehicle(vehicle: Vehicle): Observable<Vehicle> {
    return vehicle.id
      ? this.http.put<Vehicle>(`/api/vehicles/${vehicle.id}/`, vehicle)
      : this.http.post<Vehicle>('/api/vehicles/', vehicle);
  }

  deleteVehicle(id: number): Observable<void> {
    return this.http.delete<void>(`/api/vehicles/${id}/`);
  }

  members(): Observable<Page<User>> {
    return this.http.get<Page<User>>('/api/users/', { params: this.params({ role: 'member' }) });
  }

  alerts(): Observable<Page<Alert>> {
    return this.http.get<Page<Alert>>('/api/alerts/');
  }

  markSeen(id: number): Observable<Alert> {
    return this.http.post<Alert>(`/api/alerts/${id}/seen/`, {});
  }

  /** Reports need the auth header, so they cannot be a plain <a href>. */
  downloadReport(fmt: 'xlsx' | 'pdf', filters: Record<string, string | undefined>): void {
    this.http
      .get(`/api/reports/attendance.${fmt}`, {
        params: this.params(filters),
        responseType: 'blob',
      })
      .subscribe((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `presences.${fmt}`;
        link.click();
        URL.revokeObjectURL(url);
      });
  }
}
