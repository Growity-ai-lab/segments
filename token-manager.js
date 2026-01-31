/**
 * ATLAS Token Management System - Updated with Real Credentials
 * Meta ve TikTok API token'larını otomatik yönetir
 */

class TokenManager {
    constructor() {
        this.tokens = {
            meta: {
                accessToken: null,
                refreshToken: null,
                expiresAt: null,
                appId: '1722819475770536',
                appSecret: 'aa603d432868c3ae5d2f4918944bf55e',
                isRefreshing: false
            },
            tiktok: {
                accessToken: null,
                refreshToken: null,
                expiresAt: null,
                appId: '7598110409156984833',
                appSecret: '1c5b38fb69f512a8db47f11067015884c00aed44',
                isRefreshing: false
            }
        };
        
        this.refreshBuffer = 10 * 60 * 1000; // 10 dakika önce refresh et
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 saniye
        
        this.eventEmitter = new EventTarget();
        
        this.initializeTokens();
        this.startTokenMonitoring();
        this.setupAuthHandlers();
    }

    /**
     * OAuth authentication handlers kurulumu
     */
    setupAuthHandlers() {
        // URL'den auth code'u yakala
        this.handleAuthCallback();
        
        // TikTok auth button handler
        window.startTikTokAuth = () => this.startTikTokAuth();
        window.startMetaAuth = () => this.startMetaAuth();
    }

    /**
     * URL'den auth callback'i handle et
     */
    handleAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const authCode = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        
        if (error) {
            console.error('OAuth error:', error);
            this.showAuthError(`OAuth hatası: ${error}`);
            return;
        }
        
