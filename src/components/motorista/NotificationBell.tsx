import { useEffect, useState } from "react";
import { Bell, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const unread = items.filter((i) => !i.read_at).length;

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("driver_notifications")
      .select("*")
      .eq("driver_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems(data ?? []);
  };

  useEffect(() => { load(); }, [user]);
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("driver_notifs_" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_notifications", filter: `driver_user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    await supabase.from("driver_notifications").update({ read_at: new Date().toISOString() }).eq("driver_user_id", user.id).is("read_at", null);
    load();
  };

  return (
    <>
      <button onClick={() => { setOpen(true); markAllRead(); }} className="relative p-2 rounded-lg hover:bg-muted">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 grid place-items-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur" onClick={() => setOpen(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-background border-l border-border shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold flex items-center gap-2"><Bell className="h-4 w-4" /> Notificações</h3>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {items.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-12">Nenhuma notificação</div>
              ) : items.map((n) => (
                <div key={n.id} className={`rounded-lg p-3 border ${n.read_at ? "border-border bg-card/30" : "border-primary/30 bg-primary/5"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm">{n.title}</div>
                    {n.read_at && <Check className="h-3 w-3 text-success shrink-0 mt-1" />}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{n.message}</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-2">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}