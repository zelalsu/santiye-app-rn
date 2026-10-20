import Header from "@/components/Header";
import { canSeeCosts, loadActiveProject } from "@/config/projectAccess";
import { recalculateProjectTotal } from "@/config/projectCosts";
import { COLORS } from "@/constants/theme";
import { auth, db, functions } from "@/firebaseConfig";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getStorefront, useIAP, type Purchase } from "react-native-iap";
import { SafeAreaView } from "react-native-safe-area-context";

interface Contractor {
  id: string;
  name: string;
  workType: string;
  contractAmount: number;
  paidAmount: number;
  progress: number;
  note?: string;
  createdAt?: unknown;
}

const parseMoney = (value: string) => parseFloat(value.replace(",", ".")) || 0;
const CONTRACTOR_PRO_PRODUCT_IDS = {
  ios: "com.santiyencebinde.pro.monthly",
  android: "com.santiyencebinde.pro.monthly",
} as const;
const CONTRACTOR_PRO_PRODUCT_ID =
  Platform.OS === "android"
    ? CONTRACTOR_PRO_PRODUCT_IDS.android
    : CONTRACTOR_PRO_PRODUCT_IDS.ios;
const CONTRACTOR_PREVIEW: Contractor = {
  id: "contractor-preview",
  name: "Örnek Taşeron",
  workType: "Kalıp ve demir işleri",
  contractAmount: 240000,
  paidAmount: 100000,
  progress: 55,
  note: "Bu kart, Pro ekranında tutabileceğiniz bilgilerin bir örneğidir.",
};

interface ContractorProSubscription {
  active?: boolean;
}

