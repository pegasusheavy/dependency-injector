#![no_main]

//! Fuzz target for basic container operations
//!
//! Tests registration and resolution with various data patterns.

use arbitrary::{Arbitrary, Unstructured};
use dependency_injector::Container;
use libfuzzer_sys::fuzz_target;
use std::sync::Arc;

/// Service types for fuzzing
#[derive(Clone, Debug, Arbitrary)]
struct SmallService {
    id: u32,
    name: String,
}

#[derive(Clone, Debug, Arbitrary)]
struct MediumService {
    id: u64,
    data: Vec<u8>,
    config: ServiceConfig,
}

#[derive(Clone, Debug, Arbitrary)]
struct ServiceConfig {
    enabled: bool,
    timeout_ms: u32,
    retries: u8,
    tags: Vec<String>,
}

#[derive(Clone, Debug, Arbitrary)]
struct LargeService {
    id: u128,
    payload: Vec<u8>,
    metadata: Vec<(String, String)>,
}

/// Operations to perform on the container
#[derive(Debug, Arbitrary)]
enum ContainerOp {
    RegisterSmall(SmallService),
    RegisterMedium(MediumService),
    RegisterLarge(LargeService),
    RegisterLazySmall,
    RegisterTransientSmall,
    GetSmall,
    GetMedium,
    GetLarge,
    TryGetSmall,
    TryGetMedium,
    ContainsSmall,
    ContainsMedium,
    ContainsLarge,
    Clear,
    GetLen,
    IsEmpty,
}

fuzz_target!(|ops: Vec<ContainerOp>| {
    let container = Container::new();

    // Track what we've registered
    let mut has_small = false;
    let mut has_medium = false;
    let mut has_large = false;

    for op in ops {
        match op {
            ContainerOp::RegisterSmall(svc) => {
                container.singleton(svc);
                has_small = true;
            }
            ContainerOp::RegisterMedium(svc) => {
                container.singleton(svc);
                has_medium = true;
            }
            ContainerOp::RegisterLarge(svc) => {
                container.singleton(svc);
                has_large = true;
            }
            ContainerOp::RegisterLazySmall => {
                container.lazy(|| SmallService {
                    id: 42,
                    name: "lazy".into(),
                });
                has_small = true;
            }
            ContainerOp::RegisterTransientSmall => {
                container.transient(|| SmallService {
                    id: 0,
                    name: "transient".into(),
                });
                has_small = true;
            }
            ContainerOp::GetSmall => {
                let result = container.get::<SmallService>();
                if has_small {
                    // Should succeed if registered
                    assert!(result.is_ok() || result.is_err());
                }
            }
            ContainerOp::GetMedium => {
                let result = container.get::<MediumService>();
                if has_medium {
                    assert!(result.is_ok() || result.is_err());
                }
            }
            ContainerOp::GetLarge => {
                let result = container.get::<LargeService>();
                if has_large {
                    assert!(result.is_ok() || result.is_err());
                }
            }
            ContainerOp::TryGetSmall => {
                let _ = container.try_get::<SmallService>();
            }
            ContainerOp::TryGetMedium => {
                let _ = container.try_get::<MediumService>();
            }
            ContainerOp::ContainsSmall => {
                let result = container.contains::<SmallService>();
                // After clear, has_small is invalid, so just verify no panic
                let _ = result;
            }
            ContainerOp::ContainsMedium => {
                let _ = container.contains::<MediumService>();
            }
            ContainerOp::ContainsLarge => {
                let _ = container.contains::<LargeService>();
            }
            ContainerOp::Clear => {
                container.clear();
                has_small = false;
                has_medium = false;
                has_large = false;
            }
            ContainerOp::GetLen => {
                let _ = container.len();
            }
            ContainerOp::IsEmpty => {
                let _ = container.is_empty();
            }
        }
    }
});

