# Dashboard API Documentation

This document provides comprehensive API documentation for the Dashboard backend system. All endpoints follow RESTful conventions and return JSON responses.

---

## Base URL

```
http://localhost:3001/api
```

---

## Authentication

All protected endpoints require valid JWT authentication via the `Authorization` header:

```bash
Authorization: Bearer <your_jwt_token>
```

### Auth Endpoints

#### 1. Login
**Endpoint**: `POST /api/auth/login`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response (200)**:
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name"
  },
  "token": "jwt_token_string"
}
```

#### 2. Logout
**Endpoint**: `POST /api/auth/logout`

**Response (204)**: No content

#### 3. Get Current User
**Endpoint**: `GET /api/auth/me`

**Response (200)**:
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

---

## Server Management

Manage LLM server configurations, API keys, and model settings.

### List All Servers
**Endpoint**: `GET /api/servers`

**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "My LLM Server",
      "apiKey": "sk-...",
      "model": "gpt-4-turbo",
      "status": "active"
    }
  ]
}
```

### Create New Server
**Endpoint**: `POST /api/servers`

**Request Body**:
```json
{
  "name": "My LLM Server",
  "apiKey": "sk-...",
  "model": "gpt-4-turbo"
}
```

**Response (201)**: Created server object

### Get Single Server
**Endpoint**: `GET /api/servers/:id`

**Response (200)**: Server details

### Update Server
**Endpoint**: `PUT /api/servers/:id`

**Request Body**: Partial update fields

**Response (200)**: Updated server object

### Delete Server
**Endpoint**: `DELETE /api/servers/:id`

**Response (204)**: No content

---

## Project Management

Manage projects with Git integration, branch tracking, and task management.

### List All Projects
**Endpoint**: `GET /api/projects`

**Query Parameters**:
- `projectId` - Filter by project ID
- `status` - Filter by status (active, archived)

**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "My Project",
      "branch": "main",
      "taskId": "task-uuid",
      "status": "active"
    }
  ]
}
```

### Create New Project
**Endpoint**: `POST /api/projects`

**Request Body**:
```json
{
  "name": "My Project",
  "branch": "main",
  "taskId": "task-uuid"
}
```

**Response (201)**: Created project object

### Get Single Project
**Endpoint**: `GET /api/projects/:id`

**Response (200)**: Full project details including Git repository info

### Update Project
**Endpoint**: `PUT /api/projects/:id`

**Request Body**: Partial update fields

**Response (200)**: Updated project object

### Delete Project
**Endpoint**: `DELETE /api/projects/:id`

**Response (204)**: No content

---

## AI Agents Management

Deploy and manage autonomous AI agents with terminal capabilities.

### List All Agents
**Endpoint**: `GET /api/agents`

**Query Parameters**:
- `status` - Filter by status (deployed, stopped)
- `agentName` - Filter by agent name

**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Code Review Agent",
      "status": "deployed",
      "serverId": "server-uuid"
    }
  ]
}
```

### Create New Agent
**Endpoint**: `POST /api/agents`

**Request Body**:
```json
{
  "name": "Code Review Agent",
  "description": "Automated code review",
  "serverId": "server-uuid"
}
```

**Response (201)**: Created agent object

### Get Single Agent
**Endpoint**: `GET /api/agents/:id`

**Response (200)**: Full agent details including deployment status

### Update Agent
**Endpoint**: `PUT /api/agents/:id`

**Request Body**: Partial update fields

**Response (200)**: Updated agent object

### Delete Agent
**Endpoint**: `DELETE /api/agents/:id`

**Response (204)**: No content

---

## Custom Widgets

Configure custom widgets to monitor arbitrary commands and metrics.

### List All Widgets
**Endpoint**: `GET /api/widgets`

**Query Parameters**:
- `name` - Filter by widget name
- `type` - Filter by type (number, text, chart)
- `serverId` - Filter by server

**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Active Containers",
      "command": "docker ps -q | wc -l",
      "type": "number",
      "color": "#3b82f6",
      "serverId": "server-uuid"
    }
  ]
}
```

### Create New Widget
**Endpoint**: `POST /api/widgets`

**Request Body**:
```json
{
  "name": "Active Containers",
  "command": "docker ps -q | wc -l",
  "type": "number",
  "color": "#3b82f6",
  "serverId": "server-uuid"
}
```

**Response (201)**: Created widget object

### Get Single Widget
**Endpoint**: `GET /api/widgets/:id`

**Response (200)**: Full widget details

### Update Widget
**Endpoint**: `PUT /api/widgets/:id`

**Request Body**: Partial update fields

**Response (200)**: Updated widget object

### Delete Widget
**Endpoint**: `DELETE /api/widgets/:id`

**Response (204)**: No content

---

## Settings Management

Manage global dashboard settings and user preferences.

### List All Settings
**Endpoint**: `GET /api/settings`

**Response (200)**:
```json
{
  "data": {
    "theme": "dark",
    "language": "en",
    "notifications": true,
    "autoRefresh": 30
  }
}
```

### Update Settings
**Endpoint**: `PUT /api/settings`

**Request Body**:
```json
{
  "theme": "light",
  "language": "pl"
}
```

**Response (200)**: Updated settings object

---

## Error Responses

All endpoints may return error responses in the following format:

### Generic Error (4xx/5xx)
```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "status": 400
  }
}
```

### Common Error Codes
- `INVALID_CREDENTIALS` - Invalid email or password
- `UNAUTHORIZED` - Missing or invalid JWT token
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Request body validation failed
- `INTERNAL_SERVER_ERROR` - Unexpected server error

---

## Rate Limiting

API requests are rate-limited to prevent abuse:

- **Standard limit**: 100 requests per minute per IP
- **Exceeding limit**: Returns HTTP 429 with `Retry-After` header

---

## CORS Configuration

CORS is enabled for development environments. Production CORS configuration should be customized based on your deployment requirements.

**Allowed Origins (Development)**:
- `http://localhost:5173`
- `http://localhost:3000`

**Allowed Methods**:
- `GET`, `POST`, `PUT`, `DELETE`, `PATCH`

**Allowed Headers**:
- `Content-Type`, `Authorization`, `X-Requested-With`

---

## Response Formats

All successful responses use the following format:

```json
{
  "data": {},
  "meta": {
    "timestamp": "2026-08-12T10:30:00Z"
  }
}
```

Empty responses (e.g., after logout) return HTTP 204 No Content.

---

## Testing APIs

### Using cURL
```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secure"}'

# Get current user (requires auth)
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# List servers
curl -X GET http://localhost:3001/api/servers \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Using JavaScript Fetch
```javascript
// Login
const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

// Get current user
const userResponse = await fetch('http://localhost:3001/api/auth/me', {
  headers: { 
    'Authorization': `Bearer ${token}`
  }
});
```

---

**Last Updated**: 2026-08-12  
**API Version**: 1.0.0
