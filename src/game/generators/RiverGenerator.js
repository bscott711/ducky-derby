import { PHYSICS, RACE_DISTANCE } from "../../config.js";

export class RiverGenerator {
    constructor(rng) {
        this.rng = rng;
    }

    generate() {
        const riverPath = [];
        const center = PHYSICS.GAME_WIDTH / 2;
        const amplitude = 300;
        const frequency = 0.002;
        const finishLineY = RACE_DISTANCE;

        // Generate from behind start line to past finish line
        for (let y = -500; y < finishLineY + 2000; y += 5) {
            const curve = Math.sin(y * frequency) * amplitude;
            const noise = (this.rng() - 0.5) * 3;

            riverPath.push({
                y: y,
                centerX: center + curve + noise,
                width: PHYSICS.RIVER_WIDTH,
            });
        }

        return riverPath;
    }
}
