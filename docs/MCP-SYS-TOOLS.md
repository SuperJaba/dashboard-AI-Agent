# System Tools MCP Servers Reference

Catalog and configuration guide for Model Context Protocol (MCP) servers tailored for system administration, infrastructure, process orchestration, and monitoring.

## 1. System Resources & Process Management

| MCP Server | Package / Command | Use Cases |
|---|---|---|
| **System Info** | `npm: @joshuaslate/mcp-server-system-info` | Real-time CPU, RAM, disk usage, active processes, system load averages, and uptime. |
| **Filesystem** | `npx -y @modelcontextprotocol/server-filesystem <allowed-paths>` | Controlled, sandboxed file operations (reading, writing, directory navigation) without raw bash shell overhead. |
| **Process / Command Runner** | `npm: @charlotte-mcp/bash` or `mcp-server-commands` | Command execution with strict timeouts, output buffering, and status code capturing. |
| **PM2 Orchestration** | Custom wrapper / `pm2 jlist` runner | Monitoring and lifecycle management of Node.js background services (local & remote CT8). |

## 2. Containerization & Virtualization

| MCP Server | Package / Command | Use Cases |
|---|---|---|
| **Docker (Official)** | `docker run -i --rm -v /var/run/docker.sock:/var/run/docker.sock mcp/docker` | Container lifecycle (`list`, `start`, `stop`, `restart`, `logs`, `inspect`), image and volume management. |
| **Docker Compose** | `npx -y docker-compose-mcp` | Automated orchestration for multi-container stacks (e.g. `prometheus-grafana-stack`). |

## 3. Remote Administration & Networking

| MCP Server | Package / Command | Use Cases |
|---|---|---|
| **SSH Server** | `npx -y @modelcontextprotocol/server-ssh` | Direct SSH command execution (e.g. `s1.ct8.pl` with key `~/.ssh/id_ed25519_antigravity`), remote file transfers, and server health checks. |
| **Fetch / Network Diagnostic** | `npx -y @modelcontextprotocol/server-fetch` | HTTP/REST endpoints verification, SSL certificate inspection, response latency checks. |

## 4. Databases & Storage

| MCP Server | Package / Command | Use Cases |
|---|---|---|
| **PostgreSQL (Official)** | `npx -y @modelcontextprotocol/server-postgres <DATABASE_URL>` | Schema exploration, query execution, `EXPLAIN ANALYZE`, verifying table migrations without manual `psql` prompts. |
| **SQLite** | `npx -y @modelcontextprotocol/server-sqlite <path-to-db>` | Inspection and querying for local SQLite databases or cache stores. |

## 5. Metrics & Telemetry

| MCP Server | Package / Command | Use Cases |
|---|---|---|
| **Prometheus** | `npx -y mcp-prometheus` | Querying Prometheus metrics via PromQL against the dashboard's `/metrics` endpoint. |
| **Git (Official)** | `npx -y @modelcontextprotocol/server-git --repository <path>` | Token-optimized Git diff, commit, and branch inspection. |

---

## Configuration Example (`~/.gemini/config/mcp_config.json`)

To enable these servers in Antigravity or compatible agent runtimes, add them to `~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "docker": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v",
        "/var/run/docker.sock:/var/run/docker.sock",
        "mcp/docker"
      ]
    },
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgres://user:password@localhost:5432/dashboard"
      ]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/mnt/f/AI-Agents/dashboard",
        "/home/borman"
      ]
    },
    "git": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-git",
        "--repository",
        "/mnt/f/AI-Agents/dashboard"
      ]
    }
  }
}
```
