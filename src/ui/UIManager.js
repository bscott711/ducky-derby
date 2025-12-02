import { DUCK_COLORS, RACE_DISTANCE } from "../config.js";

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

        // Track wave elements for parallax
        this.waveEls = document.querySelectorAll(".wave");
        this.cloudLayerEl = document.getElementById("cloud-layer");
    }

    showPanel(panelName) {
        // FIX: loop instead of forEach
        for (const el of Object.values(this.panels)) {
            el.style.display = "none";
        }

        if (panelName === "game") {
            this.gameUI.style.display = "none";
        } else {
            this.gameUI.style.display = "flex";
            this.panels[panelName].style.display = "block";
        }
    }

    getDuckSVG(config) {
        return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g transform="scale(-1, 1) translate(-100, 0)"><path d="M20,60 Q20,90 50,90 L75,90 Q95,90 95,70 Q95,50 75,50 L70,50 L70,40 Q70,10 45,10 Q20,10 20,40 L20,60 Z" fill="${config.body}" stroke="#333" stroke-width="2"/><path d="M40,65 Q50,85 70,65" fill="none" stroke="${config.beak}" stroke-width="3" stroke-linecap="round" /><circle cx="40" cy="30" r="5" fill="white" /><circle cx="42" cy="30" r="2" fill="black" /><path d="M20,35 Q5,35 5,45 Q5,50 20,45 Z" fill="${config.beak}" stroke="#333" stroke-width="1"/></g></svg>`;
    }

    initDuckSelection(onSelect) {
        this.duckSelectionEl.innerHTML = "";
        // Biome allows forEach on arrays if you really want,
        // but let's stick to consistent for...of for DUCK_COLORS
        for (let index = 0; index < DUCK_COLORS.length; index++) {
            const duckConfig = DUCK_COLORS[index];
            const btn = document.createElement("div");
            btn.className = "bet-btn";
            btn.id = `bet-btn-${index}`;
            btn.innerHTML = `${this.getDuckSVG(duckConfig)}<strong>${duckConfig.name}</strong>`;
            btn.onclick = () => onSelect(index);
            this.duckSelectionEl.appendChild(btn);
        }
    }

    highlightSelectedDuck(index) {
        // FIX: loop for NodeList
        for (const b of document.querySelectorAll(".bet-btn")) {
            b.classList.remove("selected");
        }
        const btn = document.getElementById(`bet-btn-${index}`);
        if (btn) btn.classList.add("selected");
    }

    updateLobbyPlayers(players, currentUserId) {
        this.playerListEl.innerHTML = "";
        let readyCount = 0;

        // FIX: loop
        for (const [uid, p] of Object.entries(players)) {
            const div = document.createElement("div");
            div.className = `player-item${uid === currentUserId ? " me" : ""}`;

            let duckName = "Selecting...";
            if (p.duckIndex !== -1) {
                duckName = DUCK_COLORS[p.duckIndex].name;
                readyCount++;
            }

            div.innerHTML = `<span>${p.name}</span> <span>${duckName}</span>`;
            this.playerListEl.appendChild(div);
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

        // FIX: loop
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

    buildGameWorld() {
        this.gameWorldEl.innerHTML = `
            <div class="finish-line" style="left: ${RACE_DISTANCE}px;"></div>
            <div class="finish-flag" style="left: ${RACE_DISTANCE}px; top: 20%">🏁</div>
            <div class="finish-flag" style="left: ${RACE_DISTANCE}px; top: 95%">🏁</div>
        `;

        const duckEls = [];
        for (let index = 0; index < DUCK_COLORS.length; index++) {
            const duckConfig = DUCK_COLORS[index];
            const lane = document.createElement("div");
            lane.className = "lane";
            lane.style.top = `${index * 25}%`;

            const duckDiv = document.createElement("div");
            duckDiv.className = "duck-wrapper";
            duckDiv.innerHTML = `${this.getDuckSVG(duckConfig)}<div class="duck-name">${duckConfig.name}</div>`;

            lane.appendChild(duckDiv);
            this.gameWorldEl.appendChild(lane);
            duckEls.push(duckDiv);
        }
        return duckEls;
    }

    updateCamera(cameraX, wobbleArray, duckPositions) {
        this.gameWorldEl.style.transform = `translateX(-${cameraX}px)`;

        // FIX: loop
        for (const wave of this.waveEls) {
            wave.style.backgroundPositionX = `-${cameraX}px`;
        }

        if (this.cloudLayerEl)
            this.cloudLayerEl.style.transform = `translateX(-${cameraX * 0.1}px)`;

        // Update individual ducks
        duckPositions.forEach((pos, i) => {
            const duckEl = this.gameWorldEl.querySelectorAll(".duck-wrapper")[i];
            if (duckEl) duckEl.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
        });
    }

    showResults(finishOrder, players, myDuckIndex, currentUserId) {
        this.podiumDisplay.innerHTML = "";
        const titleEl = document.getElementById("result-title");
        const msgEl = document.getElementById("result-message");
        const me = players[currentUserId];

        const winningDuckIndex = finishOrder[0].originalIndex;
        const winners = Object.values(players).filter((p) => p.duckIndex === winningDuckIndex);
        const userWon = myDuckIndex === winningDuckIndex;

        if (userWon) {
            titleEl.textContent = "You Won! 🎉";
            titleEl.style.color = "#2ecc71";
            msgEl.textContent = "Your duck is the champion!";
        } else {
            const winnerNames = winners.map((p) => p.name);
            titleEl.textContent = winnerNames.length > 0 ? `${winnerNames[0]} Won!` : "No Winners!";
            titleEl.style.color = "#333";
            msgEl.textContent = `Winner: ${DUCK_COLORS[winningDuckIndex].name}`;
        }

        for (let i = 0; i < 3; i++) {
            if (i >= finishOrder.length) break;
            const duck = finishOrder[i];
            const pickers = Object.values(players)
                .filter((p) => p.duckIndex === duck.originalIndex)
                .map((p) => p.name);

            const step = document.createElement("div");
            step.className = `podium-step rank-${i + 1}`;
            step.innerHTML = `
                <div class="podium-duck">${this.getDuckSVG(duck.config)}</div>
                <div class="podium-bar">${i + 1}</div>
                <div class="podium-names">${pickers.join("<br>")}</div>
            `;
            this.podiumDisplay.appendChild(step);
        }
    }
}
