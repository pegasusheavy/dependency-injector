import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CodeBlockComponent } from '../../components/code-block/code-block';
import { CODE_SNIPPETS } from '../../data/code-snippets';

@Component({
  selector: 'app-home',
  imports: [RouterLink, FontAwesomeModule, CodeBlockComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class HomePage {
  installCode = CODE_SNIPPETS.install;
  exampleCode = CODE_SNIPPETS.example;

  features = [
    { title: 'Lock-Free', description: 'Uses DashMap for ~10x faster concurrent access compared to RwLock-based containers.', icon: 'bolt' },
    { title: 'Type-Safe', description: 'Compile-time type checking with zero runtime overhead. Errors caught before deployment.', icon: 'shield' },
    { title: 'Zero-Config', description: 'Any Send + Sync + \'static type is automatically injectable. No boilerplate required.', icon: 'cubes' },
    { title: 'Scoped Containers', description: 'Hierarchical scopes with full parent chain resolution. Perfect for request-scoped services.', icon: 'layer-group' },
    { title: 'Cross-Language FFI', description: 'Use from Go, Python, Node.js, and C# via native FFI bindings. One container, all languages.', icon: 'globe' },
    { title: '6-57x Faster', description: 'Benchmarked against Go, Python, Node.js, C# DI frameworks. Rust delivers unmatched performance.', icon: 'rocket' }
  ];

  benefits = [
    { title: 'No Boilerplate', description: 'No traits to implement, no macros to apply. Just use your types directly.' },
    { title: 'Arc-Based Sharing', description: 'Returns Arc<T> for zero-copy sharing across threads and components.' },
    { title: 'Lazy by Default', description: 'Services created on first access. No wasted initialization.' },
    { title: 'Scoped Testing', description: 'Create child scopes to override services for testing without affecting parents.' }
  ];
}
