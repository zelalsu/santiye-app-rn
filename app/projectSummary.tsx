import Header from "@/components/Header";
import PdfHistoryModal from "@/components/PdfHistoryModal";
import { COLORS } from "@/constants/theme";
import { auth, db } from "@/firebaseConfig";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
  // addDoc ve serverTimestamp import et

  // generateHtml — gerçek HTML dönsün
  const generateHtml = () => `
  <html>
    <body style="font-family: Arial; padding: 24px; background: #F8FAFC;">
      <div style="background: #2563EB; color: white; padding: 28px; border-radius: 20px; margin-bottom: 24px;">
        <h1 style="margin:0; font-size: 30px;">${projectName}</h1>
        <p style="margin-top: 8px; opacity: .9;">Proje Maliyet Özeti</p>
        <h2 style="margin-top: 24px; font-size: 40px;">
          ₺${totalCost.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
        </h2>
      </div>

      <h2>Kategori Dağılımı</h2>
      <table width="100%" cellspacing="0" cellpadding="10" style="border-collapse: collapse; margin-top: 12px;">
        <tr style="background:#E5E7EB; text-align:left;">
          <th>Kategori</th><th>Oran</th><th>Tutar</th>
        </tr>
        ${sortedCategories
          .map((cat) => {
            const percent = totalCost
              ? ((cat.total / totalCost) * 100).toFixed(1)
              : "0";
            return `
            <tr>
              <td style="border-bottom:1px solid #E5E7EB;">${cat.id}</td>
              <td style="border-bottom:1px solid #E5E7EB;">%${percent}</td>
              <td style="border-bottom:1px solid #E5E7EB; font-weight:bold;">
                ₺${cat.total.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
              </td>
            </tr>
          `;
          })
          .join("")}
      </table>

      <h2 style="margin-top:32px;">En Yüksek Kalemler</h2>
      <table width="100%" cellspacing="0" cellpadding="10" style="border-collapse: collapse; margin-top: 12px;">
        <tr style="background:#E5E7EB; text-align:left;">
          <th>Kalem</th><th>Kategori</th><th>Miktar</th><th>Etki</th><th>Tutar</th>
        </tr>
        ${topEntries
          .map(
            (item) => `
          <tr>
            <td style="border-bottom:1px solid #E5E7EB;">${item.label}</td>
            <td style="border-bottom:1px solid #E5E7EB;">${item.category}</td>
            <td style="border-bottom:1px solid #E5E7EB;">${item.quantity} ${item.unit}</td>
            <td style="border-bottom:1px solid #E5E7EB; color:#2563EB; font-weight:bold;">
              %${((item.total / totalCost) * 100).toFixed(1)}
            </td>
            <td style="border-bottom:1px solid #E5E7EB; font-weight:bold;">
              ₺${item.total.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
            </td>
          </tr>
        `,
          )
          .join("")}
      </table>

      <div style="margin-top:40px; color:#6B7280; font-size:12px;">
        Oluşturulma Tarihi: ${new Date().toLocaleDateString("tr-TR")}
      </div>
    </body>
  </html>
`;
  console.log(categories);
  // handleExportPdf — addDoc ekle
  const handleExportPdf = async () => {
    if (categories.length === 0) {
      Alert.alert("Veri Yok", "PDF oluşturmak için önce kalem ekleyin.");
      return;
    }
    try {
      const html = generateHtml();
      const { uri } = await Print.printToFileAsync({ html });

      // Firestore'a kaydet
      await addDoc(
        collection(db, "users", user!.uid, "projects", projectId, "pdfHistory"),
        {
          createdAt: serverTimestamp(),
          totalCost,
          projectName,
        },
      );

      await Sharing.shareAsync(uri);
    } catch (error) {
      console.log(error);
    }
  };
  useEffect(() => {
    loadData();
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
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const totalCost = useMemo(() => {
    return categories.reduce((sum, c) => sum + c.total, 0);
  }, [categories]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => b.total - a.total);
  }, [categories]);

  const topEntries = useMemo(() => {
    return categories
      .flatMap((c) =>
        c.entries.map((entry) => {
          const impactScore = entry.total * (entry.quantity || 1);

          return {
            ...entry,
            category: c.id,
            impactScore,
          };
        }),
      )
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, 3);
  }, [categories]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <PdfHistoryModal
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
        projectId={projectId}
        generateHtml={generateHtml}
      />
      <Header
        title="Maliyet Özeti"
        backIcon="arrow-left"
        rightIcon="file-pdf-box"
        onRightIconPress={() => setHistoryVisible(true)}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableOpacity onPress={handleExportPdf} style={styles.exportBtn}>
          <MaterialCommunityIcons name="file-pdf-box" size={20} color="#fff" />
          <Text style={styles.exportBtnText}>PDF Oluştur</Text>
        </TouchableOpacity>
        {/* KATEGORI DAGILIMI */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kategori Dağılımı</Text>

          {sortedCategories.map((item, index) => {
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
                      {
                        width: `${percent}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* EN PAHALI KALEMLER */}
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

        {/* TAHMIN */}
        <View style={styles.predictionCard}>
          <MaterialCommunityIcons
            name="trending-up"
            size={26}
            color={COLORS.primary}
          />

          <View style={{ flex: 1 }}>
            <Text style={styles.predictionTitle}>Maliyet</Text>

            <Text style={styles.predictionSubtitle}>
              Mevcut verilere göre toplam maliyetin değeri
            </Text>
          </View>

          <Text style={styles.predictionValue}>
            ₺
            {/* {(totalCost * 1.15).toLocaleString("tr-TR", {
              minimumFractionDigits: 0,
            })} */}
            {totalCost.toLocaleString("tr-TR", {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F7FB",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    margin: 20,
    padding: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 18,
  },
  exportBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
  },

  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },

  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 30,
    padding: 24,
    marginBottom: 22,
  },

  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  heroProject: {
    fontSize: 16,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 4,
  },

  heroLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
  },

  heroIconBox: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  heroValue: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.white,
  },

  heroStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },

  heroStatBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  heroStatText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 13,
  },

  section: {
    marginBottom: 24,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 14,
  },

  categoryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
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
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.primary,
  },

  progressBg: {
    height: 10,
    backgroundColor: "#EEF2FA",
    borderRadius: 999,
    overflow: "hidden",
  },

  progressFill: {
    height: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
  },

  entryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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

  predictionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
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

  emptyBox: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
  },

  emptyText: {
    color: COLORS.textMuted,
  },
});
