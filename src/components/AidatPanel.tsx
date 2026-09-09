import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Wallet,
  Pencil,
} from "lucide-react";
import {
  aidatTutariniDinle,
  aidatTutariKaydet,
  aidatOdemeAyarla,
  type Talebe,
} from "@/lib/talebeler";

const AY_ADLARI = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

function ayKeyOlustur(y: number, a: number) {
  return `${y}-${String(a + 1).padStart(2, "0")}`;
}

function paraFmt(n: number) {
  return `${n.toLocaleString("tr-TR")} Birr`;
}

export default function AidatPanel({
  talebeler,
  hocaModu,
  onTalebe,
}: {
  talebeler: Talebe[];
  hocaModu: boolean;
  onTalebe?: (t: Talebe) => void;
}) {
  const simdi = new Date();
  const [yil, setYil] = useState(simdi.getFullYear());
  const [ay, setAy] = useState(simdi.getMonth());
  const [tutar, setTutar] = useState(0);
  const [tutarDuzenle, setTutarDuzenle] = useState(false);
  const [tutarTaslak, setTutarTaslak] = useState("0");

  useEffect(() => {
    const unsub = aidatTutariniDinle((t) => {
      setTutar(t);
      setTutarTaslak(String(t));
    });
    return () => unsub();
  }, []);

  const ayKey = ayKeyOlustur(yil, ay);

  const ozet = useMemo(() => {
    const odeyen = talebeler.filter((t) => t.aidat?.[ayKey]).length;
    const toplam = talebeler.length;
    return {
      toplam,
      odeyen,
      odemeyen: toplam - odeyen,
      tahsil: odeyen * tutar,
      beklenen: toplam * tutar,
      kalan: (toplam - odeyen) * tutar,
    };
  }, [talebeler, ayKey, tutar]);

  const ayDegistir = (fark: number) => {
    const d = new Date(yil, ay + fark, 1);
    setYil(d.getFullYear());
    setAy(d.getMonth());
  };

  const buAy =
    yil === simdi.getFullYear() && ay === simdi.getMonth();

  return (
    <div>
      {/* Aidat tutarı */}
      <Card className="mb-3 border-accent/40 bg-secondary/40">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-2 text-sm">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Aylık aidat</span>
            {tutarDuzenle ? (
              <>
                <Input
                  autoFocus
                  inputMode="numeric"
                  value={tutarTaslak}
                  onChange={(e) =>
                    setTutarTaslak(e.target.value.replace(/[^0-9]/g, "").slice(0, 7))
                  }
                  className="h-9 w-28"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    void aidatTutariKaydet(Number(tutarTaslak) || 0);
                    setTutarDuzenle(false);
                  }}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setTutarTaslak(String(tutar));
                    setTutarDuzenle(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="text-base font-semibold text-foreground tabular-nums">
                  {paraFmt(tutar)}
                </span>
                {hocaModu && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setTutarDuzenle(true)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => ayDegistir(-1)}
              aria-label="Önceki ay"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[110px] text-center text-sm font-medium">
              {AY_ADLARI[ay]} {yil}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => ayDegistir(1)}
              aria-label="Sonraki ay"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!buAy && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setYil(simdi.getFullYear());
                  setAy(simdi.getMonth());
                }}
              >
                Bu ay
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Özet */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Ozet etiket="Ödeyen" deger={`${ozet.odeyen}/${ozet.toplam}`} />
        <Ozet etiket="Ödemeyen" deger={String(ozet.odemeyen)} vurgu="uyari" />
        <Ozet etiket="Toplanan" deger={paraFmt(ozet.tahsil)} vurgu="iyi" />
        <Ozet etiket="Kalan" deger={paraFmt(ozet.kalan)} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-8 px-1 text-center text-xs sm:w-12 sm:px-4">
                  #
                </TableHead>
                <TableHead className="px-1.5 text-sm sm:px-4">Talebe</TableHead>
                <TableHead className="px-2 text-center text-xs sm:px-4 sm:text-sm">
                  Tutar
                </TableHead>
                <TableHead className="px-2 text-center text-xs sm:px-4 sm:text-sm">
                  Durum
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {talebeler.map((t, i) => {
                const odendi = !!t.aidat?.[ayKey];
                return (
                  <TableRow key={t.id} className="hover:bg-muted/30">
                    <TableCell className="px-1 py-2 text-center text-xs text-muted-foreground sm:px-4 sm:py-3 sm:text-sm">
                      {i + 1}
                    </TableCell>
                    <TableCell className="px-1.5 py-2 font-medium sm:px-4 sm:py-3">
                      <button
                        type="button"
                        onClick={() => onTalebe?.(t)}
                        className="truncate text-left text-sm hover:text-primary hover:underline"
                      >
                        {t.isim}
                      </button>
                    </TableCell>
                    <TableCell className="px-2 py-2 text-center text-xs tabular-nums text-muted-foreground sm:px-4 sm:py-3 sm:text-sm">
                      {paraFmt(tutar)}
                    </TableCell>
                    <TableCell className="px-2 py-2 text-center sm:px-4 sm:py-3">
                      <button
                        type="button"
                        disabled={!hocaModu}
                        onClick={() =>
                          void aidatOdemeAyarla(t, ayKey, !odendi)
                        }
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition sm:text-sm ${
                          odendi
                            ? "bg-primary/15 text-primary"
                            : "bg-destructive/10 text-destructive"
                        } ${hocaModu ? "hover:opacity-80" : "cursor-default"}`}
                      >
                        {odendi ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                        {odendi ? "Ödedi" : "Ödemedi"}
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {talebeler.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
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
    </div>
  );
}

function Ozet({
  etiket,
  deger,
  vurgu,
}: {
  etiket: string;
  deger: string;
  vurgu?: "iyi" | "uyari";
}) {
  return (
    <Card>
      <CardContent className="px-3 py-3">
        <p className="text-xs text-muted-foreground">{etiket}</p>
        <p
          className={`mt-1 text-lg font-semibold tabular-nums sm:text-xl ${
            vurgu === "iyi"
              ? "text-primary"
              : vurgu === "uyari"
                ? "text-destructive"
                : "text-foreground"
          }`}
        >
          {deger}
        </p>
      </CardContent>
    </Card>
  );
}
