# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of these methods:

1. **GitHub Security Advisories** (Preferred)
   - Go to the [Security tab](../../security/advisories) of this repository
   - Click "Report a vulnerability"
   - Fill out the form with details about the vulnerability

2. **Email**
   - Send an email to: [security@example.com] <!-- Replace with actual email -->
   - Include "SECURITY" in the subject line

### What to Include

Please include the following information in your report:

- Type of vulnerability (e.g., buffer overflow, injection, etc.)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact assessment of the vulnerability

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution Target**: Within 90 days (depending on complexity)

### Disclosure Policy

- We will acknowledge receipt of your vulnerability report
- We will confirm the vulnerability and determine its impact
- We will release a fix as soon as possible, depending on complexity
- We will publicly disclose the vulnerability after a fix is available

### Recognition

We appreciate the security research community's efforts. Reporters of valid vulnerabilities will be:

- Acknowledged in the release notes (unless you prefer to remain anonymous)
- Credited in any security advisories published

## Security Best Practices

When using this library:

1. Keep dependencies up to date
2. Run `cargo audit` regularly to check for known vulnerabilities
3. Use the latest stable Rust version
4. Review the security implications of any configuration changes

Thank you for helping keep dependency-injector and its users safe!

