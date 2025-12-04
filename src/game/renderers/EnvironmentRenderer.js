import { NET_OFFSET, PHYSICS } from "../../config.js";

export class EnvironmentRenderer {
    drawGround(ctx, width, height) {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#228B22";
        ctx.fillRect(0, 0, width, height);
    }

    drawRiver(ctx, riverPath, renderStart, renderEnd) {
        ctx.beginPath();
        ctx.fillStyle = "#1E90FF";

        const startIndex = Math.max(0, Math.floor((renderStart + 500) / 5));
        const endIndex = Math.min(riverPath.length - 1, Math.floor((renderEnd + 500) / 5));

        // Left Bank
        for (let i = startIndex; i <= endIndex; i++) {
            const p = riverPath[i];
            ctx.lineTo(p.centerX - p.width / 2, p.y);
        }
        // Right Bank
        for (let i = endIndex; i >= startIndex; i--) {
            const p = riverPath[i];
            ctx.lineTo(p.centerX + p.width / 2, p.y);
        }
        ctx.fill();
    }

    drawDecorations(ctx, decorations, renderStart, renderEnd, layer) {
        for (const deco of decorations) {
            if (deco.y < renderStart || deco.y > renderEnd) continue;

            // Filter by Layer type
            if (layer === "bottom" && deco.type === "grass") {
                ctx.beginPath();
                ctx.arc(deco.x, deco.y, deco.radius, 0, Math.PI * 2);
                ctx.fillStyle = deco.color1;
                ctx.fill();
            } else if (layer === "top") {
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

        // Shadow
        ctx.beginPath();
        ctx.moveTo(startX, bridgeY + 20);
        ctx.quadraticCurveTo(segment.centerX, bridgeY - 40, endX, bridgeY + 20);
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 15;
        ctx.stroke();

        // Main Arch
        ctx.beginPath();
        ctx.moveTo(startX - 10, bridgeY);
        ctx.quadraticCurveTo(segment.centerX, bridgeY - archHeight * 2, endX + 10, bridgeY);
        ctx.lineWidth = 40;
        ctx.strokeStyle = "#8B4513";
        ctx.lineCap = "butt";
        ctx.stroke();

        // Detail
        ctx.strokeStyle = "#A0522D";
        ctx.lineWidth = 3;
        ctx.globalCompositeOperation = "source-atop";
        ctx.lineWidth = 34;
        ctx.strokeStyle = "#8B4513";
        ctx.stroke();

        // Railing
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

    drawFinishLine(ctx, riverPath, finishLineY) {
        const finishSegIdx = Math.floor((finishLineY + 500) / 5);
        const finishSeg = riverPath[finishSegIdx];
        if (finishSeg) {
            const left = finishSeg.centerX - finishSeg.width / 2;
            const right = finishSeg.centerX + finishSeg.width / 2;
            ctx.save();
            ctx.translate(left, finishLineY);

            const checkSize = 20;
            const checks = Math.ceil((right - left) / checkSize);
            for (let i = 0; i < checks; i++) {
                ctx.fillStyle = i % 2 === 0 ? "#FFFFFF" : "#000000";
                ctx.fillRect(i * checkSize, 0, checkSize, 20);
            }

            // Posts
            ctx.fillStyle = "#8B4513";
            ctx.fillRect(-10, -30, 10, 50);
            ctx.fillRect(right - left, -30, 10, 50);
            ctx.restore();
        }
    }

    drawNet(ctx, riverPath, finishLineY) {
        const netY = finishLineY + NET_OFFSET;
        const netSegIdx = Math.floor((netY + 500) / 5);
        const netSeg = riverPath[netSegIdx];
        if (netSeg) {
            const left = netSeg.centerX - netSeg.width / 2;
            const right = netSeg.centerX + netSeg.width / 2;
            ctx.save();
            ctx.translate(left, netY);

            // Posts
            ctx.fillStyle = "#555";
            ctx.fillRect(-10, -40, 10, 60);
            ctx.fillRect(right - left, -40, 10, 60);

            // Net Mesh
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

            // Top Rope
            ctx.beginPath();
            ctx.moveTo(0, -20);
            ctx.lineTo(right - left, -20);
            ctx.lineWidth = 4;
            ctx.strokeStyle = "#8B0000";
            ctx.stroke();

            ctx.restore();
        }
    }
}
