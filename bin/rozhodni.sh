#!/bin/bash
# Zápis rozhodnutia do rozhodnutia/ repa pravidiel: pridelí číslo, zapíše
# súbor, prepíše INDEX.md, commitne pod menom agenta, pushne a na serveri
# spustí sync. Úložisko a schéma sú v rozhodnutia/README.md, logiku nesie
# lib/rozhodnutia.mjs. Návrh je úloha Taskera 390.
#
# Použitie (text záznamu na stdin):
#   rozhodni.sh --nazov N --kluc K --rozsah R,R --agenti A,A --rozhodol KTO
#               --moc MOC --zdroj Z [--nahradza D0001] [--uloha N]
#               [--alias R153] [--subory s1,s2] [--zrusene-tvrdenie REGEX] [--z-ulohy N]
#               [--zapisal správca agentov] [--datum RRRR-MM-DD] [--dry-run]
#   rozhodni.sh --zrus D0007 --dovod "dôvod" [--dry-run]
# --z-ulohy N doplní --zdroj a --uloha z úlohy Taskera (ROZHODNI_TASKER, inak
# bin/tk), explicitné --zdroj a --uloha majú prednosť.
# --dry-run vypíše záznam a nezapíše nič, ani git. Rovnaký kľúč ako platný
# záznam bez --nahradza skončí chybou s výpisom platných záznamov.
#
# Premenné: AGENT_NAME (kto píše, inak --zapisal), ROZHODNI_STROJ (meno
# stroja v mene autora, inak hostname), ROZHODNUTIA_REPO (iný klon, test).
# S ROZHODNUTIA_REPO sa sync nespúšťa. Commit nesie meno "<Agent> (<stroj>)".
# Kód 0 zapísané, 1 chyba, 2 zlé použitie.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
lib="$here/../lib/rozhodnutia.mjs"
repo="${ROZHODNUTIA_REPO:-$(cd "$here/.." && pwd)}"
dir="$repo/rozhodnutia"

args=()
dry=0
zrus=0
zapisal=""
z_ulohy=""; zdroj_dany=0; uloha_dana=0
while [ $# -gt 0 ]; do
    case "$1" in
        --dry-run) dry=1 ;;
        --zrus) zrus=1; args+=("$1" "${2:-}"); shift ;;
        --zapisal) zapisal="${2:-}"; shift ;;
        --z-ulohy) z_ulohy="${2:-}"; shift ;;
        --zdroj) zdroj_dany=1; args+=("$1" "${2:-}"); shift ;;
        --uloha) uloha_dana=1; args+=("$1" "${2:-}"); shift ;;
        --telo|--dir)
            echo "Prepínač $1 nie je pre rozhodni.sh, text ide na stdin." >&2
            exit 2 ;;
        *) args+=("$1") ;;
    esac
    shift
done

# --z-ulohy N: zdroj a číslo úlohy z Taskera (ROZHODNI_TASKER, inak bin/tk),
# explicitné --zdroj a --uloha majú prednosť.
if [ -n "$z_ulohy" ]; then
    if ! [[ "$z_ulohy" =~ ^[0-9]+$ ]]; then echo "--z-ulohy chce číslo úlohy, dostal som '$z_ulohy'." >&2; exit 2; fi
    tasker_cmd="${ROZHODNI_TASKER:-$here/tk}"
    if ! uj="$($tasker_cmd task show "$z_ulohy" --json 2>/dev/null)" || [ -z "$uj" ]; then
        echo "Úlohu $z_ulohy sa nepodarilo prečítať z Taskera, zapíš --zdroj a --uloha ručne." >&2
        exit 1
    fi
    zdroj_z="$(node "$lib" zdroj-ulohy <<<"$uj")" || { echo "Úloha $z_ulohy: $zdroj_z" >&2; exit 1; }
    [ "$uloha_dana" = 0 ] && args+=(--uloha "$z_ulohy")
    [ "$zdroj_dany" = 0 ] && args+=(--zdroj "$zdroj_z")
fi

if [ -z "$zapisal" ] && [ -n "${AGENT_NAME:-}" ]; then
    zapisal="$(tr '[:lower:]' '[:upper:]' <<<"${AGENT_NAME:0:1}")${AGENT_NAME:1}"
fi
[ -n "$zapisal" ] && args+=(--zapisal "$zapisal")

telo=""
if [ "$zrus" = 0 ]; then telo="$(cat)"; fi
node_zapis() {
    if [ "$zrus" = 1 ]; then node "$lib" zapis --dir "$dir" "$@"
    else node "$lib" zapis --dir "$dir" --telo "$telo" "$@"; fi
}

if [ "$dry" = 1 ]; then
    node_zapis "${args[@]}" --dry-run
    exit $?
fi

if [ -z "$zapisal" ]; then
    echo "Chýba kto píše: AGENT_NAME alebo --zapisal." >&2
    exit 2
fi
stroj="${ROZHODNI_STROJ:-$(hostname -s)}"
autor="$zapisal ($stroj)"
git_r() { git -C "$repo" "$@"; }

if [ "$(git_r rev-parse --abbrev-ref HEAD)" != main ]; then
    echo "Klon $repo nie je na vetve main, nič som nezapísal." >&2
    exit 1
fi

