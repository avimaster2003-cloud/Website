#!/usr/bin/env python3
"""
VETRA Business Card - PDF Generator with CMYK Support
Generates professional-grade PDFs suitable for printing
"""

import os
import subprocess
import sys
from pathlib import Path

def generate_rgb_pdf(html_file, output_pdf):
    """Generate initial RGB PDF using wkhtmltopdf"""
    print(f"📋 Generating PDF from {html_file}...")
    
    cmd = [
        'wkhtmltopdf',
        '--page-width', '3.5in',
        '--page-height', '2in',
        '--margin-top', '0.5in',
        '--margin-bottom', '0.5in',
        '--margin-left', '0.5in',
        '--margin-right', '0.5in',
        '--enable-local-file-access',
        '--dpi', '300',
        html_file,
        output_pdf
    ]
    
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        print(f"✓ PDF generated: {output_pdf}")
        return True
    except FileNotFoundError:
        print("❌ Error: wkhtmltopdf not found")
        print("   Install with: brew install wkhtmltopdf")
        return False
    except subprocess.CalledProcessError as e:
        print(f"❌ Error generating PDF: {e.stderr.decode()}")
        return False

def convert_to_cmyk(rgb_pdf, cmyk_pdf):
    """Convert RGB PDF to CMYK using ImageMagick"""
    print(f"\n🎨 Converting to CMYK color profile...")
    
    cmd = [
        'convert',
        '-density', '300',
        rgb_pdf,
        '-colorspace', 'CMYK',
        cmyk_pdf
    ]
    
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        print(f"✓ CMYK PDF created: {cmyk_pdf}")
        return True
    except FileNotFoundError:
        print("❌ Error: ImageMagick not found")
        print("   Install with: brew install imagemagick")
        return False
    except subprocess.CalledProcessError as e:
        print(f"❌ Error converting to CMYK: {e.stderr.decode()}")
        return False

def main():
    script_dir = Path(__file__).parent
    html_file = script_dir / "index.html"
    rgb_pdf = script_dir / "business-card.pdf"
    cmyk_pdf = script_dir / "business-card-cmyk.pdf"
    
    # Check if HTML exists
    if not html_file.exists():
        print(f"❌ Error: {html_file} not found")
        sys.exit(1)
    
    # Check if logo exists
    logo_file = script_dir / "assets" / "VETRA.png"
    if not logo_file.exists():
        print(f"⚠️  Warning: Logo not found at {logo_file}")
        print("   The business card will display with a broken image until you add VETRA.png")
    
    # Generate RGB PDF
    if not generate_rgb_pdf(str(html_file), str(rgb_pdf)):
        sys.exit(1)
    
    # Offer CMYK conversion
    print("\n" + "="*50)
    print("📧 Ready to email!")
    print("="*50)
    
    try:
        response = input("\nConvert to CMYK for professional printing? (y/n): ").strip().lower()
        if response == 'y':
            if convert_to_cmyk(str(rgb_pdf), str(cmyk_pdf)):
                print("\n✅ All files ready!")
                print(f"   - Standard PDF: {rgb_pdf.name}")
                print(f"   - CMYK PDF (for printer): {cmyk_pdf.name}")
                print(f"\n📧 Email {cmyk_pdf.name} to your print supplier")
            else:
                print(f"\n⚠️  CMYK conversion failed. You can still use: {rgb_pdf.name}")
        else:
            print(f"\n✅ PDF ready!")
            print(f"📧 Email {rgb_pdf.name} to your print supplier")
    except KeyboardInterrupt:
        print("\n\nCancelled by user")
        sys.exit(0)
    
    print("\n" + "="*50)
    print("💡 Tips:")
    print("   - Confirm logo appears correctly in the PDF")
    print("   - Test QR code scans to usevetra.com/#home")
    print("   - Verify colors match your physical card design")
    print("="*50)

if __name__ == "__main__":
    main()
