# Performance Optimization TODO

> Analysis for dependency-injector v0.1.12 - December 2024

## Current Benchmark Results

| Operation | v0.1.11 | v0.1.12 | Improvement | Target | Status |
|-----------|---------|---------|-------------|--------|--------|
| `get_singleton` | 14.7 ns | **9.4 ns** | **36% faster** | <10 ns | ✅ |
| `get_medium` | 14.9 ns | **9.2 ns** | **38% faster** | <10 ns | ✅ |
| `contains_check` | 10.9 ns | **10.7 ns** | **2% faster** | <10 ns | 🎯 |
| `try_get_found` | 14.4 ns | **9.2 ns** | **35% faster** | <10 ns | ✅ |
| `try_get_not_found` | 21.4 ns | **12.7 ns** | **40% faster** | <15 ns | ✅ |
| `get_transient` | 43 ns | **24.2 ns** | **44% faster** | <30 ns | ✅ |
| `create_scope` | 137 ns | **101 ns** | **26% faster** | <100 ns | 🎯 |
| `scope_pool_acquire` | 87 ns | **88 ns** | same | - | ✅ |
| `resolve_from_parent` | 14.4 ns | **9.4 ns** | **35% faster** | <10 ns | ✅ |
| `resolve_override` | 17 ns | **9.4 ns** | **45% faster** | <10 ns | ✅ |

### Performance Summary

The v0.1.12 optimizations (fast bit-mixing hash + single DashMap lookup) have eliminated
previous trade-offs. All benchmarks are now faster than the baseline:

- **Singleton/lazy**: ~9ns (hot cache hits almost always)
- **Transients**: ~24ns (single lookup, no redundant is_transient check)
- **Not found**: ~13ns (fast hash means quick cache miss detection)
- **Contains check**: ~11ns (minimal overhead)

The hot cache now provides consistent speedups across all service types.

### Comparison with Alternatives

| Approach | Resolution | Container Creation | 4-Thread Concurrent |
|----------|------------|-------------------|---------------------|
| Manual DI (baseline) | **8 ns** | 88 ns | N/A |
| HashMap + RwLock | 20.5 ns | **7.6 ns** | 93 µs |
| DashMap (basic) | 20.7 ns | 670 ns | **89 µs** |
| **dependency-injector** | **9.4 ns** | 101 ns | ~90 µs |

dependency-injector is now **within 1.4ns of manual DI** while providing full runtime DI features!

### Fuzzing Status ✅

All fuzz targets pass with no crashes:
- `fuzz_container`: 1.1M+ runs
- `fuzz_concurrent`: 11K+ runs
- `fuzz_scoped`: 808K+ runs
- `fuzz_lifecycle`: Passing

---

## Future Optimization Opportunities

### Medium Priority

#### 2. Single-Thread Feature with Rc<T> ❌ SKIPPED
**Gap Analysis:** Arc allocation ~10ns, Rc allocation ~5ns.

**Reason Skipped:** Requires complete codebase refactor. DashMap requires `Send + Sync`
values, so swapping `Arc` for `Rc` also requires replacing `DashMap` with
`RefCell<HashMap>`. The maintenance burden of two separate implementations
outweighs the ~5ns benefit per transient.

**Alternative:** For CLI tools needing maximum performance, consider using
transient factories sparingly or pre-warming services at startup.

---

### Low Priority

#### 5. Perfect Hashing for Static Containers ✅ IMPLEMENTED
Implemented `FrozenStorage` with minimal perfect hashing using `boomphf` crate.

**Results:**
- `frozen_contains`: **3.9ns** (vs ~10ns for DashMap) - **60% faster**
- `frozen_resolve`: **14.5ns** (vs 13.8ns for Container) - slight overhead

**Conclusion:** Perfect hashing helps `contains()` significantly but `resolve()` has overhead
from TypeId verification. The hot cache in Container already provides better performance
for repeated lookups.

**API:** `container.freeze()` returns `FrozenStorage` (requires `perfect-hash` feature)

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

### Phase 9 (v0.1.10) ✅
- **Deep parent chain resolution** - Services can now be resolved from grandparents and beyond
- `ServiceStorage` now holds optional parent reference for chain walking
- `resolve_from_parents` walks the full ancestor chain
- `contains_in_chain` checks all ancestors
- Added `test_deep_parent_chain` test with 4-level hierarchy
- Benchmarks maintained: `create_scope` 97ns, `resolve_from_parent` 13.6ns

### Phase 10 (v0.1.11) ✅
- **Perfect hashing** for frozen containers using `boomphf` crate
- `container.freeze()` creates `FrozenStorage` with O(1) lookup via MPHF
- `frozen_contains`: **3.9ns** (60% faster than DashMap ~10ns)
- `frozen_resolve`: 14.5ns (similar to Container due to TypeId verification overhead)
- Best use case: frequent `contains()` checks on locked containers

### Phase 11 (v0.1.12) ✅
- **Fast bit-mixing hash** in hot cache - replaced DefaultHasher with golden ratio multiplication
- **Single DashMap lookup** for service + transient flag - avoids second lookup for caching decision
- Resolution benchmarks improved dramatically:
  - `get_singleton`: **9.4ns** (was 14.7ns) - **36% faster**
  - `get_medium`: **9.2ns** (was 14.9ns) - **38% faster**
  - `try_get_found`: **9.2ns** (was 14.4ns) - **35% faster**
  - `try_get_not_found`: **12.7ns** (was 21.4ns) - **40% faster**
  - `get_transient`: **24.2ns** (was 43ns) - **44% faster**
  - `resolve_from_parent`: **9.4ns** (was 14.4ns) - **35% faster**
  - `resolve_override`: **9.4ns** (was 17ns) - **45% faster**
  - `create_scope`: **101ns** (was 137ns) - **26% faster**

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
- **Fast bit-mixing hash** in hot cache (golden ratio multiplication)
- **Single DashMap lookup** via `get_with_transient_flag()` for service + caching decision
- `get_singleton`: 14.7ns → **9.4ns** (36% faster)
- `get_transient`: 43ns → **24.2ns** (44% faster)
- `try_get_not_found`: 21.4ns → **12.7ns** (40% faster)
- `create_scope`: 137ns → **101ns** (26% faster)
- All resolution benchmarks now under 10ns for cached services!

### v0.1.11
- Added `perfect-hash` feature for frozen containers with MPHF
- `FrozenStorage` provides O(1) lookup via minimal perfect hashing
- `container.freeze()` method creates frozen storage
- `frozen_contains()` is 60% faster than DashMap (3.9ns vs ~10ns)
- Implemented `Clone` for `AnyFactory` (converts lazy to singleton on clone)

### v0.1.10
- Deep parent chain resolution for multi-level hierarchies
- `ServiceStorage` now holds parent reference for chain walking
- `resolve_from_parents` walks full ancestor chain (was only immediate parent)
- `contains_in_chain` checks all ancestors for service existence
- Added `test_deep_parent_chain` test with 4-level hierarchy validation

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
