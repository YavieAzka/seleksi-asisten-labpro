import 'express-session';

declare module 'express-session' {
  interface SessionData {
    adminUser?: {
      id: string;
      name: string;
      email: string;
    };
  }
}
