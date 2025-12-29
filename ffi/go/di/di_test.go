package di

import (
	"errors"
	"testing"
)

func TestNewContainer(t *testing.T) {
	container := NewContainer()
	if container == nil {
		t.Fatal("Failed to create container")
	}
	defer container.Free()

	if container.ServiceCount() != 0 {
		t.Errorf("Expected 0 services, got %d", container.ServiceCount())
	}
}

func TestRegisterAndResolve(t *testing.T) {
	container := NewContainer()
	if container == nil {
		t.Fatal("Failed to create container")
	}
	defer container.Free()

	// Register a service
	err := container.Register("TestService", []byte("hello world"))
	if err != nil {
		t.Fatalf("Failed to register: %v", err)
	}

	// Resolve the service
	data, err := container.Resolve("TestService")
	if err != nil {
		t.Fatalf("Failed to resolve: %v", err)
	}

	if string(data) != "hello world" {
		t.Errorf("Expected 'hello world', got '%s'", string(data))
	}
}

func TestRegisterJSON(t *testing.T) {
	container := NewContainer()
	if container == nil {
		t.Fatal("Failed to create container")
	}
	defer container.Free()

	// Register with JSON
	err := container.RegisterJSON("Config", `{"debug": true, "port": 8080}`)
	if err != nil {
		t.Fatalf("Failed to register JSON: %v", err)
	}

	// Resolve and parse
	var config struct {
		Debug bool `json:"debug"`
		Port  int  `json:"port"`
	}
	err = container.ResolveJSON("Config", &config)
	if err != nil {
		t.Fatalf("Failed to resolve JSON: %v", err)
	}

	if !config.Debug {
		t.Error("Expected debug to be true")
	}
	if config.Port != 8080 {
		t.Errorf("Expected port 8080, got %d", config.Port)
	}
}

func TestRegisterValue(t *testing.T) {
	container := NewContainer()
	if container == nil {
		t.Fatal("Failed to create container")
	}
	defer container.Free()

	type User struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	}

	// Register a struct value
	err := container.RegisterValue("User", User{ID: 1, Name: "Alice"})
	if err != nil {
		t.Fatalf("Failed to register value: %v", err)
	}

	// Resolve it back
	var user User
	err = container.ResolveJSON("User", &user)
	if err != nil {
		t.Fatalf("Failed to resolve: %v", err)
	}

	if user.ID != 1 || user.Name != "Alice" {
		t.Errorf("Expected {1, Alice}, got {%d, %s}", user.ID, user.Name)
	}
}

func TestResolveInto(t *testing.T) {
	container := NewContainer()
	if container == nil {
		t.Fatal("Failed to create container")
	}
	defer container.Free()

	type Config struct {
		Debug bool   `json:"debug"`
		Host  string `json:"host"`
	}

	err := container.RegisterValue("Config", Config{Debug: true, Host: "localhost"})
	if err != nil {
		t.Fatalf("Failed to register: %v", err)
	}

	var config Config
	err = container.ResolveInto("Config", &config)
	if err != nil {
		t.Fatalf("Failed to resolve into: %v", err)
	}

	if !config.Debug || config.Host != "localhost" {
		t.Errorf("Unexpected config: %+v", config)
	}
}

func TestTryResolve(t *testing.T) {
	container := NewContainer()
	if container == nil {
		t.Fatal("Failed to create container")
	}
	defer container.Free()

	// TryResolve on non-existent should return nil
	data := container.TryResolve("NonExistent")
	if data != nil {
		t.Error("Expected nil for non-existent service")
	}

	// Register and try again
	container.Register("Exists", []byte("data"))
	data = container.TryResolve("Exists")
	if data == nil {
		t.Error("Expected data for existing service")
	}
	if string(data) != "data" {
		t.Errorf("Expected 'data', got '%s'", string(data))
	}
}

func TestContains(t *testing.T) {
	container := NewContainer()
	if container == nil {
		t.Fatal("Failed to create container")
	}
	defer container.Free()

	if container.Contains("NonExistent") {
		t.Error("Expected Contains to return false for non-existent service")
	}

	container.Register("Exists", []byte("data"))

	if !container.Contains("Exists") {
		t.Error("Expected Contains to return true for registered service")
	}
}

func TestScope(t *testing.T) {
	parent := NewContainer()
	if parent == nil {
		t.Fatal("Failed to create parent container")
	}
	defer parent.Free()

	// Register in parent
	parent.Register("ParentService", []byte("parent"))

	// Create child scope
	child, err := parent.Scope()
	if err != nil {
		t.Fatalf("Failed to create scope: %v", err)
	}
	defer child.Free()

	// Child should inherit parent's services
	if !child.Contains("ParentService") {
		t.Error("Child should contain parent's service")
	}

	// Register in child
	child.Register("ChildService", []byte("child"))

	// Parent should NOT have child's service
	if parent.Contains("ChildService") {
		t.Error("Parent should not contain child's service")
	}
}

