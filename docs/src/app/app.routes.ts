import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then(m => m.HomePage),
    title: 'Dependency Injector - High-Performance DI for Rust'
  },
  {
    path: 'benchmarks',
    loadComponent: () => import('./pages/benchmarks/benchmarks').then(m => m.BenchmarksPage),
    title: 'Benchmarks - Dependency Injector'
  },
  {
    path: 'docs',
    children: [
      {
        path: '',
        redirectTo: 'getting-started',
        pathMatch: 'full'
      },
      {
        path: 'getting-started',
        loadComponent: () => import('./pages/docs/getting-started/getting-started').then(m => m.GettingStartedPage),
        title: 'Getting Started - Dependency Injector'
      },
      {
        path: 'guide',
        loadComponent: () => import('./pages/docs/guide/guide').then(m => m.GuidePage),
        title: 'Guide - Dependency Injector'
      },
      {
        path: 'api',
        loadComponent: () => import('./pages/docs/api/api').then(m => m.ApiPage),
        title: 'API Reference - Dependency Injector'
      },
      {
        path: 'examples',
        loadComponent: () => import('./pages/docs/examples/examples').then(m => m.ExamplesPage),
        title: 'Examples - Dependency Injector'
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
