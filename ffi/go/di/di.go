// Package di provides Go bindings for the dependency-injector Rust library.
//
// This package wraps the high-performance Rust dependency injection container,
// making it available for Go applications via cgo.
//
// # Building
//
// First, build the Rust library:
//
//	cd /path/to/dependency-injector
//	cargo build --release --features ffi
//
// Then set the library path:
//
//	export LD_LIBRARY_PATH=/path/to/dependency-injector/target/release:$LD_LIBRARY_PATH
//	# or on macOS:
//	export DYLD_LIBRARY_PATH=/path/to/dependency-injector/target/release:$DYLD_LIBRARY_PATH
//
// # Example
//
//	container := di.NewContainer()
//	defer container.Free()
//
//	// Register a service as JSON
//	err := container.RegisterJSON("UserService", `{"id": 1, "name": "Alice"}`)
//	if err != nil {
//	    log.Fatal(err)
//	}
//
//	// Resolve the service
//	data, err := container.Resolve("UserService")
//	if err != nil {
//	    log.Fatal(err)
//	}
//	fmt.Println(string(data)) // {"id": 1, "name": "Alice"}
package di

/*
#cgo LDFLAGS: -L${SRCDIR}/../../../target/release -ldependency_injector
#cgo CFLAGS: -I${SRCDIR}/..

#include "dependency_injector.h"
#include <stdlib.h>
*/
import "C"
import (
	"encoding/json"
	"errors"
	"fmt"
	"runtime"
	"unsafe"
)

// ErrorCode represents error codes from the library.
type ErrorCode int

const (
	// OK indicates the operation succeeded.
	OK ErrorCode = 0
	// NotFound indicates the service was not found.
	NotFound ErrorCode = 1
	// InvalidArgument indicates an invalid argument was provided.
	InvalidArgument ErrorCode = 2
	// AlreadyRegistered indicates the service is already registered.
	AlreadyRegistered ErrorCode = 3
	// InternalError indicates an internal error occurred.
	InternalError ErrorCode = 4
	// SerializationError indicates a serialization error occurred.
	SerializationError ErrorCode = 5
)

func (e ErrorCode) Error() string {
	switch e {
	case OK:
		return "ok"
	case NotFound:
		return "service not found"
	case InvalidArgument:
		return "invalid argument"
	case AlreadyRegistered:
		return "service already registered"
	case InternalError:
		return "internal error"
	case SerializationError:
		return "serialization error"
	default:
		return fmt.Sprintf("unknown error code: %d", e)
	}
}

// DIError represents an error from the dependency injector.
type DIError struct {
	Code    ErrorCode
	Message string
}

func (e *DIError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("%s: %s", e.Code.Error(), e.Message)
	}
	return e.Code.Error()
}

// getLastError retrieves the last error message from the library.
func getLastError() string {
	cMsg := C.di_error_message()
	if cMsg == nil {
		return ""
	}
	defer C.di_string_free(cMsg)
	return C.GoString(cMsg)
}

// Container wraps the Rust dependency injection container.
type Container struct {
	ptr *C.DiContainer
}

// NewContainer creates a new dependency injection container.
func NewContainer() *Container {
	ptr := C.di_container_new()
	if ptr == nil {
		return nil
	}

	c := &Container{ptr: ptr}
	runtime.SetFinalizer(c, (*Container).Free)
	return c
}

// Free releases the container resources.
// This is called automatically by the finalizer, but can be called explicitly.
func (c *Container) Free() {
	if c.ptr != nil {
		C.di_container_free(c.ptr)
		c.ptr = nil
	}
}

// Scope creates a child scope that inherits services from this container.
func (c *Container) Scope() (*Container, error) {
	if c.ptr == nil {
		return nil, errors.New("container is nil or freed")
	}

	ptr := C.di_container_scope(c.ptr)
	if ptr == nil {
		return nil, &DIError{
			Code:    InternalError,
			Message: getLastError(),
		}
	}

	child := &Container{ptr: ptr}
	runtime.SetFinalizer(child, (*Container).Free)
	return child, nil
}

// Register registers a singleton service with the given type name and data.
func (c *Container) Register(typeName string, data []byte) error {
	if c.ptr == nil {
		return errors.New("container is nil or freed")
	}

	cTypeName := C.CString(typeName)
	defer C.free(unsafe.Pointer(cTypeName))

	var dataPtr *C.uint8_t
	if len(data) > 0 {
		dataPtr = (*C.uint8_t)(unsafe.Pointer(&data[0]))
	}

	code := C.di_register_singleton(c.ptr, cTypeName, dataPtr, C.size_t(len(data)))
	if code != C.DI_OK {
		return &DIError{
			Code:    ErrorCode(code),
			Message: getLastError(),
		}
	}
	return nil
}

// RegisterJSON registers a singleton service with JSON data.
func (c *Container) RegisterJSON(typeName string, jsonData string) error {
	if c.ptr == nil {
		return errors.New("container is nil or freed")
	}

	cTypeName := C.CString(typeName)
	defer C.free(unsafe.Pointer(cTypeName))

	cJSON := C.CString(jsonData)
	defer C.free(unsafe.Pointer(cJSON))

	code := C.di_register_singleton_json(c.ptr, cTypeName, cJSON)
	if code != C.DI_OK {
		return &DIError{
			Code:    ErrorCode(code),
			Message: getLastError(),
		}
	}
	return nil
}

// RegisterValue registers a value by serializing it to JSON.
func (c *Container) RegisterValue(typeName string, value interface{}) error {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal value: %w", err)
	}
	return c.Register(typeName, data)
}

// Resolve retrieves a service by type name and returns its raw data.
func (c *Container) Resolve(typeName string) ([]byte, error) {
	if c.ptr == nil {
		return nil, errors.New("container is nil or freed")
	}

	cTypeName := C.CString(typeName)
	defer C.free(unsafe.Pointer(cTypeName))

	result := C.di_resolve(c.ptr, cTypeName)
	if result.code != C.DI_OK {
		return nil, &DIError{
			Code:    ErrorCode(result.code),
			Message: getLastError(),
		}
	}

	if result.service == nil {
		return nil, &DIError{
			Code:    InternalError,
			Message: "service is nil",
		}
	}
	defer C.di_service_free(result.service)

	dataPtr := C.di_service_data(result.service)
	dataLen := C.di_service_data_len(result.service)

	if dataLen == 0 {
		return []byte{}, nil
	}

	// Copy the data to Go memory
	data := make([]byte, dataLen)
	copy(data, unsafe.Slice((*byte)(unsafe.Pointer(dataPtr)), dataLen))

	return data, nil
}

// ResolveJSON retrieves a service and unmarshals it from JSON into the target.
func (c *Container) ResolveJSON(typeName string, target interface{}) error {
	data, err := c.Resolve(typeName)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, target)
}

// Contains checks if a service is registered.
func (c *Container) Contains(typeName string) bool {
	if c.ptr == nil {
		return false
	}

	cTypeName := C.CString(typeName)
	defer C.free(unsafe.Pointer(cTypeName))

	result := C.di_contains(c.ptr, cTypeName)
	return result == 1
}

// ServiceCount returns the number of registered services.
func (c *Container) ServiceCount() int64 {
	if c.ptr == nil {
		return -1
	}
	return int64(C.di_service_count(c.ptr))
}

// Version returns the library version.
func Version() string {
	return C.GoString(C.di_version())
}

