import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, catchError, tap, throwError } from 'rxjs';

import { User } from './models';

const ACCESS = 'vision.access';
const USER_KEY = 'vision.user';

@Injectable({ providedIn: 'root' })
export class Auth {
  private http = inject(HttpClient);
  private router = inject(Router);

  /** Read once at startup so a refresh does not log you out. */
  readonly token = signal<string | null>(localStorage.getItem(ACCESS));
  readonly user = signal<User | null>(this.getStoredUser());

  constructor() {
    if (this.token()) {
      this.loadUser().subscribe({
        error: () => {},
      });
    }
  }

  private getStoredUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private setStoredUser(u: User | null): void {
    if (u) {
      localStorage.setItem(USER_KEY, JSON.stringify(u));
    } else {
      localStorage.removeItem(USER_KEY);
    }
    this.user.set(u);
  }

  login(username: string, password: string): Observable<{ access: string }> {
    return this.http
      .post<{ access: string }>('/api/auth/login/', { username, password })
      .pipe(
        tap(({ access }) => {
          localStorage.setItem(ACCESS, access);
          this.token.set(access);
          this.loadUser().subscribe({
            error: () => {},
          });
        }),
      );
  }

  loadUser(): Observable<User> {
    return this.http.get<User>('/api/auth/me/').pipe(
      tap((u) => this.setStoredUser(u)),
    );
  }

  updateProfile(data: { username?: string; email?: string; nom?: string; prenom?: string }): Observable<User> {
    return this.http.patch<User>('/api/auth/me/', data).pipe(
      tap((u) => this.setStoredUser(u)),
    );
  }

  changePassword(data: { old_password: string; new_password: string }): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>('/api/auth/change-password/', data);
  }

  logout(): void {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(USER_KEY);
    this.token.set(null);
    this.user.set(null);
    this.router.navigate(['/login']);
  }

  /** Supervisors read; administrators change things. Default to true while user loads if token exists. */
  get canEdit(): boolean {
    const u = this.user();
    if (!u) return this.token() !== null;
    return u.role === 'admin' || u.role === 'supervisor';
  }
}


export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const token = auth.token();
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !req.url.includes('/api/auth/login/')) {
        auth.logout();
      }
      return throwError(() => err);
    }),
  );
};

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  return auth.token() ? true : router.createUrlTree(['/login']);
};

