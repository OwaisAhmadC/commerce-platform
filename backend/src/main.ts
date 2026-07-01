import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);

  app.use(helmet());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin:
      configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000',
    credentials: true,
  });

  const port = configService.get<number>('PORT') ?? 4000;
  await app.listen(port);
}
bootstrap().catch((err: unknown) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
