# خطة التنفيذ الشاملة — Healthy Time | وقت الصحة

> **مهم:** المستودع الحالي كان شبه فارغ (فقط README)، لذلك تم إعداد **أساس هندسي وتشغيلي جاهز للتنفيذ** يغطي كامل المتطلبات التشغيلية، مع تقسيم واضح إلى مراحل قابلة للتسليم.

## 1) نطاق النظام (Scope)

النظام يتكون من 5 بوابات رئيسية:

1. **Admin Portal**: إدارة شاملة (باقات، عملاء، منتجات، إعدادات، تقارير، صلاحيات).
2. **Customer Portal**: رابط عميل خاص، اختيار وجبات، متابعة الاشتراك والطلبات.
3. **Kitchen Portal**: أوامر اليوم + تجميع الكميات + حالة التحضير.
4. **Packing Portal**: مراجعة الطلب وتغليف وطباعة ملصق.
5. **Delivery Portal**: إدارة التوصيل والحالة والموقع والإثبات.

## 2) الروابط والدخول

- `/admin/login` رابط مستقل للإدارة.
- `/c/:customerToken` رابط عميل خاص آمن.
- صلاحية رابط العميل تعتمد على:
  - `subscription.status = active`
  - `today <= end_date`
  - `remaining_days > 0`
  - `customer_link_status = enabled`

### دورة حياة رابط العميل
- عند إنشاء اشتراك: توليد `customerToken` فريد.
- عند إيقاف/انتهاء الاشتراك: تعطيل الرابط تلقائياً.
- عند التجديد: إعادة تفعيل نفس الرابط أو إنشاء رابط جديد (اختياري بإعداد النظام).

## 3) نموذج البيانات (High-Level)

### جداول رئيسية
- `users` (إدارة + موظفين + صلاحيات)
- `roles`, `permissions`, `role_permissions`
- `customers`
- `customer_links`
- `plans` (باقات)
- `subscriptions`
- `subscription_counters` (إجماليات/مستهلك/متبقي)
- `products`
- `product_media`
- `product_plan_visibility` (ربط المنتج بالباقات)
- `daily_menu` (بوفيه)
- `customer_selections` (اختيارات العميل)
- `orders`, `order_items`
- `kitchen_tasks`, `packing_tasks`, `delivery_tasks`
- `notifications`
- `site_settings`
- `audit_logs`

## 4) قواعد الأعمال الأساسية

### 4.1 احتساب الاشتراك
- إجمالي الوجبات = `days * meals_per_day`
- إجمالي السناكات = `days * snacks_per_day`
- متبقي الوجبات = `total_meals - selected_meals`
- متبقي السناكات = `total_snacks - selected_snacks`
- الأيام المستخدمة تُزاد يومياً عند إقفال يوم التشغيل.

### 4.2 تقييد الاختيار حسب الباقة
المنتج يظهر للعميل فقط إذا:
1. `product.is_active = true`
2. `product_menu_type` يتطابق (اشتراكات/بوفيه)
3. يوجد ربط مع نوع باقة العميل داخل `product_plan_visibility`

### 4.3 حدود الاختيار
- لا يمكن اختيار أكثر من `meals_per_day` لنفس اليوم (و`snacks_per_day` للسناك).
- إذا الاشتراك منتهي/موقوف → رفض الاختيار برسالة واضحة.

### 4.4 الحالات التشغيلية للطلب
- `pending_selection`
- `ready_for_kitchen`
- `in_preparation`
- `prepared`
- `in_packing`
- `packed`
- `ready_for_delivery`
- `out_for_delivery`
- `delivered`
- `delivery_failed`

## 5) واجهات الإدارة المطلوبة

1. **Dashboard** (ملخصات + تنبيهات)
2. **Customers** (إضافة/تعديل/تعطيل/نسخ الرابط)
3. **Plans** (CRUD + ترتيب + تفعيل)
4. **Products** (CRUD + صور + قيم غذائية + ربط الباقات)
5. **Subscriptions** (إنشاء/تمديد/تعديل الأرصدة)
6. **Menus**
   - Subscription Menu
   - Buffet Menu
7. **Operations**
   - Kitchen
   - Packing
   - Delivery
8. **Notifications Center**
9. **Settings** (اسم، شعار، هوية، قواعد)
10. **Users & Roles**

## 6) واجهات العميل المطلوبة

- صفحة رئيسية للاشتراك
- صفحة اختيار الوجبات
- الطلبات القادمة
- الإشعارات
- الدعم/الملاحظات

## 7) معايير الجودة

- Responsive للجوال/تابلت/كمبيوتر.
- زمن استجابة API أقل من 300ms في العمليات العادية.
- توثيق Audit Log لأي تعديل حساس.
- حماية الروابط المخصصة + Rate limiting.

## 8) خطة تنفيذ واقعية (4 مراحل)

### المرحلة 1 (Core)
- Auth + Admin login
- Customers + Plans + Products
- Subscriptions + Counters
- Customer link + customer portal base

### المرحلة 2 (Selection & Menus)
- Subscription menu + buffet menu
- Meal selection engine
- Validation limits
- Notifications الأساسية

### المرحلة 3 (Operations)
- Kitchen board
- Packing board + labels
- Delivery board + geo/open location + proof image

### المرحلة 4 (Hardening)
- تقارير تشغيلية
- صلاحيات متقدمة
- مراقبة + نسخ احتياطي + تحسين الأداء

## 9) اقتراح تقني احترافي

- **Frontend**: Next.js + TypeScript + Tailwind + i18n (AR/EN RTL)
- **Backend**: NestJS أو Next API (حسب الفريق)
- **DB**: PostgreSQL
- **ORM**: Prisma
- **Queue**: Redis + BullMQ للإشعارات والمهام المؤجلة
- **Storage**: S3-compatible للصور
- **Auth**: JWT + refresh + RBAC

## 10) تعريف النجاح

يُعتبر المشروع “تشغيلي 100%” فقط عند تحقق التالي:
- كل flow من إضافة عميل → اختيار وجبات → تحضير → تغليف → توصيل يعمل على قاعدة بيانات فعلية.
- عدادات الاشتراك تتحدث تلقائياً بدون تدخل يدوي.
- أي عنصر (منتج/باقة/رابط) يمكن التحكم به من لوحة الإدارة.
- وجود تنبيهات واضحة للإدارة والعميل.
