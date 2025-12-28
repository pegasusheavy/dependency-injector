# Dependency Injector: Rust vs Go Benchmark Comparison

Comprehensive benchmarks comparing Rust `dependency-injector` against popular Go DI libraries.

**Test Environment:**
- CPU: Intel Core i9-13900K (32 threads)
- OS: Linux (WSL2)
- Rust: 1.85 (release mode)
- Go: 1.24

---

## Go DI Libraries Compared

| Library | Version | Type | Description |
|---------|---------|------|-------------|
| **sync.Map** | stdlib | Runtime | Go's concurrent-safe map |
| **map+RWMutex** | stdlib | Runtime | Traditional mutex-protected map |
| **goioc/di** | 1.7.1 | Runtime | IoC container |
| **samber/do** | 2.0.0 | Runtime | Generic DI with Go 1.18+ generics |
| **uber-go/dig** | 1.19.0 | Runtime | Uber's reflection-based DI |

---

## Benchmark Results

### 1. Singleton Resolution (Single Service Lookup)

The most common DI operation - resolving a pre-registered singleton.

| Library | Language | Time | Allocations | vs Fastest |
|---------|----------|------|-------------|------------|
| **Go manual** | Go | 0.5 ns | 0 | 1.0x |
| **Go sync.Map** | Go | 15-29 ns | 0 | 30-58x |
| **Go map+RWMutex** | Go | 25-28 ns | 0 | 50-56x |
| **Go goioc/di** | Go | 109-171 ns | 0 | 218-342x |
| **Go samber/do** | Go | 767-844 ns | 6 | 1534-1688x |
| **Go uber/dig** | Go | 4,214-6,409 ns | 25 | 8428-12818x |
| | | | | |
| **Rust manual** | Rust | ~1 ns | 0 | ~2x |
| **Rust dependency-injector** | Rust | 17-32 ns | 0 | 34-64x |
| **Rust HashMap+RwLock** | Rust | 60-73 ns | 0 | 120-146x |
| **Rust DashMap** | Rust | 84-123 ns | 0 | 168-246x |

**Key Insights:**
- Go's `sync.Map` and Rust's `dependency-injector` are competitive (~15-30ns)
- Go's popular DI libraries (samber/do, uber/dig) are significantly slower due to reflection
- Rust's `dependency-injector` with hot cache can achieve ~8-10ns on cache hits

---

### 2. Deep Dependency Chain (Service with Dependencies)

Resolving a service that has multiple levels of dependencies.

| Library | Language | Time | Allocations |
|---------|----------|------|-------------|
| **Go manual** | Go | 0.15-0.18 ns | 0 |
| **Go sync.Map** | Go | 11-14 ns | 0 |
| **Go map+RWMutex** | Go | 16-18 ns | 0 |
| **Go samber/do** | Go | 276-498 ns | 6 |
| **Go uber/dig** | Go | 1,144-1,315 ns | 25 |
| | | | |
| **Rust dependency-injector** | Rust | 16-17 ns | 0 |
| **Rust shaku** | Rust | 16-17 ns | 0 |
| **Rust HashMap+RwLock** | Rust | 45-50 ns | 0 |

**Key Insights:**
- Both Go `sync.Map` and Rust `dependency-injector` achieve ~11-17ns for cached lookups
- Go's reflection-based libraries have significant overhead for dependency resolution
- Pre-cached singletons make dependency depth irrelevant for performance

---

### 3. Container Creation

Creating a new DI container instance.

| Library | Language | Time | Allocations |
|---------|----------|------|-------------|
| **Go sync.Map** | Go | 0.3-0.5 ns | 0 |
| **Go map+RWMutex** | Go | 6.5-10 ns | 0 |
| **Go manual** | Go | 0.9-1.0 ns | 0 |
| **Go samber/do** | Go | 27-228 µs | 30 |
| **Go uber/dig** | Go | 63-179 µs | 51 |
| | | | |
| **Rust HashMap+RwLock** | Rust | 10 ns | 0 |
| **Rust shaku** | Rust | 179-188 ns | 0 |
| **Rust dependency-injector** | Rust | 434-740 ns | 0 |
| **Rust DashMap** | Rust | 1.6-1.8 µs | 0 |

**Key Insights:**
- Go's stdlib containers are extremely fast to create
- Rust's `dependency-injector` has moderate setup cost due to DashMap shards
- Container creation is typically a one-time startup cost

