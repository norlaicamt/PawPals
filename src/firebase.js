// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// REPLACE THIS WITH YOUR ACTUAL CONFIG FROM FIREBASE CONSOLE
const firebaseConfig = {
    apiKey: "AIzaSyD-Gtj5RlP_9hzXPQK8GaEqR-UABjctUxE",
  authDomain: "pawpals-bfacb.firebaseapp.com",
  projectId: "pawpals-bfacb",
  storageBucket: "pawpals-bfacb.firebasestorage.app",
  messagingSenderId: "767556018538",
  appId: "1:767556018538:web:ea0cad530a20149e2ec513"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the services we need
export const auth = getAuth(app);
export const db = getFirestore(app);