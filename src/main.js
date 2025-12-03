import "./styles.css";
// import { RaceEngine } from "./game/RaceEngine.js"; // Disabled for Phase 1
import { authService, dbService } from "./services/firebase.js";
import { UIManager } from "./ui/UIManager.js";

const ui = new UIManager();
// const engine = new RaceEngine(ui);

const state = {
    user: null,
    room: null,
    isHost: false,
    raceStatus: "lobby",
    players: {},
    chatUnsub: null,
};

// --- HELPER: Random Color Generator ---
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

// --- HELPER: Debounce (Limits DB writes) ---
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
    const defaultDuck = getRandomDuckConfig(); // Random Start

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
    const defaultDuck = getRandomDuckConfig(); // Random Start

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
        startBtn.disabled = false;
    } else {
        hostMsg.classList.add("hidden");
        startBtn.classList.add("hidden");
        deleteBtn.classList.add("hidden");
        waitMsg.classList.remove("hidden");
    }

    // --- SETUP CUSTOMIZATION ---

    // 1. Get my current config from state (it was set during create/join)
    // We need to fetch it freshly from DB or wait for first update,
    // but initially we can rely on what we just sent or wait for the subscription to fire.
    // Ideally, we init controls once we have the player data.

    // Create a debounced updater
    const debouncedUpdate = debounce((newConfig) => {
        dbService.updatePlayerConfig(roomId, state.user.uid, newConfig, state.players);
    }, 300); // Wait 300ms after last change before writing to DB

    // Setup Chat
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

        // SYNC MY CONTROLS
        // We only init the controls once to avoid overwriting user input while they type
        const me = state.players[state.user.uid];
        if (me?.config && !state.controlsInitialized) {
            ui.initCustomization(me.config, (cfg) => debouncedUpdate(cfg));
            state.controlsInitialized = true; // Flag to prevent re-init
        }

        // If someone ELSE updates, we don't want to re-init OUR controls,
        // but we DO want to see their color change in the player list (handled by updateLobbyPlayers)

        if (data.status === "racing" && state.raceStatus === "lobby") {
            console.log("RACE STARTED!");
            state.raceStatus = "racing";
            ui.showPanel("game");
        } else if (data.status === "lobby" && state.raceStatus !== "lobby") {
            state.raceStatus = "lobby";
            ui.showPanel("lobby");
        }
    });
}

// ... rest of startRace, backToLobby, resetToLobby (same as previous) ...

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
    state.controlsInitialized = false; // Reset control flag
    if (state.chatUnsub) state.chatUnsub();
    ui.showPanel("start");
}
