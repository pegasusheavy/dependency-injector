import { Component, input, signal } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-code-block',
  imports: [FontAwesomeModule],
  templateUrl: './code-block.html',
  styleUrl: './code-block.scss'
})
export class CodeBlockComponent {
  code = input.required<string>();
  filename = input<string>();

  copied = signal(false);

  async copyCode() {
    const text = this.code().replace(/<[^>]*>/g, '');
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }
}
