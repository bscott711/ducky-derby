import { LEVEL_GEN, PHYSICS, POWERUPS, RACE_DISTANCE } from "../config.js";
import { mulberry32 } from "../utils/rng.js";

export class LevelGenerator {
    constructor(seed) {
        this.rng = mulberry32(seed);
        this.finishLineY = RACE_DISTANCE;
    }

    generate() {
        const riverPath = [];
        const obstacles = [];
        const decorations = [];
        const rapids = [];
        const whirlpools = [];
        const powerupBoxes = [];

        // Use fixed Game Width logic
        const center = PHYSICS.GAME_WIDTH / 2;
        const amplitude = 300;
        const frequency = 0.002;

        for (let y = -500; y < this.finishLineY + 2000; y += 5) {
            const curve = Math.sin(y * frequency) * amplitude;
            const noise = (this.rng() - 0.5) * 3;
            riverPath.push({
                y: y,
                centerX: center + curve + noise,
                width: PHYSICS.RIVER_WIDTH,
            });
        }

        let inRapid = false;
        let rapidEnd = 0;

        for (const segment of riverPath) {
            // Rapids
            if (
                !inRapid &&
                segment.y < this.finishLineY &&
                this.rng() < LEVEL_GEN.RAPID_FREQUENCY
            ) {
                inRapid = true;
                rapidEnd = segment.y + LEVEL_GEN.RAPID_LENGTH;
                rapids.push({ startY: segment.y, endY: rapidEnd });
            }
            if (inRapid && segment.y > rapidEnd) inRapid = false;

            // Whirlpools
            if (
                segment.y > 500 &&
                segment.y < this.finishLineY &&
                this.rng() < LEVEL_GEN.WHIRLPOOL_FREQUENCY
            ) {
                whirlpools.push({
                    x: segment.centerX + (this.rng() - 0.5) * (segment.width * 0.6),
                    y: segment.y,
                    radius: PHYSICS.WHIRLPOOL_RADIUS,
                });
            }

            // Powerups
            if (
                segment.y > 200 &&
                segment.y < this.finishLineY &&
                this.rng() < POWERUPS.SPAWN_RATE
            ) {
                powerupBoxes.push({
                    x: segment.centerX + (this.rng() - 0.5) * (segment.width * 0.8),
                    y: segment.y,
                    size: POWERUPS.BOX_SIZE,
                    active: true,
                    bobOffset: this.rng() * Math.PI * 2,
                });
            }

            // Rocks
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

                obstacles.push({
                    x: segment.centerX + offset,
                    y: segment.y,
                    radius: r,
                    vertices: vertices,
                    rotation: this.rng() * Math.PI * 2,
                });
            }

            // Decorations
            const leftBankX = segment.centerX - segment.width / 2;
            const rightBankX = segment.centerX + segment.width / 2;

            if (this.rng() < LEVEL_GEN.TREE_DENSITY) {
                const side = this.rng() > 0.5 ? -1 : 1;
                const dist = 20 + this.rng() * 100;
                decorations.push({
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
                decorations.push({
                    x: side === -1 ? leftBankX - dist : rightBankX + dist,
                    y: segment.y,
                    radius: 2 + this.rng() * 2,
                    color1: "#1a6b1a",
                    type: "grass",
                });
            }

            if (this.rng() < LEVEL_GEN.OBSTACLE_DENSITY) {
                const side = this.rng() > 0.5 ? -1 : 1;
                decorations.push({
                    x: side === -1 ? leftBankX - 5 : rightBankX + 5,
                    y: segment.y,
                    radius: 8 + this.rng() * 10,
                    color1: "#808080",
                    type: "bank_rock",
                });
            }
        }

        return { riverPath, obstacles, decorations, rapids, whirlpools, powerupBoxes };
    }
}
