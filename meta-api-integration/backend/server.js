/**
 * Meta Marketing API Backend
 * Time & Growity - Segment Kütüphanesi Entegrasyonu
 * 
 * Bu server, Meta API'den audience size ve reach estimation çeker
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// CONFIGURATION
// ============================================
const META_API_VERSION = 'v18.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// Environment variables (.env dosyasından)
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;

// ============================================
// INTEREST/BEHAVIOR ID MAPPING
// Segment kütüphanesindeki segmentlerin Meta karşılıkları
// ============================================
const SEGMENT_MAPPINGS = {
    // Yaşam Tarzı Segmentleri
    'yt-1': { // Trendsetter Öncüler
        name: 'Trendsetter Öncüler',
        meta_interests: [
            { id: '6003598022003', name: 'Early adopters' },
            { id: '6003384829667', name: 'Technology early adopters' },
            { id: '6003397425735', name: 'Gadgets' }
        ]
    },
    'yt-2': { // Statü Odaklı Profesyoneller
        name: 'Statü Odaklı Profesyoneller',
        meta_interests: [
            { id: '6003259044570', name: 'Luxury goods' },
            { id: '6003575012564', name: 'Business' },
            { id: '6003020834693', name: 'Entrepreneurship' }
        ]
    },
    'yt-3': { // Deneyim Avcıları
        name: 'Deneyim Avcıları',
        meta_interests: [
            { id: '6003139266461', name: 'Travel' },
            { id: '6003384829667', name: 'Adventure travel' },
            { id: '6003349442805', name: 'Outdoor recreation' }
        ]
    },
    'yt-4': { // Wellness Tutkunları
        name: 'Wellness Tutkunları',
        meta_interests: [
            { id: '6003384829667', name: 'Health and wellness' },
            { id: '6003205524858', name: 'Yoga' },
            { id: '6003107902433', name: 'Organic food' }
        ]
    },
    
    // Tüketim Alışkanlıkları
    'tk-1': { // Premium Tüketiciler
        name: 'Premium Tüketiciler',
        meta_interests: [
            { id: '6003259044570', name: 'Luxury goods' },
            { id: '6003456630858', name: 'Premium products' }
        ],
        meta_behaviors: [
            { id: '6002714895372', name: 'Engaged shoppers' }
        ]
    },
    'tk-2': { // Değer Arayanlar
        name: 'Değer Arayanlar',
        meta_interests: [
            { id: '6003348500347', name: 'Coupons' },
            { id: '6003263791754', name: 'Discount stores' }
        ]
    },
    
    // Dijital Davranış
    'dj-1': { // Dijital Yerliler
        name: 'Dijital Yerliler',
        meta_behaviors: [
            { id: '6015559470583', name: 'Technology early adopters' },
            { id: '6002714898572', name: 'Smartphone owners' }
        ]
    },
    'dj-2': { // Sosyal Medya Aktifi
        name: 'Sosyal Medya Aktifi',
        meta_behaviors: [
            { id: '6002714898572', name: 'Active social media users' }
        ]
    },
    
    // Enerjisa Segmentleri
    'inf-1': { // Hane Halkları - Kesintisiz Enerji
        name: 'Hane Halkları - Kesintisiz Enerji',
        meta_interests: [
            { id: '6003456630858', name: 'Home improvement' },
            { id: '6003348500347', name: 'Energy efficiency' }
        ],
        meta_demographics: {
            home_type: ['Homeowners']
        }
    },
    'inf-3': { // Mobil Kullanıcılar
        name: 'Mobil Kullanıcılar',
        meta_behaviors: [
            { id: '6002714898572', name: 'Smartphone owners' },
            { id: '6015559470583', name: 'Mobile app users' }
        ]
    },
    'inf-4': { // Küçük İşletmeler
        name: 'Küçük İşletmeler',
        meta_interests: [
            { id: '6003575012564', name: 'Small business' },
            { id: '6003020834693', name: 'Entrepreneurship' }
        ]
    },
    
    // Otomobil Segmentleri (PO için önemli)
    'ot-1': { // Premium Araç Sahipleri
        name: 'Premium Araç Sahipleri',
        meta_interests: [
            { id: '6003456630858', name: 'Luxury vehicles' },
            { id: '6003139266461', name: 'BMW' },
            { id: '6003139266461', name: 'Mercedes-Benz' }
        ]
    },
    'ot-4': { // Elektrik/Hibrit İlgili
        name: 'Elektrik/Hibrit İlgili',
        meta_interests: [
            { id: '6003139266461', name: 'Electric vehicles' },
            { id: '6003139266461', name: 'Tesla Motors' },
            { id: '6003139266461', name: 'Hybrid vehicles' }
        ]
    }
};

// ============================================
// API ENDPOINTS
// ============================================

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        meta_connected: !!ACCESS_TOKEN 
    });
});

/**
 * Tüm segment'lerin audience size'larını getir
 */
