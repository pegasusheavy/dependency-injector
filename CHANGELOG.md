# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2025-12-14

### Fixed

- Updated MSRV to 1.85.0 for Edition 2024 support
- Fixed deprecated `criterion::black_box` usage (now uses `std::hint::black_box`)
- Resolved all Clippy warnings (collapsible_if, redundant_closure, type_complexity)
- Fixed dead_code warnings in test modules
- Corrected `dtolnay/rust-action` to `dtolnay/rust-toolchain` in CI workflows
- Improved benchmark workflow robustness

### Changed

- Upgraded GitHub Actions versions (upload-artifact v6, github-script v8, action-gh-release v2, codecov-action v5)

## [0.1.0] - 2025-12-14

### Added

- **Core Container**
  - High-performance, lock-free dependency injection container
  - Thread-safe concurrent access using `DashMap`
  - Type-safe service resolution with compile-time guarantees

- **Service Lifetimes**
  - `singleton()` - Immediate registration, shared instance
  - `lazy()` - Deferred initialization on first access
  - `transient()` - New instance on every resolution

- **Scoped Containers**
  - `scope()` - Create child containers that inherit from parent
  - Service overrides in child scopes
  - Isolated request/tenant contexts

- **API**
  - `get::<T>()` - Resolve a service by type
  - `contains::<T>()` - Check if a service is registered
  - `remove::<T>()` - Remove a service registration

- **Optional Features**
  - `tracing` - Integration with the `tracing` crate (enabled by default)
  - `async` - Async support with Tokio

- **Documentation**
  - Full documentation website at https://pegasusheavy.github.io/dependency-injector/
  - Getting started guide
  - API reference
  - Usage examples with Armature framework
  - Live benchmark results page

- **CI/CD**
  - Automated testing on multiple platforms
  - Clippy linting and formatting checks
  - Security audits with `cargo-audit`
  - Performance benchmarks with Criterion
  - Automatic GitHub Pages deployment

### Security

- Lock-free design eliminates deadlock possibilities
- No unsafe code in public API

[Unreleased]: https://github.com/pegasusheavy/dependency-injector/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/pegasusheavy/dependency-injector/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/pegasusheavy/dependency-injector/releases/tag/v0.1.0

