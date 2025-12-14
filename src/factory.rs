//! Factory types for creating service instances
//!
//! Factories encapsulate how services are created and their lifecycle.

use crate::Injectable;
use once_cell::sync::OnceCell;
use std::any::Any;
use std::sync::Arc;

/// A factory that creates service instances
pub trait Factory: Send + Sync {
    /// Resolve the service, creating it if necessary
    fn resolve(&self) -> Arc<dyn Any + Send + Sync>;

    /// Check if this factory produces a new instance each time
    fn is_transient(&self) -> bool {
        false
    }
}

/// Singleton factory - stores a single pre-created instance
pub struct SingletonFactory<T: Injectable> {
    instance: Arc<T>,
}

impl<T: Injectable> SingletonFactory<T> {
    /// Create from an existing instance
    #[inline]
    pub fn new(instance: T) -> Self {
        Self {
            instance: Arc::new(instance),
        }
    }

    /// Create from an Arc
    #[inline]
    pub fn from_arc(instance: Arc<T>) -> Self {
        Self { instance }
    }

    /// Get direct access to the Arc (avoids downcast)
    #[inline]
    pub fn get(&self) -> Arc<T> {
        Arc::clone(&self.instance)
    }
}

impl<T: Injectable> Factory for SingletonFactory<T> {
    #[inline]
    fn resolve(&self) -> Arc<dyn Any + Send + Sync> {
        Arc::clone(&self.instance) as Arc<dyn Any + Send + Sync>
    }
}

/// Lazy singleton factory - creates instance on first access
pub struct LazyFactory<T: Injectable, F: Fn() -> T + Send + Sync> {
    factory: F,
    instance: OnceCell<Arc<T>>,
}

impl<T: Injectable, F: Fn() -> T + Send + Sync> LazyFactory<T, F> {
    /// Create a new lazy factory
    #[inline]
    pub fn new(factory: F) -> Self {
        Self {
            factory,
            instance: OnceCell::new(),
        }
    }

    /// Get the instance, creating it if necessary
    #[inline]
    pub fn get(&self) -> Arc<T> {
        Arc::clone(self.instance.get_or_init(|| Arc::new((self.factory)())))
    }
}

impl<T: Injectable, F: Fn() -> T + Send + Sync> Factory for LazyFactory<T, F> {
    #[inline]
    fn resolve(&self) -> Arc<dyn Any + Send + Sync> {
        self.get() as Arc<dyn Any + Send + Sync>
    }
}

/// Transient factory - creates new instance every time
pub struct TransientFactory<T: Injectable, F: Fn() -> T + Send + Sync> {
    factory: F,
    _marker: std::marker::PhantomData<T>,
}

impl<T: Injectable, F: Fn() -> T + Send + Sync> TransientFactory<T, F> {
    /// Create a new transient factory
    #[inline]
    pub fn new(factory: F) -> Self {
        Self {
            factory,
            _marker: std::marker::PhantomData,
        }
    }

    /// Create a new instance
    #[inline]
    pub fn create(&self) -> Arc<T> {
        Arc::new((self.factory)())
    }
}

impl<T: Injectable, F: Fn() -> T + Send + Sync> Factory for TransientFactory<T, F> {
    #[inline]
    fn resolve(&self) -> Arc<dyn Any + Send + Sync> {
        self.create() as Arc<dyn Any + Send + Sync>
    }

    #[inline]
    fn is_transient(&self) -> bool {
        true
    }
}

/// Type-erased factory wrapper for storage
#[allow(dead_code)]
pub(crate) struct AnyFactory {
    inner: Box<dyn Factory>,
    is_transient: bool,
}

impl AnyFactory {
    /// Create from any factory
    #[inline]
    pub fn new<F: Factory + 'static>(factory: F) -> Self {
        let is_transient = factory.is_transient();
        Self {
            inner: Box::new(factory),
            is_transient,
        }
    }

    /// Resolve the service
    #[inline]
    pub fn resolve(&self) -> Arc<dyn Any + Send + Sync> {
        self.inner.resolve()
    }

    /// Check if transient
    #[inline]
    pub fn is_transient(&self) -> bool {
        self.is_transient
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    #[derive(Clone)]
    struct TestService {
        id: u32,
    }

    #[test]
    fn test_singleton_factory() {
        let factory = SingletonFactory::new(TestService { id: 42 });

        let a = factory.get();
        let b = factory.get();

        assert_eq!(a.id, 42);
        assert!(Arc::ptr_eq(&a, &b));
    }

    #[test]
    fn test_lazy_factory() {
        static COUNTER: AtomicU32 = AtomicU32::new(0);

        let factory = LazyFactory::new(|| {
            TestService {
                id: COUNTER.fetch_add(1, Ordering::SeqCst),
            }
        });

        assert_eq!(COUNTER.load(Ordering::SeqCst), 0);

        let a = factory.get();
        assert_eq!(COUNTER.load(Ordering::SeqCst), 1);
        assert_eq!(a.id, 0);

        let b = factory.get();
        assert_eq!(COUNTER.load(Ordering::SeqCst), 1);
        assert!(Arc::ptr_eq(&a, &b));
    }

    #[test]
    fn test_transient_factory() {
        static COUNTER: AtomicU32 = AtomicU32::new(0);

        let factory = TransientFactory::new(|| TestService {
            id: COUNTER.fetch_add(1, Ordering::SeqCst),
        });

        let a = factory.create();
        let b = factory.create();

        assert_eq!(a.id, 0);
        assert_eq!(b.id, 1);
        assert!(!Arc::ptr_eq(&a, &b));
    }
}

