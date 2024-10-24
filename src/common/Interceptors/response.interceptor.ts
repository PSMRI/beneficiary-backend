import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Response } from 'express';
import { SuccessResponse } from '../responses/success-response';
import { ErrorResponse } from '../responses/error-response';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        if (data instanceof ErrorResponse) {
          const errorResponse = {
            statusCode: data.statusCode,
            error: data.errorMessage,
          };
          response.status(data.statusCode).json(errorResponse);
          return of(null);
        } else if (data instanceof SuccessResponse) {
          const successResponse = {
            statusCode: data.statusCode,
            message: data.message,
            data: data.data,
          };
          response.status(data.statusCode).json(successResponse);
          return of(null);
        }
        return data; // Return any unknown type as is
      }),
      catchError((err) => {
        // Handle errors thrown in the controller
        response.status(err.status || 500).json({
          statusCode: err.status || 500,
          error: err.message || 'Internal server error',
        });
        return of(null); // Prevent further processing
      }),
    );
  }
}
