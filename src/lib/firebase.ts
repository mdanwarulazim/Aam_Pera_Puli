import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "aamperapuli1",
  appId: "1:818077143340:web:9ed2935c2aa2b29b7c5c89",
  storageBucket: "aamperapuli1.firebasestorage.app",
  apiKey: "AIzaSyB_1mkcBATJ4L9NVAiG3EOpW-OvzMh_pOc",
  authDomain: "aamperapuli1.firebaseapp.com",
  messagingSenderId: "818077143340",
  measurementId: "G-V0JXY31HEP",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
