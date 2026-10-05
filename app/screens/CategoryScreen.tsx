// screens/CategoryScreen.tsx
import { CategoryConfig, EntryTemplate, UnitType } from "@/config/categoryConfig";
import { recalculateProjectTotal } from "@/config/projectCosts";
import { COLORS } from "@/constants/theme";
import { auth, db } from "@/firebaseConfig";
import { canSeeCosts, canUseMeasurements, loadActiveProject } from "@/config/projectAccess";
import { ProjectRole } from "@/types/projects";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import uuid from "react-native-uuid";

interface Entry {
  id: string;
  label: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

interface Props {
  config: CategoryConfig;
}

const normalizeLabel = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ø/g, "")
    .replace(/\b(lik|lık|luk|lük)\b/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

export default function CategoryScreen({ config }: Props) {
  const { projectId, ownerId } = useLocalSearchParams<{ projectId: string; ownerId?: string }>();
  const user = auth.currentUser;
  const projectOwnerId = ownerId ?? user?.uid ?? "";

  const [measurementEntries, setMeasurementEntries] = useState<Entry[]>([]);
  const [pricingEntries, setPricingEntries] = useState<Entry[]>([]);
  const [role, setRole] = useState<ProjectRole | null>(null);
  const [total, setTotal] = useState(0);
  const [label, setLabel] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState(config.unit);
  const [unitPrice, setUnitPrice] = useState("");
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isCustomLabel, setIsCustomLabel] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const customLabelRef = useRef<TextInput>(null);
  const unitPriceRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const availableUnits: UnitType[] = config.units ?? [config.unit];
  const canChooseUnit = availableUnits.length > 1;

  useEffect(() => {
    loadActiveProject().then((active) => {
      const allowed = canUseMeasurements(active.role) && (config.id !== "yevmiye" || canSeeCosts(active.role));
      setRole(active.role);
      if (!allowed) router.replace("/projects");
    });
  }, [config.id]);

  useEffect(() => {
    if (!user || !projectId || !role || (config.id === "yevmiye" && !canSeeCosts(role))) return;
    const measurementRef = doc(
      db,
      "users",
      projectOwnerId,
      "projects",
      projectId,
      "measurements",
      config.id,
    );
    const unsubMeasurements = onSnapshot(
      measurementRef,
      (snap) => {
        setMeasurementEntries((snap.data()?.entries ?? []).map((entry: Entry) => ({ ...entry, unitPrice: 0, total: 0 })));
      },
      (error) => console.error(`${config.title} metrajı yüklenemedi:`, error),
    );

    if (!canSeeCosts(role ?? undefined)) return unsubMeasurements;

    const pricingRef = doc(db, "users", projectOwnerId, "projects", projectId, "categories", config.id);
    const unsubPricing = onSnapshot(
      pricingRef,
      (snap) => {
        const priced = snap.data()?.entries ?? [];
        setPricingEntries(priced);
        setTotal(snap.data()?.total ?? 0);
      },
      (error) => console.error(`${config.title} fiyatları yüklenemedi:`, error),
    );

    return () => { unsubMeasurements(); unsubPricing(); };
  }, [projectId, config.id, config.title, projectOwnerId, role, user]);

  const entries = useMemo(() => {
    const source = canSeeCosts(role ?? undefined)
      ? [
          ...pricingEntries.filter(
            (priced) => !measurementEntries.some((measurement) => measurement.id === priced.id),
          ),
          ...measurementEntries,
        ]
      : measurementEntries;
    return source.map((measurement) => {
      const priced = pricingEntries.find((entry) => entry.id === measurement.id);
      const unitPrice = canSeeCosts(role ?? undefined) ? priced?.unitPrice ?? 0 : 0;
      return { ...measurement, unitPrice, total: measurement.quantity * unitPrice };
    });
  }, [measurementEntries, pricingEntries, role]);

  // Proje toplam maliyetini güncelle
  const updateProjectTotal = async () => {
    if (!user || !projectId) return;
    await recalculateProjectTotal(projectOwnerId, projectId);
  };

  const handleSelectTemplate = (t: EntryTemplate) => {
    setLabel(t.label);
    setIsCustomLabel(false);
    setShowTemplates(false);
    setTimeout(() => unitPriceRef.current?.focus(), 100);
  };

  const handleSelectCustomLabel = () => {
    setLabel("");
    setIsCustomLabel(true);
    setShowTemplates(false);
    setTimeout(() => customLabelRef.current?.focus(), 100);
  };

  const resetForm = () => {
    setLabel("");
    setIsCustomLabel(false);
    setQuantity("");
    setUnit(config.unit);
    setUnitPrice("");
    setEditingEntryId(null);
    setShowTemplates(false);
  };

  const handleAddEntry = async () => {
    const qty = parseFloat(quantity.replace(",", "."));
    const price = parseFloat(unitPrice.replace(",", "."));
    const showCosts = canSeeCosts(role ?? undefined);
    if (!qty || (showCosts && !price) || !label.trim() || !user || !projectId) return;

    const newEntry: Entry = {
      id: editingEntryId ?? (uuid.v4() as string),
      label: label.trim(),
      quantity: qty,
      unit,
      unitPrice: showCosts ? price : 0,
      total: showCosts ? qty * price : 0,
    };

    const updatedEntries = editingEntryId
      ? entries.map((entry) =>
          entry.id === editingEntryId ? newEntry : entry,
        )
      : [...entries, newEntry];
    const measurementPayload = updatedEntries.map(({ id, label, quantity, unit }) => ({ id, label, quantity, unit }));

    try {
      await setDoc(doc(db, "users", projectOwnerId, "projects", projectId, "measurements", config.id), {
        entries: measurementPayload,
      });

      if (!showCosts) {
        resetForm();
        return;
      }

      const newTotal = updatedEntries.reduce((sum, e) => sum + e.total, 0);

      const catRef = doc(
        db,
        "users",
        projectOwnerId,
        "projects",
        projectId,
        "categories",
        config.id,
      );
      await setDoc(catRef, { entries: updatedEntries, total: newTotal });
      await updateProjectTotal();

      resetForm();
    } catch (error) {
      console.error(`${config.title} kaydedilemedi:`, error);
      Alert.alert(
        editingEntryId ? "Kalem güncellenemedi" : "Kalem eklenemedi",
        "Bilgileriniz formda korundu. Bağlantınızı kontrol edip tekrar deneyin.",
      );
    }
  };

  const handleEditEntry = (entry: Entry) => {
    const normalizedEntry = normalizeLabel(entry.label);
    const matchingTemplate = config.templates?.find((template) => {
      const normalizedTemplate = normalizeLabel(template.label);
      if (normalizedTemplate === normalizedEntry) return true;
      if (config.id !== "demir") return false;
      const entryDiameter = entry.label.match(/\d+/)?.[0];
      const templateDiameter = template.label.match(/\d+/)?.[0];
      return (
        !!entryDiameter &&
        entryDiameter === templateDiameter &&
        normalizedEntry.includes("insaatdemiri") &&
        normalizedTemplate.includes("insaatdemiri")
      );
    });
    setEditingEntryId(entry.id);
    setLabel(matchingTemplate?.label ?? entry.label);
    setIsCustomLabel(!matchingTemplate);
    setQuantity(String(entry.quantity).replace(".", ","));
    setUnit((entry.unit as UnitType) || config.unit);
    setUnitPrice(String(entry.unitPrice).replace(".", ","));
    setShowTemplates(false);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 50);
  };

  const handleRemoveEntry = async (entryId: string) => {
    if (!user || !projectId) return;

    try {
      const updatedEntries = entries.filter((e) => e.id !== entryId);
      const measurementRef = doc(db, "users", projectOwnerId, "projects", projectId, "measurements", config.id);
      if (updatedEntries.length === 0) await deleteDoc(measurementRef);
      else await setDoc(measurementRef, { entries: updatedEntries.map(({ id, label, quantity, unit }) => ({ id, label, quantity, unit })) });

      if (!canSeeCosts(role ?? undefined)) return;

      const newTotal = updatedEntries.reduce((sum, e) => sum + e.total, 0);

      const catRef = doc(
        db,
        "users",
        projectOwnerId,
        "projects",
        projectId,
        "categories",
        config.id,
      );

      if (updatedEntries.length === 0) {
        // Son kalem silindiyse kategoriyi tamamen kaldır
        await deleteDoc(catRef);
      } else {
        await setDoc(catRef, { entries: updatedEntries, total: newTotal });
      }

      await updateProjectTotal();
    } catch (error) {
      console.error(`${config.title} silinemedi:`, error);
      Alert.alert("Kalem silinemedi", "Lütfen tekrar deneyin.");
    }
  };

  const previewTotal =
    quantity && unitPrice
      ? parseFloat(quantity.replace(",", ".")) *
        parseFloat(unitPrice.replace(",", "."))
      : null;

  const isFormValid = !!(label.trim() && quantity && (canSeeCosts(role ?? undefined) ? unitPrice : true));

  if (!role || !canUseMeasurements(role) || (config.id === "yevmiye" && !canSeeCosts(role))) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* FORM KARTI */}
        <View style={styles.formCard}>
          <View style={styles.formTitleRow}>
            <Text style={styles.formTitle}>
              {editingEntryId ? "Kalemi Düzenle" : "Yeni Kalem"}
            </Text>
            {editingEntryId && (
              <TouchableOpacity onPress={resetForm} hitSlop={8}>
                <Text style={styles.cancelEditText}>Vazgeç</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Dropdown */}
          {config.templates && config.templates.length > 0 && (
            <View style={styles.dropdownWrapper}>
              <Text style={styles.fieldLabel}>Türü</Text>
              <TouchableOpacity
                style={[
                  styles.dropdownBtn,
                  showTemplates && styles.dropdownBtnOpen,
                ]}
                onPress={() => setShowTemplates((v) => !v)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dropdownBtnText,
                    !label && styles.dropdownPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {label || (isCustomLabel ? "Diğer" : "Seçiniz...")}
                </Text>
                <MaterialCommunityIcons
                  name={showTemplates ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={showTemplates ? "#4184F3" : "#999"}
                />
              </TouchableOpacity>

              {showTemplates && (
                <View style={styles.dropdownList}>
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                    style={{ maxHeight: 220 }}
                  >
                    {config.templates.map((t, i) => {
                      const isSelected = label === t.label;
                      return (
                        <TouchableOpacity
                          key={t.label}
                          style={[
                            styles.dropdownItem,
                            i < config.templates!.length - 1 &&
                              styles.dropdownItemBorder,
                            isSelected && styles.dropdownItemActive,
                          ]}
                          onPress={() => handleSelectTemplate(t)}
                          activeOpacity={0.6}
                        >
                          <Text
                            style={[
                              styles.dropdownItemText,
                              isSelected && styles.dropdownItemTextActive,
                            ]}
                          >
                            {t.label}
                          </Text>
                          {isSelected && (
                            <View style={styles.checkBadge}>
                              <MaterialCommunityIcons
                                name="check"
                                size={12}
                                color="#fff"
                              />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      style={[
                        styles.dropdownItem,
                        isCustomLabel && styles.dropdownItemActive,
                      ]}
                      onPress={handleSelectCustomLabel}
                      activeOpacity={0.6}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          isCustomLabel && styles.dropdownItemTextActive,
                        ]}
                      >
                        Diğer
                      </Text>
                      {isCustomLabel && (
                        <View style={styles.checkBadge}>
                          <MaterialCommunityIcons
                            name="check"
                            size={12}
                            color="#fff"
                          />
                        </View>
                      )}
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              )}

              {isCustomLabel && (
                <View style={styles.customLabelGroup}>
                  <Text style={styles.fieldLabel}>Açıklama</Text>
                  <TextInput
                    ref={customLabelRef}
                    style={styles.input}
                    placeholder="Örn. Hafriyat işçisi yevmiyesi"
                    placeholderTextColor="#C0C0C0"
                    value={label}
                    onChangeText={setLabel}
                    returnKeyType="next"
                    onSubmitEditing={() => unitPriceRef.current?.focus()}
                  />
                </View>
              )}
            </View>
          )}

          {/* Miktar + Birim Fiyat */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, styles.half]}>
              <Text style={styles.fieldLabel}>
                Miktar <Text style={styles.unitHint}>({unit})</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor="#C0C0C0"
                keyboardType="decimal-pad"
                value={quantity}
                onChangeText={(text) =>
                  setQuantity(text.replace(/[^0-9.,]/g, ""))
                }
              />
            </View>
            {canChooseUnit && (
              <View style={[styles.fieldGroup, styles.half]}>
                <Text style={styles.fieldLabel}>Birim</Text>
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
              </View>
            )}
            {canSeeCosts(role) && !canChooseUnit && <View style={[styles.fieldGroup, styles.half]}>
              <Text style={styles.fieldLabel}>
                Birim Fiyat
                <Text style={styles.unitHint}> (₺/{unit})</Text>
              </Text>
              <TextInput
                ref={unitPriceRef}
                style={styles.input}
                placeholder="0,00"
                placeholderTextColor="#C0C0C0"
                keyboardType="decimal-pad"
                value={unitPrice}
                onChangeText={(text) =>
                  setUnitPrice(text.replace(/[^0-9.,]/g, ""))
                }
              />
            </View>}
          </View>
          {canSeeCosts(role) && canChooseUnit && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Birim Fiyat <Text style={styles.unitHint}> (₺/{unit})</Text>
              </Text>
              <TextInput
                ref={unitPriceRef}
                style={styles.input}
                placeholder="0,00"
                placeholderTextColor="#C0C0C0"
                keyboardType="decimal-pad"
                value={unitPrice}
                onChangeText={(text) =>
                  setUnitPrice(text.replace(/[^0-9.,]/g, ""))
                }
              />
            </View>
          )}

          {/* Önizleme */}
          {canSeeCosts(role) && previewTotal !== null && !isNaN(previewTotal) && (
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Hesaplanan tutar</Text>
              <Text style={styles.previewValue}>
                ₺
                {previewTotal.toLocaleString("tr-TR", {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>
          )}

          {/* Ekle Butonu */}
          <TouchableOpacity
            style={[styles.addBtn, !isFormValid && styles.addBtnDisabled]}
            onPress={handleAddEntry}
            activeOpacity={0.85}
            disabled={!isFormValid}
          >
            <MaterialCommunityIcons
              name={editingEntryId ? "content-save-outline" : "plus"}
              size={18}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.addBtnText}>
              {editingEntryId ? "Değişiklikleri Kaydet" : "Kalemi Ekle"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* KALEM LİSTESİ BAŞLIĞI */}
        {entries.length > 0 && (
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderTitle}>
              Kalemler{" "}
              <Text style={styles.listHeaderCount}>({entries.length})</Text>
            </Text>
            <Text style={styles.listEditHint}>
              Düzenlemek için bir kaleme dokunun
            </Text>
          </View>
        )}

        {/* KALEM LİSTESİ */}
        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="clipboard-text-outline"
              size={40}
              color="#DDD"
            />
            <Text style={styles.emptyTitle}>Henüz kalem eklenmedi</Text>
            <Text style={styles.emptySubtitle}>
              Yukarıdaki formu doldurarak başlayın
            </Text>
          </View>
        ) : (
          entries.map((item, i) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.entryRow,
                i === entries.length - 1 && { marginBottom: 0 },
              ]}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`${item.label} kalemini düzenle`}
              onPress={() => handleEditEntry(item)}
            >
              <View style={styles.entryIndex}>
                <Text style={styles.entryIndexText}>{i + 1}</Text>
              </View>

              <View style={styles.entryInfo}>
                <Text style={styles.entryLabel} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.entrySub}>
                  {item.quantity} {item.unit}
                  {canSeeCosts(role) ? ` × ₺${item.unitPrice.toLocaleString("tr-TR")}` : " • Metraj"}
                </Text>
              </View>

              <View style={styles.entryRight}>
                {canSeeCosts(role) && <Text style={styles.entryTotal}>
                  ₺
                  {item.total.toLocaleString("tr-TR", {
                    minimumFractionDigits: 2,
                  })}
                </Text>}
                <View style={styles.entryActions}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`${item.label} kalemini sil`}
                    style={styles.deleteBtn}
                    onPress={() => handleRemoveEntry(item.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons
                      name="trash-can-outline"
                      size={17}
                      color="#E24B4A"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

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
            <Text style={styles.unitModalTitle}>{config.title} birimini seç</Text>
            <Text style={styles.unitModalSubtitle}>
              Fiyat ve miktar aynı birim üzerinden hesaplanır.
            </Text>
            {availableUnits.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.unitOption, unit === item && styles.unitOptionActive]}
                onPress={() => {
                  setUnit(item);
                  setShowUnitPicker(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: unit === item }}
              >
                <Text style={[styles.unitOptionText, unit === item && styles.unitOptionTextActive]}>
                  {item}
                </Text>
                {unit === item && (
                  <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* TOPLAM BAR */}

      <TouchableOpacity onPress={() => router.back()} style={styles.totalBar}>
        <View>
          <Text style={styles.totalBarLabel}>{canSeeCosts(role) ? "Toplam Maliyet" : "Toplam Metraj Kalemi"}</Text>
          <Text style={styles.totalBarSub}>{entries.length} kalem</Text>
        </View>
        {canSeeCosts(role) ? <Text style={styles.totalBarValue}>
          ₺{total.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
        </Text> : <Text style={styles.totalBarValue}>{entries.length}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  scrollContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },

  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
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

  formTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
  },

  formTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  cancelEditText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: "700",
  },

  fieldGroup: { marginBottom: 14 },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },

  unitHint: {
    fontWeight: "400",
    textTransform: "none",
    color: COLORS.textMuted,
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

  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  unitSelector: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: COLORS.inputBg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  unitSelectorText: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
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
  unitOption: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    paddingHorizontal: 15,
    marginBottom: 9,
    backgroundColor: COLORS.inputBg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  unitOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  unitOptionText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: "800" },
  unitOptionTextActive: { color: COLORS.primary },

  dropdownWrapper: { marginBottom: 14 },

  customLabelGroup: {
    marginTop: 12,
  },

  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.inputBg,
  },

  dropdownBtnOpen: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },

  dropdownBtnText: {
    fontSize: 15,
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },

  dropdownPlaceholder: {
    color: COLORS.placeholder,
  },

  dropdownList: {
    marginTop: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: COLORS.text,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },

  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },

  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },

  dropdownItemActive: {
    backgroundColor: COLORS.primaryLight,
  },

  dropdownItemText: {
    fontSize: 14,
    color: COLORS.text,
  },

  dropdownItemTextActive: {
    color: COLORS.primary,
    fontWeight: "600",
  },

  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },

  previewLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginRight: 10,
  },

  previewValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.primary,
    flexShrink: 1,
  },

  addBtn: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  addBtnDisabled: {
    backgroundColor: COLORS.placeholder,
  },

  addBtnText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 15,
  },

  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 4,
  },

  listHeaderTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },

  listHeaderCount: {
    color: COLORS.textMuted,
  },
  listEditHint: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },

  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textMuted,
  },

  emptySubtitle: {
    fontSize: 13,
    color: COLORS.border,
  },

  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.text,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
    }),
  },

  entryIndex: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  entryIndexText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },

  entryInfo: { flex: 1 },

  entryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },

  entrySub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  entryRight: {
    alignItems: "flex-end",
    gap: 6,
    flexShrink: 0,
    maxWidth: 120,
  },

  entryTotal: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },

  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.dangerBg,
    alignItems: "center",
    justifyContent: "center",
  },

  entryActions: { flexDirection: "row", gap: 6 },

  totalBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 18,
    paddingBottom: Platform.OS === "ios" ? 30 : 18,
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  totalBarLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.white,
    marginRight: 10,
  },

  totalBarSub: {
    fontSize: 12,
    color: COLORS.placeholder,
    marginTop: 2,
  },

  totalBarValue: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.white,
    flexShrink: 1,
  },
});
