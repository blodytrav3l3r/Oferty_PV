#!/usr/bin/env python3
"""WITROS Oferty PV - buduje offline bundle do przeniesienia na inny PC.

Tworzy katalog ./dist-bundle/ ze wszystkimi potrzebnymi plikami
(z wyjątkiem node_modules/ - to musi byc zainstalowane).

Bundle NIE potrzebuje internetu ale na docelowym PC wymagane jest:
- Node.js 18+ (do zbudowania node_modules)
- mozliwosc zainstalowania npm install (raz, na PC docelowym)
"""

import os
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).parent.resolve()
OUT = ROOT / 'dist-bundle'
OUT.mkdir(exist_ok=True)

# Wiśrodla do pomien ineci (zostaw tylko to co musi isc zrodlowo)
critical_paths = ['public/', 'prisma/', 'server.js', 'package.json',
                  'package-lock.json', '.env', '.env.example']

skip_dirs = {'.git', 'node_modules', 'dist', 'build', '.cache',
             '.hermes', '.agents', '.kilo', '.gstack', '.github',
             '.husky', '.hive', '.worktrees', 'cache'}

skip_files = {'.db', '.db-journal', '.db-wal', '.lock', '.log'}

copied = 0
total_bytes = 0

for root, dirs, files_list in os.walk(ROOT):
    dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith('~')]
    for fname in files_list:
        rel_path = Path(root).relative_to(ROOT) / fname
        rel_str = str(rel_path).replace('\\', '/')
        if rel_str == 'build_offline_bundle.py':
            continue  # pomijam sam skrypt
        if any(rel_str.startswith(p) for p in critical_paths if p.endswith('/')):
            pass
        elif rel_str not in critical_paths:
            continue
        if any(rel_str.endswith(s) for s in skip_files):
            continue

        src = Path(root) / fname
        dst = OUT / rel_path
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        sz = dst.stat().st_size
        copied += 1
        total_bytes += sz


# Dodaj pliki instalacyjne ktore juz w /root
extra_files = ['install.bat', 'install.sh', 'start.bat', 'start.sh',
               'host_offline_README.txt']
for f in extra_files:
    src = ROOT / f
    if src.exists():
        dst = OUT / f
        if not dst.exists():
            shutil.copy2(src, dst)
            copied += 1
            total_bytes += dst.stat().st_size

# Stworz plik tekstowy z instrukcja
readme = OUT / 'host_offline_README.txt'
with open(readme, 'w', encoding='utf-8') as f:
    f.write("""
WITROS Oferty PV - Offline Bundle
=================================

INSTALACJA NA DOCELOWYM PC (OFFLINE):
1. Zainstaluj Node.js 18+ (https://nodejs.org/) - wymagane raz na PC
2. Skopiuj caly katalog dist-bundle/ na docelowy PC
3. Otworz terminal w katalogu dist-bundle/
4. Uruchom: install.bat (Windows) lub bash install.sh (Linux/Mac)
   BEZ internetu zadziała tylko jesli na docelowym PC jest
   cache npm w %UserProfile%\.npm\_cacache (lub ~/.npm)

WYMAGANIA OFFLINE (dla pkg z npm):
   Dla pełnej offline package install - musisz mieć wcześniej:
   a) Zainstalowane npm install na innym PC z internetem
   b) Skopiowany katalog node_modules/
   c) Skopiowany cache npm (opcjonalnie dla szybszego install)

JAK URUCHOMIC SERWER:
- node server.js
- lub: npm start
- Przegladarka: http://localhost:3000
- Konto: admin / admin123

POTRZEBNE PLIKI (98 plikow, ~4.5 MB):
""")
    f.write(f"- Pliki app: package.json, package-lock.json ({copied} plikow, {total_bytes/1024/1024:.2f} MB)\n")
    f.write(f"- Pliki public/ - frontend SPA\n")
    f.write(f"- Pliki prisma/ - schema SQLite\n")
    f.write(f"- Pliki server.js - backend Express\n")
    f.write("\n\nPo skopiowaniu dist-bundle/ na docelowy PC:\n")
    f.write("1. Zainstaluj Node.js 18+ (https://nodejs.org/)\n")
    f.write("2. Otworz terminal w dist-bundle\n")
    f.write("3. npm install\n")
    f.write("4. npx prisma generate\n")
    f.write("5. npx prisma db push --accept-data-loss\n")
    f.write("6. node server.js\n")

print(f"Bundle zbudowany: {copied} plikow, {total_bytes/1024/1024:.2f} MB")
print(f"Katalog: {OUT}")
print("\nZAWARTOSC (TOP 20):")

# Lista plikow z rozmiarami
files_with_sizes = []
for root, dirs, files_list in os.walk(OUT):
    for fname in files_list:
        rel = Path(root).relative_to(OUT) / fname
        sz = (Path(root) / fname).stat().st_size
        files_with_sizes.append((str(rel), sz))

files_with_sizes.sort(key=lambda x: -x[1])
for r, s in files_with_sizes[:20]:
    print(f"  {s/1024:7.1f} KB  {r}")

# Pakowanie do ZIP dla wygodnego przeniesienia
import zipfile as _zip
ZIP_OUT = ROOT / 'WITROS-Oferty-PV-Offline.zip'
with _zip.ZipFile(ZIP_OUT, 'w', _zip.ZIP_DEFLATED, compresslevel=9) as zfile:
    for p in OUT.rglob('*'):
        if p.is_file():
            arc = p.relative_to(OUT).as_posix()
            zfile.write(p, arc)

zip_size = ZIP_OUT.stat().st_size
print(f"\nZIP gotowy: {ZIP_OUT}")
print(f"Rozmiar ZIP (compressed): {zip_size/1024/1024:.2f} MB")
print("Przenies ten ZIP na inny PC i rozpakuj w wybranym katalogu.")
