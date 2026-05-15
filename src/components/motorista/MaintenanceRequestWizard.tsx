import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, Loader2, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PROBLEM_CATEGORIES, SEVERITY_LEVELS } from "@/lib/maintenance-requests";
import { toast } from "sonner";

type Props = { vehicleId: string; vehicleLabel: string; onClose: () => void; onCreated?: () => void };

export default function MaintenanceRequestWizard({ vehicleId, vehicleLabel, onClose, onCreated }: Props) {
  const { user, currentCompanyId } = useAuth();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<string>("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [km, setKm] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {},
        { timeout: 5000 }
      );
    }
    (async () => {
      const { data } = await supabase.from("vehicles").select("current_km").eq("id", vehicleId).maybeSingle();
      if (data?.current_km) setKm(String(data.current_km));
    })();
  }, [vehicleId]);

  const onPickPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 5 - photos.length);
    setPhotos((p) => [...p, ...files]);
    setPreviews((p) => [...p, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const removePhoto = (i: number) => {
    setPhotos((p) => p.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const submit = async () => {
    if (!user || !currentCompanyId) return;
    setBusy(true);
    try {
      const { data: drv } = await supabase.from("drivers").select("id").eq("user_id", user.id).eq("company_id", currentCompanyId).maybeSingle();

      // upload photos
      const photoUrls: string[] = [];
      for (const f of photos) {
        const ext = f.name.split(".").pop() || "jpg";
        const path = `${currentCompanyId}/${vehicleId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("maintenance-requests").upload(path, f, { upsert: false });
        if (upErr) throw upErr;
        photoUrls.push(path);
      }

      const { error } = await supabase.from("maintenance_requests").insert({
        company_id: currentCompanyId,
        vehicle_id: vehicleId,
        driver_id: drv?.id ?? null,
        driver_user_id: user.id,
        problem_category: category,
        problem_description: description,
        severity_self_assessment: severity,
        photos_urls: photoUrls,
        reported_latitude: coords?.lat ?? null,
        reported_longitude: coords?.lng ?? null,
        km_at_report: km ? parseInt(km) : null,
      });
      if (error) throw error;

      setDone(true);
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar");
    } finally {
      setBusy(false);
    }
  };

  const canNext =
    (step === 1 && !!category) ||
    (step === 2 && description.trim().length >= 5) ||
    (step === 3 && !!severity) ||
    step === 4 ||
    step === 5;

  if (done) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="h-20 w-20 rounded-full bg-success/20 grid place-items-center mb-4 animate-in zoom-in">
          <CheckCircle2 className="h-12 w-12 text-success" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Solicitação enviada!</h2>
        <p className="text-muted-foreground mb-8">Você será avisado quando o gestor responder.</p>
        <button onClick={onClose} className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold">Voltar</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <button onClick={() => (step === 1 ? onClose() : setStep(step - 1))} className="p-2 -ml-2 rounded hover:bg-muted">
          {step === 1 ? <X className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </button>
        <div className="flex-1">
          <div className="text-xs text-muted-foreground">Passo {step} de 5</div>
          <div className="font-semibold text-sm">{vehicleLabel}</div>
        </div>
      </div>
      {/* Progress */}
      <div className="h-1 bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${(step / 5) * 100}%` }} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold mb-1">O que está acontecendo?</h2>
            <p className="text-sm text-muted-foreground mb-4">Escolha a área do problema</p>
            <div className="grid grid-cols-3 gap-2">
              {PROBLEM_CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => { setCategory(c.value); setStep(2); }}
                  className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1 p-2 transition-all ${
                    category === c.value ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <span className="text-3xl">{c.icon}</span>
                  <span className="text-[11px] font-medium text-center leading-tight">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold mb-1">Descreva o problema</h2>
            <p className="text-sm text-muted-foreground mb-4">Conte o que está acontecendo com detalhes</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: O carro está fazendo barulho ao virar à esquerda..."
              className="w-full min-h-[200px] rounded-xl border border-border bg-card p-4 text-base"
              autoFocus
            />
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold mb-1">Qual a gravidade?</h2>
            <p className="text-sm text-muted-foreground mb-4">Sua percepção sobre a urgência</p>
            <div className="space-y-3">
              {SEVERITY_LEVELS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => { setSeverity(s.value); setStep(4); }}
                  className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                    severity === s.value ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-4 w-4 rounded-full ${s.dot}`} />
                    <div className="flex-1">
                      <div className="font-semibold">{s.label}</div>
                      <div className="text-sm text-muted-foreground">{s.desc}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-xl font-bold mb-1">Tire fotos do problema</h2>
            <p className="text-sm text-muted-foreground mb-4">Recomendado — até 5 fotos</p>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple onChange={onPickPhotos} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={photos.length >= 5}
              className="w-full aspect-video rounded-xl border-2 border-dashed border-border bg-card flex flex-col items-center justify-center gap-2 hover:border-primary disabled:opacity-50"
            >
              <Camera className="h-10 w-10 text-muted-foreground" />
              <span className="font-medium">{photos.length === 0 ? "Tirar foto" : `Adicionar mais (${photos.length}/5)`}</span>
            </button>
            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                    <img src={src} className="w-full h-full object-cover" alt="" />
                    <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 h-6 w-6 grid place-items-center bg-destructive/90 text-white rounded-full">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div>
            <h2 className="text-xl font-bold mb-4">Confirmação</h2>
            <div className="space-y-3">
              <Row label="Categoria" value={PROBLEM_CATEGORIES.find((c) => c.value === category)?.label ?? "—"} />
              <Row label="Gravidade" value={SEVERITY_LEVELS.find((s) => s.value === severity)?.label ?? "—"} />
              <div className="surface-card rounded-xl p-3">
                <div className="text-xs text-muted-foreground mb-1">Descrição</div>
                <div className="text-sm">{description}</div>
              </div>
              <Row label="Fotos" value={`${photos.length} foto(s)`} />
              <Row label="KM atual" value={km ? `${km} km` : "—"} editable onChange={(v) => setKm(v.replace(/\D/g, ""))} />
              <Row label="GPS" value={coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "Capturando..."} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-card/30">
        {step < 5 ? (
          <button
            onClick={() => setStep((s) => Math.min(5, s + 1))}
            disabled={!canNext}
            className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40 min-h-[52px]"
          >
            Continuar <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={busy}
            className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40 min-h-[52px]"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            Enviar solicitação
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, editable, onChange }: { label: string; value: string; editable?: boolean; onChange?: (v: string) => void }) {
  return (
    <div className="surface-card rounded-xl p-3 flex items-center justify-between gap-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      {editable ? (
        <input value={value.replace(" km", "")} onChange={(e) => onChange?.(e.target.value)} className="bg-transparent text-right font-medium text-sm outline-none w-24" inputMode="numeric" />
      ) : (
        <div className="text-sm font-medium text-right">{value}</div>
      )}
    </div>
  );
}