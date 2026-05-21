import { Link } from "react-router-dom";
import { Truck, ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PUBLIC_CAL_URL, buildWhatsappUrl } from "@/lib/contact-config";
import WhatsappFloatingButton from "@/components/WhatsappFloatingButton";

export default function Agendar() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
              <Truck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">FrotaOps</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="sm">Entrar</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-60 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-6 pt-12 pb-8 text-center">
          <h1 className="font-display text-3xl md:text-5xl font-bold leading-tight">
            Conheça o FrotaOps em <span className="text-primary glow-text">30 minutos</span>
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
            Vamos entender sua operação e mostrar como reduzir custos da sua frota — combustível,
            manutenção, multas e seguros — em um único lugar.
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 md:px-6 pb-10">
        <div className="surface-card rounded-xl overflow-hidden border border-border/60">
          <iframe
            src={PUBLIC_CAL_URL}
            title="Agendar demonstração FrotaOps"
            className="w-full block"
            style={{ minHeight: "700px", height: "80vh", border: 0 }}
            allow="camera; microphone; clipboard-read; clipboard-write"
          />
        </div>

        <div className="mt-6 surface-card rounded-xl p-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-5 justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full grid place-items-center" style={{ backgroundColor: "#25D366" }}>
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-semibold">Prefere falar antes?</p>
              <p className="text-sm text-muted-foreground">Chame no WhatsApp e a gente responde rapidinho.</p>
            </div>
          </div>
          <a href={buildWhatsappUrl()} target="_blank" rel="noopener noreferrer">
            <Button className="font-semibold" style={{ backgroundColor: "#25D366", color: "white" }}>
              Abrir WhatsApp
            </Button>
          </a>
        </div>
      </section>

      <WhatsappFloatingButton message="Olá! Vi a página de agendamento do FrotaOps e gostaria de falar antes de marcar." />
    </div>
  );
}