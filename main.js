const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const SBDL = require("@turbowarp/sbdl");

const resourcesDir = app.isPackaged
    ? process.resourcesPath
    : __dirname;

const gamesDir = app.isPackaged
    ? path.join(path.dirname(process.execPath), "games")
    : path.join(__dirname, "games");

const runtimeDir = path.join(resourcesDir, "runtime");
const tempDir = path.join(resourcesDir, "temp");

const DEFAULT_RUNTIME_SETTINGS = {
    turboMode: false,
    interpolation: false,
    framerate: 30,
    highQualityRender: false,
    fencing: true,
    miscLimits: false,
    maxClones: 300,
    compilerEnabled: true,
    warpTimer: false,
    maxTextureDimension: 2048,
    stageWidth: 480,
    stageHeight: 360,
    username: "",
    cloudServer: "",
    resizeMode: "preserve-ratio",
    accentColor: "#ff4c4c",
    editableLists: false,
    gamepad: false,
    pointerlock: false,
    specialCloudBehaviors: false,
    unsafeCloudBehaviors: false,
    pause: false
};

const DEFAULT_GLOBAL_SETTINGS = {
    username: "",
    cloudServer: "wss://clouddata.turbowarp.org"
};

const globalSettingsPath = path.join(gamesDir, "global-settings.json");

function readGlobalSettings() {
    if (!fs.existsSync(globalSettingsPath)) {
        return { ...DEFAULT_GLOBAL_SETTINGS };
    }
    try {
        const parsed = JSON.parse(fs.readFileSync(globalSettingsPath, "utf8"));
        return {
            username: typeof parsed.username === "string" ? parsed.username : DEFAULT_GLOBAL_SETTINGS.username,
            cloudServer: typeof parsed.cloudServer === "string" ? parsed.cloudServer : DEFAULT_GLOBAL_SETTINGS.cloudServer
        };
    } catch (e) {
        return { ...DEFAULT_GLOBAL_SETTINGS };
    }
}

function writeGlobalSettings(settings) {
    const payload = {
        username: typeof settings.username === "string" ? settings.username : "",
        cloudServer: typeof settings.cloudServer === "string" ? settings.cloudServer : "wss://clouddata.turbowarp.org"
    };
    fs.writeFileSync(globalSettingsPath, JSON.stringify(payload, null, 2));
    return payload;
}

function ensureGamesDir() {
    fs.mkdirSync(gamesDir, { recursive: true });
}

function parseScratchProjectId(input) {
    const trimmed = input.trim();
    const match = trimmed.match(/scratch\.mit\.edu\/projects\/(\d+)/);

    if (match) {
        return match[1];
    }

    if (/^\d+$/.test(trimmed)) {
        return trimmed;
    }

    throw new Error("Enter a Scratch project URL or project ID.");
}

function sanitizeFileName(title) {
    const sanitized = title
        .replace(/[<>:"/\\|?*]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    return (sanitized || "project") + ".sb3";
}

function getUniqueFileName(baseName) {
    const ext = path.extname(baseName);
    const stem = path.basename(baseName, ext);
    let candidate = baseName;
    let counter = 2;

    while (fs.existsSync(path.join(gamesDir, candidate))) {
        candidate = `${stem} (${counter})${ext}`;
        counter += 1;
    }

    return candidate;
}

function getGameTitle(gameName) {
    return gameName.replace(/\.sb3$/i, "");
}

function getGameSettingsPath(gameName) {
    const baseName = path.basename(gameName, path.extname(gameName));
    return path.join(gamesDir, `${baseName}.json`);
}

function normalizeBoolean(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
}

function normalizePositiveInteger(value, fallback) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return fallback;
    }

    const parsed = Math.floor(value);
    return parsed > 0 ? parsed : fallback;
}

function normalizeString(value, fallback) {
    return typeof value === "string" ? value : fallback;
}

function normalizeResizeMode(value, fallback) {
    if (value === "preserve-ratio" || value === "stretch" || value === "zoom") {
        return value;
    }
    return fallback;
}

