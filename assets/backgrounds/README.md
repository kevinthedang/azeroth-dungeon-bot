# Background assets

Drop dungeon background PNGs into `assets/backgrounds/` named after the slugified
dungeon name:

    assets/backgrounds/the_deadmines.png

Backgrounds are resolved by slug from the dungeon name at `/start` (e.g.
"The Deadmines" → `the_deadmines`) and mapped in `src/core/backgrounds.ts`.
When no background is registered for a dungeon, the embed renders without one.
