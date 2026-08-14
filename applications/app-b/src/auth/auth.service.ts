import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly authServerUrl = 'http://localhost:3000';
  private readonly clientId = 'edunek-client'; // Sesuaikan dengan database
  private readonly redirectUri = 'http://localhost:3002/auth/callback';

  // Verifier statis sementara untuk testing (idealnya digenerate dinamis per sesi login)
  private readonly codeVerifier = 'test';

  async exchangeCodeAndGetProfile(code: string) {
    // Sesuaikan URL untuk komunikasi peladen-ke-peladen di dalam jaringan Docker
    const internalAuthServerUrl = this.authServerUrl.replace(
      'localhost',
      'host.docker.internal',
    );

    // 1. Tukarkan Code dengan Access Token
    const tokenResponse = await fetch(`${internalAuthServerUrl}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        code: code,
        code_verifier: this.codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      throw new UnauthorizedException('Gagal menukarkan authorization code');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. Gunakan Access Token untuk mengambil profil user
    const profileResponse = await fetch(
      `${internalAuthServerUrl}/auth/userinfo`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!profileResponse.ok) {
      throw new UnauthorizedException('Gagal mengambil profil pengguna');
    }

    const userProfile = await profileResponse.json();

    return {
      accessToken,
      userProfile,
    };
  }
}