function normalizeRuntimeSettings(input = {}) {
    return {
        turboMode: normalizeBoolean(input.turboMode, DEFAULT_RUNTIME_SETTINGS.turboMode),
        interpolation: normalizeBoolean(input.interpolation, DEFAULT_RUNTIME_SETTINGS.interpolation),
        framerate: normalizePositiveInteger(input.framerate, DEFAULT_RUNTIME_SETTINGS.framerate),
        highQualityRender: normalizeBoolean(input.highQualityRender, DEFAULT_RUNTIME_SETTINGS.highQualityRender),
        fencing: normalizeBoolean(input.fencing, DEFAULT_RUNTIME_SETTINGS.fencing),
        miscLimits: normalizeBoolean(input.miscLimits, DEFAULT_RUNTIME_SETTINGS.miscLimits),
        maxClones: normalizePositiveInteger(input.maxClones, DEFAULT_RUNTIME_SETTINGS.maxClones),
        compilerEnabled: normalizeBoolean(input.compilerEnabled, DEFAULT_RUNTIME_SETTINGS.compilerEnabled),
        warpTimer: normalizeBoolean(input.warpTimer, DEFAULT_RUNTIME_SETTINGS.warpTimer),
        maxTextureDimension: normalizePositiveInteger(input.maxTextureDimension, DEFAULT_RUNTIME_SETTINGS.maxTextureDimension),
        stageWidth: normalizePositiveInteger(input.stageWidth, DEFAULT_RUNTIME_SETTINGS.stageWidth),
        stageHeight: normalizePositiveInteger(input.stageHeight, DEFAULT_RUNTIME_SETTINGS.stageHeight),
        username: normalizeString(input.username, DEFAULT_RUNTIME_SETTINGS.username),
        cloudServer: normalizeString(input.cloudServer, DEFAULT_RUNTIME_SETTINGS.cloudServer),
        resizeMode: normalizeResizeMode(input.resizeMode, DEFAULT_RUNTIME_SETTINGS.resizeMode),
        accentColor: normalizeString(input.accentColor, DEFAULT_RUNTIME_SETTINGS.accentColor),
        editableLists: normalizeBoolean(input.editableLists, DEFAULT_RUNTIME_SETTINGS.editableLists),
        gamepad: normalizeBoolean(input.gamepad, DEFAULT_RUNTIME_SETTINGS.gamepad),
        pointerlock: normalizeBoolean(input.pointerlock, DEFAULT_RUNTIME_SETTINGS.pointerlock),
        specialCloudBehaviors: normalizeBoolean(input.specialCloudBehaviors, DEFAULT_RUNTIME_SETTINGS.specialCloudBehaviors),
        unsafeCloudBehaviors: normalizeBoolean(input.unsafeCloudBehaviors, DEFAULT_RUNTIME_SETTINGS.unsafeCloudBehaviors),
        pause: normalizeBoolean(input.pause, DEFAULT_RUNTIME_SETTINGS.pause)
    };
}

function readGameConfig(gameName) {
    const configPath = getGameSettingsPath(gameName);
    const defaultConfig = {
        title: getGameTitle(gameName),
        fileName: gameName,
        projectId: null,
        runtimeSettings: { ...DEFAULT_RUNTIME_SETTINGS }
    };

    if (!fs.existsSync(configPath)) {
        return defaultConfig;
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));

        return {
            title: parsed.title || defaultConfig.title,
            fileName: parsed.fileName || defaultConfig.fileName,
            projectId: parsed.projectId || null,
            runtimeSettings: normalizeRuntimeSettings(parsed.runtimeSettings || parsed)
        };
    } catch (error) {
        return defaultConfig;
    }
}

function writeGameConfig(gameName, config) {
    const payload = {
        title: config.title || getGameTitle(gameName),
        fileName: gameName,
        projectId: config.projectId || null,
        runtimeSettings: normalizeRuntimeSettings(config.runtimeSettings)
    };

    fs.writeFileSync(
        getGameSettingsPath(gameName),
        JSON.stringify(payload, null, 2)
    );

    return payload;
}

