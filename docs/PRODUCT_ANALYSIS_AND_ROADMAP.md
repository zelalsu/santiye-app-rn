# Şantiyen Cebinde - Ürün, UX ve Teknik Analiz Raporu

Bu rapor, repository içindeki mevcut Expo/React Native kod tabanı incelenerek hazırlanmıştır. Uygulama bugün tam kapsamlı bir şantiye yönetim platformundan çok, proje bazlı maliyet hesaplama, belge checklist/yükleme ve PDF raporlama odaklı bir MVP durumundadır.

Analiz edilen ana dosyalar:

- `app/index.tsx`: karşılama ve onboarding ekranı
- `app/(auth)/index.tsx`: giriş ve kayıt ekranı
- `app/projects.tsx`: şantiye/proje listesi
- `app/(tabs)/index.tsx`: proje maliyet ana ekranı
- `app/screens/CategoryScreen.tsx`: kategori bazlı maliyet girişi
- `app/projectSummary.tsx`: maliyet özeti ve PDF üretimi
- `app/(tabs)/(documents)/index.tsx`: belge aşamaları listesi
- `app/(tabs)/(documents)/[doc].tsx`: belge yükleme, görüntüleme, silme
- `config/categoryConfig.ts`: maliyet kategori şablonları
- `data/CostItems.ts`: maliyet kategori listesi
- `types/phases.ts`: proje aşamaları ve gerekli belge listesi
- `config/documentUpload.ts`: Firebase Storage belge yükleme
- `firebaseConfig.ts`: Firebase Auth, Firestore, Storage kurulumu

Not: `app/projects.tsx` ve `components/SearchBar.tsx` içinde proje arama özelliği daha önce eklenmiş ve çalışma ağacında değişiklik olarak durmaktadır.

## 1. Mevcut Özellikler

### 1.1 Karşılama ve Onboarding

Dosya: `app/index.tsx`

Uygulama açılışında kullanıcıya marka, görsel, kısa değer önerisi ve "Nasıl Çalışır?" modalı gösteriliyor. Giriş yapmış kullanıcı otomatik olarak `/projects` ekranına yönlendiriliyor.

Mevcut kabiliyetler:

- Marka ve hero görseli
- "Hemen Başla" CTA
- "Nasıl Çalışır?" modalı
- Auth state kontrolü

Eksikler:

- Ürün vaadi maliyet hesaplama ile sınırlı anlatılıyor.
- Şantiye yönetimi modülleri henüz üründe olmadığı için onboarding gelecekte güncellenmeli.
- "%100 Doğruluk" gibi iddialı ifade gerçek veri kaynağı olmadığı için riskli.

### 1.2 Auth

Dosya: `app/(auth)/index.tsx`

Firebase Auth ile e-posta/şifre giriş ve kayıt yapılabiliyor.

Mevcut kabiliyetler:

- Login/register mode switch
- Display name kaydı
- Şifre göster/gizle
- Firebase hata mesajlarını Türkçe gösterme

Eksikler:

- Test hesabı inputlara gömülü: `sena@gmail.com`, `123456`
- Şifre sıfırlama yok
- E-posta doğrulama yok
- Firma/ekip üyeliği yok
- Rol bazlı yönlendirme yok

### 1.3 Proje/Şantiye Yönetimi

Dosya: `app/projects.tsx`

Kullanıcı kendi hesabı altında projeler oluşturabiliyor, listeleyebiliyor ve silebiliyor.

Mevcut kabiliyetler:

- Proje oluşturma
- Proje silme
- Proje listesi
- Proje toplam maliyetlerinin portföy toplamı
- Şantiye sayısı
- Proje arama
- Aktif proje id bilgisini AsyncStorage'a yazma

Eksikler:

- Proje adı dışında veri yok.
- Proje düzenleme yok.
- Proje durumu yok.
- Lokasyon yok.
- Başlangıç/bitiş tarihi yok.
- Sorumlu kişi yok.
- Firma/ekip paylaşımı yok.
- Silme işlemi soft delete değil.

### 1.4 Maliyet Kategori Ana Ekranı

Dosya: `app/(tabs)/index.tsx`

Seçili proje için maliyet kategorileri gösteriliyor.

Mevcut kabiliyetler:

- Kategori arama
- Kategori kartları
- Kategori toplamlarını Firestore snapshot ile dinleme
- Toplam tahmini maliyet kartı
- Logout

