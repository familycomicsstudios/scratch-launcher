const urlInput = document.getElementById("project-url");
const downloadBtn = document.getElementById("download-btn");
const downloadStatus = document.getElementById("download-status");
const settingsModal = document.getElementById("settings-modal");
const settingsTitle = document.getElementById("settings-title");
const settingsForm = document.getElementById("settings-form");
const settingsStatus = document.getElementById("settings-status");
const closeSettingsBtn = document.getElementById("close-settings");

const globalSettingsBtn = document.getElementById("global-settings-btn");
const globalSettingsModal = document.getElementById("global-settings-modal");
const globalSettingsForm = document.getElementById("global-settings-form");
const globalSettingsStatus = document.getElementById("global-settings-status");
const closeGlobalSettingsBtn = document.getElementById("close-global-settings");

let gamesCache = [];
let activeGameName = null;

const runtimeFields = [
    "turboMode",
    "interpolation",
    "framerate",
    "highQualityRender",
    "fencing",
    "miscLimits",
    "maxClones",
    "compilerEnabled",
    "warpTimer",
    "maxTextureDimension",
    "stageWidth",
    "stageHeight",
    "username",
    "cloudServer",
    "resizeMode",
    "accentColor",
    "editableLists",
    "gamepad",
    "pointerlock",
    "specialCloudBehaviors",
    "unsafeCloudBehaviors",
    "pause"
];

function setDownloadStatus(message, type) {
    downloadStatus.textContent = message;
    downloadStatus.className = type || "";
}

function setSettingsStatus(message, type) {
    settingsStatus.textContent = message;
    settingsStatus.className = type || "";
}

function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

async function loadGames() {
    const games = await window.launcher.getGames();
    const container = document.getElementById("games");
    gamesCache = games;

    container.innerHTML = "";

    games.forEach(game => {
        const div = document.createElement("div");
        const title = escapeHtml(game.title);

        div.className = "game";
        div.innerHTML = `
            <div class="game-name">${title}</div>
            <div class="game-actions">
                <button type="button" class="launch-btn">Launch</button>
                <button type="button" class="settings-btn">Settings</button>
            </div>
        `;

        div.querySelector(".launch-btn").addEventListener("click", () => {
            window.launcher.launchGame(game.fileName);
        });

        div.querySelector(".settings-btn").addEventListener("click", () => {
            openSettings(game.fileName);
        });

        container.appendChild(div);
    });
}

function openSettings(fileName) {
    const game = gamesCache.find(item => item.fileName === fileName);
    if (!game) {
        return;
    }

    activeGameName = fileName;
    settingsTitle.textContent = `Settings - ${game.title}`;
    setSettingsStatus("", "");

    const settings = game.runtimeSettings || {};
    runtimeFields.forEach((field) => {
        const input = settingsForm.elements[field];
        if (!input) {
            return;
        }

        if (input.type === "checkbox") {
            input.checked = !!settings[field];
        } else {
            input.value = settings[field];
        }
    });

    settingsModal.hidden = false;
}

function closeSettings() {
    settingsModal.hidden = true;
    activeGameName = null;
    setSettingsStatus("", "");
}

function getFormSettings() {
    const settings = {};

    runtimeFields.forEach((field) => {
        const input = settingsForm.elements[field];
        if (!input) {
            return;
        }

        if (input.type === "checkbox") {
            settings[field] = input.checked;
        } else if (input.type === "number") {
            settings[field] = Number(input.value);
        } else {
            settings[field] = input.value;
        }
    });

    return settings;
}

async function saveSettings(event) {
    event.preventDefault();

    if (!activeGameName) {
        setSettingsStatus("No game selected.", "error");
        return;
    }

    const submitBtn = document.getElementById("save-settings");
    const settings = getFormSettings();

    submitBtn.disabled = true;
    setSettingsStatus("Saving...", "");

    try {
        await window.launcher.saveGameSettings(activeGameName, settings);
        setSettingsStatus("Saved.", "success");
        await loadGames();
    } catch (error) {
        setSettingsStatus(error.message || "Could not save settings.", "error");
    } finally {
        submitBtn.disabled = false;
    }
}

async function downloadProject() {
    const input = urlInput.value.trim();

    if (!input) {
        setDownloadStatus("Enter a Scratch project URL or ID.", "error");
        return;
    }

    downloadBtn.disabled = true;
    setDownloadStatus("Downloading...", "");

    try {
        const result = await window.launcher.downloadProject(input);

        urlInput.value = "";
        setDownloadStatus(`Saved ${result.fileName}`, "success");
        await loadGames();
    } catch (error) {
        setDownloadStatus(error.message || "Download failed.", "error");
    } finally {
        downloadBtn.disabled = false;
    }
}

function setGlobalSettingsStatus(message, type) {
    globalSettingsStatus.textContent = message;
    globalSettingsStatus.className = type || "";
}

async function openGlobalSettings() {
    setGlobalSettingsStatus("", "");
    try {
        const settings = await window.launcher.getGlobalSettings();
        globalSettingsForm.elements["username"].value = settings.username || "";
        globalSettingsForm.elements["cloudServer"].value = settings.cloudServer || "";
        globalSettingsModal.hidden = false;
    } catch (error) {
        setGlobalSettingsStatus(error.message || "Could not load global settings.", "error");
        globalSettingsModal.hidden = false;
    }
}

function closeGlobalSettings() {
    globalSettingsModal.hidden = true;
    setGlobalSettingsStatus("", "");
}

async function saveGlobalSettings(event) {
    event.preventDefault();
    const submitBtn = document.getElementById("save-global-settings");
    const settings = {
        username: globalSettingsForm.elements["username"].value.trim(),
        cloudServer: globalSettingsForm.elements["cloudServer"].value.trim()
    };

    submitBtn.disabled = true;
    setGlobalSettingsStatus("Saving...", "");

    try {
        await window.launcher.saveGlobalSettings(settings);
        setGlobalSettingsStatus("Saved.", "success");
        setTimeout(closeGlobalSettings, 800);
    } catch (error) {
        setGlobalSettingsStatus(error.message || "Could not save global settings.", "error");
    } finally {
        submitBtn.disabled = false;
    }
}

downloadBtn.addEventListener("click", downloadProject);
closeSettingsBtn.addEventListener("click", closeSettings);
settingsModal.addEventListener("click", (event) => {
    if (event.target === settingsModal) {
        closeSettings();
    }
});
settingsForm.addEventListener("submit", saveSettings);

globalSettingsBtn.addEventListener("click", openGlobalSettings);
closeGlobalSettingsBtn.addEventListener("click", closeGlobalSettings);
globalSettingsModal.addEventListener("click", (event) => {
    if (event.target === globalSettingsModal) {
        closeGlobalSettings();
    }
});
globalSettingsForm.addEventListener("submit", saveGlobalSettings);

urlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        downloadProject();
    }
});

loadGames();
