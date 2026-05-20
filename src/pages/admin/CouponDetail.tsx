import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Ticket, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function CouponDetail() {
  const { id } = useParams();
  const [coupon, setCoupon] = useState<any>(null);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: rs }] = await Promise.all([
        supabase.from("coupons" as any).select("*").eq("id", id).maybeSingle(),
        supabase.from("coupon_redemptions" as any)
          .select("*, companies:company_id(name, cnpj)")
          .eq("coupon_id", id)
          .order("redeemed_at", { ascending: false }),
      ]);
      setCoupon(c);
      setRedemptions((rs as any) ?? []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!coupon) return <div className="p-6 text-muted-foreground">Cupom não encontrado.</div>;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <Button asChild variant="ghost" size="sm"><Link to="/super-admin/cupons"><ArrowLeft className="h-4 w-4" /> Voltar</Link></Button>
      <div className="surface-card rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-3">
          <Ticket className="h-6 w-6 text-primary" />
          <div>
            <div className="text-xs uppercase text-muted-foreground tracking-wider">Código</div>
            <div className="font-mono text-2xl font-bold">{coupon.code}</div>
          </div>
          <Badge className="ml-auto">{coupon.type}</Badge>
        </div>
        {coupon.description && <p className="text-sm text-muted-foreground">{coupon.description}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-border text-sm">
          <div><div className="text-xs text-muted-foreground">Usos</div><div className="font-mono">{coupon.current_uses} / {coupon.max_uses ?? "∞"}</div></div>
          <div><div className="text-xs text-muted-foreground">Válido de</div><div>{new Date(coupon.valid_from).toLocaleDateString("pt-BR")}</div></div>
          <div><div className="text-xs text-muted-foreground">Válido até</div><div>{coupon.valid_until ? new Date(coupon.valid_until).toLocaleDateString("pt-BR") : "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">CNPJ restrito</div><div>{coupon.restrict_to_cnpj ?? "—"}</div></div>
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-bold mb-3">Histórico de uso</h2>
        <div className="surface-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Empresa</th>
                <th className="text-left px-4 py-3">CNPJ</th>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Aplicado</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2">{r.companies?.name ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.cnpj_at_redemption ?? r.companies?.cnpj ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{new Date(r.redeemed_at).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-2 text-xs"><code className="text-xs">{JSON.stringify(r.applied_value)}</code></td>
                </tr>
              ))}
              {redemptions.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Cupom ainda não foi usado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}