// Firebase web configuration is public client configuration, not an Admin SDK secret.
// Firestore Security Rules + Firebase Authentication protect private user data.
window.MILKFLOW_CONFIG = {
  enableCloudSync: true,

  // Optional server-side AI coach endpoint. Leave blank until a trusted backend exists.
  // Never place an OpenAI/API secret in this browser file or anywhere else in the public repo.
  // Recommended endpoint: HTTPS Firebase Function / Cloud Run route that verifies the
  // Firebase ID token, calls the AI provider server-side, and returns { message: "..." }.
  aiCoachEndpoint: "",

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
