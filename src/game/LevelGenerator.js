import { RACE_DISTANCE } from "../config.js";
import { mulberry32 } from "../utils/rng.js";
import { DecorationGenerator } from "./generators/DecorationGenerator.js";
import { EntityGenerator } from "./generators/EntityGenerator.js";
import { FeatureGenerator } from "./generators/FeatureGenerator.js";
import { ObstacleGenerator } from "./generators/ObstacleGenerator.js";
import { RiverGenerator } from "./generators/RiverGenerator.js";

export class LevelGenerator {
    constructor(seed) {
        this.rng = mulberry32(seed);
        this.finishLineY = RACE_DISTANCE;

        // Initialize Sub-Generators
        this.riverGen = new RiverGenerator(this.rng);
        this.featureGen = new FeatureGenerator(this.rng);
        this.obstacleGen = new ObstacleGenerator(this.rng);
        this.entityGen = new EntityGenerator(this.rng);
        this.decorationGen = new DecorationGenerator(this.rng);
    }

    generate() {
        // 1. Generate Spine
        const riverPath = this.riverGen.generate();

        // 2. Generate Features (Rapids, Whirlpools)
        const { rapids, whirlpools } = this.featureGen.generate(riverPath, this.finishLineY);

        // 3. Generate Obstacles (Rocks)
        const obstacles = this.obstacleGen.generate(riverPath, this.finishLineY);

        // 4. Generate Entities (Powerups, Hunters)
        const { powerupBoxes, hunters } = this.entityGen.generate(riverPath, this.finishLineY);

        // 5. Generate Decorations (Trees, Grass)
        const decorations = this.decorationGen.generate(riverPath);

        return {
            riverPath,
            obstacles,
            decorations,
            rapids,
            whirlpools,
            powerupBoxes,
            hunters,
        };
    }
}
