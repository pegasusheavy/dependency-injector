# dependency-injector-derive

Derive macros for [dependency-injector](https://crates.io/crates/dependency-injector).

## Overview

This crate provides the `#[derive(Inject)]` macro for automatic compile-time dependency injection. It generates a `from_container()` method that resolves dependencies from a `Container` instance.

## Installation

This crate is typically used through the `derive` feature of `dependency-injector`:

```toml
[dependencies]
dependency-injector = { version = "0.2", features = ["derive"] }
```

Or directly:

```toml
[dependencies]
dependency-injector-derive = "0.1"
dependency-injector = "0.2"
```

## Usage

```rust
use dependency_injector::{Container, Inject};
use std::sync::Arc;

#[derive(Clone)]
struct Database {
    url: String,
}

#[derive(Clone)]
struct Cache {
    size: usize,
}

#[derive(Inject)]
struct UserService {
    #[inject]
    db: Arc<Database>,

    #[inject]
    cache: Arc<Cache>,

    #[inject(optional)]
    logger: Option<Arc<Logger>>,  // Won't fail if not registered

    // Non-injected fields use Default::default()
    request_count: u64,
}

fn main() -> dependency_injector::Result<()> {
    let container = Container::new();
    container.singleton(Database { url: "postgres://localhost".into() });
    container.singleton(Cache { size: 1024 });

    // Automatically resolve all #[inject] fields
    let service = UserService::from_container(&container)?;

    Ok(())
}
```

## Attributes

| Attribute | Field Type | Description |
|-----------|------------|-------------|
| `#[inject]` | `Arc<T>` | Required dependency. Fails if not registered. |
| `#[inject(optional)]` | `Option<Arc<T>>` | Optional dependency. `None` if not registered. |
| *(none)* | Any `Default` type | Uses `Default::default()`. |

## Generated Code

The macro generates an impl block with a `from_container` method:

```rust
impl UserService {
    pub fn from_container(
        container: &Container
    ) -> Result<Self, DiError> {
        Ok(Self {
            db: container.get::<Database>()?,
            cache: container.get::<Cache>()?,
            logger: container.try_get::<Logger>(),
            request_count: Default::default(),
        })
    }
}
```

## Requirements

- Struct must have named fields (no tuple structs)
- `#[inject]` fields must be `Arc<T>`
- `#[inject(optional)]` fields must be `Option<Arc<T>>`
- Non-injected fields must implement `Default`

## License

Licensed under either of Apache License, Version 2.0 or MIT license at your option.

