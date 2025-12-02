import { defineConfig } from "vite";

export default defineConfig({
    base: "/ducky-derby/",
    build: {
        outDir: "dist",
        assetsDir: "assets",
    },
});
