
-- =========================================================================
-- 1) LIMPEZA DE ÓRFÃOS
-- =========================================================================
DELETE FROM public.documents
 WHERE entity_type = 'vehicle' AND entity_id NOT IN (SELECT id FROM public.vehicles);
DELETE FROM public.documents
 WHERE entity_type = 'driver' AND entity_id NOT IN (SELECT id FROM public.drivers);
DELETE FROM public.fuel_authorizations
 WHERE vehicle_id NOT IN (SELECT id FROM public.vehicles);
DELETE FROM public.insurance_policy_vehicles
 WHERE vehicle_id NOT IN (SELECT id FROM public.vehicles);
DELETE FROM public.driver_status_history
 WHERE driver_id NOT IN (SELECT id FROM public.drivers);
DELETE FROM public.driver_otp_codes
 WHERE driver_id NOT IN (SELECT id FROM public.drivers);
DELETE FROM public.maintenance_checklist_items
 WHERE maintenance_record_id NOT IN (SELECT id FROM public.maintenance_records);
DELETE FROM public.vehicle_axle_layouts
 WHERE vehicle_id NOT IN (SELECT id FROM public.vehicles);
DELETE FROM public.fuel_authorization_items
 WHERE authorization_id NOT IN (SELECT id FROM public.fuel_authorizations);
DELETE FROM public.checklist_questions
 WHERE template_id NOT IN (SELECT id FROM public.checklist_templates);
DELETE FROM public.checklist_answers
 WHERE run_id NOT IN (SELECT id FROM public.checklist_runs);
DELETE FROM public.tire_movements
 WHERE tire_id NOT IN (SELECT id FROM public.tires);

-- =========================================================================
-- 2) FOREIGN KEYS — base multi-tenant
-- =========================================================================
ALTER TABLE public.company_members
  ADD CONSTRAINT company_members_company_fk FOREIGN KEY (company_id)
  REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_company_fk FOREIGN KEY (company_id)
  REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_current_company_fk FOREIGN KEY (current_company_id)
  REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.branches
  ADD CONSTRAINT branches_company_fk FOREIGN KEY (company_id)
  REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.cost_centers
  ADD CONSTRAINT cost_centers_company_fk FOREIGN KEY (company_id)
  REFERENCES public.companies(id) ON DELETE CASCADE;

-- drivers
ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_company_fk FOREIGN KEY (company_id)
  REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_branch_fk FOREIGN KEY (branch_id)
  REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_assigned_vehicle_fk FOREIGN KEY (assigned_vehicle_id)
  REFERENCES public.vehicles(id) ON DELETE SET NULL;

ALTER TABLE public.driver_status_history
  ADD CONSTRAINT dsh_driver_fk FOREIGN KEY (driver_id)
  REFERENCES public.drivers(id) ON DELETE CASCADE;
ALTER TABLE public.driver_status_history
  ADD CONSTRAINT dsh_company_fk FOREIGN KEY (company_id)
  REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.driver_otp_codes
  ADD CONSTRAINT otp_driver_fk FOREIGN KEY (driver_id)
  REFERENCES public.drivers(id) ON DELETE CASCADE;
ALTER TABLE public.driver_otp_codes
  ADD CONSTRAINT otp_company_fk FOREIGN KEY (company_id)
  REFERENCES public.companies(id) ON DELETE CASCADE;

-- =========================================================================
-- FOREIGN KEYS — operacional
-- =========================================================================
ALTER TABLE public.fuel_records
  ADD CONSTRAINT fr_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT fr_vehicle_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fr_driver_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD CONSTRAINT fr_cost_center_fk FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  ADD CONSTRAINT fr_station_fk FOREIGN KEY (fuel_station_id) REFERENCES public.fuel_stations(id) ON DELETE SET NULL;

ALTER TABLE public.fuel_stations
  ADD CONSTRAINT fs_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.fuel_authorizations
  ADD CONSTRAINT fa_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT fa_vehicle_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fa_driver_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD CONSTRAINT fa_station_fk FOREIGN KEY (fuel_station_id) REFERENCES public.fuel_stations(id) ON DELETE SET NULL,
  ADD CONSTRAINT fa_record_fk FOREIGN KEY (fuel_record_id) REFERENCES public.fuel_records(id) ON DELETE SET NULL;

ALTER TABLE public.fuel_authorization_items
  ADD CONSTRAINT fai_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT fai_auth_fk FOREIGN KEY (authorization_id) REFERENCES public.fuel_authorizations(id) ON DELETE CASCADE;

ALTER TABLE public.maintenance_records
  ADD CONSTRAINT mr_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT mr_vehicle_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  ADD CONSTRAINT mr_driver_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD CONSTRAINT mr_cost_center_fk FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id) ON DELETE SET NULL;

ALTER TABLE public.maintenance_checklist_items
  ADD CONSTRAINT mci_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT mci_record_fk FOREIGN KEY (maintenance_record_id) REFERENCES public.maintenance_records(id) ON DELETE CASCADE;

ALTER TABLE public.maintenance_schedules
  ADD CONSTRAINT ms_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT ms_vehicle_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE,
  ADD CONSTRAINT ms_completed_fk FOREIGN KEY (completed_record_id) REFERENCES public.maintenance_records(id) ON DELETE SET NULL;

