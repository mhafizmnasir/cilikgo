// Firebase Web App configuration untuk projek CilikGo.
// Nilai ini ialah konfigurasi client-side Firebase Web dan boleh berada dalam frontend.
export const firebaseConfig = {
  apiKey: "AIzaSyDbNrWdINvduQjH6fFfj2dC5t34NKQY7_E",
  authDomain: "cilikgo-web.firebaseapp.com",
  projectId: "cilikgo-web",
  storageBucket: "cilikgo-web.firebasestorage.app",
  messagingSenderId: "276181979080",
  appId: "1:276181979080:web:26e2cc59ff9215ff7bfafd"
};

export const USE_FIREBASE = true;


// Backend pengurusan langganan manual CilikGo. GitHub Pages memanggil Firebase Functions melalui URL penuh.
export const FUNCTIONS_REGION = "asia-southeast1";
export const FUNCTIONS_BASE_URL =
  `https://${FUNCTIONS_REGION}-${firebaseConfig.projectId}.cloudfunctions.net`;
