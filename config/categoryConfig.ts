// config/categoryConfig.ts

export type UnitType = "ton" | "m³" | "m²" | "adet" | "mt" | "set" | "gün";

export interface EntryTemplate {
  label: string; // Seçilince açıklama alanına dolar
}

export interface CategoryConfig {
  id: string;
  title: string;
  icon: string;
  unit: UnitType;
  unitLabel: string;
  quantityHint?: string;
  templates?: EntryTemplate[]; // Seçilebilir kalem şablonları
}

export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  yevmiye: {
    id: "yevmiye",
    title: "Günlük İşçilik",
    icon: "account-cash-outline",
    unit: "gün",
    unitLabel: "gün",
    quantityHint: "Kaç gün?",
    templates: [
      { label: "Usta yevmiyesi" },
      { label: "Kalfa yevmiyesi" },
      { label: "İşçi yevmiyesi" },
      { label: "Operatör yevmiyesi" },
      { label: "Elektrik ustası yevmiyesi" },
      { label: "Tesisat ustası yevmiyesi" },
      { label: "Boya ustası yevmiyesi" },
      { label: "Gece mesaisi" },
      { label: "Fazla mesai" },
    ],
  },
  demir: {
    id: "demir",
    title: "Demir",
    icon: "crane",
    unit: "ton",
    unitLabel: "ton",
    quantityHint: "Kaç ton?",
    templates: [
      { label: "İnşaat demiri Ø8" },
      { label: "İnşaat demiri Ø10" },
      { label: "İnşaat demiri Ø12" },
      { label: "İnşaat demiri Ø14" },
      { label: "İnşaat demiri Ø16" },
      { label: "İnşaat demiri Ø20" },
      { label: "Hasır çelik Q131" },
      { label: "Hasır çelik Q188" },
      { label: "Hasır çelik Q257" },
    ],
  },
  beton: {
    id: "beton",
    title: "Beton",
    icon: "home-outline",
    unit: "m³",
    unitLabel: "m³",
    quantityHint: "Kaç m³?",
    templates: [
      { label: "C16 betonu" },
      { label: "C20 betonu" },
      { label: "C25 betonu" },
      { label: "C30 betonu" },
      { label: "C35 betonu" },
      { label: "Grobeton" },
      { label: "Hazır beton pompajlı" },
    ],
  },
  siva: {
    id: "siva",
    title: "Sıva",
    icon: "texture",
    unit: "m²",
    unitLabel: "m²",
    quantityHint: "Kaç m²?",
    templates: [
      { label: "İç sıva - alçı" },
      { label: "İç sıva - çimento" },
      { label: "Dış sıva - çimento" },
      { label: "Dış sıva - ısı yalıtımlı" },
      { label: "Perdah sıvası" },
      { label: "Alçıpan" },
    ],
  },
  boya: {
    id: "boya",
    title: "Boya",
    icon: "format-paint",
    unit: "m²",
    unitLabel: "m²",
    quantityHint: "Kaç m²?",
    templates: [
      { label: "İç cephe plastik boya" },
      { label: "İç cephe su bazlı astar" },
      { label: "Dış cephe silikonlu boya" },
      { label: "Dış cephe akrilik boya" },
      { label: "Antipas + yağlı boya (demir)" },
      { label: "Vernik (ahşap)" },
    ],
  },
  kapi: {
    id: "kapi",
    title: "Kapı",
    icon: "door-closed",
    unit: "adet",
    unitLabel: "adet",
    quantityHint: "Kaç adet?",
    templates: [
      { label: "Çelik kapı - giriş (tek kanat)" },
      { label: "Çelik kapı - giriş (çift kanat)" },
      { label: "Ahşap oda kapısı" },
      { label: "WC / banyo kapısı" },
      { label: "Yangın kapısı" },
      { label: "Otomatik sürgülü kapı" },
      { label: "Garaj kapısı (seksiyonel)" },
    ],
  },
  pencere: {
    id: "pencere",
    title: "Pencere",
    icon: "view-grid",
    unit: "adet",
    unitLabel: "adet",
    quantityHint: "Kaç adet?",
    templates: [
      { label: "PVC pencere - tek cam" },
      { label: "PVC pencere - çift cam" },
      { label: "PVC pencere - ısıcamlı" },
      { label: "Alüminyum pencere" },
      { label: "Alüminyum sürgülü kapı-pencere" },
      { label: "Kaplama / panjur" },
    ],
  },
  seramik: {
    id: "seramik",
    title: "Seramik",
    icon: "grid",
    unit: "m²",
    unitLabel: "m²",
    quantityHint: "Kaç m²?",
    templates: [
      { label: "Yer seramiği 30x30" },
      { label: "Yer seramiği 60x60" },
      { label: "Duvar seramiği 20x40" },
      { label: "Duvar seramiği 30x60" },
      { label: "Granit yer karosu" },
      { label: "Mermer (doğal taş)" },
      { label: "Mozaik / bordür" },
    ],
  },
  elektrik: {
    id: "elektrik",
    title: "Elektrik",
    icon: "lightning-bolt-outline",
    unit: "set",
    unitLabel: "set",
    quantityHint: "Kaç set?",
    templates: [
      { label: "Komple elektrik tesisatı (daire)" },
      { label: "Dağıtım panosu" },
      { label: "Topraklama tesisatı" },
      { label: "Zayıf akım (anten, data)" },
      { label: "Aydınlatma armatürleri" },
      { label: "Acil aydınlatma" },
      { label: "Jeneratör bağlantısı" },
    ],
  },
  su: {
    id: "su",
    title: "Su Tesisatı",
    icon: "water-outline",
    unit: "set",
    unitLabel: "set",
    quantityHint: "Kaç set?",
    templates: [
      { label: "Komple sıhhi tesisat (daire)" },
      { label: "PPR boru tesisatı" },
      { label: "Pis su / atık su boruları" },
      { label: "Yağmur suyu drenajı" },
      { label: "Sıcak su tesisatı (kombili)" },
      { label: "Doğalgaz tesisatı" },
      { label: "Yangın söndürme sistemi" },
    ],
  },
  cati: {
    id: "cati",
    title: "Çatı",
    icon: "home-variant-outline",
    unit: "m²",
    unitLabel: "m²",
    quantityHint: "Kaç m²?",
    templates: [
      { label: "Çelik konstrüksiyon çatı" },
      { label: "Ahşap çatı iskelet" },
      { label: "Shingle kaplama" },
      { label: "Kiremit kaplama (beton)" },
      { label: "Kiremit kaplama (pişmiş toprak)" },
      { label: "Membran su yalıtımı" },
      { label: "Taraça / teras çatı" },
      { label: "Çatı ısı yalıtımı (XPS)" },
    ],
  },
};
