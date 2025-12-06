import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    increment,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from "firebase/firestore";
import { ENVIRONMENT } from "../config.js";
import { db } from "./firebaseConfig.js";

// Dynamic Paths based on Environment (dev/main)
const WORLD_DOC = `world/${ENVIRONMENT}`;
const PLAYERS_COLLECTION = `world/${ENVIRONMENT}/players`;
const LEADERBOARD_COLLECTION = `world/${ENVIRONMENT}/leaderboard`;

export class DatabaseService {
    // --- Player Management ---

    async joinWorld(userId, userName, duckConfig) {
        const playerRef = doc(db, PLAYERS_COLLECTION, userId);

        // Register player with timestamp for cleanup
        await setDoc(
            playerRef,
            {
                id: userId,
                name: userName,
                config: duckConfig,
                lastSeen: serverTimestamp(),
            },
            { merge: true },
        );
    }

    async updatePlayerConfig(userId, duckConfig) {
        const playerRef = doc(db, PLAYERS_COLLECTION, userId);
        await updateDoc(playerRef, {
            config: duckConfig,
            lastSeen: serverTimestamp(),
        });
    }

    subscribeToPlayers(callback) {
        const q = query(collection(db, PLAYERS_COLLECTION));
        return onSnapshot(q, (snapshot) => {
            const players = {};
            for (const doc of snapshot.docs) {
                players[doc.id] = doc.data();
            }
            callback(players);
        });
    }

    // --- World State & Host Logic ---

    subscribeToWorld(callback) {
        const worldRef = doc(db, WORLD_DOC);
        return onSnapshot(worldRef, (snap) => {
            if (snap.exists()) {
                callback(snap.data());
            } else {
                // Initialize world if it doesn't exist (Force chat clear on init)
                this.resetWorldState(true);
            }
        });
    }

    /**
     * Resets the game to the Lobby state.
     * @param {boolean} clearChat - If true, generates a new chatId to wipe the chat.
     * If false, preserves the existing chat room.
     */
    async resetWorldState(clearChat = false) {
        const worldRef = doc(db, WORLD_DOC);
        // Default: 15 second intermission
        const nextRace = Date.now() + 15000;

        const updateData = {
            status: "lobby",
            startTime: nextRace,
            seed: Math.floor(Math.random() * 1000000),
        };

        // Only generate a new Chat ID (clearing the chat) if requested
        if (clearChat) {
            updateData.chatId = Date.now().toString();
        }

        // Use merge: true so we don't lose the chatId if we aren't updating it
        await setDoc(worldRef, updateData, { merge: true });

        // Cleanup: Remove players who haven't updated in 1 hour
        this.cleanupOldPlayers();
    }

    // Admin: Force Stop (Treat as a reset/new session -> Clear Chat)
    async adminForceStop() {
        const worldRef = doc(db, WORLD_DOC);
        // Reset to lobby, clear chat, but maybe set a longer timer or just let the loop handle it
        await updateDoc(worldRef, {
            status: "lobby",
            chatId: Date.now().toString(), // Clear chat on force stop
        });
    }

    async leaveWorld(userId) {
        const playerRef = doc(db, PLAYERS_COLLECTION, userId);
        // Fire and forget - best effort delete
        deleteDoc(playerRef).catch((err) => console.error("Exit failed", err));
    }

    async setRaceStatus(status) {
        const worldRef = doc(db, WORLD_DOC);
        await updateDoc(worldRef, { status });
    }

    async cleanupOldPlayers() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const q = query(collection(db, PLAYERS_COLLECTION), where("lastSeen", "<", oneHourAgo));
        const snapshot = await getDocs(q);
        for (const doc of snapshot.docs) {
            deleteDoc(doc.ref);
        }
    }

    // --- Leaderboard ---

    async recordWin(userId, userName) {
        const docRef = doc(db, LEADERBOARD_COLLECTION, userId);
        await setDoc(
            docRef,
            {
                name: userName,
                wins: increment(1),
                lastUpdate: serverTimestamp(),
            },
            { merge: true },
        );
    }

    subscribeToLeaderboard(callback) {
        const q = query(collection(db, LEADERBOARD_COLLECTION), orderBy("wins", "desc"), limit(5));
        return onSnapshot(q, (snapshot) => {
            const data = [];
            for (const doc of snapshot.docs) {
                data.push(doc.data());
            }
            callback(data);
        });
    }

    // --- Chat ---

    async sendChatMessage(chatId, userId, userName, text) {
        if (!chatId) return;
        const chatRef = collection(db, `world/${ENVIRONMENT}/chats/${chatId}/messages`);
        await setDoc(doc(chatRef), {
            userId,
            userName,
            text,
            timestamp: Date.now(),
        });
    }

    subscribeToChat(chatId, callback) {
        if (!chatId) return null;
        const chatRef = collection(db, `world/${ENVIRONMENT}/chats/${chatId}/messages`);
        const q = query(chatRef, orderBy("timestamp", "desc"), limit(50));
        return onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map((doc) => doc.data()).reverse();
            callback(messages);
        });
    }

    async ping(userId) {
        const playerRef = doc(db, PLAYERS_COLLECTION, userId);
        try {
            await updateDoc(playerRef, {
                lastSeen: serverTimestamp(),
            });
        } catch (e) {
            // Ignore errors (e.g., if player was already cleaned up)
        }
    }
}
