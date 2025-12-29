using DependencyInjector;
using DependencyInjector.Native;

Console.WriteLine("╔════════════════════════════════════════════════════════════╗");
Console.WriteLine("║          dependency-injector C# Example                     ║");
Console.WriteLine("╚════════════════════════════════════════════════════════════╝");
Console.WriteLine();
Console.WriteLine($"Library version: {Container.Version}");
Console.WriteLine();

// Create the root container
using var container = new Container();
Console.WriteLine("✓ Created root container");

// === Register Application Services ===
Console.WriteLine();
Console.WriteLine("--- Registering Services ---");

// Register application configuration
var config = new Config(
    Debug: true,
    Port: 8080,
    Environment: "development",
    LogLevel: "debug"
);
container.Register("Config", config);
Console.WriteLine("✓ Registered Config");

// Register database configuration
var dbConfig = new DatabaseConfig(
    Host: "localhost",
    Port: 5432,
    Database: "myapp",
    PoolSize: 10
);
container.Register("DatabaseConfig", dbConfig);
Console.WriteLine("✓ Registered DatabaseConfig");

// Register using type inference (uses full type name)
var adminUser = new User(
    Id: 1,
    Name: "Admin",
    Email: "admin@example.com",
    Roles: new List<string> { "admin", "user" }
);
container.Register(adminUser);
Console.WriteLine("✓ Registered User (using type inference)");

// === Check Container State ===
Console.WriteLine();
Console.WriteLine("--- Container State ---");
Console.WriteLine($"Service count: {container.ServiceCount}");
Console.WriteLine($"Contains 'Config': {container.Contains("Config")}");
Console.WriteLine($"Contains 'DatabaseConfig': {container.Contains("DatabaseConfig")}");
Console.WriteLine($"Contains<User>: {container.Contains<User>()}");
Console.WriteLine($"Contains 'NonExistent': {container.Contains("NonExistent")}");

// === Resolve Services ===
Console.WriteLine();
Console.WriteLine("--- Resolving Services ---");

var resolvedConfig = container.Resolve<Config>("Config");
Console.WriteLine($"✓ Resolved Config: debug={resolvedConfig.Debug}, port={resolvedConfig.Port}");

var resolvedDb = container.Resolve<DatabaseConfig>("DatabaseConfig");
Console.WriteLine($"✓ Resolved DatabaseConfig: {resolvedDb.Host}:{resolvedDb.Port}/{resolvedDb.Database}");

var resolvedUser = container.Resolve<User>();
Console.WriteLine($"✓ Resolved User: {resolvedUser.Name} <{resolvedUser.Email}>");
Console.WriteLine($"  Roles: {string.Join(", ", resolvedUser.Roles)}");

// === Optional Resolution ===
Console.WriteLine();
Console.WriteLine("--- Optional Resolution ---");

var missing = container.TryResolve<Config>("NonExistent");
Console.WriteLine($"✓ TryResolve for missing service: {(missing == null ? "null" : "found")}");

var existing = container.TryResolve<Config>("Config");
Console.WriteLine($"✓ TryResolve for existing service: {(existing != null ? "found" : "null")}");

// === Scoped Containers ===
Console.WriteLine();
Console.WriteLine("--- Scoped Containers ---");

// Create a request scope
using var requestScope = container.Scope();
Console.WriteLine("✓ Created request scope");

// Register request-specific context
var requestContext = new RequestContext(
    RequestId: $"req-{DateTime.UtcNow.Ticks}",
    Timestamp: DateTime.UtcNow,
    UserAgent: "C#/.NET Example"
);
requestScope.Register("RequestContext", requestContext);
Console.WriteLine("✓ Registered RequestContext in request scope");

// Request scope can access parent services
var configFromScope = requestScope.Resolve<Config>("Config");
Console.WriteLine($"✓ Request scope can access Config: port={configFromScope.Port}");

// Resolve request-specific service
var ctx = requestScope.Resolve<RequestContext>("RequestContext");
Console.WriteLine($"✓ Resolved RequestContext: {ctx.RequestId}");

// Parent cannot access scoped services
Console.WriteLine($"✓ Parent sees 'RequestContext': {container.Contains("RequestContext")}");

// Nested scopes
using var nestedScope = requestScope.Scope();
nestedScope.Register("NestedData", new Dictionary<string, int> { { "level", 2 } });
Console.WriteLine("✓ Created nested scope with data");

// Nested scope can access all ancestors
var configFromNested = nestedScope.Resolve<Config>("Config");
Console.WriteLine($"✓ Nested scope resolved root Config: env={configFromNested.Environment}");

// === Error Handling ===
Console.WriteLine();
Console.WriteLine("--- Error Handling ---");

try
{
    container.Resolve<Config>("NonExistentService");
}
catch (DIException ex)
{
    Console.WriteLine($"✓ Caught expected error: {ex.Message}");
    Console.WriteLine($"  Error code: {ex.ErrorCode}");
}

try
{
    container.Register("Config", new Config(false, 9090, "test", "info"));
}
catch (DIException ex)
{
    Console.WriteLine($"✓ Caught expected error: {ex.Message}");
    Console.WriteLine($"  Error code: {ex.ErrorCode}");
}

// === Complex Data Types ===
Console.WriteLine();
Console.WriteLine("--- Complex Data Types ---");

// Arrays
container.Register("FeatureFlags", new string[] { "dark-mode", "new-dashboard", "beta-api" });
var flags = container.Resolve<string[]>("FeatureFlags");
Console.WriteLine($"✓ Array: {string.Join(", ", flags)}");

// Dictionaries
container.Register("Settings", new Dictionary<string, object>
{
    { "theme", "dark" },
    { "notifications", true },
    { "maxItems", 100 }
});
var settings = container.Resolve<Dictionary<string, object>>("Settings");
Console.WriteLine($"✓ Dictionary: theme={settings["theme"]}");

Console.WriteLine();
Console.WriteLine("✅ All examples completed successfully!");

// Model classes (must be at end of file for top-level statements)
record Config(bool Debug, int Port, string Environment, string LogLevel);
record User(int Id, string Name, string Email, List<string> Roles);
record DatabaseConfig(string Host, int Port, string Database, int PoolSize);
record RequestContext(string RequestId, DateTime Timestamp, string UserAgent);
