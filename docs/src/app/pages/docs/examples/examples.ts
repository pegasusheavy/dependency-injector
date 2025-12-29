import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CodeBlockComponent } from '../../../components/code-block/code-block';
import { CODE_SNIPPETS } from '../../../data/code-snippets';
import { SeoService } from '../../../services/seo.service';

@Component({
  selector: 'app-examples',
  imports: [RouterLink, FontAwesomeModule, CodeBlockComponent],
  templateUrl: './examples.html',
  styleUrl: './examples.scss'
})
export class ExamplesPage implements OnInit {
  private readonly seo = inject(SeoService);

  armatureCode = CODE_SNIPPETS.armature;
  testingCode = CODE_SNIPPETS.testing;
  multiTenantCode = CODE_SNIPPETS.multiTenant;

  ngOnInit(): void {
    this.seo.setExamplesSeo();
  }
}
