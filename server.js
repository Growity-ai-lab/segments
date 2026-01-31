
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const requiredEnvVars = ['TIKTOK_APP_ID', 'TIKTOK_APP_SECRET', 'META_APP_ID', 'META_APP_SECRET'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0 && process.env.NODE_ENV === 'production') {
    console.error('❌ HATA: Eksik environment variables:', missingVars.join(', '));
    console.error('Vercel Dashboard → Settings → Environment Variables kısmından ekleyin.');
    process.exit(1);
}

const corsOptions = {
    origin: [
        'https://growity-ai-lab.github.io',
        'http://localhost:3000',
        'http://127.0.0.1:5500'
    ],
    methods: ['GET', 'POST'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

const TIKTOK_CONFIG = {
    appId: process.env.TIKTOK_APP_ID,
    appSecret: process.env.TIKTOK_APP_SECRET,
    apiVersion: 'v1.3',
    baseUrl: 'https://business-api.tiktok.com/open_api'
};

const META_CONFIG = {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    apiVersion: 'v18.0',
    baseUrl: 'https://graph.facebook.com'
};

app.get('/', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'ATLAS API Proxy',
        version: '2.0.0',
        platforms: ['TikTok', 'Meta'],
        endpoints: {
            tiktok: [
                'POST /api/tiktok/token',
                'POST /api/tiktok/refresh-token',
                'POST /api/tiktok/interests',
                'POST /api/tiktok/interest-search',
                'POST /api/tiktok/audience-size'
            ],
            meta: [
                'POST /api/meta/token',
                'POST /api/meta/refresh-token',
                'POST /api/meta/accounts',
                'POST /api/meta/insights'
            ]
        },
        security: {
            secretsInCode: false,
            environmentVariables: true
        }
    });
});

app.post('/api/tiktok/token', async (req, res) => {
    try {
        const { auth_code } = req.body;
        
        if (!auth_code) {
            return res.status(400).json({ error: 'auth_code gerekli' });
        }

        const response = await fetch(`${TIKTOK_CONFIG.baseUrl}/${TIKTOK_CONFIG.apiVersion}/oauth2/access_token/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
                    refresh_token: data.data.refresh_token,
                    advertiser_ids: data.data.advertiser_ids,
                    scope: data.data.scope,
                    expires_in: data.data.access_token_expire_in
                }
            });
        } else {
            res.status(400).json({ success: false, error: data.message, code: data.code });
        }
    } catch (error) {
        console.error('TikTok token error:', error);
        res.status(500).json({ error: 'Token exchange failed', details: error.message });
    }
});

app.post('/api/tiktok/refresh-token', async (req, res) => {
    try {
        const { refresh_token } = req.body;
        
        if (!refresh_token) {
            return res.status(400).json({ error: 'refresh_token gerekli' });
        }

        const response = await fetch(`${TIKTOK_CONFIG.baseUrl}/${TIKTOK_CONFIG.apiVersion}/oauth2/refresh_token/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
                    refresh_token: data.data.refresh_token,
                    expires_in: data.data.access_token_expire_in
                }
            });
        } else {
            res.status(400).json({ success: false, error: data.message, code: data.code });
        }
    } catch (error) {
        console.error('TikTok refresh error:', error);
        res.status(500).json({ error: 'Token refresh failed', details: error.message });
    }
});

app.post('/api/tiktok/interests', async (req, res) => {
    try {
        const { access_token, advertiser_id } = req.body;
        
        if (!access_token || !advertiser_id) {
            return res.status(400).json({ error: 'access_token ve advertiser_id gerekli' });
        }

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
            res.json({ success: true, data: data.data });
        } else {
            res.status(400).json({ success: false, error: data.message, code: data.code });
        }
    } catch (error) {
        console.error('TikTok interests error:', error);
        res.status(500).json({ error: 'Interest fetch failed', details: error.message });
    }
});

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
                    language: 'tr'
                })
            }
        );

        const data = await response.json();
        
        if (data.code === 0) {
            res.json({ success: true, data: data.data });
        } else {
            res.status(400).json({ success: false, error: data.message, code: data.code });
        }
    } catch (error) {
        console.error('TikTok interest search error:', error);
        res.status(500).json({ error: 'Interest search failed', details: error.message });
    }
});

app.post('/api/tiktok/audience-size', async (req, res) => {
    try {
        const { access_token, advertiser_id, targeting } = req.body;
        
        if (!access_token || !advertiser_id) {
            return res.status(400).json({ error: 'access_token ve advertiser_id gerekli' });
        }

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
            res.json({ success: true, data: data.data });
        } else {
            res.status(400).json({ success: false, error: data.message, code: data.code });
        }
    } catch (error) {
        console.error('TikTok audience size error:', error);
        res.status(500).json({ error: 'Audience size estimation failed', details: error.message });
    }
});

