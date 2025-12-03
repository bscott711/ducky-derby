import { RACE_DISTANCE } from "../config.js";
import { DuckRenderer } from "./renderers/DuckRenderer.js";
import { EntityRenderer } from "./renderers/EntityRenderer.js";
import { EnvironmentRenderer } from "./renderers/EnvironmentRenderer.js";

export class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d", { alpha: true });
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.finishLineY = RACE_DISTANCE;

        // Sub-Renderers
        this.envRenderer = new EnvironmentRenderer();
        this.entityRenderer = new EntityRenderer();
        this.duckRenderer = new DuckRenderer();

        window.addEventListener("resize", () => this.resize());
        this.resize();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }

    draw(state) {
        const {
            cameraY,
            cameraX,
            ducks,
            riverPath,
            obstacles,
            decorations,
            whirlpools,
            rapids,
            powerupBoxes,
            hunters,
            globalTime,
        } = state;

        const ctx = this.ctx;

        // 1. Static Ground (Clear Screen)
        this.envRenderer.drawGround(ctx, this.width, this.height);

        ctx.save();

        // 2. Camera Transform
        const TARGET_VIEW_WIDTH = 600;
        const scale = Math.min(1.0, this.width / TARGET_VIEW_WIDTH);

        ctx.translate(this.width / 2, this.height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-cameraX, -cameraY);

        const renderStart = cameraY - 600;
        const renderEnd = cameraY + 1000;

        // 3. Decorations (Layer: Bottom/Grass)
        this.envRenderer.drawDecorations(ctx, decorations, renderStart, renderEnd, "bottom");

        // 4. River
        this.envRenderer.drawRiver(ctx, riverPath, renderStart, renderEnd);

        // 5. Entities (Water Layer)
        this.entityRenderer.drawWhirlpools(ctx, whirlpools, globalTime, renderStart, renderEnd);
        this.entityRenderer.drawRapids(ctx, rapids, riverPath, renderStart, renderEnd);

        // 6. Entities (Object Layer)
        this.entityRenderer.drawPowerups(ctx, powerupBoxes, globalTime, renderStart, renderEnd);
        this.entityRenderer.drawObstacles(ctx, obstacles, renderStart, renderEnd);

        // 7. Decorations (Layer: Top/Trees/BankRocks)
        this.envRenderer.drawDecorations(ctx, decorations, renderStart, renderEnd, "top");

        // 8. Entities (Hunters)
        this.entityRenderer.drawHunters(ctx, hunters, renderStart, renderEnd);

        // 9. Structures (Bottom Layer)
        this.envRenderer.drawBridge(ctx, riverPath);
        this.envRenderer.drawFinishLine(ctx, riverPath, this.finishLineY);

        // 10. Ducks
        for (const duck of ducks) {
            this.duckRenderer.draw(ctx, duck, globalTime, this.finishLineY);
        }

        // 11. Structures (Top Layer)
        this.envRenderer.drawNet(ctx, riverPath, this.finishLineY);

        ctx.restore();
    }
}
