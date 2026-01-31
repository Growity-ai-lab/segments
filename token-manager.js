class TokenManager {
    constructor() {
        this.backendUrl = 'https://atlas-taupe-alpha.vercel.app';
        
        this.redirectUri = 'https://growity-ai-lab.github.io/atlas/';
        
        this.config = {
            meta: {
                appId: '1722819475770536' 
            },
            tiktok: {
                appId: '7598110409156984833' 
            }
        };
        
        this.tokens = {
            meta: {
                accessToken: null,
                expiresAt: null,
                isRefreshing: false
            },
            tiktok: {
                accessToken: null,
                refreshToken: null,
                expiresAt: null,
                advertiserIds: [],
                isRefreshing: false
            }
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
            
            console.log('✅ Token\'lar localStorage\'dan yüklendi');
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

    setupAuthHandlers() {
        this.handleAuthCallback();
        window.startTikTokAuth = () => this.startTikTokAuth();
        window.startMetaAuth = () => this.startMetaAuth();
    }

    startTikTokAuth() {
        const state = 'tiktok_auth_' + Date.now();
        localStorage.setItem('atlas_auth_state', state);
        
        const authUrl = `https://business-api.tiktok.com/portal/auth?` +
            `app_id=${this.config.tiktok.appId}&` +
            `state=${state}&` +
            `redirect_uri=${encodeURIComponent(this.redirectUri)}`;
        
        console.log('🚀 TikTok OAuth başlatılıyor...');
        window.location.href = authUrl;
    }
    
    startMetaAuth() {
        const state = 'meta_auth_' + Date.now();
        localStorage.setItem('atlas_auth_state', state);
        
        const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
            `client_id=${this.config.meta.appId}&` +
            `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
            `state=${state}&` +
            `scope=ads_management,ads_read,business_management&` +
            `response_type=code`;
        
        console.log('🚀 Meta OAuth başlatılıyor...');
        window.location.href = authUrl;
    }

    handleAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const authCode = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        
        if (error) {
            console.error('OAuth error:', error);
            this.showNotification(`OAuth hatası: ${error}`, 'error');
            return;
        }
        
        if (authCode && state) {
            console.log('🔑 Auth code alındı, backend\'e gönderiliyor...');
            
            if (state.includes('tiktok')) {
                this.exchangeTikTokToken(authCode);
            } else if (state.includes('meta')) {
                this.exchangeMetaToken(authCode);
            }
            
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
                
                console.log('✅ TikTok authentication başarılı!');
                this.showNotification('TikTok bağlantısı başarılı!', 'success');
            } else {
                throw new Error(data.error || 'Token alınamadı');
            }
        } catch (error) {
            console.error('❌ TikTok token hatası:', error);
            this.showNotification(`TikTok hatası: ${error.message}`, 'error');
        }
    }
    
    async exchangeMetaToken(authCode) {
        try {
            this.showNotification('Meta token alınıyor...', 'info');
            
            const response = await fetch(`${this.backendUrl}/api/meta/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    auth_code: authCode,
                    redirect_uri: this.redirectUri
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.tokens.meta.accessToken = data.data.access_token;
                this.tokens.meta.expiresAt = Date.now() + ((data.data.expires_in || 5184000) * 1000);
                
                this.saveTokensToStorage();
                this.emitTokenEvent('meta', 'updated');
                
                console.log('✅ Meta authentication başarılı!');
                this.showNotification('Meta bağlantısı başarılı!', 'success');
            } else {
                throw new Error(data.error || 'Token alınamadı');
            }
        } catch (error) {
            console.error('❌ Meta token hatası:', error);
            this.showNotification(`Meta hatası: ${error.message}`, 'error');
        }
    }

    async refreshTikTokToken() {
        if (this.tokens.tiktok.isRefreshing) return;
        if (!this.tokens.tiktok.refreshToken) {
            console.warn('TikTok refresh token yok, yeniden auth gerekli');
            return;
        }
        
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
                
                console.log('🔄 TikTok token yenilendi');
            }
        } catch (error) {
            console.error('TikTok refresh hatası:', error);
            this.emitTokenEvent('tiktok', 'error');
        } finally {
            this.tokens.tiktok.isRefreshing = false;
        }
    }
    
    async refreshMetaToken() {
        if (this.tokens.meta.isRefreshing) return;
        if (!this.tokens.meta.accessToken) return;
        
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
                
                console.log('🔄 Meta token yenilendi');
            }
        } catch (error) {
            console.error('Meta refresh hatası:', error);
            this.emitTokenEvent('meta', 'error');
        } finally {
            this.tokens.meta.isRefreshing = false;
        }
    }
    
    startTokenMonitoring() {
        setInterval(() => {
            if (this.shouldRefreshToken('tiktok')) {
                this.refreshTikTokToken();
            }
            if (this.shouldRefreshToken('meta')) {
                this.refreshMetaToken();
            }
        }, 5 * 60 * 1000);
    }
    
    shouldRefreshToken(platform) {
        const token = this.tokens[platform];
        if (!token.accessToken || !token.expiresAt) return false;
        return token.expiresAt - Date.now() < this.refreshBuffer;
    }
    
    isTokenValid(platform) {
        const token = this.tokens[platform];
        if (!token.accessToken) return false;
        if (!token.expiresAt) return true;
        return token.expiresAt > Date.now();
    }

    async getValidToken(platform) {
        const token = this.tokens[platform];
        
        if (!token.accessToken) {
            throw new Error(`${platform} token bulunamadı. Lütfen önce bağlantı kurun.`);
        }
        
        if (this.shouldRefreshToken(platform)) {
            if (platform === 'tiktok') {
                await this.refreshTikTokToken();
            } else {
                await this.refreshMetaToken();
            }
        }
        
        return token.accessToken;
    }
    
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
                    Math.max(0, this.tokens.tiktok.expiresAt - Date.now()) : null,
                advertiserIds: this.tokens.tiktok.advertiserIds
            }
        };
    }
    
    clearPlatformTokens(platform) {
        this.tokens[platform] = {
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            isRefreshing: false
        };
        
        localStorage.removeItem(`atlas_${platform}_tokens`);
        this.emitTokenEvent(platform, 'cleared');
        
        console.log(`🗑️ ${platform} token'ları temizlendi`);
    }
    
    clearAllTokens() {
        this.clearPlatformTokens('meta');
        this.clearPlatformTokens('tiktok');
    }

    emitTokenEvent(platform, eventType, data = null) {
        const event = new CustomEvent('tokenEvent', {
            detail: {
                platform,
                eventType,
                timestamp: new Date(),
                data,
                tokenInfo: this.getTokenStatus()[platform]
            }
        });
        
        this.eventEmitter.dispatchEvent(event);
        document.dispatchEvent(event);
    }
    
    addEventListener(eventType, listener) {
        this.eventEmitter.addEventListener('tokenEvent', (event) => {
            if (!eventType || event.detail.eventType === eventType) {
                listener(event.detail);
            }
        });
    }
    
    showNotification(message, type = 'info') {
        const colors = {
            success: '#10B981',
            error: '#EF4444',
            info: '#3B82F6',
            warning: '#F59E0B'
        };
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            background: ${colors[type]};
            color: white;
            border-radius: 8px;
            font-family: system-ui, sans-serif;
            font-size: 14px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }
    
    logTokenStatus() {
        const status = this.getTokenStatus();
        console.log('🔑 Token Status:', {
            meta: {
                hasToken: status.meta.hasToken,
                isValid: status.meta.isValid,
                expiresIn: status.meta.expiresIn ? 
                    `${Math.round(status.meta.expiresIn / 1000 / 60)} dakika` : 'N/A'
            },
            tiktok: {
                hasToken: status.tiktok.hasToken,
                isValid: status.tiktok.isValid,
                expiresIn: status.tiktok.expiresIn ? 
                    `${Math.round(status.tiktok.expiresIn / 1000 / 60)} dakika` : 'N/A',
                advertiserIds: status.tiktok.advertiserIds
            }
        });
    }
}

