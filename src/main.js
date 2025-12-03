import "./styles.css";
// NOTE: RaceEngine is disabled for this Phase 1 commit to prevent errors
// while we refactor the physics in Phase 2.
// import { RaceEngine } from "./game/RaceEngine.js";
import { DUCK_PALETTES } from "./config.js";
import { authService, dbService } from "./services/firebase.js";
import { UIManager } from "./ui/UIManager.js";

const ui = new UIManager();
// const engine = new RaceEngine(ui); // Disabled for Phase 1

const state = {
    user: null,
    room: null,
    isHost: false,
    raceStatus: "lobby",
    players: {},
    chatUnsub: null,
};

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
    // Default to first color
    const defaultDuck = DUCK_PALETTES[0];

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
    // Pick a random color for guests initially
    const randomIdx = Math.floor(Math.random() * DUCK_PALETTES.length);
    const defaultDuck = DUCK_PALETTES[randomIdx];

    try {
        const hostId = await dbService.joinRoom(roomId, state.user.uid, name, defaultDuck);
        const isMeHost = hostId === state.user.uid;
        handleEnterLobby(roomId, isMeHost);
    } catch (e) {
        alert(e.message);
    }
}

document.getElementById("delete-room-btn").addEventListener("click", async () => {
    if (confirm("Close room?")) {
        await dbService.deleteRoom(state.room);
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
        startBtn.disabled = false; // Always enabled in v0.2.0
    } else {
        hostMsg.classList.add("hidden");
        startBtn.classList.add("hidden");
        deleteBtn.classList.add("hidden");
        waitMsg.classList.remove("hidden");
    }

    // Init Color Picker
    ui.initDuckSelection((index) => {
        const config = DUCK_PALETTES[index];
        dbService.updatePlayerConfig(roomId, state.user.uid, config, state.players);
        ui.highlightSelectedDuck(index);
    });

    // Chat Setup
    if (state.chatUnsub) state.chatUnsub();
    state.chatUnsub = dbService.subscribeToChat(roomId, (msgs) => {
        ui.renderChatMessages(msgs);
    });
    ui.setupChatListeners((text) => {
        const myName = state.players[state.user.uid]?.name || "Anon";
        dbService.sendChatMessage(roomId, state.user.uid, myName, text);
    });

    // Room Subscription
    dbService.subscribeToRoom(roomId, (data) => {
        if (!data) {
            alert("Room closed.");
            resetToLobby();
            return;
        }

        state.players = data.players || {};
        ui.updateLobbyPlayers(state.players, state.user.uid);

        // Auto-select my current color in the UI
        const me = state.players[state.user.uid];
        if (me?.config) {
            const idx = DUCK_PALETTES.findIndex((d) => d.body === me.config.body);
            if (idx !== -1) ui.highlightSelectedDuck(idx);
        }

        if (data.status === "racing" && state.raceStatus === "lobby") {
            // PHASE 2: This is where we will trigger the new Canvas Engine
            console.log("RACE STARTED! (Engine disabled for Phase 1)");
            state.raceStatus = "racing";
            ui.showPanel("game");
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
    if (state.isHost) await dbService.resetLobby(state.room);
});

function resetToLobby() {
    state.raceStatus = "lobby";
    state.room = null;
    state.isHost = false;
    if (state.chatUnsub) state.chatUnsub();
    ui.showPanel("start");
}
