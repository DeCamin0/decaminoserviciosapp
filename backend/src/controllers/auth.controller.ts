import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Get,
  UseGuards,
} from '@nestjs/common';
import { LoginDto } from '../dto/login.dto';
import { AuthService } from '../services/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    try {
      console.log('[AuthController] Login request received:', {
        email: loginDto.email,
        hasPassword: !!loginDto.password,
      });
      
      const result = await this.authService.login(
        loginDto.email,
        loginDto.password,
      );

      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            message: result.error || 'Invalid credentials',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Return format compatible with frontend + JWT token
      return {
        success: true,
        user: result.user,
        accessToken: result.accessToken, // JWT token for future requests
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: error.message || 'Login failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser() user: any) {
    // This endpoint requires JWT token in Authorization header
    // Returns the current authenticated user
    return {
      success: true,
      user,
    };
  }
}
