const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

// Environment variables
const apiUrl = process.env.API_URL || 'http://localhost';

// Serving static files through
app.use(express.static('public'));

// Default coordinates for Stockholm, Sweden
const defaultLat = 59.3293;
const defaultLon = 18.0686;

// Weather fetching function for coordinates
async function getWeatherData(lat = defaultLat, lon = defaultLon) {
    try {
        const response = await axios.get(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`, {
            headers: {
                'User-Agent': 'Axel Ingo/WeatherMailDaily (https://github.com/cloudloop/WeatherMailDaily)' 
            }
        });

        // Parse the response to extract required weather data
        const weatherData = response.data; 

        return weatherData;
    } catch (error) {
        console.error('Error fetching weather data:', error);
        throw error;
    }
}

// Function to fetch weather data
async function fetchWeatherDataFromAPI(endpoint) {
    try {
        const url = process.env.NODE_ENV === 'production' ? `${apiUrl}/${endpoint}` : `${apiUrl}:${port}/${endpoint}`;
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        throw error;
    }
}

async function hexToRgba(hex, alpha = 0.2) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

async function createChartUrl() {
    try {
        try {
            // Ternary operation to choose between production and development URLs
            const timeResponse = await axios.get(process.env.NODE_ENV === 'production' ? `${apiUrl}/time` : `${apiUrl}:${port}/time`);
            const tempResponse = await axios.get(process.env.NODE_ENV === 'production' ? `${apiUrl}/temp` : `${apiUrl}:${port}/temp`);
            const rainResponse = await axios.get(process.env.NODE_ENV === 'production' ? `${apiUrl}/rain` : `${apiUrl}:${port}/rain`);
            
            // Process the responses as needed...
        
        } catch (error) {
            console.error('Error fetching the weatherdata from API endpoints:', error);
            // Handle the error appropriately...
        }
            
            const labels = timeResponse.data.join(',');
            const data1 = tempResponse.data.join(',');
            const data2 = rainResponse.data.join(',');

            // Creating color code for temperature
            let sum = tempResponse.data.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
            let average = sum / tempResponse.data.length;
            let colorScaleValue = (average + 20)/55;
            console.log(`Color Scale Value: ${colorScaleValue}`);      
            scale = chroma.scale(['blue', 'red']);
            let borderColor = scale(colorScaleValue).hex(); // #FF7F7F
            console.log(`Chosen chart color: ${borderColor}`); // borderColor1 set to ${borderColor}
            let backgroundColor = await hexToRgba(borderColor);
            console.log(`Area color chosen: ${backgroundColor}`);
            let todaysDate = await getCurrentDate();
            chartTitle = `Todays Weather ${todaysDate}`;
            const chartUrl = `https://quickchart.io/chart/render/zm-283d72a0-e994-4d58-9b25-5a4b4233ace0?title=${encodeURIComponent(chartTitle)}&labels=${encodeURIComponent(labels)}&data1=${data1}&data2=${data2}&borderColor1=${encodeURIComponent(borderColor)}&backgroundColor1=${encodeURIComponent(backgroundColor)}`;
            
            return chartUrl;
    } catch (error) {
        console.error('Error creating chart URL:', error);
        throw error;
    }
}

// Function to read and populate email template
async function getEmailTemplate(data) {
    try {
        const templatePath = path.join(__dirname, 'public/emailTemplate.html');
        let template = fs.readFileSync(templatePath, 'utf8');
        // Replace placeholders with actual data
        template = template.replace(/{{tempMin}}/g, data.tempMin);
        // ... other replacements ...
        return template;
    } catch (error) {
        console.error('Error reading email template:', error);
        throw error;
    }
}

// Function to send email
async function sendWeatherEmail() {
    try {
        const tempData = await fetchWeatherDataFromAPI('temp');
        const windData = await fetchWeatherDataFromAPI('wind');
        const rainData = await fetchWeatherDataFromAPI('rain');

        const tempMin = Math.min(...tempData);
        const tempMax = Math.max(...tempData);

        // ... other data processing ...

        const emailHtml = await getEmailTemplate({ tempMin, tempMax, ... });

        // Nodemailer setup
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASS
            }
        });

        let mailOptions = {
            from: process.env.GMAIL_USER,
            to: process.env.EMAIL_TO,
            cc: process.env.EMAIL_CC,
            subject: `Today's Weather Briefing - ${new Date().toLocaleDateString()}`,
            html: emailHtml
        };

        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

// Express endpoints
// Serve the emailTemplate.html at the root endpoint
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'emailTemplate.html'));
});
app.get('/weatherdata', (req, res) => {
    weatherData.then((data) => {
        res.json(data.properties.timeseries);
    }).catch((error) => {
        console.error('Error:', error);
        res.status(500).send('Error fetching weather data');
    });
});

app.get('/weather', async (req, res) => {
    let promiseCheck = await weatherData;
    res.json({
        time: times_Array,
        temperature: temperature_Array,
        wind: windSpeed_Array,
        windDirection: windDirection_Array,
        rain: rain_Array,
    });
});

// API endpoint for time
app.get('/time', (req, res) => {
    res.json(times_Array);
});

// API endpoint for temperature
app.get('/temp', (req, res) => {
    res.json(temperature_Array);
});

// API endpoint for wind
app.get('/wind', (req, res) => {
    res.json(windSpeed_Array);
});

// API endpoint for wind direction
app.get('/winddirection', (req, res) => {
    res.json(windDirection_Array);
});

// API endpoint for rain
app.get('/rain', (req, res) => {
    res.json(rain_Array);
});

app.get('/send', async (req, res) => {
    try {
        await sendWeatherEmail();
        res.send("Email sent successfully");
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).send('Error sending email');
    }
});


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
