## Documentação da API FrotaOps

Gerar um documento completo (Markdown + PDF) descrevendo a API pública `frota-api` implementada como Edge Function, com todos os endpoints já autorizados/implementados até agora.

### Conteúdo do documento

1. **Visão geral**
   - URL base: `https://qvhgivhlgumcxaneizzb.supabase.co/functions/v1/frota-api`
   - Formato de resposta padrão: `{ ok: true, dados }` / `{ ok: false, erro }`
   - Códigos HTTP usados (200, 201, 400, 401, 403, 404, 405, 500)

2. **Autenticação**
   - Header `Authorization: Bearer <chave>`
   - Como obter a chave pelo botão "Conectar Central de Agentes" (tela Configurações → Empresa)
   - Regras: chave vinculada ao `company_id`, hash SHA-256 armazenado, revogação automática ao gerar nova
   - Auditoria: cada chamada registrada em `api_request_logs` com chave, método, path, status

3. **Endpoints autorizados (todos os já implementados)**

   | Método | Rota | Descrição |
   |---|---|---|
   | GET | `/health` | Status público (sem auth) |
   | GET | `/me` | Dados da empresa dona da chave + plano |
   | GET | `/veiculos` | Lista veículos da empresa |
   | POST | `/veiculos` | Cadastra veículo (status default `ativo`) |
   | PATCH | `/veiculos` | Atualiza veículo por `id` |
   | GET | `/manutencoes` | Lista manutenções com filtros (`vehicle_id`, `status`, `from`, `to`, `limit`) |
   | POST | `/manutencoes` | Registra manutenção concluída |
   | POST | `/manutencoes/aprovar` | Aprova/rejeita solicitação de manutenção |

   Para cada endpoint:
   - Método + path
   - Parâmetros de query / corpo JSON (campos obrigatórios e opcionais)
   - Valores válidos de enums (`vehicle_status`, `maintenance_type`, `maintenance_status`, `maintenance_requests.status`)
   - Exemplo de `curl`
   - Exemplo de resposta de sucesso e de erro

4. **Boas práticas / regras de negócio**
   - Toda escrita restrita ao `company_id` da chave
   - Validação de enums antes de enviar ao banco
   - Normalização de placa (uppercase, sem caracteres especiais)
   - Cálculo automático de `total_value` = `labor_value + parts_value` em manutenções

5. **Próximos módulos (roadmap — não implementados ainda)**
   - Abastecimentos, Documentos, Motoristas, Custos/TCO

### Entrega

- `/mnt/documents/FrotaOps-API-v1.md` (fonte editável)
- `/mnt/documents/FrotaOps-API-v1.pdf` (versão para distribuir à Central de Agentes)
- Ambos disponibilizados via `<presentation-artifact>` para download

### Observações

- Nenhuma alteração de código, banco ou edge function nesta tarefa — somente documentação.
- O documento reflete exatamente o estado atual da `supabase/functions/frota-api/index.ts`.
