# 🎬 Açık Video İndirici

### Video mu, müzik mi? Biçimi sen seç, kaynak kalitesini koru.

**Chrome ve Microsoft Edge için geliştirilmiş, Türkçe arayüzlü video ve ses indirme eklentisi.** Uyumlu web sayfalarındaki medya bağlantılarını tespit eder; video ve ses için birden fazla biçim sunar. Windows yardımcı bileşeni sayesinde desteklenen YouTube kaynaklarında ayrı görüntü ve ses akışlarını birleştirebilir.

**Sürüm:** 2.2.1 · **Platform:** Chrome / Edge (Chromium, Manifest V3) · **Yerel yardımcı:** Windows · **Durum:** Geliştirme sürümü

> **Tek arayüz, daha fazla kontrol.** Uygun kaynakta 1080p, 1440p ve 4K seçeneklerini görebilir; MP4, MKV veya WebM video ve MP3, M4A, Opus, FLAC, WAV ses çıktılarından uygun olanını seçebilirsin. Mevcut olmayan çözünürlük üretilmez.

---

## ✨ Neden Açık Video İndirici?

- **Video ve ses bir arada:** Aynı arayüzden görüntülü indirme veya yalnızca ses kaydetme.
- **Birden fazla dosya biçimi:** Kaynağın codec ve kapsayıcı uyumluluğuna göre video formatı seçimi; ses için dönüştürme seçenekleri.
- **Kaynak kalitesine saygı:** Mevcut kalite seçenekleri gösterilir; yapay çözünürlük yükseltme veya sessizce kalite düşürme yapılmaz.
- **Doğrudan İndirilenler'e kayıt:** YouTube video ve ses çıktıları Windows'un `Downloads` ana klasörüne gider. Desteklenen doğrudan dosyalar tarayıcının varsayılan indirme klasörüne iner.
- **DRM'siz HLS desteği:** Uyumlu, tamamlanmış HLS akışlarını parça parça diske yazar; büyük dosyanın tamamını tarayıcı belleğinde tutmak zorunda değildir.
- **Türkçe ve sade:** Medya tespiti, kalite seçimi, indirme durumu ve hata açıklamaları Türkçedir.
- **Yerel işlem:** Dosyaların birleştirilmesi ve ses dönüştürme işlemi, uygun kaynaklarda bilgisayarındaki yardımcı bileşen tarafından gerçekleştirilir.

## 🎞️ Desteklenen video biçimleri

| Biçim | Nasıl çalışır? |
|---|---|
| **MKV** | Uyumlu kaynakların görüntü ve sesini birleştirir; geniş kalite seçeneği |
| **MP4** | Kaynakta H.264/AVC video + AAC ses varsa sunulur |
| **WebM** | Uyumlu WebM video ve Opus/Vorbis ses akışlarını kullanır |
| **Doğrudan dosyalar** | MP4, WebM, MOV, M4V, OGV, MKV, AVI ve 3GP bağlantılarını algılar |

**1080p / 2K / 4K** seçenekleri yalnızca kaynağın gerçekten sunduğu ve seçilen biçimle uyumlu çözünürlüklerde görünür. Örneğin bir videonun WebM sürümü 4K, MP4 sürümü yalnızca 1080p olabilir.

## 🎵 Desteklenen ses biçimleri

| Çıktı | Özellik |
|---|---|
| **MP3** | 256 kb/sn hedefiyle dönüştürme; geniş cihaz uyumluluğu |
| **M4A** | AAC uyumlu ses dosyası |
| **Opus** | Opus ses çıktısı |
| **FLAC** | FLAC kapsayıcı/kodek çıktısı; büyük dosya olabilir |
| **WAV** | Sıkıştırılmamış ses çıktısı; büyük dosya olabilir |
| **Orijinal ses** | Kaynağın sağladığı M4A veya WebM akışını yeniden kodlamadan kaydetme |

**Ses kalitesi notu:** Kayıplı bir kaydı FLAC veya WAV'a dönüştürmek, kaybolmuş ses ayrıntılarını geri getirmez. MP3'e dönüştürmek de mevcut kaliteyi yükseltmez.

Diğer web sitelerinde doğrudan erişilebilen **MP3, M4A, AAC, OGG, OGA, Opus, WAV ve FLAC** dosyaları algılanabilir.

## 🧭 Nasıl kullanılır?

1. Chrome veya Edge'de indirme hakkına sahip olduğun bir medya sayfasını aç.
2. Gerekirse videoyu ya da sesi oynatmaya başlat; **Açık Video İndirici** simgesine tıkla.
3. **YouTube** için video veya yalnızca ses seç; biçimi ve varsa çözünürlüğü belirle.
4. İndirme hakkı onayından sonra **İndir** düğmesine bas.
5. Çıktını Windows **İndirilenler / Downloads** klasöründe bul.

