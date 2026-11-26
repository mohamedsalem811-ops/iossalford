# SALFORD POS: the owner's full test list (step 10.0)

Tick each box on the device it says. **iPhone** and **iPad** each get their own tick: do the whole
list on one device, then again on the other. Do it on the `.ipa` installed for 10.1 (not Expo Go),
with test products you delete afterwards (or on a fresh install: the real shop starts empty).

Words in «» are what the app shows. "Owner" means you, signed in with the owner's PIN. "Employee"
means a test employee you add in step 3 (for example سارة). Both systems: **المجوهرات** (jewelry)
and **الأوشحة** (scarves). Where a step says "both systems", do it in each.

If anything is wrong, write the step number and what you saw (a screenshot helps).

|             | iPhone | iPad |
| ----------- | ------ | ---- |
| Date tested |        |      |

---

## 1. First start, PINs and the lock screen

| #   | Step                                                                                     | What should happen                                                                            | iPhone | iPad |
| --- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------ | ---- |
| 1.1 | Open the app for the first time.                                                         | «SALFORD POS» with the two systems. The jewelry card says Face ID, the scarves card says PIN. | ☐      | ☐    |
| 1.2 | Choose المجوهرات and create the owner's 8-digit PIN twice.                               | The second entry must match; a different second entry is refused and you start again.         | ☐      | ☐    |
| 1.3 | Do the same for الأوشحة.                                                                 | Each system has its own PIN.                                                                  | ☐      | ☐    |
| 1.4 | Close the app completely and open it again.                                              | It opens on the system you used last and asks for its PIN.                                    | ☐      | ☐    |
| 1.5 | Jewelry: allow Face ID when asked (Settings → «الدخول بـ Face ID»). Lock and open again. | Face ID opens jewelry. Scarves always asks for the PIN.                                       | ☐      | ☐    |
| 1.6 | Type a wrong PIN 3 times.                                                                | «نسيت الرمز؟» comes forward. More wrong PINs make you wait longer each time.                  | ☐      | ☐    |
| 1.7 | Switch to the other system (Management → «تبديل النظام»).                                | It asks for that system's PIN. Each system has its own products, sales and customers.         | ☐      | ☐    |
| 1.8 | Leave the app (home screen) and come back.                                               | It is locked; the app picture in the app switcher is covered (no prices or names).            | ☐      | ☐    |
| 1.9 | Settings → «تغيير رمز الدخول». Change it, lock, sign in with the new one.                | The old PIN no longer works.                                                                  | ☐      | ☐    |

## 2. The emergency password (owner)

| #   | Step                                                                                                                  | What should happen                                                                 | iPhone | iPad |
| --- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------ | ---- |
| 2.1 | Management → الموظفون → «اختيار كلمة سر الطوارئ». Confirm with your PIN, type a password of letters and digits twice. | «حُفظت كلمة سر الطوارئ»; the row shows «محفوظة». Write it down outside the device. | ☐      | ☐    |
| 2.2 | Lock. Type 3 wrong PINs, tap «نسيت الرمز؟», enter the emergency password (capitals do not matter).                    | «رمز جديد للمالك»: choose a new PIN; you are in.                                   | ☐      | ☐    |

## 3. Employees (owner, then employee)

| #   | Step                                                                                                                                                             | What should happen                                                                                                       | iPhone | iPad |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------ | ---- |
| 3.1 | Management → الموظفون → «إضافة موظف»: name سارة, a temporary 6-digit PIN.                                                                                        | She appears in the list, «لم يختر رمزه بعد».                                                                             | ☐      | ☐    |
| 3.2 | Management → «تبديل المستخدم أو القفل». The lock screen asks «من يستخدم النظام؟».                                                                                | Names are hidden by default (the owner can show them in Settings).                                                       | ☐      | ☐    |
| 3.3 | Choose سارة, type the temporary PIN.                                                                                                                             | She must choose her own 6-digit PIN twice, then «أهلاً، سارة».                                                           | ☐      | ☐    |
| 3.4 | Owner: tap سارة in الموظفون → the menu. Try each: «رمز مؤقت جديد», «تغيير الاسم», phones on/off, spending on/off, «يعمل في المجوهرات / الأوشحة», «إيقاف الموظف». | Each change shows in her row; a stopped employee cannot sign in; one who works in one system only cannot open the other. | ☐      | ☐    |
| 3.5 | Owner: «إرسال القائمة (AirDrop)» to the other device, «استلام قائمة» there.                                                                                      | Names only arrive, no PINs; each employee's first sign-in there needs your approval.                                     | ☐      | ☐    |

