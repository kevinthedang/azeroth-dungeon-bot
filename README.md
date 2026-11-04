<div align="center">
    <h1>Azeroth Chronicle</h1>
    <h3>World of Warcraft Dungeon Tracking Discord Bot</h3>
</div>

> [!NOTE]
> Under Active Development unless otherwise noted

## About
A simple discord bot that takes the input of the people who are going on a raid and tracks how long it takes to go through a particular dungeon in WoW.

## Testing
The test suite uses [Vitest](https://vitest.dev/) and never touches the real database or asset folders — each test file runs against an in-memory SQLite database and a temporary asset tree.

```sh
npm test          # single run
npm run test:watch
```

`AZEROTH_DB_PATH` and `AZEROTH_ASSETS_DIR` override the database and asset locations if you need to run the bot or tests against another checkout.

## Credit

This is project has been licensed under the [MIT License](https://mit-license.org/) © 2026 by Kevin Dang