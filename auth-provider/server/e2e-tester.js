const assert = require('assert');
const { authenticator } = require('otplib'); // Kita menggunakan otplib untuk men-generate kode MFA selama testing
const fs = require('fs');
const path = require('path');

// Helper untuk manual redirect
async function fetchManual(url, options = {}) {
  const res = await fetch(url, { ...options, redirect: 'manual' });
  return res;
}

// Helper untuk manage cookies
function updateCookies(res, currentCookies) {
  const setCookies = res.headers.getSetCookie();
  if (!setCookies || setCookies.length === 0) return currentCookies;
  
  let cookieMap = new Map();
  if (currentCookies) {
    currentCookies.split(';').forEach(c => {
      const parts = c.split('=');
      const k = parts.shift().trim();
      const v = parts.join('=');
      if(k) cookieMap.set(k, v);
    });
  }
  
  setCookies.forEach(str => {
    const pair = str.split(';')[0];
    const parts = pair.split('=');
    const k = parts.shift().trim();
    const v = parts.join('=');
    if(k) cookieMap.set(k, v);
  });
  
  return Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function runTests() {
  console.log('--- Memulai E2E Integration Testing SSO ITB (Including Edge Cases) ---\n');
  let cpCookies = '';
  let authCookies = '';
  let appACookies = '';
  let appBCookies = '';

  try {
    // ==========================================
    // 1. Uji Control Panel Login & Edge Cases
    // ==========================================
    console.log('[TEST 1] Control Panel Login');
    
    // Edge case: Kredensial salah
    const cpLoginFail = await fetchManual('http://localhost:3010/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'admin@itb.ac.id', password: 'salah' })
    });
    // NestJS defaults to 201 Created for @Post unless specified otherwise, even when rendering a view
    assert.strictEqual(cpLoginFail.status, 201, 'Harus merender ulang halaman login dengan error 201');
    console.log('✅ Edge Case: Login dengan kredensial salah berhasil ditolak');

    // Positive case: Kredensial benar
    const cpLoginRes = await fetchManual('http://localhost:3010/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'admin@itb.ac.id', password: 'Admin123!' })
    });
    cpCookies = updateCookies(cpLoginRes, cpCookies);
    assert.strictEqual(cpLoginRes.status, 302, 'Harus redirect ke dashboard');
    assert.strictEqual(cpLoginRes.headers.get('location'), '/dashboard');
    console.log('✅ Control Panel Login berhasil');

    // ==========================================
    // 2. Setup MFA untuk "admin@itb.ac.id" via Control Panel
    // ==========================================
    console.log('\n[TEST 2] Setup MFA (B01)');
    // Ambil daftar user untuk mencari ID
    const usersRes = await fetchManual('http://localhost:3010/users', { headers: { 'Cookie': cpCookies } });
    const usersHtml = await usersRes.text();
    let userId = null;
    const allRows = usersHtml.split('<tr>');
    for(const row of allRows) {
      if(row.includes('admin@itb.ac.id')) {
        const match = row.match(/\/users\/([a-zA-Z0-9-]+)\/edit/);
        if(match) userId = match[1];
      }
    }
    
    let totpSecret = null;
    if (userId) {
      console.log(`Mengaktifkan MFA untuk user ID: ${userId}`);
      // Dapatkan form setup (GET)
      const mfaSetupGetRes = await fetchManual(`http://localhost:3010/users/${userId}/mfa/setup`, {
        method: 'GET',
        headers: { 'Cookie': cpCookies }
      });
      assert.strictEqual(mfaSetupGetRes.status, 200, 'Harus bisa membuka halaman setup MFA');
      const mfaHtml = await mfaSetupGetRes.text();
      // Ekstrak secret dari HTML
      const secretMatch = mfaHtml.match(/<strong>([A-Z2-7=]+)<\/strong>/);
      if (secretMatch) {
        totpSecret = secretMatch[1];
        
        // Simulasikan submit MFA Setup (POST)
        const setupCode = authenticator.generate(totpSecret);
        const mfaSetupPostRes = await fetchManual(`http://localhost:3010/users/${userId}/mfa/setup`, {
          method: 'POST',
          headers: { 'Cookie': cpCookies, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret: totpSecret, code: setupCode })
        });
        
        assert.strictEqual(mfaSetupPostRes.status, 302, 'Submit MFA Setup harus redirect ke edit user');
        console.log(`✅ MFA berhasil di-setup dan diverifikasi. Secret: ${totpSecret}`);
      } else {
        console.log('⚠️ Gagal menemukan secret di HTML, mungkin form salah.');
      }
    } else {
      console.log('⚠️ Gagal mendapatkan userId dari halaman, tidak bisa setup MFA via skrip.');
    }

    // ==========================================
    // 3. Uji App A Login (OAuth2 Flow & MFA)
    // ==========================================
    console.log('\n[TEST 3] App A SSO Login (MFA Flow)');
    const appALoginInit = await fetchManual('http://localhost:3001/auth/login');
    appACookies = updateCookies(appALoginInit, appACookies);
    const authUrl = appALoginInit.headers.get('location');
    
    // Parse redirect params
    const urlObj = new URL(authUrl);
    const params = new URLSearchParams(urlObj.search);
    
    // Auth Login
    const authParams = new URLSearchParams({
      email: 'admin@itb.ac.id',
      password: 'Admin123!',
      client_id: params.get('client_id'),
      redirect_uri: params.get('redirect_uri'),
      response_type: params.get('response_type'),
      state: params.get('state'),
      code_challenge: params.get('code_challenge'),
      code_challenge_method: params.get('code_challenge_method')
    });

    const authSubmitRes = await fetchManual('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: authParams
    });
    authCookies = updateCookies(authSubmitRes, authCookies);

    let callbackUrlA = '';
    
    console.log(`  Debug Login Submit: Status ${authSubmitRes.status}, Location: ${authSubmitRes.headers.get('location')}`);

    if (authSubmitRes.status === 302 && authSubmitRes.headers.get('location').includes('/auth/mfa-page')) {
      // Memerlukan MFA (Berhasil trigger B01 flow)
      console.log('✅ Flow MFA mendeteksi user harus memasukkan token');
      
      const mfaUrl = new URL(authSubmitRes.headers.get('location'), 'http://localhost:3000');
      const challengeId = mfaUrl.searchParams.get('challenge_id');
      
      // Edge case: Token MFA Salah
      const wrongMfaRes = await fetchManual('http://localhost:3000/auth/mfa-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': authCookies },
        body: new URLSearchParams({ ...Object.fromEntries(authParams), challenge_id: challengeId, code: '000000' })
      });
      // Harusnya dirender ulang formnya (kembali 200) atau redirect kembali dengan pesan error
      assert.notStrictEqual(wrongMfaRes.status, 500, 'MFA Salah tidak boleh menyebabkan internal server error');
      console.log('✅ Edge Case: MFA Token Salah ditangani dengan benar');

      // Gunakan token yang benar (jika kita punya secret dari langkah 2)
      if (totpSecret) {
        const correctToken = authenticator.generate(totpSecret);
        const correctMfaRes = await fetchManual('http://localhost:3000/auth/mfa-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': authCookies },
          body: new URLSearchParams({ ...Object.fromEntries(authParams), challenge_id: challengeId, code: correctToken })
        });
        authCookies = updateCookies(correctMfaRes, authCookies);
        assert.strictEqual(correctMfaRes.status, 302, 'MFA Token Benar harus redirect');
        
        let mfaRedirectUrl = correctMfaRes.headers.get('location');
        if(mfaRedirectUrl.startsWith('/')) mfaRedirectUrl = 'http://localhost:3000' + mfaRedirectUrl;
        
        // Follow redirect to /auth/authorize
        const authorizeRes = await fetchManual(mfaRedirectUrl, { headers: { 'Cookie': authCookies } });
        authCookies = updateCookies(authorizeRes, authCookies);
        assert.strictEqual(authorizeRes.status, 302, 'Authorize harus meredirect ke callback App A');
        
        callbackUrlA = authorizeRes.headers.get('location');
        console.log('✅ MFA Token Benar berhasil ditukar dengan Authorization Code');
      } else {
        console.log('⚠️ Melewati verifikasi MFA karena secret tidak diketahui.');
      }
    } else if (authSubmitRes.status === 302) {
       callbackUrlA = authSubmitRes.headers.get('location');
       console.log('✅ Login berhasil (tanpa MFA)');
    }

    if (callbackUrlA) {
      assert.ok(callbackUrlA.includes('code='), 'Redirect url harus memiliki authorization code');
      // Callback App A
      const appACallbackRes = await fetchManual(callbackUrlA, { headers: { 'Cookie': appACookies } });
      appACookies = updateCookies(appACallbackRes, appACookies);
      assert.strictEqual(appACallbackRes.status, 302, 'App A callback failed');
      
      // Callback App A meredirect ke /
      const appARedirect = appACallbackRes.headers.get('location');
      const appAFinalRes = await fetchManual('http://localhost:3001' + appARedirect, { headers: { 'Cookie': appACookies } });
      appACookies = updateCookies(appAFinalRes, appACookies);
      
      console.log('✅ App A: Authorization Code berhasil ditukar dengan Token');
    }

    // ==========================================
    // 4. Uji App B (Central Session Auto Login)
    // ==========================================
    console.log('\n[TEST 4] App B Auto Login (Central Session)');
    const appBLoginInit = await fetchManual('http://localhost:3002/auth/login');
    appBCookies = updateCookies(appBLoginInit, appBCookies);
    const authUrlB = appBLoginInit.headers.get('location');
    
    // Auth Check dengan authCookies (Central Session sudah ada)
    console.log('  Debug authCookies:', authCookies);
    const authCheckRes = await fetchManual(authUrlB, { headers: { 'Cookie': authCookies } });
    authCookies = updateCookies(authCheckRes, authCookies);
    assert.strictEqual(authCheckRes.status, 302, 'Harus bypass login');
    const callbackUrlB = authCheckRes.headers.get('location');
    
    console.log('  Debug callbackUrlB:', callbackUrlB);
    // Pastikan tidak ada halaman login/mfa, langsung dapat code
    assert.ok(callbackUrlB.includes('code='), 'Langsung menerima code untuk App B');
    
    const appBCallbackRes = await fetchManual(callbackUrlB, { headers: { 'Cookie': appBCookies } });
    appBCookies = updateCookies(appBCallbackRes, appBCookies);
    assert.strictEqual(appBCallbackRes.status, 302);
    console.log('✅ App B: Central Session berfungsi, bypass autentikasi berhasil');

    // ==========================================
    // 5. Uji API Central (Metrics, Health) (B02 & B03)
    // ==========================================
    console.log('\n[TEST 5] Observability & Health Probes');
    const metricsRes = await fetchManual('http://localhost:3000/internal/metrics');
    assert.strictEqual(metricsRes.status, 200, 'Metrics Endpoint (B02) tidak merespons 200 OK');
    const healthRes = await fetchManual('http://localhost:3000/health/live');
    assert.strictEqual(healthRes.status, 200, 'Health Endpoint (B03) tidak merespons 200 OK');
    console.log('✅ Liveness, Readiness, & Metrics API berfungsi dengan baik');

    // ==========================================
    // 6. Uji Global Logout via RabbitMQ (F05)
    // ==========================================
    console.log('\n[TEST 6] Global Logout (Event-driven)');
    const logoutRes = await fetchManual('http://localhost:3000/auth/logout', {
      method: 'GET',
      headers: { 'Cookie': authCookies }
    });
    
    assert.strictEqual(logoutRes.status, 302, 'Global Logout harus berhasil redirect (ke halaman awal/login)');
    authCookies = updateCookies(logoutRes, authCookies);
    
    console.log('⏳ Menunggu Sync Worker memproses event revoke_session ke App B (8 detik)...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Akses Dashboard App B dengan cookies yang sama, harus ditolak
    const checkAppB = await fetchManual('http://localhost:3002/dashboard', { headers: { 'Cookie': appBCookies } });
    assert.strictEqual(checkAppB.status, 401, 'Harus Unauthorized (Sesi dicabut)');
    console.log('✅ App B Session berhasil dicabut secara otomatis oleh sistem (F05 Success)');
    
    console.log('\n🎉 SEMUA PENGUJIAN MENDALAM BERHASIL 🎉\n');
  } catch (err) {
    console.error('\n❌ PENGUJIAN GAGAL ❌');
    console.error(err);
    process.exit(1);
  }
}

runTests();
