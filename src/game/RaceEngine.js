import { MIN_RACERS, NET_OFFSET, NPC_NAMES, PHYSICS, POWERUPS, RACE_DISTANCE } from "../config.js";
import { mulberry32 } from "../utils/rng.js";
import { LevelGenerator } from "./LevelGenerator.js";
import { Renderer } from "./Renderer.js";

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

        this.cameraY = 0;
        this.finishLineY = RACE_DISTANCE;
        this.raceFinished = false;
        this.globalTime = 0;

        // Fixed Timestep Variables
        this.accumulator = 0;
        this.lastTime = 0;
        this.FIXED_TIME_STEP = 1 / 60;
    }

    setup(seedVal, players) {
        const currentSeed = seedVal || Date.now();
        this.rng = mulberry32(currentSeed);
        this.raceFinished = false;
        this.globalTime = 0;
        this.accumulator = 0;

        // 1. Generate World
        const levelGen = new LevelGenerator(currentSeed);
        const levelData = levelGen.generate();

        this.riverPath = levelData.riverPath;
        this.obstacles = levelData.obstacles;
        this.decorations = levelData.decorations;
        this.rapids = levelData.rapids;
        this.whirlpools = levelData.whirlpools;
        this.powerupBoxes = levelData.powerupBoxes;

        // 2. Prepare Racers
        const racerList = Object.values(players).sort((a, b) =>
            (a.id || "").localeCompare(b.id || ""),
        );

        if (racerList.length < MIN_RACERS) {
            const needed = MIN_RACERS - racerList.length;
            for (let i = 0; i < needed; i++) {
                const nameIdx = Math.floor(this.rng() * NPC_NAMES.length);
                const config = {
                    body: this.getSeededColor(),
                    beak: this.getSeededColor(),
                };
                racerList.push({
                    name: `${NPC_NAMES[nameIdx]} #${i + 1}`,
                    config: config,
                    isNPC: true,
                    id: `npc-${i}`,
                });
            }
        }

        // 3. Spawn Ducks
        this.ducks = [];
        const bridgeY = -200;
        const segmentIndex = Math.floor((bridgeY + 500) / 5);
        const segment = this.riverPath[segmentIndex] || this.riverPath[0];
        const bridgeWidth = PHYSICS.RIVER_WIDTH + 140;
        const archHeight = 60;

        for (const p of racerList) {
            const spread = bridgeWidth * 0.6;
            const jitterX = (this.rng() - 0.5) * spread;
            const normX = jitterX / (bridgeWidth / 2);

            const heightOnArch = archHeight * (1 - normX * normX);
            const startZ = heightOnArch + 20 + this.rng() * 10;
            const startX = segment.centerX;

            this.ducks.push({
                id: p.name,
                name: p.name,
                color: p.config.body,
                beak: p.config.beak,
                x: startX + jitterX,
                y: bridgeY,
                z: startZ,
                vz: 0,
                vx: 0,
                vy: 0,
                radius: PHYSICS.DUCK_RADIUS,
                mass: PHYSICS.DUCK_MASS,
                finished: false,
                trapTimer: 0,
                cooldownTimer: 0,
                effect: null,
                effectTimer: 0,
                originalRadius: PHYSICS.DUCK_RADIUS,
            });
        }

        const leaderVisualY = Math.max(...this.ducks.map((d) => d.y - d.z));
        this.cameraY = leaderVisualY - this.renderer.height * 0.4;

        this.render();
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
            this.updatePhysics();
            this.globalTime += this.FIXED_TIME_STEP;
            this.accumulator -= this.FIXED_TIME_STEP;
        }

        this.render();

        if (!this.raceFinished) {
            this.animationId = requestAnimationFrame(() => this.loop());
        }
    }

    updatePhysics() {
        const timeScale = 1.0;
        let finishedCount = 0;
        const netY = this.finishLineY + NET_OFFSET;

        for (const duck of this.ducks) {
            if (duck.finished) {
                finishedCount++;
            }

            // Gravity / Z-axis
            if (duck.z > 0) {
                duck.vz -= PHYSICS.GRAVITY * timeScale;
                duck.z += duck.vz * timeScale;
                if (duck.z <= 0) {
                    duck.z = 0;
                    duck.vz = 0;
                }
                continue;
            }

            // Powerups
            if (duck.effect) {
                duck.effectTimer -= timeScale;
                if (duck.effectTimer <= 0) {
                    duck.effect = null;
                    duck.radius = duck.originalRadius;
                }
            }

            // Giant Gravity (Disabled if finished to avoid disrupting the pile-up)
            if (duck.effect === "GIANT" && !duck.finished) {
                for (const other of this.ducks) {
                    if (other === duck || other.finished) continue;
                    const dx = duck.x - other.x;
                    const dy = duck.y - other.y;
                    const distSq = dx ** 2 + dy ** 2;

                    if (distSq < POWERUPS.GIANT_RANGE ** 2) {
                        const dist = Math.sqrt(distSq);
                        const force =
                            (1 - dist / POWERUPS.GIANT_RANGE) * POWERUPS.GIANT_GRAVITY * timeScale;
                        other.vx += (dx / dist) * force;
                        other.vy += (dy / dist) * force;
                    }
                }
            }

            if (duck.cooldownTimer > 0) duck.cooldownTimer -= timeScale;

            // NET COLLISION (The Catch Logic)
            if (duck.y + duck.radius > netY) {
                duck.y = netY - duck.radius;
                duck.vy = 0;
                duck.vx *= 0.9; // Horizontal friction on the net
            } else {
                // Normal River Movement Logic
                const segmentIndex = Math.floor((duck.y + 500) / 5);
                const currentSeg = this.riverPath[segmentIndex];
                const nextSeg = this.riverPath[segmentIndex + 20];

                let inRapid = false;
                for (const rapid of this.rapids) {
                    if (duck.y >= rapid.startY && duck.y <= rapid.endY) {
                        inRapid = true;
                        break;
                    }
                }

                // Whirlpools
                let trapped = false;
                if (duck.cooldownTimer <= 0 && duck.effect !== "GHOST" && !duck.finished) {
                    for (const pool of this.whirlpools) {
                        const dx = duck.x - pool.x;
                        const dy = duck.y - pool.y;
                        const dist = Math.sqrt(dx ** 2 + dy ** 2);

                        if (dist < pool.radius * 1.5) {
                            trapped = true;
                            duck.trapTimer += timeScale;
                            const tx = -dy / dist;
                            const ty = dx / dist;
                            duck.vx -= (dx / dist) * PHYSICS.WHIRLPOOL_PULL * timeScale;
                            duck.vy -= (dy / dist) * PHYSICS.WHIRLPOOL_PULL * timeScale;
                            duck.vx += tx * PHYSICS.WHIRLPOOL_SPIN * timeScale;
                            duck.vy += ty * PHYSICS.WHIRLPOOL_SPIN * timeScale;

                            if (duck.trapTimer > PHYSICS.WHIRLPOOL_HOLD_TIME) {
                                duck.vy += 15;
                                duck.trapTimer = 0;
                                duck.cooldownTimer = 120;
                            }
                        }
                    }
                }
                if (!trapped) duck.trapTimer = Math.max(0, duck.trapTimer - timeScale);

                // Flow
                if (duck.trapTimer < 60) {
                    let flowX = 0;
                    let flowY = 1;

                    if (currentSeg && nextSeg) {
                        const dx = nextSeg.centerX - currentSeg.centerX;
                        const dy = nextSeg.y - currentSeg.y;
                        const len = Math.sqrt(dx ** 2 + dy ** 2);
                        flowX = dx / len;
                        flowY = dy / len;
                    }

                    let speed = PHYSICS.FLOW_SPEED;
                    let turb = PHYSICS.TURBULENCE;

                    if (inRapid) {
                        speed += PHYSICS.RAPID_SPEED_BOOST;
                        turb = PHYSICS.RAPID_TURBULENCE;
                    }

                    if (currentSeg) {
                        const leftBank = currentSeg.centerX - currentSeg.width / 2;
                        const rightBank = currentSeg.centerX + currentSeg.width / 2;
                        const distToBank = Math.min(duck.x - leftBank, rightBank - duck.x);
                        if (distToBank < PHYSICS.BANK_FRICTION_ZONE) {
                            const zoneFactor = Math.max(0, distToBank / PHYSICS.BANK_FRICTION_ZONE);
                            const speedMod =
                                PHYSICS.BANK_FLOW_MODIFIER +
                                (1 - PHYSICS.BANK_FLOW_MODIFIER) * zoneFactor;
                            speed *= speedMod;
                        }
                    }

                    duck.vx += flowX * speed * timeScale;
                    duck.vy += flowY * speed * timeScale;
                    duck.vx += (this.rng() - 0.5) * turb * timeScale;
                }

                // Friction
                let frictionVal = 0.96;
                if (duck.effect === "ANCHOR") frictionVal = POWERUPS.ANCHOR_DRAG;
                const friction = frictionVal ** timeScale;
                duck.vx *= friction;
                duck.vy *= friction;

                duck.x += duck.vx * timeScale;
                duck.y += duck.vy * timeScale;

                if (duck.y >= this.finishLineY && !duck.finished) {
                    duck.finished = true;
                    duck.finishTime = performance.now();
                }
            }
        }

        // Collisions
        for (const duck of this.ducks) {
            if (duck.finished || duck.z > 0) continue;
            for (const box of this.powerupBoxes) {
                if (!box.active) continue;
                if (
                    Math.abs(duck.x - box.x) < POWERUPS.BOX_SIZE &&
                    Math.abs(duck.y - box.y) < POWERUPS.BOX_SIZE
                ) {
                    this.collectPowerup(duck, box);
                }
            }
        }

        // Collision Resolution (Updated: Allow finished ducks to bump into each other)
        for (let i = 0; i < this.ducks.length; i++) {
            for (let j = i + 1; j < this.ducks.length; j++) {
                const d1 = this.ducks[i];
                const d2 = this.ducks[j];

                // Allow collision if finished (for net pile-up), but skip if falling
                if (d1.z > 0 || d2.z > 0) continue;
                if (d1.effect === "GHOST" || d2.effect === "GHOST") continue;

                this.resolveCollision(d1, d2);
            }
        }

        for (const duck of this.ducks) {
            if (duck.z > 0) continue;
            this.resolveWallCollision(duck);
            if (duck.effect === "GHOST") continue;
            for (const rock of this.obstacles) {
                if (Math.abs(rock.y - duck.y) > 60) continue;
                this.resolveRockCollision(duck, rock);
            }
        }

        // Camera Logic (Clamped so finish line remains in view)
        const leaderVisualY = Math.max(...this.ducks.map((d) => d.y - d.z));
        let targetCamY = leaderVisualY - this.renderer.height * 0.4;

        // Clamp: Ensure the finish line never scrolls off the top
        // (Keep finish line at least 200px from the top)
        const maxCamY = this.finishLineY - 200;
        if (targetCamY > maxCamY) {
            targetCamY = maxCamY;
        }

        this.cameraY += (targetCamY - this.cameraY) * 0.05;

        if (finishedCount === this.ducks.length) {
            this.endRace();
        }
    }

    collectPowerup(duck, box) {
        box.active = false;
        const typeIndex = Math.floor(this.rng() * POWERUPS.TYPES.length);
        const type = POWERUPS.TYPES[typeIndex];
        duck.effect = type;
        duck.effectTimer = POWERUPS.DURATION;
        if (type === "GIANT") {
            duck.radius = duck.originalRadius * POWERUPS.GIANT_SCALE;
        } else if (type === "SPEED") {
            duck.vy += POWERUPS.SPEED_FORCE;
        }
    }

    resolveCollision(d1, d2) {
        const dx = d2.x - d1.x;
        const dy = d2.y - d1.y;
        const distance = Math.sqrt(dx ** 2 + dy ** 2);
        const minDist = d1.radius + d2.radius;

        if (distance < minDist) {
            const angle = Math.atan2(dy, dx);
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);

            const v1r = d1.vx * cos + d1.vy * sin;
            const v1t = -d1.vx * sin + d1.vy * cos;
            const v2r = d2.vx * cos + d2.vy * sin;
            const v2t = -d2.vx * sin + d2.vy * cos;

            let restitution = PHYSICS.COLLISION_DAMPING;
            if (d1.effect === "BOUNCY" || d2.effect === "BOUNCY") {
                restitution = POWERUPS.BOUNCY_FACTOR;
            }

            const v1rFinal = v2r * restitution;
            const v2rFinal = v1r * restitution;

            d1.vx = v1rFinal * cos - v1t * sin;
            d1.vy = v1rFinal * sin + v1t * cos;
            d2.vx = v2rFinal * cos - v2t * sin;
            d2.vy = v2rFinal * sin + v2t * cos;

            const overlap = minDist - distance;
            const separationX = overlap * cos * 0.5;
            const separationY = overlap * sin * 0.5;
            d1.x -= separationX;
            d1.y -= separationY;
            d2.x += separationX;
            d2.y += separationY;
        }
    }

    resolveRockCollision(duck, rock) {
        const dx = duck.x - rock.x;
        const dy = duck.y - rock.y;
        const distance = Math.sqrt(dx ** 2 + dy ** 2);
        const minDist = duck.radius + rock.radius;

        if (distance < minDist) {
            const nx = dx / distance;
            const ny = dy / distance;
            const overlap = minDist - distance;
            duck.x += nx * overlap;
            duck.y += ny * overlap;

            let restitution = PHYSICS.COLLISION_DAMPING;
            if (duck.effect === "BOUNCY") restitution = POWERUPS.BOUNCY_FACTOR;

            const dot = duck.vx * nx + duck.vy * ny;
            duck.vx = (duck.vx - 2 * dot * nx) * restitution;
            duck.vy = (duck.vy - 2 * dot * ny) * restitution;
        }
    }

    resolveWallCollision(duck) {
        const segmentIndex = Math.floor((duck.y + 500) / 5);
        const segment = this.riverPath[segmentIndex] || this.riverPath[this.riverPath.length - 1];
        if (!segment) return;

        const leftBank = segment.centerX - segment.width / 2;
        const rightBank = segment.centerX + segment.width / 2;

        if (duck.x - duck.radius < leftBank) {
            duck.x = leftBank + duck.radius;
            duck.vx = Math.abs(duck.vx) * PHYSICS.WALL_DAMPING + 0.5;
        } else if (duck.x + duck.radius > rightBank) {
            duck.x = rightBank - duck.radius;
            duck.vx = -Math.abs(duck.vx) * PHYSICS.WALL_DAMPING - 0.5;
        }
    }

    render() {
        this.renderer.draw({
            cameraY: this.cameraY,
            ducks: this.ducks,
            riverPath: this.riverPath,
            obstacles: this.obstacles,
            decorations: this.decorations,
            whirlpools: this.whirlpools,
            rapids: this.rapids,
            powerupBoxes: this.powerupBoxes,
            globalTime: this.globalTime,
        });
    }

    endRace() {
        this.raceFinished = true;
        this.ducks.sort((a, b) => a.finishTime - b.finishTime);
        const finishOrder = this.ducks.map((d) => ({
            originalIndex: 0,
            config: { body: d.color, beak: d.beak },
            name: d.name,
        }));
        if (this.onFinishCallback) this.onFinishCallback(finishOrder);
    }

    stop() {
        cancelAnimationFrame(this.animationId);
    }
}
