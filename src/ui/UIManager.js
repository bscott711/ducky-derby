import { RACE_DISTANCE } from "../config.js";

export class UIManager {
    constructor() {
        // --- Panels ---
        this.panels = {
            start: document.getElementById("start-panel"),
            lobby: document.getElementById("lobby-panel"),
            results: document.getElementById("results-panel"),
        };

        // --- Core UI Elements ---
        this.gameUI = document.getElementById("game-ui");
        this.gameWorldEl = document.getElementById("game-world");
        this.playerListEl = document.getElementById("lobby-player-list");
        this.publicRoomListEl = document.getElementById("public-room-list");
        this.podiumDisplay = document.getElementById("podium-display");

        // --- Customization Elements (Phase 1) ---
        this.duckPreviewEl = document.getElementById("duck-preview");
        this.colorBodyInput = document.getElementById("color-body-input");
        this.colorAccentInput = document.getElementById("color-accent-input");

        // --- Chat Elements (Phase 1) ---
        this.chatOverlay = document.getElementById("chat-overlay");
        this.chatMessages = document.getElementById("chat-messages");
        this.chatInput = document.getElementById("chat-input");
        this.sendChatBtn = document.getElementById("send-chat-btn");
        this.chatToggleBtn = document.getElementById("chat-toggle-btn");
        this.chatHeader = document.querySelector(".chat-header");

        // --- Environment Elements ---
        this.waveEls = document.querySelectorAll(".wave");
        this.cloudLayerEl = document.getElementById("cloud-layer");

        // Initialize internal UI listeners (like collapse) immediately
        this.initInternalListeners();
    }

    // --- INTERNAL LISTENERS ---
    initInternalListeners() {
        // Handle Chat Collapse Toggle
        const toggleChat = () => {
            const isCollapsed = this.chatOverlay.classList.toggle("collapsed");
            if (this.chatToggleBtn) {
                this.chatToggleBtn.textContent = isCollapsed ? "+" : "−";
            }
        };

        if (this.chatToggleBtn) this.chatToggleBtn.onclick = toggleChat;
        if (this.chatHeader) this.chatHeader.onclick = toggleChat;
    }

    // --- PANEL NAVIGATION ---
    showPanel(panelName) {
        // Hide all panels first
        for (const el of Object.values(this.panels)) {
            el.classList.add("hidden");
        }

        // Handle Game UI Visibility
        if (panelName === "game") {
            this.gameUI.style.display = "none";
            this.chatOverlay.classList.remove("hidden"); // Chat visible in game
        } else if (panelName === "start") {
            this.gameUI.style.display = "flex";
            this.panels.start.classList.remove("hidden");
            this.chatOverlay.classList.add("hidden"); // Chat hidden on start screen
        } else {
            // Lobby or Results
            this.gameUI.style.display = "flex";
            if (this.panels[panelName]) {
                this.panels[panelName].classList.remove("hidden");
            }
            // Chat visible in lobby and results
            if (panelName === "lobby" || panelName === "results") {
                this.chatOverlay.classList.remove("hidden");
            }
        }
    }

    // --- CUSTOMIZATION LOGIC ---
    initCustomization(currentConfig, onUpdate) {
        // Set initial input values from the player's current config
        this.colorBodyInput.value = currentConfig.body;
        this.colorAccentInput.value = currentConfig.beak;

        // Render the initial preview
        this.updatePreview(currentConfig);

        // Helper to handle color changes
        const handleChange = () => {
            const newConfig = {
                body: this.colorBodyInput.value,
                beak: this.colorAccentInput.value,
            };
            // 1. Update the local preview immediately (fast feedback)
            this.updatePreview(newConfig);
            // 2. Notify Main to update DB (debounced in Main)
            onUpdate(newConfig);
        };

        // Listen for "input" (dragging) to update preview immediately
        this.colorBodyInput.oninput = handleChange;
        this.colorAccentInput.oninput = handleChange;
    }

    updatePreview(config) {
        this.duckPreviewEl.innerHTML = this.getDuckSVG(config);
    }

    // --- LOBBY LIST ---
    updateLobbyPlayers(players, currentUserId) {
        this.playerListEl.innerHTML = "";
        let readyCount = 0;

        for (const [uid, p] of Object.entries(players)) {
            const div = document.createElement("div");
            div.className = `player-item${uid === currentUserId ? " me" : ""}`;

            // Safe fallback for color if data is missing
            const color = p.config?.body || "#ccc";

            // Create a small color dot to represent the duck
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
            const hostName = room.players?.[room.hostId]
                ? room.players[room.hostId].name
                : "Unknown";

            const card = document.createElement("div");
            card.className = "room-card";
            card.innerHTML = `
                <div class="room-info">
                    <span style="font-weight:bold; color:#333;">Host: ${hostName}</span>
                    <div style="font-size:0.85em; color:#666;">
                        <span class="room-code-small">Code: ${room.id}</span> • ${playerCount} Players
                    </div>
                </div>
            `;

            const joinBtn = document.createElement("button");
            joinBtn.className = "join-small-btn";
            joinBtn.textContent = "JOIN";
            joinBtn.onclick = () => onJoin(room.id);
            card.appendChild(joinBtn);
            this.publicRoomListEl.appendChild(card);
        }
    }

    // --- CHAT LOGIC ---
    renderChatMessages(messages) {
        this.chatMessages.innerHTML = "";
        for (const msg of messages) {
            const el = document.createElement("div");
            el.className = "chat-msg";
            // msg.userName is colored gold in CSS (.chat-name)
            el.innerHTML = `<span class="chat-name">${msg.userName}:</span> ${msg.text}`;
            this.chatMessages.appendChild(el);
        }
        // Auto-scroll to the newest message
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

        // Allow pressing "Enter" to send
        this.chatInput.onkeypress = (e) => {
            if (e.key === "Enter") send();
        };
    }

    // --- HELPERS ---
    getDuckSVG(config) {
        return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g transform="scale(-1, 1) translate(-100, 0)"><path d="M20,60 Q20,90 50,90 L75,90 Q95,90 95,70 Q95,50 75,50 L70,50 L70,40 Q70,10 45,10 Q20,10 20,40 L20,60 Z" fill="${config.body}" stroke="#333" stroke-width="2"/><path d="M40,65 Q50,85 70,65" fill="none" stroke="${config.beak}" stroke-width="3" stroke-linecap="round" /><circle cx="40" cy="30" r="5" fill="white" /><circle cx="42" cy="30" r="2" fill="black" /><path d="M20,35 Q5,35 5,45 Q5,50 20,45 Z" fill="${config.beak}" stroke="#333" stroke-width="1"/></g></svg>`;
    }

    // --- PHASE 2 PLACEHOLDERS ---
    // These methods are temporarily empty or unused because we disabled the
    // old RaceEngine to prepare for the new Canvas Physics Engine.
    buildGameWorld() {
        return [];
    }
    updateCamera() {}
    showResults() {}
}