Eksikler:

- Kategoriler sabit.
- Firma/proje bazlı kategori özelleştirme yok.
- Gerçekleşen maliyet ve tahmini maliyet ayrımı yok.
- Para birimi ve KDV yok.
- Maliyet kalemi lokasyonu yok.
- Metraj hesabı yok.

### 1.5 Kategori Bazlı Maliyet Girişi

Dosya: `app/screens/CategoryScreen.tsx`

Kullanıcı kategori içinde kalem seçip miktar ve birim fiyat girerek toplam oluşturuyor.

Mevcut kabiliyetler:

- Şablon kalem seçimi
- Miktar girişi
- Birim fiyat girişi
- Anlık toplam önizleme
- Kalem ekleme
- Kalem silme
- Kategori toplamı
- Proje toplamını güncelleme

Eksikler:

- Kalem düzenleme yok.
- Kalem çoğaltma yok.
- Açıklama/not yok.
- Tedarikçi bağlantısı yok.
- Fatura/sipariş bağlantısı yok.
- Tahmini/gerçekleşen ayrımı yok.
- KDV, iskonto, nakliye, işçilik kırılımı yok.
- Entries array olarak tutuluyor; ölçek ve eşzamanlılık için riskli.

### 1.6 Maliyet Özeti ve PDF

Dosya: `app/projectSummary.tsx`

Proje kategorileri ve kalemleri üzerinden özet ekranı ve PDF raporu üretimi var.

Mevcut kabiliyetler:

- Kategori dağılımı
- En pahalı/etkili kalemler
- Toplam maliyet
- PDF oluşturma
- PDF önizleme
- PDF paylaşma/indirme
- PDF geçmişi kaydı

Eksikler:

- PDF geçmişinde gerçek dosya URI saklanmıyor; yeniden aynı güncel HTML'den üretim yapılıyor.
- Rapor şablonu component içine gömülü.
- Rapor kapsamı seçilemiyor.
- İmza/kaşe alanı yok.
- Excel/CSV dışa aktarma yok.
- Grafikler temel seviyede.

### 1.7 Belge Yönetimi

Dosyalar:

- `app/(tabs)/(documents)/index.tsx`
- `app/(tabs)/(documents)/[doc].tsx`
- `types/phases.ts`
- `config/documentUpload.ts`

Proje aşamalarına göre gerekli evrak checklist'i var. Kullanıcı her aşamaya PDF veya görsel yükleyebiliyor.

Mevcut kabiliyetler:

- Aşamaya göre gerekli belge listesi
- Tamamlanan belge sayısı
- Görsel yükleme
- PDF yükleme
- Belge önizleme
- Belge silme
- Serbest belge ekleme
- Firebase Storage'a dosya yükleme

Eksikler:

- Belge onayı yok.
- Belge versiyonlama yok.
- Belgeyi kimin yüklediği tutulmuyor.
- Geçerlilik/son tarih yok.
- Evrak yorumları yok.
- Evrak red nedeni yok.
- Belge arama/filtreleme yok.
- Dosya adı kullanıcı dostu değil.
- Storage delete için download URL ile ref oluşturma hatalı/riske açık olabilir; storage path ayrı tutulmalı.

## 2. Eksik Olduğu Düşünülen Özellikler

### Özellik Adı: Rol ve Yetki Sistemi

- Öncelik: Kritik
- Neden gerekli? Uygulama şu an tek kullanıcılı kişisel proje yapısında. Şantiye uygulaması çok kullanıcılı olmalı.
- Kullanıcıya sağlayacağı fayda: Her rol sadece kendi sorumluluğundaki işlemleri görür ve yapar.
- Hangi kullanıcı rolü kullanacak? Firma sahibi, proje müdürü, şantiye şefi, depo sorumlusu, satın alma personeli
- Uygulamaya nasıl entegre edilir? Veri modeli `companies/{companyId}/projects/{projectId}` yapısına taşınmalı. `members` koleksiyonunda kullanıcı rolü tutulmalı.
- Etkilenen ekranlar: Auth, Projects, Documents, Cost, Summary
- Yeni ekran gerekiyor mu? Evet, ekip ve rol yönetimi ekranı
- Backend değişikliği gerekir mi? Evet
- Tahmini geliştirme zorluğu: 8/10

### Özellik Adı: Proje Detay Profili

