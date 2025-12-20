//! High-performance storage for DI container
//!
//! Uses DashMap for lock-free concurrent access.

#![allow(dead_code)]

use crate::factory::AnyFactory;
use ahash::RandomState;
use dashmap::DashMap;
use std::any::{Any, TypeId};
use std::sync::Arc;

// =============================================================================
// Unchecked Downcast (Phase 8 optimization)
// =============================================================================

/// Downcast an `Arc<dyn Any + Send + Sync>` to `Arc<T>` without runtime type checking.
///
/// # Safety
///
/// This is safe when:
/// - The `Arc` was originally created from a value of type `T`
/// - The caller has verified the type through other means (e.g., TypeId lookup)
///
/// In this crate, this is guaranteed because:
/// - Factories are keyed by `TypeId::of::<T>()` at registration
/// - Resolution looks up by the same `TypeId::of::<T>()`
/// - The factory stores the exact type that was registered
#[inline]
pub(crate) unsafe fn downcast_arc_unchecked<T: Send + Sync + 'static>(
    arc: Arc<dyn Any + Send + Sync>,
) -> Arc<T> {
    // SAFETY: The caller guarantees that the Arc contains a value of type T.
    // We convert Arc<dyn Any> -> raw pointer -> Arc<T>
    let ptr = Arc::into_raw(arc);
    // SAFETY: ptr came from Arc::into_raw and the caller guarantees T is correct
    unsafe { Arc::from_raw(ptr as *const T) }
}

/// Thread-safe storage for service factories
///
/// Uses `DashMap` with `ahash` for maximum concurrent performance.
pub struct ServiceStorage {
    /// Map from TypeId to factory
    factories: DashMap<TypeId, AnyFactory, RandomState>,
}

impl ServiceStorage {
    /// Create new empty storage with optimized shard count.
    ///
    /// Uses 8 shards as a balance between:
    /// - Creation overhead (fewer shards = faster creation)
    /// - Concurrent read performance (more shards = less contention)
    ///
    /// Default DashMap uses num_cpus * 4 shards which is overkill for
    /// typical DI containers with <50 services.
    #[inline]
    pub fn new() -> Self {
        Self {
            factories: DashMap::with_capacity_and_hasher_and_shard_amount(
                0,
                RandomState::new(),
                8, // 8 shards balances creation speed vs concurrency
            ),
        }
    }

    /// Create with pre-allocated capacity and optimized shards.
    #[inline]
    pub fn with_capacity(capacity: usize) -> Self {
        // Scale shards based on expected capacity and concurrency needs
        let shard_amount = if capacity <= 16 {
            8
        } else if capacity <= 64 {
            16
        } else {
            32
        };
        Self {
            factories: DashMap::with_capacity_and_hasher_and_shard_amount(
                capacity,
                RandomState::new(),
                shard_amount,
            ),
        }
    }

    /// Insert a factory
    #[inline]
    pub fn insert(&self, type_id: TypeId, factory: AnyFactory) {
        self.factories.insert(type_id, factory);
    }

    /// Check if type exists
    #[inline]
    pub fn contains(&self, type_id: &TypeId) -> bool {
        self.factories.contains_key(type_id)
    }

    /// Resolve a service by TypeId
    #[inline]
    pub fn resolve(&self, type_id: &TypeId) -> Option<Arc<dyn Any + Send + Sync>> {
        self.factories.get(type_id).map(|f| f.resolve())
    }

    /// Try to resolve and downcast to T
    ///
    /// Uses unchecked downcast since we know the type from the TypeId lookup.
    #[inline]
    pub fn get<T: Send + Sync + 'static>(&self) -> Option<Arc<T>> {
        self.resolve(&TypeId::of::<T>()).map(|any| {
            // SAFETY: We looked up by TypeId::of::<T>(), so the factory
            // was registered with the same TypeId and stores type T.
            unsafe { downcast_arc_unchecked(any) }
        })
    }

    /// Get number of registered services
    #[inline]
    pub fn len(&self) -> usize {
        self.factories.len()
    }

    /// Check if empty
    #[inline]
    pub fn is_empty(&self) -> bool {
        self.factories.is_empty()
    }

    /// Clear all services
    #[inline]
    pub fn clear(&self) {
        self.factories.clear();
    }

    /// Remove a service
    #[inline]
    pub fn remove(&self, type_id: &TypeId) -> bool {
        self.factories.remove(type_id).is_some()
    }

    /// Get all registered type IDs
    pub fn type_ids(&self) -> Vec<TypeId> {
        self.factories.iter().map(|r| *r.key()).collect()
    }

    /// Check if a service is transient
    #[inline]
    pub fn is_transient(&self, type_id: &TypeId) -> bool {
        self.factories
            .get(type_id)
            .map(|f| f.is_transient())
            .unwrap_or(false)
    }
}

impl Default for ServiceStorage {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Debug for ServiceStorage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ServiceStorage")
            .field("count", &self.len())
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Clone)]
    struct TestService {
        value: i32,
    }

    #[test]
    fn test_storage_insert_and_get() {
        let storage = ServiceStorage::new();
        let type_id = TypeId::of::<TestService>();

        // Phase 2: Use new enum-based AnyFactory API
        storage.insert(type_id, AnyFactory::singleton(TestService { value: 42 }));

        let service = storage.get::<TestService>().unwrap();
        assert_eq!(service.value, 42);
    }

    #[test]
    fn test_storage_contains() {
        let storage = ServiceStorage::new();
        let type_id = TypeId::of::<TestService>();

        assert!(!storage.contains(&type_id));

        storage.insert(type_id, AnyFactory::singleton(TestService { value: 0 }));

        assert!(storage.contains(&type_id));
    }

    #[test]
    fn test_storage_remove() {
        let storage = ServiceStorage::new();
        let type_id = TypeId::of::<TestService>();

        storage.insert(type_id, AnyFactory::singleton(TestService { value: 0 }));
        assert!(storage.contains(&type_id));

        storage.remove(&type_id);
        assert!(!storage.contains(&type_id));
    }
}
