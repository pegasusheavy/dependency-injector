using System;
using System.Runtime.InteropServices;
using System.Text.Json;
using DependencyInjector.Native;

namespace DependencyInjector
{
    /// <summary>
    /// Exception thrown by the dependency injector.
    /// </summary>
    public class DIException : Exception
    {
        /// <summary>
        /// The error code from the native library.
        /// </summary>
        public DiErrorCode ErrorCode { get; }

        public DIException(DiErrorCode code, string? message = null)
            : base(message ?? GetDefaultMessage(code))
        {
            ErrorCode = code;
        }

        private static string GetDefaultMessage(DiErrorCode code) => code switch
        {
            DiErrorCode.Ok => "Success",
            DiErrorCode.NotFound => "Service not found",
            DiErrorCode.InvalidArgument => "Invalid argument",
            DiErrorCode.AlreadyRegistered => "Service already registered",
            DiErrorCode.InternalError => "Internal error",
            DiErrorCode.SerializationError => "Serialization error",
            _ => $"Unknown error: {code}"
        };
    }

    /// <summary>
    /// A high-performance dependency injection container backed by native Rust code.
    /// </summary>
    /// <remarks>
    /// <para>
    /// This container provides a type-safe interface to the native Rust dependency-injector
    /// library. Services are serialized as JSON for cross-language communication.
    /// </para>
    /// <para>
    /// Example usage:
    /// <code>
    /// using var container = new Container();
    ///
    /// // Register a service
    /// container.Register("Config", new Config { Port = 8080 });
    ///
    /// // Resolve a service
    /// var config = container.Resolve&lt;Config&gt;("Config");
    ///
    /// // Create a child scope
    /// using var scope = container.Scope();
    /// scope.Register("RequestId", new RequestId { Id = "req-123" });
    /// </code>
    /// </para>
    /// </remarks>
    public class Container : IDisposable
    {
        private IntPtr _handle;
        private bool _disposed;

        /// <summary>
        /// Static constructor to initialize the native library resolver.
        /// </summary>
        static Container()
        {
            NativeLibraryResolver.Initialize();
        }

        /// <summary>
        /// Gets the library version.
        /// </summary>
        public static string Version
        {
            get
            {
                var ptr = NativeBindings.di_version();
                return Marshal.PtrToStringUTF8(ptr) ?? "unknown";
            }
        }

        /// <summary>
        /// Gets the path to the loaded native library.
        /// </summary>
        public static string? LibraryPath => NativeLibraryResolver.LibraryPath;

        /// <summary>
        /// Creates a new dependency injection container.
        /// </summary>
        /// <exception cref="DIException">Thrown if container creation fails.</exception>
        public Container()
        {
            _handle = NativeBindings.di_container_new();
            if (_handle == IntPtr.Zero)
            {
                throw new DIException(DiErrorCode.InternalError, "Failed to create native container");
            }
        }

        /// <summary>
        /// Internal constructor for creating scoped containers.
        /// </summary>
        private Container(IntPtr handle)
        {
            _handle = handle;
        }

        /// <summary>
        /// Gets the number of registered services.
        /// </summary>
        public long ServiceCount
        {
            get
            {
                ThrowIfDisposed();
                return NativeBindings.di_service_count(_handle);
            }
        }

        /// <summary>
        /// Registers a singleton service with a string type name.
        /// </summary>
        /// <typeparam name="T">The service type.</typeparam>
        /// <param name="typeName">The type name identifier.</param>
        /// <param name="instance">The service instance.</param>
        /// <exception cref="DIException">Thrown if registration fails.</exception>
        public void Register<T>(string typeName, T instance)
        {
            ThrowIfDisposed();
            NativeBindings.di_error_clear();

            var json = JsonSerializer.Serialize(instance);
            var result = NativeBindings.di_register_singleton_json(_handle, typeName, json);

            if (result != DiErrorCode.Ok)
            {
                var errorMsg = GetLastError();
                throw new DIException(result, errorMsg);
            }
        }

        /// <summary>
        /// Registers a singleton service using the type's full name as the identifier.
        /// </summary>
        /// <typeparam name="T">The service type.</typeparam>
        /// <param name="instance">The service instance.</param>
        /// <exception cref="DIException">Thrown if registration fails.</exception>
        public void Register<T>(T instance)
        {
            var typeName = typeof(T).FullName ?? typeof(T).Name;
            Register(typeName, instance);
        }

