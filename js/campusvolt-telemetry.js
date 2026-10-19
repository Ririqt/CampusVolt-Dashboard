// CampusVolt Station Telemetry Controller (Information Page)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { portsState } from "./modules/ports-state.js";

// 1. Sync live ports state with Information page overview strip
const updatePortsTelemetry = () => {
  const activeEl = document.getElementById("ports-active-value");
  const totalEl = document.getElementById("ports-total-value");
  if (activeEl) activeEl.textContent = portsState.getActiveCount().toString();
  if (totalEl) totalEl.textContent = portsState.getTotalCount().toString();
};

updatePortsTelemetry();
portsState.addEventListener("port-status-changed", updatePortsTelemetry);
portsState.addEventListener("session-completed", updatePortsTelemetry);

// Firebase Configuration
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

// Solar power live reference
const solarPowerRef = ref(database, 'CampusVolt/station01/solarPower');
const solarPowerEl = document.getElementById("solar-power-value");

if (solarPowerEl) {
  onValue(solarPowerRef, (snapshot) => {
    const data = snapshot.val();
    if (data !== null) {
      solarPowerEl.innerText = data;
      console.log("New solar power value received: " + data);
    } else {
      console.log("No data found at this path.");
    }
  });
}

