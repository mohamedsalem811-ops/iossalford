# SALFORD POS: Expo rebuild execution plan (version 3)

Status: Phases 0 to 9 are merged, with the full review and the new home screen. Staff phases S1 to S6 (accounts, permissions, the activity log and the clock guard, discounts, approvals, returns, the employee's account, shifts and the cash count, alerts, the stock count, device protection) are merged. The fixes from the full audit after S6 are merged (database 7). The review fixes and the end-of-day summary (R4, database 8) are in review; then Phase 10, switching over.

Every feature of the current app is kept. Items marked **NEW** don't exist in the current app. Unmarked items are the same as the current app, rebuilt with a new design.

## 1. What's fixed

- **iOS only:** one app for iPhone and iPad. No Android.
- **No data sharing.** Each device keeps its own data; a backup file moves data between them.
- **Starts empty.** Nothing is carried over from the current app.
- **New app ID** (`com.salford.pos`), so it installs next to the current app until you switch.
- **Two separate systems,** Jewelry and Scarves, as today.
- **Arabic, right-to-left, digits 0-9 only,** light and dark mode, as today.
- **No Apple Developer account for now.** Builds are unsigned `.ipa` files made on GitHub Actions, as today.
- **Devices:** iPhone on iOS 26.6, iPad on iPadOS 26.7.2. **Minimum iOS 26.0.**
- **Install method:** Sideloadly with a free Apple ID. Installs expire after 7 days; re-installing over the app keeps its data. A free Apple ID allows 3 sideloaded apps per device.
- **Backups stay on the device. No iCloud, no cloud of any kind** until the Apple Developer account exists (Phase 11).
- **Merging into `main` is done by the owner, manually.** Claude pushes to the work branch and opens pull requests; it never merges.
- **Latest stack:** Expo SDK 58 on React Native 0.88. **NEW**
- **Works fully offline.** The app never needs the internet: no web addresses, no network calls. The one connection it makes is a check for instant updates when the device is online (see 8.0a); with no internet it opens straight away with the version it has, and no shop data is ever sent. Only things outside the app need a connection: printing (the printer on the same Wi-Fi), sharing to WhatsApp and similar, the Expo Go preview, and Sideloadly's re-signing every 7 days. Every phase keeps it that way.

## 2. How each step works

**Owner's rule: after every step or task, test it, check it, and push it to the pull request.** No step is reported done until its checks pass and it is pushed.

1. I build the step on a work branch.
2. I test and check it myself before pushing: `npm run check` (TypeScript, lint, formatting, automatic tests **NEW**), `expo-doctor`, and an iOS bundle export.
3. I push it to the phase's open pull request right away, so every step shows up there with its CI results.
4. GitHub Actions builds:
   - the `.ipa` for your iPhone and iPad (as today);
   - **No simulator runs during the build (owner's decision, 2026-11-12).** You test each phase yourself on the iPhone and iPad. The simulator tap-through tests and screenshots, and a full test list of the whole app for you, wait for step 10.0, the last step before the Apple Developer steps. Most simulator failures were the test robot, not the app. Each feature's Maestro flow is still written in its phase, ready for 10.0.
5. **NEW: Expo Go preview.** The stage is published to the owner's Expo account; open it in Expo Go on the iPhone or iPad from the link or QR code.
6. You install the build (Expo Go preview, or the `.ipa` at key stages) and go through a short checklist.
7. Each phase is one pull request into `main`. While steps are pushed it stays a draft and only the fast checks run (about 1 minute). Once it is marked ready, every push also builds the `.ipa` (about 20 minutes). When the phase is complete I publish the Expo Go preview; you test it and the `.ipa` and tell me what needs fixing, then it is **merged by you**.

**Keeping it working for years (standing practice, from the long-life review):**

- **Re-signing until Phase 11:** every 7 days with Sideloadly; the owner treats it as mandatory (if it lapses, the data is safe but the app won't open until it is re-signed; Sideloadly's automatic refresh can help). From Phase 11 the app comes from TestFlight and then the App Store, and no longer expires weekly.
- **Once a year (accepted by the owner):** upgrade to the newest Expo SDK, with a full test run, so the app keeps building with new Xcode and iOS versions. The installed app keeps working without it.
- **The repository stays public:** that is why GitHub's Mac builds are free and unlimited (no shop data is in it). If it became private, the free plan allows only about 8 `.ipa` builds a month.
- **Every phase's self-check also covers growth:** nothing loads a whole table at once, and nothing slows down as the years of data grow.

**Expo Go (changed after the Phase 7 review):** the owner tests with the installed `.ipa`, so Expo Go is no longer a rule. Libraries Expo Go includes are still preferred; a library with its own native code is added only when it is clearly better, after asking the owner. The Expo Go preview is still published each phase while the app runs there. In Expo Go the app shows Expo Go's name and icon, and its data is separate from the installed app (test only).

## 3. Architecture (all NEW under the hood)

**Folder layout** (inside `mobile/` in this repository):

```
mobile/
  src/
    app/                   ← screens (Expo Router)
      index.tsx            ← choose system
      [system]/            ← the same screens for jewelry and scarves
        login.tsx
        (tabs)/            ← dashboard, sale, products, receipts, management
        sales.tsx, customer/[id].tsx, …  ← screens opened from the tabs
    screens/               ← whole screens used by the routes
    features/              ← screen parts per feature (sale, products, receipts, customers, …)
    components/            ← design system
    theme/                 ← colours, fonts, spacing
    domain/                ← business rules (tested)
    db/                    ← schema and migrations, one database per system
    backup/                ← saving, keeping and restoring backups
    security/              ← PIN and Face ID
    state/                 ← cart, lock, appearance
    hooks/                 ← iPad layout helpers
    lib/                   ← money, digits, dates, photos
    receipts/              ← receipt engine and the 5 designs (HTML)
    testing/               ← whole-flow screen tests
  modules/backup-exclusion/ ← the app's only native code (Swift)
  e2e/                     ← tap-through tests (Maestro)
```

**Libraries:**

| Area             | Choice                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Screens and tabs | Expo Router with native Liquid Glass tabs                                                                                     |
| Native controls  | `@expo/ui` (SwiftUI sheets, segmented control)                                                                                |
| Database         | `expo-sqlite`, plain SQL (same SQL tested on Node SQLite). **NEW:** replaces the JSON file                                    |
| Files            | `expo-file-system`, `expo-document-picker` (backups, photos, receipts)                                                        |
| Cart state       | Zustand                                                                                                                       |
| Lists            | FlashList                                                                                                                     |
| Photos           | `expo-image`, `expo-image-picker`, `expo-image-manipulator`                                                                   |
| Security         | `expo-secure-store`, `expo-crypto`, `expo-local-authentication`                                                               |
| Receipts         | HTML → `expo-print` and `expo-sharing`; live preview in `react-native-webview`                                                |
| Charts           | The app's own bars (no chart library); Apple's charts were compared in Phase 8 and the owner chose the app's own (2026-11-11) |
| Motion           | Reanimated 4, Gesture Handler, `expo-haptics`                                                                                 |
| Tests            | Jest + Maestro. **NEW**                                                                                                       |
| Previews         | EAS Update opened in Expo Go, through the owner's Expo account. **NEW**                                                       |

**Database:** one file per system.

- **Money as whole dirhams. NEW** No rounding errors.
- **Record numbers are never reused.** Same rule as today.
- **Where data lives (from Phase 8):** the databases and photos in a private folder of the app that the Files app can't show, so they can't be deleted or moved there by mistake. Only Backups and Receipts are in the folder Files shows (On My iPhone / On My iPad → SALFORD POS).
- **Long lists load as you scroll (from Phase 8),** so screens stay fast after years of sales.

| Table                        | Holds                                                                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `settings`                   | Exchange rate, receipt counter and year                                                                                                            |
| `brands`                     | Name, photo                                                                                                                                        |
| `products`                   | SKU, name, brand, category, scarf design id, size, colour, cost (LYD, USD and rate), price, stock, low-stock alert, photo, **archived flag (NEW)** |
| `customers`                  | Name, phone, area, notes                                                                                                                           |
| `sales` + `sale_lines`       | **NEW:** one checkout = one sale with several lines. Each line keeps a copy of name, brand, size, cost, price and rate                             |
| `payments`                   | Debt payments                                                                                                                                      |
| `returns`                    | Linked to the sale line or none, quantity, refund, cost, reason                                                                                    |
| `expenses`                   | Description, amount, month                                                                                                                         |
| `sets` + `set_items`         | Name, discount, pieces                                                                                                                             |
| `receipts` + `receipt_items` | Number, template, price mode, customer, sale link, items                                                                                           |
| `closings`                   | Quarter totals                                                                                                                                     |
| `stock_moves`                | **NEW:** stock adjustments with a reason                                                                                                           |

## 4. Phases and steps

### Phase 0: project setup

- **0.0 Done (PR #2):** the SwiftUI build runs only when SwiftUI files change; `.gitignore` covers Expo and Node output.
- **0.1** Create the branch and `mobile/`, a fresh Expo SDK 58 TypeScript project.
- **0.2** App settings:
  - name "SALFORD POS", ID `com.salford.pos`;
  - iPhone + iPad, all iPad orientations, Split View and Stage Manager;
  - automatic dark mode;
  - Arabic permission texts for Face ID, photos and the camera;
  - backups visible in the Files app under On My iPhone / On My iPad (never iCloud Drive).
- **0.2b** Create the Expo project `salford-pos` on the owner's account; the owner links this GitHub repository to it on expo.dev (one click), so previews can be published. **NEW**
- **0.3** Minimum iOS version 26.0.
- **0.4** Tooling: strict TypeScript, ESLint, Prettier, Jest. **NEW**
- **0.5** Checks workflow: types, lint and tests on every push. **NEW**
- **0.6** `.ipa` workflow: unsigned build for iPhone and iPad (same as today).
- **0.7** Simulator workflow: tap-through tests and screenshots on an iPhone and an iPad. **NEW**
- **0.8** A first empty test build with the SALFORD name and icon.

**You check:** it installs on both devices next to the current app, and the first preview opens in Expo Go.

### Phase 1: design system

- **1.1** Design tokens: colours (navy, gold, ice), light and dark mode, spacing, corners, shadows, text sizes that follow the iPhone setting.
- **1.2** Arabic app font, and receipt fonts matching the current designs.
- **1.3** Right-to-left layout forced on.
- **1.4** Digits: Arabic digits and the Arabic decimal mark typed in are turned into 0-9; the app never shows Arabic digits.
- **1.5** Money: LYD and USD formatting, conversion, and a discount split that never loses a dirham. **NEW:** fully tested.
- **1.6** Dates: month keys, quarters, Arabic month names with digits 0-9, Gregorian calendar.
- **1.7** Components:
  - cards, buttons, fields, number field with a "تم" key, section headers, empty states, KPI cards;
  - brand badges, filter chips;
  - sheets, menus, pickers, confirmation dialogs.
  - **NEW:** native SwiftUI controls and Liquid Glass.
- **1.8** iPad layout helper: side-by-side views and grid column counts. **NEW**
- **1.9** A component gallery screen in test builds only, screenshotted in light and dark mode on iPhone and iPad. **NEW**

**You check:** the gallery on both devices.

### Phase 2: database and business rules

- **2.1** Tables, migrations, automatic migration when a database opens. **NEW**
- **2.2** Database manager:
  - one database per system;
  - a database that can't be read is kept, never wiped.
- **2.3** Rules. Every current rule is kept, and **NEW:** each one has tests.
  - **Products:**
    - automatic SKU, never repeated;
    - edit;
    - delete.
    - **NEW:** a sold product is archived instead of deleted, so history stays correct.
    - **NEW:** stock adjustment with a reason.
  - **Scarf designs:** sizes you type, each with its own price and stock; delete a design.
  - **Brands:** "pandora " matches "Pandora"; add, rename (updates products), delete, photo.
  - **Customers:** found by phone first, then name; suggestions; cannot be deleted while owing money or being owed money.
  - **Cart:**
    - stock checked across the whole cart;
    - same item at the same price merges into one line;
    - quantity and price editable;
    - sets with the discount split between pieces;
    - a set is removed as a whole.
  - **Checkout:** all-or-nothing, with stock checked again, cost and rate copies saved, a customer required for credit, and the receipt issued automatically. **NEW:** saved as one sale with lines.
  - **Receipt numbers:** `GR-` and `SC-` plus the year, restarting every January, never reused.
  - **Returns:** against a sale (up to the quantity not yet returned) or without one; refund what the customer paid; stock goes back; delete reverses it.
  - **Deleting a sale:** puts back the stock not already returned and removes its returns.
  - **Debts:** credit sales − refunds on credit sales − payments; debtors list and total; "له رصيد".
  - **Expenses:** booked to a chosen month.
  - **Reports:**
    - period totals in LYD and USD;
    - breakdowns by brand, by category or material, by size;
    - daily sales.
    - **NEW:** by payment method, and top products.
  - **Quarterly closing:** issue, re-issue, delete.
  - **Backup:** export with photos; import checks the file and the system, asks you to confirm, and saves a safety copy first. **NEW:** the file has a version number.
- **2.4** Automatic tests for every rule, including edge cases (336 tests in the app by the end of Phase 7). **NEW**
- **2.5** Test data for test builds only. Your real app starts empty.

**Done when:** all tests pass. I'll send you the list.

### Phase 3: app shell and security

- **3.1** Root setup: fonts, theme, database, and an error screen that never deletes data.
- **3.2** System chooser with two large cards. **NEW:** remembers the last system you used.
- **3.3** Every screen works for either system.
- **3.4** PIN:
  - 8 digits on a 0-9 keypad, stored as a hash;
  - lockout after 5 wrong attempts, with a wait that grows each time.
  - **NEW:** you create both PINs on first launch; there is no default 01020304.
  - **NEW:** haptics on the keypad.
- **3.5** Face ID for jewelry only; scarves use the PIN.
- **3.6** Auto-lock in the background and a hidden preview in the app switcher.
- **3.7** Tabs: Dashboard, Sale, Products, Receipts, Management. **NEW:** native iOS 26 Liquid Glass tabs.
- **3.8** "Switch system" from the dashboard and from Management.
- **3.9** Tap-through tests for login, lockout and switching systems. **NEW**

**You check:** both PINs, Face ID, auto-lock, the app switcher.

### Phase 4: products, brands, scarves

- **4.1** Products list:
  - search by name, SKU or brand;
  - pinned brand filter;
  - category filter.
  - **NEW:** "low stock" and "out of stock" filters, and sorting.
- **4.2** Product row: photo, name, brand, SKU, price, stock; swipe to edit or delete, with confirmation. **NEW:** swipe to adjust stock.
- **4.3** Product form:
  - photo (camera or library);
  - name, brand (suggestions, or type a new one), category, size, colour;
  - cost in USD × rate = LYD, or LYD directly;
  - price and live margin;
  - stock and low-stock alert;
  - SKU with a duplicate check.
  - **NEW:** photos resized automatically.
- **4.4** Scarves: design cards with all sizes; design form with size rows (typed size, cost, price, stock); quick add for 90×90, 120×120 and 140×140.
- **4.5** Brands management: add, rename, delete, photo or initials badge, product counts.
- **4.6** Stock adjustment sheet with a reason. **NEW**
- **4.7** iPad: list on the leading side (the right, in Arabic), details or form beside it. **NEW**

**You check:** products with photos, scarf designs with sizes, brands.

### Phase 5: selling

- **5.1** Sale screen:
  - search, brand filter, category filter;
  - product grid with photo, name, price and stock.
  - **NEW:** 4–5 columns on iPad.
- **5.2** Tap to add; scarves open the size picker. **NEW:** long-press to choose quantity and price first, plus haptics.
- **5.3** Cart:
  - **iPhone:** cart bar that opens the cart sheet.
  - **iPad NEW:** the cart is always visible on the right.
- **5.4** Cart lines: quantity, price, remove, grouped set lines, stock warnings.
- **5.5** Add a whole set from the sale screen.
- **5.6** Checkout:
  - كاش / بطاقة / تحويل / آجل;
  - customer by phone or name, or new;
  - note;
  - totals in LYD and USD.
  - **NEW:** a success screen with "receipt" and "new sale".
- **5.7** Clear error messages, with the item name and size.

**You check:** a cash sale, a credit sale, a set, a scarf with a size, and an out-of-stock case.

### Phase 6: receipts

- **6.1** Receipt engine: A4 pages with page breaks, long names wrapped, mixed Arabic and English, logos. **NEW:** built from HTML templates.
- **6.2** The 5 templates:
  - jewelry: Salford Royal, Salford White, SALFORD • Swarovski (SALFORD's own receipt for Swarovski pieces; see the decisions);
  - scarves: SALFORD Libya, SALFORD Scarves.
- **6.3** Receipt studio:
  - number, date, time;
  - template cards;
  - "رسمية بالأسعار / هدية بدون أسعار";
  - customer;
  - item cards (title, brand, quantity, price), add and remove;
  - live preview.
  - **NEW:** reorder items.
- **6.4** Print (AirPrint, correct on iPad), share PDF (WhatsApp etc.). **NEW:** save straight to Files, on the device only.
- **6.5** Receipts tab:
  - history, search by number, customer or item;
  - open, edit, delete;
  - new manual receipt.
  - **NEW:** filter by month or template.

**You check:** printing and sharing from both devices, compared with the current receipts.

### Phase 7: management

- **7.1** Grouped hub: Sales, Customers, Money, Catalogue, App.
- **7.2** Sales history:
  - filters by month and payment method, search;
  - sale details, return button, delete with stock restore.
  - **NEW:** shows a whole checkout as one sale.
- **7.3** Returns: from a sale or without one; list; delete.
- **7.4** Customers: list, search, add, edit, details with purchases and balance, delete rules.
- **7.5** Debts: who owes money and the total; customer statement; record and delete payments; "له رصيد".
- **7.6** Expenses: month picker, warning for an already-closed quarter, list, delete. **NEW:** list grouped by month.
- **7.7** Sets: create and edit with a piece picker (scarf sizes shown), discount, price preview, how many are available.
- **7.8** Quarterly closing: choose a quarter, preview, issue or re-issue, history, delete.
- **7.9** Monthly comparison chart. **NEW:** choose the range of months.
- **7.10** Settings:
  - exchange rate editor;
  - change PIN;
  - version.
  - **NEW:** appearance choice (automatic, light or dark).
- **7.11** Backup (on the device only, no cloud):
  - one backup module handles saving, keep-last-10, restore and checks; "the device" is one destination, so iCloud can be added later without touching anything else;
  - backup files have a version number and a checksum, so today's backups still restore after iCloud is added;
  - export to the device's Files (On My iPhone / On My iPad → SALFORD), never iCloud Drive;
  - import only from files on the device, with checks, confirmation and a safety copy;
  - no iCloud features in the app; app data and backups are excluded from the device's own iCloud backup (installed `.ipa` only, not in Expo Go);
  - **NEW:** automatic backup every time the app goes to the background, keeping the last 10;
  - **NEW:** a reminder banner after 7 days without a copied backup, showing when the last copy was made;
  - **NEW:** copy a backup to the other device by AirDrop, or to a computer by cable (Finder or iTunes).
  - **Risk:** deleting the app deletes its data and backups. Re-installing over it is safe. Keep a copy on the other device or a computer.

### Phase 8: dashboard

**First, the fixes from the review of Phases 0 to 7** (approved by the owner on 2026-11-11). None of them changes how the app works:

- **8.0a Instant updates in the installed app** (brought forward from L6; no developer account needed). **NEW**
  - After one new `.ipa` with updates switched on, changes to the app's code (screens, rules, receipts, fixes) reach the iPhone and iPad just by opening the app; only native changes (a new native library or permission, the icon or name, the backup module, an Expo SDK upgrade) still need a new `.ipa`. I say which kind each change is.
  - Two channels: **preview** for testing (Expo Go, as now) and **production** for the installed app. Nothing is published to production without the owner's OK.
  - Each update is tied to the exact `.ipa` it was made for (fingerprint runtime version), so it never reaches an app that can't run it.
  - The app checks when it opens and the device is online, downloads in the background and never waits; the update runs on the next launch, or straight away from an "تحديث جاهز" prompt with a restart button.
  - If an update fails to start, the app goes back to the previous working version by itself; a bad update can also be rolled back with one command. Data, photos and backups are never touched by an update.
  - Settings shows the version running and its date, and a "تحقق من التحديثات" button.
  - Tested on the devices, including what happens after Sideloadly's weekly re-sign.
- **8.0b Hide the live data from the Files app.** The databases and photos move to the app's private folder; an existing install is moved over with all its data on first launch. Backups and Receipts stay visible in Files. Keeping them out of the device's iCloud backup covers the new folder too.
- **8.0c Long lists load as you scroll:** sales history, receipts and the other long lists. The list of months comes from one quick query, not from loading every sale.
- **8.0d The tab bar stays visible inside Management:** Sales, Customers, Debts and the rest open inside the Management tab, as in Apple's own apps, instead of covering the tabs.
- **8.0e iPad layout by type of screen, using the whole width:**
  - list with its details beside it, as in the iPad Settings app: the Management menu, Sales, Customers, Debts, Returns, Receipts;
  - cards that fill the width: Dashboard and Sale;
  - forms open as windows over the screen (as now).
- **8.0f Tap-through tests written** for selling, receipts, management and backup/restore (today only login, lockout, switching and products have them). They run in the final test run (9.6), or earlier for backups.

**Then the long-life fixes** (from the long-life review, approved by the owner on 2026-11-11), so the app keeps working the same after years of data and future upgrades:

- **8.0g Backups as copies of the database file.** Each backup is made by SQLite itself (fast, small, no memory spike), written under a temporary name and renamed only when complete, so a half-written backup can't exist. Whether anything changed is known from a change counter, without reading the whole database. Every backup is checked (database integrity, system, version) before it is kept or restored. Backups already made in the old format still restore.
- **8.0h Copy off the device written and read one photo at a time,** so memory stays small however many photos there are (today all photos are packed into memory at once, which would close the app with a few hundred photos). Copies made in the old format still restore.
- **8.0i Safe database upgrades,** for every future change to the tables:
  - a copy of the database is saved before any upgrade runs;
  - the links between tables are switched off while an upgrade rebuilds a table and checked afterwards, so a rebuild can never delete sale lines, returns or other linked records;
  - every upgrade also upgrades older backups, with a test that restores a backup from the first version;
  - database upgrades ship only in a new `.ipa`, never as an instant update, and a check blocks publishing such an update (otherwise a rollback or the weekly re-sign could bring back older code that can't open the upgraded database).
- **8.0j Restore writes the safety copy to the device first,** before any data is replaced, so it exists even if the app closes in the middle.
- **8.0k Safety net for unexpected errors:** if a screen hits a bug, it shows "حدث خطأ" with "حاول مجدداً" instead of closing the app, and the error is written to a log on the device (no internet involved). Settings can share the log, so every problem is found and fixed once.
- **8.0l Speed test** (moved from 9.4): 2,000 products and 10,000 sales, and a second run with 30,000 sales (about 5 to 10 years of use). Measured: opening every screen (target under a third of a second), a checkout, the dashboard, the long lists, saving a backup and making a copy with photos. Anything slow is fixed; the numbers go in the pull request.

Then the dashboard:

- **8.1** Header: system name with the switch menu, and the "$ rate" button that opens the rate editor.
- **8.2** Today: sales, profit, number of sales and pieces. **NEW:** cash vs credit.
- **8.3** Month picker and month summary: sales, cost, profit, returns, expenses, net profit, in LYD and USD.
- **8.4** Daily sales chart for the selected month: one bar per day, drawn by the app itself (digits 0-9 and the Arabic font guaranteed, right to left). **NEW:** tap a day to see its total. The owner compared it with Apple's own charts and chose the app's drawing (2026-11-11).
- **8.5** Needs attention: low and out-of-stock items, total owed by customers. **NEW:** "no recent backup" warning.
- **8.6** Breakdowns:
  - by category (by material for scarves);
  - by brand;
  - by size for scarves, with stock per size.
  - **NEW:** by payment method, and top products.
  - Shown as ranked rows with a bar in each row (easier to read than a pie when there are many brands).
- **8.7** Latest sales list.
- **8.8** Stock summary.
- **8.9** iPad: multi-column dashboard. **NEW**
- **8.10** End of phase: self-check, Expo Go preview, pull request. (The simulator screenshot run moved to 10.0.)

### Phase 9: polish

- **9.1** Animations and haptics. **NEW**
- **9.2** Arabic VoiceOver labels, very large text sizes, contrast in both modes. **NEW:** improved over today.
- **9.3** iPad:
  - every orientation;
  - Split View and Stage Manager sizes.
  - **NEW:** keyboard shortcuts with a hardware keyboard: ⌘F focuses the search of the screen in front (products, sale, receipts, sales, customers), ⌘N adds a new one (piece or design, receipt, customer); holding ⌘ lists them. A small native module (`modules/key-commands`), added with the owner's OK; needs a new `.ipa`.
- **9.4** Speed test with 2,000 products and 10,000 sales, repeated on the finished app (first done in Phase 8, step 8.0l). **NEW**
- **9.5** App icon, launch screen, app name. Owner's choice (2026-11-12) of two drawn from the logo's typefaces: **A, "Midnight"**: a white S with gold four-point stars and SALFORD in gold on dark navy, with dark-mode and tinted versions; the launch screen shows the same mark on navy.
- **9.6** ~~Full tap-through test run and final screenshots~~: moved to step 10.0 with the owner's full test list (owner's decision, 2026-11-12).

### Staff phases S1 to S6: employees, permissions and shop controls

**NEW** (owner's request and decisions, 2026-11-12). The shop has employees: each one signs in with their own name and PIN, and the owner alone keeps what belongs to the owner. Built in six phases, each delivered, checked and tested by the owner on the iPhone and iPad before the next one starts. They come before Phase 10, so the switch-over starts with the staff in place; the simulator tests of all of it are at the very end, in step 10.0, on both devices.

**The owner's decisions:**

- Two roles only: **owner** and **employee** (no manager).
- An employee's PIN is **6 digits**; an employee works in **both systems**; an employee sees **only their own sales total**.
- The **discount limits** are amounts in dinars, one **per piece** and one **per sale**, set by the owner in Settings; above them, the owner approves on the spot.
- **Returns:** within **24 hours** of the sale, with conditions checked and a **photo** of the returned piece, both required. A used item (warranty sticker removed, scarf worn, washed or perfumed) can't be returned by an employee. The owner may override the time limit and the conditions, with a reason.
- **Charged to the employee:** if a return turns out to break the conditions, the owner marks it "على حساب الموظف" and it goes on that employee's account; the owner may also waive it.
- **Auto-lock** of an employee after **7 minutes** without touching the screen. **2 minutes** before, a distinctive sound, a vibration and a countdown banner; one touch resets it. Both times are owner settings.
- **Shifts and cash count:** yes. Also every suggestion: automatic alerts, a reason for every exception, an owner emergency code, a stock count, an exchange, readiness for syncing, and a guide to lock the device itself (Guided Access, Screen Time).

**Engineering rules for all six phases** (how shops, banks and point-of-sale systems are built):

- **Least privilege, deny by default:** an account can do only what its permissions say; a new permission belongs to the owner until it is given to employees on purpose. If a permission or a setting can't be read, the action is refused (fail closed).
- **Permissions, not roles, in the code:** every action asks "may this person do `returns.create`?", never "is this an employee?". One file lists every permission (fixed names that TypeScript checks), and one table says which role has which. The app does not build if a permission is missing from the table.
- **Defence in layers:** the check runs inside the business rules themselves (the first line of every action that changes data), and every action knows who does it: the compiler refuses a call without the person. Owner-only screens are guarded as a whole (they can't open, even from a link), and buttons are hidden as well. If one layer is forgotten, the next one still refuses, with an Arabic message, before anything is written.
- **Two people for sensitive actions (maker and checker):** the owner's approval on the spot covers that one action only. The employee stays signed in.
- **Separation of duties:** the person who sells can't change stock, delete a sale or edit the log, so nobody can hide their own mistake.
- **A log that can only grow:** every action and its log line are saved in one transaction (both or neither). Each line carries a fingerprint of the line before it (a hash chain, as in bank ledgers), so any change made to the file outside the app is detected and the owner is told.
- **Policies are data:** the 24 hours, the discount limits, the lock times and the return conditions are owner settings with their change history, so a rule changes without an app update, and every action records the policy it was done under.
- **Nothing is really deleted:** an employee who leaves is suspended, not deleted. Every sale keeps a copy of the seller's name, as it already keeps the piece's name and price.
- **The clock is not trusted blindly:** the app remembers the latest time it has seen. If the device clock goes back (to get around the 24 hours), time-based actions are refused and the owner is alerted.
- **Every record gets a unique id and the device's id,** so the iPhone and iPad can be synced later (Phase 11) without collisions.
- **Tests:**
  - every action × every role, checking that a refused action wrote nothing;
  - a test that fails if a new action that changes data has no permission check;
  - edge tests: 23:59 and 24:01 after a sale, a discount at the limit and one dirham over, a clock going back, a suspended employee, the warning at exactly 5 minutes.
- **Database upgrades follow the existing rules:** a copy first; older rows are attributed to the owner; restoring older backups is tested; a schema change ships in a new `.ipa`.

**iPhone and iPad, as usual:** every new screen follows the iPad rules (lists with details beside them, cards filling the width, forms as windows), upright and sideways, in light and dark mode, in Arabic right to left with digits 0-9, fully offline.

#### Phase S1: accounts, sign-in and auto-lock

- **S1.1** Staff accounts, shared by both systems:
  - a small app-level store in the private folder (id, name, role, active, created at, must change PIN);
  - each PIN in the Keychain, hashed with PBKDF2, one per person.
- **S1.2** The owner account:
  - the current PIN of each system becomes the owner's PIN for that system, so nothing changes for the owner;
  - Face ID stays the owner's only;
  - an **emergency code** shown once at setup, to keep off the device; it lets the owner set a new PIN.
- **S1.3** Sign-in:
  - after choosing the system, the active people appear as name cards (a grid on iPad), then the PIN pad (6 digits for an employee);
  - each person has their own wrong-PIN count and lockout;
  - an employee changes the temporary PIN at their first sign-in.
- **S1.4** Staff management (owner only, Management → الموظفون):
  - add an employee with a temporary PIN;
  - reset a PIN;
  - suspend and reactivate;
  - on iPad, the list with the person's details beside it.
- **S1.5** The session:
  - every action knows who is signed in;
  - a "switch user" button;
  - the open cart is kept per person, and nobody else sees it.
- **S1.6** Auto-lock of an employee after 7 minutes without a touch:
  - 2 minutes before, a distinctive sound (it plays even on silent), a vibration and a countdown banner ("سيُقفل الحساب بعد 2:00، المس للمتابعة");
  - one touch resets it;
  - the owner chooses their own lock (the same, or only on leaving the app);
  - both times are settings.
- **S1.7** Copy the staff list to the other device by AirDrop, without the PINs: each employee sets their PIN there at their first sign-in.
- **S1.8** Checks and tests, a new `.ipa` (new tables), owner test on both devices.

**You check:** add two employees; sign in as each on the iPhone and the iPad; a wrong PIN locks only that person; the warning sound at 5 minutes; the lock at 7; your own sign-in unchanged.

#### Phase S2: permissions and what an employee sees

- **S2.1** The permission list and role table; the check inside every business rule that changes data; owner-only screens guarded as a whole.
- **S2.2** An employee's app:
  - selling, receipts, customers and debt payments;
  - no cost, profit, margin, month summary, reports or comparison;
  - products shown with their price and stock only;
  - Management shows only what they may open.
- **S2.3** An employee's home screen: the shortcuts, and their own sales today and this month only.
- **S2.4** The full test matrix (every action × both roles) and the test that catches an action without a check.
- **S2.5** Checks; an instant update if no table changes, otherwise a new `.ipa`; owner test.

**Built in S2 (brought forward from S3.1):** schema 2 records who made each sale and each receipt (with a copy of the name), because S2.3 needs "own sales only". Older records belong to the owner. Backups from schema 1, of both kinds, still restore. This is a table change, so S2 ships in a new `.ipa`. S3.1 adds the same to returns, payments, stock changes and expenses.

**How S2 works:**

- the permissions are in `mobile/src/staff/permissions.ts`;
- every action that changes data starts with `allow(ctx, '…')`;
- sales and receipts queries show an employee only their own (`visibleTo`);
- reports refuse to be read without `reports.view`;
- owner screens are wrapped in `<Allowed>`;
- `src/staff/permissions.test.ts` runs every action × owner, employee and nobody, and fails when an action has no check.

**You check:** as an employee, nothing about cost or profit appears anywhere, on both devices, and owner screens can't be opened; as the owner, everything is as before.

#### Phase S3: who did what, the activity log and the clock

- **S3.1** Every sale, return, payment, stock change, receipt and expense records who did it (with a copy of the name). Database upgrade with a copy first; older records are attributed to the owner.
- **S3.2** The activity log:
  - every action, every sign-in and every wrong PIN;
  - append-only with the hash chain;
  - checked when the system opens, and the owner is alerted if it was changed.
- **S3.3** Owner screens:
  - the log filtered by person and day (on iPad, the line's details beside it);
  - sales per employee in "ملخص الشهر".
- **S3.4** The clock guard: the latest time seen is kept; a clock going back refuses time-based actions and alerts the owner.
- **S3.5** A unique id and the device id on every new record, for syncing later.
- **S3.6** Checks and tests (including restoring older backups), a new `.ipa`, owner test.

**How S3 works:**

- schema 3 adds who did it (`by`, `by_name`) to returns, payments, stock changes and expenses, the `activity` table, and a unique id (`uid`) and the device id (`device`) on every main table; database triggers fill both on every new record, and older records get a unique id in the upgrade;
- every action calls `logAction` in its own transaction, after its changes (both are saved or neither); `src/staff/permissions.test.ts` fails when a checked action writes no line;
- each line holds the SHA-256 of the line before it plus its own content; `verifyLog` walks the chain a page at a time;
- the newest line is also kept in the Keychain, so lines removed from the end are found; when the system opens, the log is checked after the first screen, a break is written to the log once, and the owner sees a banner until they mark it seen;
- sign-ins, wrong PINs and the emergency code happen before the database opens: their lines wait and are written as soon as it does; staff changes go to the open system's log;
- the clock guard (`src/staff/clock.ts`) keeps the latest time seen in the Keychain; a clock more than 10 minutes behind refuses every change (reading still works), writes a log line and shows the owner a banner with "قبول وقت الجهاز";
- restoring a backup stamps this device's id again and starts the log check from the restored log;
- the owner screens: Management → سجل النشاط (by person and by day, a line's details on tap), and "البائع" in the month summary on the home screen (shown once an employee has sold).

**You check:** sell as an employee, then see the sale under their name in the log and in sales per employee; set the device clock back and see it refused and reported.

#### Phase S4: discounts, approvals, returns and the employee's account

- **S4.1** Discount limits in dinars, per piece and per sale, set in Settings. Above them, **the owner's approval on the spot** (Face ID or PIN) for that sale only. A reason is required, chosen from a list ("زبون دائم", "عرض"…) or typed.
- **S4.2** Returns, new rules:
  - only from the sale or its receipt number, and only pieces sold in it;
  - within 24 hours (a setting);
  - a condition checklist per system, editable by the owner (jewelry: warranty sticker intact, piece unworn; scarves: unworn, unwashed, no perfume, in its packaging);
  - a **photo of the returned piece is required**;
  - the refund is what the customer paid, and an employee can't change it;
  - a return of a credit sale lowers the customer's debt.
- **S4.3** Any condition answered "no", or past 24 hours, refuses the return for an employee, with no way around it. The owner may override, with a reason, logged.
- **S4.4** Exchange: a returned piece and a new one in one step, the difference paid or refunded, under the same return rules.
- **S4.5** The employee's account:
  - the owner can mark a return "على حساب الموظف" (or waive it);
  - each employee has a statement of amounts charged and repaid;
  - the owner records repayments.
- **S4.6** Checks and tests (the edges at the limit, 24 hours, overrides), owner test.

**How S4 works:**

- schema 4: a sale keeps its discount (off the list prices, sets excluded), the reason and whether the owner approved it; a return keeps its photo, the conditions as answered, the owner's reason when allowed past the rules, and the sale it was exchanged for; `staff_ledger` holds the employees' accounts;
- the rules are per system, in its settings (`src/domain/policies.ts`), set in Management → قواعد البيع والمرتجعات; until set: no discount without approval, 24 hours, the default conditions;
- the owner's approval on the spot (`src/staff/approvals.ts`): Face ID where it is set up, or the owner PIN, gives a one-time token for that one sale or return, valid two minutes; the business rule uses it up (`ownerSays`);
- returns: from the sale (its number or receipt number, in Management → مرتجع أو استبدال, or from the sale's details); a photo always; past the window or with a condition "no", only the owner allows it, with a reason; the refund is what the customer paid, and only the owner may give back less;
- an exchange is the return and the sale of what is in the cart, in one transaction;
- the returns list puts a refund "على حساب الموظف" or waives it; each employee's account (Management → الموظفون → the person → حساب الموظف) shows charges, waivers and repayments; an employee sees what they owe on their home screen.

**You check:**

- a discount within and over each limit, with your approval;
- a return at 1 hour, refused at 25 hours, refused with a condition "no", then overridden by you;
- an exchange;
- a return charged to an employee, then waived.

#### Phase S5: shifts and the cash count

- **S5.1** Opening a shift: the employee enters the cash in the drawer; selling needs an open shift.
- **S5.2** Cash in and out during the shift (paying a supplier, a change top-up), with a reason.
- **S5.3** Closing:
  - the employee counts the cash;
  - the app shows what should be there (opening + cash sales − cash refunds ± cash moves) and the shortage or extra in that person's name;
  - the owner can charge a shortage to the employee's account.
- **S5.4** The shift report: sales by payment method, returns, discounts, approvals, the count. Shown to the owner, and printable as a PDF.
- **S5.5** Checks and tests, owner test on both devices.

**You check:** a full shift as an employee with a cash sale, a card sale and a return; a count with a shortage of 5 د.ل; the report and the shortage on the employee's account.

**How S5 works:**

- schema 5: `shifts` (who, opened, the opening cash, closed, counted, expected, who closed it) and `cash_moves` (in or out, the amount, the reason); sales, returns, debt payments and the employees' accounts keep the shift they were made in (`shift_id`); one open shift per person;
- an employee sells, takes a return or a debt payment only in an open shift (`shiftFor` in `src/domain/shifts.ts`, refused with "افتح الوردية أولاً"); the owner may work without one, and then those sales are in no shift;
- Management → الوردية: open with the cash in the drawer, cash in or out with a reason, close with a blind count: the expected cash and the shortage or extra show only after closing; the home screen says "افتح الوردية للبيع" when no shift is open;
- expected = opening + cash sales + cash debt payments + cash in − cash out − refunds (a refund is paid from the drawer, except the return of a sale on credit, which lowers the debt);
- Management → الورديات وعدّ النقد (the owner): every shift with its difference, and its report: sales by payment method, returns, discounts, approvals, cash moves and the count; print or share as a PDF; a shortage goes on the employee's account in one tap; a shift an employee left open can be closed by the owner with the count;
- a person can read the report of their own shift.

#### Phase S6: alerts, stock count and device protection

- **S6.1** Automatic alerts for the owner in "يحتاج انتباهك":
  - many discounts or approvals by one person in a day;
  - a return minutes after its sale;
  - repeated wrong PINs;
  - a cash shortage;
  - the clock going back;
  - a log that was changed.
  - The thresholds are settings.
- **S6.2** Stock count:
  - an employee counts the pieces without seeing the expected numbers (a blind count);
  - the owner sees the differences and applies them as stock changes, with the reason "جرد".
- **S6.3** A guide in Arabic to protect the devices with iOS itself:
  - Guided Access keeps an employee inside the app;
  - Screen Time with the owner's code stops the app from being deleted (deleting it deletes the data) and locks "Set Automatically" for the date and time.
- **S6.4** Self-check of the six phases against these decisions; the Maestro flows for every staff feature written, ready for 10.0; docs; owner test.

**You check:** each alert by causing it; a stock count with one piece missing; the devices set up with the guide.

**How S6 works:**

- the owner's alerts (`src/domain/alerts.ts`) are read from what the app already records, over the last days set in the rules: one employee's discounted sales or approvals in a day, a return taken minutes after its sale, wrong PINs in a day, a shift closed short, the clock going back, a changed log; the owner's own discounts and returns raise none; each shows in "يحتاج انتباهك" with "فتح" (the shift report, the return or the log) and "اطلعت", which hides it and is logged;
- the limits are in Management → قواعد البيع والمرتجعات → التنبيهات (0 turns an alert off): 3 discounts, 3 approvals, 30 minutes, 3 wrong PINs, any shortage, over 7 days;
- schema 6: `stock_counts` and `stock_count_lines`; Management → جرد المخزون: anyone who sells starts a count, taps each piece and types how many are there; the stock is never shown; the stock at the moment a piece is counted is kept with it, hidden, so a sale later in the count is not a difference; "إنهاء الجرد" sends it to the owner;
- the owner opens the count (the same screen lists past counts): expected, counted and the difference per piece, missing and extra, at cost, and the pieces nobody counted (left as they are); "تطبيق" changes the stock with the reason "جرد رقم N" (never below 0); or cancel;
- Management → حماية الأجهزة (the owner): Guided Access, Screen Time against deleting the app, the date and time set automatically, Face ID with the owner's face only (it approves discounts and returns), and the employees' PINs.

**S6.4, the six phases against the decisions:** owner and employee roles only; a 6-digit employee PIN; employees see only their own sales; discount limits in dinars per piece and per sale with the owner's approval on the spot; returns within 24 hours with the conditions and a photo; "على حساب الموظف"; auto-lock after 7 minutes; shifts and the cash count; the alerts, the stock count and the guide. All are in place and tested; the Maestro flows (`e2e/staff*.yaml`) cover each staff feature and wait for 10.0.

### Audit fixes (after S6)

The full audit after S6 (a read-only check of the code, flows, tests and speed on a five-year shop) found 4 medium and 9 low issues. The owner approved fixing them in three batches:

- **Batch 1, money and speed:**
  - F-1: a kept cart can't sell at a changed price. Checkout compares each piece with its price now, and each set with the set now, and offers "تحديث الأسعار". A price agreed with the customer stays.
  - F-2: a sale with returns can't be deleted until its returns are undone, so no refund paid out disappears from the reports. A sale or a return in a closed quarter or a closed shift can't be deleted. Deleting a sale asks whether to delete its receipt too.
  - F-3: one save refreshes each open screen once, and a screen out of view reads again only when it comes back.
  - F-6: each open checks only the log lines added since the last check, and the whole chain once a week. A break keeps the next checks walking the whole chain.
  - F-7: the open shift is checked before the owner's approval is used up.
  - F-8: sales from before S3 count as the owner's in sales by seller.
- **Batch 2, safety and tools:** F-9 the staff list survives a crash while saving (the complete temporary file is used); F-10 a failed undo never hides the real error; F-12 the update tool pinned to a tested version (`EAS_CLI` in `scripts/publish-update.mjs`, raised on purpose) and time limits on the CI jobs (20 and 60 minutes); F-13 tests for the staff actions (add, PIN, rename, suspend, lock settings, emergency code, sending and receiving the list). F-11 (wrong PINs at the approval prompt count toward the owner's lockout) stays as it is, so guessing there is no easier than at sign-in.
- **Batch 3, database 7 (a new `.ipa`):**
  - F-5: indexes on the times of sales, returns and shifts (`sales_created`, `returns_created`, `shifts_closed`), for the alerts.
  - F-4: the shop's credit to a customer ("له رصيد") is paid back from the customer's page ("رد الرصيد للزبون", the owner only, `payouts.create`), in cash (it comes out of the shift's expected cash) or by card or transfer. The new `payouts` table is in backups; a payout is in the customer's statement and can be removed there if recorded by mistake. To use the credit on a new piece instead, sell it on credit (آجل) to that customer: it comes off what the shop owes.

### Review fixes and the end-of-day summary (R4, after the audit fixes)

The owner asked for an overall review after the audit fixes and approved six more fixes plus the end-of-day summary:

1. **Backup reminder with proof.** iOS reports the share sheet closing the same way whether the copy was sent or cancelled. The owner is now asked after sharing whether the copy reached the other device, Files on iCloud or a computer; only "نعم" resets the reminder (logged as `backup.copied`). The home screen shows it first and in red after 7 days, with the days counted.
2. **Use a customer's credit at checkout.** When the customer at checkout has "له رصيد", checkout shows it with "استخدام رصيده لهذا البيع", which switches the sale to credit and says what credit or debt is left.
3. **Database 8, returns keep their sale.** The `returns` table is rebuilt with its sale link `ON DELETE RESTRICT`, so the database refuses deleting a sale that has returns (the app already did). The id counter keeps the highest id ever given.
4. **Database 8, customers found by name with an index.** `customers.name_key` (the name as compared: digits 0-9, lower case, single spaces) with an index; filled on upgrade and after restoring an older backup. A migration can now run a step in code after its SQL (`after`).
5. **A kept cart from before the update** can't tell an agreed price from an old one: checkout asks, with "إبقاء السعر المتفق عليه" next to "تحديث الأسعار". Kept, it is a discount from today's price, checked like any other.
6. **The simulator flows run now** instead of waiting for 10.0 (owner's decision, 2026-11-13). Flows were added for the screens none covered (money, sets and an exchange, archived pieces, credit at checkout, the day summary). The first run (55) failed 19 of 26 flows on iPad and 17 on iPhone; a failure on one device is checked on the other and both are fixed together before the next run:
   - app: the PIN keypad could drop a digit when two keys came before the screen redrew; choosing a photo from the library no longer asks for access to the whole library (Apple's picker needs none; the prompt blocked later flows);
   - flows: Management rows are opened by one shared step that scrolls inside the menu column on iPad; the staff flows (S1 to S6), never run before, each stand alone instead of relying on the one before; the picker's first photo is tapped where it shows on iPad;
   - flows, from the iPhone side: the Management tab keeps its last section, so a second tap returns to the menu, and a row is brought to the middle so the floating tab bar doesn't take the tap; buttons below the fold (the return's photo and save) are scrolled to first; a row you can tap reads as one combined label and hides its second line, so checks match the whole label or the row's id (expenses, scarf designs, backups, the activity log); the employee's "no cost, no profit" checks match anywhere in a label.
   - then, at the owner's request, every flow was gone through step by step against the screens on both layouts, so the next run doesn't stop on the next step instead (owner's decision, 2026-11-13): a scroll stops with its target above 70% of the screen height, never under iPhone's tab bar; checkout is scrolled to its confirm button; the number pad is closed before the next tap; on iPad a Management row is tapped only once it is wholly on the screen, and the sale screen's "إضافة طقم" is found in the header's "More" menu when iPad folds it there; the photo picker is tapped at up to three spots, with a picture of it kept;
   - app, for the same pass: the header's icon buttons (إضافة طقم, إضافة قطعة, زبون جديد, طقم جديد, إيصال جديد, مرتجع بدون فاتورة) carry their name, so iPad's "More" menu lists them by name; a customer's purchases have an id for the flows.
   - run 57 (after that pass): iPad 19 of 25 flows passed, iPhone 12. Each failure's cause was checked against the run's screenshots, screen details and logs before fixing, on both layouts: scrolls to the last row of a list ran out of Maestro's 20-second default while it tried to bring the row higher (60 seconds now); the dashboard's last card is reached by swiping at the page's edge, since a drag that starts on the native segmented control doesn't scroll; "Chain Gold", added from the dashboard, is checked in the Products tab; Apple's photo picker was tapped while still loading (iPad) or closed without handing the photo over (iPhone, twice in three), so the flow waits for its photos, taps one by name, and picks again if no photo comes;
   - app, from run 57: the return search closes the keyboard (left open, iOS brought it back over the tab bar after the return form) and reads the sale again after a return ("أُرجع" showed 0); the photo buttons are never locked while a pick waits ("جارٍ تجهيز الصورة…" shows), and a new pick replaces one that never ended.
   - run 58: iPad 20 of 25 flows passed, iPhone 20. Every failure on both was the return photo: the simulator's log shows the picker handing the photo to the app each time, and then the app's resizing never ended. The app now keeps the photo as picked if resizing takes over 15 seconds (larger on disk, shown the same), and writes a slow step to the device log.
7. **End-of-day summary** (Management → المال → ملخص اليوم, and today's card on the home screen; owner only): any day's sales by payment method and by person, discounts and approvals, the cash (sales, debt payments, refunds, credit paid back, in and out, the day's net, shortages and extras), returns, expenses, and each shift with its count. Printed on A4 or shared as a PDF.

Fixes 3 and 4 change the database, so they need a new `.ipa` (database 8, which includes database 7).

### Features F1 to F3 (after R4: features 10, 16, 26, 30 and 34)

The owner chose five features from the list of additions and approved their plan (2026-11-14). Each phase is its own pull request, stacked on the one before and merged once its checks pass and the one before is merged. The simulator flows are written in each phase and run once at the end, on both devices, for all three; the owner installs one `.ipa` after that run passes.

**F1, instant update, no database change.**

1. **Quick discount (feature 10).** Buttons at checkout, "خصم 3% • 10 د.ل", one per percentage the owner sets in Management → قواعد البيع والمرتجعات (starting at 3; up to four, whole numbers from 1 to 50; empty hides them). The percentage is of the pieces' list prices, rounded down to a whole dinar, and taken off in whole dinars per piece so each piece and the receipt keep a round price (when the dinars can't be split evenly over the pieces of one line, the sale gets slightly less, never more). Sets keep their own price. Tapping the chosen button again puts the list prices back. It is a discount like a typed one: the employee limits, the owner's approval with a reason, and the log all apply.
2. **Customers' phones hidden from employees (feature 26).** A new permission "رؤية أرقام الزبائن": the owner's; an employee sees `091•••5678` in the customer list, the debts list, the customer page (no call button), the customer form (the number stays as it is) and the checkout suggestions, and a name holding a number ("زبون 0912345678") is masked the same way. The owner can give it to one trusted employee from الموظفون (tap the person; logged). For an employee, searching the customer list or the checkout suggestions by phone needs the whole number, so part of one lists nobody. Typing the full number at checkout still finds the customer; picking a suggestion doesn't fill in the phone, and the sale still goes to that customer. Printed receipts keep the phone in full.

**F2, database 9 (a new `.ipa`).** Products get `specs` ("المواصفات والخامة", optional free text up to 300 characters, searchable, shown on the product page, the iPad card and under the item on the receipt, with an on/off in the receipt studio). Customers get `gender` (أنثى / ذكر) and `image_file` (an optional real photo), with elegant portraits drawn in the system's colours when there is no photo: a woman (without hijab), a man and a neutral one, in the customer list, the customer page and the checkout customer card. A new `loyalty_moves` table is the points ledger for F3 (earn, redeem, reverse, adjust). Upgrade tests from 8 to 9. Built as planned, plus: the specs are kept on each receipt line (so a printed receipt never changes when the product is edited), the receipt studio has the on/off ("المواصفات والخامة تحت القطع") and a specs field per line, and a customer's photo is part of backups and is removed from the device once nothing uses it. A backup made before database 9 restores with the new fields empty.

**F3, instant update after F2: loyalty points, built switched off.** The owner sets the rules later in Settings → "نقاط الولاء": on/off, dinars per point, a point's value, the minimum to redeem and the largest share of a sale paid in points. Points paid are their own line, "مدفوع بالنقاط", not a discount. On a credit sale, points are earned only once the debt is paid. A return takes back its share of the points. Shown on the customer page, the receipt and the day summary; the owner can adjust a balance, and the change is logged.

As built: Settings → المال → نقاط الولاء (owner). The starting rules, used once they are turned on: a point for each 10 د.ل paid, a point pays 0.1 د.ل, from 100 points, up to 50% of a sale. Points pay part of a cash or card sale only, for a registered customer; the drawer, the shift count and the day summary count only the money ("مدفوع بالنقاط" is its own line on checkout, the sale, the receipt and the day). New points are earned on what was paid in money; on a credit sale, each debt payment earns its points (deleting the payment takes them back). A return takes back its share of the points earned and gives back its share of the points that paid, and the money refunded is the rest; points already spent are never taken below zero. A deleted sale, return or payment takes its points with it. A customer with points can't be deleted; with none, their history goes with them. Database 9 carries the columns this needs (`sales.points_paid`, `receipts.points_paid`, and each move's payment and value), so F3 itself is an instant update.

### Customers G1 to G3: customer details, the customer card, rewards and VIP (after F1 to F3)

The owner chose these on 2026-11-14 and, after the plan was checked against the code, approved every recommendation (answers recorded below). Each phase is its own pull request, built the same way as F1 to F3, with Jest tests and `npm run check` (and the speed test). There is no simulator run for these phases (owner's decision, 2026-11-14); the existing simulator flows are kept, and the one that uses the points button is updated to the new points field. Nothing is built until the owner says go. G1 and G2 change the database (database 10), so they ship together in one new `.ipa`. G3 is an instant update, sent only with the owner's OK.

**Owner's answers (2026-11-14):**

- **Visit reward:**
  - a sale counts as a purchase only from **500 د.ل**; several sales by the same customer on the same day are added together and count as one purchase (300 + 300 on one day is one purchase of 600);
  - after 3 counted purchases, the **4th gets 10% off, at most 250 د.ل**;
  - the 4th purchase itself must be **250 د.ل or more** to use the reward; a smaller sale leaves it waiting;
  - an unused reward **waits for the next purchase** and never expires;
  - the reward purchase doesn't count towards the next reward: counting starts again from the purchase after it;
  - purchases made before the owner turns rewards on don't count: counting starts the day rewards are turned on.
- **The reward with other discounts:** the 10% and the quick discount buttons ("خصم 3%") can't be used together; a price agreed with the customer stays, and the 10% comes off what is left. The 10% covers the whole sale, sets included, still at most 250 د.ل.
- **The reward with points:** the reward comes off first; then points can pay **up to 50%** of what is left.
- **Credit sales:** debts are kept per customer, not per sale, so a credit sale counts towards the reward and VIP when it is made, and a credit sale can use the reward.
- **A full return of the reward purchase** gives the reward back, waiting for the next purchase.
- **VIP:** more than **5,000 د.ل spent in the last 12 months** (sales less refunds), worked out automatically from the history; the owner can also mark a customer VIP, or never VIP, by hand. VIP customers **earn double points**.
- **Points at checkout:** up to 50% of the invoice; the employee types how much the customer wants to use (for example 20%), or taps a quick button.
- **Birthday:** day and month only, no year.
- **Extra details, all optional:** area (the existing "المنطقة"); how they heard about us; ring size and metal (jewelry) or favourite colours (scarves); notes (the existing "ملاحظات"); accepts offer messages.
- **How they heard:** buttons only, never typed: Facebook, Instagram, TikTok, صديق / زبون آخر, أخرى.
- **Employees see a spending range** ("أكثر من 2000 د.ل"), never the exact total; the owner sets the ranges (to start: under 500, 500+, 1000+, 2000+, 5000+, 10000+). On the customer page an employee sees each purchase's date and pieces, without amounts, so the total can't be added up. Only the owner sees the exact total; the owner can give it to a trusted employee, like the phones (F1).
- **WhatsApp buttons** are the owner's (and an employee given the phones), since phones are hidden from employees.
- **One settings screen,** Settings → المال → **"الولاء والمكافآت"** (owner), replacing "نقاط الولاء": points, the visit reward, VIP and the spending ranges, in sections.
- All the further suggestions are approved (G3 and "Rules that keep rewards fair").

**G1, database 10 (a new `.ipa`, together with G2): customer details and the customer card.**

1. **New customer at checkout.** The phone stays the main field. If it matches a customer, their card shows. If not:
   - name and gender (أنثى / ذكر / غير محدد, one tap, on the checkout itself; it sets the portrait);
   - the existing area field;
   - a button "تفاصيل إضافية (اختياري)" opening a half-sheet with: birthday (day and month), how they heard (the five buttons), ring size and metal (jewelry) or favourite colours (scarves), notes, accepts offer messages.

   A sale with only a phone still works. Details typed at checkout only fill a customer's empty fields; they never change what is already saved (that is done on the customer page). Notes typed at checkout replace the automatic "تمت الإضافة تلقائياً من نافذة البيع". The same fields are on the customer form, in sections (basic, details, preferences).

2. **The customer card at checkout,** compact, with "المزيد" for the rest:
   - portrait, name and phone (masked for employees, as in F1);
   - badge: جديد / عائد / VIP;
   - visits and the last visit ("منذ 12 يوماً");
   - spending: the exact total for the owner, the range for employees;
   - the reward progress ("●●●○");
   - points: the balance and what it is worth in dinars;
   - debt or credit warning ("عليه دين 120 د.ل" / "له رصيد 50 د.ل");
   - birthday this week (never the year);
   - ring size or preferences and notes;
   - the last 3 purchases;
   - a one-tap gender choice when the customer has none yet.

   On iPad the card is in two columns: the customer on one side, points and reward on the other. The card is worked out once per customer, not on every key press, and is timed in the speed test on the five-year test shop.

3. **The customer page** shows the same, plus the full history (amounts for the owner only). The owner sees the exact total and can set VIP by hand (automatic / always VIP / never VIP; logged).
4. **The customer list** shows the VIP badge, and for employees the spending range, on one line.
5. **New permissions:** set VIP by hand (owner), see the exact total spent (owner; grantable to an employee, like the phones), merge duplicate customers (owner, used in G3). Seeing permissions go after `costs.view` in the list, since the ones before it are the writes. The permission tests are updated.
6. **Database 10:**
   - customers get: birthday (month and day), how they heard, ring size, metal, favourite colours, accepts offers, and the owner's VIP choice;
   - sales get the reward taken off (`reward_off`) and whether the sale is an exchange's;
   - receipts get the reward line and the text printed under the total at the time of the sale (the points balance and "one purchase left"), so a receipt printed again later never changes;
   - a new table of wanted pieces for G3 (customer, what they want, the date, done or not), included in backups, so G3 needs no database change;
   - upgrade tests from 9 to 10; a backup made before database 10 restores with the new fields empty.

**G1 as built (2026-11-14):** everything above, with these notes:

- the extra details open in place on the checkout ("تفاصيل إضافية (اختياري)") instead of a half-sheet, so the keyboard and the scroll stay as they are on the rest of the checkout;
- whether a sale is an exchange's is read from the return that points to it (`returns.exchange_sale_id`, from S4), so no new column was needed on sales;
- the card's reward dots and the points line come with G2, which owns the reward and the new points field; the debt warning ("عليه دين") and the existing "له رصيد" are on the card now;
- the card's numbers are worked out once per customer and timed in the speed test (customer card, and the customer list with VIP and spending);
- new simulator flow `e2e/customer-card.yaml`, run only in the final simulator run.

**G2, ships with G1: visit reward, VIP and choosing the points.**

1. **"الولاء والمكافآت"** (owner), the visit reward off until turned on. To start: purchases from 500 د.ل, every 3 purchases, then 10% off at most 250 د.ل on a purchase of 250 د.ل or more; VIP from 5,000 د.ل in 12 months with double points; the spending ranges employees see. Every change is logged.
2. **The purchase count is worked out from the sales and returns,** from the day rewards were turned on and after the last reward used; it is not kept as a number. So a return, a deleted sale or an exchange corrects it by itself.
3. **At checkout,** on the reward purchase (250 د.ل or more), the progress dots show on the customer card and the button "تطبيق مكافأة 10%" shows in the totals, next to the quick discount buttons (which it turns off).
   - The 10% is taken off the pieces' prices in whole dinars, the way the quick discount is, and marked as the reward. So returns, profit, the shift's cash count and the day summary stay right without anything else.
   - The owner set it up in advance, so it needs no approval and isn't counted in the employee's discount limit (a typed discount on top still is); it is logged.
   - On the receipt it is its own line: "مكافأة الزيارة الرابعة".
   - If the seller doesn't apply it, checkout asks "لم يستخدم الزبون المكافأة؟" and keeps it for the next purchase.
4. **Choosing the points:** the "الدفع بالنقاط" button becomes a field in the totals showing the most that can be used ("حتى 120 د.ل (50%)"), with quick buttons (20%, 30%, the most) or a typed amount. More than 50% of what is left after the reward, or more than the balance, is refused with a clear message.
5. **VIP double points:** a VIP earns twice the points on what they pay in money, on cash and card sales and on debt payments. Points earned before becoming VIP aren't changed; a return already takes back its share of what was earned.
6. **On the receipt:** "بقيت لك عملية شراء واحدة للحصول على خصم 10%" and "رصيد نقاطك: 1,240 نقطة", saved with the receipt.
7. **The end-of-day summary and the activity log** show the rewards given and what they cost, apart from the other discounts.

**Rules that keep rewards fair (G2):**

- several sales by the same customer on the same day are added together and count as one purchase;
- a sale fully returned is taken off the count and the spending; a return on the reward purchase refunds the price paid after the 10%, and a full return gives the reward back;
- a deleted sale takes its count with it; if it used the reward, the reward goes back to waiting;
- an exchange is not a new purchase and can't use the reward;
- a purchase counts only for a registered customer with a phone.

**G2 as built (2026-11-14):** everything above, with these notes:

- the reward is applied by checkout itself (`reward: true`): it checks the reward is ready, the sale is 250 د.ل or more and no quick discount is chosen, then takes the 10% off the prices it saves; the employee's discount limit is checked on the prices before it;
- "ready" also needs the purchase that completed the count to be on an earlier day, since a day's sales are one purchase;
- the points field takes a number of points, with 20%, 30% and "الأقصى" (the most allowed, half of what is left after the reward);
- the receipt prints "Visit reward / مكافأة الزيارة" and a footer kept from the sale (points left, purchases to the next reward); the day summary shows the rewards used;
- `e2e/loyalty-points.yaml` now taps "الأقصى" and photographs the reward section; a 4-visit reward can't be shown in one simulator day, so it is covered by the Jest tests.

**G3, instant update after G1 and G2 (no database change).**

1. **Birthdays:** an optional birthday gift or discount in the birthday week (set in "الولاء والمكافآت"); a list on the home screen, "أعياد ميلاد هذا الأسبوع"; a WhatsApp button for customers who accept offers.
2. **"Haven't come back":** customers with no purchase in 90 days, each with a WhatsApp button (only those who accept offers).
3. **WhatsApp:** a `wa.me` link with the number in international form and a ready message, so it needs no native change; the app itself stays offline. The buttons are the owner's (and an employee given the phones).
4. **Wanted pieces (jewelry):** note a piece a customer asked for ("تريد سوار ذهب عيار 21"); when a matching product is added, the app reminds the owner who wanted it.
5. **Owner reports:** where customers come from (Facebook, Instagram, TikTok, friend, other) with what each brought in; the top customers this month and this year; the share of returning customers; rewards and points given and what they cost.
6. **Duplicate customers:** a warning when the same name appears with two phones, with a merge (owner; logged) that moves the purchases, payments, credit paid back, points, receipts, wanted pieces and notes to the customer kept.

**G3 as built (2026-11-14):** everything above, with these notes:

- the birthday gift is a short text the owner sets in "الولاء والمكافآت" ("هدية مجانية", "خصم 5%"); it shows on the customer card in the birthday week and in the birthday message, and the seller gives it (a gift, or the usual discount);
- birthdays, "لم يعودوا" (90 days), the duplicates and the owner's report are one screen, Customers → "متابعة الزبائن"; the home screen's "يحتاج انتباهك" lists this week's birthdays and opens it;
- tapping a customer there offers a ready WhatsApp message (`wa.me`) when they accept offers and the person may see phones, or opens their page;
- wanted pieces are on the customer page (both shops); a new piece whose name, brand, category or colour shares a word with an open request shows who asked for it;
- the merge moves sales, debt payments, credit paid back, points and wanted pieces, fills the empty details, joins the notes, and is logged;
- new simulator flow `e2e/customer-care.yaml`, run only in the final simulator run.

### Phase 10: switching over

- **10.0** **NEW** Full test of the whole app, before switching over and before the Apple Developer steps (owner's decision, 2026-11-12):
  - the simulator tap-through tests (Maestro) and screenshots on an iPhone and an iPad, upright and sideways, including every staff feature of phases S1 to S6 (signing in as owner and as employee, what an employee can't see, the auto-lock warning, discounts and approvals, returns refused and overridden, a full shift); I fix what fails and every layout problem the screenshots show;
  - a complete test list for you: every screen and action of both systems, as owner and as employee, step by step, to tick off on your iPhone and iPad.
- **10.1** Release build, version 1.0.0:
  - version 1.0.0, a new build number, the test-only screens (component gallery, test data) confirmed absent;
  - speed test and the full checks once more; the `.ipa` installed on both devices and recorded for instant updates;
  - the Expo Go preview retired (the installed app is the only way to test from here).
- **10.2** You set up both PINs and enter your products and brands (the new app starts empty, as decided). Then the first backup, copied to the other device.
- **10.3** A few days of real use with the current app still installed. What you find is fixed and sent as instant updates (or a new `.ipa` when native).
- **10.4** Delete the old app, only after a fresh backup has been copied off the device.
- **10.5** **NEW** Retire the old SwiftUI app in the repository: its build workflow switched off and its code kept in history, so only the Expo app is built from then on (with your OK).

### Phase 11: Apple Developer account and the App Store

Once the build (Phases 0 to 10) is finished, the owner gets the Apple Developer account ($99 a year) and the project ends by putting the app on the App Store (owner's decision, 2026-11-11). This replaces the old "Later" list; its step numbers are kept in brackets. All **NEW**:

- **11.1 The account:** the owner creates it; the app's ID (`com.salford.pos`) and name ("SALFORD POS") are reserved in App Store Connect. If another developer already holds either, a close one is chosen before anything else.
- **11.2 Signed builds** (L1): GitHub Actions signs each build and uploads it to App Store Connect. The signing keys are kept as GitHub secrets, never in the repository.
- **11.3 TestFlight on both devices** (L5), replacing Sideloadly. Before switching, a copy is made off each device; if the data doesn't carry over to the signed app, the copy is restored. The PINs are set again, as the signed app has its own secure storage.
- **11.4 iCloud backup** (L2) and **choosing where each backup goes** (L3: device only, iCloud only, or both). Owner's choice of iCloud Drive or private iCloud storage.
- **11.5 Stronger file protection** (L4): the data stays locked while the device is locked.
- **11.6 Final polish for the App Store:**
  - store icon, screenshots for iPhone and iPad, Arabic name, subtitle, description and keywords;
  - App Privacy: "no data collected"; a privacy policy and support page (a simple free page);
  - review notes for Apple (how to create the two PINs and try the app);
  - other companies' brand names kept out of the listing and screenshots;
  - a last full tap-through test run and screenshots on iPhone and iPad.
- **11.7 Submit** (L7): public on the App Store, or unlisted (found only through its link), owner's choice. Anything Apple's review asks for is fixed and resubmitted.
- **11.8 After approval:** native changes go out as App Store updates; fixes to the app's code as instant updates (8.0a), within Apple's rules.

Instant updates (L6) were already moved to Phase 8 (8.0a).

## 5. Summary

|                       | Count                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current features kept | All. Nothing is removed.                                                                                                                                                                                                                                                                                                                                                                  |
| New features          | 17: iPad layout, automatic backups and reminder, archived products, one sale per checkout, stock reasons, stock filters and sorting, long-press add, receipt item reordering, receipt filters, payment-method and top-product breakdowns, cash vs credit today, appearance setting, no default PIN, remembering the last system, keyboard shortcuts, animations and haptics, Liquid Glass |
| New under the hood    | SQLite database, money as whole dirhams, automatic tests, tap-through tests with screenshots                                                                                                                                                                                                                                                                                              |

## 6. Decisions on record

- Rebuild in `mobile/` in this repository, next to the SwiftUI app.
- New app, starts empty; no data migration.
- iOS only (iPhone and iPad), minimum iOS 26.0; no Android; no device sync.
- Unsigned `.ipa` from GitHub Actions, installed with Sideloadly.
- Previews in Expo Go through the owner's Expo account. Until Phase 7 only Expo Go-compatible libraries were used; since the Phase 7 review Expo Go is preferred but no longer a rule (see section 2).
- Backups on the device only; iCloud backup postponed to Phase 11 (11.4).
- The owner merges every pull request.
- Keep every receipt template; digits 0-9 only. The Swarovski London design is not rebuilt as it was: it copied a Swarovski store's name, address, phone and thanks, which makes it a receipt from a real company that did not make the sale. Its place is SALFORD's own receipt for the Swarovski pieces it sells (owner to confirm in Phase 6).
- After every step or task: test, check, push to the pull request.
- Database: plain SQL instead of Drizzle, so every rule is tested against a real SQLite database with the exact SQL the app runs.
- Design approved: Mix B + C with the centred logo, light and dark (`docs/DESIGN.md`). Logos redrawn as lettering.
- Everything kept up to date: newest stable Xcode on `macos-26`, latest GitHub Actions, Node LTS, and the newest package versions the Expo SDK supports.
- The old SwiftUI app keeps its minimum iOS 16 (no effect on the owner's devices; it is being replaced).
- PINs: 8 digits, salted SHA-256 in the Keychain (this device only, never backed up). Easy PINs (one digit repeated, straight runs) are refused. First-launch setup only asks for a system that has no PIN yet, so an interrupted setup can't be used to replace a saved PIN.
- Locking: going to the background locks; the app switcher and the Face ID prompt only hide the screen behind the logos. The start screen always locks, so entering any system needs its PIN (or Face ID for jewelry).
- The design gallery is opened only by its link (`salfordpos://gallery`), not from the start screen.
- End of every phase (owner's rule): before the phase is handed over, Claude re-checks the whole phase against this plan and against how the app is really used, and fixes or adds anything missed or done wrong, without waiting to be asked (as with the exchange-rate editor in Phase 4). What was found is listed in the pull request.
- Testing: every push runs the fast checks (types, lint, unit and screen tests) and builds the `.ipa`; Claude publishes the Expo Go preview each phase. The owner tests on the iPhone and iPad and reports what needs fixing. No simulator runs during the build (owner's decision, 2026-11-12): the simulator tap-through and screenshots, and the owner's full test list, are step 10.0.
- Photos: taken or chosen, resized to at most 1600 px, kept in the app's own folder per system (only the file name is in the database). A photo file is deleted only when no product, scarf size or brand shows it.
- A cost entered in dollars keeps the rate it was bought at; editing a piece reprices it only when the dollar cost itself changes.
- iPad: the list is on the leading side (the right, in Arabic, as in iOS's own apps) and the open piece beside it.
- Face ID works only in the installed `.ipa`: Expo Go cannot use Face ID on iOS (Expo's own limitation). In Expo Go the login says so and the PIN is used; in the app, a failed or blocked Face ID says why.
- The exchange-rate editor is on the dashboard from Phase 4 (tap "سعر الصرف"), because dollar costs need the real rate; Phase 7 adds it to Settings too.
- Selling: while a sale is open, the cart bar sits above the tabs on iPhone (the iOS 26 tab bar accessory, as in Apple Music) and the Sale tab shows the number of pieces; on iPad the cart is always beside the products, on the right. The cart is kept until checkout, also while the app is locked; fully closing the app empties it (nothing is sold until checkout).
- Sets management (create, edit, delete; item 7.7) was brought forward into Phase 5 so a set can be sold and tested now. It is under Management → Sets and from the sets button on the sale screen.
- After checkout the success screen shows the total and the receipt number; "الإيصال" opens the receipt studio to print, share or edit it.
- Receipts: printing makes an A6 PDF (105 × 148 mm, the shop's receipt paper, with narrower side margins and tighter spacing so a usual receipt fits on one sheet); sharing and Files use A4. Both run edge to edge: every size is a fraction of the paper's width, so the receipt fills the page whatever scale iOS prints at. Printing or sharing saves the receipt first, so the PDF has its number. iOS's web printing cannot put "page 1 / 2" on each page; instead each continued page repeats the table header with the receipt number. Saved PDFs go to the app's Receipts folder (Files → On My iPhone/iPad → SALFORD POS → Receipts); in Expo Go they stay inside Expo Go.
- Management (Phase 7): the hub is grouped (sales, customers, money, catalogue, app). Changing a PIN asks for the current PIN first (wrong attempts count towards the lockout). Appearance (automatic, light, dark) applies to the whole app, native parts included. The monthly comparison is drawn with plain bars (no chart library) and offers 3, 6 or 12 months; Phase 8 decides the dashboard's charts.
- Backups (Phase 7; from Phase 8 as copies of the database file, see 8.0g): saved on the device as JSON, last 10 per system, by hand, and automatically when the app goes to the background, when the system is locked or switched (skipped when nothing changed). These copies hold the data; the photos stay in the app's folder. A copy made to leave the device (AirDrop, Files, a computer) is one file with the data and the photos. Restoring checks the file, shows what it holds, asks, and saves a safety copy first (restorable). The reminder shows after 7 days without a copy off the device (before any copy, counted from the first backup).
- Keeping the data out of the device's own iCloud backup needs one iOS setting that no Expo library offers, so the app has one small module of its own (`mobile/modules/backup-exclusion`, Swift). It runs in the installed `.ipa` only; Expo Go does not have it and the app works there without it. It is the app's only native code.

- Review of Phases 0 to 7 (2026-11-11), approved by the owner, without changing how the app works:
  - **Fixes**, done first in Phase 8 (8.0b to 8.0e): the live data hidden from the Files app; long lists loaded as you scroll; the tab bar kept inside Management; the iPad layout planned by type of screen (list with details beside it, cards filling the width, forms as windows).
  - **Plan changes:** the speed test moved to Phase 8 (8.0l); no chart library: the dashboard draws its own bars, with tap-to-see the day's total and breakdowns as ranked rows, and the first Phase 8 preview compares them with Apple's own charts; the missing tap-through tests written in Phase 8 (8.0f); this document brought up to date.
  - **Way of working:** a screenshot run on iPhone and iPad at the end of every phase (replaced on 2026-11-12: all simulator runs moved to step 10.0); Expo Go no longer limits the choice of libraries (a native library only when clearly better, after asking).
  - **Instant updates** (L6) brought forward to the first step of Phase 8 (8.0a): they don't need the developer account. Updates go to the installed app only with the owner's OK; offline use is unchanged.
- After the Phase 8 test (2026-11-12): the backup picker accepts every file (iOS has no type for ".db"); one automatic backup per hour plus the newest of each of the last 7 days; date-first backup names; a new home screen and photo cards for products on iPad, sent as an instant update. Opening a backup straight from AirDrop or Files ("Open in SALFORD") was offered and declined: a backup is restored from Backup → Restore.
- Full review (2026-11-12), all approved by the owner: a quick second tap can no longer save twice (sale, payment, expense, product, return, receipt); the open cart is kept across iOS closing the app; the database signals every change so screens can't miss a refresh; a weekly database check shown on the home screen; PINs stored with PBKDF2; the receipt preview runs no scripts; archived pieces can be brought back from Management; a note when a piece is priced below its cost; the biggest files split and leftover code removed.
- Home screen like the old app (owner's request, 2026-11-12), in both systems: three shortcuts at the top (بيعة جديدة, إيصال جديد, قطعة جديدة / تصميم جديد) and "ملخص الشهر" with a calendar chip for the month and four tiles (صافي المبيعات, ربح المبيعات with the margin, المصاريف والمرتجعات, صافي الربح in dollars), each with a dot comparing with the month before.
- Staff (2026-11-12): owner and employees with their own PINs, permissions, returns within 24 hours with conditions and a photo, discount limits per piece and per sale, shifts and cash count, an activity log, alerts, stock count; planned as phases S1 to S6 before Phase 10 (see the staff phases).
- Offline: the app works fully without the internet, and every phase's self-check confirms nothing new needs it.
- Long-life review (2026-11-11), approved by the owner: backups become copies of the database file, written safely and checked (8.0g); the copy off the device is handled one photo at a time (8.0h); database upgrades are made safe and ship only in a new `.ipa` (8.0i); restore saves its safety copy first (8.0j); errors show a retry screen and go to a log on the device (8.0k); the speed test also runs with 30,000 sales (8.0l). Standing practice: Sideloadly's automatic refresh, one Expo SDK upgrade a year, the repository kept public (section 2).
- Owner (2026-11-11): re-signing every 7 days is mandatory until the developer account, and the yearly Expo SDK upgrade is accepted. Once the build is finished the owner gets the Apple Developer account, and the project ends with Phase 11: TestFlight, iCloud backup, final polish and submitting to the App Store (no longer optional).

- Phase 8 (built, owner to test): instant updates need one new `.ipa` (build 2) before they reach the devices; after installing it, it is recorded with `npm run update:record`. Backups are now copies of the database file (`.db`); `.json` backups from before still restore. A restore keeps sale and receipt numbers from ever repeating, also from an older backup (found while testing 8.0g). The speed test is `npm run speed`: with 2,000 products and 30,000 sales every screen reads in under 25 ms on a computer (Customers and Debts were changed to one query for all balances). The dashboard's daily chart has a temporary switch to Apple's charts so the owner can choose; the other one is removed afterwards. Errors are kept in a log on the device (Settings → سجل الأخطاء).

Status: Phases 0 to 9 are merged, with the full review and the new home screen. Staff phases S1 to S6 (accounts, permissions, the activity log and the clock guard, discounts, approvals, returns, the employee's account, shifts and the cash count, alerts, the stock count, device protection) are merged. The fixes from the full audit after S6 are merged (database 7). The review fixes and the end-of-day summary (R4, database 8) are in review; then Phase 10, switching over.
