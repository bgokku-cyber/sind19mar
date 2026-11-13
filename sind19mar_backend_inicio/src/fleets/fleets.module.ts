import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FleetsController } from './fleets.controller';
import { FleetsService } from './fleets.service';

@Module({ imports: [AuthModule], controllers: [FleetsController], providers: [FleetsService] })
export class FleetsModule {}
