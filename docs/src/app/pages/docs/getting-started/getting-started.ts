import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CodeBlockComponent } from '../../../components/code-block/code-block';
import { CODE_SNIPPETS } from '../../../data/code-snippets';

@Component({
  selector: 'app-getting-started',
  imports: [RouterLink, FontAwesomeModule, CodeBlockComponent],
  templateUrl: './getting-started.html',
  styleUrl: './getting-started.scss'
})
export class GettingStartedPage {
  installCode = CODE_SNIPPETS.install;
  featuresCode = CODE_SNIPPETS.features;
  quickStartCode = CODE_SNIPPETS.quickStart;
  lifetimesCode = CODE_SNIPPETS.lifetimes;
}
