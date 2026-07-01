import Header from "@/components/Header";
import PdfHistoryModal from "@/components/PdfHistoryModal";
import { COLORS } from "@/constants/theme";
import { auth, db } from "@/firebaseConfig";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { copyAsync, documentDirectory } from "expo-file-system/legacy";
import * as Print from "expo-print";
import { useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

interface CategoryData {
  id: string;
  total: number;
  entries: any[];
}

export default function ProjectSummaryScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const user = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState("");
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [pdfPreviewVisible, setPdfPreviewVisible] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  // ─── Veri yükleme ────────────────────────────────────────────────────────────

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      if (!user || !projectId) return;

      const projectRef = doc(db, "users", user.uid, "projects", projectId);
      const projectSnap = await getDoc(projectRef);
      if (projectSnap.exists()) {
        setProjectName(projectSnap.data()?.name ?? "Proje");
      }

      const categoriesSnap = await getDocs(
        collection(db, "users", user.uid, "projects", projectId, "categories"),
      );

      const parsed: CategoryData[] = categoriesSnap.docs.map((d) => ({
        id: d.id,
        total: d.data()?.total ?? 0,
        entries: d.data()?.entries ?? [],
      }));

      setCategories(parsed);
    } catch (error) {
      console.error("loadData error:", error);
    } finally {
      setLoading(false);
    }
  };

  // ─── Memoized hesaplamalar ────────────────────────────────────────────────────

  const totalCost = useMemo(
    () => categories.reduce((sum, c) => sum + c.total, 0),
    [categories],
  );

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => b.total - a.total),
    [categories],
  );

  const topEntries = useMemo(
    () =>
      categories
        .flatMap((c) =>
          c.entries.map((entry) => ({
            ...entry,
            category: c.id,
            impactScore: entry.total * (entry.quantity || 1),
          })),
        )
        .sort((a, b) => b.impactScore - a.impactScore)
        .slice(0, 3),
    [categories],
  );

  const allEntries = useMemo(
    () =>
      categories.flatMap((c) =>
        c.entries.map((entry) => ({ ...entry, category: c.id })),
      ),
    [categories],
  );

  // ─── HTML şablonu ─────────────────────────────────────────────────────────────

  const generateHtml = () => `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 32px; background: #F8FAFC; color: #1F2937; }
    .hero { background: #2563EB; color: white; padding: 28px; border-radius: 20px; margin-bottom: 24px; }
    .hero h1 { font-size: 28px; }
    .hero p { margin-top: 6px; opacity: .85; font-size: 14px; }
    .hero .total { font-size: 38px; font-weight: 900; margin-top: 18px; }
    .date { color: #6B7280; font-size: 12px; margin-bottom: 14px; }
    h2 { font-size: 18px; font-weight: 700; margin: 24px 0 12px; color: #111827; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #E5E7EB; padding: 10px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #E5E7EB; }
    .blue { color: #2563EB; font-weight: 700; }
    .bold { font-weight: 700; }
  </style>
</head>
<body>
  <p class="date">Oluşturulma Tarihi: ${new Date().toLocaleDateString("tr-TR")}</p>

  <div class="hero">
    <h1>${projectName}</h1>
    <p>Proje Maliyet Özeti</p>
    <div class="total">₺${totalCost.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</div>
  </div>

  <h2>Kategori Dağılımı</h2>
  <table>
    <tr><th>Kategori</th><th>Oran</th><th>Tutar</th></tr>
    ${sortedCategories
      .map((cat) => {
        const pct = totalCost
          ? ((cat.total / totalCost) * 100).toFixed(1)
          : "0";
        return `
        <tr>
          <td>${cat.id}</td>
          <td>%${pct}</td>
          <td class="bold">₺${cat.total.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
        </tr>`;
      })
      .join("")}
  </table>

  <h2>Tüm Kalemler</h2>
  <table>
    <tr><th>Kalem</th><th>Kategori</th><th>Miktar</th><th>Etki</th><th>Tutar</th></tr>
    ${allEntries
      .map(
        (item) => `
      <tr>
        <td>${item.label}</td>
        <td>${item.category}</td>
        <td>${item.quantity} ${item.unit}</td>
        <td class="blue">%${totalCost ? ((item.total / totalCost) * 100).toFixed(1) : "0"}</td>
        <td class="bold">₺${item.total.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
      </tr>`,
      )
      .join("")}
  </table>
</body>
</html>`;

  // ─── PDF oluştur → önizleme aç ───────────────────────────────────────────────

  const handleGenerateAndPreview = async () => {
    if (categories.length === 0) {
      Alert.alert("Veri Yok", "PDF oluşturmak için önce kalem ekleyin.");
      return;
    }

    try {
      setPdfGenerating(true);
      const html = generateHtml();

      // expo-print ile geçici PDF oluştur
      const { uri: tempUri } = await Print.printToFileAsync({ html });

      // Kalıcı konuma kopyala (Documents klasörü — indirilebilir)
      const fileName = `${projectName.replace(/\s+/g, "_")}_${Date.now()}.pdf`;
      const permanentUri = documentDirectory + fileName;
      await copyAsync({ from: tempUri, to: permanentUri });

      // Firestore'a kaydet
      await addDoc(
        collection(db, "users", user!.uid, "projects", projectId, "pdfHistory"),
        {
          createdAt: serverTimestamp(),
          totalCost,
          projectName,
          fileName,
        },
      );

      setPdfUri(permanentUri);
      setPdfPreviewVisible(true);
    } catch (error) {
      console.error("PDF hatası:", error);
      Alert.alert("Hata", "PDF oluşturulurken bir sorun çıktı.");
    } finally {
      setPdfGenerating(false);
    }
  };

  // ─── Paylaş / İndir ──────────────────────────────────────────────────────────

  const handleShare = async () => {
    if (!pdfUri) return;
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert(
        "Paylaşım desteklenmiyor",
        "Bu cihazda paylaşım özelliği kullanılamıyor.",
      );
      return;
    }
    await Sharing.shareAsync(pdfUri, {
      mimeType: "application/pdf",
      dialogTitle: "PDF'i paylaş veya kaydet",
    });
  };

  // ─── Yükleniyor ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* Geçmiş PDF'ler */}
      <PdfHistoryModal
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
        projectId={projectId}
        generateHtml={generateHtml}
      />

      {/* ─── Uygulama içi PDF önizleme modal'ı ─── */}
      <Modal
        visible={pdfPreviewVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setPdfPreviewVisible(false)}
      >
        <View style={styles.previewRoot}>
          {/* Status bar için spacing */}
          <View style={styles.statusBarSpacer} />

          {/* Üst bar - SafeArea içinde değil, manuel padding */}
          <View style={styles.previewHeader}>
            <TouchableOpacity
              onPress={() => setPdfPreviewVisible(false)}
              style={styles.previewHeaderBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={COLORS.primary}
              />
            </TouchableOpacity>

            <Text style={styles.previewTitle}>PDF Önizleme</Text>

            <TouchableOpacity
              onPress={handleShare}
              style={styles.previewHeaderBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons
                name="share-variant"
                size={24}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>

          {/* PDF görüntüleyici */}
          {pdfUri ? (
            <WebView
              source={{ uri: pdfUri }}
              style={{ flex: 1 }}
              originWhitelist={["*"]}
            />
          ) : (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          )}

          {/* Alt buton */}
          <View style={styles.previewFooter}>
            <TouchableOpacity style={styles.downloadBtn} onPress={handleShare}>
              <MaterialCommunityIcons name="download" size={20} color="#fff" />
              <Text style={styles.downloadBtnText}>İndir / Paylaş</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Ana header ─── */}
      <Header
        title="Maliyet Özeti"
        backIcon
        rightIcon="file-pdf-box"
        onRightIconPress={() => setHistoryVisible(true)}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* PDF Oluştur butonu */}
        <TouchableOpacity
          onPress={handleGenerateAndPreview}
          style={[styles.exportBtn, pdfGenerating && { opacity: 0.7 }]}
          disabled={pdfGenerating}
        >
          {pdfGenerating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialCommunityIcons
              name="file-pdf-box"
              size={20}
              color="#fff"
            />
          )}
          <Text style={styles.exportBtnText}>
            {pdfGenerating ? "Oluşturuluyor..." : "PDF Oluştur & Önizle"}
          </Text>
        </TouchableOpacity>

        {/* ─── KATEGORİ DAĞILIMI ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kategori Dağılımı</Text>
          {sortedCategories.map((item) => {
            const percent = totalCost
              ? ((item.total / totalCost) * 100).toFixed(1)
              : "0";

            return (
              <View key={item.id} style={styles.categoryCard}>
                <View style={styles.categoryTop}>
                  <View>
                    <Text style={styles.categoryName}>{item.id}</Text>
                    <Text style={styles.categoryPercent}>%{percent}</Text>
                  </View>

                  <Text style={styles.categoryPrice}>
                    ₺
                    {item.total.toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                    })}
                  </Text>
                </View>

                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${percent}%` as any },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── EN PAHALI KALEMLER ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bütçeyi En Çok Etkileyenler</Text>
          {topEntries.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Henüz veri yok</Text>
            </View>
          ) : (
            topEntries.map((item, index) => (
              <View key={item.id} style={styles.entryCard}>
                <View style={styles.entryLeft}>
                  <View style={styles.entryIndex}>
                    <Text style={styles.entryIndexText}>{index + 1}</Text>
                  </View>

                  <View>
                    <Text style={styles.entryLabel}>{item.label}</Text>
                    <Text style={styles.entrySub}>
                      {item.quantity} {item.unit}
                    </Text>
                  </View>
                </View>

                <Text style={styles.entryPrice}>
                  ₺
                  {item.total.toLocaleString("tr-TR", {
                    minimumFractionDigits: 2,
                  })}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* ─── TOPLAM MALİYET ─── */}
        <View style={styles.predictionCard}>
          <MaterialCommunityIcons
            name="trending-up"
            size={26}
            color={COLORS.primary}
          />

          <View style={{ flex: 1 }}>
            <Text style={styles.predictionTitle}>Toplam Maliyet</Text>
            <Text style={styles.predictionSubtitle}>
              Mevcut verilere göre toplam maliyet
            </Text>
          </View>

          <Text style={styles.predictionValue}>
            ₺{totalCost.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FB" },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F7FB",
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },

  // PDF Preview Modal - YENİ
  previewRoot: {
    flex: 1,
    backgroundColor: "#fff",
  },
  statusBarSpacer: {
    height: 44, // Status bar yüksekliği (iPhone için 44, Android için 24-32)
    backgroundColor: "#fff",
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  previewHeaderBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },
  previewFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#fff",
    paddingBottom: 24,
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
  },
  downloadBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Dışa aktar
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    marginBottom: 24,
    padding: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
  },
  exportBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },

  // Bölümler
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 14,
  },

  // Kategori kartı
  categoryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  categoryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  categoryName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    textTransform: "capitalize",
  },

  categoryPercent: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 3,
  },

  categoryPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.primary,
  },

  progressBg: {
    height: 8,
    backgroundColor: "#EEF2FA",
    borderRadius: 4,
    overflow: "hidden",
  },

  progressFill: {
    height: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },

  // Kalem kartı
  entryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },

  entryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },

  entryIndex: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  entryIndexText: {
    color: COLORS.primary,
    fontWeight: "800",
    fontSize: 14,
  },

  entryLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },

  entrySub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  entryPrice: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },

  // Tahmin kartı
  predictionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  predictionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },

  predictionSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 3,
  },

  predictionValue: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.primary,
  },

  // Boş durum
  emptyBox: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },

  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
});
