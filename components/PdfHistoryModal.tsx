import { COLORS } from "@/constants/theme";
import { auth, db } from "@/firebaseConfig";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface PdfRecord {
  id: string;
  createdAt: any;
  totalCost: number;
  projectName: string;
}

export default function PdfHistoryModal({
  visible,
  onClose,
  projectId,
  generateHtml, // pdf html'ini dışarıdan al
}: {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  generateHtml: () => string;
}) {
  const user = auth.currentUser;
  const [records, setRecords] = useState<PdfRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharingId, setSharingId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) loadHistory();
  }, [visible]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "users", user!.uid, "projects", projectId, "pdfHistory"),
        orderBy("createdAt", "desc"),
      );
      const snap = await getDocs(q);
      setRecords(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PdfRecord),
      );
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (record: PdfRecord) => {
    try {
      setSharingId(record.id);
      const html = generateHtml();
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (e) {
      console.log(e);
    } finally {
      setSharingId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>
          <Text style={styles.title}>PDF Geçmişi</Text>
          <View style={{ width: 42 }} />
        </View>

        {loading ? (
          <ActivityIndicator
            style={{ marginTop: 40 }}
            size="large"
            color={COLORS.primary}
          />
        ) : records.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="file-pdf-box"
              size={52}
              color={COLORS.border}
            />
            <Text style={styles.emptyText}>Henüz PDF oluşturulmamış</Text>
          </View>
        ) : (
          <FlatList
            data={records}
            keyExtractor={(r) => r.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardIcon}>
                  <MaterialCommunityIcons
                    name="file-pdf-box"
                    size={28}
                    color={COLORS.primary}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.projectName}</Text>
                  <Text style={styles.cardSub}>
                    {item.createdAt?.toDate
                      ? item.createdAt.toDate().toLocaleDateString("tr-TR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </Text>
                  <Text style={styles.cardCost}>
                    ₺
                    {item.totalCost.toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                    })}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleShare(item)}
                  style={styles.shareBtn}
                  disabled={sharingId === item.id}
                >
                  {sharingId === item.id ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <MaterialCommunityIcons
                      name="share-outline"
                      size={20}
                      color={COLORS.primary}
                    />
                  )}
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FB" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: 55,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  closeBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#1A1A1A" },
  list: { padding: 20, gap: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  cardSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  cardCost: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.primary,
    marginTop: 4,
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { color: "#64748b", fontSize: 15 },
});
