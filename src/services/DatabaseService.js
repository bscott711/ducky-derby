import {
    collection,
    deleteDoc,
    doc,
    getDocs,
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

const WORLD_DOC = `world/${ENVIRONMENT}`;
const PLAYERS_COLLECTION = `world/${ENVIRONMENT}/players`;

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
                // Initialize world if it doesn't exist
                this.resetWorldState();
            }
        });
    }

    async resetWorldState() {
        const worldRef = doc(db, WORLD_DOC);
        // Default: 15 second intermission
        const nextRace = Date.now() + 15000;

        await setDoc(worldRef, {
            status: "lobby",
            startTime: nextRace,
            seed: Math.floor(Math.random() * 1000000),
        });

        // Cleanup: Remove players who haven't updated in 1 hour
        // (Real app would use a tighter heartbeat, but this keeps the DB clean enough)
        this.cleanupOldPlayers();
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

    // --- Chat ---
    async sendChatMessage(userId, userName, text) {
        const chatRef = collection(db, "world/main/messages");
        await setDoc(doc(chatRef), {
            userId,
            userName,
            text,
            timestamp: Date.now(),
        });
    }

    subscribeToChat(callback) {
        const chatRef = collection(db, "world/main/messages");
        const q = query(chatRef, orderBy("timestamp", "desc"), limit(50));
        return onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map((doc) => doc.data()).reverse();
            callback(messages);
        });
    }
}
