import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

// See: https://firebase.google.com/docs/web/learn-more#config-object
const firebaseConfig = {
  apiKey: "AIzaSyAp-VZhBJfhiqCEJ72iZSjPnYY__zh69p8",
  authDomain: "santiyeapp-75925.firebaseapp.com",
  projectId: "santiyeapp-75925",
  storageBucket: "santiyeapp-75925.firebasestorage.app",
  messagingSenderId: "311791461455",
  appId: "1:311791461455:web:4c6b7561ab6cf6d2a2b63a",
  measurementId: "G-Y6V2GML271",
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
// Callable Functions, Avrupa bölgesinde tutuluyor; aksi halde istemci varsayılan
// bölgeye istek göndererek abonelik doğrulamasını bulamaz.
export const functions = getFunctions(app, "europe-west1");
export const storage = getStorage(app);
export default app;
