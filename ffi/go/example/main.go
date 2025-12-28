// Example Go application using the dependency-injector FFI bindings.
//
// To run this example:
//
//  1. Build the Rust library:
//     cd /path/to/dependency-injector
//     cargo build --release --features ffi
//
//  2. Set the library path:
//     export LD_LIBRARY_PATH=/path/to/dependency-injector/target/release:$LD_LIBRARY_PATH
//
//  3. Run the example:
//     cd ffi/go/example
//     go run main.go
package main

import (
	"fmt"
	"log"

	"github.com/pegasusheavy/dependency-injector/ffi/go/di"
)

// Config represents application configuration.
type Config struct {
	Debug    bool   `json:"debug"`
	Port     int    `json:"port"`
	DBHost   string `json:"db_host"`
	LogLevel string `json:"log_level"`
}

// User represents a user entity.
type User struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// DatabaseService represents a database connection.
type DatabaseService struct {
	Host     string `json:"host"`
	Database string `json:"database"`
	PoolSize int    `json:"pool_size"`
}

func main() {
	fmt.Printf("dependency-injector Go bindings example\n")
	fmt.Printf("Library version: %s\n\n", di.Version())

	// Create the root container
	container := di.NewContainer()
	if container == nil {
		log.Fatal("Failed to create container")
	}
	defer container.Free()

	// Register application configuration
	config := Config{
		Debug:    true,
		Port:     8080,
		DBHost:   "localhost:5432",
		LogLevel: "debug",
	}
	if err := container.RegisterValue("Config", config); err != nil {
		log.Fatalf("Failed to register config: %v", err)
	}
	fmt.Println("✓ Registered Config")

	// Register database service
	dbService := DatabaseService{
		Host:     "localhost:5432",
		Database: "myapp",
		PoolSize: 10,
	}
	if err := container.RegisterValue("DatabaseService", dbService); err != nil {
		log.Fatalf("Failed to register database: %v", err)
	}
	fmt.Println("✓ Registered DatabaseService")

	// Check what's registered
	fmt.Printf("\nContainer has %d services\n", container.ServiceCount())
	fmt.Printf("Contains 'Config': %v\n", container.Contains("Config"))
	fmt.Printf("Contains 'DatabaseService': %v\n", container.Contains("DatabaseService"))
	fmt.Printf("Contains 'NonExistent': %v\n\n", container.Contains("NonExistent"))

	// Resolve and use the config
	var resolvedConfig Config
	if err := container.ResolveJSON("Config", &resolvedConfig); err != nil {
		log.Fatalf("Failed to resolve config: %v", err)
	}
	fmt.Printf("Resolved Config: debug=%v, port=%d, log_level=%s\n",
		resolvedConfig.Debug, resolvedConfig.Port, resolvedConfig.LogLevel)

	// Demonstrate scoped containers
	fmt.Println("\n--- Scoped Container Demo ---")

	// Create a request scope
	requestScope, err := container.Scope()
	if err != nil {
		log.Fatalf("Failed to create scope: %v", err)
	}
	defer requestScope.Free()

	// Register request-specific data
	user := User{
		ID:    42,
		Name:  "Alice",
		Email: "alice@example.com",
	}
	if err := requestScope.RegisterValue("CurrentUser", user); err != nil {
		log.Fatalf("Failed to register user: %v", err)
	}
	fmt.Println("✓ Registered CurrentUser in request scope")

	// Request scope can access parent services
	var dbFromScope DatabaseService
	if err := requestScope.ResolveJSON("DatabaseService", &dbFromScope); err != nil {
		log.Fatalf("Failed to resolve from scope: %v", err)
	}
	fmt.Printf("✓ Request scope can access DatabaseService: %s\n", dbFromScope.Database)

	// Resolve the user from the request scope
	var resolvedUser User
	if err := requestScope.ResolveJSON("CurrentUser", &resolvedUser); err != nil {
		log.Fatalf("Failed to resolve user: %v", err)
	}
	fmt.Printf("✓ Resolved CurrentUser: %s <%s>\n", resolvedUser.Name, resolvedUser.Email)

	// Parent cannot access scoped services
	if container.Contains("CurrentUser") {
		log.Fatal("Parent should not contain CurrentUser!")
	}
	fmt.Println("✓ Parent container correctly doesn't see CurrentUser")

	// Error handling demo
	fmt.Println("\n--- Error Handling Demo ---")
	_, err = container.Resolve("NonExistentService")
	if err != nil {
		fmt.Printf("✓ Got expected error: %v\n", err)
	}

	fmt.Println("\n✅ All demos completed successfully!")
}

