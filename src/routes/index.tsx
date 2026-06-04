import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GraduationCap,
  Lock,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  Check,
  X,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Loader2,
  Camera,
  Phone,
  StickyNote,
  User as UserIcon,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  talebeleriDinle,
  talebeEkle,
  talebeGuncelle,
  talebeSil,
  topluHedefGuncelle,
  type Talebe,
  type SayfaKaydi,
} from "@/lib/talebeler";
import { dosyaFotoDataUrl, bashHarfler } from "@/lib/foto";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Talebe Takip — Hocaefendi Paneli" },
      {
        name: "description",
        content:
          "Talebelerin kıraat ve Kur'an-ı Kerim ilerlemesini takip edin.",
      },
    ],
  }),
  component: Index,
});

// (Talebe / SayfaKaydi tipleri ve veri katmanı '@/lib/talebeler' içindedir)

const SAYFA_BASINA_CUZ = 20;
const HOCA_OTURUM_KEY = "talebe-takip-hoca-oturum";
const HOCA_AD_KEY = "talebe-takip-hoca-ad";
const TALEBE_CACHE_KEY = "talebe-takip-cache-v1";
const HOCA_PAROLA_KEY = "talebe-takip-hoca-parola";
const VARSAYILAN_PAROLA = "siec099852";

function mevcutParola(): string {
  try {
    const kayitli = localStorage.getItem(HOCA_PAROLA_KEY);
    // Eski parolayı temizle, herkes yeni varsayılan ile girebilsin
    if (kayitli && kayitli !== VARSAYILAN_PAROLA) {
      localStorage.removeItem(HOCA_PAROLA_KEY);
      return VARSAYILAN_PAROLA;
    }
    return kayitli || VARSAYILAN_PAROLA;
  } catch {
    return VARSAYILAN_PAROLA;
  }
}

function cuzHesapla(sayfa: number) {
  if (sayfa < 1) return 1;
  if (sayfa > 604) return 30;
  return Math.min(30, Math.floor((sayfa - 1) / SAYFA_BASINA_CUZ) + 1);
}

