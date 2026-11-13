import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register/passenger')
  registerPassenger(@Body() body: any) { return this.auth.registerPassenger(body); }

  @Post('register/driver')
  registerDriver(@Body() body: any) { return this.auth.registerDriver(body); }

  @Post('register/fleet-manager')
  registerFleetManager(@Body() body: any) { return this.auth.registerFleetManager(body); }

  @Post('login')
  login(@Body() body: any) { return this.auth.login(body); }
}
