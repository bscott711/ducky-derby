import { LEVEL_GEN, PHYSICS } from "../../config.js";

export class ObstacleGenerator {
    constructor(rng) {
        this.rng = rng;
    }

    generate(riverPath, finishLineY) {
        const obstacles = [];

        for (const segment of riverPath) {
            // Rocks
            if (
                segment.y > 0 &&
                segment.y < finishLineY &&
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
        }

        return obstacles;
    }
}
