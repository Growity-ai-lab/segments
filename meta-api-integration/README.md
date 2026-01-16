# Meta Marketing API Entegrasyonu
## Time & Growity - Segment Kütüphanesi

Bu entegrasyon, Segment Kütüphanesi'ne Meta'dan canlı audience size ve reach tahminleri çeker.

---

## 🚀 Hızlı Başlangıç

### 1. Meta Business Manager Kurulumu

#### 1.1 App Oluştur
1. [developers.facebook.com](https://developers.facebook.com) adresine git
2. "My Apps" → "Create App"
3. "Other" → "Business" type seç
4. App adı: "TG Segment Tool" (veya istediğin isim)

#### 1.2 Marketing API Ekle
1. App Dashboard → "Add Products"
2. "Marketing API" → "Set Up"

#### 1.3 System User Oluştur (Önerilir - Uzun Ömürlü Token)
1. [Business Settings](https://business.facebook.com/settings) → "System Users"
2. "Add" → İsim ver → "Admin" rolü
3. "Generate Token" → Marketing API izinlerini seç:
   - `ads_management`
   - `ads_read`
   - `business_management`
4. Token'ı kopyala → `.env` dosyasına yapıştır

#### 1.4 Ad Account ID Bul
1. Business Settings → "Ad Accounts"
2. Account ID'yi kopyala (örn: `123456789`)

---

### 2. Backend Kurulumu

```bash
# Klasöre git
cd backend

# Dependencies yükle
npm install

# .env dosyası oluştur
cp .env.example .env

# .env dosyasını düzenle
nano .env
```

**.env içeriği:**
```
META_ACCESS_TOKEN=EAAxxxxxxxxxx...
META_AD_ACCOUNT_ID=123456789
PORT=3001
```

```bash
# Server'ı başlat
npm start

# Veya development mode (auto-reload)
npm run dev
```

**Test et:**
```bash
curl http://localhost:3001/api/health
# {"status":"ok","meta_connected":true}

curl http://localhost:3001/api/segments/yt-1/size
# {"segment_id":"yt-1","name":"Trendsetter Öncüler","audience_size":{"lower_bound":1200000,"upper_bound":1500000}}
```

---

### 3. Frontend Entegrasyonu

#### Seçenek A: Script olarak ekle
```html
<!-- index.html'e ekle -->
<script src="meta-api-client.js"></script>
<script>
    // Sayfa yüklendiğinde Meta verilerini çek
    document.addEventListener('DOMContentLoaded', async () => {
        await enhanceSegmentsWithMetaData();
    });
</script>
```

#### Seçenek B: Mevcut segments array'e entegre et
```javascript
// Segment render fonksiyonunda
async function renderSegments(filter, search) {
    const client = new MetaAPIClient();
    const metaSizes = await client.getAllSegmentSizes();
    
    // Her segment için
    segments.forEach(parent => {
        parent.subs.forEach(sub => {
            if (metaSizes[sub.id]) {
                sub.metaReach = metaSizes[sub.id].audience_size;
            }
        });
    });
    
    // Normal render devam...
}
```

---

## 📊 API Endpoints

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/api/health` | GET | Bağlantı kontrolü |
| `/api/segments/sizes` | GET | Tüm segment boyutları |
| `/api/segments/:id/size` | GET | Tek segment detayı |
| `/api/reach-estimate` | POST | Reach/Frequency tahmini |
| `/api/search/interests` | GET | Interest arama |

### Örnek: Reach Tahmini
```javascript
// 3 segment için 100.000 TL bütçe ile 30 günlük reach tahmini
const estimate = await fetch('/api/reach-estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        segment_ids: ['yt-1', 'tk-1', 'dj-2'],
        budget: 100000,
        duration_days: 30
    })
});
```

---

## 🔧 Segment Mapping Güncelleme

Yeni segment eklemek için `server.js`'teki `SEGMENT_MAPPINGS` objesini güncelle:

```javascript
const SEGMENT_MAPPINGS = {
    'yeni-segment-id': {
        name: 'Yeni Segment Adı',
        meta_interests: [
            { id: '6003139266461', name: 'Interest Adı' }
        ],
        meta_behaviors: [
            { id: '6002714895372', name: 'Behavior Adı' }
        ]
    }
};
```

### Interest ID Nasıl Bulunur?
```bash
# API ile arama
curl "http://localhost:3001/api/search/interests?q=travel"

# Veya Meta'nın Audience Insights tool'unu kullan
```

---

## 🏗️ Production Deployment

### Seçenek 1: VPS (DigitalOcean, Hetzner, vs.)
```bash
# PM2 ile çalıştır
npm install -g pm2
pm2 start server.js --name "meta-api"
pm2 save
pm2 startup
```

### Seçenek 2: Heroku
```bash
heroku create tg-meta-api
heroku config:set META_ACCESS_TOKEN=xxx
heroku config:set META_AD_ACCOUNT_ID=xxx
git push heroku main
```

### Seçenek 3: Railway / Render
- GitHub repo bağla
- Environment variables ekle
- Auto-deploy

---

## ⚠️ Önemli Notlar

1. **Token Güvenliği**: Access token'ı asla frontend'de kullanma, her zaman backend üzerinden çağır

2. **Rate Limits**: Meta API'nin rate limitleri var, cache kullan (client.js'te 5 dk cache var)

3. **Token Yenileme**: System User token'ları uzun ömürlü ama yine de kontrol et

4. **Sandbox Mode**: Test için sandbox mode kullanabilirsin (gerçek data göstermez)

---

## 📈 Gelecek Geliştirmeler

- [ ] Custom Audience sync (CRM listesi yükleme)
- [ ] Lookalike audience oluşturma
- [ ] Kampanya performans verisi çekme
- [ ] Google Ads API entegrasyonu
- [ ] TikTok Marketing API entegrasyonu
- [ ] Otomatik segment öneri sistemi

---

## 🆘 Sorun Giderme

**"Invalid OAuth access token"**
→ Token'ı yenile veya izinleri kontrol et

**"User does not have permission"**
→ System User'a Ad Account erişimi ver

**"Rate limit exceeded"**
→ Cache süresini artır veya request azalt

---

## 📞 Destek

Sorularınız için: [Time & Growity](https://growity.com.tr)
