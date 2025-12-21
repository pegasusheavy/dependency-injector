//! Comparison benchmarks against other Rust DI containers
//!
//! This benchmark compares dependency-injector against:
//! - shaku (compile-time DI with derive macros)
//! - waiter_di (runtime DI)
//! - Manual DI patterns (baseline)

use criterion::{BenchmarkId, Criterion, Throughput, criterion_group, criterion_main};
use std::hint::black_box;
use std::sync::Arc;

// ============================================================================
// Test Services (shared across all DI containers)
// ============================================================================

/// Simple value service
#[allow(dead_code)]
#[derive(Clone, Debug)]
struct Config {
    database_url: String,
    max_connections: u32,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            database_url: "postgres://localhost/test".to_string(),
            max_connections: 10,
        }
    }
}

/// Service with a dependency
#[allow(dead_code)]
#[derive(Clone, Debug)]
struct Database {
    config: Arc<Config>,
}

impl Database {
    fn new(config: Arc<Config>) -> Self {
        Self { config }
    }
}

/// Service with multiple dependencies
#[allow(dead_code)]
#[derive(Clone, Debug)]
struct UserRepository {
    db: Arc<Database>,
    cache_enabled: bool,
}

impl UserRepository {
    fn new(db: Arc<Database>) -> Self {
        Self {
            db,
            cache_enabled: true,
        }
    }
}

/// Top-level service with deep dependency chain
#[allow(dead_code)]
#[derive(Clone, Debug)]
struct UserService {
    repo: Arc<UserRepository>,
    name: String,
}

impl UserService {
    fn new(repo: Arc<UserRepository>) -> Self {
        Self {
            repo,
            name: "UserService".to_string(),
        }
    }
}

// ============================================================================
// Manual DI (Baseline)
// ============================================================================

mod manual_di {
    use super::*;

    #[allow(dead_code)]
    pub struct Container {
        config: Arc<Config>,
        database: Arc<Database>,
        user_repo: Arc<UserRepository>,
        user_service: Arc<UserService>,
    }

    #[allow(dead_code)]
    impl Container {
        pub fn new() -> Self {
            let config = Arc::new(Config::default());
            let database = Arc::new(Database::new(Arc::clone(&config)));
            let user_repo = Arc::new(UserRepository::new(Arc::clone(&database)));
            let user_service = Arc::new(UserService::new(Arc::clone(&user_repo)));

            Self {
                config,
                database,
                user_repo,
                user_service,
            }
        }

        #[inline]
        pub fn config(&self) -> Arc<Config> {
            Arc::clone(&self.config)
        }

        #[inline]
        pub fn database(&self) -> Arc<Database> {
            Arc::clone(&self.database)
        }

        #[inline]
        pub fn user_repo(&self) -> Arc<UserRepository> {
            Arc::clone(&self.user_repo)
        }

        #[inline]
        pub fn user_service(&self) -> Arc<UserService> {
            Arc::clone(&self.user_service)
        }
    }
}

// ============================================================================
// HashMap-based DI (Simple runtime)
// ============================================================================

mod hashmap_di {
    use std::any::{Any, TypeId};
    use std::collections::HashMap;
    use std::sync::{Arc, RwLock};

    pub struct Container {
        services: RwLock<HashMap<TypeId, Arc<dyn Any + Send + Sync>>>,
    }

    impl Container {
        pub fn new() -> Self {
            Self {
                services: RwLock::new(HashMap::new()),
            }
        }

        pub fn register<T: Send + Sync + 'static>(&self, service: T) {
            let mut services = self.services.write().unwrap();
            services.insert(TypeId::of::<T>(), Arc::new(service));
        }

        pub fn get<T: Send + Sync + Clone + 'static>(&self) -> Option<Arc<T>> {
            let services = self.services.read().unwrap();
            services
                .get(&TypeId::of::<T>())
                .and_then(|s| s.clone().downcast::<T>().ok())
        }
    }
}

// ============================================================================
// DashMap-based DI (Concurrent runtime - similar to dependency-injector)
// ============================================================================

mod dashmap_di {
    use dashmap::DashMap;
    use std::any::{Any, TypeId};
    use std::sync::Arc;

    pub struct Container {
        services: DashMap<TypeId, Arc<dyn Any + Send + Sync>>,
    }

    impl Container {
        pub fn new() -> Self {
            Self {
                services: DashMap::new(),
            }
        }

        pub fn register<T: Send + Sync + 'static>(&self, service: T) {
            self.services.insert(TypeId::of::<T>(), Arc::new(service));
        }

        pub fn get<T: Send + Sync + Clone + 'static>(&self) -> Option<Arc<T>> {
            self.services
                .get(&TypeId::of::<T>())
                .and_then(|s| s.value().clone().downcast::<T>().ok())
        }
    }
}

