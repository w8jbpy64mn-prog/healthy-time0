-- PostgreSQL schema draft for Healthy Time

create type subscription_status as enum ('draft','active','paused','expired','cancelled');
create type order_status as enum (
  'pending_selection','ready_for_kitchen','in_preparation','prepared',
  'in_packing','packed','ready_for_delivery','out_for_delivery','delivered','delivery_failed'
);

create table plans (
  id bigserial primary key,
  name_ar varchar(120) not null,
  name_en varchar(120),
  plan_type varchar(60) not null,
  days_count int not null check (days_count > 0),
  meals_per_day int not null check (meals_per_day >= 0),
  snacks_per_day int not null default 0 check (snacks_per_day >= 0),
  price numeric(10,2) not null check (price >= 0),
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table customers (
  id bigserial primary key,
  full_name varchar(160) not null,
  phone varchar(30) not null unique,
  email varchar(160),
  allergies text,
  forbidden_foods text,
  address text,
  location_url text,
  notes_public text,
  notes_internal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table subscriptions (
  id bigserial primary key,
  customer_id bigint not null references customers(id),
  plan_id bigint not null references plans(id),
  status subscription_status not null default 'draft',
  start_date date not null,
  end_date date not null,
  days_count int not null,
  meals_per_day int not null,
  snacks_per_day int not null default 0,
  total_meals int not null,
  selected_meals int not null default 0,
  total_snacks int not null default 0,
  selected_snacks int not null default 0,
  used_days int not null default 0,
  remaining_days int not null,
  link_token varchar(100) not null unique,
  link_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (total_meals >= 0 and selected_meals >= 0),
  check (total_snacks >= 0 and selected_snacks >= 0)
);

create table products (
  id bigserial primary key,
  name_ar varchar(160) not null,
  name_en varchar(160),
  menu_scope varchar(30) not null, -- subscription / buffet / both
  meal_category varchar(40), -- lunch/dinner/breakfast/snack
  buffet_price numeric(10,2),
  calories int,
  protein_g numeric(7,2),
  carbs_g numeric(7,2),
  fats_g numeric(7,2),
  weight_g numeric(7,2),
  description text,
  ingredients text,
  allergens text,
  is_available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table product_plan_visibility (
  id bigserial primary key,
  product_id bigint not null references products(id) on delete cascade,
  plan_id bigint not null references plans(id) on delete cascade,
  unique(product_id, plan_id)
);

create table orders (
  id bigserial primary key,
  customer_id bigint not null references customers(id),
  subscription_id bigint references subscriptions(id),
  delivery_date date not null,
  status order_status not null default 'pending_selection',
  prep_notes text,
  pack_notes text,
  delivery_notes text,
  proof_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_items (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  product_id bigint not null references products(id),
  quantity int not null default 1 check (quantity > 0),
  slot varchar(40) not null -- breakfast/lunch/dinner/snack
);