## 4. What an employee can and cannot do (signed in as سارة)

| #   | Step                                                                                        | What should happen                                                                                                                                                                                                            | iPhone | iPad |
| --- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---- |
| 4.1 | Look at الرئيسية.                                                                           | Her own sales today and this month only, no shop totals, no profit, no costs.                                                                                                                                                 | ☐      | ☐    |
| 4.2 | Open الإدارة.                                                                               | Only her sections: الوردية, سجل المبيعات (hers only), الطلبات بعربون, الصيانة, مرتجع أو استبدال, الزبائن, الديون, جرد المخزون, and الإعدادات with only what she may change. No المال, no الموظفون, no backups, no سجل النشاط. | ☐      | ☐    |
| 4.3 | Products: open a piece.                                                                     | No cost and no profit; she cannot edit, delete or change stock.                                                                                                                                                               | ☐      | ☐    |
| 4.4 | Customers: open one.                                                                        | Phone partly hidden («091•••5678») unless you allowed phones; total spending hidden unless allowed. She cannot delete or merge.                                                                                               | ☐      | ☐    |
| 4.5 | Sell with a discount over the limit (Management → قواعد البيع والمرتجعات).                  | «يحتاج موافقة المالك»: the sale waits for your PIN on the spot.                                                                                                                                                               | ☐      | ☐    |
| 4.6 | Open a sale's receipt.                                                                      | She can share and print it; items and customer cannot be changed.                                                                                                                                                             | ☐      | ☐    |
| 4.7 | Leave the device untouched (lock after 7 minutes by default; set 3 minutes to test faster). | A red countdown «سيُقفل الحساب بعد» before the lock, with a sound; a touch keeps her signed in; then it locks to «من يستخدم النظام؟».                                                                                         | ☐      | ☐    |
| 4.8 | Owner: Management → الموظفون → «المالك أيضاً».                                              | When on, the owner also locks after the same time; when off, only on leaving the app.                                                                                                                                         | ☐      | ☐    |

## 5. Products (owner, both systems)

| #   | Step                                                                                                                                                        | What should happen                                                                 | iPhone | iPad |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------ | ---- |
| 5.1 | المنتجات → ＋. Jewelry: name, brand (suggestions while typing), category, code, specs, price, cost in د.ل or $, stock, photo from the camera and the album. | Margin and profit shown live; a code used twice is refused; saved with its photo.  | ☐      | ☐    |
| 5.2 | Scarves: ＋ a design with sizes (90×90, 120×120, …), each with its own stock, cost and price; «مقاس آخر (كتابة بنفسك)».                                     | One card per design; sizes and stock shown on the card.                            | ☐      | ☐    |
| 5.3 | Search by name, code and brand; the brand bar (pin a brand); category; stock filter; sort.                                                                  | The list follows each filter; the count above updates.                             | ☐      | ☐    |
| 5.4 | Long-press a piece: «تعديل المخزون مع السبب» → «توريد جديد», 1 piece.                                                                                       | «سيصبح المخزون: …» then saved; the history shows the move with its reason.         | ☐      | ☐    |
| 5.5 | Jewelry, long-press → «الفاتورة الأصلية»: add the supplier's invoice photo or link one already there.                                                       | It opens later from the same menu.                                                 | ☐      | ☐    |
| 5.6 | Long-press → «عرض الصورة»; edit → «حذف الصورة».                                                                                                             | The photo opens full; deleting it leaves the initials badge.                       | ☐      | ☐    |
| 5.7 | Swipe a piece: archive it. Management → «القطع المؤرشفة»: bring it back.                                                                                    | Archived pieces disappear from sale and come back unchanged.                       | ☐      | ☐    |
| 5.8 | Management → «الماركات»: add, rename, photo, delete an unused brand.                                                                                        | A brand with pieces cannot be deleted.                                             | ☐      | ☐    |
| 5.9 | المنتجات → «القطع الراكدة» (60/90/180 days).                                                                                                                | Pieces not sold in that time, with the money tied up; a suggested bonus per piece. | ☐      | ☐    |

## 6. Selling (owner, then employee, both systems)

