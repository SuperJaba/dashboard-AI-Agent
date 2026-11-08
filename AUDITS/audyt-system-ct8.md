  Przeprowadziłem zautomatyzowaną analizę i audyt serwera OMV (10.10.10.100) w ramach sesji SSH. Poniżej znajduje się szczegółowy
  raport kondycji oraz zestaw rekomendowanych działań DevOps.
  ──────
   📊 Raport z Audytu Systemu OMV (omv2)

  ## 1. Profil sprzętowy i systemowy

  • System OS: Debian GNU/Linux 13 (trixie) x86_64, Kernel 7.2.11+deb13-amd64
  • Uptime & Load: ~20h, Load average: 0.56, 0.37, 0.20
  • Procesor: Intel Core i3-5005U @ 2.00GHz (2 rdzenie / 4 wątki, energooszczędny Broadwell)
  • Pamięć RAM: 3.7 GiB (1.5 GiB zajęte przez procesy, 2.2 GiB buff/cache)
  • SWAP: 976 MiB na partycji /dev/sda3 (zajęte ~535 MiB / 55%), zswap jest wyłączony
  • Dyski i magazyn danych:
      • /dev/sda (WDC WD6400BEVT, 5400 RPM HDD, 596 GB) – dane ext4 (sda2) + SWAP (sda3)
      • /dev/sdb (Seagate ST320LT012, 5400 RPM HDD, 298 GB) – dysk systemowy / (ext4) z pozostałościami sygnatury zfs_member
      • /dev/sdc (Seagate Backup+ Hub BK, 2.8 TB, USB HDD) – partycja NTFS zamontowana przez FUSE (fuseblk)

  ──────
  ## 2. Ocena Kondycji (Health Check): DOSTATECZNA (Wymaga interwencji)

  ### 🔴 Krytyczne problemy i awarie usług

  1. Pętla błędów w logach (twingate-notifier):
      • Proces /usr/bin/twingate-notifier wykonuje pętlę co 5 sekund, raportując: auth.sock socket is not found, zalewając systemd-
      journald.
      • Sama usługa systemowa twingate.service jest wyłączona (konektor Twingate działa prawidłowo w kontenerze Dockera twingate-
      famous-fossa). Klient hosta został uruchomiony osierocony i bezcelowo obciąża logi.
  2. 3 nieudane jednostki systemd (systemctl --failed):
      • dnsmasq.service – FAILED: konflikt na porcie 53 (Address already in use – port zajęty przez nextdns oraz systemd-resolved).
      • wg-quick@wgnet1.service – FAILED: brak pliku konfiguracyjnego /etc/wireguard/wgnet1.conf przy włączonym autostarcie usługi.
      • zfs-load-module.service – FAILED: brak modułu ZFS dla nowego jądra 7.2.11+deb13-amd64 (na maszynie nie ma aktywnej puli ZFS,
      jest jedynie stara flaga partycji na /dev/sdb).


  ### 🟡 Wydajność i wąskie gardła (I/O & RAM)

  1. Wszystkie dyski to wolne dyski talerzowe 5400 RPM:
      • Dysk systemowy / oraz magazyn kontenerów (/var/lib/docker, /var/lib/containers) działają na mechanicznym laptopowym dysku
      HDD. Prowadzi to do wysokich opóźnień (I/O wait) przy jednoczesnej pracy baz danych (MariaDB, Prometheus).
  2. NTFS na dysku USB 2.8 TB (/dev/sdc1):
      • Sterownik fuseblk (NTFS-3G w przestrzeni użytkownika) drastycznie zwiększa narzut na procesor przy zapisie/odczycie i nie
      wspiera natywnych uprawnień POSIX.
  3. Pamięć RAM i swapowanie na HDD:
      • Przy zaledwie 3.7 GiB RAM i uruchomionych kilkunastu usługach, 535 MB pamięci trafiło do SWAP na talerzowy dysk HDD. Brak
      kompresji zswap powoduje spadek responsywności systemu pod obciążeniem.
  4. Duplikacja runtime'ów kontenerów (Docker + Podman):
      • System utrzymuje jednocześnie demony Dockera oraz środowisko Podmana (każdy z własnymi interfejsami sieciowymi veth,
      regułami iptables i mostkami docker0, podman0, br-e265...).
      • W Dockerze zalegają 3 porzucone kontenery watchtower (status Exited od 2-3 miesięcy).
      • W Podmanie wisi nieużywany kontener owntone utworzony 10 miesięcy temu.
