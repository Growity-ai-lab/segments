/**
 * ATLAS Token Management System v2.3
 * TikTok CORS sorunu düzeltildi - tüm çağrılar backend proxy üzerinden
 */

class TokenManager {
    constructor() {
        this.backendUrl = 'https://atlas-taupe-alpha.vercel.app';
        this.redirectUri = 'https://growity-ai-lab.github.io/atlas/';
        
        this.config = {
            meta: { appId: '1722819475770536' },
            tiktok: { appId: '7598110409156984833' }
        };
        
        this.tokens = {
            meta: { accessToken: null, expiresAt: null, isRefreshing: false },
            tiktok: { accessToken: null, refreshToken: null, expiresAt: null, advertiserIds: [], isRefreshing: false }
        };
        
        this.refreshBuffer = 10 * 60 * 1000;
        this.eventEmitter = new EventTarget();
        
        this.initializeTokens();
        this.startTokenMonitoring();
        this.setupAuthHandlers();
    }

    initializeTokens() {
        try {
            const metaTokens = localStorage.getItem('atlas_meta_tokens');
            const tiktokTokens = localStorage.getItem('atlas_tiktok_tokens');
            
            if (metaTokens) {
                const parsed = JSON.parse(metaTokens);
                this.tokens.meta = { ...this.tokens.meta, ...parsed };
            }
            if (tiktokTokens) {
                const parsed = JSON.parse(tiktokTokens);
                this.tokens.tiktok = { ...this.tokens.tiktok, ...parsed };
            }
            console.log('✅ Token\'lar yüklendi');
        } catch (error) {
            console.error('Token yükleme hatası:', error);
        }
    }
    
    saveTokensToStorage() {
        try {
            localStorage.setItem('atlas_meta_tokens', JSON.stringify({
                accessToken: this.tokens.meta.accessToken,
                expiresAt: this.tokens.meta.expiresAt
            }));
            localStorage.setItem('atlas_tiktok_tokens', JSON.stringify({
                accessToken: this.tokens.tiktok.accessToken,
                refreshToken: this.tokens.tiktok.refreshToken,
                expiresAt: this.tokens.tiktok.expiresAt,
                advertiserIds: this.tokens.tiktok.advertiserIds
            }));
            console.log('💾 Token\'lar kaydedildi');
        } catch (error) {
            console.error('Token kaydetme hatası:', error);
        }
    }

    /**
     * Manuel token ayarlama
     */
    setTokens(platform, tokenData) {
        if (!['meta', 'tiktok'].includes(platform)) throw new Error('Geçersiz platform');
        if (!tokenData.accessToken) throw new Error('Access token gerekli');
        
        const expiresIn = tokenData.expiresIn || (platform === 'meta' ? 5184000 : 86400);
        
        if (platform === 'meta') {
            this.tokens.meta.accessToken = tokenData.accessToken;
            this.tokens.meta.expiresAt = Date.now() + (expiresIn * 1000);
        } else {
            this.tokens.tiktok.accessToken = tokenData.accessToken;
            this.tokens.tiktok.refreshToken = tokenData.refreshToken || null;
            this.tokens.tiktok.expiresAt = Date.now() + (expiresIn * 1000);
            this.tokens.tiktok.advertiserIds = tokenData.advertiserIds || [];
        }
        
        this.saveTokensToStorage();
        this.emitTokenEvent(platform, 'updated');
        this.showNotification(`${platform.toUpperCase()} token kaydedildi!`, 'success');
    }

    setupAuthHandlers() {
        this.handleAuthCallback();
        window.startTikTokAuth = () => this.startTikTokAuth();
        window.startMetaAuth = () => this.startMetaAuth();
    }

    startTikTokAuth() {
        localStorage.setItem('atlas_auth_platform', 'tiktok');
        const authUrl = `https://business-api.tiktok.com/portal/auth?app_id=${this.config.tiktok.appId}&state=tiktok_${Date.now()}&redirect_uri=${encodeURIComponent(this.redirectUri)}`;
        window.location.href = authUrl;
    }
    
