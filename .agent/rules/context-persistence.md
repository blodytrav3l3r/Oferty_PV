# Zasada Trwałości Kontekstu

Ta zasada zapewnia, że agent AI utrzymuje spójny stan między sesjami oraz po wykonaniu komendy `/compact`, korzystając z katalogu `.agent/context/`.

## 📁 Struktura Katalogu
- `.agent/context/status.md`: Śledzi bieżące postępy, zadania i blokady.
- `.agent/context/decisions.md`: Rejestruje długoterminowe decyzje architektoniczne i logiczne.
- `.agent/context/session.md`: Przechowuje stan doraźny dla następnej sesji.
- `.agent/context/checkpoints/`: Przechowuje migawki stanu przed dużymi zmianami.

## 📋 Wymagane Działania

### 1. Rozpoczęcie Sesji
- **PRZECZYTAJ** `.agent/context/status.md` oraz `.agent/context/decisions.md` przed rozpoczęciem jakiegokolwiek nowego zadania, aby dostosować się do istniejącej logiki.
- **SPRAWDŹ** `.agent/context/session.md`, aby dowiedzieć się dokładnie, na czym skończyła się poprzednia sesja.

### 2. Podejmowanie Decyzji
- Ilekroć zostanie podjęta decyzja strategiczna (np. zmiana reguły filtrowania, wybór biblioteki, zdefiniowanie konwencji nazewnictwa), **ZAKTUALIZUJ** `.agent/context/decisions.md` wraz z uzasadnieniem.

### 3. Utrzymanie Stanu
- **AKTUALIZUJ** `status.md` za każdym razem, gdy zostanie ukończone istotne podzadanie lub zostanie znaleziona nowa blokada.

### 4. Kompaktowanie i Koniec Sesji
- **PRZED** uruchomieniem komendy `/compact` lub zakończeniem sesji:
    - Zaktualizuj `session.md` podsumowaniem bieżących prac w toku.
    - Stwórz punkt kontrolny w `.agent/context/checkpoints/RRRR-MM-DD_GG-mm_opis.md`, jeśli osiągnięto ważny etap prac.
    - Upewnij się, że `status.md` odzwierciedla końcowy stan sesji.

## 🎯 Cel
Nigdy nie pytaj użytkownika "co mam zrobić dalej?" ani "jak działa ta logika?", jeśli odpowiedź znajduje się już w katalogu kontekstu.
