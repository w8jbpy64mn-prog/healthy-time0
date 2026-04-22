const express = require('express');
const fs = require('fs');
const path = require('path');
const { customAlphabet } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 24);

app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, 'public')));

function seed() {
  return {
    admin: { username: 'admin', password: 'HealthyTime@2026' },
    plans: [
      { id: 1, name: 'اشتراك دجاج', type: 'chicken', days: 24, mealsPerDay: 2, snacksPerDay: 1, price: 1499, active: true },
      { id: 2, name: 'اشتراك منوع', type: 'mixed', days: 24, mealsPerDay: 2, snacksPerDay: 1, price: 1699, active: true },
      { id: 3, name: 'اشتراك منوع بلس', type: 'mixed_plus', days: 24, mealsPerDay: 3, snacksPerDay: 1, price: 1899, active: true }
    ],
    products: [
      { id: 1, name: 'دجاج مشوي مع رز', category: 'lunch', allowedPlanTypes: ['chicken', 'mixed', 'mixed_plus'], calories: 520, protein: 38, carbs: 55, fats: 12, isAvailable: true },
      { id: 2, name: 'ستيك بقري صحي', category: 'dinner', allowedPlanTypes: ['mixed', 'mixed_plus'], calories: 610, protein: 41, carbs: 42, fats: 20, isAvailable: true },
      { id: 3, name: 'سناك زبادي يوناني', category: 'snack', allowedPlanTypes: ['chicken', 'mixed', 'mixed_plus'], calories: 180, protein: 15, carbs: 10, fats: 8, isAvailable: true }
    ],
    customers: [],
    selections: []
  };
}

function ensureDb() {
  if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify(seed(), null, 2));
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function nextId(items) {
  return items.length ? Math.max(...items.map((i) => i.id || 0)) + 1 : 1;
}

function computeCounters(sub) {
  const totalMeals = sub.days * sub.mealsPerDay;
  const totalSnacks = sub.days * sub.snacksPerDay;
  return { ...sub, totalMeals, totalSnacks, selectedMeals: 0, selectedSnacks: 0, remainingDays: sub.days, usedDays: 0 };
}

function getSubscriptionStatus(subscription) {
  if (!subscription.linkEnabled) return 'inactive';
  const today = new Date().toISOString().slice(0, 10);
  if (today > subscription.endDate) return 'expired';
  if (subscription.remainingDays <= 0) return 'expired';
  return 'active';
}

app.get('/', (req, res) => res.redirect('/admin'));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/c/:token', (req, res) => res.sendFile(path.join(__dirname, 'public', 'customer.html')));

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDb();
  if (username === db.admin.username && password === db.admin.password) {
    return res.json({ ok: true, message: 'تم تسجيل الدخول بنجاح' });
  }
  return res.status(401).json({ ok: false, message: 'بيانات دخول غير صحيحة' });
});

app.get('/api/plans', (req, res) => res.json(readDb().plans));
app.post('/api/plans', (req, res) => {
  const db = readDb();
  const plan = { id: nextId(db.plans), ...req.body, active: true };
  db.plans.push(plan);
  writeDb(db);
  res.status(201).json(plan);
});

app.get('/api/products', (req, res) => res.json(readDb().products));
app.post('/api/products', (req, res) => {
  const db = readDb();
  const product = { id: nextId(db.products), ...req.body, isAvailable: true };
  db.products.push(product);
  writeDb(db);
  res.status(201).json(product);
});

app.get('/api/customers', (req, res) => res.json(readDb().customers));
app.post('/api/customers', (req, res) => {
  const db = readDb();
  const { fullName, phone, planId, startDate, notes, allergies, forbiddenFoods, address, locationUrl } = req.body;
  const plan = db.plans.find((p) => p.id === Number(planId));
  if (!plan) return res.status(400).json({ message: 'الباقة غير موجودة' });

  const endDateObj = new Date(startDate);
  endDateObj.setDate(endDateObj.getDate() + plan.days - 1);
  const endDate = endDateObj.toISOString().slice(0, 10);

  const subscription = computeCounters({
    id: Date.now(),
    planId: plan.id,
    planName: plan.name,
    planType: plan.type,
    days: plan.days,
    mealsPerDay: plan.mealsPerDay,
    snacksPerDay: plan.snacksPerDay,
    startDate,
    endDate,
    linkToken: nanoid(),
    linkEnabled: true
  });

  const customer = {
    id: nextId(db.customers),
    fullName,
    phone,
    notes: notes || '',
    allergies: allergies || '',
    forbiddenFoods: forbiddenFoods || '',
    address: address || '',
    locationUrl: locationUrl || '',
    subscription
  };

  db.customers.push(customer);
  writeDb(db);
  res.status(201).json({ ...customer, customerLink: `/c/${subscription.linkToken}` });
});

