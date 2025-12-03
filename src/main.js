import "./styles.css";
import { GameClient } from "./game/GameClient.js";
import { UIManager } from "./ui/UIManager.js";

// Initialize UI
const ui = new UIManager();

// Initialize Game Client (The Controller)
// This will attach listeners and start the Auth flow
const client = new GameClient(ui);

// For debugging console access if needed
window.gameClient = client;
