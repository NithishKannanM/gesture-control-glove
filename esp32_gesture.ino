/* ESP32 BLE Gesture Broadcaster - Optimized for Flash Size

   - Reduced memory footprint while maintaining functionality
   - Optimized string handling and removed unnecessary features
   - Added Right Tilt and Left Tilt gestures
*/

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Wire.h>
#include "MPU6050.h"

MPU6050 mpu;

// Pin definitions
const uint8_t flex1Pin = 34;
const uint8_t flex2Pin = 35;

// BLE UUIDs
#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_UUID    "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLECharacteristic *pChar = nullptr;
bool connected = false;

// Gesture names stored in PROGMEM to save RAM
const char g0[] PROGMEM = "IDLE";
const char g1[] PROGMEM = "FIST";
const char g2[] PROGMEM = "OPEN_HAND";
const char g3[] PROGMEM = "WAVE_LEFT";
const char g4[] PROGMEM = "WAVE_RIGHT";
const char g5[] PROGMEM = "TILT_UP";
const char g6[] PROGMEM = "TILT_DOWN";
const char g7[] PROGMEM = "TILT_RIGHT";
const char g8[] PROGMEM = "TILT_LEFT";
const char* const gestureNames[] PROGMEM = {g0, g1, g2, g3, g4, g5, g6, g7, g8};

// Thresholds
int16_t FLEX_HIGH = 2600;
int16_t FLEX_LOW = 1200;
int16_t GYRO_THR = 8000;
int16_t ACC_THR = 14000;

// State
uint8_t currentGesture = 0;
uint8_t gestureCount = 0;
uint32_t lastSend = 0;

class MyCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* s) { connected = true; }
  void onDisconnect(BLEServer* s) { connected = false; }
};

uint8_t detectGesture(int16_t f1, int16_t f2, int16_t ax, int16_t ay, 
                      int16_t az, int16_t gx, int16_t gy, int16_t gz) {
  // Motion priority
  if (gz < -GYRO_THR) return 3;  // WAVE_LEFT
  if (gz > GYRO_THR) return 4;   // WAVE_RIGHT
  if (ay < -ACC_THR) return 5;   // TILT_UP
  if (ay > ACC_THR) return 6;    // TILT_DOWN
  if (ax > ACC_THR) return 7;    // TILT_RIGHT
  if (ax < -ACC_THR) return 8;   // TILT_LEFT
  
  // Flex with hysteresis
  if (f1 > FLEX_HIGH - 200 && f2 > FLEX_HIGH - 200) return 1;  // FIST
  if (f1 < FLEX_LOW + 200 && f2 < FLEX_LOW + 200) return 2;   // OPEN_HAND
  
  return 0;  // IDLE
}

void setup() {
  Serial.begin(115200);
  
  // I2C
  Wire.begin(21, 22);
  Wire.setClock(400000);
  
  // ADC
  pinMode(flex1Pin, INPUT);
  pinMode(flex2Pin, INPUT);
  
  // MPU
  mpu.initialize();
  if (!mpu.testConnection()) {
    Serial.println(F("MPU FAIL"));
  }
  
  // BLE
  BLEDevice::init("ESP32_Gesture");
  BLEServer *srv = BLEDevice::createServer();
  srv->setCallbacks(new MyCallbacks());
  BLEService *svc = srv->createService(SERVICE_UUID);
  pChar = svc->createCharacteristic(CHAR_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  pChar->addDescriptor(new BLE2902());
  svc->start();
  BLEDevice::getAdvertising()->addServiceUUID(SERVICE_UUID);
  BLEDevice::getAdvertising()->start();
  
  Serial.println(F("Ready"));
}

void loop() {
  // Read sensors
  int16_t f1 = analogRead(flex1Pin);
  int16_t f2 = analogRead(flex2Pin);
  int16_t ax, ay, az, gx, gy, gz;
  mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
  
  // Detect with debouncing
  uint8_t detected = detectGesture(f1, f2, ax, ay, az, gx, gy, gz);
  if (detected == currentGesture) {
    if (gestureCount < 3) gestureCount++;
  } else {
    currentGesture = detected;
    gestureCount = 0;
  }
  
  // Send if connected and interval passed
  uint32_t now = millis();
  if (connected && gestureCount == 3 && now - lastSend >= 120) {
    char buf[128];
    char name[16];
    strcpy_P(name, (char*)pgm_read_dword(&(gestureNames[currentGesture])));
    snprintf(buf, sizeof(buf), "%d:%s|%d,%d,%d,%d,%d,%d,%d,%d",
             currentGesture, name, f1, f2, ax, ay, az, gx, gy, gz);
    
    pChar->setValue((uint8_t*)buf, strlen(buf));
    pChar->notify();
    lastSend = now;
    Serial.println(buf);
  }
  
  // Reconnect
  if (!connected) {
    BLEDevice::startAdvertising();
  }
  
  delay(30);
}