// ============================================================================
// Benchmarks
// ============================================================================

fn bench_singleton_resolution(c: &mut Criterion) {
    let mut group = c.benchmark_group("singleton_resolution");
    group.throughput(Throughput::Elements(1));

    // Manual DI (baseline)
    let manual = manual_di::Container::new();
    group.bench_function("manual_di", |b| {
        b.iter(|| black_box(manual.config()))
    });

    // HashMap DI
    let hashmap = hashmap_di::Container::new();
    hashmap.register(Config::default());
    group.bench_function("hashmap_rwlock", |b| {
        b.iter(|| black_box(hashmap.get::<Config>()))
    });

    // DashMap DI
    let dashmap = dashmap_di::Container::new();
    dashmap.register(Config::default());
    group.bench_function("dashmap_basic", |b| {
        b.iter(|| black_box(dashmap.get::<Config>()))
    });

    // dependency-injector
    let di = dependency_injector::Container::new();
    di.singleton(Config::default());
    group.bench_function("dependency_injector", |b| {
        b.iter(|| black_box(di.get::<Config>().unwrap()))
    });

    group.finish();
}

fn bench_deep_dependency_chain(c: &mut Criterion) {
    let mut group = c.benchmark_group("deep_dependency_chain");
    group.throughput(Throughput::Elements(1));

    // Manual DI (baseline) - 4 level dependency chain
    let manual = manual_di::Container::new();
    group.bench_function("manual_di", |b| {
        b.iter(|| black_box(manual.user_service()))
    });

    // HashMap DI
    let hashmap = hashmap_di::Container::new();
    let config = Arc::new(Config::default());
    let db = Arc::new(Database::new(Arc::clone(&config)));
    let repo = Arc::new(UserRepository::new(Arc::clone(&db)));
    let service = Arc::new(UserService::new(Arc::clone(&repo)));
    hashmap.register((*config).clone());
    hashmap.register((*db).clone());
    hashmap.register((*repo).clone());
    hashmap.register((*service).clone());
    group.bench_function("hashmap_rwlock", |b| {
        b.iter(|| black_box(hashmap.get::<UserService>()))
    });

    // DashMap DI
    let dashmap = dashmap_di::Container::new();
    dashmap.register((*config).clone());
    dashmap.register((*db).clone());
    dashmap.register((*repo).clone());
    dashmap.register((*service).clone());
    group.bench_function("dashmap_basic", |b| {
        b.iter(|| black_box(dashmap.get::<UserService>()))
    });

    // dependency-injector
    let di = dependency_injector::Container::new();
    di.singleton((*config).clone());
    di.singleton((*db).clone());
    di.singleton((*repo).clone());
    di.singleton((*service).clone());
    group.bench_function("dependency_injector", |b| {
        b.iter(|| black_box(di.get::<UserService>().unwrap()))
    });

    group.finish();
}

fn bench_container_creation(c: &mut Criterion) {
    let mut group = c.benchmark_group("container_creation");

    group.bench_function("manual_di", |b| {
        b.iter(|| black_box(manual_di::Container::new()))
    });

    group.bench_function("hashmap_rwlock", |b| {
        b.iter(|| black_box(hashmap_di::Container::new()))
    });

    group.bench_function("dashmap_basic", |b| {
        b.iter(|| black_box(dashmap_di::Container::new()))
    });

    group.bench_function("dependency_injector", |b| {
        b.iter(|| black_box(dependency_injector::Container::new()))
    });

    group.finish();
}

fn bench_registration(c: &mut Criterion) {
    let mut group = c.benchmark_group("service_registration");

    group.bench_function("hashmap_rwlock", |b| {
        b.iter(|| {
            let container = hashmap_di::Container::new();
            container.register(Config::default());
            black_box(container)
        })
    });

    group.bench_function("dashmap_basic", |b| {
        b.iter(|| {
            let container = dashmap_di::Container::new();
            container.register(Config::default());
            black_box(container)
        })
    });

    group.bench_function("dependency_injector", |b| {
        b.iter(|| {
            let container = dependency_injector::Container::new();
            container.singleton(Config::default());
            black_box(container)
        })
    });

    group.finish();
}

