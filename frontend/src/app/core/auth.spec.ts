import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Auth, authInterceptor } from './auth';

describe('Auth', () => {
  let auth: Auth;
  let http: HttpClient;
  let mock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(Auth);
    http = TestBed.inject(HttpClient);
    mock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => mock.verify());

  it('keeps the token so a page refresh does not log you out', () => {
    auth.login('admin', 'secret').subscribe();
    mock.expectOne('/api/auth/login/').flush({ access: 'jwt-123' });

    expect(auth.token()).toBe('jwt-123');
    expect(localStorage.getItem('vision.access')).toBe('jwt-123');
  });

  it('attaches the token to outgoing requests, and nothing before login', () => {
    http.get('/api/dashboard/').subscribe();
    expect(mock.expectOne('/api/dashboard/').request.headers.has('Authorization')).toBeFalse();

    auth.login('admin', 'secret').subscribe();
    mock.expectOne('/api/auth/login/').flush({ access: 'jwt-123' });

    http.get('/api/dashboard/').subscribe();
    expect(mock.expectOne('/api/dashboard/').request.headers.get('Authorization')).toBe(
      'Bearer jwt-123',
    );
  });

  it('lets only the administrator edit', () => {
    const base = { id: 1, username: 'x', nom: '', prenom: '', photo: null };
    auth.user.set({ ...base, role: 'supervisor' });
    expect(auth.canEdit).toBeFalse();

    auth.user.set({ ...base, role: 'admin' });
    expect(auth.canEdit).toBeTrue();
  });

  it('forgets everything on logout', () => {
    auth.login('admin', 'secret').subscribe();
    mock.expectOne('/api/auth/login/').flush({ access: 'jwt-123' });

    auth.logout();
    expect(auth.token()).toBeNull();
    expect(localStorage.getItem('vision.access')).toBeNull();
  });
});
