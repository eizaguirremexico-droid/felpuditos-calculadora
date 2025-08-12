'use client';
import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { RotateCcw, CheckCircle2, Info, PlusCircle, Trash2, Calculator, Settings, Layers, ReceiptText } from "lucide-react";

/**
 * Calculadora de Stickers — v1.13.0 (UI Refresh)
 * - Solo estética: colores suaves tipo dashboard (inspiración de referencia)
 * - Cards redondeadas 3XL, sombras sutiles, acento esmeralda
 * - Header con iconos, fondo con patrón suave
 * - Mantiene todas las funcionalidades intactas
 */

// Mapa de stickers por hoja según tamaño (cm)
const PER_SHEET: Record<number, number> = {
  1: 50,
  2: 50,
  3: 30,
  4: 18,
  5: 13,
  6: 7,
  7: 6, // Confirmado
  8: 5,
  9: 2,
  10: 2,
};

// Acabados disponibles (tipado estricto)
const acabados = [
  { value: "vinil_blanco", label: "Vinil blanco" },
  { value: "holo_clasico", label: "Holo clásico" },
  { value: "holo_puntos", label: "Holo puntos" },
  { value: "holo_arena", label: "Holo arena" },
  { value: "vinil_blanco_laminado", label: "Vinil blanco laminado" },
] as const;

type Finish = typeof acabados[number]["value"];

// Costos por hoja por acabado (MXN)
const COST_PER_SHEET: Record<Finish, number> = {
  vinil_blanco: 5.9,
  holo_clasico: 7.9,
  holo_puntos: 7.9,
  holo_arena: 10,
  vinil_blanco_laminado: 17,
};

// Gastos fijos (MXN)
const FIXED_COSTS = [
  { key: "caja_envio", label: "Caja de envío", value: 20 },
  { key: "tapete_corte", label: "Tapete de corte", value: 0.76 },
  { key: "cinta_kraft", label: "Cinta kraft", value: 4 },
  { key: "guia_envio", label: "Guía de envío", value: 0.3 },
] as const;

// Costos variables por hoja (MXN)
const VARIABLE_RATES = {
  tinta: 0.25,
  corte: 0.13,
  cinta_magica: 0.7,
} as const;

// Impuestos
const IVA_RATE = 0.16;

// Cargo incluido por cotización en multicotización
const INCLUDED_FEE_PER_QUOTE = 80; // MXN

// Utilidades puras
const getStickersPerSheet = (sizeCm: number) => PER_SHEET[sizeCm] ?? 0;
const getMargin = (sizeCm: number) => (sizeCm <= 7 ? 0.46 : 0.33);
const getCostPerSheet = (finish: Finish) => COST_PER_SHEET[finish] ?? 0;
const getFinishLabel = (value: Finish) => acabados.find((a) => a.value === value)?.label ?? value;

const computeSheetsNeeded = (qty: number, sizeCm: number) => {
  const per = getStickersPerSheet(sizeCm);
  if (!qty || !per) return 0;
  return Math.ceil(qty / per);
};

const computeVariableCostsBySheet = (sheets: number) => {
  const tinta = sheets * VARIABLE_RATES.tinta;
  const corte = sheets * VARIABLE_RATES.corte;
  const cinta = sheets * VARIABLE_RATES.cinta_magica;
  const total = tinta + corte + cinta;
  return { tinta, corte, cinta, total };
};

// Plástico envoltorio: 2.1 por cada 100 stickers (ceil)
const computePackagingCost = (qty: number) => {
  if (qty <= 0) return 0;
  const blocks = Math.ceil(qty / 100);
  return blocks * 2.1;
};

// Totales de venta
const computeProfit = (operarios: number, marginRate: number) => operarios * marginRate;
const computeTotals = (operarios: number, marginRate: number, ivaRate = IVA_RATE) => {
  const profit = computeProfit(operarios, marginRate);
  const subtotal = operarios + profit;
  const iva = subtotal * ivaRate;
  const total = subtotal + iva;
  return { profit, subtotal, iva, total };
};

