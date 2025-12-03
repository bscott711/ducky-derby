import { HUNTERS, NET_OFFSET, PHYSICS, POWERUPS } from "../../config.js";

export class PhysicsSystem {
    constructor(rng) {
        this.rng = rng;
    }

    update(timeScale, state) {
        const { ducks, riverPath, rapids, whirlpools, obstacles, inputs, finishLineY, followId } =
            state;

        const netY = finishLineY + NET_OFFSET;

        // 1. Individual Duck Physics
        for (const duck of ducks) {
            // Z-Axis (Airborne)
            if (duck.z > 0) {
                this.handleAirbornePhysics(duck, timeScale);
                continue;
            }

            // Steering
            if (followId && duck.id === followId && !duck.finished) {
                if (inputs.left) duck.vx -= PHYSICS.STEER_FORCE;
                if (inputs.right) duck.vx += PHYSICS.STEER_FORCE;
            }

            // Cooldowns
            if (duck.cooldownTimer > 0) duck.cooldownTimer -= timeScale;

            // Net Collision
            if (duck.y + duck.radius > netY) {
                this.handleNetCollision(duck, netY);
            } else {
                this.applyRiverForces(duck, riverPath, rapids, whirlpools, timeScale);

                if (duck.y >= finishLineY && !duck.finished) {
                    duck.finished = true;
                    duck.finishTime = performance.now();
                }
            }

            this.integratePosition(duck, timeScale);
        }

        // 2. Collisions
        for (let i = 0; i < ducks.length; i++) {
            for (let j = i + 1; j < ducks.length; j++) {
                this.resolveDuckCollision(ducks[i], ducks[j]);
            }
        }

        // 3. Environment
        for (const duck of ducks) {
            // FIX: Removed '|| duck.finished' so they stay in bounds after finish line
            if (duck.z > 0) continue;

            this.resolveWallCollision(duck, riverPath);

            if (duck.effect !== "GHOST" && duck.effect !== "HUNTED") {
                for (const rock of obstacles) {
                    if (Math.abs(rock.y - duck.y) > 60) continue;
                    this.resolveRockCollision(duck, rock);
                }
            }
        }
    }

    handleAirbornePhysics(duck, timeScale) {
        duck.vz -= PHYSICS.GRAVITY * timeScale;
        duck.z += duck.vz * timeScale;

        if (duck.z <= 0) {
            duck.z = 0;
            duck.vz = 0;
        }
    }

    handleNetCollision(duck, netY) {
        duck.y = netY - duck.radius;
        duck.vy = 0;
        duck.vx *= 0.2;
    }

    applyRiverForces(duck, riverPath, rapids, whirlpools, timeScale) {
        const segmentIndex = Math.floor((duck.y + 500) / 5);
        const currentSeg = riverPath[segmentIndex];
        const nextSeg = riverPath[segmentIndex + 20];

        // Whirlpools
        let trapped = false;
        if (duck.cooldownTimer <= 0 && duck.effect !== "GHOST" && duck.effect !== "HUNTED") {
            for (const pool of whirlpools) {
                const dx = duck.x - pool.x;
                const dy = duck.y - pool.y;
                const dist = Math.sqrt(dx ** 2 + dy ** 2);

                if (dist < pool.radius * 1.5) {
                    trapped = true;
                    duck.trapTimer += timeScale;
                    duck.vx -= (dx / dist) * PHYSICS.WHIRLPOOL_PULL * timeScale;
                    duck.vy -= (dy / dist) * PHYSICS.WHIRLPOOL_PULL * timeScale;
                    const tx = -dy / dist;
                    const ty = dx / dist;
                    duck.vx += tx * PHYSICS.WHIRLPOOL_SPIN * timeScale;
                    duck.vy += ty * PHYSICS.WHIRLPOOL_SPIN * timeScale;

                    if (duck.trapTimer > PHYSICS.WHIRLPOOL_HOLD_TIME) {
                        duck.vy += 15;
                        duck.trapTimer = 0;
                        duck.cooldownTimer = 120;
                    }
                }
            }
        }
        if (!trapped) duck.trapTimer = Math.max(0, duck.trapTimer - timeScale);

        // Flow
        if (duck.trapTimer < 60) {
            let flowX = 0;
            let flowY = 1;

            if (currentSeg && nextSeg) {
                const dx = nextSeg.centerX - currentSeg.centerX;
                const dy = nextSeg.y - currentSeg.y;
                const len = Math.sqrt(dx ** 2 + dy ** 2);
                flowX = dx / len;
                flowY = dy / len;
            }

            let inRapid = false;
            for (const rapid of rapids) {
                if (duck.y >= rapid.startY && duck.y <= rapid.endY) {
                    inRapid = true;
                    break;
                }
            }

            let speed = PHYSICS.FLOW_SPEED;
            let turb = PHYSICS.TURBULENCE;

            if (inRapid) {
                speed += PHYSICS.RAPID_SPEED_BOOST;
                turb = PHYSICS.RAPID_TURBULENCE;
            }

            if (currentSeg) {
                const leftBank = currentSeg.centerX - currentSeg.width / 2;
                const rightBank = currentSeg.centerX + currentSeg.width / 2;
                const distToBank = Math.min(duck.x - leftBank, rightBank - duck.x);

                if (distToBank < PHYSICS.BANK_FRICTION_ZONE) {
                    const zoneFactor = Math.max(0, distToBank / PHYSICS.BANK_FRICTION_ZONE);
                    speed *=
                        PHYSICS.BANK_FLOW_MODIFIER + (1 - PHYSICS.BANK_FLOW_MODIFIER) * zoneFactor;
                }
            }

            duck.vx += flowX * speed * timeScale;
            duck.vy += flowY * speed * timeScale;
            duck.vx += (this.rng() - 0.5) * turb * timeScale;
        }
    }

