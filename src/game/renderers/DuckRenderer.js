export class DuckRenderer {
    draw(ctx, duck, globalTime, finishLineY) {
        ctx.save();

        // 1. Shadow (only if airborne)
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

        // 2. Bobbing Calculation
        let bobY = 0;
        if (duck.y > finishLineY) {
            const phase = duck.name.length;
            bobY = Math.sin(globalTime * 5 + phase) * 3;
        }

        // 3. Transform to Duck Space
        ctx.translate(duck.x, duck.y - duck.z + bobY);
        const scale = duck.radius / 35;

        // Use the facing direction from physics state
        const facingRight = duck.facingRight;

        ctx.scale(facingRight ? -scale : scale, scale);
        ctx.translate(-50, -60);

        // 4. Effects Styles
        if (duck.effect === "GHOST" || duck.effect === "HUNTED") {
            ctx.globalAlpha = 0.5;
        }
        if (duck.effect === "HUNTED") {
            ctx.scale(1, -1);
        }
        if (duck.effect === "BOUNCY") {
            const pulse = 1 + Math.sin(globalTime * 20) * 0.1;
            ctx.scale(pulse, 1 / pulse);
        }

        // 5. Draw Body Parts
        this.drawBody(ctx, duck);
        this.drawBill(ctx, duck);
        this.drawWing(ctx, duck);
        this.drawEye(ctx);

        ctx.restore();

        // 6. Draw UI Overlay (Name & Icons)
        this.drawUI(ctx, duck, bobY);
    }

    drawBody(ctx, duck) {
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
    }

    drawBill(ctx, duck) {
        ctx.beginPath();
        ctx.moveTo(20, 35);
        ctx.quadraticCurveTo(5, 35, 5, 45);
        ctx.quadraticCurveTo(5, 50, 20, 45);
        ctx.closePath();
        ctx.fillStyle = duck.beak;
        ctx.fill();
        ctx.stroke();
    }

    drawWing(ctx, duck) {
        ctx.beginPath();
        ctx.moveTo(40, 65);
        ctx.quadraticCurveTo(50, 85, 70, 65);
        ctx.strokeStyle = duck.beak;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.stroke();
    }

    drawEye(ctx) {
        ctx.beginPath();
        ctx.arc(40, 30, 5, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(42, 30, 2, 0, Math.PI * 2);
        ctx.fillStyle = "black";
        ctx.fill();
    }

    drawUI(ctx, duck, bobY) {
        ctx.save();
        ctx.translate(duck.x, duck.y - duck.z + bobY);
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
            if (duck.effect === "HUNTED") icon = "💀";
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
