# PrintShop Pro — Backend & API Specification

## Recommended tech stack

| Layer | Technology | Reason |
|---|---|---|
| Runtime | Node.js 20 LTS | Strong ecosystem, async I/O ideal for notifications |
| Framework | Express.js | Lightweight, well-documented, easy to extend |
| ORM | Prisma | Type-safe, auto-migrations, great with PostgreSQL |
| Database | PostgreSQL 16 | Relational integrity, JSONB for flexible fields |
| Cache / Queue | Redis (BullMQ) | Session store + job queue for reminders |
| File storage | Supabase Storage or AWS S3 | Proof files + generated PDF invoices |
| Auth | JWT + bcrypt | Stateless tokens, role-based guards |
| PDF generation | Puppeteer or pdfmake | Server-side invoice PDF rendering |
| Email | Resend or SendGrid | Transactional email with templates |
| WhatsApp | Meta WhatsApp Business API | Automated + manual message dispatch |
| Cron scheduler | node-cron (via BullMQ) | Daily reminder job execution |
| Hosting | Railway / Render / VPS | Simple deploy, PostgreSQL add-on available |

---

## Project structure

```
printshop-api/
├── src/
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── customers.ts
│   │   ├── orders.ts
│   │   ├── quotes.ts
│   │   ├── invoices.ts
│   │   ├── payments.ts
│   │   ├── proofs.ts
│   │   ├── deliveries.ts
│   │   ├── stock.ts
│   │   ├── notifications.ts
│   │   └── reminders.ts
│   ├── services/
│   │   ├── OrderService.ts
│   │   ├── InvoiceService.ts
│   │   ├── PaymentService.ts
│   │   ├── ProofService.ts
│   │   ├── NotifyService.ts        ← WhatsApp + email dispatch
│   │   ├── ReminderScheduler.ts    ← BullMQ cron jobs
│   │   └── PDFService.ts
│   ├── middleware/
│   │   ├── auth.ts                 ← JWT verify
│   │   ├── roleGuard.ts            ← RBAC per route
│   │   ├── requestLogger.ts
│   │   └── errorHandler.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── jobs/
│   │   └── reminderJob.ts          ← runs daily at 08:00
│   └── index.ts
├── .env
├── package.json
└── README.md
```

---

## Database schema (Prisma)

