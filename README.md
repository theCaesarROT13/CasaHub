# 🏠 CasaHub

Una web application self-hosted sviluppata in **Node.js** ed **Express**, progettata per essere eseguita su **Raspberry Pi** (o qualsiasi server Linux basato su Debian/Ubuntu) e resa accessibile in sicurezza dall'esterno tramite **HTTPS**, **Nginx** come reverse proxy e **DuckDNS**.

---

## 📋 Prerequisiti

Prima di iniziare, assicurati di avere a disposizione:

* **Hardware:** Raspberry Pi (consigliato Pi 3B+, Pi 4 o Pi 5) con sistema operativo Raspberry Pi OS (Debian) aggiornato.
* **Rete:** Accesso al pannello di amministrazione del router per configurare il **Port Forwarding** e un indirizzo IP locale statico assegnato al Raspberry Pi.
* **Dominio Dinamico:** Un account gratuito su [DuckDNS](https://www.duckdns.org/) con un sottodominio registrato (es. `tuodominio.duckdns.org`).
* **Software di base:** Git e curl installati sul sistema.

---

## 🚀 1. Installazione delle Dipendenze

Aggiorna il sistema e installa **Node.js**, **Nginx** e **Certbot**:

```bash
# Aggiornamento dei pacchetti di sistema
sudo apt update && sudo apt upgrade -y

# Installazione di Node.js e npm (v20 LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Installazione di Nginx e Certbot per i certificati SSL
sudo apt install -y nginx certbot python3-certbot-nginx
```

---

## 📦 2. Installazione dell'Applicazione

Clona la repository e installa i pacchetti necessari del progetto:

```bash
# Clona il progetto nella cartella home
cd ~
git clone https://github.com/tuo-username/CasaHub.git
cd CasaHub

# Installa le dipendenze Node.js
npm install
```

Puoi fare un primo test rapido di avvio manuale per assicurarti che tutto funzioni:
```bash
node server.js
```
*(Premi `Ctrl + C` per interrompere il test una volta verificato che il server parte senza errori).*

---

## ⚙️ 3. Avvio Automatico con Systemd (Consigliato)

Per fare in modo che CasaHub rimanga sempre attivo in background e si avvii automaticamente all'accensione del Raspberry Pi senza dover tenere il terminale aperto, creiamo un servizio di sistema **Systemd**:

1. Crea il file del servizio:
   ```bash
   sudo nano /etc/systemd/system/casahub.service
   ```

2. Incolla il seguente contenuto (sostituendo `pi` con il tuo nome utente Linux se diverso, ad esempio `giulio`):
   ```ini
   [Unit]
   Description=CasaHub Node.js Server
   After=network.target

   [Service]
   Type=simple
   User=pi
   WorkingDirectory=/home/pi/CasaHub
   ExecStart=/usr/bin/node /home/pi/CasaHub/server.js
   Restart=on-failure
   RestartSec=10
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```
   Salva (`Ctrl + O`, `Invio`) ed esci (`Ctrl + X`).

3. Abilita e avvia il servizio:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable casahub
   sudo systemctl start casahub
   ```

4. Verifica che il server risponda localmente sulla porta `3000`:
   ```bash
   curl -I http://localhost:3000
   ```

---

## 🌐 4. Configurazione del Router (Port Forwarding)

Accedi alle impostazioni del tuo router (solitamente `192.168.1.1`) e crea due regole di inoltro porte (**Port Forwarding / Virtual Server**) puntate all'indirizzo IP locale del tuo Raspberry Pi:

| Nome Regola | Protocollo | Porta Esterna (WAN) | Porta Interna (LAN) | IP Destinazione |
| :--- | :---: | :---: | :---: | :---: |
| **HTTP** | TCP | `80` | `80` | `<IP_RASPBERRY_PI>` |
| **HTTPS** | TCP | `443` | `443` | `<IP_RASPBERRY_PI>` |

> ⚠️ **Nota sulla sicurezza:** Non aprire la porta `3000` verso l'esterno. Tutto il traffico passerà attraverso Nginx sulle porte `80` e `443`.

---

## 🔒 5. Configurazione di Nginx e SSL (HTTPS)

### A. Creazione del profilo Nginx

Rimuovi la configurazione predefinita di Nginx e crea un nuovo file per CasaHub:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo nano /etc/nginx/sites-available/casahub
```

Incolla la seguente configurazione (sostituendo `tuodominio.duckdns.org` con il tuo dominio DuckDNS):

```nginx
server {
    listen 80;
    server_name tuodominio.duckdns.org;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Salva il file (`Ctrl + O`, `Invio`) ed esci (`Ctrl + X`).

### B. Attivazione del sito e generazione certificato SSL

Collega il file di configurazione, verifica la sintassi e richiedi il certificato gratuito a Let's Encrypt:

```bash
# Abilita il sito
sudo ln -s /etc/nginx/sites-available/casahub /etc/nginx/sites-enabled/

# Verifica la sintassi e riavvia Nginx
sudo nginx -t
sudo systemctl restart nginx

# Genera il certificato SSL e configura il reindirizzamento HTTPS automatico
sudo certbot --nginx -d tuodominio.duckdns.org
```

Durante la procedura di Certbot, inserisci la tua email, accetta i termini (`Y`) e seleziona l'opzione per reindirizzare automaticamente tutto il traffico HTTP su HTTPS.

### C. Verifica Firewall (se UFW è attivo)

Se utilizzi il firewall `ufw` sul Raspberry Pi, consenti il traffico web:

```bash
sudo ufw allow 'Nginx Full'
```

---

## 🛠️ Comandi Utili per la Manutenzione

* **Controllare lo stato dell'app CasaHub:**
  ```bash
  sudo systemctl status casahub
  ```
* **Visualizzare i log dell'applicazione in tempo reale:**
  ```bash
  sudo journalctl -u casahub -f
  ```
* **Riavviare l'applicazione dopo una modifica al codice:**
  ```bash
  sudo systemctl restart casahub
  ```
* **Verificare la configurazione e lo stato di Nginx:**
  ```bash
  sudo nginx -t
  sudo systemctl status nginx
  ```
* **Testare il rinnovo automatico dei certificati SSL:**
  ```bash
  sudo certbot renew --dry-run
  ```

---

## 📄 Licenza

Questo progetto è distribuito sotto licenza MIT. Sentiti libero di modificarlo e adattarlo alle tue esigenze.# CasaHub
