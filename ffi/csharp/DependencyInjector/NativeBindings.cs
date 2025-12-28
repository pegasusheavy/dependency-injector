using System;
using System.Runtime.InteropServices;
using System.Text;

namespace DependencyInjector.Native
{
    /// <summary>
    /// Native P/Invoke bindings to the Rust dependency-injector library.
    /// </summary>
    internal static class NativeBindings
    {
        private const string LibraryName = "dependency_injector";

        [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
        public static extern IntPtr di_container_new();

        [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
        public static extern void di_container_free(IntPtr container);

        [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
        public static extern int di_register_singleton(
            IntPtr container,
            [MarshalAs(UnmanagedType.LPUTF8Str)] string typeId,
            [MarshalAs(UnmanagedType.LPUTF8Str)] string jsonData);

        [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
        public static extern int di_register_transient(
            IntPtr container,
            [MarshalAs(UnmanagedType.LPUTF8Str)] string typeId,
            [MarshalAs(UnmanagedType.LPUTF8Str)] string jsonData);

        [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
        public static extern IntPtr di_resolve(
            IntPtr container,
            [MarshalAs(UnmanagedType.LPUTF8Str)] string typeId);

        [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
        public static extern int di_contains(
            IntPtr container,
            [MarshalAs(UnmanagedType.LPUTF8Str)] string typeId);

        [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
        public static extern int di_remove(
            IntPtr container,
            [MarshalAs(UnmanagedType.LPUTF8Str)] string typeId);

        [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
        public static extern IntPtr di_create_scope(IntPtr container);

        [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
        public static extern void di_free_string(IntPtr str);
    }
}

