const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const cors = require('cors');
const app = express();
const port = 3000;
const ip = '192.168.137.175'; // IP address of your ESP01

// Enable CORS
app.use(cors());

// Serve the HTML file for the GUI
app.use(express.static(__dirname + '/public'));

// Endpoint to control the servos
app.get('/control', (req, res) => {
    const servo1 = req.query.servo1;
    const servo2 = req.query.servo2;
    const servo3 = req.query.servo3;
    const servo4 = req.query.servo4;
    const servo5 = req.query.servo5;
    const servo6 = req.query.servo6;

    const axios = require('axios');
    const url = `http://${ip}/update?s1=${servo1}&s2=${servo2}&s3=${servo3}&s4=${servo4}&s5=${servo5}&s6=${servo6}`;
    
    axios.get(url)
        .then(response => {
            res.send("Sent values to ESP01");
        })
        .catch(error => {
            console.error('Error sending data:', error);
            res.send("Failed to send values to ESP01");
        });
});

// Video stream endpoint
app.get('/video', (req, res) => {
    res.contentType('mp4');
    ffmpeg('video=USB2.0 PC CAMERA') // Use the correct device name for your USB camera
        .addInputOption('-f', 'dshow') // For Windows, use 'dshow'
        .outputOptions('-pix_fmt', 'yuv420p')
        .on('start', function(commandLine) {
            console.log('Spawned Ffmpeg with command: ' + commandLine);
        })
        .on('error', function(err) {
            console.log('An error occurred: ' + err.message);
        })
        .pipe(res, { end: true });
});

app.listen(port, () => {
    console.log(`Webserver running at http://localhost:${port}`);
});
