import {
  Controller,
  Get,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GeocodingService } from '../services/geocoding.service';

@Controller('api/geocoding')
export class GeocodingController {
  private readonly logger = new Logger(GeocodingController.name);

  constructor(private readonly geocodingService: GeocodingService) {}

  @Get('reverse')
  @UseGuards(JwtAuthGuard)
  async reverseGeocode(
    @Query('lat') lat: string,
    @Query('lon') lon: string,
  ) {
    try {
      this.logger.log(
        `📝 Reverse geocode request - lat: ${lat || 'missing'}, lon: ${lon || 'missing'}`,
      );

      if (!lat || !lon) {
        throw new BadRequestException('lat and lon query parameters are required');
      }

      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);

      if (isNaN(latitude) || isNaN(longitude)) {
        throw new BadRequestException('lat and lon must be valid numbers');
      }

      const address = await this.geocodingService.getAddressFromCoords(
        latitude,
        longitude,
      );

      // Dacă adresa este goală (timeout sau eroare), returnăm coordonatele
      // Frontend-ul va afișa coordonatele dacă adresa nu este disponibilă
      if (!address || address.trim() === '') {
        this.logger.warn(
          `⚠️ Address not available for coordinates: ${latitude}, ${longitude}. Returning coordinates.`,
        );
        return {
          success: false,
          address: '',
          coordinates: {
            latitude,
            longitude,
          },
          message: 'No se pudo obtener la dirección. Se muestran las coordenadas.',
        };
      }

      return {
        success: true,
        address: address,
        coordinates: {
          latitude,
          longitude,
        },
      };
    } catch (error: any) {
      this.logger.error('❌ Error in reverse geocode:', error);

      // Dacă este BadRequestException pentru validare, o aruncăm
      if (error instanceof BadRequestException) {
        // Verificăm dacă este eroare de validare (nu de timeout)
        const errorMessage = error.message || '';
        if (
          errorMessage.includes('required') ||
          errorMessage.includes('must be') ||
          errorMessage.includes('between')
        ) {
          throw error; // Aruncă erorile de validare
        }
      }

      // Pentru alte erori (timeout, network), returnăm coordonatele
      // Extragem coordonatele din query params dacă sunt disponibile
      try {
        const latitude = parseFloat(lat || '0');
        const longitude = parseFloat(lon || '0');

        if (!isNaN(latitude) && !isNaN(longitude)) {
          return {
            success: false,
            address: '',
            coordinates: {
              latitude,
              longitude,
            },
            message: 'No se pudo obtener la dirección. Se muestran las coordenadas.',
          };
        }
      } catch {
        // Ignorăm erorile de parsing
      }

      // Dacă nu putem returna coordonatele, aruncăm eroarea originală
      throw error;
    }
  }
}

