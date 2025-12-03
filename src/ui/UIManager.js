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
        this.publicRoomListEl = document.getElementById("public-room-list");
        this.podiumDisplay = document.getElementById("podium-display");

        this.duckPreviewEl = document.getElementById("duck-preview");
        this.colorBodyInput = document.getElementById("color-body-input");
        this.colorAccentInput = document.getElementById("color-accent-input");

        this.chatOverlay = document.getElementById("chat-overlay");
        this.chatMessages = document.getElementById("chat-messages");
        this.chatInput = document.getElementById("chat-input");
        this.sendChatBtn = document.getElementById("send-chat-btn");
        this.chatToggleBtn = document.getElementById("chat-toggle-btn");
        this.chatHeader = document.querySelector(".chat-header");

        this.waveEls = document.querySelectorAll(".wave");
        this.cloudLayerEl = document.getElementById("cloud-layer");

        this.initInternalListeners();
    }

    initInternalListeners() {
        const toggleChat = () => {
            const isCollapsed = this.chatOverlay.classList.toggle("collapsed");
            if (this.chatToggleBtn) {
                this.chatToggleBtn.textContent = isCollapsed ? "+" : "−";
            }
        };

        if (this.chatToggleBtn) this.chatToggleBtn.onclick = toggleChat;
        if (this.chatHeader) this.chatHeader.onclick = toggleChat;
    }

    showPanel(panelName) {
        for (const el of Object.values(this.panels)) {
            el.classList.add("hidden");
        }

        if (panelName === "game") {
            this.gameUI.style.display = "none";
            this.chatOverlay.classList.remove("hidden");
        } else if (panelName === "start") {
            this.gameUI.style.display = "flex";
            this.panels.start.classList.remove("hidden");
            this.chatOverlay.classList.add("hidden");
        } else {
            this.gameUI.style.display = "flex";
            if (this.panels[panelName]) {
                this.panels[panelName].classList.remove("hidden");
            }
            if (panelName === "lobby" || panelName === "results") {
                this.chatOverlay.classList.remove("hidden");
            }
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
        this.duckPreviewEl.innerHTML = this.getDuckSVG(config);
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

    renderChatMessages(messages) {
        this.chatMessages.innerHTML = "";
        for (const msg of messages) {
            const el = document.createElement("div");
            el.className = "chat-msg";
            el.innerHTML = `<span class="chat-name">${msg.userName}:</span> ${msg.text}`;
            this.chatMessages.appendChild(el);
        }
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

    // --- FIX: RESTORED SHOW RESULTS METHOD ---
    showResults(finishOrder, players, myRank, currentUserId) {
        this.podiumDisplay.innerHTML = "";
        const titleEl = document.getElementById("result-title");
        const msgEl = document.getElementById("result-message");

        // Handle "You Won" vs "Winner" logic
        if (myRank === 0) {
            titleEl.textContent = "You Won! 🎉";
            titleEl.style.color = "#2ecc71";
            msgEl.textContent = "Your duck is the champion!";
        } else {
            const winnerName = finishOrder[0]?.name || "Nobody";
            titleEl.textContent = `${winnerName} Won!`;
            titleEl.style.color = "#333";

            const myDuckName = players[currentUserId]?.name || "You";
            if (myRank !== -1) {
                msgEl.textContent = `${myDuckName} finished #${myRank + 1}`;
            } else {
                msgEl.textContent = "Better luck next time!";
            }
        }

        // Render Top 3 on Podium
        for (let i = 0; i < 3; i++) {
            if (i >= finishOrder.length) break;
            const duck = finishOrder[i];

            const step = document.createElement("div");
            step.className = `podium-step rank-${i + 1}`;
            step.innerHTML = `
                <div class="podium-duck">${this.getDuckSVG(duck.config)}</div>
                <div class="podium-bar">${i + 1}</div>
                <div class="podium-names">${duck.name}</div>
            `;
            this.podiumDisplay.appendChild(step);
        }
    }

    getDuckSVG(config) {
        return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g transform="scale(-1, 1) translate(-100, 0)"><path d="M20,60 Q20,90 50,90 L75,90 Q95,90 95,70 Q95,50 75,50 L70,50 L70,40 Q70,10 45,10 Q20,10 20,40 L20,60 Z" fill="${config.body}" stroke="#333" stroke-width="2"/><path d="M40,65 Q50,85 70,65" fill="none" stroke="${config.beak}" stroke-width="3" stroke-linecap="round" /><circle cx="40" cy="30" r="5" fill="white" /><circle cx="42" cy="30" r="2" fill="black" /><path d="M20,35 Q5,35 5,45 Q5,50 20,45 Z" fill="${config.beak}" stroke="#333" stroke-width="1"/></g></svg>`;
    }

    buildGameWorld() {
        return [];
    }
    updateCamera() {}
}
