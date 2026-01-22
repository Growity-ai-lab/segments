/**
 * ATLAS TikTok API Backend Proxy
 * Bu sunucu TikTok Business API ile iletişim kurar ve CORS sorunlarını çözer.
 * 
 * Deploy: Vercel, Render, Railway veya Heroku
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS ayarları - sadece ATLAS domain'inden gelen isteklere izin ver
const corsOptions = {
    origin: [
        'https://growity-ai-lab.github.io',
        'http://localhost:3000',
        'http://127.0.0.1:5500' // Local development
    ],
    methods: ['GET', 'POST'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// TikTok API Config
const TIKTOK_CONFIG = {
    appId: process.env.TIKTOK_APP_ID || '7598110409156984833',
    appSecret: process.env.TIKTOK_APP_SECRET || '1c5b38fb69f512a8db47f11067015884c00aed44',
    apiVersion: 'v1.3',
    baseUrl: 'https://business-api.tiktok.com/open_api'
};

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'ATLAS TikTok API Proxy',
        version: '1.0.0',
        endpoints: [
            'POST /api/tiktok/token - Access token al',
            'POST /api/tiktok/interests - Interest kategorileri',
            'POST /api/tiktok/audience-size - Audience büyüklüğü tahmini'
        ]
    });
});

// ============================================
// 1. ACCESS TOKEN ENDPOINT
// ============================================
app.post('/api/tiktok/token', async (req, res) => {
    try {
        const { auth_code } = req.body;
        
        if (!auth_code) {
            return res.status(400).json({ error: 'auth_code gerekli' });
        }

        const response = await fetch(`${TIKTOK_CONFIG.baseUrl}/${TIKTOK_CONFIG.apiVersion}/oauth2/access_token/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                app_id: TIKTOK_CONFIG.appId,
                secret: TIKTOK_CONFIG.appSecret,
                auth_code: auth_code
            })
        });

        const data = await response.json();
        
        if (data.code === 0) {
            res.json({
                success: true,
                data: {
                    access_token: data.data.access_token,
                    advertiser_ids: data.data.advertiser_ids,
                    scope: data.data.scope
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: data.message,
                code: data.code
            });
        }
    } catch (error) {
        console.error('Token exchange error:', error);
        res.status(500).json({ error: 'Token exchange failed', details: error.message });
    }
});

// ============================================
// 2. INTEREST CATEGORIES ENDPOINT
// ============================================
app.post('/api/tiktok/interests', async (req, res) => {
    try {
        const { access_token, advertiser_id } = req.body;
        
        if (!access_token || !advertiser_id) {
            return res.status(400).json({ error: 'access_token ve advertiser_id gerekli' });
        }

        // Interest kategorilerini al
        const response = await fetch(
            `${TIKTOK_CONFIG.baseUrl}/${TIKTOK_CONFIG.apiVersion}/tool/interest_category/?advertiser_id=${advertiser_id}`,
            {
                method: 'GET',
                headers: {
                    'Access-Token': access_token,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = await response.json();
        
        if (data.code === 0) {
            res.json({
                success: true,
                data: data.data
            });
        } else {
            res.status(400).json({
                success: false,
                error: data.message,
                code: data.code
            });
        }
    } catch (error) {
        console.error('Interest fetch error:', error);
        res.status(500).json({ error: 'Interest fetch failed', details: error.message });
    }
});

// ============================================
// 3. INTEREST KEYWORD SEARCH ENDPOINT
// ============================================
app.post('/api/tiktok/interest-search', async (req, res) => {
    try {
        const { access_token, advertiser_id, keyword } = req.body;
        
        if (!access_token || !advertiser_id || !keyword) {
            return res.status(400).json({ error: 'access_token, advertiser_id ve keyword gerekli' });
        }

        const response = await fetch(
            `${TIKTOK_CONFIG.baseUrl}/${TIKTOK_CONFIG.apiVersion}/tool/interest_keyword/recommend/`,
            {
                method: 'POST',
                headers: {
                    'Access-Token': access_token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    advertiser_id: advertiser_id,
                    keyword: keyword,
                    language: 'tr' // Türkçe
                })
            }
        );

        const data = await response.json();
        
        if (data.code === 0) {
            res.json({
                success: true,
                data: data.data
            });
        } else {
            res.status(400).json({
                success: false,
                error: data.message,
                code: data.code
            });
        }
    } catch (error) {
        console.error('Interest search error:', error);
        res.status(500).json({ error: 'Interest search failed', details: error.message });
    }
});

// ============================================
// 4. AUDIENCE SIZE ESTIMATION ENDPOINT
// ============================================
app.post('/api/tiktok/audience-size', async (req, res) => {
    try {
        const { access_token, advertiser_id, targeting } = req.body;
        
        if (!access_token || !advertiser_id) {
            return res.status(400).json({ error: 'access_token ve advertiser_id gerekli' });
        }

        // Varsayılan Türkiye hedeflemesi
        const defaultTargeting = {
            location_ids: ['6252001'], // Türkiye
            age_groups: ['AGE_18_24', 'AGE_25_34', 'AGE_35_44', 'AGE_45_54'],
            ...targeting
        };

        const response = await fetch(
            `${TIKTOK_CONFIG.baseUrl}/${TIKTOK_CONFIG.apiVersion}/tool/audience_size/`,
            {
                method: 'POST',
                headers: {
                    'Access-Token': access_token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    advertiser_id: advertiser_id,
                    ...defaultTargeting
                })
            }
        );

        const data = await response.json();
        
        if (data.code === 0) {
            res.json({
                success: true,
                data: data.data
            });
        } else {
            res.status(400).json({
                success: false,
                error: data.message,
                code: data.code
            });
        }
    } catch (error) {
        console.error('Audience size error:', error);
        res.status(500).json({ error: 'Audience size estimation failed', details: error.message });
    }
});

// ============================================
// 5. REFRESH TOKEN ENDPOINT
// ============================================
app.post('/api/tiktok/refresh-token', async (req, res) => {
    try {
        const { refresh_token } = req.body;
        
        if (!refresh_token) {
            return res.status(400).json({ error: 'refresh_token gerekli' });
        }

        const response = await fetch(`${TIKTOK_CONFIG.baseUrl}/${TIKTOK_CONFIG.apiVersion}/oauth2/refresh_token/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                app_id: TIKTOK_CONFIG.appId,
                secret: TIKTOK_CONFIG.appSecret,
                refresh_token: refresh_token
            })
        });

        const data = await response.json();
        
        if (data.code === 0) {
            res.json({
                success: true,
                data: {
                    access_token: data.data.access_token,
                    refresh_token: data.data.refresh_token
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: data.message,
                code: data.code
            });
        }
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Token refresh failed', details: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════╗
    ║   ATLAS TikTok API Proxy                  ║
    ║   Running on port ${PORT}                     ║
    ║   Ready to handle requests! 🚀            ║
    ╚═══════════════════════════════════════════╝
    `);
});

module.exports = app; // Vercel için export
