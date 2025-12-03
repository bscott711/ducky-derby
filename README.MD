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
    * **Avoid:** Rocks (they bounce you) and Whirlpools (they trap you).
    * **Grab:** Mystery Boxes (?) for random power-ups.
5. **Win:** The first duck to cross the finish line takes the crown!

---

## ✨ New Features (v0.2.0)

### 🌊 Physics & World

* **Canvas Engine:** Rebuilt from scratch using HTML5 Canvas for high-performance rendering.
* **Fluid Dynamics:** Ducks are pushed by river currents, accelerate in rapids, and drift in friction zones near the banks.
* **Procedural Generation:** Every race features a unique, winding river path with randomly placed obstacles and decorations.
* **Elastic Collisions:** Ducks bounce off each other and obstacles with realistic momentum transfer.

### ⚔️ Multiplayer Chaos

* **Power-Up System:** Mystery boxes grant temporary abilities:
  * **⚡ Speed:** Instant velocity boost.
  * **🪐 Giant:** Grow 2.5x size and pull other ducks in with your gravity.
  * **👻 Ghost:** Pass through rocks and other ducks.
  * **🏀 Bouncy:** Super-elastic collisions.
  * **⚓ Anchor:** Heavy drag (the "bad" power-up).
* **NPC Bots:** Empty slots are automatically filled with bots ("Quackers", "Waddles") so the river is always full.
* **Spectator Chat:** Live chat overlay to talk trash during the race.

### 🎨 Visuals & Polish

* **Bridge Drop Start:** Ducks spawn on a 3D-styled arched bridge and drop into the water on "GO!".
* **Dynamic Camera:** Smoothly tracks the race leader.
* **Live Customization:** See your duck update in real-time as you pick colors.

---

## 🛠️ Tech Stack

* **Frontend:** HTML5 Canvas, CSS3, Vanilla JavaScript (ES6 Modules)
* **Backend:** Firebase Firestore (Real-time sync) & Authentication (Anonymous login)
* **Build Tool:** Vite
* **Physics:** Custom verlet-style 2D physics loop (60hz fixed timestep)

---

## 🚀 Future Roadmap

* [ ] **Sound Effects:** Add splashes, quacks, and collision "boings".
* [ ] **Spectator Tools:** "Follow Cam" to click and spectate specific ducks.
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
