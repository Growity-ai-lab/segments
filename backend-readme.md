# ATLAS TikTok API Backend Proxy

TikTok Business API ile iletişim kuran backend proxy. CORS sorunlarını çözer ve güvenli token yönetimi sağlar.

## 🚀 Hızlı Kurulum

### Seçenek 1: Vercel (Önerilen - Ücretsiz)

1. **GitHub Repo Oluştur**
   ```bash
   cd atlas-backend
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/Growity-ai-lab/atlas-backend.git
   git push -u origin main
   ```

2. **Vercel'e Deploy**
   - https://vercel.com adresine git
   - GitHub ile giriş yap
   - "Import Project" → atlas-backend repo'sunu seç
   - Environment Variables ekle:
     - `TIKTOK_APP_ID`: [TikTok Developer Portal'dan al]
     - `TIKTOK_APP_SECRET`: [TikTok Developer Portal'dan al]
     - `META_APP_ID`: [Meta Developer Portal'dan al]
     - `META_APP_SECRET`: [Meta Developer Portal'dan al]
   - "Deploy" tıkla

   > ⚠️ **GÜVENLİK UYARISI:** Secret'ları asla koda veya dokümantasyona yazmayın! 
   > Sadece Vercel Environment Variables kullanın.

3. **URL'i Al**
   - Deploy sonrası `https://atlas-backend-xxx.vercel.app` gibi bir URL alacaksın
   - Bu URL'i ATLAS frontend'ine ekle

### Seçenek 2: Railway (Ücretsiz)

1. https://railway.app adresine git
2. GitHub ile giriş yap
3. "New Project" → "Deploy from GitHub repo"
4. atlas-backend seç
5. Environment variables ekle
6. Otomatik deploy olacak

### Seçenek 3: Render (Ücretsiz)

1. https://render.com adresine git
2. "New Web Service" tıkla
3. GitHub repo bağla
4. Environment: Node
5. Build Command: `npm install`
6. Start Command: `npm start`
7. Environment variables ekle

## 📡 API Endpoints

### Health Check
```
GET /
```

### Access Token Al
```
POST /api/tiktok/token
Body: { "auth_code": "xxx" }
```

### Interest Kategorileri
```
POST /api/tiktok/interests
Body: { "access_token": "xxx", "advertiser_id": "xxx" }
```

### Interest Arama
```
POST /api/tiktok/interest-search
Body: { "access_token": "xxx", "advertiser_id": "xxx", "keyword": "gaming" }
```

### Audience Size Tahmini
```
POST /api/tiktok/audience-size
Body: { 
  "access_token": "xxx", 
  "advertiser_id": "xxx",
  "targeting": { "interest_ids": ["123"] }
}
```

### Token Yenileme
```
POST /api/tiktok/refresh-token
Body: { "refresh_token": "xxx" }
```

## 🔧 Local Development

```bash
# Bağımlılıkları yükle
npm install

# .env dosyası oluştur
cp .env.example .env
# .env dosyasına kendi secret'larını ekle

# Geliştirme modunda çalıştır
npm run dev

# Production modunda çalıştır
npm start
```

## 🔐 Güvenlik

- ✅ API secret'ları sadece backend'de environment variables olarak tutulur
- ✅ Secret'lar asla koda veya dokümantasyona yazılmaz
- ✅ CORS sadece izinli domain'lere açık
- ⚠️ Rate limiting eklenebilir (production için önerilir)

## 📊 Frontend Entegrasyonu

ATLAS frontend'inde backend URL'ini güncelle:

```javascript
const BACKEND_URL = 'https://atlas-backend-xxx.vercel.app';

// Token al
const response = await fetch(`${BACKEND_URL}/api/tiktok/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth_code: authCode })
});
```

## 📝 Lisans

MIT © Growity AI Lab
