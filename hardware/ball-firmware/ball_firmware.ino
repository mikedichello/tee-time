/**
 * Tee Time — Smart Golf Ball Firmware
 *
 * Target MCU : ATtiny85 @ 8 MHz (3.3V)
 *              or ATmega328p (Arduino Uno/Pro Mini) for prototyping
 *
 * Connections (ATtiny85):
 *   PB0 (pin 5)  → SDA  of NT3H2111 (NFC I2C tag) + SDA of LIS3DH
 *   PB2 (pin 7)  → SCL  of NT3H2111 + SCL of LIS3DH
 *   PB1 (pin 6)  → INT1 of LIS3DH (accelerometer interrupt, active-low)
 *   VCC          → 3.3V from LIR2032 (rechargeable coin cell)
 *   GND          → GND
 *
 * How it works:
 *   1. MCU sleeps in deep sleep (< 5 µA)
 *   2. LIS3DH INT1 fires when acceleration exceeds IMPACT_THRESHOLD_G
 *   3. ISR wakes MCU, sets impact flag
 *   4. Main loop reads current count from NT3H2111 EEPROM (I2C)
 *   5. Increments count, writes back
 *   6. Returns to sleep
 *   7. At hole cup: RC522 on Raspberry Pi reads the NFC side of NT3H2111
 *      (same memory, different interface) → gets UID + stroke count
 *      RC522 then writes 0 to page 4 to reset for next hole
 *
 * Required libraries (Arduino IDE):
 *   - SparkFun LIS3DH (https://github.com/sparkfun/SparkFun_LIS3DH_Arduino_Library)
 *   - TinyI2C  (https://github.com/technoblogy/tiny-i2c) for ATtiny85
 *   or Wire.h for Arduino Uno prototyping
 *
 * NT3H2111 NFC memory layout (NTAG I2C):
 *   NFC page 4 = I2C byte address 0x10 in user SRAM
 *   Bytes 0-1: stroke count as uint16 little-endian
 *   Bytes 2-3: reserved / 0x00
 */

#include <Wire.h>
#include <avr/sleep.h>
#include <avr/interrupt.h>

// ── Configuration ───────────────────────────────────────────────────────────
#define IMPACT_THRESHOLD_G   4     // g — minimum acceleration to count as putter strike
#define IMPACT_DURATION_MS   10    // ms the threshold must be exceeded
#define DEBOUNCE_MS          400   // ms to ignore subsequent impacts after one counted
#define MAX_STROKES          15    // sanity cap per hole

// ── I2C addresses ───────────────────────────────────────────────────────────
#define LIS3DH_ADDR          0x18  // SA0 pin low; use 0x19 if SA0 high
#define NT3H2111_ADDR        0x55  // fixed I2C address

// NT3H2111 EEPROM user-data byte address for NFC page 4
// NFC page N = I2C byte address 0x00 + N*4 (relative to EEPROM block select)
#define NFC_PAGE4_I2C_ADDR   0x10  // byte offset for NFC page 4

// LIS3DH register addresses
#define LIS_CTRL_REG1        0x20
#define LIS_CTRL_REG3        0x22
#define LIS_CTRL_REG4        0x23
#define LIS_CTRL_REG5        0x24
#define LIS_INT1_CFG         0x30
#define LIS_INT1_THS         0x32
#define LIS_INT1_DURATION    0x33
#define LIS_INT1_SRC         0x31

// ── ATtiny85 interrupt pin ──────────────────────────────────────────────────
#define INT_PIN  1  // PB1, physical pin 6

// ── Globals ─────────────────────────────────────────────────────────────────
volatile bool impactDetected = false;
unsigned long lastImpactMs   = 0;

