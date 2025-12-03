import { LEVEL_GEN, PHYSICS, RACE_DISTANCE } from "../config.js";
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

        this.cameraY = 0;
        this.finishLineY = RACE_DISTANCE;
        this.raceFinished = false;
        this.globalTime = 0;

        window.addEventListener("resize", () => this.resize());
        this.resize();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    // --- PHASE 1: SETUP (Static) ---
    setup(seedVal, players) {
        let currentSeed = seedVal;
        if (!currentSeed) {
            console.warn("⚠️ No seed provided, using fallback");
            currentSeed = Date.now();
        }

        this.rng = mulberry32(currentSeed);
        this.raceFinished = false;
        this.globalTime = 0;

        // 1. Generate World
        this.generateLevel();

        // 2. Spawn Ducks
        this.ducks = [];
        const playerList = Object.values(players);

        // Find bridge parameters for spawn logic
        const bridgeY = -200;
        const segmentIndex = Math.floor((bridgeY + 500) / 5);
        const segment = this.riverPath[segmentIndex] || this.riverPath[0];
        const bridgeWidth = PHYSICS.RIVER_WIDTH + 140;
        const archHeight = 60;

        for (const p of playerList) {
            // Random spread on bridge
            const spread = bridgeWidth * 0.6;
            const jitterX = (this.rng() - 0.5) * spread;

            // Calculate Arch Height at this X
            const normX = jitterX / (bridgeWidth / 2);
            const archY = bridgeY - archHeight * (1 - normX * normX);
            const spawnY = archY - 10 - this.rng() * 20; // Stand on top

            const startX = segment ? segment.centerX : this.canvas.width / 2;

            this.ducks.push({
                id: p.name,
                name: p.name,
                color: p.config.body,
                beak: p.config.beak,
                x: startX + jitterX,
                y: spawnY,
                vx: 0,
                vy: 0,
                radius: PHYSICS.DUCK_RADIUS,
                mass: PHYSICS.DUCK_MASS,
                finished: false,
                trapTimer: 0,
                cooldownTimer: 0,
            });
        }

        // 3. Snap Camera
        const leaderY = Math.max(...this.ducks.map((d) => d.y));
        this.cameraY = leaderY - this.canvas.height * 0.4;

        // 4. Initial Render
        this.render();
    }

    // --- PHASE 2: RUN (Active) ---
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

        const center = this.canvas.width / 2;
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
        const dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;
        this.globalTime += dt;

        this.updatePhysics(dt);
        this.render();

        if (!this.raceFinished) {
            this.animationId = requestAnimationFrame(() => this.loop());
        }
    }

    updatePhysics(dt) {
        const timeScale = dt * 60;
        let finishedCount = 0;

        for (const duck of this.ducks) {
            if (duck.finished) {
                finishedCount++;
                continue;
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
            if (duck.cooldownTimer <= 0) {
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

            const friction = 0.96 ** timeScale;
            duck.vx *= friction;
            duck.vy *= friction;

            duck.x += duck.vx * timeScale;
            duck.y += duck.vy * timeScale;

            if (duck.y >= this.finishLineY && !duck.finished) {
                duck.finished = true;
                duck.finishTime = performance.now();
            }
        }

        for (let i = 0; i < this.ducks.length; i++) {
            for (let j = i + 1; j < this.ducks.length; j++) {
                if (this.ducks[i].finished || this.ducks[j].finished) continue;
                this.resolveCollision(this.ducks[i], this.ducks[j]);
            }
        }

        for (const duck of this.ducks) {
            if (duck.finished) continue;
            this.resolveWallCollision(duck);
            for (const rock of this.obstacles) {
                if (Math.abs(rock.y - duck.y) > 60) continue;
                this.resolveRockCollision(duck, rock);
            }
        }

        const leaderY = Math.max(...this.ducks.map((d) => d.y));
        const targetCamY = leaderY - this.canvas.height * 0.4;
        this.cameraY += (targetCamY - this.cameraY) * 0.05 * timeScale;

        if (finishedCount === this.ducks.length) {
            this.endRace();
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

            const v1rFinal = v2r * PHYSICS.COLLISION_DAMPING;
            const v2rFinal = v1r * PHYSICS.COLLISION_DAMPING;

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

            const dot = duck.vx * nx + duck.vy * ny;
            duck.vx = (duck.vx - 2 * dot * nx) * PHYSICS.COLLISION_DAMPING;
            duck.vy = (duck.vy - 2 * dot * ny) * PHYSICS.COLLISION_DAMPING;
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
        ctx.translate(0, -camY);

        // 1. Bank
        ctx.fillStyle = "#228B22";
        ctx.fillRect(0, camY, width, height);

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

        // 6. Obstacles
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

        // 7. Bank Decorations
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

        // 8. Bridge
        this.drawBridge(ctx);

        // 9. Finish Line
        ctx.fillStyle = "white";
        ctx.fillRect(0, this.finishLineY, width, 20);

        // 10. Ducks
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
        ctx.translate(duck.x, duck.y);

        const scale = duck.radius / 35;
        const facingRight = duck.vx > 0.1;
        ctx.scale(facingRight ? -scale : scale, scale);

        ctx.translate(-50, -60);

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
        ctx.fillStyle = duck.color;
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
        ctx.translate(duck.x, duck.y);
        ctx.fillStyle = "white";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "black";
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
