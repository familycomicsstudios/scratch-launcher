const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("launcher", {

    getGames: () =>
        ipcRenderer.invoke("list-games"),

    launchGame: (name) =>
        ipcRenderer.invoke("launch-game", name),

    downloadProject: (input) =>
        ipcRenderer.invoke("download-project", input)

});