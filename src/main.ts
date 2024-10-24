import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  VERSION_NEUTRAL,
  VersioningType,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ResponseInterceptor } from './common/Interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: VERSION_NEUTRAL,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true, // Automatically transforms payloads to be objects typed according to their DTO classes
      transformOptions: {
        enableImplicitConversion: true,
      },
      validationError: {
        target: false,
        value: false,
      },
      exceptionFactory: (errors) => {
        // Customize the error response format
        const messages = errors.map(
          (error) =>
            `${error.property} - ${Object.values(error.constraints).join(
              ', ',
            )}`,
        );
        return new BadRequestException(messages);
      },
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Configure Swagger
  const config = new DocumentBuilder()
    .setTitle('UBI Beneficiary API')
    .setDescription('API documentation for UBI Beneficiary')
    .setVersion('1.0')
    .addServer('/api')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your Bearer token in the format: Bearer {token}',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/docs', app, document); // Route for Swagger UI

  await app.listen(process.env.PORT);
}
bootstrap();
