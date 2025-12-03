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
            const jitterX = (this.rng() - 0.5) * 60;
            const jitterY = (this.rng() - 0.5) * 60;

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

        // FIX #2: High Resolution River (Step 10px instead of 50px)
        // This makes the banks look smooth instead of jagged
        for (let y = -500; y < this.finishLineY + 2000; y += 10) {
            const curve = Math.sin(y * frequency) * amplitude;
            // Less noise for a smoother "grassy bank" look
            const noise = (this.rng() - 0.5) * 10;

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

        for (const duck of this.ducks) {
            if (duck.finished) {
                finishedCount++;
                continue;
            }

            // --- FIX #1: Directional Water Flow ---
            // Find the local direction of the river at this duck's Y position
            const segmentIndex = Math.floor((duck.y + 500) / 10);
            const currentSeg = this.riverPath[segmentIndex];
            const nextSeg = this.riverPath[segmentIndex + 5]; // Look ahead slightly for smooth flow

            let flowX = 0;
            let flowY = 1; // Default down

            if (currentSeg && nextSeg) {
                const dx = nextSeg.centerX - currentSeg.centerX;
                const dy = nextSeg.y - currentSeg.y;
                // Normalize vector
                const len = Math.sqrt(dx * dx + dy * dy);
                flowX = dx / len;
                flowY = dy / len;
            }

            // Apply Flow Force (Push duck along the curve)
            duck.vx += flowX * PHYSICS.FLOW_SPEED * timeScale;
            duck.vy += flowY * PHYSICS.FLOW_SPEED * timeScale;

            // Turbulence (Random pushes)
            duck.vx += (this.rng() - 0.5) * PHYSICS.TURBULENCE * timeScale;

            // Friction
            const friction = 0.96 ** timeScale;
            duck.vx *= friction;
            duck.vy *= friction;

            // Update Position
            duck.x += duck.vx * timeScale;
            duck.y += duck.vy * timeScale;

            // Check Finish
            if (duck.y >= this.finishLineY && !duck.finished) {
                duck.finished = true;
                duck.finishTime = performance.now();
            }
        }

        // Collisions
        for (let i = 0; i < this.ducks.length; i++) {
            for (let j = i + 1; j < this.ducks.length; j++) {
                this.resolveCollision(this.ducks[i], this.ducks[j]);
            }
        }

        // Wall Collisions
        for (const duck of this.ducks) {
            this.resolveWallCollision(duck);
        }

        // Camera
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
        const segmentIndex = Math.floor((duck.y + 500) / 10);
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

        // 4. Draw Ducks (FIX #3: Restoring Side Profile)
        for (const duck of this.ducks) {
            this.drawDuck(ctx, duck);
        }

        ctx.restore();
    }

    // --- NEW: Helper to draw the Side-Profile Duck ---
    drawDuck(ctx, duck) {
        ctx.save();
        ctx.translate(duck.x, duck.y);

        // Determine facing direction based on velocity x
        // If moving left, flip horizontally
        const scale = duck.radius / 35; // Scale SVG coord system to fit radius
        ctx.scale(duck.vx < -0.1 ? -scale : scale, scale);

        // Center the shape (The original path is roughly 0,0 to 100,100)
        ctx.translate(-50, -60);

        // -- Duck Body --
        ctx.beginPath();
        // Path translated from original SVG:
        // M20,60 Q20,90 50,90 L75,90 Q95,90 95,70 Q95,50 75,50 L70,50 L70,40 Q70,10 45,10 Q20,10 20,40 L20,60 Z
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
        // Path: M40,65 Q50,85 70,65 (Smile)
        // Path: M20,35 Q5,35 5,45 Q5,50 20,45 Z (Beak)
        ctx.moveTo(20, 35);
        ctx.quadraticCurveTo(5, 35, 5, 45);
        ctx.quadraticCurveTo(5, 50, 20, 45);
        ctx.closePath();
        ctx.fillStyle = duck.beak;
        ctx.fill();
        ctx.stroke();

        // -- Wing/Detail (Smile) --
        ctx.beginPath();
        ctx.moveTo(40, 65);
        ctx.quadraticCurveTo(50, 85, 70, 65);
        ctx.strokeStyle = duck.beak; // Use beak color for detail
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

        // -- Name Tag (Floating above) --
        ctx.restore(); // Restore transform to draw text un-flipped/un-scaled
        ctx.fillStyle = "white";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "black";
        ctx.strokeText(duck.name, duck.x, duck.y - duck.radius - 10);
        ctx.fillText(duck.name, duck.x, duck.y - duck.radius - 10);
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
