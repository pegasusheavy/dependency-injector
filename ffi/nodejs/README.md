# @pegasusheavy/dependency-injector

Node.js/TypeScript bindings for the high-performance Rust dependency injection container.

## Features

- 🚀 **High Performance** - Native Rust implementation with ~10ns resolution
- 📦 **Type-Safe** - Full TypeScript support with generics
- 🔄 **Scoped Containers** - Hierarchical scopes for request-level isolation
- 🧵 **Thread-Safe** - Safe to use in worker threads
- 🔌 **FFI-Based** - Direct native bindings via koffi (no native compilation required)
- ⚡ **SWC-Powered** - Lightning-fast builds with SWC

## Prerequisites

1. **pnpm** - This project requires pnpm as the package manager:

```bash
# Install pnpm if you don't have it
npm install -g pnpm
# Or use corepack (Node.js 16.10+)
corepack enable
```

2. Build the Rust library:

```bash
cd /path/to/dependency-injector
cargo rustc --release --features ffi --crate-type cdylib
```

3. Set the library path:

```bash
# Linux
export LD_LIBRARY_PATH=/path/to/dependency-injector/target/release:$LD_LIBRARY_PATH

# macOS
export DYLD_LIBRARY_PATH=/path/to/dependency-injector/target/release:$DYLD_LIBRARY_PATH

# Windows (add to PATH)
set PATH=%PATH%;C:\path\to\dependency-injector\target\release
```

## Installation

```bash
pnpm add @pegasusheavy/dependency-injector
```

## Quick Start

```typescript
import { Container } from '@pegasusheavy/dependency-injector';

// Define your service interfaces
interface Config {
  debug: boolean;
  port: number;
}

interface Database {
  host: string;
  port: number;
}

// Create container
const container = new Container();

// Register services (automatically serialized as JSON)
container.register<Config>('Config', { debug: true, port: 8080 });
container.register<Database>('Database', { host: 'localhost', port: 5432 });

// Resolve services (automatically deserialized)
const config = container.resolve<Config>('Config');
console.log(config.port); // 8080

// Check existence
console.log(container.contains('Config')); // true

// Don't forget to free when done
container.free();
```

## Scoped Containers

Create child scopes for request-level isolation:

```typescript
const root = new Container();
root.register('Config', { env: 'production' });

// Create request scope
const requestScope = root.scope();
requestScope.register('RequestId', { id: 'req-123' });

// Child can access parent services
requestScope.resolve('Config'); // Works!

// Parent cannot access child services
root.contains('RequestId'); // false

// Clean up
requestScope.free();
root.free();
```

## API Reference

### `Container`

#### `new Container()`
Create a new dependency injection container.

#### `container.register<T>(typeName: string, value: T): void`
Register a singleton service. The value is JSON-serialized.

#### `container.resolve<T>(typeName: string): T`
Resolve a service. The value is JSON-deserialized.

#### `container.contains(typeName: string): boolean`
Check if a service is registered.

#### `container.scope(): Container`
Create a child scope that inherits parent services.

#### `container.serviceCount: number`
Get the number of registered services.

#### `container.free(): void`
Free the container and release native resources.

#### `Container.version(): string`
Get the library version.

### `DIError`

Error class thrown by the container.

```typescript
import { DIError, ErrorCode } from '@pegasusheavy/dependency-injector';

try {
  container.resolve('NonExistent');
} catch (error) {
  if (error instanceof DIError) {
    console.log(error.code); // ErrorCode.NotFound
    console.log(error.message); // "Service not found: ..."
  }
}
```

### `ErrorCode`

```typescript
enum ErrorCode {
  Ok = 0,
  NotFound = 1,
  InvalidArgument = 2,
  AlreadyRegistered = 3,
  InternalError = 4,
  SerializationError = 5,
}
```

## Development

### Setup

```bash
# Install dependencies (pnpm required)
cd ffi/nodejs
pnpm install
```

### Build

```bash
# Full build (SWC + TypeScript declarations)
pnpm build

# SWC only (fast JS compilation)
pnpm build:swc

# TypeScript declarations only
pnpm build:types

# Type checking without emit
pnpm typecheck
```

### Running Tests

```bash
# Build the native library first
cd /path/to/dependency-injector
cargo rustc --release --features ffi --crate-type cdylib

# Run tests
cd ffi/nodejs
export LD_LIBRARY_PATH=/path/to/dependency-injector/target/release:$LD_LIBRARY_PATH
pnpm test
```

### Running the Example

```bash
cd ffi/nodejs
pnpm install
export LD_LIBRARY_PATH=/path/to/dependency-injector/target/release:$LD_LIBRARY_PATH
pnpm example
```

## Type Safety

The library uses TypeScript generics for type-safe resolution:

```typescript
interface User {
  id: number;
  name: string;
}

container.register<User>('User', { id: 1, name: 'Alice' });

// TypeScript knows this is a User
const user = container.resolve<User>('User');
console.log(user.name); // TypeScript autocomplete works!
```

## Memory Management

**Important**: Always call `free()` on containers when you're done:

```typescript
const container = new Container();
try {
  // Use container...
} finally {
  container.free();
}
```

For scoped containers:

```typescript
const root = new Container();
const scope = root.scope();

// Free in reverse order (children before parents)
scope.free();
root.free();
```

## How It Works

This package uses [koffi](https://koffi.dev/) for FFI bindings, which:
- Requires no native compilation (unlike `ffi-napi`)
- Works out of the box on Windows, macOS, and Linux
- Supports all modern Node.js versions (18+)

Services are serialized as JSON, which means:
- Plain objects, arrays, strings, numbers, and booleans work perfectly
- Class instances and functions cannot be serialized
- Complex nested structures are fully supported

## Performance

The native Rust library achieves ~9ns singleton resolution. The FFI overhead adds:
- ~50-100ns for JSON serialization
- ~10-20ns for FFI call overhead

For most applications, this is negligible. If you need maximum performance, consider using the Rust library directly.

## Limitations

- Services are JSON-serialized, so functions and class instances won't work
- The native library must be built and accessible via LD_LIBRARY_PATH
- Binary data should be base64-encoded in JSON

## License

MIT OR Apache-2.0
