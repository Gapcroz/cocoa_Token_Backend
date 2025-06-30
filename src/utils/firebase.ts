// src/utils/firebase.ts
import admin from "firebase-admin";
import serviceAccount from "../firebase/cocoatokenflutter-firebase-adminsdk-fbsvc-d5b83ea8d2.json"; // download from Firebase

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

export default admin;
