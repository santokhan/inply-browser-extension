// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyArBbQYNpeULW_9MRjWMS4epa5zBITZMCk",
  authDomain: "inply-21d06.firebaseapp.com",
  projectId: "inply-21d06",
  storageBucket: "inply-21d06.firebasestorage.app",
  messagingSenderId: "906525728358",
  appId: "1:906525728358:web:dfee4b5f2cb6bb1e4357a7",
  measurementId: "G-J465VP1JMB"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);