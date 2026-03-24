import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import helmet from 'helmet';
import { join } from 'path';

async function bootstrap() {
    const logger = new Logger('Bootstrap');
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // Serve Static Assets (Uploads)
    app.useStaticAssets(join(process.cwd(), 'uploads'), {
        prefix: '/uploads/',
    });

    // Security headers; allow cross-origin static image loading from /uploads.
    app.use(
        helmet({
            crossOriginResourcePolicy: false,
            crossOriginEmbedderPolicy: false,
        }),
    );

    // CORS Configuration
    app.enableCors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
    });

    // API Versioning (Requirement: v1)
    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
    });

    // Global Pipes (Validation)
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    // Global Exception Filter
    app.useGlobalFilters(new GlobalExceptionFilter());

    // Global Interceptors
    app.useGlobalInterceptors(new LoggingInterceptor());

    // Swagger Documentation
    const config = new DocumentBuilder()
        .setTitle('The Fruit Tribe API')
        .setDescription('Production-grade Multi-vendor E-commerce API')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    const port = process.env.PORT || 3000;
    await app.listen(port);
    logger.log(`Application is running on: http://localhost:${port}/v1`);
    logger.log(`Swagger Docs: http://localhost:${port}/api/docs`);
}
bootstrap();
