import { Link } from "react-router-dom";
import { Truck, ArrowLeft } from "lucide-react";

export default function Termos() {
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
        <h1 className="font-display text-4xl font-bold mb-2">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mb-10">Última atualização: 12 de maio de 2026</p>

        <article className="prose prose-invert max-w-none space-y-8 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">1. Aceitação dos Termos</h2>
            <p>
              Ao criar uma conta ou utilizar a plataforma FrotaOps ("Plataforma"), operada pela
              FrotaOps Tecnologia Ltda. ("FrotaOps", "nós"), você ("Cliente", "Usuário") declara
              ter lido, compreendido e aceito integralmente estes Termos de Uso.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">2. Descrição do Serviço</h2>
            <p>
              A FrotaOps oferece uma solução SaaS de gestão de frota corporativa, incluindo cadastro
              de veículos e motoristas, controle de abastecimento, manutenção, checklists, seguros,
              documentos e relatórios analíticos.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">3. Conta e Responsabilidades</h2>
            <p>
              O Cliente é responsável pela veracidade dos dados informados, pela guarda das
              credenciais de acesso e por todas as atividades realizadas em sua conta. Notifique-nos
              imediatamente em caso de uso não autorizado.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">4. Planos, Pagamentos e Cancelamento</h2>
            <p>
              Os planos são cobrados conforme valores e periodicidade vigentes na Plataforma. O
              cancelamento pode ser solicitado a qualquer momento e produz efeitos ao final do ciclo
              já pago, sem reembolso de períodos parcialmente utilizados.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">5. Uso Aceitável</h2>
            <p>
              É vedado utilizar a Plataforma para fins ilícitos, realizar engenharia reversa, tentar
              acesso não autorizado a sistemas, ou inserir dados de terceiros sem base legal
              adequada.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">6. Propriedade Intelectual</h2>
            <p>
              Todo o software, marca, layout e conteúdo da Plataforma pertencem à FrotaOps. Os
              dados inseridos pelo Cliente permanecem de sua propriedade, sendo concedida à
              FrotaOps licença para processá-los exclusivamente para a prestação do serviço.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">7. Limitação de Responsabilidade</h2>
            <p>
              A FrotaOps envida melhores esforços para manter a Plataforma disponível, mas não
              garante operação ininterrupta. Não nos responsabilizamos por decisões operacionais
              tomadas com base em dados inseridos pelo próprio Cliente.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">8. Suspensão e Encerramento</h2>
            <p>
              Podemos suspender ou encerrar contas que violem estes Termos, mediante notificação
              prévia sempre que possível.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">9. Alterações</h2>
            <p>
              Estes Termos podem ser atualizados periodicamente. Mudanças relevantes serão
              comunicadas por email ou na Plataforma com antecedência razoável.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">10. Foro e Lei Aplicável</h2>
            <p>
              Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca da sede
              da FrotaOps para dirimir quaisquer controvérsias.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">11. Contato</h2>
            <p>
              Dúvidas sobre estes Termos:{" "}
              <a href="mailto:contato@frotaops.com.br" className="text-primary hover:underline">
                contato@frotaops.com.br
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