# Documentation Index

This directory contains technical documentation, architecture specifications, and guides for the Dashboard project.

## Documents

| Document | Purpose | Audience / Use Case |
| :--- | :--- | :--- |
| [C4 Architecture](C4_ARCHITECTURE.md) | C4 Context and Container diagrams showing system boundaries, dependencies, and protocols. | Agents & developers needing service boundary context. |
| [Architecture Documentation](ARCHITECTURE_DOCUMENTATION.md) | Deep dive into full-stack architecture, component breakdown, data flows, and security model. | In-depth architectural review. |
| [OpenAPI Specification](openapi.yaml) | Authoritative OpenAPI 3.0 specification for backend REST endpoints. | API client generation, contract testing, and route reference. |
| [API Documentation](API_DOCUMENTATION.md) | Human-readable guide to backend endpoints, auth flows, and socket streams. | Quick reference for API routes and payloads. |
| [Widget Tutorial](TUTORIAL_ADD_WIDGET.md) | Step-by-step tutorial on creating, wiring, and registering custom dashboard widgets. | Frontend developers adding new dashboard components. |

## Additional Guides

- [Developer Onboarding](DEVELOPER_ONBOARDING.md) – Setup, local development commands, and environment configuration.
- [Design Decisions & Tradeoffs](DESIGN.md) – Architectural design records, state management, and fallback strategies.
- [Context Management](CONTEXT_MANAGEMENT.md) – Protocol for context-passing and agent task coordination.
- [Deployment & CI/CD](DEPLOYMENT.md) – CT8 target architecture, deployment scripts, and automated GitHub Actions pipeline.
- [Propozycje Rozwoju i Roadmapa](FEATURE_PROPOSALS.md) – Zestawienie propozycji nowych funkcji (Ansible, Agenci AI, DevOps, Obserwowalność).
- [Agent SSH Automation](agent-ssh-con.md) – SSH execution protocol and remote terminal connection rules.
- [Security Policy](SECURITY.md) – Reporting security issues and disclosure process.