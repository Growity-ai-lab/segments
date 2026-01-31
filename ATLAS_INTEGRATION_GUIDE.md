# ATLAS API Monitoring & Token Management
## Kurulum ve Entegrasyon Kılavuzu

Bu doküman ATLAS projesi için geliştirilen API monitoring ve token management sistemlerinin kurulumu ve kullanımını açıklar.

## 🚀 Hızlı Başlangıç

### 1. Dosyaları Projenize Ekleyin

```html
<!-- HTML sayfanızın <head> bölümüne ekleyin -->
<script src="api-health-monitor.js"></script>
<script src="token-manager.js"></script>
```

### 2. Sistemleri Initialize Edin

```javascript
// Sayfa yüklendiğinde otomatik başlar
// Global instance'lar hazır: window.apiHealthMonitor, window.tokenManager, window.apiClient
```

### 3. Token'ları Ayarlayın

```javascript
// Meta API token'ları
window.tokenManager.setTokens('meta', {
    appId: 'YOUR_META_APP_ID',
    appSecret: 'YOUR_META_APP_SECRET',
    accessToken: 'YOUR_META_ACCESS_TOKEN',
    expiresIn: 5184000 // 60 gün (saniye)
});

// TikTok API token'ları
window.tokenManager.setTokens('tiktok', {
    accessToken: 'YOUR_TIKTOK_ACCESS_TOKEN',
    refreshToken: 'YOUR_TIKTOK_REFRESH_TOKEN',
    expiresIn: 86400 // 24 saat (saniye)
});
```

## 📊 API Health Monitoring

### Temel Kullanım

```javascript
// Manuel health check tetikle
await window.apiHealthMonitor.triggerManualCheck();

// Health status'u dinle
document.addEventListener('apiHealthUpdate', (event) => {
    const healthData = event.detail;
    console.log('Overall status:', healthData.overall);
    console.log('Meta API:', healthData.platforms.meta.status);
    console.log('TikTok API:', healthData.platforms.tiktok.status);
});

// Monitoring'i durdur/başlat
window.apiHealthMonitor.stopMonitoring();
window.apiHealthMonitor.startMonitoring(5); // 5 dakikada bir check
```

### Health Status'leri

- **healthy**: API normal çalışıyor (yanıt süresi <5s, başarı oranı >80%)
- **degraded**: API yavaşlamış (yanıt süresi yüksek veya başarı oranı düşük)
- **down**: API çalışmıyor (3+ ardışık hata)
- **unknown**: Henüz test edilmedi

### Custom Alert'ler

```javascript
// Health threshold'larını özelleştir
window.apiHealthMonitor.alertThreshold = {
    responseTime: 3000, // 3 saniye
    failureCount: 2,    // 2 ardışık hata
    successRate: 90     // %90'ın altı
};

// Custom alert handler
document.addEventListener('apiHealthUpdate', (event) => {
    const { overall } = event.detail;
    
    if (overall === 'critical') {
        // Kritik durum - Slack/email notification gönder
        sendCriticalAlert();
    }
});
```

## 🔑 Token Management

### Token Status Kontrolü

```javascript
// Tüm token'ların durumunu kontrol et
const status = window.tokenManager.getTokenStatus();
console.log('Meta token valid:', status.meta.isValid);
console.log('TikTok token expires in:', status.tiktok.expiresIn);

// Specific platform token'ının geçerli olup olmadığını kontrol et
const isMetaValid = window.tokenManager.isTokenValid('meta');
```

### Otomatik Token Refresh

```javascript
// Token event'leri dinle
window.tokenManager.addEventListener('refreshed', (eventData) => {
    console.log(`${eventData.platform} token yenilendi`);
});

window.tokenManager.addEventListener('refresh_failed', (eventData) => {
    console.error(`${eventData.platform} token yenileme hatası:`, eventData.data);
});

// Manuel token refresh
await window.tokenManager.refreshPlatformToken('meta');
await window.tokenManager.refreshPlatformToken('tiktok');
```

### Safe API Calls

```javascript
// Token management ile entegre API calls
try {
    // Meta API call (otomatik token refresh ile)
    const metaResponse = await window.apiClient.makeMetaAPICall('/me/adaccounts');
    
    // TikTok API call (otomatik token refresh ile)
    const tiktokResponse = await window.apiClient.makeTikTokAPICall('/oauth2/advertiser/get/');
    
} catch (error) {
    console.error('API call failed:', error);
    // Token problemi olabilir, kullanıcıyı yeniden authenticate etmeye yönlendir
}
```

## 🔧 ATLAS Projesi Entegrasyonu

### Mevcut Segmentasyon Sayfalarına Entegrasyon

