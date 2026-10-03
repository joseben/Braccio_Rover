const express = require('express');
const app = express();
const port = process.env.PORT || 3001;
const ip = process.env.BOARD_IP || '192.168.137.120'; // IP address of the Arduino R4 WiFi
const videoDevice = process.env.VIDEO_DEVICE || '/dev/video0';
const ffmpeg = require('fluent-ffmpeg');

// Serve the HTML file for the GUI
app.use(express.static(__dirname + '/public'));
app.use('/new-gui', express.static(__dirname + '/new-gui'));

// Endpoint to stream video from the V4L2 device
app.get('/video', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
        'Cache-Control': 'no-cache',
        'Connection': 'close'
    });

    const command = ffmpeg(videoDevice)
        .inputFormat('v4l2')
        .videoCodec('mjpeg')
        .format('mjpeg')
        .size('640x480')
        .fps(15)
        .on('start', (commandLine) => {
            console.log('Spawned Ffmpeg with command: ' + commandLine);
        })
        .on('error', (err, stdout, stderr) => {
            console.error('Error streaming video:', err.message);
            console.error('ffmpeg stderr:', stderr);
            if (!res.headersSent) {
                res.status(500).send('Video stream error');
            }
        })
        .on('end', () => {
            console.log('Video stream ended');
        });

    // Pipe the stream to response
    const stream = command.pipe();
    
    let frameCounter = 0;
    stream.on('data', (chunk) => {
        if (!res.destroyed) {
            res.write('--frame\r\n');
            res.write('Content-Type: image/jpeg\r\n');
            res.write(`Content-Length: ${chunk.length}\r\n\r\n`);
            res.write(chunk);
            res.write('\r\n');
            frameCounter++;
        }
    });

    stream.on('error', (err) => {
        console.error('Stream error:', err);
    });

    req.on('close', () => {
        console.log('Client disconnected, killing ffmpeg process');
        command.kill('SIGINT');
    });
});

// Receive control values from the GUI and send to the board
app.get('/control', (req, res) => {
    const servo1 = req.query.servo1;
    const servo2 = req.query.servo2;
    const servo3 = req.query.servo3;
    const servo4 = req.query.servo4;
    const servo5 = req.query.servo5;
    const servo6 = req.query.servo6;

    // Forward the values to the Arduino R4 via HTTP
    // (axios is used for the request)
    const axios = require('axios');
    const url = `http://${ip}/update?s1=${servo1}&s2=${servo2}&s3=${servo3}&s4=${servo4}&s5=${servo5}&s6=${servo6}`;
    
    axios.get(url, { timeout: 3000 })
        .then(response => {
            res.send("Sent values to board");
        })
        .catch(error => {
            console.error('Error sending data:', error);
            res.send("Failed to send values to board");
        });
});

app.listen(port, () => {
    console.log(`Webserver running at http://0.0.0.0:${port}`);
});



