# Deploying to a Raspberry Pi

This repository's GitHub Actions workflow runs tests when changes are pushed to
`master`. It does not automatically deploy to the Raspberry Pi or another local
server. Deployment is performed manually after the master branch has passed.

## Requirements

- Raspberry Pi running 64-bit Raspberry Pi OS
- Internet access
- Node.js 24.21.0 or newer
- Git
- A Discord bot token stored in the application's `.env` file

## Install Node.js and the application

```bash
sudo apt update
sudo apt install -y git curl

curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node --version
```

Create an installation directory owned by the local user:

```bash
sudo mkdir -p /opt/azeroth-chronicle-bot
sudo chown "$USER":"$USER" /opt/azeroth-chronicle-bot

git clone https://github.com/kevinthedang/azeroth-chronicle-bot.git \
  /opt/azeroth-chronicle-bot
cd /opt/azeroth-chronicle-bot

npm ci
npm run build
```

## Configure the bot

Copy the example environment file and add the bot token:

```bash
cp .env.example .env
nano .env
```

```env
CLIENT_TOKEN=your-bot-token
```

Do not commit `.env` or expose the token. If the token is replaced or reset,
update `.env`, restart the service, and keep the installed application
associated with the new Discord application.

For the Discord application, enable the privileged Gateway intents the client
requests in **Developer Portal > Application > Bot > Privileged Gateway
Intents**. The application should have the `bot` and `applications.commands`
OAuth scopes, with the permissions needed for viewing channels, sending
messages, embedding links, attaching files, reading message history, and using
application commands. Administrator permission is not required.

## Run automatically with systemd

Create a systemd service:

```bash
sudo nano /etc/systemd/system/azeroth-bot.service
```

Use the following service definition, replacing `YOUR_USERNAME`:

```ini
[Unit]
Description=Azeroth Chronicle Discord Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/azeroth-chronicle-bot
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
User=YOUR_USERNAME

[Install]
WantedBy=multi-user.target
```

Enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now azeroth-bot
sudo systemctl status azeroth-bot
sudo journalctl -u azeroth-bot -f
```

## Update the deployment

Wait until the pushed `master` commit passes GitHub Actions, then update the
Raspberry Pi manually:

```bash
cd /opt/azeroth-chronicle-bot
git pull origin master
npm ci
npm run build
sudo systemctl restart azeroth-bot
```

Check the service and logs:

```bash
sudo systemctl status azeroth-bot
sudo journalctl -u azeroth-bot -f
```

## Persistent data

The bot stores its SQLite database in `data/` and ships with artwork in `assets/`.
Back up both directories before migrating the installation or replacing the
Raspberry Pi:

```bash
tar -czf azeroth-chronicle-backup.tgz data assets .env
```