- Öncelik: Kritik
- Neden gerekli? Şantiye sadece isimle temsil ediliyor.
- Kullanıcıya sağlayacağı fayda: Projenin lokasyonu, durumu, süresi, sorumlusu ve genel bilgileri izlenir.
- Hangi kullanıcı rolü kullanacak? Firma sahibi, proje müdürü, şantiye şefi
- Uygulamaya nasıl entegre edilir? `Project` tipine `location`, `status`, `startDate`, `endDate`, `managerId`, `description` eklenmeli.
- Etkilenen ekranlar: Projects, Project Detail, Summary
- Yeni ekran gerekiyor mu? Evet
- Backend değişikliği gerekir mi? Evet
- Tahmini geliştirme zorluğu: 4/10

### Özellik Adı: Günlük Saha Raporu

- Öncelik: Kritik
- Neden gerekli? Şantiye şefinin günlük iş, hava, ekip, makine, malzeme ve fotoğraf raporu tutması gerekir.
- Kullanıcıya sağlayacağı fayda: Saha hafızası oluşur, anlaşmazlıklarda kanıt sağlar.
- Hangi kullanıcı rolü kullanacak? Şantiye şefi, proje müdürü
- Uygulamaya nasıl entegre edilir? `projects/{projectId}/dailyLogs/{logId}` koleksiyonu eklenmeli.
- Etkilenen ekranlar: Yeni Daily Logs tabı, Project Summary
- Yeni ekran gerekiyor mu? Evet
- Backend değişikliği gerekir mi? Evet
- Tahmini geliştirme zorluğu: 7/10

### Özellik Adı: Depo ve Stok Yönetimi

- Öncelik: Kritik
- Neden gerekli? Şantiye yönetiminde malzeme giriş/çıkış ve stok seviyesi ana ihtiyaçtır.
- Kullanıcıya sağlayacağı fayda: Malzeme bitmeden uyarı alınır, fire ve kayıp izlenir.
- Hangi kullanıcı rolü kullanacak? Depo sorumlusu, şantiye şefi, satın alma personeli
- Uygulamaya nasıl entegre edilir? `inventoryItems` ve `stockMovements` koleksiyonları eklenmeli.
- Etkilenen ekranlar: Yeni Stok tabı, Maliyet, Satın Alma
- Yeni ekran gerekiyor mu? Evet
- Backend değişikliği gerekir mi? Evet
- Tahmini geliştirme zorluğu: 8/10

### Özellik Adı: Satın Alma Talep ve Onay Akışı

- Öncelik: Kritik
- Neden gerekli? Maliyet hesabı var ama bu maliyetlerin satın alma operasyonu yok.
- Kullanıcıya sağlayacağı fayda: Talep, teklif, onay ve sipariş süreçleri takip edilir.
- Hangi kullanıcı rolü kullanacak? Satın alma personeli, proje müdürü, firma sahibi
- Uygulamaya nasıl entegre edilir? `purchaseRequests`, `vendors`, `quotes`, `purchaseOrders` koleksiyonları eklenmeli.
- Etkilenen ekranlar: Yeni Satın Alma tabı, Maliyet, Stok
- Yeni ekran gerekiyor mu? Evet
- Backend değişikliği gerekir mi? Evet
- Tahmini geliştirme zorluğu: 8/10

### Özellik Adı: Gerçekleşen Maliyet ve Bütçe Takibi

- Öncelik: Yüksek
- Neden gerekli? Mevcut uygulama sadece tahmini maliyet gösteriyor.
- Kullanıcıya sağlayacağı fayda: Bütçe sapmaları ve gerçek harcamalar izlenir.
- Hangi kullanıcı rolü kullanacak? Proje müdürü, firma sahibi, satın alma personeli
- Uygulamaya nasıl entegre edilir? Kalemlere `estimatedCost`, `actualCost`, `committedCost`, `invoiceRef` alanları eklenmeli.
- Etkilenen ekranlar: CategoryScreen, SummaryCard, ProjectSummary
- Yeni ekran gerekiyor mu? Kısmen
- Backend değişikliği gerekir mi? Evet
- Tahmini geliştirme zorluğu: 6/10

### Özellik Adı: Görev ve Punch List

