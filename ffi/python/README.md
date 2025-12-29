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
cargo rustc --release --features ffi --crate-type cdylib
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
from dependency_injector import Container

# Create container
container = Container()

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
from dependency_injector import Container

with Container() as container:
    container.register("Service", {"data": "value"})
    result = container.resolve("Service")
    print(result["data"])  # "value"
# Container is automatically freed
```

## Scoped Containers

Create child scopes for request-level isolation:

```python
from dependency_injector import Container

root = Container()
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

## Optional Resolution

Use `try_resolve` to get `None` instead of raising an exception for missing services:

```python
from dependency_injector import Container

container = Container()
container.register("Config", {"debug": True})

# Returns the value if found
config = container.try_resolve("Config")  # {"debug": True}

# Returns None if not found (no exception)
missing = container.try_resolve("NonExistent")  # None

container.free()
```

## Type Hints with TypedDict

```python
from typing import TypedDict
from dependency_injector import Container

class Config(TypedDict):
    debug: bool
    port: int

container = Container()
container.register("Config", Config(debug=True, port=8080))

config: Config = container.resolve("Config")
print(config["port"])  # IDE knows this is an int!

container.free()
```

## API Reference

### `Container`

```python
from dependency_injector import Container

container = Container()

# Register a service (JSON-serializable value)
container.register("Key", {"value": 1})

# Resolve a service (raises DIError if not found)
data = container.resolve("Key")  # {"value": 1}

# Try to resolve (returns None if not found)
data = container.try_resolve("Key")  # {"value": 1} or None

# Check if a service exists
container.contains("Key")  # True

# Get service count
container.service_count  # 1

# Create a child scope
child = container.scope()

# Get library version
Container.version()  # "0.2.2"

# Free resources
container.free()
```

### Error Handling

```python
from dependency_injector import Container, DIError, ErrorCode

container = Container()

try:
    container.resolve("NonExistent")
except DIError as e:
    print(e.code)     # ErrorCode.NOT_FOUND
    print(e.message)  # "Service 'NonExistent' not found"

container.free()
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
export LD_LIBRARY_PATH=/path/to/dependency-injector/target/release:$LD_LIBRARY_PATH
pytest tests/ -v
```

## Running the Example

```bash
cd ffi/python
export LD_LIBRARY_PATH=/path/to/dependency-injector/target/release:$LD_LIBRARY_PATH
python examples/basic.py
```

## How It Works

This library uses Python's built-in `ctypes` module to call the Rust FFI functions directly. Services are serialized as JSON, which means:

- Plain objects (dicts), lists, strings, numbers, and booleans work perfectly
- Class instances and functions cannot be serialized
- Complex nested structures are fully supported
- Use `dataclasses.asdict()` to serialize dataclasses

## Performance

The native Rust library achieves ~10ns singleton resolution. The FFI overhead adds:

- ~1-5µs for JSON serialization (Python's `json` module)
- Minimal overhead for the ctypes FFI call

For most applications, this is negligible compared to actual I/O operations.

## Limitations

- Services are JSON-serialized, so functions and class instances won't work
- The native library must be accessible via LD_LIBRARY_PATH
- Binary data should be base64-encoded in JSON

## License

MIT OR Apache-2.0
