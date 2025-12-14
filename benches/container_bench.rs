//! Benchmarks for the DI container

use dependency_injector::Container;
use criterion::{black_box, criterion_group, criterion_main, Criterion, Throughput};
use std::sync::Arc;

#[derive(Clone)]
struct SmallService {
    value: i32,
}

#[derive(Clone)]
struct MediumService {
    name: String,
    values: Vec<i32>,
}

#[derive(Clone)]
struct LargeService {
    data: Vec<u8>,
    config: std::collections::HashMap<String, String>,
}

fn bench_registration(c: &mut Criterion) {
    let mut group = c.benchmark_group("registration");

    group.bench_function("singleton_small", |b| {
        b.iter(|| {
            let container = Container::new();
            container.singleton(SmallService { value: 42 });
            black_box(container)
        })
    });

    group.bench_function("singleton_medium", |b| {
        b.iter(|| {
            let container = Container::new();
            container.singleton(MediumService {
                name: "test".to_string(),
                values: vec![1, 2, 3, 4, 5],
            });
            black_box(container)
        })
    });

    group.bench_function("lazy", |b| {
        b.iter(|| {
            let container = Container::new();
            container.lazy(|| SmallService { value: 42 });
            black_box(container)
        })
    });

    group.bench_function("transient", |b| {
        b.iter(|| {
            let container = Container::new();
            container.transient(|| SmallService { value: 42 });
            black_box(container)
        })
    });

    group.finish();
}

fn bench_resolution(c: &mut Criterion) {
    let mut group = c.benchmark_group("resolution");
    group.throughput(Throughput::Elements(1));

    // Pre-create container with services
    let container = Container::new();
    container.singleton(SmallService { value: 42 });
    container.singleton(MediumService {
        name: "test".to_string(),
        values: vec![1, 2, 3, 4, 5],
    });

    group.bench_function("get_singleton", |b| {
        b.iter(|| {
            let service = container.get::<SmallService>().unwrap();
            black_box(service)
        })
    });

    group.bench_function("get_medium", |b| {
        b.iter(|| {
            let service = container.get::<MediumService>().unwrap();
            black_box(service)
        })
    });

    group.bench_function("contains_check", |b| {
        b.iter(|| {
            let exists = container.contains::<SmallService>();
            black_box(exists)
        })
    });

    group.bench_function("try_get_found", |b| {
        b.iter(|| {
            let service = container.try_get::<SmallService>();
            black_box(service)
        })
    });

    group.bench_function("try_get_not_found", |b| {
        b.iter(|| {
            let service = container.try_get::<LargeService>();
            black_box(service)
        })
    });

    group.finish();
}

fn bench_transient_resolution(c: &mut Criterion) {
    let mut group = c.benchmark_group("transient");
    group.throughput(Throughput::Elements(1));

    let container = Container::new();
    container.transient(|| SmallService { value: 42 });

    group.bench_function("get_transient", |b| {
        b.iter(|| {
            let service = container.get::<SmallService>().unwrap();
            black_box(service)
        })
    });

    group.finish();
}

fn bench_scoped(c: &mut Criterion) {
    let mut group = c.benchmark_group("scoped");

    group.bench_function("create_scope", |b| {
        let root = Container::new();
        root.singleton(SmallService { value: 42 });

        b.iter(|| {
            let scope = root.scope();
            black_box(scope)
        })
    });

    group.bench_function("resolve_from_parent", |b| {
        let root = Container::new();
        root.singleton(SmallService { value: 42 });
        let child = root.scope();

        b.iter(|| {
            let service = child.get::<SmallService>().unwrap();
            black_box(service)
        })
    });

    group.bench_function("resolve_override", |b| {
        let root = Container::new();
        root.singleton(SmallService { value: 42 });
        let child = root.scope();
        child.singleton(SmallService { value: 100 });

        b.iter(|| {
            let service = child.get::<SmallService>().unwrap();
            black_box(service)
        })
    });

    group.finish();
}

fn bench_concurrent(c: &mut Criterion) {
    use std::thread;

    let mut group = c.benchmark_group("concurrent");

    group.bench_function("concurrent_reads_4", |b| {
        let container = Arc::new(Container::new());
        container.singleton(SmallService { value: 42 });

        b.iter(|| {
            let handles: Vec<_> = (0..4)
                .map(|_| {
                    let c = Arc::clone(&container);
                    thread::spawn(move || {
                        for _ in 0..100 {
                            let _ = c.get::<SmallService>().unwrap();
                        }
                    })
                })
                .collect();

            for h in handles {
                h.join().unwrap();
            }
        })
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_registration,
    bench_resolution,
    bench_transient_resolution,
    bench_scoped,
    bench_concurrent,
);

criterion_main!(benches);

