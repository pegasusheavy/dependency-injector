import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CodeBlockComponent } from '../../../components/code-block/code-block';
import { CODE_SNIPPETS } from '../../../data/code-snippets';
import { SeoService } from '../../../services/seo.service';

@Component({
  selector: 'app-getting-started',
  imports: [RouterLink, FontAwesomeModule, CodeBlockComponent],
  templateUrl: './getting-started.html',
  styleUrl: './getting-started.scss'
})
export class GettingStartedPage implements OnInit {
  private readonly seo = inject(SeoService);

  installCode = CODE_SNIPPETS.install;
  featuresCode = CODE_SNIPPETS.features;
  quickStartCode = CODE_SNIPPETS.quickStart;
  lifetimesCode = CODE_SNIPPETS.lifetimes;

  ngOnInit(): void {
    this.seo.setGettingStartedSeo();
  }
}
