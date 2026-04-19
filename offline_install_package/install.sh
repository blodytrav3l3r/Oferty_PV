#!/bin/bash
echo "Instalacja WITROS Oferty w trybie offline..."
echo "Upewnij sie, ze Node.js jest zainstalowane"
cd "$(dirname "$0")"
npm ci --offline --cache ../npm_packages --no-save
npx prisma generate
npm run build
echo ""
echo "Instalacja bazowa zakonczona!"
echo ""
read -p "Czy chcesz zainstalowac backend AI (Python)? [y/N]: " choice
if [[ "$choice" =~ ^[Yy]$ ]]; then
    echo ""
    echo "Instalowanie Python i dependencies..."
    pip install --no-index --find-links=python_packages -r requirements.txt
    echo ""
    echo "Instalacja backendu AI zakonczona!"
else
    echo ""
    echo "Backend AI nie zostanie zainstalowany."
    echo "Dostepne beda tylko funkcje podstawowe."
fi
echo ""
echo "Wszystko gotowe! Uruchom: npm start"
echo "Aplikacja dostępna pod adresem: http://localhost:3000"
read -p "Press any key to continue..."
