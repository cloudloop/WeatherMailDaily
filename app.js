const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const chroma = require("chroma-js");



const app = express();
const port = parseInt(process.env.PORT) || 8080;
const apiUrl = process.env.API_URL || 'http://localhost';
require('dotenv').config();
//Supress the https warning
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
// Set Express to pretty-print JSON
app.set('json spaces', 2);


// Default coordinates for Stockholm, Sweden
const defaultLat = 59.3293;
const defaultLon = 18.0686;

// Weather fetching function for coordinates
async function fetchWeatherData(lat = 63, lon = 10) {
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
// Function to create the email weather graph
async function createGraph(tempdata,raindata) {
    // URL to Chart API that could work for temp/wind
    // https://quickchart.io/chart/render/zm-cb1f842c-bb20-4ab8-9626-f6bcebbf466b
    // or for temp/rain
    // https://quickchart.io/chart/render/zm-7fe2df71-8a77-4735-a3a1-b443ac2150b8

                                //     How to use it
                                // Override the chart template by adding variables to your URL. For example, to override the first dataset, add numbers to data1:

                                // https://quickchart.io/chart/render/zm-7fe2df71-8a77-4735-a3a1-b443ac2150b8?data1=50,40,30,20
                                // To override chart labels, set labels:

                                // https://quickchart.io/chart/render/zm-7fe2df71-8a77-4735-a3a1-b443ac2150b8?labels=Q1,Q2,Q3,Q4
                                // To override the chart title, set title:

                                // https://quickchart.io/chart/render/zm-7fe2df71-8a77-4735-a3a1-b443ac2150b8?title=An interesting chart
                                // You can join multiple overrides by using &:

                                // https://quickchart.io/chart/render/zm-7fe2df71-8a77-4735-a3a1-b443ac2150b8?title=An interesting chart&labels=Q1,Q2,Q3,Q4&data1=50,40,30,20
    return
}

async function getCurrentDate() {
    let today = new Date();
    let day = String(today.getDate()).padStart(2, '0');
    let month = String(today.getMonth() + 1).padStart(2, '0'); // January is 0!
    let year = today.getFullYear();

    return day + '/' + month + '/' + year;
}

async function hexToRgba(hex, alpha = 0.2) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}


async function createChartUrl() {
    try {
        let timeResponse, tempResponse, rainResponse;
        if (process.env.NODE_ENV === 'production') {
            // Direct function calls
            timeResponse = await axios.get(`${apiUrl}/time`);
            tempResponse = await axios.get(`${apiUrl}/temp`);
            rainResponse = await axios.get(`${apiUrl}/rain`);
        } else {
            // Axios API calls
            timeResponse = await axios.get(`${apiUrl}:${port}/time`);
            tempResponse = await axios.get(`${apiUrl}:${port}/temp`);
            rainResponse = await axios.get(`${apiUrl}:${port}/rain`);
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
        console.error('Error fetching data:', error);
        throw error;
    }
}

async function saveChartImage() {
    const chartUrl = await createChartUrl();
    const response = await axios({
        method: 'get',
        url: chartUrl,
        responseType: 'stream'
    });

    const path = './images/myDynamicChart.png';
    response.data.pipe(fs.createWriteStream(path));
}

// Function to send email
async function sendWeatherEmail() {

    await saveChartImage();
    // Create a Nodemailer transporter using Gmail and environment variables
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS
        }
    });

    let windResponse, tempResponse, rainResponse, tempRes, windRes, rainRes;
    if (process.env.NODE_ENV === 'production') {
        tempResponse = await axios.get(`${apiUrl}/temp`);
        tempRes = tempResponse.data;
        windResponse = await axios.get(`${apiUrl}/wind`);
        windRes = windResponse.data;
        rainResponse = await axios.get(`${apiUrl}/rain`);
        rainRes = rainResponse.data;
    } else {
        // Axios API calls
        tempResponse = await axios.get(`${apiUrl}:${port}/temp`);
        tempRes = tempResponse.data;
        windResponse = await axios.get(`${apiUrl}:${port}/wind`);
        windRes = windResponse.data;
        rainResponse = await axios.get(`${apiUrl}:${port}/rain`);
        rainRes = rainResponse.data;
    }
    
    


    //Creating my HTML sendout variables:
    const tempMin = Math.min(...tempRes);
    const tempMax = Math.max(...tempRes);

    const windSpeedMin = Math.min(...windRes); 
    const windSpeedMax = Math.max(...windRes); 

    const totalRainfall = rainRes.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
    let todaysDate = await getCurrentDate();

    // Email options
    let mailOptions = {
        from: process.env.GMAIL_USER,
        to: 'marcus.lilliebjorn@outlook.com',
        cc: 'axel.k.ingo@gmail.com',
        subject: `Today\'s Weather Briefing - ${todaysDate}`,
        html: `
        <html>
            <head>
                <title>Your daily weather briefing</title>
            </head>
            <body>
                <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eeeeee;">
                    <tr colspan="3">
                        <td align="center" valign="top" width="100%">
                            <h1 style="color: #333333;" text-align:"center";>Weather Report for the next 18h</h1>
                        </td>
                    </tr>
                    <tr>
                        <!-- Temperature Range Column -->
                        <td width="33%" align="center" valign="top">
                        <h2>Temperature Range</h2>
                        <p style="color: #0000d8;">Min: ${tempMin}°C</p>
                        <p style="color: #ff0000;">Max: ${tempMax}°C</p>
                    </td>

                        <!-- Wind and Direction Column -->
                        <td width="33%" align="center" valign="top">
                            <h2>Wind</h2>
                            <p>${windSpeedMin}-${windSpeedMax} m/s°</p>
                        </td>

                        <!-- Rain Column -->
                        <td width="33%" align="center" valign="top">
                            <h2>Rain</h2>
                            <p>${totalRainfall} mm</p>
                        </td>
                    </tr>
                    <tr>
                        <!-- Full Width Image Row -->
                        <td colspan="3">
                            <img src="cid:unique@cid.example.com" style="width: 100%;">
                        </td>
                    </tr>
                </table>
            </body>
        </html>
    `,
    attachments: [{
        filename: 'graph.jpeg',
        path: './images/myDynamicChart.png',
        cid: 'unique@cid.example.com' // Same CID value as in the html field
    }]  // You can format weatherData to be displayed as needed
    };

    // Send the email
    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

