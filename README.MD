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

## ✨ New Features (v0.3.0)

### 🎥 Spectator Tools & Camera

* **Follow Cam:** Toggle between "Leader" (Spectator Mode) and "Me" (Track your own duck) with the new floating camera button.
* **Smart Framing:** The camera adjusts vertically based on rank—leaders see the trail of opponents behind them, while those in the back see the pack ahead.
* **Mobile Optimization:** Full responsive scaling and smooth horizontal tracking ensure the action stays centered on any device.

### 🔫 The Hunt (PvE)

* **Hunters:** Aggressive red dots appear on the riverbanks to snipe passing ducks.
* **Laser Penalty:** Getting shot triggers the "Hunted" state (💀). Your duck flips upside down and suffers heavy drag for 2 seconds.

### 🏁 Epic Finishes

* **Catch Net:** A physical net past the finish line catches all racers, creating a satisfying end-of-race pile-up.
* **Bobbing Physics:** Ducks gently bob in the current while stuck against the net.
* **End-Game Cam:** The camera smoothly decelerates at the finish line to frame the final results.

### 🔧 Engine Overhaul

* **Refactored Core:** Split the monolith `RaceEngine` into dedicated `LevelGenerator`, `Renderer`, and `Physics` modules for better maintainability.
* **Improved Rendering:** Fixed Z-indexing so ducks properly float *under* bridges and nets.

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
