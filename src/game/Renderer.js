import { NET_OFFSET, PHYSICS, POWERUPS, RACE_DISTANCE } from "../config.js";

export class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d", { alpha: true });
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.finishLineY = RACE_DISTANCE;

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
            globalTime,
        } = state;

        const ctx = this.ctx;

        // 1. Clear & Draw Ground
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.fillStyle = "#228B22";
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.save();

        // 2. Camera Transform (Standard View)
        const TARGET_VIEW_WIDTH = 550;
        const scale = Math.min(1.0, this.width / TARGET_VIEW_WIDTH);

        ctx.translate(this.width / 2, this.height / 2);
        ctx.scale(scale, scale);

        // Move world so Camera Target is at Center Screen
        ctx.translate(-cameraX, -cameraY);

        // Look Ahead Offset: Move world UP slightly so we see more "downstream"
        const lookAhead = (this.height / scale) * 0.15;
        ctx.translate(0, -lookAhead);

        // Render Bounds
        const renderStart = cameraY - 500;
        const renderEnd = cameraY + 1000;

        // 3. Decorations
        for (const deco of decorations) {
            if (deco.y < renderStart || deco.y > renderEnd) continue;
            if (deco.type === "grass") {
                ctx.beginPath();
                ctx.arc(deco.x, deco.y, deco.radius, 0, Math.PI * 2);
                ctx.fillStyle = deco.color1;
                ctx.fill();
            }
        }

        // 4. River
        ctx.beginPath();
        ctx.fillStyle = "#1E90FF";
        const startIndex = Math.max(0, Math.floor((renderStart + 500) / 5));
        const endIndex = Math.min(riverPath.length - 1, Math.floor((renderEnd + 500) / 5));

        for (let i = startIndex; i <= endIndex; i++) {
            const p = riverPath[i];
            ctx.lineTo(p.centerX - p.width / 2, p.y);
        }
        for (let i = endIndex; i >= startIndex; i--) {
            const p = riverPath[i];
            ctx.lineTo(p.centerX + p.width / 2, p.y);
        }
        ctx.fill();

        // 5. Whirlpools
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

        // 6. Rapids
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
                const xOff = Math.sin(i * 0.1 + timeOffset) * (p.width * 0.4);
                ctx.moveTo(p.centerX + xOff, p.y);
                ctx.lineTo(p.centerX + xOff, p.y + 20);
                const xOff2 = Math.cos(i * 0.15 + timeOffset) * (p.width * 0.3);
                ctx.moveTo(p.centerX + xOff2, p.y + 10);
                ctx.lineTo(p.centerX + xOff2, p.y + 30);
            }
            ctx.stroke();
        }

        // 7. Power-Up Boxes
        for (const box of powerupBoxes) {
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

        // 8. Obstacles
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
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(v[0].x * 0.5, v[0].y * 0.5);
            ctx.stroke();
            ctx.restore();
        }

        // 9. Bank Decorations
        for (const deco of decorations) {
            if (deco.y < renderStart || deco.y > renderEnd) continue;
            if (deco.type === "tree") {
                ctx.beginPath();
                ctx.arc(deco.x, deco.y, deco.radius, 0, Math.PI * 2);
                ctx.fillStyle = deco.color1;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(deco.x, deco.y, deco.radius * 0.6, 0, Math.PI * 2);
                ctx.fillStyle = deco.color2;
                ctx.fill();
            } else if (deco.type === "bank_rock") {
                ctx.beginPath();
                ctx.arc(deco.x, deco.y, deco.radius, 0, Math.PI * 2);
                ctx.fillStyle = deco.color1;
                ctx.fill();
            }
        }

        this.drawBridge(ctx, riverPath);
        this.drawFinishLine(ctx, riverPath);
        this.drawNet(ctx, riverPath);

        // 10. Ducks
        for (const duck of ducks) {
            this.drawDuck(ctx, duck, globalTime);
        }

        ctx.restore();
    }

    drawFinishLine(ctx, riverPath) {
        const finishSegIdx = Math.floor((this.finishLineY + 500) / 5);
        const finishSeg = riverPath[finishSegIdx];
        if (finishSeg) {
            const left = finishSeg.centerX - finishSeg.width / 2;
            const right = finishSeg.centerX + finishSeg.width / 2;
            ctx.save();
            ctx.translate(left, this.finishLineY);
            const checkSize = 20;
            const checks = Math.ceil((right - left) / checkSize);
            for (let i = 0; i < checks; i++) {
                ctx.fillStyle = i % 2 === 0 ? "#FFFFFF" : "#000000";
                ctx.fillRect(i * checkSize, 0, checkSize, 20);
            }
            ctx.fillStyle = "#8B4513";
            ctx.fillRect(-10, -30, 10, 50);
            ctx.fillRect(right - left, -30, 10, 50);
            ctx.restore();
        }
    }

    drawNet(ctx, riverPath) {
        const netY = this.finishLineY + NET_OFFSET;
        const netSegIdx = Math.floor((netY + 500) / 5);
        const netSeg = riverPath[netSegIdx];
        if (netSeg) {
            const left = netSeg.centerX - netSeg.width / 2;
            const right = netSeg.centerX + netSeg.width / 2;
            ctx.save();
            ctx.translate(left, netY);
            ctx.fillStyle = "#555";
            ctx.fillRect(-10, -40, 10, 60);
            ctx.fillRect(right - left, -40, 10, 60);
            ctx.beginPath();
            ctx.rect(0, -20, right - left, 40);
            ctx.strokeStyle = "rgba(0,0,0,0.3)";
            ctx.lineWidth = 1;
            ctx.save();
            ctx.clip();
            for (let i = 0; i < right - left + 40; i += 10) {
                ctx.moveTo(i, -20);
                ctx.lineTo(i - 40, 20);
                ctx.moveTo(i - 40, -20);
                ctx.lineTo(i, 20);
            }
            ctx.stroke();
            ctx.restore();
            ctx.beginPath();
            ctx.moveTo(0, -20);
            ctx.lineTo(right - left, -20);
            ctx.lineWidth = 4;
            ctx.strokeStyle = "#8B0000";
            ctx.stroke();
            ctx.restore();
        }
    }

    drawBridge(ctx, riverPath) {
        const bridgeY = -200;
        const segmentIndex = Math.floor((bridgeY + 500) / 5);
        const segment = riverPath[segmentIndex];
        if (!segment) return;
        const bridgeWidth = PHYSICS.RIVER_WIDTH + 140;
        const startX = segment.centerX - bridgeWidth / 2;
        const endX = segment.centerX + bridgeWidth / 2;
        const archHeight = 60;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(startX, bridgeY + 20);
        ctx.quadraticCurveTo(segment.centerX, bridgeY - 40, endX, bridgeY + 20);
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 15;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(startX - 10, bridgeY);
        ctx.quadraticCurveTo(segment.centerX, bridgeY - archHeight * 2, endX + 10, bridgeY);
        ctx.lineWidth = 40;
        ctx.strokeStyle = "#8B4513";
        ctx.lineCap = "butt";
        ctx.stroke();
        ctx.strokeStyle = "#A0522D";
        ctx.lineWidth = 3;
        ctx.globalCompositeOperation = "source-atop";
        ctx.lineWidth = 34;
        ctx.strokeStyle = "#8B4513";
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(startX - 10, bridgeY - 15);
        ctx.quadraticCurveTo(
            segment.centerX,
            bridgeY - archHeight * 2 - 15,
            endX + 10,
            bridgeY - 15,
        );
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#CD853F";
        ctx.stroke();
        ctx.restore();
    }

    drawDuck(ctx, duck, globalTime) {
        ctx.save();
        if (duck.z > 0) {
            ctx.save();
            ctx.translate(duck.x, duck.y);
            ctx.scale(1, 0.5);
            const shadowRatio = Math.max(0.2, 1 - duck.z / 200);
            const shadowRadius = duck.radius * shadowRatio;
            ctx.beginPath();
            ctx.arc(0, 0, shadowRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0,0,0, ${0.4 * shadowRatio})`;
            ctx.fill();
            ctx.restore();
        }
        ctx.translate(duck.x, duck.y - duck.z);
        const scale = duck.radius / 35;
        const facingRight = duck.vx > 0.1;
        ctx.scale(facingRight ? -scale : scale, scale);
        ctx.translate(-50, -60);
        if (duck.effect === "GHOST") ctx.globalAlpha = 0.5;
        if (duck.effect === "BOUNCY") {
            const pulse = 1 + Math.sin(globalTime * 20) * 0.1;
            ctx.scale(pulse, 1 / pulse);
        }
        // Body
        ctx.beginPath();
        ctx.moveTo(20, 60);
        ctx.quadraticCurveTo(20, 90, 50, 90);
        ctx.lineTo(75, 90);
        ctx.quadraticCurveTo(95, 90, 95, 70);
        ctx.quadraticCurveTo(95, 50, 75, 50);
        ctx.lineTo(70, 50);
        ctx.lineTo(70, 40);
        ctx.quadraticCurveTo(70, 10, 45, 10);
        ctx.quadraticCurveTo(20, 10, 20, 40);
        ctx.lineTo(20, 60);
        ctx.closePath();
        ctx.fillStyle = duck.effect === "ANCHOR" ? "#555" : duck.color;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#333";
        ctx.stroke();
        // Bill
        ctx.beginPath();
        ctx.moveTo(20, 35);
        ctx.quadraticCurveTo(5, 35, 5, 45);
        ctx.quadraticCurveTo(5, 50, 20, 45);
        ctx.closePath();
        ctx.fillStyle = duck.beak;
        ctx.fill();
        ctx.stroke();
        // Wing
        ctx.beginPath();
        ctx.moveTo(40, 65);
        ctx.quadraticCurveTo(50, 85, 70, 65);
        ctx.strokeStyle = duck.beak;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.stroke();
        // Eye
        ctx.beginPath();
        ctx.arc(40, 30, 5, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(42, 30, 2, 0, Math.PI * 2);
        ctx.fillStyle = "black";
        ctx.fill();
        ctx.restore();
        // Name Tag & Icons
        ctx.save();
        ctx.translate(duck.x, duck.y - duck.z);
        ctx.fillStyle = "white";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "black";
        if (duck.effect) {
            let icon = "";
            if (duck.effect === "SPEED") icon = "⚡";
            if (duck.effect === "ANCHOR") icon = "⚓";
            if (duck.effect === "BOUNCY") icon = "🏀";
            if (duck.effect === "GHOST") icon = "👻";
            if (icon) {
                ctx.font = "20px Arial";
                ctx.fillText(icon, 0, -duck.radius - 25);
            }
        }
        ctx.strokeText(duck.name, 0, -duck.radius - 10);
        ctx.fillText(duck.name, 0, -duck.radius - 10);
        ctx.restore();
    }
}
