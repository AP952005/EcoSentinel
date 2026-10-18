// EcoSentinel Firebase Configuration & SDK Initialization
// @ts-ignore
import { initializeApp, getApps, getApp } from "firebase/app";
// @ts-ignore
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC6UvzNs9N3XAp79JntD602xxJ8AJJpVTY",
  authDomain: "ecosentinal-514af.firebaseapp.com",
  projectId: "ecosentinal-514af",
  storageBucket: "ecosentinal-514af.firebasestorage.app",
  messagingSenderId: "33405818543",
  appId: "1:33405818543:web:41bb45387cacc77ee8a65a",
  measurementId: "G-2DZNT1Q4QQ"
};

// Initialize Firebase App singleton
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Export Firebase Authentication & Providers
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
};

export default app;
