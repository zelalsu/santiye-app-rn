import { COLORS } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface CostItem {
  id: string;
  title: string;
  icon: string;
}

interface Props {
  items: CostItem[];
  columnWidth: number;
  categoryTotals: Record<string, number>;
  projectId: string;
}

export default function CostGrid({
  items,
  columnWidth,
  categoryTotals,
  projectId,
}: Props) {
  const router = useRouter();

  return (
    <View style={styles.gridContainer}>
      {items.map((item) => {
        const categoryTotal = categoryTotals[item.id] ?? 0;

        const displayPrice =
          categoryTotal > 0
            ? `₺${categoryTotal.toLocaleString("tr-TR", {
                minimumFractionDigits: 2,
              })}`
            : "Henüz hesaplanmadı";

        return (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.88}
            style={[styles.card, { width: columnWidth }]}
            onPress={() =>
              router.push({
                pathname: "/screens/[category]",
                params: {
                  category: item.id,
                  projectId,
                },
              })
            }
          >
            <View style={styles.cardIconContainer}>
              <MaterialCommunityIcons
                name={item.icon as any}
                size={24}
                color={COLORS.primary}
              />
            </View>

            <Text style={styles.cardTitle}>{item.title}</Text>

            <Text
              style={[
                styles.cardPrice,
                categoryTotal === 0 && styles.pendingPrice,
              ]}
            >
              {displayPrice}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,

    elevation: 2,
  },

  cardIconContainer: {
    width: 46,
    height: 46,

    borderRadius: 14,

    backgroundColor: COLORS.borderLight,

    alignItems: "center",
    justifyContent: "center",

    marginBottom: 16,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: "700",

    color: COLORS.text,

    marginBottom: 8,

    lineHeight: 20,

    fontFamily: "Manrope",
  },

  cardPrice: {
    fontSize: 14,
    fontWeight: "700",

    color: COLORS.primary,

    fontFamily: "Inter",
  },

  pendingPrice: {
    color: COLORS.placeholder,

    fontSize: 12,
    fontWeight: "500",

    fontStyle: "italic",

    fontFamily: "Inter",
  },
});
