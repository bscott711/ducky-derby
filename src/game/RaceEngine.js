import { MIN_RACERS, NET_OFFSET, NPC_NAMES, PHYSICS, RACE_DISTANCE } from "../config.js";
import { mulberry32 } from "../utils/rng.js";
import { LevelGenerator } from "./LevelGenerator.js";
import { Renderer } from "./Renderer.js";

// Systems
import { HunterSystem } from "./systems/HunterSystem.js";
import { PhysicsSystem } from "./systems/PhysicsSystem.js";
import { PowerupSystem } from "./systems/PowerupSystem.js";

export class RaceEngine {
    constructor() {
        this.renderer = new Renderer("game-canvas");

        this.animationId = null;
        this.ducks = [];
        this.riverPath = [];
        this.obstacles = [];
        this.decorations = [];
        this.rapids = [];
        this.whirlpools = [];
        this.powerupBoxes = [];
        this.hunters = [];

        this.cameraY = 0;
        this.cameraX = PHYSICS.GAME_WIDTH / 2;
        this.finishLineY = RACE_DISTANCE;
        this.raceFinished = false;
        this.globalTime = 0;

        this.followId = null;
        this.postRaceTimer = 0;

        this.accumulator = 0;
        this.lastTime = 0;
        this.FIXED_TIME_STEP = 1 / 60;

        // Systems
        this.physicsSystem = null;
        this.powerupSystem = null;
        this.hunterSystem = null;
    }

    setFollowId(id) {
        this.followId = id;
    }

    setup(seedVal, players) {
        const currentSeed = seedVal || Date.now();
        this.rng = mulberry32(currentSeed);

        this.physicsSystem = new PhysicsSystem(this.rng);
        this.powerupSystem = new PowerupSystem(this.rng);
        this.hunterSystem = new HunterSystem();

        this.raceFinished = false;
        this.globalTime = 0;
        this.accumulator = 0;
        this.postRaceTimer = 0;

        const levelGen = new LevelGenerator(currentSeed);
        const levelData = levelGen.generate();

        this.riverPath = levelData.riverPath;
        this.obstacles = levelData.obstacles;
        this.decorations = levelData.decorations;
        this.rapids = levelData.rapids;
        this.whirlpools = levelData.whirlpools;
        this.powerupBoxes = levelData.powerupBoxes;
        this.hunters = levelData.hunters;

        // Reset Ducks
        this.ducks = [];

        // 1. Add Real Players
        for (const p of players) {
            this.addRacer(p, true);
        }

        // 2. Fill with NPCs
        const needed = MIN_RACERS - this.ducks.length;
        for (let i = 0; i < needed; i++) {
            const nameIdx = Math.floor(this.rng() * NPC_NAMES.length);
            this.addRacer(
                {
                    id: `npc-${i}`,
                    name: `${NPC_NAMES[nameIdx]}`,
                    config: { body: this.getSeededColor(), beak: this.getSeededColor() },
                    isNPC: true,
                },
                true,
            );
        }

        // Set Camera Start
        const startSeg = this.riverPath[0];
        this.cameraX = startSeg.centerX;
        this.cameraY = -200;

        this.render();
    }

    // NEW: Adds a single duck (used for setup AND late joiners)
    addRacer(playerData, isSetup = false) {
        // Prevent duplicates
        if (this.ducks.find((d) => d.id === playerData.id)) return;

        const bridgeY = -200;
        // FIX: Calculate the river segment index corresponding to the bridge's Y position.
        const segmentIndex = Math.floor((bridgeY + 500) / 5);
        const segment = this.riverPath[segmentIndex] || this.riverPath[0];
        const bridgeCenterX = segment.centerX;

        const bridgeWidth = PHYSICS.RIVER_WIDTH + 140;
        const archHeight = 60;

        // Use seeded RNG for setup, random for late joiners (prevents stacking)
        const rand = isSetup ? this.rng() : Math.random();

        const spread = bridgeWidth * 0.6;
        const jitterX = (rand - 0.5) * spread;
        const startX = bridgeCenterX + jitterX; // Use the corrected center X
        const startZ = archHeight * (1 - (jitterX / (bridgeWidth / 2)) ** 2) + 20;

        this.ducks.push({
            id: playerData.id,
            name: playerData.name,
            color: playerData.config?.body || "#fff",
            beak: playerData.config?.beak || "#ffa500",
            x: startX,
            y: bridgeY,
            z: startZ,
            vz: 0,
            vx: 0,
            vy: 0,
            radius: PHYSICS.DUCK_RADIUS,
            mass: PHYSICS.DUCK_MASS,
            finished: false,
            finishTime: 0,
            trapTimer: 0,
            cooldownTimer: 0,
            effect: null,
            effectTimer: 0,
            originalRadius: PHYSICS.DUCK_RADIUS,
            facingRight: rand > 0.5,
        });
    }

