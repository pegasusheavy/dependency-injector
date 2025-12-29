import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { BenchmarkService, ProcessedBenchmark } from '../../services/benchmark.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-benchmarks',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './benchmarks.html',
  styleUrl: './benchmarks.scss'
})
export class BenchmarksPage implements OnInit {
  readonly benchmarkService = inject(BenchmarkService);
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.setBenchmarksSeo();
    this.benchmarkService.loadBenchmarks();
  }

  formatValue(value: number, unit: string): string {
    return this.benchmarkService.formatValue(value, unit);
  }

  getChangeClass(changePercent: number | null): string {
    return this.benchmarkService.getChangeClass(changePercent);
  }

  getChangeIcon(changePercent: number | null): string {
    return this.benchmarkService.getChangeIcon(changePercent);
  }

  formatChange(changePercent: number | null): string {
    if (changePercent === null) return 'N/A';
    const sign = changePercent > 0 ? '+' : '';
    return `${sign}${changePercent.toFixed(1)}%`;
  }

  getSparklinePoints(benchmark: ProcessedBenchmark): string {
    if (!benchmark.history || benchmark.history.length < 2) return '';

    const values = benchmark.history.map(h => h.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const width = 100;
    const height = 30;
    const padding = 2;

    return benchmark.history
      .map((h, i) => {
        const x = padding + (i / (benchmark.history.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((h.value - min) / range) * (height - 2 * padding);
        return `${x},${y}`;
      })
      .join(' ');
  }

  getLastCommit(): string {
    const data = this.benchmarkService.data();
    if (!data?.entries) return '';

    const entries = Object.values(data.entries).flat();
    if (entries.length === 0) return '';

    const latest = entries.sort((a, b) => b.date - a.date)[0];
    return latest.commit.id.slice(0, 7);
  }

  getLastUpdate(): string {
    const data = this.benchmarkService.data();
    if (!data?.lastUpdate) return '';

    return new Date(data.lastUpdate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
