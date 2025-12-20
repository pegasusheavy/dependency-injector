# Performance Optimization TODO

> Analysis for dependency-injector v0.1.7 - December 2024

## Current Benchmark Results

| Operation | v0.1.5 | v0.1.7 | Improvement | Target | Status |
|-----------|--------|--------|-------------|--------|--------|
| `get_singleton` | 18.7 ns | **14.8 ns** | **21% faster** | <12 ns | 🎯 |
| `get_medium` | 18.8 ns | **13.8 ns** | **27% faster** | <12 ns | 🎯 |
| `contains_check` | 10.8 ns | **13.0 ns** | -20% (cache check) | <10 ns | ⚠️ |
| `try_get_found` | 18.8 ns | **14.6 ns** | **22% faster** | <12 ns | 🎯 |
| `try_get_not_found` | 10.9 ns | **16.7 ns** | -53% (cache miss) | N/A | ⚠️ |
| `get_transient` | 25 ns | **39.5 ns** | -58% (cache miss) | N/A | ⚠️ |
| `create_scope` | 129 ns | **121 ns** | **6% faster** | <100 ns | 🔄 |
| `scope_pool_acquire` | N/A | **84.5 ns** | **30% faster** than create_scope | - | ✅ |
| `resolve_from_parent` | 28.7 ns | **14.8 ns** | **48% faster** | <15 ns | ✅ |
| `resolve_override` | 19 ns | **14.6 ns** | **23% faster** | <15 ns | ✅ |

### Trade-offs

The thread-local hot cache provides significant speedups for **singleton and lazy services** (the common case) at the cost of:
- Transient resolution is slower (~40ns vs ~25ns) due to cache miss overhead
- `try_get_not_found` is slower (~17ns vs ~11ns) for the same reason
- `contains_check` is slightly slower (~13ns vs ~11ns)

This is an acceptable trade-off because:
1. Singletons/lazy services are resolved far more often than transients
2. The "not found" case is typically an error condition, not a hot path

### Comparison with Alternatives

| Approach | Resolution | Container Creation | 4-Thread Concurrent |
|----------|------------|-------------------|---------------------|
| Manual DI (baseline) | **8 ns** | 88 ns | N/A |
| HashMap + RwLock | 20.5 ns | **7.6 ns** | 93 µs |
| DashMap (basic) | 20.7 ns | 670 ns | **89 µs** |
| **dependency-injector** | **14.8 ns** | 121 ns | 106 µs |

### Fuzzing Status ✅

All fuzz targets pass with no crashes:
- `fuzz_container`: 1.1M+ runs
- `fuzz_concurrent`: 11K+ runs
- `fuzz_scoped`: 808K+ runs
- `fuzz_lifecycle`: Passing

---

## Future Optimization Opportunities

### Medium Priority

#### 2. Deep Parent Chain Optimization
**Gap Analysis:** Parent resolution is now 14.8ns but only checks immediate parent.

**Current Issue:** Only checks immediate parent, not full chain.

**Solution:** Walk full parent chain with cached references:
```rust
fn resolve_from_parents<T: Injectable>(&self) -> Result<Arc<T>> {
    let mut current = self.parent_storage.as_ref();
    while let Some(storage) = current {
        if let Some(factory) = storage.factories.get(&TypeId::of::<T>()) {
            return Ok(factory.resolve().downcast::<T>().unwrap());
        }
        current = storage.parent.as_ref();
    }
    Err(DiError::not_found::<T>())
}
```

**Expected Improvement:** Better support for deep hierarchies (5+ levels)
**Complexity:** Low
**Risk:** Low

---

#### 4. Single-Thread Feature with Rc<T>
**Gap Analysis:** Arc allocation ~10ns, Rc allocation ~5ns.

**Solution:** Feature-gated single-thread mode for CLI tools:
```rust
#[cfg(feature = "single-thread")]
type SmartPtr<T> = Rc<T>;

#[cfg(not(feature = "single-thread"))]
type SmartPtr<T> = Arc<T>;
```

**Expected Improvement:** ~5 ns per transient creation
**Complexity:** Medium (API changes)
**Risk:** Low

---

### Low Priority

#### 5. Perfect Hashing for Static Containers
For containers with known service sets at startup, use perfect hashing instead of DashMap.

**Expected Improvement:** ~5 ns for resolution
**Complexity:** High
**Risk:** Medium