```prisma
model User {
  id         String   @id @default(uuid())
  name       String
  email      String   @unique
  password   String
  role       Role     @default(SALES)
  phone      String?
  active     Boolean  @default(true)
  createdAt  DateTime @default(now())

  orders        Order[]
  quotes        Quote[]
  invoices      Invoice[]
  payments      Payment[]
  proofs        Proof[]
  proofComments ProofComment[]
  deliveries    Delivery[]
  waLogs        WaLog[]
  notifLogs     NotificationLog[]
}

enum Role {
  ADMIN
  PRESS_OPERATOR
  DRIVER
  SALES
  CUSTOMER
}

model Customer {
  id            String   @id @default(uuid())
  name          String
  contactPerson String?
  email         String
  phone         String
  address       String?
  type          CustomerType @default(INDIVIDUAL)
  createdAt     DateTime @default(now())

  orders   Order[]
  quotes   Quote[]
  invoices Invoice[]
}

enum CustomerType {
  INDIVIDUAL
  BUSINESS
  CORPORATE
}

model Order {
  id            String      @id @default(uuid())
  orderNumber   String      @unique
  customerId    String
  capturedById  String
  jobName       String
  jobType       String
  quantity      Int
  totalValue    Decimal     @db.Decimal(10,2)
  paymentType   PaymentType @default(FULL)
  depositAmount Decimal     @db.Decimal(10,2) @default(0)
  depositPct    Int         @default(0)
  depositReceived Boolean   @default(false)
  balancePaid   Boolean     @default(false)
  status        OrderStatus @default(NEW)
  priority      Priority    @default(MEDIUM)
  dueDate       DateTime
  notes         String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  customer    Customer   @relation(fields: [customerId], references: [id])
  capturedBy  User       @relation(fields: [capturedById], references: [id])
  payments    Payment[]
  invoices    Invoice[]
  proofs      Proof[]
  deliveries  Delivery[]
  waLogs      WaLog[]
}

enum PaymentType {
  FULL
  DEPOSIT_PCT
  DEPOSIT_FIXED
  COD
}

enum OrderStatus {
  NEW
  IN_PRODUCTION
  READY
  DELIVERED
  OVERDUE
}

enum Priority {
  LOW
  MEDIUM
  HIGH
}

model Payment {
  id          String   @id @default(uuid())
  orderId     String
  recordedById String
  paymentType String
  amount      Decimal  @db.Decimal(10,2)
  method      String
  paymentDate DateTime
  notes       String?
  createdAt   DateTime @default(now())

  order      Order @relation(fields: [orderId], references: [id])
  recordedBy User  @relation(fields: [recordedById], references: [id])
}

model Invoice {
  id            String        @id @default(uuid())
  invoiceNumber String        @unique
  orderId       String
  customerId    String
  capturedById  String
  invoiceType   String
  amount        Decimal       @db.Decimal(10,2)
  amountPaid    Decimal       @db.Decimal(10,2) @default(0)
  status        InvoiceStatus @default(UNPAID)
  invoiceDate   DateTime
  dueDate       DateTime
  createdAt     DateTime      @default(now())

  order           Order             @relation(fields: [orderId], references: [id])
  customer        Customer          @relation(fields: [customerId], references: [id])
  capturedBy      User              @relation(fields: [capturedById], references: [id])
  reminderLogs    ReminderLog[]
  notificationLogs NotificationLog[]
}

enum InvoiceStatus {
  UNPAID
  SENT
  PARTIAL
  PAID
  OVERDUE
}

model Quote {
  id           String      @id @default(uuid())
  quoteNumber  String      @unique
  customerId   String
  capturedById String
  description  String
  jobType      String
  quantity     Int
  value        Decimal     @db.Decimal(10,2)
  validUntil   DateTime
  status       QuoteStatus @default(PENDING)
  createdAt    DateTime    @default(now())

  customer   Customer @relation(fields: [customerId], references: [id])
  capturedBy User     @relation(fields: [capturedById], references: [id])
}

enum QuoteStatus {
  PENDING
  ACCEPTED
  DECLINED
  EXPIRED
}

model Proof {
  id          String      @id @default(uuid())
  orderId     String
  uploadedById String
  fileName    String
  fileUrl     String
  version     String
  status      ProofStatus @default(PENDING)
  notes       String?
  createdAt   DateTime    @default(now())

  order      Order          @relation(fields: [orderId], references: [id])
  uploadedBy User           @relation(fields: [uploadedById], references: [id])
  comments   ProofComment[]
}

enum ProofStatus {
  PENDING
  APPROVED
  REVISION_REQUESTED
}

model ProofComment {
  id        String   @id @default(uuid())
  proofId   String
  userId    String
  comment   String
  createdAt DateTime @default(now())

  proof Proof @relation(fields: [proofId], references: [id])
  user  User  @relation(fields: [userId], references: [id])
}

model Delivery {
  id           String         @id @default(uuid())
  orderId      String
  driverId     String
  address      String
  deliveryDate DateTime
  timeSlot     String
  status       DeliveryStatus @default(SCHEDULED)
  createdAt    DateTime       @default(now())

  order  Order @relation(fields: [orderId], references: [id])
  driver User  @relation(fields: [driverId], references: [id])
}

enum DeliveryStatus {
  SCHEDULED
  PENDING
  DELIVERED
}

model StockItem {
  id        String   @id @default(uuid())
  name      String
  category  String
  quantity  Int      @default(0)
  minLevel  Int      @default(0)
  unit      String
  updatedAt DateTime @updatedAt
}

model ReminderSchedule {
  id          String   @id @default(uuid())
  daysOffset  Int
  label       String
  triggerType String
  channels    Json
  active      Boolean  @default(true)

  logs ReminderLog[]
}

model ReminderLog {
  id           String   @id @default(uuid())
  invoiceId    String
  scheduleId   String
  channel      String
  status       String
  sentAt       DateTime @default(now())

  invoice  Invoice          @relation(fields: [invoiceId], references: [id])
  schedule ReminderSchedule @relation(fields: [scheduleId], references: [id])
}

model WaLog {
  id           String   @id @default(uuid())
  orderId      String
  customerPhone String
  templateName String
  status       String
  sentById     String
  sentAt       DateTime @default(now())

  order  Order @relation(fields: [orderId], references: [id])
  sentBy User  @relation(fields: [sentById], references: [id])
}

model NotificationLog {
  id        String   @id @default(uuid())
  invoiceId String
  userId    String
  eventType String
  message   String
  createdAt DateTime @default(now())

  invoice Invoice @relation(fields: [invoiceId], references: [id])
  user    User    @relation(fields: [userId], references: [id])
}
```

