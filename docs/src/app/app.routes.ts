import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then(m => m.HomePage),
    title: 'Dependency Injector - High-Performance DI for Rust, Go, Node.js, Python & C#'
  },
  {
    path: 'benchmarks',
    loadComponent: () => import('./pages/benchmarks/benchmarks').then(m => m.BenchmarksPage),
    title: 'Benchmarks - Dependency Injector Performance Comparison'
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
        title: 'Getting Started - Dependency Injector for Rust'
      },
      {
        path: 'guide',
        loadComponent: () => import('./pages/docs/guide/guide').then(m => m.GuidePage),
        title: 'Guide - Dependency Injector Patterns and Best Practices'
      },
      {
        path: 'ffi',
        loadComponent: () => import('./pages/docs/ffi/ffi').then(m => m.FfiPage),
        title: 'FFI Bindings - Go, Node.js, Python, C# | Dependency Injector'
      },
      {
        path: 'api',
        loadComponent: () => import('./pages/docs/api/api').then(m => m.ApiPage),
        title: 'API Reference - Dependency Injector Container, Factory, Scope'
      },
      {
        path: 'examples',
        loadComponent: () => import('./pages/docs/examples/examples').then(m => m.ExamplesPage),
        title: 'Examples - Rust, Go, Node.js, Python, C# Code Samples'
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
