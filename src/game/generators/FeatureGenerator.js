import { LEVEL_GEN, PHYSICS } from "../../config.js";

export class FeatureGenerator {
    constructor(rng) {
        this.rng = rng;
    }

    generate(riverPath, finishLineY) {
        const rapids = [];
        const whirlpools = [];

        let inRapid = false;
        let rapidEnd = 0;

        for (const segment of riverPath) {
            // Rapids
            if (!inRapid && segment.y < finishLineY && this.rng() < LEVEL_GEN.RAPID_FREQUENCY) {
                inRapid = true;
                rapidEnd = segment.y + LEVEL_GEN.RAPID_LENGTH;
                rapids.push({ startY: segment.y, endY: rapidEnd });
            }
            if (inRapid && segment.y > rapidEnd) inRapid = false;

            // Whirlpools
            if (
                segment.y > 500 &&
                segment.y < finishLineY &&
                this.rng() < LEVEL_GEN.WHIRLPOOL_FREQUENCY
            ) {
                whirlpools.push({
                    x: segment.centerX + (this.rng() - 0.5) * (segment.width * 0.6),
                    y: segment.y,
                    radius: PHYSICS.WHIRLPOOL_RADIUS,
                });
            }
        }

        return { rapids, whirlpools };
    }
}
