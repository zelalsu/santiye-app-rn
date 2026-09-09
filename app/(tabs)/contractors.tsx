import Header from "@/components/Header";
import { COLORS } from "@/constants/theme";
import { auth, db } from "@/firebaseConfig";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
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

export default function ContractorsScreen() {
  const params = useLocalSearchParams<{ projectId?: string }>();
  const user = auth.currentUser;
  const userId = user?.uid;

  const [projectId, setProjectId] = useState(params.projectId ?? "");
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
    const contractorsRef = collection(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "contractors",
    );
    const q = query(contractorsRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Contractor[];

      setContractors(data);
      setLoading(false);
    });

    return unsub;
  }, [projectId, userId]);

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

  const resetForm = () => {
    setName("");
    setWorkType("");
    setContractAmount("");
    setPaidAmount("");
    setProgress("");
    setNote("");
  };

  const handleAddContractor = async () => {
    if (!user || !projectId || !name.trim() || !workType.trim()) return;

    const parsedProgress = Math.min(
      Math.max(parseInt(progress, 10) || 0, 0),
      100,
    );

    setSaving(true);
    await addDoc(
      collection(db, "users", user.uid, "projects", projectId, "contractors"),
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
    setSaving(false);
    resetForm();
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
              user.uid,
              "projects",
              projectId,
              "contractors",
              contractor.id,
            ),
          );
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

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Taşeron Takibi" leftMenuIcon />

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
              <Text style={styles.summaryLabel}>Taşeron</Text>
              <Text style={styles.summaryValue}>{totals.count}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Ödenen</Text>
              <Text style={styles.summaryValue}>
                ₺{totals.paid.toLocaleString("tr-TR")}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Kalan</Text>
              <Text style={styles.summaryValue}>
                ₺{totals.remaining.toLocaleString("tr-TR")}
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

            <View style={styles.row}>
              <View style={[styles.fieldGroup, styles.half]}>
                <Text style={styles.fieldLabel}>Ad / Firma</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Mehmet Usta"
                  placeholderTextColor={COLORS.placeholder}
                  value={name}
                  onChangeText={setName}
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
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.addBtn, !isFormValid && styles.addBtnDisabled]}
              onPress={handleAddContractor}
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
                  <Text style={styles.addBtnText}>Taşeronu Kaydet</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.listHeaderTitle}>Taşeronlar</Text>
            <Text style={styles.listHeaderCount}>
              {contractors.length} kayıt
            </Text>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : contractors.length === 0 ? (
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
            contractors.map((contractor) => {
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
