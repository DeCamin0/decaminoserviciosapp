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
  // Cache pentru eșecuri (coordonate -> timestamp) cu TTL de 1 oră (evită retry-uri repetate)
  private readonly failureCache = new Map<string, number>();
  // Cache pentru request-uri în curs (evită duplicate requests simultane)
  private readonly pendingRequests = new Map<string, Promise<string>>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 ore în milisecunde
  private readonly FAILURE_CACHE_TTL = 60 * 60 * 1000; // 1 oră pentru eșecuri
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
        this.logger.log(
          `✅ Address found in cache (age: ${Math.round(age / 1000)}s)`,
        );
        return cached.address;
      } else {
        // Cache expirat, ștergem
        this.addressCache.delete(cacheKey);
      }
    }

    return null;
  }

  /**
   * Verifică dacă coordonatele au eșuat recent (evită retry-uri repetate)
   */
  private hasRecentFailure(latitude: number, longitude: number): boolean {
    const cacheKey = this.getCacheKey(latitude, longitude);
    const failureTime = this.failureCache.get(cacheKey);

    if (failureTime) {
      const age = Date.now() - failureTime;
      if (age < this.FAILURE_CACHE_TTL) {
        this.logger.log(
          `⚠️ Recent failure cached for coordinates (age: ${Math.round(age / 1000)}s), skipping request`,
        );
        return true;
      } else {
        // Cache expirat, ștergem
        this.failureCache.delete(cacheKey);
      }
    }

    return false;
  }

  /**
   * Marchează coordonatele ca eșuate
   */
  private markAsFailed(latitude: number, longitude: number): void {
    const cacheKey = this.getCacheKey(latitude, longitude);
    this.failureCache.set(cacheKey, Date.now());

    // Cleanup periodic pentru failure cache
    if (this.failureCache.size > 500) {
      const now = Date.now();
      for (const [key, timestamp] of this.failureCache.entries()) {
        if (now - timestamp > this.FAILURE_CACHE_TTL) {
          this.failureCache.delete(key);
        }
      }
    }
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
   * Evită duplicate requests simultane pentru aceleași coordonate
   */
  async getAddressFromCoords(
    latitude: number,
    longitude: number,
  ): Promise<string> {
    // Validări
    if (latitude === null || latitude === undefined || isNaN(latitude)) {
      throw new BadRequestException(
        'Latitude is required and must be a valid number',
      );
    }

    if (longitude === null || longitude === undefined || isNaN(longitude)) {
      throw new BadRequestException(
        'Longitude is required and must be a valid number',
      );
    }

    // Validăm range-ul coordonatelor
    if (latitude < -90 || latitude > 90) {
      throw new BadRequestException('Latitude must be between -90 and 90');
    }

    if (longitude < -180 || longitude > 180) {
      throw new BadRequestException('Longitude must be between -180 and 180');
    }

    const cacheKey = this.getCacheKey(latitude, longitude);

    // Verificăm cache-ul primul
    const cachedAddress = this.getCachedAddress(latitude, longitude);
    if (cachedAddress) {
      return cachedAddress;
    }

    // Verificăm dacă există un request în curs pentru aceleași coordonate
    const pendingRequest = this.pendingRequests.get(cacheKey);
    if (pendingRequest) {
      this.logger.log(
        `⏳ Reusing pending request for coordinates: ${latitude}, ${longitude}`,
      );
      return pendingRequest;
    }

    // Verificăm dacă coordonatele au eșuat recent
    if (this.hasRecentFailure(latitude, longitude)) {
      return ''; // Returnăm string gol fără să facem request
    }

    // Creăm un nou request și îl adăugăm în pendingRequests
    const requestPromise = this.fetchAddressFromNominatim(latitude, longitude);
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const address = await requestPromise;
      return address;
    } finally {
      // Ștergem request-ul din pendingRequests după ce se termină
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Face request-ul efectiv către Nominatim
   */
  private async fetchAddressFromNominatim(
    latitude: number,
    longitude: number,
  ): Promise<string> {
    // Facem request către Nominatim
    const MAX_RETRIES = 2; // Redus la 2 încercări (mai rapid)
    const TIMEOUT = 8000; // Redus la 8 secunde (mai rapid, cache-ul va ajuta)

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
          this.logger.log(
            `✅ Address obtained from Nominatim: ${finalAddress}`,
          );
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
        // Verificăm dacă este eroare de timeout sau network
        const isTimeout =
          error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
        const isNetworkError =
          error.code === 'ECONNREFUSED' ||
          error.code === 'ENOTFOUND' ||
          !error.response;

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

    // Dacă toate încercările au eșuat, marchem ca eșuat
    this.markAsFailed(latitude, longitude);

    this.logger.warn(
      `⚠️ Could not get address from Nominatim after ${MAX_RETRIES} attempts. Returning empty string (coordinates will be shown).`,
    );

    // Returnăm string gol în loc să aruncăm eroare - permite continuarea aplicației
    // Frontend-ul va afișa coordonatele dacă adresa nu este disponibilă
    return '';
  }
}
