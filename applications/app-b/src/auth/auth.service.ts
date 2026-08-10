import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly authServerUrl = 'http://localhost:3000';
  private readonly clientId = 'edunek-client'; // Client ID App B
  private readonly redirectUri = 'http://localhost:3002/auth/callback'; // Port 3002
  private readonly codeVerifier = 'test';

  async exchangeCodeAndGetProfile(code: string) {
    const tokenResponse = await fetch(`${this.authServerUrl}/auth/token`, {
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

    const profileResponse = await fetch(`${this.authServerUrl}/auth/userinfo`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

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
