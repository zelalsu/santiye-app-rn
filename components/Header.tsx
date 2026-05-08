import { COLORS } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function Header({
  title,
  leftMenuIcon,
  backIcon,
  rightIcon,
  onRightIconPress,
}: {
  title: string;
  leftMenuIcon?: boolean;
  backIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
}) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      {leftMenuIcon && (
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons
            name="format-align-left"
            size={20}
            color="#64748b"
          />
        </TouchableOpacity>
      )}
      {backIcon && (
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons
            name={backIcon as any}
            size={20}
            color="#64748b"
          />
        </TouchableOpacity>
      )}
      <Text style={styles.headerTitle}>{title}</Text>
      {rightIcon && (
        <TouchableOpacity onPress={onRightIconPress} style={styles.iconBtn}>
          <MaterialCommunityIcons
            name={rightIcon as any}
            size={20}
            color="#64748b"
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
});
