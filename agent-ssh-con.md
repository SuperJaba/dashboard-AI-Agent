# Instrukcja połączenia SSH z serwerem zdalnym

Niniejszy dokument opisuje krok po kroku procedurę zestawiania zautomatyzowanego połączenia SSH bez interaktywnych promptów (tryb `BatchMode`).

---

## 1. Wymagane parametry połączenia

- **Host**: `s1.ct8.pl`
- **Port**: `22`
- **Użytkownik**: `jagger2`
- **Klucz prywatny**: `/home/seba/.ssh/id_ed25519_antigravity`
- **Klucz publiczny**: `/home/seba/.ssh/id_ed25519_antigravity.pub`

---

## 2. Jednorazowa konfiguracja klucza na serwerze (z maszyny lokalnej)

Aby serwer akceptował połączenia SSH przy użyciu dedykowanego klucza, należy wgrać klucz publiczny na serwer zdalny:

```bash
ssh-copy-id -f -i "/home/seba/.ssh/id_ed25519_antigravity.pub" -p 22 jagger2@s1.ct8.pl
```

---

## 3. Łączenie z serwerem (polecenie SSH)

### Połączenie interaktywne / Sesja SSH
Aby otworzyć interaktywną powłokę (shell) na serwerze zdalnym:

```bash
ssh -i /home/seba/.ssh/id_ed25519_antigravity -p 22 jagger2@s1.ct8.pl
```

### Zautomatyzowane wykonywanie poleceń (Batch Mode)
W przypadku agentów, skryptów CI/CD i automatyzacji należy podać flagi `-o StrictHostKeyChecking=accept-new` oraz `-o BatchMode=yes`:

```bash
ssh -i /home/seba/.ssh/id_ed25519_antigravity -o StrictHostKeyChecking=accept-new -o BatchMode=yes jagger2@s1.ct8.pl -p 22
```

---

## 4. Konfiguracja w `~/.ssh/config` (opcjonalnie)

Dla ułatwienia można dodać alias w pliku `~/.ssh/config` na lokalnym komputerze:

```sshconfig
Host ct8-jagger2
    HostName s1.ct8.pl
    Port 22
    User jagger2
    IdentityFile /home/seba/.ssh/id_ed25519_antigravity
    IdentitiesOnly yes
    BatchMode yes
    StrictHostKeyChecking accept-new
```

Po zapisaniu powyższego profilu połączenie realizuje się prostą komendą:

```bash
ssh ct8-jagger2 'uname -a'
```
