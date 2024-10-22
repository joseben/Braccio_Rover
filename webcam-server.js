const express = require('express');
const app = express();
const port = 3000;
const ip = '192.168.137.175'; // IP address of your ESP01
const ffmpeg = require('fluent-ffmpeg');

// Serve the HTML file for the GUI
app.use(express.static(__dirname + '/public'));

// Endpoint to stream video from /dev/video0
app.get('/video', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    });

    const stream = ffmpeg('/dev/video6')
        .inputFormat('v4l2')
        .format('mjpeg')
        .outputOptions('-r 25')  // Frame rate, adjust as needed
        .on('error', (err) => {
            console.error('Error streaming video:', err);
        })
        .pipe();

    stream.on('data', (chunk) => {
        res.write(`--frame\r\n`);
        res.write('Content-Type: image/jpeg\r\n');
        res.write(`Content-Length: ${chunk.length}\r\n`);
        res.write('\r\n');
        res.write(chunk, 'binary');
        res.write('\r\n');
    });

    stream.on('end', () => {
        console.log('Stream ended');
        res.end();
    });
});


// Receive control values from the GUI and send to ESP01
app.get('/control', (req, res) => {
    const { servo1, servo2, servo3, servo4, servo5, servo6 } = req.query;

    // Send values to the ESP01 via HTTP
    const axios = require('axios');
    const url = `http://${ip}/update?s1=${servo1}&s2=${servo2}&s3=${servo3}&s4=${servo4}&s5=${servo5}&s6=${servo6}`;
    
    axios.get(url)
        .then(() => res.send("Sent values to ESP01"))
        .catch((error) => {
            console.error('Error sending data:', error);
            res.send("Failed to send values to ESP01");
        });
});

app.listen(port, () => {
    console.log(`Webserver running at http://localhost:${port}`);
});
