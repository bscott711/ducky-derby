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
        this.leaderboardEl = document.getElementById("leaderboard-container");

        // New Global Lobby Elements
        this.lobbyTimerEl = document.getElementById("lobby-timer");
        this.playerCountEl = document.getElementById("player-count");

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
    updateLeaderboard(entries) {
        if (!this.leaderboardEl) return;

        let html = '<div class="lb-header">🏆 All-Time Champions</div>';

        if (entries.length === 0) {
            html +=
                '<div style="color:#888; font-style:italic;">No winners yet. Be the first!</div>';
        } else {
            let rank = 1;
            for (const entry of entries) {
                // Highlight top 3 with emojis
                let icon = `#${rank}`;
                if (rank === 1) icon = "🥇";
                if (rank === 2) icon = "🥈";
                if (rank === 3) icon = "🥉";

                html += `
                    <div class="lb-row">
                        <span class="lb-rank">${icon}</span>
                        <span class="lb-name">${entry.name}</span>
                        <span class="lb-wins">${entry.wins} Wins</span>
                    </div>
                `;
                rank++;
            }
        }
        this.leaderboardEl.innerHTML = html;
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

        // Sort: Current User First, then Alphabetical
        const sorted = Object.values(players).sort((a, b) => {
            if (a.id === currentUserId) return -1;
            if (b.id === currentUserId) return 1;
            return (a.name || "").localeCompare(b.name || "");
        });

        // Update Global Count
        if (this.playerCountEl) {
            this.playerCountEl.textContent = `${sorted.length} Racers Ready`;
        }

        for (const p of sorted) {
            const div = document.createElement("div");
            div.className = `player-item${p.id === currentUserId ? " me" : ""}`;
            const color = p.config?.body || "#ccc";
            const colorDot = `<span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${color}; margin-right:5px; border:1px solid #999;"></span>`;
            div.innerHTML = `<div>${colorDot} ${p.name}</div>`;
            this.playerListEl.appendChild(div);
        }
    }

    updateLobbyTimer(text) {
        if (this.lobbyTimerEl) {
            this.lobbyTimerEl.textContent = text;
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
            titleEl.textContent = "You Won! 👑";
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