| #   | Step                                                                                                   | What should happen                                                                 | iPhone | iPad |
| --- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------ | ---- |
| 6.1 | بيع: tap a piece; long-press a piece to set quantity and price; scarves: choose the size.              | It goes to the cart (iPhone: the bar at the bottom; iPad: the panel at the side).  | ☐      | ☐    |
| 6.2 | In the cart: change quantity, price, remove a line; try more than in stock.                            | «الكمية أكبر من المتوفر» warns.                                                    | ☐      | ☐    |
| 6.3 | Add a set (Management → «الأطقم» to make one first).                                                   | The set's pieces come in together at the set price.                                | ☐      | ☐    |
| 6.4 | «إتمام البيع»: pay كاش, بطاقة, تحويل, and أجل (on credit) with a customer; a quick % discount; a note. | Totals in د.ل and $ at today's rate; credit needs a customer.                      | ☐      | ☐    |
| 6.5 | Type a new phone number at checkout.                                                                   | The customer is added automatically («تمت الإضافة تلقائياً من نافذة البيع»).       | ☐      | ☐    |
| 6.6 | Confirm.                                                                                               | «تم البيع بنجاح» with the receipt, the WhatsApp thank-you message, and «بيع جديد». | ☐      | ☐    |
| 6.7 | Close the app in the middle of a cart and open again.                                                  | The cart is kept.                                                                  | ☐      | ☐    |
| 6.8 | Change the rate (Settings → «سعر الصرف») with a cart open.                                             | «تغيّرت الأسعار»: update or keep the agreed price.                                 | ☐      | ☐    |

## 7. Receipts

| #   | Step                                                                                                                                   | What should happen                                                                                                                                      | iPhone | iPad |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---- |
| 7.1 | الإيصالات: open the receipt of a sale.                                                                                                 | iPad: beside the list, **with the A4 page drawn in the preview** (the simulator could not picture it: please confirm here). iPhone: the receipt studio. | ☐      | ☐    |
| 7.2 | Try each design (SALFORD, SJ الرسمي, SJ الملكي, scarves designs), «رسمية بالأسعار» / «هدية بدون أسعار», «المواصفات والخامة تحت القطع». | The preview changes at once.                                                                                                                            | ☐      | ☐    |
| 7.3 | «طباعة» to a printer and «مشاركة PDF» to Files and WhatsApp.                                                                           | One A4 page per receipt (more pages only for many pieces), Arabic and English names correct.                                                            | ☐      | ☐    |
| 7.4 | A new receipt by hand (＋), with items you type.                                                                                       | Saved with its own number; search by number, customer and piece; filter by month and design.                                                            | ☐      | ☐    |

## 8. Customers, debts, loyalty

| #   | Step                                                                                                    | What should happen                                                                                                                 | iPhone | iPad |
| --- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------ | ---- |
| 8.1 | الزبائن: add, edit (birthday, gender, photo, region, offers yes/no), search by name and phone.          | Duplicates are found by phone; two customers can be merged (owner).                                                                | ☐      | ☐    |
| 8.2 | Open a customer.                                                                                        | The ivory card, visits, last visit, spending, VIP (تلقائي / دائماً / ليس VIP), wanted pieces, orders, repairs, balance, purchases. | ☐      | ☐    |
| 8.3 | «إضافة قطعة يطلبها», then add a matching piece in products.                                             | You are reminded who asked for it.                                                                                                 | ☐      | ☐    |
| 8.4 | A credit sale, then الديون → the customer → «تسجيل دفعة».                                               | The debt goes down; a statement shows each sale and payment.                                                                       | ☐      | ☐    |
| 8.5 | Return a paid piece (see 9) so the shop owes her: «له رصيد». Use it at checkout, or «رد الرصيد للزبون». | The balance ends at zero.                                                                                                          | ☐      | ☐    |
| 8.6 | Settings → «الولاء والمكافآت»: turn on points, the visit reward, VIP double points; sell to her.        | Points earned shown on the receipt; spend points at checkout.                                                                      | ☐      | ☐    |
| 8.7 | Management → الزبائن → «بطاقة المكافآت»: card, QR, PDF, A6 test print.                                  | The card shows the shop's details from Settings.                                                                                   | ☐      | ☐    |
| 8.8 | A customer with a birthday this week.                                                                   | Home reminds you; the birthday discount is offered at checkout.                                                                    | ☐      | ☐    |

## 9. Returns and exchanges

