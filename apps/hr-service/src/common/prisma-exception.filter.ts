import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '../../prisma/generated/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') return;

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      return response
        .status(exception.getStatus())
        .json(exception.getResponse());
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const status = this.prismaStatus(exception.code);
      return response.status(status).json({
        statusCode: status,
        message: this.prismaMessage(exception),
        error: HttpStatus[status],
      });
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      this.logger.error('PrismaClientValidationError', exception.message);
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid request data',
        error: 'Bad Request',
      });
    }

    this.logger.error(
      `Unhandled exception on ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
      error: 'Internal Server Error',
    });
  }

  private prismaStatus(code: string): number {
    switch (code) {
      case 'P2002':
        return HttpStatus.CONFLICT;
      case 'P2003':
      case 'P2014':
        return HttpStatus.BAD_REQUEST;
      case 'P2025':
        return HttpStatus.NOT_FOUND;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }

  private prismaMessage(e: Prisma.PrismaClientKnownRequestError): string {
    switch (e.code) {
      case 'P2002': {
        const fields = Array.isArray(e.meta?.target)
          ? (e.meta.target as string[]).join(', ')
          : 'field';
        return `A record with this ${fields} already exists`;
      }
      case 'P2003':
        return 'Related record not found';
      case 'P2025':
        return typeof e.meta?.cause === 'string'
          ? e.meta.cause
          : 'Record not found';
      default:
        return 'Database error';
    }
  }
}
