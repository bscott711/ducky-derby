import "./styles.css";
import { GameClient } from "./game/GameClient.js";
import { UIManager } from "./ui/UIManager.js";

// Initialize UI
const ui = new UIManager();

// Initialize Game Client
const client = new GameClient(ui);

// Debug access
window.gameClient = client;
