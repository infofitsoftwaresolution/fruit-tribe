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
    if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
        throw new Error('Missing required environment variable: JWT_SECRET');
    }
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
    // Note: `credentials: true` should not be combined with wildcard "*".
    const envOrigins = (process.env.ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    const defaultDevOrigins = ['http://localhost:5173', 'http://localhost:5174'];
    const allowList = new Set([...defaultDevOrigins, ...envOrigins]);
    app.enableCors({
        origin: (origin, callback) => {
            // Non-browser or same-origin requests may not send Origin.
            if (!origin) return callback(null, true);
            // Keep local dev smooth across different Vite ports.
            if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
                return callback(null, true);
            }
            if (allowList.has(origin)) return callback(null, true);
            return callback(new Error(`CORS blocked for origin: ${origin}`), false);
        },
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
