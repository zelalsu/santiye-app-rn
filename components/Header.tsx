import { COLORS } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function Header({
  title,
  subtitle,
  leftMenuIcon,
  backIcon,
  accountIcon,
  rightIcon,
  onRightIconPress,
}: {
  title: string;
  subtitle?: string;
  leftMenuIcon?: boolean;
  backIcon?: boolean;
  accountIcon?: boolean;
  rightIcon?: string;
  onRightIconPress?: () => void;
}) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <View style={styles.headerMain}>
        {leftMenuIcon && (
          <TouchableOpacity
            onPress={() => router.replace("/projects")}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Şantiyeler ekranına dön"
          >
            <MaterialCommunityIcons
              name="office-building-outline"
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>
        )}
        {backIcon && (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconBtn}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>
        )}

        <View style={styles.headerMainText}>
          <Text style={styles.headerMainSub}>Şantiyen Cebinde</Text>
          <Text style={styles.headerMainTitle}>{title}</Text>
          {subtitle && <Text style={styles.headerMainMeta}>{subtitle}</Text>}
        </View>
        {(rightIcon || accountIcon) && (
          <View style={styles.headerActions}>
            {rightIcon && (
              <TouchableOpacity onPress={onRightIconPress} style={styles.iconBtn}>
                <MaterialCommunityIcons name={rightIcon as any} size={20} color="#64748b" />
              </TouchableOpacity>
            )}
            {accountIcon && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Hesabım"
                onPress={() => router.push("/account")}
                style={styles.iconBtn}
              >
                <MaterialCommunityIcons name="account-outline" size={21} color="#64748b" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
  },
  iconBtn: {
    width: 35,
    height: 35,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerMain: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    gap: 12,
  },
  headerMainText: {
    flex: 1,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },

  headerMainSub: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  headerMainTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
  },
  headerMainMeta: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
    fontWeight: "500",
  },
});
