#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_NAME="sok"
COMPOSE_FILE="$ROOT/docker-compose.yml"
RESUME_EXISTING_VOLUME=false
ARTIFACT_PATH=""
ENV_TEMP=""
PASSWORD_TEMP=""
PENDING_PASSWORD_TEMP=""
MARKER_TEMP=""
INSTALL_MARKER="$ROOT/.sok-postgres-installed"

log() { printf '\n[%s] %s\n' "$1" "$2"; }
fail() { printf '\n[ERROR] %s\n' "$*" >&2; exit 1; }
compose() { docker compose --env-file "$ROOT/.env" --project-name "$PROJECT_NAME" --file "$COMPOSE_FILE" "$@"; }
cleanup_temps() {
    [[ -z "$ENV_TEMP" ]] || rm -f -- "$ENV_TEMP"
    [[ -z "$PASSWORD_TEMP" ]] || rm -f -- "$PASSWORD_TEMP"
    [[ -z "$PENDING_PASSWORD_TEMP" ]] || rm -f -- "$PENDING_PASSWORD_TEMP"
    [[ -z "$MARKER_TEMP" ]] || rm -f -- "$MARKER_TEMP"
}
trap cleanup_temps EXIT

usage() {
    cat <<'EOF'
Instalacja S.O.K. na firmowym serwerze Linux (Ubuntu/Debian).

Użycie:
  sudo bash install-linux-server.sh [--artifact /ścieżka/active-pricelists.json]
                                    [--resume-existing-volume]

Instalator wymaga eksportu aktywnych cenników ze starej instalacji.
Nie usuwa wolumenów ani nie kopiuje ofert, użytkowników lub historii.
EOF
}

