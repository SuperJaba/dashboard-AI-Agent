# SSH to CT8

BatchMode agent command (copy-paste ready):
```bash
ssh -i ~/.ssh/id_ed25519_antigravity \
    -o BatchMode=yes \
    -o StrictHostKeyChecking=accept-new \
    -o ConnectTimeout=10 \
    -p 22 jagger2@s1.ct8.pl "COMMAND"
```

Key: `~/.ssh/id_ed25519_antigravity`
Host: `jagger2@s1.ct8.pl:22`

> Human setup (one-time key upload, interactive session, `~/.ssh/config` alias): see [agent-ssh-con-human.md](agent-ssh-con-human.md)
