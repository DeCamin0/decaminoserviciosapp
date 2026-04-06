import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';

interface CachedAddress {
  address: string;
  timestamp: number;
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly NOMINATIM_BASE_URL =
    process.env.NOMINATIM_BASE_URL?.trim() ||
    'https://nominatim.openstreetmap.org';
  /** Photon (OSM) — a doua sursă gratuită dacă Nominatim eșuează. */
  private readonly PHOTON_BASE_URL =
    process.env.PHOTON_GEOCODING_URL?.trim() || 'https://photon.komoot.io';
  /** User-Agent identificabil (politica Nominatim). */
  private readonly GEO_HTTP_HEADERS = {
    'User-Agent':
      process.env.NOMINATIM_USER_AGENT?.trim() ||
      'DeCaminoServiciosApp/1.0 (geocoding; contact: info@decaminoservicios.com)',
    Accept: 'application/json',
  } as const;
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
    const requestPromise = this.fetchAddressWithFallbacks(latitude, longitude);
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
   * Nominatim → Photon (gratuit) → Google Geocoding (doar dacă GOOGLE_GEOCODING_API_KEY).
   * markAsFailed doar dacă toate sursele eșuează.
   */
  private async fetchAddressWithFallbacks(
    latitude: number,
    longitude: number,
  ): Promise<string> {
    const nominatim = await this.tryNominatimReverse(latitude, longitude);
    if (nominatim) {
      this.setCachedAddress(latitude, longitude, nominatim);
      return nominatim;
    }

    this.logger.warn(
      `⚠️ Nominatim: no address for ${latitude},${longitude} — trying Photon`,
    );
    const photon = await this.tryPhotonReverse(latitude, longitude);
    if (photon) {
      this.setCachedAddress(latitude, longitude, photon);
      this.logger.log(`✅ Address from Photon: ${photon}`);
      return photon;
    }

    const googleKey = process.env.GOOGLE_GEOCODING_API_KEY?.trim();
    if (googleKey) {
      this.logger.warn(
        `⚠️ Photon: no address — trying Google Geocoding (paid key present)`,
      );
      const googleAddr = await this.tryGoogleReverse(
        latitude,
        longitude,
        googleKey,
      );
      if (googleAddr) {
        this.setCachedAddress(latitude, longitude, googleAddr);
        this.logger.log(`✅ Address from Google: ${googleAddr}`);
        return googleAddr;
      }
    }

    this.markAsFailed(latitude, longitude);
    this.logger.warn(
      `⚠️ All reverse geocoding providers failed for ${latitude},${longitude}`,
    );
    return '';
  }

  private async tryNominatimReverse(
    latitude: number,
    longitude: number,
  ): Promise<string> {
    const MAX_RETRIES = 2;
    const TIMEOUT = 8000;

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
          `🌍 Nominatim reverse (attempt ${attempt + 1}/${MAX_RETRIES}): ${latitude}, ${longitude}`,
        );

        const response = await axios.get(url, {
          params,
          headers: { ...this.GEO_HTTP_HEADERS },
          timeout: TIMEOUT,
        });

        if (!response.data) {
          this.logger.warn('⚠️ Nominatim returned empty response');
          return '';
        }

        const data = response.data;
        let finalAddress = '';
        if (data.display_name) {
          finalAddress = data.display_name;
        } else if (data.address) {
          const addr = data.address;
          const parts: string[] = [];
          if (addr.road) parts.push(addr.road);
          if (addr.house_number) parts.push(addr.house_number);
          if (addr.city || addr.town || addr.village) {
            parts.push(addr.city || addr.town || addr.village);
          }
          if (addr.state || addr.region) parts.push(addr.state || addr.region);
          if (addr.postcode) parts.push(addr.postcode);
          if (addr.country) parts.push(addr.country);
          if (parts.length > 0) finalAddress = parts.join(', ');
        }

        if (finalAddress.trim() !== '') {
          return finalAddress.trim();
        }

