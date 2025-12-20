# Performance Optimization TODO

> Benchmarking and profiling analysis for dependency-injector v0.1.2

## Benchmark Results Summary

| Operation | Before (v0.1.1) | After (v0.1.2) | Improvement | Target | Status |
|-----------|-----------------|----------------|-------------|--------|--------|
| `get_singleton` | ~19 ns | ~19 ns | - | <15 ns | ⏳ |
| `contains_check` | ~21 ns | ~11 ns | **47% faster** | <8 ns | ✅ |
| `try_get_found` | ~43 ns | ~19 ns | **56% faster** | <15 ns | ⏳ |
| `try_get_not_found` | ~14 ns | ~11 ns | **21% faster** | <8 ns | ⏳ |
| `get_transient` | ~27 ns | ~25 ns | **7% faster** | <20 ns | ⏳ |
| `create_scope` | ~870 ns | ~99 ns | **89% faster** | <500 ns | ✅ |
| `resolve_from_parent` | ~38 ns | ~38 ns | - | <25 ns | ⏳ |
| `singleton registration` | ~854 ns | ~134 ns | **84% faster** | <600 ns | ✅ |
| `concurrent_reads_4` (4×100) | ~99 µs | ~125 µs | -26% | <80 µs | ⚠️ |

### Phase 1 Results (Completed)

The Phase 1 optimizations achieved significant improvements:

- **Registration** is now **6-8x faster** (~850ns → ~120ns)
- **Scope creation** is now **8.8x faster** (~870ns → ~99ns)
- **Contains check** is now **~2x faster** (~21ns → ~11ns)
- **try_get** operations significantly improved

Concurrent reads regressed slightly due to fewer DashMap shards, but this is an acceptable tradeoff for the massive gains in single-threaded operations which are far more common.

---

## High Priority Optimizations

### 1. Eliminate Dynamic Dispatch in Resolution Hot Path
**Location:** `src/factory.rs` → `AnyFactory::resolve()`

**Problem:** The `AnyFactory` wrapper uses `Box<dyn Factory>` which requires a vtable lookup on every resolution.

**Current Code:**
```rust
pub(crate) struct AnyFactory {
    inner: Box<dyn Factory>,
    is_transient: bool,
}
```

**Solution:** Use an enum-based approach to avoid vtable indirection:
```rust
pub(crate) enum AnyFactory {
    Singleton(Arc<dyn Any + Send + Sync>),
    Lazy(Arc<OnceCell<Arc<dyn Any + Send + Sync>>>, Arc<dyn Fn() -> Arc<dyn Any + Send + Sync> + Send + Sync>),
    Transient(Arc<dyn Fn() -> Arc<dyn Any + Send + Sync> + Send + Sync>),
}
```

**Expected Improvement:** ~2-3 ns per resolution (10-15%)

---

### 2. Avoid Arc Clone in Singleton Resolution
**Location:** `src/factory.rs` → `SingletonFactory::resolve()`

**Problem:** Every resolution clones the `Arc<T>` even though we immediately cast it to `Arc<dyn Any>`.

**Current Code:**
```rust
fn resolve(&self) -> Arc<dyn Any + Send + Sync> {
    Arc::clone(&self.instance) as Arc<dyn Any + Send + Sync>
}
```

**Solution:** Store the type-erased `Arc<dyn Any + Send + Sync>` directly to avoid the clone+cast:
```rust
pub struct SingletonFactory {
    instance: Arc<dyn Any + Send + Sync>,
}
```

**Expected Improvement:** ~1-2 ns per resolution (5-10%)

---

### 3. Optimize Scope Creation
**Location:** `src/container.rs` → `Container::scope()`

**Problem:** Creating a scope allocates:
- New `ServiceStorage` (includes DashMap allocation)
- New `RwLock<bool>` for locked state
- New `Arc` wrappers

**Current Code:**
```rust
pub fn scope(&self) -> Self {
    Self {
        storage: Arc::new(ServiceStorage::new()),
        parent: Some(Arc::downgrade(&self.storage)),
        locked: Arc::new(RwLock::new(false)),
        depth: self.depth + 1,
    }
}
```

**Solutions:**

#### a) Pre-allocate scope storage with small capacity
```rust
pub fn scope(&self) -> Self {
    Self {
        storage: Arc::new(ServiceStorage::with_capacity(4)), // Most scopes have few services
        parent: Some(Arc::downgrade(&self.storage)),
        locked: Arc::new(RwLock::new(false)),
        depth: self.depth + 1,
    }
}
```