---

## REST API endpoints

### Auth — `/api/auth`
| Method | Path | Description | Roles |
|---|---|---|---|
| POST | `/login` | Email + password → JWT | All |
| GET | `/me` | Current user profile | All |
| POST | `/logout` | Invalidate token | All |
| PUT | `/users/:id/role` | Change user role | ADMIN |

### Customers — `/api/customers`
| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/` | List all customers | ADMIN, SALES |
| POST | `/` | Create customer | ADMIN, SALES |
| GET | `/:id` | Get customer + order history | ADMIN, SALES |
| PUT | `/:id` | Update customer | ADMIN, SALES |
| DELETE | `/:id` | Soft-delete customer | ADMIN |

### Orders — `/api/orders`
| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/` | List orders (filter by status, customer) | ADMIN, SALES, PRESS |
| POST | `/` | Create order (with payment setup) | ADMIN, SALES |
| GET | `/:id` | Get order details + payments + proofs | ADMIN, SALES, PRESS |
| PUT | `/:id` | Update order | ADMIN, SALES |
| PATCH | `/:id/status` | Advance order status | ADMIN, SALES, PRESS |
| DELETE | `/:id` | Soft-delete order | ADMIN |

### Quotes — `/api/quotes`
| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/` | List quotes | ADMIN, SALES |
| POST | `/` | Create quote | ADMIN, SALES |
| GET | `/:id` | Get quote | ADMIN, SALES |
| PUT | `/:id` | Update quote | ADMIN, SALES |
| POST | `/:id/convert` | Convert quote to order | ADMIN, SALES |

### Invoices — `/api/invoices`
| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/` | List invoices | ADMIN, SALES |
| POST | `/` | Create invoice | ADMIN, SALES |
| GET | `/:id` | Get invoice | ADMIN, SALES |
| GET | `/:id/pdf` | Generate + download PDF | ADMIN, SALES |
| POST | `/:id/send-email` | Email invoice to customer | ADMIN, SALES |
| PATCH | `/:id/mark-paid` | Mark invoice as paid | ADMIN, SALES |

### Payments — `/api/payments`
| Method | Path | Description | Roles |
|---|---|---|---|
| POST | `/` | Record payment (deposit or balance) | ADMIN, SALES |
| GET | `/order/:orderId` | All payments for an order | ADMIN, SALES |

### Proofs — `/api/proofs`
| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/order/:orderId` | List proofs for an order | ADMIN, SALES, PRESS |
| POST | `/` | Upload proof file (multipart) | ADMIN, PRESS |
| PATCH | `/:id/approve` | Approve proof | ADMIN, SALES, CUSTOMER |
| PATCH | `/:id/reject` | Request revision | ADMIN, SALES, CUSTOMER |
| POST | `/:id/comment` | Add comment | All |

### Deliveries — `/api/deliveries`
| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/` | List deliveries (filter by date/driver) | ADMIN, DRIVER |
| POST | `/` | Schedule delivery | ADMIN, SALES |
| PATCH | `/:id/delivered` | Mark as delivered | ADMIN, DRIVER |

### Stock — `/api/stock`
| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/` | List all stock items | ADMIN, PRESS |
| POST | `/` | Add stock item | ADMIN |
| PATCH | `/:id/adjust` | Adjust quantity | ADMIN, PRESS |
| GET | `/alerts` | Items below min level | ADMIN, PRESS |

### Notifications — `/api/notifications`
| Method | Path | Description | Roles |
|---|---|---|---|
| POST | `/whatsapp/send` | Send WhatsApp to customer | ADMIN, SALES |
| POST | `/email/send` | Send email to customer | ADMIN, SALES |
| GET | `/log` | Full notification log | ADMIN |

### Reminders — `/api/reminders`
| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/schedule` | Get all reminder steps | ADMIN |
| POST | `/schedule` | Add reminder step | ADMIN |
| PUT | `/schedule/:id` | Update step (toggle, channels) | ADMIN |
| GET | `/upcoming` | Reminders due in next 7 days | ADMIN |
| GET | `/log` | Full reminder activity log | ADMIN |
| POST | `/send-now/:invoiceId` | Manually trigger reminder | ADMIN, SALES |
| PATCH | `/stop/:invoiceId` | Stop all reminders for invoice | ADMIN, SALES |

