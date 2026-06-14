
-- Seed role_permissions for the new "corretivo" tab under module 'maintenance'.
-- Mirror visibility from existing maintenance:view rows so the tab is not invisible.
INSERT INTO public.role_permissions (company_id, role, module, action, tab, allowed)
SELECT DISTINCT rp.company_id, rp.role, 'maintenance', 'view', 'corretivo', true
FROM public.role_permissions rp
WHERE rp.module = 'maintenance' AND rp.action = 'view'
ON CONFLICT DO NOTHING;
