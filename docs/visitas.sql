-- Contador exclusivo de pablovillagran.cl. No almacena IP, nombres ni ciudades.
-- La clave de firma se configura por separado y nunca se incorpora al repositorio.
create schema myhome_stats;
revoke all on schema myhome_stats from public, anon, authenticated;

create table myhome_stats.settings (
  singleton boolean primary key default true check (singleton),
  signing_secret text not null check (length(signing_secret) = 64),
  started_at timestamptz not null default now()
);
create table myhome_stats.daily (
  day date not null,
  country text not null check (country ~ '^[A-Z]{2}$'),
  visits bigint not null default 1 check (visits > 0),
  primary key (day, country)
);
create table myhome_stats.dedup (
  day date not null,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  primary key (day, fingerprint)
);
alter table myhome_stats.settings enable row level security;
alter table myhome_stats.daily enable row level security;
alter table myhome_stats.dedup enable row level security;
create policy no_direct_access on myhome_stats.settings as restrictive for all to anon,authenticated using(false) with check(false);
create policy no_direct_access on myhome_stats.daily as restrictive for all to anon,authenticated using(false) with check(false);
create policy no_direct_access on myhome_stats.dedup as restrictive for all to anon,authenticated using(false) with check(false);
revoke all on all tables in schema myhome_stats from public, anon, authenticated;

-- Solo devuelve totales públicos. Las tablas y la clave permanecen privadas.
create function myhome_stats.summary()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total', coalesce((select sum(visits) from myhome_stats.daily), 0),
    'today', coalesce((select sum(visits) from myhome_stats.daily where day = (now() at time zone 'America/Coyhaique')::date), 0),
    'day', (now() at time zone 'America/Coyhaique')::date,
    'since', (select started_at from myhome_stats.settings where singleton),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('code', country, 'visits', n) order by n desc, country) from (select country, sum(visits) as n from myhome_stats.daily group by country) t), '[]'::jsonb)
  );
$$;

-- Punto de escritura autenticado por firma HMAC y vigencia de dos minutos.
-- El servidor firma únicamente la geolocalización que entrega Vercel.
create function myhome_stats.record(p_day date, p_country text, p_fingerprint text, p_clock bigint, p_signature text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  secret text;
  expected text;
  inserted integer;
begin
  if p_day is null or p_day <> (now() at time zone 'America/Coyhaique')::date
     or p_country is null or p_country !~ '^[A-Z]{2}$'
     or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$'
     or p_clock is null or abs(extract(epoch from now()) - p_clock) > 120
     or p_signature is null or p_signature !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid visit' using errcode = '22023';
  end if;
  select signing_secret into strict secret from myhome_stats.settings where singleton;
  expected := encode(extensions.hmac(p_day::text || '|' || p_country || '|' || p_fingerprint || '|' || p_clock::text, secret, 'sha256'), 'hex');
  if expected is distinct from p_signature then
    raise exception 'Invalid signature' using errcode = '42501';
  end if;
  insert into myhome_stats.dedup(day, fingerprint) values (p_day, p_fingerprint) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 1 then
    insert into myhome_stats.daily(day, country, visits) values (p_day, p_country, 1)
    on conflict (day, country) do update set visits = myhome_stats.daily.visits + 1;
    delete from myhome_stats.dedup where day < p_day - 1;
  end if;
  return myhome_stats.summary() || jsonb_build_object('counted', inserted = 1);
end;
$$;

-- La API expone únicamente estas dos operaciones, sin acceso directo a tablas.
create function public.myhome_visits_summary()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select myhome_stats.summary();
$$;
create function public.myhome_visits_record(p_day date, p_country text, p_fingerprint text, p_clock bigint, p_signature text)
returns jsonb language sql security invoker set search_path = '' as $$
  select myhome_stats.record(p_day, p_country, p_fingerprint, p_clock, p_signature);
$$;
revoke all on function myhome_stats.summary() from public, anon, authenticated;
revoke all on function myhome_stats.record(date,text,text,bigint,text) from public, anon, authenticated;
revoke all on function public.myhome_visits_summary() from public, anon, authenticated;
revoke all on function public.myhome_visits_record(date,text,text,bigint,text) from public, anon, authenticated;
grant usage on schema myhome_stats to anon;
grant execute on function myhome_stats.summary(), myhome_stats.record(date,text,text,bigint,text) to anon;
grant execute on function public.myhome_visits_summary(), public.myhome_visits_record(date,text,text,bigint,text) to anon;
notify pgrst, 'reload schema';
