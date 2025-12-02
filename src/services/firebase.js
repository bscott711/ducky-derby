import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
    collection,
    doc,
    getDoc,
    initializeFirestore,
    onSnapshot,
    setDoc,
    updateDoc,
} from "firebase/firestore";

// Replace with your actual config
const firebaseConfig = {
    apiKey: "AIzaSyBM_L6_YUj4jVplAU7LcGiP0cSwuh24D28",
    authDomain: "ducky-derby.firebaseapp.com",
    projectId: "ducky-derby",
    storageBucket: "ducky-derby.firebasestorage.app",
    messagingSenderId: "898033359128",
    appId: "1:898033359128:web:06a908dace58009689266d",
    measurementId: "G-G50XQ0HY6X",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// FIX: Force WebSockets.
// Since your domain is authorized, the "Access Control" error on 'xmlhttp' requests
// means the browser is failing Long Polling. Forcing WebSockets bypasses this check.
const db = initializeFirestore(app, {
    experimentalForceLongPolling: false,
});

// Use a fixed collection path for this app
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
                // FIX: Use for...of on snapshot.docs
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
        players[userId] = { name: userName, duckIndex: -1 };

        await updateDoc(raceRef, { players });
        return true;
    },

    subscribeToRoom(roomId, callback) {
        const raceRef = doc(db, COLLECTION_PATH, roomId);
        return onSnapshot(
            raceRef,
            (docSnap) => {
                if (docSnap.exists()) callback(docSnap.data());
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
