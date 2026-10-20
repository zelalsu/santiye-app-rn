import { db } from "@/firebaseConfig";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

export function useProEntitlement(ownerId?: string | null) {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) {
      setIsPro(false);
      setLoading(true);
      return;
    }

    setLoading(true);
    return onSnapshot(
      doc(db, "users", ownerId, "entitlements", "pro"),
      (snapshot) => {
        setIsPro(snapshot.data()?.active === true);
        setLoading(false);
      },
      (error) => {
        console.error("Pro üyeliği alınamadı:", error);
        setIsPro(false);
        setLoading(false);
      },
    );
  }, [ownerId]);

  return { isPro, loading };
}
