import { COLORS } from "@/constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const STEPS = [
  {
    icon: "business-outline" as const,
    title: "Şantiyelerini tek yerde yönet",
    description:
      "Her projen için ayrı bir şantiye oluştur; maliyet, günlük kayıt, taşeron ve belgelerini düzenli tut.",
  },
  {
    icon: "calculator-outline" as const,
    title: "Maliyeti adım adım hesapla",
    description:
      "Kategori seç, miktar ve birim fiyatı gir. Toplam maliyetin her eklemede otomatik güncellensin.",
  },
  {
    icon: "document-text-outline" as const,
    title: "Kaydet, raporla ve paylaş",
    description:
      "Şantiye günlüklerini ve belgelerini sakla; maliyet özetini PDF olarak oluşturup kolayca paylaş.",
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const { width } = useWindowDimensions();
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const finish = async () => {
    await AsyncStorage.setItem("hasCompletedOnboarding", "true");
    router.replace("/(auth)");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <Image
              source={require("../assets/images/splash-brand.png")}
              style={styles.logo}
            />
            <Text style={styles.brand}>Şantiyen Cebinde</Text>
          </View>
          {!isLast && (
            <Pressable accessibilityRole="button" onPress={finish} hitSlop={12}>
              <Text style={styles.skip}>Atla</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.visual, { minHeight: Math.min(width * 0.78, 340) }]}>
          <View style={styles.iconHalo}>
            <Ionicons name={step.icon} size={76} color={COLORS.primary} />
          </View>
          <View style={styles.miniCard}>
            <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
            <Text style={styles.miniCardText}>Verilerin kaydedildi</Text>
          </View>
        </View>

        <View style={styles.copy}>
          <Text style={styles.eyebrow}>{index + 1} / {STEPS.length}</Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>
        </View>

        <View style={styles.dots}>
          {STEPS.map((_, dotIndex) => (
            <View
              key={dotIndex}
              style={[styles.dot, dotIndex === index && styles.dotActive]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          {index > 0 && (
            <Pressable style={styles.backButton} onPress={() => setIndex(index - 1)}>
              <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
              <Text style={styles.backText}>Geri</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.nextButton, index === 0 && { flex: 1 }]}
            onPress={() => (isLast ? finish() : setIndex(index + 1))}
          >
            <Text style={styles.nextText}>{isLast ? "Başlayalım" : "İlerle"}</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 16, gap: 22 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 40, height: 40, borderRadius: 12 },
  brand: { color: COLORS.primary, fontSize: 17, fontWeight: "800" },
  skip: { color: COLORS.textSecondary, fontSize: 15, fontWeight: "700" },
  visual: { alignItems: "center", justifyContent: "center" },
  iconHalo: {
    width: 190,
    height: 190,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  miniCard: {
    position: "absolute",
    bottom: 28,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  miniCardText: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  copy: { gap: 10 },
  eyebrow: { color: COLORS.primary, fontSize: 13, fontWeight: "800" },
  title: { color: COLORS.text, fontSize: 30, lineHeight: 36, fontWeight: "900" },
  description: { color: COLORS.textSecondary, fontSize: 16, lineHeight: 24 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  dotActive: { width: 28, backgroundColor: COLORS.primary },
  actions: { flexDirection: "row", gap: 12, marginTop: "auto" },
  backButton: {
    flex: 1,
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
  },
  backText: { color: COLORS.primary, fontSize: 16, fontWeight: "800" },
  nextButton: {
    flex: 1.5,
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
  },
  nextText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
