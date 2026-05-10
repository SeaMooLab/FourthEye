import { EmbedBuilder } from "discord.js";
import config from "../config.js";
import { runCMD } from "../main.js";
/* Add to prevent the message being spammed this will allow the blacklist to work,
it seems that when a player leaves the range of the bot account
and returns it sends the message again.
*/
const Debug = false;
export function addPlayerListener(bot, channelId, WhitelistRead) {
    const Whitelist = WhitelistRead.whitelist;
    bot.on("add_player", (packet) => {
        const deviceOS = getDeviceName(packet.device_os);
        const gameDescription = `[In Game] ${packet.username}: Has joined the server using ${deviceOS}`;
        let description = gameDescription;
        if (config.blacklistDeviceTypes.includes(packet.device_os) && !Whitelist.includes(packet.username)) {
            const cmd = `/kick ${packet.username} device is blacklisted.`;
            runCMD(cmd);
            description = `[Server] ${packet.username}: Has been kicked as the device has been blacklisted: ${packet.device_os}`;
        }
        if (Debug === true) {
            if (config.useEmbed === true) {
                const msgEmbed = new EmbedBuilder().setColor([0, 255, 0]).setTitle(config.setTitle).setDescription(description).setAuthor({ name: "‎", iconURL: config.logoURL });
                sendToChannel(channelId, { embeds: [msgEmbed] }, "I could not find the in-game channel in Discord. 2");
            }
            else {
                sendToChannel(channelId, description, "I could not find the in-game channel in Discord. 3");
            }
        }
    });
}
function sendToChannel(channelId, content, errorMessage) {
    if (typeof channelId === "object") {
        channelId.send(content);
    }
    else {
        console.log(errorMessage);
    }
}
function getDeviceName(deviceOS) {
    switch (deviceOS) {
        case "Win10":
            return "Windows PC";
        case "IOS":
            return "Apple Device";
        case "Nintendo":
            return "Nintendo Switch";
        case "Android":
            return "Android";
        case "Orbis":
            return "PlayStation";
        default:
            console.log("DeviceOS defaulted to packet.device_os");
            return deviceOS;
    }
}
