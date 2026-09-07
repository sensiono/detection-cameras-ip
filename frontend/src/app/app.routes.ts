import { Routes } from '@angular/router';

import { authGuard } from './core/auth';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.LoginPage || m.Login) },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/dashboard').then((m) => m.DashboardPage || m.Dashboard),
      },
      {
        path: 'attendance',
        loadComponent: () => import('./pages/attendance').then((m) => m.AttendancePage || m.Attendance),
      },
      { path: 'vehicles', loadComponent: () => import('./pages/vehicles').then((m) => m.VehiclesPage || m.Vehicles) },
      { path: 'members', loadComponent: () => import('./pages/members').then((m) => m.MembersPage || m.Members) },
      { path: 'logs', loadComponent: () => import('./pages/logs').then((m) => m.LogsPage || m.Logs) },
      { path: 'alerts', loadComponent: () => import('./pages/alerts').then((m) => m.AlertsPage || m.Alerts) },
      { path: 'cameras', loadComponent: () => import('./pages/cameras').then((m) => m.CamerasPage || m.Cameras) },
    ],
  },
  { path: '**', redirectTo: '' },
];

