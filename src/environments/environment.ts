// CONFIGURE SUAS CREDENCIAIS DO FIREBASE AQUI
// Obtenha em: https://console.firebase.google.com -> Configurações do projeto -> Apps

export const environment = {
  production: false,
  firebase: {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJECT_ID.firebaseapp.com",
    projectId: "SEU_PROJECT_ID",
    storageBucket: "SEU_PROJECT_ID.appspot.com",
    messagingSenderId: "SEU_MESSAGING_SENDER_ID",
    appId: "SEU_APP_ID"
  }
};
