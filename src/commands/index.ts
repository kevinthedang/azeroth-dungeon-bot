import { Clear } from "./clear.js";
import { ClearName } from "./clearName.js";
import { ClearSprite } from "./clearSprite.js";
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
    SetName,
    SetRole,
    SetSprite,
    Start,
    Stop
] as SlashCommand[]
