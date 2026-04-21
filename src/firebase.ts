import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDP1wLjEW_PWcpVvQOqtKVh4zpBzzTzjVI",
  authDomain: "freshstock-392e4.firebaseapp.com",
  projectId: "freshstock-392e4",
  storageBucket: "freshstock-392e4.firebasestorage.app",
  messagingSenderId: "938331419766",
  appId: "1:938331419766:web:ac15267524509e3f5cdb57"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
