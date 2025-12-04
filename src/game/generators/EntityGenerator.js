import { HUNTERS, POWERUPS } from "../../config.js";

export class EntityGenerator {
    constructor(rng) {
        this.rng = rng;
    }

    generate(riverPath, finishLineY) {
        const powerupBoxes = [];
        const hunters = [];

        for (const segment of riverPath) {
            // Powerups
            if (segment.y > 200 && segment.y < finishLineY && this.rng() < POWERUPS.SPAWN_RATE) {
                powerupBoxes.push({
                    x: segment.centerX + (this.rng() - 0.5) * (segment.width * 0.8),
                    y: segment.y,
                    size: POWERUPS.BOX_SIZE,
                    active: true,
                    bobOffset: this.rng() * Math.PI * 2,
                });
            }

            // Hunters
            if (segment.y > 200 && segment.y < finishLineY && this.rng() < HUNTERS.SPAWN_RATE) {
                const leftBankX = segment.centerX - segment.width / 2;
                const rightBankX = segment.centerX + segment.width / 2;

                const side = this.rng() > 0.5 ? -1 : 1;
                const dist = 30 + this.rng() * 20;

                hunters.push({
                    x: side === -1 ? leftBankX - dist : rightBankX + dist,
                    y: segment.y,
                    cooldown: 0,
                    activeShot: null,
                });
            }
        }

        return { powerupBoxes, hunters };
    }
}
