import { readFileSync, writeFileSync } from "fs";
import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import { createClient } from "bedrock-protocol";
import config from "./config.js";
import { setupDeathListener } from "./death_listener/deathMessage.js";
import { addPlayerListener } from "./player_device_listener/playerDeviceLogging.js";
import { setupSystemCommandsListener } from "./system_commands_listener/systemCommandsLogging.js";
import { setupVoiceChatListener } from "./voiceChat_listener/voiceChat.js";
import { checkAndDeleteEmptyChannels } from "./voiceChat_listener/voiceChatCleanUp.js";
import { idList } from "./badActors.js";

const { MessageContent, GuildMessages, Guilds, GuildVoiceStates } = GatewayIntentBits;

export const correction = {
    "§4P": "P",
    "§l": "",
    "§r": "",
    "§a": "",
    "§b": "",
    "§c": "",
    "§d": "",
    "§f": "",
    "§9": "",
    "§8": "",
    "§7": "",
    "§6": "",
    "§5": "",
    "§4": "",
    "§3": "",
    "§2": "",
    "§1": "",
    "§0": "",
    "§o": "",
    "§k": "",
    "§¶": "",
    "§r§6[§aScythe§6]§r": ""
};

let whitelistRead = JSON.parse(readFileSync("whitelist.json", "utf-8"));
let inGameChannel = null;
let systemCommandsChannel = null;
let bot = null;

const discordClient = new Client({ intents: [Guilds, GuildMessages, MessageContent, GuildVoiceStates] });

console.log("ThirdEye v1.0.12 - no cheats / no Paradox build / PartialReadError suppressed");

const botOptions = config.isRealm
    ? {
        profilesFolder: "authentication_tokens",
        realms: { realmInvite: config.realmInviteCode }
    }
    : {
        host: config.ip,
        port: config.port,
        username: config.username,
        offline: config.AuthType,
        profilesFolder: "authentication_tokens"
    };

if (typeof config.bedrockVersion === "string" && config.bedrockVersion.trim() !== "") {
    botOptions.version = config.bedrockVersion.trim();
}

if (config.skipServerPing === true) {
    botOptions.skipPing = true;
}

console.log(`Using Bedrock protocol version: ${botOptions.version ?? "auto"}`);
console.log(`Server ping before connect: ${config.skipServerPing === true ? "disabled" : "enabled"}`);

bot = createClient(botOptions);

discordClient.login(config.token);

discordClient.once("clientReady", client => {
    console.log(`Discord bot logged in as ${client.user.tag}`);

    inGameChannel = discordClient.channels.cache.get(config.channel) ?? null;

    if (inGameChannel) {
        setupDeathListener(bot, inGameChannel);
        addPlayerListener(bot, inGameChannel, whitelistRead);
        sendDiscordStatus("[ThirdEye]: Discord bridge is online.");
    } else {
        console.log("I could not find the in-game channel in Discord. Check config.channel.");
    }

    if (config.logSystemCommands === true && config.systemCommandsChannel) {
        systemCommandsChannel = discordClient.channels.cache.get(config.systemCommandsChannel) ?? null;

        if (systemCommandsChannel) {
            setupSystemCommandsListener(bot, systemCommandsChannel);
        } else {
            console.log("I could not find the systemLogs channel in Discord. Check config.systemCommandsChannel.");
        }
    }

    const guild = discordClient.guilds.cache.get(config.guild);

    if (guild) {
        console.log(`Found guild: ${guild.name}`);
        setupVoiceChatListener(bot, guild);
    } else {
        console.log(`Guild with ID ${config.guild} not found. Voice channel features are disabled.`);
    }
});

discordClient.on("messageCreate", message => {
    if (message.author.bot) {
        return;
    }

    const admins = Array.isArray(config.admins) ? config.admins : [];
    const isAdmin = admins.includes(message.author.id);

    if (message.content === "$reconnect" && isAdmin) {
        console.log("Reconnect requested from Discord admin.");
        process.exit(0);
    }

    if (message.content.startsWith("$-r") && isAdmin) {
        const name = message.content.replace("$-r", "").trim();
        whitelistRead.whitelist = whitelistRead.whitelist.filter(playerName => playerName !== name);
        writeFileSync("whitelist.json", JSON.stringify(whitelistRead, null, 2), "utf-8");
        message.reply(`Removed ${name} from whitelist.`).catch(console.error);
        return;
    }

    if (message.content.startsWith("$") && isAdmin) {
        const name = message.content.replace("$", "").trim();
        whitelistRead.whitelist.push(name);
        writeFileSync("whitelist.json", JSON.stringify(whitelistRead, null, 2), "utf-8");
        message.reply(`Added ${name} to whitelist.`).catch(console.error);
        return;
    }

    if (message.content.startsWith(config.cmdPrefix)) {
        console.log(`Blocked command because no-cheats mode is enabled: ${message.content} From: ${message.author.id}`);
        return;
    }

    if (!inGameChannel || message.channel.id !== inGameChannel.id) {
        return;
    }

    const tag = idList.includes(message.author.id) ? " (Known Hacker/Troll)" : "";
    runText(`[Discord] ${message.author.username}${tag}: ${message.content}`);
});

