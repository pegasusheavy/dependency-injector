# Rust Dependency Injection Library Comparison

Benchmarked on December 2025 with Rust 1.85.

## Libraries Compared

| Library | Version | Type | Features |
|---------|---------|------|----------|
| **dependency-injector** | 0.2.1 | Runtime | Lock-free, scopes, hot cache, concurrent |
| **shaku** | 0.6.2 | Compile-time | Derive macros, interfaces, modules |
| **ferrous-di** | 0.2.0 | Runtime | Scopes, factories, named services |
| Manual DI | - | Baseline | Direct `Arc<T>` construction |
| HashMap + RwLock | - | Runtime | Basic thread-safe DI |
| DashMap | - | Runtime | Lock-free concurrent map |

---

## Benchmark Results

### 1. Singleton Resolution (Single Service Lookup)

The most common operation in DI - resolving an already-registered singleton.

| Library | Time (ns) | Throughput | vs Best |
|---------|-----------|------------|---------|
| **shaku** | 17-21 | ~48 Melem/s | 1.0x |
| **dependency-injector** | 18-24* | ~42 Melem/s | 1.1x |
| manual_di | 21-23 | ~44 Melem/s | 1.1x |
| ferrous_di | 57-70 | ~15 Melem/s | 3.3x |
| hashmap_rwlock | 60-73 | ~14 Melem/s | 3.5x |
| dashmap_basic | 84-123 | ~8 Melem/s | 5.8x |

*dependency-injector includes thread-local hot cache that approaches ~8-10ns on cache hit

**Key Insights:**
- Compile-time DI (shaku) and dependency-injector's hot cache achieve near-manual performance
- ferrous-di is ~3x slower due to runtime type checks
- Basic implementations (HashMap + RwLock) are 3-6x slower

---

### 2. Deep Dependency Chain (Resolving Service with Dependencies)

Resolving a service that has multiple levels of dependencies (Config → Database → Repository → Service).

| Library | Time (ns) | vs Best |
|---------|-----------|---------|
| **shaku** | 16-17 | 1.0x |
| **dependency-injector** | 16-17 | 1.0x |
| manual_di | 17-19 | 1.1x |
| hashmap_rwlock | 45-50 | 2.9x |
| ferrous_di | 49-53 | 3.1x |
| dashmap_basic | 54-63 | 3.7x |

**Key Insights:**
- Both shaku and dependency-injector match manual DI performance
- Pre-cached singletons eliminate runtime dependency resolution
- Runtime factories would show larger differences

---

### 3. Container Creation

Creating a new DI container instance.

| Library | Time | vs Best |
|---------|------|---------|
| hashmap_rwlock | 10 ns | 1.0x |
| shaku | 179-188 ns | 18x |
| manual_di | 201-316 ns | 20-32x |
| **dependency-injector** | 434-740 ns | 43-74x |
| dashmap_basic | 1.6-1.8 µs | 160-180x |
| ferrous_di | 2.0-2.2 µs | 200-220x |

**Key Insights:**
- Simple HashMap is fastest to create
- dependency-injector has moderate setup cost (DashMap shards + hot cache)
- Creation typically happens once at startup, so this is rarely a bottleneck

---

### 4. Mixed Workload (Realistic Usage Pattern)

Simulating web server workload: 80% service resolution, 15% contains checks, 5% scope creation.

| Library | Time (100 ops) | Throughput | vs Best |
|---------|---------------|------------|---------|
| **dependency-injector** | 2.2 µs | ~45 Melem/s | 1.0x |
| shaku | 2.5-15 µs* | ~7-40 Melem/s | 1.1-6.8x |
| dashmap_basic | 5.9-6.0 µs | ~17 Melem/s | 2.7x |
| ferrous_di | 7.6-11.3 µs | ~9 Melem/s | 3.4-5.1x |

*shaku shows high variance due to module rebuild for scopes

**Key Insights:**
- dependency-injector excels in mixed workloads with scoping
- shaku's rebuild requirement for new modules causes variance
- ferrous-di's scope creation is slower

---

### 5. Service Count Scaling

Performance with increasing number of registered services.

| Services | dependency-injector | dashmap_basic |
|----------|---------------------|---------------|
| 10 | 26-28 ns | 44-48 ns |
| 50 | 25-29 ns | 80-154 ns |
| 100 | 11-13 ns | 45-48 ns |
| 500 | 18-19 ns | 24 ns |

**Key Insights:**
- Both scale well due to O(1) hash lookups
- Hot cache keeps dependency-injector consistent regardless of size
- DashMap sharding provides good scalability

---

## Feature Comparison

| Feature | dependency-injector | shaku | ferrous-di |
|---------|---------------------|-------|------------|
| Singleton | ✅ | ✅ | ✅ |
| Transient | ✅ | ✅ (via Provider) | ✅ |
| Scoped | ✅ | ❌ | ✅ |
| Lazy Singleton | ✅ | ❌ | ✅ |
| Factory | ✅ | ✅ | ✅ |
| Named Services | ❌ | ❌ | ✅ |
| Thread-safe | ✅ | ✅ | ✅ |
| Hot Cache | ✅ | ❌ | ❌ |
| Compile-time checks | ❌ | ✅ | ❌ |
| Derive macros | ✅ | ✅ | ❌ |
| Async support | ✅ | ✅ | ✅ |

---

## When to Use Each

### dependency-injector
**Best for:** High-performance applications needing runtime flexibility, scoping, and concurrent access.
- Web servers with request-scoped services
- Applications with dynamic service registration
- Microservices requiring <50ns resolution

### shaku
**Best for:** Applications prioritizing compile-time safety over runtime flexibility.
- Projects where all dependencies are known at compile time
- Teams preferring explicit interface definitions
- Applications not requiring runtime scoping

### ferrous-di
**Best for:** Enterprise applications needing familiar .NET-style DI patterns.
- Teams coming from C#/.NET background
- Applications requiring named service resolution
- Projects valuing API familiarity over raw performance

---

## Conclusion

| Metric | Winner |
|--------|--------|
| Singleton Resolution | shaku / dependency-injector (tie) |
| Dependency Chains | shaku / dependency-injector (tie) |
| Container Creation | HashMap (but rarely matters) |
| Mixed Workloads | **dependency-injector** |
| Scalability | Both excellent |
| Feature Set | **dependency-injector** (scopes + hot cache) |
| Compile-time Safety | **shaku** |
| .NET Familiarity | ferrous-di |

**dependency-injector** provides the best balance of **performance** and **features** for runtime DI:
- Near-manual performance (~17ns) with hot cache
- Full scoping support for request-scoped services
- Lock-free concurrent access with DashMap
- Scales to 500+ services without degradation

---

*Benchmarks run on Linux x86_64, Rust 1.85, release mode*
*See `benches/comparison_bench.rs` for full benchmark code*

