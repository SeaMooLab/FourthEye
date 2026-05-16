import { EmbedBuilder } from "discord.js";
import config from "../config.js";
import { runCMD } from "../main.js";

/**
 * Prevent duplicate join messages caused by Bedrock player re-syncs.
 */
const recentPlayers = new Set();

/**
 * Toggle extra console debugging.
 */
const Debug = false;

/**
 * Handles Bedrock player join events.
 * @param {object} bot
 * @param {object|string} channelId
 * @param {object} WhitelistRead
 */
export function addPlayerListener(bot, channelId, WhitelistRead) {
    const whitelist = Array.isArray(WhitelistRead?.whitelist) ? WhitelistRead.whitelist : [];
    const blacklistDeviceTypes = getBlacklistDeviceTypes();

    bot.on("add_player", (packet) => {
        if (!packet?.username) return;

        if (recentPlayers.has(packet.username)) return;

        recentPlayers.add(packet.username);

        setTimeout(() => {
            recentPlayers.delete(packet.username);
        }, 5000);

        const rawDeviceOS = packet.device_os || "Unknown";
        const deviceOS = getDeviceName(rawDeviceOS);

        let description = `[In Game] ${packet.username}: Has joined the server using ${deviceOS}`;

        if (
            isDeviceBlacklisted(rawDeviceOS, deviceOS, blacklistDeviceTypes) &&
            !whitelist.includes(packet.username)
        ) {
            const cmd = `/kick "${packet.username}" Device is blacklisted.`;

            runCMD(cmd);

            description = `[Server] ${packet.username}: Has been kicked because their device is blacklisted (${deviceOS})`;
        }

        if (config.useEmbed === true) {
            const msgEmbed = new EmbedBuilder()
                .setColor([0, 255, 0])
                .setTitle(config.setTitle)
                .setDescription(description)
                .setAuthor({
                    name: "‎",
                    iconURL: config.logoURL
                })
                .setTimestamp();

            sendToChannel(
                channelId,
                { embeds: [msgEmbed] },
                "Could not find the Discord channel for join messages."
            );
        } else {
            sendToChannel(
                channelId,
                description,
                "Could not find the Discord channel for join messages."
            );
        }

        if (Debug) {
            console.log(`[DEBUG] Player joined: ${packet.username} (${rawDeviceOS} / ${deviceOS})`);
        }
    });
}

/**
 * Reads configured blacklisted Bedrock device types safely.
 * @returns {string[]}
 */
function getBlacklistDeviceTypes() {
    if (Array.isArray(config.blacklistDeviceTypes)) {
        return config.blacklistDeviceTypes;
    }

    console.warn("[FourthEye] config.blacklistDeviceTypes is missing or invalid. Using an empty blacklist.");

    return [];
}

/**
 * Checks whether a Bedrock device type is blacklisted.
 * @param {string} rawDeviceOS
 * @param {string} deviceOS
 * @param {string[]} blacklistDeviceTypes
 * @returns {boolean}
 */
function isDeviceBlacklisted(rawDeviceOS, deviceOS, blacklistDeviceTypes) {
    return blacklistDeviceTypes.some((blacklistedDevice) => {
        return normalizeDeviceName(blacklistedDevice) === normalizeDeviceName(rawDeviceOS) ||
            normalizeDeviceName(blacklistedDevice) === normalizeDeviceName(deviceOS);
    });
}

/**
 * Normalizes device names for forgiving config comparisons.
 * @param {string} value
 * @returns {string}
 */
function normalizeDeviceName(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

/**
 * Sends a message to a Discord channel safely.
 * @param {object|string} channelId
 * @param {object|string} content
 * @param {string} errorMessage
 */
function sendToChannel(channelId, content, errorMessage) {
    if (channelId && typeof channelId.send === "function") {
        channelId.send(content).catch((err) => {
            console.error("Failed to send Discord message:", err);
        });
    } else {
        console.log(errorMessage);
    }
}

/**
 * Converts Bedrock device identifiers into readable names.
 * @param {string} deviceOS
 * @returns {string}
 */
function getDeviceName(deviceOS) {
    switch (deviceOS) {
        case "Win10":
        case "Win32":
        case "Windows":
            return "Windows PC";

        case "IOS":
        case "iOS":
            return "Apple Device";

        case "OSX":
        case "macOS":
            return "macOS";

        case "Android":
            return "Android Device";

        case "Nintendo":
        case "NX":
            return "Nintendo Switch";

        case "Orbis":
        case "PlayStation":
            return "PlayStation";

        case "Xbox":
            return "Xbox";

        case "Linux":
            return "Linux";

        case "Unknown":
            return "Unknown Device";

        default:
            console.log(`Unknown deviceOS detected: ${deviceOS}`);
            return deviceOS || "Unknown Device";
    }
}
