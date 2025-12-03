export const RACE_DISTANCE = 10000;

// Physics Constants
export const PHYSICS = {
    DUCK_RADIUS: 12,
    DUCK_MASS: 1,
    RIVER_WIDTH: 500,
    FLOW_SPEED: 0.2,
    COLLISION_DAMPING: 0.8,
    WALL_DAMPING: 0.6,
    TURBULENCE: 0.2,

    // NEW: Rapids & Rocks
    RAPID_SPEED_BOOST: 0.3, // Extra speed in rapids
    RAPID_TURBULENCE: 0.8, // High chaos in rapids
    ROCK_RADIUS_MIN: 15,
    ROCK_RADIUS_MAX: 30,
};

// NEW: Generation Settings
export const LEVEL_GEN = {
    OBSTACLE_DENSITY: 0.002, // Chance per pixel of river length
    RAPID_FREQUENCY: 0.0005, // Chance of a rapid section starting
    RAPID_LENGTH: 600, // How long a rapid lasts
    TREE_DENSITY: 0.01, // Trees on the bank
    GRASS_DENSITY: 0.05, // Texture dots on the bank
};

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

export const MIN_RACERS = 20;

export const NPC_NAMES = [
    "Quackers",
    "Waddles",
    "Puddles",
    "Feathers",
    "Bill",
    "Drake",
    "Webby",
    "Lucky",
    "Plucky",
    "Howard",
    "Scrooge",
    "Donald",
    "Daisy",
    "Daffy",
    "Psyduck",
    "Launchpad",
    "Gosalyn",
    "Huey",
    "Dewey",
    "Louie",
    "Ziggy",
    "Pippin",
    "Bubbles",
    "Splash",
    "Paddle",
];
