# Fabrication Research OS — v0.1.1 Doğrulama ve Uygulama Planı

## 1. Mevcut Durum ve Hedef
Seçiminiz doğrultusunda ilk adımda **mevcut v0.1.1 (Schema v2 — 17 Tablo) altyapısını ve test betiğini düzeltip uçtan uca doğrulayacağız**, ardından onayınızla **Quality Inspector (Node / Joint Inspection)** ve diğer arayüz modüllerine geçeceğiz.

---

## 2. Faz 1 (Şimdi Uygulanacak Adım): Test Betiğinin Düzeltilmesi ve Mevcut Durum Doğrulaması

### 2.1. `src/scientific/runAuditTests.ts` Güncellemesi
* **Sorun:** `runAuditTests.ts` içindeki `T01` testi hâlâ Faz A (Schema v1) dönemindeki `13` canonical entity sayısını (`DOMAIN_ENTITY_NAMES.length === 13`) bekliyor. Schema v2 ile birlikte `NodeDesign`, `NodeFeatureDefinition`, `Specimen` ve `AssemblyVerification` eklendiği için toplam tablo sayısı `17` oldu.
* **Çözüm:**
  * `T01` kontrolünü `17` canonical entity ve `SCHEMA_VERSION === 2` doğrulaması yapacak şekilde güncelleyeceğiz.
  * Mevcut 9 denetim testine ek olarak **T10 — v0.1.1 Ceramic Node Scientific & Schema v2 Verification** testini ekleyeceğiz:
    * `computeStageToStageShrinkage` (`GREEN -> DRY`, `DRY -> FIRED`, `GREEN -> FIRED` hesaplamaları ve `Stage Unknown` / farklı numune engellemesi),
    * `evaluateFeatureTolerance` (simetrik `±` ve asimetrik `[alt, üst]` soket toleransı),
    * `computeDiametralClearance` ve `evaluateSpecimenAcceptance` (`Geometrically Accepted` ile `Assembly Accepted` ayrımı),
    * Schema v1'den Schema v2'ye kayıpsız otomatik migrasyon (`migrateV1ToV2RawObject`) ve yeni CSV dışa aktarımları (`exportNodeDesignsToCsv`, `exportSpecimensToCsv`, `exportAssemblyVerificationsToCsv`).

### 2.2. Derleme ve Otomatik Test Doğrulaması
* `npx tsx src/scientific/runAuditTests.ts` komutu çalıştırılarak tüm otomatik testlerin (`T01`–`T10`) `100% PASS` olduğu doğrulanacak.
* `compile_applet` aracı çalıştırılarak TypeScript ve Vite üretim derlemesinin (`npm run build`) sıfır hata ile tamamlandığı teyit edilecek.
* `PHASE_A_AUDIT.md` raporu Schema v2 (17 entity) doğrulama sonuçlarıyla güncellenecek.

---

## 3. Faz 2 (Doğrulama Sonrası İkinci Adım): Quality Inspector — Node & Joint Inspection Arayüzü
İlk adım doğrulandıktan sonra seçtiğiniz 3 temel analiz aracını içeren **Quality Inspector (`src/modules/QualityInspectorModule.tsx`)** güncellemesi uygulanacaktır:
1. **2B Soket ve Düğüm Kesit Şematiği Karşılaştırması:** Nominal CAD soket iç çapı, duvar kalınlığı ve kol açıları ile ölçülen değerlerin şematik karşılaştırması.
2. **GREEN → DRY → FIRED Aşamalar Arası Çekme (Shrinkage %) Matrisi:** Aynı numune ve özellik için aşamalar arası boyutsal küçülme yüzdeleri ve bilimsel uygunluk kilitleri.
3. **Fiziksel Montaj Doğrulama (`AssemblyVerification`) ve Çapsal Boşluk (`Diametral Clearance`) Testi:** Birleşim elemanının gerçek montaj geçiş durumu (`PASS` / `TIGHT FIT` / `LOOSE FIT` / `INTERFERENCE FAIL`), ölçülen boşluk (`mm`) ve açısal sapma (`°`) kaydı.