    getSeededColor() {
        const val = Math.floor(this.rng() * 16777215)
            .toString(16)
            .padStart(6, "0");
        return `#${val}`;
    }

    run(onFinish) {
        this.onFinishCallback = onFinish;
        this.lastTime = performance.now();
        this.loop();
    }

    loop() {
        const now = performance.now();
        let dt = (now - this.lastTime) / 1000;
        this.lastTime = now;
        if (dt > 0.25) dt = 0.25;

        this.accumulator += dt;
        while (this.accumulator >= this.FIXED_TIME_STEP) {
            this.updateGameLogic();
            this.globalTime += this.FIXED_TIME_STEP;
            this.accumulator -= this.FIXED_TIME_STEP;
        }

        this.updateCamera();
        this.render();

        if (!this.raceFinished) {
            this.animationId = requestAnimationFrame(() => this.loop());
        }
    }

    updateGameLogic() {
        const timeScale = 1.0;

        // Update Sub-Systems
        this.hunterSystem.update(this.hunters, this.ducks, timeScale);
        this.powerupSystem.update(this.ducks, this.powerupBoxes, timeScale);

        // Update Physics
        this.physicsSystem.update(timeScale, {
            ducks: this.ducks,
            riverPath: this.riverPath,
            rapids: this.rapids,
            whirlpools: this.whirlpools,
            obstacles: this.obstacles,
            finishLineY: this.finishLineY,
        });

        // Race Completion Check
        // Only end if we have ducks and ALL are finished
        const finishedCount = this.ducks.filter((d) => d.finished).length;
        if (this.ducks.length > 0 && finishedCount === this.ducks.length) {
            if (this.postRaceTimer === 0) this.postRaceTimer = 300;
            this.postRaceTimer--;
            if (this.postRaceTimer <= 0) {
                this.endRace();
            }
        }
    }

    updateCamera() {
        let targetDuck = null;

        // 1. Follow User
        if (this.followId) {
            targetDuck = this.ducks.find((d) => d.id === this.followId);
        }

        // 2. Or Follow Leader
        if (!targetDuck) {
            let maxY = Number.NEGATIVE_INFINITY;
            for (const d of this.ducks) {
                if (d.y > maxY) {
                    maxY = d.y;
                    targetDuck = d;
                }
            }
        }

        if (targetDuck) {
            const targetCamX = targetDuck.x;
            this.cameraX += (targetCamX - this.cameraX) * 0.02;

            const viewOffset = 220;
            let targetCamY = targetDuck.y + viewOffset;

            const maxCamY = this.finishLineY + NET_OFFSET - 200;
            if (targetCamY > maxCamY) {
                targetCamY = maxCamY;
                const endSeg = this.riverPath[Math.floor((this.finishLineY + NET_OFFSET) / 5)];
                if (endSeg) {
                    this.cameraX += (endSeg.centerX - this.cameraX) * 0.03;
                }
            }
            this.cameraY += (targetCamY - this.cameraY) * 0.05;
        }
    }

    render() {
        this.renderer.draw({
            cameraY: this.cameraY,
            cameraX: this.cameraX,
            ducks: this.ducks,
            riverPath: this.riverPath,
            obstacles: this.obstacles,
            decorations: this.decorations,
            whirlpools: this.whirlpools,
            rapids: this.rapids,
            powerupBoxes: this.powerupBoxes,
            hunters: this.hunters,
            globalTime: this.globalTime,
        });
    }

    endRace() {
        this.raceFinished = true;
        this.ducks.sort((a, b) => a.finishTime - b.finishTime);
        const finishOrder = this.ducks.map((d) => ({
            id: d.id,
            config: { body: d.color, beak: d.beak },
            name: d.name,
        }));
        if (this.onFinishCallback) this.onFinishCallback(finishOrder);
    }

    stop() {
        cancelAnimationFrame(this.animationId);
    }
}
