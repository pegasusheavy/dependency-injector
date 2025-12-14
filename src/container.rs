//! High-performance dependency injection container
//!
//! The `Container` is the core of the DI system. It stores services and
//! resolves dependencies with minimal overhead.

use crate::factory::{AnyFactory, LazyFactory, SingletonFactory, TransientFactory};
use crate::storage::ServiceStorage;
use crate::{DiError, Injectable, Result};
use parking_lot::RwLock;
use std::any::{Any, TypeId};
use std::sync::{Arc, Weak};

#[cfg(feature = "tracing")]
use tracing::{debug, trace};

/// High-performance dependency injection container.
///
/// Uses lock-free data structures for maximum concurrent throughput.
/// Supports hierarchical scopes with full parent chain resolution.
///
/// # Examples
///
/// ```rust
/// use dependency_injector::Container;
///
/// #[derive(Clone)]
/// struct MyService { name: String }
///
/// let container = Container::new();
/// container.singleton(MyService { name: "test".into() });
///
/// let service = container.get::<MyService>().unwrap();
/// assert_eq!(service.name, "test");
/// ```
#[derive(Clone)]
pub struct Container {
    /// Service storage (lock-free)
    storage: Arc<ServiceStorage>,
    /// Parent container for scope hierarchy
    parent: Option<Weak<ServiceStorage>>,
    /// Lock state (rarely accessed, ok to use RwLock)
    locked: Arc<RwLock<bool>>,
    /// Scope depth for debugging
    depth: u32,
}

impl Container {
    /// Create a new root container.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use dependency_injector::Container;
    /// let container = Container::new();
    /// ```
    #[inline]
    pub fn new() -> Self {
        #[cfg(feature = "tracing")]
        debug!("Creating new DI container");

        Self {
            storage: Arc::new(ServiceStorage::new()),
            parent: None,
            locked: Arc::new(RwLock::new(false)),
            depth: 0,
        }
    }

