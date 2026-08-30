import { Routes } from '@angular/router';

import { authGuard } from './core/auth';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.Login) },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'attendance',
        loadComponent: () => import('./pages/attendance').then((m) => m.AttendancePage),
      },
      { path: 'vehicles', loadComponent: () => import('./pages/vehicles').then((m) => m.Vehicles) },
      { path: 'logs', loadComponent: () => import('./pages/logs').then((m) => m.Logs) },
      { path: 'alerts', loadComponent: () => import('./pages/alerts').then((m) => m.Alerts) },
    ],
  },
  { path: '**', redirectTo: '' },
];
