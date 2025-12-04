import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBM_L6_YUj4jVplAU7LcGiP0cSwuh24D28",
    authDomain: "ducky-derby.firebaseapp.com",
    projectId: "ducky-derby",
    storageBucket: "ducky-derby.firebasestorage.app",
    messagingSenderId: "898033359128",
    appId: "1:898033359128:web:06a908dace58009689266d",
    measurementId: "G-G50XQ0HY6X",
};

// Singleton Init
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

let db;
try {
    // Attempt WebSocket/LongPolling configuration
    db = initializeFirestore(app, { experimentalForceLongPolling: false });
    console.log("🔥 Firebase: Initialized new Firestore instance (WebSockets Enabled)");
} catch (e) {
    // Fallback if already initialized
    db = getFirestore(app);
    console.log("♻️ Firebase: Reusing existing Firestore instance");
}

export { auth, db };
