import UIKit
import SwiftUI

/// 100% Native iOS PDF Engine using UIGraphicsPDFRenderer & UIPrintInteractionController (AirPrint)
enum NativePDFGenerator {

    static func generateGiftReceiptPDF(
        template: ReceiptTemplate,
        showRealPrices: Bool,
        receiptNo: String,
        dateStr: String,
        timeStr: String,
        customer: String,
        items: [ReceiptLineItem]
    ) -> URL? {
        // First pass counts the pages so every page can say "1 / N"; second pass is the real PDF.
        var pageCount = 1
        _ = renderReceipt(template: template, showRealPrices: showRealPrices, receiptNo: receiptNo,
                          dateStr: dateStr, timeStr: timeStr, customer: customer, items: items,
                          totalPages: nil, pagesUsed: &pageCount)
        var finalCount = 1
        let data = renderReceipt(template: template, showRealPrices: showRealPrices, receiptNo: receiptNo,
                                 dateStr: dateStr, timeStr: timeStr, customer: customer, items: items,
                                 totalPages: pageCount, pagesUsed: &finalCount)

        let safeNo = receiptNo.replacingOccurrences(of: "/", with: "-")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("SALFORD-Receipt-\(safeNo).pdf")
        do {
            try data.write(to: url, options: .atomic)
            return url
        } catch {
            return nil
        }
    }

    /// Draws the receipt on real A4 pages: when the items don't fit, a new page starts with the
    /// table header repeated, so long receipts print correctly instead of being shrunk or cut.
    private static func renderReceipt(
        template: ReceiptTemplate,
        showRealPrices: Bool,
        receiptNo: String,
        dateStr: String,
        timeStr: String,
        customer: String,
        items: [ReceiptLineItem],
        totalPages: Int?,
        pagesUsed: inout Int
    ) -> Data {
        let pageWidth: CGFloat = 595.2  // A4 width in pt
        let pageHeight: CGFloat = 841.8 // A4 height in pt
        let bottomMargin: CGFloat = 56
        let pageRect = CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight)

