/* global kiwi:true */

const DEFAULT_GAME_CFG = { enabled: true, button: true, command: true };

/**
 * Coerce config flags. Treats false / "false" / 0 / "0" as disabled.
 * Missing / unknown values fall back to `defaultValue`.
 */
export function coerceBool(value, defaultValue = true) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    if (value === false || value === 0 || value === '0') return false;
    if (typeof value === 'string' && value.toLowerCase() === 'false') return false;
    if (value === true || value === 1 || value === '1') return true;
    if (typeof value === 'string' && value.toLowerCase() === 'true') return true;
    return Boolean(value);
}

/**
 * Plugin runtime settings.
 * Accepts both documented `plugin_kiwi_games` and Kiwi-convention `kiwi-games`
 * (config key matching kiwi.plugin('kiwi-games', ...)).
 */
export function getPluginSettings() {
    const root = (kiwi.state && kiwi.state.settings) || {};
    const primary = root.plugin_kiwi_games;
    const legacy = root['kiwi-games'];

    if (primary && typeof primary === 'object' && legacy && typeof legacy === 'object') {
        return { ...legacy, ...primary };
    }
    if (primary && typeof primary === 'object') return primary;
    if (legacy && typeof legacy === 'object') return legacy;
    return {};
}

/**
 * Resolve per-game runtime config.
 * `"pictionary": false` disables the game entirely.
 */
export function getGameConfig(gameId, settings) {
    const all = settings || getPluginSettings();
    const raw = all[gameId];

    if (raw === false || raw === 0 || raw === 'false' || raw === '0') {
        return { enabled: false, button: false, command: false };
    }

    const merged = {
        ...DEFAULT_GAME_CFG,
        ...(raw && typeof raw === 'object' ? raw : {}),
    };

    return {
        enabled: coerceBool(merged.enabled, true),
        button: coerceBool(merged.button, true),
        command: coerceBool(merged.command, true),
        ...Object.keys(merged).reduce((acc, key) => {
            if (key === 'enabled' || key === 'button' || key === 'command') return acc;
            acc[key] = merged[key];
            return acc;
        }, {}),
    };
}

export function isGameEnabled(gameId, settings) {
    return getGameConfig(gameId, settings).enabled;
}
