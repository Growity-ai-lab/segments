/**
 * ATLAS API Health Monitoring System
 * Meta ve TikTok API'lerinin sağlık durumunu izler
 */

class APIHealthMonitor {
    constructor() {
        this.healthStatus = {
            meta: {
                status: 'unknown',
                lastCheck: null,
                responseTime: null,
                lastError: null,
                successRate: 100,
                consecutiveFailures: 0
            },
            tiktok: {
                status: 'unknown',
                lastCheck: null,
                responseTime: null,
                lastError: null,
                successRate: 100,
                consecutiveFailures: 0
            }
        };
        
        this.checkInterval = null;
        this.alertThreshold = {
            responseTime: 5000, // 5 saniye
            failureCount: 3,    // Üst üste 3 hata
            successRate: 80     // %80'in altı
        };
        
        this.recentChecks = {
            meta: [],
            tiktok: []
        };
        
        this.maxRecentChecks = 20; // Son 20 check'i sakla
        
        this.initializeUI();
        this.startMonitoring();
    }

    /**
     * Health monitoring başlat
     */
    startMonitoring(intervalMinutes = 2) {
        console.log('🔍 API Health Monitoring başlatıldı...');
        
        // İlk check'i hemen yap
        this.checkAllAPIs();
        
        // Periyodik check'leri başlat
        this.checkInterval = setInterval(() => {
            this.checkAllAPIs();
        }, intervalMinutes * 60 * 1000);
    }

