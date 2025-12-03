export const RACE_DISTANCE = 10000; // Longer race for the new engine

// Physics Constants (Tuned for time-scaled Canvas)
export const PHYSICS = {
    DUCK_RADIUS: 12,
    DUCK_MASS: 1,
    RIVER_WIDTH: 500,
    FLOW_SPEED: 0.2, // Acceleration per frame (Results in ~300px/sec terminal velocity)
    COLLISION_DAMPING: 0.8,
    WALL_DAMPING: 0.6,
    TURBULENCE: 0.2, // Random side-to-side force
};

// Initial color palette (Still used for defaults)
export const DUCK_PALETTES = [
    { name: "Sunny", body: "#FFD700", beak: "#FF8C00" },
    { name: "Teal", body: "#00CED1", beak: "#FFD700" },
    { name: "Pink", body: "#FF69B4", beak: "#FFC0CB" },
    { name: "Purple", body: "#9370DB", beak: "#4B0082" },
    { name: "Crimson", body: "#DC143C", beak: "#FFD700" },
    { name: "Lime", body: "#32CD32", beak: "#FFFF00" },
    { name: "Slate", body: "#708090", beak: "#D3D3D3" },
    { name: "Navy", body: "#000080", beak: "#87CEEB" },
    { name: "Orange", body: "#FF4500", beak: "#FFD700" },
    { name: "White", body: "#FFFFFF", beak: "#FFA500" },
];
