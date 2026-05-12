import { Link } from "react-router-dom";
import { Truck, ArrowLeft } from "lucide-react";

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border/60">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
              <Truck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold">FrotaOps</span>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="font-display text-4xl font-bold mb-2">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-10">Última atualização: 12 de maio de 2026</p>

        <article className="prose prose-invert max-w-none space-y-8 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">1. Quem Somos</h2>
            <p>
              A FrotaOps Tecnologia Ltda. ("FrotaOps") é a controladora dos dados pessoais tratados
              em sua plataforma de gestão de frota, em conformidade com a Lei Geral de Proteção de
              Dados (Lei 13.709/2018 — LGPD).
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">2. Dados que Coletamos</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-foreground">Cadastro:</strong> nome, email, telefone, empresa, CNPJ.</li>
              <li><strong className="text-foreground">Operacionais:</strong> dados de veículos, motoristas, abastecimentos, manutenção, checklists.</li>
              <li><strong className="text-foreground">Técnicos:</strong> endereço IP, tipo de dispositivo, logs de acesso.</li>
              <li><strong className="text-foreground">Pagamento:</strong> processado por parceiros (Stripe). Não armazenamos dados de cartão.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">3. Finalidades</h2>
            <p>
              Utilizamos os dados para autenticar usuários, prestar o serviço contratado, gerar
              relatórios analíticos para o Cliente, cumprir obrigações legais e melhorar a
              Plataforma.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">4. Bases Legais</h2>
            <p>
              Tratamos dados com base em: execução de contrato, cumprimento de obrigação legal,
              legítimo interesse e, quando aplicável, consentimento do titular.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">5. Compartilhamento</h2>
            <p>
              Compartilhamos dados apenas com operadores essenciais à prestação do serviço
              (infraestrutura em nuvem, processadores de pagamento, gateway de IA, serviço de
              email transacional), todos contratualmente obrigados a manter confidencialidade.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">6. Armazenamento e Segurança</h2>
            <p>
              Dados são armazenados em provedores com criptografia em trânsito e em repouso. Adotamos
              controles de acesso, segregação por empresa (RLS), trilhas de auditoria e backups
              periódicos.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">7. Retenção</h2>
            <p>
              Mantemos os dados pelo tempo necessário às finalidades descritas e ao cumprimento
              de obrigações legais e regulatórias. Após o encerramento do contrato, os dados podem
              ser anonimizados ou excluídos mediante solicitação.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">8. Direitos do Titular</h2>
            <p>
              Você pode solicitar a qualquer momento: confirmação de tratamento, acesso, correção,
              anonimização, portabilidade, eliminação e revogação de consentimento. Para exercer
              seus direitos, entre em contato conosco.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">9. Cookies</h2>
            <p>
              Utilizamos cookies essenciais ao funcionamento da Plataforma (sessão, preferências) e,
              quando aplicável, cookies analíticos para entender o uso do produto.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">10. Alterações</h2>
            <p>
              Esta Política pode ser atualizada. Mudanças relevantes serão comunicadas pelos canais
              oficiais da Plataforma.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">11. Encarregado (DPO) e Contato</h2>
            <p>
              Para assuntos relacionados a privacidade e proteção de dados:{" "}
              <a href="mailto:privacidade@frotaops.com.br" className="text-primary hover:underline">
                privacidade@frotaops.com.br
              </a>
            </p>
          </section>
        </article>
      </main>

      <footer className="border-t border-border/60 mt-10">
        <div className="max-w-4xl mx-auto px-6 py-8 text-sm text-muted-foreground flex flex-wrap gap-4 justify-between">
          <span>© {new Date().getFullYear()} FrotaOps</span>
          <div className="flex gap-5">
            <Link to="/termos" className="hover:text-foreground">Termos</Link>
            <Link to="/privacidade" className="hover:text-foreground">Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}