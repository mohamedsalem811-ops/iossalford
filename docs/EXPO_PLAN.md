# SALFORD POS: Expo rebuild execution plan (version 3)

Status: **in progress** (see the end of this file).

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
- **Backups stay on the device. No iCloud, no cloud of any kind** until the Apple Developer account exists (see "Later").
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
   - **NEW: at the end of every phase, a screenshot run:** the phase's new screens on an iPhone and an iPad simulator, upright and sideways. I look at every screenshot and fix what is wrong before handing the phase over, because layout problems only show on a real screen (tests can't see them). About an hour of GitHub's time; no work for you.
   - **NEW: the full tap-through test** (Maestro) runs at the end of the project, or earlier when a change is critical (security and PINs, saving data, backups); I say when and why. GitHub's macOS simulators are slow, and a run takes about an hour.
5. **NEW: Expo Go preview.** The stage is published to the owner's Expo account; open it in Expo Go on the iPhone or iPad from the link or QR code.
6. You install the build (Expo Go preview, or the `.ipa` at key stages) and go through a short checklist.
7. Each phase is one pull request into `main`. While steps are pushed it stays a draft and only the fast checks run (about 1 minute). Once it is marked ready, every push also builds the `.ipa` (about 20 minutes). When the phase is complete I publish the Expo Go preview; you test it and the `.ipa` and tell me what needs fixing, then it is **merged by you**.

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

