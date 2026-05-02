import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Layers, Building2, DollarSign, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

type Props = {
  groupId: string | null;
  onClose: () => void;
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function GroupInfoDialog({ groupId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [group, setGroup] = useState<any | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string; created_at: string }[]>([]);
  const [baseAmount, setBaseAmount] = useState(99.9);
  const [name, setName] = useState("");
  const [fee, setFee] = useState("30");

  useEffect(() => {
    if (!groupId) return;
    (async () => {
      setLoading(true);
      try {
        const [{ data: g }, { data: cs }, { data: subs }] = await Promise.all([
          supabase.from("company_groups").select("*").eq("id", groupId).maybeSingle(),
          supabase.from("companies").select("id,name,created_at").eq("group_id", groupId).order("created_at", { ascending: true }),
          supabase
            .from("subscriptions")
            .select("plan_id, status, plans(monthly_price)")
            .eq("group_id", groupId)
            .in("status", ["ativa", "aguardando_pagamento"])
            .limit(1),
        ]);
        setGroup(g);
        setCompanies(cs ?? []);
        setName(g?.name ?? "");
        setFee(String(g?.extra_company_fee ?? 30));
        const sub: any = subs?.[0];
        setBaseAmount(sub?.plans?.monthly_price ?? 99.9);
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId]);

  const total = baseAmount + Math.max(companies.length - 1, 0) * Number(fee.replace(",", ".") || 0);

  const save = async () => {
    if (!groupId) return;
    const feeNum = Number(fee.replace(",", "."));
    if (Number.isNaN(feeNum) || feeNum < 0) return toast.error("Taxa inválida");
    if (!name.trim()) return toast.error("Nome obrigatório");
    setSaving(true);
    const { error } = await supabase
      .from("company_groups")
      .update({ name: name.trim(), extra_company_fee: feeNum })
      .eq("id", groupId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Grupo atualizado");
    onClose();
  };

  return (
    <Dialog open={!!groupId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Grupo econômico
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>
        ) : !group ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Grupo não encontrado.</div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="g-name">Nome do grupo</Label>
                <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="g-fee">Taxa por empresa extra (R$)</Label>
                <Input id="g-fee" value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" />
              </div>
            </div>

            <div className="surface-card rounded-lg p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Faturamento mensal consolidado
              </div>
              <div className="text-2xl font-display font-bold text-success mt-1">{fmtBRL(total)}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {fmtBRL(baseAmount)} base + {Math.max(companies.length - 1, 0)} × {fmtBRL(Number(fee.replace(",", ".") || 0))}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Empresas no grupo ({companies.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {companies.map((c, idx) => (
                  <Badge key={c.id} variant={idx === 0 ? "default" : "secondary"} className="text-xs">
                    <Building2 className="h-3 w-3 mr-1" />
                    {c.name}
                    {idx === 0 && <span className="ml-1.5 text-[9px] opacity-80">PRINCIPAL</span>}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button onClick={save} disabled={saving || loading}>
            <Save className="h-4 w-4 mr-2" /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}