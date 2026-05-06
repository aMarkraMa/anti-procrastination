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
    path: 'confirm',
    loadComponent: () => import('./pages/confirm/confirm').then((m) => m.ConfirmComponent),
  },
  {
    path: 'bank',
    loadComponent: () => import('./pages/bank/bank').then((m) => m.BankComponent),
  },
  {
    path: 'execute',
    loadComponent: () =>
      import('./pages/execute/execute').then((m) => m.ExecuteComponent),
  },
  {
    path: 'result',
    loadComponent: () => import('./pages/result/result').then((m) => m.ResultComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
