import { LEVEL_GEN, PHYSICS, RACE_DISTANCE } from "../config.js";
import { mulberry32 } from "../utils/rng.js";

export class RaceEngine {
    constructor() {
        this.canvas = document.getElementById("game-canvas");
        this.ctx = this.canvas.getContext("2d", { alpha: true });

        this.animationId = null;
        this.ducks = [];
        this.riverPath = [];
        this.obstacles = []; // In-river rocks
        this.decorations = []; // Trees, grass, bank rocks
        this.rapids = []; // Zones { startY, endY }

        this.cameraY = 0;
        this.finishLineY = RACE_DISTANCE;
        this.raceFinished = false;

        window.addEventListener("resize", () => this.resize());
        this.resize();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    start(seedVal, players, onFinish) {
        let currentSeed = seedVal;
        if (!currentSeed) {
            console.warn("⚠️ No seed provided, using fallback");
            currentSeed = Date.now();
        }

        this.rng = mulberry32(currentSeed);
        this.onFinishCallback = onFinish;
        this.raceFinished = false;
        this.cameraY = 0;

        // 1. Generate the World
        this.generateLevel();

        // 2. Spawn Ducks
        this.ducks = [];
        const playerList = Object.values(players);

        for (const p of playerList) {
            const jitterX = (this.rng() - 0.5) * 60;
            const jitterY = (this.rng() - 0.5) * 60;
            const spawnY = jitterY - 200;

            // Find start X relative to river center
            const segmentIndex = Math.floor((spawnY + 500) / 5);
            const segment = this.riverPath[segmentIndex] || this.riverPath[0];
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
            });
        }

