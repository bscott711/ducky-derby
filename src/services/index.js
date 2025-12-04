import { AuthService } from "./AuthService.js";
import { DatabaseService } from "./DatabaseService.js";

// Export Singletons
export const authService = new AuthService();
export const dbService = new DatabaseService();
