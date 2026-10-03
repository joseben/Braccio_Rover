#include <WiFiS3.h>
#include <Servo.h>

// Braccio shield servos. The Braccio library does not support the UNO R4 (renesas),
// so its begin()/ServoMovement() logic is reimplemented below (same pins, limits and soft start).
Servo base, shoulder, elbow, wrist_rot, wrist_ver, gripper;

const int SOFT_START_PIN = 12;   // Braccio shield V4+ soft-start control

// Current positions (written one degree at a time)
int cur_base = 0, cur_shoulder = 40, cur_elbow = 180;
int cur_wrist_rot = 0, cur_wrist_ver = 170, cur_gripper = 73;

void softwarePWM(int high_time, int low_time) {
    digitalWrite(SOFT_START_PIN, HIGH);
    delayMicroseconds(high_time);
    digitalWrite(SOFT_START_PIN, LOW);
    delayMicroseconds(low_time);
}

void softStart() {
    unsigned long t = millis();
    while (millis() - t < 2000) softwarePWM(80, 450);
    while (millis() - t < 6000) softwarePWM(75, 430);
    digitalWrite(SOFT_START_PIN, HIGH);
}

void braccioBegin() {
    pinMode(SOFT_START_PIN, OUTPUT);
    digitalWrite(SOFT_START_PIN, LOW);

    base.attach(11);
    shoulder.attach(10);
    elbow.attach(9);
    wrist_rot.attach(6);
    wrist_ver.attach(5);
    gripper.attach(3);

    base.write(cur_base);
    shoulder.write(cur_shoulder);
    elbow.write(cur_elbow);
    wrist_ver.write(cur_wrist_ver);
    wrist_rot.write(cur_wrist_rot);
    gripper.write(cur_gripper);

    softStart();
}

// Move one servo a single degree towards target; returns true if it is still moving
bool stepServo(Servo& s, int& cur, int target) {
    if (cur == target) return false;
    cur += (target > cur) ? 1 : -1;
    s.write(cur);
    return cur != target;
}

// Same argument order and limits as Braccio.ServoMovement(). As in the original library,
// the 4th argument drives the servo on pin 6 and the 5th the servo on pin 5.
void braccioMove(int stepDelay, int vBase, int vShoulder, int vElbow, int vWristVer, int vWristRot, int vGripper) {
    stepDelay = constrain(stepDelay, 10, 30);
    vBase = constrain(vBase, 0, 180);
    vShoulder = constrain(vShoulder, 15, 165);
    vElbow = constrain(vElbow, 0, 180);
    vWristVer = constrain(vWristVer, 0, 180);
    vWristRot = constrain(vWristRot, 0, 180);
    vGripper = constrain(vGripper, 10, 73);

    bool moving = true;
    while (moving) {
        moving = false;
        moving |= stepServo(base, cur_base, vBase);
        moving |= stepServo(shoulder, cur_shoulder, vShoulder);
        moving |= stepServo(elbow, cur_elbow, vElbow);
        moving |= stepServo(wrist_rot, cur_wrist_rot, vWristVer);
        moving |= stepServo(wrist_ver, cur_wrist_ver, vWristRot);
        moving |= stepServo(gripper, cur_gripper, vGripper);
        delay(stepDelay);
    }
}

const char* ssid = "TP-LINK_2.4G";           // Replace with your network SSID
const char* password = "epposheriakkitharam";  // Replace with your network password

WiFiServer server(80);

// Extract the integer after "<key>=" from the query string, or -1 if missing
int getParam(const String& query, const char* key) {
    String k = String(key) + "=";
    int i = query.indexOf(k);
    if (i < 0) return -1;
    return query.substring(i + k.length()).toInt();
}

void setup() {
    Serial.begin(115200);
    braccioBegin();
    braccioMove(30, 90, 90, 90, 90, 90, 90);

    Serial.println("Connecting to WiFi...");
    while (WiFi.begin(ssid, password) != WL_CONNECTED) {
        delay(2000);
        Serial.println("Retrying WiFi...");
    }
    // On the R4 the link comes up before DHCP finishes, so wait for a real address
    while (WiFi.localIP() == IPAddress(0, 0, 0, 0)) {
        delay(500);
    }
    Serial.print("WiFi connected. IP address: ");
    Serial.println(WiFi.localIP());   // Put this in BOARD_IP in docker-compose.yml
    server.begin();
}

void loop() {
    WiFiClient client = server.available();
    if (!client) return;

    String request = client.readStringUntil('\r');   // e.g. "GET /update?s1=90&...&s6=40 HTTP/1.1"
    client.flush();

    int start = request.indexOf("/update?");
    bool ok = false;
    if (start != -1) {
        start += 8;
        int end = request.indexOf(' ', start);
        String query = request.substring(start, end);

        int v[6];
        ok = true;
        for (int j = 0; j < 6; j++) {
            String key = "s" + String(j + 1);
            v[j] = getParam(query, key.c_str());
            if (v[j] < 0) { ok = false; break; }
            if (v[j] > 180) v[j] = 180;
        }

        if (ok) {
            Serial.print("Servo Positions: ");
            for (int j = 0; j < 6; j++) {
                Serial.print(v[j]);
                if (j < 5) Serial.print(", ");
            }
            Serial.println();
            braccioMove(30, v[0], v[1], v[2], v[3], v[4], v[5]);
        } else {
            Serial.println("Error: Incomplete servo values in request.");
        }
    }

    client.println(ok ? "HTTP/1.1 200 OK" : "HTTP/1.1 400 Bad Request");
    client.println("Content-Type: text/plain");
    client.println("Connection: close");
    client.println();
    client.println(ok ? "Data received" : "Bad request");
    client.stop();
}
