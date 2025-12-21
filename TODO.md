# Performance Optimization TODO

> dependency-injector v0.1.12 - December 2024

## Current Benchmark Results

| Operation | Time | Target | Status |
|-----------|------|--------|--------|
| `get_singleton` | **~9 ns** | <10 ns | ✅ |
| `get_medium` | **~9 ns** | <10 ns | ✅ |
| `contains_check` | **~10.5 ns** | <10 ns | 🎯 |
| `try_get_found` | **~9 ns** | <10 ns | ✅ |
| `try_get_not_found` | **~12 ns** | <15 ns | ✅ |
| `get_transient` | **~24 ns** | <30 ns | ✅ |
| `create_scope` | **~80-110 ns** | <100 ns | ✅ |
| `scope_pool_acquire` | **~56 ns** | <60 ns | ✅ |
| `resolve_from_parent` | **~9 ns** | <10 ns | ✅ |
| `resolve_override` | **~9 ns** | <10 ns | ✅ |

### Performance Summary

- **Singleton/lazy**: ~9ns (thread-local hot cache)
- **Transients**: ~24ns (single DashMap lookup)
- **Not found**: ~12ns (fast bit-mixing hash)
- **Contains check**: ~10.5ns (DashMap baseline)
- **Scope creation**: ~80-110ns (4-shard DashMap)
- **Scope pool**: ~56ns (pre-allocated reuse)

### Comparison with Alternatives

| Approach | Resolution | Container Creation | 4-Thread Concurrent |
|----------|------------|-------------------|---------------------|
| Manual DI (baseline) | **8 ns** | 88 ns | N/A |
| HashMap + RwLock | 20.5 ns | **7.6 ns** | 93 µs |
| DashMap (basic) | 20.7 ns | 670 ns | **89 µs** |
| **dependency-injector** | **~9 ns** | ~80-110 ns | ~90 µs |

**Within ~1ns of manual DI** while providing full runtime DI features!

---

## Future Optimization Opportunities

### Profile-Guided Optimization (PGO)

Build with PGO for production deployments (5-15% improvement).

```bash
# Build with instrumentation
RUSTFLAGS="-Cprofile-generate=/tmp/pgo" cargo build --release

# Run benchmarks to generate profile
./target/release/bench

# Rebuild with profile data
RUSTFLAGS="-Cprofile-use=/tmp/pgo" cargo build --release
```

### Contains Check (<10ns target)

Currently ~10.5ns, limited by DashMap `contains_key` overhead.
Options:
- Use `FrozenStorage` for locked containers (3.9ns)
- Accept current performance (only 0.5ns over target)

---

## Benchmarking Commands

```bash
# Run all benchmarks
cargo bench

# Run specific benchmark
cargo bench --bench container_bench -- "resolution"

# Run comparison benchmarks
cargo bench --bench comparison_bench

# Run with profiling (requires perf/dtrace)
cargo flamegraph --bench container_bench -- --bench

# Run fuzzing (requires nightly)
cd fuzz && cargo +nightly fuzz run fuzz_container -- -max_total_time=60
```

---

## Changelog

### v0.1.12
- Fast bit-mixing hash in hot cache (golden ratio multiplication)
- Single DashMap lookup via `get_with_transient_flag()`
- Reduced shard count for child scopes (8 → 4)
- All resolution benchmarks now **under 10ns** for cached services

### v0.1.11
- `perfect-hash` feature with `FrozenStorage` (MPHF)
- `container.freeze()` for O(1) lookup
- `frozen_contains`: 3.9ns (60% faster than DashMap)

### v0.1.10
- Deep parent chain resolution (grandparents and beyond)

### v0.1.9
- Unsafe unchecked downcast (~5-7% faster resolution)

### v0.1.8
- Fluent batch registration API

### v0.1.7
- `ScopePool` for high-throughput web servers

### v0.1.6
- Thread-local hot cache

### v0.1.5
- `#[derive(Inject)]` macro

### v0.1.2-v0.1.4
- AtomicBool lock, enum-based factories, batch API

---

*Last updated: December 2024*
*Fuzzing: All targets passing (1M+ iterations)*
