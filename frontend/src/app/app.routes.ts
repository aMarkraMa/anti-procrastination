import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.HomeComponent),
  },
  {
    path: 'create',
    loadComponent: () => import('./pages/create/create').then((m) => m.CreateComponent),
  },
  {
    path: 'review',
    loadComponent: () => import('./pages/review/review').then((m) => m.ReviewComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