| #   | Step                                                                                                                                                                           | What should happen                                                         | iPhone | iPad |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------ | ---- |
| 9.1 | Management → «مرتجع أو استبدال»: find a sale, choose the piece, the refund way (كاش, بطاقة, تحويل, from the debt), conditions «ملصق الضمان سليم» / «القطعة لم تُلبس», a photo. | Saved; the piece goes back to stock; the money shows in the day's summary. | ☐      | ☐    |
| 9.2 | Employee: answer a condition «لا».                                                                                                                                             | «المرتجع مرفوض»; «موافقة المالك» with your PIN lets it through.            | ☐      | ☐    |
| 9.3 | Employee: a return after 24 hours.                                                                                                                                             | Refused unless the owner approves.                                         | ☐      | ☐    |
| 9.4 | An exchange: return one piece and take another.                                                                                                                                | Only the difference is paid or refunded.                                   | ☐      | ☐    |
| 9.5 | Owner: a return «على حساب الموظف».                                                                                                                                             | It goes on the employee's account (عليه).                                  | ☐      | ☐    |
| 9.6 | المرتجعات: open one → «التفاصيل والصورة».                                                                                                                                      | The refund way and the photo are shown.                                    | ☐      | ☐    |

## 10. Orders with a deposit and repairs

| #    | Step                                                                                                                          | What should happen                                                             | iPhone | iPad |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------ | ---- |
| 10.1 | «طلب بعربون»: a piece from stock (held) or one to order from the supplier, agreed price, deposit, arrival date.               | A deposit receipt; a held piece cannot be sold to anyone else.                 | ☐      | ☐    |
| 10.2 | Open the order: «دفعة على الطلب» (a part payment), «تم الشراء من المورد» (owner), the ready message, «تسليم للزبون • الباقي». | Each payment has its own receipt; delivery takes the rest at checkout.         | ☐      | ☐    |
| 10.3 | «إلغاء الطلب».                                                                                                                | The deposit is refunded or kept as you choose; a held piece goes back to sale. | ☐      | ☐    |
| 10.4 | «صيانة جديدة»: the piece, photo, the work (fixed prices in Settings), cost, deposit.                                          | A repair ticket; «جاهزة للاستلام» message; delivery takes the rest.            | ☐      | ☐    |

## 11. The shift and the cash count

| #    | Step                                                                                        | What should happen                                                               | iPhone | iPad |
| ---- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------ | ---- |
| 11.1 | Employee: home says «الوردية مغلقة: افتحها للبيع». Open it with the cash in the drawer.     | Selling works only with a shift open.                                            | ☐      | ☐    |
| 11.2 | «إدخال» / «إخراج» cash with a reason.                                                       | Each move is listed in the shift.                                                | ☐      | ☐    |
| 11.3 | Close with a blind count (she does not see what is expected).                               | After closing: expected, counted, «عجز» or «زيادة».                              | ☐      | ☐    |
| 11.4 | Owner: المال → «الورديات وعدّ النقد» → the shift report. «تحميل» a shortage on her account. | Her account (الموظفون → her → «حساب الموظف») shows عليه; «تسجيل سداد» lowers it. | ☐      | ☐    |

## 12. Money and reports (owner)