- Öncelik: Yüksek
- Neden gerekli? Sahadaki eksik, kusurlu veya yapılacak işler takip edilmiyor.
- Kullanıcıya sağlayacağı fayda: İşler sorumlu, termin, durum ve fotoğrafla takip edilir.
- Hangi kullanıcı rolü kullanacak? Şantiye şefi, proje müdürü, taşeron ekipler
- Uygulamaya nasıl entegre edilir? `tasks` koleksiyonu ve `status`, `assigneeId`, `dueDate`, `photos` alanları eklenmeli.
- Etkilenen ekranlar: Yeni Görevler tabı, Project Summary
- Yeni ekran gerekiyor mu? Evet
- Backend değişikliği gerekir mi? Evet
- Tahmini geliştirme zorluğu: 7/10

### Özellik Adı: Belge Onay ve Versiyonlama

- Öncelik: Yüksek
- Neden gerekli? Yüklenen belgenin doğru, güncel veya onaylı olup olmadığı bilinmiyor.
- Kullanıcıya sağlayacağı fayda: Yanlış/eksik belgeyle çalışma riski azalır.
- Hangi kullanıcı rolü kullanacak? Proje müdürü, şantiye şefi
- Uygulamaya nasıl entegre edilir? Document modeline `version`, `status`, `approvedBy`, `approvedAt`, `rejectionReason` eklenmeli.
- Etkilenen ekranlar: Documents, Document Detail
- Yeni ekran gerekiyor mu? Hayır, mevcut ekran genişletilebilir
- Backend değişikliği gerekir mi? Evet
- Tahmini geliştirme zorluğu: 6/10

### Özellik Adı: Çizim/Pafta Görüntüleme ve İşaretleme

- Öncelik: Yüksek
- Neden gerekli? Rakip saha uygulamalarının temel özelliklerinden biri çizim üzerinde işaretleme ve issue takibidir.
- Kullanıcıya sağlayacağı fayda: Sorunlar doğrudan pafta üzerinde işaretlenir.
- Hangi kullanıcı rolü kullanacak? Şantiye şefi, proje müdürü, teknik ofis
- Uygulamaya nasıl entegre edilir? PDF/image viewer, annotation metadata ve issue bağlantısı eklenmeli.
- Etkilenen ekranlar: Documents, Tasks, RFI
- Yeni ekran gerekiyor mu? Evet
- Backend değişikliği gerekir mi? Evet
- Tahmini geliştirme zorluğu: 9/10

### Özellik Adı: RFI ve Teknik Soru Akışı

- Öncelik: Yüksek
- Neden gerekli? Sahadaki teknik belirsizlikler kayıt altına alınmalı.
- Kullanıcıya sağlayacağı fayda: Soru, cevap, ekler ve kararlar kaybolmaz.
- Hangi kullanıcı rolü kullanacak? Şantiye şefi, proje müdürü, teknik ofis
- Uygulamaya nasıl entegre edilir? `rfis` koleksiyonu eklenmeli.
- Etkilenen ekranlar: Yeni RFI ekranı, Documents, Tasks
- Yeni ekran gerekiyor mu? Evet
- Backend değişikliği gerekir mi? Evet
- Tahmini geliştirme zorluğu: 7/10

### Özellik Adı: Takvim ve İş Programı

- Öncelik: Yüksek
- Neden gerekli? Projenin zaman yönetimi yok.
- Kullanıcıya sağlayacağı fayda: Gecikmeler, terminler ve kritik işler görünür.
- Hangi kullanıcı rolü kullanacak? Proje müdürü, şantiye şefi, firma sahibi
- Uygulamaya nasıl entegre edilir? `scheduleTasks` koleksiyonu ve takvim görünümü eklenmeli.
- Etkilenen ekranlar: Yeni Takvim tabı, Project Summary
- Yeni ekran gerekiyor mu? Evet
- Backend değişikliği gerekir mi? Evet
- Tahmini geliştirme zorluğu: 8/10

### Özellik Adı: Tedarikçi ve Teklif Karşılaştırma

- Öncelik: Yüksek
- Neden gerekli? Satın alma personeli için fiyat ve teklif yönetimi şarttır.
- Kullanıcıya sağlayacağı fayda: En uygun fiyat, teslimat ve ödeme koşulu kıyaslanır.
- Hangi kullanıcı rolü kullanacak? Satın alma personeli, firma sahibi
- Uygulamaya nasıl entegre edilir? `vendors`, `quotes`, `quoteItems` koleksiyonları eklenmeli.
- Etkilenen ekranlar: Satın Alma, Maliyet, Stok
- Yeni ekran gerekiyor mu? Evet
- Backend değişikliği gerekir mi? Evet
- Tahmini geliştirme zorluğu: 7/10

