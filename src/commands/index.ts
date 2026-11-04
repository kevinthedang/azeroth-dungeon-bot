import { Clear } from "./clear.js";
import { ClearName } from "./clearName.js";
import { ClearSprite } from "./clearSprite.js";
import { Pause } from "./pause.js";
import { Resume } from "./resume.js";
import { SetName } from "./setName.js";
import { SetRole } from "./setRole.js";
import { SetSprite } from "./setSprite.js";
import { Start } from "./start.js";
import { Stop } from "./stop.js";
import { SlashCommand } from "../utils/index.js";

export default [
    Clear,
    ClearName,
    ClearSprite,
    Pause,
    Resume,
    SetName,
    SetRole,
    SetSprite,
    Start,
    Stop
] as SlashCommand[]
