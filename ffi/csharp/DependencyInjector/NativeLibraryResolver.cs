using System;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;

namespace DependencyInjector.Native
{
    /// <summary>
    /// Handles native library resolution for the dependency-injector Rust library.
    /// </summary>
    internal static class NativeLibraryResolver
    {
        private static bool _initialized;
        private static IntPtr _libraryHandle;
        private static string? _libraryPath;

        /// <summary>
        /// Gets the path to the loaded native library.
        /// </summary>
        public static string? LibraryPath => _libraryPath;

        /// <summary>
        /// Initialize the native library resolver.
        /// This should be called before any P/Invoke calls.
        /// </summary>
        public static void Initialize()
        {
            if (_initialized) return;

            NativeLibrary.SetDllImportResolver(typeof(NativeLibraryResolver).Assembly, ResolveDllImport);
            _initialized = true;
        }

        private static IntPtr ResolveDllImport(string libraryName, Assembly assembly, DllImportSearchPath? searchPath)
        {
            if (libraryName != "dependency_injector")
            {
                return IntPtr.Zero;
            }

            if (_libraryHandle != IntPtr.Zero)
            {
                return _libraryHandle;
            }

            // Try loading from various locations
            var paths = GetSearchPaths();

            foreach (var path in paths)
            {
                if (string.IsNullOrEmpty(path)) continue;

                if (File.Exists(path))
                {
                    if (NativeLibrary.TryLoad(path, out _libraryHandle))
                    {
                        _libraryPath = path;
                        return _libraryHandle;
                    }
                }
            }

            // Fall back to default resolution
            if (NativeLibrary.TryLoad(libraryName, assembly, searchPath, out _libraryHandle))
            {
                _libraryPath = libraryName;
                return _libraryHandle;
            }

            throw new DllNotFoundException(
                $"Unable to load native library '{libraryName}'. Searched paths:\n" +
                string.Join("\n", paths.Where(p => !string.IsNullOrEmpty(p)).Select(p => $"  - {p}")) +
                "\n\nTo fix this:\n" +
                "  1. Install the NuGet package (includes native libraries)\n" +
                "  2. Or build locally: cargo rustc --release --features ffi --crate-type cdylib\n" +
                "  3. Or set DI_LIBRARY_PATH environment variable"
            );
        }

        private static IEnumerable<string> GetSearchPaths()
        {
            var libraryName = GetLibraryFileName();
            var assemblyDir = Path.GetDirectoryName(typeof(NativeLibraryResolver).Assembly.Location) ?? ".";

            // 1. Environment variable (highest priority)
            yield return Environment.GetEnvironmentVariable("DI_LIBRARY_PATH") ?? "";

            // 2. Runtime-specific directory (from NuGet package)
            var rid = GetRuntimeIdentifier();
            yield return Path.Combine(assemblyDir, "runtimes", rid, "native", libraryName);

            // 3. Same directory as assembly
            yield return Path.Combine(assemblyDir, libraryName);

            // 4. Development paths (cargo build output)
            var devPaths = new[]
            {
                Path.Combine(assemblyDir, "..", "..", "..", "..", "target", "release", libraryName),
                Path.Combine(assemblyDir, "..", "..", "..", "..", "..", "target", "release", libraryName),
                Path.Combine(assemblyDir, "..", "..", "..", "..", "..", "..", "target", "release", libraryName),
            };
            foreach (var path in devPaths)
            {
                yield return Path.GetFullPath(path);
            }

            // 5. System paths (Linux/macOS)
            if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                yield return Path.Combine("/usr/local/lib", libraryName);
                yield return Path.Combine("/usr/lib", libraryName);
            }
        }

        private static string GetLibraryFileName()
        {
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                return "dependency_injector.dll";
            if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
                return "libdependency_injector.dylib";
            return "libdependency_injector.so";
        }

        private static string GetRuntimeIdentifier()
        {
            var os = RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? "win" :
                     RuntimeInformation.IsOSPlatform(OSPlatform.OSX) ? "osx" : "linux";

            var arch = RuntimeInformation.OSArchitecture switch
            {
                Architecture.X64 => "x64",
                Architecture.Arm64 => "arm64",
                Architecture.X86 => "x86",
                Architecture.Arm => "arm",
                _ => "x64"
            };

            return $"{os}-{arch}";
        }
    }
}

