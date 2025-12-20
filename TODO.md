# Performance Optimization TODO

> Analysis for dependency-injector v0.1.6 - December 2024

## Current Benchmark Results

| Operation | v0.1.5 | v0.1.6 | Improvement | Target | Status |
|-----------|--------|--------|-------------|--------|--------|
| `get_singleton` | 18.7 ns | **15.3 ns** | **18% faster** | <12 ns | 🎯 |
| `get_medium` | 18.8 ns | **15.3 ns** | **19% faster** | <12 ns | 🎯 |
| `contains_check` | 10.8 ns | **10.9 ns** | - | <10 ns | ✅ |
| `try_get_found` | 18.8 ns | **15.4 ns** | **18% faster** | <12 ns | 🎯 |
| `try_get_not_found` | 10.9 ns | **17.6 ns** | -61% (cache miss) | N/A | ⚠️ |
| `get_transient` | 25 ns | **43.5 ns** | -74% (cache miss) | N/A | ⚠️ |
| `create_scope` | 129 ns | **134 ns** | - | <100 ns | 🔄 |
| `resolve_from_parent` | 28.7 ns | **15.4 ns** | **46% faster** | <20 ns | ✅ |
| `resolve_override` | 19 ns | **15.9 ns** | **16% faster** | <15 ns | ✅ |
| `concurrent_reads_4` | 92 µs | **106 µs** | -15% | <80 µs | 🔄 |

### Trade-offs

The thread-local hot cache provides significant speedups for **singleton and lazy services** (the common case) at the cost of:
- Transient resolution is slower (~43ns vs ~25ns) due to cache miss overhead
- `try_get_not_found` is slower (~17ns vs ~11ns) for the same reason

This is an acceptable trade-off because:
1. Singletons/lazy services are resolved far more often than transients
2. The "not found" case is typically an error condition, not a hot path

### Comparison with Alternatives

| Approach | Resolution | Container Creation | 4-Thread Concurrent |
|----------|------------|-------------------|---------------------|
| Manual DI (baseline) | **8 ns** | 88 ns | N/A |
| HashMap + RwLock | 20.5 ns | **7.6 ns** | 93 µs |
| DashMap (basic) | 20.7 ns | 670 ns | **89 µs** |
| **dependency-injector** | **15.3 ns** | 87 ns | 106 µs |

### Fuzzing Status ✅

All fuzz targets pass with no crashes:
- `fuzz_container`: 1.1M+ runs
- `fuzz_concurrent`: 11K+ runs
- `fuzz_scoped`: 808K+ runs
- `fuzz_lifecycle`: Passing

---

## Future Optimization Opportunities

### High Priority

#### 1. Scope Pooling for Web Servers
**Gap Analysis:** Scope creation is 134ns, but could be near-zero with pooling.

**Solution:** Pre-allocate and reuse scope instances:
```rust
pub struct ScopePool {
    free_scopes: Mutex<Vec<Container>>,
    parent: Arc<ServiceStorage>,
}

impl ScopePool {
    pub fn acquire(&self) -> PooledScope {
        // Return a pre-allocated scope or create new one
    }
    
    pub fn release(&self, scope: Container) {
        scope.clear();
        self.free_scopes.lock().push(scope);
    }
}
```

**Expected Improvement:** ~100ns per request (75% faster scope creation)
**Complexity:** Medium
**Risk:** Medium (lifetime management)

---

#### 2. Fix Batch Registration Performance
**Gap Analysis:** Batch registration (279ns) is slower than individual (255ns for 4 services).

**Problem:** Current implementation has Vec allocation overhead that negates benefits.

**Solution:** Use pre-sized Vec and avoid unnecessary checks:
```rust
impl BatchRegistrar {
    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            pending: Vec::with_capacity(capacity),
            count: 0,
        }
    }
}
```

**Expected Improvement:** Batch should be 20-30% faster than individual
**Complexity:** Low
**Risk:** Low

---

### Medium Priority

#### 3. Faster Arc Downcast
**Gap Analysis:** Each resolution does `Arc::downcast()` which involves type checking.

**Solution:** Use unchecked downcast when type is guaranteed:
```rust
// In factory resolve, we know the type at registration time
unsafe fn downcast_unchecked<T>(arc: Arc<dyn Any + Send + Sync>) -> Arc<T> {
    // We registered this exact type, so downcast is guaranteed to succeed
    let ptr = Arc::into_raw(arc) as *const T;
    Arc::from_raw(ptr)
}
```

**Expected Improvement:** ~2-3 ns per resolution
**Complexity:** Low
**Risk:** Medium (requires careful safety analysis)

---

#### 4. Deep Parent Chain Optimization
**Gap Analysis:** Parent resolution is now 15.4ns but only checks immediate parent.

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

#### 5. Single-Thread Feature with Rc<T>
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

#### 6. Perfect Hashing for Static Containers
For containers with known service sets at startup, use perfect hashing instead of DashMap.

**Expected Improvement:** ~5 ns for resolution
**Complexity:** High
**Risk:** Medium

---

#### 7. Profile-Guided Optimization (PGO)
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
- **18% faster** singleton resolution (18.7ns → 15.3ns)
- **46% faster** parent resolution (28.7ns → 15.4ns)

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

### v0.1.6
- Added thread-local hot cache for frequently accessed services
- **18% faster** singleton resolution (18.7ns → 15.3ns)
- **46% faster** parent resolution (28.7ns → 15.4ns)
- **16% faster** scope override resolution (19ns → 15.9ns)
- Trade-off: transient resolution slower due to cache miss overhead

### v0.1.5
- Added `#[derive(Inject)]` compile-time DI macro
- All fuzz targets passing
- Current performance: 18.7ns resolution, 129ns scope creation

### v0.1.4
- Batch registration API
- Concurrent reads: ~92µs (4 threads)

### v0.1.3
- Enum-based AnyFactory
- Parent resolution: ~29ns

### v0.1.2
- AtomicBool lock state
- Registration: ~125ns

---

*Last updated: December 2024*
*Fuzzing: All targets passing (1M+ iterations)*
*Next focus: Scope pooling and batch registration performance*
