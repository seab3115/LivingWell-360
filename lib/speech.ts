import * as Speech from "expo-speech";

export function speak(text: string): void {
  try {
    Speech.stop();
    Speech.speak(text, {
      rate: 0.95,
      pitch: 1.0,
      language: "en-US",
    });
  } catch {
    // Speech may be unavailable on some platforms (e.g. unsupported web browsers)
  }
}

export function stopSpeaking(): void {
  try {
    Speech.stop();
  } catch {
    // ignore
  }
}
