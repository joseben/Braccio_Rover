#include <Servo.h>

Servo servo1, servo2, servo3, servo4, servo5, servo6;

void setup() {
    Serial.begin(115200);   // For Serial Monitor
    Serial2.begin(115200);  // For ESP01 communication (TX2/RX2)

    // Debug: Print initial message to ensure Serial Monitor works
    Serial.println("Arduino Mega initialized. Waiting for ESP01 data...");

    // Attach your servos to the pins on your Arduino Mega
    servo1.attach(3);
    servo2.attach(5);
    servo3.attach(6);
    servo4.attach(9);
    servo5.attach(10);
    servo6.attach(11);
}

void loop() {
    // Check if Serial2 has received data from ESP01
    if (Serial2.available()) {
        String data = Serial2.readStringUntil('\n'); // Read the incoming command from ESP

        // Debug: Print the received command
        //Serial.print("Received Data from ESP01: ");
        //Serial.println(data);

        // Parse the servo values
        int servoValues[6] = {0}; // Initialize array for servo values
        int extracted = 0; // Count of extracted servo values

        // Tokenize the data string by '&'
        char* token = strtok(data.c_str(), "&");
        while (token != NULL && extracted < 6) {
            String paramName = String(token);
            int equalIndex = paramName.indexOf('=');
            if (equalIndex != -1) {
                String valueStr = paramName.substring(equalIndex + 1); // Extract the value
                servoValues[extracted] = valueStr.toInt(); // Convert string to int
                extracted++;
            }
            token = strtok(NULL, "&");
        }

        // Ensure we have extracted all 6 servo values
        if (extracted == 6) {
            // Ensure values are within valid range for servos
            for (int j = 0; j < 6; j++) {
                if (servoValues[j] < 0) servoValues[j] = 0;
                if (servoValues[j] > 180) servoValues[j] = 180;
            }

            // Set servo positions
            servo1.write(servoValues[0]);
            servo2.write(servoValues[1]);
            servo3.write(servoValues[2]);
            servo4.write(servoValues[3]);
            servo5.write(servoValues[4]);
            servo6.write(servoValues[5]);

            // Print the servo values to Serial Monitor for debug
            Serial.print("Servo Positions: ");
            for (int j = 0; j < 6; j++) {
                Serial.print(servoValues[j]);
                if (j < 5) Serial.print(", ");
            }
            Serial.println();
        } else {
            Serial.println("Error: Incomplete servo values in data.");
        }
    } else {
        // Debug: Indicate when no data is available
        //Serial.println("No data available from ESP01.");
        delay(1000);  // Delay to avoid flooding Serial Monitor
    }
}
