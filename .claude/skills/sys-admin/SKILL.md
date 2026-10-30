---
name: sys-admin
description: On-demand system hardware diagnostics (CPU, RAM, disk, processes) and remote SSH administration for CT8 host (jagger2@s1.ct8.pl).
---

# System & Remote Administration Skill

Provides token-efficient, zero-dependency tools for inspecting local host health and executing remote SSH tasks on CT8.

## Tool Commands

### 1. Local Diagnostics (`scripts/sys-info.js`)
Executes in <50ms with zero extra npm dependencies. Returns compact, structured JSON.

| Command | Action |
|---|---|
| `node scripts/sys-info.js` | Full system summary (CPU, RAM, Disk, Top 5 processes). |
| `node scripts/sys-info.js --compact` | Ultra-dense single-line JSON (~100 tokens). |
| `node scripts/sys-info.js --mem` | RAM total, used, free, and percentage. |
| `node scripts/sys-info.js --cpu` | CPU model, cores, and 1m/5m/15m load averages. |
| `node scripts/sys-info.js --disk` | Mount point, capacity, used, and available space. |
| `node scripts/sys-info.js --proc` | Top 5 processes sorted by memory utilization. |

### 2. Remote CT8 Administration (`jagger2` / `scripts/ssh-ct8.js`)
Host alias `jagger2` is configured in `~/.ssh/config` (mapping to `s1.ct8.pl:22`, user `jagger2`, key `~/.ssh/id_ed25519_antigravity`, BatchMode).

Direct invocation via SSH config alias:
```bash
ssh jagger2 "<command>"
```

Explicit batch mode invocation:
```bash
ssh -i ~/.ssh/id_ed25519_antigravity -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -p 22 jagger2 "<command>"
```

Safe log cleanup (npm logs & domain logs):
```bash
ssh jagger2 "rm -rf ~/.npm/_logs/* ~/domains/*/logs/* 2>/dev/null || true"
```

Wrapper script commands:
| Command | Action |
|---|---|
| `node scripts/ssh-ct8.js status` | Host uptime, CPU/RAM stats, and `devil www list` status. |
| `node scripts/ssh-ct8.js restart-dash` | Restart the remote dashboard Node.js application via Devil CLI. |
| `node scripts/ssh-ct8.js list-apps` | List configured domains and application paths. |
| `node scripts/ssh-ct8.js logs` | Tail last 30 lines of remote dashboard application/error logs. |
| `node scripts/ssh-ct8.js "<command>"` | Execute arbitrary remote shell command. |

---

## Token Efficiency & Subagent Delegation Rule

1. **Fast Single-Action Checks**: Run `node scripts/sys-info.js` or `node scripts/ssh-ct8.js status` directly in the main thread.
2. **Heavy / Multi-Step Investigations** (large log searches, process tracking, remote directory scans):
   - **Do NOT dump hundreds of lines into the main conversation context.**
   - Spawn a subagent (`invoke_subagent` with role `System Investigator` or `cavecrew-investigator`).
   - Have the subagent run the commands, extract the relevant errors or anomalies, and report back a **3-line summary** to the main conversation.
