# Gizlilik ve izin açıklaması

**Açık Video İndirici 2.2.1 — geliştirme sürümü**

## Tarayıcı izinleri

- `activeTab`: Kullanıcı eklentiyi açtığında aktif sayfanın URL ve başlığını anlamak için.
- `downloads`: Doğrudan indirme dosyasını tarayıcı indirme yöneticisine aktarmak için.
- `storage`: İndirme sekmesi için kısa ömürlü oturum verisini saklamak için.
- `nativeMessaging`: Windows yerel indirme yardımcısı ile iletişim için.
- `webRequest` ve `http://*/*`, `https://*/*`: Ziyaret edilen sitelerin medya istek ve yanıtlarından dosya bağlantılarını tanımak için.
- Sayfalara enjekte edilen `content.js`: Sayfada bulunan `video`, `audio` ve `source` öğelerinin medya adreslerini algılamak için.

Bu izinler geniştir: eklenti ziyaret edilen sitelerin medya ağ taleplerini görebilir. Kullanıcılar yalnızca güvendikleri kaynak kodunu yüklemelidir. Eklentinin sayfa içeriği gözlemlemesi, tüm sitelerde çalışacağı anlamına gelmez.

## Veriler nerede işlenir?

- Algılanan medya URL'leri, tarayıcı belleğinde ve geçici eklenti oturum verisinde tutulabilir.
- Eklenti, seçilen indirme talebini yerel Windows yardımcı bileşenine iletebilir.
- Yardımcı bileşen, indirilmesine izin verilen YouTube URL'si ile video/ses bilgisini almak ve dosyayı indirmek amacıyla YouTube ve indirme aracının kullandığı gerekli kaynak sunucularına ağ istekleri yapar.
- Kaynak kodda geliştiriciye ait analiz, reklam veya telemetri sunucusu bulunmaz; dosyalar geliştiriciye yüklenmez.
- Yerel yardımcı, tarayıcı çerezlerini veya oturum belirteçlerini otomatik olarak almaz.

## Dosya sistemi

- Windows yerel yardımcısı çıktıları `%USERPROFILE%\Downloads` klasörüne kaydeder.
- Doğrudan dosyalar tarayıcının kendi indirme konumu ayarını kullanır.
- HLS indirmesinde İndirilenler'i başlangıç konumu olarak açan yerel dosya seçici kullanılır; kullanıcı yolu değiştirebilir.

## Güvenlik sınırları

DRM, ödeme duvarı ve yetkisiz erişim kısıtlamalarını aşmak için tasarlanmamıştır. İnternet kaynakları zamanla değişebilir ve indirmeler başarısız olabilir.

Güvenlik bildirimi için bu deponun GitHub Issues bölümünden genel bir sorun kaydı açılabilir; güvenlik açığı bildirimlerinde hassas ayrıntıların herkese açık paylaşılmaması önerilir.
