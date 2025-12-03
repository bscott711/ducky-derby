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

        // 1. Generate River FIRST so we know where to spawn
        this.generateRiver();

        this.ducks = [];
        const playerList = Object.values(players);

        for (const p of playerList) {
            const jitterX = (this.rng() - 0.5) * 60;
            const jitterY = (this.rng() - 0.5) * 60;
            const spawnY = jitterY - 200; // Spawn above screen

            // FIX 1: Spawn relative to River Center, not Screen Center
            // Find the river segment closest to this Y position
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

    generateRiver() {
        this.riverPath = [];
        const center = this.canvas.width / 2;
        const amplitude = 300;
        const frequency = 0.002;

        // High Res Generation
        for (let y = -500; y < this.finishLineY + 2000; y += 5) {
            const curve = Math.sin(y * frequency) * amplitude;
            const noise = (this.rng() - 0.5) * 3;

            this.riverPath.push({
                y: y,
                centerX: center + curve + noise,
                width: PHYSICS.RIVER_WIDTH,
            });
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

        // 1. Move Ducks
        for (const duck of this.ducks) {
            if (duck.finished) {
                finishedCount++;
                continue;
            }

            // Directional Flow
            const segmentIndex = Math.floor((duck.y + 500) / 5);
            const currentSeg = this.riverPath[segmentIndex];
            const nextSeg = this.riverPath[segmentIndex + 20];

            let flowX = 0;
            let flowY = 1;

            if (currentSeg && nextSeg) {
                const dx = nextSeg.centerX - currentSeg.centerX;
                const dy = nextSeg.y - currentSeg.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                flowX = dx / len;
                flowY = dy / len;
            }

            // Apply Forces
            duck.vx += flowX * PHYSICS.FLOW_SPEED * timeScale;
            duck.vy += flowY * PHYSICS.FLOW_SPEED * timeScale;
            duck.vx += (this.rng() - 0.5) * PHYSICS.TURBULENCE * timeScale;

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

        // 2. Collisions
        for (let i = 0; i < this.ducks.length; i++) {
            for (let j = i + 1; j < this.ducks.length; j++) {
                this.resolveCollision(this.ducks[i], this.ducks[j]);
            }
        }

        // 3. Walls
        for (const duck of this.ducks) {
            this.resolveWallCollision(duck);
        }

        // 4. Camera
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
        const distance = Math.sqrt(dx * dx + dy * dy);
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

    resolveWallCollision(duck) {
        const segmentIndex = Math.floor((duck.y + 500) / 5);
        const segment = this.riverPath[segmentIndex] || this.riverPath[this.riverPath.length - 1];

        if (!segment) return;

        const leftBank = segment.centerX - segment.width / 2;
        const rightBank = segment.centerX + segment.width / 2;

        if (duck.x - duck.radius < leftBank) {
            duck.x = leftBank + duck.radius;
            // Add a hard "push" (0.5) to prevent sticking to the wall
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

        ctx.clearRect(0, 0, width, height);
        ctx.save();
        ctx.translate(0, -this.cameraY);

        // River
        ctx.beginPath();
        ctx.fillStyle = "#1E90FF";
        for (const p of this.riverPath) ctx.lineTo(p.centerX - p.width / 2, p.y);
        for (let i = this.riverPath.length - 1; i >= 0; i--)
            ctx.lineTo(
                this.riverPath[i].centerX + this.riverPath[i].width / 2,
                this.riverPath[i].y,
            );
        ctx.fill();

        // Banks
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#228B22";
        ctx.fillRect(0, this.cameraY, width, height);
        ctx.globalCompositeOperation = "source-over";

        // Finish Line
        ctx.fillStyle = "white";
        ctx.fillRect(0, this.finishLineY, width, 20);

        // Ducks
        for (const duck of this.ducks) {
            this.drawDuck(ctx, duck);
        }

        ctx.restore();
    }

    drawDuck(ctx, duck) {
        ctx.save();
        ctx.translate(duck.x, duck.y);

        const scale = duck.radius / 35;

        // FIX 2: INVERTED Orientation Check
        // Default SVG faces LEFT.
        // If moving Right (vx > 0.1), we want to face Right -> Flip (-scale)
        // If moving Left (vx < -0.1), we want to face Left -> Normal (scale)
        const facingRight = duck.vx > 0.1;
        ctx.scale(facingRight ? -scale : scale, scale);

        ctx.translate(-50, -60);

        // -- Body --
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

        // -- Beak --
        ctx.beginPath();
        ctx.moveTo(20, 35);
        ctx.quadraticCurveTo(5, 35, 5, 45);
        ctx.quadraticCurveTo(5, 50, 20, 45);
        ctx.closePath();
        ctx.fillStyle = duck.beak;
        ctx.fill();
        ctx.stroke();

        // -- Wing --
        ctx.beginPath();
        ctx.moveTo(40, 65);
        ctx.quadraticCurveTo(50, 85, 70, 65);
        ctx.strokeStyle = duck.beak;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.stroke();

        // -- Eye --
        ctx.beginPath();
        ctx.arc(40, 30, 5, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(42, 30, 2, 0, Math.PI * 2);
        ctx.fillStyle = "black";
        ctx.fill();

        ctx.restore();

        // -- Name Tag --
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
