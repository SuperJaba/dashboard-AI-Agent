# Remote SSH Administration (CT8 & OMV)

## 1. OMV (OpenMediaVault)
Direct BatchMode SSH command execution for OMV (`root@10.10.10.100`, alias `omv` in `~/.ssh/config`):

```bash
ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes omv -p 22 "bash -c '<COMMAND>'"
```

### Examples:
- Inspect system logs and recent errors:
  ```bash
  ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes omv -p 22 "bash -c 'journalctl -xe'"
  ```
- Check services / systemctl status:
  ```bash
  ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes omv -p 22 "bash -c 'systemctl status <service>'"
  ```

Key: `~/.ssh/id_ed25519_antigravity`  
Host: `omv` (10.10.10.100:22, user `root`)

---

## 2. CT8 (`s1.ct8.pl` / alias `jagger2`)
Host alias `jagger2` is configured in `~/.ssh/config` (pointing to `s1.ct8.pl`, user `jagger2`, key `~/.ssh/id_ed25519_antigravity`, BatchMode).

Direct execution using alias from `~/.ssh/config`:
```bash
ssh jagger2 "COMMAND"
```

Or explicit command referencing `~/.ssh/config` host:
```bash
ssh -i ~/.ssh/id_ed25519_antigravity -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -p 22 jagger2 "COMMAND"
```

### Examples:
- Bezpieczne czyszczenie logów (logi npm oraz domen):
  ```bash
  ssh -i ~/.ssh/id_ed25519_antigravity -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -p 22 jagger2 "rm -rf ~/.npm/_logs/* ~/domains/*/logs/* 2>/dev/null || true"
  ```
  (lub w skróconej formie z wykorzystaniem `~/.ssh/config`):
  ```bash
  ssh jagger2 "rm -rf ~/.npm/_logs/* ~/domains/*/logs/* 2>/dev/null || true"
  ```
- Or using wrapper script:
```bash
node scripts/ssh-ct8.js "<COMMAND>"
```

Key: `~/.ssh/id_ed25519_antigravity`  
Host alias in `~/.ssh/config`: `jagger2` (mapping to `s1.ct8.pl:22`, user `jagger2`)