    integratePosition(duck, timeScale) {
        let frictionVal = 0.96;
        if (duck.effect === "ANCHOR") frictionVal = POWERUPS.ANCHOR_DRAG;
        if (duck.effect === "HUNTED") frictionVal = HUNTERS.DRAG;

        const friction = frictionVal ** timeScale;

        duck.vx *= friction;
        duck.vy *= friction;

        duck.x += duck.vx * timeScale;
        duck.y += duck.vy * timeScale;

        // FIX: Update facing direction only when moving fast enough (Hysteresis)
        // This preserves the initial random direction until they actually move.
        if (Math.abs(duck.vx) > 0.1) {
            duck.facingRight = duck.vx > 0;
        }
    }

    resolveDuckCollision(d1, d2) {
        if ((d1.finished && d2.finished) || d1.z > 0 || d2.z > 0) return;
        if (d1.effect === "GHOST" || d2.effect === "GHOST") return;
        if (d1.effect === "HUNTED" || d2.effect === "HUNTED") return;

        const dx = d2.x - d1.x;
        const dy = d2.y - d1.y;
        const distance = Math.sqrt(dx ** 2 + dy ** 2);
        const minDist = d1.radius + d2.radius;

        if (distance < minDist) {
            const angle = Math.atan2(dy, dx);
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);

            const v1r = d1.vx * cos + d1.vy * sin;
            const v1t = -d1.vx * sin + d1.vy * cos;
            const v2r = d2.vx * cos + d2.vy * sin;
            const v2t = -d2.vx * sin + d2.vy * cos;

            let restitution = PHYSICS.COLLISION_DAMPING;
            if (d1.effect === "BOUNCY" || d2.effect === "BOUNCY") {
                restitution = POWERUPS.BOUNCY_FACTOR;
            }

            const v1rFinal = v2r * restitution;
            const v2rFinal = v1r * restitution;

            d1.vx = v1rFinal * cos - v1t * sin;
            d1.vy = v1rFinal * sin + v1t * cos;
            d2.vx = v2rFinal * cos - v2t * sin;
            d2.vy = v2rFinal * sin + v2t * cos;

            const overlap = minDist - distance;
            const separationX = overlap * cos * 0.5;
            const separationY = overlap * sin * 0.5;
            d1.x -= separationX;
            d1.y -= separationY;
            d2.x += separationX;
            d2.y += separationY;
        }
    }

    resolveWallCollision(duck, riverPath) {
        const segmentIndex = Math.floor((duck.y + 500) / 5);
        // Fallback to last segment if we are past the finish line
        const segment = riverPath[segmentIndex] || riverPath[riverPath.length - 1];
        if (!segment) return;

        const leftBank = segment.centerX - segment.width / 2;
        const rightBank = segment.centerX + segment.width / 2;

        if (duck.x - duck.radius < leftBank) {
            duck.x = leftBank + duck.radius;
            duck.vx = Math.abs(duck.vx) * PHYSICS.WALL_DAMPING + 0.5;
        } else if (duck.x + duck.radius > rightBank) {
            duck.x = rightBank - duck.radius;
            duck.vx = -Math.abs(duck.vx) * PHYSICS.WALL_DAMPING - 0.5;
        }
    }

    resolveRockCollision(duck, rock) {
        const dx = duck.x - rock.x;
        const dy = duck.y - rock.y;
        const distance = Math.sqrt(dx ** 2 + dy ** 2);
        const minDist = duck.radius + rock.radius;

        if (distance < minDist) {
            const nx = dx / distance;
            const ny = dy / distance;
            const overlap = minDist - distance;
            duck.x += nx * overlap;
            duck.y += ny * overlap;

            let restitution = PHYSICS.COLLISION_DAMPING;
            if (duck.effect === "BOUNCY") restitution = POWERUPS.BOUNCY_FACTOR;

            const dot = duck.vx * nx + duck.vy * ny;
            duck.vx = (duck.vx - 2 * dot * nx) * restitution;
            duck.vy = (duck.vy - 2 * dot * ny) * restitution;
        }
    }
}
