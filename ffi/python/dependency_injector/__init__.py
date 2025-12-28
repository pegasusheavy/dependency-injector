"""
Python bindings for the dependency-injector Rust library.

A high-performance dependency injection container with ~10ns resolution times.

Example:
    >>> from dependency_injector import Container
    >>>
    >>> container = Container()
    >>> container.register("Config", {"debug": True, "port": 8080})
    >>>
    >>> config = container.resolve("Config")
    >>> print(config["port"])  # 8080
    >>>
    >>> container.free()
"""

from .container import Container, DIError, ErrorCode

__all__ = ["Container", "DIError", "ErrorCode"]
__version__ = "0.2.1"

