CREATE TABLE public.school_application_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type text NOT NULL,
  child_name text NOT NULL,
  wants_hostel boolean NOT NULL DEFAULT false,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  photo_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.school_application_forms TO service_role;
ALTER TABLE public.school_application_forms ENABLE ROW LEVEL SECURITY;