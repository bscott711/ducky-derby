export const RACE_DISTANCE = 10000; // Longer race for the new engine

// Physics Constants
export const PHYSICS = {
    DUCK_RADIUS: 15,
    DUCK_MASS: 1,
    RIVER_WIDTH: 500,
    FLOW_SPEED: 2.5, // Downward speed of water
    COLLISION_DAMPING: 0.8, // Bounciness (1 = perfect elastic, 0 = no bounce)
    WALL_DAMPING: 0.5,
    TURBULENCE: 0.1, // Random forces applied to ducks
};

// Initial color palette (Still used for defaults)
export const DUCK_PALETTES = [
    { name: "Sunny", body: "#FFD700", beak: "#FF8C00" },
    { name: "Teal", body: "#00CED1", beak: "#FFD700" },
    // ... others
];
