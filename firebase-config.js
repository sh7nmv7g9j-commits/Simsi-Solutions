// Firebase web config for Productive.
//
// This is NOT a secret — the web apiKey is safe to commit. Access to your data
// is enforced by Firestore security rules (see firestore.rules) and the list of
// Authorized Domains in the Firebase console, not by hiding these values.
//
// From: Firebase console → Project settings → Your apps → Web app.
// (This is a plain <script>, not a module, so we expose the config on window
//  rather than using the bundler-style `import ... from "firebase/app"` snippet.)
window.__FIREBASE_CONFIG__ = {
  apiKey: "AIzaSyDvZUICrd2IHawNReo6PusphHPhRqzQqeM",
  authDomain: "simsi-solution.firebaseapp.com",
  projectId: "simsi-solution",
  storageBucket: "simsi-solution.firebasestorage.app",
  messagingSenderId: "2044828880",
  appId: "1:2044828880:web:5d9c21f067e52ef3fa92d5",
  measurementId: "G-4Q27H9D1RP"
};
