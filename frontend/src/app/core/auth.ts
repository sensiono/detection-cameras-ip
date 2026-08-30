import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { User } from './models';

const ACCESS = 'vision.access';

@Injectable({ providedIn: 'root' })
export class Auth {
  private http = inject(HttpClient);
  private router = inject(Router);

  /** Read once at startup so a refresh does not log you out. */
  readonly token = signal<string | null>(localStorage.getItem(ACCESS));
  readonly user = signal<User | null>(null);

  login(username: string, password: string): Observable<{ access: string }> {
    return this.http
      .post<{ access: string }>('/api/auth/login/', { username, password })
      .pipe(
        tap(({ access }) => {
          localStorage.setItem(ACCESS, access);
          this.token.set(access);
        }),
      );
  }

  loadUser(): Observable<User> {
    return this.http.get<User>('/api/auth/me/').pipe(tap((u) => this.user.set(u)));
  }

  logout(): void {
    localStorage.removeItem(ACCESS);
    this.token.set(null);
    this.user.set(null);
    this.router.navigate(['/login']);
  }

  /** Supervisors read; only administrators change things. Mirrors the API rule —
   *  the UI hides what the server would refuse anyway. */
  get canEdit(): boolean {
    return this.user()?.role === 'admin';
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(Auth).token();
  return token
    ? next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))
    : next(req);
};

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  return auth.token() ? true : router.createUrlTree(['/login']);
};
