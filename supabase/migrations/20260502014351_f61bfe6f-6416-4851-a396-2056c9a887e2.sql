-- Super admin pode gerenciar company_members
DROP POLICY IF EXISTS "super admin manages company members" ON public.company_members;
CREATE POLICY "super admin manages company members"
  ON public.company_members FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Super admin pode gerenciar user_roles
DROP POLICY IF EXISTS "super admin manages user roles" ON public.user_roles;
CREATE POLICY "super admin manages user roles"
  ON public.user_roles FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Super admin pode visualizar profiles
DROP POLICY IF EXISTS "super admin views profiles" ON public.profiles;
CREATE POLICY "super admin views profiles"
  ON public.profiles FOR SELECT
  USING (public.is_super_admin(auth.uid()));