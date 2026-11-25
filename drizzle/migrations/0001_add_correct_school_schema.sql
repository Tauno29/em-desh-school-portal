
CREATE TABLE public.school_learners (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id varchar(32) NOT NULL UNIQUE, first_name varchar(80) NOT NULL, last_name varchar(80) NOT NULL, grade varchar(8) NOT NULL, class_name varchar(80) NOT NULL DEFAULT '', guardian_name varchar(120) NOT NULL, guardian_phone varchar(40) NOT NULL DEFAULT '', status varchar(16) NOT NULL DEFAULT 'active', pin_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX school_learners_created_idx ON public.school_learners (created_at);
CREATE TABLE public.school_sessions (token_hash varchar(128) PRIMARY KEY, role varchar(16) NOT NULL, learner_id uuid NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX school_sessions_expiry_idx ON public.school_sessions (expires_at);
CREATE TABLE public.school_login_throttle (throttle_key varchar(255) PRIMARY KEY, failed_attempts integer NOT NULL, locked_until timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.school_applications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), first_name varchar(80) NOT NULL, last_name varchar(80) NOT NULL, grade varchar(8) NOT NULL, father_name varchar(120) NOT NULL DEFAULT '', father_phone varchar(40) NOT NULL DEFAULT '', father_occupation varchar(120) NOT NULL DEFAULT '', mother_name varchar(120) NOT NULL DEFAULT '', mother_phone varchar(40) NOT NULL DEFAULT '', mother_occupation varchar(120) NOT NULL DEFAULT '', guardian_name varchar(120) NOT NULL, guardian_email varchar(160) NOT NULL DEFAULT '', guardian_phone varchar(40) NOT NULL DEFAULT '', message text NOT NULL, status varchar(16) NOT NULL DEFAULT 'new', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.school_gallery_images (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), caption varchar(120) NOT NULL DEFAULT '', object_path varchar(255) NOT NULL UNIQUE, content_type varchar(80) NOT NULL, size_bytes integer NOT NULL, status varchar(16) NOT NULL DEFAULT 'pending', homepage_role varchar(16) NOT NULL DEFAULT 'gallery', homepage_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.school_site_settings (setting_key varchar(80) PRIMARY KEY, setting_value text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.school_behavior_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), learner_id uuid NOT NULL, note varchar(500) NOT NULL, recorded_on timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX school_behavior_learner_idx ON public.school_behavior_records (learner_id);
CREATE TABLE public.school_test_results (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), learner_id uuid NOT NULL, subject varchar(60) NOT NULL, score integer NOT NULL, term varchar(40) NOT NULL DEFAULT '', recorded_on timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX school_tests_learner_idx ON public.school_test_results (learner_id);
CREATE TABLE public.school_report_cards (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), learner_id uuid NOT NULL, object_path varchar(255) NOT NULL UNIQUE, file_name varchar(255) NOT NULL, content_type varchar(80) NOT NULL, size_bytes integer NOT NULL, term varchar(40) NOT NULL DEFAULT '', status varchar(16) NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX school_reports_learner_idx ON public.school_report_cards (learner_id);

DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['school_learners','school_sessions','school_login_throttle','school_applications','school_gallery_images','school_site_settings','school_behavior_records','school_test_results','school_report_cards'] LOOP
  EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
END LOOP; END $$;

DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['urgent_update_reads','urgent_updates','parent_account_learners','performance_entries','attendance_records','learner_portal_records','learners','parent_accounts','classes','site_content','gallery_media','gallery_asset_visibility','site_alert_config','fee_structures','school_contact_info','user_roles'] LOOP
  EXECUTE format('COMMENT ON TABLE public.%I IS %L', t, 'DEPRECATED: from wrongly imported repository; unused');
END LOOP; END $$;
