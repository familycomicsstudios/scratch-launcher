const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

const gamesDir = path.join(__dirname, "games");

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
        icon: path.join(__dirname, "build", "icon.ico"),
    });

    win.setMenuBarVisibility(false);

    win.loadFile("launcher.html");
}

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createLauncher();
});

ipcMain.handle("list-games", () => {
    return fs.readdirSync(gamesDir)
        .filter(file => file.endsWith(".sb3"));
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
        icon: path.join(__dirname, "build", "icon.ico"),
    });

    gameWindow.setMenuBarVisibility(false);

    gameWindow.loadFile(
        path.join(__dirname, "runtime", "index.html")
    );
});