
-- Quebra vínculo bidirecional para evitar bloqueios de FK
UPDATE public.fuel_authorizations SET fuel_record_id = NULL WHERE fuel_record_id IS NOT NULL;
UPDATE public.fuel_records SET authorization_id = NULL WHERE authorization_id IS NOT NULL;

-- Apaga em ordem de dependência
DELETE FROM public.fuel_authorization_items;
DELETE FROM public.fuel_authorizations;
DELETE FROM public.fuel_records;

-- Limpa trilha de auditoria das tabelas zeradas
DELETE FROM public.audit_logs
 WHERE table_name IN ('fuel_records','fuel_authorizations','fuel_authorization_items');
