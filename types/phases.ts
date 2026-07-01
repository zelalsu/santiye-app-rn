export interface RequiredDocument {
  id: string;
  name: string;
}

export interface PhaseInfo {
  id: string;
  title: string;
  iconName: string;
  iconPack: IconPackType;
  docCount: number;
  requiredDocuments: RequiredDocument[];
}

export const PHASES_DATA: Omit<PhaseInfo, "docCount">[] = [
  {
    id: "1",
    title: "Temel & Altyapı",
    iconName: "hard-hat",
    iconPack: "MaterialCommunityIcons",
    requiredDocuments: [
      { id: "1-1", name: "Zemin Etüdü Raporu" },
      { id: "1-2", name: "Tapu Fotokopisi" },
      { id: "1-3", name: "Aplikasyon Krokisi" },
      { id: "1-4", name: "Yapı Ruhsatı" },
    ],
  },
  {
    id: "2",
    title: "Taşıyıcı Sistem",
    iconName: "bridge",
    iconPack: "MaterialCommunityIcons",
    requiredDocuments: [
      { id: "2-1", name: "Statik Proje" },
      { id: "2-2", name: "Betonarme Hesapları" },
      { id: "2-3", name: "Temel Vizesi" },
    ],
  },
  {
    id: "3",
    title: "Çatı & Yalıtım",
    iconName: "home-roof",
    iconPack: "MaterialCommunityIcons",
    requiredDocuments: [
      { id: "3-1", name: "Çatı Vizesi" },
      { id: "3-2", name: "Isı Yalıtım Projesi" },
      { id: "3-3", name: "Su Yalıtım Raporu" },
    ],
  },
  {
    id: "4",
    title: "Mekanik Tesisat",
    iconName: "settings",
    iconPack: "Ionicons",
    requiredDocuments: [
      { id: "4-1", name: "Sıhhi Tesisat Projesi" },
      { id: "4-2", name: "Doğalgaz Projesi" },
      { id: "4-3", name: "Havalandırma Projesi" },
    ],
  },
  {
    id: "5",
    title: "Elektrik Tesisatı",
    iconName: "bolt",
    iconPack: "MaterialCommunityIcons",
    requiredDocuments: [
      { id: "5-1", name: "Elektrik Projesi" },
      { id: "5-2", name: "Elektrik Abonelik Belgesi" },
      { id: "5-3", name: "Zayıf Akım Projesi" },
    ],
  },
  {
    id: "6",
    title: "İç & Dış Kaplama",
    iconName: "format-paint",
    iconPack: "MaterialCommunityIcons",
    requiredDocuments: [
      { id: "6-1", name: "İskân Başvuru Belgesi" },
      { id: "6-2", name: "Yangın Raporu" },
      { id: "6-3", name: "Asansör Muayene Belgesi" },
    ],
  },
];
