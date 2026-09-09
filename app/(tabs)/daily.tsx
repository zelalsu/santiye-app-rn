import Header from "@/components/Header";
import { COLORS } from "@/constants/theme";
import { auth, db } from "@/firebaseConfig";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";
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
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface DailyLog {
  id: string;
  date: string;
  workerCount: number;
  workDone: string;
  materials?: string;
  issues?: string;
  dailyExpense?: number;
  createdAt?: unknown;
}

const getToday = () => new Date().toISOString().slice(0, 10);

export default function DailyScreen() {
  const params = useLocalSearchParams<{ projectId?: string }>();
  const user = auth.currentUser;
  const userId = user?.uid;

  const [projectId, setProjectId] = useState(params.projectId ?? "");
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(getToday());
  const [workerCount, setWorkerCount] = useState("");
  const [workDone, setWorkDone] = useState("");
  const [materials, setMaterials] = useState("");
  const [issues, setIssues] = useState("");
  const [dailyExpense, setDailyExpense] = useState("");

  useEffect(() => {
    if (params.projectId) {
      setProjectId(params.projectId);
      return;
    }

    AsyncStorage.getItem("activeProjectId").then((storedProjectId) => {
      if (storedProjectId) setProjectId(storedProjectId);
    });
  }, [params.projectId]);

  useEffect(() => {
    if (!userId || !projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const dailyLogsRef = collection(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "dailyLogs",
    );
    const q = query(dailyLogsRef, orderBy("date", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as DailyLog[];

      setLogs(data);
      setLoading(false);
    });

    return unsub;
  }, [projectId, userId]);

  const totals = useMemo(
    () => ({
      days: logs.length,
      workers: logs.reduce((sum, log) => sum + (log.workerCount || 0), 0),
      expense: logs.reduce((sum, log) => sum + (log.dailyExpense || 0), 0),
    }),
    [logs],
  );

  const resetForm = () => {
    setDate(getToday());
    setWorkerCount("");
    setWorkDone("");
    setMaterials("");
    setIssues("");
    setDailyExpense("");
  };

  const handleAddLog = async () => {
    if (!user || !projectId || !date.trim() || !workDone.trim()) return;

    const parsedWorkerCount = parseInt(workerCount, 10) || 0;
    const parsedDailyExpense =
      parseFloat(dailyExpense.replace(",", ".")) || 0;

    setSaving(true);
    await addDoc(
      collection(db, "users", user.uid, "projects", projectId, "dailyLogs"),
      {
        date: date.trim(),
        workerCount: parsedWorkerCount,
        workDone: workDone.trim(),
        materials: materials.trim(),
        issues: issues.trim(),
        dailyExpense: parsedDailyExpense,
        createdAt: serverTimestamp(),
      },
    );
    setSaving(false);
    resetForm();
  };

  const handleDeleteLog = (log: DailyLog) => {
    if (!user || !projectId) return;

    Alert.alert("Günlük Kaydı Sil", `${log.date} tarihli kayıt silinsin mi?`, [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(
            doc(
              db,
              "users",
              user.uid,
              "projects",
              projectId,
              "dailyLogs",
              log.id,
            ),
          );
        },
      },
    ]);
  };

  const isFormValid = !!(date.trim() && workDone.trim() && projectId);

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Günlük Kayıtlar" leftMenuIcon />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.summaryStrip}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Kayıt</Text>
              <Text style={styles.summaryValue}>{totals.days}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Personel/Gün</Text>
              <Text style={styles.summaryValue}>{totals.workers}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Ek Harcama</Text>
              <Text style={styles.summaryValue}>
                ₺{totals.expense.toLocaleString("tr-TR")}
              </Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <View style={styles.formTitleRow}>
              <View style={styles.formIcon}>
                <MaterialCommunityIcons
                  name="clipboard-text-outline"
                  size={20}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.formTitle}>Yeni Günlük Kayıt</Text>
            </View>

            <View style={styles.row}>
              <View style={[styles.fieldGroup, styles.half]}>
                <Text style={styles.fieldLabel}>Tarih</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-AA-GG"
                  placeholderTextColor={COLORS.placeholder}
                  value={date}
                  onChangeText={setDate}
                />
              </View>
              <View style={[styles.fieldGroup, styles.half]}>
                <Text style={styles.fieldLabel}>Çalışan Sayısı</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="number-pad"
                  value={workerCount}
                  onChangeText={(text) =>
                    setWorkerCount(text.replace(/[^0-9]/g, ""))
                  }
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Yapılan İşler</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Bugün sahada yapılan işleri yazın"
                placeholderTextColor={COLORS.placeholder}
                value={workDone}
                onChangeText={setWorkDone}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Malzeme</Text>
              <TextInput
                style={[styles.input, styles.textAreaSmall]}
                placeholder="Gelen, kullanılan veya eksilen malzemeler"
                placeholderTextColor={COLORS.placeholder}
                value={materials}
                onChangeText={setMaterials}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.fieldGroup, styles.half]}>
                <Text style={styles.fieldLabel}>Ek Harcama</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0,00"
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="decimal-pad"
                  value={dailyExpense}
                  onChangeText={(text) =>
                    setDailyExpense(text.replace(/[^0-9.,]/g, ""))
                  }
                />
              </View>
              <View style={[styles.fieldGroup, styles.half]}>
                <Text style={styles.fieldLabel}>Sorun / Not</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Varsa kısa not"
                  placeholderTextColor={COLORS.placeholder}
                  value={issues}
                  onChangeText={setIssues}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.addBtn, !isFormValid && styles.addBtnDisabled]}
              onPress={handleAddLog}
              activeOpacity={0.85}
              disabled={!isFormValid || saving}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="plus"
                    size={18}
                    color={COLORS.white}
                    style={styles.addBtnIcon}
                  />
                  <Text style={styles.addBtnText}>Günlüğü Kaydet</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.listHeaderTitle}>Kayıtlar</Text>
            <Text style={styles.listHeaderCount}>{logs.length} gün</Text>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : logs.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="calendar-blank-outline"
                size={42}
                color="#CBD5E1"
              />
              <Text style={styles.emptyTitle}>Henüz günlük kayıt yok</Text>
              <Text style={styles.emptySubtitle}>
                İlk kaydı ekleyerek şantiye geçmişini oluşturmaya başlayın
              </Text>
            </View>
          ) : (
            logs.map((log) => (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logTop}>
                  <View>
                    <Text style={styles.logDate}>{log.date}</Text>
                    <Text style={styles.logMeta}>
                      {log.workerCount || 0} çalışan
                      {log.dailyExpense
                        ? ` • ₺${log.dailyExpense.toLocaleString("tr-TR")}`
                        : ""}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteLog(log)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons
                      name="trash-can-outline"
                      size={18}
                      color={COLORS.danger}
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.logText}>{log.workDone}</Text>

                {!!log.materials && (
                  <View style={styles.logDetailRow}>
                    <MaterialCommunityIcons
                      name="package-variant-closed"
                      size={16}
                      color={COLORS.textSecondary}
                    />
                    <Text style={styles.logDetailText}>{log.materials}</Text>
                  </View>
                )}

                {!!log.issues && (
                  <View style={styles.logDetailRow}>
                    <MaterialCommunityIcons
                      name="alert-circle-outline"
                      size={16}
                      color={COLORS.textSecondary}
                    />
                    <Text style={styles.logDetailText}>{log.issues}</Text>
                  </View>
                )}
              </View>
            ))
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

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 110,
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

  textArea: {
    minHeight: 92,
  },

  textAreaSmall: {
    minHeight: 72,
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

  logCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 16,
    marginBottom: 12,
  },

  logTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  logDate: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 2,
  },

  logMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },

  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: COLORS.dangerBg,
    alignItems: "center",
    justifyContent: "center",
  },

  logText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: 10,
  },

  logDetailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
  },

  logDetailText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});
