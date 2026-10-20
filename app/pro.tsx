import { loadActiveProject } from "@/config/projectAccess";
import { COLORS } from "@/constants/theme";
import { auth, functions } from "@/firebaseConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { httpsCallable } from "firebase/functions";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getStorefront, useIAP, type Purchase } from "react-native-iap";
import { SafeAreaView } from "react-native-safe-area-context";

const PRODUCT_ID = "com.santiyencebinde.pro.monthly";
const PRIVACY_URL =
  "https://zelalsu.github.io/Santiyen-Cebinde-Support/privacy.html";
const TERMS_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

const FEATURES = [
  {
    icon: "office-building-plus-outline" as const,
    title: "Sınırsız şantiye oluşturun",
    description: "Tüm projelerinizi ayrı ayrı yönetin ve aralarında kolayca geçiş yapın.",
  },
  {
    icon: "account-hard-hat-outline" as const,
    title: "Tüm taşeronları tek yerde yönetin",
    description: "Firma, iş türü, anlaşma bedeli ve çalışma notlarını şantiye bazında kaydedin.",
  },
  {
    icon: "cash-check" as const,
    title: "Hakediş ve ödemeleri takip edin",
    description: "Ödenen tutarı, kalan borcu ve iş ilerlemesini anlık olarak görün.",
  },
  {
    icon: "calculator-variant-outline" as const,
    title: "Maliyeti otomatik hesaplayın",
    description: "Taşeron anlaşma bedellerini toplam şantiye maliyetine otomatik yansıtın.",
  },
  {
    icon: "file-chart-outline" as const,
    title: "Profesyonel raporlar oluşturun",
    description: "Günlük kayıtları PDF ve Excel olarak dışa aktarın, raporları proje belgelerine arşivleyin.",
  },
  {
    icon: "file-percent-outline" as const,
    title: "Maliyet raporunu paylaşın",
    description: "Projenin güncel maliyet dağılımını PDF olarak oluşturun ve paylaşın.",
  },
];