```javascript
// segment-page.html içine ekleyin
class SegmentManager {
    constructor() {
        this.tokenManager = window.tokenManager;
        this.apiClient = window.apiClient;
        
        // Token event'lerini dinle
        this.setupTokenEventHandlers();
    }
    
    setupTokenEventHandlers() {
        document.addEventListener('tokenEvent', (event) => {
            const { platform, eventType } = event.detail;
            
            if (eventType === 'refresh_failed') {
                this.showTokenError(platform);
            }
        });
    }
    
    async updateSegmentAudienceSize(segmentId, targeting) {
        try {
            // Loading state göster
            this.setSegmentStatus(segmentId, 'loading');
            
            // Paralel olarak Meta ve TikTok'tan audience size al
            const [metaSize, tiktokSize] = await Promise.allSettled([
                this.getMetaAudienceSize(targeting),
                this.getTikTokAudienceSize(targeting)
            ]);
            
            // UI'yi güncelle
            this.updateSegmentUI(segmentId, {
                meta: metaSize.status === 'fulfilled' ? metaSize.value : null,
                tiktok: tiktokSize.status === 'fulfilled' ? tiktokSize.value : null,
                lastUpdated: new Date()
            });
            
            this.setSegmentStatus(segmentId, 'completed');
            
        } catch (error) {
            console.error('Segment update failed:', error);
            this.setSegmentStatus(segmentId, 'error');
        }
    }
    
    async getMetaAudienceSize(targeting) {
        // Meta Ads API ile audience size estimation
        const response = await this.apiClient.makeMetaAPICall(
            `/act_${META_AD_ACCOUNT_ID}/delivery_estimate`,
            {
                method: 'POST',
                body: JSON.stringify({
                    targeting_spec: this.convertToMetaTargeting(targeting),
                    optimization_goal: 'REACH'
                })
            }
        );
        
        return response.estimate_ready ? response.estimate_dau : null;
    }
    
    async getTikTokAudienceSize(targeting) {
        // TikTok Ads API ile audience size estimation
        const response = await this.apiClient.makeTikTokAPICall(
            '/tool/target_recommend/',
            {
                method: 'POST',
                body: JSON.stringify({
                    advertiser_id: TIKTOK_ADVERTISER_ID,
                    target_audience: this.convertToTikTokTargeting(targeting)
                })
            }
        );
        
        return response.audience_size;
    }
    
    setSegmentStatus(segmentId, status) {
        const statusElement = document.querySelector(`[data-segment="${segmentId}"] .status`);
        if (statusElement) {
            statusElement.className = `status ${status}`;
            statusElement.textContent = this.getStatusText(status);
        }
    }
    
    getStatusText(status) {
        const texts = {
            loading: 'Güncelleniyor...',
            completed: 'Güncel',
            error: 'Hata',
            stale: 'Eski Veri'
        };
        return texts[status] || status;
    }
    
    showTokenError(platform) {
        // Token hatası durumunda kullanıcıyı bilgilendir
        const notification = document.createElement('div');
        notification.className = 'token-error-notification';
        notification.innerHTML = `
            <div class="alert alert-warning">
                <strong>${platform} API Token Hatası!</strong>
                <p>Token'ınızın süresi dolmuş olabilir. Lütfen yeniden giriş yapın.</p>
                <button onclick="this.closest('.alert').remove()">Kapat</button>
            </div>
        `;
        document.body.appendChild(notification);
    }
}

// Segment manager'ı başlat
window.segmentManager = new SegmentManager();
```

### Auto-Update Sistemi

```javascript
// Segment'leri otomatik güncelle
class SegmentAutoUpdater {
    constructor(segmentManager) {
        this.segmentManager = segmentManager;
        this.updateQueue = new Map();
        this.isProcessing = false;
        
        this.startAutoUpdate();
    }
    
    startAutoUpdate() {
        // Her 15 dakikada bir eski segment'leri kontrol et
        setInterval(() => {
            this.checkStaleSegments();
        }, 15 * 60 * 1000);
        
        // API health'e göre update frequency'yi ayarla
        document.addEventListener('apiHealthUpdate', (event) => {
            this.adjustUpdateFrequency(event.detail.overall);
        });
    }
    
    adjustUpdateFrequency(healthStatus) {
        // API sağlıklıysa daha sık, problemliyse daha seyrek güncelle
        if (healthStatus === 'healthy') {
            this.updateInterval = 15 * 60 * 1000; // 15 dakika
        } else if (healthStatus === 'warning') {
            this.updateInterval = 30 * 60 * 1000; // 30 dakika
        } else {
            this.updateInterval = 60 * 60 * 1000; // 1 saat
        }
    }
    
    async checkStaleSegments() {
        const segments = document.querySelectorAll('[data-segment]');
        const staleSegments = [];
        
        segments.forEach(segment => {
            const segmentId = segment.dataset.segment;
            const lastUpdate = segment.dataset.lastUpdate;
            
            if (!lastUpdate || Date.now() - new Date(lastUpdate) > this.updateInterval) {
                staleSegments.push(segmentId);
            }
        });
        
        if (staleSegments.length > 0) {
            console.log(`${staleSegments.length} eski segment güncelleniyor...`);
            
            // Batch update (max 5 paralel)
            const batches = this.chunkArray(staleSegments, 5);
            
            for (const batch of batches) {
                await Promise.allSettled(
                    batch.map(segmentId => this.updateSegment(segmentId))
                );
                
                // Rate limiting için bekleme
                await this.sleep(2000);
            }
        }
    }
    
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Auto-updater'ı başlat
window.segmentAutoUpdater = new SegmentAutoUpdater(window.segmentManager);
```