func TestNestedScopes(t *testing.T) {
	root := NewContainer()
	if root == nil {
		t.Fatal("Failed to create root container")
	}
	defer root.Free()

	root.Register("Root", []byte("root"))

	level1, err := root.Scope()
	if err != nil {
		t.Fatalf("Failed to create level1 scope: %v", err)
	}
	defer level1.Free()
	level1.Register("Level1", []byte("level1"))

	level2, err := level1.Scope()
	if err != nil {
		t.Fatalf("Failed to create level2 scope: %v", err)
	}
	defer level2.Free()
	level2.Register("Level2", []byte("level2"))

	// Level2 can access all
	if !level2.Contains("Root") || !level2.Contains("Level1") || !level2.Contains("Level2") {
		t.Error("Level2 should have access to all services")
	}

	// Level1 cannot access Level2
	if level1.Contains("Level2") {
		t.Error("Level1 should not have access to Level2 services")
	}

	// Root cannot access Level1 or Level2
	if root.Contains("Level1") || root.Contains("Level2") {
		t.Error("Root should not have access to child services")
	}
}

func TestNotFound(t *testing.T) {
	container := NewContainer()
	if container == nil {
		t.Fatal("Failed to create container")
	}
	defer container.Free()

	_, err := container.Resolve("NonExistent")
	if err == nil {
		t.Fatal("Expected error for non-existent service")
	}

	diErr, ok := err.(*DIError)
	if !ok {
		t.Fatalf("Expected DIError, got %T", err)
	}

	if diErr.Code != NotFound {
		t.Errorf("Expected NotFound error, got %v", diErr.Code)
	}

	// Test with errors.Is
	if !errors.Is(err, ErrNotFound) {
		t.Error("Expected errors.Is to match ErrNotFound")
	}
}

func TestAlreadyRegistered(t *testing.T) {
	container := NewContainer()
	if container == nil {
		t.Fatal("Failed to create container")
	}
	defer container.Free()

	err := container.Register("Service", []byte("first"))
	if err != nil {
		t.Fatalf("First registration should succeed: %v", err)
	}

	err = container.Register("Service", []byte("second"))
	if err == nil {
		t.Fatal("Second registration should fail")
	}

	diErr, ok := err.(*DIError)
	if !ok {
		t.Fatalf("Expected DIError, got %T", err)
	}

	if diErr.Code != AlreadyRegistered {
		t.Errorf("Expected AlreadyRegistered error, got %v", diErr.Code)
	}

	// Test with errors.Is
	if !errors.Is(err, ErrAlreadyRegistered) {
		t.Error("Expected errors.Is to match ErrAlreadyRegistered")
	}
}

func TestVersion(t *testing.T) {
	version := Version()
	if version == "" {
		t.Error("Version should not be empty")
	}
	t.Logf("Library version: %s", version)
}

func TestFreeNil(t *testing.T) {
	// Free should be safe to call on nil container
	var c *Container
	c.Free() // Should not panic
}

func TestFreeTwice(t *testing.T) {
	container := NewContainer()
	if container == nil {
		t.Fatal("Failed to create container")
	}

	container.Free()
	container.Free() // Should not panic
}

func BenchmarkRegister(b *testing.B) {
	container := NewContainer()
	if container == nil {
		b.Fatal("Failed to create container")
	}
	defer container.Free()

	data := []byte(`{"id": 1, "name": "test"}`)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		typeName := "Service" + string(rune(i%1000+'A'))
		container.Register(typeName, data)
	}
}

func BenchmarkResolve(b *testing.B) {
	container := NewContainer()
	if container == nil {
		b.Fatal("Failed to create container")
	}
	defer container.Free()

	container.Register("BenchService", []byte(`{"id": 1}`))

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		container.Resolve("BenchService")
	}
}

func BenchmarkContains(b *testing.B) {
	container := NewContainer()
	if container == nil {
		b.Fatal("Failed to create container")
	}
	defer container.Free()

	container.Register("BenchService", []byte(`{"id": 1}`))

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		container.Contains("BenchService")
	}
}

func BenchmarkResolveJSON(b *testing.B) {
	container := NewContainer()
	if container == nil {
		b.Fatal("Failed to create container")
	}
	defer container.Free()

	type Config struct {
		Debug bool `json:"debug"`
		Port  int  `json:"port"`
	}

	container.RegisterValue("Config", Config{Debug: true, Port: 8080})

	var config Config
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		container.ResolveJSON("Config", &config)
	}
}