// Scheduled task with cron. Bypassing step until weather function is correctly working
// cron.schedule('0 6 * * *', async () => {
//     const weatherData = await fetchWeatherData();
//     await sendWeatherEmail(weatherData);
// }, {
//     scheduled: true,
//     timezone: "Europe/Stockholm"
// });


const weatherData = fetchWeatherData();

let times_Array = [];
let temperature_Array = [];
let windDirection_Array = [];
let windSpeed_Array = [];
let rain_Array = [];

weatherData.then(data => {
    const timeseries = data.properties.timeseries;

    function convertWindDirection(wind_from_direction) {
        if (wind_from_direction < 180) {
            return wind_from_direction + 180;
        } else {
            return wind_from_direction - 180;
        }
    }

    // Reset arrays
    times_Array = [];
    temperature_Array = [];
    windSpeed_Array = [];
    windDirection_Array = [];
    rain_Array = [];
    
    for (let i = 0; i < timeseries.length && i < 18; i++) {
        const timePoint = timeseries[i];
        // Access data in each timePoint
        const time = timePoint.time; // Accessing the time
        const temperature = timePoint.data.instant.details.air_temperature; //Accessing the temperature at 2m above ground
        const windFromOrg = timePoint.data.instant.details.wind_from_direction; //Accessing the wind FROM direction
        const windFrom = Math.round(windFromOrg)
        const windTo = convertWindDirection(windFrom);
        const windSpeed = timePoint.data.instant.details.wind_speed; //Accessing the wind speed
        const rain = data.properties.timeseries[i].data.next_1_hours.details.precipitation_amount;


        // console.log(`Time: ${time}, Temperature: ${temperature}°C, Wind Speed: ${windSpeed}m/s, Wind direction: ${windTo}`);

        times_Array.push(time);
        temperature_Array.push(temperature);
        windDirection_Array.push(windTo);
        windSpeed_Array.push(windSpeed);
        rain_Array.push(rain);

    }
    const returnArray = [times_Array, temperature_Array, windDirection_Array, windSpeed_Array, rain_Array];
    return returnArray
}).then( Array => {
    times_Array = Array[0];
    temperature_Array = Array[1];
    windDirections_Array = Array[2];
    windSpeed_Array = Array[3];
    rainArray_Array = Array[4];
    // console.log(times_Array, temperature_Array, windDirections_Array, windSpeed_Array)

}).catch(error => {
    console.error('Error:', error);
});

// cron.schedule("*/10 * * * * *", function() {
//     console.log("running a task every 10 second");
//   });


// API endpoint for all weather data
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

// Express server setup
app.listen(port, async() => {
    console.log(`Server is running on ${apiUrl}:${port}`);
});