### Özellik Adı: Bildirimler ve Kritik Uyarılar

- Öncelik: Yüksek
- Neden gerekli? Onay, stok, belge ve bütçe aşımı gibi olaylar pasif kalıyor.
- Kullanıcıya sağlayacağı fayda: Kritik aksiyonlar kaçmaz.
- Hangi kullanıcı rolü kullanacak? Tüm roller
- Uygulamaya nasıl entegre edilir? Expo Notifications ve Firestore tetiklemeleri ile uyarı üretilebilir.
- Etkilenen ekranlar: Tüm modüller
- Yeni ekran gerekiyor mu? Evet, bildirim merkezi
- Backend değişikliği gerekir mi? Evet
- Tahmini geliştirme zorluğu: 7/10

### Özellik Adı: Offline Saha Modu

- Öncelik: Yüksek
- Neden gerekli? Şantiyelerde internet her zaman güvenilir değildir.
- Kullanıcıya sağlayacağı fayda: Veri bağlantı yokken de kayıt yapılır, sonra senkronize edilir.
- Hangi kullanıcı rolü kullanacak? Şantiye şefi, depo sorumlusu
- Uygulamaya nasıl entegre edilir? Local queue, sync status ve conflict handling eklenmeli.
- Etkilenen ekranlar: Daily Logs, Tasks, Stock, Documents
- Yeni ekran gerekiyor mu? Hayır, sync göstergeleri gerekir
- Backend değişikliği gerekir mi? Kısmen
- Tahmini geliştirme zorluğu: 8/10

### Özellik Adı: AI Belge Özeti ve Eksik Evrak Kontrolü

- Öncelik: Orta
- Neden gerekli? Yüklenen PDF ve görseller şu an sadece saklanıyor.
- Kullanıcıya sağlayacağı fayda: Ruhsat, rapor ve evrak içerikleri hızlıca özetlenir; eksikler yakalanır.
- Hangi kullanıcı rolü kullanacak? Proje müdürü, şantiye şefi
- Uygulamaya nasıl entegre edilir? Storage dosyası backend üzerinden OCR/LLM servisine gönderilmeli.
- Etkilenen ekranlar: Documents, Project Summary
- Yeni ekran gerekiyor mu? Hayır, belge detayına panel eklenebilir
- Backend değişikliği gerekir mi? Evet
- Tahmini geliştirme zorluğu: 8/10

### Özellik Adı: AI Maliyet Anomali Uyarısı

- Öncelik: Orta
- Neden gerekli? Yanlış birim fiyat veya aşırı sapma uygulama tarafından yakalanmıyor.
- Kullanıcıya sağlayacağı fayda: Hatalı maliyet girişi erken fark edilir.
- Hangi kullanıcı rolü kullanacak? Satın alma personeli, proje müdürü, firma sahibi
- Uygulamaya nasıl entegre edilir? Kalem eklenirken geçmiş proje/firma ortalamasıyla karşılaştırma yapılmalı.
- Etkilenen ekranlar: CategoryScreen, ProjectSummary
- Yeni ekran gerekiyor mu? Hayır
- Backend değişikliği gerekir mi? Evet
- Tahmini geliştirme zorluğu: 7/10

## 3. Rol Bazlı Eksikler

### Şantiye Şefi

İhtiyaç duyacağı ama mevcut olmayan özellikler:

- Günlük saha raporu
- Fotoğraflı ilerleme takibi
- Görev/punch list
- RFI oluşturma
- Taşeron ekip takibi
- İş programı ve günlük yapılacaklar
- Offline kayıt
- Pafta üzerinde işaretleme

### Depo Sorumlusu

İhtiyaç duyacağı ama mevcut olmayan özellikler:

- Malzeme kartları
- Stok giriş/çıkış
- İrsaliye/fatura bağlantısı
- Minimum stok uyarısı
- Depo sayımı
- Fire/zayiat kaydı
- QR/barkod ile malzeme hareketi

### Proje Müdürü

İhtiyaç duyacağı ama mevcut olmayan özellikler:

- Proje dashboard
- Bütçe vs gerçekleşen maliyet
- İş programı
- RFI ve karar takibi
- Belge onayları
- Görevlerin durumu
- Günlük rapor onayı
- Portföy görünümü

