const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const chroma = require("chroma-js");



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

async function createChartUrl() {
    try {
        const timeResponse = await axios.get('http://localhost:3000/time');
        const tempResponse = await axios.get('http://localhost:3000/temp');
        const rainResponse = await axios.get('http://localhost:3000/rain');

        const labels = timeResponse.data.join(',');
        const data1 = tempResponse.data.join(',');
        const data2 = rainResponse.data.join(',');

        // Creating color code for temperature
        let sum = tempResponse.data.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
        let average = sum / tempResponse.data.length;
        let colorScaleValue = 
        scale = chroma.scale(['blue', 'red']);
        borderColor = scale(colorScaleValue).hex(); // #FF7F7F
        console.log(`Chosen chart color: ${borderColor}`)
        // borderColor1 set to ${borderColor}

        let todaysDate = await getCurrentDate();
        chartTitle = `Todays Weather ${todaysDate}`;
        const chartUrl = `https://quickchart.io/chart/render/zm-283d72a0-e994-4d58-9b25-5a4b4233ace0?title=$${chartTitle}&labels=${labels}&data1=${data1}&data2=${data2}`;
        
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
        sleep(1500).then(() => {sendWeatherEmail(temperature_Array,rain_Array)}); // Ensure this function is defined as async
    } catch (error) {
        console.error('Error sending email:', error);
    }
});

