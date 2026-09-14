# Şantiyen Cebinde

Şantiye projelerini, maliyetleri, günlük kayıtları, taşeronları ve belgeleri tek yerden yönetmek için geliştirilmiş mobil uygulama.

<p align="center">
  <img src="assets/images/splash-brand.png" alt="Şantiyen Cebinde logosu" width="180" />
</p>

## Neler yapabilirsiniz?

- Birden fazla şantiye oluşturabilir, arayabilir ve adlarını düzenleyebilirsiniz.
- Malzeme ve işçilik kalemlerini miktar ile birim fiyat üzerinden hesaplayabilir; eklediğiniz kalemleri düzenleyebilirsiniz.
- Şantiye günlüklerini ve taşeron kayıtlarını tutabilirsiniz.
- Belgelerinize PDF yükleyebilir, galeriden görsel seçebilir veya doğrudan fotoğraf çekebilirsiniz.
- Maliyet özetini PDF olarak oluşturabilir, önizleyebilir ve paylaşabilirsiniz.
- Hesabınızı ve ilişkili verilerinizi uygulama içinden silebilirsiniz.

## Teknolojiler

| Alan | Kullanılan teknoloji |
| --- | --- |
| Mobil uygulama | React Native, Expo SDK 54, TypeScript |
| Ekranlar ve gezinme | Expo Router |
| Kimlik doğrulama ve veri | Firebase Authentication, Cloud Firestore, Firebase Storage |
| Belgeler ve raporlar | Expo Image Picker, Document Picker, Print, Sharing |
| iOS dağıtımı | EAS Build ve App Store Connect / TestFlight |

## Yerel geliştirme

Gereksinimler: Node.js, Yarn 1.x ve iOS Simulator veya Android Emulator. Proje şu anda **Expo SDK 54** kullanır. Fiziksel iPhone'daki daha yeni Expo Go sürümü SDK 54 ile uyumsuz olabilir; böyle bir durumda uyumlu iOS Simulator veya uygulamanın development/TestFlight build'ini kullanın.

```bash
git clone https://github.com/zelalsu/santiye-app-rn.git
cd santiye-app-rn
yarn install
npx expo start
```

Başlatma ekranında `i` ile iOS Simulator'ı, `a` ile Android Emulator'ı açabilirsiniz. Kod ve bağımlılık kontrolleri için:

```bash
npx expo install --check
yarn lint
```

Uygulama Firebase hizmetlerine bağlanır. Kendi ortamınızda çalıştıracaksanız `firebaseConfig.ts` içindeki Firebase proje ayarlarını kendi projenize göre düzenleyin; Authentication, Firestore ve Storage hizmetlerini ve güvenlik kurallarını da yapılandırın. Yalnızca istemci ayarlarını değiştirmek yeterli değildir.

## Proje yapısı

```text
app/               Ekranlar ve Expo Router rotaları
components/        Tekrar kullanılan arayüz bileşenleri
config/            Uygulama yapılandırması ve dosya yükleme
constants/         Tema değerleri
data/              Maliyet kalemi tanımları
firebaseConfig.ts  Firebase istemci bağlantısı
app.json           Expo uygulama ayarları ve izin açıklamaları
eas.json           EAS build/gönderim profilleri
```

## Gizlilik ve destek

Kamera ve fotoğraf arşivi erişimi yalnızca kullanıcı belgeye fotoğraf eklemeyi seçtiğinde istenir. Uygulama yalnızca fotoğraf çekimi için mikrofon izni istemez.

- [Gizlilik Politikası](https://zelalsu.github.io/Santiyen-Cebinde-Support/privacy.html)
- [Destek sayfası](https://zelalsu.github.io/Santiyen-Cebinde-Support/)

## Durum

Uygulamanın iOS build'leri TestFlight üzerinden test edilmektedir. TestFlight'a yüklenen bir build, App Store'da yayımlandığı anlamına gelmez.

© 2026 Zelalsu Kartal