        /// <summary>
        /// Resolves a service by type name.
        /// </summary>
        /// <typeparam name="T">The expected service type.</typeparam>
        /// <param name="typeName">The type name identifier.</param>
        /// <returns>The resolved service instance.</returns>
        /// <exception cref="DIException">Thrown if the service is not found or deserialization fails.</exception>
        public T Resolve<T>(string typeName)
        {
            ThrowIfDisposed();
            NativeBindings.di_error_clear();

            var jsonPtr = NativeBindings.di_resolve_json(_handle, typeName);
            if (jsonPtr == IntPtr.Zero)
            {
                var errorMsg = GetLastError();
                throw new DIException(DiErrorCode.NotFound, errorMsg ?? $"Service '{typeName}' not found");
            }

            try
            {
                var json = Marshal.PtrToStringUTF8(jsonPtr);
                if (string.IsNullOrEmpty(json))
                {
                    throw new DIException(DiErrorCode.SerializationError, "Service data is empty");
                }

                var result = JsonSerializer.Deserialize<T>(json);
                if (result == null)
                {
                    throw new DIException(DiErrorCode.SerializationError, "Failed to deserialize service");
                }
                return result;
            }
            finally
            {
                NativeBindings.di_string_free(jsonPtr);
            }
        }

        /// <summary>
        /// Resolves a service using the type's full name as the identifier.
        /// </summary>
        /// <typeparam name="T">The expected service type.</typeparam>
        /// <returns>The resolved service instance.</returns>
        /// <exception cref="DIException">Thrown if the service is not found or deserialization fails.</exception>
        public T Resolve<T>()
        {
            var typeName = typeof(T).FullName ?? typeof(T).Name;
            return Resolve<T>(typeName);
        }

        /// <summary>
        /// Attempts to resolve a service by type name.
        /// </summary>
        /// <typeparam name="T">The expected service type.</typeparam>
        /// <param name="typeName">The type name identifier.</param>
        /// <returns>The resolved service instance, or null if not found.</returns>
        public T? TryResolve<T>(string typeName) where T : class
        {
            ThrowIfDisposed();
            NativeBindings.di_error_clear();

            var jsonPtr = NativeBindings.di_resolve_json(_handle, typeName);
            if (jsonPtr == IntPtr.Zero)
            {
                return null;
            }

            try
            {
                var json = Marshal.PtrToStringUTF8(jsonPtr);
                if (string.IsNullOrEmpty(json))
                {
                    return null;
                }

                return JsonSerializer.Deserialize<T>(json);
            }
            finally
            {
                NativeBindings.di_string_free(jsonPtr);
            }
        }

        /// <summary>
        /// Attempts to resolve a service using the type's full name as the identifier.
        /// </summary>
        /// <typeparam name="T">The expected service type.</typeparam>
        /// <returns>The resolved service instance, or null if not found.</returns>
        public T? TryResolve<T>() where T : class
        {
            var typeName = typeof(T).FullName ?? typeof(T).Name;
            return TryResolve<T>(typeName);
        }

        /// <summary>
        /// Checks if a service is registered by type name.
        /// </summary>
        /// <param name="typeName">The type name identifier.</param>
        /// <returns>True if the service is registered, false otherwise.</returns>
        public bool Contains(string typeName)
        {
            ThrowIfDisposed();
            return NativeBindings.di_contains(_handle, typeName) == 1;
        }

        /// <summary>
        /// Checks if a service is registered using the type's full name.
        /// </summary>
        /// <typeparam name="T">The service type.</typeparam>
        /// <returns>True if the service is registered, false otherwise.</returns>
        public bool Contains<T>()
        {
            var typeName = typeof(T).FullName ?? typeof(T).Name;
            return Contains(typeName);
        }

        /// <summary>
        /// Creates a child scope that inherits from this container.
        /// </summary>
        /// <remarks>
        /// Child scopes can access all services from the parent container,
        /// but services registered in the child are not visible to the parent.
        /// </remarks>
        /// <returns>A new scoped container.</returns>
        /// <exception cref="DIException">Thrown if scope creation fails.</exception>
        public Container Scope()
        {
            ThrowIfDisposed();
            NativeBindings.di_error_clear();

            var scopeHandle = NativeBindings.di_container_scope(_handle);
            if (scopeHandle == IntPtr.Zero)
            {
                var errorMsg = GetLastError();
                throw new DIException(DiErrorCode.InternalError, errorMsg ?? "Failed to create scope");
            }
            return new Container(scopeHandle);
        }

        private static string? GetLastError()
        {
            var errorPtr = NativeBindings.di_error_message();
            if (errorPtr == IntPtr.Zero)
            {
                return null;
            }

            try
            {
                return Marshal.PtrToStringUTF8(errorPtr);
            }
            finally
            {
                NativeBindings.di_string_free(errorPtr);
            }
        }

        private void ThrowIfDisposed()
        {
            if (_disposed)
            {
                throw new ObjectDisposedException(nameof(Container));
            }
        }

        /// <summary>
        /// Disposes the container and releases native resources.
        /// </summary>
        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        /// <summary>
        /// Disposes the container.
        /// </summary>
        protected virtual void Dispose(bool disposing)
        {
            if (!_disposed)
            {
                if (_handle != IntPtr.Zero)
                {
                    NativeBindings.di_container_free(_handle);
                    _handle = IntPtr.Zero;
                }
                _disposed = true;
            }
        }

        /// <summary>
        /// Finalizer.
        /// </summary>
        ~Container()
        {
            Dispose(false);
        }
    }
}
