import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Session, SessionData } from 'express-session';

type RequestWithSession = Request & {
  session: Session & Partial<SessionData>;
};

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithSession>();
    const res = context.switchToHttp().getResponse<Response>();

    if (req.session.adminUser) {
      return true;
    }

    res.redirect('/login');
    return false;
  }
}
