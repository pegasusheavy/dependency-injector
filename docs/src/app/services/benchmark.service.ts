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

    // Actual benchmark results from v0.1.1 (Dec 2024)
    return {
      lastUpdate: new Date().toISOString(),
      repoUrl: 'https://github.com/pegasusheavy/dependency-injector',
      entries: {
        'Rust Benchmarks': [
          {
            commit: {
              id: 'e19620e',
              message: 'feat(logging): add comprehensive debug logging with JSON/pretty output',
              timestamp: new Date(now).toISOString(),
              url: 'https://github.com/pegasusheavy/dependency-injector/commit/e19620e',
              author: { name: 'Developer', username: 'pegasusheavy' }
            },
            date: now,
            tool: 'cargo',
            benches: [
              // Registration benchmarks (includes container creation overhead)
              { name: 'registration/singleton_small', value: 854, unit: 'ns/iter', range: '± 24' },
              { name: 'registration/singleton_medium', value: 914, unit: 'ns/iter', range: '± 45' },
              { name: 'registration/lazy', value: 867, unit: 'ns/iter', range: '± 35' },
              { name: 'registration/transient', value: 858, unit: 'ns/iter', range: '± 38' },
              // Resolution benchmarks
              { name: 'resolution/get_singleton', value: 19.60, unit: 'ns/iter', range: '± 1.6' },
              { name: 'resolution/get_medium', value: 19.22, unit: 'ns/iter', range: '± 0.5' },
              { name: 'resolution/contains_check', value: 18.58, unit: 'ns/iter', range: '± 0.8' },
              { name: 'resolution/try_get_found', value: 19.41, unit: 'ns/iter', range: '± 0.5' },
              { name: 'resolution/try_get_not_found', value: 13.94, unit: 'ns/iter', range: '± 0.8' },
              // Transient benchmarks
              { name: 'transient/get_transient', value: 26.88, unit: 'ns/iter', range: '± 1.4' },
              // Scoped benchmarks
              { name: 'scoped/create_scope', value: 870, unit: 'ns/iter', range: '± 34' },
              { name: 'scoped/resolve_from_parent', value: 38.35, unit: 'ns/iter', range: '± 1.7' },
              { name: 'scoped/resolve_override', value: 19.41, unit: 'ns/iter', range: '± 0.9' },
              // Concurrent benchmarks
              { name: 'concurrent/concurrent_reads_4', value: 92650, unit: 'ns/iter', range: '± 10100' },
              // Comparison benchmarks
              { name: 'comparison/singleton_resolution', value: 19.22, unit: 'ns/iter', range: '± 0.5' },
              { name: 'comparison/deep_dependency_chain', value: 18.29, unit: 'ns/iter', range: '± 0.4' },
              { name: 'comparison/container_creation', value: 788, unit: 'ns/iter', range: '± 34' },
              // Service scaling
              { name: 'scaling/10_services', value: 19.87, unit: 'ns/iter', range: '± 0.25' },
              { name: 'scaling/50_services', value: 18.86, unit: 'ns/iter', range: '± 0.44' },
              { name: 'scaling/100_services', value: 18.56, unit: 'ns/iter', range: '± 0.61' },
              { name: 'scaling/500_services', value: 18.76, unit: 'ns/iter', range: '± 0.96' }
            ]
          },
          {
            commit: {
              id: 'd35391b',
              message: 'fix: pin criterion to 0.5 for Rust 1.85 compatibility',
              timestamp: new Date(now - day).toISOString(),
              url: 'https://github.com/pegasusheavy/dependency-injector/commit/d35391b',
              author: { name: 'Developer', username: 'pegasusheavy' }
            },
            date: now - day,
            tool: 'cargo',
            benches: [
              { name: 'registration/singleton_small', value: 845, unit: 'ns/iter', range: '± 8' },
              { name: 'registration/singleton_medium', value: 873, unit: 'ns/iter', range: '± 8' },
              { name: 'registration/lazy', value: 840, unit: 'ns/iter', range: '± 9' },
              { name: 'registration/transient', value: 825, unit: 'ns/iter', range: '± 5' },
              { name: 'resolution/get_singleton', value: 18.50, unit: 'ns/iter', range: '± 0.10' },
              { name: 'resolution/get_medium', value: 18.70, unit: 'ns/iter', range: '± 0.15' },
              { name: 'resolution/contains_check', value: 17.50, unit: 'ns/iter', range: '± 0.18' },
              { name: 'resolution/try_get_found', value: 18.80, unit: 'ns/iter', range: '± 0.15' },
              { name: 'resolution/try_get_not_found', value: 11.00, unit: 'ns/iter', range: '± 0.08' },
              { name: 'transient/get_transient', value: 25.10, unit: 'ns/iter', range: '± 0.30' },
              { name: 'scoped/create_scope', value: 789, unit: 'ns/iter', range: '± 7' },
              { name: 'scoped/resolve_from_parent', value: 37.50, unit: 'ns/iter', range: '± 0.35' },
              { name: 'scoped/resolve_override', value: 19.00, unit: 'ns/iter', range: '± 0.22' },
              { name: 'concurrent/concurrent_reads_4', value: 104590, unit: 'ns/iter', range: '± 4590' },
              { name: 'comparison/singleton_resolution', value: 19.50, unit: 'ns/iter', range: '± 0.5' },
              { name: 'comparison/deep_dependency_chain', value: 17.60, unit: 'ns/iter', range: '± 0.4' },
              { name: 'comparison/container_creation', value: 767, unit: 'ns/iter', range: '± 28' },
              { name: 'scaling/10_services', value: 17.95, unit: 'ns/iter', range: '± 0.20' },
              { name: 'scaling/50_services', value: 17.85, unit: 'ns/iter', range: '± 0.35' },
              { name: 'scaling/100_services', value: 18.02, unit: 'ns/iter', range: '± 0.50' },
              { name: 'scaling/500_services', value: 18.80, unit: 'ns/iter', range: '± 0.85' }
            ]
          },
          {
            commit: {
              id: 'v0.1.0',
              message: 'Initial release',
              timestamp: new Date(now - 2 * day).toISOString(),
              url: 'https://github.com/pegasusheavy/dependency-injector/releases/tag/v0.1.0',
              author: { name: 'Developer', username: 'pegasusheavy' }
            },
            date: now - 2 * day,
            tool: 'cargo',
            benches: [
              { name: 'registration/singleton_small', value: 980, unit: 'ns/iter', range: '± 12' },
              { name: 'registration/singleton_medium', value: 990, unit: 'ns/iter', range: '± 11' },
              { name: 'registration/lazy', value: 1100, unit: 'ns/iter', range: '± 15' },
              { name: 'registration/transient', value: 920, unit: 'ns/iter', range: '± 8' },
              { name: 'resolution/get_singleton', value: 19.20, unit: 'ns/iter', range: '± 0.12' },
              { name: 'resolution/get_medium', value: 19.50, unit: 'ns/iter', range: '± 0.18' },
              { name: 'resolution/contains_check', value: 18.00, unit: 'ns/iter', range: '± 0.20' },
              { name: 'resolution/try_get_found', value: 19.50, unit: 'ns/iter', range: '± 0.18' },
              { name: 'resolution/try_get_not_found', value: 11.50, unit: 'ns/iter', range: '± 0.10' },
              { name: 'transient/get_transient', value: 26.00, unit: 'ns/iter', range: '± 0.35' },
              { name: 'scoped/create_scope', value: 850, unit: 'ns/iter', range: '± 10' },
              { name: 'scoped/resolve_from_parent', value: 39.00, unit: 'ns/iter', range: '± 0.40' },
              { name: 'scoped/resolve_override', value: 20.20, unit: 'ns/iter', range: '± 0.25' },
              { name: 'concurrent/concurrent_reads_4', value: 135000, unit: 'ns/iter', range: '± 6500' },
              { name: 'comparison/singleton_resolution', value: 19.50, unit: 'ns/iter', range: '± 0.5' },
              { name: 'comparison/deep_dependency_chain', value: 17.60, unit: 'ns/iter', range: '± 0.4' },
              { name: 'comparison/container_creation', value: 800, unit: 'ns/iter', range: '± 30' },
              { name: 'scaling/10_services', value: 18.50, unit: 'ns/iter', range: '± 0.25' },
              { name: 'scaling/50_services', value: 18.20, unit: 'ns/iter', range: '± 0.40' },
              { name: 'scaling/100_services', value: 18.50, unit: 'ns/iter', range: '± 0.55' },
              { name: 'scaling/500_services', value: 19.00, unit: 'ns/iter', range: '± 0.90' }
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

