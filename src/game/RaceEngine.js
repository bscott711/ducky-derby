import { DUCK_COLORS, RACE_DISTANCE } from "../config.js";
import { mulberry32 } from "../utils/rng.js";

export class RaceEngine {
    constructor(uiManager) {
        this.ui = uiManager;
        this.animationId = null;
        this.ducks = [];
        this.finishOrder = [];
        this.cameraX = 0;
        this.seededRandom = Math.random;
    }

    start(seedVal, onFinish) {
        this.seededRandom = mulberry32(seedVal);
        this.ducks = [];
        this.finishOrder = [];
        this.cameraX = 0;

        // Create logical ducks
        const duckEls = this.ui.buildGameWorld(); // Reset DOM

        for (const [index, config] of DUCK_COLORS.entries()) {
            this.ducks.push({
                index: index,
                x: 0,
                y: 0, // wobble offset
                speed: 2,
                wobbleOffset: this.seededRandom() * Math.PI * 2,
                finished: false,
                config: config,
                originalIndex: index,
            });
        }

        this.onFinishCallback = onFinish;
        this.loop(0);
    }

    loop(timestamp) {
        if (this.finishOrder.length === this.ducks.length) {
            this.onFinishCallback(this.finishOrder);
            return;
        }

        const finishLineX = RACE_DISTANCE;
        let leadingDuckX = 0;

        for (const duck of this.ducks) {
            if (duck.finished) {
                if (duck.x > leadingDuckX) leadingDuckX = duck.x;
                return;
            }

            // Physics
            duck.speed += (this.seededRandom() - 0.5) * 0.1;
            duck.speed = Math.max(2, Math.min(duck.speed, 6));
            duck.x += duck.speed;

            // Wobble Y calculation for visual
            duck.y = Math.sin(timestamp / 200 + duck.wobbleOffset) * 5;

            if (duck.x > leadingDuckX) leadingDuckX = duck.x;

            if (duck.x >= finishLineX) {
                duck.finished = true;
                duck.x = finishLineX + this.seededRandom() * 50;
                this.finishOrder.push(duck);
            }
        }

        // Camera Logic
        const maxCameraX = finishLineX - window.innerWidth * 0.8;
        let targetCameraX = Math.max(0, leadingDuckX - window.innerWidth * 0.4);
        if (targetCameraX > maxCameraX) targetCameraX = maxCameraX;
        this.cameraX += (targetCameraX - this.cameraX) * 0.1;

        // Render Frame
        this.ui.updateCamera(this.cameraX, null, this.ducks);

        this.animationId = requestAnimationFrame((t) => this.loop(t));
    }

    stop() {
        cancelAnimationFrame(this.animationId);
    }
}