export default function ProScreen() {
  const params = useLocalSearchParams<{
    projectId?: string;
    ownerId?: string;
    role?: string;
    projectName?: string;
    intro?: string;
  }>();
  const [projectId, setProjectId] = useState(params.projectId ?? "");
  const [ownerId, setOwnerId] = useState(params.ownerId ?? "");
  const [projectName, setProjectName] = useState(params.projectName ?? "");
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogRequest, setCatalogRequest] = useState(0);
  const [restoreRequested, setRestoreRequested] = useState(false);
  const restoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (projectId && ownerId) return;
    loadActiveProject().then((active) => {
      setProjectId(active.id);
      setOwnerId(active.ownerId);
      setProjectName(active.name);
    });
  }, [ownerId, projectId]);

  const goToApp = useCallback(async () => {
    await AsyncStorage.setItem("hasSeenProIntro", "true");
    if (!projectId || !ownerId) {
      router.replace("/projects");
      return;
    }
    router.replace({
      pathname: "/(tabs)/daily",
      params: {
        projectId,
        ownerId,
        role: params.role ?? "owner",
        projectName,
      },
    } as never);
  }, [ownerId, params.role, projectId, projectName]);

  const verifyPurchase = useCallback(
    async (purchase: Purchase) => {
      const purchaseToken = purchase.purchaseToken ?? undefined;
      if (
        !projectId ||
        (Platform.OS === "ios" && !purchase.id) ||
        (Platform.OS === "android" && !purchaseToken)
      ) {
        return false;
      }
      const verify = httpsCallable<
        {
          platform: "ios" | "android";
          transactionId?: string;
          purchaseToken?: string;
          projectId: string;
        },
        { active: boolean }
      >(functions, "verifyContractorPro");
      const result = await verify({
        platform: Platform.OS === "android" ? "android" : "ios",
        transactionId: Platform.OS === "ios" ? purchase.id : undefined,
        purchaseToken: Platform.OS === "android" ? purchaseToken : undefined,
        projectId,
      });
      return result.data.active;
    },
    [projectId],
  );

  const {
    connected,
    subscriptions,
    availablePurchases,
    fetchProducts,
    getAvailablePurchases,
    requestPurchase,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: (purchase) => {
      void (async () => {
        setPurchaseLoading(true);
        try {
          const active = await verifyPurchase(purchase);
          if (!active) {
            Alert.alert(
              "Abonelik doğrulanamadı",
              "Ödeme alındıysa satın alımları geri yükleyerek tekrar doğrulayın.",
            );
            return;
          }
          await finishTransaction({ purchase, isConsumable: false });
          Alert.alert("Pro etkin", "Pro özellikleri bu şantiye için etkinleştirildi.");
          await goToApp();
        } catch (error) {
          console.error("Pro aboneliği doğrulanamadı:", error);
          Alert.alert("Doğrulama yapılamadı", "Bağlantınızı kontrol edip tekrar deneyin.");
        } finally {
          setPurchaseLoading(false);
        }
      })();
    },
    onPurchaseError: (error) => {
      if (error.code !== "user-cancelled") {
        Alert.alert("Satın alma tamamlanamadı", error.message);
      }
      setPurchaseLoading(false);
    },
  });

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    void (async () => {
      setCatalogLoading(true);
      try {
        const storefront = await getStorefront().catch(() => "unknown");
        console.log("[PRO] Etkin mağaza bölgesi:", storefront);
        await fetchProducts({ skus: [PRODUCT_ID], type: "subs" });
      } catch (error) {
        console.error("[PRO] Abonelik ürünü alınamadı:", error);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogRequest, connected, fetchProducts]);

  const product = useMemo(
    () => subscriptions.find((item) => item.id === PRODUCT_ID),
    [subscriptions],
  );
  const androidOfferToken = product?.subscriptionOffers?.find((offer) =>
    Boolean(offer.offerTokenAndroid),
  )?.offerTokenAndroid;

  useEffect(() => {
    if (!restoreRequested) return;
    const purchase = availablePurchases.find(
      (item) => item.productId === PRODUCT_ID,
    );
    if (!purchase) return;
    if (restoreTimer.current) clearTimeout(restoreTimer.current);
    void (async () => {
      try {
        const active = await verifyPurchase(purchase);
        if (!active) {
          Alert.alert("Abonelik doğrulanamadı", "Biraz sonra tekrar deneyin.");
          return;
        }
        await finishTransaction({ purchase, isConsumable: false });
        Alert.alert("Satın alma geri yüklendi", "Pro özellikleri yeniden etkinleştirildi.");
        await goToApp();
      } catch (error) {
        console.error("Pro satın alımı geri yüklenemedi:", error);
        Alert.alert("Geri yüklenemedi", "Mağaza hesabınızı ve bağlantınızı kontrol edin.");
      } finally {
        setRestoreRequested(false);
        setPurchaseLoading(false);
      }
    })();
  }, [availablePurchases, finishTransaction, goToApp, restoreRequested, verifyPurchase]);

  useEffect(
    () => () => {
      if (restoreTimer.current) clearTimeout(restoreTimer.current);
    },
    [],
  );

  const startPurchase = async () => {
    if (!connected || !product) {
      Alert.alert("Mağaza hazır değil", "Fiyat bilgisi geldikten sonra tekrar deneyin.");
      return;
    }
    if (Platform.OS === "android" && !androidOfferToken) {
      Alert.alert("Plan hazır değil", "Google Play abonelik planını henüz göndermedi.");
      return;
    }
    setPurchaseLoading(true);
    try {
      await requestPurchase({
        request:
          Platform.OS === "android"
            ? {
                google: {
                  skus: [PRODUCT_ID],
                  subscriptionOffers: [
                    { sku: PRODUCT_ID, offerToken: androidOfferToken! },
                  ],
                },
              }
            : { apple: { sku: PRODUCT_ID } },
        type: "subs",
      });
    } catch (error) {
      console.error("Pro satın alma başlatılamadı:", error);
      setPurchaseLoading(false);
    }
  };

  const restorePurchases = async () => {
    setPurchaseLoading(true);
    setRestoreRequested(true);
    try {
      restoreTimer.current = setTimeout(() => {
        setRestoreRequested(false);
        setPurchaseLoading(false);
        Alert.alert(
          "Abonelik bulunamadı",
          "Bu mağaza hesabında etkin abonelik görünmüyor.",
        );
      }, 2500);
      await getAvailablePurchases();
    } catch (error) {
      console.error("Pro satın alımı geri yüklenemedi:", error);
      Alert.alert("Geri yüklenemedi", "Mağaza hesabınızı ve bağlantınızı kontrol edin.");
      setRestoreRequested(false);
      setPurchaseLoading(false);
    }
  };

  const isOwner = !ownerId || ownerId === auth.currentUser?.uid;
  const priceText = product?.displayPrice
    ? `${product.displayPrice} / ay`
    : catalogLoading
      ? "Mağaza fiyatı yükleniyor…"
      : "Fiyat bilgisi alınamadı";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.proBadge}>
            <MaterialCommunityIcons name="star-four-points" size={18} color={COLORS.primary} />
            <Text style={styles.proBadgeText}>ŞANTİYEN CEBİNDE PRO</Text>
          </View>
          <Text style={styles.title}>Şantiyenizi daha kolay yönetin</Text>
          <Text style={styles.subtitle}>
            Tüm şantiyelerinizi ve taşeron süreçlerinizi tek üyelikle profesyonelce yönetin.
          </Text>
        </View>

        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <MaterialCommunityIcons name={feature.icon} size={22} color={COLORS.primary} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.price}>{priceText}</Text>
        {isOwner ? (
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.primaryButton, (!product || purchaseLoading) && styles.disabled]}
            onPress={startPurchase}
            disabled={!product || purchaseLoading}
          >
            {purchaseLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {product ? "Pro’ya geç" : "Abonelik hazırlanıyor"}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <Text style={styles.ownerNote}>Aboneliği yalnızca şantiye sahibi başlatabilir.</Text>
        )}

        {params.intro === "1" ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={goToApp}>
            <Text style={styles.secondaryButtonText}>Şimdilik ücretsiz devam et</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Geri dön</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={restorePurchases} disabled={purchaseLoading}>
          <Text style={styles.link}>Satın alımları geri yükle</Text>
        </TouchableOpacity>
        {!product && !catalogLoading ? (
          <TouchableOpacity onPress={() => setCatalogRequest((value) => value + 1)}>
            <Text style={styles.link}>Fiyatı tekrar sorgula</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.legalLinks}>
          <Text style={styles.legal}>Abonelik mağaza hesabınız üzerinden aylık yenilenir.</Text>
          <View style={styles.legalRow}>
            <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}>
              <Text style={styles.legalLink}>Kullanım Koşulları</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>•</Text>
            <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}>
              <Text style={styles.legalLink}>Gizlilik Politikası</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 22, paddingBottom: 36 },
  hero: { alignItems: "center", paddingTop: 12, marginBottom: 24 },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.primaryLight,
    marginBottom: 18,
  },
  proBadgeText: { color: COLORS.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  title: { color: COLORS.text, fontSize: 30, lineHeight: 36, fontWeight: "900", textAlign: "center" },
  subtitle: { color: COLORS.textSecondary, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 10 },
  features: {
    borderRadius: 22,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
  },
  featureRow: { flexDirection: "row", gap: 13, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  featureIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primaryLight },
  featureText: { flex: 1 },
  featureTitle: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  featureDescription: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 3 },
  price: { color: COLORS.primary, fontSize: 21, fontWeight: "900", textAlign: "center", marginTop: 24, marginBottom: 13 },
  primaryButton: { minHeight: 56, borderRadius: 17, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: COLORS.white, fontSize: 16, fontWeight: "900" },
  disabled: { opacity: 0.5 },
  secondaryButton: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 5 },
  secondaryButtonText: { color: COLORS.primary, fontSize: 14, fontWeight: "800" },
  link: { color: COLORS.primary, fontSize: 13, fontWeight: "700", textAlign: "center", paddingVertical: 8 },
  ownerNote: { color: COLORS.textSecondary, fontSize: 13, textAlign: "center", marginBottom: 8 },
  legalLinks: { alignItems: "center", marginTop: 12, gap: 6 },
  legal: { color: COLORS.textMuted, fontSize: 11, textAlign: "center" },
  legalRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legalLink: { color: COLORS.textSecondary, fontSize: 11, textDecorationLine: "underline" },
  legalDot: { color: COLORS.textMuted, fontSize: 11 },
});
