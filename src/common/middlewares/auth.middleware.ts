import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { jwtDecode } from 'jwt-decode';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor() { }

  async use(req: any, res: Response, next: NextFunction) {
    req.mw_roles = [];
    req.mw_userid = null;

    if (req.headers.authorization) {
      let bearerToken = null;
      let bearerTokenTemp = null;

      // Get userid from  auth/login jwt token
      const authToken = req?.headers?.authorization;
      const authTokenTemp = req?.headers?.authorization.split(' ');

      // If Bearer word not found in auth header value
      if (authTokenTemp[0] !== 'Bearer') {
        req.mw_userid = null;
      }
      // Get trimmed Bearer token value by skipping Bearer value
      else {
        bearerToken = authToken.trim().substr(7, authToken.length).trim();
      }

      // If Bearer token value is not passed
      if (!bearerToken) {
        req.mw_userid = null;
      }
      // Lets split token by dot (.)
      else {
        bearerTokenTemp = bearerToken.split('.');
      }

      // Since JWT has three parts - seperated by dots(.), lets split token
      if (bearerTokenTemp.length < 3) {
        req.mw_userid = null;
      }

      const decoded: any = jwtDecode(authToken);
      let keycloak_id = decoded.sub;

      // If keycloak_id is not found in token payload (subject)
      if (!keycloak_id) {
        req.mw_userid = null;
        throw new Error('User not found');
      }

      const roles = decoded.resource_access.hasura.roles ?? [];
      req.mw_roles = roles;
      req.mw_userid = keycloak_id;
    }

    next();
  }
}
