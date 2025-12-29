#!/usr/bin/env python3
"""
Basic example of using the dependency-injector from Python.

To run this example:

1. Build the Rust library:
   cd /path/to/dependency-injector
   cargo rustc --release --features ffi --crate-type cdylib

2. Set the library path:
   export LD_LIBRARY_PATH=/path/to/dependency-injector/target/release:$LD_LIBRARY_PATH

3. Run the example:
   cd ffi/python
   python examples/basic.py
"""

from __future__ import annotations

import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import TypedDict

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dependency_injector import Container, DIError, ErrorCode


# Type definitions for better IDE support
class Config(TypedDict):
    debug: bool
    port: int
    environment: str


class DatabaseConfig(TypedDict):
    host: str
    port: int
    database: str
    pool_size: int


class User(TypedDict):
    id: int
    name: str
    email: str
    roles: list[str]


class RequestContext(TypedDict):
    request_id: str
    timestamp: float
    user_agent: str


def main() -> None:
    print("╔════════════════════════════════════════════════════════════╗")
    print("║         dependency-injector Python Example                  ║")
    print("╚════════════════════════════════════════════════════════════╝\n")

    # Get library version
    print(f"Library version: {Container.version()}\n")

    # Create container
    container = Container()
    print("✓ Created root container")

    try:
        # === Register Application Services ===
        print("\n--- Registering Services ---")

        # Register application configuration
        config: Config = {
            "debug": True,
            "port": 8080,
            "environment": "development",
        }
        container.register("Config", config)
        print("✓ Registered Config")

        # Register database configuration
        db_config: DatabaseConfig = {
            "host": "localhost",
            "port": 5432,
            "database": "myapp",
            "pool_size": 10,
        }
        container.register("DatabaseConfig", db_config)
        print("✓ Registered DatabaseConfig")

        # Register a user
        admin_user: User = {
            "id": 1,
            "name": "Admin",
            "email": "admin@example.com",
            "roles": ["admin", "user"],
        }
        container.register("AdminUser", admin_user)
        print("✓ Registered AdminUser")

        # === Check Container State ===
        print("\n--- Container State ---")
        print(f"Service count: {container.service_count}")
        print(f"Contains 'Config': {container.contains('Config')}")
        print(f"Contains 'DatabaseConfig': {container.contains('DatabaseConfig')}")
        print(f"Contains 'NonExistent': {container.contains('NonExistent')}")

        # === Resolve Services ===
        print("\n--- Resolving Services ---")

        resolved_config = container.resolve("Config")
        print(
            f"✓ Resolved Config: port={resolved_config['port']}, "
            f"debug={resolved_config['debug']}"
        )

        resolved_db = container.resolve("DatabaseConfig")
        print(
            f"✓ Resolved DatabaseConfig: {resolved_db['host']}:"
            f"{resolved_db['port']}/{resolved_db['database']}"
        )

        resolved_user = container.resolve("AdminUser")
        print(f"✓ Resolved AdminUser: {resolved_user['name']} <{resolved_user['email']}>")
        print(f"  Roles: {', '.join(resolved_user['roles'])}")

        # === Scoped Containers ===
        print("\n--- Scoped Containers ---")

        # Create a request scope
        request_scope = container.scope()
        print("✓ Created request scope")

        # Register request-specific context
        request_context: RequestContext = {
            "request_id": f"req-{int(time.time() * 1000)}",
            "timestamp": time.time(),
            "user_agent": "Python/3.x Example",
        }
        request_scope.register("RequestContext", request_context)
        print("✓ Registered RequestContext in request scope")

        # Request scope can access parent services
        config_from_scope = request_scope.resolve("Config")
        print(f"✓ Request scope resolved parent Config: port={config_from_scope['port']}")

        # Resolve request-specific service
        ctx = request_scope.resolve("RequestContext")
        print(f"✓ Resolved RequestContext: {ctx['request_id']}")

        # Parent cannot see request-scoped services
        print(
            f"✓ Parent sees 'RequestContext': {container.contains('RequestContext')}"
        )  # False

        # Nested scopes
        nested_scope = request_scope.scope()
        nested_scope.register("NestedData", {"level": 2})
        print("✓ Created nested scope with data")

        # Nested scope can access all ancestors
        config_from_nested = nested_scope.resolve("Config")
        print(f"✓ Nested scope resolved root Config: {config_from_nested['environment']}")

        # Clean up scopes
        nested_scope.free()
        request_scope.free()
        print("✓ Freed request scopes")

        # === Error Handling ===
        print("\n--- Error Handling ---")

        try:
            container.resolve("NonExistentService")
        except DIError as e:
            print(f"✓ Caught expected error: {e}")
            print(f"  Error code: {ErrorCode(e.code).name}")

        try:
            container.register("Config", {"overwrite": True})
        except DIError as e:
            print(f"✓ Caught expected error: {e}")
            print(f"  Error code: {ErrorCode(e.code).name}")

        # === try_resolve ===
        print("\n--- Optional Resolution ---")

        # try_resolve returns None for missing services instead of raising
        missing = container.try_resolve("DoesNotExist")
        print(f"✓ try_resolve for missing service: {missing}")  # None

        found = container.try_resolve("Config")
        print(f"✓ try_resolve for existing service: found={found is not None}")

        # === Complex Data Types ===
        print("\n--- Complex Data Types ---")

        # Lists
        container.register("FeatureFlags", ["dark-mode", "new-dashboard", "beta-api"])
        flags = container.resolve("FeatureFlags")
        print(f"✓ List: {', '.join(flags)}")

        # Nested objects
        container.register(
            "AppState",
            {
                "user": {"id": 1, "name": "Test"},
                "settings": {
                    "theme": "dark",
                    "notifications": {"email": True, "push": False},
                },
                "history": ["/home", "/profile", "/settings"],
            },
        )
        state = container.resolve("AppState")
        print(
            f"✓ Nested object: user={state['user']['name']}, "
            f"theme={state['settings']['theme']}"
        )

        # Dataclass example
        @dataclass
        class Product:
            id: int
            name: str
            price: float
            tags: list[str]

        product = Product(id=1, name="Widget", price=9.99, tags=["sale", "popular"])
        container.register("Product", asdict(product))
        resolved_product = container.resolve("Product")
        print(f"✓ Dataclass: {resolved_product['name']} - ${resolved_product['price']}")

        # === Context Manager ===
        print("\n--- Context Manager ---")

        with Container() as temp_container:
            temp_container.register("Temp", {"value": "temporary"})
            temp_result = temp_container.resolve("Temp")
            print(f"✓ Context manager: {temp_result}")
        print("✓ Container automatically freed after 'with' block")

        print("\n✅ All examples completed successfully!")

    finally:
        # Always free the container
        container.free()
        print("\n✓ Freed root container")


if __name__ == "__main__":
    main()