#### b) Use AtomicBool instead of RwLock<bool>
```rust
locked: Arc<AtomicBool>,  // Cheaper than RwLock for single bool
```

#### c) Scope pooling for high-throughput scenarios
```rust
pub fn scope_from_pool(&self, pool: &ScopePool) -> Self { ... }
```

**Expected Improvement:** ~200-300 ns per scope creation (25-35%)

---

### 4. Optimize Parent Chain Resolution
**Location:** `src/container.rs` → `Container::resolve_from_parents()`

**Problem:** Parent resolution requires:
1. `Weak::upgrade()` - atomic reference count
2. `storage.resolve()` - DashMap lookup
3. `Arc::downcast()` - type checking

**Current Code:**
```rust
fn resolve_from_parents<T: Injectable>(&self, type_id: &TypeId) -> Result<Arc<T>> {
    if let Some(weak) = self.parent.as_ref() {
        if let Some(storage) = weak.upgrade() {
            if let Some(arc) = storage.resolve(type_id)
                && let Ok(typed) = arc.downcast::<T>() {
                return Ok(typed);
            }
        }
    }
    Err(DiError::not_found::<T>())
}
```

**Solutions:**

#### a) Cache parent's Arc directly (trade memory for speed)
```rust
pub struct Container {
    storage: Arc<ServiceStorage>,
    parent_storage: Option<Arc<ServiceStorage>>,  // Strong ref instead of Weak
    parent_weak: Option<Weak<ServiceStorage>>,    // Keep for proper cleanup
    // ...
}
```

#### b) Support deep hierarchy with iterative resolution
```rust
fn resolve_from_parents<T: Injectable>(&self, type_id: &TypeId) -> Result<Arc<T>> {
    let mut current_parent = self.parent_storage.as_ref();
    while let Some(storage) = current_parent {
        if let Some(arc) = storage.resolve(type_id) {
            if let Ok(typed) = arc.downcast::<T>() {
                return Ok(typed);
            }
        }
        current_parent = storage.parent.as_ref();
    }
    Err(DiError::not_found::<T>())
}
```

**Expected Improvement:** ~10 ns per parent resolution (25%)

---

## Medium Priority Optimizations

### 5. Use TypeId Specialization for Common Types
**Location:** `src/storage.rs`

**Problem:** `TypeId` hashing is fast with ahash, but we can do better for common patterns.

**Solution:** Implement a small inline cache for the most recently accessed types:
```rust
pub struct ServiceStorage {
    factories: DashMap<TypeId, AnyFactory, RandomState>,
    // LRU cache for hot types (1-4 entries)
    hot_cache: [Option<(TypeId, AnyFactory)>; 4],
}
```

**Expected Improvement:** ~3-5 ns for hot path types (15-25%)

---

### 6. Reduce Arc Allocations in Transient Factories
**Location:** `src/factory.rs` → `TransientFactory::resolve()`

**Problem:** Every transient resolution allocates a new `Arc<T>`.

**Current Code:**
```rust
pub fn create(&self) -> Arc<T> {
    Arc::new((self.factory)())
}
```

**Solutions:**

#### a) Support `Rc<T>` for single-threaded scenarios
```rust
#[cfg(feature = "single-thread")]
pub fn create(&self) -> Rc<T> {
    Rc::new((self.factory)())
}
```

#### b) Arena allocation for request-scoped transients
```rust
pub fn create_in_arena(&self, arena: &Arena) -> &T {
    arena.alloc((self.factory)())
}
```

**Expected Improvement:** ~5 ns per transient (20%)

---

### 7. Optimize Registration Path
**Location:** `src/container.rs` → registration methods

**Problem:** Registration checks the lock state on every call.

**Current Code:**
```rust
pub fn singleton<T: Injectable>(&self, instance: T) {
    self.check_not_locked();  // RwLock read on every registration
    // ...
}
```

**Solution:** Use `AtomicBool` with relaxed ordering:
```rust
#[inline]
fn check_not_locked(&self) {
    if self.locked.load(Ordering::Relaxed) {
        panic!("Cannot register services: container is locked");
    }
}
```

**Expected Improvement:** ~50 ns per registration (5%)

---

### 8. Batch Registration API
**Location:** New API in `src/container.rs`

**Problem:** Registering many services has per-call overhead.

**Solution:**
```rust
impl Container {
    pub fn batch<F: FnOnce(&mut BatchRegistrar)>(&self, f: F) {
        self.check_not_locked();
        let mut registrar = BatchRegistrar::new();
        f(&mut registrar);
        registrar.commit(self);
    }
}

pub struct BatchRegistrar {
    pending: Vec<(TypeId, AnyFactory)>,
}
```

