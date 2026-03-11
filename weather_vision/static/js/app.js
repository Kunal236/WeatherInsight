document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let currentCityData = null;

    // --- DOM Elements ---
    const searchForm = document.getElementById('search-form');
    const cityInput = document.getElementById('city-search');
    const searchError = document.getElementById('search-error');
    const btnLocation = document.getElementById('btn-location');
    const btnSaveCity = document.getElementById('btn-save-city');
    const savedCitiesList = document.getElementById('saved-cities-list');
    
    // UI States
    const initialState = document.getElementById('initial-state');
    const loadingState = document.getElementById('loading-state');
    const weatherDashboard = document.getElementById('weather-dashboard');

    // Weather Display Elements
    const currentCityEl = document.getElementById('current-city');
    const currentDateEl = document.getElementById('current-date');
    const currentTempEl = document.getElementById('current-temp');
    const currentIconEl = document.getElementById('current-icon');
    const currentConditionEl = document.getElementById('current-condition');
    const currentHumidityEl = document.getElementById('current-humidity');
    const currentWindEl = document.getElementById('current-wind');
    const forecastContainer = document.getElementById('forecast-container');

    // --- Weather Mapping (WMO Codes to Icons and Text) ---
    const weatherMapping = {
        0: { text: 'Clear Sky', icon: 'fa-sun', color: '#fbbf24' },
        1: { text: 'Mainly Clear', icon: 'fa-cloud-sun', color: '#fcd34d' },
        2: { text: 'Partly Cloudy', icon: 'fa-cloud-sun', color: '#94a3b8' },
        3: { text: 'Overcast', icon: 'fa-cloud', color: '#64748b' },
        45: { text: 'Fog', icon: 'fa-smog', color: '#94a3b8' },
        48: { text: 'Depositing Rime Fog', icon: 'fa-smog', color: '#94a3b8' },
        51: { text: 'Light Drizzle', icon: 'fa-cloud-rain', color: '#60a5fa' },
        53: { text: 'Moderate Drizzle', icon: 'fa-cloud-rain', color: '#60a5fa' },
        55: { text: 'Dense Drizzle', icon: 'fa-cloud-rain', color: '#3b82f6' },
        56: { text: 'Light Freezing Drizzle', icon: 'fa-icicles', color: '#93c5fd' },
        57: { text: 'Dense Freezing Drizzle', icon: 'fa-icicles', color: '#60a5fa' },
        61: { text: 'Slight Rain', icon: 'fa-cloud-rain', color: '#60a5fa' },
        63: { text: 'Moderate Rain', icon: 'fa-cloud-showers-heavy', color: '#3b82f6' },
        65: { text: 'Heavy Rain', icon: 'fa-cloud-showers-heavy', color: '#2563eb' },
        66: { text: 'Light Freezing Rain', icon: 'fa-cloud-meatball', color: '#93c5fd' },
        67: { text: 'Heavy Freezing Rain', icon: 'fa-cloud-meatball', color: '#60a5fa' },
        71: { text: 'Slight Snowfall', icon: 'fa-snowflake', color: '#bfdbfe' },
        73: { text: 'Moderate Snowfall', icon: 'fa-snowflake', color: '#93c5fd' },
        75: { text: 'Heavy Snowfall', icon: 'fa-snowflake', color: '#60a5fa' },
        77: { text: 'Snow Grains', icon: 'fa-snowflake', color: '#bfdbfe' },
        80: { text: 'Slight Rain Showers', icon: 'fa-cloud-rain', color: '#60a5fa' },
        81: { text: 'Moderate Rain Showers', icon: 'fa-cloud-showers-heavy', color: '#3b82f6' },
        82: { text: 'Violent Rain Showers', icon: 'fa-cloud-showers-heavy', color: '#1d4ed8' },
        85: { text: 'Slight Snow Showers', icon: 'fa-snowflake', color: '#93c5fd' },
        86: { text: 'Heavy Snow Showers', icon: 'fa-snowflake', color: '#60a5fa' },
        95: { text: 'Thunderstorm', icon: 'fa-bolt', color: '#fbbf24' },
        96: { text: 'Thunderstorm with Slight Hail', icon: 'fa-cloud-bolt', color: '#f59e0b' },
        99: { text: 'Thunderstorm with Heavy Hail', icon: 'fa-cloud-bolt', color: '#d97706' }
    };

    function getWeatherInfo(code) {
        return weatherMapping[code] || { text: 'Unknown', icon: 'fa-cloud', color: '#94a3b8' };
    }

    function formatDate(dateObj) {
        const options = { weekday: 'long', day: 'numeric', month: 'short' };
        return dateObj.toLocaleDateString('en-US', options);
    }

    function getShortDayName(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    }

    // --- API Calls ---

    async function searchCity(cityName) {
        try {
            showLoading();
            const response = await fetch(`/api/geocode?city=${encodeURIComponent(cityName)}`);
            if (!response.ok) {
                throw new Error('City not found');
            }
            const data = await response.json();
            currentCityData = data;
            
            // Check if city is already saved to update button state
            checkIfCitySaved(data.name);
            
            await fetchWeather(data.latitude, data.longitude, `${data.name}${data.country ? ', ' + data.country : ''}`);
        } catch (error) {
            hideLoading();
            searchError.classList.remove('hidden');
            setTimeout(() => {
                searchError.classList.add('hidden');
            }, 3000);
            console.error('Error searching city:', error);
        }
    }

    async function fetchWeather(lat, lon, displayName) {
        try {
            const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
            if (!response.ok) {
                throw new Error('Failed to fetch weather data');
            }
            const data = await response.json();
            updateDashboard(data, displayName);
        } catch (error) {
            hideLoading();
            console.error('Error fetching weather:', error);
            alert('Failed to retrieve weather data.');
        }
    }

    async function loadFavorites() {
        const loader = document.getElementById('favorites-loader');
        try {
            loader.classList.remove('hidden');
            const response = await fetch('/api/favorites');
            const cities = await response.json();
            
            // Clear existing cities (except loader)
            const cityItems = savedCitiesList.querySelectorAll('.saved-city-item');
            cityItems.forEach(item => item.remove());

            cities.forEach(city => {
                addCityToSidebar(city);
            });
            
            if (currentCityData) {
                checkIfCitySaved(currentCityData.name);
            }
        } catch (error) {
            console.error('Error loading favorites:', error);
        } finally {
            loader.classList.add('hidden');
        }
    }

    async function saveFavorite() {
        if (!currentCityData) return;

        try {
            const isCurrentlySaved = btnSaveCity.classList.contains('saved');
            
            if (isCurrentlySaved) {
                // To delete, we need the ID which we don't store globally.
                // We just reload favorites instead of direct deletion from header.
                // Normally we'd store the DB ID in currentCityData. For simplicity:
                alert('City is already saved!');
                return;
            }

            const payload = {
                name: currentCityData.name,
                latitude: currentCityData.latitude,
                longitude: currentCityData.longitude
            };

            const response = await fetch('/api/favorites', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                btnSaveCity.innerHTML = '<i class="fa-solid fa-star"></i> Saved';
                btnSaveCity.classList.add('saved');
                loadFavorites();
            }
        } catch (error) {
            console.error('Error saving favorite:', error);
        }
    }

    async function deleteFavorite(id, cityElement) {
        try {
            const response = await fetch(`/api/favorites?id=${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                cityElement.remove();
                if (currentCityData && currentCityData.id === id) { // pseudo-check
                    btnSaveCity.innerHTML = '<i class="fa-regular fa-star"></i> Save Location';
                    btnSaveCity.classList.remove('saved');
                }
                loadFavorites(); // Refresh to ensure sync
            }
        } catch (error) {
            console.error('Error deleting favorite:', error);
        }
    }

    // --- UI Updaters ---

    function updateDashboard(weatherData, displayName) {
        // Hide loaders, show dashboard
        initialState.classList.add('hidden');
        loadingState.classList.add('hidden');
        weatherDashboard.classList.remove('hidden');

        // Update Header
        currentCityEl.textContent = displayName;
        currentDateEl.textContent = formatDate(new Date());

        // Update Current Weather
        const current = weatherData.current;
        const currentInfo = getWeatherInfo(current.weather_code);
        
        currentTempEl.textContent = Math.round(current.temperature_2m);
        currentConditionEl.textContent = currentInfo.text;
        currentIconEl.innerHTML = `<i class="fa-solid ${currentInfo.icon}" style="color: ${currentInfo.color}"></i>`;
        
        currentHumidityEl.textContent = `${current.relative_humidity_2m}%`;
        currentWindEl.textContent = `${current.wind_speed_10m} km/h`;

        // Update Forecast
        forecastContainer.innerHTML = '';
        const daily = weatherData.daily;
        
        // Take next 5 days
        for (let i = 1; i <= 5; i++) {
            if (i >= daily.time.length) break;
            
            const dateStr = daily.time[i];
            const maxTemp = Math.round(daily.temperature_2m_max[i]);
            const minTemp = Math.round(daily.temperature_2m_min[i]);
            const code = daily.weather_code[i];
            const info = getWeatherInfo(code);
            const dayName = getShortDayName(dateStr);

            const forecastEl = document.createElement('div');
            forecastEl.className = 'forecast-item';
            forecastEl.innerHTML = `
                <span class="forecast-day">${dayName}</span>
                <i class="fa-solid ${info.icon} forecast-icon" style="color: ${info.color}"></i>
                <div class="forecast-temps">
                    <span class="temp-max">${maxTemp}°</span>
                    <span class="temp-min">${minTemp}°</span>
                </div>
            `;
            forecastContainer.appendChild(forecastEl);
        }
    }

    function addCityToSidebar(city) {
        const div = document.createElement('div');
        div.className = 'saved-city-item';
        div.innerHTML = `
            <span class="saved-city-name">${city.name}</span>
            <button class="btn-delete" title="Remove city" data-id="${city.id}">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        
        // Click on city name to load
        div.querySelector('.saved-city-name').addEventListener('click', () => {
            currentCityData = { name: city.name, latitude: city.latitude, longitude: city.longitude };
            showLoading();
            checkIfCitySaved(city.name);
            fetchWeather(city.latitude, city.longitude, city.name);
        });

        // Click delete
        div.querySelector('.btn-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteFavorite(city.id, div);
        });

        savedCitiesList.appendChild(div);
    }

    function showLoading() {
        initialState.classList.add('hidden');
        weatherDashboard.classList.add('hidden');
        loadingState.classList.remove('hidden');
    }

    function hideLoading() {
        loadingState.classList.add('hidden');
    }

    function checkIfCitySaved(cityName) {
        // Query DOM to check if city is in the sidebar list
        const savedItems = document.querySelectorAll('.saved-city-name');
        let isSaved = false;
        savedItems.forEach(item => {
            if (item.textContent === cityName) {
                isSaved = true;
            }
        });

        if (isSaved) {
            btnSaveCity.innerHTML = '<i class="fa-solid fa-star"></i> Saved';
            btnSaveCity.classList.add('saved');
        } else {
            btnSaveCity.innerHTML = '<i class="fa-regular fa-star"></i> Save Location';
            btnSaveCity.classList.remove('saved');
        }
    }

    // --- Event Listeners ---

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const city = cityInput.value.trim();
        if (city) {
            searchCity(city);
            cityInput.value = '';
        }
    });

    btnLocation.addEventListener('click', () => {
        if ("geolocation" in navigator) {
            btnLocation.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    currentCityData = { name: "Current Location", latitude: lat, longitude: lon };
                    try {
                        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
                        const data = await response.json();
                        const displayName = data.city || data.locality || "Current Location";
                        currentCityData.name = displayName;
                        fetchWeather(lat, lon, displayName);
                    } catch (e) {
                        fetchWeather(lat, lon, "Your Location");
                    }
                    btnLocation.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
                },
                (error) => {
                    alert("Unable to retrieve your location.");
                    btnLocation.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
                }
            );
            showLoading();
        } else {
            alert("Geolocation is not supported by your browser");
        }
    });

    btnSaveCity.addEventListener('click', saveFavorite);

    // Initial load
    loadFavorites();
});
