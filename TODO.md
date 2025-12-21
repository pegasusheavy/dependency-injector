# Performance Optimization TODO

> dependency-injector v0.2.0 - December 2025

## Current Benchmark Results

| Operation | Time | Target | Status |
|-----------|------|--------|--------|
| `get_singleton` | **~9.4 ns** | <8 ns | 🎯 |
| `get_medium` | **~9.5 ns** | <8 ns | 🎯 |
| `contains_check` | **~11.0 ns** | <10 ns | 🔲 |
| `try_get_found` | **~9.5 ns** | <8 ns | 🎯 |
| `try_get_not_found` | **~10.9 ns** | <15 ns | ✅ |
| `get_transient` | **~24 ns** | <30 ns | ✅ |
| `create_scope` | **~80-110 ns** | <100 ns | ✅ |
| `scope_pool_acquire` | **~56 ns** | <60 ns | ✅ |

### Performance Summary

- **Singleton/lazy**: ~9.4ns (UnsafeCell + type hash optimization)
- **Transients**: ~24ns (factory invocation overhead)
- **Not found**: ~10.9ns (root fast-path optimization)
- **Contains check**: ~11ns (DashMap lookup)
- **Scope creation**: ~80-110ns (4-shard DashMap)
- **Scope pool**: ~56ns (pre-allocated reuse)

### Comparison with Alternatives

| Approach | Resolution | Container Creation | 4-Thread Concurrent |
|----------|------------|-------------------|---------------------|
| Manual DI (baseline) | **8.4 ns** | 95 ns | N/A |
| HashMap + RwLock | 21.5 ns | **7.6 ns** | 93 µs |
| DashMap (basic) | 22.2 ns | 670 ns | **89 µs** |
| **dependency-injector** | **~9.4 ns** | ~80-110 ns | ~90 µs |

**Gap to manual DI: ~1.0ns** - only 12% overhead vs hand-written DI!

---

## Path to 8ns Resolution

Current: **~9.4ns** | Target: **8ns** | Gap: **~1.4ns**

### Completed Optimizations

#### Phase 12: Replace RefCell with UnsafeCell ✅

Since `HotCache` is thread-local and single-threaded, `RefCell` bounds checks are unnecessary.

**Result:** ~0.4ns savings

#### Phase 13: Inline TypeId Storage ✅

Store `u64` hash instead of `TypeId` to avoid transmute on every comparison.

**Result:** ~0.3ns savings

#### Phase 14: Cold Path Annotations ✅

Marked `resolve_from_parents` as `#[cold]` to improve branch prediction.

**Result:** Improved branch prediction

#### Phase 15: Root Container Fast-Path ✅

Skip parent chain walk when `depth == 0`.

**Result:** `try_get_not_found` improved 13% (12.6ns → 10.9ns)

### Remaining Optimization

#### Phase 16: Profile-Guided Optimization (PGO)

**Status:** 🔲 TODO

Build with PGO for production (5-15% improvement):

```bash
RUSTFLAGS="-Cprofile-generate=/tmp/pgo" cargo build --release
./target/release/bench
RUSTFLAGS="-Cprofile-use=/tmp/pgo" cargo build --release
```

**Expected:** 9.4ns → ~8.0ns

---

## Summary: Progress to 8ns

| Phase | Optimization | Result | Current |
|-------|--------------|--------|---------|
| Baseline | - | - | 9.8ns |
| 12 | UnsafeCell | ✅ -0.4ns | 9.4ns |
| 13 | Inline TypeId | ✅ (combined) | 9.4ns |
| 14 | Cold paths | ✅ | 9.4ns |
| 15 | Root fast-path | ✅ | **9.4ns** |
| 16 | PGO | 🔲 | ~8.0ns |

---

## Other Opportunities

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

*Last updated: December 2025*
*Fuzzing: All targets passing (1M+ iterations)*
*See [CHANGELOG.md](CHANGELOG.md) for version history*