app.post('/api/meta/token', async (req, res) => {
    try {
        const { auth_code, redirect_uri } = req.body;
        
        if (!auth_code || !redirect_uri) {
            return res.status(400).json({ error: 'auth_code ve redirect_uri gerekli' });
        }

        const tokenResponse = await fetch(`${META_CONFIG.baseUrl}/${META_CONFIG.apiVersion}/oauth/access_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: META_CONFIG.appId,
                client_secret: META_CONFIG.appSecret,
                redirect_uri: redirect_uri,
                code: auth_code
            })
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            return res.status(400).json({ 
                success: false, 
                error: tokenData.error.message,
                code: tokenData.error.code 
            });
        }

        const longLivedResponse = await fetch(
            `${META_CONFIG.baseUrl}/${META_CONFIG.apiVersion}/oauth/access_token?` +
            `grant_type=fb_exchange_token&` +
            `client_id=${META_CONFIG.appId}&` +
            `client_secret=${META_CONFIG.appSecret}&` +
            `fb_exchange_token=${tokenData.access_token}`,
            { method: 'GET' }
        );

        const longLivedData = await longLivedResponse.json();

        if (longLivedData.error) {
            return res.json({
                success: true,
                data: {
                    access_token: tokenData.access_token,
                    token_type: 'short-lived',
                    expires_in: tokenData.expires_in || 3600
                }
            });
        }

        res.json({
            success: true,
            data: {
                access_token: longLivedData.access_token,
                token_type: 'long-lived',
                expires_in: longLivedData.expires_in || 5184000 
            }
        });

    } catch (error) {
        console.error('Meta token error:', error);
        res.status(500).json({ error: 'Token exchange failed', details: error.message });
    }
});

app.post('/api/meta/refresh-token', async (req, res) => {
    try {
        const { access_token } = req.body;
        
        if (!access_token) {
            return res.status(400).json({ error: 'access_token gerekli' });
        }

        const response = await fetch(
            `${META_CONFIG.baseUrl}/${META_CONFIG.apiVersion}/oauth/access_token?` +
            `grant_type=fb_exchange_token&` +
            `client_id=${META_CONFIG.appId}&` +
            `client_secret=${META_CONFIG.appSecret}&` +
            `fb_exchange_token=${access_token}`,
            { method: 'GET' }
        );

        const data = await response.json();

        if (data.error) {
            return res.status(400).json({ 
                success: false, 
                error: data.error.message,
                code: data.error.code 
            });
        }

        res.json({
            success: true,
            data: {
                access_token: data.access_token,
                expires_in: data.expires_in || 5184000
            }
        });

    } catch (error) {
        console.error('Meta refresh error:', error);
        res.status(500).json({ error: 'Token refresh failed', details: error.message });
    }
});

app.post('/api/meta/accounts', async (req, res) => {
    try {
        const { access_token } = req.body;
        
        if (!access_token) {
            return res.status(400).json({ error: 'access_token gerekli' });
        }

        const response = await fetch(
            `${META_CONFIG.baseUrl}/${META_CONFIG.apiVersion}/me/adaccounts?` +
            `fields=id,name,account_status,currency,business_name&` +
            `access_token=${access_token}`,
            { method: 'GET' }
        );

        const data = await response.json();

        if (data.error) {
            return res.status(400).json({ 
                success: false, 
                error: data.error.message,
                code: data.error.code 
            });
        }

        res.json({
            success: true,
            data: data.data || []
        });

    } catch (error) {
        console.error('Meta accounts error:', error);
        res.status(500).json({ error: 'Accounts fetch failed', details: error.message });
    }
});

app.post('/api/meta/insights', async (req, res) => {
    try {
        const { access_token, account_id, date_preset, fields } = req.body;
        
        if (!access_token || !account_id) {
            return res.status(400).json({ error: 'access_token ve account_id gerekli' });
        }

        const defaultFields = 'campaign_name,impressions,clicks,spend,cpc,cpm,reach,frequency';
        const datePreset = date_preset || 'last_30d';

        const response = await fetch(
            `${META_CONFIG.baseUrl}/${META_CONFIG.apiVersion}/${account_id}/insights?` +
            `level=campaign&` +
            `fields=${fields || defaultFields}&` +
            `date_preset=${datePreset}&` +
            `access_token=${access_token}`,
            { method: 'GET' }
        );

        const data = await response.json();

        if (data.error) {
            return res.status(400).json({ 
                success: false, 
                error: data.error.message,
                code: data.error.code 
            });
        }

        res.json({
            success: true,
            data: data.data || []
        });

    } catch (error) {
        console.error('Meta insights error:', error);
        res.status(500).json({ error: 'Insights fetch failed', details: error.message });
    }
});

app.use((req, res) => {
    res.status(404).json({ 
        error: 'Endpoint bulunamadı',
        availableEndpoints: '/ adresine GET request atarak tüm endpoint\'leri görebilirsiniz'
    });
});

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Bir hata oluştu'
    });
});

app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════════╗
    ║   ATLAS API Proxy v2.0                        ║
    ║   Running on port ${PORT}                         ║
    ║   Platforms: TikTok, Meta                     ║
    ║   Security: Environment Variables Only ✅      ║
    ╚═══════════════════════════════════════════════╝
    `);
});

module.exports = app;
