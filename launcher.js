async function loadGames() {

    const games = await window.launcher.getGames();

    const container =
        document.getElementById("games");

    container.innerHTML = "";

    games.forEach(game => {

        const div =
            document.createElement("div");

        div.className = "game";

        div.textContent =
            game.replace(".sb3", "");

        div.onclick = () => {
            window.launcher.launchGame(game);
        };

        container.appendChild(div);
    });
}

loadGames();