import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CodeBlockComponent } from '../../../components/code-block/code-block';
import { CODE_SNIPPETS } from '../../../data/code-snippets';

@Component({
  selector: 'app-examples',
  imports: [RouterLink, FontAwesomeModule, CodeBlockComponent],
  templateUrl: './examples.html',
  styleUrl: './examples.scss'
})
export class ExamplesPage {
  armatureCode = CODE_SNIPPETS.armature;
  testingCode = CODE_SNIPPETS.testing;
  multiTenantCode = CODE_SNIPPETS.multiTenant;
}