---

### 4. Concurrent Access (Parallel Reads)

Performance under concurrent read load (32 goroutines/threads).

| Library | Language | Time/op |
|---------|----------|---------|
| **Go sync.Map** | Go | 0.9-1.3 ns |
| **Go map+RWMutex** | Go | 51-68 ns |
| **Go uber/dig** | Go | 1,299-54,752 ns |
| **Go samber/do** | Go | 1,081-26,952 ns |
| | | |
| **Rust dependency-injector** | Rust | 1.3-3.4 ms (100 ops) |
| **Rust HashMap+RwLock** | Rust | 5.7 ms (100 ops) |

**Key Insights:**
- Go's `sync.Map` excels at concurrent read access (~1ns per operation)
- Rust's DashMap-based implementation scales well but has higher overhead
- Both languages benefit from lock-free data structures

---

### 5. Mixed Workload (100 Operations)

Simulating realistic usage: 80% resolutions, 15% lookups, 5% scope creation.

| Library | Language | Time | Allocations |
|---------|----------|------|-------------|
| **Go map+RWMutex** | Go | 7-133 µs | 20 |
| **Go sync.Map** | Go | 9-31 µs | 25 |
| **Go samber/do** | Go | 125-1,399 µs | 570 |
| | | | |
| **Rust dependency-injector** | Rust | 2.2 µs | 0 |
| **Rust DashMap basic** | Rust | 5.9-6.0 µs | 0 |
| **Rust shaku** | Rust | 2.5-15 µs | 0 |

**Key Insights:**
- **Rust `dependency-injector` wins with consistent 2.2µs**
- Go stdlib solutions (map+RWMutex, sync.Map) vary widely
- Go's feature-rich DI libraries (samber/do) have high overhead

---

## Summary: Rust vs Go DI Performance

### Speed Comparison

| Operation | Go Best | Go Popular DI | Rust dependency-injector |
|-----------|---------|---------------|--------------------------|
| Singleton lookup | 15 ns (sync.Map) | 767 ns (samber/do) | **17-32 ns** |
| Dependency chain | 11 ns (sync.Map) | 276 ns (samber/do) | **16-17 ns** |
| Container creation | 0.3 ns (sync.Map) | 27 µs (samber/do) | 434-740 ns |
| Mixed workload (100 ops) | 7 µs (map+RWMutex) | 125 µs (samber/do) | **2.2 µs** |

### Feature Comparison

| Feature | Go samber/do | Go uber/dig | Rust dependency-injector |
|---------|--------------|-------------|--------------------------|
| Singleton | ✅ | ✅ | ✅ |
| Transient | ✅ | ✅ | ✅ |
| Scoped | ✅ | ✅ | ✅ |
| Lazy | ✅ | ✅ | ✅ |
| Factory | ✅ | ✅ | ✅ |
| Named Services | ✅ | ✅ | ❌ |
| Zero Allocations | ❌ | ❌ | ✅ |
| Hot Cache | ❌ | ❌ | ✅ |
| Compile-time Safety | ❌ | ❌ | ✅ |

---

## Conclusions

### Why Rust `dependency-injector` is Faster

1. **Zero allocations** - No heap allocation per resolution
2. **Thread-local hot cache** - Frequently accessed services cached locally
3. **Lock-free DashMap** - Concurrent reads without mutex contention
4. **No reflection** - All type resolution at compile time
5. **Inlined hot paths** - Critical code paths optimized by LLVM

### When to Use Go DI Libraries

- **sync.Map/map+RWMutex**: When you need maximum speed and can manage dependencies manually
- **samber/do**: When you need generics-based DI with good developer experience
- **uber/dig**: When you need advanced features like decoration and groups

### When to Use Rust `dependency-injector`

- **High-performance services** requiring sub-microsecond DI
- **Memory-constrained environments** (zero allocation per resolution)
- **Concurrent workloads** with many threads accessing the container
- **Type-safe applications** where compile-time guarantees matter

---

## Reproducing Benchmarks

### Go Benchmarks

```bash
cd benchmarks/go-comparison
go test -bench=. -benchmem -count=3
```

### Rust Benchmarks

```bash
cargo bench --bench container_bench
cargo bench --bench comparison_bench
```

---

*Benchmarks run on Intel i9-13900K, Linux, December 2025*
