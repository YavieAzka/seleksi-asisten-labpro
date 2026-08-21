import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import * as crypto from 'crypto';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { NestExpressApplication } from '@nestjs/platform-express';

function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

describe('Auth Provider Server E2E (F02-F05, B03)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.use(cookieParser());
    
    app.setBaseViewsDir(join(process.cwd(), 'views'));
    app.setViewEngine('ejs');

    await app.init();
    
    prisma = app.get(PrismaService);
    
    // Seed dummy data for tests
    const passwordHash = await bcrypt.hash('Mahasiswa123!', 10);
    const user = await prisma.user.upsert({
      where: { email: '13524001@mahasiswa.itb.ac.id' },
      update: { passwordHash },
      create: {
        name: 'Mahasiswa Test',
        email: '13524001@mahasiswa.itb.ac.id',
        passwordHash,
        status: 'active',
      }
    });

    const group = await prisma.group.upsert({
      where: { name: 'Mahasiswa' },
      update: {},
      create: { name: 'Mahasiswa', description: 'Test Group' }
    });

    await prisma.userGroup.upsert({
      where: { userId_groupId: { userId: user.id, groupId: group.id } },
      update: {},
      create: { userId: user.id, groupId: group.id }
    });

    const appClient = await prisma.application.upsert({
      where: { clientId: 'sieks-client' },
      update: {},
      create: {
        name: 'SiEks',
        clientId: 'sieks-client',
        status: 'active',
        launchUrl: 'http://localhost:3001',
        logoutNotificationUrl: 'http://localhost:3001/internal/logout',
      }
    });
    
    const existingUri = await prisma.applicationRedirectUri.findFirst({
      where: { applicationId: appClient.id, redirectUri: 'http://localhost:3001/auth/callback' }
    });
    if (!existingUri) {
      await prisma.applicationRedirectUri.create({
        data: { applicationId: appClient.id, redirectUri: 'http://localhost:3001/auth/callback' }
      });
    }

    await prisma.applicationGroupPolicy.upsert({
      where: { applicationId_groupId_effect: { applicationId: appClient.id, groupId: group.id, effect: 'allow' } },
      update: {},
      create: { applicationId: appClient.id, groupId: group.id, effect: 'allow' }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('B03 - Health Checks', () => {
    it('/health/live (GET) should return 200 alive', () => {
      return request(app.getHttpServer())
        .get('/health/live')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toEqual('alive');
        });
    });

    it('/health/ready (GET) should check dependencies', async () => {
      const res = await request(app.getHttpServer()).get('/health/ready');
      if (res.status === 200) {
        expect(res.body.status).toEqual('ready');
      } else {
        expect(res.status).toEqual(503);
      }
    });
  });

  describe('F02, F03, F04, F05 - SSO Flows', () => {
    let sessionCookie: string;
    let authCode: string;
    const clientId = 'sieks-client';
    const redirectUri = 'http://localhost:3001/auth/callback';
    const pkce = generatePKCE();

    it('1. GET /auth/login-page should return 200 OK', () => {
      return request(app.getHttpServer())
        .get(`/auth/login-page?client_id=${clientId}&redirect_uri=${redirectUri}&state=123&code_challenge=${pkce.challenge}&code_challenge_method=S256`)
        .expect(200);
    });

    it('2. POST /auth/login should authenticate and set session cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: '13524001@mahasiswa.itb.ac.id',
          password: 'Mahasiswa123!',
          client_id: clientId,
          redirect_uri: redirectUri,
          state: '123',
          code_challenge: pkce.challenge,
          code_challenge_method: 'S256',
        })
        .expect(302); // Should redirect to /consent or directly to app

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      
      const sessionStr = cookies.find((c: string) => c.startsWith('sso_session='));
      expect(sessionStr).toBeDefined();
      
      sessionCookie = sessionStr.split(';')[0];
    });

    it('3. GET /auth/authorize should generate auth code', async () => {
      const res = await request(app.getHttpServer())
        .get(`/auth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&state=123&code_challenge=${pkce.challenge}&code_challenge_method=S256`)
        .set('Cookie', sessionCookie)
        .expect(302);

      const location = res.headers['location'];
      expect(location).toContain('code=');
      
      const url = new URL(location);
      authCode = url.searchParams.get('code') as string;
      expect(authCode).toBeDefined();
    });

    it('4. POST /auth/token should exchange code for access token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/token')
        .send({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: redirectUri,
          client_id: clientId,
          code_verifier: pkce.verifier,
        })
        .expect(200);

      expect(res.body.access_token).toBeDefined();
    });

    it('5. GET /auth/logout should revoke session', async () => {
      await request(app.getHttpServer())
        .get('/auth/logout')
        .set('Cookie', sessionCookie)
        .expect(302);
      
      // Try to access a protected page with revoked cookie, should redirect to login
      await request(app.getHttpServer())
        .get(`/auth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}`)
        .set('Cookie', sessionCookie)
        .expect(302)
        .expect('Location', /\/auth\/login-page/);
    });
  });
});
