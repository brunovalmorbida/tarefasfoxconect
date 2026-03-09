
-- Add fleet permission columns to user_permissions
ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS can_manage_fleet boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_fleet boolean NOT NULL DEFAULT false;

-- Vehicles table
CREATE TABLE public.fleet_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plate text NOT NULL,
  brand text,
  model text,
  year integer,
  current_km integer DEFAULT 0,
  city text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'reserve', 'inactive')),
  driver_id uuid,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Drivers table
CREATE TABLE public.fleet_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  job_title text,
  city text,
  vehicle_id uuid REFERENCES public.fleet_vehicles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK from vehicles to drivers
ALTER TABLE public.fleet_vehicles
  ADD CONSTRAINT fleet_vehicles_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.fleet_drivers(id) ON DELETE SET NULL;

-- Check-ins table
CREATE TABLE public.fleet_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.fleet_drivers(id) ON DELETE CASCADE,
  checkin_date date NOT NULL DEFAULT CURRENT_DATE,
  km_reported integer,
  needs_maintenance boolean DEFAULT false,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'overdue')),
  task_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Maintenances table
CREATE TABLE public.fleet_maintenances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  maintenance_type text NOT NULL DEFAULT 'other',
  maintenance_date date NOT NULL DEFAULT CURRENT_DATE,
  km_at_maintenance integer,
  cost numeric,
  supplier text,
  description text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Documents / Warranties table
CREATE TABLE public.fleet_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  maintenance_id uuid REFERENCES public.fleet_maintenances(id) ON DELETE SET NULL,
  document_type text NOT NULL DEFAULT 'other' CHECK (document_type IN ('invoice', 'warranty', 'quote', 'receipt', 'photo', 'other')),
  title text NOT NULL,
  supplier text,
  document_date date,
  warranty_expiry date,
  notes text,
  file_url text,
  file_name text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Fleet settings table
