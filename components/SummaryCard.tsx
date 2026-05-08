import { COLORS } from "@/constants/theme";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function SummaryCard({
  total,
  projectId,
}: {
  total: number;
  projectId: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() =>
        router.push({
          pathname: "/projectSummary",
          params: { projectId },
        })
      }
      style={styles.summaryCard}
    >
      <View style={styles.leftContent}>
        <Text style={styles.summaryLabel}>Toplam Tahmini Maliyet</Text>

        <Text style={styles.totalPrice}>
          ₺
          {total.toLocaleString("tr-TR", {
            minimumFractionDigits: 2,
          })}
        </Text>

        <View style={styles.badge}>
          <Ionicons name="trending-up" size={13} color={COLORS.white} />

          <Text style={styles.badgeText}> Güncel Portföy Özeti</Text>
        </View>
      </View>

      <View style={styles.iconWrapper}>
        <MaterialCommunityIcons
          name="chart-bar"
          size={58}
          color="rgba(255,255,255,0.18)"
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 8,
    padding: 24,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 8,
  },

  leftContent: {
    flex: 1,
    paddingRight: 12,
  },

  summaryLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
    fontFamily: "Inter",
  },

  totalPrice: {
    color: COLORS.white,
    fontSize: 30,
    fontWeight: "800",
    marginTop: 8,
    marginBottom: 14,
    letterSpacing: -0.6,
    fontFamily: "Manrope",
  },

  badge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
  },

  badgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 5,
    fontFamily: "Inter",
  },

  iconWrapper: {
    width: 74,
    height: 74,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
});