function gunBaslangici(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

// Pazartesi başlangıçlı hafta
function haftaBaslangici(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const gun = (x.getDay() + 6) % 7; // Pzt=0
  x.setDate(x.getDate() - gun);
  return x.getTime();
}

function sayfaOnceFn(t: Talebe, esik: number) {
  const oncekiler = t.gecmis.filter((g) => g.t < esik);
  return oncekiler.length > 0
    ? oncekiler[oncekiler.length - 1].sayfa
    : t.gecmis[0]?.sayfa ?? t.sayfa;
}

function ilerleme(t: Talebe, baslangic: number, bitis: number) {
  const baz = sayfaOnceFn(t, baslangic);
  const son = sayfaOnceFn(t, bitis);
  return Math.max(0, son - baz);
}

function haftaBazSayfa(t: Talebe, baslangic: number) {
  return sayfaOnceFn(t, baslangic);
}

function haftaEtiket(baslangic: number) {
  const b = new Date(baslangic);
  const s = new Date(baslangic + 6 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
  return `${fmt(b)} – ${fmt(s)}`;
}

const GUN_KISA = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Pzr"] as const;
const GUN_UZUN = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
] as const;

function bugununGunu(): number {
  return (new Date().getDay() + 6) % 7; // Pzt=0
}

function getKiraatGunler(t: Talebe, haftaBas: number): number[] {
  const k = t.kiraatGunler?.[String(haftaBas)];
  return Array.isArray(k) ? [...k].sort((a, b) => a - b) : [];
}

function toggleGun(mevcut: number[], gun: number): number[] {
  return mevcut.includes(gun)
    ? mevcut.filter((g) => g !== gun)
    : [...mevcut, gun].sort((a, b) => a - b);
}

function Index() {
  const [hoca, setHoca] = useState("Hocaefendi");
  const [talebeler, setTalebeler] = useState<Talebe[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(TALEBE_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Talebe[]) : [];
    } catch {
      return [];
    }
  });
  const [yuklendi, setYuklendi] = useState(false);
  const [yuklemeHata, setYuklemeHata] = useState<string | null>(null);

  const [hocaModu, setHocaModu] = useState(false);
  const [girisAcik, setGirisAcik] = useState(false);
  const [parolaTaslak, setParolaTaslak] = useState("");
  const [parolaHata, setParolaHata] = useState<string | null>(null);

  const [duzenlenen, setDuzenlenen] = useState<Talebe | null>(null);
  const [profilGoster, setProfilGoster] = useState<Talebe | null>(null);
  const [hocaDuzenle, setHocaDuzenle] = useState(false);
  const [hocaTaslak, setHocaTaslak] = useState(hoca);
  const [seciliHafta, setSeciliHafta] = useState<number>(() => haftaBaslastik());
  const [seciliGun, setSeciliGun] = useState<number>(() => bugununGunu());

  const [parolaDegistirAcik, setParolaDegistirAcik] = useState(false);
  const [eskiParola, setEskiParola] = useState("");
  const [yeniParola, setYeniParola] = useState("");
  const [yeniParolaTekrar, setYeniParolaTekrar] = useState("");
  const [parolaDegistirHata, setParolaDegistirHata] = useState<string | null>(null);

  const [vermediAcik, setVermediAcik] = useState(false);
  const [raporAcik, setRaporAcik] = useState(false);

  function haftaBaslastik() {
    return haftaBaslangici();
  }

  const HAFTA_MS = 7 * 24 * 60 * 60 * 1000;
  const buHafta = haftaBaslangici();
  const haftaSonu = seciliHafta + HAFTA_MS;
  const haftaFarki = Math.round((seciliHafta - buHafta) / HAFTA_MS);
  const haftaBasligi =
    haftaFarki === 0
      ? "Bu hafta"
      : haftaFarki === -1
        ? "Geçen hafta"
        : haftaFarki === 1
          ? "Gelecek hafta"
          : haftaFarki < 0
            ? `${-haftaFarki} hafta önce`
            : `${haftaFarki} hafta sonra`;

  // Yerel UI tercihleri (hoca adı + oturum) localStorage'da kalır
  useEffect(() => {
    try {
      const ad = localStorage.getItem(HOCA_AD_KEY);
      if (ad) setHoca(ad);
      if (sessionStorage.getItem(HOCA_OTURUM_KEY) === "1") setHocaModu(true);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HOCA_AD_KEY, hoca);
    } catch {}
  }, [hoca]);

  // Firestore canlı veri
  useEffect(() => {
    const unsub = talebeleriDinle(
      (liste) => {
        setTalebeler(liste);
        setYuklendi(true);
        try {
          localStorage.setItem(TALEBE_CACHE_KEY, JSON.stringify(liste));
        } catch {}
      },
      (e) => {
        setYuklemeHata(e.message);
        setYuklendi(true);
      },
    );
    return () => unsub();
  }, []);

  const guncelle = (id: string, alan: Partial<Talebe>) => {
    const mevcut = talebeler.find((t) => t.id === id);
    if (!mevcut) return;
    const patch: Partial<Talebe> = { ...alan };
    if (alan.sayfa !== undefined && alan.sayfa !== mevcut.sayfa) {
      patch.gecmis = [
        ...mevcut.gecmis,
        { t: Date.now(), sayfa: alan.sayfa },
      ];
    }
    void talebeGuncelle(id, patch);
  };

  const sil = (id: string) => {
    void talebeSil(id);
  };

  const kiraatGunToggle = (t: Talebe, gun: number) => {
    const key = String(seciliHafta);
    const mevcut = getKiraatGunler(t, seciliHafta);
    const yeni = toggleGun(mevcut, gun);
    const harita = { ...(t.kiraatGunler ?? {}), [key]: yeni };
    void talebeGuncelle(t.id, {
      kiraatGunler: harita,
      kiraat: yeni.length > 0,
    });
  };

  const ekle = () => {
    const yeniNo = talebeler.length + 1;
    const enBuyukSira = talebeler.reduce(
      (m, t) => Math.max(m, t.sira ?? 0),
      0,
    );
    void talebeEkle({
      isim: `Talebe ${yeniNo}`,
      kiraat: false,
      sayfa: 1,
      hedefHaftalik: 5,
      gecmis: [{ t: Date.now(), sayfa: 1 }],
      sira: enBuyukSira + 1,
    });
  };

  const haftalikToplam = useMemo(
    () =>
      talebeler.reduce(
        (acc, t) => acc + ilerleme(t, seciliHafta, haftaSonu),
        0,
      ),
    [talebeler, seciliHafta, haftaSonu],
  );

  const ozet = useMemo(() => {
    const toplam = talebeler.length;
    const kiraatSayi = talebeler.filter(
      (t) => getKiraatGunler(t, seciliHafta).includes(seciliGun),
    ).length;
    return { toplam, kiraatSayi };
  }, [talebeler, seciliHafta, seciliGun]);

  const [topluHedefTaslak, setTopluHedefTaslak] = useState("5");
  const [topluHedefHata, setTopluHedefHata] = useState<string | null>(null);

  const topluHedefUygula = () => {
    const d = topluHedefTaslak.trim();
    if (!/^\d+$/.test(d)) {
      setTopluHedefHata("Yalnızca rakam giriniz");
      return;
    }
    const n = Number(d);
    if (n < 0 || n > 200) {
      setTopluHedefHata("0 ile 200 arasında olmalı");
      return;
    }
    setTopluHedefHata(null);
    void topluHedefGuncelle(
      talebeler.map((t) => t.id),
      n,
    );
  };

  const girisYap = () => {
    if (parolaTaslak === mevcutParola()) {
      setHocaModu(true);
      sessionStorage.setItem(HOCA_OTURUM_KEY, "1");
      setGirisAcik(false);
      setParolaTaslak("");
      setParolaHata(null);
    } else {
      setParolaHata("Parola hatalı");
    }
  };

  const cikisYap = () => {
    setHocaModu(false);
    sessionStorage.removeItem(HOCA_OTURUM_KEY);
  };

  const parolaDegistir = () => {
    if (eskiParola !== mevcutParola()) {
      setParolaDegistirHata("Mevcut parola hatalı");
      return;
    }
    if (yeniParola.length < 3) {
      setParolaDegistirHata("Yeni parola en az 3 karakter olmalı");
      return;
    }
    if (yeniParola !== yeniParolaTekrar) {
      setParolaDegistirHata("Yeni parolalar eşleşmiyor");
      return;
    }
    try {
      localStorage.setItem(HOCA_PAROLA_KEY, yeniParola);
    } catch {}
    setParolaDegistirAcik(false);
    setEskiParola("");
    setYeniParola("");
    setYeniParolaTekrar("");
    setParolaDegistirHata(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-2 py-4 sm:px-6 sm:py-12">
        <header className="mb-6 flex flex-col items-center gap-3 text-center sm:mb-12 sm:gap-5">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary sm:h-20 sm:w-20">
            <GraduationCap className="h-7 w-7 sm:h-10 sm:w-10" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-6xl">
              SİEC DESSİE KURSU
            </h1>
            <p className="mt-2 text-base text-muted-foreground sm:text-xl">
              Talebe Başarı Paneli
            </p>
          </div>
        </header>

        <Card className="mb-6 border-accent/40 bg-secondary/40">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Hocaefendi
              </span>
              {hocaModu && hocaDuzenle ? (
                <>
                  <Input
                    autoFocus
                    value={hocaTaslak}
                    onChange={(e) => setHocaTaslak(e.target.value.slice(0, 60))}
                    className="h-9 w-48"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      setHoca(hocaTaslak.trim() || "Hocaefendi");
                      setHocaDuzenle(false);
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setHocaDuzenle(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-base font-medium text-foreground">
                    {hoca}
                  </span>
                  {hocaModu && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        setHocaTaslak(hoca);
                        setHocaDuzenle(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {hocaModu ? (
                <>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    Düzenleme modu
                  </span>
              <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEskiParola("");
                      setYeniParola("");
                      setYeniParolaTekrar("");
                      setParolaDegistirHata(null);
                      setParolaDegistirAcik(true);
                    }}
                  >
                    Parola
                  </Button>
                  <Button size="sm" variant="outline" onClick={cikisYap}>
                    <LogOut className="h-4 w-4" /> Çıkış
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setGirisAcik(true)}
                >
                  <Lock className="h-4 w-4" /> Hocaefendi Girişi
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <OzetKart etiket="Toplam Talebe" deger={ozet.toplam} />
          <OzetKart
            etiket={`Ders (${GUN_UZUN[seciliGun]})`}
            deger={`${ozet.kiraatSayi}/${ozet.toplam}`}
            onClick={() => setVermediAcik(true)}
          />
        </div>

        <div className="mb-6 flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setRaporAcik(true)}>
            <CalendarDays className="h-4 w-4" /> Haftanın Raporu
          </Button>
        </div>

        {hocaModu && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-secondary/30 px-3 py-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Toplu hedef
            </span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={200}
              value={topluHedefTaslak}
              onChange={(e) => {
                setTopluHedefTaslak(e.target.value);
                setTopluHedefHata(null);
              }}
              className="h-8 w-24"
              aria-invalid={topluHedefHata ? true : undefined}
            />
            <span className="text-xs text-muted-foreground">sf / hafta</span>
            <Button size="sm" onClick={topluHedefUygula}>
              Tümüne uygula
            </Button>
            {topluHedefHata && (
              <span className="text-xs text-destructive">{topluHedefHata}</span>
            )}
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-secondary/30 px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground">{haftaBasligi}</span>
            <span className="text-muted-foreground">·</span>
            <span className="tabular-nums text-muted-foreground">
              {haftaEtiket(seciliHafta)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setSeciliHafta((h) => h - HAFTA_MS)}
              aria-label="Önceki hafta"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSeciliHafta(haftaBaslangici())}
              disabled={haftaFarki === 0}
            >
              Bu hafta
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setSeciliHafta((h) => h + HAFTA_MS)}
              aria-label="Sonraki hafta"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-8 px-1 text-center text-xs sm:w-12 sm:px-4">#</TableHead>
                  <TableHead className="px-1.5 text-sm sm:px-4">Talebe</TableHead>
                  <TableHead className="px-1 text-center sm:px-4">
                    <Select
                      value={String(seciliGun)}
                      onValueChange={(v) => setSeciliGun(Number(v))}
                    >
                      <SelectTrigger className="mx-auto h-8 w-[100px] px-2 text-xs sm:w-[130px] sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GUN_UZUN.map((isim, i) => (
                          <SelectItem key={i} value={String(i)} className="text-sm">
                            Ders · {isim}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead className="px-2 pr-3 text-center text-xs sm:px-4 sm:text-sm">Sf</TableHead>
                  <TableHead className="px-2 pl-3 text-center text-xs sm:px-4 sm:text-sm">Cüz</TableHead>
                  <TableHead className="px-1 text-center text-xs sm:px-4 sm:text-sm">Hedef</TableHead>
                  {hocaModu && (
                    <TableHead className="w-14 px-1 text-right text-xs sm:w-24 sm:px-4 sm:text-sm">İşlem</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {talebeler.map((t, i) => {
                  const hafta = ilerleme(t, seciliHafta, haftaSonu);
                  return (
                  <TableRow key={t.id} className="hover:bg-muted/30">
                    <TableCell className="px-1 py-2 text-center text-xs text-muted-foreground sm:px-4 sm:py-3 sm:text-sm">
                      {i + 1}
                    </TableCell>
                    <TableCell className="px-1.5 py-2 font-medium sm:px-4 sm:py-3">
                      <button
                        type="button"
                        onClick={() => setProfilGoster(t)}
                        className="group inline-flex items-center gap-1.5 text-left text-sm hover:text-primary sm:gap-2"
                      >
                        <TalebeAvatar talebe={t} boyut={30} />
                        <span className="truncate group-hover:underline">{t.isim}</span>
                      </button>
                    </TableCell>
                    <TableCell className="px-1 py-2 pr-2 text-center sm:px-4 sm:py-3">
                      <GunDurum
                        verdi={getKiraatGunler(t, seciliHafta).includes(seciliGun)}
                        duzenlenebilir={hocaModu}
                        onToggle={() => kiraatGunToggle(t, seciliGun)}
                      />
                    </TableCell>
                    <TableCell className="px-2 pr-3 py-2 text-center text-xs tabular-nums sm:px-4 sm:py-3 sm:text-sm">
                      {t.sayfa}
                    </TableCell>
                    <TableCell className="px-2 pl-3 py-2 text-center text-xs tabular-nums text-muted-foreground sm:px-4 sm:py-3 sm:text-sm">
                      {cuzHesapla(t.sayfa)}
                    </TableCell>
                    <TableCell className="px-1 py-2 text-center sm:px-4 sm:py-3">
                      <HedefRozet
                        yapilan={hafta}
                        hedef={t.hedefHaftalik}
                        bazSayfa={haftaBazSayfa(t, seciliHafta)}
                      />
                    </TableCell>
                    {hocaModu && (
                      <TableCell className="px-1 py-2 text-right sm:px-4 sm:py-3">
                        <div className="flex justify-end gap-0.5 sm:gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 sm:h-8 sm:w-8"
                            onClick={() => setDuzenlenen(t)}
                          >
                            <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive sm:h-8 sm:w-8"
                            onClick={() => sil(t.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                  );
                })}
                {!yuklendi && talebeler.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={hocaModu ? 8 : 7}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Veriler yükleniyor…
                      </span>
                    </TableCell>
                  </TableRow>
                )}
                {yuklendi && yuklemeHata && (
                  <TableRow>
                    <TableCell
                      colSpan={hocaModu ? 8 : 7}
                      className="py-10 text-center text-sm text-destructive"
                    >
                      Bağlantı hatası: {yuklemeHata}
                    </TableCell>
                  </TableRow>
                )}
                {yuklendi && !yuklemeHata && talebeler.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={hocaModu ? 8 : 7}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      Henüz talebe yok.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {hocaModu && (
          <div className="mt-4 flex justify-end">
            <Button size="sm" onClick={ekle}>
              <Plus className="h-4 w-4" /> Talebe Ekle
            </Button>
          </div>
        )}
      </div>

      <VermediDiyalog
        acik={vermediAcik}
        onClose={() => setVermediAcik(false)}
        gunAdi={GUN_UZUN[seciliGun]}
        talebeler={talebeler.filter(
          (t) => !getKiraatGunler(t, seciliHafta).includes(seciliGun),
        )}
        onTalebe={(t) => {
          setVermediAcik(false);
          setProfilGoster(t);
        }}
      />

      <RaporDiyalog
        acik={raporAcik}
        onClose={() => setRaporAcik(false)}
        talebeler={talebeler}
        haftaBas={seciliHafta}
        haftaEtiketi={haftaEtiket(seciliHafta)}
        onTalebe={(t) => {
          setRaporAcik(false);
          setProfilGoster(t);
        }}
      />


      <Dialog
        open={girisAcik}
        onOpenChange={(o) => {
          setGirisAcik(o);
          if (!o) {
            setParolaTaslak("");
            setParolaHata(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hocaefendi Girişi</DialogTitle>
            <DialogDescription>
              Düzenleme yapabilmek için parola giriniz.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Parola</Label>
            <ParolaInput
              value={parolaTaslak}
              onChange={(v) => {
                setParolaTaslak(v.slice(0, 50));
                setParolaHata(null);
              }}
              onEnter={girisYap}
              hata={!!parolaHata}
              autoFocus
            />
            {parolaHata && (
              <p className="text-xs text-destructive">{parolaHata}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGirisAcik(false)}>
              İptal
            </Button>
            <Button onClick={girisYap}>Giriş Yap</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={parolaDegistirAcik}
        onOpenChange={(o) => {
          setParolaDegistirAcik(o);
          if (!o) {
            setEskiParola("");
            setYeniParola("");
            setYeniParolaTekrar("");
            setParolaDegistirHata(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Parola Değiştir</DialogTitle>
            <DialogDescription>
              Yeni parolanızı belirleyin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Mevcut parola</Label>
              <ParolaInput
                value={eskiParola}
                onChange={(v) => {
                  setEskiParola(v.slice(0, 50));
                  setParolaDegistirHata(null);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Yeni parola</Label>
              <ParolaInput
                value={yeniParola}
                onChange={(v) => {
                  setYeniParola(v.slice(0, 50));
                  setParolaDegistirHata(null);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Yeni parola (tekrar)</Label>
              <ParolaInput
                value={yeniParolaTekrar}
                onChange={(v) => {
                  setYeniParolaTekrar(v.slice(0, 50));
                  setParolaDegistirHata(null);
                }}
                onEnter={parolaDegistir}
              />
            </div>
            {parolaDegistirHata && (
              <p className="text-xs text-destructive">{parolaDegistirHata}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setParolaDegistirAcik(false)}>
              İptal
            </Button>
            <Button onClick={parolaDegistir}>Değiştir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DuzenleDiyalog
        talebe={duzenlenen}
        onClose={() => setDuzenlenen(null)}
        onKaydet={(p) => {
          if (duzenlenen) guncelle(duzenlenen.id, p);
          setDuzenlenen(null);
        }}
      />

      <ProfilDiyalog
        talebe={
          profilGoster
            ? (talebeler.find((x) => x.id === profilGoster.id) ?? profilGoster)
            : null
        }
        hocaModu={hocaModu}
        onClose={() => setProfilGoster(null)}
        onDuzenle={(t) => {
          setProfilGoster(null);
          setDuzenlenen(t);
        }}
        onFotoDegistir={(t, fotoUrl) => {
          void talebeGuncelle(t.id, { fotoUrl });
        }}
        onNotKaydet={(t, patch) => {
          void talebeGuncelle(t.id, patch);
        }}
      />
    </div>
  );
}

function TalebeAvatar({
  talebe,
  boyut = 40,
}: {
  talebe: Talebe;
  boyut?: number;
}) {
  const stil = { width: boyut, height: boyut } as const;
  if (talebe.fotoUrl) {
    return (
      <img
        src={talebe.fotoUrl}
        alt={talebe.isim}
        style={stil}
        className="rounded-full object-cover ring-1 ring-border"
      />
    );
  }
  return (
    <div
      style={stil}
      className="inline-flex items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-primary/20"
    >
      {bashHarfler(talebe.isim)}
    </div>
  );
}

function ProfilDiyalog({
  talebe,
  hocaModu,
  onClose,
  onDuzenle,
  onFotoDegistir,
  onNotKaydet,
}: {
  talebe: Talebe | null;
  hocaModu: boolean;
  onClose: () => void;
  onDuzenle: (t: Talebe) => void;
  onFotoDegistir: (t: Talebe, fotoUrl: string) => void;
  onNotKaydet: (
    t: Talebe,
    patch: Partial<Pick<Talebe, "telefon" | "notlar">>,
  ) => void;
}) {
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [telefon, setTelefon] = useState("");
  const [notlar, setNotlar] = useState("");
  const [fotoBuyuk, setFotoBuyuk] = useState(false);

  useEffect(() => {
    if (talebe) {
      setTelefon(talebe.telefon ?? "");
      setNotlar(talebe.notlar ?? "");
      setHata(null);
    }
  }, [talebe?.id]);

  if (!talebe) return null;

  const fotoSec = async (file: File | undefined) => {
    if (!file) return;
    setHata(null);
    setYukleniyor(true);
    try {
      const url = await dosyaFotoDataUrl(file);
      onFotoDegistir(talebe, url);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Yükleme başarısız");
    } finally {
      setYukleniyor(false);
    }
  };

  const haftalikHedef = talebe.hedefHaftalik;

  return (
    <Dialog open={!!talebe} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Talebe Profili</DialogTitle>
          <DialogDescription>
            Fotoğraf ve kişisel bilgiler.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => talebe.fotoUrl && setFotoBuyuk(true)}
              className={`block rounded-full ${talebe.fotoUrl ? "cursor-zoom-in" : "cursor-default"}`}
              title={talebe.fotoUrl ? "Fotoğrafı büyüt" : undefined}
            >
              <TalebeAvatar talebe={talebe} boyut={120} />
            </button>
            {hocaModu && (
              <label
                className="absolute -bottom-1 -right-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-background hover:opacity-90"
                title="Fotoğraf yükle"
              >
                {yukleniyor ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void fotoSec(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{talebe.isim}</div>
            <div className="text-xs text-muted-foreground">
              Sayfa {talebe.sayfa} · {cuzHesapla(talebe.sayfa)}. cüz · Hedef{" "}
              {haftalikHedef} sf/hafta
            </div>
          </div>
          {hocaModu && talebe.fotoUrl && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground"
              onClick={() => onFotoDegistir(talebe, "")}
            >
              Fotoğrafı kaldır
            </Button>
          )}
          {hata && <p className="text-xs text-destructive">{hata}</p>}
        </div>

        <div className="mt-2 space-y-3">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <Phone className="h-3.5 w-3.5" /> Telefon
            </Label>
            <div className="flex gap-2">
              <Input
                value={telefon}
                onChange={(e) => setTelefon(e.target.value.slice(0, 30))}
                disabled={!hocaModu}
                placeholder="—"
                inputMode="tel"
                type="tel"
                className="text-base"
              />
              {telefon.trim() && (
                <Button asChild size="icon" variant="outline" title="Ara">
                  <a href={`tel:${telefon.replace(/\s+/g, "")}`}>
                    <Phone className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <StickyNote className="h-3.5 w-3.5" /> Notlar
            </Label>
            <Textarea
              value={notlar}
              onChange={(e) => setNotlar(e.target.value.slice(0, 600))}
              disabled={!hocaModu}
              rows={3}
              placeholder="—"
              className="text-base"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onClose}>
            Kapat
          </Button>
          {hocaModu && (
            <>
              <Button
                variant="outline"
                onClick={() => onDuzenle(talebe)}
              >
                <UserIcon className="h-4 w-4" /> İsim & ilerleme
              </Button>
              <Button
                onClick={() => {
                  onNotKaydet(talebe, {
                    telefon: telefon.trim() || undefined,
                    notlar: notlar.trim() || undefined,
                  });
                  onClose();
                }}
              >
                Kaydet
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      {talebe.fotoUrl && (
        <Dialog open={fotoBuyuk} onOpenChange={(o) => !o && setFotoBuyuk(false)}>
          <DialogContent className="max-w-[95vw] border-0 bg-transparent p-0 shadow-none sm:max-w-[90vw]">
            <DialogHeader className="sr-only">
              <DialogTitle>{talebe.isim} fotoğrafı</DialogTitle>
              <DialogDescription>Büyütülmüş fotoğraf görünümü.</DialogDescription>
            </DialogHeader>
            <img
              src={talebe.fotoUrl}
              alt={talebe.isim}
              className="mx-auto max-h-[85vh] w-auto max-w-full rounded-lg object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}

function OzetKart({
  etiket,
  deger,
  onClick,
}: {
  etiket: string;
  deger: number | string;
  onClick?: () => void;
}) {
  const icerik = (
    <CardContent className="px-3 py-3 text-center sm:px-4 sm:py-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {etiket}
      </div>
      <div className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">
        {deger}
      </div>
    </CardContent>
  );
  if (onClick) {
    return (
      <Card
        className="border-border/60 cursor-pointer transition-colors hover:bg-muted/40 hover:border-primary/40"
        onClick={onClick}
      >
        {icerik}
      </Card>
    );
  }
  return <Card className="border-border/60">{icerik}</Card>;
}

function KiraatGunler({
  gunler,
  duzenlenebilir,
  onToggle,
}: {
  gunler: number[];
  duzenlenebilir: boolean;
  onToggle: (g: number) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {GUN_KISA.map((isim, i) => {
        const aktif = gunler.includes(i);
        const sinif = aktif
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-muted/40 text-muted-foreground border-border";
        if (duzenlenebilir) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => onToggle(i)}
              className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:bg-primary/80 hover:text-primary-foreground ${sinif}`}
              title={isim}
            >
              {isim[0]}
            </button>
          );
        }
        return (
          <span
            key={i}
            className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${sinif}`}
            title={isim}
          >
            {isim[0]}
          </span>
        );
      })}
    </div>
  );
}

function GunDurum({
  verdi,
  duzenlenebilir,
  onToggle,
}: {
  verdi: boolean;
  duzenlenebilir: boolean;
  onToggle: () => void;
}) {
  const sinif = verdi
    ? "bg-primary text-primary-foreground border-primary"
    : "bg-muted/40 text-muted-foreground border-border";
  const kisa = verdi ? "✓" : "—";
  const uzun = verdi ? "Verdi" : "Vermedi";
  const icerik = <span>{uzun}</span>;
  if (duzenlenebilir) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title={uzun}
        className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold transition-colors hover:opacity-90 sm:px-2 sm:py-1 sm:text-xs ${sinif}`}
      >
        {icerik}
      </button>
    );
  }
  return (
    <span
      title={uzun}
      className={`inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-semibold sm:px-2 sm:py-1 sm:text-xs ${sinif}`}
    >
      {icerik}
    </span>
  );
}

function IlerlemeRozet({ sayfa }: { sayfa: number }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
        sayfa > 0
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {sayfa} sf
    </span>
  );
}

function HedefRozet({
  yapilan,
  hedef,
  bazSayfa,
}: {
  yapilan: number;
  hedef: number;
  bazSayfa: number;
}) {
  if (!hedef || hedef <= 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const hedefSayfa = Math.min(604, bazSayfa + hedef);
  const oran = Math.round((yapilan / hedef) * 100);
  let renk = "bg-destructive/10 text-destructive";
  let nokta = "bg-destructive";
  let etiket = "Geride";
  if (oran >= 100) {
    renk = "bg-primary/10 text-primary";
    nokta = "bg-primary";
    etiket = "Hedefte";
  } else if (oran >= 50) {
    renk = "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    nokta = "bg-amber-500";
    etiket = "Yolda";
  }
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0 text-[10px] font-medium leading-tight tabular-nums ${renk}`}
        title={`${yapilan} / ${hedef} sf · hedef sayfa ${hedefSayfa} · ${etiket}`}
      >
        <span className={`h-1 w-1 rounded-full ${nokta}`} />
        %{oran}
      </span>
    </div>
  );
}

function DuzenleDiyalog({
  talebe,
  onClose,
  onKaydet,
}: {
  talebe: Talebe | null;
  onClose: () => void;
  onKaydet: (p: Partial<Talebe>) => void;
}) {
  const [isim, setIsim] = useState("");
  
  const [sayfaTaslak, setSayfaTaslak] = useState("1");
  const [sayfaHata, setSayfaHata] = useState<string | null>(null);
  const [hedefTaslak, setHedefTaslak] = useState("5");
  const [hedefHata, setHedefHata] = useState<string | null>(null);

  useEffect(() => {
    if (talebe) {
      setIsim(talebe.isim);
      
      setSayfaTaslak(String(talebe.sayfa));
      setHedefTaslak(String(talebe.hedefHaftalik ?? 5));
      setSayfaHata(null);
      setHedefHata(null);
    }
  }, [talebe]);

  const sayfaDogrula = (deger: string): number | null => {
    if (deger.trim() === "") {
      setSayfaHata("Sayfa boş olamaz");
      return null;
    }
    if (!/^\d+$/.test(deger)) {
      setSayfaHata("Yalnızca rakam giriniz");
      return null;
    }
    const n = Number(deger);
    if (n < 1 || n > 604) {
      setSayfaHata("Sayfa 1 ile 604 arasında olmalı");
      return null;
    }
    setSayfaHata(null);
    return n;
  };

  const hedefDogrula = (deger: string): number | null => {
    if (deger.trim() === "") {
      setHedefHata("Hedef boş olamaz");
      return null;
    }
    if (!/^\d+$/.test(deger)) {
      setHedefHata("Yalnızca rakam giriniz");
      return null;
    }
    const n = Number(deger);
    if (n < 0 || n > 200) {
      setHedefHata("Hedef 0 ile 200 arasında olmalı");
      return null;
    }
    setHedefHata(null);
    return n;
  };

  const kaydet = () => {
    const sayfa = sayfaDogrula(sayfaTaslak);
    const hedef = hedefDogrula(hedefTaslak);
    if (sayfa === null || hedef === null) return;
    const temizIsim = isim.trim().slice(0, 60);
    if (!temizIsim) return;
    onKaydet({ isim: temizIsim, sayfa, hedefHaftalik: hedef });
  };

  const cuz = /^\d+$/.test(sayfaTaslak)
    ? cuzHesapla(Math.max(1, Math.min(604, Number(sayfaTaslak))))
    : "—";

  return (
    <Dialog open={!!talebe} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Talebeyi Düzenle</DialogTitle>
          <DialogDescription>
            İsim, ders ve Kur'an-ı Kerim ilerlemesi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>İsim</Label>
            <Input
              value={isim}
              onChange={(e) => setIsim(e.target.value.slice(0, 60))}
              maxLength={60}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Kıraat günlerini ana tablodaki gün rozetlerinden işaretleyebilirsiniz.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" /> Sayfa (1-604)
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={604}
                value={sayfaTaslak}
                onChange={(e) => {
                  setSayfaTaslak(e.target.value);
                  sayfaDogrula(e.target.value);
                }}
                aria-invalid={sayfaHata ? true : undefined}
                className={
                  sayfaHata
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cüz (otomatik)</Label>
              <div className="flex h-9 items-center rounded-md border border-input bg-secondary/40 px-3 text-sm font-medium text-secondary-foreground">
                {cuz}{typeof cuz === "number" ? ". cüz" : ""}
              </div>
            </div>
          </div>
          {sayfaHata && <p className="text-xs text-destructive">{sayfaHata}</p>}

          <div className="space-y-1.5">
            <Label>Haftalık hedef (sayfa)</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={200}
              value={hedefTaslak}
              onChange={(e) => {
                setHedefTaslak(e.target.value);
                hedefDogrula(e.target.value);
              }}
              aria-invalid={hedefHata ? true : undefined}
              className={
                hedefHata ? "border-destructive focus-visible:ring-destructive" : ""
              }
            />
            {hedefHata ? (
              <p className="text-xs text-destructive">{hedefHata}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                0 yazarsanız hedef takibi devre dışı kalır.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            İptal
          </Button>
          <Button
            onClick={kaydet}
            disabled={!!sayfaHata || !!hedefHata || !isim.trim()}
          >
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DersKutu({
  etiket,
  verildi,
  onChange,
}: {
  etiket: string;
  verildi: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2.5 transition-colors ${
        verildi
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card hover:bg-muted/50"
      }`}
    >
      <span className="text-sm font-medium text-foreground">{etiket}</span>
      <div className="flex items-center gap-2">
        <span
          className={`text-xs ${verildi ? "text-primary" : "text-muted-foreground"}`}
        >
          {verildi ? "Verdi" : "Vermedi"}
        </span>
        <Checkbox
          checked={verildi}
          onCheckedChange={(v) => onChange(Boolean(v))}
        />
      </div>
    </label>
  );
}

function ParolaInput({
  value,
  onChange,
  onEnter,
  hata,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  hata?: boolean;
  autoFocus?: boolean;
}) {
  const [goster, setGoster] = useState(false);
  return (
    <div className="relative">
      <Input
        type={goster ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) onEnter();
        }}
        autoFocus={autoFocus}
        aria-invalid={hata ? true : undefined}
        className={`pr-10 text-base ${hata ? "border-destructive focus-visible:ring-destructive" : ""}`}
      />
      <button
        type="button"
        onClick={() => setGoster((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        tabIndex={-1}
        aria-label={goster ? "Parolayı gizle" : "Parolayı göster"}
      >
        {goster ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}


function VermediDiyalog({
  acik,
  onClose,
  gunAdi,
  talebeler,
  onTalebe,
}: {
  acik: boolean;
  onClose: () => void;
  gunAdi: string;
  talebeler: Talebe[];
  onTalebe: (t: Talebe) => void;
}) {
  return (
    <Dialog open={acik} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ders Vermeyenler · {gunAdi}</DialogTitle>
          <DialogDescription>
            {talebeler.length} talebe bu gün için işaretli değil.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {talebeler.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Bu gün tüm talebeler ders verdi. 🎉
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {talebeler.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onTalebe(t)}
                    className="flex w-full items-center gap-3 py-2 text-left hover:bg-muted/40"
                  >
                    <TalebeAvatar talebe={t} boyut={36} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.isim}</div>
                      <div className="text-xs text-muted-foreground">
                        Sayfa {t.sayfa} · {cuzHesapla(t.sayfa)}. cüz
                      </div>
                    </div>
                    <span className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                      Vermedi
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RaporDiyalog({
  acik,
  onClose,
  talebeler,
  haftaBas,
  haftaEtiketi,
  onTalebe,
}: {
  acik: boolean;
  onClose: () => void;
  talebeler: Talebe[];
  haftaBas: number;
  haftaEtiketi: string;
  onTalebe: (t: Talebe) => void;
}) {
  const siralanmis = [...talebeler]
    .map((t) => ({ t, gun: getKiraatGunler(t, haftaBas).length }))
    .sort((a, b) => b.gun - a.gun);
  const enIyiler = siralanmis.filter((x) => x.gun >= 4);
  const ortalar = siralanmis.filter((x) => x.gun === 2 || x.gun === 3);
  const zayiflar = siralanmis.filter((x) => x.gun <= 1);

  const grup = (
    baslik: string,
    renk: string,
    liste: { t: Talebe; gun: number }[],
  ) => (
    <div>
      <h3 className={`mb-2 text-sm font-semibold ${renk}`}>
        {baslik} <span className="text-muted-foreground">({liste.length})</span>
      </h3>
      {liste.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border/60">
          {liste.map(({ t, gun }) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onTalebe(t)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40"
              >
                <TalebeAvatar talebe={t} boyut={32} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {t.isim}
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
                  {gun}/7 gün
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <Dialog open={acik} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Haftanın Raporu</DialogTitle>
          <DialogDescription>{haftaEtiketi}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto">
          {grup("🌟 En çok ders verenler (4+ gün)", "text-primary", enIyiler)}
          {grup("⚖️ Orta seviye (2-3 gün)", "text-amber-600 dark:text-amber-400", ortalar)}
          {grup("⚠️ Zayıf (0-1 gün)", "text-destructive", zayiflar)}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
