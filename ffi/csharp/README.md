# C# FFI Bindings for dependency-injector

C# bindings for the high-performance Rust dependency injection container.

## Requirements

- .NET 8.0 or later
- Native `dependency_injector` library (compiled from Rust)

## Building the Native Library

```bash
# From the project root
cargo build --release --features ffi

# Copy the library to your C# project
# Linux: target/release/libdependency_injector.so
# macOS: target/release/libdependency_injector.dylib
# Windows: target/release/dependency_injector.dll
```

## Installation

Add a reference to the `DependencyInjector` project or copy the source files.

## Usage

```csharp
using DependencyInjector;

// Create a container
using var container = new Container();

// Register a singleton
container.Singleton(new Config 
{ 
    DatabaseUrl = "postgres://localhost/db",
    MaxConnections = 10
});

// Resolve a service
var config = container.Get<Config>();

// Check if service exists
if (container.Contains<Config>())
{
    Console.WriteLine("Config is registered");
}

// Create a child scope
using var scope = container.Scope();
scope.Singleton(new RequestContext { Id = "req-123" });
```

## Limitations

The FFI bindings use JSON serialization for cross-language communication, which adds overhead compared to native Rust usage. For maximum performance, consider:

1. Using the native Rust library directly
2. Minimizing service resolution in hot paths
3. Caching resolved services when appropriate

## Benchmark Comparison

| Library | Singleton Resolution | Mixed Workload (100 ops) |
|---------|---------------------|--------------------------|
| **Rust dependency-injector** | **17-32 ns** | **2.2 µs** |
| C# Dictionary | 142 ns | 30 µs |
| Microsoft.Extensions.DI | 208 ns | 31 µs |
| C# Manual DI | 393 ns | 3.4 µs |

Note: C# benchmarks include JIT compilation overhead. Production performance may vary.

## API Reference

### Container

| Method | Description |
|--------|-------------|
| `Singleton<T>(T instance)` | Register a singleton service |
| `Transient<T>(T template)` | Register a transient factory |
| `Get<T>()` | Resolve a service (returns null if not found) |
| `Contains<T>()` | Check if a service is registered |
| `Remove<T>()` | Remove a service registration |
| `Scope()` | Create a child container |
| `Dispose()` | Release native resources |

## License

MIT OR Apache-2.0

