# SSH to CT8 — Human Setup

## One-time key upload
```bash
ssh-copy-id -f -i ~/.ssh/id_ed25519_antigravity.pub -p 22 jagger2@s1.ct8.pl
```

## Interactive session
```bash
ssh -i ~/.ssh/id_ed25519_antigravity -p 22 jagger2@s1.ct8.pl
```

## ~/.ssh/config alias (optional)
```sshconfig
Host ct8-jagger2
    HostName s1.ct8.pl
    Port 22
    User jagger2
    IdentityFile ~/.ssh/id_ed25519_antigravity
    IdentitiesOnly yes
    BatchMode yes
    StrictHostKeyChecking accept-new
    ConnectTimeout 10
```
Usage: `ssh ct8-jagger2 'uname -a'`
