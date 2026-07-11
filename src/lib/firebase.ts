// Firebase app initialization
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyBMGuCh2GEn4qHLFmEaehF0jUK8IlqVem8",
  authDomain: "leadqonnect.firebaseapp.com",
  projectId: "leadqonnect",
  storageBucket: "leadqonnect.firebasestorage.app",
  messagingSenderId: "919478859207",
  appId: "1:919478859207:web:5e3de5b7402cf4c02d15e2",
  measurementId: "G-G9ZSPSTKWM"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
// Region must match where the functions are deployed (default: us-central1).
export const functions = getFunctions(app);

export default app;
