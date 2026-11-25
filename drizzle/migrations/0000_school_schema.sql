
CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, role public.app_role NOT NULL, UNIQUE (user_id, role));
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE TABLE public.parent_accounts (id serial PRIMARY KEY, username varchar(80) NOT NULL UNIQUE, "accessCodeHash" varchar(128) NOT NULL, "parentName" varchar(160) NOT NULL, "parentEmail" varchar(320), active integer NOT NULL DEFAULT 1, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.classes (id serial PRIMARY KEY, name varchar(80) NOT NULL UNIQUE, "createdAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.learners (id serial PRIMARY KEY, "fullName" varchar(160) NOT NULL, surname varchar(120) NOT NULL, "studentId" varchar(80), "parentPinHash" varchar(128), teacher varchar(160), subjects text, "className" varchar(80) NOT NULL, "classId" integer REFERENCES public.classes(id) ON DELETE SET NULL, "parentAccountId" integer REFERENCES public.parent_accounts(id) ON DELETE SET NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.parent_account_learners ("parentAccountId" integer NOT NULL REFERENCES public.parent_accounts(id) ON DELETE CASCADE, "learnerId" integer NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE, "createdAt" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("parentAccountId","learnerId"));
CREATE TABLE public.performance_entries (id serial PRIMARY KEY, "learnerId" integer NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE, "activityName" varchar(160) NOT NULL, "activityType" varchar(60) NOT NULL, marks integer NOT NULL, "totalMarks" integer NOT NULL, "performedAt" timestamptz NOT NULL DEFAULT now(), "createdAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.attendance_records (id serial PRIMARY KEY, "learnerId" integer NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE, "attendanceDate" timestamptz NOT NULL, status varchar(20) NOT NULL, note text, "createdAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.learner_portal_records ("learnerId" integer PRIMARY KEY REFERENCES public.learners(id) ON DELETE CASCADE, "behaviorNotes" text NOT NULL DEFAULT '', "term1Report" text NOT NULL DEFAULT '', "term2Report" text NOT NULL DEFAULT '', "term3Report" text NOT NULL DEFAULT '', "updatedAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.site_content (id serial PRIMARY KEY, "contentKey" varchar(120) NOT NULL UNIQUE, title varchar(180) NOT NULL, body text NOT NULL, published integer NOT NULL DEFAULT 1, "updatedBy" integer, "updatedAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.urgent_updates (id serial PRIMARY KEY, title varchar(180) NOT NULL, body text NOT NULL, "isPublished" integer NOT NULL DEFAULT 0, "createdAt" timestamptz NOT NULL DEFAULT now(), "expiresAt" timestamptz);
CREATE TABLE public.urgent_update_reads ("parentAccountId" integer NOT NULL REFERENCES public.parent_accounts(id) ON DELETE CASCADE, "updateId" integer NOT NULL REFERENCES public.urgent_updates(id) ON DELETE CASCADE, "readAt" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("parentAccountId","updateId"));
CREATE TABLE public.gallery_media (id serial PRIMARY KEY, title varchar(180) NOT NULL, category varchar(80) NOT NULL, "imageUrl" text NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.gallery_asset_visibility ("imageUrl" text PRIMARY KEY, "hiddenAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.site_alert_config (id serial PRIMARY KEY, enabled integer NOT NULL DEFAULT 1, message text NOT NULL, "buttonLabel" varchar(80) NOT NULL, destination varchar(255) NOT NULL, "updatedAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.fee_structures (id serial PRIMARY KEY, "academicYear" varchar(20) NOT NULL UNIQUE, kindergarten varchar(80) NOT NULL, "prePrimary" varchar(80) NOT NULL, grade1to3 varchar(80) NOT NULL, "developmentFund" varchar(80) NOT NULL, "hostelBoarding" varchar(80) NOT NULL, "registrationFee" varchar(80) NOT NULL, "updatedAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.school_contact_info (id serial PRIMARY KEY, phone varchar(80) NOT NULL, whatsapp varchar(80) NOT NULL, email varchar(320) NOT NULL, location varchar(180) NOT NULL, "postalBox" varchar(180) NOT NULL, "registrationNumber" varchar(80) NOT NULL, "nextTermDate" varchar(80) NOT NULL, "updatedAt" timestamptz NOT NULL DEFAULT now());

DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['parent_accounts','classes','learners','parent_account_learners','performance_entries','attendance_records','learner_portal_records','site_content','urgent_updates','urgent_update_reads','gallery_media','gallery_asset_visibility','site_alert_config','fee_structures','school_contact_info'] LOOP
  EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
END LOOP; END $$;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
