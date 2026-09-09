export type IconPackType =
  | "Ionicons"
  | "MaterialCommunityIcons"
  | "FontAwesome5";

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
}

export const PHASES_DATA: Omit<PhaseInfo, "docCount">[] = [
  {
    id: "1",
    title: "Temel & Altyapı",
    iconName: "hard-hat",
    iconPack: "MaterialCommunityIcons",
  },
  {
    id: "2",
    title: "Taşıyıcı Sistem",
    iconName: "bridge",
    iconPack: "MaterialCommunityIcons",
  },
  {
    id: "3",
    title: "Çatı & Yalıtım",
    iconName: "home-roof",
    iconPack: "MaterialCommunityIcons",
  },
];