# Zapíše výstup `zapis` (id, názov, súbory) ako commit. Nastaví id, nazov, subory.
commit_out() {
    local out="$1" autor_c="$2" msg
    id="$(sed -n 1p <<<"$out")"
    nazov="$(sed -n 2p <<<"$out")"
    subory=()
    while IFS= read -r f; do [ -n "$f" ] && subory+=("rozhodnutia/$f"); done < <(sed -n '3,$p' <<<"$out")
    git_r add -- "${subory[@]}" || return 1
    if [ "$zrus" = 1 ]; then msg="Rozhodnutie $id zrušené: $nazov"; else msg="Rozhodnutie $id: $nazov"; fi
    if ! git_r -c user.name="$autor_c" commit -q -m "$msg" -- "${subory[@]}"; then
        # Hook pre-commit (check.mjs) commit odmietol: súbory sa nesmú ostať v indexe, ďalší zápis by padol na rebase.
        git_r reset -q -- "${subory[@]}"
        local f
        for f in "${subory[@]}"; do
            if git_r cat-file -e "HEAD:$f" 2>/dev/null; then git_r checkout -q -- "$f"; else rm -f "$repo/$f"; fi
        done
        id=""
        return 1
    fi
}

# Rebase padol na konflikte lokálnych nepushnutých commitov rozhodnutí
# (rovnaké číslo D z dvoch strojov, S3 a S6 úlohy 404). Keď sú všetky nepushnuté
# commity zápisy nových rozhodnutí a strom je čistý, zapíše ich znova nad
# origin/main pod novým číslom. Pri neúspechu (napr. rovnaký kľúč) vráti klon
# na pôvodný stav. Vráti 0 len keď sú všetky znova zapísané.
precisluj_lokalne() {
    local orig shas sha f tmpd st
    orig="$(git_r rev-parse HEAD)"
    [ -z "$(git_r status --porcelain --untracked-files=no)" ] || return 1
    shas="$(git_r log --reverse --format=%H origin/main..HEAD)"
    [ -n "$shas" ] || return 1
    tmpd="$(mktemp -d)"
    for sha in $shas; do
        git_r log -1 --format=%s "$sha" | grep -q '^Rozhodnutie D[0-9]\{4\}: ' || { rm -rf "$tmpd"; return 1; }
        st="$(git_r diff-tree --no-commit-id --name-status -r "$sha" -- rozhodnutia | grep -E $'^A\trozhodnutia/D[0-9]{4}\.md$' || true)"
        [ -n "$st" ] || { rm -rf "$tmpd"; return 1; }
        f="${st#*$'\t'}"
        git_r show "$sha:$f" >"$tmpd/$sha.md"
        git_r log -1 --format=%an "$sha" >"$tmpd/$sha.autor"
    done
    git_r reset -q --hard origin/main
    local o
    for sha in $shas; do
        if ! o="$(node "$lib" znovu --dir "$dir" --subor "$tmpd/$sha.md" 2>&1)" || ! commit_out "$o" "$(cat "$tmpd/$sha.autor")"; then
            echo "Prečíslovanie lokálneho záznamu zlyhalo (vrátil som klon na pôvodný stav): $o" >&2
            git_r reset -q --hard "$orig"
            rm -rf "$tmpd"
            return 1
        fi
        echo "Lokálny záznam ${id} sa po cudzom zápise prečísloval." >&2
    done
    rm -rf "$tmpd"
}

zapis_a_push() {
    git_r fetch -q origin
    if ! git_r rebase -q origin/main >/dev/null 2>&1; then
        git_r rebase --abort 2>/dev/null
        if ! precisluj_lokalne; then
            echo "Rebase na origin/main zlyhal (necommitnuté zmeny alebo konflikt s lokálnym commitom rozhodnutia), rebase som zrušil. Nepushnutý záznam zachráň: git log origin/main..HEAD, text si ulož, git reset --hard origin/main a zapíš znova (konflikt kľúča rieši --nahradza)." >&2
            return 1
        fi
    fi
    local out
    out="$(node_zapis "${args[@]}")" || return 1
    commit_out "$out" "$autor" || return 1
    git_r push -q origin HEAD:main || return 1
}

# Po odmietnutom pushi vráti vlastný commit a zmeny súborov, zvyšok klonu nechá.
vrat() {
    git_r reset -q HEAD~1
    local f
    for f in "${subory[@]}"; do
        if git_r cat-file -e "HEAD:$f" 2>/dev/null; then git_r checkout -q -- "$f"; else rm -f "$repo/$f"; fi
    done
}

id=""; nazov=""; subory=()
if ! zapis_a_push; then
    if [ -n "$id" ] && [ "$(git_r log -1 --format=%s)" != "" ] && git_r log -1 --format=%s | grep -q "^Rozhodnutie $id"; then
        echo "Push odmietnutý, skúsim raz znova s novým číslom." >&2
        vrat
        id=""; subory=()
        if ! zapis_a_push; then
            # Commit druhého pokusu ostáva v klone (offline zápis, push pri najbližšom pripojení).
            if [ -n "$id" ] && git_r log -1 --format=%s | grep -q "^Rozhodnutie $id"; then
                echo "Záznam $id je commitnutý len lokálne, nepushnutý. Po pripojení: git fetch, git rebase origin/main, git push origin HEAD:main." >&2
                exit 1
            fi
            echo "Druhý pokus zlyhal, záznam nie je zapísaný. Pozri chybu hore." >&2
            exit 1
        fi
    else
        exit 1
    fi
fi

if [ -z "${ROZHODNUTIA_REPO:-}" ] && command -v systemctl >/dev/null; then
    systemctl start agent-rules-sync.service 2>/dev/null || echo "Sync agent-rules-sync.service sa nespustil, klon servera ho stiahne do 5 minút." >&2
fi
echo "$id"
