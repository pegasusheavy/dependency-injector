# Performance Optimization TODO

> dependency-injector v0.2.0 - December 2025

## Current Benchmark Results

| Operation | Time | Target | Status |
|-----------|------|--------|--------|
| `get_singleton` | **~9.8 ns** | <8 ns | 🎯 |
| `get_medium` | **~9.6 ns** | <8 ns | 🎯 |
| `contains_check` | **~11.7 ns** | <10 ns | 🔲 |
| `try_get_found` | **~9.6 ns** | <8 ns | 🎯 |
| `try_get_not_found` | **~13.7 ns** | <15 ns | ✅ |
| `get_transient` | **~24 ns** | <30 ns | ✅ |
| `create_scope` | **~80-110 ns** | <100 ns | ✅ |
| `scope_pool_acquire` | **~56 ns** | <60 ns | ✅ |

### Performance Summary

- **Singleton/lazy**: ~9.8ns (thread-local hot cache)
- **Transients**: ~24ns (factory invocation overhead)
- **Not found**: ~13.7ns (cache miss + error path)
- **Contains check**: ~11.7ns (DashMap lookup)
- **Scope creation**: ~80-110ns (4-shard DashMap)
- **Scope pool**: ~56ns (pre-allocated reuse)

### Comparison with Alternatives

| Approach | Resolution | Container Creation | 4-Thread Concurrent |
|----------|------------|-------------------|---------------------|
| Manual DI (baseline) | **8.4 ns** | 95 ns | N/A |
| HashMap + RwLock | 21.5 ns | **7.6 ns** | 93 µs |
| DashMap (basic) | 22.2 ns | 670 ns | **89 µs** |
| **dependency-injector** | **~9.8 ns** | ~80-110 ns | ~90 µs |

**Gap to manual DI: ~1.4ns** - target optimizations below to close this gap!

---

## Path to 8ns Resolution

Current: **~9.8ns** | Target: **8ns** | Gap: **~1.8ns**

### Hot Path Analysis

The current resolution path costs breakdown:
1. `thread_local!` access: ~2-3ns
2. `RefCell::borrow()`: ~1ns
3. TypeId comparison: ~0.5ns
4. Arc clone: ~2ns
5. Unchecked downcast: ~0.5ns

Manual DI is just `Arc::clone` (~2ns) + field access (~0.5ns) = ~2.5ns base cost.

### Phase 12: Replace RefCell with UnsafeCell (~0.5-1ns savings)

**Status:** 🔲 TODO

Since `HotCache` is thread-local and single-threaded, `RefCell` bounds checks are unnecessary overhead.

```rust
// Before
thread_local! {
    static HOT_CACHE: RefCell<HotCache> = RefCell::new(HotCache::new());
}

// After
thread_local! {
    static HOT_CACHE: UnsafeCell<HotCache> = UnsafeCell::new(HotCache::new());
}

// SAFETY: thread_local guarantees single-threaded access
let cache = unsafe { &mut *HOT_CACHE.with(|c| c.get()) };
```

**Expected:** 9.8ns → ~9.3ns

### Phase 13: Inline TypeId Storage (~0.3ns savings)

**Status:** 🔲 TODO

Store `u64` hash instead of `TypeId` to avoid transmute on every comparison.

```rust
struct CacheEntry {
    type_hash: u64,  // Pre-computed from TypeId
    storage_ptr: usize,
    service: Arc<dyn Any + Send + Sync>,
}
```

**Expected:** 9.3ns → ~9.0ns

### Phase 14: Cold Path Annotations (~0.2ns savings)

**Status:** 🔲 TODO

Mark error paths as cold to improve branch prediction:

```rust
#[cold]
#[inline(never)]
fn resolve_from_parents<T>(...) -> Result<Arc<T>> { ... }
```

**Expected:** 9.0ns → ~8.8ns

### Phase 15: Specialize for Common Case (~0.3ns savings)

**Status:** 🔲 TODO

Create a fast path for root containers (no parent check):

```rust
#[inline]
pub fn get<T: Injectable>(&self) -> Result<Arc<T>> {
    if self.depth == 0 {
        return self.get_from_root::<T>();  // No parent walk
    }
    self.get_with_parents::<T>()
}
```

**Expected:** 8.8ns → ~8.5ns

### Phase 16: Profile-Guided Optimization (PGO)

**Status:** 🔲 TODO

Build with PGO for production (5-15% improvement):

```bash
RUSTFLAGS="-Cprofile-generate=/tmp/pgo" cargo build --release
./target/release/bench
RUSTFLAGS="-Cprofile-use=/tmp/pgo" cargo build --release
```

**Expected:** 8.5ns → ~8.0ns

---

## Summary: Reaching 8ns

| Phase | Optimization | Savings | Cumulative |
|-------|--------------|---------|------------|
| Current | Baseline | - | 9.8ns |
| 12 | UnsafeCell | -0.5ns | 9.3ns |
| 13 | Inline TypeId | -0.3ns | 9.0ns |
| 14 | Cold paths | -0.2ns | 8.8ns |
| 15 | Root fast-path | -0.3ns | 8.5ns |
| 16 | PGO | -0.5ns | **8.0ns** |

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
