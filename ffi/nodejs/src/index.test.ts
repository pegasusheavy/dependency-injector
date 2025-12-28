/**
 * Unit tests for the dependency-injector Node.js bindings.
 *
 * These tests require the native library to be built:
 *   cargo build --release --features ffi
 *
 * And the library path to be set:
 *   export LD_LIBRARY_PATH=/path/to/target/release:$LD_LIBRARY_PATH
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Container, DIError, ErrorCode } from "./index.js";

describe("Container", () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  afterEach(() => {
    container.free();
  });

  describe("creation", () => {
    it("should create a new container", () => {
      expect(container).toBeInstanceOf(Container);
      expect(container.serviceCount).toBe(0);
    });

    it("should return version string", () => {
      const version = Container.version();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe("register", () => {
    it("should register a simple object", () => {
      container.register("Config", { debug: true });
      expect(container.contains("Config")).toBe(true);
      expect(container.serviceCount).toBe(1);
    });

    it("should register multiple services", () => {
      container.register("Service1", { id: 1 });
      container.register("Service2", { id: 2 });
      container.register("Service3", { id: 3 });
      expect(container.serviceCount).toBe(3);
    });

    it("should throw when registering duplicate", () => {
      container.register("Config", { first: true });
      expect(() => {
        container.register("Config", { second: true });
      }).toThrow(DIError);
    });

    it("should register arrays", () => {
      container.register("List", [1, 2, 3]);
      expect(container.contains("List")).toBe(true);
    });

    it("should register strings", () => {
      container.register("Message", "Hello, World!");
      expect(container.contains("Message")).toBe(true);
    });

    it("should register numbers", () => {
      container.register("Port", 8080);
      expect(container.contains("Port")).toBe(true);
    });

    it("should register booleans", () => {
      container.register("Debug", true);
      expect(container.contains("Debug")).toBe(true);
    });

    it("should register null", () => {
      container.register("Empty", null);
      expect(container.contains("Empty")).toBe(true);
    });
  });

  describe("resolve", () => {
    it("should resolve a simple object", () => {
      container.register("Config", { debug: true, port: 8080 });
      const config = container.resolve<{ debug: boolean; port: number }>("Config");
      expect(config.debug).toBe(true);
      expect(config.port).toBe(8080);
    });

    it("should resolve arrays", () => {
      container.register("List", [1, 2, 3]);
      const list = container.resolve<number[]>("List");
      expect(list).toEqual([1, 2, 3]);
    });

    it("should resolve strings", () => {
      container.register("Message", "Hello");
      const msg = container.resolve<string>("Message");
      expect(msg).toBe("Hello");
    });

    it("should resolve nested objects", () => {
      container.register("Nested", {
        level1: {
          level2: {
            value: "deep",
          },
        },
      });
      const nested = container.resolve<{ level1: { level2: { value: string } } }>(
        "Nested"
      );
      expect(nested.level1.level2.value).toBe("deep");
    });

    it("should throw for non-existent service", () => {
      expect(() => {
        container.resolve("NonExistent");
      }).toThrow(DIError);
    });

    it("should return same data on multiple resolves", () => {
      container.register("Config", { id: 42 });
      const first = container.resolve<{ id: number }>("Config");
      const second = container.resolve<{ id: number }>("Config");
      expect(first.id).toBe(second.id);
    });
  });

  describe("contains", () => {
    it("should return false for non-existent service", () => {
      expect(container.contains("NonExistent")).toBe(false);
    });

    it("should return true for registered service", () => {
      container.register("Exists", {});
      expect(container.contains("Exists")).toBe(true);
    });
  });

  describe("scope", () => {
    it("should create a child scope", () => {
      const child = container.scope();
      expect(child).toBeInstanceOf(Container);
      child.free();
    });

    it("should inherit parent services", () => {
      container.register("Parent", { from: "parent" });
      const child = container.scope();
      expect(child.contains("Parent")).toBe(true);
      const data = child.resolve<{ from: string }>("Parent");
      expect(data.from).toBe("parent");
      child.free();
    });

    it("should not leak child services to parent", () => {
      const child = container.scope();
      child.register("Child", { from: "child" });
      expect(container.contains("Child")).toBe(false);
      expect(child.contains("Child")).toBe(true);
      child.free();
    });

    it("should support nested scopes", () => {
      container.register("Root", { level: 0 });
      const level1 = container.scope();
      level1.register("Level1", { level: 1 });
      const level2 = level1.scope();
      level2.register("Level2", { level: 2 });

      // Level2 can access all
      expect(level2.contains("Root")).toBe(true);
      expect(level2.contains("Level1")).toBe(true);
      expect(level2.contains("Level2")).toBe(true);

      // Level1 can access root and self
      expect(level1.contains("Root")).toBe(true);
      expect(level1.contains("Level1")).toBe(true);
      expect(level1.contains("Level2")).toBe(false);

      // Root only has root
      expect(container.contains("Root")).toBe(true);
      expect(container.contains("Level1")).toBe(false);
      expect(container.contains("Level2")).toBe(false);

      level2.free();
      level1.free();
    });
  });

  describe("free", () => {
    it("should free container", () => {
      const c = new Container();
      c.register("Test", {});
      c.free();
      // Second free should be safe
      c.free();
    });

    it("should throw when using freed container", () => {
      const c = new Container();
      c.free();
      expect(() => {
        c.register("Test", {});
      }).toThrow();
    });
  });

  describe("error handling", () => {
    it("should have correct error code for not found", () => {
      try {
        container.resolve("Missing");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(DIError);
        expect((error as DIError).code).toBe(ErrorCode.NotFound);
      }
    });

    it("should have correct error code for duplicate", () => {
      container.register("Dup", {});
      try {
        container.register("Dup", {});
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(DIError);
        expect((error as DIError).code).toBe(ErrorCode.AlreadyRegistered);
      }
    });
  });
});

