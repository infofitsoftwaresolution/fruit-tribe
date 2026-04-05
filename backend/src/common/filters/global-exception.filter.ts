import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const message =
            exception instanceof HttpException
                ? exception.getResponse()
                : 'Internal server error';

        // Log the error for observability (Amazon-style: Centralized Logging)
        this.logger.error(
            `${request.method} ${request.url} - Status: ${status} - Error: ${JSON.stringify(message)}`,
            exception instanceof Error ? exception.stack : '',
        );

        // Standardized Error Response (OWASP: Don't leak stack traces in prod)
        const msg = typeof message === 'string' ? message : (message as any).message;
        const messagePayload = Array.isArray(msg) ? msg.join('; ') : msg || 'Error occurred';
        const body =
            typeof message === 'object' && message !== null && typeof (message as any).email === 'string'
                ? { email: (message as any).email as string }
                : {};
        response.status(status).json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message: messagePayload,
            errorCode: (message as any).error || 'INTERNAL_ERROR',
            ...body,
        });
    }
}
