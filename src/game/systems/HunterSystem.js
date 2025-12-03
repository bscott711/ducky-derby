import { HUNTERS } from "../../config.js";

export class HunterSystem {
    update(hunters, ducks, timeScale) {
        for (const hunter of hunters) {
            // Manage cooldowns
            if (hunter.cooldown > 0) hunter.cooldown -= timeScale;
            if (hunter.activeShot > 0) hunter.activeShot--;

            // Shooting Logic
            if (hunter.cooldown <= 0) {
                this.tryShoot(hunter, ducks);
            }
        }
    }

    tryShoot(hunter, ducks) {
        let closestDuck = null;
        let minDistSq = HUNTERS.RANGE * HUNTERS.RANGE;

        for (const duck of ducks) {
            // Don't shoot finished, ghosts, or already hunted ducks
            if (duck.finished || duck.effect === "GHOST" || duck.effect === "HUNTED") continue;

            const dx = duck.x - hunter.x;
            const dy = duck.y - hunter.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < minDistSq) {
                minDistSq = distSq;
                closestDuck = duck;
            }
        }

        if (closestDuck) {
            // Fire!
            hunter.cooldown = HUNTERS.COOLDOWN;
            hunter.activeShot = 30; // Visual duration of laser
            hunter.targetX = closestDuck.x;
            hunter.targetY = closestDuck.y;

            // Apply Penalty
            closestDuck.effect = "HUNTED";
            closestDuck.effectTimer = HUNTERS.DURATION;
            closestDuck.vx *= 0.5;
            closestDuck.vy *= 0.5;
        }
    }
}
