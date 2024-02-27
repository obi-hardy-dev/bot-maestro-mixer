import { CommandInteraction, GuildMember, VoiceBasedChannel } from "discord.js";
import { Connection } from "../ConnectionManager";
import { connectionManagerInstance as connectionManager } from "../index"

export function getOptionValue<T>(interaction: CommandInteraction, name: string) : T | undefined{
    const option = interaction.options.get(name);

    return option ? option.value as T : undefined;
}

export function getVoiceBasedChannel(interaction: CommandInteraction) : VoiceBasedChannel {
    const member = interaction.member as GuildMember;//|| await interaction.guild.members.fetch(interaction.user.id);
    const channel = member?.voice.channel;
    if(!channel || !channel.isVoiceBased) {
        throw new Error(`Must be in a voice channel to use this request`);
    }
    return channel;
}
export function getConnection(interaction: CommandInteraction) : Connection {
    try{
        const guild = interaction.guild!;
        const channel = getVoiceBasedChannel(interaction)!;
        return connectionManager.connect(guild, channel);
    } catch(error) {
        let errorMsg = "Error occurred.";
        if(error instanceof Error){
            errorMsg = error.message;
        }
        console.log(errorMsg);    
        throw new Error(errorMsg);
    } 
}
