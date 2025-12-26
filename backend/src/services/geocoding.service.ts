import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';

interface CachedAddress {
  address: string;
  timestamp: number;
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
  // Cache pentru adrese (coordonate -> adresă) cu TTL de 24 ore
  private readonly addressCache = new Map<string, CachedAddress>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 ore în milisecunde
  private readonly CACHE_PRECISION = 4; // 4 zecimale = ~11 metri precizie

  /**
   * Generează cheia de cache pentru coordonate (rotunjite la precizie)
   */
  private getCacheKey(latitude: number, longitude: number): string {
    const latRounded = latitude.toFixed(this.CACHE_PRECISION);
    const lonRounded = longitude.toFixed(this.CACHE_PRECISION);
    return `${latRounded},${lonRounded}`;
  }

  /**
   * Verifică dacă există adresă în cache
   */
  private getCachedAddress(latitude: number, longitude: number): string | null {
    const cacheKey = this.getCacheKey(latitude, longitude);
    const cached = this.addressCache.get(cacheKey);

    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.CACHE_TTL) {
        this.logger.log(`✅ Address found in cache (age: ${Math.round(age / 1000)}s)`);
        return cached.address;
      } else {
        // Cache expirat, ștergem
        this.addressCache.delete(cacheKey);
      }
    }

    return null;
  }

  /**
   * Salvează adresa în cache
   */
  private setCachedAddress(
    latitude: number,
    longitude: number,
    address: string,
  ): void {
    if (!address || address.trim() === '') {
      return; // Nu cache-ăm adrese goale
    }

    const cacheKey = this.getCacheKey(latitude, longitude);
    this.addressCache.set(cacheKey, {
      address,
      timestamp: Date.now(),
    });

    // Cleanup periodic: ștergem cache-ul expirat (max 1000 de intrări)
    if (this.addressCache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of this.addressCache.entries()) {
        if (now - value.timestamp > this.CACHE_TTL) {
          this.addressCache.delete(key);
        }
      }
    }
  }

  /**
   * Obține adresa completă din coordonate (reverse geocoding)
   * Folosește cache pentru coordonatele recente și Nominatim API cu retry logic
   */
  async getAddressFromCoords(
    latitude: number,
    longitude: number,
  ): Promise<string> {
    // Validări
    if (latitude === null || latitude === undefined || isNaN(latitude)) {
      throw new BadRequestException('Latitude is required and must be a valid number');
    }

    if (longitude === null || longitude === undefined || isNaN(longitude)) {
      throw new BadRequestException('Longitude is required and must be a valid number');
    }

    // Validăm range-ul coordonatelor
    if (latitude < -90 || latitude > 90) {
      throw new BadRequestException('Latitude must be between -90 and 90');
    }

    if (longitude < -180 || longitude > 180) {
      throw new BadRequestException('Longitude must be between -180 and 180');
    }

    // Verificăm cache-ul primul
    const cachedAddress = this.getCachedAddress(latitude, longitude);
    if (cachedAddress) {
      return cachedAddress;
    }

    // Dacă nu e în cache, facem request către Nominatim
    const MAX_RETRIES = 2; // Redus la 2 încercări (mai rapid)
    const TIMEOUT = 10000; // Redus la 10 secunde (mai rapid, cache-ul va ajuta)
    let lastError: any = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const url = `${this.NOMINATIM_BASE_URL}/reverse`;
        const params = {
          format: 'json',
          lat: latitude.toString(),
          lon: longitude.toString(),
          zoom: 18,
          addressdetails: 1,
        };

        this.logger.log(
          `🌍 Requesting address from Nominatim (attempt ${attempt + 1}/${MAX_RETRIES}) for coordinates: ${latitude}, ${longitude}`,
        );

        // Facem request către Nominatim cu User-Agent header (cerință Nominatim)
        const response = await axios.get(url, {
          params,
          headers: {
            'User-Agent': 'DeCaminoServiciosApp/1.0',
          },
          timeout: TIMEOUT,
        });

        if (!response.data) {
          this.logger.warn('⚠️ Nominatim returned empty response');
          return '';
        }

        const data = response.data;

        // Prioritate 1: display_name (adresa completă)
        let finalAddress = '';
        if (data.display_name) {
          finalAddress = data.display_name;
          this.logger.log(`✅ Address obtained from Nominatim: ${finalAddress}`);
        } else if (data.address) {
          // Prioritate 2: construim adresa din componente
          const addr = data.address;
          const parts = [];

          if (addr.road) parts.push(addr.road);
          if (addr.house_number) parts.push(addr.house_number);
          if (addr.city || addr.town || addr.village) {
            parts.push(addr.city || addr.town || addr.village);
          }
          if (addr.state || addr.region) parts.push(addr.state || addr.region);
          if (addr.postcode) parts.push(addr.postcode);
          if (addr.country) parts.push(addr.country);

          if (parts.length > 0) {
            finalAddress = parts.join(', ');
            this.logger.log(
              `✅ Address constructed from components: ${finalAddress}`,
            );
          }
        }

        // Dacă am obținut adresă, o salvăm în cache
        if (finalAddress && finalAddress.trim() !== '') {
          this.setCachedAddress(latitude, longitude, finalAddress);
          return finalAddress;
        }

        this.logger.warn('⚠️ No address found in Nominatim response');
        return '';
      } catch (error: any) {
        lastError = error;

        // Verificăm dacă este eroare de timeout sau network
        const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
        const isNetworkError = error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || !error.response;

        if (isTimeout || isNetworkError) {
          this.logger.warn(
            `⚠️ Nominatim request failed (attempt ${attempt + 1}/${MAX_RETRIES}): ${error.message || error.code}`,
          );

          // Dacă nu e ultima încercare, așteptăm înainte de retry
          if (attempt < MAX_RETRIES - 1) {
            const delay = 500; // Delay scurt (500ms) pentru retry rapid
            this.logger.log(`⏳ Retrying in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue; // Retry
          }
        } else {
          // Eroare HTTP sau altă eroare - nu retry
          this.logger.error('❌ Error getting address from Nominatim:', error);
          break;
        }
      }
    }

    // Dacă toate încercările au eșuat
    this.logger.warn(
      `⚠️ Could not get address from Nominatim after ${MAX_RETRIES} attempts. Returning empty string (coordinates will be shown).`,
    );

    // Returnăm string gol în loc să aruncăm eroare - permite continuarea aplicației
    // Frontend-ul va afișa coordonatele dacă adresa nu este disponibilă
    return '';
  }
}

