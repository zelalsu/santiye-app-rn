import Header from "@/components/Header";
import { CATEGORY_CONFIG } from "@/config/categoryConfig";
import { uploadDocument } from "@/config/documentUpload";
import { recalculateProjectTotal } from "@/config/projectCosts";
import {
  ROLE_LABELS,
  canCreateDaily,
  canExportDaily,
  canManageDocuments,
  canSeeCosts,
  loadActiveProject,
} from "@/config/projectAccess";
import { COLORS } from "@/constants/theme";
import { COST_ITEMS } from "@/data/CostItems";
import { auth, db } from "@/firebaseConfig";
import { ProjectRole } from "@/types/projects";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import { useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as XLSX from "xlsx";

interface DailyLog {
  id: string;
  date: string;
  workerCount: number;
  workDone: string;
  workArea?: string;
  workType?: string;
  quantity?: number;
  unit?: string;
  materials?: string;
  issues?: string;
  authorId?: string;
  authorName?: string;
  authorRole?: ProjectRole;
  dailyExpense?: number;
  measurementCategoryId?: string;
  measurementCategoryTitle?: string;
  measurementItemLabel?: string;
  approvalStatus?: "pending" | "approved" | "rejected" | "not_required";
  approvedBy?: string;
  source?: "dailyLogs" | "siteLogs";
}

const WORK_TYPES = [
  "Beton",
  "Demir",
  "Kalıp",
  "Duvar",
  "Sıva",
  "Elektrik",
  "Tesisat",
  "Diğer",
];
const MEASUREMENT_CATEGORIES = COST_ITEMS.filter(
  (item) => item.id !== "yevmiye",
);
const UNITS = ["m³", "m²", "m", "mt", "kg", "ton", "adet", "set"];
const toDateKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const fromDateKey = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const formatDate = (value: string) =>
  fromDateKey(value).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function DailyScreen() {
  const params = useLocalSearchParams<{
    projectId?: string;
    ownerId?: string;
    role?: ProjectRole;
  }>();
  const user = auth.currentUser;
  const [projectId, setProjectId] = useState(params.projectId ?? "");
  const [projectOwnerId, setProjectOwnerId] = useState(params.ownerId ?? "");
  // Rol AsyncStorage'dan geldiği için ilk çizimde "owner" varsayımı yapma.
  // Aksi halde şef/ofis hesabı kısa süreliğine maliyet koleksiyonlarını okumaya
  // çalışıp Firestore permission-denied hatası üretebiliyordu.
  const [role, setRole] = useState<ProjectRole | undefined>(params.role);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [costs, setCosts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [activeSection, setActiveSection] = useState<"flow" | "reports">(
    "flow",
  );
  const [showForm, setShowForm] = useState(false);
  const [reportBusy, setReportBusy] = useState<
    "pdf-share" | "pdf-archive" | "excel-share" | "excel-archive" | null
  >(null);
  const [projectName, setProjectName] = useState("Şantiye");
  const [date, setDate] = useState(toDateKey(new Date()));
  const [workArea, setWorkArea] = useState("");
  const [workType, setWorkType] = useState("Beton");
  const [workDone, setWorkDone] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("m³");
  const [workerCount, setWorkerCount] = useState("");
  const [materials, setMaterials] = useState("");
  const [issues, setIssues] = useState("");
  const [dailyExpense, setDailyExpense] = useState("");
  const [measurementCategoryId, setMeasurementCategoryId] = useState("");
  const [measurementItemLabel, setMeasurementItemLabel] = useState("");
  const [customMeasurementItem, setCustomMeasurementItem] = useState(false);
  const [editingLog, setEditingLog] = useState<DailyLog | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const availableDailyUnits = measurementCategoryId
    ? CATEGORY_CONFIG[measurementCategoryId]?.units ??
      [CATEGORY_CONFIG[measurementCategoryId]?.unit ?? "adet"]
    : UNITS;

  useEffect(() => {
    loadActiveProject().then((active) => {
      setProjectId(params.projectId ?? active.id);
      setProjectOwnerId(
        params.ownerId ??
          (!params.projectId || active.id === params.projectId
            ? active.ownerId
            : ""),
      );
      setRole(params.role ?? active.role);
      setProjectName(active.name || "Şantiye");
    });
  }, [params.ownerId, params.projectId, params.role, user?.uid]);

  useEffect(() => {
    if (!user || !projectId || !projectOwnerId || !role) return;
    setLoading(true);
    setLoadError("");
    let siteLogs: DailyLog[] = [];
    let legacyLogs: DailyLog[] = [];
    const sync = () => {
      setLogs(
        [...siteLogs, ...legacyLogs].sort((a, b) =>
          b.date.localeCompare(a.date),
        ),
      );
      setLoading(false);
    };
    const onError = (error: unknown) => {
      console.error("Saha günlükleri yüklenemedi:", error);
      setLoadError(
        "Kayıtlar yüklenemedi. Bağlantınızı kontrol edip tekrar açın.",
      );
      setLoading(false);
    };
    const unsubSite = onSnapshot(
      query(
        collection(
          db,
          "users",
          projectOwnerId,
          "projects",
          projectId,
          "siteLogs",
        ),
        orderBy("date", "desc"),
      ),
      (snapshot) => {
        siteLogs = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
          source: "siteLogs",
        })) as DailyLog[];
        sync();
      },
      onError,
    );
    if (!canSeeCosts(role)) return unsubSite;
    const unsubLegacy = onSnapshot(
      query(
        collection(
          db,
          "users",
          projectOwnerId,
          "projects",
          projectId,
          "dailyLogs",
        ),
        orderBy("date", "desc"),
      ),
      (snapshot) => {
        legacyLogs = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
          source: "dailyLogs",
        })) as DailyLog[];
        sync();
      },
      onError,
    );
    const unsubCosts = onSnapshot(
      collection(
        db,
        "users",
        projectOwnerId,
        "projects",
        projectId,
        "dailyLogCosts",
      ),
      (snapshot) => {
        const next: Record<string, number> = {};
        snapshot.docs.forEach((item) => {
          next[item.id] = item.data().amount ?? 0;
        });
        setCosts(next);
      },
      onError,
    );
    return () => {
      unsubSite();
      unsubLegacy();
      unsubCosts();
    };
  }, [projectId, projectOwnerId, role, user]);

  const selectedLogs = useMemo(
    () => logs.filter((log) => log.date === date),
    [date, logs],
  );
  const summary = useMemo(
    () => ({
      records: selectedLogs.length,
      workers: selectedLogs.reduce(
        (sum, log) => sum + (log.workerCount || 0),
        0,
      ),
      quantityRecords: selectedLogs.filter((log) => !!log.quantity).length,
    }),
    [selectedLogs],
  );

  const resetForm = () => {
    setWorkArea("");
    setWorkType("Beton");
    setWorkDone("");
    setQuantity("");
    setUnit("m³");
    setWorkerCount("");
    setMaterials("");
    setIssues("");
    setDailyExpense("");
    setMeasurementCategoryId("");
    setMeasurementItemLabel("");
    setCustomMeasurementItem(false);
  };
  const closeForm = () => {
    if (saving) return;
    resetForm();
    setEditingLog(null);
    setShowForm(false);
  };
  const startEditing = (log: DailyLog) => {
    const templates = log.measurementCategoryId
      ? CATEGORY_CONFIG[log.measurementCategoryId]?.templates ?? []
      : [];
    setEditingLog(log);
    setDate(log.date);
    setWorkArea(log.workArea ?? "");
    setWorkType(log.workType ?? "Beton");
    setWorkDone(log.workDone ?? "");
    setQuantity(log.quantity ? String(log.quantity) : "");
    setUnit(log.unit ?? "m³");
    setWorkerCount(log.workerCount ? String(log.workerCount) : "");
    setMaterials(log.materials ?? "");
    setIssues(log.issues ?? "");
    setDailyExpense(
      canSeeCosts(role) && (costs[log.id] ?? log.dailyExpense)
        ? String(costs[log.id] ?? log.dailyExpense)
        : "",
    );
    setMeasurementCategoryId(log.measurementCategoryId ?? "");
    setMeasurementItemLabel(log.measurementItemLabel ?? "");
    setCustomMeasurementItem(
      !!log.measurementItemLabel &&
        !templates.some(
          (template) => template.label === log.measurementItemLabel,
        ),
    );
    setActiveSection("flow");
    setShowForm(true);
  };
  const onDateChange = (_event: DateTimePickerEvent, value?: Date) => {
    setShowCalendar(false);
    if (value) setDate(toDateKey(value));
  };

  const handleSaveLog = async () => {
    if (
      !user ||
      !projectId ||
      !projectOwnerId ||
      !workArea.trim() ||
      !workDone.trim()
    )
      return;
    setSaving(true);
    try {
      const parsedQuantity = parseFloat(quantity.replace(",", ".")) || 0;
      const measurementCategory = MEASUREMENT_CATEGORIES.find(
        (item) => item.id === measurementCategoryId,
      );
      const logData = {
        date,
        workArea: workArea.trim(),
        workType,
        workDone: workDone.trim(),
        quantity: parsedQuantity,
        unit,
        workerCount: parseInt(workerCount, 10) || 0,
        materials: materials.trim(),
        issues: issues.trim(),
        measurementCategoryId: measurementCategory?.id ?? "",
        measurementCategoryTitle: measurementCategory?.title ?? "",
        measurementItemLabel: measurementCategory
          ? measurementItemLabel.trim()
          : "",
      };
      let logId: string;
      if (editingLog) {
        const logRef = doc(
          db,
          "users",
          projectOwnerId,
          "projects",
          projectId,
          editingLog.source ?? "siteLogs",
          editingLog.id,
        );
        await updateDoc(logRef, {
          ...logData,
          ...(editingLog.approvalStatus === "rejected" && {
            approvalStatus: "pending",
          }),
          updatedAt: serverTimestamp(),
        });
        logId = editingLog.id;
      } else {
        const logRef = await addDoc(
          collection(
            db,
            "users",
            projectOwnerId,
            "projects",
            projectId,
            "siteLogs",
          ),
          {
            ...logData,
            approvalStatus: measurementCategory ? "pending" : "not_required",
            authorId: user.uid,
            authorName: user.displayName || user.email || "Ekip üyesi",
            authorRole: role,
            createdAt: serverTimestamp(),
          },
        );
        logId = logRef.id;
      }
      if (canSeeCosts(role)) {
        const costRef = doc(
          db,
          "users",
          projectOwnerId,
          "projects",
          projectId,
          "dailyLogCosts",
          logId,
        );
        if (dailyExpense.trim()) {
          await setDoc(costRef, {
            amount: parseFloat(dailyExpense.replace(",", ".")) || 0,
            updatedAt: serverTimestamp(),
          });
        } else if (editingLog) {
          await deleteDoc(costRef).catch(() => undefined);
        }
        await recalculateProjectTotal(projectOwnerId, projectId);
      }
      resetForm();
      setEditingLog(null);
      setShowForm(false);
      setActiveSection("flow");
    } catch (error) {
      console.error("Günlük kaydedilemedi:", error);
      Alert.alert(
        editingLog ? "Kayıt güncellenemedi" : "Kayıt eklenemedi",
        "Yazdıklarınız silinmedi. Bağlantınızı kontrol edip tekrar deneyin.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLog = (log: DailyLog) => {
    if (!user || !projectId || !projectOwnerId) return;
    const removesMeasurement =
      canSeeCosts(role) &&
      log.approvalStatus === "approved" &&
      !!log.measurementCategoryId;
    Alert.alert(
      "Kaydı Sil",
      removesMeasurement
        ? "Bu kayıt günlükten, bağlı metrajdan ve maliyet hesabından birlikte silinecek."
        : "Bu saha kaydı kalıcı olarak silinsin mi?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            try {
              const logRef = doc(
                db,
                "users",
                projectOwnerId,
                "projects",
                projectId,
                log.source ?? "siteLogs",
                log.id,
              );
              const costRef = doc(
                db,
                "users",
                projectOwnerId,
                "projects",
                projectId,
                "dailyLogCosts",
                log.id,
              );
              if (removesMeasurement && log.measurementCategoryId) {
                const measurementRef = doc(
                  db,
                  "users",
                  projectOwnerId,
                  "projects",
                  projectId,
                  "measurements",
                  log.measurementCategoryId,
                );
                const categoryRef = doc(
                  db,
                  "users",
                  projectOwnerId,
                  "projects",
                  projectId,
                  "categories",
                  log.measurementCategoryId,
                );
                await runTransaction(db, async (transaction) => {
                  const [measurementSnapshot, categorySnapshot] =
                    await Promise.all([
                      transaction.get(measurementRef),
                      transaction.get(categoryRef),
                    ]);
                  const isLinkedEntry = (entry: {
                    id?: string;
                    sourceDailyLogId?: string;
                  }) =>
                    entry.id === `daily-${log.id}` ||
                    entry.sourceDailyLogId === log.id;
                  const measurementEntries = (
                    measurementSnapshot.data()?.entries ?? []
                  ).filter(
                    (entry: { id?: string; sourceDailyLogId?: string }) =>
                      !isLinkedEntry(entry),
                  );
                  const categoryEntries = (
                    categorySnapshot.data()?.entries ?? []
                  ).filter(
                    (entry: { id?: string; sourceDailyLogId?: string }) =>
                      !isLinkedEntry(entry),
                  );
                  if (measurementEntries.length)
                    transaction.set(
                      measurementRef,
                      { entries: measurementEntries },
                      { merge: true },
                    );
                  else transaction.delete(measurementRef);
                  if (categorySnapshot.exists()) {
                    if (categoryEntries.length)
                      transaction.set(
                        categoryRef,
                        {
                          entries: categoryEntries,
                          total: categoryEntries.reduce(
                            (sum: number, entry: { total?: number }) =>
                              sum + (entry.total ?? 0),
                            0,
                          ),
                        },
                        { merge: true },
                      );
                    else transaction.delete(categoryRef);
                  }
                  transaction.delete(logRef);
                  transaction.delete(costRef);
                });
                await recalculateProjectTotal(projectOwnerId, projectId);
              } else {
                await deleteDoc(logRef);
                if (canSeeCosts(role) && log.source !== "dailyLogs") {
                  await deleteDoc(costRef).catch(() => undefined);
                  await recalculateProjectTotal(projectOwnerId, projectId);
                }
              }
            } catch (error) {
              console.error("Günlük kaydı silinemedi:", error);
              Alert.alert(
                "Kayıt silinemedi",
                "Bağlı veriler korunarak işlem durduruldu. Lütfen tekrar deneyin.",
              );
            }
          },
        },
      ],
    );
  };

  const canDelete = (log: DailyLog) =>
    canSeeCosts(role) ||
    (log.approvalStatus !== "approved" && log.authorId === user?.uid);
  const canEdit = (log: DailyLog) =>
    log.source === "siteLogs" &&
    (log.approvalStatus === "pending" ||
      log.approvalStatus === "rejected" ||
      log.approvalStatus === "not_required" ||
      !log.approvalStatus) &&
    (canSeeCosts(role) || log.authorId === user?.uid);
  const parsedFormQuantity = parseFloat(quantity.replace(",", ".")) || 0;
  const parsedWorkerCount = parseInt(workerCount, 10) || 0;
  const hasValidMeasurementLink =
    !measurementCategoryId ||
    (!!measurementItemLabel.trim() && parsedFormQuantity > 0);
  const isFormValid = !!(
    projectId &&
    workArea.trim() &&
    workDone.trim() &&
    parsedWorkerCount > 0 &&
    hasValidMeasurementLink
  );

  const reviewLog = async (log: DailyLog, approve: boolean) => {
    if (
      !user ||
      !projectId ||
      !projectOwnerId ||
      log.source !== "siteLogs" ||
      !canSeeCosts(role)
    )
      return;
    setReviewingId(log.id);
    try {
      const logRef = doc(
        db,
        "users",
        projectOwnerId,
        "projects",
        projectId,
        "siteLogs",
        log.id,
      );
      if (!approve) {
        await updateDoc(logRef, {
          approvalStatus: "rejected",
          approvedBy: user.uid,
          reviewedAt: serverTimestamp(),
        });
      } else {
        if (
          !log.measurementCategoryId ||
          !log.measurementItemLabel ||
          !log.quantity
        )
          throw new Error("MISSING_MEASUREMENT");
        const categoryId = log.measurementCategoryId;
        const measurementRef = doc(
          db,
          "users",
          projectOwnerId,
          "projects",
          projectId,
          "measurements",
          categoryId,
        );
        await runTransaction(db, async (transaction) => {
          const [logSnapshot, measurementSnapshot] = await Promise.all([
            transaction.get(logRef),
            transaction.get(measurementRef),
          ]);
          const currentLog = logSnapshot.data() as DailyLog | undefined;
          if (!currentLog || currentLog.approvalStatus !== "pending") return;
          const entries = measurementSnapshot.data()?.entries ?? [];
          if (
            !entries.some(
              (entry: { sourceDailyLogId?: string }) =>
                entry.sourceDailyLogId === log.id,
            )
          ) {
            transaction.set(
              measurementRef,
              {
                entries: [
                  ...entries,
                  {
                    id: `daily-${log.id}`,
                    label: `${log.measurementItemLabel} — ${log.workArea || "Genel saha"}`,
                    quantity: log.quantity,
                    unit:
                      log.unit || CATEGORY_CONFIG[categoryId]?.unit || "adet",
                    unitPrice: 0,
                    total: 0,
                    sourceDailyLogId: log.id,
                    sourceDate: log.date,
                  },
                ],
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );
          }
          transaction.update(logRef, {
            approvalStatus: "approved",
            approvedBy: user.uid,
            reviewedAt: serverTimestamp(),
          });
        });
      }
    } catch (error) {
      console.error("Günlük onayı tamamlanamadı:", error);
      Alert.alert(
        "İşlem tamamlanamadı",
        "Kayıt değişmiş olabilir. Liste yenilendikten sonra tekrar deneyin.",
      );
    } finally {
      setReviewingId(null);
    }
  };

  const escapeHtml = (value: string | number | undefined) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[character] ?? character,
    );
  const dailyReportHtml = () => {
    const rows = selectedLogs
      .map(
        (log, index) =>
          `<tr><td>${index + 1}</td><td>${escapeHtml(log.workArea || "Genel saha")}</td><td>${escapeHtml(log.measurementItemLabel ? `${log.workType || ""} / ${log.measurementItemLabel}` : log.workType || "Saha kaydı")}</td><td>${escapeHtml(log.workDone)}</td><td>${log.quantity ? `${escapeHtml(log.quantity)} ${escapeHtml(log.unit)}` : "—"}</td><td>${escapeHtml(log.workerCount || 0)}</td><td>${escapeHtml(log.materials || "—")}</td><td>${escapeHtml(log.issues || "—")}</td><td>${escapeHtml(log.authorName || "—")}</td></tr>`,
      )
      .join("");
    return `<!doctype html><html><head><meta charset="utf-8"><style>@page{margin:28px}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#172033}h1{color:#1557a6;margin:0 0 4px}p{margin:3px 0;color:#526076}.summary{display:flex;gap:14px;margin:18px 0}.box{border:1px solid #dce5f0;border-radius:10px;padding:10px 14px}.box b{font-size:20px;color:#1557a6}table{width:100%;border-collapse:collapse;font-size:9px}th{background:#1557a6;color:#fff;padding:7px;text-align:left}td{border:1px solid #dce5f0;padding:7px;vertical-align:top}tr:nth-child(even){background:#f6f9fc}.footer{margin-top:18px;font-size:9px;color:#7a8798}</style></head><body><h1>${escapeHtml(projectName)}</h1><p>Günlük Saha Raporu • ${escapeHtml(formatDate(date))}</p><div class="summary"><div class="box"><b>${summary.records}</b><br>Kayıt</div><div class="box"><b>${summary.workers}</b><br>Personel</div><div class="box"><b>${summary.quantityRecords}</b><br>Miktarlı iş</div></div><table><thead><tr><th>#</th><th>Alan</th><th>İş türü</th><th>Yapılan iş</th><th>Miktar</th><th>Personel</th><th>Malzeme</th><th>Not</th><th>Kaydeden</th></tr></thead><tbody>${rows}</tbody></table><p class="footer">Şantiyen Cebinde ile ${escapeHtml(new Date().toLocaleString("tr-TR"))} tarihinde hazırlanmıştır.</p></body></html>`;
  };

  const createPdf = async () => {
    if (selectedLogs.length === 0) throw new Error("EMPTY_REPORT");
    return Print.printToFileAsync({ html: dailyReportHtml() });
  };

  const shareDailyPdf = async () => {
    setReportBusy("pdf-share");
    try {
      const { uri } = await createPdf();
      if (!(await Sharing.isAvailableAsync()))
        throw new Error("SHARING_UNAVAILABLE");
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `${formatDate(date)} günlük saha raporu`,
      });
    } catch (error) {
      Alert.alert(
        error instanceof Error && error.message === "EMPTY_REPORT"
          ? "Kayıt yok"
          : "PDF oluşturulamadı",
        error instanceof Error && error.message === "EMPTY_REPORT"
          ? "PDF için seçili günde en az bir saha kaydı olmalı."
          : "Lütfen tekrar deneyin.",
      );
    } finally {
      setReportBusy(null);
    }
  };

  const archiveDailyPdf = async () => {
    if (!projectId || !projectOwnerId) return;
    setReportBusy("pdf-archive");
    try {
      const { uri } = await createPdf();
      await setDoc(
        doc(
          db,
          "users",
          projectOwnerId,
          "projects",
          projectId,
          "documentSections",
          "daily-reports",
        ),
        {
          title: "Günlük Raporlar",
          iconName: "file-chart-outline",
          iconPack: "MaterialCommunityIcons",
          order: -1,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      const fileName = `Gunluk_Rapor_${date}.pdf`;
      const result = await uploadDocument(
        uri,
        fileName,
        "application/pdf",
        projectOwnerId,
        projectId,
        "daily-reports",
      );
      if (!result.success) throw new Error(result.error);
      Alert.alert(
        "Belgelere kaydedildi",
        `${fileName}, Günlük Raporlar klasörüne eklendi.`,
      );
    } catch (error) {
      Alert.alert(
        error instanceof Error && error.message === "EMPTY_REPORT"
          ? "Kayıt yok"
          : "Arşivlenemedi",
        error instanceof Error && error.message === "EMPTY_REPORT"
          ? "PDF için seçili günde en az bir saha kaydı olmalı."
          : "PDF belgelere eklenemedi. Lütfen tekrar deneyin.",
      );
    } finally {
      setReportBusy(null);
    }
  };

  const createExcel = async () => {
    if (selectedLogs.length === 0) throw new Error("EMPTY_REPORT");
    if (!FileSystem.cacheDirectory) throw new Error("CACHE_UNAVAILABLE");
    const rows = [
      [projectName],
      [`Günlük Saha Raporu - ${formatDate(date)}`],
      [],
      [
        "Toplam kayıt",
        summary.records,
        "Toplam personel",
        summary.workers,
        "Miktarlı iş",
        summary.quantityRecords,
      ],
      [],
      [
        "No",
        "Tarih",
        "Çalışma Alanı",
        "İş Türü",
        "Alt Kalem",
        "Yapılan İş",
        "Miktar",
        "Birim",
        "Kişi Sayısı",
        "Malzeme",
        "Sorun / Not",
        "Kaydeden",
      ],
      ...selectedLogs.map((log, index) => [
        index + 1,
        formatDate(log.date),
        log.workArea || "Genel saha",
        log.workType || "Saha kaydı",
        log.measurementItemLabel || "",
        log.workDone,
        log.quantity || "",
        log.unit || "",
        log.workerCount || 0,
        log.materials || "",
        log.issues || "",
        log.authorName || "",
      ]),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
    ];
    worksheet["!cols"] = [6, 16, 24, 16, 28, 36, 12, 10, 12, 28, 28, 24].map(
      (wch) => ({ wch }),
    );
    worksheet["!autofilter"] = { ref: `A6:L${rows.length}` };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Günlük Rapor");
    const uri = `${FileSystem.cacheDirectory}Gunluk_Rapor_${date}.xlsx`;
    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    await FileSystem.writeAsStringAsync(uri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { uri, fileName: `Gunluk_Rapor_${date}.xlsx` };
  };

  const shareDailyExcel = async () => {
    setReportBusy("excel-share");
    try {
      const { uri } = await createExcel();
      if (!(await Sharing.isAvailableAsync()))
        throw new Error("SHARING_UNAVAILABLE");
      await Sharing.shareAsync(uri, {
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        UTI: "org.openxmlformats.spreadsheetml.sheet",
        dialogTitle: `${formatDate(date)} Excel günlük raporu`,
      });
    } catch (error) {
      Alert.alert(
        error instanceof Error && error.message === "EMPTY_REPORT"
          ? "Kayıt yok"
          : "Excel oluşturulamadı",
        error instanceof Error && error.message === "EMPTY_REPORT"
          ? "Excel için seçili günde en az bir saha kaydı olmalı."
          : "Lütfen tekrar deneyin.",
      );
    } finally {
      setReportBusy(null);
    }
  };

  const archiveDailyExcel = async () => {
    if (!projectId || !projectOwnerId) return;
    setReportBusy("excel-archive");
    try {
      const { uri, fileName } = await createExcel();
      await setDoc(
        doc(
          db,
          "users",
          projectOwnerId,
          "projects",
          projectId,
          "documentSections",
          "daily-reports",
        ),
        {
          title: "Günlük Raporlar",
          iconName: "file-chart-outline",
          iconPack: "MaterialCommunityIcons",
          order: -1,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      const result = await uploadDocument(
        uri,
        fileName,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        projectOwnerId,
        projectId,
        "daily-reports",
      );
      if (!result.success) throw new Error(result.error);
      Alert.alert(
        "Belgelere kaydedildi",
        `${fileName}, Günlük Raporlar klasörüne eklendi.`,
      );
    } catch (error) {
      Alert.alert(
        error instanceof Error && error.message === "EMPTY_REPORT"
          ? "Kayıt yok"
          : "Excel arşivlenemedi",
        error instanceof Error && error.message === "EMPTY_REPORT"
          ? "Excel için seçili günde en az bir saha kaydı olmalı."
          : "Excel belgelere eklenemedi. Lütfen tekrar deneyin.",
      );
    } finally {
      setReportBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header title="Saha Günlüğü" leftMenuIcon accountIcon />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.dateCard}>
            <View>
              <Text style={styles.eyebrow}>SEÇİLİ GÜN</Text>
              <Text style={styles.dateTitle}>{formatDate(date)}</Text>
            </View>
            <View style={styles.dateActions}>
              {date !== toDateKey(new Date()) && (
                <TouchableOpacity
                  onPress={() => setDate(toDateKey(new Date()))}
                  style={styles.todayButton}
                >
                  <Text style={styles.todayText}>Bugün</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setShowCalendar((value) => !value)}
                style={styles.calendarButton}
                accessibilityLabel="Takvimden tarih seç"
              >
                <MaterialCommunityIcons
                  name="calendar-month-outline"
                  size={22}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>
          </View>
          {showCalendar && (
            <View style={styles.calendarWrap}>
              <DateTimePicker
                value={fromDateKey(date)}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                maximumDate={new Date()}
                onChange={onDateChange}
              />
            </View>
          )}
          <View style={styles.summaryStrip}>
            <SummaryItem label="Kayıt" value={summary.records} />
            <View style={styles.summaryDivider} />
            <SummaryItem label="Personel" value={summary.workers} />
            <View style={styles.summaryDivider} />
            <SummaryItem label="Miktarlı İş" value={summary.quantityRecords} />
          </View>

          {!showForm && (
            <View style={styles.sectionTabs} accessibilityRole="tablist">
              <TouchableOpacity
                accessibilityRole="tab"
                accessibilityState={{ selected: activeSection === "flow" }}
                style={[
                  styles.sectionTab,
                  activeSection === "flow" && styles.sectionTabActive,
                ]}
                onPress={() => setActiveSection("flow")}
              >
                <MaterialCommunityIcons
                  name="format-list-bulleted"
                  size={18}
                  color={
                    activeSection === "flow" ? COLORS.primary : COLORS.textMuted
                  }
                />
                <Text
                  style={[
                    styles.sectionTabText,
                    activeSection === "flow" && styles.sectionTabTextActive,
                  ]}
                >
                  Saha Akışı
                </Text>
              </TouchableOpacity>
              {canExportDaily(role) && (
                <TouchableOpacity
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeSection === "reports" }}
                  style={[
                    styles.sectionTab,
                    activeSection === "reports" && styles.sectionTabActive,
                  ]}
                  onPress={() => setActiveSection("reports")}
                >
                  <MaterialCommunityIcons
                    name="file-chart-outline"
                    size={18}
                    color={
                      activeSection === "reports"
                        ? COLORS.primary
                        : COLORS.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.sectionTabText,
                      activeSection === "reports" &&
                        styles.sectionTabTextActive,
                    ]}
                  >
                    Raporlar
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {canCreateDaily(role) && showForm && (
            <View style={styles.formCard}>
              <View style={styles.formTitleRow}>
                <View style={styles.formIcon}>
                  <MaterialCommunityIcons
                    name="hard-hat"
                    size={21}
                    color={COLORS.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formTitle}>
                    {editingLog
                      ? "Saha kaydını düzenle"
                      : "Sahadan yeni kayıt"}
                  </Text>
                  <Text style={styles.formSubtitle}>
                    {editingLog
                      ? "Değişiklikler saha akışında hemen güncellenir"
                      : "Yapılan işi ekip için anlaşılır biçimde kaydedin"}
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityLabel="Kayıt formunu kapat"
                  style={styles.formCloseButton}
                  onPress={closeForm}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={21}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              <Field label="Çalışma alanı *">
                <TextInput
                  style={styles.input}
                  value={workArea}
                  onChangeText={setWorkArea}
                  placeholder="Örn: A Blok, 2. kat, C3 kolonu"
                  placeholderTextColor={COLORS.placeholder}
                />
              </Field>
              <Text style={styles.fieldLabel}>İş türü</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {WORK_TYPES.map((item) => (
                  <TouchableOpacity
                    key={item}
                    onPress={() => setWorkType(item)}
                    style={[
                      styles.chip,
                      workType === item && styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        workType === item && styles.chipTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.fieldLabel}>
                Metraja bağla (isteğe bağlı)
              </Text>
              {editingLog ? (
                <View style={styles.lockedMeasurementBox}>
                  <MaterialCommunityIcons
                    name={measurementCategoryId ? "link-lock" : "link-off"}
                    size={18}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.lockedMeasurementText}>
                    {measurementCategoryId
                      ? `${CATEGORY_CONFIG[measurementCategoryId]?.title || "Metraj"} bağlantısı korunuyor`
                      : "Bu kayıt metraja bağlı değil"}
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setMeasurementCategoryId("");
                      setMeasurementItemLabel("");
                      setCustomMeasurementItem(false);
                    }}
                    style={[
                      styles.chip,
                      !measurementCategoryId && styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        !measurementCategoryId && styles.chipTextActive,
                      ]}
                    >
                      Bağlama
                    </Text>
                  </TouchableOpacity>
                  {MEASUREMENT_CATEGORIES.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => {
                        setMeasurementCategoryId(item.id);
                        setMeasurementItemLabel("");
                        setCustomMeasurementItem(false);
                        setWorkType(item.title);
                        setUnit(CATEGORY_CONFIG[item.id]?.unit ?? unit);
                      }}
                      style={[
                        styles.chip,
                        measurementCategoryId === item.id && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          measurementCategoryId === item.id &&
                            styles.chipTextActive,
                        ]}
                      >
                        {item.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              {!!measurementCategoryId && (
                <View style={styles.measurementDetailBox}>
                  <Text style={styles.fieldLabel}>
                    {CATEGORY_CONFIG[measurementCategoryId]?.title} türü /
                    kalemi *
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    {CATEGORY_CONFIG[measurementCategoryId]?.templates?.map(
                      (template) => (
                        <TouchableOpacity
                          key={template.label}
                          onPress={() => {
                            setMeasurementItemLabel(template.label);
                            setCustomMeasurementItem(false);
                          }}
                          style={[
                            styles.chip,
                            measurementItemLabel === template.label &&
                              !customMeasurementItem &&
                              styles.chipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              measurementItemLabel === template.label &&
                                !customMeasurementItem &&
                                styles.chipTextActive,
                            ]}
                          >
                            {template.label}
                          </Text>
                        </TouchableOpacity>
                      ),
                    )}
                    <TouchableOpacity
                      onPress={() => {
                        setMeasurementItemLabel("");
                        setCustomMeasurementItem(true);
                      }}
                      style={[
                        styles.chip,
                        customMeasurementItem && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          customMeasurementItem && styles.chipTextActive,
                        ]}
                      >
                        Diğer
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                  {customMeasurementItem && (
                    <TextInput
                      style={styles.input}
                      value={measurementItemLabel}
                      onChangeText={setMeasurementItemLabel}
                      placeholder="Kalem türünü yazın"
                      placeholderTextColor={COLORS.placeholder}
                    />
                  )}
                </View>
              )}
              <Text style={styles.helperText}>
                {measurementCategoryId
                  ? "Tür ve miktar zorunludur. Yönetici onayından sonra metraja yalnızca bir kez aktarılır."
                  : "Yalnızca saha notu girecekseniz metraja bağlamadan devam edebilirsiniz."}
              </Text>
              <Field label="Yapılan iş *">
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={workDone}
                  onChangeText={setWorkDone}
                  placeholder="Örn: C3 ve C4 kolonlarının betonu döküldü"
                  placeholderTextColor={COLORS.placeholder}
                  multiline
                  textAlignVertical="top"
                />
              </Field>
              <View style={styles.row}>
                <Field label="Miktar" half>
                  <TextInput
                    style={styles.input}
                    value={quantity}
                    onChangeText={(text) =>
                      setQuantity(text.replace(/[^0-9.,]/g, ""))
                    }
                    placeholder="0"
                    placeholderTextColor={COLORS.placeholder}
                    keyboardType="decimal-pad"
                  />
                </Field>
                <Field label="Birim" half>
                  <TouchableOpacity
                    style={styles.unitSelector}
                    onPress={() => setShowUnitPicker(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`Birim seç: ${unit}`}
                  >
                    <Text style={styles.unitSelectorText}>{unit}</Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={21}
                      color={COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                </Field>
              </View>
              <View style={styles.row}>
                <Field label="Çalışan kişi sayısı *" half>
                  <TextInput
                    style={styles.input}
                    value={workerCount}
                    onChangeText={(text) =>
                      setWorkerCount(text.replace(/[^0-9]/g, ""))
                    }
                    placeholder="0"
                    placeholderTextColor={COLORS.placeholder}
                    keyboardType="number-pad"
                  />
                </Field>
                <Field label="Sorun / not" half>
                  <TextInput
                    style={styles.input}
                    value={issues}
                    onChangeText={setIssues}
                    placeholder="Varsa kısa not"
                    placeholderTextColor={COLORS.placeholder}
                  />
                </Field>
              </View>
              <Field label="Kullanılan / gelen malzeme">
                <TextInput
                  style={[styles.input, styles.smallArea]}
                  value={materials}
                  onChangeText={setMaterials}
                  placeholder="Örn: 3 mikser C30 beton geldi"
                  placeholderTextColor={COLORS.placeholder}
                  multiline
                />
              </Field>
              {canSeeCosts(role) && (
                <View style={styles.managerBox}>
                  <Text style={styles.managerLabel}>YÖNETİCİYE ÖZEL</Text>
                  <TextInput
                    style={styles.input}
                    value={dailyExpense}
                    onChangeText={(text) =>
                      setDailyExpense(text.replace(/[^0-9.,]/g, ""))
                    }
                    placeholder="Ek harcama (₺)"
                    placeholderTextColor={COLORS.placeholder}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.addButton,
                  (!isFormValid || saving) && styles.addButtonDisabled,
                ]}
                onPress={handleSaveLog}
                disabled={!isFormValid || saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="content-save-outline"
                      size={19}
                      color="#fff"
                    />
                    <Text style={styles.addButtonText}>
                      {editingLog
                        ? "Değişiklikleri Kaydet"
                        : "Saha Kaydını Ekle"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {canExportDaily(role) && !showForm && activeSection === "reports" && (
            <View style={styles.reportCard}>
              <View style={styles.reportHeading}>
                <View style={styles.reportIcon}>
                  <MaterialCommunityIcons
                    name="file-chart-outline"
                    size={22}
                    color={COLORS.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reportTitle}>Raporu dışa aktar</Text>
                  <Text style={styles.reportSubtitle}>
                    Seçili gün için PDF veya düzenlenebilir Excel oluşturun.
                  </Text>
                </View>
              </View>
              <View style={styles.exportFormat}>
                <View style={styles.exportFormatHeading}>
                  <View style={[styles.formatIcon, styles.pdfIcon]}>
                    <MaterialCommunityIcons
                      name="file-pdf-box"
                      size={24}
                      color="#D33B32"
                    />
                  </View>
                  <View style={styles.formatCopy}>
                    <Text style={styles.formatTitle}>PDF raporu</Text>
                    <Text style={styles.formatDescription}>
                      Sabit görünüm · WhatsApp ve e-posta için
                    </Text>
                  </View>
                </View>
                <View style={styles.formatActions}>
                  <TouchableOpacity
                    accessibilityLabel="PDF raporunu paylaş"
                    style={[
                      styles.formatSecondaryButton,
                      (!selectedLogs.length || !!reportBusy) &&
                        styles.reportButtonDisabled,
                    ]}
                    onPress={shareDailyPdf}
                    disabled={!selectedLogs.length || !!reportBusy}
                  >
                    {reportBusy === "pdf-share" ? (
                      <ActivityIndicator color={COLORS.primary} />
                    ) : (
                      <>
                        <MaterialCommunityIcons
                          name="share-variant-outline"
                          size={17}
                          color={COLORS.primary}
                        />
                        <Text style={styles.formatSecondaryText}>Paylaş</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {canManageDocuments(role) && (
                    <TouchableOpacity
                      accessibilityLabel="PDF raporunu belgelere kaydet"
                      style={[
                        styles.formatPrimaryButton,
                        (!selectedLogs.length || !!reportBusy) &&
                          styles.reportButtonDisabled,
                      ]}
                      onPress={archiveDailyPdf}
                      disabled={!selectedLogs.length || !!reportBusy}
                    >
                      {reportBusy === "pdf-archive" ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <MaterialCommunityIcons
                            name="folder-plus-outline"
                            size={17}
                            color="#fff"
                          />
                          <Text style={styles.formatPrimaryText}>
                            Belgelere kaydet
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <View style={styles.exportFormat}>
                <View style={styles.exportFormatHeading}>
                  <View style={[styles.formatIcon, styles.excelIcon]}>
                    <MaterialCommunityIcons
                      name="microsoft-excel"
                      size={23}
                      color="#18864B"
                    />
                  </View>
                  <View style={styles.formatCopy}>
                    <Text style={styles.formatTitle}>Excel tablosu</Text>
                    <Text style={styles.formatDescription}>
                      Düzenlenebilir · Ofis takibi ve arşiv için
                    </Text>
                  </View>
                </View>
                <View style={styles.formatActions}>
                  <TouchableOpacity
                    accessibilityLabel="Excel tablosunu paylaş"
                    style={[
                      styles.formatSecondaryButton,
                      styles.excelSecondaryButton,
                      (!selectedLogs.length || !!reportBusy) &&
                        styles.reportButtonDisabled,
                    ]}
                    onPress={shareDailyExcel}
                    disabled={!selectedLogs.length || !!reportBusy}
                  >
                    {reportBusy === "excel-share" ? (
                      <ActivityIndicator color="#18864B" />
                    ) : (
                      <>
                        <MaterialCommunityIcons
                          name="share-variant-outline"
                          size={17}
                          color="#18864B"
                        />
                        <Text style={styles.excelActionText}>Paylaş</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {canManageDocuments(role) && (
                    <TouchableOpacity
                      accessibilityLabel="Excel tablosunu belgelere kaydet"
                      style={[
                        styles.formatPrimaryButton,
                        styles.excelPrimaryButton,
                        (!selectedLogs.length || !!reportBusy) &&
                          styles.reportButtonDisabled,
                      ]}
                      onPress={archiveDailyExcel}
                      disabled={!selectedLogs.length || !!reportBusy}
                    >
                      {reportBusy === "excel-archive" ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <MaterialCommunityIcons
                            name="folder-plus-outline"
                            size={17}
                            color="#fff"
                          />
                          <Text style={styles.formatPrimaryText}>
                            Belgelere kaydet
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}

          {!showForm && activeSection === "flow" && (
            <>
              <View style={styles.listHeader}>
                <View>
                  <Text style={styles.listTitle}>Saha akışı</Text>
                  <Text style={styles.listSubtitle}>{formatDate(date)}</Text>
                </View>
                <Text style={styles.recordBadge}>
                  {selectedLogs.length} kayıt
                </Text>
              </View>
              {loading ? (
                <View style={styles.center}>
                  <ActivityIndicator color={COLORS.primary} />
                </View>
              ) : loadError ? (
                <Empty icon="cloud-alert-outline" title={loadError} />
              ) : selectedLogs.length === 0 ? (
                <Empty
                  icon="clipboard-text-clock-outline"
                  title="Bu güne ait kayıt yok"
                  subtitle={
                    canCreateDaily(role)
                      ? "Yukarıdaki formdan ilk saha kaydını ekleyin."
                      : "Saha ekibi bu güne kayıt eklediğinde burada görünecek."
                  }
                />
              ) : (
                selectedLogs.map((log, index) => (
                  <View
                    key={`${log.source}-${log.id}`}
                    style={styles.timelineRow}
                  >
                    <View style={styles.timelineRail}>
                      <View style={styles.timelineDot} />
                      {index < selectedLogs.length - 1 && (
                        <View style={styles.timelineLine} />
                      )}
                    </View>
                    <View style={styles.logCard}>
                      <View style={styles.recordAuthorBar}>
                        <View style={styles.recordAuthorAvatar}>
                          <MaterialCommunityIcons
                            name="account-hard-hat-outline"
                            size={16}
                            color={COLORS.primary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recordAuthorName}>
                            {log.authorName || "Kayıt sahibi bilinmiyor"}
                          </Text>
                          <Text style={styles.recordAuthorRole}>
                            {log.authorRole
                              ? ROLE_LABELS[log.authorRole]
                              : "Saha kaydı"}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.logTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.logArea}>
                            {log.workArea || "Genel saha"}
                          </Text>
                          <Text style={styles.logType}>
                            {log.measurementItemLabel ||
                              log.workType ||
                              "Saha kaydı"}
                          </Text>
                        </View>
                        {!!log.workerCount && (
                          <Meta
                            icon="account-hard-hat-outline"
                            text={`${log.workerCount} kişi`}
                          />
                        )}
                        <View style={styles.recordActions}>
                          {canEdit(log) && (
                            <TouchableOpacity
                              accessibilityLabel="Saha kaydını düzenle"
                              onPress={() => startEditing(log)}
                              style={styles.editButton}
                            >
                              <MaterialCommunityIcons
                                name="pencil-outline"
                                size={17}
                                color={COLORS.primary}
                              />
                            </TouchableOpacity>
                          )}
                          {canDelete(log) && (
                            <TouchableOpacity
                              accessibilityLabel="Saha kaydını sil"
                              onPress={() => handleDeleteLog(log)}
                              style={styles.deleteButton}
                            >
                              <MaterialCommunityIcons
                                name="trash-can-outline"
                                size={17}
                                color={COLORS.danger}
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      <Text style={styles.logText}>{log.workDone}</Text>
                      <View style={styles.metaRow}>
                        {!!log.workType &&
                          log.measurementItemLabel !== log.workType && (
                            <Meta icon="hammer-wrench" text={log.workType} />
                          )}
                        {!!log.quantity && (
                          <Meta
                            icon="ruler-square"
                            text={`${log.quantity} ${log.unit || ""}`}
                          />
                        )}
                        {canSeeCosts(role) &&
                          !!(costs[log.id] ?? log.dailyExpense) && (
                            <Meta
                              icon="cash"
                              text={`₺${(costs[log.id] ?? log.dailyExpense ?? 0).toLocaleString("tr-TR")}`}
                            />
                          )}
                      </View>
                      {role !== "office" && !!log.measurementCategoryId && (
                        <View
                          style={[
                            styles.approvalBox,
                            log.approvalStatus === "approved" &&
                              styles.approvalApproved,
                            log.approvalStatus === "rejected" &&
                              styles.approvalRejected,
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.approvalTitle}>
                              {log.measurementCategoryTitle || "Metraj"} ·{" "}
                              {log.measurementItemLabel || "Kalem belirtilmedi"}
                            </Text>
                            <Text style={styles.approvalText}>
                              {log.approvalStatus === "approved"
                                ? "Metraja aktarıldı"
                                : log.approvalStatus === "rejected"
                                  ? "Yönetici tarafından reddedildi"
                                  : "Yönetici onayı bekliyor"}
                            </Text>
                          </View>
                          {canSeeCosts(role) &&
                            log.approvalStatus === "pending" && (
                              <View style={styles.reviewActions}>
                                <TouchableOpacity
                                  accessibilityLabel="Metraj bağlantısını reddet"
                                  disabled={reviewingId === log.id}
                                  onPress={() => reviewLog(log, false)}
                                  style={styles.rejectButton}
                                >
                                  <MaterialCommunityIcons
                                    name="close"
                                    size={18}
                                    color={COLORS.danger}
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  accessibilityLabel="Metraj bağlantısını onayla"
                                  disabled={reviewingId === log.id}
                                  onPress={() => reviewLog(log, true)}
                                  style={styles.approveButton}
                                >
                                  {reviewingId === log.id ? (
                                    <ActivityIndicator
                                      size="small"
                                      color="#fff"
                                    />
                                  ) : (
                                    <MaterialCommunityIcons
                                      name="check"
                                      size={18}
                                      color="#fff"
                                    />
                                  )}
                                </TouchableOpacity>
                              </View>
                            )}
                        </View>
                      )}
                      {!!log.materials && (
                        <Detail
                          icon="package-variant-closed"
                          text={log.materials}
                        />
                      )}
                      {!!log.issues && (
                        <Detail
                          icon="alert-circle-outline"
                          text={log.issues}
                          danger
                        />
                      )}
                    </View>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
        {canCreateDaily(role) && !showForm && (
          <TouchableOpacity
            accessibilityLabel="Yeni saha kaydı ekle"
            accessibilityRole="button"
            style={styles.floatingAddButton}
            onPress={() => {
              resetForm();
              setEditingLog(null);
              setShowForm(true);
            }}
          >
            <MaterialCommunityIcons name="plus" size={23} color="#fff" />
            <Text style={styles.floatingAddText}>Kayıt Ekle</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
      <Modal
        visible={showUnitPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUnitPicker(false)}
      >
        <View style={styles.unitModalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowUnitPicker(false)}
            accessibilityLabel="Birim seçiciyi kapat"
          />
          <View style={styles.unitModalSheet}>
            <View style={styles.unitModalHandle} />
            <Text style={styles.unitModalTitle}>Birim seç</Text>
            <Text style={styles.unitModalSubtitle}>
              Kaydedilen miktar bu birimle gösterilir.
            </Text>
            <View style={styles.unitOptions}>
              {availableDailyUnits.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.unitOption,
                    unit === item && styles.unitOptionActive,
                  ]}
                  onPress={() => {
                    setUnit(item);
                    setShowUnitPicker(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: unit === item }}
                >
                  <Text
                    style={[
                      styles.unitOptionText,
                      unit === item && styles.unitOptionTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                  {unit === item && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={19}
                      color={COLORS.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Field({
  label,
  half,
  children,
}: {
  label: string;
  half?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.field, half && styles.half]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}
function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}
function Meta({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.metaChip}>
      <MaterialCommunityIcons
        name={icon as never}
        size={15}
        color={COLORS.primary}
      />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}
function Detail({
  icon,
  text,
  danger,
}: {
  icon: string;
  text: string;
  danger?: boolean;
}) {
  return (
    <View style={[styles.detailRow, danger && styles.detailDanger]}>
      <MaterialCommunityIcons
        name={icon as never}
        size={16}
        color={danger ? COLORS.danger : COLORS.textSecondary}
      />
      <Text style={styles.detailText}>{text}</Text>
    </View>
  );
}
function Empty({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.emptyCard}>
      <MaterialCommunityIcons name={icon as never} size={40} color="#B8C6D8" />
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  keyboardView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 120, gap: 14 },
  dateCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  dateTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 4 },
  dateActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  todayButton: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  todayText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  calendarButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  calendarWrap: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    overflow: "hidden",
    padding: 6,
  },
  summaryStrip: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  summaryDivider: { width: 1, height: 32, backgroundColor: COLORS.borderLight },
  sectionTabs: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 4,
    gap: 4,
  },
  sectionTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  sectionTabActive: { backgroundColor: COLORS.primaryLight },
  sectionTabText: { color: COLORS.textMuted, fontSize: 13, fontWeight: "800" },
  sectionTabTextActive: { color: COLORS.primary },
  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 18,
    gap: 2,
  },
  formTitleRow: {
    flexDirection: "row",
    gap: 11,
    alignItems: "center",
    marginBottom: 16,
  },
  formIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  formTitle: { color: COLORS.text, fontSize: 17, fontWeight: "900" },
  formSubtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  formCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  field: { marginBottom: 13 },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 7,
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBg,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 14,
  },
  textArea: { minHeight: 82 },
  smallArea: { minHeight: 58 },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  chipRow: { gap: 7, paddingBottom: 13 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBg,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  unitSelector: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: COLORS.inputBg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  unitSelectorText: { fontSize: 14, color: COLORS.text, fontWeight: "700" },
  unitModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.42)",
  },
  unitModalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
  },
  unitModalHandle: {
    width: 38,
    height: 4,
    borderRadius: 4,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginBottom: 17,
  },
  unitModalTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  unitModalSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  unitOptions: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  unitOption: {
    width: "31%",
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.inputBg,
  },
  unitOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  unitOptionText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: "800" },
  unitOptionTextActive: { color: COLORS.primary },
  measurementDetailBox: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  lockedMeasurementBox: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  lockedMeasurementText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  helperText: {
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: -7,
    marginBottom: 13,
  },
  approvalBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF8E7",
    borderColor: "#F4D58D",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 9,
  },
  approvalApproved: { backgroundColor: "#ECFDF3", borderColor: "#A7E3BE" },
  approvalRejected: {
    backgroundColor: COLORS.dangerBg,
    borderColor: "#F5B8B8",
  },
  approvalTitle: { color: COLORS.text, fontSize: 12, fontWeight: "800" },
  approvalText: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  reviewActions: { flexDirection: "row", gap: 7 },
  rejectButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  approveButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  managerBox: {
    backgroundColor: "#FFF8E7",
    borderColor: "#F4D58D",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  managerLabel: {
    color: "#9A6700",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 7,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    minHeight: 50,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonDisabled: { backgroundColor: COLORS.placeholder },
  addButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  reportCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 16,
  },
  reportHeading: { flexDirection: "row", alignItems: "center", gap: 11 },
  reportIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  reportTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  reportSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  exportFormat: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 15,
    padding: 12,
    marginTop: 12,
  },
  exportFormatHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  formatIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pdfIcon: { backgroundColor: "#FDECEB" },
  excelIcon: { backgroundColor: "#E9F7EF" },
  formatCopy: { flex: 1 },
  formatTitle: { color: COLORS.text, fontSize: 14, fontWeight: "900" },
  formatDescription: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  formatActions: { flexDirection: "row", gap: 8, marginTop: 11 },
  formatSecondaryButton: {
    flex: 0.8,
    minHeight: 40,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  formatPrimaryButton: {
    flex: 1.35,
    minHeight: 40,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  excelSecondaryButton: { borderColor: "#18864B" },
  excelPrimaryButton: { backgroundColor: "#18864B" },
  reportButtonDisabled: { opacity: 0.42 },
  formatSecondaryText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  excelActionText: { color: "#18864B", fontSize: 12, fontWeight: "900" },
  formatPrimaryText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  reportFootnote: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 9,
    textAlign: "center",
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 3,
    marginTop: 4,
  },
  listTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  listSubtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  recordBadge: {
    color: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
  },
  center: { alignItems: "center", paddingVertical: 30 },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: "center",
    paddingVertical: 34,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 9,
    textAlign: "center",
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 5,
    textAlign: "center",
  },
  timelineRow: { flexDirection: "row", alignItems: "stretch" },
  timelineRail: { width: 25, alignItems: "center" },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 20,
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: COLORS.primaryLight,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 18,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  logCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 15,
    marginBottom: 10,
  },
  logTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  logType: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 3,
  },
  logArea: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: COLORS.dangerBg,
    alignItems: "center",
    justifyContent: "center",
  },
  recordActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  editButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  logText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 11,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 4 },
  metaChip: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    backgroundColor: COLORS.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  metaText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  detailRow: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: COLORS.background,
    borderRadius: 11,
    padding: 10,
    marginTop: 8,
  },
  detailDanger: { backgroundColor: COLORS.dangerBg },
  detailText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  recordAuthorBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 12,
    paddingBottom: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  recordAuthorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  recordAuthorName: { color: COLORS.text, fontSize: 12, fontWeight: "800" },
  recordAuthorRole: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
  },
  floatingAddButton: {
    position: "absolute",
    right: 18,
    bottom: 34,
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    shadowColor: "#10284A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 7,
  },
  floatingAddText: { color: "#fff", fontSize: 14, fontWeight: "900" },
});