// División de beneficios (IVA + margen)
const ALELI_RATE = 0.55;
const PEPE_RATE = 0.45;
const computeBenefitSplit = (base: number) => ({
  aleli: base * ALELI_RATE,
  pepe: base * PEPE_RATE,
});

// Helpers para cotización sin envío (compat/tests)
const computeOperariosWithoutShipping = (qty: number, sizeCm: number, finish: Finish) => {
  const sheets = computeSheetsNeeded(qty, sizeCm);
  const costPer = getCostPerSheet(finish);
  const vinyl = sheets * costPer;
  const fixed = FIXED_COSTS.reduce((acc, c) => acc + c.value, 0);
  const vars = computeVariableCostsBySheet(sheets).total;
  const pack = computePackagingCost(qty);
  return vinyl + fixed + vars + pack; // sin envío
};

export const computeQuoteTotalNoShipping = (qty: number, sizeCm: number, finish: Finish) => {
  const operariosNoShip = computeOperariosWithoutShipping(qty, sizeCm, finish);
  const margin = getMargin(sizeCm);
  const { total } = computeTotals(operariosNoShip, margin, IVA_RATE);
  return Math.ceil(total);
};

// --- Cotización con $80 incluido por cotización ---
export const computeQuoteTotalWithIncludedFee = (qty: number, sizeCm: number, finish: Finish, fee = INCLUDED_FEE_PER_QUOTE) => {
  const operariosNoShip = computeOperariosWithoutShipping(qty, sizeCm, finish);
  const base = operariosNoShip + Math.max(0, fee);
  const margin = getMargin(sizeCm);
  const { total } = computeTotals(base, margin, IVA_RATE);
  return Math.ceil(total);
};

export const computeCombinedTotalIncluded = (totalsWithFee: number[], shipping: number, feePerQuote = INCLUDED_FEE_PER_QUOTE) => {
  const sum = totalsWithFee.reduce((a, b) => a + b, 0);
  const remainder = Math.max(0, Math.max(0, shipping) - feePerQuote * totalsWithFee.length);
  return Math.ceil(sum + remainder);
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatPercent(n: number) {
  return `${Math.round(n * 100)}%`;
}

function formatCurrency(n: number) {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)} MXN`;
  }
}

function formatCurrencyInt(n: number) {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n)} MXN`;
  }
}

// Tipo de ítem guardado
type SavedQuote = {
  id: number;
  clientName: string;
  sizeCm: number;
  qty: number;
  finish: Finish;
  finishLabel: string;
  marginRate: number;
  totalNoShippingRounded: number;      // referencia
  totalWithIncludedRounded: number;    // usado en multicotización
  profitIncluded: number;              // MXN
  ivaIncluded: number;                 // MXN
  includedFee: number;                 // MXN
};

// ---------- Feedback UX: vibración + beep suave (dulce) ----------
let __audioCtx: any | null = null;
function tapFeedback() {
  try { if (navigator.vibrate) navigator.vibrate(10); } catch {}
  try {
    const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    if (!__audioCtx) __audioCtx = new Ctx();
    const ctx: any = __audioCtx;
    if (ctx.state === "suspended") ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    const t0 = ctx.currentTime;
    osc.frequency.setValueAtTime(660, t0);
    osc.frequency.linearRampToValueAtTime(880, t0 + 0.12);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.03, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.20);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.22);
  } catch {}
}

// Construye el texto para WhatsApp (multicotización, humano y con costos)
function buildMultiText(quotes: SavedQuote[], shipping: number, feePerQuote = INCLUDED_FEE_PER_QUOTE) {
  const lines: string[] = [];
  lines.push("Perfecto, ya tenemos tu cotización:");
  if (quotes.length === 0) {
    lines.push("— Sin cotizaciones guardadas —");
  } else {
    let suma = 0;
    for (const q of quotes) {
      suma += q.totalWithIncludedRounded;
      lines.push(`- ${q.sizeCm} cm · ${q.qty} stickers · ${q.finishLabel} — ${formatCurrencyInt(q.totalWithIncludedRounded)}`);
    }
    const remaining = Math.max(0, shipping - feePerQuote * quotes.length);
    const totalFinal = Math.ceil(suma + remaining);
    lines.push(`Total por todo: ${formatCurrencyInt(totalFinal)}`);
    if (remaining <= 0) lines.push("Envío gratis 🙌");
  }
  return lines.join("\n");
}