---

## Role-based access matrix

| Feature | Admin | Sales | Press operator | Driver | Customer |
|---|:---:|:---:|:---:|:---:|:---:|
| All orders | ✓ | ✓ | read | — | own |
| Create/edit orders | ✓ | ✓ | — | — | — |
| Invoices | ✓ | ✓ | — | — | own |
| Payments | ✓ | ✓ | — | — | — |
| Proofs | ✓ | ✓ | ✓ | — | approve |
| Deliveries | ✓ | ✓ | — | own | — |
| Stock | ✓ | — | ✓ | — | — |
| WhatsApp / email | ✓ | ✓ | — | — | — |
| Reminders config | ✓ | — | — | — | — |
| User management | ✓ | — | — | — | — |

---

## Key service logic

### `ReminderScheduler` (BullMQ cron — daily at 08:00 SAST)
```
1. Fetch all unpaid, non-stopped invoices
2. For each invoice:
   a. Calculate days_diff = today - invoice.due_date
   b. Find all active reminder schedule steps where step.days_offset === days_diff
   c. For each matching step:
      - Skip if already sent today (check ReminderLog)
      - Skip weekends if pause_weekends = true
      - Call NotifyService.sendWhatsApp() if channels includes 'wa'
      - Call NotifyService.sendEmail() if channels includes 'email'
      - Write to ReminderLog
3. Check escalation: if days overdue > escalation_days → flag account / hold
```

### `PaymentService.recordPayment()`
```
1. Create Payment record
2. If type === 'deposit': set order.depositReceived = true
3. If type === 'balance' OR amount >= outstanding balance:
   a. Set order.balancePaid = true
   b. Set all open invoices for order to PAID
   c. Call ReminderScheduler.stopForInvoice(invoiceId)
   d. Call NotifyService.sendConfirmation(customer) — thank-you WA + email
   e. Call NotifyService.notifyStaff(staffList, payment) — staff alert
```

### `InvoiceService.generate(orderId)`
```
1. Determine invoice type based on order.paymentType + deposit/balance state:
   - No deposit paid yet → Deposit Invoice (amount = depositAmount)
   - Deposit paid, balance outstanding → Balance Invoice (amount = totalValue - depositAmount)
   - COD or full → Tax Invoice (amount = totalValue)
2. Auto-generate invoice number (INV-YYYY-NNN)
3. Calculate VAT breakdown (15%)
4. Save to database
5. Return invoice record (PDF rendered on demand via GET /:id/pdf)
```

---

## Environment variables (`.env`)

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/printshop
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# WhatsApp Business API
WA_ACCOUNT_ID=your-account-id
WA_PHONE_NUMBER_ID=your-phone-number-id
WA_ACCESS_TOKEN=your-access-token

# Email
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=your-api-key
EMAIL_FROM=billing@printshoppro.co.za

# File storage
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your-anon-key
STORAGE_BUCKET=printshop-files

# App
PORT=3000
FRONTEND_URL=https://app.printshoppro.co.za
REMINDER_CRON=0 8 * * 1-5
TIMEZONE=Africa/Johannesburg
```

---

## Recommended deployment

```
Railway or Render (easiest for SA-based dev)
├── printshop-api   (Node.js service)
├── printshop-db    (PostgreSQL add-on)
└── printshop-redis (Redis add-on)

Frontend: Vercel or Netlify (React SPA)
Files: Supabase Storage (free tier generous)
Domain: Cloudflare (DNS + SSL)
```

**Estimated monthly cost (small shop):** ~R300–600/month on Railway or Render with a small PostgreSQL instance.

---

## Suggested build order

1. Set up Prisma schema + run migrations
2. Build auth routes (login, JWT middleware, role guard)
3. Customers + Orders CRUD
4. Payments + Invoice generation
5. PDF export (Puppeteer)
6. WhatsApp + Email integration (NotifyService)
7. File upload for proofs (Supabase Storage)
8. Reminder scheduler (BullMQ cron job)
9. Customer portal endpoints (read-only scoped to customer ID)
10. Connect React frontend to all API endpoints
