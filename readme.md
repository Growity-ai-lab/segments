# 🎯 Segment Analiz Aracı

Time & Growity tarafından geliştirilen interaktif hedef kitle segment analiz ve görselleştirme aracı.

## 🔗 Demo

- **Segment Kütüphanesi**: [https://growity-ai-lab.github.io/segments/](https://growity-ai-lab.github.io/segments/)
- **Segment Analizi**: [https://growity-ai-lab.github.io/segments/segmentation-quadrant/](https://growity-ai-lab.github.io/segments/segmentation-quadrant/)

---

## 📊 Nasıl Çalışır?

### 1️⃣ Segment Seçimi (Ana Sayfa)
- 30 ana segment kategorisi, 120+ alt segment
- Filtreleme ve arama
- Çoklu seçim yaparak analiz sayfasına gönderme

### 2️⃣ Segment Analizi (3 Görünüm)

| Tab | Açıklama |
|-----|----------|
| 📊 **Quadrant** | 2x2 matris görselleştirmesi |
| 🔵 **Kesişim Analizi** | Venn diagram ile segment kesişimleri |
| 📋 **Karşılaştırma** | Tablo formatında metrik karşılaştırması |

---

## 🎯 Quadrant Eksenleri

| Eksen | Açıklama |
|-------|----------|
| **X - Erişilebilirlik** | Hedefe ulaşma kolaylığı, platform varlığı, targeting opsiyonları |
| **Y - Değer Potansiyeli** | Müşteri değeri, sepet büyüklüğü, LTV potansiyeli |
| **Boyut** | Erişim hacmi (elle düzenlenebilir) |

### Quadrant Bölgeleri

```
┌─────────────────────┬─────────────────────┐
│                     │                     │
│   YATIRIM GEREKLİ   │    🎯 ÖNCELİK      │
│   (Zor + Değerli)   │  (Kolay + Değerli) │
│                     │                     │
├─────────────────────┼─────────────────────┤
│                     │                     │
│  DÜŞÜK PRİORİTE     │   HACİM OYUNU      │
│  (Zor + Düşük)      │  (Kolay + Düşük)   │
│                     │                     │
└─────────────────────┴─────────────────────┘
        Erişilebilirlik →
```

---

## 🔵 Kesişim Analizi (Venn Diagram)

- **Maksimum 4 segment** seçilebilir
- Sürükle-bırak veya "+" butonu ile ekleme
- Otomatik kesişim hesaplama:
  - Her segmentin hacmi
  - İkili kesişimler
  - Toplam kesişim

---

## 📋 Karşılaştırma Tablosu

- Tüm segmentler yan yana
- Görsel bar chart'lar
- **Öncelik Skoru** = (Erişilebilirlik × 0.4) + (Değer × 0.6)

---

## ✏️ Düzenleme Özellikleri

- Segment silme
- Metrik düzenleme (X, Y, Hacim)
- Hacim formatları: `2.5M`, `500K`, `1200000`

---

## 📁 Dosya Yapısı

```
segments/
├── index.html                    # Segment kütüphanesi
├── README.md                     # Dokümantasyon
└── segmentation-quadrant/
    └── index.html                # Analiz sayfası (Quadrant + Venn + Tablo)
```

---

## 🚀 Kurulum

```bash
git clone https://github.com/Growity-ai-lab/segments.git
cd segments
# Tarayıcıda index.html açın
```

Veya GitHub Pages üzerinden doğrudan kullanın.

---

## 📤 Export

- **PNG**: Aktif görünümün görselini indir
- **Excel**: Tüm segment verilerini tablo olarak indir

---

## 🛠️ Teknolojiler

- Vanilla JavaScript (framework-free)
- HTML5 Canvas
- CSS3 Grid & Flexbox
- LocalStorage (segment seçimi aktarımı)

---

## 👥 Geliştirici

**Time & Growity**  
Media Agency & Digital Transformation Consulting

---

## 📄 Lisans

MIT License

---

<p align="center">
  <strong>Time & Growity</strong><br>
  <em>Transforming Data into Strategy</em>
</p>