Diğer sitelerdeki doğrudan dosyalarda eklenti, uygun medya bağlantısını görürse **Videoyu indir** veya **Ses dosyasını indir** düğmesini sunar. HLS için dosya seçme penceresi İndirilenler konumunda açılır.

## 🛠️ Kurulum — Chrome / Edge

**Gereksinimler:** Chromium tabanlı Chrome veya Edge; YouTube ses/görüntü birleştirme için **Windows, Python 3, Node.js** ve Python bağımlılıkları. Doğrudan dosya tespiti için yerel yardımcı zorunlu değildir.

1. Bu depoyu ZIP olarak indirip **sabit bir klasöre** çıkart veya klonla.
2. Chrome için `chrome://extensions`, Edge için `edge://extensions` sayfasını aç.
3. **Geliştirici modu** → **Paketlenmemiş öğe yükle** → bu deponun `manifest.json` dosyasını içeren klasörünü seç.
4. Eklenti kartında görüntülenen 32 karakterlik **eklenti kimliğini** kopyala.
5. Terminalde proje klasörüne giderek yardımcı programı kur:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r native\requirements.txt
.\.venv\Scripts\python.exe native\setup_native.py --extension-id EKLENTI_KIMLIGINIZ --browser chrome
```

Edge için son komutta `--browser edge` kullan. Ardından tarayıcının eklentiler ekranından **Yeniden Yükle**. Kurulum işlemi kullanıcı hesabına Native Messaging kaydı ekler; yönetici izni gerektirmemesi hedeflenmiştir.

> **Önemli:** Yüklendiği klasörü taşımayın veya silmeyin. Yerel yardımcı program çalışması için eklentinin gerçek kimliğiyle kaydedilmiş olmalıdır. YouTube akışlarının kullanılabilirliği zamanla değişebilir; `yt-dlp` güncellemesi gerekebilir.

## 🔒 Gizlilik ve güvenlik

Eklenti, sayfalarda medya kaynaklarını bulabilmek için geniş site erişim izni kullanır. Bu yüzden indirmeden önce izinleri incelemek önemlidir. Kaynak URL'leri indirme işlevi kapsamında işlenir; projede reklam/analitik altyapısı veya geliştiriciye ait veri toplama sunucusu bulunmaz.

- DRM, erişim denetimleri, abonelik veya ödeme duvarları aşılmaz.
- Yerel YouTube yardımcısı izin verilen YouTube video URL biçimleriyle sınırlıdır.
- Kullanıcının tarayıcı çerezlerini veya oturum bilgilerini yerel yardımcıya aktarmak için kod yazılmamıştır.
- Daha ayrıntılı açıklama: [Gizlilik ve İzinler](PRIVACY.md).

## ✅ Test ve mevcut sınırlar

**Doğrulananlar:** 22 Python + 13 JavaScript testi; örnek kaynakta MP4/H.264+AAC, WebM/VP9+Opus ve M4A/AAC dosyalarının gerçek indirilmesi ve FFmpeg ile çözümlenmesi; doğrudan MP3 algılama ve Downloads klasörüne indirme; Chrome'da 2.2.1 sürümünün etkinliği.

**Henüz tüm koşullarda doğrulanmamış olanlar:** Edge üzerinde uçtan uca indirme, her film sitesi, tüm HLS türleri, FLAC/WAV/Opus'un her kaynakla dönüşümü. Genel MPEG-DASH indirmesi ve canlı yayın indirmesi mevcut değildir.

Testleri çalıştır:

```powershell
node --test tests/core.test.js tests/media_formats.test.js
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v
```

## ⚖️ Kullanım koşulları ve lisans

**Yalnızca indirme hakkınız olan içeriklerle kullanın.** YouTube ve diğer servislerin sözleşmeleri geçerlidir; bu proje bu kuralları değiştirmez. YouTube indirme özellikli uzantılar Chrome Web Store politikaları nedeniyle reddedilebilir. Bu depo bir **tarayıcı mağazası onayı** veya evrensel site uyumluluğu iddiası değildir.

Bu depoda henüz açık kaynak lisansı belirtilmemiştir; GitHub'da görünür olması otomatik olarak yeniden kullanım/dağıtım izni sağlamaz. Lisans ve yeniden dağıtım koşulları yayıncı tarafından daha sonra belirlenmelidir.

---

**Açık Video İndirici — desteklenen kaynağı algıla, doğru biçimi seç, dosyanı kaydet.**
