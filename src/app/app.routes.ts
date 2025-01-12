import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/main-shell.component').then((m) => m.MainShellComponent),
    title: 'Solar Field Desk',
  },
  { path: '**', redirectTo: '' },
];
