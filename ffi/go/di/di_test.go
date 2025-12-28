package di

import (
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
}

func TestVersion(t *testing.T) {
	version := Version()
	if version == "" {
		t.Error("Version should not be empty")
	}
	t.Logf("Library version: %s", version)
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
		typeName := "Service" + string(rune(i%1000))
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

