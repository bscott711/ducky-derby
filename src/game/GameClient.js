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

        // Keep-Alive
        this.heartbeat = null;

        this.init();
    }

    init() {
        // [!code ++] EXIT SIGNAL: Immediately remove player on tab close
        window.addEventListener("beforeunload", () => {
            if (this.user?.uid) {
                dbService.leaveWorld(this.user.uid);
            }
        });

        // Camera Toggle (Me -> Leader -> Last -> Me)
        this.ui.setupCameraListener(() => {
            const current = this.engine.followId;
            const myId = this.user?.uid;

            if (current === myId && myId) {
                this.engine.setFollowId(null);
                return "Leader";
            }

            if (current === null) {
                this.engine.setFollowId("LAST");
                return "Last";
            }

            this.engine.setFollowId(myId);
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

    // ... [Keep onAuthSuccess, joinWorld, startHeartbeat, handleWorldUpdate unchanged] ...

    // [!code ++] Re-paste these to ensure context, but they remain largely the same until lobbyTick
    onAuthSuccess() {
        // Bind Start Button
        const joinBtn = document.getElementById("join-world-btn");
        const nameInput = document.getElementById("player-name-input");
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
        await dbService.joinWorld(this.user.uid, name, defaultDuck);

        this.ui.showPanel("lobby");
        dbService.subscribeToLeaderboard((data) => this.ui.updateLeaderboard(data));
        dbService.subscribeToChat((msgs) => this.ui.chat.renderMessages(msgs));
        this.ui.chat.setupSendListener((text) => {
            const myName = this.players[this.user.uid]?.name || "Anon";
            dbService.sendChatMessage(this.user.uid, myName, text);
        });

        dbService.subscribeToPlayers((players) => {
            this.players = players;
            this.ui.updateLobbyPlayers(players, this.user.uid);

            const me = this.players[this.user.uid];
            if (me && !this.controlsInitialized) {
                const debouncedUpdate = debounce((cfg) => {
                    dbService.updatePlayerConfig(this.user.uid, cfg);
                }, 300);
                this.ui.initCustomization(me.config, debouncedUpdate);
                this.controlsInitialized = true;
            }
        });

        dbService.subscribeToWorld((data) => this.handleWorldUpdate(data));
        this.startHeartbeat();
    }

    startHeartbeat() {
        if (this.heartbeat) clearInterval(this.heartbeat);
        this.heartbeat = setInterval(() => {
            if (this.user?.uid) dbService.ping(this.user.uid);
        }, 60000);
    }

    handleWorldUpdate(data) {
        this.worldState = data;

        if (data.status === "lobby") {
            if (this.currentState !== "lobby") {
                this.currentState = "lobby";
                this.ui.showPanel("lobby");
                this.engine.stop();
                this.hostStarting = false;

                if (this.lobbyInterval) clearInterval(this.lobbyInterval);
                this.lobbyInterval = setInterval(() => this.lobbyTick(), 1000);
                this.lobbyTick();
            }
        } else if (data.status === "racing") {
            if (this.currentState === "racing" || this.currentState === "spectating") return;

            if (this.currentState === "unknown") {
                this.currentState = "spectating";
                this.ui.showPanel("lobby");
                this.ui.updateLobbyTimer("Race in Progress... (Wait for next round)");
                this.engine.stop();

                // [!code ++] Even spectators should check if the race is stuck!
                this.lobbyTick();
                return;
            }

            if (this.lobbyInterval) {
                clearInterval(this.lobbyInterval);
                this.lobbyInterval = null;
            }
            this.startRace(data.seed);
        }
    }

    lobbyTick() {
        // [!code ++] Allow ticking even if not in lobby (for Host Stale Check)
        if (!this.worldState) return;

        const now = Date.now();

        // Only update UI if we are actually in the lobby
        if (this.currentState === "lobby") {
            const remaining = Math.max(0, Math.ceil((this.worldState.startTime - now) / 1000));
            this.ui.updateLobbyTimer(`Next Race: ${remaining}s`);
        }

        // --- Host Logic ---
        const playerIds = Object.keys(this.players).sort();
        const isHost = playerIds.length > 0 && playerIds[0] === this.user.uid;

        if (isHost) {
            // Case 1: LOBBY -> RACING
            if (
                this.worldState.status === "lobby" &&
                now >= this.worldState.startTime &&
                !this.hostStarting
            ) {
                this.hostStarting = true;
                console.log("HOST: Timer complete, starting race...");
                dbService.setRaceStatus("racing");
            }

            // [!code ++] Case 2: STALE RACE RECOVERY
            // If the world says "racing" but it's been more than 60 seconds since start time,
            // assume the previous host crashed and FORCE RESET.
            if (this.worldState.status === "racing" && now - this.worldState.startTime > 60000) {
                console.warn("HOST: Detected stale race (>60s). Forcing reset.");
                dbService.resetWorldState();
            }
        }
    }

    // ... [Keep startRace and onLocalRaceFinish unchanged] ...
    startRace(seed) {
        this.currentState = "racing";
        this.ui.showPanel("game");
        this.engine.setup(seed, Object.values(this.players));
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
        if (myRank === 0) {
            console.log("Champion! Recording win...");
            dbService.recordWin(this.user.uid, myName);
        }

        const playerIds = Object.keys(this.players).sort();
        const isHost = playerIds.length > 0 && playerIds[0] === this.user.uid;

        if (isHost) {
            setTimeout(() => {
                dbService.resetWorldState();
            }, 8000);
        }
    }
}
