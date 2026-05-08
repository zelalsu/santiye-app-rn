import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
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
export default app;
