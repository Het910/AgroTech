const defaultFarmState = {
  moisture: 68,
  wateringOn: false,
  cropHealth: {
    maize: 92,
    rice: 81,
    tomatoes: 76,
  },
  production: {
    weekly: 930,
    monthly: 2860,
    estimated: 5100,
    total: 4782,
  },
  weather: {
    temp: 28,
    condition: "Partly Cloudy",
    icon: "☀️",
    forecast: [
      { day: "Mon", temp: 27, icon: "⛅" },
      { day: "Tue", temp: 29, icon: "☀️" },
      { day: "Wed", temp: 30, icon: "🌤️" },
      { day: "Thu", temp: 26, icon: "🌦️" },
    ],
  },
};

const state = loadState();

const cropHealthList = document.getElementById("cropHealthList");
const improvementList = document.getElementById("improvementList");
const weatherForecast = document.getElementById("weatherForecast");
const connectionStatusText = document.getElementById("connectionStatusText");
const connectionStatusDot = document.getElementById("connectionStatusDot");
const toggleWaterBtn = document.getElementById("toggleWaterBtn");
const refreshDataBtn = document.getElementById("refreshDataBtn");

function loadState() {
  const saved = localStorage.getItem("agrotech-state");
  return saved ? JSON.parse(saved) : defaultFarmState;
}

function saveState() {
  localStorage.setItem("agrotech-state", JSON.stringify(state));
}

function formatKg(value) {
  return `${value.toLocaleString()} kg`;
}

function getHealthClass(score) {
  if (score >= 85) return "good";
  if (score >= 70) return "warn";
  return "bad";
}

function renderCropHealth() {
  const entries = Object.entries(state.cropHealth);
  cropHealthList.innerHTML = entries
    .map(([name, score]) => {
      const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
      return `
        <div class="crop-item">
          <div class="crop-top">
            <strong>${capitalized}</strong>
            <span class="crop-score ${getHealthClass(score)}">${score}%</span>
          </div>
          <div class="progress-bar">
            <span style="width:${score}%"></span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderImprovements() {
  const issues = [
    {
      text: "Rice plots need a 12% increase in watering during the late afternoon to preserve moisture balance.",
    },
    {
      text: "Tomato beds need compost enrichment and a calcium boost to reduce fruit cracking risk.",
    },
    {
      text: "Monitor wind exposure near the western fence to prevent leaf damage in maize rows.",
    },
  ];

  improvementList.innerHTML = issues
    .map(
      (issue, index) => `
        <li>
          <span class="badge">${index + 1}</span>
          <div>${issue.text}</div>
        </li>
      `
    )
    .join("");
}

function renderWeather() {
  const weather = state.weather;
  document.getElementById("weatherTemp").textContent = `${weather.temp}°C`;
  document.getElementById("weatherCondition").textContent = weather.condition;
  document.getElementById("weatherIcon").textContent = weather.icon;

  weatherForecast.innerHTML = weather.forecast
    .map(
      (day) => `
        <div class="weather-item">
          <span class="day">${day.day}</span>
          <span>${day.icon}</span>
          <strong>${day.temp}°C</strong>
        </div>
      `
    )
    .join("");
}

function renderSummary() {
  const healthAverage = Math.round(
    Object.values(state.cropHealth).reduce((sum, value) => sum + value, 0) /
      Object.values(state.cropHealth).length
  );

  document.getElementById("cropHealthScore").textContent = `${healthAverage}%`;
  document.getElementById("waterLevel").textContent = `${state.moisture}%`;
  document.getElementById("productionTotal").textContent = formatKg(state.production.total);
  document.getElementById("weeklyProduction").textContent = formatKg(state.production.weekly);
  document.getElementById("monthlyProduction").textContent = formatKg(state.production.monthly);
  document.getElementById("estimatedYield").textContent = formatKg(state.production.estimated);

  const waterProgress = document.getElementById("waterProgress");
  const moistureValue = document.getElementById("moistureValue");
  waterProgress.style.width = `${state.moisture}%`;
  moistureValue.textContent = `${state.moisture}%`;

  const alertsCount = document.getElementById("alertsCount");
  alertsCount.textContent = state.moisture < 50 ? "2" : "3";

  toggleWaterBtn.textContent = state.wateringOn ? "Stop irrigation" : "Start irrigation";
  toggleWaterBtn.style.background = state.wateringOn ? "#dc2626" : "#1f7a4c";
}

function updateConnectionStatus() {
  const online = navigator.onLine;
  connectionStatusText.textContent = online ? "Online" : "Offline";
  connectionStatusDot.classList.toggle("offline", !online);
}

function toggleWatering() {
  state.wateringOn = !state.wateringOn;
  state.moisture = state.wateringOn ? Math.min(90, state.moisture + 18) : Math.max(45, state.moisture - 8);
  saveState();
  renderSummary();
}

async function fetchWeatherData() {
  const lat = -0.1022;
  const lng = 34.7617;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Africa%2NNairobi`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Weather API unavailable");

    const data = await response.json();
    const current = data.current;
    const daily = data.daily;
    const weatherCodes = {
      0: { label: "Clear sky", icon: "☀️" },
      1: { label: "Mostly clear", icon: "🌤️" },
      2: { label: "Partly cloudy", icon: "⛅" },
      3: { label: "Cloudy", icon: "☁️" },
      45: { label: "Foggy", icon: "🌫️" },
      61: { label: "Rainy", icon: "🌧️" },
      80: { label: "Showers", icon: "🌦️" },
      95: { label: "Storm risk", icon: "⛈️" },
    };

    const currentWeather = weatherCodes[data.current.weather_code] || { label: "Variable", icon: "🌤️" };

    state.weather = {
      temp: Math.round(current.temperature_2m),
      condition: currentWeather.label,
      icon: currentWeather.icon,
      forecast: daily.time.slice(0, 4).map((date, index) => ({
        day: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
        temp: Math.round((daily.temperature_2m_max[index] + daily.temperature_2m_min[index]) / 2),
        icon: weatherCodes[daily.weather_code[index]]?.icon || "🌤️",
      })),
    };

    saveState();
    renderWeather();
    console.log("Weather data refreshed from API.");
  } catch (error) {
    console.warn("Using offline weather fallback:", error);
    state.weather = defaultFarmState.weather;
    renderWeather();
  }
}

function initialize() {
  updateConnectionStatus();
  renderCropHealth();
  renderImprovements();
  renderWeather();
  renderSummary();

  toggleWaterBtn.addEventListener("click", toggleWatering);
  refreshDataBtn.addEventListener("click", fetchWeatherData);
  window.addEventListener("online", () => {
    updateConnectionStatus();
    fetchWeatherData();
  });
  window.addEventListener("offline", updateConnectionStatus);

  if (navigator.onLine) {
    fetchWeatherData();
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}

initialize();