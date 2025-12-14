import { Injectable, signal } from '@angular/core';

export interface BenchmarkEntry {
  commit: {
    id: string;
    message: string;
    timestamp: string;
    url: string;
    author: {
      name: string;
      username: string;
    };
  };
  date: number;
  tool: string;
  benches: Bench[];
}

export interface Bench {
  name: string;
  value: number;
  unit: string;
  range?: string;
  extra?: string;
}

export interface BenchmarkData {
  lastUpdate: string;
  repoUrl: string;
  entries: {
    [key: string]: BenchmarkEntry[];
  };
}

export interface ProcessedBenchmark {
  name: string;
  current: number;
  previous: number | null;
  change: number | null;
  changePercent: number | null;
  unit: string;
  range?: string;
  history: { date: Date; value: number; commit: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class BenchmarkService {
  private readonly DATA_URL = 'https://pegasusheavy.github.io/dependency-injector/benchmarks/data.js';
  private readonly FALLBACK_URL = './assets/benchmarks/data.json';

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<BenchmarkData | null>(null);
  readonly processedBenchmarks = signal<ProcessedBenchmark[]>([]);

  async loadBenchmarks(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      // Try to fetch from gh-pages benchmark data
      const response = await this.fetchBenchmarkData();

      if (response) {
        this.data.set(response);
        this.processedBenchmarks.set(this.processBenchmarks(response));
      } else {
        // Use sample data for development/preview
        const sampleData = this.getSampleData();
        this.data.set(sampleData);
        this.processedBenchmarks.set(this.processBenchmarks(sampleData));
      }
    } catch (e) {
      console.error('Failed to load benchmarks:', e);
      this.error.set('Failed to load benchmark data. Showing sample data.');
      // Use sample data as fallback
      const sampleData = this.getSampleData();
      this.data.set(sampleData);
      this.processedBenchmarks.set(this.processBenchmarks(sampleData));
    } finally {
      this.loading.set(false);
    }
  }

  private async fetchBenchmarkData(): Promise<BenchmarkData | null> {
    try {
      // The benchmark action stores data in a JS file with window.BENCHMARK_DATA = {...}
      const response = await fetch(this.DATA_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      // Parse the JS file to extract the data
      const match = text.match(/window\.BENCHMARK_DATA\s*=\s*(\{[\s\S]*\})/);
      if (match) {
        return JSON.parse(match[1]);
      }

      // Try parsing as plain JSON
      return JSON.parse(text);
    } catch {
      // Try fallback URL
      try {
        const fallbackResponse = await fetch(this.FALLBACK_URL);
        if (fallbackResponse.ok) {
          return await fallbackResponse.json();
        }
      } catch {
        // Ignore fallback errors
      }
      return null;
    }
  }

  private processBenchmarks(data: BenchmarkData): ProcessedBenchmark[] {
    const results: ProcessedBenchmark[] = [];

    for (const [suiteName, entries] of Object.entries(data.entries)) {
      if (!entries || entries.length === 0) continue;

      // Sort entries by date (newest first)
      const sortedEntries = [...entries].sort((a, b) => b.date - a.date);
      const latestEntry = sortedEntries[0];
      const previousEntry = sortedEntries[1] || null;

      for (const bench of latestEntry.benches) {
        const previousBench = previousEntry?.benches.find(b => b.name === bench.name);
        const change = previousBench ? bench.value - previousBench.value : null;
        const changePercent = previousBench && previousBench.value > 0
          ? ((bench.value - previousBench.value) / previousBench.value) * 100
          : null;

        // Build history for this benchmark
        const history = sortedEntries
          .filter(entry => entry.benches.some(b => b.name === bench.name))
          .map(entry => {
            const b = entry.benches.find(b => b.name === bench.name)!;
            return {
              date: new Date(entry.date),
              value: b.value,
              commit: entry.commit.id.slice(0, 7)
            };
          })
          .reverse(); // Oldest first for charts

        results.push({
          name: bench.name,
          current: bench.value,
          previous: previousBench?.value || null,
          change,
          changePercent,
          unit: bench.unit,
          range: bench.range,
          history
        });
      }
    }

    return results;
  }

  private getSampleData(): BenchmarkData {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    return {
      lastUpdate: new Date().toISOString(),
      repoUrl: 'https://github.com/pegasusheavy/dependency-injector',
      entries: {
        'Rust Benchmarks': [
          {
            commit: {
              id: 'abc1234567890',
              message: 'Optimize container resolution',
              timestamp: new Date(now).toISOString(),
              url: 'https://github.com/pegasusheavy/dependency-injector/commit/abc1234',
              author: { name: 'Developer', username: 'dev' }
            },
            date: now,
            tool: 'cargo',
            benches: [
              { name: 'container_resolve_singleton', value: 15.2, unit: 'ns/iter', range: '± 0.8' },
              { name: 'container_resolve_transient', value: 45.6, unit: 'ns/iter', range: '± 2.1' },
              { name: 'container_resolve_scoped', value: 28.3, unit: 'ns/iter', range: '± 1.5' },
              { name: 'container_register_service', value: 125.4, unit: 'ns/iter', range: '± 5.2' },
              { name: 'container_concurrent_resolve/4_threads', value: 18.9, unit: 'ns/iter', range: '± 1.2' },
              { name: 'container_concurrent_resolve/8_threads', value: 22.1, unit: 'ns/iter', range: '± 1.8' }
            ]
          },
          {
            commit: {
              id: 'def5678901234',
              message: 'Add scoped lifetime support',
              timestamp: new Date(now - day).toISOString(),
              url: 'https://github.com/pegasusheavy/dependency-injector/commit/def5678',
              author: { name: 'Developer', username: 'dev' }
            },
            date: now - day,
            tool: 'cargo',
            benches: [
              { name: 'container_resolve_singleton', value: 16.1, unit: 'ns/iter', range: '± 0.9' },
              { name: 'container_resolve_transient', value: 48.2, unit: 'ns/iter', range: '± 2.3' },
              { name: 'container_resolve_scoped', value: 30.1, unit: 'ns/iter', range: '± 1.7' },
              { name: 'container_register_service', value: 128.7, unit: 'ns/iter', range: '± 5.5' },
              { name: 'container_concurrent_resolve/4_threads', value: 19.8, unit: 'ns/iter', range: '± 1.3' },
              { name: 'container_concurrent_resolve/8_threads', value: 23.5, unit: 'ns/iter', range: '± 2.0' }
            ]
          },
          {
            commit: {
              id: 'ghi9012345678',
              message: 'Initial benchmark setup',
              timestamp: new Date(now - 2 * day).toISOString(),
              url: 'https://github.com/pegasusheavy/dependency-injector/commit/ghi9012',
              author: { name: 'Developer', username: 'dev' }
            },
            date: now - 2 * day,
            tool: 'cargo',
            benches: [
              { name: 'container_resolve_singleton', value: 18.5, unit: 'ns/iter', range: '± 1.1' },
              { name: 'container_resolve_transient', value: 52.0, unit: 'ns/iter', range: '± 2.8' },
              { name: 'container_resolve_scoped', value: 35.2, unit: 'ns/iter', range: '± 2.0' },
              { name: 'container_register_service', value: 135.0, unit: 'ns/iter', range: '± 6.0' },
              { name: 'container_concurrent_resolve/4_threads', value: 21.2, unit: 'ns/iter', range: '± 1.5' },
              { name: 'container_concurrent_resolve/8_threads', value: 25.8, unit: 'ns/iter', range: '± 2.2' }
            ]
          }
        ]
      }
    };
  }

  formatValue(value: number, unit: string): string {
    if (unit.includes('ns')) {
      if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(2)} ms`;
      } else if (value >= 1_000) {
        return `${(value / 1_000).toFixed(2)} µs`;
      }
      return `${value.toFixed(2)} ns`;
    }
    return `${value.toFixed(2)} ${unit}`;
  }

  getChangeClass(changePercent: number | null): string {
    if (changePercent === null) return '';
    if (changePercent <= -5) return 'text-green-400'; // Faster is better
    if (changePercent >= 5) return 'text-red-400';    // Slower is worse
    return 'text-slate-400';
  }

  getChangeIcon(changePercent: number | null): string {
    if (changePercent === null) return '';
    if (changePercent <= -5) return '↓'; // Faster
    if (changePercent >= 5) return '↑';  // Slower
    return '→';
  }
}

