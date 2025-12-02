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
        // Get the hostId from the join response
        const hostId = await dbService.joinRoom(roomId, state.user.uid, name);

        // Check if I am the host
        const isMeHost = hostId === state.user.uid;

        handleEnterLobby(roomId, isMeHost);
    } catch (e) {
        alert(e.message);
    }
}

// NEW: Delete Room Button Listener
document.getElementById("delete-room-btn").addEventListener("click", async () => {
    if (confirm("Are you sure you want to close this room? Everyone will be kicked.")) {
        try {
            await dbService.deleteRoom(state.room);
            // The onSnapshot listener below will handle the UI reset
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
    const deleteBtn = document.getElementById("delete-room-btn"); // Get the new button
    const waitMsg = document.getElementById("waiting-msg");

    // Toggle Host Controls
    if (isHost) {
        hostMsg.classList.remove("hidden");
        startBtn.classList.remove("hidden");
        deleteBtn.classList.remove("hidden"); // Show Delete Button
        waitMsg.classList.add("hidden");
    } else {
        hostMsg.classList.add("hidden");
        startBtn.classList.add("hidden");
        deleteBtn.classList.add("hidden"); // Hide Delete Button
        waitMsg.classList.remove("hidden");
    }

    ui.initDuckSelection((index) => {
        dbService.updateDuckSelection(roomId, state.user.uid, index, state.players);
        ui.highlightSelectedDuck(index);
    });

    // Subscribe to Room Updates
    dbService.subscribeToRoom(roomId, (data) => {
        // NEW: Handle Room Deletion (data is null if doc deleted)
        if (!data) {
            alert("The host has closed the room.");
            resetToLobby();
            return;
        }

        console.log("Room Update:", data); // DEBUG

        state.players = data.players || {};
        const readyCount = ui.updateLobbyPlayers(state.players, state.user.uid);

        if (isHost) startBtn.disabled = readyCount === 0;

        if (data.status === "racing" && state.raceStatus === "lobby") {
            console.log("🏁 Race Signal Received! Seed:", data.seed);
            const raceSeed = data.seed || 123456;
            startRace(raceSeed);
        } else if (data.status === "lobby" && state.raceStatus !== "lobby") {
            // Soft reset (back to lobby for rematch)
            state.raceStatus = "lobby";
            engine.stop();
            ui.showPanel("lobby");
            ui.initDuckSelection((index) => {
                dbService.updateDuckSelection(state.room, state.user.uid, index, state.players);
                ui.highlightSelectedDuck(index);
            });
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
    console.log("🚀 Starting Client Engine with seed:", seed);
    state.raceStatus = "racing";
    ui.showPanel("game");

    engine.start(seed, (finishOrder) => {
        state.raceStatus = "finished";
        console.log("🏆 Race Finished", finishOrder);

        setTimeout(() => {
            ui.showPanel("results");
            const myDuck = state.players[state.user.uid]?.duckIndex;
            ui.showResults(finishOrder, state.players, myDuck, state.user.uid);

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
    state.room = null; // Clear room
    state.isHost = false;
    engine.stop();
    ui.showPanel("start"); // Go back to START panel, not lobby panel
}
