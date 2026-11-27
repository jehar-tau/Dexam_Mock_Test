-- The anonymous API role allows 3 seconds. Listing all 49 papers can take
-- longer while it verifies the released manifests and registered figures.
-- PostgREST hoists this setting for this read-only call. Eight seconds matches
-- the authenticated API budget and leaves room within the browser's 10s limit.
alter function public.free_year_paper_catalog() set statement_timeout to '8s';
notify pgrst, 'reload schema';