fn bench_concurrent_reads(c: &mut Criterion) {
    use std::thread;

    let mut group = c.benchmark_group("concurrent_reads");

    for num_threads in [1, 2, 4, 8] {
        // HashMap with RwLock
        let hashmap = Arc::new(hashmap_di::Container::new());
        hashmap.register(Config::default());
        group.bench_with_input(
            BenchmarkId::new("hashmap_rwlock", num_threads),
            &num_threads,
            |b, &n| {
                b.iter(|| {
                    let handles: Vec<_> = (0..n)
                        .map(|_| {
                            let c = Arc::clone(&hashmap);
                            thread::spawn(move || {
                                for _ in 0..100 {
                                    let _ = black_box(c.get::<Config>());
                                }
                            })
                        })
                        .collect();
                    for h in handles {
                        h.join().unwrap();
                    }
                })
            },
        );

        // DashMap
        let dashmap = Arc::new(dashmap_di::Container::new());
        dashmap.register(Config::default());
        group.bench_with_input(
            BenchmarkId::new("dashmap_basic", num_threads),
            &num_threads,
            |b, &n| {
                b.iter(|| {
                    let handles: Vec<_> = (0..n)
                        .map(|_| {
                            let c = Arc::clone(&dashmap);
                            thread::spawn(move || {
                                for _ in 0..100 {
                                    let _ = black_box(c.get::<Config>());
                                }
                            })
                        })
                        .collect();
                    for h in handles {
                        h.join().unwrap();
                    }
                })
            },
        );

        // dependency-injector
        let di = Arc::new(dependency_injector::Container::new());
        di.singleton(Config::default());
        group.bench_with_input(
            BenchmarkId::new("dependency_injector", num_threads),
            &num_threads,
            |b, &n| {
                b.iter(|| {
                    let handles: Vec<_> = (0..n)
                        .map(|_| {
                            let c = Arc::clone(&di);
                            thread::spawn(move || {
                                for _ in 0..100 {
                                    let _ = black_box(c.get::<Config>().unwrap());
                                }
                            })
                        })
                        .collect();
                    for h in handles {
                        h.join().unwrap();
                    }
                })
            },
        );
    }

    group.finish();
}

fn bench_mixed_workload(c: &mut Criterion) {
    let mut group = c.benchmark_group("mixed_workload");
    group.throughput(Throughput::Elements(100));

    // Simulate realistic web server workload:
    // - 80% reads (service resolution)
    // - 15% contains checks
    // - 5% new scope creation

    // dependency-injector
    let di = dependency_injector::Container::new();
    di.singleton(Config::default());
    let config = Arc::new(Config::default());
    let db = Arc::new(Database::new(Arc::clone(&config)));
    di.singleton((*db).clone());

    group.bench_function("dependency_injector", |b| {
        b.iter(|| {
            for i in 0..100 {
                match i % 20 {
                    0..=15 => {
                        // 80% - resolve service
                        let _ = black_box(di.get::<Config>());
                    }
                    16..=18 => {
                        // 15% - contains check
                        let _ = black_box(di.contains::<Database>());
                    }
                    _ => {
                        // 5% - create scope
                        let scope = di.scope();
                        let _ = black_box(scope);
                    }
                }
            }
        })
    });

    // DashMap basic
    let dashmap = dashmap_di::Container::new();
    dashmap.register(Config::default());
    dashmap.register((*db).clone());

    group.bench_function("dashmap_basic", |b| {
        b.iter(|| {
            for i in 0..100 {
                match i % 20 {
                    0..=15 => {
                        let _ = black_box(dashmap.get::<Config>());
                    }
                    16..=18 => {
                        // No contains in basic dashmap
                        let _ = black_box(dashmap.get::<Database>().is_some());
                    }
                    _ => {
                        // No scoping in basic dashmap
                        let scope = dashmap_di::Container::new();
                        let _ = black_box(scope);
                    }
                }
            }
        })
    });

    group.finish();
}

fn bench_service_count_scaling(c: &mut Criterion) {
    let mut group = c.benchmark_group("service_count_scaling");
    group.throughput(Throughput::Elements(1));

    for count in [10, 50, 100, 500] {
        // dependency-injector
        let di = dependency_injector::Container::new();
        for i in 0..count {
            // Register unique services by wrapping in a tuple
            di.singleton((i, Config::default()));
        }
        di.singleton(Config::default()); // Target service

        group.bench_with_input(
            BenchmarkId::new("dependency_injector", count),
            &count,
            |b, _| {
                b.iter(|| black_box(di.get::<Config>().unwrap()))
            },
        );

        // DashMap basic
        let dashmap = dashmap_di::Container::new();
        for i in 0..count {
            dashmap.register((i, Config::default()));
        }
        dashmap.register(Config::default());

        group.bench_with_input(BenchmarkId::new("dashmap_basic", count), &count, |b, _| {
            b.iter(|| black_box(dashmap.get::<Config>()))
        });
    }

    group.finish();
}

criterion_group!(
    comparison_benches,
    bench_singleton_resolution,
    bench_deep_dependency_chain,
    bench_container_creation,
    bench_registration,
    bench_concurrent_reads,
    bench_mixed_workload,
    bench_service_count_scaling,
);

criterion_main!(comparison_benches);

