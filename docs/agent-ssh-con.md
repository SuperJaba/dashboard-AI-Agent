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

## 2. CT8 (`s1.ct8.pl`)
BatchMode agent command (copy-paste ready):
```bash
ssh -i ~/.ssh/id_ed25519_antigravity \
    -o BatchMode=yes \
    -o StrictHostKeyChecking=accept-new \
    -o ConnectTimeout=10 \
    -p 22 jagger2@s1.ct8.pl "COMMAND"
```
Or use the convenience wrapper script:
```bash
node scripts/ssh-ct8.js "<COMMAND>"
```

Key: `~/.ssh/id_ed25519_antigravity`  
Host: `jagger2@s1.ct8.pl:22` (alias `ct8-jagger2`)