app.get('/api/segments/sizes', async (req, res) => {
    try {
        const results = {};
        
        for (const [segmentId, segmentData] of Object.entries(SEGMENT_MAPPINGS)) {
            try {
                const size = await getAudienceSize(segmentData);
                results[segmentId] = {
                    name: segmentData.name,
                    audience_size: size,
                    last_updated: new Date().toISOString()
                };
            } catch (err) {
                results[segmentId] = {
                    name: segmentData.name,
                    audience_size: null,
                    error: err.message
                };
            }
        }
        
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Tek bir segment'in detaylı bilgisini getir
 */
app.get('/api/segments/:segmentId/size', async (req, res) => {
    const { segmentId } = req.params;
    const segmentData = SEGMENT_MAPPINGS[segmentId];
    
    if (!segmentData) {
        return res.status(404).json({ error: 'Segment not found' });
    }
    
    try {
        const size = await getAudienceSize(segmentData);
        const reachEstimate = await getReachEstimate(segmentData);
        
        res.json({
            segment_id: segmentId,
            name: segmentData.name,
            audience_size: size,
            reach_estimate: reachEstimate,
            meta_targeting: segmentData,
            last_updated: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Reach & Frequency tahmini al
 */
app.post('/api/reach-estimate', async (req, res) => {
    const { segment_ids, budget, duration_days = 30 } = req.body;
    
    if (!segment_ids || !Array.isArray(segment_ids)) {
        return res.status(400).json({ error: 'segment_ids array required' });
    }
    
    try {
        // Tüm segment'lerin interest'lerini birleştir
        const allInterests = [];
        const allBehaviors = [];
        
        segment_ids.forEach(segId => {
            const segment = SEGMENT_MAPPINGS[segId];
            if (segment) {
                if (segment.meta_interests) {
                    allInterests.push(...segment.meta_interests);
                }
                if (segment.meta_behaviors) {
                    allBehaviors.push(...segment.meta_behaviors);
                }
            }
        });
        
        const targetingSpec = buildTargetingSpec(allInterests, allBehaviors);
        const estimate = await getReachEstimateWithBudget(targetingSpec, budget, duration_days);
        
        res.json({
            segment_ids,
            targeting_spec: targetingSpec,
            estimate,
            last_updated: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Interest arama (yeni hedefleme bulmak için)
 */
app.get('/api/search/interests', async (req, res) => {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
        return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }
    
    try {
        const response = await axios.get(`${META_BASE_URL}/search`, {
            params: {
                type: 'adinterest',
                q: q,
                access_token: ACCESS_TOKEN
            }
        });
        
        res.json(response.data.data || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Targeting suggestions al (önerilen hedeflemeler)
 */
app.get('/api/targeting-suggestions', async (req, res) => {
    const { interest_ids } = req.query;
    
    try {
        const response = await axios.get(
            `${META_BASE_URL}/act_${AD_ACCOUNT_ID}/targetingsuggestions`,
            {
                params: {
                    targeting_list: JSON.stringify(
                        interest_ids.split(',').map(id => ({ id, type: 'interests' }))
                    ),
                    access_token: ACCESS_TOKEN
                }
            }
        );
        
        res.json(response.data.data || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Segment için audience size hesapla
 */
async function getAudienceSize(segmentData) {
    const targetingSpec = buildTargetingSpec(
        segmentData.meta_interests || [],
        segmentData.meta_behaviors || []
    );
    
    try {
        const response = await axios.get(
            `${META_BASE_URL}/act_${AD_ACCOUNT_ID}/reachestimate`,
            {
                params: {
                    targeting_spec: JSON.stringify(targetingSpec),
                    access_token: ACCESS_TOKEN
                }
            }
        );
        
        const data = response.data.data;
        return {
            lower_bound: data.users_lower_bound,
            upper_bound: data.users_upper_bound,
            estimate: Math.round((data.users_lower_bound + data.users_upper_bound) / 2)
        };
    } catch (error) {
        console.error('Audience size error:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Reach estimate al
 */
async function getReachEstimate(segmentData) {
    const targetingSpec = buildTargetingSpec(
        segmentData.meta_interests || [],
        segmentData.meta_behaviors || []
    );
    
    try {
        const response = await axios.get(
            `${META_BASE_URL}/act_${AD_ACCOUNT_ID}/reachestimate`,
            {
                params: {
                    targeting_spec: JSON.stringify(targetingSpec),
                    optimize_for: 'REACH',
                    access_token: ACCESS_TOKEN
                }
            }
        );
        
        return response.data.data;
    } catch (error) {
        console.error('Reach estimate error:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Bütçe bazlı reach/frequency tahmini
 */
async function getReachEstimateWithBudget(targetingSpec, budget, durationDays) {
    try {
        const response = await axios.get(
            `${META_BASE_URL}/act_${AD_ACCOUNT_ID}/reachfrequencypredictions`,
            {
                params: {
                    targeting_spec: JSON.stringify(targetingSpec),
                    budget: budget * 100, // Meta uses cents
                    destination_id: AD_ACCOUNT_ID,
                    prediction_mode: 0, // Reach optimized
                    reach_frequency_spec: JSON.stringify({
                        min_reach_limits: {},
                        max_reach_limits: {}
                    }),
                    start_time: Math.floor(Date.now() / 1000),
                    end_time: Math.floor(Date.now() / 1000) + (durationDays * 24 * 60 * 60),
                    access_token: ACCESS_TOKEN
                }
            }
        );
        
        return response.data;
    } catch (error) {
        console.error('Reach frequency error:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Targeting spec oluştur
 */
function buildTargetingSpec(interests = [], behaviors = []) {
    const spec = {
        geo_locations: {
            countries: ['TR'] // Türkiye
        },
        age_min: 18,
        age_max: 65
    };
    
    if (interests.length > 0) {
        spec.flexible_spec = [{
            interests: interests.map(i => ({ id: i.id, name: i.name }))
        }];
    }
    
    if (behaviors.length > 0) {
        if (!spec.flexible_spec) spec.flexible_spec = [{}];
        spec.flexible_spec[0].behaviors = behaviors.map(b => ({ id: b.id, name: b.name }));
    }
    
    return spec;
}

// ============================================
// SERVER START
// ============================================
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║  Meta API Backend Server                              ║
║  Time & Growity - Segment Kütüphanesi                 ║
╠═══════════════════════════════════════════════════════╣
║  Port: ${PORT}                                           ║
║  API Version: ${META_API_VERSION}                              ║
║  Token: ${ACCESS_TOKEN ? '✓ Configured' : '✗ Missing'}                       ║
║  Ad Account: ${AD_ACCOUNT_ID ? '✓ Configured' : '✗ Missing'}                   ║
╚═══════════════════════════════════════════════════════╝

Endpoints:
  GET  /api/health                    - Health check
  GET  /api/segments/sizes            - Tüm segment boyutları
  GET  /api/segments/:id/size         - Tek segment detayı
  POST /api/reach-estimate            - Reach/Frequency tahmini
  GET  /api/search/interests?q=       - Interest arama
  GET  /api/targeting-suggestions     - Önerilen hedeflemeler
    `);
});
