// screens/CategoryScreen.tsx
import { CategoryConfig, EntryTemplate } from "@/config/categoryConfig";
import { COLORS } from "@/constants/theme";
import { auth, db } from "@/firebaseConfig";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
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

export default function CategoryScreen({ config }: Props) {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const user = auth.currentUser;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [label, setLabel] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const unitPriceRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!user || !projectId) return;
    const catRef = doc(
      db,
      "users",
      user.uid,
      "projects",
      projectId,
      "categories",
      config.id,
    );

    const unsub = onSnapshot(catRef, (snap) => {
      if (snap.exists()) {
        setEntries(snap.data().entries ?? []);
        setTotal(snap.data().total ?? 0);
      } else {
        setEntries([]);
        setTotal(0);
      }
    });

    return unsub;
  }, [projectId, config.id]);

  // Proje toplam maliyetini güncelle
  const updateProjectTotal = async () => {
    if (!user || !projectId) return;
    const allCatsSnap = await getDocs(
      collection(db, "users", user.uid, "projects", projectId, "categories"),
    );
    const grandTotal = allCatsSnap.docs.reduce(
      (sum, d) => sum + (d.data().total ?? 0),
      0,
    );
    await updateDoc(doc(db, "users", user.uid, "projects", projectId), {
      totalCost: grandTotal,
    });
  };

  const handleSelectTemplate = (t: EntryTemplate) => {
    setLabel(t.label);
    setShowTemplates(false);
    setTimeout(() => unitPriceRef.current?.focus(), 100);
  };

  const handleAddEntry = async () => {
    const qty = parseFloat(quantity.replace(",", "."));
    const price = parseFloat(unitPrice.replace(",", "."));
    if (!qty || !price || !label.trim() || !user || !projectId) return;

    const newEntry: Entry = {
      id: uuid.v4() as string,
      label: label.trim(),
      quantity: qty,
      unit: config.unit,
      unitPrice: price,
      total: qty * price,
    };

    const updatedEntries = [...entries, newEntry];
    const newTotal = updatedEntries.reduce((sum, e) => sum + e.total, 0);

    const catRef = doc(
      db,
      "users",
      user.uid,
      "projects",
      projectId,
      "categories",
      config.id,
    );
    await setDoc(catRef, { entries: updatedEntries, total: newTotal });
    await updateProjectTotal();

    setLabel("");
    setQuantity("");
    setUnitPrice("");
  };

  const handleRemoveEntry = async (entryId: string) => {
    if (!user || !projectId) return;

    const updatedEntries = entries.filter((e) => e.id !== entryId);
    const newTotal = updatedEntries.reduce((sum, e) => sum + e.total, 0);

    const catRef = doc(
      db,
      "users",
      user.uid,
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
  };

  const previewTotal =
    quantity && unitPrice
      ? parseFloat(quantity.replace(",", ".")) *
        parseFloat(unitPrice.replace(",", "."))
      : null;

  const isFormValid = !!(label.trim() && quantity && unitPrice);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* FORM KARTI */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Yeni Kalem</Text>

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
                  {label || "Seçiniz..."}
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
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* Miktar + Birim Fiyat */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, styles.half]}>
              <Text style={styles.fieldLabel}>
                Miktar <Text style={styles.unitHint}>({config.unit})</Text>
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
            <View style={[styles.fieldGroup, styles.half]}>
              <Text style={styles.fieldLabel}>
                Birim Fiyat
                <Text style={styles.unitHint}> (₺/{config.unit})</Text>
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
          </View>

          {/* Önizleme */}
          {previewTotal !== null && !isNaN(previewTotal) && (
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
              name="plus"
              size={18}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.addBtnText}>Kalemi Ekle</Text>
          </TouchableOpacity>
        </View>

        {/* KALEM LİSTESİ BAŞLIĞI */}
        {entries.length > 0 && (
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderTitle}>
              Kalemler{" "}
              <Text style={styles.listHeaderCount}>({entries.length})</Text>
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
            <View
              key={item.id}
              style={[
                styles.entryRow,
                i === entries.length - 1 && { marginBottom: 0 },
              ]}
            >
              <View style={styles.entryIndex}>
                <Text style={styles.entryIndexText}>{i + 1}</Text>
              </View>

              <View style={styles.entryInfo}>
                <Text style={styles.entryLabel} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.entrySub}>
                  {item.quantity} {item.unit} × ₺
                  {item.unitPrice.toLocaleString("tr-TR")}
                </Text>
              </View>

              <View style={styles.entryRight}>
                <Text style={styles.entryTotal}>
                  ₺
                  {item.total.toLocaleString("tr-TR", {
                    minimumFractionDigits: 2,
                  })}
                </Text>
                <TouchableOpacity
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
          ))
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* TOPLAM BAR */}

      <TouchableOpacity onPress={() => router.back()} style={styles.totalBar}>
        <View>
          <Text style={styles.totalBarLabel}>Toplam Maliyet</Text>
          <Text style={styles.totalBarSub}>{entries.length} kalem</Text>
        </View>
        <Text style={styles.totalBarValue}>
          ₺{total.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
        </Text>
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
    marginBottom: 20,
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

  dropdownWrapper: { marginBottom: 14 },

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
