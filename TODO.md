# Performance Optimization TODO

> Analysis for dependency-injector v0.1.5 - December 2024

## Current Benchmark Results

| Operation | Current | Baseline (Manual DI) | Gap | Target | Status |
|-----------|---------|---------------------|-----|--------|--------|
| `get_singleton` | **18.7 ns** | 8 ns | 10.7 ns | <12 ns | 🎯 |
| `contains_check` | **10.8 ns** | N/A | - | <10 ns | ✅ |
| `try_get_found` | **18.8 ns** | 8 ns | 10.8 ns | <12 ns | 🎯 |
| `try_get_not_found` | **10.9 ns** | N/A | - | <10 ns | ✅ |
| `get_transient` | **25 ns** | N/A | - | <20 ns | 🔄 |
| `create_scope` | **129 ns** | N/A | - | <100 ns | 🔄 |
| `resolve_from_parent` | **28.7 ns** | 8 ns | 20.7 ns | <20 ns | 🎯 |
| `singleton registration` | **125 ns** | N/A | - | <100 ns | 🔄 |
| `concurrent_reads_4` (4×100) | **92 µs** | N/A | - | <80 µs | 🔄 |

### Comparison with Alternatives

| Approach | Resolution | Container Creation | 4-Thread Concurrent |
|----------|------------|-------------------|---------------------|
| Manual DI (baseline) | **8 ns** | 88 ns | N/A |
| HashMap + RwLock | 20.5 ns | **7.6 ns** | 93 µs |
| DashMap (basic) | 20.7 ns | 670 ns | **89 µs** |
| **dependency-injector** | **18.8 ns** | 87 ns | 92 µs |

### Fuzzing Status ✅

All fuzz targets pass with no crashes:
- `fuzz_container`: 1.1M+ runs
- `fuzz_concurrent`: 11K+ runs
- `fuzz_scoped`: 808K+ runs
- `fuzz_lifecycle`: Passing

---

## Future Optimization Opportunities

### High Priority

#### 1. Thread-Local Service Caching
**Gap Analysis:** Resolution is ~19ns vs ~8ns for manual DI. The 11ns gap is primarily DashMap lookup.

**Solution:** Cache frequently accessed services in thread-local storage:
```rust
thread_local! {
    static CACHED: RefCell<Option<(TypeId, Arc<dyn Any + Send + Sync>)>> = RefCell::new(None);
}

fn get<T: Injectable>(&self) -> Result<Arc<T>> {
    // Check thread-local cache first
    CACHED.with(|cache| {
        if let Some((cached_id, cached_arc)) = cache.borrow().as_ref() {
            if *cached_id == TypeId::of::<T>() {
                return Ok(cached_arc.clone().downcast().unwrap());
            }
        }
        // Fall back to DashMap
    })
}
```

**Expected Improvement:** ~8-10 ns for hot services (50% faster)
**Complexity:** Medium
**Risk:** Low (thread-local is well-understood)

---

#### 2. Scope Pooling for Web Servers
**Gap Analysis:** Scope creation is 129ns, but could be near-zero with pooling.

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

#### 3. Fix Batch Registration Performance
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

#### 4. Faster Arc Downcast
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

#### 5. Deep Parent Chain Optimization
**Gap Analysis:** Parent resolution is 28.7ns vs 18.7ns for local resolution (~10ns overhead).

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

#### 6. Single-Thread Feature with Rc<T>
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

#### 7. Perfect Hashing for Static Containers
For containers with known service sets at startup, use perfect hashing instead of DashMap.

**Expected Improvement:** ~5 ns for resolution
**Complexity:** High
**Risk:** Medium

---

#### 8. Profile-Guided Optimization (PGO)
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

#### 9. Lazy TypeId Computation
Cache `TypeId::of::<T>()` results to avoid repeated computation.

**Current:** TypeId is computed on every call
**Solution:** Use const generics or lazy_static for common types

**Expected Improvement:** ~1-2 ns
**Complexity:** Medium
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
*Next focus: Thread-local caching and scope pooling*
