import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePostoAuth } from "@/contexts/PostoAuthContext";
import { friendlyKmError } from "@/lib/km-validation";

type AuthInfo = {
  id: string;
  approved_amount: number | null;
  fuel_type: string | null;
  km_at_request: number | null;
  expires_at: string;
  vehicle: { plate: string; brand: string; model: string } | null;
  driver: { full_name: string; phone: string | null } | null;
  company: { name: string } | null;
};

export default function PostoConfirmar() {
  const { authedFetch, station } = usePostoAuth();
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<AuthInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [liters, setLiters] = useState("");
  const [total, setTotal] = useState("");
  const [receiptNum, setReceiptNum] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [km, setKm] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!info?.expires_at) return;
    const tick = () => {
      const ms = new Date(info.expires_at).getTime() - Date.now();
      setSecondsLeft(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [info?.expires_at]);

  const lookup = async () => {
    if (code.length !== 6) return toast.error("Digite o código de 6 dígitos");
    setBusy(true);
    try {
      const res = await authedFetch<{ authorization: AuthInfo }>("posto-confirm", {
        method: "POST",
        body: JSON.stringify({ action: "lookup", code }),
      });
      setInfo(res.authorization);
      setKm(String(res.authorization.km_at_request ?? ""));
    } catch (e: any) {
      toast.error(e.message);
      setInfo(null);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setCode(""); setInfo(null); setLiters(""); setTotal(""); setReceiptNum(""); setReceiptFile(null); setKm("");
  };

  const confirm = async () => {
    if (!info) return;
    if (!liters || !total || !receiptNum) return toast.error("Preencha litros, valor e cupom");
    setBusy(true);
    try {
      let receiptUrl: string | null = null;
      if (receiptFile) {
        const path = `posto/${station?.id}/${info.id}-${Date.now()}-${receiptFile.name}`;
        const { data, error } = await supabase.storage.from("fuel-receipts").upload(path, receiptFile, {
          upsert: false, contentType: receiptFile.type,
        });
        if (error) throw error;
        const { data: pub } = supabase.storage.from("fuel-receipts").createSignedUrl
          ? await supabase.storage.from("fuel-receipts").createSignedUrl(data.path, 60 * 60 * 24 * 30)
          : { data: { signedUrl: "" } };
        receiptUrl = (pub as any)?.signedUrl ?? null;
      }
      await authedFetch("posto-confirm", {
        method: "POST",
        body: JSON.stringify({
          action: "confirm",
          code,
          liters: Number(liters),
          total_value: Number(total),
          receipt_number: receiptNum,
          receipt_url: receiptUrl,
          km_at_fueling: km ? Number(km) : null,
        }),
      });
      toast.success("Abastecimento confirmado");
      reset();
    } catch (e: any) {
      toast.error(friendlyKmError(e?.message ?? "") ?? e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!info) {
    return (
      <div className="surface-card rounded-2xl p-8 max-w-md mx-auto space-y-5">
        <div className="text-center space-y-1">
          <h2 className="font-display text-xl font-bold">Digite o código do motorista</h2>
          <p className="text-sm text-muted-foreground">Código de 6 dígitos exibido no celular</p>
        </div>
        <Input
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="text-center text-3xl font-mono h-16 tracking-widest"
          placeholder="000000"
        />
        <Button onClick={lookup} disabled={busy || code.length !== 6} className="w-full bg-gradient-primary text-primary-foreground gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Validar código
        </Button>
      </div>
    );
  }

  return (
    <div className="surface-card rounded-2xl p-6 max-w-xl mx-auto space-y-5">
      <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <div className="text-2xl font-mono font-bold text-primary">{info.vehicle?.plate}</div>
            <div className="text-xs text-muted-foreground">{info.vehicle?.brand} {info.vehicle?.model}</div>
          </div>
          {secondsLeft !== null && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Expira em</div>
              <div className={`font-mono text-lg font-bold ${secondsLeft < 60 ? "text-destructive" : "text-foreground"}`}>
                {Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,"0")}
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><div className="text-xs text-muted-foreground">Motorista</div><div>{info.driver?.full_name ?? "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">Empresa</div><div>{info.company?.name ?? "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">Combustível</div><div>{info.fuel_type ?? "—"}</div></div>
          <div>
            <div className="text-xs text-muted-foreground">Valor autorizado</div>
            <div className="font-semibold">{info.approved_amount ? `R$ ${Number(info.approved_amount).toFixed(2)}` : "Sem limite"}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Litros abastecidos*</Label>
          <Input type="number" step="0.01" value={liters} onChange={(e) => setLiters(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Valor total (R$)*</Label>
          <Input type="number" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Nº cupom fiscal*</Label>
          <Input value={receiptNum} onChange={(e) => setReceiptNum(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>KM no abastecimento</Label>
          <Input type="number" value={km} onChange={(e) => setKm(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Foto do cupom fiscal</Label>
        <div className="flex items-center gap-2">
          <Input type="file" accept="image/*,application/pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
          {receiptFile && <Upload className="h-4 w-4 text-success" />}
        </div>
      </div>

      {info.approved_amount && Number(total) > Number(info.approved_amount) && (
        <div className="text-xs text-warning bg-warning/10 border border-warning/30 rounded-md p-2">
          ⚠ Valor digitado excede o autorizado (R$ {Number(info.approved_amount).toFixed(2)}). A confirmação será aceita mas marcada como anomalia.
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={reset} disabled={busy} className="flex-1">Cancelar</Button>
        <Button onClick={confirm} disabled={busy} className="flex-1 bg-gradient-primary text-primary-foreground gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Confirmar
        </Button>
      </div>
    </div>
  );
}