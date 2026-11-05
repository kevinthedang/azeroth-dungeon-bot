# Deploying to a Raspberry Pi

Deployment is automated with GitHub Actions. When a push to `master` passes the
`Test` workflow, [`deploy.yml`](workflows/deploy.yml) connects to the Pi over
SSH, syncs the source, rebuilds the bot on the Pi, and restarts the systemd
service.

The deploy runs from a GitHub-hosted `ubuntu-latest` runner, so the runner has
to be able to reach the Pi over SSH (see [Network access](#network-access)).

## How the pipeline works

1. A push to `master` runs the `Test` workflow.
2. If it succeeds, `Deploy` starts. It first builds the tested commit on the
   runner as a sanity check.
3. The deploy job uses `rsync` to copy the repository to the Pi. `.git`,
   `node_modules`, `data/`, and `.env` are excluded.
4. `CLIENT_TOKEN` is written to `.env` on the Pi from the GitHub secret.
5. `npm ci` and `npm run build` run **on the Pi**, so native modules such as
   `@napi-rs/canvas` match the Pi's ARM architecture.
6. `wow-dungeon-bot` is restarted only after the build succeeds, then checked with
   `systemctl is-active`.

You can also run `Deploy` manually from **Actions > Deploy > Run workflow** and
provide a previous commit SHA. This is the rollback mechanism.

## Requirements

- Raspberry Pi running 64-bit Raspberry Pi OS
- Internet access and an SSH server
- Node.js 24.21.0 or newer
- `rsync` on the Pi
- A Discord bot token
- Passwordless `systemctl restart` permission for the deploy user

## 1. Install Node.js

```bash
sudo apt update
sudo apt install -y curl rsync
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node --version
```

## 2. Create the install directory

The service runs from this directory. The deploy user must own it so `rsync` and
`npm ci` can write to it.

```bash
sudo mkdir -p /opt/azeroth-chronicle-bot
sudo chown "$USER":"$USER" /opt/azeroth-chronicle-bot
```

You do not need to `git clone` on the Pi; the workflow copies the files over.
If the directory already contains a checkout, that is fine. The workflow
preserves `data/` and the existing `.env`.

## 3. Run the bot with systemd

Create the service:

```bash
sudo nano /etc/systemd/system/wow-dungeon-bot.service
```

Replace `YOUR_USERNAME`:

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

Enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now wow-dungeon-bot
sudo systemctl status wow-dungeon-bot
```

The bot's `.env` is written by the workflow from the `CLIENT_TOKEN` secret. If
you prefer to keep the token only on the Pi, remove the "Write the token" part
of the deploy step and create `.env` manually:

```bash
printf 'CLIENT_TOKEN=%s\n' 'your-bot-token' > /opt/azeroth-chronicle-bot/.env
chmod 600 /opt/azeroth-chronicle-bot/.env
```

## 4. Allow the deploy user to restart the service

The workflow restarts the service with `sudo -n`, so the deploy user needs a
narrow sudo rule. Run on the Pi:

```bash
SERVICE=wow-dungeon-bot
echo "$USER ALL=(root) NOPASSWD: $(command -v systemctl) restart $SERVICE" |
  sudo tee /etc/sudoers.d/wow-dungeon-bot-deploy
sudo chmod 440 /etc/sudoers.d/wow-dungeon-bot-deploy
```

Verify it works without a password:

```bash
sudo -n systemctl restart wow-dungeon-bot
```

## 5. Create a deploy SSH key

On your workstation:

```bash
ssh-keygen -t ed25519 -C "github-actions-azeroth" -f ~/.ssh/azeroth_deploy -N ""
ssh-copy-id -i ~/.ssh/azeroth_deploy.pub pi@raspberrypi.local
```

Confirm the key can log in:

```bash
ssh -i ~/.ssh/azeroth_deploy pi@raspberrypi.local 'echo ok'
```

## 6. Add GitHub secrets and variables

In **Settings > Secrets and variables > Actions**:

Secrets:

| Name | Value |
| --- | --- |
| `DEPLOY_HOST` | Pi hostname or IP reachable from GitHub (for example a Tailscale name) |
| `DEPLOY_USER` | SSH user on the Pi, for example `pi` |
| `DEPLOY_SSH_KEY` | Full contents of the private key, `~/.ssh/azeroth_deploy` |
| `CLIENT_TOKEN` | Discord bot token |
| `DEPLOY_PORT` | Optional, defaults to `22` |
| `DEPLOY_KNOWN_HOSTS` | Optional pinned host key; see below |
| `TS_OAUTH_CLIENT_ID` | Optional Tailscale OAuth client ID; see [Network access](#network-access) |
| `TS_OAUTH_SECRET` | Optional Tailscale OAuth client secret |

Variables (optional):

| Name | Default | Purpose |
| --- | --- | --- |
| `DEPLOY_PATH` | `/opt/azeroth-chronicle-bot` | Install directory on the Pi |
| `DEPLOY_SERVICE` | `wow-dungeon-bot` | systemd unit name |

### Host key verification

By default the workflow runs `ssh-keyscan` before connecting. To pin the host
key instead, run this on your workstation and paste the output into the
`DEPLOY_KNOWN_HOSTS` secret:

```bash
ssh-keyscan -p 22 -H raspberrypi.local
```

## Network access

The GitHub-hosted runner is on the public internet. A Pi on your home LAN
(`raspberrypi.local`, `192.168.x.x`, `10.x.x.x`, and so on) is **not reachable**
from it. The deploy will fail at the TCP connectivity check until the Pi is
reachable over the internet.

### Option 1: Tailscale (recommended)

Tailscale gives the runner and the Pi private addresses on the same virtual
network, so you do not need to expose SSH to the internet.

**On the Pi:**

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
tailscale ip -4          # note this 100.x.y.z address
hostname                 # or use the MagicDNS name
```

**In the Tailscale admin console:**

1. Go to **Settings > OAuth clients** and create a client with the `auth_keys`
   scope and the `tag:github-actions` tag.
2. Add an access rule so `tag:github-actions` can reach the Pi on port 22, for
   example:

   ```json
   {
     "grants": [
       {
         "src": ["tag:github-actions"],
         "dst": ["tag:server"],
         "ip": ["tcp:22"]
       }
     ]
   }
   ```

   Tag the Pi with `tag:server` in the admin console, or use your existing ACLs.
3. Copy the client ID and secret into the `TS_OAUTH_CLIENT_ID` and
   `TS_OAUTH_SECRET` GitHub secrets.

The deploy workflow automatically joins the tailnet with
`tailscale/github-action` when both secrets are present, then connects to the
Pi. Set `DEPLOY_HOST` to the Pi's Tailscale IP (`100.x.y.z`) or MagicDNS name.

### Option 2: Cloudflare Tunnel

Run `cloudflared` on the Pi and expose SSH through the tunnel, then point
`DEPLOY_HOST`/`DEPLOY_PORT` at the tunnel endpoint. The workflow itself does not
need changes.

### Option 3: Port forwarding

Forward a non-default external port to the Pi's SSH port and set
`DEPLOY_HOST`/`DEPLOY_PORT` accordingly. This exposes SSH to the internet, so
use key-only authentication and a firewall.

A self-hosted GitHub runner on the Pi is another option, but this repository is
public: do not attach a self-hosted runner to a public repo, because pull
requests can execute code on it.

## Deploying an update

Push to `master`. After `Test` passes, the deploy workflow runs automatically.
Watch it under the **Actions** tab.

To check the bot after a deploy:

```bash
ssh pi@raspberrypi.local
sudo systemctl status wow-dungeon-bot
sudo journalctl -u wow-dungeon-bot -f
```

## Rolling back

Open **Actions > Deploy > Run workflow**, then enter the commit SHA of the last
known-good version. The workflow checks out that commit, rebuilds it, and
restarts the service.

## Persistent data

The bot stores its SQLite database in `data/` and artwork in `assets/`. The
deploy excludes `data/` from `rsync --delete`, so the live database is never
removed. Back it up before migrating or replacing the Pi:

```bash
tar -czf azeroth-chronicle-backup.tgz \
  -C /opt/azeroth-chronicle-bot data assets .env
```

## Troubleshooting

- **`Permission denied (publickey)`** — check that the public key is in
  `~/.ssh/authorized_keys` for `DEPLOY_USER` and that `DEPLOY_SSH_KEY` is the
  matching private key.
- **`Host key verification failed`** — update `DEPLOY_KNOWN_HOSTS` or check that
  `DEPLOY_HOST`/`DEPLOY_PORT` reach the right machine.
- **`sudo: a password is required`** — the sudoers rule is missing or does not
  match the systemd unit name. Check `sudo -n systemctl restart wow-dungeon-bot`.
- **`rsync: command not found`** — install `rsync` on the Pi.
- **`npm ci` fails on the Pi** — confirm the Pi has Node 24 and 64-bit
  Raspberry Pi OS; native `@napi-rs/canvas` binaries are architecture-specific.
- **Deploy did not run** — the `Deploy` workflow only runs after the `Test`
  workflow succeeds for a push to `master`. A push that only touches files
  outside `test.yml`'s path filters will not trigger it.
- **GitHub cannot reach the Pi** — see [Network access](#network-access). In
  particular, `raspberrypi.local`, mDNS names, and `192.168.x.x`/`10.x.x.x`
  addresses only work on your LAN and cannot be reached by a GitHub-hosted
  runner. Use a Tailscale name or another tunnel.
- **`ssh-keyscan` fails in the "Trust the Raspberry Pi host key" step** — the
  runner could not open a TCP connection to `DEPLOY_HOST:DEPLOY_PORT`. Check the
  hostname, that SSH is running on the Pi, and that the address is reachable
  from the public internet.
