// Firebase web configuration is public client configuration, not an Admin SDK secret.
// Firestore Security Rules + Firebase Authentication protect private user data.
window.MILKFLOW_CONFIG = {
  enableCloudSync: true,

  // Optional server-side AI coach endpoint. The OpenAI/API secret lives only in Firebase
  // Secret Manager; this public HTTPS URL is safe to expose in the browser.
  aiCoachEndpoint: "https://pumpcoachai-unb4gv4wpq-uc.a.run.app",

  // Private in-app Mom + Baby assistant. The browser tries the Firebase alias first and
  // the deployed Cloud Run route second if the alias is unreachable or server-failing.
  familyChatEndpoint: "https://us-central1-milkflow-pumping-dashboard.cloudfunctions.net/familyChat",
  familyChatEndpoints: [
    "https://us-central1-milkflow-pumping-dashboard.cloudfunctions.net/familyChat",
    "https://familychat-unb4gv4wpq-uc.a.run.app"
  ],

  firebaseConfig: {
    apiKey: "AIzaSyAUfC16n_ZSSZtmJZoz2UVfQVbLePu1BvA",
    authDomain: "milkflow-pumping-dashboard.firebaseapp.com",
    projectId: "milkflow-pumping-dashboard",
    storageBucket: "milkflow-pumping-dashboard.firebasestorage.app",
    messagingSenderId: "479317112379",
    appId: "1:479317112379:web:e60993ab8490435d6d0e1e",
    measurementId: "G-N1E7896CKW"
  }
};
