import { Clear } from "./clear.js";
import { ClearSprite } from "./clearSprite.js";
import { Pause } from "./pause.js";
import { Resume } from "./resume.js";
import { SetRole } from "./setRole.js";
import { SetSprite } from "./setSprite.js";
import { Start } from "./start.js";
import { Stop } from "./stop.js";
import { SlashCommand } from "../utils/index.js";

export default [
    Clear,
    ClearSprite,
    Pause,
    Resume,
    SetRole,
    SetSprite,
    Start,
    Stop
] as SlashCommand[]
