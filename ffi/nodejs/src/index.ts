/**
 * Node.js bindings for the dependency-injector Rust library.
 *
 * This module provides a high-level TypeScript API for the dependency injection
 * container, wrapping the native FFI calls using koffi.
 *
 * @example
 * ```typescript
 * import { Container } from '@pegasusheavy/dependency-injector';
 *
 * const container = new Container();
 *
 * // Register a service
 * container.register('Config', { debug: true, port: 8080 });
 *
 * // Resolve the service
 * const config = container.resolve<{ debug: boolean; port: number }>('Config');
 * console.log(config.port); // 8080
 *
 * container.free();
 * ```
 *
 * @module
 */

import koffi from "koffi";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

/**
 * Error codes from the native library.
 */
export enum ErrorCode {
  Ok = 0,
  NotFound = 1,
  InvalidArgument = 2,
  AlreadyRegistered = 3,
  InternalError = 4,
  SerializationError = 5,
}

/**
 * Error thrown by the dependency injector.
 */
export class DIError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string
  ) {
    super(message);
    this.name = "DIError";
  }

  static fromCode(code: ErrorCode, lastError?: string): DIError {
    const messages: Record<ErrorCode, string> = {
      [ErrorCode.Ok]: "Success",
      [ErrorCode.NotFound]: "Service not found",
      [ErrorCode.InvalidArgument]: "Invalid argument",
      [ErrorCode.AlreadyRegistered]: "Service already registered",
      [ErrorCode.InternalError]: "Internal error",
      [ErrorCode.SerializationError]: "Serialization error",
    };
    const baseMessage = messages[code] || `Unknown error code: ${code}`;
    const fullMessage = lastError ? `${baseMessage}: ${lastError}` : baseMessage;
    return new DIError(code, fullMessage);
  }
}

/**
 * Find the native library path.
 */
function findLibraryPath(): string {
  // Get current file directory (ESM compatible)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Try multiple locations
  const possiblePaths = [
    // Development: relative to ffi directory
    path.resolve(__dirname, "../../../target/release/libdependency_injector.so"),
    path.resolve(__dirname, "../../../../target/release/libdependency_injector.so"),
    path.resolve(__dirname, "../../../target/release/libdependency_injector.dylib"),
    path.resolve(__dirname, "../../../../target/release/libdependency_injector.dylib"),
    path.resolve(__dirname, "../../../target/release/dependency_injector.dll"),
    path.resolve(__dirname, "../../../../target/release/dependency_injector.dll"),
    // Custom path from environment
    process.env.DI_LIBRARY_PATH,
  ].filter(Boolean) as string[];

  // Find first existing path
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        return p;
      }
    } catch {
      // Continue to next path
    }
  }

  // Return the first path and let koffi handle the error
  return possiblePaths[0];
}

// Define koffi types
const ContainerPtr = koffi.pointer("DiContainer", koffi.opaque());
const ServicePtr = koffi.pointer("DiService", koffi.opaque());

// Load the native library
let lib: ReturnType<typeof koffi.load>;

try {
  const libPath = findLibraryPath();
  lib = koffi.load(libPath);
} catch (error) {
  throw new Error(
    `Failed to load dependency-injector native library. ` +
      `Make sure you've built it with: cargo rustc --release --features ffi --crate-type cdylib\n` +
      `Original error: ${error}`
  );
}

// Define FFI functions
const di_container_new = lib.func("di_container_new", ContainerPtr, []);
const di_container_free = lib.func("di_container_free", "void", [ContainerPtr]);
const di_container_scope = lib.func("di_container_scope", ContainerPtr, [ContainerPtr]);

const di_register_singleton = lib.func("di_register_singleton", "int", [
  ContainerPtr,
  "str",
  koffi.pointer("uint8_t"),
  "size_t",
]);
const di_register_singleton_json = lib.func("di_register_singleton_json", "int", [
  ContainerPtr,
  "str",
  "str",
]);

const di_resolve_json = lib.func("di_resolve_json", "str", [ContainerPtr, "str"]);
const di_contains = lib.func("di_contains", "int", [ContainerPtr, "str"]);
const di_service_count = lib.func("di_service_count", "int64", [ContainerPtr]);

const di_error_message = lib.func("di_error_message", "str", []);
const di_error_clear = lib.func("di_error_clear", "void", []);
const di_string_free = lib.func("di_string_free", "void", ["str"]);

const di_version = lib.func("di_version", "str", []);

/**
 * Get the last error message from the native library.
 */
function getLastError(): string | null {
  const error = di_error_message();
  if (!error) {
    return null;
  }
  return error;
}

/**
 * Clear the last error in the native library.
 */
function clearError(): void {
  di_error_clear();
}

/**
 * A dependency injection container.
 *
 * The container stores services by string type names and serializes them as JSON.
 * This allows seamless interop between TypeScript objects and the Rust container.
 *
 * @example
 * ```typescript
 * const container = new Container();
 *
 * // Register services
 * container.register('Database', { host: 'localhost', port: 5432 });
 * container.register('Config', { debug: true });
 *
 * // Resolve services
 * const db = container.resolve<{ host: string; port: number }>('Database');
 *
 * // Create scoped containers
 * const requestScope = container.scope();
 * requestScope.register('RequestId', { id: 'req-123' });
 *
 * requestScope.free();
 * container.free();
 * ```
 */
