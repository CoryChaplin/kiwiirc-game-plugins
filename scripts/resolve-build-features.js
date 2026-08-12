const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEFAULT_CONFIG_PATH = path.join(ROOT, 'build.config.json');

const KNOWN_GAMES = ['tictactoe', 'connectfour', 'pictionary', 'battleship', 'chess'];

function resolveBuildFeatures(env = {}) {
    const configPath = env.config
        ? path.resolve(process.cwd(), env.config)
        : DEFAULT_CONFIG_PATH;

    if (!fs.existsSync(configPath)) {
        throw new Error(`[kiwi-games] Build config not found: ${configPath}`);
    }

    const raw = JSON.parse(
        fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '')
    );
    const games = {};
    for (const id of KNOWN_GAMES) {
        games[id] = raw.games && raw.games[id] === false ? false : true;
    }

    const excludeList = parseList(env.exclude);
    for (const id of excludeList) {
        if (!KNOWN_GAMES.includes(id)) {
            console.warn(`[kiwi-games] unknown exclude ignored: "${id}"`);
            continue;
        }
        games[id] = false;
    }

    const includeList = parseList(env.include);
    for (const id of includeList) {
        if (!KNOWN_GAMES.includes(id)) {
            console.warn(`[kiwi-games] unknown include ignored: "${id}"`);
            continue;
        }
        games[id] = true;
    }

    return { games };
}

function parseList(value) {
    if (!value) return [];
    const parts = Array.isArray(value) ? value : [value];
    return parts
        .flatMap((v) => String(v).split(/[,;\s]+/))
        .map((s) => s.trim())
        .filter(Boolean);
}

function logBuildFeatures(features) {
    const enabled = KNOWN_GAMES.filter((id) => features.games[id]);
    const disabled = KNOWN_GAMES.filter((id) => !features.games[id]);
    console.log('[kiwi-games] Build features:');
    console.log(`  games:    ${enabled.length ? enabled.join(', ') : '(none)'}`);
    if (disabled.length) {
        console.log(`  excluded: ${disabled.join(', ')}`);
    }
}

function buildDefinePluginEntries(features) {
    const defs = {};
    for (const id of KNOWN_GAMES) {
        const key = `__KIWI_BUILD_GAME_${id.toUpperCase()}__`;
        defs[key] = JSON.stringify(!!features.games[id]);
    }
    return defs;
}

module.exports = {
    KNOWN_GAMES,
    resolveBuildFeatures,
    logBuildFeatures,
    buildDefinePluginEntries,
};