    startMetaAuth() {
        localStorage.setItem('atlas_auth_platform', 'meta');
        const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${this.config.meta.appId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&state=meta_${Date.now()}&scope=ads_management,ads_read,business_management&response_type=code`;
        window.location.href = authUrl;
    }

    handleAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const authCode = urlParams.get('code');
        const error = urlParams.get('error') || urlParams.get('error_message');
        
        if (error) {
            this.showNotification(`OAuth hatası: ${decodeURIComponent(error)}`, 'error');
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }
        
        if (authCode) {
            const platform = localStorage.getItem('atlas_auth_platform') || 'meta';
            if (platform === 'tiktok') this.exchangeTikTokToken(authCode);
            else this.exchangeMetaToken(authCode);
            localStorage.removeItem('atlas_auth_platform');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
    
    async exchangeTikTokToken(authCode) {
        try {
            this.showNotification('TikTok token alınıyor...', 'info');
            const response = await fetch(`${this.backendUrl}/api/tiktok/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auth_code: authCode })
            });
            const data = await response.json();
            
            if (data.success) {
                this.tokens.tiktok.accessToken = data.data.access_token;
                this.tokens.tiktok.refreshToken = data.data.refresh_token;
                this.tokens.tiktok.advertiserIds = data.data.advertiser_ids || [];
                this.tokens.tiktok.expiresAt = Date.now() + ((data.data.expires_in || 86400) * 1000);
                this.saveTokensToStorage();
                this.emitTokenEvent('tiktok', 'updated');
                this.showNotification('TikTok bağlantısı başarılı!', 'success');
            } else throw new Error(data.error || 'Token alınamadı');
        } catch (error) {
            this.showNotification(`TikTok hatası: ${error.message}`, 'error');
        }
    }
    
    async exchangeMetaToken(authCode) {
        try {
            this.showNotification('Meta token alınıyor...', 'info');
            const response = await fetch(`${this.backendUrl}/api/meta/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auth_code: authCode, redirect_uri: this.redirectUri })
            });
            const data = await response.json();
            
            if (data.success) {
                this.tokens.meta.accessToken = data.data.access_token;
                this.tokens.meta.expiresAt = Date.now() + ((data.data.expires_in || 5184000) * 1000);
                this.saveTokensToStorage();
                this.emitTokenEvent('meta', 'updated');
                this.showNotification('Meta bağlantısı başarılı!', 'success');
            } else throw new Error(data.error || 'Token alınamadı');
        } catch (error) {
            this.showNotification(`Meta hatası: ${error.message}`, 'error');
        }
    }

    async refreshTikTokToken() {
        if (this.tokens.tiktok.isRefreshing || !this.tokens.tiktok.refreshToken) return;
        try {
            this.tokens.tiktok.isRefreshing = true;
            const response = await fetch(`${this.backendUrl}/api/tiktok/refresh-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: this.tokens.tiktok.refreshToken })
            });
            const data = await response.json();
            if (data.success) {
                this.tokens.tiktok.accessToken = data.data.access_token;
                this.tokens.tiktok.refreshToken = data.data.refresh_token;
                this.tokens.tiktok.expiresAt = Date.now() + ((data.data.expires_in || 86400) * 1000);
                this.saveTokensToStorage();
                this.emitTokenEvent('tiktok', 'refreshed');
            }
        } catch (error) {
            console.error('TikTok refresh hatası:', error);
        } finally {
            this.tokens.tiktok.isRefreshing = false;
        }
    }
    
    async refreshMetaToken() {
        if (this.tokens.meta.isRefreshing || !this.tokens.meta.accessToken) return;
        try {
            this.tokens.meta.isRefreshing = true;
            const response = await fetch(`${this.backendUrl}/api/meta/refresh-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_token: this.tokens.meta.accessToken })
            });
            const data = await response.json();
            if (data.success) {
                this.tokens.meta.accessToken = data.data.access_token;
                this.tokens.meta.expiresAt = Date.now() + ((data.data.expires_in || 5184000) * 1000);
                this.saveTokensToStorage();
                this.emitTokenEvent('meta', 'refreshed');
            }
        } catch (error) {
            console.error('Meta refresh hatası:', error);
        } finally {
            this.tokens.meta.isRefreshing = false;
        }
    }

    startTokenMonitoring() {
        setInterval(() => {
            if (this.shouldRefreshToken('tiktok')) this.refreshTikTokToken();
            if (this.shouldRefreshToken('meta')) this.refreshMetaToken();
        }, 5 * 60 * 1000);
    }
    
    shouldRefreshToken(platform) {
        const token = this.tokens[platform];
        return token.accessToken && token.expiresAt && (token.expiresAt - Date.now() < this.refreshBuffer);
    }
    
    isTokenValid(platform) {
        const token = this.tokens[platform];
        return token.accessToken && (!token.expiresAt || token.expiresAt > Date.now());
    }

    async getValidToken(platform) {
        const token = this.tokens[platform];
        if (!token.accessToken) throw new Error(`${platform} token bulunamadı`);
        if (this.shouldRefreshToken(platform)) {
            if (platform === 'tiktok') await this.refreshTikTokToken();
            else await this.refreshMetaToken();
        }
        return token.accessToken;
    }
    
    getTokenStatus() {
        return {
            meta: {
                hasToken: !!this.tokens.meta.accessToken,
                isValid: this.isTokenValid('meta'),
                expiresAt: this.tokens.meta.expiresAt,
                expiresIn: this.tokens.meta.expiresAt ? Math.max(0, this.tokens.meta.expiresAt - Date.now()) : null
            },
            tiktok: {
                hasToken: !!this.tokens.tiktok.accessToken,
                isValid: this.isTokenValid('tiktok'),
                expiresAt: this.tokens.tiktok.expiresAt,
                expiresIn: this.tokens.tiktok.expiresAt ? Math.max(0, this.tokens.tiktok.expiresAt - Date.now()) : null,
                advertiserIds: this.tokens.tiktok.advertiserIds
            }
        };
    }
    
    clearPlatformTokens(platform) {
        if (platform === 'meta') {
            this.tokens.meta = { accessToken: null, expiresAt: null, isRefreshing: false };
        } else {
            this.tokens.tiktok = { accessToken: null, refreshToken: null, expiresAt: null, advertiserIds: [], isRefreshing: false };
        }
        localStorage.removeItem(`atlas_${platform}_tokens`);
        this.emitTokenEvent(platform, 'cleared');
    }
    
    clearAllTokens() {
        this.clearPlatformTokens('meta');
        this.clearPlatformTokens('tiktok');
    }

    emitTokenEvent(platform, eventType, data = null) {
        const event = new CustomEvent('tokenEvent', {
            detail: { platform, eventType, timestamp: new Date(), data, tokenInfo: this.getTokenStatus()[platform] }
        });
        this.eventEmitter.dispatchEvent(event);
        document.dispatchEvent(event);
    }
    
    addEventListener(eventType, listener) {
        this.eventEmitter.addEventListener('tokenEvent', (event) => {
            if (!eventType || event.detail.eventType === eventType) listener(event.detail);
        });
    }
    
    showNotification(message, type = 'info') {
        const colors = { success: '#10B981', error: '#EF4444', info: '#3B82F6', warning: '#F59E0B' };
        const notification = document.createElement('div');
        notification.style.cssText = `position:fixed;top:20px;right:20px;padding:16px 24px;background:${colors[type]};color:white;border-radius:8px;font-family:system-ui;font-size:14px;z-index:10000;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:400px;animation:slideIn 0.3s ease;`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => { notification.remove(); }, 4000);
    }
    
    logTokenStatus() {
        console.log('🔑 Token Status:', this.getTokenStatus());
    }
}

/**
 * API Client - TÜM ÇAĞRILAR BACKEND PROXY ÜZERİNDEN
 * CORS sorunlarını önlemek için doğrudan API çağrısı yapılmıyor
 */
class APIClient {
    constructor(tokenManager) {
        this.tokenManager = tokenManager;
        this.backendUrl = tokenManager.backendUrl;
    }
    
    /**
     * TikTok API - Backend proxy üzerinden
     * Dashboard'daki makeTikTokAPICall bu fonksiyonu çağırıyor
     */
    async makeTikTokAPICall(endpoint, options = {}) {
        const token = await this.tokenManager.getValidToken('tiktok');
        
        // Endpoint'e göre uygun proxy endpoint'i belirle
        let proxyEndpoint = 'interests'; // varsayılan
        
        if (endpoint.includes('advertiser')) {
            // Advertiser bilgisi için özel endpoint - doğrudan TikTok API'den al
            // Ama CORS yüzünden backend üzerinden gitmeli
            try {
                const response = await fetch(`${this.backendUrl}/api/tiktok/advertiser`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ access_token: token })
                });
                
                if (!response.ok) {
                    // Eğer advertiser endpoint yoksa, basit bir test yap
                    return await this.testTikTokConnection(token);
                }
                
                const data = await response.json();
                if (data.success) return data.data;
                throw new Error(data.error || 'API call failed');
            } catch (error) {
                // Fallback: basit bağlantı testi
                return await this.testTikTokConnection(token);
            }
        }
        
        if (endpoint.includes('interest')) proxyEndpoint = 'interests';
        if (endpoint.includes('audience')) proxyEndpoint = 'audience-size';
        
        const response = await fetch(`${this.backendUrl}/api/tiktok/${proxyEndpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: token, ...options.body })
        });
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'API call failed');
        return data.data;
    }
    
    /**
     * TikTok bağlantı testi - token geçerli mi kontrol et
     */
    async testTikTokConnection(token) {
        // Token var ve süre dolmamışsa başarılı say
        const status = this.tokenManager.getTokenStatus();
        if (status.tiktok.hasToken && status.tiktok.isValid) {
            return { 
                status: 'connected',
                message: 'TikTok token geçerli',
                expires_in: Math.round(status.tiktok.expiresIn / 1000 / 60) + ' dakika'
            };
        }
        throw new Error('TikTok token geçersiz veya süresi dolmuş');
    }
    
    /**
     * Meta API - Doğrudan çağrı (CORS sorunu yok)
     */
    async makeMetaAPICall(endpoint, options = {}) {
        const token = await this.tokenManager.getValidToken('meta');
        
        const url = new URL(`https://graph.facebook.com/v18.0${endpoint}`);
        url.searchParams.append('access_token', token);
        
        const response = await fetch(url.toString(), {
            ...options,
            headers: { 'Content-Type': 'application/json', ...options.headers }
        });
        
        const data = await response.json();
        if (data.error) throw new Error(`Meta API Error: ${data.error.message}`);
        return data;
    }
    
    /**
     * TikTok - Explicit proxy call
     */
    async callTikTokViaProxy(endpoint, body = {}) {
        const token = await this.tokenManager.getValidToken('tiktok');
        
        const response = await fetch(`${this.backendUrl}/api/tiktok/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: token, ...body })
        });
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'API call failed');
        return data.data;
    }
    
    /**
     * Meta - Explicit proxy call
     */
    async callMetaViaProxy(endpoint, body = {}) {
        const token = await this.tokenManager.getValidToken('meta');
        
        const response = await fetch(`${this.backendUrl}/api/meta/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: token, ...body })
        });
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'API call failed');
        return data.data;
    }
}

// CSS & Init
const style = document.createElement('style');
style.textContent = `@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`;
document.head.appendChild(style);

window.tokenManager = new TokenManager();
window.apiClient = new APIClient(window.tokenManager);

console.log('🔐 ATLAS Token Manager v2.3 yüklendi');
console.log('📡 Backend:', window.tokenManager.backendUrl);
console.log('ℹ️ TikTok API çağrıları backend proxy üzerinden yapılıyor (CORS fix)');

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TokenManager, APIClient };
}
