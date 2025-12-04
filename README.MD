# 🦆 Ducky Derby

**Ducky Derby** is a chaotic, real-time multiplayer racing game powered by a custom 2D physics engine. Players create lobbies, design their own custom ducks, and race down a procedurally generated river filled with rapids, whirlpools, and jagged rocks.

Built with **HTML5 Canvas**, **JavaScript Modules**, and **Firebase**, it supports infinite concurrent ducks, elastic collisions, and synchronized physics across all devices.

---

## 🎮 How to Play

1. **Join the Lobby:** Open the game and enter your name.
    * **Host:** Create a new public or private room.
    * **Join:** Browse the public list or enter a room code.
2. **Customize:** Use the color picker to design your duck's Body and Beak colors.
3. **Wait for Drop:** Once the host starts the race, a countdown begins on the bridge.
4. **Race:** Watch the physics take over!
    * **Avoid:** Rocks (bounce), Whirlpools (trap), and Hunters (lasers).
    * **Grab:** Mystery Boxes (?) for random power-ups.
5. **Win:** The first duck to cross the finish line (and hit the net) takes the crown!

---

## ✨ New Features (v0.4.0)

### 🏗️ Architectural Overhaul

* **System-Based Engine:** The core `RaceEngine` has been decoupled into specialized systems (`PhysicsSystem`, `HunterSystem`, `PowerupSystem`) for robust simulation logic.
* **Modular Rendering:** The monolithic renderer has been split into dedicated painters (`DuckRenderer`, `EntityRenderer`, `EnvironmentRenderer`) for cleaner draw calls and z-indexing.
* **Procedural Pipelines:** Level generation is now handled by a suite of micro-generators (`RiverGenerator`, `FeatureGenerator`, `ObstacleGenerator`), paving the way for future biome expansions.

### 🔌 Service Layer Extraction

* **Decoupled Backend:** Firebase logic has been moved out of the UI and Game loop into a dedicated Service Layer (`AuthService`, `DatabaseService`), ensuring better separation of concerns and easier testing.
* **Input Controller:** Input handling is now normalized in a dedicated controller, separating player intent from UI event listeners.

### 💧 Physics & Polish

* **Net Drifting:** Ducks no longer "freeze" at the finish line; they now physically drift into the catch net and pile up realistically.
* **Orientation Hysteresis:** Ducks maintain their facing direction during slow movements and spawn with random orientations for a more natural look.
* **Timestep Fixes:** Corrected frame-rate dependency issues to ensure penalty timers (like being hunted) are consistent across all devices.

---

## ⚔️ Multiplayer Chaos

* **Power-Up System:** Mystery boxes grant temporary abilities:
  * **⚡ Speed:** Instant velocity boost.
  * **🪐 Giant:** Grow 2.5x size and pull other ducks in with your gravity.
  * **👻 Ghost:** Pass through rocks and other ducks.
  * **🏀 Bouncy:** Super-elastic collisions.
  * **⚓ Anchor:** Heavy drag (the "bad" power-up).
* **NPC Bots:** Empty slots are automatically filled with bots ("Quackers", "Waddles") so the river is always full.
* **Spectator Chat:** Live chat overlay to talk trash during the race.

---

## 🛠️ Tech Stack

* **Frontend:** HTML5 Canvas, CSS3, Vanilla JavaScript (ES6 Modules)
* **Backend:** Firebase Firestore (Real-time sync) & Authentication (Anonymous login)
* **Build Tool:** Vite
* **Physics:** Custom verlet-style 2D physics loop (60hz fixed timestep)

---

## 🚀 Future Roadmap

* [x] **Spectator Tools:** "Follow Cam" to click and spectate specific ducks.
* [x] **Refactor:** Complete modularization of Engine, Renderer, and Services.
* [ ] **Sound Effects:** Add splashes, quacks, and collision "boings".
* [ ] **Leaderboards:** Track total wins across session.
* [ ] **Seasons:** Different biomes (Snow, Lava, Space).

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes.
4. Push to the branch.
5. Open a Pull Request.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
