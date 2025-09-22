#include <ESP8266WiFi.h>

const char* ssid = "Test"; // Replace with your network SSID
const char* password = "enthinada"; // Replace with your network password


WiFiServer server(80);

void setup() {
    Serial.begin(115200);  // For Serial Monitor

    // Connect to Wi-Fi
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.println("Connecting to WiFi...");
    }
    Serial.println("WiFi connected.");
    server.begin();
}

void loop() {
    WiFiClient client = server.available();
    if (client) {
        String request = client.readStringUntil('\r');
        client.flush(); // Clear any remaining data

        // Process request and extract servo values from the URL
        String servoCommand;
        if (request.indexOf("/update?") != -1) {
            int start = request.indexOf("/update?") + 8; // Move past "/update?"
            int end = request.indexOf(" ", start); // Find the next space
            servoCommand = request.substring(start, end); // Extract servo command
        }

        // Send servo command to Arduino Mega
        if (servoCommand.length() > 0) {
            Serial.println(servoCommand); // Send servo command as is
        }

        // Respond to client
        client.println("HTTP/1.1 200 OK");
        client.println("Content-Type: text/plain");
        client.println("Connection: close");
        client.println();
        client.println("Data received");
    }
}
