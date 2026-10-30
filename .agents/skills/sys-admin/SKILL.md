---
name: sys-admin
description: On-demand system hardware diagnostics (CPU, RAM, disk, processes) and remote SSH administration for CT8 host and OMV (OpenMediaVault).
---

# System & Remote Administration Skill

Provides token-efficient, zero-dependency tools for inspecting local host health and executing remote SSH tasks on CT8 and OMV nodes.

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

### 3. Remote OMV Administration (`omv`)
Non-blocking execution for OpenMediaVault / local storage node (`10.10.10.100`, user `root`), using `~/.ssh/id_ed25519_antigravity`:

| Command | Action |
|---|---|
| `ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes omv -p 22 "bash -c 'journalctl -xe'"` | Inspect system logs and recent errors. |
| `ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes omv -p 22 "bash -c '<command>'"` | Execute arbitrary remote shell command on OMV. |

### 4. SMART Diagnostics & Sector Remediation (Disk Recovery)

When diagnosing/repairing `Current_Pending_Sector` (attribute 197) or `Offline_Uncorrectable` (attribute 198):

1. **Locate Failing LBAs**:
   - Run selective self-test: `smartctl -t select,<LBA>-max /dev/sdX`
   - Read self-test log: `smartctl -l selftest /dev/sdX` to find `LBA_of_first_error`.
   - Verify specific sector readability: `dd if=/dev/sdX of=/dev/null skip=<LBA> count=1 iflag=direct`.

2. **Verify Filesystem Impact**:
   - Calculate block in partition: `(LBA - partition_start_sector) * 512 / block_size`.
   - Inspect allocation state via `debugfs -R "testb <block>" /dev/sdX<N>`. If block is unallocated, zeroing poses no user data loss.

3. **Force Controller Reallocation / ECC Refresh**:
   - Write zero directly to LBA: `dd if=/dev/zero of=/dev/sdX seek=<LBA> count=1 bs=512 oflag=direct`.
   - Verify read: `dd if=/dev/sdX of=/dev/null skip=<LBA> count=1 bs=512 iflag=direct`.

4. **Shell Execution Guard**:
   - Remote machines with `zsh` fail on unmatched wildcards (`no matches found`). Always wrap compound commands and globbing inside `bash -c '...'`.


---

## Token Efficiency & Subagent Delegation Rule

1. **Fast Single-Action Checks**: Run `node scripts/sys-info.js`, `node scripts/ssh-ct8.js status`, or targeted OMV ssh commands directly in the main thread.
2. **Heavy / Multi-Step Investigations** (large log searches, process tracking, remote directory scans):
   - **Do NOT dump hundreds of lines into the main conversation context.**
   - Spawn a subagent (`invoke_subagent` with role `System Investigator` or `cavecrew-investigator`).
   - Have the subagent run the commands, extract the relevant errors or anomalies, and report back a **3-line summary** to the main conversation.
