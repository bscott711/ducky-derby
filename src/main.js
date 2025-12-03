import "./styles.css";
import { MIN_RACERS, NPC_NAMES } from "./config.js";
import { RaceEngine } from "./game/RaceEngine.js";
import { authService, dbService } from "./services/firebase.js";
import { UIManager } from "./ui/UIManager.js";

const ui = new UIManager();
const engine = new RaceEngine(ui);

const state = {
    user: null,
    room: null,
    isHost: false,
    raceStatus: "lobby", // lobby, racing, finished
    players: {},
    chatUnsub: null,
    controlsInitialized: false,
};

// --- HELPERS ---
function getRandomHex() {
    return `#${Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0")}`;
}

function getRandomDuckConfig() {
    return {
        body: getRandomHex(),
        beak: getRandomHex(),
    };
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// --- AUTH ---
authService.onAuthStateChanged((user) => {
    if (user) {
        state.user = user;
        dbService.subscribeToPublicRooms((rooms) => {
            if (!state.room) ui.updateRoomList(rooms, (id) => handleJoinRoom(id));
        });
    } else {
        authService.signIn();
    }
});

// --- EVENT HANDLERS ---
document.getElementById("create-room-btn").addEventListener("click", async () => {
    const name = document.getElementById("player-name-input").value || "Host";
    const isPublic = document.getElementById("is-public-check").checked;
    const defaultDuck = getRandomDuckConfig();

    try {
        const roomId = await dbService.createRoom(state.user.uid, name, isPublic, defaultDuck);
        handleEnterLobby(roomId, true);
    } catch (e) {
        console.error(e);
    }
});

document.getElementById("join-room-btn").addEventListener("click", () => {
    const code = document.getElementById("room-code-input").value.toUpperCase();
    if (code) handleJoinRoom(code);
});

async function handleJoinRoom(roomId) {
    const name = document.getElementById("player-name-input").value || "Guest";
    const defaultDuck = getRandomDuckConfig();

    try {
        const hostId = await dbService.joinRoom(roomId, state.user.uid, name, defaultDuck);
        const isMeHost = hostId === state.user.uid;
        handleEnterLobby(roomId, isMeHost);
    } catch (e) {
        alert(e.message);
    }
}

document.getElementById("delete-room-btn").addEventListener("click", async () => {
    if (confirm("Are you sure you want to close this room? Everyone will be kicked.")) {
        try {
            await dbService.deleteRoom(state.room);
        } catch (e) {
            console.error("Failed to delete room:", e);
        }
    }
});

function handleEnterLobby(roomId, isHost) {
    state.room = roomId;
    state.isHost = isHost;

    ui.showPanel("lobby");
    document.getElementById("lobby-code-display").textContent = roomId;
    document.getElementById("room-code-header").textContent = `ROOM: ${roomId}`;

    const hostMsg = document.getElementById("host-msg");
    const startBtn = document.getElementById("start-race-btn");
    const deleteBtn = document.getElementById("delete-room-btn");
    const waitMsg = document.getElementById("waiting-msg");

    if (isHost) {
        hostMsg.classList.remove("hidden");
        startBtn.classList.remove("hidden");
        deleteBtn.classList.remove("hidden");
        waitMsg.classList.add("hidden");
        startBtn.disabled = false;
    } else {
        hostMsg.classList.add("hidden");
        startBtn.classList.add("hidden");
        deleteBtn.classList.add("hidden");
        waitMsg.classList.remove("hidden");
    }

    const debouncedUpdate = debounce((newConfig) => {
        dbService.updatePlayerConfig(roomId, state.user.uid, newConfig, state.players);
    }, 300);

    if (state.chatUnsub) state.chatUnsub();
    state.chatUnsub = dbService.subscribeToChat(roomId, (msgs) => {
        ui.renderChatMessages(msgs);
    });
    ui.setupChatListeners((text) => {
        const myName = state.players[state.user.uid]?.name || "Anon";
        dbService.sendChatMessage(roomId, state.user.uid, myName, text);
    });

    dbService.subscribeToRoom(roomId, (data) => {
        if (!data) {
            alert("Room closed.");
            resetToLobby();
            return;
        }

        state.players = data.players || {};
        ui.updateLobbyPlayers(state.players, state.user.uid);

        const me = state.players[state.user.uid];
        if (me?.config && !state.controlsInitialized) {
            ui.initCustomization(me.config, (cfg) => debouncedUpdate(cfg));
            state.controlsInitialized = true;
        }

        if (data.status === "racing" && state.raceStatus === "lobby") {
            console.log("🏁 Race Signal Received! Seed:", data.seed);
            const raceSeed = data.seed || 123456;
            startRace(raceSeed);
        } else if (data.status === "lobby" && state.raceStatus !== "lobby") {
            state.raceStatus = "lobby";
            ui.showPanel("lobby");
        }
    });
}

document.getElementById("start-race-btn").addEventListener("click", async () => {
    if (state.isHost) {
        const seed = Math.floor(Math.random() * 1000000);
        await dbService.startRace(state.room, seed);
    }
});

document.getElementById("back-to-lobby-btn").addEventListener("click", async () => {
    if (state.isHost) {
        await dbService.resetLobby(state.room);
    }
});

function startRace(seed) {
    console.log("🚀 Starting Client Engine with seed:", seed);
    state.raceStatus = "racing";
    ui.showPanel("game");

    const realPlayers = Object.values(state.players);
    const racers = [...realPlayers];

    // NPC Logic
    if (racers.length < MIN_RACERS) {
        const needed = MIN_RACERS - racers.length;
        for (let i = 0; i < needed; i++) {
            const randomName = NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)];
            racers.push({
                name: `${randomName} #${i + 1}`,
                config: getRandomDuckConfig(),
                isNPC: true,
            });
        }
    }

    // --- FIX: The Sequence ---
    // 1. Setup World (Draw Bridge, Place Ducks)
    engine.setup(seed, racers);

    // 2. Countdown Animation
    ui.runCountdown(() => {
        // 3. Start Physics Loop
        engine.run((finishOrder) => {
            state.raceStatus = "finished";
            console.log("🏆 Race Finished", finishOrder);

            setTimeout(() => {
                ui.showPanel("results");
                const myName = state.players[state.user.uid]?.name;
                const myRank = finishOrder.findIndex((d) => d.name === myName);
                ui.showResults(finishOrder, state.players, myRank, state.user.uid);

                const backBtn = document.getElementById("back-to-lobby-btn");
                if (state.isHost) {
                    backBtn.textContent = "Back to Lobby";
                    backBtn.disabled = false;
                } else {
                    backBtn.textContent = "Waiting for Host...";
                    backBtn.disabled = true;
                }
            }, 1000);
        });
    });
}

function resetToLobby() {
    state.raceStatus = "lobby";
    state.room = null;
    state.isHost = false;
    state.controlsInitialized = false;

    if (state.chatUnsub) state.chatUnsub();
    engine.stop();
    ui.showPanel("start");
}
