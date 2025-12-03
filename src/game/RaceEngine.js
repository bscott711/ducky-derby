import { PHYSICS, RACE_DISTANCE } from "../config.js";
import { mulberry32 } from "../utils/rng.js";

export class RaceEngine {
    constructor() {
        this.canvas = document.getElementById("game-canvas");
        this.ctx = this.canvas.getContext("2d", { alpha: true });

        this.animationId = null;
        this.ducks = [];
        this.riverPath = [];
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

        this.generateRiver();

        this.ducks = [];
        const playerList = Object.values(players);
        const startX = this.canvas.width / 2;

        for (const p of playerList) {
            const jitterX = (this.rng() - 0.5) * 100;
            const jitterY = (this.rng() - 0.5) * 100;

            this.ducks.push({
                id: p.name,
                name: p.name,
                color: p.config.body,
                beak: p.config.beak,
                x: startX + jitterX,
                y: jitterY - 200,
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

    generateRiver() {
        this.riverPath = [];
        const center = this.canvas.width / 2;
        const amplitude = 300;
        const frequency = 0.002;

        for (let y = -500; y < this.finishLineY + 2000; y += 50) {
            const curve = Math.sin(y * frequency) * amplitude;
            const noise = (this.rng() - 0.5) * 50;

            this.riverPath.push({
                y: y,
                centerX: center + curve + noise,
                width: PHYSICS.RIVER_WIDTH,
            });
        }
    }

    loop() {
        const now = performance.now();
        // Calculate dt in seconds
        const dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;

        this.updatePhysics(dt);
        this.render();

        if (!this.raceFinished) {
            this.animationId = requestAnimationFrame(() => this.loop());
        }
    }

    updatePhysics(dt) {
        // Create a timeScale where 1.0 = 60fps
        // This makes our Physics numbers easier to reason about (e.g., 0.5 pixels per frame)
        const timeScale = dt * 60;

        let finishedCount = 0;

        // 1. Move Ducks
        for (const duck of this.ducks) {
            if (duck.finished) {
                finishedCount++;
                continue;
            }

            // A. Apply Forces
            // We multiply by timeScale to ensure movement is consistent across different frame rates
            duck.vy += PHYSICS.FLOW_SPEED * timeScale;
            duck.vx += (this.rng() - 0.5) * PHYSICS.TURBULENCE * timeScale;

            // Friction
            // We apply friction scaled by time to prevent jitter
            const friction = 0.96 ** timeScale;
            duck.vx *= friction;
            duck.vy *= friction;

            // B. Apply Velocity
            duck.x += duck.vx * timeScale;
            duck.y += duck.vy * timeScale;

            // C. Check Finish
            if (duck.y >= this.finishLineY && !duck.finished) {
                duck.finished = true;
                duck.finishTime = performance.now();
            }
        }

        // 2. Resolve Collisions
        for (let i = 0; i < this.ducks.length; i++) {
            for (let j = i + 1; j < this.ducks.length; j++) {
                this.resolveCollision(this.ducks[i], this.ducks[j]);
            }
        }

        // 3. Resolve Wall Collisions
        for (const duck of this.ducks) {
            this.resolveWallCollision(duck);
        }

        // 4. Update Camera
        const leaderY = Math.max(...this.ducks.map((d) => d.y));
        const targetCamY = leaderY - this.canvas.height * 0.4;
        this.cameraY += (targetCamY - this.cameraY) * 0.05 * timeScale; // Smooth camera

        // 5. Check Race End
        if (finishedCount === this.ducks.length) {
            this.endRace();
        }
    }

    resolveCollision(d1, d2) {
        const dx = d2.x - d1.x;
        const dy = d2.y - d1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDist = d1.radius + d2.radius;

        if (distance < minDist) {
            const angle = Math.atan2(dy, dx);
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);

            // Rotate velocities
            const v1r = d1.vx * cos + d1.vy * sin;
            const v1t = -d1.vx * sin + d1.vy * cos;
            const v2r = d2.vx * cos + d2.vy * sin;
            const v2t = -d2.vx * sin + d2.vy * cos;

            // Swap radial velocities (elastic bounce)
            const v1rFinal = v2r * PHYSICS.COLLISION_DAMPING;
            const v2rFinal = v1r * PHYSICS.COLLISION_DAMPING;

            // Rotate back
            d1.vx = v1rFinal * cos - v1t * sin;
            d1.vy = v1rFinal * sin + v1t * cos;
            d2.vx = v2rFinal * cos - v2t * sin;
            d2.vy = v2rFinal * sin + v2t * cos;

            // Separate
            const overlap = minDist - distance;
            const separationX = overlap * cos * 0.5;
            const separationY = overlap * sin * 0.5;
            d1.x -= separationX;
            d1.y -= separationY;
            d2.x += separationX;
            d2.y += separationY;
        }
    }

    resolveWallCollision(duck) {
        const segmentIndex = Math.floor((duck.y + 500) / 50);
        const segment = this.riverPath[segmentIndex] || this.riverPath[this.riverPath.length - 1];

        if (!segment) return;

        const leftBank = segment.centerX - segment.width / 2;
        const rightBank = segment.centerX + segment.width / 2;

        if (duck.x - duck.radius < leftBank) {
            duck.x = leftBank + duck.radius;
            duck.vx = Math.abs(duck.vx) * PHYSICS.WALL_DAMPING + 1; // Slight bounce push
        } else if (duck.x + duck.radius > rightBank) {
            duck.x = rightBank - duck.radius;
            duck.vx = -Math.abs(duck.vx) * PHYSICS.WALL_DAMPING - 1;
        }
    }

    render() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        ctx.clearRect(0, 0, width, height);
        ctx.save();
        ctx.translate(0, -this.cameraY);

        // 1. River
        ctx.beginPath();
        ctx.fillStyle = "#1E90FF";
        for (const p of this.riverPath) ctx.lineTo(p.centerX - p.width / 2, p.y);
        for (let i = this.riverPath.length - 1; i >= 0; i--)
            ctx.lineTo(
                this.riverPath[i].centerX + this.riverPath[i].width / 2,
                this.riverPath[i].y,
            );
        ctx.fill();

        // 2. Banks
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#228B22";
        ctx.fillRect(0, this.cameraY, width, height);
        ctx.globalCompositeOperation = "source-over";

        // 3. Finish Line
        ctx.fillStyle = "white";
        ctx.fillRect(0, this.finishLineY, width, 20);

        // 4. Ducks
        for (const duck of this.ducks) {
            ctx.beginPath();
            ctx.arc(duck.x, duck.y, duck.radius, 0, Math.PI * 2);
            ctx.fillStyle = duck.color;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgba(0,0,0,0.3)";
            ctx.stroke();

            // Beak
            ctx.beginPath();
            ctx.arc(duck.x, duck.y - 4, 4, 0, Math.PI * 2);
            ctx.fillStyle = duck.beak;
            ctx.fill();

            // Name
            ctx.fillStyle = "white";
            ctx.font = "bold 12px Arial";
            ctx.textAlign = "center";
            ctx.strokeStyle = "black";
            ctx.lineWidth = 3;
            ctx.strokeText(duck.name, duck.x, duck.y - 18);
            ctx.fillText(duck.name, duck.x, duck.y - 18);
        }

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
