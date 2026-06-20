const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const SBDL = require("@turbowarp/sbdl");

const gamesDir = app.isPackaged
    ? path.join(path.dirname(process.execPath), "games")
    : path.join(__dirname, "games");

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

function writeGameMetadata(gameName) {
    const title = getGameTitle(gameName);
    const meta = {
        title,
        fileName: gameName
    };

    fs.writeFileSync(
        path.join(__dirname, "runtime", "game-meta.json"),
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
        .filter(file => file.endsWith(".sb3"));
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

    return {
        fileName,
        title: project.title
    };
});

ipcMain.handle("launch-game", (event, gameName) => {

    const tempDir = path.join(__dirname, "temp");
    const assetsDir = path.join(__dirname, "runtime", "assets");

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

    const gameWindow = new BrowserWindow({
        width: 960,
        height: 720,
        title: gameMeta.title,
        autoHideMenuBar: true,
        icon: path.join(__dirname, "build", "icon.png"),
    });

    gameWindow.setMenuBarVisibility(false);

    gameWindow.loadFile(
        path.join(__dirname, "runtime", "index.html")
    );
});