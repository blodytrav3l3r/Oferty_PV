import puppeteer from 'puppeteer';

export async function generatePDF(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            // ponytail: --no-sandbox niezbędny w kontenerze Docker (proces jako root;
            // slim obrazy nie maja user namespaces, ktorych Chromium uzywa dla sandboxa).
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });

    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'domcontentloaded' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                right: '15mm',
                bottom: '10mm',
                left: '15mm'
            }
        });

        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}
