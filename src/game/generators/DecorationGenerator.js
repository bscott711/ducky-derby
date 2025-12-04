import { LEVEL_GEN } from "../../config.js";

export class DecorationGenerator {
    constructor(rng) {
        this.rng = rng;
    }

    generate(riverPath) {
        const decorations = [];

        for (const segment of riverPath) {
            const leftBankX = segment.centerX - segment.width / 2;
            const rightBankX = segment.centerX + segment.width / 2;

            // Trees
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

            // Grass
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

            // Bank Rocks
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

        return decorations;
    }
}
