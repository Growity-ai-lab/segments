/**
 * ATLAS Token Management System
 * Meta ve TikTok API token'larını otomatik yönetir
 */

class TokenManager {
    constructor() {
        this.tokens = {
            meta: {
                accessToken: null,
                refreshToken: null,
                expiresAt: null,
                appId: null,
                appSecret: null,
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
            
            console.log('📚 Token'lar local storage'dan yüklendi');
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
            
            console.log('💾 Token'lar storage'a kaydedildi');
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
        
        if (!token.refreshToken) {
            throw new Error('Meta refresh token bulunamadı');
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
                throw new Error(`Meta API Error: ${response.status} ${response.statusText}`);
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
                throw new Error(`TikTok API Error: ${response.status} ${response.statusText}`);
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
