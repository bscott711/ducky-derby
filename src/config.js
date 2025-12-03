export const RACE_DISTANCE = 10000;
export const NET_OFFSET = 200;

// Physics Constants
export const PHYSICS = {
    DUCK_RADIUS: 12,
    DUCK_MASS: 1,
    RIVER_WIDTH: 500,
    FLOW_SPEED: 0.2,
    COLLISION_DAMPING: 0.8,
    WALL_DAMPING: 0.6,
    TURBULENCE: 0.2,
    GRAVITY: 0.8,

    // NEW: Fixed Logical Width (The "Universe" size)
    GAME_WIDTH: 800,

    // Rapids
    RAPID_SPEED_BOOST: 0.3,
    RAPID_TURBULENCE: 0.8,

    // Rocks
    ROCK_RADIUS_MIN: 15,
    ROCK_RADIUS_MAX: 35,
    ROCK_JAGGEDNESS: 0.4,

    // Whirlpools
    WHIRLPOOL_RADIUS: 50,
    WHIRLPOOL_PULL: 0.1,
    WHIRLPOOL_SPIN: 0.3,
    WHIRLPOOL_HOLD_TIME: 150,

    // Bank Physics
    BANK_FRICTION_ZONE: 60,
    BANK_FLOW_MODIFIER: 0.4,
};

// Power-Up Configuration
export const POWERUPS = {
    SPAWN_RATE: 0.001,
    BOX_SIZE: 20,
    DURATION: 300,

    // Effect Tuning
    GIANT_SCALE: 2.5,
    GIANT_GRAVITY: 0.8,
    GIANT_RANGE: 300,
    BOUNCY_FACTOR: 1.6,
    SPEED_FORCE: 8.0,
    ANCHOR_DRAG: 0.9,

    TYPES: ["GIANT", "GHOST", "BOUNCY", "SPEED", "ANCHOR"],
};

// Generation Settings
export const LEVEL_GEN = {
    OBSTACLE_DENSITY: 0.002,
    RAPID_FREQUENCY: 0.0005,
    RAPID_LENGTH: 600,
    WHIRLPOOL_FREQUENCY: 0.0003,
    TREE_DENSITY: 0.01,
    GRASS_DENSITY: 0.05,
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
