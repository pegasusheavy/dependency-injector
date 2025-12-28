using System;
using System.Runtime.InteropServices;
using System.Text.Json;
using DependencyInjector.Native;

namespace DependencyInjector
{
    /// <summary>
    /// A high-performance dependency injection container backed by native Rust code.
    /// </summary>
    public class Container : IDisposable
    {
        private IntPtr _handle;
        private bool _disposed;

        /// <summary>
        /// Creates a new dependency injection container.
        /// </summary>
        public Container()
        {
            _handle = NativeBindings.di_container_new();
            if (_handle == IntPtr.Zero)
            {
                throw new InvalidOperationException("Failed to create native container");
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
        /// Registers a singleton service.
        /// </summary>
        public void Singleton<T>(T instance) where T : class
        {
            ThrowIfDisposed();
            var typeId = typeof(T).FullName ?? typeof(T).Name;
            var json = JsonSerializer.Serialize(instance);
            var result = NativeBindings.di_register_singleton(_handle, typeId, json);
            if (result != 0)
            {
                throw new InvalidOperationException($"Failed to register singleton: {typeId}");
            }
        }

        /// <summary>
        /// Registers a transient service factory.
        /// </summary>
        public void Transient<T>(T template) where T : class
        {
            ThrowIfDisposed();
            var typeId = typeof(T).FullName ?? typeof(T).Name;
            var json = JsonSerializer.Serialize(template);
            var result = NativeBindings.di_register_transient(_handle, typeId, json);
            if (result != 0)
            {
                throw new InvalidOperationException($"Failed to register transient: {typeId}");
            }
        }

        /// <summary>
        /// Resolves a service by type.
        /// </summary>
        public T? Get<T>() where T : class
        {
            ThrowIfDisposed();
            var typeId = typeof(T).FullName ?? typeof(T).Name;
            var resultPtr = NativeBindings.di_resolve(_handle, typeId);

            if (resultPtr == IntPtr.Zero)
            {
                return null;
            }

            try
            {
                var json = Marshal.PtrToStringUTF8(resultPtr);
                if (string.IsNullOrEmpty(json))
                {
                    return null;
                }
                return JsonSerializer.Deserialize<T>(json);
            }
            finally
            {
                NativeBindings.di_free_string(resultPtr);
            }
        }

        /// <summary>
        /// Checks if a service is registered.
        /// </summary>
        public bool Contains<T>() where T : class
        {
            ThrowIfDisposed();
            var typeId = typeof(T).FullName ?? typeof(T).Name;
            return NativeBindings.di_contains(_handle, typeId) != 0;
        }

        /// <summary>
        /// Removes a service registration.
        /// </summary>
        public bool Remove<T>() where T : class
        {
            ThrowIfDisposed();
            var typeId = typeof(T).FullName ?? typeof(T).Name;
            return NativeBindings.di_remove(_handle, typeId) != 0;
        }

        /// <summary>
        /// Creates a child scope that inherits from this container.
        /// </summary>
        public Container Scope()
        {
            ThrowIfDisposed();
            var scopeHandle = NativeBindings.di_create_scope(_handle);
            if (scopeHandle == IntPtr.Zero)
            {
                throw new InvalidOperationException("Failed to create scope");
            }
            return new Container(scopeHandle);
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

        ~Container()
        {
            Dispose(false);
        }
    }
}

