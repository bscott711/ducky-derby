import { PHYSICS, RACE_DISTANCE } from "../config.js";
import { mulberry32 } from "../utils/rng.js";

export class RaceEngine {
    constructor() {
        this.canvas = document.getElementById("game-canvas");
        this.ctx = this.canvas.getContext("2d", { alpha: true });

        this.animationId = null;
        this.ducks = [];
        this.riverPath = []; // Array of {x, y, width}
        this.cameraY = 0;
        this.finishLineY = RACE_DISTANCE;
        this.raceFinished = false;

        // Handle resizing
        window.addEventListener("resize", () => this.resize());
        this.resize();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    start(seedVal, players, onFinish) {
        // FIX: Use a local variable instead of reassigning the parameter 'seedVal'
        let currentSeed = seedVal;

        // Safety check for seed
        if (!currentSeed) {
            console.warn("⚠️ No seed provided, using fallback");
            currentSeed = Date.now();
        }

        this.rng = mulberry32(currentSeed);
        this.onFinishCallback = onFinish;
        this.raceFinished = false;
        this.cameraY = 0;

        // 1. Generate the River Path
        this.generateRiver();

        // 2. Spawn Ducks (Drop them in)
        this.ducks = [];
        const playerList = Object.values(players);
        const startX = this.canvas.width / 2;

        // FIX: Use for...of instead of forEach
        for (const p of playerList) {
            // Random jitter so they don't spawn perfectly inside each other
            const jitterX = (this.rng() - 0.5) * 100;
            const jitterY = (this.rng() - 0.5) * 100;

            this.ducks.push({
                id: p.name, // or uid
                name: p.name,
                color: p.config.body,
                beak: p.config.beak,

                // Physics Properties
                x: startX + jitterX,
                y: jitterY - 200, // Spawn above screen
                vx: 0,
                vy: 0,
                radius: PHYSICS.DUCK_RADIUS,
                mass: PHYSICS.DUCK_MASS,
                finished: false,
            });
        }

        // 3. Start Loop
        this.lastTime = performance.now();
        this.loop();
    }

    generateRiver() {
        this.riverPath = [];
        const center = this.canvas.width / 2;
        const amplitude = 300; // How wide the river curves
        const frequency = 0.002; // How fast it curves

        // Generate points every 50px down to the finish line + buffer
        for (let y = -500; y < this.finishLineY + 2000; y += 50) {
            // Simple Sine Wave River
            const curve = Math.sin(y * frequency) * amplitude;
            // Add some "noise" to make it look organic
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
        const dt = Math.min((now - this.lastTime) / 1000, 0.1); // Cap dt for safety
        this.lastTime = now;

        this.updatePhysics(dt);
        this.render();

        if (!this.raceFinished) {
            this.animationId = requestAnimationFrame(() => this.loop());
        }
    }

    updatePhysics(dt) {
        let finishedCount = 0;

        // 1. Move Ducks
        // FIX: Use for...of instead of forEach
        for (const duck of this.ducks) {
            if (duck.finished) {
                finishedCount++;
                continue;
            }

            // A. Apply Forces (Gravity/Flow)
            // Water pushes them down
            duck.vy += PHYSICS.FLOW_SPEED * dt * 60;
            // Turbulence (random left/right push)
            duck.vx += (this.rng() - 0.5) * PHYSICS.TURBULENCE * 60;
            // Friction (Water Drag)
            duck.vx *= 0.98;
            duck.vy *= 0.98;

            // B. Apply Velocity
            duck.x += duck.vx * dt * 60;
            duck.y += duck.vy * dt * 60;

            // C. Check Finish
            if (duck.y >= this.finishLineY && !duck.finished) {
                duck.finished = true;
                duck.finishTime = performance.now();
            }
        }

        // 2. Resolve Collisions (Elastic Duck-to-Duck)
        // Simple O(N^2) check - fine for < 500 ducks
        for (let i = 0; i < this.ducks.length; i++) {
            for (let j = i + 1; j < this.ducks.length; j++) {
                this.resolveCollision(this.ducks[i], this.ducks[j]);
            }
        }

        // 3. Resolve Wall Collisions (River Banks)
        // FIX: Use for...of instead of forEach
        for (const duck of this.ducks) {
            this.resolveWallCollision(duck);
        }

        // 4. Update Camera (Follow Leader)
        const leaderY = Math.max(...this.ducks.map((d) => d.y));
        const targetCamY = leaderY - this.canvas.height * 0.4;
        // Smooth camera panning
        this.cameraY += (targetCamY - this.cameraY) * 0.1;

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
            // Physics: Elastic Collision Response
            const angle = Math.atan2(dy, dx);
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);

            // Rotate velocities
            const v1 = { x: 0, y: 0 };
            const v2 = { x: 0, y: 0 };

            // Velocity in rotated frame
            const v1r = d1.vx * cos + d1.vy * sin;
            const v1t = -d1.vx * sin + d1.vy * cos;
            const v2r = d2.vx * cos + d2.vy * sin;
            const v2t = -d2.vx * sin + d2.vy * cos;

            // Swap radial velocities (for equal mass)

            // Rotate back
            d1.vx = v2r * cos - v1t * sin;
            d1.vy = v2r * sin + v1t * cos;
            d2.vx = v1r * cos - v2t * sin;
            d2.vy = v1r * sin + v2t * cos;

            // Seperate overlaps to prevent sticking
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
        // Find river segment for this duck's Y
        // We look up the closest generated point
        const segmentIndex = Math.floor((duck.y + 500) / 50); // Offset based on generation loop
        const segment = this.riverPath[segmentIndex] || this.riverPath[this.riverPath.length - 1];

        if (!segment) return;

        const leftBank = segment.centerX - segment.width / 2;
        const rightBank = segment.centerX + segment.width / 2;

        // Hit Left Wall
        if (duck.x - duck.radius < leftBank) {
            duck.x = leftBank + duck.radius;
            duck.vx *= -PHYSICS.WALL_DAMPING;
        }
        // Hit Right Wall
        else if (duck.x + duck.radius > rightBank) {
            duck.x = rightBank - duck.radius;
            duck.vx *= -PHYSICS.WALL_DAMPING;
        }
    }

    render() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        ctx.clearRect(0, 0, width, height);

        ctx.save();
        // Apply Camera Transform
        ctx.translate(0, -this.cameraY);

        // 1. Draw River (Water)
        // We draw a large polygon connecting the banks
        ctx.beginPath();
        ctx.fillStyle = "#1E90FF"; // Deep water blue

        // Left Bank Points
        // FIX: Use for...of instead of forEach
        for (const p of this.riverPath) {
            ctx.lineTo(p.centerX - p.width / 2, p.y);
        }
        // Right Bank Points (reversed)
        for (let i = this.riverPath.length - 1; i >= 0; i--) {
            const p = this.riverPath[i];
            ctx.lineTo(p.centerX + p.width / 2, p.y);
        }
        ctx.fill();

        // 2. Draw Banks (Grass)
        // Simple visualization: Large rectangles on sides, covering "behind" the river
        ctx.globalCompositeOperation = "destination-over"; // Draw BEHIND water
        ctx.fillStyle = "#228B22"; // Forest Green
        ctx.fillRect(0, this.cameraY, width, height); // Fill entire screen background
        ctx.globalCompositeOperation = "source-over"; // Reset

        // 3. Draw Finish Line
        ctx.fillStyle = "white";
        ctx.fillRect(0, this.finishLineY, width, 20);

        // 4. Draw Ducks
        // FIX: Use for...of instead of forEach
        for (const duck of this.ducks) {
            // Body
            ctx.beginPath();
            ctx.arc(duck.x, duck.y, duck.radius, 0, Math.PI * 2);
            ctx.fillStyle = duck.color;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgba(0,0,0,0.3)";
            ctx.stroke();

            // Beak (Directional?)
            // For now just a circle on top
            ctx.beginPath();
            ctx.arc(duck.x, duck.y - 5, 5, 0, Math.PI * 2);
            ctx.fillStyle = duck.beak;
            ctx.fill();

            // Name Tag
            ctx.fillStyle = "white";
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.fillText(duck.name, duck.x, duck.y - 20);
        }

        ctx.restore();
    }

    endRace() {
        this.raceFinished = true;
        // Sort by finish time
        this.ducks.sort((a, b) => a.finishTime - b.finishTime);

        // Map back to format expected by UI
        const finishOrder = this.ducks.map((d, i) => ({
            originalIndex: 0, // Not used in infinite mode
            config: { body: d.color, beak: d.beak },
            name: d.name,
        }));

        if (this.onFinishCallback) this.onFinishCallback(finishOrder);
    }

    stop() {
        cancelAnimationFrame(this.animationId);
    }
}
