import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    limit,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    updateDoc,
} from "firebase/firestore";
import { db } from "./firebaseConfig.js";

const COLLECTION_PATH = "races";

export class DatabaseService {
    subscribeToPublicRooms(callback) {
        const racesCollection = collection(db, COLLECTION_PATH);
        return onSnapshot(racesCollection, (snapshot) => {
            const rooms = [];
            for (const doc of snapshot.docs) {
                const data = doc.data();
                if (
                    data.isPublic === true &&
                    (data.status === "lobby" || data.status === "racing")
                ) {
                    rooms.push({ id: doc.id, ...data });
                }
            }
            callback(rooms);
        });
    }

    async createRoom(hostId, hostName, isPublic, duckConfig) {
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        const raceRef = doc(db, COLLECTION_PATH, roomId);
        const initialData = {
            hostId,
            status: "lobby",
            isPublic,
            seed: 0,
            players: {
                [hostId]: {
                    name: hostName,
                    color: duckConfig.body,
                    config: duckConfig,
                },
            },
            createdAt: Date.now(),
        };
        await setDoc(raceRef, initialData);
        return roomId;
    }

    async joinRoom(roomId, userId, userName, duckConfig) {
        const raceRef = doc(db, COLLECTION_PATH, roomId);
        const snap = await getDoc(raceRef);

        if (!snap.exists()) throw new Error("Room not found");
        const data = snap.data();
        if (data.status !== "lobby") throw new Error("Race already started");

        const players = data.players || {};
        if (!players[userId]) {
            players[userId] = {
                name: userName,
                color: duckConfig.body,
                config: duckConfig,
            };
        }
        await updateDoc(raceRef, { players });
        return data.hostId;
    }

    async deleteRoom(roomId) {
        const raceRef = doc(db, COLLECTION_PATH, roomId);
        await deleteDoc(raceRef);
    }

    subscribeToRoom(roomId, callback) {
        const raceRef = doc(db, COLLECTION_PATH, roomId);
        return onSnapshot(raceRef, (docSnap) => {
            if (docSnap.exists()) {
                callback(docSnap.data());
            } else {
                callback(null);
            }
        });
    }

    async updatePlayerConfig(roomId, userId, duckConfig, currentPlayers) {
        const raceRef = doc(db, COLLECTION_PATH, roomId);
        const players = { ...currentPlayers };
        if (players[userId]) {
            players[userId].color = duckConfig.body;
            players[userId].config = duckConfig;
            await updateDoc(raceRef, { players });
        }
    }

    async startRace(roomId, seedVal) {
        const raceRef = doc(db, COLLECTION_PATH, roomId);
        await updateDoc(raceRef, { status: "racing", seed: seedVal });
    }

    async resetLobby(roomId) {
        const raceRef = doc(db, COLLECTION_PATH, roomId);
        await updateDoc(raceRef, { status: "lobby" });
    }

    async sendChatMessage(roomId, userId, userName, text) {
        const chatRef = collection(db, COLLECTION_PATH, roomId, "messages");
        await addDoc(chatRef, {
            userId,
            userName,
            text,
            timestamp: Date.now(),
        });
    }

    subscribeToChat(roomId, callback) {
        const chatRef = collection(db, COLLECTION_PATH, roomId, "messages");
        const q = query(chatRef, orderBy("timestamp", "asc"), limit(50));
        return onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map((doc) => doc.data());
            callback(messages);
        });
    }
}
