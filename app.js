const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const cron = require('node-cron');


const app = express();
const port = 3000;
require('dotenv').config();
//Supress the https warning
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
// Set Express to pretty-print JSON
app.set('json spaces', 2);


// Default coordinates for Stockholm, Sweden
const defaultLat = 59.3293;
const defaultLon = 18.0686;

// Weather fetching function for coordinates
async function fetchWeatherData(lat = defaultLat, lon = defaultLon) {
    try {
        const response = await axios.get(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`, {
            headers: {
                'User-Agent': 'Axel Ingo/WeatherMailDaily (https://github.com/cloudloop/WeatherMailDaily)' // Replace with your actual app info
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
async function createGraph(data) {
    // URL to Chart API that could work
    return
}

// Function to send email
async function sendWeatherEmail(weatherData) {

    await createGraph(weatherData);
    // Create a Nodemailer transporter using Gmail and environment variables
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS
        }
    });

    const timeResponse = await axios.get('http://localhost:3000/time');
    const timeRes = timeResponse.data;
    const tempResponse = await axios.get('http://localhost:3000/temp');
    const tempRes = tempResponse.data;

    // Email options
    let mailOptions = {
        from: process.env.GMAIL_USER,
        to: 'axel.k.ingo+weather@gmail.com',
        subject: 'Today\'s Weather',
        html: `
        <html>
            <head>
                <title>Email Title</title>
            </head>
            <body>
                <table width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                        <td align="center" valign="top" style="background-color:#eeeeee;">
                            <h1 style="color: #333333;">Weather Report</h1>
                            <p style="color: #555555;">Details about the weather...</p>
                            <p style="color: #777777;">${timeRes}, ${tempRes}</p>
                            <!-- More content here -->
                            <img src="cid:unique@cid.example.com">
                        </td>
                    </tr>
                </table>
            </body>
        </html>
    `,
    attachments: [{
        filename: 'graph.jpeg',
        path: './images/graph.jpeg',
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
app.get('/weather', (req, res) => {
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


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

// Express server setup
app.listen(port, async() => {
    console.log(`Server is running on http://localhost:${port}`);
    try {
        sleep(200).then(() => {sendWeatherEmail()}); // Ensure this function is defined as async
    } catch (error) {
        console.error('Error sending email:', error);
    }
});