class APIClient {
    constructor(tokenManager) {
        this.tokenManager = tokenManager;
        this.backendUrl = tokenManager.backendUrl;
    }
    
    async makeTikTokAPICall(endpoint, options = {}) {
        const token = await this.tokenManager.getValidToken('tiktok');
        
        const response = await fetch(`https://business-api.tiktok.com/open_api/v1.3${endpoint}`, {
            ...options,
            headers: {
                'Access-Token': token,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        const data = await response.json();
        
        if (data.code !== 0) {
            throw new Error(`TikTok API Error: ${data.message}`);
        }
        
        return data.data;
    }
    
    async makeMetaAPICall(endpoint, options = {}) {
        const token = await this.tokenManager.getValidToken('meta');
        
        const url = new URL(`https://graph.facebook.com/v18.0${endpoint}`);
        url.searchParams.append('access_token', token);
        
        const response = await fetch(url.toString(), {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(`Meta API Error: ${data.error.message}`);
        }
        
        return data;
    }
    
    async callTikTokViaProxy(endpoint, body = {}) {
        const token = await this.tokenManager.getValidToken('tiktok');
        
        const response = await fetch(`${this.backendUrl}/api/tiktok/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: token,
                ...body
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'API call failed');
        }
        
        return data.data;
    }
    
    async callMetaViaProxy(endpoint, body = {}) {
        const token = await this.tokenManager.getValidToken('meta');
        
        const response = await fetch(`${this.backendUrl}/api/meta/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: token,
                ...body
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'API call failed');
        }
        
        return data.data;
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

window.tokenManager = new TokenManager();
window.apiClient = new APIClient(window.tokenManager);

console.log('🔐 ATLAS Token Manager v2.0 (Secure) yüklendi');
console.log('📡 Backend:', window.tokenManager.backendUrl);

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TokenManager, APIClient };
}
