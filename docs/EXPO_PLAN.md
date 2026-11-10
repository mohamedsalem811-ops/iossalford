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

## 2. How each step works

**Owner's rule: after every step or task, test it, check it, and push it to the pull request.** No step is reported done until its checks pass and it is pushed.

1. I build the step on a work branch.
2. I test and check it myself before pushing: `npm run check` (TypeScript, lint, formatting, automatic tests **NEW**), `expo-doctor`, and an iOS bundle export.
3. I push it to the phase's open pull request right away, so every step shows up there with its CI results.
4. GitHub Actions builds:
   - the `.ipa` for your iPhone and iPad (as today);
   - a simulator run that taps through the app on an iPhone and an iPad simulator and takes screenshots for me to review. **NEW** Run only at the end of the project, or earlier when a change is critical (security and PINs, saving data, backups); I say when and why. GitHub's macOS simulators are slow and unreliable, and a run takes about an hour.
5. **NEW: Expo Go preview.** The stage is published to the owner's Expo account; open it in Expo Go on the iPhone or iPad from the link or QR code. Before that, Claude checks it on Expo's cloud iPhone and iPad simulators through the Expo connection (only within what the Expo plan allows; nothing paid without asking).
6. You install the build (Expo Go preview, or the `.ipa` at key stages) and go through a short checklist.
7. Each phase is one pull request into `main`. While steps are pushed it stays a draft and only the fast checks run (about 1 minute). Once it is marked ready, every push also builds the `.ipa` (about 20 minutes). When the phase is complete I publish the Expo Go preview; you test it and the `.ipa` and tell me what needs fixing, then it is **merged by you**.

**Expo Go rule:** the app uses only libraries that Expo Go already includes, so every stage can be previewed in Expo Go. In Expo Go the app shows Expo Go's name and icon, and its data is separate from the installed app (test only).

## 3. Architecture (all NEW under the hood)

**Folder layout** (inside `mobile/` in this repository):

```
mobile/
  app/                     ← screens (Expo Router)
    index.tsx              ← choose system
    [system]/              ← the same screens for jewelry and scarves
      login.tsx
      (tabs)/ dashboard/ sale/ products/ receipts/ management/
  src/
    domain/                ← business rules (tested)
    db/                    ← schema and migrations, one database per system
    features/              ← screen parts per feature
    ui/                    ← design system
    lib/                   ← money, digits, dates
    receipts/templates/    ← 5 receipt designs (HTML)
  e2e/                     ← tap-through tests
```

**Libraries:**

| Area             | Choice                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Screens and tabs | Expo Router with native Liquid Glass tabs                                                  |
| Native controls  | `@expo/ui` (SwiftUI menus, pickers, sheets, forms)                                         |
| Database         | `expo-sqlite`, plain SQL (same SQL tested on Node SQLite). **NEW:** replaces the JSON file |
| Cart state       | Zustand                                                                                    |
| Lists            | FlashList                                                                                  |
| Photos           | `expo-image`, `expo-image-picker`, `expo-image-manipulator`                                |
| Security         | `expo-secure-store`, `expo-crypto`, `expo-local-authentication`                            |
| Receipts         | HTML → `expo-print` and `expo-sharing`                                                     |
| Charts           | Victory Native                                                                             |
| Motion           | Reanimated 4, Gesture Handler, `expo-haptics`                                              |
| Tests            | Jest + Maestro. **NEW**                                                                    |
| Previews         | EAS Update opened in Expo Go, through the owner's Expo account. **NEW**                    |

**Database:** one file per system.

- **Money as whole dirhams. NEW** No rounding errors.
- **Record numbers are never reused.** Same rule as today.

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
- **2.4** About 60 automatic tests, including edge cases. **NEW**
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

- **8.1** Header: system name with the switch menu, and the "$ rate" button that opens the rate editor.
- **8.2** Today: sales, profit, number of sales and pieces. **NEW:** cash vs credit.
- **8.3** Month picker and month summary: sales, cost, profit, returns, expenses, net profit, in LYD and USD.
- **8.4** Daily sales chart for the selected month.
- **8.5** Needs attention: low and out-of-stock items, total owed by customers. **NEW:** "no recent backup" warning.
- **8.6** Breakdowns:
  - by category (by material for scarves);
  - by brand;
  - by size for scarves, with stock per size.
  - **NEW:** by payment method, and top products.
- **8.7** Latest sales list.
- **8.8** Stock summary.
- **8.9** iPad: multi-column dashboard. **NEW**

### Phase 9: polish

- **9.1** Animations and haptics. **NEW**
- **9.2** Arabic VoiceOver labels, very large text sizes, contrast in both modes. **NEW:** improved over today.
- **9.3** iPad:
  - every orientation;
  - Split View and Stage Manager sizes.
  - **NEW:** keyboard shortcuts (⌘F search, ⌘N new product).
- **9.4** Speed test with 2,000 products and 10,000 sales. **NEW**
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
| L6  | Instant updates (EAS Update in the real app)                               | Small fixes reach the installed app without reinstalling                |
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
- Previews in Expo Go through the owner's Expo account; only Expo Go-compatible libraries.
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
- Testing: every push runs the fast checks (types, lint, unit and screen tests) and builds the `.ipa`; Claude publishes the Expo Go preview each phase. The owner tests on the iPhone and iPad and reports what needs fixing. The simulator tap-through (Maestro) runs only at the end of the project, or earlier for a critical change (security and PINs, saving data, backups).
- Photos: taken or chosen, resized to at most 1600 px, kept in the app's own folder per system (only the file name is in the database). A photo file is deleted only when no product, scarf size or brand shows it.
- A cost entered in dollars keeps the rate it was bought at; editing a piece reprices it only when the dollar cost itself changes.
- iPad: the list is on the leading side (the right, in Arabic, as in iOS's own apps) and the open piece beside it.
- Face ID works only in the installed `.ipa`: Expo Go cannot use Face ID on iOS (Expo's own limitation). In Expo Go the login says so and the PIN is used; in the app, a failed or blocked Face ID says why.
- The exchange-rate editor is on the dashboard from Phase 4 (tap "سعر الصرف"), because dollar costs need the real rate; Phase 7 adds it to Settings too.
- Selling: while a sale is open, the cart bar sits above the tabs on iPhone (the iOS 26 tab bar accessory, as in Apple Music) and the Sale tab shows the number of pieces; on iPad the cart is always beside the products, on the right. The cart is kept until checkout, also while the app is locked; fully closing the app empties it (nothing is sold until checkout).
- Sets management (create, edit, delete; item 7.7) was brought forward into Phase 5 so a set can be sold and tested now. It is under Management → Sets and from the sets button on the sale screen.
- After checkout the success screen shows the total and the receipt number; "الإيصال" opens the receipt studio to print, share or edit it.
- Receipts: one PDF (A4) is made from the receipt and used to print, share and save in Files, so they always match. Printing or sharing saves the receipt first, so the PDF has its number. iOS's web printing cannot put "page 1 / 2" on each page; instead each continued page repeats the table header with the receipt number. Saved PDFs go to the app's Receipts folder (Files → On My iPhone/iPad → SALFORD POS → Receipts); in Expo Go they stay inside Expo Go.

Status: Phases 0 to 5 are merged; Phase 6 is in progress.
