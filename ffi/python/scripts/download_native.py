#!/usr/bin/env python3
"""
Download pre-built native library for the current platform.

This script downloads the appropriate pre-built native library from GitHub releases.
It can be run manually or as part of a post-install hook.

Usage:
    python -m scripts.download_native
    
Environment variables:
    DI_LIBRARY_PATH: Skip download and use this path instead
    DI_SKIP_DOWNLOAD: Skip download entirely
    DI_GITHUB_TOKEN: GitHub token for rate limiting
"""

from __future__ import annotations

import os
import platform
import sys
import urllib.request
import json
from pathlib import Path

# Configuration
REPO_OWNER = "pegasusheavy"
REPO_NAME = "dependency-injector"
PACKAGE_DIR = Path(__file__).parent.parent / "dependency_injector"


def get_version() -> str:
    """Get package version from __init__.py."""
    init_file = PACKAGE_DIR / "__init__.py"
    with open(init_file) as f:
        for line in f:
            if line.startswith("__version__"):
                return line.split("=")[1].strip().strip('"\'')
    return "0.0.0"


def get_platform_info() -> tuple[str, str, str]:
    """Get platform, architecture, and library name.
    
    Returns:
        Tuple of (platform_tag, asset_name, library_name)
    """
    system = platform.system().lower()
    machine = platform.machine().lower()
    
    # Normalize machine architecture
    if machine in ("x86_64", "amd64"):
        arch = "x64"
    elif machine in ("aarch64", "arm64"):
        arch = "arm64"
    else:
        arch = machine
    
    # Map to asset names
    if system == "linux":
        lib_name = "libdependency_injector.so"
        asset_name = f"libdependency_injector-linux-{arch}.so"
    elif system == "darwin":
        lib_name = "libdependency_injector.dylib"
        asset_name = f"libdependency_injector-darwin-{arch}.dylib"
    elif system == "windows":
        lib_name = "dependency_injector.dll"
        asset_name = f"dependency_injector-win32-{arch}.dll"
    else:
        raise RuntimeError(f"Unsupported platform: {system}")
    
    return f"{system}-{arch}", asset_name, lib_name


def get_download_url(version: str, asset_name: str) -> str | None:
    """Get download URL for a specific asset from GitHub releases."""
    tag = version if version.startswith("v") else f"v{version}"
    api_url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/releases/tags/{tag}"
    
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": f"dependency-injector-python/{version}",
    }
    
    if token := os.environ.get("DI_GITHUB_TOKEN"):
        headers["Authorization"] = f"token {token}"
    
    try:
        req = urllib.request.Request(api_url, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as response:
            release = json.loads(response.read().decode())
            
            for asset in release.get("assets", []):
                if asset["name"] == asset_name:
                    return asset["browser_download_url"]
    except Exception as e:
        print(f"Warning: Could not fetch release info: {e}", file=sys.stderr)
    
    return None


def download_file(url: str, dest: Path) -> None:
    """Download a file from URL to destination."""
    print(f"Downloading from {url}...")
    
    headers = {"User-Agent": f"dependency-injector-python/{get_version()}"}
    req = urllib.request.Request(url, headers=headers)
    
    with urllib.request.urlopen(req, timeout=60) as response:
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as f:
            while chunk := response.read(8192):
                f.write(chunk)
    
    # Make executable on Unix
    if sys.platform != "win32":
        dest.chmod(0o755)


def main() -> int:
    """Main entry point."""
    print("📦 dependency-injector: Checking native library...")
    
    # Check for skip flag
    if os.environ.get("DI_SKIP_DOWNLOAD"):
        print("⏭️  DI_SKIP_DOWNLOAD set, skipping download")
        return 0
    
    # Check for custom library path
    if custom_path := os.environ.get("DI_LIBRARY_PATH"):
        if Path(custom_path).exists():
            print(f"✅ Using custom library: {custom_path}")
            return 0
        print(f"⚠️  DI_LIBRARY_PATH set but file not found: {custom_path}")
    
    # Get platform info
    try:
        platform_tag, asset_name, lib_name = get_platform_info()
    except RuntimeError as e:
        print(f"❌ {e}")
        return 1
    
    native_dir = PACKAGE_DIR / "native"
    lib_path = native_dir / lib_name
    
    # Check if already exists
    if lib_path.exists():
        print(f"✅ Native library already exists: {lib_path}")
        return 0
    
    # Check for local build
    for parent_levels in range(3, 6):
        local_build = PACKAGE_DIR
        for _ in range(parent_levels):
            local_build = local_build.parent
        local_build = local_build / "target" / "release" / lib_name
        if local_build.exists():
            print(f"✅ Found local build: {local_build}")
            return 0
    
    # Download from GitHub
    version = get_version()
    print(f"📥 Downloading {asset_name} for {platform_tag} (v{version})...")
    
    download_url = get_download_url(version, asset_name)
    if not download_url:
        print(f"❌ Could not find asset '{asset_name}' in release v{version}")
        print()
        print("You can:")
        print("  1. Build locally: cargo rustc --release --features ffi --crate-type cdylib")
        print("  2. Set DI_LIBRARY_PATH to point to an existing library")
        print("  3. Install a platform-specific wheel instead of sdist")
        return 1
    
    try:
        download_file(download_url, lib_path)
        print(f"✅ Downloaded to: {lib_path}")
        return 0
    except Exception as e:
        print(f"❌ Download failed: {e}")
        print()
        print("You can:")
        print("  1. Build locally: cargo rustc --release --features ffi --crate-type cdylib")
        print("  2. Set DI_LIBRARY_PATH to point to an existing library")
        return 1


if __name__ == "__main__":
    sys.exit(main())

