# VETRA Business Card - Printing Guide

## 📋 File Overview
- **index.html** — Digital business card (front and back)
- **assets/** — Place your VETRA.png logo here

## ✅ Setup Instructions

### Step 1: Add Your Logo
1. Copy `VETRA.png` from your Downloads folder
2. Paste it into the `assets/` folder in this directory
3. The logo will automatically display in the business card design

### Step 2: Generate PDF for Printing

#### **Option A: Browser Print (Simplest)**
Best for quick PDFs, standard RGB output:
1. Open `index.html` in your web browser
2. Press `Cmd + P` (Mac) or `Ctrl + P` (Windows)
3. Configure print settings:
  - **Paper size**: Custom (85.5mm × 54mm)
  - **Margins**: 0
   - **Scale**: 100%
   - **Background graphics**: ✓ Enable
4. Click "Save as PDF"

#### **Option B: Terminal Command (Advanced)**
For CMYK color profile support (best for professional printing):

```bash
# First, install wkhtmltopdf if you don't have it:
brew install wkhtmltopdf

# Then generate the PDF:
cd /Users/avipatel/Downloads/apex-widget/Website/business-card
wkhtmltopdf \
  --page-width 85.5mm \
  --page-height 54mm \
  --margin-top 0 \
  --margin-bottom 0 \
  --margin-left 0 \
  --margin-right 0 \
  --enable-local-file-access \
  index.html business-card.pdf
```

#### **Option C: CMYK Conversion (Professional Printing)**
If your print supplier specifically requires CMYK:

```bash
# Install ImageMagick if needed:
brew install imagemagick

# Convert RGB PDF to CMYK:
convert -density 300 business-card.pdf -colorspace CMYK business-card-cmyk.pdf
```

## 🎨 Design Details

### Card Dimensions
- **Physical Size**: 85.5mm × 54mm (ISO / Europe standard business card)
- **Resolution**: 300 DPI (optimal for printing)
- **Format**: Digital HTML/CSS with professional styling

### Design Features
- **Color Scheme**: Matte Black (#1a1a1a) with Cyan Accent (#00d4ff)
- **Layout**:
  - Front: Logo, Name, Title, Contact Info
  - Back: QR Code linking to usevetra.com/#home
- **Typography**: Modern, Bold, Professional
- **Finish**: Matte black background (high-end, professional look)

## 📧 Emailing to Your Supplier

### Recommended Format
- **PDF file type** with CMYK color profile for professional printing
- High-resolution (300 DPI)

### Email Template
```
Subject: Vetra Business Card - Print Files

Hi [Supplier Name],

Please find attached the VETRA business card design files for production.

Specifications:
- Dimensions: 85.5mm × 54mm
- Color Profile: CMYK
- Resolution: 300 DPI
- Stock: Matte cardstock

Files included:
- business-card.pdf (CMYK) — Use this for printing
- index.html (source file, for reference)

Please confirm receipt and let me know about production timeline.

Thanks!
Avi Patel
```

## 🎯 Color Reference (For Approval)

| Element | Color | Code | CMYK |
|---------|-------|------|------|
| Background | Matte Black | #1a1a1a | C:70 M:60 Y:50 K:90 |
| Accent | Cyan | #00d4ff | C:100 M:10 Y:0 K:0 |
| Text | White | #ffffff | C:0 M:0 Y:0 K:0 |

## ⚙️ Customization

To modify the business card:
1. Edit `index.html` with any text editor
2. Update name, email, phone, or website
3. Adjust colors by modifying the hex codes in the `<style>` section
4. Change the QR code link by updating the API URL
5. Regenerate PDF using the steps above

## 🖨️ Final Checklist Before Sending to Printer

- [ ] Logo (VETRA.png) is added to assets folder
- [ ] PDF generated in CMYK format
- [ ] Resolution confirmed at 300 DPI
- [ ] Colors verified (black background with cyan accents)
- [ ] Text is clear and readable
- [ ] QR code scans correctly to usevetra.com/#home
- [ ] Print provider confirms specifications

## 📞 Support

If you need adjustments to the design, you can:
1. Modify the HTML/CSS directly
2. Re-generate the PDF
3. Send updated version to your printer

---

**Created**: 2026-04-03  
**For**: Vetra Business Card  
**Design**: Modern/Bold with Matte Black + Cyan
