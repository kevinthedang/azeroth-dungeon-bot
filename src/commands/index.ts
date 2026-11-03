import { Clear } from "./clear.js";
import { Pause } from "./pause.js";
import { Resume } from "./resume.js";
import { SetRole } from "./setRole.js";
import { Start } from "./start.js";
import { Stop } from "./stop.js";
import { SlashCommand } from "../utils/index.js";

export default [
    Clear,
    Pause,
    Resume,
    SetRole,
    Start,
    Stop
] as SlashCommand[]
