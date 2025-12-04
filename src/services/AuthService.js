import { signInAnonymously } from "firebase/auth";
import { auth } from "./firebaseConfig.js";

export class AuthService {
    async signIn() {
        try {
            return await signInAnonymously(auth);
        } catch (error) {
            console.error("Authentication failed:", error);
            throw error;
        }
    }

    getCurrentUser() {
        return auth.currentUser;
    }

    onAuthStateChanged(callback) {
        return auth.onAuthStateChanged(callback);
    }
}
