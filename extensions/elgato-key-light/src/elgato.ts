import axios from "axios";
import Bonjour, { RemoteService } from "bonjour";
import { waitUntil } from "./utils";
import { getPreferenceValues } from "@raycast/api";

const WARM_TEMPERATURE = 344; // 2900k
const COLD_TEMPERATURE = 143; // 7000k
const TEMPERATURE_STEP = (WARM_TEMPERATURE - COLD_TEMPERATURE) / 20; // 5%

interface Preferences {
  keyLights_count: string;
  keyLights_ips?: string; 
}

// Config for a single keylight
interface KeylightConfig {
  ip: string;
  port: number;
}

export class KeyLight {
  static keyLights: KeylightConfig[] = [];

  static async discover() {
    const preferences = getPreferenceValues<Preferences>();

    // Check if static IPs are provided
    if (preferences.keyLights_ips) {
      const ips = preferences.keyLights_ips.split(",").map((ip) => ip.trim());
      console.log(`🔧 Using static IPs: ${ips.join(", ")}`);

      KeyLight.keyLights = ips.map((ip) => ({ ip, port: 9123 }));
      return KeyLight;
    }

    // Otherwise, perform Bonjour discovery
    console.log("🔍 Discovering Key Lights using Bonjour...");
    const bonjour = Bonjour();
    KeyLight.keyLights = [];
    const count: number = parseInt(preferences.keyLights_count, 10);

    const find = new Promise<KeylightConfig[]>((resolve, reject) => {
      bonjour.find({ type: "elg" }, (service) => {
        if (service.referer?.address && service.port) {
          const keylightConfig: KeylightConfig = {
            ip: service.referer.address,
            port: service.port,
          };
          KeyLight.keyLights.push(keylightConfig);

          if (KeyLight.keyLights.length === count) {
            resolve(KeyLight.keyLights);
            bonjour.destroy();
          }
        }
      });

      setTimeout(() => {
        if (KeyLight.keyLights.length === 0) {
          reject(new Error("Cannot discover any Key Lights in the network"));
        }
      }, 5000);
    });

    return waitUntil(find);
  }

  static async toggle() {
    let newState;
    for (const keyLight of KeyLight.keyLights) {
      try {
        const state = await KeyLight.getKeyLight(keyLight);
        newState = !state.on;
        await KeyLight.updateKeyLight(keyLight, { on: newState });
      } catch (e) {
        throw new Error(`Failed toggling Key Light at ${keyLight.ip}`);
      }
    }
    return newState;
  }

  static async increaseBrightness() {
    let newBrightness;
    for (const keyLight of KeyLight.keyLights) {
      try {
        const state = await KeyLight.getKeyLight(keyLight);
        newBrightness = Math.min(state.brightness + 5, 100);
        await KeyLight.updateKeyLight(keyLight, { brightness: newBrightness });
      } catch (e) {
        throw new Error(`Failed increasing brightness for ${keyLight.ip}`);
      }
    }
    return newBrightness;
  }

  static async decreaseBrightness() {
    let newBrightness;
    for (const keyLight of KeyLight.keyLights) {
      try {
        const state = await KeyLight.getKeyLight(keyLight);
        newBrightness = Math.max(state.brightness - 5, 0);
        await KeyLight.updateKeyLight(keyLight, { brightness: newBrightness });
      } catch (e) {
        throw new Error(`Failed decreasing brightness for ${keyLight.ip}`);
      }
    }
    return newBrightness;
  }

  static async increaseTemperature() {
    let newTemperature;
    for (const keyLight of KeyLight.keyLights) {
      try {
        const state = await KeyLight.getKeyLight(keyLight);
        newTemperature = Math.min(state.temperature + TEMPERATURE_STEP, WARM_TEMPERATURE);
        await KeyLight.updateKeyLight(keyLight, { temperature: newTemperature });
      } catch (e) {
        throw new Error(`Failed increasing temperature for ${keyLight.ip}`);
      }
    }
    return newTemperature;
  }

  static async decreaseTemperature() {
    let newTemperature;
    for (const keyLight of KeyLight.keyLights) {
      try {
        const state = await KeyLight.getKeyLight(keyLight);
        newTemperature = Math.max(state.temperature - TEMPERATURE_STEP, COLD_TEMPERATURE);
        await KeyLight.updateKeyLight(keyLight, { temperature: newTemperature });
      } catch (e) {
        throw new Error(`Failed decreasing temperature for ${keyLight.ip}`);
      }
    }
    return newTemperature;
  }

  private static async getKeyLight(config: KeylightConfig) {
    const url = `http://${config.ip}:${config.port}/elgato/lights`;
    try {
      const response = await axios.get(url);
      return response.data.lights[0];
    } catch (error) {
      throw new Error(`Failed to fetch Key Light state from ${url}`);
    }
  }

  private static async updateKeyLight(
    config: KeylightConfig,
    options: { brightness?: number; temperature?: number; on?: boolean },
  ) {
    const url = `http://${config.ip}:${config.port}/elgato/lights`;
    try {
      await axios.put(url, {
        lights: [{ ...options }],
      });
    } catch (error) {
      throw new Error(`Failed to update Key Light state at ${url}`);
    }
  }
}
