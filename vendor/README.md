# Offline Dependencies / Zaleznosci Offline

Ten folder zawiera wszystkie zaleznosci potrzebne do uruchomienia aplikacji **bez dostepu do internetu**.

## Struktura

- `node_modules.tar.gz` — spakowane zaleznosci Node.js (odpakowywane automatycznie przez skrypty startowe)
- `python_wheels/` — pliki `.whl` z zaleznosciami Pythona (instalowane automatycznie offline)
- `requirements-frozen.txt` — pelna lista zainstalowanych pakietow Pythona z dokladnymi wersjami

## Jak przygotowac paczke offline

Jesli chcesz zaktualizowac zaleznosci offline (na komputerze z internetem):

### Node.js
```batch
npm install
tar -czf vendor\node_modules.tar.gz node_modules
```

### Python
```batch
cd well_configurator_backend
python -m pip freeze > ..\vendor\requirements-frozen.txt
python -m pip download -r ..\vendor\requirements-frozen.txt -d ..\vendor\python_wheels
```

## Dystrybucja

**Wazne:** Pliki w tym folderze sa pomijane przez Git ze wzgledu na duzy rozmiar.
Przy przenoszeniu aplikacji na inny komputer skopiuj **calosc folderu `vendor/`**
wraz z reszta projektu (np. przez ZIP, USB, Dropbox).

Po przeniesieniu wystarczy uruchomic `start_all.bat` — skrypty same rozpakuja
i zainstaluja wszystko bez potrzeby laczenia sie z internetem.
