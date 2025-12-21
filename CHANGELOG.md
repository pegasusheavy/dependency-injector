# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2025-12-21

### Changed
- Replaced `RefCell` with `UnsafeCell` in thread-local hot cache (Phase 12)
- Store pre-computed `u64` type hash instead of `TypeId` (Phase 13)
- Added `#[cold]` annotation to `resolve_from_parents` (Phase 14)
- Fast path for root containers skips parent chain walk (Phase 15)
- Added `#[inline(always)]` to hot cache methods

### Performance
- `get_singleton`: 9.8ns → **9.4ns** (4% faster)
- `try_get_not_found`: 13.7ns → **10.9ns** (20% faster)
- Gap to manual DI reduced from 1.4ns to **1.0ns** (12% overhead)

## [0.2.0] - 2025-12-21

### Highlights
- **~9ns singleton resolution** - within 1ns of manual dependency injection
- **Full feature set** - scopes, pooling, derive macros, perfect hashing
- **Lock-free concurrency** - DashMap + thread-local cache

### Added
- `#[derive(Inject)]` macro for compile-time dependency injection
- `ScopePool` for pre-allocated scope reuse in high-throughput scenarios
- `FrozenStorage` with perfect hashing for static containers
- Thread-local hot cache for frequently accessed services
- Fluent batch registration API (`container.batch().singleton(A).done()`)
- Deep parent chain resolution for multi-level hierarchies
- `perfect-hash` feature flag for frozen container support
- `logging`, `logging-json`, and `logging-pretty` feature flags

### Changed
- Replaced `RwLock<bool>` with `AtomicBool` for lock state
- Switched to enum-based `AnyFactory` (eliminated vtable indirection)
- Reduced DashMap shards for child scopes (8 → 4)
- Optimized hot cache with fast bit-mixing hash

### Performance
| Operation | Time |
|-----------|------|
| `get_singleton` | ~9 ns |
| `get_transient` | ~24 ns |
| `create_scope` | ~80 ns |
| `scope_pool_acquire` | ~56 ns |
| `frozen_contains` | ~4 ns |

## [0.1.12] - 2025-12-21

### Changed
- Fast bit-mixing hash in hot cache (golden ratio multiplication)
- Single DashMap lookup via `get_with_transient_flag()`
- Reduced shard count for child scopes (8 → 4)

### Performance
- All resolution benchmarks now under 10ns for cached services
- `get_singleton`: 14.7ns → 9ns (40% faster)
- `get_transient`: 43ns → 24ns (44% faster)

## [0.1.11] - 2025-12-20

### Added
- `perfect-hash` feature with `FrozenStorage` using MPHF
- `container.freeze()` method for immutable containers

### Performance
- `frozen_contains`: 3.9ns (60% faster than DashMap)

## [0.1.10] - 2025-12-20

### Added
- Deep parent chain resolution for grandparent and beyond

### Changed
- `ServiceStorage` now holds optional parent reference for chain walking

## [0.1.9] - 2025-12-19

### Changed
- Unsafe unchecked downcast for Arc (TypeId already verified)

### Performance
- ~5-7% faster resolution across all benchmarks

## [0.1.8] - 2025-12-19

### Added
- Fluent batch registration API: `container.batch().singleton(A).done()`

### Performance
- Batch registration ~1% faster than individual registrations

## [0.1.7] - 2025-12-18

### Added
- `ScopePool` for pre-allocated scope reuse
- `PooledScope` RAII guard for automatic release

### Performance
- 30% faster scope acquisition vs fresh creation

## [0.1.6] - 2025-12-18

### Added
- Thread-local hot cache for frequently accessed services
- `clear_cache()` and `warm_cache<T>()` methods

### Performance
- 21% faster singleton resolution (18.7ns → 14.8ns)
- 48% faster parent resolution (28.7ns → 14.8ns)

## [0.1.5] - 2025-12-17

### Added
- `#[derive(Inject)]` compile-time DI macro
- `#[inject]` and `#[inject(optional)]` attributes
- `from_container()` method generation

## [0.1.4] - 2025-12-17

### Added
- Batch registration API with `BatchRegistrar`

## [0.1.3] - 2025-12-16

### Changed
- Enum-based `AnyFactory` (eliminated vtable indirection)
- Pre-erased `Arc<dyn Any>` storage in factories
- Cached parent `Arc<ServiceStorage>`

## [0.1.2] - 2025-12-16

### Changed
- Replaced `RwLock<bool>` with `AtomicBool` for lock state
- Optimized DashMap shard count (8 shards default)
- Removed `parking_lot` dependency

### Performance
- Registration: 854ns → 250ns (71% faster)

## [0.1.1] - 2025-12-15

### Added
- Initial release with core DI functionality
- Singleton, lazy, and transient lifetimes
- Scoped containers with parent resolution
- Lock-free concurrent access via DashMap

[0.2.1]: https://github.com/pegasusheavy/dependency-injector/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/pegasusheavy/dependency-injector/compare/v0.1.12...v0.2.0
[0.1.12]: https://github.com/pegasusheavy/dependency-injector/compare/v0.1.11...v0.1.12
[0.1.11]: https://github.com/pegasusheavy/dependency-injector/compare/v0.1.10...v0.1.11
[0.1.10]: https://github.com/pegasusheavy/dependency-injector/compare/v0.1.9...v0.1.10
[0.1.9]: https://github.com/pegasusheavy/dependency-injector/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/pegasusheavy/dependency-injector/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/pegasusheavy/dependency-injector/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/pegasusheavy/dependency-injector/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/pegasusheavy/dependency-injector/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/pegasusheavy/dependency-injector/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/pegasusheavy/dependency-injector/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/pegasusheavy/dependency-injector/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/pegasusheavy/dependency-injector/releases/tag/v0.1.1
