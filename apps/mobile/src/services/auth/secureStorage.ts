import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const AUTH_TOKEN_KEY = 'vibemint_mobile_auth_token';

// In-memory fallback if secure storage is unavailable (e.g. web preview)
let memoryToken: string | null = null;

export const secureStorage = {
  /**
   * Retrieves the secure authentication token.
   */
  async getToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return memoryToken;
      }
      return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    } catch {
      return memoryToken;
    }
  },

  /**
   * Saves the authentication token into secure hardware-backed storage (iOS Keychain / Android Keystore).
   */
  async setToken(token: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        memoryToken = token;
        return;
      }
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      });
    } catch {
      memoryToken = token;
    }
  },

  /**
   * Deletes the authentication token from secure storage.
   */
  async removeToken(): Promise<void> {
    try {
      memoryToken = null;
      if (Platform.OS !== 'web') {
        await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      }
    } catch {
      memoryToken = null;
    }
  },
};
