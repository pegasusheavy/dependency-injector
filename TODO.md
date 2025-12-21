# Performance Optimization TODO

> dependency-injector v0.2.0 - December 2024

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

*Last updated: December 2024*
*Fuzzing: All targets passing (1M+ iterations)*
*See [CHANGELOG.md](CHANGELOG.md) for version history*
