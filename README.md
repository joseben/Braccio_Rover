# Braccio Rover

Wireless control of an Arduino Braccio robotic arm mounted on a rover, with a live camera feed. The operator uses a web page on a laptop that shows the camera view and has sliders for each of the arm's six servos.

## How it works

```
 Browser (laptop)  <--- MJPEG video ---  Node/Express server in Docker (port 3001)  <--- /dev/video0 (USB video receiver)
   sliders (0-100)                              |
        |  GET /control?servo1..6               |  HTTP GET http://<BOARD_IP>/update?s1=..&s6=..
        +-------------------------------------->+---------------------------> Arduino UNO R4 WiFi (HTTP server, port 80)
                                                                                   |  Braccio library
                                                                                   v
                                                                              Braccio arm (6 servos)
```

**Video path:** the camera on the rover sends its feed through a video transmitter to a receiver on the laptop. The receiver appears as a V4L2 device (`/dev/video0`). The server uses ffmpeg to turn it into an MJPEG stream (640x480, 15 fps) at `/video`, which the page displays in an `<img>` tag.

**Control path:** moving a slider calls `/control` on the server, which forwards the values over HTTP to the Arduino UNO R4 WiFi. The R4 parses them and moves the arm directly. There is no ESP-01 or second serial link any more.

## Hardware

- Arduino UNO R4 WiFi with a Braccio shield and Braccio arm
- Camera with video transmitter on the rover, plus a receiver on the laptop (shows up as `/dev/video0`)
- Any Linux machine with Docker, on the same WiFi network as the R4

## Repository layout

| Path | Purpose |
|---|---|
| `server.js` | Express server. Serves `public/`, streams video at `/video`, relays servo values at `/control`. Configured with env vars `BOARD_IP`, `VIDEO_DEVICE`, `PORT`. |
| `public/index.html` | The control GUI: 6 sliders, a Reset button and the live video panel. |
| `public/index copy.html`, `public/webcam.html` | Older/prototype GUIs, not used. |
| `Dockerfile`, `docker-compose.yml`, `.dockerignore` | Container setup (Node 20 + ffmpeg). |
| `Braccio_Rover/r4_wifi/r4_wifi.ino` | **Current firmware** for the UNO R4 WiFi: joins WiFi, serves `/update?...` on port 80, moves the arm using a built-in port of the Braccio movement code. |
| `Braccio_Rover/legacy/` | Old Mega + ESP-01 firmware (`esp_code`, `Braccio_arduino_code`, `arduino_code`), kept for reference. |

## Setup and running

1. In `Braccio_Rover/r4_wifi/r4_wifi.ino`, set `ssid` and `password`, then flash it to the R4 (board package: Arduino UNO R4 Boards; the `Servo` library must be version 1.2.2 or newer from the Library Manager. The `Braccio` library is not needed because it doesn't support the R4).
2. Open the Serial Monitor at 115200 baud and note the IP address the R4 prints after it connects.
3. Put that IP in `BOARD_IP` in `docker-compose.yml`.
4. On the Linux machine (only Docker needed):
   ```
   docker compose up -d --build
   ```
5. Open `http://localhost:3001` and use the sliders.

To move it to another machine, copy the repository folder and run step 4. To avoid rebuilding there, run `docker save braccio-rover | gzip > braccio-rover.tar.gz` here, then `docker load < braccio-rover.tar.gz` on the other machine and copy `docker-compose.yml` alongside it.

The compose file uses host networking (so the container can reach the R4 on the LAN) and passes `/dev/video0` through. If the video receiver is on a different device, change `VIDEO_DEVICE` and the `devices:` entry. Host networking works on Linux only.

## Protocol details

- **Browser to server:** `GET /control?servo1=..&servo2=..&servo3=..&servo4=..&servo5=..&servo6=..` (degrees).
- **Server to R4:** `GET /update?s1=..&s2=..&s3=..&s4=..&s5=..&s6=..`
- **R4:** reads `s1` to `s6` by name, clamps to 0-180 and moves the arm with the same logic as `Braccio.ServoMovement`. It answers `400` if any value is missing.

Servo order: base, shoulder, elbow, wrist vertical, wrist rotation, gripper (the Braccio library's argument order).

The sliders run 0-100 and are mapped to these servo ranges in `index.html`:

| Servo | Min | Max |
|---|---|---|
| 1 base | 0 | 180 |
| 2 shoulder | 20 | 160 |
| 3 elbow | 0 | 180 |
| 4 wrist vertical | 0 | 180 |
| 5 wrist rotation | 0 | 180 |
| 6 gripper | 15 | 70 |

The Reset button sends 90 for servos 1-5 and 40 for the gripper, and puts the sliders back at 50. Slider 50 maps to 90 for servos 1-5 and to 43 for the gripper, so after a reset the gripper is 3 degrees off from where the slider would put it.

## Notes and known issues

- **WiFi credentials are committed** in the sketch. Consider moving them out of the repository.
- The page sends a request on every slider `oninput` event. `Braccio.ServoMovement(30, ...)` blocks while the arm moves, so rapid slider movement can back up requests. Throttling in the page would help.
- `/control` doesn't validate input and returns HTTP 200 even when the board is unreachable (the response text says it failed; the browser only logs it).
- `/video` runs one ffmpeg process per connected viewer and kills it when the client disconnects.
- The firmware has not been tested on a real R4 yet. It replaces the `Braccio` library with a port of its code, so the arm should behave the same, but check the first movements with care.
