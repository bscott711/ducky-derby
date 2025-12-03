import { LEVEL_GEN, MIN_RACERS, NPC_NAMES, PHYSICS, POWERUPS, RACE_DISTANCE } from "../config.js";
import { mulberry32 } from "../utils/rng.js";

export class RaceEngine {
    constructor() {
        this.canvas = document.getElementById("game-canvas");
        this.ctx = this.canvas.getContext("2d", { alpha: true });

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
        this.FIXED_TIME_STEP = 1 / 60; // 60hz Physics

        window.addEventListener("resize", () => this.resize());
        this.resize();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    // --- PHASE 1: SETUP ---
    setup(seedVal, players) {
        let currentSeed = seedVal;
        if (!currentSeed) {
            console.warn("⚠️ No seed provided, using fallback");
            currentSeed = Date.now();
        }

        this.rng = mulberry32(currentSeed);
        this.raceFinished = false;
        this.globalTime = 0;
        this.accumulator = 0;

        // 1. Generate World (Using Fixed GAME_WIDTH)
        this.generateLevel();

        // 2. Prepare Racers (Deterministic Sort + Seeded NPCs)
        // Sort by ID to ensure stable order even if names are duplicate
        const racerList = Object.values(players).sort((a, b) =>
            (a.id || "").localeCompare(b.id || ""),
        );

        if (racerList.length < MIN_RACERS) {
            const needed = MIN_RACERS - racerList.length;
            for (let i = 0; i < needed; i++) {
                const nameIdx = Math.floor(this.rng() * NPC_NAMES.length);
                const randomName = NPC_NAMES[nameIdx];
                const config = {
                    body: this.getSeededColor(),
                    beak: this.getSeededColor(),
                };
                racerList.push({
                    name: `${randomName} #${i + 1}`,
                    config: config,
                    isNPC: true,
                    id: `npc-${i}`, // Dummy ID for consistency
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

            // Use segment center (which is based on GAME_WIDTH), NOT screen width
            const startX = segment ? segment.centerX : PHYSICS.GAME_WIDTH / 2;

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
        this.cameraY = leaderVisualY - this.canvas.height * 0.4;

        this.render();
    }

    getSeededColor() {
        const val = Math.floor(this.rng() * 16777215)
            .toString(16)
            .padStart(6, "0");
        return `#${val}`;
    }

    // --- PHASE 2: RUN ---
    run(onFinish) {
        this.onFinishCallback = onFinish;
        this.lastTime = performance.now();
        this.loop();
    }

    generateLevel() {
        this.riverPath = [];
        this.obstacles = [];
        this.decorations = [];
        this.rapids = [];
        this.whirlpools = [];
        this.powerupBoxes = [];

        // FIX: Use fixed Game Width logic, independent of screen size
        const center = PHYSICS.GAME_WIDTH / 2;
        const amplitude = 300;
        const frequency = 0.002;

        for (let y = -500; y < this.finishLineY + 2000; y += 5) {
            const curve = Math.sin(y * frequency) * amplitude;
            const noise = (this.rng() - 0.5) * 3;
            this.riverPath.push({
                y: y,
                centerX: center + curve + noise,
                width: PHYSICS.RIVER_WIDTH,
            });
        }

        let inRapid = false;
        let rapidEnd = 0;

        for (const segment of this.riverPath) {
            if (
                !inRapid &&
                segment.y < this.finishLineY &&
                this.rng() < LEVEL_GEN.RAPID_FREQUENCY
            ) {
                inRapid = true;
                rapidEnd = segment.y + LEVEL_GEN.RAPID_LENGTH;
                this.rapids.push({ startY: segment.y, endY: rapidEnd });
            }
            if (inRapid && segment.y > rapidEnd) inRapid = false;

            if (
                segment.y > 500 &&
                segment.y < this.finishLineY &&
                this.rng() < LEVEL_GEN.WHIRLPOOL_FREQUENCY
            ) {
                this.whirlpools.push({
                    x: segment.centerX + (this.rng() - 0.5) * (segment.width * 0.6),
                    y: segment.y,
                    radius: PHYSICS.WHIRLPOOL_RADIUS,
                });
            }

            if (
                segment.y > 200 &&
                segment.y < this.finishLineY &&
                this.rng() < POWERUPS.SPAWN_RATE
            ) {
                this.powerupBoxes.push({
                    x: segment.centerX + (this.rng() - 0.5) * (segment.width * 0.8),
                    y: segment.y,
                    size: POWERUPS.BOX_SIZE,
                    active: true,
                    bobOffset: this.rng() * Math.PI * 2,
                });
            }

            if (
                segment.y > 0 &&
                segment.y < this.finishLineY &&
                this.rng() < LEVEL_GEN.OBSTACLE_DENSITY
            ) {
                const r =
                    PHYSICS.ROCK_RADIUS_MIN +
                    this.rng() * (PHYSICS.ROCK_RADIUS_MAX - PHYSICS.ROCK_RADIUS_MIN);
                const offset = (this.rng() - 0.5) * (segment.width - r * 4);

                const vertices = [];
                const points = 7 + Math.floor(this.rng() * 5);
                for (let i = 0; i < points; i++) {
                    const angle = (i / points) * Math.PI * 2;
                    const varR =
                        r *
                        (1 - PHYSICS.ROCK_JAGGEDNESS / 2 + this.rng() * PHYSICS.ROCK_JAGGEDNESS);
                    vertices.push({ x: Math.cos(angle) * varR, y: Math.sin(angle) * varR });
                }

                this.obstacles.push({
                    x: segment.centerX + offset,
                    y: segment.y,
                    radius: r,
                    vertices: vertices,
                    rotation: this.rng() * Math.PI * 2,
                });
            }

            const leftBankX = segment.centerX - segment.width / 2;
            const rightBankX = segment.centerX + segment.width / 2;

            if (this.rng() < LEVEL_GEN.TREE_DENSITY) {
                const side = this.rng() > 0.5 ? -1 : 1;
                const dist = 20 + this.rng() * 100;
                this.decorations.push({
                    x: side === -1 ? leftBankX - dist : rightBankX + dist,
                    y: segment.y,
                    radius: 15 + this.rng() * 15,
                    color1: "#228B22",
                    color2: "#32CD32",
                    type: "tree",
                });
            }

            if (this.rng() < LEVEL_GEN.GRASS_DENSITY) {
                const side = this.rng() > 0.5 ? -1 : 1;
                const dist = this.rng() * 300;
                this.decorations.push({
                    x: side === -1 ? leftBankX - dist : rightBankX + dist,
                    y: segment.y,
                    radius: 2 + this.rng() * 2,
                    color1: "#1a6b1a",
                    type: "grass",
                });
            }

            if (this.rng() < LEVEL_GEN.OBSTACLE_DENSITY) {
                const side = this.rng() > 0.5 ? -1 : 1;
                this.decorations.push({
                    x: side === -1 ? leftBankX - 5 : rightBankX + 5,
                    y: segment.y,
                    radius: 8 + this.rng() * 10,
                    color1: "#808080",
                    type: "bank_rock",
                });
            }
        }
    }

    loop() {
        const now = performance.now();
        // Calc dt in seconds
        let dt = (now - this.lastTime) / 1000;
        this.lastTime = now;

        // Prevent spiral of death if laggy (cap at 0.25s)
        if (dt > 0.25) dt = 0.25;

        this.accumulator += dt;

        // FIX: Fixed Time Step Loop
        // Run physics in fixed chunks of 1/60s
        while (this.accumulator >= this.FIXED_TIME_STEP) {
            this.updatePhysics(); // No dt param needed, implicitly 1/60
            this.globalTime += this.FIXED_TIME_STEP;
            this.accumulator -= this.FIXED_TIME_STEP;
        }

        this.render();

        if (!this.raceFinished) {
            this.animationId = requestAnimationFrame(() => this.loop());
        }
    }

    updatePhysics() {
        // Since we are inside a fixed step loop, timescale is always 1.0 (relative to 60fps)
        const timeScale = 1.0;

        let finishedCount = 0;

        for (const duck of this.ducks) {
            if (duck.finished) {
                finishedCount++;
                continue;
            }

            // --- Z-AXIS PHYSICS (FALLING) ---
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

            if (duck.effect === "GIANT") {
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

            let trapped = false;
            if (duck.cooldownTimer <= 0 && duck.effect !== "GHOST") {
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

            let frictionVal = 0.96;
            if (duck.effect === "ANCHOR") frictionVal = POWERUPS.ANCHOR_DRAG;

            // Replaced Math.pow with **
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

        for (let i = 0; i < this.ducks.length; i++) {
            for (let j = i + 1; j < this.ducks.length; j++) {
                const d1 = this.ducks[i];
                const d2 = this.ducks[j];

                if (d1.finished || d2.finished || d1.z > 0 || d2.z > 0) continue;
                if (d1.effect === "GHOST" || d2.effect === "GHOST") continue;

                this.resolveCollision(d1, d2);
            }
        }

        for (const duck of this.ducks) {
            if (duck.finished || duck.z > 0) continue;
            this.resolveWallCollision(duck);

            if (duck.effect === "GHOST") continue;

            for (const rock of this.obstacles) {
                if (Math.abs(rock.y - duck.y) > 60) continue;
                this.resolveRockCollision(duck, rock);
            }
        }

        const leaderVisualY = Math.max(...this.ducks.map((d) => d.y - d.z));
        const targetCamY = leaderVisualY - this.canvas.height * 0.4;
        this.cameraY += (targetCamY - this.cameraY) * 0.05 * timeScale;

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
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const camY = this.cameraY;

        ctx.clearRect(0, 0, width, height);
        ctx.save();

        // FIX: Center the Fixed Game World relative to the Screen Width
        const offsetX = (width - PHYSICS.GAME_WIDTH) / 2;
        ctx.translate(offsetX, -camY);

        // 1. Bank
        ctx.fillStyle = "#228B22";
        // Draw bank filling entire view height
        ctx.fillRect(0 - offsetX, camY, width + offsetX * 2, height);

        // 2. Decorations
        const renderStart = camY - 100;
        const renderEnd = camY + height + 100;

        for (const deco of this.decorations) {
            if (deco.y < renderStart || deco.y > renderEnd) continue;
            if (deco.type === "grass") {
                ctx.beginPath();
                ctx.arc(deco.x, deco.y, deco.radius, 0, Math.PI * 2);
                ctx.fillStyle = deco.color1;
                ctx.fill();
            }
        }

        // 3. River
        ctx.beginPath();
        ctx.fillStyle = "#1E90FF";
        const startIndex = Math.max(0, Math.floor((renderStart + 500) / 5));
        const endIndex = Math.min(this.riverPath.length - 1, Math.floor((renderEnd + 500) / 5));

        for (let i = startIndex; i <= endIndex; i++) {
            const p = this.riverPath[i];
            ctx.lineTo(p.centerX - p.width / 2, p.y);
        }
        for (let i = endIndex; i >= startIndex; i--) {
            const p = this.riverPath[i];
            ctx.lineTo(p.centerX + p.width / 2, p.y);
        }
        ctx.fill();

        // 4. Whirlpools
        for (const pool of this.whirlpools) {
            if (pool.y < renderStart || pool.y > renderEnd) continue;
            ctx.save();
            ctx.translate(pool.x, pool.y);
            ctx.rotate(this.globalTime * 2);
            ctx.beginPath();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
            ctx.lineWidth = 3;
            for (let arm = 0; arm < 2; arm++) {
                ctx.rotate(Math.PI);
                ctx.moveTo(0, 0);
                for (let i = 0; i < pool.radius; i += 2) {
                    const angle = i * 0.2;
                    const r = i;
                    ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
                }
            }
            ctx.stroke();
            ctx.restore();
        }

        // 5. Rapids
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 2;
        for (const rapid of this.rapids) {
            if (rapid.endY < renderStart || rapid.startY > renderEnd) continue;
            const timeOffset = Date.now() / 100;
            const startIdx = Math.max(0, Math.floor((rapid.startY + 500) / 5));
            const endIdx = Math.min(this.riverPath.length - 1, Math.floor((rapid.endY + 500) / 5));

            ctx.beginPath();
            for (let i = startIdx; i < endIdx; i += 10) {
                const p = this.riverPath[i];
                const xOff = Math.sin(i * 0.1 + timeOffset) * (p.width * 0.4);
                ctx.moveTo(p.centerX + xOff, p.y);
                ctx.lineTo(p.centerX + xOff, p.y + 20);
                const xOff2 = Math.cos(i * 0.15 + timeOffset) * (p.width * 0.3);
                ctx.moveTo(p.centerX + xOff2, p.y + 10);
                ctx.lineTo(p.centerX + xOff2, p.y + 30);
            }
            ctx.stroke();
        }

        // 6. Power-Up Boxes
        for (const box of this.powerupBoxes) {
            if (!box.active || box.y < renderStart || box.y > renderEnd) continue;
            ctx.save();
            const floatY = Math.sin(this.globalTime * 3 + box.bobOffset) * 5;
            ctx.translate(box.x, box.y + floatY);
            ctx.fillStyle = "#FFD700";
            ctx.strokeStyle = "#DAA520";
            ctx.lineWidth = 2;
            const sz = box.size;
            ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
            ctx.strokeRect(-sz / 2, -sz / 2, sz, sz);
            ctx.fillStyle = "white";
            ctx.font = "bold 16px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("?", 0, 0);
            ctx.restore();
        }

        // 7. Obstacles
        for (const rock of this.obstacles) {
            if (rock.y < renderStart || rock.y > renderEnd) continue;
            ctx.save();
            ctx.translate(rock.x, rock.y);
            ctx.rotate(rock.rotation);
            ctx.beginPath();
            const v = rock.vertices;
            ctx.moveTo(v[0].x, v[0].y);
            for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
            ctx.closePath();
            ctx.fillStyle = "#808080";
            ctx.fill();
            ctx.strokeStyle = "#555";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(v[0].x * 0.5, v[0].y * 0.5);
            ctx.stroke();
            ctx.restore();
        }

        // 8. Bank Decorations
        for (const deco of this.decorations) {
            if (deco.y < renderStart || deco.y > renderEnd) continue;
            if (deco.type === "tree") {
                ctx.beginPath();
                ctx.arc(deco.x, deco.y, deco.radius, 0, Math.PI * 2);
                ctx.fillStyle = deco.color1;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(deco.x, deco.y, deco.radius * 0.6, 0, Math.PI * 2);
                ctx.fillStyle = deco.color2;
                ctx.fill();
            } else if (deco.type === "bank_rock") {
                ctx.beginPath();
                ctx.arc(deco.x, deco.y, deco.radius, 0, Math.PI * 2);
                ctx.fillStyle = deco.color1;
                ctx.fill();
            }
        }

        this.drawBridge(ctx);

        ctx.fillStyle = "white";
        ctx.fillRect(0, this.finishLineY, width, 20);

        for (const duck of this.ducks) {
            if (duck.finished) ctx.globalAlpha = 0.6;
            this.drawDuck(ctx, duck);
            ctx.globalAlpha = 1.0;
        }

        ctx.restore();
    }

    drawBridge(ctx) {
        const bridgeY = -200;
        const segmentIndex = Math.floor((bridgeY + 500) / 5);
        const segment = this.riverPath[segmentIndex];

        if (!segment) return;

        const bridgeWidth = PHYSICS.RIVER_WIDTH + 140;
        const startX = segment.centerX - bridgeWidth / 2;
        const endX = segment.centerX + bridgeWidth / 2;
        const archHeight = 60;

        ctx.save();

        ctx.beginPath();
        ctx.moveTo(startX, bridgeY + 20);
        ctx.quadraticCurveTo(segment.centerX, bridgeY - 40, endX, bridgeY + 20);
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 15;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(startX - 10, bridgeY);
        ctx.quadraticCurveTo(segment.centerX, bridgeY - archHeight * 2, endX + 10, bridgeY);
        ctx.lineWidth = 40;
        ctx.strokeStyle = "#8B4513";
        ctx.lineCap = "butt";
        ctx.stroke();

        ctx.strokeStyle = "#A0522D";
        ctx.lineWidth = 3;
        ctx.globalCompositeOperation = "source-atop";
        ctx.lineWidth = 34;
        ctx.strokeStyle = "#8B4513";
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(startX - 10, bridgeY - 15);
        ctx.quadraticCurveTo(
            segment.centerX,
            bridgeY - archHeight * 2 - 15,
            endX + 10,
            bridgeY - 15,
        );
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#CD853F";
        ctx.stroke();

        ctx.restore();
    }

    drawDuck(ctx, duck) {
        ctx.save();

        if (duck.z > 0) {
            ctx.save();
            ctx.translate(duck.x, duck.y);
            ctx.scale(1, 0.5);
            const shadowRatio = Math.max(0.2, 1 - duck.z / 200);
            const shadowRadius = duck.radius * shadowRatio;

            ctx.beginPath();
            ctx.arc(0, 0, shadowRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0,0,0, ${0.4 * shadowRatio})`;
            ctx.fill();
            ctx.restore();
        }

        ctx.translate(duck.x, duck.y - duck.z);

        const scale = duck.radius / 35;
        const facingRight = duck.vx > 0.1;
        ctx.scale(facingRight ? -scale : scale, scale);

        ctx.translate(-50, -60);

        if (duck.effect === "GHOST") {
            ctx.globalAlpha = 0.5;
        }
        if (duck.effect === "BOUNCY") {
            const pulse = 1 + Math.sin(this.globalTime * 20) * 0.1;
            ctx.scale(pulse, 1 / pulse);
        }

        ctx.beginPath();
        ctx.moveTo(20, 60);
        ctx.quadraticCurveTo(20, 90, 50, 90);
        ctx.lineTo(75, 90);
        ctx.quadraticCurveTo(95, 90, 95, 70);
        ctx.quadraticCurveTo(95, 50, 75, 50);
        ctx.lineTo(70, 50);
        ctx.lineTo(70, 40);
        ctx.quadraticCurveTo(70, 10, 45, 10);
        ctx.quadraticCurveTo(20, 10, 20, 40);
        ctx.lineTo(20, 60);
        ctx.closePath();

        ctx.fillStyle = duck.effect === "ANCHOR" ? "#555" : duck.color;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#333";
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(20, 35);
        ctx.quadraticCurveTo(5, 35, 5, 45);
        ctx.quadraticCurveTo(5, 50, 20, 45);
        ctx.closePath();
        ctx.fillStyle = duck.beak;
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(40, 65);
        ctx.quadraticCurveTo(50, 85, 70, 65);
        ctx.strokeStyle = duck.beak;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(40, 30, 5, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(42, 30, 2, 0, Math.PI * 2);
        ctx.fillStyle = "black";
        ctx.fill();

        ctx.restore();

        ctx.save();
        ctx.translate(duck.x, duck.y - duck.z);
        ctx.fillStyle = "white";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "black";

        if (duck.effect) {
            let icon = "";
            if (duck.effect === "SPEED") icon = "⚡";
            if (duck.effect === "ANCHOR") icon = "⚓";
            if (duck.effect === "BOUNCY") icon = "🏀";
            if (duck.effect === "GHOST") icon = "👻";

            if (icon) {
                ctx.font = "20px Arial";
                ctx.fillText(icon, 0, -duck.radius - 25);
            }
        }

        ctx.strokeText(duck.name, 0, -duck.radius - 10);
        ctx.fillText(duck.name, 0, -duck.radius - 10);
        ctx.restore();
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
