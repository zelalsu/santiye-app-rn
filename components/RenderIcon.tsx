// app/(tabs)/documents/components/RenderIcon.tsx
import { IconPackType } from "@/types/phases";
import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import React from "react";

interface RenderIconProps {
  iconPack: IconPackType;
  iconName: string;
  color: string;
  size?: number;
}

export const RenderIcon = ({
  iconPack,
  iconName,
  color,
  size = 24,
}: RenderIconProps) => {
  switch (iconPack) {
    case "Ionicons":
      return <Ionicons name={iconName as any} size={size} color={color} />;
    case "MaterialCommunityIcons":
      return (
        <MaterialCommunityIcons
          name={iconName as any}
          size={size}
          color={color}
        />
      );
    case "FontAwesome5":
      return <FontAwesome5 name={iconName as any} size={size} color={color} />;
    default:
      return <Ionicons name="document-outline" size={size} color={color} />;
  }
};