## 🎯 Sorunlu "Bekliyor" Durumunu Çözme

### Problem: API çağrıları sürekli bekliyor
### Çözüm: Timeout ve retry logic

```javascript
// Mevcut API çağrılarınızı bu şekilde sarın
async function robustAPICall(apiFunction, maxRetries = 3, timeout = 30000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Timeout wrapper
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), timeout)
            );
            
            const apiPromise = apiFunction();
            
            // Race between API call and timeout
            const result = await Promise.race([apiPromise, timeoutPromise]);
            
            return result;
            
        } catch (error) {
            console.warn(`API call attempt ${attempt}/${maxRetries} failed:`, error.message);
            
            if (attempt === maxRetries) {
                throw new Error(`API call failed after ${maxRetries} attempts: ${error.message}`);
            }
            
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
}

// Kullanım örneği
async function updateSegmentWithRetry(segmentId, targeting) {
    try {
        const result = await robustAPICall(
            () => window.apiClient.makeMetaAPICall('/audience/estimate', {
                method: 'POST',
                body: JSON.stringify(targeting)
            }),
            3, // 3 deneme
            15000 // 15 saniye timeout
        );
        
        // Başarılı result'u işle
        updateSegmentDisplay(segmentId, result);
        
    } catch (error) {
        // Son çare olarak cached data kullan veya error state göster
        handleSegmentUpdateError(segmentId, error);
    }
}
```

## 🔍 Debug ve Troubleshooting

### Health Monitoring Logs

```javascript
// Detaylı health data export et
const healthData = window.apiHealthMonitor.exportHealthData();
console.log('Health Export:', healthData);

// Manual health check ve debug
await window.apiHealthMonitor.triggerManualCheck();
window.apiHealthMonitor.printHealthSummary();
```

### Token Debug

```javascript
// Token durumunu debug et
window.tokenManager.logTokenStatus();

// Token data export
const tokenData = window.tokenManager.getTokenStatus();
console.log('Token Export:', tokenData);
```

### Performance Monitoring

```javascript
// API response time monitoring
let responseTimes = [];

async function monitoredAPICall(apiFunction, platform) {
    const startTime = Date.now();
    
    try {
        const result = await apiFunction();
        const responseTime = Date.now() - startTime;
        
        responseTimes.push({
            platform,
            responseTime,
            timestamp: new Date(),
            success: true
        });
        
        return result;
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        
        responseTimes.push({
            platform,
            responseTime,
            timestamp: new Date(),
            success: false,
            error: error.message
        });
        
        throw error;
    }
}

// Performance report
function getPerformanceReport() {
    const recent = responseTimes.slice(-50); // Son 50 call
    
    return {
        avgResponseTime: recent.reduce((sum, r) => sum + r.responseTime, 0) / recent.length,
        successRate: (recent.filter(r => r.success).length / recent.length) * 100,
        slowCalls: recent.filter(r => r.responseTime > 5000),
        errorRate: (recent.filter(r => !r.success).length / recent.length) * 100
    };
}
```

## 📁 Dosya Yapısı

```
atlas/
├── api-health-monitor.js     # API monitoring sistemi
├── token-manager.js          # Token management sistemi  
├── atlas-api-dashboard.html  # Monitoring dashboard
└── existing-files/
    ├── segment-page.html     # Mevcut segment sayfası (güncellenecek)
    ├── po-segmentasyon.html  # Petrol Ofisi segmentasyon
    └── enerjisa-30yil.html   # Enerjisa 30. yıl kampanyası
```

## 🎉 Sonraki Adımlar

1. **Dosyaları projenize ekleyin** ve dashboard'u test edin
2. **Token'larınızı yapılandırın** ve API erişimini doğrulayın  
3. **Mevcut segmentasyon kodunu güncelleyin** robust API calls ile
4. **Auto-update sistemini aktifleştirin** eski segmentleri otomatik güncelleme için
5. **Monitoring'i production'a alın** ve alert sistemini kurun

Bu sistem ile "bekliyor" sorununuz çözülecek ve segmentlerin sürekli güncel kalması sağlanacak! 🚀
