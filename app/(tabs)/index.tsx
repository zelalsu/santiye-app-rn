import CostGrid from "@/components/CostGrid";
import Header from "@/components/Header";
import SearchBar from "@/components/SearchBar";
import SummaryCard from "@/components/SummaryCard";
import { COST_ITEMS } from "@/data/CostItems";
import { auth, db } from "@/firebaseConfig";
import { canSeeCosts, canUseMeasurements, loadActiveProject } from "@/config/projectAccess";
import { ProjectRole } from "@/types/projects";
import { useLocalSearchParams } from "expo-router";
import { collection, doc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { Dimensions, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");
const COLUMN_WIDTH = (width - 48) / 2;

export default function HomeScreen() {
  const { projectId, ownerId } = useLocalSearchParams<{ projectId: string; ownerId?: string }>();
  const user = auth.currentUser;
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<ProjectRole | null>(null);
  const [activeProject, setActiveProject] = useState<{
    id: string;
    ownerId: string;
  } | null>(null);
  const [categoryTotals, setCategoryTotals] = useState<Record<string, number>>(
    {},
  );
  const [measurementCounts, setMeasurementCounts] = useState<Record<string, number>>({});
  const [contractorTotal, setContractorTotal] = useState(0);
  const [additionalExpenseTotal, setAdditionalExpenseTotal] = useState(0);

  useEffect(() => {
    loadActiveProject().then((active) => {
      setRole(active.role);
      setActiveProject({ id: active.id, ownerId: active.ownerId });
    });
  }, []);

  // Ortak şantiyede ownerId gelmeden kullanıcıya ait proje yoluna düşmek,
  // Firestore'da yanlış bir koleksiyon sorgusuna ve permission-denied'a neden
  // oluyordu. Aktif proje ile route uyuşmuyorsa sorgu başlatmıyoruz.
  const activeMatchesRoute = !projectId || activeProject?.id === projectId;
  const resolvedProjectId = projectId || activeProject?.id || "";
  const resolvedOwnerId = ownerId || (activeMatchesRoute ? activeProject?.ownerId : "");

  useEffect(() => {
    if (!user || !resolvedProjectId || !resolvedOwnerId || !role) return;

    if (!canSeeCosts(role)) {
      const visibleItems = COST_ITEMS.filter((item) => item.id !== "yevmiye");
      const unsubscribers = visibleItems.map((item) => onSnapshot(
        doc(db, "users", resolvedOwnerId, "projects", resolvedProjectId, "measurements", item.id),
        (snap) => setMeasurementCounts((current) => ({ ...current, [item.id]: snap.data()?.entries?.length ?? 0 })),
        (error) => console.error(`${item.title} metrajı yüklenemedi:`, error),
      ));
      return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
    }

    const unsubCategories = onSnapshot(
      collection(db, "users", resolvedOwnerId, "projects", resolvedProjectId, "categories"),
      (snap) => {
        const totals: Record<string, number> = {};
        snap.docs.forEach((d) => {
          totals[d.id] = d.data().total ?? 0;
        });
        setCategoryTotals(totals);
      },
      (error) => {
        if (error.code !== "permission-denied") console.error("Maliyetler yüklenemedi:", error);
      },
    );
    const unsubContractors = onSnapshot(
      collection(db, "users", resolvedOwnerId, "projects", resolvedProjectId, "contractors"),
      (snap) => setContractorTotal(snap.docs.reduce((sum, item) => sum + (item.data().contractAmount ?? 0), 0)),
      (error) => {
        if (error.code !== "permission-denied") console.error("Taşeron maliyetleri yüklenemedi:", error);
      },
    );
    const unsubDailyExpenses = onSnapshot(
      collection(db, "users", resolvedOwnerId, "projects", resolvedProjectId, "dailyLogCosts"),
      (snap) =>
        setAdditionalExpenseTotal(
          snap.docs.reduce((sum, item) => sum + (item.data().amount ?? 0), 0),
        ),
      (error) => {
        if (error.code !== "permission-denied")
          console.error("Ek harcamalar yüklenemedi:", error);
      },
    );

    return () => { unsubCategories(); unsubContractors(); unsubDailyExpenses(); };
  }, [role, resolvedProjectId, resolvedOwnerId, user]);

  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c");

  const showCosts = canSeeCosts(role ?? undefined);
  const filteredItems = useMemo(() => {
    const accessibleItems = showCosts ? COST_ITEMS : COST_ITEMS.filter((item) => item.id !== "yevmiye");
    if (!search) return accessibleItems;
    return accessibleItems.filter((item) =>
      normalize(item.title).includes(normalize(search)),
    );
  }, [search, showCosts]);

  const grandTotal =
    Object.values(categoryTotals).reduce((a, b) => a + b, 0) +
    contractorTotal +
    additionalExpenseTotal;
  if (!role || !resolvedProjectId || !resolvedOwnerId || !canUseMeasurements(role)) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <Header
        title={showCosts ? "Proje Maliyeti" : "Proje Metrajı"}
        accountIcon
        leftMenuIcon
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 50 }}
      >
        {showCosts && <SummaryCard projectId={resolvedProjectId} ownerId={resolvedOwnerId} total={grandTotal} />}
        <SearchBar value={search} onChange={setSearch} />
        <CostGrid
          items={filteredItems}
          columnWidth={COLUMN_WIDTH}
          categoryTotals={categoryTotals}
          projectId={resolvedProjectId}
          ownerId={resolvedOwnerId}
          showCosts={showCosts}
          measurementCounts={measurementCounts}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