---

#### 6. Profile-Guided Optimization (PGO)
Build with PGO for production deployments.

```bash
# Build with instrumentation
RUSTFLAGS="-Cprofile-generate=/tmp/pgo" cargo build --release

# Run benchmarks to generate profile
./target/release/bench

# Rebuild with profile data
RUSTFLAGS="-Cprofile-use=/tmp/pgo" cargo build --release
```

**Expected Improvement:** 5-15% overall
**Complexity:** Low (build process only)
**Risk:** Low

---

## Completed Optimizations

### Phase 1 (v0.1.2) ✅
- Replaced `RwLock<bool>` with `AtomicBool` for lock state
- Optimized DashMap shard count (8 shards)
- Removed `parking_lot` dependency

### Phase 2 (v0.1.3) ✅
- Enum-based `AnyFactory` (eliminated vtable indirection)
- Pre-erased `Arc<dyn Any>` in factories
- Cached parent `Arc<ServiceStorage>`

### Phase 3 (v0.1.4) ✅
- Batch registration API
- BatchRegistrar struct

### Phase 4 (v0.1.5) ✅
- `#[derive(Inject)]` macro
- `#[inject]` and `#[inject(optional)]` attributes
- `from_container()` generation

### Phase 5 (v0.1.6) ✅
- Thread-local hot cache for frequently accessed services
- 4-slot direct-mapped cache with TypeId + storage pointer as key
- `clear_cache()` and `warm_cache<T>()` methods
- **21% faster** singleton resolution (18.7ns → 14.8ns)
- **48% faster** parent resolution (28.7ns → 14.8ns)

### Phase 6 (v0.1.7) ✅
- **ScopePool** for high-throughput web servers
- Pre-allocates and reuses scope instances
- **PooledScope** RAII guard for automatic release
- **30% faster** than regular scope creation (121ns → 84.5ns)
- New methods: `ScopePool::new()`, `pool.acquire()`, `pool.available_count()`

### Phase 7 (v0.1.8) ✅
- **Fluent batch registration** - `container.register_batch().singleton(A).singleton(B).done()`
- Eliminates closure overhead in batch registration
- Fluent API is now **~1% faster** than individual registrations (243ns vs 246ns)
- Closure-based `batch()` kept for ergonomics (333ns, still useful for grouping)

### Phase 8 (v0.1.9) ✅
- **Unsafe unchecked downcast** - Skip runtime type checking in `Arc::downcast()`
- Safe because TypeId lookup guarantees type correctness
- Resolution benchmarks improved:
  - `get_singleton`: **-6.6%** (14.8ns → 13.8ns)
  - `get_medium`: **-4.2%** (13.9ns → 13.3ns)
  - `try_get_found`: **-5.7%** (14.7ns → 13.9ns)
  - `contains_check`: **-19.7%** (13.0ns → 10.4ns)

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

### v0.1.9
- Unsafe unchecked downcast for ~5-7% faster resolution
- `downcast_arc_unchecked` avoids runtime type check (TypeId already verified)
- Resolution benchmarks: `get_singleton` 14.8→13.8ns, `contains_check` 13→10.4ns

### v0.1.8
- Added fluent batch registration: `container.register_batch().singleton(A).done()`
- `BatchBuilder` for chainable registrations without closure overhead
- Fluent batch is **~1% faster** than individual registrations (243ns vs 246ns)
- Closure-based `batch()` retained for ergonomics

### v0.1.7
- Added `ScopePool` for pre-allocated scope reuse
- Added `PooledScope` RAII guard for automatic release
- **30% faster** scope acquisition vs regular creation
- Ideal for high-throughput web servers (1000s of req/sec)

### v0.1.6
- Added thread-local hot cache for frequently accessed services
- **21% faster** singleton resolution (18.7ns → 14.8ns)
- **48% faster** parent resolution (28.7ns → 14.8ns)
- Trade-off: transient resolution slower due to cache miss overhead

### v0.1.5
- Added `#[derive(Inject)]` compile-time DI macro
- All fuzz targets passing

### v0.1.4
- Batch registration API

### v0.1.3
- Enum-based AnyFactory

### v0.1.2
- AtomicBool lock state

---

*Last updated: December 2024*
*Fuzzing: All targets passing (1M+ iterations)*
*Next focus: Batch registration fix, faster Arc downcast*
