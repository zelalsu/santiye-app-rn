import { db } from "@/firebaseConfig";
import {
  collection,
  doc,
  DocumentData,
  getDocs,
  QuerySnapshot,
  updateDoc,
} from "firebase/firestore";

export interface ProjectCostBreakdown {
  measurementTotal: number;
  contractorTotal: number;
  additionalExpenseTotal: number;
  total: number;
}

const sumField = (
  snapshot: QuerySnapshot<DocumentData>,
  field: string,
) =>
  snapshot.docs.reduce(
    (sum, item) => sum + (Number(item.data()[field]) || 0),
    0,
  );

export async function getProjectCostBreakdown(
  ownerId: string,
  projectId: string,
): Promise<ProjectCostBreakdown> {
  const projectRef = doc(db, "users", ownerId, "projects", projectId);
  const [categories, contractors, dailyExpenses] = await Promise.allSettled([
    getDocs(collection(projectRef, "categories")),
    getDocs(collection(projectRef, "contractors")),
    getDocs(collection(projectRef, "dailyLogCosts")),
  ]);
  // Hesap ekranı bir koleksiyondaki geçici erişim/bağlantı sorunu yüzünden
  // günlük veya metraj kaydını başarısız göstermemeli. Yeni kurallarda üçü de
  // yöneticinin okumasına açıktır; bu koruma eski veri ve ağ geçişleri içindir.
  const measurementTotal =
    categories.status === "fulfilled" ? sumField(categories.value, "total") : 0;
  const contractorTotal =
    contractors.status === "fulfilled"
      ? sumField(contractors.value, "contractAmount")
      : 0;
  const additionalExpenseTotal =
    dailyExpenses.status === "fulfilled"
      ? sumField(dailyExpenses.value, "amount")
      : 0;

  return {
    measurementTotal,
    contractorTotal,
    additionalExpenseTotal,
    total: measurementTotal + contractorTotal + additionalExpenseTotal,
  };
}

export async function recalculateProjectTotal(
  ownerId: string,
  projectId: string,
) {
  const breakdown = await getProjectCostBreakdown(ownerId, projectId);
  await updateDoc(doc(db, "users", ownerId, "projects", projectId), {
    totalCost: breakdown.total,
  });
  return breakdown;
}
