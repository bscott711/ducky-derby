import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
    collection,
    deleteDoc, // <--- Imported deleteDoc
    doc,
    getDoc,
    getFirestore,
    initializeFirestore,
    onSnapshot,
    setDoc,
    updateDoc,
} from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBM_L6_YUj4jVplAU7LcGiP0cSwuh24D28",
    authDomain: "ducky-derby.firebaseapp.com",
    projectId: "ducky-derby",
    storageBucket: "ducky-derby.firebasestorage.app",
    messagingSenderId: "898033359128",
    appId: "1:898033359128:web:06a908dace58009689266d",
    measurementId: "G-G50XQ0HY6X",
};

// 1. Singleton: Get existing app or initialize a new one
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// 2. Connection Logic (With Logging)
let db;
try {
    // EXPLICITLY set false to override any defaults or cached behaviors
    db = initializeFirestore(app, {
        experimentalForceLongPolling: false,
    });
    console.log("🔥 Firebase: Initialized new Firestore instance (WebSockets Enabled)");
} catch (e) {
    // If this fails, it means an instance already exists (hot-reload)
    db = getFirestore(app);
    console.log("♻️ Firebase: Reusing existing Firestore instance");
}

const COLLECTION_PATH = "races";

export const authService = {
    async signIn() {
        try {
            return await signInAnonymously(auth);
        } catch (error) {
            console.error("Authentication failed:", error);
            throw error;
        }
    },
    getCurrentUser() {
        return auth.currentUser;
    },
    onAuthStateChanged(callback) {
        return auth.onAuthStateChanged(callback);
    },
};

export const dbService = {
    subscribeToPublicRooms(callback) {
        const racesCollection = collection(db, COLLECTION_PATH);
        return onSnapshot(
            racesCollection,
            (snapshot) => {
                const rooms = [];
                for (const doc of snapshot.docs) {
                    const data = doc.data();
                    if (data.status === "lobby" && data.isPublic === true) {
                        rooms.push({ id: doc.id, ...data });
                    }
                }
                callback(rooms);
            },
            (error) => {
                console.error("Error subscribing to public rooms:", error);
            },
        );
    },

    async createRoom(hostId, hostName, isPublic) {
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        const raceRef = doc(db, COLLECTION_PATH, roomId);
        const initialData = {
            hostId,
            status: "lobby",
            isPublic,
            seed: 0,
            players: {
                [hostId]: { name: hostName, duckIndex: -1 },
            },
            createdAt: Date.now(),
        };
        await setDoc(raceRef, initialData);
        return roomId;
    },

    async joinRoom(roomId, userId, userName) {
        const raceRef = doc(db, COLLECTION_PATH, roomId);
        const snap = await getDoc(raceRef);

        if (!snap.exists()) throw new Error("Room not found");
        const data = snap.data();
        if (data.status !== "lobby") throw new Error("Race already started");

        const players = data.players || {};
        // Don't overwrite existing player data if just reconnecting
        if (!players[userId]) {
            players[userId] = { name: userName, duckIndex: -1 };
        }

        await updateDoc(raceRef, { players });
        // RETURN hostId so we can check if we own the room
        return data.hostId;
    },

    // NEW: Delete Room Function
    async deleteRoom(roomId) {
        const raceRef = doc(db, COLLECTION_PATH, roomId);
        await deleteDoc(raceRef);
    },

    subscribeToRoom(roomId, callback) {
        const raceRef = doc(db, COLLECTION_PATH, roomId);
        return onSnapshot(
            raceRef,
            (docSnap) => {
                if (docSnap.exists()) {
                    callback(docSnap.data());
                } else {
                    // Notify that the room is gone (deleted)
                    callback(null);
                }
            },
            (error) => {
                console.error("Error subscribing to room:", error);
            },
        );
    },

    async updateDuckSelection(roomId, userId, duckIndex, currentPlayers) {
        const raceRef = doc(db, COLLECTION_PATH, roomId);
        const players = { ...currentPlayers };
        if (players[userId]) {
            players[userId].duckIndex = duckIndex;
            await updateDoc(raceRef, { players });
        }
    },

    async startRace(roomId, seedVal) {
        const raceRef = doc(db, COLLECTION_PATH, roomId);
        await updateDoc(raceRef, { status: "racing", seed: seedVal });
    },

    async resetLobby(roomId) {
        const raceRef = doc(db, COLLECTION_PATH, roomId);
        await updateDoc(raceRef, { status: "lobby" });
    },
};
