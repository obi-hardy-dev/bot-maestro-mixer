import { CommandInteraction } from "discord.js";
import { getOptionValue } from "./utils/Interaction"

export type Track = {
    name?: string,
    url: string ,
    trackName?: string,
    volume?: number,
}


export function CreateTrack(interaction: CommandInteraction) : Track {

    const name: string | undefined = getOptionValue<string>(interaction, 'name');
    const volume: number | undefined = getOptionValue<number>(interaction, 'volume');
    const songUrl: string | undefined = getOptionValue<string>(interaction, 'url');
    

    const newTrack = { url: songUrl, name: name, volume: volume } as Track;

    return newTrack;
}
