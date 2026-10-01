# Dashboard API Documentation

RESTful JSON API served at `http://localhost:3001/api`. Protected endpoints require an `Authorization: Bearer <token>` header.

## Authentication (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Authenticate with `{ email, password }`. Returns `{ token, user }`. |
| `POST` | `/api/auth/register` | Register new user `{ email, password, name }`. Returns `{ token, user }`. |
| `GET` | `/api/auth/me` | Fetch authenticated user session profile. |
| `POST` | `/api/auth/logout` | Invalidate current session (returns 204). |

## Remote Servers (`/api/servers`)
Manage SSH server targets for remote command execution and monitoring.
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/servers` | List all configured remote servers. |
| `POST` | `/api/servers` | Add server `{ name, host, port, username, authType, password, privateKey }`. |
| `GET` | `/api/servers/:id` | Get details for a specific server. |
| `PUT` | `/api/servers/:id` | Update server credentials or connection details. |
| `DELETE` | `/api/servers/:id` | Remove a server configuration. |
| `GET` | `/api/servers/:id/stats` | Fetch real-time CPU, RAM, and Disk metrics via SSH. |

## LLM Providers (`/api/llmServers`)
Configure LLM backend providers (OpenAI, Anthropic, Ollama, LM Studio, etc.).
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/llmServers` | List all LLM server configurations. |
| `POST` | `/api/llmServers` | Add provider `{ name, provider, baseUrl, apiKey, model, isDefault }`. |
| `PUT` | `/api/llmServers/:id` | Update provider configuration or API key. |
| `DELETE` | `/api/llmServers/:id` | Delete provider configuration. |

## Projects & Tasks (`/api/projects`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/projects` | List all workspace projects with task metrics. |
| `POST` | `/api/projects` | Register new workspace directory `{ name, path, description }`. |
| `GET` | `/api/projects/:id` | Get project metadata, branch, and parsed tasks. |
| `PUT` | `/api/projects/:id` | Update project parameters. |
| `DELETE` | `/api/projects/:id` | Unregister project from dashboard. |
| `POST` | `/api/projects/:id/analyze` | Re-scan project markdown files for tasks and update metrics. |

## Git Operations (`/api/git`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/git/status` | Get status (`?path=<projectPath>`) of modified/staged files. |
| `GET` | `/api/git/branches` | List local and remote branches. |
| `POST` | `/api/git/checkout` | Switch branch `{ path, branch }`. |
| `POST` | `/api/git/branch` | Create new branch `{ path, branch }`. |
| `GET` | `/api/git/diff` | Get unified diff for unstaged or staged changes. |
| `POST` | `/api/git/stage` | Stage files `{ path, files }` or stage all. |
| `POST` | `/api/git/commit` | Create commit `{ path, message }`. |
| `POST` | `/api/git/push` | Push commits to upstream `{ path, remote, branch }`. |
| `POST` | `/api/git/pull` | Pull changes from upstream `{ path, remote, branch }`. |

## AI Agents (`/api/agents`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/agents` | List configured CLI agents (Antigravity, Claude Code, Aider, etc.). |
| `POST` | `/api/agents` | Register new agent configuration `{ name, command, args, env }`. |
| `PUT` | `/api/agents/:id` | Update agent configuration. |
| `DELETE` | `/api/agents/:id` | Remove agent configuration. |
| `GET` | `/api/agents/workers` | List connected local agent workers. |

## Custom Widgets (`/api/widgets`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/widgets` | List custom executor widgets. |
| `POST` | `/api/widgets` | Create widget `{ name, command, type: 'number'|'text'|'chart', color, serverId }`. |
| `PUT` | `/api/widgets/:id` | Update widget configuration. |
| `DELETE` | `/api/widgets/:id` | Delete widget. |
| `POST` | `/api/widgets/:id/run` | Execute widget command immediately and return output. |

## Settings (`/api/settings`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/settings` | Get dashboard settings (LLM overrides, polling intervals). |
| `PUT` | `/api/settings` | Save settings `{ defaultModel, maxTokens, temperature, ... }`. |

## Real-Time Terminal (Socket.io)
Connect via WebSocket with JWT authentication:
- **Client Emits**:
  - `spawn_terminal`: `{ command, args, cwd, target: 'auto'|'worker'|'remote', serverId }`
  - `terminal_input`: `{ data }`
  - `terminal_resize`: `{ cols, rows }`
- **Server Emits**:
  - `terminal_data`: String chunks from stdout/stderr.
  - `terminal_exit`: Process exit event `{ code, signal }`.
  - `terminal_error`: Error payload `{ error }`.
