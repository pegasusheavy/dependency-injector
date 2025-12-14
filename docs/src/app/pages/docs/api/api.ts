import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-api',
  imports: [RouterLink, FontAwesomeModule],
  templateUrl: './api.html',
  styleUrl: './api.scss'
})
export class ApiPage {
  containerMethods = [
    { name: 'new()', description: 'Creates a new empty container', returns: 'Container' },
    { name: 'singleton<T>(value: T)', description: 'Registers a singleton service with an immediate value', returns: '()' },
    { name: 'lazy<T, F>(factory: F)', description: 'Registers a lazy singleton that is created on first access', returns: '()' },
    { name: 'transient<T, F>(factory: F)', description: 'Registers a transient service with a factory', returns: '()' },
    { name: 'get<T>()', description: 'Resolves a service, returning an Arc<T>', returns: 'Result<Arc<T>, DiError>' },
    { name: 'try_get<T>()', description: 'Tries to resolve a service, returning None if not found', returns: 'Option<Arc<T>>' },
    { name: 'contains<T>()', description: 'Checks if a service is registered', returns: 'bool' },
    { name: 'scope()', description: 'Creates a child scope that inherits from this container', returns: 'ScopedContainer' },
    { name: 'lock()', description: 'Prevents further registrations', returns: '()' },
  ];

  errorVariants = [
    { name: 'NotFound', description: 'The requested service type was not found in the container or any parent scope' },
    { name: 'FactoryPanicked', description: 'The factory function panicked during service creation' },
  ];
}
