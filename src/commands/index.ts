import { Clear } from "./clear.js";
import { ClearName } from "./clearName.js";
import { ClearSprite } from "./clearSprite.js";
import { AddMember } from "./addMember.js";
import { Drop } from "./drop.js";
import { ExtraNote } from "./extraNote.js";
import { RemoveMember } from "./removeMember.js";
import { SetName } from "./setName.js";
import { SetRole } from "./setRole.js";
import { SetSprite } from "./setSprite.js";
import { SetChannel } from "./setChannel.js";
import { Start } from "./start.js";
import { Stop } from "./stop.js";
import { createHelpCommand } from "./help.js";
import { SlashCommand } from "../utils/index.js";

const baseCommands = [
    AddMember,
    Clear,
    ClearName,
    ClearSprite,
    Drop,
    ExtraNote,
    RemoveMember,
    SetName,
    SetRole,
    SetSprite,
    SetChannel,
    Start,
    Stop
] as SlashCommand[]

export const Help = createHelpCommand(baseCommands)

export default [...baseCommands, Help]
