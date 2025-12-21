#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  dependency-injector Publish Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Ensure we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${RED}Error: Must be on 'main' branch to publish.${NC}"
    echo -e "Current branch: $CURRENT_BRANCH"
    echo -e "Run: git checkout main"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}Error: Uncommitted changes detected.${NC}"
    echo -e "Please commit or stash your changes before publishing."
    exit 1
fi

# Get versions
MAIN_VERSION=$(grep '^version' Cargo.toml | head -1 | sed 's/.*"\(.*\)".*/\1/')
DERIVE_VERSION=$(grep '^version' dependency-injector-derive/Cargo.toml | head -1 | sed 's/.*"\(.*\)".*/\1/')

echo -e "Main crate version:   ${YELLOW}v${MAIN_VERSION}${NC}"
echo -e "Derive crate version: ${YELLOW}v${DERIVE_VERSION}${NC}"
echo ""

# Confirm
read -p "Publish these versions to crates.io? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Aborted.${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}Step 1/4: Running tests...${NC}"
cargo test --all-features
echo -e "${GREEN}✓ Tests passed${NC}"
echo ""

echo -e "${GREEN}Step 2/4: Running clippy...${NC}"
cargo clippy --all-features --all-targets -- -D warnings
echo -e "${GREEN}✓ Clippy passed${NC}"
echo ""

echo -e "${GREEN}Step 3/4: Publishing dependency-injector-derive v${DERIVE_VERSION}...${NC}"
cd dependency-injector-derive
cargo publish
cd ..
echo -e "${GREEN}✓ dependency-injector-derive published${NC}"
echo ""

# Wait for crates.io to index the derive crate
echo -e "${YELLOW}Waiting 30 seconds for crates.io to index...${NC}"
sleep 30

echo -e "${GREEN}Step 4/4: Publishing dependency-injector v${MAIN_VERSION}...${NC}"
cargo publish
echo -e "${GREEN}✓ dependency-injector published${NC}"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Successfully published!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  dependency-injector-derive v${DERIVE_VERSION}"
echo -e "  dependency-injector v${MAIN_VERSION}"
echo ""
echo -e "Don't forget to:"
echo -e "  1. Push the tag: ${YELLOW}git push origin v${MAIN_VERSION}${NC}"
echo -e "  2. Create GitHub release"