        if (authCode) {
            console.log('🔑 Auth code alındı:', authCode);
            
            // State'e göre hangi platform olduğunu belirle
            if (state && state.includes('tiktok')) {
                this.exchangeTikTokAuthCode(authCode);
            } else if (state && state.includes('meta')) {
                this.exchangeMetaAuthCode(authCode);
            } else {
                // Default olarak TikTok dene
                this.exchangeTikTokAuthCode(authCode);
            }
            
            // URL'i temizle
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    /**
     * TikTok OAuth başlat
     */
    startTikTokAuth() {
        const redirectUri = encodeURIComponent('https://growity-ai-lab.github.io/atlas/');
        const state = 'tiktok_auth_' + Date.now();
        
        const authUrl = `https://business-api.tiktok.com/portal/auth?` +
            `app_id=${this.tokens.tiktok.appId}&` +
            `state=${state}&` +
            `redirect_uri=${redirectUri}&` +
            `scope=user_info:read,ad_management:read,ad_management:write`;
        
        console.log('🚀 TikTok OAuth başlatılıyor...');
        window.location.href = authUrl;
    }

    /**
     * Meta OAuth başlat
     */
    startMetaAuth() {
        const redirectUri = encodeURIComponent('https://growity-ai-lab.github.io/atlas/');
        const state = 'meta_auth_' + Date.now();
        
        const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
            `client_id=${this.tokens.meta.appId}&` +
            `redirect_uri=${redirectUri}&` +
            `state=${state}&` +
            `scope=ads_management,ads_read,business_management&` +
            `response_type=code`;
        
        console.log('🚀 Meta OAuth başlatılıyor...');
        window.location.href = authUrl;
    }

    /**
     * TikTok auth code'unu token ile değiş
     */
    async exchangeTikTokAuthCode(authCode) {
        try {
            console.log('🔄 TikTok auth code exchange başlatıldı...');
            
            const response = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    app_id: this.tokens.tiktok.appId,
                    secret: this.tokens.tiktok.appSecret,
                    auth_code: authCode
                })
            });

            const data = await response.json();
            console.log('TikTok auth response:', data);

            if (data.code === 0 && data.data) {
                // Token'ları kaydet
                this.tokens.tiktok.accessToken = data.data.access_token;
                this.tokens.tiktok.refreshToken = data.data.refresh_token;
                this.tokens.tiktok.expiresAt = Date.now() + (data.data.access_token_expire_in * 1000);

                this.saveTokensToStorage();
                this.emitTokenEvent('tiktok', 'updated');

                console.log('✅ TikTok token\'ları başarıyla alındı!');
                this.showAuthSuccess('TikTok authentication başarılı!');
            } else {
                throw new Error(`TikTok auth failed: ${data.message || 'Unknown error'}`);
            }

        } catch (error) {
            console.error('❌ TikTok auth code exchange hatası:', error);
            this.showAuthError(`TikTok authentication hatası: ${error.message}`);
        }
    }

    /**
     * Meta auth code'unu token ile değiş
     */
    async exchangeMetaAuthCode(authCode) {
        try {
            console.log('🔄 Meta auth code exchange başlatıldı...');
            
            const response = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    client_id: this.tokens.meta.appId,
                    client_secret: this.tokens.meta.appSecret,
                    redirect_uri: 'https://growity-ai-lab.github.io/atlas/',
                    code: authCode
                })
            });

            const data = await response.json();
            console.log('Meta auth response:', data);

            if (data.access_token) {
                // Long-lived token al
                const longLivedResponse = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: new URLSearchParams({
                        grant_type: 'fb_exchange_token',
                        client_id: this.tokens.meta.appId,
                        client_secret: this.tokens.meta.appSecret,
                        fb_exchange_token: data.access_token
                    })
                });

                const longLivedData = await longLivedResponse.json();
                
                if (longLivedData.access_token) {
                    // Token'ları kaydet
                    this.tokens.meta.accessToken = longLivedData.access_token;
                    this.tokens.meta.expiresAt = longLivedData.expires_in ? 
                        Date.now() + (longLivedData.expires_in * 1000) : 
                        Date.now() + (60 * 24 * 60 * 60 * 1000); // 60 gün

                    this.saveTokensToStorage();
                    this.emitTokenEvent('meta', 'updated');

                    console.log('✅ Meta token\'ları başarıyla alındı!');
                    this.showAuthSuccess('Meta authentication başarılı!');
                } else {
                    throw new Error('Long-lived token alınamadı');
                }
            } else {
                throw new Error(`Meta auth failed: ${data.error?.message || 'Unknown error'}`);
            }

        } catch (error) {
            console.error('❌ Meta auth code exchange hatası:', error);
            this.showAuthError(`Meta authentication hatası: ${error.message}`);
        }
    }

    /**
     * Auth success notification göster
     */
    showAuthSuccess(message) {
        this.showNotification(message, 'success');
    }

    /**
     * Auth error notification göster
     */
    showAuthError(message) {
        this.showNotification(message, 'error');
    }

    /**
     * Notification göster
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10001;
            padding: 16px 20px;
            border-radius: 8px;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 500;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6',
            warning: '#f59e0b'
        };

        notification.style.backgroundColor = colors[type] || colors.info;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Auto remove
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    /**
     * Token'ları initialize et
     */
    async initializeTokens() {
        console.log('🔑 Token Management System başlatılıyor...');
        
        // Local storage'dan token'ları yükle
        await this.loadTokensFromStorage();
        
        // Expired token'ları temizle
        this.validateStoredTokens();
        
        console.log('✅ Token Management System hazır');
    }

    /**
     * Local storage'dan token'ları yükle
     */
    async loadTokensFromStorage() {
        try {
            const metaTokenData = localStorage.getItem('atlas_meta_tokens');
            const tiktokTokenData = localStorage.getItem('atlas_tiktok_tokens');
            
            if (metaTokenData) {
                const parsed = JSON.parse(metaTokenData);
                this.tokens.meta = { ...this.tokens.meta, ...parsed };
            }
            
            if (tiktokTokenData) {
                const parsed = JSON.parse(tiktokTokenData);
                this.tokens.tiktok = { ...this.tokens.tiktok, ...parsed };
            }
            
            console.log('📚 Token\'lar local storage\'dan yüklendi');
        } catch (error) {
            console.warn('⚠️ Local storage token yükleme hatası:', error);
        }
    }

    /**
     * Token'ları storage'a kaydet
     */
    saveTokensToStorage() {
        try {
            localStorage.setItem('atlas_meta_tokens', JSON.stringify({
                accessToken: this.tokens.meta.accessToken,
                refreshToken: this.tokens.meta.refreshToken,
                expiresAt: this.tokens.meta.expiresAt,
                appId: this.tokens.meta.appId
            }));
            
            localStorage.setItem('atlas_tiktok_tokens', JSON.stringify({
                accessToken: this.tokens.tiktok.accessToken,
                refreshToken: this.tokens.tiktok.refreshToken,
                expiresAt: this.tokens.tiktok.expiresAt
            }));
            
            console.log('💾 Token\'lar storage\'a kaydedildi');
        } catch (error) {
            console.warn('⚠️ Token storage kaydetme hatası:', error);
        }
    }

    /**
     * Stored token'ları validate et
     */
    validateStoredTokens() {
        const now = Date.now();
        
        // Meta token kontrolü
        if (this.tokens.meta.expiresAt && this.tokens.meta.expiresAt <= now) {
            console.log('🔄 Meta token süresi dolmuş, temizleniyor...');
            this.clearPlatformTokens('meta');
        }
        
        // TikTok token kontrolü
        if (this.tokens.tiktok.expiresAt && this.tokens.tiktok.expiresAt <= now) {
            console.log('🔄 TikTok token süresi dolmuş, temizleniyor...');
            this.clearPlatformTokens('tiktok');
        }
    }

    /**
     * Token monitoring başlat
     */
    startTokenMonitoring() {
        // Her 5 dakikada bir token'ları kontrol et
        setInterval(() => {
            this.checkTokenExpiry();
        }, 5 * 60 * 1000);
        
        console.log('👁️ Token monitoring başlatıldı');
    }

    /**
     * Token süre dolum kontrolü
     */
    async checkTokenExpiry() {
        const now = Date.now();
        
        // Meta token kontrolü
        if (this.shouldRefreshToken('meta', now)) {
            console.log('🔄 Meta token yenileniyor...');
            await this.refreshPlatformToken('meta');
        }
        
        // TikTok token kontrolü
        if (this.shouldRefreshToken('tiktok', now)) {
            console.log('🔄 TikTok token yenileniyor...');
            await this.refreshPlatformToken('tiktok');
        }
    }

    /**
     * Token'ın yenilenmesi gerekip gerekmediğini kontrol et
     */
    shouldRefreshToken(platform, now = Date.now()) {
        const token = this.tokens[platform];
        
        if (!token.accessToken || !token.refreshToken || !token.expiresAt) {
            return false;
        }
        
        // Token süresi dolmadan 10 dakika önce yenile
        return token.expiresAt - now < this.refreshBuffer;
    }

    /**
     * Platform token'ını yenile
     */
    async refreshPlatformToken(platform) {
        const token = this.tokens[platform];
        
        if (token.isRefreshing) {
            console.log(`⏳ ${platform} token zaten yenileniyor...`);
            return await this.waitForRefresh(platform);
        }
        
        token.isRefreshing = true;
        
        try {
            if (platform === 'meta') {
                await this.refreshMetaToken();
            } else if (platform === 'tiktok') {
                await this.refreshTikTokToken();
            }
            
            this.saveTokensToStorage();
            this.emitTokenEvent(platform, 'refreshed');
            
            console.log(`✅ ${platform} token başarıyla yenilendi`);
            
        } catch (error) {
            console.error(`❌ ${platform} token yenileme hatası:`, error);
            this.emitTokenEvent(platform, 'refresh_failed', error);
            throw error;
        } finally {
            token.isRefreshing = false;
        }
    }

    /**
     * Meta token'ını yenile
     */
    async refreshMetaToken() {
        const token = this.tokens.meta;
        
        if (!token.accessToken) {
            throw new Error('Meta access token bulunamadı');
        }
        
        const response = await this.makeRetryableRequest('https://graph.facebook.com/v18.0/oauth/access_token', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            body: new URLSearchParams({
                grant_type: 'fb_exchange_token',
                client_id: token.appId,
                client_secret: token.appSecret,
                fb_exchange_token: token.accessToken
            })
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Meta token refresh failed: ${error}`);
        }
        
        const data = await response.json();
        
        // Token bilgilerini güncelle
        token.accessToken = data.access_token;
        token.expiresAt = data.expires_in ? Date.now() + (data.expires_in * 1000) : null;
        
        console.log('🔄 Meta token güncellendi:', {
            expiresIn: data.expires_in ? `${Math.round(data.expires_in / 3600)}h` : 'never',
            expiresAt: token.expiresAt ? new Date(token.expiresAt).toLocaleString('tr-TR') : 'never'
        });
    }

    /**
     * TikTok token'ını yenile
     */
    async refreshTikTokToken() {
        const token = this.tokens.tiktok;
        
        if (!token.refreshToken) {
            throw new Error('TikTok refresh token bulunamadı');
        }
        
        const response = await this.makeRetryableRequest('https://business-api.tiktok.com/open_api/v1.3/oauth2/refresh_token/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                app_id: token.appId,
                secret: token.appSecret,
                refresh_token: token.refreshToken
            })
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`TikTok token refresh failed: ${error}`);
        }
        
        const data = await response.json();
        
        if (data.code !== 0) {
            throw new Error(`TikTok API error: ${data.message}`);
        }
        
        // Token bilgilerini güncelle
        token.accessToken = data.data.access_token;
        token.refreshToken = data.data.refresh_token;
        token.expiresAt = Date.now() + (data.data.access_token_expire_in * 1000);
        
        console.log('🔄 TikTok token güncellendi:', {
            expiresIn: `${Math.round(data.data.access_token_expire_in / 3600)}h`,
            expiresAt: new Date(token.expiresAt).toLocaleString('tr-TR')
        });
    }

    /**
     * Retry logic ile request yap
     */
    async makeRetryableRequest(url, options) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await fetch(url, options);
                return response;
            } catch (error) {
                lastError = error;
                console.warn(`🔄 Request attempt ${attempt}/${this.maxRetries} failed:`, error.message);
                
                if (attempt < this.maxRetries) {
                    await this.sleep(this.retryDelay * Math.pow(2, attempt - 1)); // Exponential backoff
                }
            }
        }
        
        throw lastError;
    }

    /**
     * Platform token'ını set et
     */
    setTokens(platform, tokenData) {
        const token = this.tokens[platform];
        
        if (tokenData.accessToken) {
            token.accessToken = tokenData.accessToken;
        }
        
        if (tokenData.refreshToken) {
            token.refreshToken = tokenData.refreshToken;
        }
        
        if (tokenData.expiresIn) {
            token.expiresAt = Date.now() + (tokenData.expiresIn * 1000);
        } else if (tokenData.expiresAt) {
            token.expiresAt = tokenData.expiresAt;
        }
        
        if (tokenData.appId) {
            token.appId = tokenData.appId;
        }
        
        if (tokenData.appSecret) {
            token.appSecret = tokenData.appSecret;
        }
        
        this.saveTokensToStorage();
        this.emitTokenEvent(platform, 'updated');
        
        console.log(`✅ ${platform} token'ları güncellendi`);
    }

    /**
     * Platform token'ını al (otomatik refresh ile)
     */
    async getValidToken(platform) {
        const token = this.tokens[platform];
        
        // Token yoksa hata ver
        if (!token.accessToken) {
            throw new Error(`${platform} access token bulunamadı. Lütfen önce authenticate edin.`);
        }
        
        // Token süresi dolmuşsa yenile
        if (this.shouldRefreshToken(platform)) {
            await this.refreshPlatformToken(platform);
        }
        
        return token.accessToken;
    }

    /**
     * Token'ın geçerli olup olmadığını kontrol et
     */
    isTokenValid(platform) {
        const token = this.tokens[platform];
        
        if (!token.accessToken) return false;
        if (!token.expiresAt) return true; // Never expires
        
        return token.expiresAt > Date.now() + this.refreshBuffer;
    }

    /**
     * Platform token'larını temizle
     */
    clearPlatformTokens(platform) {
        const token = this.tokens[platform];
        
        token.accessToken = null;
        token.refreshToken = null;
        token.expiresAt = null;
        token.isRefreshing = false;
        
        // Storage'dan temizle
        if (platform === 'meta') {
            localStorage.removeItem('atlas_meta_tokens');
        } else if (platform === 'tiktok') {
            localStorage.removeItem('atlas_tiktok_tokens');
        }
        
        this.emitTokenEvent(platform, 'cleared');
        
        console.log(`🗑️ ${platform} token'ları temizlendi`);
    }

    /**
     * Tüm token'ları temizle
     */
    clearAllTokens() {
        this.clearPlatformTokens('meta');
        this.clearPlatformTokens('tiktok');
        
        console.log('🗑️ Tüm token'lar temizlendi');
    }

    /**
     * Token refresh'in tamamlanmasını bekle
     */
    async waitForRefresh(platform, timeout = 30000) {
        const startTime = Date.now();
        
        while (this.tokens[platform].isRefreshing) {
            if (Date.now() - startTime > timeout) {
                throw new Error(`${platform} token refresh timeout`);
            }
            
            await this.sleep(100);
        }
        
        return this.tokens[platform].accessToken;
    }

    /**
     * Token event'i emit et
     */
    emitTokenEvent(platform, eventType, data = null) {
        const event = new CustomEvent('tokenEvent', {
            detail: {
                platform,
                eventType,
                timestamp: new Date(),
                data,
                tokenInfo: {
                    hasAccessToken: !!this.tokens[platform].accessToken,
                    hasRefreshToken: !!this.tokens[platform].refreshToken,
                    expiresAt: this.tokens[platform].expiresAt,
                    isValid: this.isTokenValid(platform)
                }
            }
        });
        
        this.eventEmitter.dispatchEvent(event);
        document.dispatchEvent(event);
    }

    /**
     * Token status'u al
     */
    getTokenStatus() {
        return {
            meta: {
                hasToken: !!this.tokens.meta.accessToken,
                isValid: this.isTokenValid('meta'),
                expiresAt: this.tokens.meta.expiresAt,
                expiresIn: this.tokens.meta.expiresAt ? 
                    Math.max(0, this.tokens.meta.expiresAt - Date.now()) : null
            },
            tiktok: {
                hasToken: !!this.tokens.tiktok.accessToken,
                isValid: this.isTokenValid('tiktok'),
                expiresAt: this.tokens.tiktok.expiresAt,
                expiresIn: this.tokens.tiktok.expiresAt ? 
                    Math.max(0, this.tokens.tiktok.expiresAt - Date.now()) : null
            }
        };
    }

    /**
     * Token event listener ekle
     */
    addEventListener(eventType, listener) {
        this.eventEmitter.addEventListener('tokenEvent', (event) => {
            if (event.detail.eventType === eventType) {
                listener(event.detail);
            }
        });
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Debug için token bilgilerini yazdır
     */
    logTokenStatus() {
        const status = this.getTokenStatus();
        
        console.log('🔑 Token Status:', {
            meta: {
                hasToken: status.meta.hasToken,
                isValid: status.meta.isValid,
                expiresIn: status.meta.expiresIn ? 
                    `${Math.round(status.meta.expiresIn / 1000 / 60)}min` : 'N/A'
            },
            tiktok: {
                hasToken: status.tiktok.hasToken,
                isValid: status.tiktok.isValid,
                expiresIn: status.tiktok.expiresIn ? 
                    `${Math.round(status.tiktok.expiresIn / 1000 / 60)}min` : 'N/A'
            }
        });
    }
}

// API Client Wrapper - Token management ile entegre
class APIClient {
    constructor(tokenManager) {
        this.tokenManager = tokenManager;
    }

    /**
     * Meta API call yap
     */
    async makeMetaAPICall(endpoint, options = {}) {
        try {
            const token = await this.tokenManager.getValidToken('meta');
            
            const response = await fetch(`https://graph.facebook.com/v18.0${endpoint}`, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Meta API Error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Meta API call failed:', error);
            throw error;
        }
    }

    /**
     * TikTok API call yap
     */
    async makeTikTokAPICall(endpoint, options = {}) {
        try {
            const token = await this.tokenManager.getValidToken('tiktok');
            
            const response = await fetch(`https://business-api.tiktok.com/open_api/v1.3${endpoint}`, {
                ...options,
                headers: {
                    'Access-Token': token,
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`TikTok API Error: ${response.status} ${response.statusText} - ${errorData.message || 'Unknown error'}`);
            }
            
            const data = await response.json();
            
            if (data.code !== 0) {
                throw new Error(`TikTok API Error: ${data.message}`);
            }
            
            return data.data;
        } catch (error) {
            console.error('TikTok API call failed:', error);
            throw error;
        }
    }
}

// Global instance'ları oluştur
window.tokenManager = new TokenManager();
window.apiClient = new APIClient(window.tokenManager);

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TokenManager, APIClient };
}