function writeGameMetadata(gameName) {
    const gameConfig = readGameConfig(gameName);
    const globalSettings = readGlobalSettings();

    const resolvedSettings = { ...gameConfig.runtimeSettings };
    
    // Resolve fallback logic: use global settings if not set individually
    if (!resolvedSettings.username) {
        resolvedSettings.username = globalSettings.username || "";
    }
    if (!resolvedSettings.cloudServer) {
        resolvedSettings.cloudServer = globalSettings.cloudServer || "wss://clouddata.turbowarp.org";
    }

    const meta = {
        title: gameConfig.title,
        fileName: gameName,
        projectId: gameConfig.projectId || null,
        runtimeSettings: resolvedSettings
    };

    fs.writeFileSync(
        path.join(runtimeDir, "game-meta.json"),
        JSON.stringify(meta, null, 2)
    );

    return meta;
}

function createLauncher() {
    const win = new BrowserWindow({
        width: 900,
        height: 600,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js")
        },
        icon: path.join(__dirname, "build", "icon.png"),
    });

    win.setMenuBarVisibility(false);

    win.loadFile("launcher.html");
}

app.whenReady().then(() => {
    ensureGamesDir();
    Menu.setApplicationMenu(null);
    createLauncher();
});

ipcMain.handle("list-games", () => {
    ensureGamesDir();

    return fs.readdirSync(gamesDir)
    .filter(file => file.endsWith(".sb3"))
    .map(file => readGameConfig(file));
});

ipcMain.handle("download-project", async (event, input) => {
    ensureGamesDir();

    const projectId = parseScratchProjectId(input);
    let project;

    try {
        project = await SBDL.downloadProjectFromID(projectId);
    } catch (error) {
        if (error && error.name === "CanNotAccessProjectError") {
            throw new Error("Project not found or not shared.");
        }

        throw new Error(
            error.message || "Could not download project. Check the URL and try again."
        );
    }

    const fileName = getUniqueFileName(
        sanitizeFileName(project.title)
    );

    fs.writeFileSync(
        path.join(gamesDir, fileName),
        Buffer.from(project.arrayBuffer)
    );

    writeGameConfig(fileName, {
        title: getGameTitle(fileName),
        projectId: projectId,
        runtimeSettings: DEFAULT_RUNTIME_SETTINGS
    });

    return {
        fileName,
        title: project.title
    };
});

ipcMain.handle("get-global-settings", () => {
    ensureGamesDir();
    return readGlobalSettings();
});

ipcMain.handle("save-global-settings", (event, settings) => {
    ensureGamesDir();
    return writeGlobalSettings(settings);
});

ipcMain.handle("save-game-settings", (event, gameName, runtimeSettings) => {
    ensureGamesDir();

    const gamePath = path.join(gamesDir, gameName);
    if (!fs.existsSync(gamePath)) {
        throw new Error("Game not found.");
    }

    const current = readGameConfig(gameName);
    return writeGameConfig(gameName, {
        title: current.title,
        projectId: current.projectId,
        runtimeSettings
    });
});

ipcMain.handle("launch-game", (event, gameName) => {

    const assetsDir = path.join(runtimeDir, "assets");

    fs.rmSync(tempDir, {
        recursive: true,
        force: true
    });

    fs.mkdirSync(tempDir, {
        recursive: true
    });

    const zip = new AdmZip(
        path.join(gamesDir, gameName)
    );

    zip.extractAllTo(tempDir, true);

    fs.rmSync(assetsDir, {
        recursive: true,
        force: true
    });

    fs.cpSync(tempDir, assetsDir, {
        recursive: true
    });

    const gameMeta = writeGameMetadata(gameName);
    const stageWidth = (gameMeta.runtimeSettings && gameMeta.runtimeSettings.stageWidth) || 480;
    const stageHeight = (gameMeta.runtimeSettings && gameMeta.runtimeSettings.stageHeight) || 360;

    const gameWindow = new BrowserWindow({
        width: stageWidth * 2,
        height: stageHeight * 2,
        title: gameMeta.title,
        autoHideMenuBar: true,
        icon: path.join(resourcesDir, "build", "icon.png"),
    });

    gameWindow.setMenuBarVisibility(false);

    gameWindow.loadFile(
        path.join(runtimeDir, "index.html")
    );
});