    /// Create a container with pre-allocated capacity.
    ///
    /// Use this when you know approximately how many services will be registered.
    #[inline]
    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            storage: Arc::new(ServiceStorage::with_capacity(capacity)),
            parent: None,
            locked: Arc::new(RwLock::new(false)),
            depth: 0,
        }
    }

    /// Create a child scope that inherits from this container.
    ///
    /// Child scopes can:
    /// - Access all services from parent scopes
    /// - Override parent services with local registrations
    /// - Have their own transient/scoped services
    ///
    /// # Examples
    ///
    /// ```rust
    /// use dependency_injector::Container;
    ///
    /// #[derive(Clone)]
    /// struct AppConfig { debug: bool }
    ///
    /// #[derive(Clone)]
    /// struct RequestId(String);
    ///
    /// let root = Container::new();
    /// root.singleton(AppConfig { debug: true });
    ///
    /// let request = root.scope();
    /// request.singleton(RequestId("req-123".into()));
    ///
    /// // Request scope can access root config
    /// assert!(request.contains::<AppConfig>());
    /// ```
    #[inline]
    pub fn scope(&self) -> Self {
        #[cfg(feature = "tracing")]
        debug!(depth = self.depth + 1, "Creating child scope");

        Self {
            storage: Arc::new(ServiceStorage::new()),
            parent: Some(Arc::downgrade(&self.storage)),
            locked: Arc::new(RwLock::new(false)),
            depth: self.depth + 1,
        }
    }

    /// Alias for `scope()` - creates a child container.
    #[inline]
    pub fn create_scope(&self) -> Self {
        self.scope()
    }

    // =========================================================================
    // Registration Methods
    // =========================================================================

    /// Register a singleton service (eager).
    ///
    /// The instance is stored immediately and shared across all resolves.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use dependency_injector::Container;
    ///
    /// #[derive(Clone)]
    /// struct Database { url: String }
    ///
    /// let container = Container::new();
    /// container.singleton(Database { url: "postgres://localhost".into() });
    /// ```
    #[inline]
    pub fn singleton<T: Injectable>(&self, instance: T) {
        self.check_not_locked();

        let type_id = TypeId::of::<T>();

        #[cfg(feature = "tracing")]
        trace!(
            service = std::any::type_name::<T>(),
            "Registering singleton"
        );

        self.storage
            .insert(type_id, AnyFactory::new(SingletonFactory::new(instance)));
    }

    /// Register a lazy singleton service.
    ///
    /// The factory is called once on first access, then the instance is cached.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use dependency_injector::Container;
    ///
    /// #[derive(Clone)]
    /// struct ExpensiveService { data: Vec<u8> }
    ///
    /// let container = Container::new();
    /// container.lazy(|| ExpensiveService {
    ///     data: vec![0; 1024 * 1024], // Only allocated on first use
    /// });
    /// ```
    #[inline]
    pub fn lazy<T: Injectable, F>(&self, factory: F)
    where
        F: Fn() -> T + Send + Sync + 'static,
    {
        self.check_not_locked();

        let type_id = TypeId::of::<T>();

        #[cfg(feature = "tracing")]
        trace!(
            service = std::any::type_name::<T>(),
            "Registering lazy singleton"
        );

        self.storage
            .insert(type_id, AnyFactory::new(LazyFactory::new(factory)));
    }

    /// Register a transient service.
    ///
    /// A new instance is created on every resolve.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use dependency_injector::Container;
    /// use std::sync::atomic::{AtomicU64, Ordering};
    ///
    /// static COUNTER: AtomicU64 = AtomicU64::new(0);
    ///
    /// #[derive(Clone)]
    /// struct RequestId(u64);
    ///
    /// let container = Container::new();
    /// container.transient(|| RequestId(COUNTER.fetch_add(1, Ordering::SeqCst)));
    ///
    /// let id1 = container.get::<RequestId>().unwrap();
    /// let id2 = container.get::<RequestId>().unwrap();
    /// assert_ne!(id1.0, id2.0); // Different instances
    /// ```
    #[inline]
    pub fn transient<T: Injectable, F>(&self, factory: F)
    where
        F: Fn() -> T + Send + Sync + 'static,
    {
        self.check_not_locked();

        let type_id = TypeId::of::<T>();

        #[cfg(feature = "tracing")]
        trace!(
            service = std::any::type_name::<T>(),
            "Registering transient"
        );

        self.storage
            .insert(type_id, AnyFactory::new(TransientFactory::new(factory)));
    }

    /// Register using a factory (alias for `lazy`).
    #[inline]
    pub fn register_factory<T: Injectable, F>(&self, factory: F)
    where
        F: Fn() -> T + Send + Sync + 'static,
    {
        self.lazy(factory);
    }

    /// Register an instance (alias for `singleton`).
    #[inline]
    pub fn register<T: Injectable>(&self, instance: T) {
        self.singleton(instance);
    }

    /// Register a boxed instance.
    #[inline]
    #[allow(clippy::boxed_local)]
    pub fn register_boxed<T: Injectable>(&self, instance: Box<T>) {
        self.singleton(*instance);
    }

    /// Register by TypeId directly (advanced use).
    #[inline]
    pub fn register_by_id(&self, type_id: TypeId, instance: Arc<dyn Any + Send + Sync>) {
        self.check_not_locked();

        // Create a factory that returns the Arc directly
        struct ArcFactory(Arc<dyn Any + Send + Sync>);

        impl crate::factory::Factory for ArcFactory {
            fn resolve(&self) -> Arc<dyn Any + Send + Sync> {
                Arc::clone(&self.0)
            }
        }

        self.storage
            .insert(type_id, AnyFactory::new(ArcFactory(instance)));
    }

    // =========================================================================
    // Resolution Methods
    // =========================================================================

    /// Resolve a service by type.
    ///
    /// Returns `Arc<T>` for zero-copy sharing. Walks the parent chain if
    /// not found in the current scope.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use dependency_injector::Container;
    ///
    /// #[derive(Clone)]
    /// struct MyService;
    ///
    /// let container = Container::new();
    /// container.singleton(MyService);
    ///
    /// let service = container.get::<MyService>().unwrap();
    /// ```
    #[inline]
    pub fn get<T: Injectable>(&self) -> Result<Arc<T>> {
        let type_id = TypeId::of::<T>();

        #[cfg(feature = "tracing")]
        trace!(service = std::any::type_name::<T>(), "Resolving service");

        // Try local storage first (most common case)
        if let Some(service) = self.storage.get::<T>() {
            #[cfg(feature = "tracing")]
            trace!(
                service = std::any::type_name::<T>(),
                "Found in current scope"
            );
            return Ok(service);
        }

        // Walk parent chain
        self.resolve_from_parents::<T>(&type_id)
    }

    /// Resolve from parent chain (internal)
    fn resolve_from_parents<T: Injectable>(&self, type_id: &TypeId) -> Result<Arc<T>> {
        if let Some(weak) = self.parent.as_ref() {
            if let Some(storage) = weak.upgrade() {
                if let Some(arc) = storage.resolve(type_id)
                    && let Ok(typed) = arc.downcast::<T>()
                {
                    #[cfg(feature = "tracing")]
                    trace!(
                        service = std::any::type_name::<T>(),
                        "Found in parent scope"
                    );
                    return Ok(typed);
                }
                // Single-level parent resolution for now
                // TODO: Support deep hierarchies by storing parent ref in storage
            } else {
                return Err(DiError::ParentDropped);
            }
        }

        #[cfg(feature = "tracing")]
        trace!(service = std::any::type_name::<T>(), "Service not found");

        Err(DiError::not_found::<T>())
    }

    /// Alias for `get` - resolve a service.
    #[inline]
    pub fn resolve<T: Injectable>(&self) -> Result<Arc<T>> {
        self.get::<T>()
    }

    /// Try to resolve, returning None if not found.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use dependency_injector::Container;
    ///
    /// #[derive(Clone)]
    /// struct OptionalService;
    ///
    /// let container = Container::new();
    /// assert!(container.try_get::<OptionalService>().is_none());
    /// ```
    #[inline]
    pub fn try_get<T: Injectable>(&self) -> Option<Arc<T>> {
        self.get::<T>().ok()
    }

    /// Alias for `try_get`.
    #[inline]
    pub fn try_resolve<T: Injectable>(&self) -> Option<Arc<T>> {
        self.try_get::<T>()
    }

    // =========================================================================
    // Query Methods
    // =========================================================================

    /// Check if a service is registered.
    ///
    /// Checks both current scope and parent scopes.
    #[inline]
    pub fn contains<T: Injectable>(&self) -> bool {
        let type_id = TypeId::of::<T>();
        self.contains_type_id(&type_id)
    }

    /// Alias for `contains`.
    #[inline]
    pub fn has<T: Injectable>(&self) -> bool {
        self.contains::<T>()
    }

    /// Check by TypeId
    fn contains_type_id(&self, type_id: &TypeId) -> bool {
        // Check local
        if self.storage.contains(type_id) {
            return true;
        }

        // Check parent chain
        if let Some(weak) = self.parent.as_ref()
            && let Some(storage) = weak.upgrade()
            && storage.contains(type_id)
        {
            return true;
        }

        false
    }

    /// Get the number of services in this scope (not including parents).
    #[inline]
    pub fn len(&self) -> usize {
        self.storage.len()
    }

    /// Check if this scope is empty.
    #[inline]
    pub fn is_empty(&self) -> bool {
        self.storage.is_empty()
    }

    /// Get all registered TypeIds in this scope.
    pub fn registered_types(&self) -> Vec<TypeId> {
        self.storage.type_ids()
    }

    /// Get the scope depth (0 = root).
    #[inline]
    pub fn depth(&self) -> u32 {
        self.depth
    }

    // =========================================================================
    // Lifecycle Methods
    // =========================================================================

    /// Lock the container to prevent further registrations.
    ///
    /// Useful for ensuring no services are registered after app initialization.
    #[inline]
    pub fn lock(&self) {
        let mut locked = self.locked.write();
        *locked = true;

        #[cfg(feature = "tracing")]
        debug!("Container locked");
    }

    /// Check if the container is locked.
    #[inline]
    pub fn is_locked(&self) -> bool {
        *self.locked.read()
    }

    /// Clear all services from this scope.
    ///
    /// Does not affect parent scopes.
    #[inline]
    pub fn clear(&self) {
        self.storage.clear();

        #[cfg(feature = "tracing")]
        debug!("Container cleared");
    }

    /// Panic if locked (internal helper).
    #[inline]
    fn check_not_locked(&self) {
        if *self.locked.read() {
            panic!("Cannot register services: container is locked");
        }
    }
}

