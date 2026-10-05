import HowItWorksModal from "@/components/HowItWorksModal";
import { COLORS } from "@/constants/theme";
import { auth } from "@/firebaseConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

export default function App() {
  const [howItWorksVisible, setHowItWorksVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsubscribe = () => {};

    AsyncStorage.getItem("hasCompletedOnboarding").then((completed) => {
      if (completed !== "true") {
        router.replace("/onboarding");
        return;
      }

      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) router.replace("/projects");
        else setReady(true);
      });
    });

    return () => unsubscribe();
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.iconBox}>
              <Image
                source={require("../assets/images/splash-brand.png")}
                style={styles.logo}
              />
            </View>
            <Text style={styles.headerTitle}>Şantiyen Cebinde</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View
            entering={FadeIn.duration(500)}
            style={styles.heroContainer}
          >
            <View style={styles.cardFrame}>
              <Image
                source={require("../assets/images/building.png")}
                style={styles.heroImage}
                resizeMode="cover"
              />
            </View>

            <View style={styles.floatingBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={styles.badgeText}>%100 Doğruluk</Text>
            </View>
          </Animated.View>

          {/* Headline Section */}
          <View style={styles.textSection}>
            <Text style={styles.mainTitle}>
              Hızlı ve Güvenilir Maliyet Hesabı
            </Text>
            <Text style={styles.subTitle}>
              İnşaat projelerinizin maliyetlerini saniyeler içinde hesaplayın,
              bütçenizi profesyonelce yönetin.
            </Text>
          </View>

          {/* Button Section */}
          <View style={styles.buttonSection}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.replace("/(auth)")}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Hemen Başla</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setHowItWorksVisible(true)}
            >
              <Text style={styles.secondaryButtonText}>Nasıl Çalışır?</Text>
            </TouchableOpacity>
          </View>

          {/* Feature Cards Grid */}
          <View style={styles.grid}>
            <View style={styles.featureCard}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="calculator-outline" size={20} color="#0058be" />
              </View>
              <Text style={styles.featureTitle}>Akıllı Hesaplama</Text>
              <Text style={styles.featureDesc}>
                Güncel verilerle hesaplamalar yapın.
              </Text>
            </View>

            <View style={styles.featureCard}>
              <View style={styles.featureIconContainer}>
                <Feather name="file-text" size={20} color="#0058be" />
              </View>
              <Text style={styles.featureTitle}>Detaylı Rapor</Text>
              <Text style={styles.featureDesc}>PDF formatında çıktı alın.</Text>
            </View>
          </View>
        </ScrollView>
      </View>
      <HowItWorksModal
        visible={howItWorksVisible}
        onClose={() => setHowItWorksVisible(false)}
        onStart={() => {
          setHowItWorksVisible(false);
          router.replace("/(auth)");
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    zIndex: 100,
  },

  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },

  logo: {
    width: 42,
    height: 42,
    resizeMode: "contain",
    borderRadius: 10,
    marginRight: 12,
  },

  iconBox: {
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.primary,
    fontFamily: "Manrope",
  },

  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: COLORS.border,
  },

  profileImage: {
    width: "100%",
    height: "100%",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },

  heroContainer: {
    position: "relative",
    marginTop: 24,
    marginBottom: 30,
  },

  cardFrame: {
    aspectRatio: 16 / 9,

    backgroundColor: COLORS.white,

    borderRadius: 32,
    padding: 14,

    borderWidth: 1,
    borderColor: COLORS.borderLight,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
  },

  heroImage: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
  },

  floatingBadge: {
    position: "absolute",
    bottom: -15,
    right: -5,

    backgroundColor: COLORS.primary,

    flexDirection: "row",
    alignItems: "center",

    paddingVertical: 12,
    paddingHorizontal: 16,

    borderRadius: 18,

    borderWidth: 3,
    borderColor: COLORS.white,

    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },

  badgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 6,
    fontFamily: "Inter",
  },

  textSection: {
    alignItems: "center",
    marginBottom: 28,
  },

  mainTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.text,

    textAlign: "center",

    marginBottom: 10,

    lineHeight: 36,
    fontFamily: "Manrope",
  },

  subTitle: {
    fontSize: 15,
    color: COLORS.textSecondary,

    textAlign: "center",

    lineHeight: 24,
    paddingHorizontal: 8,

    fontFamily: "Inter",
  },

  buttonSection: {
    gap: 14,
    marginBottom: 10,
  },

  primaryButton: {
    backgroundColor: COLORS.primary,

    height: 54,
    borderRadius: 20,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
    marginRight: 8,
    fontFamily: "Inter",
  },

  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },

  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter",
  },

  grid: {
    flexDirection: "row",
    gap: 15,
  },

  featureCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
  },

  featureIconContainer: {
    width: 42,
    height: 42,

    backgroundColor: COLORS.primaryLight,

    borderRadius: 14,

    alignItems: "center",
    justifyContent: "center",

    marginBottom: 14,
  },

  featureTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,

    marginBottom: 6,

    fontFamily: "Manrope",
  },

  featureDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,

    lineHeight: 18,

    fontFamily: "Inter",
  },
});