export default function ContractorsScreen() {
  const params = useLocalSearchParams<{
    projectId?: string;
    ownerId?: string;
  }>();
  const user = auth.currentUser;
  const userId = user?.uid;

  const [projectId, setProjectId] = useState(params.projectId ?? "");
  const [projectOwnerId, setProjectOwnerId] = useState(params.ownerId ?? "");
  const [role, setRole] = useState<
    "owner" | "manager" | "office" | "chief" | "field" | undefined
  >();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [workType, setWorkType] = useState("");
  const [contractAmount, setContractAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [progress, setProgress] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [proLoading, setProLoading] = useState(true);
  const [projectPro, setProjectPro] = useState(false);
  const [accountPro, setAccountPro] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogRequest, setCatalogRequest] = useState(0);

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

      const verifyContractorPro = httpsCallable<
        {
          platform: "ios" | "android";
          transactionId?: string;
          purchaseToken?: string;
          projectId: string;
        },
        { active: boolean }
      >(functions, "verifyContractorPro");
      const result = await verifyContractorPro({
        platform: Platform.OS === "android" ? "android" : "ios",
        transactionId: Platform.OS === "ios" ? purchase.id : undefined,
        purchaseToken:
          Platform.OS === "android" ? purchaseToken : undefined,
        projectId,
      });
      return result.data.active;
    },
    [projectId],
  );

  const {
    connected: storeConnected,
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
          console.log("Taşeron Pro doğrulama sonucu:  ", active);
          if (!active) {
            Alert.alert(
              "Abonelik etkinleşmedi",
              "Mağaza aboneliği etkin görünmüyor. Satın alımları geri yükleyip tekrar deneyin.",
            );
            return;
          }
          await finishTransaction({ purchase, isConsumable: false });
          Alert.alert(
            "Pro etkin",
            "Taşeron takibi bu şantiye için etkinleştirildi.",
          );
        } catch (error) {
          console.error("Taşeron Pro doğrulanamadı:", error);
          Alert.alert(
            "Doğrulama yapılamadı",
            "Ödeme alınmadıysa tekrar deneyin. Ödeme alındıysa Satın Alımları Geri Yükle ile aboneliğinizi doğrulayın.",
          );
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
    loadActiveProject().then((active) => {
      setProjectId(params.projectId ?? active.id);
      setProjectOwnerId(params.ownerId ?? active.ownerId ?? userId ?? "");
      setRole(active.role);
    });
  }, [params.ownerId, params.projectId, userId]);

  useEffect(() => {
    if (!role || canSeeCosts(role)) return;
    router.replace({
      pathname: "/(tabs)/daily",
      params: { projectId, ownerId: projectOwnerId, role },
    } as never);
  }, [projectId, projectOwnerId, role]);

  useEffect(() => {
    if (!projectId || !projectOwnerId || !canSeeCosts(role)) return;

    setProLoading(true);
    const subscriptionRef = doc(
      db,
      "users",
      projectOwnerId,
      "projects",
      projectId,
      "subscriptions",
      "contractorPro",
    );
    return onSnapshot(
      subscriptionRef,
      (snapshot) => {
        const subscription = snapshot.data() as
          | ContractorProSubscription
          | undefined;
        setProjectPro(subscription?.active === true);
        setProLoading(false);
      },
      (error) => {
        console.error("Taşeron Pro durumu alınamadı:", error);
        setProLoading(false);
      },
    );
  }, [projectId, projectOwnerId, role]);

  useEffect(() => {
    if (!projectOwnerId || !canSeeCosts(role)) return;
    return onSnapshot(
      doc(db, "users", projectOwnerId, "entitlements", "pro"),
      (snapshot) => setAccountPro(snapshot.data()?.active === true),
      (error) => {
        if (error.code !== "permission-denied") {
          console.error("Hesap Pro durumu alınamadı:", error);
        }
        setAccountPro(false);
      },
    );
  }, [projectOwnerId, role]);

  const isContractorPro = accountPro || projectPro;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        // Sandbox hesabı veya App Store ülkesi Ayarlar'dan değiştirildiğinde
        // StoreKit önceki mağazanın ürün fiyatını bellekte tutabilir. Uygulama
        // yeniden öne geldiğinde kataloğu güncel storefront için tekrar iste.
        setCatalogRequest((value) => value + 1);
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    console.log("[IAP] Store bağlantısı:", {
      connected: storeConnected,
      platform: Platform.OS,
      productId: CONTRACTOR_PRO_PRODUCT_ID,
    });

    if (!storeConnected) return;

    let cancelled = false;

    void (async () => {
      setCatalogLoading(true);
      try {
        const storefront = await getStorefront().catch(() => "unknown");
        console.log("[IAP] Etkin mağaza bölgesi:", storefront);

        // App Store Connect değişiklikleri sandbox kataloğuna gecikmeli
        // yansıyabildiği için boş yanıt durumunda birkaç kez yeniden sorgula.
        for (let attempt = 1; attempt <= 3 && !cancelled; attempt += 1) {
          console.log(`[IAP] Abonelik ürünü sorgulanıyor (${attempt}/3)…`);
          await fetchProducts({
            skus: [CONTRACTOR_PRO_PRODUCT_ID],
            type: "subs",
          });
          console.log("[IAP] Ürün sorgusu tamamlandı; hook sonucu bekleniyor.");
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        }
      } catch (error) {
        console.error("[IAP] Mağaza ürünleri alınamadı:", error);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();

    void getAvailablePurchases()
      .then(() => {
        console.log("[IAP] Satın alma geçmişi sorgusu tamamlandı.");
      })
      .catch((error) =>
        console.warn("[IAP] Satın alma geçmişi alınamadı:", error),
      );

    return () => {
      cancelled = true;
    };
  }, [catalogRequest, fetchProducts, getAvailablePurchases, storeConnected]);

  useEffect(() => {
    console.log(
      "[IAP] Hook abonelikleri güncellendi:",
      subscriptions.map((product) => ({
        id: product.id,
        displayPrice: product.displayPrice,
        currency: product.currency,
        type: product.type,
      })),
    );
  }, [subscriptions]);

  useEffect(() => {
    if (!projectId || availablePurchases.length === 0) return;
    const purchase = availablePurchases.find(
      (item) => item.productId === CONTRACTOR_PRO_PRODUCT_ID,
    );
    if (!purchase) return;

    void (async () => {
      try {
        const active = await verifyPurchase(purchase);
        if (active) await finishTransaction({ purchase, isConsumable: false });
      } catch (error) {
        console.warn("Geri yüklenen abonelik doğrulanamadı:", error);
      }
    })();
  }, [availablePurchases, finishTransaction, projectId, verifyPurchase]);

  useEffect(() => {
    if (
      !userId ||
      !projectId ||
      !projectOwnerId ||
      !isContractorPro ||
      !canSeeCosts(role)
    ) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const contractorsRef = collection(
      db,
      "users",
      projectOwnerId,
      "projects",
      projectId,
      "contractors",
    );
    const q = query(contractorsRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Contractor[];

        setContractors(data);
        setLoading(false);
      },
      (error) => {
        console.error("Taşeron dinleyicisi açılamadı:", error);
        setLoading(false);
      },
    );

    return unsub;
  }, [isContractorPro, projectId, projectOwnerId, role, userId]);

  const totals = useMemo(() => {
    const contract = contractors.reduce(
      (sum, item) => sum + (item.contractAmount || 0),
      0,
    );
    const paid = contractors.reduce(
      (sum, item) => sum + (item.paidAmount || 0),
      0,
    );

    return {
      count: contractors.length,
      contract,
      paid,
      remaining: Math.max(contract - paid, 0),
    };
  }, [contractors]);

  const visibleContractors = isContractorPro
    ? contractors
    : [CONTRACTOR_PREVIEW];
  const visibleTotals = isContractorPro
    ? totals
    : { count: 1, contract: 240000, paid: 100000, remaining: 140000 };

  const resetForm = () => {
    setName("");
    setWorkType("");
    setContractAmount("");
    setPaidAmount("");
    setProgress("");
    setNote("");
  };

  const updateProjectTotal = async () => {
    await recalculateProjectTotal(projectOwnerId, projectId);
  };

  const handleAddContractor = async () => {
    if (!user || !projectId || !name.trim() || !workType.trim()) return;

    const parsedProgress = Math.min(
      Math.max(parseInt(progress, 10) || 0, 0),
      100,
    );

    setSaving(true);
    try {
      await addDoc(
        collection(
          db,
          "users",
          projectOwnerId,
          "projects",
          projectId,
          "contractors",
        ),
        {
          name: name.trim(),
          workType: workType.trim(),
          contractAmount: parseMoney(contractAmount),
          paidAmount: parseMoney(paidAmount),
          progress: parsedProgress,
          note: note.trim(),
          createdAt: serverTimestamp(),
        },
      );
      await updateProjectTotal();
      resetForm();
    } catch (error) {
      console.error("Taşeron kaydedilemedi:", error);
      Alert.alert(
        "Taşeron kaydedilemedi",
        "Yazdıklarınız korunuyor. Bağlantınızı kontrol edip tekrar deneyin.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContractor = (contractor: Contractor) => {
    if (!user || !projectId) return;

    Alert.alert("Taşeronu Sil", `${contractor.name} kaydı silinsin mi?`, [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(
            doc(
              db,
              "users",
              projectOwnerId,
              "projects",
              projectId,
              "contractors",
              contractor.id,
            ),
          );
          await updateProjectTotal();
        },
      },
    ]);
  };

  const getStatus = (contractor: Contractor) => {
    const remaining =
      (contractor.contractAmount || 0) - (contractor.paidAmount || 0);

    if (remaining <= 0) return { label: "Ödendi", style: styles.statusPaid };
    if ((contractor.progress || 0) >= 100) {
      return { label: "Ödeme Bekliyor", style: styles.statusWarning };
    }
    return { label: "Devam Ediyor", style: styles.statusActive };
  };

  const isFormValid = !!(
    projectId &&
    name.trim() &&
    workType.trim() &&
    contractAmount
  );

  const subscription = subscriptions.find(
    (item) => item.id === CONTRACTOR_PRO_PRODUCT_ID,
  );
  const androidOfferToken = subscription?.subscriptionOffers?.find(
    (offer) => Boolean(offer.offerTokenAndroid),
  )?.offerTokenAndroid;
  const isProjectOwner = projectOwnerId === userId;
  const displayPrice = subscription?.displayPrice;
  const isProductReady = Boolean(subscription);
  const startPurchase = async () => {
    if (!storeConnected) {
      Alert.alert(
        "Mağaza hazır değil",
        "Uygulama mağazası bağlantısı kurulunca tekrar deneyin.",
      );
      return;
    }
    if (!isProductReady) {
      Alert.alert(
        "Abonelik henüz hazır değil",
        "Uygulama mağazası fiyat bilgisini henüz göndermedi. Lütfen kısa süre sonra tekrar deneyin.",
      );
      return;
    }
    if (Platform.OS === "android" && !androidOfferToken) {
      Alert.alert(
        "Abonelik planı hazır değil",
        "Google Play aylık abonelik planını henüz göndermedi. Lütfen kısa süre sonra tekrar deneyin.",
      );
      return;
    }
    setPurchaseLoading(true);
    try {
      await requestPurchase({
        request:
          Platform.OS === "android"
            ? {
                google: {
                  skus: [CONTRACTOR_PRO_PRODUCT_ID],
                  subscriptionOffers: [
                    {
                      sku: CONTRACTOR_PRO_PRODUCT_ID,
                      offerToken: androidOfferToken!,
                    },
                  ],
                },
              }
            : { apple: { sku: CONTRACTOR_PRO_PRODUCT_ID } },
        type: "subs",
      });
    } catch (error) {
      console.error("Taşeron Pro satın alma başlatılamadı:", error);
      setPurchaseLoading(false);
    }
  };

  const restorePurchases = async () => {
    setPurchaseLoading(true);
    try {
      await getAvailablePurchases();
      Alert.alert(
        "Kontrol ediliyor",
        "Etkin abonelik varsa bu şantiye için doğrulanacak.",
      );
    } catch (error) {
      console.error("Satın alma geri yüklenemedi:", error);
      Alert.alert(
        "Geri yüklenemedi",
        "Mağaza hesabınızı ve bağlantınızı kontrol edip tekrar deneyin.",
      );
    } finally {
      setPurchaseLoading(false);
    }
  };

  if (!role || proLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Taşeron Takibi" leftMenuIcon accountIcon />
        <View style={styles.proLoading}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isContractorPro && !isProjectOwner) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Taşeron Takibi" leftMenuIcon accountIcon />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.proScreen}
        >
          <View style={styles.proIcon}>
            <MaterialCommunityIcons
              name="shield-crown-outline"
              size={34}
              color={COLORS.primary}
            />
          </View>
          <Text style={styles.proTitle}>Taşeron Takibi Pro</Text>
          <Text style={styles.proSubtitle}>
            Sözleşmeleri, hakedişleri ve taşeron ödemelerini tek şantiyede takip
            edin.
          </Text>
          <Text style={styles.proBenefitsTitle}>Pro ile neler yapabilirsiniz?</Text>
          <View style={styles.proFeatures}>
            {[
              {
                icon: "account-hard-hat-outline" as const,
                title: "Tüm taşeronları tek yerde yönetin",
                description:
                  "Firma, iş türü, anlaşma bedeli ve çalışma notlarını şantiye bazında kaydedin.",
              },
              {
                icon: "cash-check" as const,
                title: "Hakediş ve ödemeleri takip edin",
                description:
                  "Ödenen tutarı, kalan borcu ve iş ilerlemesini anlık olarak görün.",
              },
              {
                icon: "calculator-variant-outline" as const,
                title: "Maliyeti otomatik hesaplayın",
                description:
                  "Taşeron anlaşma bedellerini toplam şantiye maliyetine otomatik yansıtın.",
              },
              {
                icon: "file-document-check-outline" as const,
                title: "Kayıtları düzenli ve erişilebilir tutun",
                description:
                  "Ödeme geçmişini ve sözleşme bilgilerini ihtiyaç duyduğunuz anda kontrol edin.",
              },
            ].map((feature) => (
              <View key={feature.title} style={styles.proFeature}>
                <View style={styles.proFeatureIcon}>
                  <MaterialCommunityIcons
                    name={feature.icon}
                    size={22}
                    color={COLORS.primary}
                  />
                </View>
                <View style={styles.proFeatureContent}>
                  <Text style={styles.proFeatureTitle}>{feature.title}</Text>
                  <Text style={styles.proFeatureDescription}>
                    {feature.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          {isProjectOwner ? (
            <>
              <Text style={styles.proPrice}>
                {isProductReady
                  ? `${displayPrice} / ay`
                  : catalogLoading
                    ? "App Store fiyatı yükleniyor…"
                    : "Fiyat bilgisi alınamadı"}
              </Text>
              <TouchableOpacity
                style={[
                  styles.proButton,
                  (!isProductReady || purchaseLoading) &&
                    styles.proButtonDisabled,
                ]}
                onPress={startPurchase}
                disabled={!isProductReady || purchaseLoading}
              >
                {purchaseLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.proButtonText}>
                    {isProductReady
                      ? "Aylık aboneliği başlat"
                      : "Abonelik hazırlanıyor"}
                  </Text>
                )}
              </TouchableOpacity>
              {!isProductReady && !catalogLoading ? (
                <TouchableOpacity
                  style={styles.restoreButton}
                  onPress={() => setCatalogRequest((value) => value + 1)}
                >
                  <Text style={styles.restoreButtonText}>Tekrar dene</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.restoreButton}
                onPress={restorePurchases}
                disabled={purchaseLoading}
              >
                <Text style={styles.restoreButtonText}>
                  Satın alımları geri yükle
                </Text>
              </TouchableOpacity>
              <Text style={styles.proFootnote}>
                Ödeme, Apple Kimliğiniz üzerinden aylık yenilenir. İstediğiniz
                zaman App Store aboneliklerinden yönetebilirsiniz.
              </Text>
            </>
          ) : (
            <Text style={styles.proFootnote}>
              Bu özelliği yalnızca şantiye yöneticisi etkinleştirebilir.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Taşeron Takibi" leftMenuIcon accountIcon />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {!isContractorPro ? (
            <View style={styles.previewBanner}>
              <View style={styles.previewBannerTop}>
                <View style={styles.previewBannerIcon}>
                  <MaterialCommunityIcons
                    name="shield-crown-outline"
                    size={23}
                    color={COLORS.primary}
                  />
                </View>
                <View style={styles.previewBannerCopy}>
                  <Text style={styles.previewBannerTitle}>
                    Taşeron Takibi Pro
                  </Text>
                  <Text style={styles.previewBannerText}>
                    Aşağıdaki ekranı inceleyin. Kayıt eklemek ve yönetmek için
                    Pro’yu etkinleştirin.
                  </Text>
                </View>
              </View>
              <View style={styles.previewBannerAction}>
                <Text style={styles.previewBannerPrice}>
                  {isProductReady
                    ? `${displayPrice} / ay`
                    : "Fiyat yükleniyor…"}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.previewUpgradeButton,
                    (!isProductReady || purchaseLoading) &&
                      styles.proButtonDisabled,
                  ]}
                  onPress={startPurchase}
                  disabled={!isProductReady || purchaseLoading}
                >
                  {purchaseLoading ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.previewUpgradeButtonText}>
                      Pro’yu etkinleştir
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <View style={styles.summaryStrip}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Taşeron</Text>
              <Text style={styles.summaryValue}>{visibleTotals.count}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Ödenen</Text>
              <Text style={styles.summaryValue}>
                ₺{visibleTotals.paid.toLocaleString("tr-TR")}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Kalan</Text>
              <Text style={styles.summaryValue}>
                ₺{visibleTotals.remaining.toLocaleString("tr-TR")}
              </Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <View style={styles.formTitleRow}>
              <View style={styles.formIcon}>
                <MaterialCommunityIcons
                  name="account-hard-hat-outline"
                  size={20}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.formTitle}>Yeni Taşeron</Text>
            </View>
            <Text style={styles.costNotice}>
              Anlaşma bedeli genel maliyete eklenir. Aynı işçilik bedelini
              metraj birim fiyatına tekrar eklemeyin.
            </Text>

            <View style={styles.row}>
              <View style={[styles.fieldGroup, styles.half]}>
                <Text style={styles.fieldLabel}>Ad / Firma</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Mehmet Usta"
                  placeholderTextColor={COLORS.placeholder}
                  value={name}
                  onChangeText={setName}
                  editable={isContractorPro}
                />
              </View>
              <View style={[styles.fieldGroup, styles.half]}>
                <Text style={styles.fieldLabel}>İş Türü</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Sıva işi"
                  placeholderTextColor={COLORS.placeholder}
                  value={workType}
                  onChangeText={setWorkType}
                  editable={isContractorPro}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.fieldGroup, styles.half]}>
                <Text style={styles.fieldLabel}>Anlaşma Bedeli</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0,00"
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="decimal-pad"
                  value={contractAmount}
                  onChangeText={(text) =>
                    setContractAmount(text.replace(/[^0-9.,]/g, ""))
                  }
                  editable={isContractorPro}
                />
              </View>
              <View style={[styles.fieldGroup, styles.half]}>
                <Text style={styles.fieldLabel}>Ödenen</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0,00"
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="decimal-pad"
                  value={paidAmount}
                  onChangeText={(text) =>
                    setPaidAmount(text.replace(/[^0-9.,]/g, ""))
                  }
                  editable={isContractorPro}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.fieldGroup, styles.half]}>
                <Text style={styles.fieldLabel}>Tarih</Text>

                <TouchableOpacity
                  style={styles.dateInput}
                  activeOpacity={0.8}
                  onPress={() => setShowDatePicker(true)}
                  disabled={!isContractorPro}
                >
                  <View style={styles.dateLeft}>
                    <MaterialCommunityIcons
                      name="calendar-month-outline"
                      size={20}
                      color={COLORS.primary}
                    />

                    <Text style={styles.dateText}>
                      {date.toLocaleDateString("tr-TR")}
                    </Text>
                  </View>

                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={22}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display="spinner"
                    locale="tr-TR"
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate) setDate(selectedDate);
                    }}
                  />
                )}
              </View>
              <View style={[styles.fieldGroup, styles.half]}>
                <Text style={styles.fieldLabel}>Not</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Avans, vade..."
                  placeholderTextColor={COLORS.placeholder}
                  value={note}
                  onChangeText={setNote}
                  editable={isContractorPro}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.addBtn,
                isContractorPro && !isFormValid && styles.addBtnDisabled,
              ]}
              onPress={isContractorPro ? handleAddContractor : startPurchase}
              activeOpacity={0.85}
              disabled={isContractorPro ? !isFormValid || saving : purchaseLoading}
            >
              {saving || (!isContractorPro && purchaseLoading) ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name={isContractorPro ? "plus" : "lock-open-variant-outline"}
                    size={18}
                    color={COLORS.white}
                    style={styles.addBtnIcon}
                  />
                  <Text style={styles.addBtnText}>
                    {isContractorPro
                      ? "Taşeronu Kaydet"
                      : "Kayıt eklemek için Pro’yu etkinleştir"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.listHeaderTitle}>Taşeronlar</Text>
            <Text style={styles.listHeaderCount}>
              {isContractorPro
                ? `${contractors.length} kayıt`
                : "Örnek görünüm"}
            </Text>
          </View>

          {isContractorPro && loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : visibleContractors.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="account-group-outline"
                size={44}
                color="#CBD5E1"
              />
              <Text style={styles.emptyTitle}>Henüz taşeron yok</Text>
              <Text style={styles.emptySubtitle}>
                Anlaşma bedeli ve ödemeleri girerek kalan borçları takip edin
              </Text>
            </View>
          ) : (
            visibleContractors.map((contractor) => {
              const remaining = Math.max(
                (contractor.contractAmount || 0) - (contractor.paidAmount || 0),
                0,
              );
              const paymentPercent =
                contractor.contractAmount > 0
                  ? Math.min(
                      (contractor.paidAmount / contractor.contractAmount) * 100,
                      100,
                    )
                  : 0;
              const status = getStatus(contractor);

              return (
                <View key={contractor.id} style={styles.contractorCard}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardTitleWrap}>
                      <Text style={styles.contractorName}>
                        {contractor.name}
                      </Text>
                      <Text style={styles.workType}>{contractor.workType}</Text>
                    </View>
                    {isContractorPro ? (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteContractor(contractor)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <MaterialCommunityIcons
                          name="trash-can-outline"
                          size={18}
                          color={COLORS.danger}
                        />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.previewPill}>
                        <Text style={styles.previewPillText}>ÖRNEK</Text>
                      </View>
                    )}
                  </View>

                  <View style={[styles.statusPill, status.style]}>
                    <Text style={styles.statusText}>{status.label}</Text>
                  </View>

                  <View style={styles.moneyGrid}>
                    <View style={styles.moneyBox}>
                      <Text style={styles.moneyLabel}>Anlaşma</Text>
                      <Text style={styles.moneyValue}>
                        ₺{contractor.contractAmount.toLocaleString("tr-TR")}
                      </Text>
                    </View>
                    <View style={styles.moneyBox}>
                      <Text style={styles.moneyLabel}>Ödenen</Text>
                      <Text style={styles.moneyValue}>
                        ₺{contractor.paidAmount.toLocaleString("tr-TR")}
                      </Text>
                    </View>
                    <View style={styles.moneyBox}>
                      <Text style={styles.moneyLabel}>Kalan</Text>
                      <Text style={[styles.moneyValue, styles.remainingValue]}>
                        ₺{remaining.toLocaleString("tr-TR")}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressBlock}>
                    <View style={styles.progressHeader}>
                      <Text style={styles.progressLabel}>Ödeme oranı</Text>
                      <Text style={styles.progressValue}>
                        %{Math.round(paymentPercent)}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.paymentFill,
                          { width: `${paymentPercent}%` },
                        ]}
                      />
                    </View>
                  </View>

                  {!!contractor.note && (
                    <View style={styles.noteRow}>
                      <MaterialCommunityIcons
                        name="note-text-outline"
                        size={16}
                        color={COLORS.textSecondary}
                      />
                      <Text style={styles.noteText}>{contractor.note}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  proLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  proScreen: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 120,
    alignItems: "center",
  },

  proIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  proTitle: {
    fontSize: 25,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
  },

  proSubtitle: {
    marginTop: 10,
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },

  proBenefitsTitle: {
    alignSelf: "stretch",
    marginTop: 28,
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
  },

  proFeatures: {
    alignSelf: "stretch",
    marginTop: 14,
    marginBottom: 24,
    gap: 12,
  },

  proFeature: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 16,
    padding: 14,
  },

  proFeatureIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
  },

  proFeatureContent: {
    flex: 1,
    gap: 4,
  },

  proFeatureTitle: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "800",
  },

  proFeatureDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },

  proButton: {
    alignSelf: "stretch",
    minHeight: 54,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 15,
    backgroundColor: COLORS.primary,
  },

  proButtonDisabled: {
    backgroundColor: "#94A3B8",
  },

  proPrice: {
    marginBottom: 10,
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },

  proButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "800",
  },

  restoreButton: {
    paddingVertical: 16,
    alignItems: "center",
  },

  restoreButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "700",
  },

  proFootnote: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 110,
  },

  previewBanner: {
    marginTop: 12,
    marginBottom: 14,
    padding: 16,
    gap: 14,
    backgroundColor: "#EAF2FF",
    borderWidth: 1,
    borderColor: "#CFE0F7",
    borderRadius: 18,
  },

  previewBannerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  previewBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },

  previewBannerCopy: {
    flex: 1,
    gap: 4,
  },

  previewBannerTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },

  previewBannerText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },

  previewBannerAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  previewBannerPrice: {
    flex: 1,
    color: COLORS.primary,
    fontSize: 17,
    fontWeight: "800",
  },

  previewUpgradeButton: {
    minHeight: 42,
    paddingHorizontal: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },

  previewUpgradeButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "800",
  },

  previewPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#EAF2FF",
  },

  previewPillText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  summaryStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    marginBottom: 14,
  },

  summaryItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 6,
  },

  summaryLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginBottom: 4,
  },

  summaryValue: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },

  summaryDivider: {
    width: 1,
    height: 34,
    backgroundColor: COLORS.borderLight,
  },
  dateInput: {
    height: 45,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: COLORS.inputBg,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dateLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  dateText: {
    marginLeft: 10,
    fontSize: 15,
    color: COLORS.text,
    fontWeight: "600",
  },

  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 18,
    marginBottom: 18,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },

  formTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  formIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  formTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
  },
  costNotice: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },

  row: {
    flexDirection: "row",
    gap: 10,
  },

  half: {
    flex: 1,
  },

  fieldGroup: {
    marginBottom: 14,
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginBottom: 6,
    textTransform: "uppercase",
  },

  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.inputBg,
  },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },

  addBtnDisabled: {
    backgroundColor: COLORS.placeholder,
  },

  addBtnIcon: {
    marginRight: 6,
  },

  addBtnText: {
    color: COLORS.white,
    fontWeight: "800",
    fontSize: 15,
  },

  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 4,
  },

  listHeaderTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
  },

  listHeaderCount: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textMuted,
  },

  center: {
    alignItems: "center",
    paddingVertical: 30,
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 20,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 10,
  },

  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 19,
  },

  contractorCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 16,
    marginBottom: 12,
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  cardTitleWrap: {
    flex: 1,
    paddingRight: 10,
  },

  contractorName: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 3,
  },

  workType: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },

  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: COLORS.dangerBg,
    alignItems: "center",
    justifyContent: "center",
  },

  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 12,
    marginBottom: 12,
  },

  statusActive: {
    backgroundColor: "#EFF6FF",
  },

  statusWarning: {
    backgroundColor: "#FFF7ED",
  },

  statusPaid: {
    backgroundColor: "#ECFDF5",
  },

  statusText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.textSecondary,
  },

  moneyGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },

  moneyBox: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },

  moneyLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginBottom: 4,
  },

  moneyValue: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },

  remainingValue: {
    color: COLORS.danger,
  },

  progressBlock: {
    marginTop: 10,
  },

  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  progressLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },

  progressValue: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.text,
  },

  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.borderLight,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },

  paymentFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#10B981",
  },

  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 12,
  },

  noteText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});
