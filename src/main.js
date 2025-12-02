import "./styles.css"; // Vite handles CSS import
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
};

// --- AUTH ---
authService.onAuthStateChanged((user) => {
    if (user) {
        state.user = user;
        // Load public rooms
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

    try {
        const roomId = await dbService.createRoom(state.user.uid, name, isPublic);
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
    try {
        await dbService.joinRoom(roomId, state.user.uid, name);
        handleEnterLobby(roomId, false);
    } catch (e) {
        alert(e.message);
    }
}

function handleEnterLobby(roomId, isHost) {
    state.room = roomId;
    state.isHost = isHost;

    ui.showPanel("lobby");
    document.getElementById("lobby-code-display").textContent = roomId;
    document.getElementById("room-code-header").textContent = `ROOM: ${roomId}`;

    const hostMsg = document.getElementById("host-msg");
    const startBtn = document.getElementById("start-race-btn");
    const waitMsg = document.getElementById("waiting-msg");

    if (isHost) {
        hostMsg.classList.remove("hidden");
        startBtn.classList.remove("hidden");
        waitMsg.classList.add("hidden");
    }

    ui.initDuckSelection((index) => {
        dbService.updateDuckSelection(roomId, state.user.uid, index, state.players);
        ui.highlightSelectedDuck(index);
    });

    // Subscribe to Room Updates
    dbService.subscribeToRoom(roomId, (data) => {
        state.players = data.players || {};
        const readyCount = ui.updateLobbyPlayers(state.players, state.user.uid);

        // Host Start Button Logic
        if (isHost) startBtn.disabled = readyCount === 0;

        // Check Race Status Changes
        if (data.status === "racing" && state.raceStatus === "lobby") {
            startRace(data.seed);
        } else if (data.status === "lobby" && state.raceStatus !== "lobby") {
            resetToLobby();
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

// --- GAME STATE ---
function startRace(seed) {
    state.raceStatus = "racing";
    ui.showPanel("game"); // Hides UI overlay

    engine.start(seed, (finishOrder) => {
        state.raceStatus = "finished";

        // Brief delay before showing results
        setTimeout(() => {
            ui.showPanel("results");
            const myDuck = state.players[state.user.uid]?.duckIndex;
            ui.showResults(finishOrder, state.players, myDuck, state.user.uid);

            // Host control for back button
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
}

function resetToLobby() {
    state.raceStatus = "lobby";
    engine.stop();
    ui.showPanel("lobby");
    // Re-render lobby state
    ui.initDuckSelection((index) => {
        dbService.updateDuckSelection(state.room, state.user.uid, index, state.players);
        ui.highlightSelectedDuck(index);
    });
}
