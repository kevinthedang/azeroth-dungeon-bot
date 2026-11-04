# Background assets

Drop dungeon background PNGs into `assets/backgrounds/` named after the slugified
dungeon name:

    assets/backgrounds/the_deadmines.png

Backgrounds are resolved by slug from the dungeon name at `/start` (e.g.
"The Deadmines" → `the_deadmines`). Files are picked up directly — no upload or
restart needed — and a hosted URL registered in `src/core/backgrounds.ts` is used
as a fallback if no matching file exists.

If a dungeon has no art of its own, `assets/backgrounds/default.png` is used, so
every run still gets a run card. Only when no default exists either does the run
render without an image.
