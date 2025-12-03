import { DUCK_PALETTES, RACE_DISTANCE } from "../config.js";

export class UIManager {
    constructor() {
        this.panels = {
            start: document.getElementById("start-panel"),
            lobby: document.getElementById("lobby-panel"),
            results: document.getElementById("results-panel"),
        };
        this.gameUI = document.getElementById("game-ui");
        this.gameWorldEl = document.getElementById("game-world");
        this.playerListEl = document.getElementById("lobby-player-list");
        this.duckSelectionEl = document.getElementById("duck-selection");
        this.publicRoomListEl = document.getElementById("public-room-list");
        this.podiumDisplay = document.getElementById("podium-display");

        // Chat Elements
        this.chatOverlay = document.getElementById("chat-overlay");
        this.chatMessages = document.getElementById("chat-messages");
        this.chatInput = document.getElementById("chat-input");
        this.sendChatBtn = document.getElementById("send-chat-btn");

        this.waveEls = document.querySelectorAll(".wave");
        this.cloudLayerEl = document.getElementById("cloud-layer");
    }

    showPanel(panelName) {
        for (const el of Object.values(this.panels)) {
            el.classList.add("hidden");
        }

        if (panelName === "game") {
            this.gameUI.style.display = "none";
            this.chatOverlay.classList.remove("hidden"); // Show chat in game
        } else if (panelName === "start") {
            this.gameUI.style.display = "flex";
            this.panels.start.classList.remove("hidden");
            this.chatOverlay.classList.add("hidden"); // Hide chat on start screen
        } else {
            this.gameUI.style.display = "flex";
            if (this.panels[panelName]) {
                this.panels[panelName].classList.remove("hidden");
            }
            if (panelName === "lobby" || panelName === "results") {
                this.chatOverlay.classList.remove("hidden"); // Show chat in lobby/results
            }
        }
    }

    // New Color Picker Logic
    initDuckSelection(onSelect) {
        this.duckSelectionEl.innerHTML = "";
        for (let index = 0; index < DUCK_PALETTES.length; index++) {
            const config = DUCK_PALETTES[index];
            const btn = document.createElement("div");
            btn.className = "color-swatch";
            btn.id = `color-btn-${index}`;
            btn.style.backgroundColor = config.body;
            btn.title = config.name;
            btn.onclick = () => onSelect(index);
            this.duckSelectionEl.appendChild(btn);
        }
    }

    highlightSelectedDuck(index) {
        for (const b of document.querySelectorAll(".color-swatch")) {
            b.classList.remove("selected");
        }
        const btn = document.getElementById(`color-btn-${index}`);
        if (btn) btn.classList.add("selected");
    }

    updateLobbyPlayers(players, currentUserId) {
        this.playerListEl.innerHTML = "";
        let readyCount = 0;

        for (const [uid, p] of Object.entries(players)) {
            const div = document.createElement("div");
            div.className = `player-item${uid === currentUserId ? " me" : ""}`;

            // Show color dot next to name
            const colorDot = `<span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${p.color || "#ccc"}; margin-right:5px;"></span>`;

            div.innerHTML = `<div>${colorDot} ${p.name}</div>`;
            this.playerListEl.appendChild(div);

            // In v0.2.0, everyone is always "ready" once they join (default color assigned)
            readyCount++;
        }
        return readyCount;
    }

    // --- CHAT UI ---
    renderChatMessages(messages) {
        this.chatMessages.innerHTML = "";
        for (const msg of messages) {
            const el = document.createElement("div");
            el.className = "chat-msg";
            el.innerHTML = `<span class="chat-name">${msg.userName}:</span> ${msg.text}`;
            this.chatMessages.appendChild(el);
        }
        // Auto scroll to bottom
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    setupChatListeners(onSend) {
        const send = () => {
            const text = this.chatInput.value.trim();
            if (text) {
                onSend(text);
                this.chatInput.value = "";
            }
        };
        this.sendChatBtn.onclick = send;
        this.chatInput.onkeypress = (e) => {
            if (e.key === "Enter") send();
        };
    }

    // Keep existing methods for now...
    updateRoomList(rooms, onJoin) {
        /* ... same as before ... */
        this.publicRoomListEl.innerHTML = "";
        if (rooms.length === 0) {
            this.publicRoomListEl.innerHTML =
                '<div style="text-align:center; color:#999; padding: 20px;">No public races starting soon...</div>';
            return;
        }
        for (const room of rooms) {
            const playerCount = room.players ? Object.keys(room.players).length : 0;
            const hostName = room.players?.[room.hostId]
                ? room.players[room.hostId].name
                : "Unknown";
            const card = document.createElement("div");
            card.className = "room-card";
            card.innerHTML = `
                <div class="room-info">
                    <span style="font-weight:bold; color:#333;">Host: ${hostName}</span>
                    <div style="font-size:0.85em; color:#666;"><span class="room-code-small">Code: ${room.id}</span> • ${playerCount} Players</div>
                </div>`;
            const joinBtn = document.createElement("button");
            joinBtn.className = "join-small-btn";
            joinBtn.textContent = "JOIN";
            joinBtn.onclick = () => onJoin(room.id);
            card.appendChild(joinBtn);
            this.publicRoomListEl.appendChild(card);
        }
    }

    // Placeholder for Phase 2: Game World Rendering will move to Canvas next
    buildGameWorld() {
        return [];
    }
    updateCamera() {}
    showResults() {}
    getDuckSVG(config) {
        /* Helper for results/podium */
        return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g transform="scale(-1, 1) translate(-100, 0)"><path d="M20,60 Q20,90 50,90 L75,90 Q95,90 95,70 Q95,50 75,50 L70,50 L70,40 Q70,10 45,10 Q20,10 20,40 L20,60 Z" fill="${config.body}" stroke="#333" stroke-width="2"/><path d="M40,65 Q50,85 70,65" fill="none" stroke="${config.beak}" stroke-width="3" stroke-linecap="round" /><circle cx="40" cy="30" r="5" fill="white" /><circle cx="42" cy="30" r="2" fill="black" /><path d="M20,35 Q5,35 5,45 Q5,50 20,45 Z" fill="${config.beak}" stroke="#333" stroke-width="1"/></g></svg>`;
    }
}
