//! High-performance storage for DI container
//!
//! Uses DashMap for lock-free concurrent access.

#![allow(dead_code)]

use crate::factory::AnyFactory;
use ahash::RandomState;
use dashmap::DashMap;
use std::any::{Any, TypeId};
use std::sync::Arc;

/// Thread-safe storage for service factories
///
/// Uses `DashMap` with `ahash` for maximum concurrent performance.
pub struct ServiceStorage {
    /// Map from TypeId to factory
    factories: DashMap<TypeId, AnyFactory, RandomState>,
}

impl ServiceStorage {
    /// Create new empty storage
    #[inline]
    pub fn new() -> Self {
        Self {
            factories: DashMap::with_hasher(RandomState::new()),
        }
    }

    /// Create with pre-allocated capacity
    #[inline]
    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            factories: DashMap::with_capacity_and_hasher(capacity, RandomState::new()),
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
    #[inline]
    pub fn get<T: Send + Sync + 'static>(&self) -> Option<Arc<T>> {
        self.resolve(&TypeId::of::<T>())
            .and_then(|any| any.downcast::<T>().ok())
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
    use crate::factory::SingletonFactory;

    #[derive(Clone)]
    struct TestService {
        value: i32,
    }

    #[test]
    fn test_storage_insert_and_get() {
        let storage = ServiceStorage::new();
        let type_id = TypeId::of::<TestService>();

        storage.insert(type_id, AnyFactory::new(SingletonFactory::new(TestService { value: 42 })));

        let service = storage.get::<TestService>().unwrap();
        assert_eq!(service.value, 42);
    }

    #[test]
    fn test_storage_contains() {
        let storage = ServiceStorage::new();
        let type_id = TypeId::of::<TestService>();

        assert!(!storage.contains(&type_id));

        storage.insert(type_id, AnyFactory::new(SingletonFactory::new(TestService { value: 0 })));

        assert!(storage.contains(&type_id));
    }

    #[test]
    fn test_storage_remove() {
        let storage = ServiceStorage::new();
        let type_id = TypeId::of::<TestService>();

        storage.insert(type_id, AnyFactory::new(SingletonFactory::new(TestService { value: 0 })));
        assert!(storage.contains(&type_id));

        storage.remove(&type_id);
        assert!(!storage.contains(&type_id));
    }
}