CREATE TABLE public.fleet_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_assignee_id uuid,
  default_board_id uuid,
  checkin_day integer NOT NULL DEFAULT 1,
  checkin_time time NOT NULL DEFAULT '08:00',
  default_task_deadline_days integer NOT NULL DEFAULT 3,
  auto_checkin_enabled boolean NOT NULL DEFAULT true,
  warranty_alerts_enabled boolean NOT NULL DEFAULT true,
  checkin_message_template text DEFAULT 'Bom dia, {nome}.\n\nCheck-in semanal do veículo {veiculo}.\n\nResponda neste formato:\n\nKM:\nManutenção: sim ou não\nDescrição:',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Update has_permission function to include fleet permissions
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE _permission
    WHEN 'manage_boards' THEN COALESCE((SELECT can_manage_boards FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'manage_columns' THEN COALESCE((SELECT can_manage_columns FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'manage_tasks' THEN COALESCE((SELECT can_manage_tasks FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'manage_recurring_tasks' THEN COALESCE((SELECT can_manage_recurring_tasks FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'manage_purchases' THEN COALESCE((SELECT can_manage_purchases FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'view_purchases' THEN COALESCE((SELECT can_view_purchases FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'be_buyer' THEN COALESCE((SELECT can_be_buyer FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'manage_fleet' THEN COALESCE((SELECT can_manage_fleet FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'view_fleet' THEN COALESCE((SELECT can_view_fleet FROM public.user_permissions WHERE user_id = _user_id), false)
    ELSE false
  END;
$$;

-- Enable RLS on all fleet tables
ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_maintenances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fleet_vehicles
CREATE POLICY "Authorized users can view vehicles" ON public.fleet_vehicles FOR SELECT TO authenticated
  USING (is_app_admin() OR has_permission(auth.uid(), 'view_fleet') OR has_permission(auth.uid(), 'manage_fleet'));

CREATE POLICY "Authorized users can create vehicles" ON public.fleet_vehicles FOR INSERT TO authenticated
  WITH CHECK (is_app_admin() OR has_permission(auth.uid(), 'manage_fleet'));

CREATE POLICY "Authorized users can update vehicles" ON public.fleet_vehicles FOR UPDATE TO authenticated
  USING (is_app_admin() OR has_permission(auth.uid(), 'manage_fleet'));

CREATE POLICY "Authorized users can delete vehicles" ON public.fleet_vehicles FOR DELETE TO authenticated
  USING (is_app_admin() OR has_permission(auth.uid(), 'manage_fleet'));

-- RLS Policies for fleet_drivers
CREATE POLICY "Authorized users can view drivers" ON public.fleet_drivers FOR SELECT TO authenticated
  USING (is_app_admin() OR has_permission(auth.uid(), 'view_fleet') OR has_permission(auth.uid(), 'manage_fleet'));

CREATE POLICY "Authorized users can create drivers" ON public.fleet_drivers FOR INSERT TO authenticated
  WITH CHECK (is_app_admin() OR has_permission(auth.uid(), 'manage_fleet'));

CREATE POLICY "Authorized users can update drivers" ON public.fleet_drivers FOR UPDATE TO authenticated
  USING (is_app_admin() OR has_permission(auth.uid(), 'manage_fleet'));

CREATE POLICY "Authorized users can delete drivers" ON public.fleet_drivers FOR DELETE TO authenticated
  USING (is_app_admin() OR has_permission(auth.uid(), 'manage_fleet'));

-- RLS Policies for fleet_checkins
CREATE POLICY "Authorized users can view checkins" ON public.fleet_checkins FOR SELECT TO authenticated
  USING (is_app_admin() OR has_permission(auth.uid(), 'view_fleet') OR has_permission(auth.uid(), 'manage_fleet'));

CREATE POLICY "Authorized users can create checkins" ON public.fleet_checkins FOR INSERT TO authenticated
  WITH CHECK (is_app_admin() OR has_permission(auth.uid(), 'manage_fleet'));

CREATE POLICY "Authorized users can update checkins" ON public.fleet_checkins FOR UPDATE TO authenticated
  USING (is_app_admin() OR has_permission(auth.uid(), 'manage_fleet'));

CREATE POLICY "Authorized users can delete checkins" ON public.fleet_checkins FOR DELETE TO authenticated
  USING (is_app_admin() OR has_permission(auth.uid(), 'manage_fleet'));

-- RLS Policies for fleet_maintenances
CREATE POLICY "Authorized users can view maintenances" ON public.fleet_maintenances FOR SELECT TO authenticated
  USING (is_app_admin() OR has_permission(auth.uid(), 'view_fleet') OR has_permission(auth.uid(), 'manage_fleet'));

CREATE POLICY "Authorized users can create maintenances" ON public.fleet_maintenances FOR INSERT TO authenticated
  WITH CHECK (is_app_admin() OR has_permission(auth.uid(), 'manage_fleet'));

CREATE POLICY "Authorized users can update maintenances" ON public.fleet_maintenances FOR UPDATE TO authenticated
  USING (is_app_admin() OR has_permission(auth.uid(), 'manage_fleet'));

CREATE POLICY "Authorized users can delete maintenances" ON public.fleet_maintenances FOR DELETE TO authenticated
  USING (is_app_admin() OR has_permission(auth.uid(), 'manage_fleet'));

-- RLS Policies for fleet_documents
CREATE POLICY "Authorized users can view documents" ON public.fleet_documents FOR SELECT TO authenticated
  USING (is_app_admin() OR has_permission(auth.uid(), 'view_fleet') OR has_permission(auth.uid(), 'manage_fleet'));

CREATE POLICY "Authorized users can create documents" ON public.fleet_documents FOR INSERT TO authenticated
  WITH CHECK (is_app_admin() OR has_permission(auth.uid(), 'manage_fleet'));

CREATE POLICY "Authorized users can update documents" ON public.fleet_documents FOR UPDATE TO authenticated
  USING (is_app_admin() OR has_permission(auth.uid(), 'manage_fleet'));

CREATE POLICY "Authorized users can delete documents" ON public.fleet_documents FOR DELETE TO authenticated
  USING (is_app_admin() OR has_permission(auth.uid(), 'manage_fleet'));

-- RLS Policies for fleet_settings
CREATE POLICY "Admins can view fleet settings" ON public.fleet_settings FOR SELECT TO authenticated
  USING (is_app_admin() OR has_permission(auth.uid(), 'manage_fleet'));

CREATE POLICY "Admins can insert fleet settings" ON public.fleet_settings FOR INSERT TO authenticated
  WITH CHECK (is_app_admin());

CREATE POLICY "Admins can update fleet settings" ON public.fleet_settings FOR UPDATE TO authenticated
  USING (is_app_admin());

-- Storage bucket for fleet documents
INSERT INTO storage.buckets (id, name, public) VALUES ('fleet-documents', 'fleet-documents', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload fleet docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fleet-documents');

CREATE POLICY "Anyone can view fleet docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fleet-documents');

CREATE POLICY "Authorized users can delete fleet docs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fleet-documents' AND (is_app_admin() OR has_permission(auth.uid(), 'manage_fleet')));
