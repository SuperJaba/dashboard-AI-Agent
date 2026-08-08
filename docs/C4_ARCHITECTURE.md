# C4 Architecture Documentation

This document provides a visual representation of the Dashboard system architecture using the C4 model.

## 1. System Context Diagram

This diagram shows the Dashboard in the context of its users and external systems.

```mermaid
C4Context
    title System Context diagram for Dashboard

    Person(user, "User", "A developer or admin using the dashboard.")
    System(dashboard, "Dashboard System", "Allows users to manage projects, run AI agents, and monitor metrics.")
    
    System_Ext(llm, "LLM Providers", "External AI models (OpenAI, Anthropic, Ollama)")
    System_Ext(git, "GitHub / Git", "Version control and CI/CD pipelines")
    System_Ext(prometheus, "Prometheus & Grafana", "System monitoring and metrics visualization")

    Rel(user, dashboard, "Uses", "HTTPS")
    Rel(dashboard, llm, "Sends prompts to", "REST/HTTPS")
    Rel(dashboard, git, "Reads status and manages", "CLI/SSH")
    Rel(dashboard, prometheus, "Exposes and reads metrics", "HTTP")
```

## 2. Container Diagram

This diagram zooms into the Dashboard System, showing the high-level technical containers.

```mermaid
C4Container
    title Container diagram for Dashboard System

    Person(user, "User", "A developer or admin using the dashboard.")

    System_Boundary(dashboard, "Dashboard System") {
        Container(spa, "Single Page Application", "React, TypeScript, Vite", "Provides the dashboard UI and terminal interface.")
        Container(api, "Backend API", "Node.js, Express", "Handles business logic, auth, and agent coordination.")
        ContainerDb(db, "Database", "PostgreSQL", "Stores projects, servers, agent configurations, and settings.")
        Container(socket, "WebSocket Server", "Socket.io", "Manages real-time terminal sessions and data streams.")
    }

    Rel(user, spa, "Visits", "HTTPS")
    Rel(spa, api, "Makes API calls to", "JSON/HTTPS")
    Rel(spa, socket, "Connects to terminal via", "WSS")
    Rel(api, db, "Reads from and writes to", "SQL")
    Rel(socket, api, "Spawns PTY processes via", "Internal")
```

## 3. Component Diagram (Backend API)

This diagram zooms into the Backend API container.

```mermaid
C4Component
    title Component diagram for Backend API

    ContainerBoundary(api, "Backend API") {
        Component(auth, "Auth Router", "Express Router", "Handles JWT authentication and middleware.")
        Component(projects, "Projects Router", "Express Router", "Manages project CRUD, Git ops, and task analysis.")
        Component(agents, "Agents Router", "Express Router", "Manages AI CLI agents and terminal deployments.")
        Component(db_module, "Database Module", "pg Pool", "Handles PostgreSQL connections and queries.")
    }

    Rel(projects, db_module, "Uses")
    Rel(agents, db_module, "Uses")
    Rel(auth, db_module, "Uses")
```
