## O problema (confirmado)

- O bucket `insurance-policies` é **privado**.
- No banco, todas as 26 apólices com PDF têm `file_url` gravado como **URL assinada** (`/storage/v1/object/sign/insurance-policies/...?token=...`), gerada no upload em `InsurancePanel.handleFile`.
- Essas URLs assinadas são tokens JWT: quando expiram ou quando as chaves do projeto são rotacionadas, **param de funcionar** — é o erro que você está vendo ao abrir o PDF.
- Vários pontos abrem `file_url` cru, sem re-assinar:
  - `InsurancePanel.tsx`: link da lista de apólices, link "página X" da revisão por IA, e os `fetch(file_url)` de `runAiReview` / `extractWithAI`.
  - `ReviewMatches.tsx`: link "ver PDF" da apólice.
  - `Vehicles.tsx`: coluna de seguro usa `policy.file_url`.

Já existe o utilitário correto (`src/lib/storage-url.ts` → `openStoredFile` / `resolveStoredFileUrl`), usado em Documentos e CNH, que extrai bucket+path de qualquer URL de storage e gera uma assinatura nova na hora. Basta aplicá-lo às apólices.

## O que vou fazer

1. **Abrir sempre com assinatura fresca**
   - `InsurancePanel.tsx`: trocar os `<a href={file_url}>` por botões que chamam `openStoredFile(file_url)`; para o link "página X", assinar e abrir com `#page=N` anexado.
   - `ReviewMatches.tsx`: mesmo tratamento no link de PDF da apólice.
   - `Vehicles.tsx`: garantir que o PDF da apólice também passe por `openStoredFile`.

2. **Corrigir os fetch da IA**
   - Em `runAiReview` e no reprocessamento por IA, resolver o URL com `resolveStoredFileUrl` antes do `fetch`, e mostrar mensagem clara ("PDF não encontrado no armazenamento") em vez do erro genérico.

3. **Guardar caminho, não URL assinada (novos uploads)**
   - `handleFile` passa a gravar o **path** (`{company_id}/{timestamp}-arquivo.pdf`) em `file_url`, sem token. `resolveStoredFileUrl` será ajustado para aceitar tanto URL de storage quanto path puro (assumindo o bucket informado), então continua funcionando para os registros antigos.

4. **Sem migração de dados destrutiva**: os registros antigos continuam válidos porque o bucket e o path são extraídos da URL existente; só o token é descartado e refeito na hora da abertura.

## Detalhes técnicos

- `resolveStoredFileUrl(url, { bucket })`: se `parseStorageUrl` falhar e o valor não começar com `http`, tratar como path no bucket informado.
- Nada muda em RLS/policies: o usuário já tem acesso de leitura ao bucket via política por empresa, então `createSignedUrl` no cliente funciona.
