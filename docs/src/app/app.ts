import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { HeaderComponent } from './components/header/header';
import { FooterComponent } from './components/footer/footer';
import { setupIconLibrary } from './app.config';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  constructor() {
    const library = inject(FaIconLibrary);
    setupIconLibrary(library);
  }
}
