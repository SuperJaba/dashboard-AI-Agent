# QA Bug Report - Dashboard Application

**Test Date:** 2026-08-13  
**Target URL:** http://localhost:5173  
**Tester:** Automated QA (dogfood skill)  
**Status:** Issues Found

---

## Executive Summary

Found **2 Critical issues** related to backend connectivity and API failures. These errors prevent the application from functioning properly as a dashboard that manages AI agents and LLM servers.

### Issue Count by Severity
| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 0 |
| Medium | 0 |
| Low | 0 |

---

## Issues Found

### Issue #1: Failed to Fetch Agents - API Connectivity Failure
- **Severity:** Critical
- **Category:** Functional / Console
- **URL:** http://localhost:5173 (AgentsView page)
- **Description:** The application fails to fetch registered AI agents. All requests return `TypeError: Failed to fetch`.

**Console Errors Observed:**
```
Failed to fetch agents TypeError: Failed to fetch
    at apiFetch (http://localhost:5173/src/shared/api-client/client.ts:99:9)
    at fetchAgents (http://localhost:5173/src/AgentsView.tsx:44:22)
```

**Steps to Reproduce:**
1. Navigate to http://localhost:5173
2. Observe console errors in browser DevTools

**Expected Behavior:** Agents should be fetched from the backend API and displayed in the UI.

**Actual Behavior:** API request fails with "Failed to fetch" error, no agents loaded.

---

### Issue #2: Failed to Fetch LLM Servers - Backend Connection Timeout
- **Severity:** Critical
- **Category:** Functional / Console
- **URL:** http://localhost:5173 (LlmServerManager page)
- **Description:** The application fails to fetch and connect to LLM server instances. All requests result in connection timeouts.

**Console Errors Observed:**
```
Failed to fetch LLM servers TypeError: Failed to fetch
    at apiFetch (http://localhost:5173/src/shared/api-client/client.ts:99:9)
    at fetchServers (http://localhost:5173/src/LlmServerManager.tsx:23:22)

ApiError: Connection terminated due to connection timeout
    at request (http://localhost:5173/src/shared/api-client/client.ts:52:18)
```

**Steps to Reproduce:**
1. Navigate to http://localhost:5173
2. Observe console errors in browser DevTools

**Expected Behavior:** LLM servers should be discovered and connected for agent communication.

**Actual Behavior:** Connection timeouts occur repeatedly, preventing any server communication.

---

### Issue #3: Service Worker Not Found - Runtime Warning
- **Severity:** Medium
- **Category:** Console / UX
- **URL:** http://localhost:5173
- **Description:** Vite dev server reports that the service worker is not found, which may affect caching and performance optimization.

**Console Error Observed:**
```
SERVICE WORKER NOT FOUND
```

**Steps to Reproduce:**
1. Navigate to http://localhost:5173
2. Check console for warnings

**Expected Behavior:** Service worker should be registered if using production build or configured dev server.

**Actual Behavior:** Warning indicates service worker configuration may be incomplete.

---

## Root Cause Analysis

The primary issue appears to be **backend connectivity failure**. The frontend application is running successfully (Vite dev server on port 5173), but cannot communicate with:
- Backend API endpoints for agent management
- LLM server discovery and connection services

This could be caused by:
1. Backend server not running or misconfigured
2. CORS policy blocking requests
3. Network/firewall restrictions
4. Incorrect API endpoint configuration in client.ts

---

## Testing Notes

### What Was Tested
- ✅ Application starts successfully (Vite dev server)
- ✅ Frontend renders without layout issues
- ❌ Backend API connectivity fails
- ❌ LLM server discovery fails
- ❌ Agent loading fails

### What Was Not Tested
- Login/Authentication flows (backend not reachable)
- User registration forms
- Dashboard data visualization (requires backend data)
- Responsive design testing
- Edge cases and error handling

---

## Recommendations

1. **Priority 1:** Verify backend server is running and accessible at expected endpoints
2. **Priority 2:** Check CORS configuration in the backend
3. **Priority 3:** Review `client.ts` API client configuration for correct base URLs
4. **Priority 4:** Address service worker configuration if using production build

---

## Files Referenced

- `src/shared/api-client/client.ts` - API client implementation (line 99, 52)
- `src/AgentsView.tsx` - Agents view component (line 44)
- `src/LlmServerManager.tsx` - LLM server manager (line 23)
- `src/hooks/useDashboardState.ts` - Dashboard state hook (line 289)
