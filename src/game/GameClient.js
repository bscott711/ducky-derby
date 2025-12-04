import { authService, dbService } from "../services/index.js";
import { debounce, getRandomDuckConfig } from "../utils/helpers.js";
import { RaceEngine } from "./RaceEngine.js";

export class GameClient {
    constructor(uiManager) {
        this.ui = uiManager;
        this.engine = new RaceEngine();

        this.user = null;
        this.worldState = null;
        this.players = {};

        // Local state machine
        this.currentState = "unknown"; // 'lobby' | 'racing'
        this.controlsInitialized = false;

        // Timer & Host Logic
        this.lobbyInterval = null;
        this.hostStarting = false;

        this.init();
    }

    init() {
        // Camera Toggle
        this.ui.setupCameraListener(() => {
            if (this.engine.followId === this.user?.uid) {
                this.engine.setFollowId(null);
                return "Leader";
            }
            this.engine.setFollowId(this.user?.uid);
            return "Me";
        });

        authService.onAuthStateChanged((user) => {
            if (user) {
                this.user = user;
                this.onAuthSuccess();
            } else {
                authService.signIn();
            }
        });
    }

    onAuthSuccess() {
        // Bind Start Button
        const joinBtn = document.getElementById("join-world-btn");
        const nameInput = document.getElementById("player-name-input");

        // Pre-fill name
        const storedName = localStorage.getItem("ducky_name");
        if (storedName) nameInput.value = storedName;

        joinBtn.onclick = () => {
            const name = nameInput.value || "Guest";
            localStorage.setItem("ducky_name", name);
            this.joinWorld(name);
        };
    }

    async joinWorld(name) {
        const defaultDuck = getRandomDuckConfig();

        // 1. Register in DB
        await dbService.joinWorld(this.user.uid, name, defaultDuck);

        // 2. Init UI
        this.ui.showPanel("lobby");

        // 3. Subscribe to Chat
        dbService.subscribeToChat((msgs) => this.ui.chat.renderMessages(msgs));
        this.ui.chat.setupSendListener((text) => {
            const myName = this.players[this.user.uid]?.name || "Anon";
            dbService.sendChatMessage(this.user.uid, myName, text);
        });

        // 4. Subscribe to Players
        dbService.subscribeToPlayers((players) => {
            this.players = players;
            this.ui.updateLobbyPlayers(players, this.user.uid);

            // Sync My Config (This logic remains)
            const me = this.players[this.user.uid];
            if (me && !this.controlsInitialized) {
                const debouncedUpdate = debounce((cfg) => {
                    dbService.updatePlayerConfig(this.user.uid, cfg);
                }, 300);
                this.ui.initCustomization(me.config, debouncedUpdate);
                this.controlsInitialized = true;
            }
        });

        // 5. Subscribe to World State (The Heartbeat)
        dbService.subscribeToWorld((data) => this.handleWorldUpdate(data));
    }

    handleWorldUpdate(data) {
        this.worldState = data;

        // --- Client State Transitions ---
        if (data.status === "lobby") {
            if (this.currentState !== "lobby") {
                this.currentState = "lobby";
                this.ui.showPanel("lobby");
                this.engine.stop();

                // Reset Host Logic
                this.hostStarting = false;

                // Start Local Timer Loop
                if (this.lobbyInterval) clearInterval(this.lobbyInterval);
                this.lobbyInterval = setInterval(() => this.lobbyTick(), 1000);
                this.lobbyTick(); // Immediate update
            }
        } else if (data.status === "racing") {
            // 1. If we are already racing or spectating, ignore redundant updates
            if (this.currentState === "racing" || this.currentState === "spectating") return;

            // 2. Late Joiner Check: If we load in (unknown state) and the race is ON, we must spectate
            if (this.currentState === "unknown") {
                this.currentState = "spectating";
                this.ui.showPanel("lobby");
                this.ui.updateLobbyTimer("Race in Progress... (Wait for next round)");
                this.engine.stop();
                return;
            }

            // 3. Normal Transition: Lobby -> Racing
            if (this.lobbyInterval) {
                clearInterval(this.lobbyInterval);
                this.lobbyInterval = null;
            }
            this.startRace(data.seed);
        }
    }

    lobbyTick() {
        if (!this.worldState || this.currentState !== "lobby") return;

        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((this.worldState.startTime - now) / 1000));

        // Update UI
        this.ui.updateLobbyTimer(`Next Race: ${remaining}s`);

        // --- Host Logic ---
        // Distributed Host: The alphabetically first player is the "Soft Host"
        // We run this check every second to trigger the race when time runs out
        const playerIds = Object.keys(this.players).sort();
        const isHost = playerIds.length > 0 && playerIds[0] === this.user.uid;

        if (isHost && now >= this.worldState.startTime) {
            if (!this.hostStarting) {
                this.hostStarting = true;
                console.log("HOST: Timer complete, starting race...");
                dbService.setRaceStatus("racing");
            }
        }
    }

    startRace(seed) {
        this.currentState = "racing";
        this.ui.showPanel("game");

        // Start Engine with current players
        this.engine.setup(seed, Object.values(this.players));

        // Auto-Cam
        this.engine.setFollowId(this.user.uid);
        this.ui.camBtn.textContent = "🎥 Camera: Me";

        this.ui.runCountdown(() => {
            this.engine.run((finishOrder) => this.onLocalRaceFinish(finishOrder));
        });
    }

    onLocalRaceFinish(finishOrder) {
        this.ui.showPanel("results");
        const myName = this.players[this.user.uid]?.name;
        const myRank = finishOrder.findIndex((d) => d.name === myName);
        this.ui.showResults(finishOrder, this.players, myRank, this.user.uid);

        // If I am Host, queue the reset
        const playerIds = Object.keys(this.players).sort();
        const isHost = playerIds.length > 0 && playerIds[0] === this.user.uid;

        if (isHost) {
            // Wait 8 seconds for everyone to see results, then back to lobby
            setTimeout(() => {
                dbService.resetWorldState();
            }, 8000);
        }
    }
}
