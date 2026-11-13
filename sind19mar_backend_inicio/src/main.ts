import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET es obligatorio en producción.');
  }
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const origins = (process.env.CORS_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
  app.enableCors({ origin: origins.length ? origins : false });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}
bootstrap();
