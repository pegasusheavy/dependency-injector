import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CodeBlockComponent } from '../../../components/code-block/code-block';
import { CODE_SNIPPETS } from '../../../data/code-snippets';
import { SeoService } from '../../../services/seo.service';

@Component({
  selector: 'app-guide',
  imports: [RouterLink, FontAwesomeModule, CodeBlockComponent],
  templateUrl: './guide.html',
  styleUrl: './guide.scss'
})
export class GuidePage implements OnInit {
  private readonly seo = inject(SeoService);

  scopeCode = CODE_SNIPPETS.scopes;
  overrideCode = CODE_SNIPPETS.overrides;

  ngOnInit(): void {
    this.seo.setGuideSeo();
  }
}