        this.lastTime = performance.now();
        this.loop();
    }

    generateLevel() {
        this.riverPath = [];
        this.obstacles = [];
        this.decorations = [];
        this.rapids = [];

        const center = this.canvas.width / 2;
        const amplitude = 300;
        const frequency = 0.002;

        // --- 1. Generate River Path ---
        for (let y = -500; y < this.finishLineY + 2000; y += 5) {
            const curve = Math.sin(y * frequency) * amplitude;
            const noise = (this.rng() - 0.5) * 3;

            this.riverPath.push({
                y: y,
                centerX: center + curve + noise,
                width: PHYSICS.RIVER_WIDTH,
            });
        }

        // --- 2. Generate Features based on Path ---
        let inRapid = false;
        let rapidEnd = 0;

        for (const segment of this.riverPath) {
            // A. Rapids Generation
            if (
                !inRapid &&
                segment.y < this.finishLineY &&
                this.rng() < LEVEL_GEN.RAPID_FREQUENCY
            ) {
                inRapid = true;
                rapidEnd = segment.y + LEVEL_GEN.RAPID_LENGTH;
                this.rapids.push({ startY: segment.y, endY: rapidEnd });
            }
            if (inRapid && segment.y > rapidEnd) {
                inRapid = false;
            }

            // B. Obstacles (Rocks in water)
            // Don't spawn rocks at the very start (give players time to settle)
            if (
                segment.y > 0 &&
                segment.y < this.finishLineY &&
                this.rng() < LEVEL_GEN.OBSTACLE_DENSITY
            ) {
                // Determine collision radius
                const r =
                    PHYSICS.ROCK_RADIUS_MIN +
                    this.rng() * (PHYSICS.ROCK_RADIUS_MAX - PHYSICS.ROCK_RADIUS_MIN);
                // Position randomly within river width (with buffer from banks)
                const offset = (this.rng() - 0.5) * (segment.width - r * 4);

                this.obstacles.push({
                    x: segment.centerX + offset,
                    y: segment.y,
                    radius: r,
                    type: "rock",
                });
            }

            // C. Bank Decorations (Trees, Grass, Rocks on shore)
            const leftBankX = segment.centerX - segment.width / 2;
            const rightBankX = segment.centerX + segment.width / 2;

            // Trees
            if (this.rng() < LEVEL_GEN.TREE_DENSITY) {
                const side = this.rng() > 0.5 ? -1 : 1; // Left or Right bank
                const distFromBank = 20 + this.rng() * 100; // How far inland
                this.decorations.push({
                    x: side === -1 ? leftBankX - distFromBank : rightBankX + distFromBank,
                    y: segment.y,
                    radius: 15 + this.rng() * 15,
                    color1: "#228B22", // Dark Green
                    color2: "#32CD32", // Light Green highlight
                    type: "tree",
                });
            }

            // Grass Texture (Small dots)
            if (this.rng() < LEVEL_GEN.GRASS_DENSITY) {
                const side = this.rng() > 0.5 ? -1 : 1;
                const dist = this.rng() * 300; // Scatter widely
                this.decorations.push({
                    x: side === -1 ? leftBankX - dist : rightBankX + dist,
                    y: segment.y,
                    radius: 2 + this.rng() * 2,
                    color1: "#1a6b1a", // Darker grass patch
                    type: "grass",
                });
            }

            // Bank Rocks (Grey decorative rocks on the edge)
            if (this.rng() < LEVEL_GEN.OBSTACLE_DENSITY) {
                const side = this.rng() > 0.5 ? -1 : 1;
                this.decorations.push({
                    x: side === -1 ? leftBankX - 5 : rightBankX + 5, // Right on the edge
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

            // 1. Environment Lookup
            const segmentIndex = Math.floor((duck.y + 500) / 5);
            const currentSeg = this.riverPath[segmentIndex];
            const nextSeg = this.riverPath[segmentIndex + 20];

            // Check if in Rapids
            let inRapid = false;
            // Simple optimization: only check recent rapids
            for (const rapid of this.rapids) {
                if (duck.y >= rapid.startY && duck.y <= rapid.endY) {
                    inRapid = true;
                    break;
                }
            }

            // 2. Flow Forces
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

            // Apply Rapids Modifiers
            if (inRapid) {
                speed += PHYSICS.RAPID_SPEED_BOOST;
                turb = PHYSICS.RAPID_TURBULENCE;
            }

            duck.vx += flowX * speed * timeScale;
            duck.vy += flowY * speed * timeScale;
            duck.vx += (this.rng() - 0.5) * turb * timeScale;

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

        // 3. Duck-Duck Collisions
        for (let i = 0; i < this.ducks.length; i++) {
            for (let j = i + 1; j < this.ducks.length; j++) {
                if (this.ducks[i].finished || this.ducks[j].finished) continue;
                this.resolveCollision(this.ducks[i], this.ducks[j]);
            }
        }

        // 4. Duck-Rock Collisions (New!)
        for (const duck of this.ducks) {
            if (duck.finished) continue;
            this.resolveWallCollision(duck);

            // Optimization: Only check rocks roughly on screen
            // Since rocks are sorted by Y (mostly), we could optimize,
            // but for <100 rocks visible O(N) is fine.
            for (const rock of this.obstacles) {
                // Simple Y distance check first to avoid SQRT
                if (Math.abs(rock.y - duck.y) > 50) continue;

                this.resolveRockCollision(duck, rock);
            }
        }

        // 5. Camera
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
            // Elastic bounce against static object
            // Normal vector
            const nx = dx / distance;
            const ny = dy / distance;

            // Push out (Hard separation)
            const overlap = minDist - distance;
            duck.x += nx * overlap;
            duck.y += ny * overlap;

            // Reflect velocity vector
            // v' = v - 2 * (v . n) * n
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

        // --- 1. Bank Background (Grass) ---
        ctx.fillStyle = "#228B22";
        ctx.fillRect(0, camY, width, height);

        // --- 2. Bank Decorations (Under River Layer) ---
        // Optimization: Render only what is on screen
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

        // --- 3. River ---
        ctx.beginPath();
        ctx.fillStyle = "#1E90FF";

        // Optimize drawing by slicing the path
        // Approx index conversion: (y + 500) / 5
        const startIndex = Math.max(0, Math.floor((renderStart + 500) / 5));
        const endIndex = Math.min(this.riverPath.length - 1, Math.floor((renderEnd + 500) / 5));

        // Draw Left Bank
        for (let i = startIndex; i <= endIndex; i++) {
            const p = this.riverPath[i];
            ctx.lineTo(p.centerX - p.width / 2, p.y);
        }
        // Draw Right Bank
        for (let i = endIndex; i >= startIndex; i--) {
            const p = this.riverPath[i];
            ctx.lineTo(p.centerX + p.width / 2, p.y);
        }
        ctx.fill();

        // --- 4. Rapids (Visuals) ---
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 2;
        for (const rapid of this.rapids) {
            // Check visibility
            if (rapid.endY < renderStart || rapid.startY > renderEnd) continue;

            // Draw random streak lines inside the river path for this rapid
            // Use time to animate them
            const timeOffset = Date.now() / 100;
            const startIdx = Math.max(0, Math.floor((rapid.startY + 500) / 5));
            const endIdx = Math.min(this.riverPath.length - 1, Math.floor((rapid.endY + 500) / 5));

            ctx.beginPath();
            for (let i = startIdx; i < endIdx; i += 10) {
                const p = this.riverPath[i];
                // Animate x position with sine
                const xOff = Math.sin(i * 0.1 + timeOffset) * (p.width * 0.4);

                ctx.moveTo(p.centerX + xOff, p.y);
                ctx.lineTo(p.centerX + xOff, p.y + 20);

                // Second streak
                const xOff2 = Math.cos(i * 0.15 + timeOffset) * (p.width * 0.3);
                ctx.moveTo(p.centerX + xOff2, p.y + 10);
                ctx.lineTo(p.centerX + xOff2, p.y + 30);
            }
            ctx.stroke();
        }

        // --- 5. Obstacles (Rocks in River) ---
        for (const rock of this.obstacles) {
            if (rock.y < renderStart || rock.y > renderEnd) continue;

            // Rock Shadow/Water ripple
            ctx.beginPath();
            ctx.arc(rock.x, rock.y + 5, rock.radius + 2, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(0,0,0,0.2)";
            ctx.fill();

            // Rock Body
            ctx.beginPath();
            ctx.arc(rock.x, rock.y, rock.radius, 0, Math.PI * 2);
            ctx.fillStyle = "#808080";
            ctx.fill();
            ctx.strokeStyle = "#555";
            ctx.lineWidth = 2;
            ctx.stroke();

            // Highlight
            ctx.beginPath();
            ctx.arc(
                rock.x - rock.radius * 0.3,
                rock.y - rock.radius * 0.3,
                rock.radius * 0.3,
                0,
                Math.PI * 2,
            );
            ctx.fillStyle = "#A9A9A9";
            ctx.fill();
        }

        // --- 6. Bank Trees/Rocks (Top Layer) ---
        for (const deco of this.decorations) {
            if (deco.y < renderStart || deco.y > renderEnd) continue;

            if (deco.type === "tree") {
                // Simple stylized top-down tree
                ctx.beginPath();
                ctx.arc(deco.x, deco.y, deco.radius, 0, Math.PI * 2);
                ctx.fillStyle = deco.color1;
                ctx.fill();
                // Inner highlight
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

        // --- 7. Finish Line ---
        ctx.fillStyle = "white";
        ctx.fillRect(0, this.finishLineY, width, 20);

        // --- 8. Ducks ---
        for (const duck of this.ducks) {
            if (duck.finished) ctx.globalAlpha = 0.6;
            this.drawDuck(ctx, duck);
            ctx.globalAlpha = 1.0;
        }

        ctx.restore();
    }

    drawDuck(ctx, duck) {
        ctx.save();
        ctx.translate(duck.x, duck.y);

        const scale = duck.radius / 35;
        const facingRight = duck.vx > 0.1;
        ctx.scale(facingRight ? -scale : scale, scale);

        ctx.translate(-50, -60);

        // Body
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

        // Beak
        ctx.beginPath();
        ctx.moveTo(20, 35);
        ctx.quadraticCurveTo(5, 35, 5, 45);
        ctx.quadraticCurveTo(5, 50, 20, 45);
        ctx.closePath();
        ctx.fillStyle = duck.beak;
        ctx.fill();
        ctx.stroke();

        // Wing
        ctx.beginPath();
        ctx.moveTo(40, 65);
        ctx.quadraticCurveTo(50, 85, 70, 65);
        ctx.strokeStyle = duck.beak;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.stroke();

        // Eye
        ctx.beginPath();
        ctx.arc(40, 30, 5, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(42, 30, 2, 0, Math.PI * 2);
        ctx.fillStyle = "black";
        ctx.fill();

        ctx.restore();

        // Name Tag
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
