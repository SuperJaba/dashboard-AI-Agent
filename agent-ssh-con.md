# Połączenie SSH ze Zdalnym Serwerem (CT8)

Procedura zestawiania zautomatyzowanego połączenia SSH bez interaktywnych promptów (tryb `BatchMode`).

## 1. Parametry Połączenia
- **Host**: `s1.ct8.pl`
- **Port**: `22`
- **Użytkownik**: `jagger2`
- **Klucz prywatny**: `~/.ssh/id_ed25519_antigravity`
- **Klucz publiczny**: `~/.ssh/id_ed25519_antigravity.pub`

## 2. Jednorazowa Konfiguracja Klucza
Wgranie klucza publicznego na serwer z maszyny lokalnej:
```bash
ssh-copy-id -f -i ~/.ssh/id_ed25519_antigravity.pub -p 22 jagger2@s1.ct8.pl
```

## 3. Polecenia SSH

### Zautomatyzowane Wykonywanie (Batch Mode dla Agentów/CI)
```bash
ssh -i ~/.ssh/id_ed25519_antigravity -o StrictHostKeyChecking=accept-new -o BatchMode=yes -p 22 jagger2@s1.ct8.pl "polecenie"
```

### Połączenie Interaktywne
```bash
ssh -i ~/.ssh/id_ed25519_antigravity -p 22 jagger2@s1.ct8.pl
```

## 4. Alias w `~/.ssh/config` (opcjonalnie)
```sshconfig
Host ct8-jagger2
    HostName s1.ct8.pl
    Port 22
    User jagger2
    IdentityFile ~/.ssh/id_ed25519_antigravity
    IdentitiesOnly yes
    BatchMode yes
    StrictHostKeyChecking accept-new
```
Użycie:
```bash
ssh ct8-jagger2 'uname -a'
```