app.patch('/api/subscriptions/:id/link', (req, res) => {
  const db = readDb();
  const customer = db.customers.find((c) => String(c.subscription.id) === req.params.id);
  if (!customer) return res.status(404).json({ message: 'الاشتراك غير موجود' });
  customer.subscription.linkEnabled = Boolean(req.body.enabled);
  writeDb(db);
  res.json({ ok: true, status: getSubscriptionStatus(customer.subscription) });
});

app.get('/api/customer/:token/profile', (req, res) => {
  const db = readDb();
  const customer = db.customers.find((c) => c.subscription.linkToken === req.params.token);
  if (!customer) return res.status(404).json({ message: 'الرابط غير صحيح' });
  const status = getSubscriptionStatus(customer.subscription);
  if (status !== 'active') return res.status(403).json({ message: 'الاشتراك غير نشط', status });

  const availableProducts = db.products.filter(
    (p) => p.isAvailable && p.allowedPlanTypes.includes(customer.subscription.planType)
  );

  const customerSelections = db.selections.filter((s) => s.customerId === customer.id);
  return res.json({
    customer,
    status,
    availableProducts,
    selections: customerSelections
  });
});

app.post('/api/customer/:token/select', (req, res) => {
  const db = readDb();
  const customer = db.customers.find((c) => c.subscription.linkToken === req.params.token);
  if (!customer) return res.status(404).json({ message: 'الرابط غير صحيح' });

  const status = getSubscriptionStatus(customer.subscription);
  if (status !== 'active') return res.status(403).json({ message: 'الاشتراك غير نشط', status });

  const { deliveryDate, mealProductIds = [], snackProductIds = [] } = req.body;
  if (mealProductIds.length > customer.subscription.mealsPerDay) {
    return res.status(422).json({ message: 'تم تجاوز الحد اليومي للوجبات' });
  }
  if (snackProductIds.length > customer.subscription.snacksPerDay) {
    return res.status(422).json({ message: 'تم تجاوز الحد اليومي للسناكات' });
  }

  const valid = (ids, type) => ids.every((id) => {
    const p = db.products.find((pr) => pr.id === id);
    if (!p) return false;
    if (!p.allowedPlanTypes.includes(customer.subscription.planType)) return false;
    return type === 'snack' ? p.category === 'snack' : p.category !== 'snack';
  });

  if (!valid(mealProductIds, 'meal') || !valid(snackProductIds, 'snack')) {
    return res.status(422).json({ message: 'اختيارات غير مسموحة لهذه الباقة' });
  }

  db.selections = db.selections.filter((s) => !(s.customerId === customer.id && s.deliveryDate === deliveryDate));
  db.selections.push({
    id: Date.now(),
    customerId: customer.id,
    deliveryDate,
    mealProductIds,
    snackProductIds
  });

  const all = db.selections.filter((s) => s.customerId === customer.id);
  const selectedMeals = all.reduce((acc, s) => acc + s.mealProductIds.length, 0);
  const selectedSnacks = all.reduce((acc, s) => acc + s.snackProductIds.length, 0);
  customer.subscription.selectedMeals = selectedMeals;
  customer.subscription.selectedSnacks = selectedSnacks;
  customer.subscription.usedDays = all.length;
  customer.subscription.remainingDays = Math.max(customer.subscription.days - all.length, 0);

  writeDb(db);
  res.json({ ok: true, counters: customer.subscription });
});

app.listen(PORT, () => {
  ensureDb();
  console.log(`Healthy Time app running on http://localhost:${PORT}`);
});