| Area             | Choice                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Screens and tabs | Expo Router with native Liquid Glass tabs                                                  |
| Native controls  | `@expo/ui` (SwiftUI sheets, segmented control; also has Apple's charts)                    |
| Database         | `expo-sqlite`, plain SQL (same SQL tested on Node SQLite). **NEW:** replaces the JSON file |
| Files            | `expo-file-system`, `expo-document-picker` (backups, photos, receipts)                     |
| Cart state       | Zustand                                                                                    |
| Lists            | FlashList                                                                                  |
| Photos           | `expo-image`, `expo-image-picker`, `expo-image-manipulator`                                |
| Security         | `expo-secure-store`, `expo-crypto`, `expo-local-authentication`                            |
| Receipts         | HTML → `expo-print` and `expo-sharing`; live preview in `react-native-webview`             |
| Charts           | The app's own bars (no chart library); Apple's charts from `@expo/ui` compared in Phase 8  |
| Motion           | Reanimated 4, Gesture Handler, `expo-haptics`                                              |
| Tests            | Jest + Maestro. **NEW**                                                                    |
| Previews         | EAS Update opened in Expo Go, through the owner's Expo account. **NEW**                    |

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
- **8.0f Speed test** (moved from 9.4): 2,000 products and 10,000 sales, measured on the dashboard and the long lists; anything slow is fixed.
- **8.0g Tap-through tests written** for selling, receipts, management and backup/restore (today only login, lockout, switching and products have them). They run in the final test run (9.6), or earlier for backups.

Then the dashboard:

- **8.1** Header: system name with the switch menu, and the "$ rate" button that opens the rate editor.
- **8.2** Today: sales, profit, number of sales and pieces. **NEW:** cash vs credit.
- **8.3** Month picker and month summary: sales, cost, profit, returns, expenses, net profit, in LYD and USD.
- **8.4** Daily sales chart for the selected month: one bar per day, drawn by the app itself (digits 0-9 and the Arabic font guaranteed, right to left). **NEW:** tap a day to see its total. The first preview also shows the same chart drawn with Apple's own charts, so the owner can compare and choose on the devices.
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
- **8.10** End of phase: self-check, screenshot run on iPhone and iPad (upright and sideways), Expo Go preview, pull request.

### Phase 9: polish

- **9.1** Animations and haptics. **NEW**
- **9.2** Arabic VoiceOver labels, very large text sizes, contrast in both modes. **NEW:** improved over today.
- **9.3** iPad:
  - every orientation;
  - Split View and Stage Manager sizes.
  - **NEW:** keyboard shortcuts (⌘F search, ⌘N new product).
- **9.4** Speed test with 2,000 products and 10,000 sales, repeated on the finished app (first done in Phase 8, step 8.0f). **NEW**
- **9.5** App icon, launch screen, app name.
- **9.6** Full tap-through test run and final screenshots on iPhone and iPad. **NEW**

### Phase 10: switching over

- **10.1** Release build, version 1.0.0.
- **10.2** You set up both PINs and enter your products and brands.
- **10.3** A few days of use with the current app still installed.
- **10.4** Delete the old app.

### Later, with an Apple Developer account ($99 a year)

Done **after the project is finished**, one step at a time; none of it changes the project before then. All **NEW**:

| #   | Step                                                                       | What it adds                                                            |
| --- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| L1  | Sign the app with the developer account                                    | Installs last 1 year instead of 7 days; no weekly Sideloadly re-signing |
| L2  | **iCloud backup** (iCloud Drive or private iCloud storage, owner's choice) | Automatic copy off the device; restore on a new iPhone or iPad          |
| L3  | Choose where each backup goes                                              | On device only, iCloud only, or both                                    |
| L4  | Stronger file protection                                                   | Data stays locked while the device is locked                            |
| L5  | TestFlight installs                                                        | Install and update from TestFlight instead of Sideloadly                |
| L6  | Instant updates (EAS Update in the real app): moved to Phase 8 (8.0a)      | Small fixes reach the installed app without reinstalling                |
| L7  | App Store (optional)                                                       | Only if wanted; it can stay private                                     |

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
- Backups on the device only; iCloud backup postponed to step L2.
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
- Testing: every push runs the fast checks (types, lint, unit and screen tests) and builds the `.ipa`; Claude publishes the Expo Go preview each phase. The owner tests on the iPhone and iPad and reports what needs fixing. From Phase 8, every phase ends with a screenshot run of its new screens on an iPhone and an iPad simulator (upright and sideways), reviewed and fixed before handover. The full simulator tap-through (Maestro) runs at the end of the project, or earlier for a critical change (security and PINs, saving data, backups).
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
- Backups (Phase 7): saved on the device as JSON, last 10 per system, by hand, and automatically when the app goes to the background, when the system is locked or switched (skipped when nothing changed). These copies hold the data; the photos stay in the app's folder. A copy made to leave the device (AirDrop, Files, a computer) is one file with the data and the photos. Restoring checks the file, shows what it holds, asks, and saves a safety copy first (restorable). The reminder shows after 7 days without a copy off the device (before any copy, counted from the first backup).
- Keeping the data out of the device's own iCloud backup needs one iOS setting that no Expo library offers, so the app has one small module of its own (`mobile/modules/backup-exclusion`, Swift). It runs in the installed `.ipa` only; Expo Go does not have it and the app works there without it. It is the app's only native code.

- Review of Phases 0 to 7 (2026-11-11), approved by the owner, without changing how the app works:
  - **Fixes**, done first in Phase 8 (8.0b to 8.0e): the live data hidden from the Files app; long lists loaded as you scroll; the tab bar kept inside Management; the iPad layout planned by type of screen (list with details beside it, cards filling the width, forms as windows).
  - **Plan changes:** the speed test moved to Phase 8 (8.0f); no chart library: the dashboard draws its own bars, with tap-to-see the day's total and breakdowns as ranked rows, and the first Phase 8 preview compares them with Apple's own charts; the missing tap-through tests written in Phase 8 (8.0g); this document brought up to date.
  - **Way of working:** a screenshot run on iPhone and iPad at the end of every phase; Expo Go no longer limits the choice of libraries (a native library only when clearly better, after asking).
  - **Instant updates** (L6) brought forward to the first step of Phase 8 (8.0a): they don't need the developer account. Updates go to the installed app only with the owner's OK; offline use is unchanged.
- Offline: the app works fully without the internet, and every phase's self-check confirms nothing new needs it.

Status: Phases 0 to 7 are merged. Next: Phase 8, starting with instant updates and the review fixes (8.0a to 8.0g).