| #    | Step                                                                                        | What should happen                                                                                                                                    | iPhone | iPad |
| ---- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---- |
| 12.1 | الرئيسية (owner).                                                                           | Today, the week, the month; sales, profit, alerts («يحتاج انتباهك»), the month summary, the chart, stock value. Both themes (فاتح / داكن) look right. | ☐      | ☐    |
| 12.2 | «ملخص اليوم»: previous and next day, print, PDF.                                            | Each payment way, returns, expenses, shifts.                                                                                                          | ☐      | ☐    |
| 12.3 | «المصروفات»: add one, delete one.                                                           | Shown in profits.                                                                                                                                     | ☐      | ☐    |
| 12.4 | «الأرباح»: month, quarter, year; by brand → category → piece.                               | Matches the sales minus costs, returns and expenses.                                                                                                  | ☐      | ☐    |
| 12.5 | «الإقفال الربع سنوي»: close the quarter; «إعادة إصدار الإقفال».                             | Closed quarters are kept; a past quarter cannot change silently.                                                                                      | ☐      | ☐    |
| 12.6 | «مقارنة الأشهر»: 3, 6, 12 months.                                                           | Sales and profit side by side.                                                                                                                        | ☐      | ☐    |
| 12.7 | الموظفون → «هدف الشهر لكل موظف», «المكافأة المقترحة للقطعة»; «تقرير الموظفين الشهري» (PDF). | Each employee sees only her own target and rank.                                                                                                      | ☐      | ☐    |
| 12.8 | «سجل النشاط».                                                                               | Who did what and when: sales, deletions, approvals, sign-ins.                                                                                         | ☐      | ☐    |
| 12.9 | Delete a sale (owner, from the sale's page).                                                | Stock comes back; it is in the activity log.                                                                                                          | ☐      | ☐    |

## 13. Marketing, reminders, alerts

| #    | Step                                                                                                            | What should happen                                                                   | iPhone | iPad |
| ---- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------ | ---- |
| 13.1 | «التسويق»: occasions (Ramadan, Eid, …), «أرسلي صديقة», «نفتقدك», VIP first look, the message texts, the report. | «إرسال الرسائل» opens WhatsApp one customer at a time; only those who accept offers. | ☐      | ☐    |
| 13.2 | Settings → «التنبيهات»: allow notifications; the morning and closing times.                                     | Local reminders arrive (orders due, birthdays, backups) without internet.            | ☐      | ☐    |
| 13.3 | Management → «قواعد البيع والمرتجعات» → التنبيهات.                                                              | Discounts, approvals, wrong PINs, cash shortages over your limits show on home.      | ☐      | ☐    |

## 14. Stock count

| #    | Step                                                                       | What should happen                                                              | iPhone | iPad |
| ---- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------ | ---- |
| 14.1 | Employee: «جرد المخزون» → count each piece → «إنهاء الجرد وإرساله للمالك». | The owner sees «بانتظار المالك».                                                | ☐      | ☐    |
| 14.2 | Owner: open it → «تطبيق الفروق على المخزون» (or «إلغاء الجرد»).            | Stock changes only for the pieces with a difference; the loss at cost is shown. | ☐      | ☐    |

## 15. Backups

| #    | Step                                                                                                  | What should happen                                                 | iPhone | iPad |
| ---- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------ | ---- |
| 15.1 | «النسخ الاحتياطي» → «نسخة على الجهاز», then «نسخ خارج الجهاز» (Files or AirDrop to the other device). | The reminder of days since a backup left the device resets.        | ☐      | ☐    |
| 15.2 | Set «كلمة سر النسخ الاحتياطي» and make a backup.                                                      | The file opens only with the password (or the emergency password). | ☐      | ☐    |
| 15.3 | Restore a backup from the list and from a file (AirDrop → «Open in SALFORD»).                         | A safety copy is made first; everything comes back, photos too.    | ☐      | ☐    |
| 15.4 | Leave the app and come back after an hour.                                                            | A new automatic backup is listed (newest per day kept for 7 days). | ☐      | ☐    |

## 16. Settings and updates

| #    | Step                                                                             | What should happen                                                           | iPhone | iPad |
| ---- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------ | ---- |
| 16.1 | Settings: rate, contact details for the card, appearance (فاتح / داكن / تلقائي). | Each change shows at once and stays after closing the app.                   | ☐      | ☐    |
| 16.2 | «تحقق من التحديثات» with internet.                                               | «النسخة العاملة» shows; after an instant update, «تحديث جاهز — أعد التشغيل». | ☐      | ☐    |
| 16.3 | Airplane mode: sell, return, open reports, back up on the device.                | Everything works without internet.                                           | ☐      | ☐    |
| 16.4 | «حماية الأجهزة»: follow the guide (Guided Access, Screen Time).                  | The steps match the device's settings.                                       | ☐      | ☐    |

## 17. iPad only

| #    | Step                                                                                 | What should happen                                                                     | iPad |
| ---- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ---- |
| 17.1 | Turn the iPad sideways on الرئيسية, بيع (with a cart), المنتجات, الإيصالات, الإدارة. | The layout fills the width; nothing cut off; the cart panel stays beside the products. | ☐    |
| 17.2 | Split View and Slide Over with another app at each size.                             | The app switches between the iPad and iPhone layouts cleanly.                          | ☐    |
| 17.3 | A keyboard: the shortcuts (new sale, search, …).                                     | They work.                                                                             | ☐    |

## 18. Arabic, large text, VoiceOver

| #    | Step                                                  | What should happen                                                                   | iPhone | iPad |
| ---- | ----------------------------------------------------- | ------------------------------------------------------------------------------------ | ------ | ---- |
| 18.1 | Every screen above.                                   | Right to left; digits 0–9 (Arabic-Indic digits typed are accepted and shown as 0–9). | ☐      | ☐    |
| 18.2 | iOS Settings → larger text.                           | Text grows without overlapping; long names wrap.                                     | ☐      | ☐    |
| 18.3 | VoiceOver on a few screens (sale, checkout, receipt). | Arabic labels read for every button.                                                 | ☐      | ☐    |