        this.logger.warn('⚠️ No address in Nominatim response');
        return '';
      } catch (error: any) {
        const isTimeout =
          error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
        const isNetworkError =
          error.code === 'ECONNREFUSED' ||
          error.code === 'ENOTFOUND' ||
          !error.response;

        if (isTimeout || isNetworkError) {
          this.logger.warn(
            `⚠️ Nominatim failed (attempt ${attempt + 1}/${MAX_RETRIES}): ${error.message || error.code}`,
          );
          if (attempt < MAX_RETRIES - 1) {
            await new Promise((r) => setTimeout(r, 500));
            continue;
          }
        } else {
          this.logger.error('❌ Nominatim error:', error?.message || error);
          break;
        }
      }
    }
    return '';
  }

  /** Photon reverse — fără cheie; folosiți rezonabil (fair use Komoot). */
  private async tryPhotonReverse(
    latitude: number,
    longitude: number,
  ): Promise<string> {
    const TIMEOUT = 7000;
    try {
      const url = `${this.PHOTON_BASE_URL.replace(/\/$/, '')}/reverse`;
      const response = await axios.get(url, {
        params: { lat: latitude, lon: longitude, lang: 'es' },
        headers: { ...this.GEO_HTTP_HEADERS },
        timeout: TIMEOUT,
      });

      const features = response.data?.features;
      if (!Array.isArray(features) || features.length === 0) {
        return '';
      }

      const props = features[0]?.properties;
      if (!props || typeof props !== 'object') return '';

      const line = this.formatPhotonAddress(props as Record<string, unknown>);
      return line.trim() !== '' ? line : '';
    } catch (error: any) {
      this.logger.warn(
        `⚠️ Photon reverse failed: ${error?.message || error?.code || error}`,
      );
      return '';
    }
  }

  private formatPhotonAddress(p: Record<string, unknown>): string {
    const parts: string[] = [];
    const street =
      (p.street && String(p.street).trim()) ||
      (p.name && String(p.name).trim());
    const hn = p.housenumber && String(p.housenumber).trim();
    if (street) {
      parts.push(hn ? `${street} ${hn}` : street);
    }
    const city =
      (p.city && String(p.city).trim()) ||
      (p.town && String(p.town).trim()) ||
      (p.district && String(p.district).trim());
    if (city) parts.push(city);
    if (p.state) parts.push(String(p.state).trim());
    if (p.postcode) parts.push(String(p.postcode).trim());
    if (p.country) parts.push(String(p.country).trim());
    return parts.filter(Boolean).join(', ');
  }

  private async tryGoogleReverse(
    latitude: number,
    longitude: number,
    apiKey: string,
  ): Promise<string> {
    const TIMEOUT = 8000;
    try {
      const url = 'https://maps.googleapis.com/maps/api/geocode/json';
      const response = await axios.get(url, {
        params: {
          latlng: `${latitude},${longitude}`,
          key: apiKey,
          language: 'es',
        },
        headers: { Accept: 'application/json' },
        timeout: TIMEOUT,
      });

      const status = response.data?.status;
      if (status !== 'OK' || !response.data?.results?.length) {
        this.logger.warn(`⚠️ Google Geocoding status: ${status || 'unknown'}`);
        return '';
      }

      const formatted = response.data.results[0]?.formatted_address;
      return formatted && String(formatted).trim() !== ''
        ? String(formatted).trim()
        : '';
    } catch (error: any) {
      this.logger.warn(
        `⚠️ Google reverse failed: ${error?.message || error?.code || error}`,
      );
      return '';
    }
  }

  /**
   * Autocompletare adrese (forward geocoding) - returnează sugestii de adrese
   * Folosește Nominatim Search API cu parametri optimizați pentru precizie
   */
  async searchAddresses(
    query: string,
    limit: number = 5,
  ): Promise<
    Array<{
      display_name: string;
      lat: string;
      lon: string;
      postcode?: string;
      address?: any;
    }>
  > {
    if (!query || query.trim() === '') {
      return [];
    }

    try {
      const url = `${this.NOMINATIM_BASE_URL}/search`;
      const params = {
        q: query.trim(),
        format: 'json',
        limit: limit.toString(),
        addressdetails: 1,
        countrycodes: 'es', // Limitează la Spania
        extratags: 1, // Include tag-uri suplimentare pentru mai multă precizie
        namedetails: 1, // Include detalii despre nume
      };

      this.logger.log(`🔍 Searching addresses for query: "${query}"`);

      const response = await axios.get(url, {
        params,
        headers: { ...this.GEO_HTTP_HEADERS },
        timeout: 5000,
      });

      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }

      const results = response.data.map((item: any) => ({
        display_name: item.display_name || '',
        lat: item.lat || '',
        lon: item.lon || '',
        postcode: item.address?.postcode || '',
        address: item.address || {},
      }));

      this.logger.log(
        `✅ Found ${results.length} address suggestions for "${query}"`,
      );

      return results;
    } catch (error: any) {
      this.logger.warn(
        `⚠️ Error searching addresses for "${query}": ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Obține adresa completă și precisă folosind coordonatele (reverse geocoding)
   * Folosește această metodă după selectarea unei adrese pentru a obține codul poștal corect
   * Folosește zoom=18 pentru precizie maximă și accept-language=es pentru formatare în spaniolă
   */
  async getAddressFromCoordinates(
    lat: string,
    lon: string,
  ): Promise<{
    display_name: string;
    postcode?: string;
    address?: any;
  } | null> {
    try {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);

      if (isNaN(latitude) || isNaN(longitude)) {
        return null;
      }

      // Facem reverse geocoding cu parametri optimizați pentru precizie
      const url = `${this.NOMINATIM_BASE_URL}/reverse`;
      const params = {
        format: 'json',
        lat: lat,
        lon: lon,
        zoom: 18, // Precizie maximă pentru adrese
        addressdetails: 1,
        'accept-language': 'es', // Formatare în spaniolă
        extratags: 1, // Include tag-uri suplimentare
      };

      const response = await axios.get(url, {
        params,
        headers: { ...this.GEO_HTTP_HEADERS },
        timeout: 5000,
      });

      if (response.data) {
        const addr = response.data.address || {};
        let displayName = response.data.display_name || '';

        // Construim adresa formatată manual pentru a controla ordinea componentelor
        // Format: "Calle, Număr, Cod Poștal, Localitate, Provincie, Țară"
        const parts = [];

        if (addr.road || addr.pedestrian) {
          parts.push(addr.road || addr.pedestrian);
        }
        if (addr.house_number) {
          parts.push(addr.house_number);
        }
        if (addr.postcode) {
          parts.push(addr.postcode);
        }
        if (addr.city || addr.town || addr.village || addr.municipality) {
          parts.push(
            addr.city || addr.town || addr.village || addr.municipality,
          );
        }
        if (addr.state || addr.region) {
          parts.push(addr.state || addr.region);
        }
        if (addr.country) {
          parts.push(addr.country);
        }

        // Dacă am construit manual adresa, o folosim; altfel folosim display_name
        if (parts.length > 0) {
          displayName = parts.join(', ');
        }

        this.logger.log(
          `✅ Address from coordinates: ${displayName} (postcode: ${addr.postcode || 'N/A'})`,
        );

        return {
          display_name: displayName,
          postcode: addr.postcode || '',
          address: addr,
        };
      }

      return null;
    } catch (error: any) {
      this.logger.warn(
        `⚠️ Error getting address from coordinates: ${error.message}`,
      );
      return null;
    }
  }
}
