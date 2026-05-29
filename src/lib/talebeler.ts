import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";

export type SayfaKaydi = { t: number; sayfa: number };

export type Talebe = {
  id: string;
  isim: string;
  kiraat: boolean;
  kiraatGunler?: Record<string, number[]>;
  sayfa: number;
  hedefHaftalik: number;
  gecmis: SayfaKaydi[];
  sira?: number;
  fotoUrl?: string;
  telefon?: string;
  dogum?: string;
  notlar?: string;
};

const COL = "talebeler";

export function talebeleriDinle(
  cb: (t: Talebe[]) => void,
  onError?: (e: Error) => void,
) {
  const q = query(collection(db, COL), orderBy("sira", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const liste: Talebe[] = snap.docs.map((d) => {
        const v = d.data() as Partial<Talebe>;
        return {
          id: d.id,
          isim: v.isim ?? "Talebe",
          kiraat: !!v.kiraat,
          kiraatGunler:
            v.kiraatGunler && typeof v.kiraatGunler === "object"
              ? (v.kiraatGunler as Record<string, number[]>)
              : {},
          sayfa: typeof v.sayfa === "number" ? v.sayfa : 1,
          hedefHaftalik:
            typeof v.hedefHaftalik === "number" ? v.hedefHaftalik : 5,
          gecmis: Array.isArray(v.gecmis) ? v.gecmis : [],
          sira: typeof v.sira === "number" ? v.sira : 0,
          fotoUrl: typeof v.fotoUrl === "string" ? v.fotoUrl : undefined,
          telefon: typeof v.telefon === "string" ? v.telefon : undefined,
          dogum: typeof v.dogum === "string" ? v.dogum : undefined,
          notlar: typeof v.notlar === "string" ? v.notlar : undefined,
        };
      });
      cb(liste);
    },
    (err) => {
      console.error("Firestore dinleme hatası", err);
      onError?.(err);
    },
  );
}

export async function talebeEkle(t: Omit<Talebe, "id">) {
  const ref = await addDoc(collection(db, COL), t);
  return ref.id;
}

export async function talebeGuncelle(
  id: string,
  patch: Partial<Omit<Talebe, "id">>,
) {
  await updateDoc(doc(db, COL, id), patch as Record<string, unknown>);
}

export async function talebeSil(id: string) {
  await deleteDoc(doc(db, COL, id));
}

export async function topluHedefGuncelle(ids: string[], hedef: number) {
  const batch = writeBatch(db);
  ids.forEach((id) =>
    batch.update(doc(db, COL, id), { hedefHaftalik: hedef }),
  );
  await batch.commit();
}
