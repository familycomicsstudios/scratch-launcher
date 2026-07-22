const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("launcher", {

    getGames: () =>
        ipcRenderer.invoke("list-games"),

    launchGame: (name) =>
        ipcRenderer.invoke("launch-game", name),

    saveGameSettings: (name, runtimeSettings) =>
        ipcRenderer.invoke("save-game-settings", name, runtimeSettings),

    downloadProject: (input) =>
        ipcRenderer.invoke("download-project", input),

    getGlobalSettings: () =>
        ipcRenderer.invoke("get-global-settings"),

    saveGlobalSettings: (settings) =>
        ipcRenderer.invoke("save-global-settings", settings)

});