### Satın Alma Personeli

İhtiyaç duyacağı ama mevcut olmayan özellikler:

- Satın alma talepleri
- Tedarikçi rehberi
- Teklif toplama
- Teklif karşılaştırma
- Sipariş oluşturma
- Teslimat ve stok bağlantısı
- Onay akışı

### Firma Sahibi

İhtiyaç duyacağı ama mevcut olmayan özellikler:

- Tüm projeler için portföy KPI
- Nakit çıkışı ve bütçe sapması
- Kritik riskler
- Onay bekleyen harcamalar
- Proje karlılık analizi
- Yönetici özeti raporu
- Yetki ve kullanıcı yönetimi

## 4. Rakip Uygulamalarda Olan Ama Bu Projede Olmayan Özellikler

Rakiplerde sık görülen özellik grupları:

- Çizim ve pafta yönetimi
- Çizim revizyon kontrolü
- RFI yönetimi
- Submittal/onay süreçleri
- Günlük rapor
- Punch list
- Issue tracking
- Fotoğraf ve saha kanıtları
- İş programı
- Bütçe ve taahhüt maliyeti yönetimi
- Tedarikçi/sözleşme yönetimi
- Offline saha kullanımı
- Ekip/rol yönetimi
- Mobil bildirimler
- AI destekli doküman ve risk analizi

Bu projeye en uygun rakip özellikleri:

1. Günlük rapor
2. Görev/punch list
3. Belge onay/versiyonlama
4. Stok yönetimi
5. Satın alma talep akışı
6. RFI
7. Çizim görüntüleme
8. Dashboard/KPI

## 5. UX İyileştirme Önerileri

### Proje Seçim Akışı

Mevcut durumda aktif proje AsyncStorage üzerinden tutuluyor. Bu kullanıcı için görünmez bir durum yaratır.

Öneri:

- Üst barda aktif proje adı gösterilmeli.
- Proje değiştirme hızlı menüsü eklenmeli.
- Aktif proje yoksa tüm tablar kullanıcıyı proje seçimine yönlendirmeli.

### Ana Tab Yapısı

Mevcut tablar:

- Ana Sayfa
- Belgeler

Önerilen tablar:

- Özet
- Maliyet
- Belgeler
- Görevler
- Stok
- Satın Alma

### Maliyet Girişi

Öneriler:

- Kalem düzenleme
- Kalem kopyalama
- Kategori içi arama
- KDV/iskonto/nakliye alanları
- Not ve dosya ekleme
- Tahmini/gerçekleşen ayrımı

### Belgeler

Öneriler:

- Filtreler: Eksik, Onay Bekliyor, Onaylandı, Reddedildi
- Belge detay ekranı
- Yükleyen kişi
- Son güncelleme
- Versiyon geçmişi
- Red nedeni

### Raporlama

Öneriler:

- Rapor oluşturma öncesi kapsam seçimi
- PDF/Excel seçenekleri
- Yönetici özeti
- İmza/kaşe alanı
- Rapor geçmişinde gerçek dosya saklama

## 6. Yapay Zeka ile Geliştirilebilecek Özellikler

### AI Evrak Kontrol Asistanı

Yüklenen PDF ve görselleri okuyarak belge türünü, tarihini, eksik alanları ve riskleri özetler.

### AI Maliyet Kontrol Asistanı

Birim fiyatları geçmiş proje ortalaması veya firma fiyat havuzu ile kıyaslar.

### AI Günlük Rapor Oluşturucu

Şantiye şefinin kısa notlarından profesyonel günlük rapor oluşturur.

### AI Fotoğraf İlerleme Analizi

Fotoğraflardan ilerleme, eksik iş ve potansiyel güvenlik riskleri hakkında özet çıkarır.

### AI Satın Alma Önerisi

Malzeme ihtiyacı, stok seviyesi ve geçmiş fiyatlara göre satın alma önerisi üretir.

## 7. Performans, Güvenlik ve Mimari Değerlendirme

### Performans

- Kategori entries array olarak tutuluyor. Çok kalemde Firestore doküman limiti ve yazma çakışması riski oluşur.
- Proje toplamı her kalem değişiminde tüm kategoriler okunarak güncelleniyor.
- Belge sayıları `getDocs` ile yükleniyor; gerçek zamanlı veya aggregate yapı daha doğru olur.
- Büyük listelerde FlatList yerine map kullanımları performans sorunu yaratabilir.