discordClient.on("voiceStateUpdate", newState => {
    checkAndDeleteEmptyChannels(newState.guild);
});

bot.on("login", () => {
    console.log("Client has been authenticated by the server.");
});

bot.on("join", () => {
    console.log("The client is ready to receive game packets.");
});

bot.on("spawn", () => {
    console.log(`Bedrock bot logged in as ${config.username}`);
    sendDiscordStatus("[ThirdEye]: Client is logged in.");
});

bot.on("disconnect", packet => {
    const message = packet?.message ?? packet?.reason ?? "";
    console.log("Server requested disconnect:", message || "(blank disconnect reason)");

    if (config.debug === true) {
        try {
            console.log("Raw disconnect packet:", JSON.stringify(packet, null, 2));
        } catch {
            console.log("Raw disconnect packet could not be stringified.");
        }
    }
});

bot.on("close", () => {
    console.log("The server has closed the connection.");
    console.log(`Client disconnected. Entity ID: ${bot?.entityId ?? "not spawned yet"}`);
});

bot.on("error", error => {
    if (error?.partialReadError === true || error?.name === "PartialReadError" || String(error?.stack ?? error).includes("PartialReadError")) {
        if (config.debug === true) {
            console.log("Ignored harmless Bedrock PartialReadError packet decode issue.");
        }

        return;
    }

    console.error("Minecraft connection error:", error);
});

bot.on("text", packet => {
    handleMinecraftText(packet);
});

if (config.debug === true) {
    bot.on("packet", packet => {
        console.log(packet);
    });
}

function handleMinecraftText(packet) {
    if (!inGameChannel) {
        return;
    }

    if (packet.type === "chat") {
        if (!packet.message || packet.message.includes("Discord")) {
            return;
        }

        sendInGameMessage(`${packet.source_name}: ${packet.message}`);
        return;
    }

    if (packet.type === "json") {
        try {
            const obj = JSON.parse(packet.message);
            const rawText = obj?.rawtext?.[0]?.text;

            if (!rawText || rawText.includes("Discord")) {
                return;
            }

            if (obj.rawtext[0].translate) {
                return;
            }

            if (rawText.includes("§2[§7Available Commands§2]§r")) {
                return;
            }

            sendInGameMessage(autoCorrect(rawText, correction));
        } catch (error) {
            if (config.debug === true) {
                console.error("Could not parse Minecraft JSON text packet:", error);
            }
        }

        return;
    }

    if (packet.message?.includes("§e%multiplayer.player.left")) {
        sendInGameMessage(`${packet.parameters}: Has left the server.`, [255, 0, 0]);
        return;
    }

    if (config.useSystemPlayerJoinMessage === true && packet.message?.includes("§e%multiplayer.player.joined")) {
        sendInGameMessage(`${packet.parameters}: Has joined the server.`, [0, 255, 0]);
    }
}

function sendDiscordStatus(description) {
    if (!inGameChannel) {
        return;
    }

    if (config.useEmbed === true) {
        const embed = new EmbedBuilder().setColor(config.setColor).setTitle(config.setTitle).setDescription(description).setAuthor({ name: "‎", iconURL: config.logoURL });
        inGameChannel.send({ embeds: [embed] }).catch(console.error);
        return;
    }

    inGameChannel.send(description).catch(console.error);
}

function sendInGameMessage(description, color = config.setColor) {
    if (!inGameChannel) {
        console.log("I could not find the in-game channel in Discord.");
        return;
    }

    if (config.useEmbed === true) {
        const embed = new EmbedBuilder().setColor(color).setTitle(config.setTitle).setDescription(`[In Game] ${description}`).setAuthor({ name: "‎", iconURL: config.logoURL });
        inGameChannel.send({ embeds: [embed] }).catch(console.error);
        return;
    }

    inGameChannel.send(`[In Game] ${description}`).catch(console.error);
}

export function autoCorrect(text, map) {
    const pattern = new RegExp(Object.keys(map).map(escapeRegExp).join("|"), "g");
    return text.replace(pattern, matched => map[matched]);
}

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function runCMD(command) {
    console.log(`Blocked command_request because no-cheats mode is enabled: ${command}`);
}

function runText(message) {
    bot.queue("text", {
        needs_translation: false,
        category: "authored",
        chat: "chat",
        whisper: "whisper",
        announcement: "announcement",
        type: "chat",
        source_name: config.username,
        message,
        xuid: "",
        platform_chat_id: "",
        has_filtered_message: false
    });
}