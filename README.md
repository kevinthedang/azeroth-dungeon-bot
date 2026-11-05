<div align="center">
    <h1>Azeroth Chronicle</h1>
    <h3>World of Warcraft Dungeon Tracking Discord Bot</h3>
    <a href="https://github.com/kevinthedang/azeroth-dungeon-bot/actions/workflows/test.yml">
        <img src="https://github.com/kevinthedang/azeroth-dungeon-bot/actions/workflows/test.yml/badge.svg" alt="Tests">
    </a>
    <a href="https://github.com/kevinthedang/azeroth-dungeon-bot/actions/workflows/deploy.yml">
        <img src="https://github.com/kevinthedang/azeroth-dungeon-bot/actions/workflows/deploy.yml/badge.svg" alt="Deploy">
    </a>
</div>

> [!NOTE]
> Under Active Development unless otherwise noted

> [!NOTE]
> The following background images are not available on ForeverDB yet:
> 1. [x] The Drowned City (Forever)
> 2. [x] Krol'dok Stronghold (Forever)
> 3. [x] Alcaz Prison (Forever)
> 4. [ ] Blackmaw Hold (Forever)
> 5. [x] Shaper's Terrace (Forever)
> 6. [ ] Demon Fall Canyon (Classic)
> 7. [ ] Karazhan Crypts (Classic)

## About
A simple discord bot that takes the input of the people who are going on a raid and tracks how long it takes to go through a particular dungeon in WoW.

## Discord Setup

1. Create or select the bot application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Open **Bot** and enable the required **Privileged Gateway Intents**:
   - **Server Members Intent** is required for guild member lookups.
   - **Message Content Intent** is required only if the bot will read and respond to regular text messages.
3. Add the bot to the server with the `bot` and `applications.commands` scopes.
4. Grant the bot the permissions it needs rather than Administrator:
   - View Channels
   - Send Messages
   - Embed Links
   - Attach Files
   - Read Message History
   - Use Application Commands
5. Copy the application bot token into `.env`:

```env
CLIENT_TOKEN=your-bot-token
```

Do not commit the real token to source control. Restart the bot after changing the Developer Portal intent settings or `.env` token.

## Deployment

Pushing to `master` runs the tests, then automatically deploys to the Raspberry Pi over SSH once they pass. The workflow rebuilds on the Pi, preserves `data/` and `.env`, and restarts the systemd service. See [.github/DEPLOYMENT.md](.github/DEPLOYMENT.md) for one-time Raspberry Pi setup, required GitHub secrets, and rollback instructions.

## Testing
The test suite uses [Vitest](https://vitest.dev/) and never touches the real database or asset folders — each test file runs against an in-memory SQLite database and a temporary asset tree.

```sh
npm test          # single run
npm run test:watch
```

`AZEROTH_DB_PATH` and `AZEROTH_ASSETS_DIR` override the database and asset locations if you need to run the bot or tests against another checkout.

## Slash Commands

| Command | Options | Description |
| --- | --- | --- |
| `/start` | `dungeon` (required autocomplete list), `members` (required) | Starts the dungeon timer for the current channel and lists the party on the run card. `members` accepts comma-separated Discord usernames or mentions. |
| `/add-member` | `user` (required) | Adds a server member to the active run party and updates the run card. |
| `/remove-member` | `member` (required, autocomplete) | Removes a member from the active run party. Autocomplete only lists people currently in the run. |
| `/stop` | — | Stops the active dungeon timer and updates the run card with the finished time. |
| `/extra-note` | `text` (required) | Adds a note to the active run. Repeated calls append to the **Extra Notes** section on the timer card. |
| `/drop` | `boss` (required), `item` (required), `vendored` (required), `member` (required when not vendored) | Records a boss drop. Vendored drops are marked as vendored; otherwise, the command records which active-run party member received the item. |
| `/set-name` | `name` (required), `user` (optional) | Sets the WoW character name shown on run cards for you or another server member. |
| `/clear-name` | `user` (optional) | Clears a member's WoW character name, making the run card use their Discord name again. |
| `/set-role` | `role` (required), `user` (optional) | Sets a WoW party role—Tank, Melee, Ranged, or Healer—for you or another server member. |
| `/clear-sprite` | `user` (optional) | Clears the WoW character sprite for you or another server member. |
| `/set-sprite` | `sprite` (required), `user` (optional) | Sets the character sprite shown on run cards for you or another server member. |
| `/clear` | `dungeon` (required) | Requires **Manage Server** permission. Clears recorded completed and cancelled history for a dungeon without removing active runs. |

## Credit

This is project has been licensed under the [MIT License](https://mit-license.org/) © 2026 by Kevin Dang