### Güvenlik

- Auth ekranında test hesabı gömülü.
- Firestore/Storage rules repo içinde görünmüyor.
- Rol ve yetki modeli yok.
- Silme işlemleri audit log üretmiyor.
- Belge yüklemede dosya tipi client tarafına güveniyor.

### Mimari

- Firestore path'leri component içinde elle yazılıyor.
- İş mantığı component içinde yoğunlaşmış.
- PDF HTML template component içinde.
- Ortak formatter/util eksik.
- Domain tipleri zayıf; bazı yerlerde `any` kullanılıyor.
- Redux Toolkit dependency var ama kullanılmıyor.

## 8. Kod Tekrarları ve Refactor Edilecek Noktalar

### Tekrar Eden Fonksiyonlar

- Türkçe normalize fonksiyonu `app/projects.tsx` ve `app/(tabs)/index.tsx` içinde tekrar ediyor.
- Para formatlama birçok yerde tekrar ediyor.
- Tarih formatlama farklı componentlerde dağınık.

Öneri:

- `utils/text.ts`
- `utils/format.ts`
- `utils/currency.ts`

### Service Katmanı Eksikliği

Önerilen servisler:

- `services/projects.ts`
- `services/costs.ts`
- `services/documents.ts`
- `services/storage.ts`
- `services/auth.ts`

### Kullanılmayan veya Starter Dosyalar

Temizlenmesi değerlendirilecek dosyalar:

- `components/CostInput.tsx`
- `components/FloatingButton.tsx`
- `app/modal.tsx`
- `app/pdfViewer.tsx`
- Expo starter themed/example bileşenleri

### ESLint Uyarıları

`npm run lint` çıktısında hata yok, ancak 13 warning var. Çoğu hook dependency ve kullanılmayan değişkenlerden oluşuyor.

Öncelikli dosyalar:

- `app/(tabs)/(documents)/[doc].tsx`
- `app/(tabs)/(documents)/index.tsx`
- `app/(tabs)/index.tsx`
- `app/projects.tsx`
- `app/screens/CategoryScreen.tsx`
- `components/HowItWorksModal.tsx`
- `components/PdfHistoryModal.tsx`
- `components/ProjectCard.tsx`

## 9. İlk Yapılması Gereken 20 Geliştirme

1. Auth ekranındaki gömülü test hesabını kaldır.
2. Firestore ve Storage security rules yaz.
3. Firma, proje, üye ve rol veri modelini tasarla.
4. Proje detay modelini genişlet.
5. Proje düzenleme ekranı ekle.
6. Audit log altyapısı ekle.
7. Maliyet entries veri modelini subcollection'a taşı.
8. Maliyet toplamını transaction veya aggregate yapı ile güvenceye al.
9. Maliyet kalemi düzenleme özelliği ekle.
10. Belge onay durumu ekle.
11. Belge versiyonlama ekle.
12. Günlük saha raporu MVP ekle.
13. Görev/punch list MVP ekle.
14. Stok kartları ve stok hareketleri ekle.
15. Satın alma talep akışı ekle.
16. Dashboard/KPI ekranı ekle.
17. Bildirim merkezi ekle.
18. Ortak util ve service katmanı çıkar.
19. ESLint warning'lerini temizle.
20. README'yi gerçek ürün dokümantasyonuna çevir.

## 10. Hızlı Kazanımlar

1-2 günde yapılabilecek geliştirmeler:

- Auth input defaultlarını temizleme
- Proje adını düzenleme
- Maliyet kalemi düzenleme
- Para/tarih formatter refactor
- Normalize fonksiyonunu ortak util'e taşıma
- Belge ekranına arama/filtre ekleme
- PDF raporuna imza alanı ekleme
- PDF rapor başlıklarını güzelleştirme
- ESLint warning temizliği
- Kullanılmayan starter dosyaları kaldırma
- Boş durum ekranlarını standardize etme
- Aktif proje adını header'da gösterme

## 11. Büyük Özellikler

1-4 hafta sürebilecek geliştirmeler:

- Rol tabanlı firma çalışma alanı
- Günlük saha raporu
- Görev/punch list
- Stok/depo yönetimi
- Satın alma ve teklif karşılaştırma
- RFI sistemi
- İş programı/takvim
- Çizim görüntüleme ve işaretleme
- Offline-first saha deneyimi
- AI belge ve maliyet asistanı

