const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const app = express();
require('dotenv').config();

// Default coordinates for Stockholm, Sweden
const defaultLat = 59.3293;
const defaultLon = 18.0686;

async function fetchWeatherData(lat = defaultLat, lon = defaultLon) {
    try {
        const response = await axios.get(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`, {
            headers: {
                'User-Agent': 'YourAppName/YourAppVersion (YourContactInfo)' // Replace with your actual app info
            }
        });

        // Parse the response to extract required weather data
        const weatherData = response.data; // Modify as per your needs

        return weatherData;
    } catch (error) {
        console.error('Error fetching weather data:', error);
        throw error;
    }
}


// Function to send email
async function sendWeatherEmail(weatherData) {
    // Configure Nodemailer and send email with weatherData
}

// Scheduled task
cron.schedule('0 6 * * *', async () => {
    const weatherData = await fetchWeatherData();
    await sendWeatherEmail(weatherData);
}, {
    scheduled: true,
    timezone: "Europe/Stockholm"
});

// Express server setup
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
