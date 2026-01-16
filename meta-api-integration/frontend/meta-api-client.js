/**
 * Meta API Client
 * Segment Kütüphanesi Frontend Entegrasyonu
 * 
 * Bu dosyayı index.html'e ekle veya ayrı bir script olarak import et
 */

class MetaAPIClient {
    constructor(baseUrl = 'http://localhost:3001/api') {
        this.baseUrl = baseUrl;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 dakika cache
    }

    /**
     * API health check
     */
    async checkHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            return await response.json();
        } catch (error) {
            console.error('Meta API bağlantı hatası:', error);
            return { status: 'error', error: error.message };
        }
    }

    /**
     * Tüm segment boyutlarını getir
     */
    async getAllSegmentSizes() {
        const cacheKey = 'all_sizes';
        
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const response = await fetch(`${this.baseUrl}/segments/sizes`);
            const data = await response.json();
            
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
            return data;
        } catch (error) {
            console.error('Segment sizes error:', error);
            return null;
        }
    }

    /**
     * Tek segment detayı
     */
    async getSegmentSize(segmentId) {
        const cacheKey = `segment_${segmentId}`;
        
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const response = await fetch(`${this.baseUrl}/segments/${segmentId}/size`);
            const data = await response.json();
            
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
            return data;
        } catch (error) {
            console.error('Segment size error:', error);
            return null;
        }
    }

    /**
     * Reach/Frequency tahmini
     */
    async getReachEstimate(segmentIds, budget, durationDays = 30) {
        try {
            const response = await fetch(`${this.baseUrl}/reach-estimate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segment_ids: segmentIds,
                    budget: budget,
                    duration_days: durationDays
                })
            });
            return await response.json();
        } catch (error) {
            console.error('Reach estimate error:', error);
            return null;
        }
    }

    /**
     * Interest arama
     */
    async searchInterests(query) {
        try {
            const response = await fetch(`${this.baseUrl}/search/interests?q=${encodeURIComponent(query)}`);
            return await response.json();
        } catch (error) {
            console.error('Interest search error:', error);
            return [];
        }
    }

    /**
     * Sayıyı formatla (1.2M, 850K gibi)
     */
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(0) + 'K';
        }
        return num.toString();
    }

    /**
     * Range formatla (1.2M - 1.5M gibi)
     */
    formatRange(lower, upper) {
        return `${this.formatNumber(lower)} - ${this.formatNumber(upper)}`;
    }
}

// ============================================
// SEGMENT KÜTÜPHANESI ENTEGRASYONU
// ============================================

/**
 * Segment kartlarına Meta data ekle
 */
async function enhanceSegmentsWithMetaData() {
    const client = new MetaAPIClient();
    
    // API bağlantısını kontrol et
    const health = await client.checkHealth();
    if (health.status !== 'ok') {
        console.warn('Meta API bağlı değil, statik veriler kullanılıyor');
        return;
    }

    // Tüm segment boyutlarını çek
    const sizes = await client.getAllSegmentSizes();
    if (!sizes) return;

    // Her segment için UI güncelle
    Object.entries(sizes).forEach(([segmentId, data]) => {
        const segmentElement = document.querySelector(`[data-segment-id="${segmentId}"]`);
        if (segmentElement && data.audience_size) {
            // Meta reach badge ekle
            const metaBadge = document.createElement('span');
            metaBadge.className = 'meta-reach-badge';
            metaBadge.innerHTML = `
                <span class="meta-icon">📊</span>
                <span class="meta-size">${client.formatRange(
                    data.audience_size.lower_bound,
                    data.audience_size.upper_bound
                )}</span>
                <span class="meta-live">LIVE</span>
            `;
            
            const metaContainer = segmentElement.querySelector('.sub-meta') || segmentElement;
            metaContainer.appendChild(metaBadge);
        }
    });
}

/**
 * Seçili segmentler için reach tahmini göster
 */
async function showReachEstimateForSelection(selectedSegmentIds, budget) {
    const client = new MetaAPIClient();
    
    const estimate = await client.getReachEstimate(selectedSegmentIds, budget);
    if (!estimate) return null;

    return {
        reach: estimate.estimate?.reach,
        frequency: estimate.estimate?.frequency,
        impressions: estimate.estimate?.impressions,
        cpm: estimate.estimate?.cpm
    };
}

/**
 * Interest arama modal
 */
async function showInterestSearchModal() {
    const client = new MetaAPIClient();
    
    // Modal HTML oluştur
    const modal = document.createElement('div');
    modal.className = 'interest-search-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>🔍 Meta Interest Arama</h3>
                <button class="close-btn" onclick="this.closest('.interest-search-modal').remove()">✕</button>
            </div>
            <div class="modal-body">
                <input type="text" id="interestSearchInput" placeholder="Interest ara (örn: travel, fitness)..." />
                <div id="interestResults" class="interest-results"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Arama input listener
    const input = document.getElementById('interestSearchInput');
    const results = document.getElementById('interestResults');
    let debounceTimer;

    input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const query = e.target.value;
            if (query.length < 2) {
                results.innerHTML = '<p class="hint">En az 2 karakter girin</p>';
                return;
            }

            results.innerHTML = '<p class="loading">Aranıyor...</p>';
            const interests = await client.searchInterests(query);
            
            if (interests.length === 0) {
                results.innerHTML = '<p class="no-results">Sonuç bulunamadı</p>';
                return;
            }

            results.innerHTML = interests.map(interest => `
                <div class="interest-item" data-id="${interest.id}">
                    <div class="interest-name">${interest.name}</div>
                    <div class="interest-size">${client.formatNumber(interest.audience_size || 0)} kişi</div>
                    <button class="add-btn" onclick="addInterestToSegment('${interest.id}', '${interest.name}')">+ Ekle</button>
                </div>
            `).join('');
        }, 300);
    });
}

// ============================================
// CSS STYLES (head'e ekle)
// ============================================
const metaStyles = `
<style>
.meta-reach-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: linear-gradient(135deg, rgba(24,119,242,0.2), rgba(24,119,242,0.1));
    border: 1px solid rgba(24,119,242,0.3);
    border-radius: 12px;
    font-size: 9px;
    font-family: 'Space Mono', monospace;
}

.meta-icon { font-size: 10px; }
.meta-size { color: #60a5fa; font-weight: 600; }
.meta-live {
    background: #10b981;
    color: #000;
    padding: 1px 4px;
    border-radius: 4px;
    font-size: 7px;
    font-weight: bold;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
}

.interest-search-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}

.interest-search-modal .modal-content {
    background: #1a1a24;
    border-radius: 16px;
    width: 500px;
    max-height: 80vh;
    overflow: hidden;
    border: 1px solid #2a2a3a;
}

.interest-search-modal .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #2a2a3a;
}

.interest-search-modal .modal-body {
    padding: 20px;
}

.interest-search-modal input {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid #2a2a3a;
    border-radius: 8px;
    background: #12121a;
    color: #fff;
    font-size: 14px;
    margin-bottom: 16px;
}

.interest-results {
    max-height: 400px;
    overflow-y: auto;
}

.interest-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: #12121a;
    border-radius: 8px;
    margin-bottom: 8px;
}

.interest-name { font-size: 13px; font-weight: 500; }
.interest-size { font-size: 11px; color: #8888a0; }

.add-btn {
    padding: 6px 12px;
    background: #1877f2;
    border: none;
    border-radius: 6px;
    color: #fff;
    font-size: 11px;
    cursor: pointer;
}

.add-btn:hover { background: #1565c0; }
</style>
`;

// Sayfa yüklendiğinde styles ekle
if (typeof document !== 'undefined') {
    document.head.insertAdjacentHTML('beforeend', metaStyles);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MetaAPIClient, enhanceSegmentsWithMetaData, showReachEstimateForSelection };
}
