# dependency-injector C# Bindings

C# bindings for the high-performance Rust dependency injection container.

## Features

- 🚀 **High Performance** - Native Rust implementation with ~10ns resolution
- 📦 **Type-Safe** - Full generic support with compile-time type checking
- 🔄 **Scoped Containers** - Hierarchical scopes for request-level isolation
- 🧵 **Thread-Safe** - Safe to use from multiple threads
- 🔌 **P/Invoke** - Direct native bindings via P/Invoke

## Requirements

- .NET 8.0 or later
- Native `dependency_injector` library (compiled from Rust)

## Building the Native Library

```bash
# From the project root
cd /path/to/dependency-injector
cargo rustc --release --features ffi --crate-type cdylib

# The library will be at:
# Linux:   target/release/libdependency_injector.so
# macOS:   target/release/libdependency_injector.dylib
# Windows: target/release/dependency_injector.dll
```

Set the library path:

```bash
# Linux
export LD_LIBRARY_PATH=/path/to/dependency-injector/target/release:$LD_LIBRARY_PATH

# macOS
export DYLD_LIBRARY_PATH=/path/to/dependency-injector/target/release:$DYLD_LIBRARY_PATH

# Windows (add to PATH or copy DLL to output directory)
set PATH=%PATH%;C:\path\to\dependency-injector\target\release
```

## Installation

Add a reference to the `DependencyInjector` project or use the NuGet package (when published):

```bash
dotnet add package PegasusHeavy.DependencyInjector
```

## Quick Start

```csharp
using DependencyInjector;

// Define your service types
record Config(bool Debug, int Port, string Environment);
record User(int Id, string Name, string Email);

// Create a container
using var container = new Container();

// Register services
container.Register("Config", new Config(true, 8080, "development"));
container.Register(new User(1, "Alice", "alice@example.com"));

// Resolve services
var config = container.Resolve<Config>("Config");
Console.WriteLine($"Port: {config.Port}"); // Port: 8080

var user = container.Resolve<User>(); // Uses type name as key
Console.WriteLine($"User: {user.Name}"); // User: Alice

// Optional resolution (returns null if not found)
var missing = container.TryResolve<Config>("NonExistent");
// missing is null

// Check existence
Console.WriteLine(container.Contains("Config")); // true
```

## Scoped Containers

Create child scopes for request-level isolation:

```csharp
using var root = new Container();
root.Register("Config", new Config(true, 8080, "production"));

// Create request scope
using var request = root.Scope();
request.Register("RequestId", new RequestContext("req-123"));

// Child can access parent services
var config = request.Resolve<Config>("Config"); // Works!

// Parent cannot access child services
root.Contains("RequestId"); // false

// Clean up happens automatically with `using`
```

## API Reference

### Container

```csharp
// Create container
using var container = new Container();

// Register with explicit type name
container.Register<T>("TypeName", instance);

// Register using type's full name
container.Register<T>(instance);

// Resolve (throws DIException if not found)
T service = container.Resolve<T>("TypeName");
T service = container.Resolve<T>();

// Try resolve (returns null if not found)
T? service = container.TryResolve<T>("TypeName");
T? service = container.TryResolve<T>();

// Check existence
bool exists = container.Contains("TypeName");
bool exists = container.Contains<T>();

// Get service count
long count = container.ServiceCount;

// Create child scope
using var scope = container.Scope();

// Get library version
string version = Container.Version;

// Dispose (called automatically with `using`)
container.Dispose();
```

### DIException

```csharp
using DependencyInjector;
using DependencyInjector.Native;

try
{
    container.Resolve<Config>("NonExistent");
}
catch (DIException ex)
{
    Console.WriteLine(ex.ErrorCode); // DiErrorCode.NotFound
    Console.WriteLine(ex.Message);   // "Service 'NonExistent' not found"
}
```

### Error Codes

| Code | Enum Value | Description |
|------|------------|-------------|
| 0 | `DiErrorCode.Ok` | Success |
| 1 | `DiErrorCode.NotFound` | Service not found |
| 2 | `DiErrorCode.InvalidArgument` | Invalid argument |
| 3 | `DiErrorCode.AlreadyRegistered` | Service already exists |
| 4 | `DiErrorCode.InternalError` | Internal error |
| 5 | `DiErrorCode.SerializationError` | JSON serialization failed |

## Project Structure

```
ffi/csharp/
├── DependencyInjector.sln           # Solution file
├── DependencyInjector/              # Main library
│   ├── Container.cs                 # High-level container API
│   ├── NativeBindings.cs            # P/Invoke declarations
│   └── DependencyInjector.csproj
├── DependencyInjector.Tests/        # Unit tests
│   ├── ContainerTests.cs
│   └── DependencyInjector.Tests.csproj
├── Example/                         # Example application
│   ├── Program.cs
│   └── Example.csproj
└── README.md
```

## Building and Testing

```bash
cd ffi/csharp

# Build all projects
dotnet build

# Run tests
export LD_LIBRARY_PATH=/path/to/dependency-injector/target/release:$LD_LIBRARY_PATH
dotnet test

# Run example
dotnet run --project Example
```

## Performance

The native Rust library achieves ~10ns singleton resolution. The P/Invoke overhead adds:
- ~50-100ns for P/Invoke call
- ~1-5µs for JSON serialization (System.Text.Json)

### Benchmark Comparison

| Library | Singleton Resolution | Mixed Workload (100 ops) |
|---------|---------------------|--------------------------|
| **Rust dependency-injector** | **17-32 ns** | **2.2 µs** |
| C# Dictionary | 142 ns | 30 µs |
| Microsoft.Extensions.DI | 208 ns | 31 µs |
| C# Manual DI | 393 ns | 3.4 µs |

*Note: C# benchmarks include JIT compilation overhead. Production performance may vary.*

## Limitations

- Services are JSON-serialized, so:
  - Functions and delegates won't work
  - Circular references may cause issues
  - Non-serializable types need custom handling
- The native library must be accessible via LD_LIBRARY_PATH or in the executable directory
- Requires .NET 8.0 or later (for modern P/Invoke features)

## Memory Management

The container implements `IDisposable` and uses a finalizer for safety. Always use `using` statements:

```csharp
using var container = new Container();
// Use container...
// Automatically disposed at end of scope
```

For scoped containers, the `using` statement handles cleanup in the correct order:

```csharp
using var root = new Container();
using var scope = root.Scope();
// Use containers...
// scope is disposed first, then root
```

## License

MIT OR Apache-2.0
