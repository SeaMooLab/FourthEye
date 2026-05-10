import { ChannelType } from "discord.js";
//Based on the state loop through the channels and delete empty ones when no longer active
export function checkAndDeleteEmptyChannels(guild) {
    guild.channels.cache.forEach((channel) => {
        if (channel.type === ChannelType.GuildVoice && channel.name.startsWith("v")) {
            // Check if the channel is empty
            if (channel.members.size === 0) {
                // Delete the empty channel
                channel
                    .delete()
                    .then(() => {
                    console.log(`Deleted voice channel: ${channel.name}`);
                })
                    .catch(console.error);
            }
        }
    });
}
