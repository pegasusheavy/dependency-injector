/**
 * Basic example of using the dependency-injector from TypeScript/Node.js.
 *
 * To run this example:
 *
 * 1. Build the Rust library:
 *    cd /path/to/dependency-injector
 *    cargo build --release --features ffi
 *
 * 2. Set the library path:
 *    export LD_LIBRARY_PATH=/path/to/dependency-injector/target/release:$LD_LIBRARY_PATH
 *
 * 3. Install dependencies:
 *    cd ffi/nodejs
 *    pnpm install
 *
 * 4. Run the example:
 *    pnpm run example
 */

import { Container, DIError, ErrorCode } from "../src/index.js";

// Define service interfaces
interface Config {
  debug: boolean;
  port: number;
  environment: string;
}

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  poolSize: number;
}

interface User {
  id: number;
  name: string;
  email: string;
  roles: string[];
}

interface RequestContext {
  requestId: string;
  timestamp: number;
  userAgent: string;
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     dependency-injector TypeScript/Node.js Example         ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // Get library version
  console.log(`Library version: ${Container.version()}\n`);

  // Create the root container
  const container = new Container();
  console.log("✓ Created root container");

  try {
    // === Register Application Services ===
    console.log("\n--- Registering Services ---");

    // Register application configuration
    const config: Config = {
      debug: true,
      port: 8080,
      environment: "development",
    };
    container.register("Config", config);
    console.log("✓ Registered Config");

    // Register database configuration
    const dbConfig: DatabaseConfig = {
      host: "localhost",
      port: 5432,
      database: "myapp",
      poolSize: 10,
    };
    container.register("DatabaseConfig", dbConfig);
    console.log("✓ Registered DatabaseConfig");

    // Register a user
    const adminUser: User = {
      id: 1,
      name: "Admin",
      email: "admin@example.com",
      roles: ["admin", "user"],
    };
    container.register("AdminUser", adminUser);
    console.log("✓ Registered AdminUser");

    // === Check Container State ===
    console.log("\n--- Container State ---");
    console.log(`Service count: ${container.serviceCount}`);
    console.log(`Contains 'Config': ${container.contains("Config")}`);
    console.log(`Contains 'DatabaseConfig': ${container.contains("DatabaseConfig")}`);
    console.log(`Contains 'NonExistent': ${container.contains("NonExistent")}`);

    // === Resolve Services ===
    console.log("\n--- Resolving Services ---");

    const resolvedConfig = container.resolve<Config>("Config");
    console.log(`✓ Resolved Config: port=${resolvedConfig.port}, debug=${resolvedConfig.debug}`);

    const resolvedDb = container.resolve<DatabaseConfig>("DatabaseConfig");
    console.log(`✓ Resolved DatabaseConfig: ${resolvedDb.host}:${resolvedDb.port}/${resolvedDb.database}`);

    const resolvedUser = container.resolve<User>("AdminUser");
    console.log(`✓ Resolved AdminUser: ${resolvedUser.name} <${resolvedUser.email}>`);
    console.log(`  Roles: ${resolvedUser.roles.join(", ")}`);

    // === Scoped Containers ===
    console.log("\n--- Scoped Containers ---");

    // Create a request scope
    const requestScope = container.scope();
    console.log("✓ Created request scope");

    // Register request-specific context
    const requestContext: RequestContext = {
      requestId: `req-${Date.now()}`,
      timestamp: Date.now(),
      userAgent: "Mozilla/5.0 (Node.js Example)",
    };
    requestScope.register("RequestContext", requestContext);
    console.log("✓ Registered RequestContext in request scope");

    // Request scope can access parent services
    const configFromScope = requestScope.resolve<Config>("Config");
    console.log(`✓ Request scope resolved parent Config: port=${configFromScope.port}`);

    // Resolve request-specific service
    const ctx = requestScope.resolve<RequestContext>("RequestContext");
    console.log(`✓ Resolved RequestContext: ${ctx.requestId}`);

    // Parent cannot see request-scoped services
    console.log(`✓ Parent sees 'RequestContext': ${container.contains("RequestContext")}`); // false

    // Nested scopes
    const nestedScope = requestScope.scope();
    nestedScope.register("NestedData", { level: 2 });
    console.log("✓ Created nested scope with data");

    // Nested scope can access all ancestors
    const configFromNested = nestedScope.resolve<Config>("Config");
    console.log(`✓ Nested scope resolved root Config: ${configFromNested.environment}`);

    // Clean up scopes
    nestedScope.free();
    requestScope.free();
    console.log("✓ Freed request scopes");

    // === Error Handling ===
    console.log("\n--- Error Handling ---");

    try {
      container.resolve("NonExistentService");
    } catch (error) {
      if (error instanceof DIError) {
        console.log(`✓ Caught expected error: ${error.message}`);
        console.log(`  Error code: ${ErrorCode[error.code]}`);
      }
    }

    try {
      container.register("Config", { overwrite: true });
    } catch (error) {
      if (error instanceof DIError) {
        console.log(`✓ Caught expected error: ${error.message}`);
        console.log(`  Error code: ${ErrorCode[error.code]}`);
      }
    }

    // === Complex Data Types ===
    console.log("\n--- Complex Data Types ---");

    // Arrays
    container.register("FeatureFlags", ["dark-mode", "new-dashboard", "beta-api"]);
    const flags = container.resolve<string[]>("FeatureFlags");
    console.log(`✓ Array: ${flags.join(", ")}`);

    // Nested objects
    container.register("AppState", {
      user: { id: 1, name: "Test" },
      settings: {
        theme: "dark",
        notifications: { email: true, push: false },
      },
      history: ["/home", "/profile", "/settings"],
    });
    const state = container.resolve<{
      user: { id: number; name: string };
      settings: { theme: string; notifications: { email: boolean; push: boolean } };
      history: string[];
    }>("AppState");
    console.log(`✓ Nested object: user=${state.user.name}, theme=${state.settings.theme}`);

    console.log("\n✅ All examples completed successfully!");
  } finally {
    // Always free the container
    container.free();
    console.log("\n✓ Freed root container");
  }
}

// Run the example
main().catch((error) => {
  console.error("❌ Example failed:", error);
  process.exit(1);
});