// Texto para WhatsApp (cotización simple)
function buildSingleText(sizeCm: number, qty: number, finishLabel: string, totalRounded: number, shipping: number) {
  const lines: string[] = [];
  lines.push("Perfecto, ya tenemos tu cotización:");
  lines.push(`- ${sizeCm} cm · ${qty} stickers · ${finishLabel} — ${formatCurrencyInt(totalRounded)}`);
  if (shipping <= 0) lines.push("Envío gratis 🙌");
  return lines.join("\n");
}

export default function StickerCalculator() {
  const [clientName, setClientName] = useState<string>("");
  const [sizeCm, setSizeCm] = useState<number>(5);
  const [qty, setQty] = useState<number>(100);
  const [finish, setFinish] = useState<Finish>(acabados[0].value);
  const [shipping, setShipping] = useState<number>(159);
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [printText, setPrintText] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const printAreaRef = useRef<HTMLTextAreaElement>(null);

  const margin = getMargin(sizeCm);

  const stickersPerSheet = getStickersPerSheet(sizeCm);
  const sheetsNeeded = computeSheetsNeeded(qty, sizeCm);
  const costPerSheet = getCostPerSheet(finish);
  const totalVinylCost = sheetsNeeded * costPerSheet;
  const fixedTotal = FIXED_COSTS.reduce((acc, c) => acc + c.value, 0);

  const variableBySheet = computeVariableCostsBySheet(sheetsNeeded);
  const packaging = computePackagingCost(qty);
  const variablesTotal = variableBySheet.total + packaging;

  const operariosTotal = totalVinylCost + fixedTotal + variablesTotal + shipping;

  const { profit, subtotal, iva, total } = computeTotals(operariosTotal, margin);
  const totalRounded = Math.ceil(total);

  const benefitBase = profit + iva;
  const { aleli, pepe } = computeBenefitSplit(benefitBase);
  const pricePerSticker = qty > 0 ? totalRounded / qty : 0;

  const handleSizeSlider = (values: number[]) => {
    const v = clamp(Math.round(values[0] ?? sizeCm), 1, 10);
    setSizeCm(v);
  };

  const handleSizeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseInt(e.target.value.replace(/[^0-9-]/g, ""), 10);
    if (Number.isNaN(raw)) return setSizeCm(1);
    setSizeCm(clamp(raw, 1, 10));
  };

  const handleQtyInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.trim();
    const n = Number(raw);
    if (Number.isNaN(n)) return setQty(0);
    setQty(Math.max(0, Math.floor(n)));
  };

  const handleShippingInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number(e.target.value);
    if (Number.isFinite(n)) setShipping(Math.max(0, n));
  };

  const onSaveQuote = () => {
    const totalNoShip = computeQuoteTotalNoShipping(qty, sizeCm, finish);

    const operariosNoShip = computeOperariosWithoutShipping(qty, sizeCm, finish);
    const baseIncl = operariosNoShip + INCLUDED_FEE_PER_QUOTE;
    const { profit, iva, total } = computeTotals(baseIncl, getMargin(sizeCm), IVA_RATE);

    const item: SavedQuote = {
      id: Date.now(),
      clientName: clientName.trim(),
      sizeCm,
      qty,
      finish,
      finishLabel: getFinishLabel(finish),
      marginRate: getMargin(sizeCm),
      totalNoShippingRounded: totalNoShip,
      totalWithIncludedRounded: Math.ceil(total),
      profitIncluded: profit,
      ivaIncluded: iva,
      includedFee: INCLUDED_FEE_PER_QUOTE,
    };
    setSavedQuotes((prev) => [...prev, item]);
  };

  const removeQuote = (id: number) => {
    setSavedQuotes((prev) => prev.filter((q) => q.id !== id));
  };

  const reset = () => {
    setClientName("");
    setSizeCm(5);
    setQty(100);
    setFinish(acabados[0].value);
    setShipping(159);
  };

  const sumWithFee = savedQuotes.reduce((a, b) => a + b.totalWithIncludedRounded, 0);
  const remainingShipping = Math.max(0, shipping - INCLUDED_FEE_PER_QUOTE * savedQuotes.length);
  const combinedTotal = Math.ceil(sumWithFee + remainingShipping);

  const multiBenefitBase = savedQuotes.reduce((a, b) => a + b.profitIncluded + b.ivaIncluded, 0);
  const { aleli: multiAleli, pepe: multiPepe } = computeBenefitSplit(multiBenefitBase);

  const handleGeneratePrintTextMulti = () => {
    const txt = buildMultiText(savedQuotes, shipping, INCLUDED_FEE_PER_QUOTE);
    setPrintText(txt);
    setCopied(false);
  };

  const handleGeneratePrintTextSingle = () => {
    const txt = buildSingleText(sizeCm, qty, getFinishLabel(finish), totalRounded, shipping);
    setPrintText(txt);
    setCopied(false);
  };

  const handleCopy = async () => {
    const text = printText;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      return;
    } catch {
      try {
        const ta = printAreaRef.current ?? document.createElement("textarea");
        if (!printAreaRef.current) {
          (ta as HTMLTextAreaElement).value = text;
          (ta as HTMLTextAreaElement).style.position = "fixed";
          (ta as HTMLTextAreaElement).style.opacity = "0";
          document.body.appendChild(ta);
        }
        (ta as HTMLTextAreaElement).focus();
        (ta as HTMLTextAreaElement).select();
        const ok = document.execCommand("copy");
        if (!printAreaRef.current) document.body.removeChild(ta);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
          return;
        }
      } catch {}
    }
    setCopied(false);
  };

  return (
    <div className="relative min-h-screen w-full text-neutral-900">
      {/* Fondo con patrón sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(16, 185, 129, 0.06) 1px, transparent 0), linear-gradient(to bottom, #f8fafc, #ffffff)",
          backgroundSize: "22px 22px, 100% 100%",
        }}
      />

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight"
          >
            <Calculator className="h-6 w-6 text-emerald-600" />
            Calculadora de stickers Felpuditos
          </motion.h1>

          <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">v1.13.0</Badge>
        </div>
        <p className="mt-1 text-sm text-neutral-600">Diseño renovado. Misma lógica y resultados.</p>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Panel de controles */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="rounded-3xl border border-neutral-200 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Settings className="h-4 w-4 text-emerald-600" /> Parámetros</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Cliente */}
                <div className="space-y-2">
                  <Label htmlFor="clientName">Nombre del cliente</Label>
                  <Input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ej. Aleli" className="rounded-xl border-neutral-300 focus-visible:ring-emerald-500" />
                </div>

                {/* Tamaño */}
                <div className="space-y-2">
                  <Label htmlFor="size">Tamaño del sticker (cm)</Label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 px-1">
                      <Slider id="size" min={1} max={10} step={1} value={[sizeCm]} onValueChange={handleSizeSlider} className="py-2" />
                    </div>
                    <Input type="number" min={1} max={10} step={1} value={sizeCm} onChange={handleSizeInput} className="w-20 rounded-xl text-right" />
                  </div>
                  <p className="text-xs text-neutral-500">Rango: 1 a 10 cm (enteros).</p>
                </div>

                {/* Cantidad */}
                <div className="space-y-2">
                  <Label htmlFor="qty">Cantidad de stickers</Label>
                  <Input id="qty" type="number" inputMode="numeric" placeholder="Ingresa la cantidad" value={qty} onChange={handleQtyInput} className="rounded-xl border-neutral-300 focus-visible:ring-emerald-500" />
                  <p className="text-xs text-neutral-500">Campo de edición libre. Se aceptan cantidades grandes.</p>
                </div>

                {/* Acabado */}
                <div className="space-y-2">
                  <Label>Acabado</Label>
                  <Select value={finish} onValueChange={setFinish}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Selecciona un acabado" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {acabados.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Margen (auto) */}
                <div className="space-y-2">
                  <Label>Margen de ganancia (auto)</Label>
                  <div className="flex items-center gap-2">
                    <Input value={formatPercent(margin)} readOnly className="w-28 rounded-xl" />
                    <Badge variant="secondary" className="whitespace-nowrap rounded-full">{sizeCm <= 7 ? "1–7 cm → 46%" : "8–10 cm → 33%"}</Badge>
                  </div>
                  <p className="text-xs text-neutral-500">Se ajusta automáticamente según el tamaño.</p>
                </div>

                {/* Envío (editable) */}
                <div className="space-y-2">
                  <Label htmlFor="shipping">Envío</Label>
                  <div className="flex items-center gap-2">
                    <Input id="shipping" type="number" step="0.01" value={shipping} onChange={handleShippingInput} className="w-40 rounded-xl" />
                    <Badge variant="outline" className="rounded-full">Editable</Badge>
                  </div>
                  <p className="text-xs text-neutral-500">Costo por defecto: 159 MXN (ajústalo si aplica).</p>
                </div>

                {/* Acciones */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <motion.div whileTap={{ scale: 0.97 }} onClick={tapFeedback}>
                    <Button onClick={onSaveQuote} className="gap-2 rounded-2xl bg-emerald-600 text-white shadow-sm hover:bg-emerald-700">
                      <PlusCircle className="h-4 w-4" /> Guardar cotización
                    </Button>
                  </motion.div>
                  <motion.div whileTap={{ scale: 0.97 }} onClick={tapFeedback}>
                    <Button variant="secondary" onClick={reset} className="gap-2 rounded-2xl bg-neutral-100 text-neutral-700 shadow-sm hover:bg-neutral-200">
                      <RotateCcw className="h-4 w-4" /> Restablecer
                    </Button>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Panel de resultados */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="rounded-3xl border border-neutral-200 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4 text-emerald-600" /> Datos de producción y costos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Producción básica */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs text-neutral-500">Stickers por hoja</p>
                    <p className="mt-1 text-2xl font-semibold">{stickersPerSheet}</p>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs text-neutral-500">Hojas necesarias</p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-2xl font-semibold">{sheetsNeeded}</p>
                      <Badge className="gap-1" variant="outline">
                        <CheckCircle2 className="h-3.5 w-3.5" /> redondeado arriba
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Nota de redondeo */}
                <div className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4" />
                    <div>
                      Si la cantidad de hojas resulta fraccionada, siempre se redondea 1 hoja hacia arriba.
                    </div>
                  </div>
                </div>

                {/* Costos por vinil */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs text-neutral-500">Costo por hoja (según acabado)</p>
                    <p className="mt-1 text-lg font-medium">{formatCurrency(costPerSheet)}</p>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs text-neutral-500">Costo total de vinil</p>
                    <p className="mt-1 text-lg font-medium">{formatCurrency(totalVinylCost)}</p>
                  </div>
                </div>

                {/* Gastos fijos */}
                <div className="rounded-2xl border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-neutral-500">Gastos fijos (suma)</p>
                    <p className="text-lg font-medium">{formatCurrency(fixedTotal)}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
                    {FIXED_COSTS.map((c) => (
                      <div key={c.key} className="flex items-center justify-between">
                        <span className="text-neutral-600">{c.label}</span>
                        <span className="font-medium">{formatCurrency(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Costos variables */}
                <div className="rounded-2xl border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-neutral-500">Costos variables</p>
                    <p className="text-lg font-medium">{formatCurrency(variablesTotal)}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-600">Tinta ({formatCurrency(VARIABLE_RATES.tinta)}/hoja)</span>
                      <span className="font-medium">{formatCurrency(variableBySheet.tinta)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-600">Corte ({formatCurrency(VARIABLE_RATES.corte)}/hoja)</span>
                      <span className="font-medium">{formatCurrency(variableBySheet.corte)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-600">Cinta mágica ({formatCurrency(VARIABLE_RATES.cinta_magica)}/hoja)</span>
                      <span className="font-medium">{formatCurrency(variableBySheet.cinta)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-600">Plástico envoltorio (2.10/100 stickers)</span>
                      <span className="font-medium">{formatCurrency(packaging)}</span>
                    </div>
                  </div>
                </div>

                {/* Costos operarios */}
                <div className="rounded-2xl border p-4">
                  <p className="text-xs text-neutral-500">Costos operarios (total)</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center justify-between"><span className="text-neutral-600">Vinil</span><span className="font-medium">{formatCurrency(totalVinylCost)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-neutral-600">Fijos</span><span className="font-medium">{formatCurrency(fixedTotal)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-neutral-600">Variables</span><span className="font-medium">{formatCurrency(variablesTotal)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-neutral-600">Envío</span><span className="font-medium">{formatCurrency(shipping)}</span></div>
                  </div>
                  <p className="mt-4 text-xl font-semibold">{formatCurrency(operariosTotal)}</p>
                </div>

                {/* Venta: margen, IVA y total (vertical) */}
                <div className="rounded-2xl border p-4">
                  <p className="text-xs text-neutral-500">Resumen de venta</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between"><span className="text-neutral-600">Margen de ganancia</span><span className="font-medium">{formatCurrency(profit)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-neutral-600">Subtotal (operarios + margen)</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-neutral-600">IVA (16%)</span><span className="font-medium">{formatCurrency(iva)}</span></div>
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <span className="text-emerald-900 font-medium">TOTAL al cliente</span>
                    <span className="text-4xl font-extrabold tracking-tight text-emerald-900">{formatCurrencyInt(totalRounded)}</span>
                  </div>

                  {/* Desglose de beneficios */}
                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-neutral-500">Desglose de beneficios</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-600">Costo por sticker (cliente)</span>
                      <span className="font-medium text-xs">{qty > 0 ? formatCurrency(pricePerSticker) : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">Aleli 55% de (IVA + margen)</span>
                      <span className="font-semibold text-green-700">{formatCurrency(aleli)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">Pepe 45% de (IVA + margen)</span>
                      <span className="font-semibold text-green-700">{formatCurrency(pepe)}</span>
                    </div>
                  </div>

                  {/* Imprimir cotización (simple) */}
                  <div className="mt-4">
                    <motion.div whileTap={{ scale: 0.97 }} onClick={tapFeedback}>
                      <Button onClick={handleGeneratePrintTextSingle} className="gap-2 rounded-2xl bg-emerald-600 text-white shadow-sm hover:bg-emerald-700">
                        Imprimir cotización
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Cotización múltiple */}
        <div className="mt-6">
          <Card className="rounded-3xl border border-neutral-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><ReceiptText className="h-4 w-4 text-emerald-600" /> Cotización múltiple</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {savedQuotes.length === 0 ? (
                <p className="text-sm text-neutral-500">Aún no has guardado cotizaciones. Configura y presiona <strong>Guardar cotización</strong>.</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    {savedQuotes.map((q) => (
                      <div key={q.id} className="flex items-center justify-between rounded-xl border p-3">
                        <div className="flex flex-col">
                          <span className="font-medium">{q.clientName ? `${q.clientName} · ` : ""}{q.sizeCm} cm · {q.qty} uds · {q.finishLabel}</span>
                          <span className="text-xs text-neutral-500">Margen aplicado: {formatPercent(q.marginRate)}</span>
                          <span className="text-xs text-neutral-500">Hojas necesarias: {computeSheetsNeeded(q.qty, q.sizeCm)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-sm font-semibold">{formatCurrencyInt(q.totalWithIncludedRounded)}</p>
                            <p className="text-xs text-neutral-500">(incluye ${INCLUDED_FEE_PER_QUOTE} envío)</p>
                          </div>
                          <motion.div whileTap={{ scale: 0.97 }} onClick={tapFeedback}>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Borrar cotización"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => removeQuote(q.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </motion.div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Resumen rápido */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border p-4">
                      <p className="text-xs text-neutral-500">Suma de cotizaciones (con ${INCLUDED_FEE_PER_QUOTE} c/u)</p>
                      <p className="mt-1 text-lg font-medium">{formatCurrencyInt(sumWithFee)}</p>
                    </div>
                    <div className="rounded-2xl border p-4">
                      <p className="text-xs text-neutral-500">Envío restante</p>
                      <p className="mt-1 text-lg font-medium">{formatCurrencyInt(remainingShipping)}</p>
                    </div>
                    <div className="rounded-2xl border p-4">
                      <p className="text-xs text-neutral-500">Cotizaciones guardadas</p>
                      <p className="mt-1 text-lg font-medium">{savedQuotes.length}</p>
                    </div>
                  </div>

                  {/* Beneficio total de la multicotización (solo UI, NO se imprime en WhatsApp) */}
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs text-neutral-500">Beneficio total de la multicotización</p>
                    <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-600">IVA + margen (total)</span>
                        <span className="font-semibold">{formatCurrency(multiBenefitBase)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-600">Aleli 55%</span>
                        <span className="font-semibold text-green-700">{formatCurrency(multiAleli)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-600">Pepe 45%</span>
                        <span className="font-semibold text-green-700">{formatCurrency(multiPepe)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Imprimir cotización (múltiple) */}
          <div className="mt-4 space-y-2">
            <motion.div whileTap={{ scale: 0.97 }} onClick={tapFeedback}>
              <Button onClick={handleGeneratePrintTextMulti} className="gap-2 rounded-2xl bg-emerald-600 text-white shadow-sm hover:bg-emerald-700">
                Imprimir cotización
              </Button>
            </motion.div>

            {printText && (
              <div className="rounded-xl border p-3">
                <label className="text-xs text-neutral-500">Texto para WhatsApp</label>
                <textarea
                  ref={printAreaRef}
                  readOnly
                  value={printText}
                  className="mt-2 h-40 w-full resize-y rounded-md border bg-neutral-50 p-2 text-sm outline-none"
                />
                <div className="mt-2 flex justify-end">
                  <motion.div whileTap={{ scale: 0.97 }} onClick={tapFeedback}>
                    <Button onClick={handleCopy} className="gap-2 rounded-2xl bg-neutral-900 text-white hover:bg-black">
                      {copied ? "¡Copiado!" : "Copiar"}
                    </Button>
                  </motion.div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-neutral-500">
          v1.13.0 • UI Refresh (estética tipo dashboard)
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// Tests ligeros (en consola)
// -----------------------------
if (typeof window !== "undefined") {
  // Producción y reglas
  console.assert(getStickersPerSheet(7) === 6, "7 cm debe ser 6 por hoja");
  console.assert(computeSheetsNeeded(51, 1) === 2, "51 de 1 cm → 2 hojas (50/hoja)");
  console.assert(computeSheetsNeeded(100, 3) === 4, "100 de 3 cm → 4 hojas (30/hoja)");
  console.assert(getMargin(7) === 0.46 && getMargin(8) === 0.33, "Margen según tamaño correcto (46% / 33%)");

  const v10 = computeVariableCostsBySheet(10);
  console.assert(Math.abs(v10.total - (10*0.25 + 10*0.13 + 10*0.7)) < 1e-9, "Cálculo variables/hoja x10 correcto");

  console.assert(Math.abs(computePackagingCost(0) - 0) < 1e-9, "Empaque 0 uds → 0");
  console.assert(Math.abs(computePackagingCost(1) - 2.1) < 1e-9, "Empaque 1–100 uds → 2.1");
  console.assert(Math.abs(computePackagingCost(100) - 2.1) < 1e-9, "Empaque 100 uds → 2.1");
  console.assert(Math.abs(computePackagingCost(101) - 4.2) < 1e-9, "Empaque 101–200 uds → 4.2");

  const t = computeTotals(100, 0.46, 0.16);
  console.assert(Math.abs(t.profit - 46) < 1e-9, "Margen 46% de 100 → 46");
  console.assert(Math.abs(t.subtotal - 146) < 1e-9, "Subtotal 100+46 → 146");
  console.assert(Math.abs(t.iva - 23.36) < 1e-9, "IVA 16% de 146 → 23.36");
  console.assert(Math.abs(t.total - 169.36) < 1e-9, "Total 146+23.36 → 169.36");
  console.assert(Math.ceil(t.total) === 170, "Total redondeado hacia arriba → 170");

  const base = t.profit + t.iva;
  const split = computeBenefitSplit(base);
  console.assert(Math.abs(split.aleli + split.pepe - base) < 1e-9, "Suma Aleli+Pepe = IVA+margen");

  const q1 = computeQuoteTotalNoShipping(100, 1, "vinil_blanco");
  console.assert(q1 === 70, `Cotización sin envío 100x1cm vinil blanco → 70 (obtenido ${q1})`);

  const q2 = computeQuoteTotalNoShipping(45, 7, "holo_clasico");
  console.assert(q2 === 168, `Cotización sin envío 45x7cm holo clásico → 168 (obtenido ${q2})`);

  const combinedClassic = computeCombinedTotalIncluded([q1, q2], 159, 0);
  console.assert(combinedClassic === 397, `Combinado clásico (70+168 + 159 envío) → 397 (obtenido ${combinedClassic})`);

  const q1inc = computeQuoteTotalWithIncludedFee(100, 5, "vinil_blanco", 80);
  console.assert(q1inc === 277, `Incluido $80 → 100x5cm vinil blanco → 277 (obtenido ${q1inc})`);
  const q2inc = computeQuoteTotalWithIncludedFee(100, 7, "vinil_blanco", 80);
  console.assert(q2inc === 383, `Incluido $80 → 100x7cm vinil blanco → 383 (obtenido ${q2inc})`);
  const combInc = computeCombinedTotalIncluded([q1inc, q2inc], 159, 80);
  console.assert(combInc === 660, `Combinado con $80 c/u y envío 159 → 660 (obtenido ${combInc})`);

  const combOne = computeCombinedTotalIncluded([q1inc], 159, 80);
  console.assert(combOne === 356, `Una sola cotización (277) + envío restante 79 → 356 (obtenido ${combOne})`);

  const fakeA: SavedQuote = { id:1, clientName:"", sizeCm:5, qty:100, finish:"vinil_blanco", finishLabel:"Vinil blanco", marginRate:0.46, totalNoShippingRounded:0, totalWithIncludedRounded:277, profitIncluded:0, ivaIncluded:0, includedFee:80 };
  const fakeB: SavedQuote = { id:2, clientName:"", sizeCm:7, qty:45, finish:"holo_clasico", finishLabel:"Holo clásico", marginRate:0.46, totalNoShippingRounded:0, totalWithIncludedRounded:383, profitIncluded:0, ivaIncluded:0, includedFee:80 };
  const txtMulti = buildMultiText([fakeA, fakeB], 159, 80);
  const expectedTotal = computeCombinedTotalIncluded([fakeA.totalWithIncludedRounded, fakeB.totalWithIncludedRounded], 159, 80);
  console.assert(txtMulti.includes("Perfecto, ya tenemos tu cotización:"), "Texto múltiple inicia OK");
  console.assert(txtMulti.includes(formatCurrencyInt(fakeA.totalWithIncludedRounded)), "Incluye costo A");
  console.assert(txtMulti.includes(formatCurrencyInt(fakeB.totalWithIncludedRounded)), "Incluye costo B");
  console.assert(txtMulti.includes(formatCurrencyInt(expectedTotal)), "Incluye total final");

  const txtSingle = buildSingleText(5, 100, "Vinil blanco", 277, 0);
  console.assert(txtSingle.includes("Envío gratis"), "Simple marca envío gratis si shipping=0");
}
