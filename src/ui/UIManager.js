import { ChatOverlay } from "./components/ChatOverlay.js";
import { DuckAvatar } from "./components/DuckAvatar.js";

export class UIManager {
    constructor() {
        this.panels = {
            start: document.getElementById("start-panel"),
            lobby: document.getElementById("lobby-panel"),
            results: document.getElementById("results-panel"),
        };

        this.gameUI = document.getElementById("game-ui");
        this.playerListEl = document.getElementById("lobby-player-list");
        this.publicRoomListEl = document.getElementById("public-room-list");
        this.podiumDisplay = document.getElementById("podium-display");
        this.countdownOverlay = document.getElementById("countdown-overlay");

        this.duckPreviewEl = document.getElementById("duck-preview");
        this.colorBodyInput = document.getElementById("color-body-input");
        this.colorAccentInput = document.getElementById("color-accent-input");

        this.chat = new ChatOverlay();

        this.camBtn = document.createElement("button");
        this.camBtn.className = "floating-cam-btn hidden";
        this.camBtn.textContent = "🎥 Camera: Auto";
        document.body.appendChild(this.camBtn);
    }

    showPanel(panelName) {
        for (const el of Object.values(this.panels)) {
            el.classList.add("hidden");
        }
        this.camBtn.classList.add("hidden");

        if (panelName === "game") {
            this.gameUI.style.display = "none";
            this.chat.setVisible(true);
            this.camBtn.classList.remove("hidden");
        } else if (panelName === "start") {
            this.gameUI.style.display = "flex";
            this.panels.start.classList.remove("hidden");
            this.chat.setVisible(false);
        } else {
            this.gameUI.style.display = "flex";
            if (this.panels[panelName]) this.panels[panelName].classList.remove("hidden");
            this.chat.setVisible(true);
        }
    }

    initCustomization(currentConfig, onUpdate) {
        this.colorBodyInput.value = currentConfig.body;
        this.colorAccentInput.value = currentConfig.beak;
        this.updatePreview(currentConfig);

        const handleChange = () => {
            const newConfig = {
                body: this.colorBodyInput.value,
                beak: this.colorAccentInput.value,
            };
            this.updatePreview(newConfig);
            onUpdate(newConfig);
        };

        this.colorBodyInput.oninput = handleChange;
        this.colorAccentInput.oninput = handleChange;
    }

    updatePreview(config) {
        this.duckPreviewEl.innerHTML = DuckAvatar.getSVG(config);
    }

    updateLobbyPlayers(players, currentUserId) {
        this.playerListEl.innerHTML = "";
        let readyCount = 0;

        for (const [uid, p] of Object.entries(players)) {
            const div = document.createElement("div");
            div.className = `player-item${uid === currentUserId ? " me" : ""}`;
            const color = p.config?.body || "#ccc";
            const colorDot = `<span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${color}; margin-right:5px; border:1px solid #999;"></span>`;
            div.innerHTML = `<div>${colorDot} ${p.name}</div>`;
            this.playerListEl.appendChild(div);
            readyCount++;
        }
        return readyCount;
    }

    updateRoomList(rooms, onJoin) {
        this.publicRoomListEl.innerHTML = "";
        if (rooms.length === 0) {
            this.publicRoomListEl.innerHTML =
                '<div style="text-align:center; color:#999; padding: 20px;">No public races starting soon...</div>';
            return;
        }

        for (const room of rooms) {
            const playerCount = room.players ? Object.keys(room.players).length : 0;
            const hostName = room.players?.[room.hostId]?.name || "Unknown";
            const isRacing = room.status === "racing";

            const card = document.createElement("div");
            card.className = "room-card";
            if (isRacing) card.style.opacity = "0.7";

            card.innerHTML = `
                <div class="room-info">
                    <span style="font-weight:bold; color:#333;">Host: ${hostName}${isRacing ? " (In Progress)" : ""}</span>
                    <div style="font-size:0.85em; color:#666;">
                        <span class="room-code-small">Code: ${room.id}</span> • ${playerCount} Players
                    </div>
                </div>
            `;

            const joinBtn = document.createElement("button");
            joinBtn.className = "join-small-btn";

            if (isRacing) {
                joinBtn.textContent = "RACING";
                joinBtn.disabled = true;
                joinBtn.style.backgroundColor = "#ccc";
                joinBtn.style.cursor = "default";
            } else {
                joinBtn.textContent = "JOIN";
                joinBtn.onclick = () => onJoin(room.id);
            }

            card.appendChild(joinBtn);
            this.publicRoomListEl.appendChild(card);
        }
    }

    setupCameraListener(callback) {
        this.camBtn.onclick = () => {
            const nextMode = callback();
            this.camBtn.textContent = `🎥 Camera: ${nextMode}`;
        };
    }

    runCountdown(onComplete) {
        let count = 3;
        const el = this.countdownOverlay;

        el.classList.remove("hidden");
        el.classList.add("active");
        el.textContent = count;

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                el.textContent = count;
            } else if (count === 0) {
                el.textContent = "GO!";
                if (onComplete) onComplete();
            } else {
                clearInterval(interval);
                el.classList.remove("active");
                el.classList.add("hidden");
            }
        }, 1000);
    }

    showResults(finishOrder, players, myRank, currentUserId) {
        this.podiumDisplay.innerHTML = "";
        const titleEl = document.getElementById("result-title");
        const msgEl = document.getElementById("result-message");

        if (myRank === 0) {
            titleEl.textContent = "You Won! 🎉";
            titleEl.style.color = "#2ecc71";
            msgEl.textContent = "Your duck is the champion!";
        } else {
            const winnerName = finishOrder[0]?.name || "Nobody";
            titleEl.textContent = `${winnerName} Won!`;
            titleEl.style.color = "#333";
            const myDuckName = players[currentUserId]?.name || "You";
            msgEl.textContent =
                myRank !== -1 ? `${myDuckName} finished #${myRank + 1}` : "Better luck next time!";
        }

        for (let i = 0; i < 3; i++) {
            if (i >= finishOrder.length) break;
            const duck = finishOrder[i];
            const step = document.createElement("div");
            step.className = `podium-step rank-${i + 1}`;
            step.innerHTML = `
                <div class="podium-duck">${DuckAvatar.getSVG(duck.config)}</div>
                <div class="podium-bar">${i + 1}</div>
                <div class="podium-names">${duck.name}</div>
            `;
            this.podiumDisplay.appendChild(step);
        }
    }
}
