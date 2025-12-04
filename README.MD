# 🦆 Ducky Derby

**Ducky Derby** is a chaotic, real-time multiplayer racing game powered by a custom 2D physics engine. Players join a persistent global world, design their own custom ducks, and race down a procedurally generated river filled with rapids, whirlpools, and jagged rocks.

Built with **HTML5 Canvas**, **JavaScript Modules**, and **Firebase**, it supports massive multiplayer races, elastic collisions, and synchronized physics across all devices.

---

## 🎮 How to Play

1. **Enter the River:** Open the game and enter your name to join the global lobby.
2. **Customize:** Use the color picker to design your duck's Body and Beak colors while waiting for the next round.
3. **The Cycle:** Races run on a continuous loop.
    * **Lobby:** 15-second intermission to chat, customize, and check the leaderboard.
    * **Race:** If you join mid-race, you will enter **Spectator Mode** until the next round begins.
4. **Race:** Watch the physics take over!
    * **Avoid:** Rocks (bounce), Whirlpools (trap), and Hunters (lasers).
    * **Grab:** Mystery Boxes (?) for random power-ups.
5. **Win:** The first duck to cross the finish line takes the crown and climbs the Global Leaderboard!

---

## ✨ New Features (v0.5.0)

### 🌍 Global Persistent World

* **Single Instance Architecture:** Moved away from isolated rooms to a single "Global River." All players join the same world, creating a massive, chaotic racing experience.
* **Distributed Soft-Host:** The serverless architecture now auto-assigns a "Soft Host" (the longest-active player) to manage the race timer and state transitions, ensuring the game runs endlessly even if players leave.
* **Heartbeat System:** Implemented a keep-alive system to track active players and clean up "zombie" data automatically.

### 🏆 Competition & Spectating

* **Global Leaderboards:** Persistent tracking of all-time wins stored in Firestore. The top champions are displayed proudly in the lobby.
* **Smart Spectator Mode:** Late joiners no longer glitch into the race with "super-speed" physics. They are automatically placed in a spectator state to watch the current race finish.
* **Advanced Camera Control:** Added a 3-way toggle:
    1. **Me:** Follow your duck.
    2. **Leader:** Follow the duck in 1st place.
    3. **Last Place:** Watch the struggle bus at the back of the pack.

### 🛠️ Stability & DevOps

* **Environment Switching:** Added distinct development (`dev`) and production (`main`) database paths to ensure testing doesn't corrupt the live leaderboard.
* **Jitter Fix:** Synchronized the camera update loop with the physics timestep to eliminate visual vibration during high-speed movement.
* **Chat Upgrades:** Increased character limits for names and chat messages.

---

## ⚔️ Multiplayer Chaos

* **Power-Up System:** Mystery boxes grant temporary abilities:
  * **⚡ Speed:** Instant velocity boost.
  * **🪐 Giant:** Grow 2.5x size and pull other ducks in with your gravity.
  * **👻 Ghost:** Pass through rocks and other ducks.
  * **🏀 Bouncy:** Super-elastic collisions.
  * **⚓ Anchor:** Heavy drag (the "bad" power-up).
* **NPC Bots:** Empty slots are automatically filled with bots ("Quackers", "Waddles") so the river is always full.
* **Spectator Chat:** Live global chat overlay to talk trash during the race.

---

## 🛠️ Tech Stack

* **Frontend:** HTML5 Canvas, CSS3, Vanilla JavaScript (ES6 Modules)
* **Backend:** Firebase Firestore (Real-time sync) & Authentication (Anonymous login)
* **Build Tool:** Vite
* **Physics:** Custom verlet-style 2D physics loop (60hz fixed timestep)

---

## 🚀 Future Roadmap

* [x] **Spectator Tools:** "Follow Cam" and "Last Place Cam".
* [x] **Refactor:** Complete modularization of Engine, Renderer, and Services.
* [x] **Leaderboards:** Track total wins across sessions.
* [ ] **Sound Effects:** Add splashes, quacks, and collision "boings".
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
