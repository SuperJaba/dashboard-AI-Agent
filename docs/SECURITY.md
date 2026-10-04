# Security Policy

## Reporting Security Vulnerabilities
If you discover a potential security vulnerability within this project, please report it responsibly:
- Open a private security advisory or contact project maintainers directly.
- Include reproduction steps, affected components, and potential impact.

## Security Practices
- **Authentication**: JWT-based session tokens with bcrypt-hashed passwords.
- **Sensitive Credentials**: Passwords and private keys stored in the database are encrypted using AES-256 via `src/backend/utils/crypto.js` with `ENCRYPTION_KEY`.
- **Environment Isolation**: Secrets (`JWT_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`) are read strictly from environment variables and must never be committed to git.
- **Terminal Execution**: PTY sessions run inside child processes (`node-pty`) authenticated via JWT.