while (($#)); do
    case "$1" in
        --artifact)
            (($# >= 2)) || fail 'Po --artifact podaj ścieżkę do pliku.'
            ARTIFACT_PATH="$2"
            shift 2
            ;;
        --resume-existing-volume)
            RESUME_EXISTING_VOLUME=true
            shift
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *) fail "Nieznany argument: $1. Użyj --help." ;;
    esac
done

[[ $EUID -eq 0 ]] || fail 'Uruchom instalator jako administrator: sudo bash install-linux-server.sh'
cd -- "$ROOT"
for required in docker-compose.yml Dockerfile .env.example docker/postgres/init-roles.sh scripts/docker-entrypoint.sh scripts/import-active-pricelists.ts scripts/grant-postgres-roles.mjs; do
    [[ -f "$ROOT/$required" ]] || fail "Niekompletny folder S.O.K.; brakuje: $required"
done

if [[ -z "$ARTIFACT_PATH" ]]; then
    default_artifact="$ROOT/cutover/active-pricelists.json"
    if [[ -f "$default_artifact" ]]; then
        ARTIFACT_PATH="$default_artifact"
    elif [[ -t 0 ]]; then
        read -r -p 'Podaj pełną ścieżkę do active-pricelists.json: ' ARTIFACT_PATH
    fi
fi
[[ -n "$ARTIFACT_PATH" && -f "$ARTIFACT_PATH" ]] || fail 'Brak wymaganego active-pricelists.json. Najpierw wyeksportuj aktywne cenniki ze starego S.O.K.'
ARTIFACT_PATH="$(realpath -- "$ARTIFACT_PATH")"
[[ "$(basename -- "$ARTIFACT_PATH")" == 'active-pricelists.json' ]] || fail 'Artefakt musi mieć nazwę active-pricelists.json.'
[[ "$ARTIFACT_PATH" != *','* && "$ARTIFACT_PATH" != *':'* ]] || fail 'Ścieżka artefaktu nie może zawierać przecinka ani dwukropka.'
if [[ "$ARTIFACT_PATH" == "$ROOT"/* && "$ARTIFACT_PATH" != "$ROOT/cutover/"* ]]; then
    fail 'Artefakt wewnątrz repozytorium umieść wyłącznie w cutover/ (wykluczonym z obrazu) albo przenieś poza folder S.O.K.'
fi

exec 9>/run/lock/sok-linux-installer.lock
flock -n 9 || fail 'Inna instalacja S.O.K. jest już uruchomiona.'

source /etc/os-release
[[ "${ID:-}" == 'ubuntu' || "${ID:-}" == 'debian' ]] || fail "Obsługiwane są Ubuntu i Debian; wykryto: ${ID:-nieznany}"
[[ -n "${VERSION_CODENAME:-}" ]] || fail 'Nie można ustalić nazwy wydania Linuxa.'
command -v systemctl >/dev/null || fail 'Wymagany jest systemd.'

install_docker_engine() {
    log INFO 'Instaluję Docker Engine z podpisanego, oficjalnego repozytorium Docker.'
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y ca-certificates curl openssl
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    printf 'Types: deb\nURIs: https://download.docker.com/linux/%s\nSuites: %s\nComponents: stable\nArchitectures: %s\nSigned-By: /etc/apt/keyrings/docker.asc\n' \
        "$ID" "$VERSION_CODENAME" "$(dpkg --print-architecture)" > /etc/apt/sources.list.d/docker.sources
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
    if dpkg-query -W -f='${db:Status-Status} ${binary:Package}\n' docker.io docker-compose podman-docker containerd runc 2>/dev/null | grep -q '^installed '; then
        fail 'Wykryto pakiety kontenerowe z innego źródła. Nie usunąłem ich. Administrator powinien sprawdzić konflikt przed instalacją Docker Engine.'
    fi
    install_docker_engine
fi
systemctl enable --now docker
docker info >/dev/null || fail 'Docker Engine nie odpowiada. Sprawdź: systemctl status docker.'
docker compose version >/dev/null || fail 'Brak Docker Compose plugin. Sprawdź instalację docker-compose-plugin.'

volume_exists=false
if docker volume inspect sok_postgres-data >/dev/null 2>&1; then volume_exists=true; fi
if [[ "$volume_exists" == true ]]; then
    volume_project="$(docker volume inspect --format '{{ index .Labels "com.docker.compose.project" }}' sok_postgres-data)"
    [[ "$volume_project" == "$PROJECT_NAME" ]] || fail 'Istniejący wolumen nie ma etykiety bieżącego projektu S.O.K.; odmowa użycia obcej bazy.'
    [[ "$RESUME_EXISTING_VOLUME" == true ]] || fail 'Wolumen sok_postgres-data już istnieje; niczego nie zmieniłem. Wznowienie wymaga --resume-existing-volume i osobnych potwierdzeń.'
    [[ -f "$ROOT/.env" ]] || fail 'Wolumen istnieje, ale brakuje .env z jego hasłami. Nie wygeneruję nowych danych dostępowych; odtwórz właściwy .env z bezpiecznego backupu.'
fi

env_file="$ROOT/.env"
[[ ! -L "$env_file" ]] || fail 'Odmowa pracy z dowiązaniem symbolicznym .env.'
install_owner="${SUDO_USER:-root}"
getent passwd "$install_owner" >/dev/null || fail 'Nie można ustalić konta administratora instalującego S.O.K.'
install_group="$(id -gn "$install_owner")"
install_home="$(getent passwd "$install_owner" | cut -d: -f6)"
[[ -n "$install_home" && "$install_home" == /* ]] || fail 'Nie można ustalić katalogu domowego administratora.'
credential_directory="$install_home/.config/sok"
password_file="$credential_directory/install-admin-password.txt"
pending_password_file="$credential_directory/install-admin-password.pending.txt"
[[ ! -L "$install_home/.config" && ! -L "$credential_directory" ]] || fail 'Odmowa zapisu sekretu do dowiązanego katalogu konfiguracji.'
[[ ! -L "$password_file" ]] || fail 'Odmowa pracy z dowiązaniem symbolicznym pliku hasła administratora.'
[[ ! -L "$pending_password_file" ]] || fail 'Odmowa pracy z dowiązaniem symbolicznym pliku tymczasowego hasła administratora.'
[[ ! -e "$env_file" || -f "$env_file" ]] || fail '.env istnieje, ale nie jest zwykłym plikiem.'
[[ ! -e "$password_file" || -f "$password_file" ]] || fail 'Plik hasła administratora istnieje, ale nie jest zwykłym plikiem.'
[[ ! -e "$pending_password_file" || -f "$pending_password_file" ]] || fail 'Tymczasowy plik hasła administratora nie jest zwykłym plikiem.'
install -d -m 0700 -o "$install_owner" -g "$install_group" "$credential_directory"
chmod 0700 "$credential_directory"
chown "$install_owner:$install_group" "$credential_directory"

replace_env_value() {
    local key="$1" value="$2"
    if grep -q "^${key}=" "$env_file"; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$env_file"
    else
        printf '%s=%s\n' "$key" "$value" >> "$env_file"
    fi
}

replace_env_value_from_stdin() {
    local key="$1" temp
    temp="$(mktemp "$ROOT/.env.XXXXXX")"
    chmod 0600 "$temp"
    chown "$install_owner:$install_group" "$temp"
    if ! awk -v key="$key" '
        BEGIN { if ((getline value < "/dev/stdin") <= 0) exit 2 }
        index($0, key "=") == 1 { print key "=" value; count++; next }
        { print }
        END { if (count != 1) exit 3 }
    ' "$env_file" > "$temp"; then
        rm -f -- "$temp"
        fail "Nie można bezpiecznie zaktualizować pola $key w .env."
    fi
    mv -T -- "$temp" "$env_file"
}

read_env_value() {
    local key="$1" count
    count="$(grep -c "^${key}=" "$env_file" || true)"
    [[ "$count" == '1' ]] || fail ".env musi zawierać dokładnie jeden wpis $key. Plik pozostawiono bez zmian."
    sed -n "s/^${key}=//p" "$env_file"
}

if [[ ! -e "$env_file" ]]; then
    ENV_TEMP="$(mktemp "$ROOT/.env.XXXXXX")"
    env_file="$ENV_TEMP"
    cp "$ROOT/.env.example" "$env_file"
    chmod 0600 "$env_file"
    if [[ -e "$password_file" ]]; then
        IFS= read -r admin_label < "$password_file"
        admin_password="$(sed -n '2p' "$password_file")"
        [[ "$admin_label" == 'admin' && ${#admin_password} -ge 8 ]] || fail 'Osierocony plik hasła ma nieoczekiwany format; niczego nie nadpisano.'
        chmod 0600 "$password_file"
        chown "$install_owner:$install_group" "$password_file"
        log INFO 'Odnaleziono wcześniejsze hasło administratora; zachowuję je podczas wznowienia konfiguracji.'
    else
        admin_password="$(openssl rand -hex 24)"
    fi
    bootstrap_password="$(openssl rand -hex 32)"
    migrator_password="$(openssl rand -hex 32)"
    app_password="$(openssl rand -hex 32)"
    backup_password="$(openssl rand -hex 32)"
    replace_env_value COMPOSE_PROJECT_NAME "$PROJECT_NAME"
    printf '%s\n' "$admin_password" | replace_env_value_from_stdin DEFAULT_ADMIN_PASSWORD
    replace_env_value POSTGRES_DB sok
    replace_env_value POSTGRES_USER sok_bootstrap
    replace_env_value POSTGRES_PASSWORD "$bootstrap_password"
    replace_env_value SOK_MIGRATOR_PASSWORD "$migrator_password"
    replace_env_value SOK_APP_PASSWORD "$app_password"
    replace_env_value SOK_BACKUP_PASSWORD "$backup_password"
    replace_env_value MIGRATION_DATABASE_URL "postgresql://sok_migrator:${migrator_password}@postgres:5432/sok?schema=public"
    replace_env_value DATABASE_URL "postgresql://sok_app:${app_password}@postgres:5432/sok?schema=public"
    replace_env_value BACKUP_DATABASE_URL "postgresql://sok_backup:${backup_password}@postgres:5432/sok?schema=public"
    replace_env_value TRUST_PROXY 1
    replace_env_value COOKIE_SECURE true
    chown "$install_owner:$install_group" "$env_file"
    if [[ ! -e "$password_file" ]]; then
        PASSWORD_TEMP="$(mktemp "$credential_directory/.install-admin-password.XXXXXX")"
        chmod 0600 "$PASSWORD_TEMP"
        chown "$install_owner:$install_group" "$PASSWORD_TEMP"
        printf 'admin\n%s\n' "$admin_password" > "$PASSWORD_TEMP"
    fi
    if [[ -n "$PASSWORD_TEMP" ]]; then
        mv -T -- "$PASSWORD_TEMP" "$password_file"
        PASSWORD_TEMP=""
    fi
    mv -T -- "$ENV_TEMP" "$ROOT/.env"
    ENV_TEMP=""
    env_file="$ROOT/.env"
    unset admin_password bootstrap_password migrator_password app_password backup_password
    log OK 'Utworzono .env i chroniony plik pierwszego hasła administratora.'
else
    chmod 0600 "$env_file"
    log INFO 'Zachowuję istniejący .env; sprawdzam wymagane sekrety i lokalne adresy PostgreSQL.'
    if [[ "$(grep -c '^RESET_ADMIN_PASSWORD_ON_BOOTSTRAP=' "$env_file" || true)" == '0' ]]; then
        replace_env_value RESET_ADMIN_PASSWORD_ON_BOOTSTRAP false
    fi
    required_keys=(DEFAULT_ADMIN_PASSWORD RESET_ADMIN_PASSWORD_ON_BOOTSTRAP POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD SOK_MIGRATOR_PASSWORD SOK_APP_PASSWORD SOK_BACKUP_PASSWORD MIGRATION_DATABASE_URL DATABASE_URL BACKUP_DATABASE_URL)
    for key in "${required_keys[@]}"; do
        value="$(read_env_value "$key")"
        [[ -n "$value" && "$value" != *CHANGE_ME* && "$value" != *REPLACE_WITH* ]] || fail ".env zawiera pusty lub przykładowy $key; administrator powinien go skonfigurować."
    done
    [[ "$(read_env_value TRUST_PROXY)" == '1' ]] || fail '.env TRUST_PROXY musi mieć wartość 1 za firmowym reverse proxy.'
    [[ "$(read_env_value COOKIE_SECURE)" == 'true' ]] || fail '.env COOKIE_SECURE musi mieć wartość true dla HTTPS.'
    rotation_flag="$(read_env_value RESET_ADMIN_PASSWORD_ON_BOOTSTRAP)"
    [[ "$rotation_flag" == 'true' || "$rotation_flag" == 'false' ]] || fail '.env RESET_ADMIN_PASSWORD_ON_BOOTSTRAP musi mieć wartość true albo false.'
    for role in migrator app backup; do
        case "$role" in
            migrator) url_key=MIGRATION_DATABASE_URL; password_key=SOK_MIGRATOR_PASSWORD ;;
            app) url_key=DATABASE_URL; password_key=SOK_APP_PASSWORD ;;
            backup) url_key=BACKUP_DATABASE_URL; password_key=SOK_BACKUP_PASSWORD ;;
        esac
        expected="postgresql://sok_${role}:$(read_env_value "$password_key")@postgres:5432/$(read_env_value POSTGRES_DB)?schema=public"
        [[ "$(read_env_value "$url_key")" == "$expected" ]] || fail ".env $url_key nie odpowiada roli lub hasłu $role; plik nie został zmieniony."
    done
    if [[ -f "$password_file" ]]; then
        chmod 0600 "$password_file"
        chown "$install_owner:$install_group" "$password_file"
    else
        log WARN 'Nie znaleziono pierwszego hasła administratora. Użyj istniejących danych logowania; DEFAULT_ADMIN_PASSWORD może być nieaktualne.'
    fi
fi

compose config --quiet
if [[ "$volume_exists" == true ]]; then
    read -r -p 'To wygląda na wolumen Compose projektu S.O.K. Wznowienie może zmienić istniejącą bazę. Wpisz RESUME: ' answer
    [[ "$answer" == 'RESUME' ]] || fail 'Wznowienie anulowane; baza nie została zmieniona.'
    read -r -p 'Teraz uruchomię migracje schematu i seed na tej bazie. Kontynuuj tylko dla przerwanej instalacji S.O.K. po sprawdzeniu backupu. Wpisz MIGRATE AND SEED: ' answer
    [[ "$answer" == 'MIGRATE AND SEED' ]] || fail 'Migracje i seed anulowane; istniejąca baza nie została zmieniona.'
fi

[[ ! -L "$INSTALL_MARKER" ]] || fail 'Wskaźnik instalacji jest dowiązaniem; odmowa jego zmiany.'
rm -f -- "$INSTALL_MARKER"

log INFO 'Buduję aplikację i uruchamiam PostgreSQL 18.'
compose build app
compose up --detach --wait --wait-timeout 180 postgres

secret_check_script='const { isUnsafeDefaultAdminPassword } = require("./dist/src/middleware/auth.js"); console.log("SOK_ADMIN_SECRET_UNSAFE=" + isUnsafeDefaultAdminPassword(process.env.DEFAULT_ADMIN_PASSWORD));'
secret_check_output="$(compose run --rm --no-deps --entrypoint node db-bootstrap -e "$secret_check_script")" || fail 'Nie można bezpiecznie sprawdzić początkowej konfiguracji administratora.'
secret_check_output="$(printf '%s\n' "$secret_check_output" | sed -n 's/^SOK_ADMIN_SECRET_UNSAFE=\(true\|false\)$/\1/p')"
[[ "$secret_check_output" == 'true' || "$secret_check_output" == 'false' ]] || fail 'Kontrola sekretu administratora zwróciła nieprawidłowy wynik.'
if [[ "$secret_check_output" == 'true' ]]; then
    admin_password="$(openssl rand -hex 24)"
    PENDING_PASSWORD_TEMP="$(mktemp "$credential_directory/.install-admin-password.pending.XXXXXX")"
    chmod 0600 "$PENDING_PASSWORD_TEMP"
    chown "$install_owner:$install_group" "$PENDING_PASSWORD_TEMP"
    printf 'admin\n%s\n' "$admin_password" > "$PENDING_PASSWORD_TEMP"
    mv -T -- "$PENDING_PASSWORD_TEMP" "$pending_password_file"
    PENDING_PASSWORD_TEMP=""
    printf '%s\n' "$admin_password" | replace_env_value_from_stdin DEFAULT_ADMIN_PASSWORD
    replace_env_value RESET_ADMIN_PASSWORD_ON_BOOTSTRAP true
    unset admin_password
    log WARN 'Niebezpieczny sekret początkowy zostanie zastąpiony losowym; istniejące konto admin zostanie obrócone tylko podczas tego bootstrapu.'
fi

bootstrap_output="$(compose run --rm --no-deps db-bootstrap 2>&1)" || {
    printf '%s\n' "$bootstrap_output" >&2
    fail 'Bootstrap PostgreSQL nie powiódł się.'
}
printf '%s\n' "$bootstrap_output"
admin_match="$(printf '%s\n' "$bootstrap_output" | sed -n 's/.*SOK_ADMIN_CREDENTIAL_MATCH=\(true\|false\).*/\1/p' | tail -n 1)"
[[ "$admin_match" == 'true' || "$admin_match" == 'false' ]] || fail 'Bootstrap nie zweryfikował danych logowania administratora.'
if [[ "$admin_match" == 'false' ]]; then
    [[ "$(read_env_value RESET_ADMIN_PASSWORD_ON_BOOTSTRAP)" != 'true' ]] || fail 'Rotacja administratora nie została potwierdzona; serwer aplikacji nie został uruchomiony.'
    log INFO 'Istniejące konto administratora zachowuje dotychczasowe dane logowania.'
else
    if [[ -f "$pending_password_file" ]]; then
        mv -T -- "$pending_password_file" "$password_file"
        chmod 0600 "$password_file"
        chown "$install_owner:$install_group" "$password_file"
    fi
    replace_env_value RESET_ADMIN_PASSWORD_ON_BOOTSTRAP false
fi

mount="$ARTIFACT_PATH:/tmp/active-pricelists.json:ro"
dry_run="npx ts-node scripts/import-active-pricelists.ts /tmp/active-pricelists.json"
log INFO 'Sprawdzam artefakt cenników bez zapisywania danych.'
compose run --rm --no-deps --volume "$mount" --entrypoint sh app -ec "$dry_run"
read -r -p 'Jeśli raport zawiera oczekiwane trzy aktywne cenniki i liczniki, wpisz IMPORT: ' answer
[[ "$answer" == 'IMPORT' ]] || fail 'Import anulowany. Serwer S.O.K. nie został uruchomiony.'
apply_import="npx ts-node scripts/import-active-pricelists.ts /tmp/active-pricelists.json --apply"
log INFO 'Importuję wyłącznie aktywne cenniki.'
compose run --rm --no-deps --volume "$mount" --entrypoint sh app -ec "$apply_import"

log INFO 'Uruchamiam S.O.K. i czekam na gotowość PostgreSQL oraz aplikacji.'
compose up --detach --wait --wait-timeout 300 app
compose ps
MARKER_TEMP="$(mktemp "$ROOT/.sok-postgres-installed.XXXXXX")"
printf 'PostgreSQL 18; active pricelists imported; app readiness passed\n' > "$MARKER_TEMP"
chmod 0600 "$MARKER_TEMP"
mv -T -- "$MARKER_TEMP" "$INSTALL_MARKER"
MARKER_TEMP=""
printf '\n[OK] S.O.K. działa lokalnie na serwerze: http://127.0.0.1:3000\n'
printf '[INFO] Dostęp z firmowej sieci wymaga reverse proxy HTTPS kierującego do 127.0.0.1:3000. Nie wystawiaj portu PostgreSQL.\n'
if [[ -f "$password_file" ]]; then
    printf '[INFO] Pierwsze hasło administratora zapisano w %s (uprawnienia 0600). Zmień je po pierwszym logowaniu.\n' "$password_file"
fi
