# dependency-injector-rust

Python bindings for the high-performance Rust dependency injection container.

## Features

- 🚀 **High Performance** - Native Rust implementation with ~10ns resolution
- 🐍 **Pythonic API** - Clean, idiomatic Python interface
- 🔄 **Scoped Containers** - Hierarchical scopes for request-level isolation
- 📝 **Type Hints** - Full type annotation support
- 🔌 **Zero Dependencies** - Uses only Python's built-in `ctypes`

## Prerequisites

1. Build the Rust library:

```bash
cd /path/to/dependency-injector
cargo build --release --features ffi
```

2. Set the library path:

```bash
# Linux
export LD_LIBRARY_PATH=/path/to/dependency-injector/target/release:$LD_LIBRARY_PATH

# macOS
export DYLD_LIBRARY_PATH=/path/to/dependency-injector/target/release:$DYLD_LIBRARY_PATH

# Windows
set PATH=%PATH%;C:\path\to\dependency-injector\target\release
```

## Installation

```bash
pip install dependency-injector-rust
```

Or install from source:

```bash
cd ffi/python
pip install -e .
```

## Quick Start

```python
from dependency_injector.container import CachingContainer

# Create container
container = CachingContainer()

# Register services (automatically JSON-serialized)
container.register("Config", {"debug": True, "port": 8080})
container.register("Database", {"host": "localhost", "port": 5432})

# Resolve services (automatically JSON-deserialized)
config = container.resolve("Config")
print(config["port"])  # 8080

# Check existence
print(container.contains("Config"))  # True

# Don't forget to free!
container.free()
```

## Context Manager Support

```python
from dependency_injector.container import CachingContainer

with CachingContainer() as container:
    container.register("Service", {"data": "value"})
    result = container.resolve("Service")
    print(result["data"])  # "value"
# Container is automatically freed
```

## Scoped Containers

Create child scopes for request-level isolation:

```python
from dependency_injector.container import CachingContainer

root = CachingContainer()
root.register("Config", {"env": "production"})

# Create request scope
request = root.scope()
request.register("RequestId", {"id": "req-123"})

# Child can access parent services
config = request.resolve("Config")  # Works!

# Parent cannot access child services
root.contains("RequestId")  # False

# Clean up (children before parents)
request.free()
root.free()
```

## Type Hints with TypedDict

```python
from typing import TypedDict
from dependency_injector.container import CachingContainer

class Config(TypedDict):
    debug: bool
    port: int

container = CachingContainer()
container.register("Config", Config(debug=True, port=8080))

config: Config = container.resolve("Config")
print(config["port"])  # IDE knows this is an int!

container.free()
```

## API Reference

### `Container`

Basic container without resolve support (for contains/registration only).

```python
from dependency_injector import Container

container = Container()
container.register("Key", {"value": 1})
container.contains("Key")  # True
container.service_count    # 1
container.free()
```

### `CachingContainer`

Container with full resolve support via local caching.

```python
from dependency_injector.container import CachingContainer

container = CachingContainer()
container.register("Key", {"value": 1})
data = container.resolve("Key")  # {"value": 1}
container.free()
```

### Error Handling

```python
from dependency_injector import DIError, ErrorCode

try:
    container.resolve("NonExistent")
except DIError as e:
    print(e.code)     # ErrorCode.NOT_FOUND
    print(e.message)  # "Service 'NonExistent' not found"
```

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| 0 | `OK` | Success |
| 1 | `NOT_FOUND` | Service not found |
| 2 | `INVALID_ARGUMENT` | Invalid argument |
| 3 | `ALREADY_REGISTERED` | Service already exists |
| 4 | `INTERNAL_ERROR` | Internal error |
| 5 | `SERIALIZATION_ERROR` | JSON serialization failed |

## Running Tests

```bash
cd ffi/python
pip install -e ".[dev]"
pytest tests/ -v
```

## Running the Example

```bash
cd ffi/python
python examples/basic.py
```

## Limitations

- Services are JSON-serialized, so functions and class instances won't work
- Use `CachingContainer` for `resolve()` support
- The native library must be accessible via LD_LIBRARY_PATH

## License

MIT OR Apache-2.0

