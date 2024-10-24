import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { jwtDecode } from 'jwt-decode';
import { Observable } from 'rxjs';
interface AuthenticatedRequest extends Request {
  user: {
    keycloak_id: string;
    // other properties
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<AuthenticatedRequest>();

    // Check if Authorization header is present
    const authHeader = request.header('authorization');
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is missing');
    }

    // Split and validate the Bearer token format
    const [bearer, token] = authHeader.split(' ');
    if (bearer.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Bearer token not found or invalid');
    }

    // Decode and validate the token
    const decoded = this.verifyToken(token);

    // Check for keycloak_id in token payload (subject)
    if (!decoded?.sub) {
      throw new UnauthorizedException('Invalid token: keycloak_id missing');
    }

    // Check token expiry
    if (Date.now() >= decoded.exp * 1000) {
      throw new UnauthorizedException('Token has expired');
    }

    request.user = {
      keycloak_id: decoded.sub,
      ...decoded,
    };

    return true; // Token is valid
  }

  // Verify the token and return decoded value
  private verifyToken(token: string): any {
    try {
      const decoded = jwtDecode(token);
      return decoded;
    } catch (err) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