impl Default for Container {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Debug for Container {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Container")
            .field("service_count", &self.len())
            .field("depth", &self.depth)
            .field("has_parent", &self.parent.is_some())
            .field("locked", &self.is_locked())
            .finish()
    }
}

// =========================================================================
// Thread Safety
// =========================================================================

// Container is Send + Sync because:
// - ServiceStorage uses DashMap (thread-safe)
// - parent is Weak<...> which is Send + Sync
// - locked uses parking_lot::RwLock (Send + Sync)
unsafe impl Send for Container {}
unsafe impl Sync for Container {}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Clone)]
    struct TestService {
        value: String,
    }

    #[allow(dead_code)]
    #[derive(Clone)]
    struct AnotherService {
        name: String,
    }

    #[test]
    fn test_singleton() {
        let container = Container::new();
        container.singleton(TestService {
            value: "test".into(),
        });

        let s1 = container.get::<TestService>().unwrap();
        let s2 = container.get::<TestService>().unwrap();

        assert_eq!(s1.value, "test");
        assert!(Arc::ptr_eq(&s1, &s2));
    }

    #[test]
    fn test_lazy() {
        use std::sync::atomic::{AtomicBool, Ordering};

        static CREATED: AtomicBool = AtomicBool::new(false);

        let container = Container::new();
        container.lazy(|| {
            CREATED.store(true, Ordering::SeqCst);
            TestService {
                value: "lazy".into(),
            }
        });

        assert!(!CREATED.load(Ordering::SeqCst));

        let s = container.get::<TestService>().unwrap();
        assert!(CREATED.load(Ordering::SeqCst));
        assert_eq!(s.value, "lazy");
    }

    #[test]
    fn test_transient() {
        use std::sync::atomic::{AtomicU32, Ordering};

        static COUNTER: AtomicU32 = AtomicU32::new(0);

        #[derive(Clone)]
        struct Counter(u32);

        let container = Container::new();
        container.transient(|| Counter(COUNTER.fetch_add(1, Ordering::SeqCst)));

        let c1 = container.get::<Counter>().unwrap();
        let c2 = container.get::<Counter>().unwrap();

        assert_ne!(c1.0, c2.0);
    }

    #[test]
    fn test_scope_inheritance() {
        let root = Container::new();
        root.singleton(TestService {
            value: "root".into(),
        });

        let child = root.scope();
        child.singleton(AnotherService {
            name: "child".into(),
        });

        // Child sees both
        assert!(child.contains::<TestService>());
        assert!(child.contains::<AnotherService>());

        // Root only sees its own
        assert!(root.contains::<TestService>());
        assert!(!root.contains::<AnotherService>());
    }

    #[test]
    fn test_scope_override() {
        let root = Container::new();
        root.singleton(TestService {
            value: "root".into(),
        });

        let child = root.scope();
        child.singleton(TestService {
            value: "child".into(),
        });

        let root_service = root.get::<TestService>().unwrap();
        let child_service = child.get::<TestService>().unwrap();

        assert_eq!(root_service.value, "root");
        assert_eq!(child_service.value, "child");
    }

    #[test]
    fn test_not_found() {
        let container = Container::new();
        let result = container.get::<TestService>();
        assert!(result.is_err());
    }

    #[test]
    fn test_lock() {
        let container = Container::new();
        assert!(!container.is_locked());

        container.lock();
        assert!(container.is_locked());
    }

    #[test]
    #[should_panic(expected = "Cannot register services: container is locked")]
    fn test_register_after_lock() {
        let container = Container::new();
        container.lock();
        container.singleton(TestService {
            value: "fail".into(),
        });
    }
}
