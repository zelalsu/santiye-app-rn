// app/(tabs)/documents/index.tsx
import Header from "@/components/Header";
import { RenderIcon } from "@/components/RenderIcon";
import { COLORS } from "@/constants/theme";
import { auth, db } from "@/firebaseConfig";
import { PhaseInfo, PHASES_DATA } from "@/types/phases";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { collection, getDocs } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── SCREEN ───────────────────────────────────────────

export default function DocumentsScreen() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // State tipini güncelle
  const [phases, setPhases] = useState<
    (PhaseInfo & { completedCount: number })[]
  >(PHASES_DATA.map((p) => ({ ...p, docCount: 0, completedCount: 0 })));

  const user = auth.currentUser;

  useEffect(() => {
    const load = async () => {
      try {
        const id = await AsyncStorage.getItem("activeProjectId");
        setProjectId(id);
        if (!id) setLoading(false);
      } catch {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (projectId && user) loadCounts();
  }, [projectId]);

  const loadCounts = async () => {
    try {
      const counts = await Promise.all(
        PHASES_DATA.map(async (phase) => {
          const snap = await getDocs(
            collection(
              db,
              "users",
              user!.uid,
              "projects",
              projectId!,
              "phases",
              phase.id,
              "documents",
            ),
          );

          // Yüklenen belgelerin requiredDocumentId alanlarını topla
          const uploadedReqIds = new Set(
            snap.docs.map((d) => d.data().requiredDocumentId).filter(Boolean),
          );

          return {
            id: phase.id,
            count: snap.size,
            completedCount: uploadedReqIds.size,
          };
        }),
      );

      setPhases((prev) =>
        prev.map((p) => ({
          ...p,
          docCount: counts.find((c) => c.id === p.id)?.count ?? 0,
          completedCount:
            counts.find((c) => c.id === p.id)?.completedCount ?? 0,
        })),
      );
    } catch (e) {
      console.error("Count load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const totalDocs = phases.reduce((s, p) => s + p.docCount, 0);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header title="Proje belgeleri" />

      {!projectId ? (
        <View style={styles.emptyFull}>
          <Ionicons name="folder-open-outline" size={64} color="#94A3B8" />
          <Text style={styles.emptyFullTitle}>Proje Seçilmedi</Text>
          <Text style={styles.emptyFullSub}>
            Belgeleri görmek için önce aktif bir proje seçin.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {phases.map((phase, i) => (
            <TouchableOpacity
              key={phase.id}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: "/[doc]",
                  params: {
                    doc: phase.id, // ← bunu ekle
                    id: phase.id,
                    phaseId: phase.id,
                    phaseTitle: phase.title,
                    projectId: projectId,
                  },
                })
              }
            >
              <View style={[styles.iconWrap]}>
                <RenderIcon
                  iconPack={phase.iconPack}
                  iconName={phase.iconName}
                  color={COLORS.primary}
                />
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardIndex}>AŞAMA {i + 1}</Text>
                <Text style={styles.cardTitle}>{phase.title}</Text>
              </View>

              <View style={styles.cardRight}>
                <View style={styles.cardRight}>
                  {phase.requiredDocuments.length > 0 && (
                    <View
                      style={[
                        styles.countPill,
                        phase.completedCount ===
                          phase.requiredDocuments.length &&
                          styles.countPillComplete,
                      ]}
                    >
                      <Text
                        style={[
                          styles.countText,
                          phase.completedCount ===
                            phase.requiredDocuments.length &&
                            styles.countTextComplete,
                        ]}
                      >
                        {phase.completedCount}/{phase.requiredDocuments.length}
                      </Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                </View>
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  header: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 20 },
  headerSub: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#0F172A" },
  headerMeta: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 4,
    fontWeight: "500",
  },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#94A3B8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.primaryLight,
  },
  cardBody: { flex: 1 },
  cardIndex: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  cardRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  countPill: {
    backgroundColor: COLORS.primaryLight ?? "#EFF6FF",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countText: { fontSize: 12, fontWeight: "700", color: COLORS.primary },
  emptyFull: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyFullTitle: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
  emptyFullSub: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 20,
  },
  countPillComplete: {
    backgroundColor: "#DCFCE7",
  },
  countTextComplete: {
    color: "#16A34A",
  },
});