## 12. Uygulamayı Rakiplerinden Ayıracak Yenilikçi Özellikler

- Türkiye inşaat mevzuatına göre eksik evrak asistanı
- Şantiye fotoğraflarından AI ilerleme raporu
- Birim fiyat anomalisi uyarıları
- Depo stok, satın alma ve maliyet tahminini tek akışta birleştirme
- Küçük/orta ölçekli müteahhitlere özel sade Procore-lite deneyimi
- WhatsApp'tan gelen foto/notları projeye bağlama
- Türkçe saha raporu otomatik metinleştirme

## 13. İlk 6 Ay Roadmap

### Ay 1: Temel Güvenlik ve Veri Modeli

Hedef: Uygulamayı tek kullanıcılı MVP'den gerçek firma yapısına hazırlamak.

Yapılacaklar:

- Auth ekranındaki test değerlerini kaldır
- Firestore/Storage rules yaz
- Company/member/role modelini tasarla
- Project tipini genişlet
- Proje detay ve düzenleme ekranını ekle
- Maliyet veri modelini subcollection'a taşıma planı çıkar
- ESLint warning'lerini temizle

Çıktı:

- Güvenli, genişleyebilir temel model
- Proje bilgisi daha gerçekçi hale gelir

### Ay 2: Saha Operasyonu

Hedef: Şantiye şefinin günlük kullanımına değer katmak.

Yapılacaklar:

- Günlük saha raporu
- Fotoğraf ekleme
- Hava durumu, ekip, makine, malzeme alanları
- Görev/punch list MVP
- Audit log
- Bildirim altyapısı başlangıcı

Çıktı:

- Uygulama maliyet aracı olmaktan çıkıp saha takip aracına dönüşür.

### Ay 3: Belge ve Onay Süreçleri

Hedef: Belge modülünü gerçek iş akışına taşımak.

Yapılacaklar:

- Belge onay durumu
- Versiyonlama
- Red nedeni
- Yükleyen/onaylayan bilgisi
- Belge filtreleme
- PDF rapor kapsam seçimi

Çıktı:

- Belgeler pasif dosya olmaktan çıkar, yönetilebilir süreç haline gelir.

### Ay 4: Stok ve Depo

Hedef: Depo sorumlusu ve satın alma için operasyonel temel kurmak.

Yapılacaklar:

- Malzeme kartları
- Stok giriş/çıkış
- Minimum stok uyarısı
- Stok hareket geçmişi
- Maliyet kalemleriyle stok bağlantısı
- Depo sayım akışı

Çıktı:

- Malzeme kaybı ve stok eksikliği görünür hale gelir.

### Ay 5: Satın Alma ve Tedarikçi

Hedef: Maliyet hesabını satın alma aksiyonuna bağlamak.

Yapılacaklar:

- Satın alma talepleri
- Talep onay akışı
- Tedarikçi rehberi
- Teklif karşılaştırma
- Sipariş oluşturma
- Teslimat ve stok bağlantısı

Çıktı:

- Satın alma süreci uygulama içinde izlenebilir hale gelir.

### Ay 6: Yönetim, AI ve Rekabet Avantajı

Hedef: Firma sahibi ve proje müdürü için üst seviye karar destek sistemi oluşturmak.

Yapılacaklar:

- Portföy dashboard
- Bütçe sapma uyarıları
- AI belge özeti
- AI maliyet anomalisi
- Yönetici PDF/Excel raporları
- Offline-first iyileştirmeler

Çıktı:

- Uygulama sadece kayıt tutan değil, karar destek veren bir ürüne dönüşür.

## 14. Sonuç

Bu proje doğru bir MVP çekirdeğine sahip: maliyet hesabı, belge checklist'i ve PDF rapor üretimi. Ancak "şantiye yönetim uygulaması" seviyesine çıkması için ilk büyük dönüşüm çok kullanıcılı rol modeli, saha günlükleri, stok/depo ve satın alma akışları üzerinden yapılmalıdır.

En doğru ürün stratejisi:

1. Mevcut maliyet ve belge modülünü sağlamlaştır.
2. Rol ve proje veri modelini düzelt.
3. Şantiye şefi için günlük rapor ve görevleri ekle.
4. Depo ve satın alma süreçlerini maliyetle bağla.
5. Yönetici dashboard ve AI özellikleriyle ürünü farklılaştır.