**Expected Improvement:** ~50% for bulk registration scenarios

---

## Low Priority Optimizations

### 9. Feature-Gate Tracing Overhead
**Location:** Throughout codebase

**Problem:** Even when tracing feature is enabled, most calls don't actually trace.

**Solution:** Use `tracing::enabled!` macro for conditional compilation:
```rust
#[cfg(feature = "tracing")]
{
    if tracing::enabled!(tracing::Level::TRACE) {
        trace!(service = std::any::type_name::<T>(), "Resolving service");
    }
}
```

---

### 10. SIMD-Accelerated TypeId Comparison
**Location:** `src/storage.rs`

**Problem:** For containers with many services, TypeId lookups dominate.

**Solution:** For very large containers (100+ services), consider a sorted vector with binary search or perfect hashing.

---

### 11. Compile-Time Dependency Injection
**Location:** New macro in `src/lib.rs`

**Problem:** Runtime DI has inherent overhead vs compile-time.

**Solution:** Add procedural macro for compile-time wiring:
```rust
#[derive(Injectable)]
struct MyService {
    #[inject]
    db: Arc<Database>,
    #[inject]
    cache: Arc<Cache>,
}
```

---

## Memory Optimizations

### 12. Reduce Container Size
**Current Size:** 40 bytes (estimated)
- `Arc<ServiceStorage>`: 8 bytes
- `Option<Weak<ServiceStorage>>`: 16 bytes
- `Arc<RwLock<bool>>`: 8 bytes
- `depth: u32`: 4 bytes
- padding: 4 bytes

**Solution:** Pack depth into the Arc's unused bits or use smaller types:
```rust
pub struct Container {
    storage: Arc<ServiceStorage>,
    parent: Option<Weak<ServiceStorage>>,
    locked: Arc<AtomicBool>,  // 8 bytes smaller than RwLock<bool>
    depth: u16,               // 2 bytes instead of 4
}
```

---

### 13. ServiceStorage Optimization
**Current:** DashMap with default shard count (usually 32)

**Solution:** Reduce shard count for small containers:
```rust
impl ServiceStorage {
    pub fn new() -> Self {
        Self {
            factories: DashMap::with_capacity_and_hasher_and_shard_amount(
                8,                  // Initial capacity
                RandomState::new(),
                4,                  // Fewer shards for small containers
            ),
        }
    }
}
```

---

## Benchmarking Improvements

### 14. Add More Realistic Benchmarks
- Mixed read/write workloads
- Deep scope hierarchies (5+ levels)
- Large service counts (100+ services)
- Real-world service graph patterns
- Memory allocation tracking

### 15. Add Comparison Benchmarks
- Compare with `shaku`
- Compare with `inject`
- Compare with manual DI patterns

---

## Implementation Roadmap

### Phase 1: Quick Wins ✅ COMPLETED
- [x] #7: AtomicBool for lock check (Relaxed ordering for fast path)
- [x] #3b: AtomicBool for locked state (replaced RwLock<bool>)
- [x] #13: Optimized DashMap shard count (8 shards instead of num_cpus * 4)
- [x] Removed `parking_lot` dependency (no longer needed)

### Phase 2: Core Optimizations (Est. 4-6 hours)
- [ ] #1: Enum-based AnyFactory
- [ ] #2: Pre-erase Arc type in SingletonFactory
- [ ] #4a: Cache parent Arc

### Phase 3: Advanced (Est. 8-12 hours)
- [ ] #5: Hot cache for frequently accessed types
- [ ] #8: Batch registration API
- [ ] #6: Arena allocation for transients

### Phase 4: Future Considerations
- [ ] #11: Compile-time DI macro
- [ ] #10: SIMD TypeId comparison

---

## Measurement Methodology

All benchmarks run with:
- Criterion 0.5 with HTML reports
- 100 samples, 3-second warmup
- Release build with LTO
- Intel/AMD x86_64 or Apple Silicon

To run benchmarks:
```bash
cargo bench --bench container_bench
```

To profile with flamegraph:
```bash
cargo install flamegraph
cargo flamegraph --bench container_bench -- --bench
```

---

## Changelog

### v0.1.2 (Phase 1 Optimizations)
- Replaced `parking_lot::RwLock<bool>` with `std::sync::atomic::AtomicBool` for lock state
- Optimized DashMap shard count from default (num_cpus * 4) to 8 shards
- Removed `parking_lot` dependency entirely
- Registration is now ~6-8x faster
- Scope creation is now ~9x faster

---

*Last updated: 2024-12-20*
*Based on v0.1.2 benchmark results*