// ── I2C helpers ─────────────────────────────────────────────────────────────
void writeReg(uint8_t devAddr, uint8_t reg, uint8_t val) {
  Wire.beginTransmission(devAddr);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

uint8_t readReg(uint8_t devAddr, uint8_t reg) {
  Wire.beginTransmission(devAddr);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(devAddr, (uint8_t)1);
  return Wire.available() ? Wire.read() : 0;
}

// ── NT3H2111 stroke count (stored at NFC page 4) ────────────────────────────
uint16_t readStrokeCount() {
  Wire.beginTransmission(NT3H2111_ADDR);
  Wire.write(0x00);              // block select 0 (EEPROM)
  Wire.write(NFC_PAGE4_I2C_ADDR);
  Wire.endTransmission(false);
  Wire.requestFrom(NT3H2111_ADDR, (uint8_t)4);

  if (Wire.available() < 2) return 0;
  uint8_t lo = Wire.read();
  uint8_t hi = Wire.read();
  while (Wire.available()) Wire.read();  // drain
  return ((uint16_t)hi << 8) | lo;      // little-endian
}

void writeStrokeCount(uint16_t count) {
  Wire.beginTransmission(NT3H2111_ADDR);
  Wire.write(0x00);              // block select 0
  Wire.write(NFC_PAGE4_I2C_ADDR);
  Wire.write((uint8_t)(count & 0xFF));
  Wire.write((uint8_t)(count >> 8));
  Wire.write(0x00);
  Wire.write(0x00);
  Wire.endTransmission();
  delay(5);  // NT3H2111 EEPROM write time
}

// ── LIS3DH setup ───────────────────────────────────────────────────────────
void initLIS3DH() {
  // ODR=100Hz, all axes, normal power
  writeReg(LIS3DH_ADDR, LIS_CTRL_REG1, 0x57);
  // ±8g full-scale (gives enough headroom), high-res
  writeReg(LIS3DH_ADDR, LIS_CTRL_REG4, 0x28);
  // INT1 activity on INT1 pin
  writeReg(LIS3DH_ADDR, LIS_CTRL_REG3, 0x40);
  // Latch interrupt
  writeReg(LIS3DH_ADDR, LIS_CTRL_REG5, 0x08);
  // Threshold: (IMPACT_THRESHOLD_G * 1000) / 64 LSB for ±8g scale
  uint8_t ths = (uint8_t)((IMPACT_THRESHOLD_G * 1000UL) / 64);
  writeReg(LIS3DH_ADDR, LIS_INT1_THS, ths);
  // Duration: IMPACT_DURATION_MS / 10ms (at 100Hz, 1 LSB = 10ms)
  writeReg(LIS3DH_ADDR, LIS_INT1_DURATION, (uint8_t)(IMPACT_DURATION_MS / 10));
  // Enable high-event on any axis
  writeReg(LIS3DH_ADDR, LIS_INT1_CFG, 0x2A);
}

// ── ISR ────────────────────────────────────────────────────────────────────
ISR(INT0_vect) {   // PB2/INT0 for ATtiny85; use attachInterrupt for Uno
  impactDetected = true;
}

// ── Sleep ──────────────────────────────────────────────────────────────────
void goToSleep() {
  set_sleep_mode(SLEEP_MODE_PWR_DOWN);
  sleep_enable();
  sleep_cpu();
  sleep_disable();
}

// ── Setup ──────────────────────────────────────────────────────────────────
void setup() {
  Wire.begin();
  Wire.setClock(100000);  // 100 kHz I2C

  initLIS3DH();

  // Clear latched interrupt from LIS3DH
  readReg(LIS3DH_ADDR, LIS_INT1_SRC);

  // Configure INT pin (active-low interrupt from LIS3DH)
  pinMode(INT_PIN, INPUT_PULLUP);

  // ATtiny85: INT0 on PB2; Arduino Uno: use attachInterrupt(0, isr, FALLING)
#if defined(__AVR_ATtiny85__)
  MCUCR |= (1 << ISC01);  // falling edge
  GIMSK |= (1 << INT0);
#else
  attachInterrupt(digitalPinToInterrupt(INT_PIN), []() { impactDetected = true; }, FALLING);
#endif

  sei();

  // Ensure stroke count starts at 0 for a freshly loaded ball
  if (readStrokeCount() > MAX_STROKES) {
    writeStrokeCount(0);
  }
}

// ── Loop ───────────────────────────────────────────────────────────────────
void loop() {
  if (!impactDetected) {
    goToSleep();
    return;
  }

  impactDetected = false;

  // Clear the LIS3DH latched interrupt register so INT1 can fire again
  readReg(LIS3DH_ADDR, LIS_INT1_SRC);

  unsigned long now = millis();
  if (now - lastImpactMs < DEBOUNCE_MS) {
    return;  // ignore rapid bounces
  }
  lastImpactMs = now;

  uint16_t count = readStrokeCount();
  if (count < MAX_STROKES) {
    writeStrokeCount(count + 1);
  }
}
