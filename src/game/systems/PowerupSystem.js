import { POWERUPS } from "../../config.js";

export class PowerupSystem {
    constructor(rng) {
        this.rng = rng;
    }

    update(ducks, powerupBoxes, timeScale) {
        // 1. Handle Box Collisions
        for (const duck of ducks) {
            if (duck.finished || duck.z > 0) continue;

            for (const box of powerupBoxes) {
                if (!box.active) continue;

                const dx = duck.x - box.x;
                const dy = duck.y - box.y;

                // Simple AABB/Circle check approximation for box collection
                if (Math.abs(dx) < POWERUPS.BOX_SIZE && Math.abs(dy) < POWERUPS.BOX_SIZE) {
                    this.collectPowerup(duck, box);
                }
            }
        }

        // 2. Handle Active Effects on Ducks
        for (const duck of ducks) {
            if (!duck.effect) continue;

            // Tick down timer
            duck.effectTimer -= timeScale;
            if (duck.effectTimer <= 0) {
                this.removeEffect(duck);
            }

            // Apply "GIANT" Gravity Effect
            if (duck.effect === "GIANT" && !duck.finished) {
                this.applyGiantGravity(duck, ducks, timeScale);
            }
        }
    }

    collectPowerup(duck, box) {
        box.active = false;

        // Randomize Effect
        const typeIndex = Math.floor(this.rng() * POWERUPS.TYPES.length);
        const type = POWERUPS.TYPES[typeIndex];

        duck.effect = type;
        duck.effectTimer = POWERUPS.DURATION;

        // Apply Immediate Stats
        if (type === "GIANT") {
            duck.radius = duck.originalRadius * POWERUPS.GIANT_SCALE;
        } else if (type === "SPEED") {
            duck.vy += POWERUPS.SPEED_FORCE;
        }
    }

    removeEffect(duck) {
        duck.effect = null;
        duck.radius = duck.originalRadius;
    }

    applyGiantGravity(giantDuck, allDucks, timeScale) {
        for (const other of allDucks) {
            if (other === giantDuck || other.finished) continue;

            const dx = giantDuck.x - other.x;
            const dy = giantDuck.y - other.y;
            const distSq = dx ** 2 + dy ** 2;

            if (distSq < POWERUPS.GIANT_RANGE ** 2) {
                const dist = Math.sqrt(distSq);
                // Inverse linear falloff
                const force =
                    (1 - dist / POWERUPS.GIANT_RANGE) * POWERUPS.GIANT_GRAVITY * timeScale;

                other.vx += (dx / dist) * force;
                other.vy += (dy / dist) * force;
            }
        }
    }
}