    /**
     * Monitoring durdur
     */
    stopMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('⏹️ API Health Monitoring durduruldu');
        }
    }

    /**
     * Tüm API'leri kontrol et
     */
    async checkAllAPIs() {
        console.log('🔍 API health check başlatıldı...');
        
        const checks = [
            this.checkMetaAPI(),
            this.checkTikTokAPI()
        ];

        await Promise.allSettled(checks);
        this.updateHealthSummary();
        this.notifyHealthStatus();
    }

    /**
     * Meta API health check
     */
    async checkMetaAPI() {
        const platform = 'meta';
        const startTime = Date.now();
        
        try {
            // Meta API test endpoint'i
            const testParams = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            // Test request - platform status endpoint
            const response = await this.makeHealthCheckRequest(
                'https://graph.facebook.com/v18.0/me/adaccounts',
                testParams
            );
            
            const responseTime = Date.now() - startTime;
            const isSuccess = response.status < 400;
            
            this.updatePlatformHealth(platform, {
                success: isSuccess,
                responseTime,
                error: isSuccess ? null : `HTTP ${response.status}`,
                details: await response.text()
            });

        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.updatePlatformHealth(platform, {
                success: false,
                responseTime,
                error: error.message,
                details: error.toString()
            });
        }
    }

    /**
     * TikTok API health check
     */
    async checkTikTokAPI() {
        const platform = 'tiktok';
        const startTime = Date.now();
        
        try {
            // TikTok API test endpoint'i
            const testParams = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            // Test request
            const response = await this.makeHealthCheckRequest(
                'https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/',
                testParams
            );
            
            const responseTime = Date.now() - startTime;
            const isSuccess = response.status < 400;
            
            this.updatePlatformHealth(platform, {
                success: isSuccess,
                responseTime,
                error: isSuccess ? null : `HTTP ${response.status}`,
                details: await response.text()
            });

        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.updatePlatformHealth(platform, {
                success: false,
                responseTime,
                error: error.message,
                details: error.toString()
            });
        }
    }

    /**
     * Health check request'i yap (timeout ile)
     */
    async makeHealthCheckRequest(url, params) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        try {
            const response = await fetch(url, {
                ...params,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Platform health durumunu güncelle
     */
    updatePlatformHealth(platform, result) {
        const now = new Date();
        const health = this.healthStatus[platform];
        
        // Response time güncelle
        health.responseTime = result.responseTime;
        health.lastCheck = now;
        
        // Recent checks'e ekle
        this.recentChecks[platform].push({
            timestamp: now,
            success: result.success,
            responseTime: result.responseTime,
            error: result.error
        });
        
        // Eski check'leri temizle
        if (this.recentChecks[platform].length > this.maxRecentChecks) {
            this.recentChecks[platform] = this.recentChecks[platform].slice(-this.maxRecentChecks);
        }
        
        // Success rate hesapla
        const recentResults = this.recentChecks[platform];
        const successCount = recentResults.filter(r => r.success).length;
        health.successRate = recentResults.length > 0 
            ? Math.round((successCount / recentResults.length) * 100)
            : 100;
        
        // Consecutive failures güncelle
        if (result.success) {
            health.consecutiveFailures = 0;
            health.lastError = null;
        } else {
            health.consecutiveFailures++;
            health.lastError = result.error;
        }
        
        // Status belirle
        health.status = this.determineHealthStatus(platform);
        
        console.log(`📊 ${platform.toUpperCase()} API Health:`, {
            status: health.status,
            responseTime: `${health.responseTime}ms`,
            successRate: `${health.successRate}%`,
            consecutiveFailures: health.consecutiveFailures
        });
    }

    /**
     * Platform health status'unu belirle
     */
    determineHealthStatus(platform) {
        const health = this.healthStatus[platform];
        
        // Down durumu
        if (health.consecutiveFailures >= this.alertThreshold.failureCount) {
            return 'down';
        }
        
        // Degraded durumu
        if (health.successRate < this.alertThreshold.successRate ||
            health.responseTime > this.alertThreshold.responseTime) {
            return 'degraded';
        }
        
        // Healthy durumu
        return 'healthy';
    }

    /**
     * Genel health summary'si güncelle
     */
    updateHealthSummary() {
        const metaHealth = this.healthStatus.meta.status;
        const tiktokHealth = this.healthStatus.tiktok.status;
        
        let overallStatus;
        if (metaHealth === 'down' || tiktokHealth === 'down') {
            overallStatus = 'critical';
        } else if (metaHealth === 'degraded' || tiktokHealth === 'degraded') {
            overallStatus = 'warning';
        } else {
            overallStatus = 'healthy';
        }
        
        this.overallStatus = overallStatus;
    }

    /**
     * UI'ya health status bildir
     */
    notifyHealthStatus() {
        const statusEvent = new CustomEvent('apiHealthUpdate', {
            detail: {
                overall: this.overallStatus,
                platforms: this.healthStatus,
                timestamp: new Date()
            }
        });
        
        document.dispatchEvent(statusEvent);
        
        // Console'a özet yazdır
        this.printHealthSummary();
    }

    /**
     * Health summary'sini console'a yazdır
     */
    printHealthSummary() {
        console.log('📋 API Health Summary:', {
            overall: this.overallStatus,
            meta: `${this.healthStatus.meta.status} (${this.healthStatus.meta.successRate}%)`,
            tiktok: `${this.healthStatus.tiktok.status} (${this.healthStatus.tiktok.successRate}%)`,
            lastCheck: new Date().toLocaleTimeString('tr-TR')
        });
    }

    /**
     * UI elementlerini initialize et
     */
    initializeUI() {
        // Health indicator UI element'ini oluştur
        if (!document.getElementById('api-health-indicator')) {
            this.createHealthIndicatorUI();
        }
        
        // Event listener'ları ekle
        document.addEventListener('apiHealthUpdate', (event) => {
            this.updateHealthUI(event.detail);
        });
    }

    /**
     * Health indicator UI oluştur
     */
    createHealthIndicatorUI() {
        const indicator = document.createElement('div');
        indicator.id = 'api-health-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 9999;
            padding: 8px 12px;
            border-radius: 6px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            font-weight: 600;
            color: white;
            cursor: pointer;
            transition: all 0.3s ease;
        `;
        
        indicator.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px;">
                <span id="health-status-icon">⚪</span>
                <span id="health-status-text">API Durumu</span>
            </div>
        `;
        
        // Click event - detaylı bilgi göster
        indicator.addEventListener('click', () => {
            this.showDetailedHealthInfo();
        });
        
        document.body.appendChild(indicator);
    }

    /**
     * Health UI'sını güncelle
     */
    updateHealthUI(healthData) {
        const indicator = document.getElementById('api-health-indicator');
        const icon = document.getElementById('health-status-icon');
        const text = document.getElementById('health-status-text');
        
        if (!indicator || !icon || !text) return;
        
        const statusConfig = {
            healthy: { color: '#10b981', icon: '🟢', text: 'API Sağlıklı' },
            warning: { color: '#f59e0b', icon: '🟡', text: 'API Uyarı' },
            critical: { color: '#ef4444', icon: '🔴', text: 'API Sorun' }
        };
        
        const config = statusConfig[healthData.overall] || statusConfig.warning;
        
        indicator.style.backgroundColor = config.color;
        icon.textContent = config.icon;
        text.textContent = config.text;
    }

    /**
     * Detaylı health bilgisi göster
     */
    showDetailedHealthInfo() {
        const modal = this.createHealthModal();
        document.body.appendChild(modal);
        
        // Modal'ı göster
        requestAnimationFrame(() => {
            modal.style.opacity = '1';
        });
    }

    /**
     * Health detail modal'ını oluştur
     */
    createHealthModal() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        content.innerHTML = this.generateHealthReport();
        
        // Close event
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.opacity = '0';
                setTimeout(() => modal.remove(), 300);
            }
        });
        
        modal.appendChild(content);
        return modal;
    }

    /**
     * Health raporu generate et
     */
    generateHealthReport() {
        const meta = this.healthStatus.meta;
        const tiktok = this.healthStatus.tiktok;
        
        return `
            <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; color: #1f2937;">API Sağlık Durumu</h3>
                <div style="margin-bottom: 8px; color: #6b7280; font-size: 14px;">
                    Son güncelleme: ${new Date().toLocaleString('tr-TR')}
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin: 0 0 8px 0; color: #374151;">Meta API</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px;">
                    <div>Durum: <span style="color: ${this.getStatusColor(meta.status)}">${this.getStatusText(meta.status)}</span></div>
                    <div>Başarı Oranı: <span style="color: ${meta.successRate >= 90 ? '#10b981' : meta.successRate >= 70 ? '#f59e0b' : '#ef4444'}">${meta.successRate}%</span></div>
                    <div>Yanıt Süresi: ${meta.responseTime ? meta.responseTime + 'ms' : 'N/A'}</div>
                    <div>Ardışık Hata: ${meta.consecutiveFailures}</div>
                </div>
                ${meta.lastError ? `<div style="margin-top: 8px; padding: 8px; background: #fef2f2; color: #dc2626; border-radius: 6px; font-size: 12px;">Son Hata: ${meta.lastError}</div>` : ''}
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin: 0 0 8px 0; color: #374151;">TikTok API</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px;">
                    <div>Durum: <span style="color: ${this.getStatusColor(tiktok.status)}">${this.getStatusText(tiktok.status)}</span></div>
                    <div>Başarı Oranı: <span style="color: ${tiktok.successRate >= 90 ? '#10b981' : tiktok.successRate >= 70 ? '#f59e0b' : '#ef4444'}">${tiktok.successRate}%</span></div>
                    <div>Yanıt Süresi: ${tiktok.responseTime ? tiktok.responseTime + 'ms' : 'N/A'}</div>
                    <div>Ardışık Hata: ${tiktok.consecutiveFailures}</div>
                </div>
                ${tiktok.lastError ? `<div style="margin-top: 8px; padding: 8px; background: #fef2f2; color: #dc2626; border-radius: 6px; font-size: 12px;">Son Hata: ${tiktok.lastError}</div>` : ''}
            </div>
            
            <button onclick="this.closest('div').dispatchEvent(new Event('click'))" style="
                width: 100%;
                padding: 12px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                cursor: pointer;
                transition: background 0.2s;
            " onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
                Kapat
            </button>
        `;
    }

    /**
     * Status rengini al
     */
    getStatusColor(status) {
        const colors = {
            healthy: '#10b981',
            degraded: '#f59e0b',
            down: '#ef4444',
            unknown: '#6b7280'
        };
        return colors[status] || colors.unknown;
    }

    /**
     * Status metnini al
     */
    getStatusText(status) {
        const texts = {
            healthy: 'Sağlıklı',
            degraded: 'Yavaşlamış',
            down: 'Çalışmıyor',
            unknown: 'Bilinmiyor'
        };
        return texts[status] || texts.unknown;
    }

    /**
     * Manual health check tetikle
     */
    async triggerManualCheck() {
        console.log('🔄 Manuel API health check tetiklendi...');
        await this.checkAllAPIs();
    }

    /**
     * Health verilerini export et
     */
    exportHealthData() {
        return {
            timestamp: new Date(),
            healthStatus: this.healthStatus,
            recentChecks: this.recentChecks,
            overallStatus: this.overallStatus
        };
    }
}

// Global instance oluştur
window.apiHealthMonitor = new APIHealthMonitor();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIHealthMonitor;
}
