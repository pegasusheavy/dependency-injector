using Xunit;
using DependencyInjector;
using DependencyInjector.Native;

namespace DependencyInjector.Tests;

public class ContainerTests
{
    // Test model classes
    public record Config(bool Debug, int Port, string Host);
    public record User(int Id, string Name, string Email);
    public record DatabaseConfig(string ConnectionString, int PoolSize);

    [Fact]
    public void NewContainer_CreatesEmptyContainer()
    {
        using var container = new Container();
        Assert.Equal(0, container.ServiceCount);
    }

    [Fact]
    public void Version_ReturnsNonEmptyString()
    {
        var version = Container.Version;
        Assert.NotNull(version);
        Assert.NotEmpty(version);
        Assert.Contains(".", version); // Should be semver-like
    }

    [Fact]
    public void Register_AddsService()
    {
        using var container = new Container();

        container.Register("Config", new Config(true, 8080, "localhost"));

        Assert.Equal(1, container.ServiceCount);
        Assert.True(container.Contains("Config"));
    }

    [Fact]
    public void Register_WithTypeInference_AddsService()
    {
        using var container = new Container();

        container.Register(new Config(true, 8080, "localhost"));

        Assert.True(container.Contains<Config>());
    }

    [Fact]
    public void Resolve_ReturnsRegisteredService()
    {
        using var container = new Container();
        var original = new Config(true, 8080, "localhost");

        container.Register("Config", original);
        var resolved = container.Resolve<Config>("Config");

        Assert.Equal(original, resolved);
    }

    [Fact]
    public void Resolve_WithTypeInference_ReturnsService()
    {
        using var container = new Container();
        var original = new User(1, "Alice", "alice@example.com");

        container.Register(original);
        var resolved = container.Resolve<User>();

        Assert.Equal(original, resolved);
    }

    [Fact]
    public void Resolve_NotFound_ThrowsDIException()
    {
        using var container = new Container();

        var ex = Assert.Throws<DIException>(() => container.Resolve<Config>("NonExistent"));
        Assert.Equal(DiErrorCode.NotFound, ex.ErrorCode);
    }

    [Fact]
    public void TryResolve_ReturnsServiceIfFound()
    {
        using var container = new Container();
        var original = new Config(true, 8080, "localhost");

        container.Register("Config", original);
        var resolved = container.TryResolve<Config>("Config");

        Assert.NotNull(resolved);
        Assert.Equal(original, resolved);
    }

    [Fact]
    public void TryResolve_ReturnsNullIfNotFound()
    {
        using var container = new Container();

        var resolved = container.TryResolve<Config>("NonExistent");

        Assert.Null(resolved);
    }

    [Fact]
    public void Contains_ReturnsTrueForRegisteredService()
    {
        using var container = new Container();

        container.Register("Config", new Config(true, 8080, "localhost"));

        Assert.True(container.Contains("Config"));
    }

    [Fact]
    public void Contains_ReturnsFalseForUnregisteredService()
    {
        using var container = new Container();

        Assert.False(container.Contains("NonExistent"));
    }

    [Fact]
    public void Register_Duplicate_ThrowsDIException()
    {
        using var container = new Container();

        container.Register("Config", new Config(true, 8080, "localhost"));

        var ex = Assert.Throws<DIException>(() =>
            container.Register("Config", new Config(false, 9090, "other")));
        Assert.Equal(DiErrorCode.AlreadyRegistered, ex.ErrorCode);
    }

    [Fact]
    public void Scope_CreatesChildContainer()
    {
        using var parent = new Container();
        parent.Register("Parent", new Config(true, 8080, "localhost"));

        using var child = parent.Scope();

        Assert.NotNull(child);
    }

    [Fact]
    public void Scope_InheritsParentServices()
    {
        using var parent = new Container();
        var config = new Config(true, 8080, "localhost");
        parent.Register("Config", config);

        using var child = parent.Scope();

        Assert.True(child.Contains("Config"));
        var resolved = child.Resolve<Config>("Config");
        Assert.Equal(config, resolved);
    }

    [Fact]
    public void Scope_DoesNotLeakToParent()
    {
        using var parent = new Container();

        using var child = parent.Scope();
        child.Register("ChildOnly", new User(1, "Alice", "alice@example.com"));

        Assert.False(parent.Contains("ChildOnly"));
        Assert.True(child.Contains("ChildOnly"));
    }

    [Fact]
    public void NestedScopes_WorkCorrectly()
    {
        using var root = new Container();
        root.Register("Root", new Config(true, 8080, "localhost"));

        using var level1 = root.Scope();
        level1.Register("Level1", new User(1, "Level1User", "l1@example.com"));

        using var level2 = level1.Scope();
        level2.Register("Level2", new DatabaseConfig("conn", 10));

        // Level2 can access all
        Assert.True(level2.Contains("Root"));
        Assert.True(level2.Contains("Level1"));
        Assert.True(level2.Contains("Level2"));

        // Level1 cannot access Level2
        Assert.False(level1.Contains("Level2"));

        // Root cannot access Level1 or Level2
        Assert.False(root.Contains("Level1"));
        Assert.False(root.Contains("Level2"));
    }

    [Fact]
    public void Dispose_ReleasesResources()
    {
        var container = new Container();
        container.Register("Config", new Config(true, 8080, "localhost"));

        container.Dispose();

        Assert.Throws<ObjectDisposedException>(() => container.ServiceCount);
    }

    [Fact]
    public void Dispose_CalledMultipleTimes_IsSafe()
    {
        var container = new Container();
        container.Dispose();
        container.Dispose(); // Should not throw
    }

    [Fact]
    public void ServiceCount_ReturnsCorrectCount()
    {
        using var container = new Container();

        Assert.Equal(0, container.ServiceCount);

        container.Register("Service1", new Config(true, 8080, "localhost"));
        Assert.Equal(1, container.ServiceCount);

        container.Register("Service2", new User(1, "Alice", "alice@example.com"));
        Assert.Equal(2, container.ServiceCount);

        container.Register("Service3", new DatabaseConfig("conn", 10));
        Assert.Equal(3, container.ServiceCount);
    }

    [Fact]
    public void Register_VariousTypes()
    {
        using var container = new Container();

        // Record types
        container.Register("Config", new Config(true, 8080, "localhost"));

        // Anonymous types don't work well with JSON deserialization,
        // but arrays and dictionaries do
        container.Register("IntArray", new int[] { 1, 2, 3 });
        container.Register("StringList", new List<string> { "a", "b", "c" });
        container.Register("Dict", new Dictionary<string, int> { { "one", 1 }, { "two", 2 } });

        Assert.Equal(4, container.ServiceCount);

        // Resolve and verify
        var config = container.Resolve<Config>("Config");
        Assert.Equal(8080, config.Port);

        var intArray = container.Resolve<int[]>("IntArray");
        Assert.Equal(new int[] { 1, 2, 3 }, intArray);

        var stringList = container.Resolve<List<string>>("StringList");
        Assert.Equal(new List<string> { "a", "b", "c" }, stringList);

        var dict = container.Resolve<Dictionary<string, int>>("Dict");
        Assert.Equal(1, dict["one"]);
        Assert.Equal(2, dict["two"]);
    }
}



