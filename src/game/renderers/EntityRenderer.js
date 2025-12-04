import { HUNTERS } from "../../config.js";

export class EntityRenderer {
    drawWhirlpools(ctx, whirlpools, globalTime, renderStart, renderEnd) {
        for (const pool of whirlpools) {
            if (pool.y < renderStart || pool.y > renderEnd) continue;
            ctx.save();
            ctx.translate(pool.x, pool.y);
            ctx.rotate(globalTime * 2);
            ctx.beginPath();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
            ctx.lineWidth = 3;
            for (let arm = 0; arm < 2; arm++) {
                ctx.rotate(Math.PI);
                ctx.moveTo(0, 0);
                for (let i = 0; i < pool.radius; i += 2) {
                    const angle = i * 0.2;
                    const r = i;
                    ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
                }
            }
            ctx.stroke();
            ctx.restore();
        }
    }

    drawRapids(ctx, rapids, riverPath, renderStart, renderEnd) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 2;
        for (const rapid of rapids) {
            if (rapid.endY < renderStart || rapid.startY > renderEnd) continue;

            const timeOffset = Date.now() / 100;
            const startIdx = Math.max(0, Math.floor((rapid.startY + 500) / 5));
            const endIdx = Math.min(riverPath.length - 1, Math.floor((rapid.endY + 500) / 5));

            ctx.beginPath();
            for (let i = startIdx; i < endIdx; i += 10) {
                const p = riverPath[i];
                // Zig-zag lines for rapid water
                const xOff = Math.sin(i * 0.1 + timeOffset) * (p.width * 0.4);
                ctx.moveTo(p.centerX + xOff, p.y);
                ctx.lineTo(p.centerX + xOff, p.y + 20);

                const xOff2 = Math.cos(i * 0.15 + timeOffset) * (p.width * 0.3);
                ctx.moveTo(p.centerX + xOff2, p.y + 10);
                ctx.lineTo(p.centerX + xOff2, p.y + 30);
            }
            ctx.stroke();
        }
    }

    drawPowerups(ctx, boxes, globalTime, renderStart, renderEnd) {
        for (const box of boxes) {
            if (!box.active || box.y < renderStart || box.y > renderEnd) continue;
            ctx.save();
            const floatY = Math.sin(globalTime * 3 + box.bobOffset) * 5;
            ctx.translate(box.x, box.y + floatY);

            ctx.fillStyle = "#FFD700";
            ctx.strokeStyle = "#DAA520";
            ctx.lineWidth = 2;
            const sz = box.size;
            ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
            ctx.strokeRect(-sz / 2, -sz / 2, sz, sz);

            ctx.fillStyle = "white";
            ctx.font = "bold 16px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("?", 0, 0);
            ctx.restore();
        }
    }

    drawObstacles(ctx, obstacles, renderStart, renderEnd) {
        for (const rock of obstacles) {
            if (rock.y < renderStart || rock.y > renderEnd) continue;
            ctx.save();
            ctx.translate(rock.x, rock.y);
            ctx.rotate(rock.rotation);

            ctx.beginPath();
            const v = rock.vertices;
            ctx.moveTo(v[0].x, v[0].y);
            for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
            ctx.closePath();

            ctx.fillStyle = "#808080";
            ctx.fill();
            ctx.strokeStyle = "#555";
            ctx.lineWidth = 2;
            ctx.stroke();

            // Detail line
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(v[0].x * 0.5, v[0].y * 0.5);
            ctx.stroke();
            ctx.restore();
        }
    }

    drawHunters(ctx, hunters, renderStart, renderEnd) {
        for (const hunter of hunters) {
            if (hunter.y < renderStart || hunter.y > renderEnd) continue;

            ctx.beginPath();
            ctx.arc(hunter.x, hunter.y, 10, 0, Math.PI * 2);
            ctx.fillStyle = HUNTERS.COLOR;
            ctx.fill();
            ctx.strokeStyle = "#333";
            ctx.lineWidth = 2;
            ctx.stroke();

            // Laser Sight
            if (hunter.activeShot > 0) {
                ctx.beginPath();
                ctx.moveTo(hunter.x, hunter.y);
                ctx.lineTo(hunter.targetX, hunter.targetY);
                ctx.strokeStyle = "rgba(255, 0, 0, 0.7)";
                ctx.lineWidth = 3;
                ctx.stroke();
            }
        }
    }
}
