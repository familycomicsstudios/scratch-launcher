const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("launcher", {

    getGames: () =>
        ipcRenderer.invoke("list-games"),

    launchGame: (name) =>
        ipcRenderer.invoke("launch-game", name)

});