        var pageNumber = 0
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)
        let data = renderer.pdfData { context in
            let cg = context.cgContext

            func startPage() {
                context.beginPage()
                pageNumber += 1
                UIColor.white.setFill()
                cg.fill(pageRect)
                if let total = totalPages, total > 1 {
                    drawCenteredText("\(receiptNo)  •  \(pageNumber) / \(total)", y: pageHeight - 34,
                                     font: .systemFont(ofSize: 9), color: .gray, pageWidth: pageWidth)
                }
            }

            startPage()

            var curY: CGFloat = 40

            if template == .salfordRoyal {
                // Royal Obsidian & Violet Header Banner matching SALFORD logo scheme
                let bannerRect = CGRect(x: 0, y: 0, width: pageWidth, height: 145)
                let colors = [
                    UIColor(red: 43/255, green: 25/255, blue: 84/255, alpha: 1).cgColor,
                    UIColor(red: 11/255, green: 11/255, blue: 24/255, alpha: 1).cgColor,
                    UIColor(red: 5/255, green: 5/255, blue: 10/255, alpha: 1).cgColor
                ] as CFArray
                if let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 0.6, 1]) {
                    cg.saveGState()
                    cg.addRect(bannerRect)
                    cg.clip()
                    cg.drawLinearGradient(grad, start: CGPoint(x: pageWidth, y: 0), end: CGPoint(x: 0, y: 145), options: [])
                    cg.restoreGState()
                }
                UIColor(red: 200/255, green: 216/255, blue: 240/255, alpha: 1).setFill()
                cg.fill(CGRect(x: 0, y: 145, width: pageWidth, height: 3))

                drawCenteredText("SJ", y: 22, font: .systemFont(ofSize: 44, weight: .black), color: .white, pageWidth: pageWidth)
                drawCenteredText("SALFORD", y: 74, font: .systemFont(ofSize: 22, weight: .bold), color: .white, pageWidth: pageWidth)
                drawCenteredText("jewelry", y: 100, font: .systemFont(ofSize: 11, weight: .regular), color: UIColor(red: 200/255, green: 216/255, blue: 240/255, alpha: 1), pageWidth: pageWidth)
                drawCenteredText("✦ FINE JEWELRY & LUXURY CREATIONS • TRIPOLI, LIBYA ✦", y: 120, font: .systemFont(ofSize: 9.5, weight: .medium), color: UIColor(red: 200/255, green: 216/255, blue: 240/255, alpha: 1), pageWidth: pageWidth)
                curY = 175
            } else if template == .salfordWhite {
                drawCenteredText("SJ", y: 36, font: .systemFont(ofSize: 42, weight: .black), color: .black, pageWidth: pageWidth)
                drawCenteredText("SALFORD", y: 86, font: .systemFont(ofSize: 21, weight: .bold), color: .black, pageWidth: pageWidth)
                drawCenteredText("jewelry", y: 110, font: .systemFont(ofSize: 11, weight: .regular), color: .darkGray, pageWidth: pageWidth)
                drawCenteredText("SALFORD JEWELRY — LIBYA", y: 132, font: .systemFont(ofSize: 11, weight: .bold), color: .black, pageWidth: pageWidth)
                curY = 168
            } else if template == .scarvesLibya {
                // SALFORD Libya (scarves): white, classic.
                drawCenteredText("SALFORD", y: 40, font: .systemFont(ofSize: 30, weight: .bold), color: .black, pageWidth: pageWidth)
                drawCenteredText("L  I  B  Y  A", y: 80, font: .systemFont(ofSize: 12, weight: .semibold), color: .darkGray, pageWidth: pageWidth)
                drawCenteredText("SCARVES & ACCESSORIES • TRIPOLI, LIBYA", y: 104, font: .systemFont(ofSize: 10, weight: .medium), color: .gray, pageWidth: pageWidth)
                UIColor(white: 0.85, alpha: 1).setFill()
                cg.fill(CGRect(x: pageWidth / 2 - 60, y: 126, width: 120, height: 1))
                curY = 150
            } else if template == .scarvesSalford {
                // SALFORD Scarves: dark rose banner.
                let bannerRect = CGRect(x: 0, y: 0, width: pageWidth, height: 140)
                let colors = [
                    UIColor(red: 110/255, green: 30/255, blue: 62/255, alpha: 1).cgColor,
                    UIColor(red: 42/255, green: 12/255, blue: 26/255, alpha: 1).cgColor
                ] as CFArray
                if let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1]) {
                    cg.saveGState()
                    cg.addRect(bannerRect)
                    cg.clip()
                    cg.drawLinearGradient(grad, start: CGPoint(x: pageWidth, y: 0), end: CGPoint(x: 0, y: 140), options: [])
                    cg.restoreGState()
                }
                let blush = UIColor(red: 240/255, green: 190/255, blue: 208/255, alpha: 1)
                blush.setFill()
                cg.fill(CGRect(x: 0, y: 140, width: pageWidth, height: 3))
                drawCenteredText("SALFORD", y: 34, font: .systemFont(ofSize: 30, weight: .bold), color: .white, pageWidth: pageWidth)
                drawCenteredText("scarves", y: 74, font: .systemFont(ofSize: 13, weight: .regular), color: blush, pageWidth: pageWidth)
                drawCenteredText("✦ SILK & CASHMERE SCARVES • TRIPOLI, LIBYA ✦", y: 104, font: .systemFont(ofSize: 9.5, weight: .medium), color: blush, pageWidth: pageWidth)
                curY = 170
            } else {
                // Swarovski London (Covent Garden) — 100% verbatim match to Invoice swarovski.pdf
                drawCenteredText("SWAROVSKI", y: 50, font: .boldSystemFont(ofSize: 15), color: .black, pageWidth: pageWidth)
                drawCenteredText("London – Covent Garden", y: 70, font: .systemFont(ofSize: 11.5), color: .black, pageWidth: pageWidth)
                drawCenteredText("20–21 James Street, Covent Garden", y: 86, font: .systemFont(ofSize: 11.5), color: .black, pageWidth: pageWidth)
                drawCenteredText("London, WC2E 8NS", y: 102, font: .systemFont(ofSize: 11.5), color: .black, pageWidth: pageWidth)
                drawCenteredText("Tel: +44 20 7946 0000", y: 118, font: .systemFont(ofSize: 11.5), color: .black, pageWidth: pageWidth)
                curY = 156
            }

            let docTitle = showRealPrices ? "OFFICIAL INVOICE / RECEIPT" : "GIFT RECEIPT"
            drawCenteredText(docTitle, y: curY, font: .boldSystemFont(ofSize: 13), color: .black, pageWidth: pageWidth)
            curY += 34

            let storeName = template.storeName
            let meta: [(String, String)] = [
                ("Date:", dateStr),
                ("Time:", timeStr),
                ("Receipt No:", receiptNo),
                ("Store:", storeName)
            ]
            for (k, v) in meta {
                drawLeftText(k, x: 96, y: curY, font: .systemFont(ofSize: 11.5), color: .black)
                drawLeftText(v, x: 210, y: curY, font: .systemFont(ofSize: 11.5), color: .black)
                curY += 20
            }

            curY += 10
            let tx: CGFloat = 96
            let tw: CGFloat = pageWidth - 192
            let col1: CGFloat = tw * 0.65
            let col2: CGFloat = tw * 0.15
            let col3: CGFloat = tw * 0.20
            let rh: CGFloat = 22

            let hdrTextCol: UIColor = (template == .salfordRoyal || template == .scarvesSalford) ? .white : .black
            func drawTableHeader() {
                let hdrRect = CGRect(x: tx, y: curY, width: tw, height: rh)
                (template == .salfordRoyal ? UIColor(red: 11/255, green: 11/255, blue: 24/255, alpha: 1)
                    : template == .scarvesSalford ? UIColor(red: 110/255, green: 30/255, blue: 62/255, alpha: 1)
                    : UIColor(white: 0.93, alpha: 1)).setFill()
                cg.fill(hdrRect)
                UIColor.gray.setStroke()
                cg.stroke(CGRect(x: tx, y: curY, width: col1, height: rh))
                cg.stroke(CGRect(x: tx + col1, y: curY, width: col2, height: rh))
                cg.stroke(CGRect(x: tx + col1 + col2, y: curY, width: col3, height: rh))
                drawLeftText("Item", x: tx + 8, y: curY + 4, font: .boldSystemFont(ofSize: 11), color: hdrTextCol)
                drawLeftText("Qty", x: tx + col1 + 8, y: curY + 4, font: .boldSystemFont(ofSize: 11), color: hdrTextCol)
                drawLeftText("Price", x: tx + col1 + col2 + 8, y: curY + 4, font: .boldSystemFont(ofSize: 11), color: hdrTextCol)
                curY += rh
            }

            // Table Header
            drawTableHeader()

            for item in items {
                // Each item takes two rows; continue on a new page when they don't fit.
                if curY + rh * 2 > pageHeight - bottomMargin {
                    startPage()
                    curY = 50
                    drawLeftText("Receipt No: \(receiptNo) — continued", x: tx, y: curY, font: .systemFont(ofSize: 10.5), color: .darkGray)
                    curY += 22
                    drawTableHeader()
                }
                let priceText = (showRealPrices && item.price > 0) ? Money.plain(item.price * Double(item.qty)) : "XXX"
                UIColor.gray.setStroke()
                cg.stroke(CGRect(x: tx, y: curY, width: col1, height: rh))
                cg.stroke(CGRect(x: tx + col1, y: curY, width: col2, height: rh))
                cg.stroke(CGRect(x: tx + col1 + col2, y: curY, width: col3, height: rh))

                drawTruncatedText(item.fullTitle, in: CGRect(x: tx + 8, y: curY + 4, width: col1 - 14, height: rh - 4), font: .systemFont(ofSize: 11), color: .black)
                drawLeftText("\(item.qty)", x: tx + col1 + 14, y: curY + 4, font: .systemFont(ofSize: 11), color: .black)
                drawLeftText(priceText, x: tx + col1 + col2 + 12, y: curY + 4, font: .systemFont(ofSize: 11), color: .black)
                curY += rh

                cg.stroke(CGRect(x: tx, y: curY, width: col1, height: rh))
                cg.stroke(CGRect(x: tx + col1, y: curY, width: col2, height: rh))
                cg.stroke(CGRect(x: tx + col1 + col2, y: curY, width: col3, height: rh))
                drawTruncatedText("Item Code: \(item.code)", in: CGRect(x: tx + 8, y: curY + 4, width: col1 - 14, height: rh - 4), font: .systemFont(ofSize: 10.5), color: .darkGray)
                curY += rh
            }

            // Total, customer, notes and thank-you block stay together.
            if curY + 190 > pageHeight - bottomMargin {
                startPage()
                curY = 50
            }

            curY += 14
            UIColor.black.setStroke()
            cg.setLineWidth(1.2)
            cg.move(to: CGPoint(x: tx, y: curY))
            cg.addLine(to: CGPoint(x: tx + tw, y: curY))
            cg.strokePath()

            let grandTotal = items.reduce(0.0) { $0 + ($1.price * Double($1.qty)) }
            let totalStr = (showRealPrices && grandTotal > 0) ? Money.plain(grandTotal) + " LYD" : "XXX"
            drawLeftText("Total", x: tx + 8, y: curY + 8, font: .boldSystemFont(ofSize: 12), color: .black)
            drawLeftText(totalStr, x: tx + tw - 65, y: curY + 8, font: .boldSystemFont(ofSize: 12), color: .black)

            curY += 44
            drawLeftText("Customer: \(customer)", x: 48, y: curY, font: .boldSystemFont(ofSize: 11.5), color: .black)

            curY += 26
            drawLeftText("This is a gift receipt. Original receipt is required for returns or exchanges.", x: 48, y: curY, font: .systemFont(ofSize: 10), color: .gray)
            drawLeftText("Returns are subject to store policy.", x: 48, y: curY + 15, font: .systemFont(ofSize: 10), color: .gray)

            curY += 56
            if template == .swarovskiLondon {
                drawCenteredText("Thank you for shopping with Swarovski.", y: curY, font: .systemFont(ofSize: 11.5), color: .black, pageWidth: pageWidth)
                drawCenteredText("www.swarovski.com", y: curY + 16, font: .systemFont(ofSize: 11.5), color: .black, pageWidth: pageWidth)
            } else if template == .scarvesLibya || template == .scarvesSalford {
                drawCenteredText("Thank you for shopping with SALFORD.", y: curY, font: .systemFont(ofSize: 11.5), color: .black, pageWidth: pageWidth)
                drawCenteredText(template == .scarvesLibya ? "✦ SALFORD LIBYA ✦" : "✦ SALFORD SCARVES ✦", y: curY + 18, font: .boldSystemFont(ofSize: 10.5), color: .darkGray, pageWidth: pageWidth)
            } else {
                drawCenteredText("Thank you for shopping with SALFORD Jewelry.", y: curY, font: .systemFont(ofSize: 11.5), color: .black, pageWidth: pageWidth)
                drawCenteredText("✦ SALFORD HIGH JEWELRY ✦", y: curY + 18, font: .boldSystemFont(ofSize: 10.5), color: .darkGray, pageWidth: pageWidth)
            }
        }
        pagesUsed = pageNumber
        return data
    }

    /// Opens the AirPrint dialog. On iPad it is anchored to the screen currently on top
    /// (including a sheet), which iPad requires. Returns false if the file can't be printed.
    @discardableResult
    static func printPDF(url: URL, jobName: String) -> Bool {
        guard UIPrintInteractionController.canPrint(url) else { return false }
        let printInfo = UIPrintInfo(dictionary: nil)
        printInfo.jobName = jobName
        printInfo.outputType = .general
        let controller = UIPrintInteractionController.shared
        controller.printInfo = printInfo
        controller.printingItem = url

        if UIDevice.current.userInterfaceIdiom == .pad, let top = topViewController() {
            let view = top.view!
            let anchor = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            controller.present(from: anchor, in: view, animated: true, completionHandler: nil)
        } else {
            controller.present(animated: true, completionHandler: nil)
        }
        return true
    }

    private static func topViewController() -> UIViewController? {
        let window = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }
        var top = window?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }

    private static func drawTruncatedText(_ text: String, in rect: CGRect, font: UIFont, color: UIColor) {
        let style = NSMutableParagraphStyle()
        style.lineBreakMode = .byTruncatingTail
        let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color, .paragraphStyle: style]
        (text as NSString).draw(with: rect, options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine], attributes: attrs, context: nil)
    }

    private static func drawCenteredText(_ text: String, y: CGFloat, font: UIFont, color: UIColor, pageWidth: CGFloat) {
        let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color]
        let size = (text as NSString).size(withAttributes: attrs)
        let rect = CGRect(x: (pageWidth - size.width) / 2.0, y: y, width: size.width, height: size.height + 4)
        (text as NSString).draw(in: rect, withAttributes: attrs)
    }

    private static func drawLeftText(_ text: String, x: CGFloat, y: CGFloat, font: UIFont, color: UIColor) {
        let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color]
        (text as NSString).draw(at: CGPoint(x: x, y: y), withAttributes: attrs)
    }
}