ALTER TABLE public.tires
  ADD CONSTRAINT tires_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT tires_vehicle_fk FOREIGN KEY (current_vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;

ALTER TABLE public.tire_movements
  ADD CONSTRAINT tm_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT tm_tire_fk FOREIGN KEY (tire_id) REFERENCES public.tires(id) ON DELETE CASCADE,
  ADD CONSTRAINT tm_vehicle_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;

ALTER TABLE public.vehicle_axle_layouts
  ADD CONSTRAINT val_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT val_vehicle_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;

-- checklists
ALTER TABLE public.checklist_templates
  ADD CONSTRAINT ct_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.checklist_questions
  ADD CONSTRAINT cq_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT cq_template_fk FOREIGN KEY (template_id) REFERENCES public.checklist_templates(id) ON DELETE CASCADE;
ALTER TABLE public.checklist_runs
  ADD CONSTRAINT cr_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT cr_template_fk FOREIGN KEY (template_id) REFERENCES public.checklist_templates(id) ON DELETE RESTRICT,
  ADD CONSTRAINT cr_vehicle_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  ADD CONSTRAINT cr_driver_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD CONSTRAINT cr_maintenance_fk FOREIGN KEY (generated_maintenance_id) REFERENCES public.maintenance_records(id) ON DELETE SET NULL;
ALTER TABLE public.checklist_answers
  ADD CONSTRAINT ca_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT ca_run_fk FOREIGN KEY (run_id) REFERENCES public.checklist_runs(id) ON DELETE CASCADE,
  ADD CONSTRAINT ca_question_fk FOREIGN KEY (question_id) REFERENCES public.checklist_questions(id) ON DELETE RESTRICT;

-- documents
ALTER TABLE public.documents
  ADD CONSTRAINT documents_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- insurance
ALTER TABLE public.insurance_brokers
  ADD CONSTRAINT ib_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.insurance_policies
  ADD CONSTRAINT ip_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT ip_broker_fk FOREIGN KEY (broker_id) REFERENCES public.insurance_brokers(id) ON DELETE SET NULL;
ALTER TABLE public.insurance_policy_vehicles
  ADD CONSTRAINT ipv_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT ipv_policy_fk FOREIGN KEY (policy_id) REFERENCES public.insurance_policies(id) ON DELETE CASCADE,
  ADD CONSTRAINT ipv_vehicle_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;

-- audit
ALTER TABLE public.audit_logs
  ADD CONSTRAINT al_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- subscriptions / payments
ALTER TABLE public.subscriptions
  ADD CONSTRAINT sub_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT sub_plan_fk FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE RESTRICT;
ALTER TABLE public.subscription_payments
  ADD CONSTRAINT sp_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT sp_subscription_fk FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE CASCADE;

-- =========================================================================
-- 3) ÍNDICES nas FKs
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_fr_company_vehicle ON public.fuel_records(company_id, vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fr_driver ON public.fuel_records(driver_id);
CREATE INDEX IF NOT EXISTS idx_fr_fueled_at ON public.fuel_records(company_id, fueled_at DESC);
CREATE INDEX IF NOT EXISTS idx_fa_company_vehicle ON public.fuel_authorizations(company_id, vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fa_driver ON public.fuel_authorizations(driver_id);
CREATE INDEX IF NOT EXISTS idx_fa_status ON public.fuel_authorizations(company_id, status);
CREATE INDEX IF NOT EXISTS idx_fai_auth ON public.fuel_authorization_items(authorization_id);
CREATE INDEX IF NOT EXISTS idx_mr_company_vehicle ON public.maintenance_records(company_id, vehicle_id);
CREATE INDEX IF NOT EXISTS idx_mr_driver ON public.maintenance_records(driver_id);
CREATE INDEX IF NOT EXISTS idx_mci_record ON public.maintenance_checklist_items(maintenance_record_id);
CREATE INDEX IF NOT EXISTS idx_ms_vehicle ON public.maintenance_schedules(vehicle_id, status);
CREATE INDEX IF NOT EXISTS idx_tires_company_vehicle ON public.tires(company_id, current_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tm_tire ON public.tire_movements(tire_id);
CREATE INDEX IF NOT EXISTS idx_tm_vehicle ON public.tire_movements(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_cr_company_vehicle ON public.checklist_runs(company_id, vehicle_id);
CREATE INDEX IF NOT EXISTS idx_cr_driver ON public.checklist_runs(driver_id);
CREATE INDEX IF NOT EXISTS idx_cr_template ON public.checklist_runs(template_id);
CREATE INDEX IF NOT EXISTS idx_ca_run ON public.checklist_answers(run_id);
CREATE INDEX IF NOT EXISTS idx_cq_template ON public.checklist_questions(template_id);
CREATE INDEX IF NOT EXISTS idx_docs_company_entity ON public.documents(company_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_docs_expires ON public.documents(company_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_ipv_policy ON public.insurance_policy_vehicles(policy_id);
CREATE INDEX IF NOT EXISTS idx_ipv_vehicle ON public.insurance_policy_vehicles(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_ip_broker ON public.insurance_policies(broker_id);
CREATE INDEX IF NOT EXISTS idx_drivers_company ON public.drivers(company_id, status);
CREATE INDEX IF NOT EXISTS idx_drivers_assigned_vehicle ON public.drivers(assigned_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_dsh_driver ON public.driver_status_history(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_company ON public.user_roles(user_id, company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user ON public.company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_company ON public.audit_logs(company_id, created_at DESC);
