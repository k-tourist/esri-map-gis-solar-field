import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/main-shell.component').then((m) => m.MainShellComponent),
    title: 'Solar Field Desk',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard-page.component').then(
        (m) => m.DashboardPageComponent,
      ),
    title: 'Fleet dashboard — Solar Field Desk',
  },
  { path: '**', redirectTo: '' },
];
