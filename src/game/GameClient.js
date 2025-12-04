import { authService, dbService } from "../services/firebase.js";
import { debounce, getRandomDuckConfig } from "../utils/helpers.js";
import { RaceEngine } from "./RaceEngine.js";

export class GameClient {
    constructor(uiManager) {
        this.ui = uiManager;
        this.engine = new RaceEngine();

        // Application State
        this.user = null;
        this.room = null;
        this.isHost = false;
        this.players = {};
        this.raceStatus = "lobby";

        this.chatUnsub = null;
        this.roomUnsub = null;
        this.controlsInitialized = false;

        this.init();
    }

    init() {
        this.setupGlobalListeners();

        authService.onAuthStateChanged((user) => {
            if (user) {
                this.user = user;
                this.onAuthSuccess();
            } else {
                authService.signIn();
            }
        });
    }

    setupGlobalListeners() {
        // Camera Toggle
        this.ui.setupCameraListener(() => {
            if (this.engine.followId === this.user?.uid) {
                this.engine.setFollowId(null);
                return "Leader";
            }
            this.engine.setFollowId(this.user?.uid);
            return "Me";
        });

        // DOM Event Listeners
        document
            .getElementById("create-room-btn")
            .addEventListener("click", () => this.handleCreateRoom());
        document
            .getElementById("join-room-btn")
            .addEventListener("click", () => this.handleJoinPrivate());
        document
            .getElementById("start-race-btn")
            .addEventListener("click", () => this.handleStartRace());
        document
            .getElementById("back-to-lobby-btn")
            .addEventListener("click", () => this.handleBackToLobby());
        document
            .getElementById("delete-room-btn")
            .addEventListener("click", () => this.handleDeleteRoom());
    }

    onAuthSuccess() {
        dbService.subscribeToPublicRooms((rooms) => {
            if (!this.room) {
                this.ui.updateRoomList(rooms, (id) => this.handleJoinRoom(id));
            }
        });
    }

    // --- Room Actions ---

    async handleCreateRoom() {
        const name = document.getElementById("player-name-input").value || "Host";
        const isPublic = document.getElementById("is-public-check").checked;
        const defaultDuck = getRandomDuckConfig();

        try {
            const roomId = await dbService.createRoom(this.user.uid, name, isPublic, defaultDuck);
            this.enterLobby(roomId, true);
        } catch (e) {
            console.error("Create Room Error:", e);
        }
    }

    handleJoinPrivate() {
        const code = document.getElementById("room-code-input").value.toUpperCase();
        if (code) this.handleJoinRoom(code);
    }

    async handleJoinRoom(roomId) {
        const name = document.getElementById("player-name-input").value || "Guest";
        const defaultDuck = getRandomDuckConfig();

        try {
            const hostId = await dbService.joinRoom(roomId, this.user.uid, name, defaultDuck);
            const isMeHost = hostId === this.user.uid;
            this.enterLobby(roomId, isMeHost);
        } catch (e) {
            alert(e.message);
        }
    }

    async handleDeleteRoom() {
        if (confirm("Are you sure you want to close this room? Everyone will be kicked.")) {
            try {
                await dbService.deleteRoom(this.room);
            } catch (e) {
                console.error("Delete Room Error:", e);
            }
        }
    }

    // --- Lobby Logic ---

    enterLobby(roomId, isHost) {
        this.room = roomId;
        this.isHost = isHost;
        this.raceStatus = "lobby";

        this.ui.showPanel("lobby");
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
            dbService.updatePlayerConfig(roomId, this.user.uid, newConfig, this.players);
        }, 300);

        if (this.chatUnsub) this.chatUnsub();
        this.chatUnsub = dbService.subscribeToChat(roomId, (msgs) => {
            this.ui.chat.renderMessages(msgs);
        });
        this.ui.chat.setupSendListener((text) => {
            const myName = this.players[this.user.uid]?.name || "Anon";
            dbService.sendChatMessage(roomId, this.user.uid, myName, text);
        });

        if (this.roomUnsub) this.roomUnsub();
        this.roomUnsub = dbService.subscribeToRoom(roomId, (data) => this.onRoomDataUpdate(data));
    }

    onRoomDataUpdate(data) {
        if (!data) {
            alert("Room closed.");
            this.resetToLobby();
            return;
        }

        this.players = data.players || {};
        this.ui.updateLobbyPlayers(this.players, this.user.uid);

        const me = this.players[this.user.uid];
        if (me?.config && !this.controlsInitialized) {
            const debouncedUpdate = debounce((newConfig) => {
                dbService.updatePlayerConfig(this.room, this.user.uid, newConfig, this.players);
            }, 300);

            this.ui.initCustomization(me.config, (cfg) => debouncedUpdate(cfg));
            this.controlsInitialized = true;
        }

        if (data.status === "racing" && this.raceStatus === "lobby") {
            console.log("Rx Race Signal. Seed:", data.seed);
            this.beginRaceSequence(data.seed || 123456);
        } else if (data.status === "lobby" && this.raceStatus !== "lobby") {
            this.returnToLobbyState();
        }
    }

    // --- Race Logic ---

    async handleStartRace() {
        if (this.isHost) {
            const seed = Math.floor(Math.random() * 1000000);
            await dbService.startRace(this.room, seed);
        }
    }

    beginRaceSequence(seed) {
        console.log("Starting Engine with seed:", seed);
        this.raceStatus = "racing";
        this.ui.showPanel("game");

        const realPlayers = Object.entries(this.players).map(([id, data]) => ({
            id,
            ...data,
        }));

        this.engine.setup(seed, realPlayers);
        this.engine.setFollowId(null);
        this.ui.camBtn.textContent = "🎥 Camera: Leader";

        this.ui.runCountdown(() => {
            this.engine.run((finishOrder) => this.onRaceFinish(finishOrder));
        });
    }

    onRaceFinish(finishOrder) {
        this.raceStatus = "finished";
        console.log("Race Finished", finishOrder);

        setTimeout(() => {
            this.ui.showPanel("results");
            const myName = this.players[this.user.uid]?.name;
            const myRank = finishOrder.findIndex((d) => d.name === myName);
            this.ui.showResults(finishOrder, this.players, myRank, this.user.uid);

            const backBtn = document.getElementById("back-to-lobby-btn");
            if (this.isHost) {
                backBtn.textContent = "Back to Lobby";
                backBtn.disabled = false;
            } else {
                backBtn.textContent = "Waiting for Host...";
                backBtn.disabled = true;
            }
        }, 1000);
    }

    async handleBackToLobby() {
        if (this.isHost) {
            await dbService.resetLobby(this.room);
        }
    }

    returnToLobbyState() {
        this.raceStatus = "lobby";
        this.ui.showPanel("lobby");
        this.engine.stop();
    }

    resetToLobby() {
        this.raceStatus = "lobby";
        this.room = null;
        this.isHost = false;
        this.controlsInitialized = false;

        if (this.chatUnsub) this.chatUnsub();
        if (this.roomUnsub) this.roomUnsub();

        this.engine.stop();
        this.ui.showPanel("start");
    }
}
