const urlInput = document.getElementById("project-url");
const downloadBtn = document.getElementById("download-btn");
const downloadStatus = document.getElementById("download-status");

function setDownloadStatus(message, type) {
    downloadStatus.textContent = message;
    downloadStatus.className = type || "";
}

async function loadGames() {
    const games = await window.launcher.getGames();
    const container = document.getElementById("games");

    container.innerHTML = "";

    games.forEach(game => {
        const div = document.createElement("div");

        div.className = "game";
        div.textContent = game.replace(".sb3", "");
        div.onclick = () => {
            window.launcher.launchGame(game);
        };

        container.appendChild(div);
    });
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

downloadBtn.addEventListener("click", downloadProject);

urlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        downloadProject();
    }
});

loadGames();