export class Container {
  private ptr: unknown | null;
  private isFreed = false;

  /**
   * Create a new dependency injection container.
   */
  constructor() {
    this.ptr = di_container_new();
    if (!this.ptr) {
      throw new DIError(ErrorCode.InternalError, "Failed to create container");
    }
  }

  /**
   * Create a container from an existing native pointer.
   * @internal
   */
  private static fromPtr(ptr: unknown): Container {
    const container = Object.create(Container.prototype);
    container.ptr = ptr;
    container.isFreed = false;
    return container;
  }

  /**
   * Check if the container has been freed.
   */
  private ensureNotFreed(): void {
    if (this.isFreed || !this.ptr) {
      throw new DIError(ErrorCode.InvalidArgument, "Container has been freed");
    }
  }

  /**
   * Free the container and release native resources.
   *
   * After calling this method, the container can no longer be used.
   */
  free(): void {
    if (!this.isFreed && this.ptr) {
      di_container_free(this.ptr);
      this.isFreed = true;
      this.ptr = null;
    }
  }

  /**
   * Create a child scope that inherits services from this container.
   *
   * Services registered in the child scope are not visible to the parent.
   * The child scope can resolve services from the parent.
   *
   * @returns A new scoped container.
   *
   * @example
   * ```typescript
   * const root = new Container();
   * root.register('Config', { env: 'production' });
   *
   * const request = root.scope();
   * request.register('User', { id: 1 });
   *
   * // Child can access parent's services
   * request.resolve('Config'); // Works
   *
   * // Parent cannot access child's services
   * root.contains('User'); // false
   *
   * request.free();
   * root.free();
   * ```
   */
  scope(): Container {
    this.ensureNotFreed();
    clearError();
    const childPtr = di_container_scope(this.ptr!);
    if (!childPtr) {
      const error = getLastError();
      throw new DIError(ErrorCode.InternalError, error || "Failed to create scope");
    }
    return Container.fromPtr(childPtr);
  }

  /**
   * Register a singleton service with the given type name.
   *
   * The value is serialized to JSON for storage in the native container.
   *
   * @param typeName - A unique identifier for this service type.
   * @param value - The service value (must be JSON-serializable).
   * @throws {DIError} If the service is already registered or serialization fails.
   *
   * @example
   * ```typescript
   * container.register('Config', { debug: true, port: 8080 });
   * container.register('Database', { host: 'localhost' });
   * ```
   */
  register<T>(typeName: string, value: T): void {
    this.ensureNotFreed();
    clearError();

    let json: string;
    try {
      json = JSON.stringify(value);
    } catch (error) {
      throw new DIError(
        ErrorCode.SerializationError,
        `Failed to serialize value: ${error}`
      );
    }

    const code = di_register_singleton_json(this.ptr!, typeName, json);
    if (code !== ErrorCode.Ok) {
      const error = getLastError();
      throw DIError.fromCode(code, error || undefined);
    }
  }

  /**
   * Resolve a service by type name.
   *
   * The service data is deserialized from JSON.
   *
   * @param typeName - The service type name to resolve.
   * @returns The deserialized service value.
   * @throws {DIError} If the service is not found or deserialization fails.
   *
   * @example
   * ```typescript
   * interface Config {
   *   debug: boolean;
   *   port: number;
   * }
   *
   * container.register('Config', { debug: true, port: 8080 });
   * const config = container.resolve<Config>('Config');
   * console.log(config.port); // 8080
   * ```
   */
  resolve<T>(typeName: string): T {
    this.ensureNotFreed();
    clearError();

    const json = di_resolve_json(this.ptr!, typeName);
    if (!json) {
      const error = getLastError();
      if (error) {
        throw new DIError(ErrorCode.NotFound, error);
      }
      throw new DIError(ErrorCode.NotFound, `Service '${typeName}' not found`);
    }

    try {
      return JSON.parse(json) as T;
    } catch (error) {
      throw new DIError(
        ErrorCode.SerializationError,
        `Failed to deserialize service '${typeName}': ${error}`
      );
    }
  }

  /**
   * Check if a service is registered.
   *
   * @param typeName - The service type name to check.
   * @returns `true` if the service is registered, `false` otherwise.
   */
  contains(typeName: string): boolean {
    this.ensureNotFreed();
    const result = di_contains(this.ptr!, typeName);
    return result === 1;
  }

  /**
   * Get the number of registered services.
   *
   * @returns The number of services in the container.
   */
  get serviceCount(): number {
    this.ensureNotFreed();
    return Number(di_service_count(this.ptr!));
  }

  /**
   * Get the library version.
   *
   * @returns The version string.
   */
  static version(): string {
    return di_version();
  }
}

// Re-export types
export { ErrorCode as DiErrorCode };
export default Container;
