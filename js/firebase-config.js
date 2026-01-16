import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBZ3cUgxGV-xv1lq62VrAb-zxIIN4dSJV0",
  authDomain: "brenocell.firebaseapp.com",
  projectId: "brenocell",
  storageBucket: "brenocell.firebasestorage.app",
  messagingSenderId: "1096820014533",
  appId: "1:1096820014533:web:c06fcbb694e7efb98c5fac"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };