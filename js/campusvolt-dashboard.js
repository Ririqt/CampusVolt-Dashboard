// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDTVOxATLW_ScNwUFTf9No6EhMz_m2P2OY",
  authDomain: "campusvolt.firebaseapp.com",
  projectId: "campusvolt",
  storageBucket: "campusvolt.firebasestorage.app",
  messagingSenderId: "398807888",
  appId: "1:398807888:web:e04775c07d2486f60c5255"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// 1. Create a reference pointing to the exact path in your database
const solarPowerRef = ref(database, 'CampusVolt/station01/solarPower');

// 2. Grab the HTML element where the number should display
const solarPowerEl = document.getElementById("solar-power-value");

// 3. Listen for changes in real-time
onValue(solarPowerRef, (snapshot) => {
  const data = snapshot.val(); // Extract the number from the database
  
  // If the data exists, update the HTML text
  if (data !== null) {
    solarPowerEl.innerText = data;
    console.log("New solar power value received: " + data);
  } else {
    console.log("No data found at this path.");
  }
});