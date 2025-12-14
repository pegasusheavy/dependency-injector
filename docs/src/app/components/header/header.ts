import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, FontAwesomeModule],
  templateUrl: './header.html',
  styleUrl: './header.scss'
})
export class HeaderComponent {
  mobileMenuOpen = signal(false);

  navLinks = [
    { path: '/docs/getting-started', label: 'Getting Started', exact: false },
    { path: '/docs/guide', label: 'Guide', exact: false },
    { path: '/docs/api', label: 'API', exact: false },
    { path: '/docs/examples', label: 'Examples', exact: false },
    { path: '/benchmarks', label: 'Benchmarks', exact: false }
  ];

  toggleMobileMenu() {
    this.mobileMenuOpen.update(v => !v);
  }
}
