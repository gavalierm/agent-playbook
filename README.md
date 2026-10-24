# agent-playbook

Návod, ako postaviť agentov s identitou, pravidlami a kontrolou, a očistené
kópie súborov z živého súkromného repa pravidiel jedného operátora. Návod
opisuje, čo sme postavili, prečo a v akom poradí to postaviť u seba. Nie je to
plugin a nič sa z neho neinštaluje.

## Kde začať

Prečítaj `PLAYBOOK.md`. Každá kapitola má problém, mechanizmus, kroky a odkaz
na náš príklad v tomto repe. Skopíruj mechanizmy, nie naše pravidlá. Pravidlá
sú odpoveďou na naše chyby a tvoje budú iné.

## Čo tu je

| cesta | čo to je |
|---|---|
| `PLAYBOOK.md` | samotný návod |
| `global/CLAUDE.md` | globálne pravidlá všetkých agentov |
| `roles/` | index rolí `ROLES.md` a pravidlá každej roly |
| `env/server/CLAUDE.md` | príklad pravidiel prostredia (server s viacerými agentmi) |
| `skills/unslop/`, `skills/chyba/` | skilly: písanie bez znakov strojového textu, uznaná chyba |
| `hooks/` | hooky s testami: identita a roly, zmena pravidiel, rozsah pravidla, odpoveď agenta, prijatá námietka, úlohy správcu úloh |
| `lib/` | pomocný kód hookov, register rozhodnutí `rozhodnutia.mjs`, kontrola verejného repa `public_check.mjs`, kontrola odkazov na cesty `path_check.mjs` |
| `bin/chyba.sh`, `bin/rozhodni.sh`, `bin/tk` | zápis uznanej chyby, zápis rozhodnutia, obal správcu úloh |
| `rozhodnutia/` | schéma registra rozhodnutí a značky rozsahu |

## Čo v repe nie je

Súkromné repo prevádzky nesie veci viazané na jedného operátora. Sú v ňom mená ľudí, agentov, strojov a účtov, adresy,
persony agentov a runtime správcu agentov (budič, schránky). Preto sa neprenášajú. Odkazy na ne v `PLAYBOOK.md` a v kóde
ostali, ukazujú do súkromného repa prevádzky. Ostatné súbory, ktoré text spomína a ktoré tu nie sú, opisuje táto tabuľka.
Zástupný vzor `rozhodnutia/D0xxx.md` znamená ľubovoľný záznam rozhodnutia. Kontrola `lib/path_check.mjs` zlyhá, keď text
spomenie cestu, ktorá v repe nie je a nie je v tabuľke.

| cesta | čo robí | prečo tu nie je |
|---|---|---|
| `env/mac/` | Pravidlá, nasadenie a nastavenie prostredia na Macu operátora, tiež popisy štruktúry a toku práce. | Nesie adresy a cesty konkrétneho stroja. Podobu prostredia ukazuje `env/server/CLAUDE.md`. |
| `env/server/install.sh` | Nasadí pravidlá z klonu na server, zapojí hooky do nastavenia Claude Code a zapne časovač, ktorý klon každých 5 minút stiahne. | Viazaný na náš server a systemd. Hooky si zapojíš vo vlastnom nastavení Claude Code. |
| `roles/agents.md` | Tabuľka agentov s rolou, strojom a cestou, ktorou sa budia. | Nesie mená agentov a strojov. Rola je v `roles/ROLES.md`, meno agenta patrí len do tejto tabuľky. |
| `rozhodnutia/D0010.md` | Pokyn v rozpore s písaným pravidlom pravidlo nemení, agent ho pomenuje a spýta sa, či ho zmeniť. Nahradil ho D0144. | Súkromný záznam rozhodnutia, nesie mená a odkazy na naše úlohy. |
| `rozhodnutia/D0141.md` | Každé zamietnutie hooku nesie riadok "Správny postup:" s krokom, ktorým agent cieľ dosiahne. | Súkromný záznam rozhodnutia. Pravidlo samo je v kapitole 6 playbooku. |
| `rozhodnutia/D0142.md` | Uznaná chyba spustí skill nápravy so skriptom, ktorý ju zapíše do registra a pri druhom výskyte založí úlohu na kontrolu. | Súkromný záznam rozhodnutia. Mechanizmus je v kapitole 5 playbooku a v `skills/chyba/SKILL.md`. |
| `rozhodnutia/D0144.md` | Potvrdená zmena pravidla ide do pravidla na jeho úrovni, lokálne pravidlo s globálnym dosahom sa presunie do globálnych a duplikáty sa odstránia. | Súkromný záznam rozhodnutia, nesie odkazy na naše úlohy. |
| `bin/ask_agent.sh` | Pošle správu agentovi zo schránky na schránku a zapíše trasu odpovede. Na stavbu potrebuješ vedieť, že zapíše súbor cez skrytý `.tmp` a `mv`, vloží hlavičku s režimom `čakám` alebo `na vedomie` a režim `nečakám` odmietne (kapitola 8, bod 3). | Potrebuje naše schránky agentov a budič. |
| `hooks/ask_agent.test.mjs` | Test skriptu `bin/ask_agent.sh` v dočasných schránkach. | Testuje skript, ktorý tu nie je. |
| `runtime/reply.sh` | Odpoveď agenta na správu zo schránky s hlavičkou `k:` a predvoleným režimom `na vedomie`. Na stavbu potrebuješ vedieť, že zistí režim a tému z pôvodnej správy v `processed`, odmietne telo s riadkom `Úloha`, `Otázka` alebo `Hotovo:` bez výslovného režimu a zapíše trasu (kapitola 8, bod 4). | Je v repe správcu agentov a číta nastavenie našich schránok. |
| `runtime/route.mjs` | Trasa odpovede (id správy `k:` na vlákno odosielateľa v `routes.json`) a zoznam tém. Na stavbu potrebuješ vedieť, že záznam vzniká pri odoslaní z vlákna témy a budič ním pri odpovedi vyberie cieľové vlákno (kapitola 8, bod 7). | Je v repe správcu agentov a hľadá vlákna cez T3 Code. |
| `runtime/driver.mjs` | Budič doručí správu zo schránky agenta do vlákna a po riadku `HOTOVO-KONTEXT` pošle `/clear`. Na stavbu potrebuješ vedieť, že číta `inbox` každých 5 s, drží tiché okno a dávkuje, nikdy nepošle do vlákna s aktívnym behom a po odoslaní presunie súbory do `processed` (kapitola 8, body 5 a 6). | Je v repe správcu agentov a je viazaný na T3 Code a naše schránky. |
| `runtime/README.md` | Opis runtime, teda schránky, budiča, odpovedí a nasadenia. Na stavbu z neho potrebuješ časť Budenie, ktorú kapitola 8 zhrnula. | Je v repe správcu agentov, opisuje naše nasadenie. |
| `bin/kontext.sh` | Vypíše riadok `HOTOVO-KONTEXT <režim> <kľúč>`, ktorým agent končí odpoveď pred čistým kontextom. | Viazaný na budič a vlákna T3 Code. Postup je v kapitole 11 playbooku. |
| `lib/kontext.mjs` | Logika skriptu `bin/kontext.sh`. Zapíše odovzdávku a odmietne čistenie, keď úloha agenta čaká. | Viazaná na budič, vlákna T3 Code a náš správca úloh. |
| `hooks/clear_bridge.mjs` | SessionStart hook po `/clear`. Zabráni návratu starého kontextu a urobí štart relácie. | Rieši vlastnosť nášho runtime T3 Code, u teba sa môže správať inak. |
| `hooks/context_warning.mjs` | UserPromptSubmit hook, nad 80 tisíc tokenov kontextu pridá pokyn na čistý kontext. | Pokyn volá `bin/kontext.sh` a počíta s naším budičom. |
| `hooks/no_model_wait.mjs` | PreToolUse hook, zamietne čakanie v popredí (`sleep` nad 10 s, slučka so `sleep`). Na stavbu stačí hook, ktorý zamietne príkaz so `sleep` nad desať sekúnd alebo slučku so `sleep`. | Text zamietnutia odkazuje na náš budič a správcu úloh. Mechanizmus je v kapitole 6 playbooku. |
| `hooks/unslop.mjs` | SessionStart hook, vloží do kontextu sekciu Jadro zo `skills/unslop/SKILL.md` s verziou skillu. | Vkladaný text nesie pravidlá nášho runtime a odkaz na našu personu. Skill samotný tu je. |
| `hooks/tasker_root.mjs` | PreToolUse hook, zamietne priamy príkaz správcu úloh pod rootom, správny je obal `bin/tk`. | Rieši naše nasadenie, správca úloh u nás beží pod iným používateľom. |
| `hooks/web_review.mjs` | PreToolUse hook, zamietne založenie úlohy webu mimo skriptu a čakanie, kým posudok dizajnéra nevyhovuje. | Viazaný na náš správca úloh a agentov webu. |
| `bin/uloha-webu.sh` | Založí úlohu webu a k nej úlohu posudku dizajnéra, rodiča zablokuje. | Volá náš správca úloh a bránu posudku. |
| `hooks/rozhodnutia_guard.mjs` | PreToolUse hook, zamietne zápis do záznamov rozhodnutí inak než skriptom `bin/rozhodni.sh`. | Počíta s naším archívom rozhodnutí a nasadením hookov. |
| `hooks/rozhodnutia_context.mjs` | SessionStart hook, ohlási rozhodnutia zmenené od posledného štartu agenta a otázky na operátora. | Číta naše záznamy, persony a správcu úloh. |
| `lib/doc_paths.mjs` | Overí, že cesta v pokynoch agenta ukazuje na existujúci súbor, a zastaví zrušené tvrdenia. | Počíta s našimi strojmi a zoznamom zrušených tvrdení. Jednoduchá verzia pre tento repozitár je `lib/path_check.mjs`. |
| `lib/retired_claims.txt` | Zoznam zrušených tvrdení. Riadok je regulárny výraz, tabulátor a dôvod. | Nesie mená našich agentov a zrušené veci. Formát si prevezmi. |
| `lib/memory_claims.mjs` | Zastaví riadok pamäte agenta, ktorý tvrdí, že niečo čaká na operátora bez čísla úlohy, alebo spomína rozhodnutie bez čísla záznamu. | Viazaná na naše úlohy a pamäť agentov. |
| `lib/rule_dupes.mjs` | Nájde pravidlá, ktoré hovoria to isté v lokálnych aj zdieľaných pravidlách. | Skript je prenosný, ale jeho test a zoznam výnimiek nesú naše mená, preto ho nekopírujeme. Postup je v kapitole 2 playbooku. |
| `lib/global_word_cap.txt` | Strop počtu slov v `global/CLAUDE.md`, smie len klesať. | Číslo je naša voľba a kontrola stropu tu nie je. |
| `lib/commit_guard.sh` | Hook commit-msg, odmietne trailer Co-Authored-By, cudzí e-mail a autora, ktorého meno nie je v tvare agent a stroj. | Číta zoznam našich agentov a e-mail operátora. |
| `lib/open_branch_guard.sh` | Hook pre-commit, odmietne commit na main do súboru, ktorý mení otvorená vetva, a commit na vetve bez rebase. | Beží z klonu pravidiel nasadeného na našich strojoch. |
| `skills/projekt-novy` | Skill so skriptmi, ktorý jedným behom založí projekt webu s repami, klonmi, DNS a úlohami. | Príklad skillu s našimi účtami a doménami. |
| `skills/artefakty/SKILL.md` | Skill, ktorý opisuje používanie schválených vzorov opakovanej práce z priečinka `artifacts/`. | Vzory sú naše pracovné výstupy, `artifacts/` v repe nie je. |

Rovnako tu nie sú skripty a testy, ktoré potrebujú živý správca úloh, schránky agentov alebo nasadenie v `/opt/agent-rules`
(napríklad `check.mjs`).

Súbory sú očistené: mená nahradila rola alebo zástupné meno (`<server>`,
`<tailnet>`, `<používateľ správcu úloh>`, `<projekt>`). Kde kód potrebuje skutočnú
hodnotu, je tam predvolená (napríklad používateľ `tasker`) a komentár, že ju máš
upraviť. Fixtúry testov používajú názvy rolí alebo mená `Alfa`, `Beta`, `Gama`.

## Kontrola a testy

Po klonovaní zapni hooky repa:

```
git config core.hooksPath .githooks
```

`pre-commit` aj `pre-push` spustia `node lib/public_check.mjs` a `node lib/path_check.mjs`. Ten prejde
všetky súbory v gite a zlyhá kódom 1, keď nájde meno človeka, agenta, stroja,
účtu alebo adresu zo vzorov v `lib/public_check.txt` (vzory sú v base64, aby
zoznam mená nevyzrádzal). `pre-push` skontroluje aj meno autora a správy
commitov, ktoré idú von.

`path_check.mjs` prejde všetky `*.md` v repe a zlyhá kódom 1, keď text v apostrofoch spomína cestu (`bin/`, `lib/`, `hooks/`,
`skills/`, `roles/`, `env/`, `global/`, `rozhodnutia/`, `artifacts/`, `runtime/`), ktorá v repe nie je a nie je v tabuľke
"Čo v repe nie je". Vypíše súbor, riadok a cestu.

Testy potrebujú Node 22 alebo novší:

```
node --test 'hooks/*.test.mjs' 'lib/*.test.mjs'
node lib/public_check.mjs
node lib/path_check.mjs
```

Hooky `*.test.mjs` bežia v dočasných priečinkoch a živý Tasker ani schránky
nevolajú. Súbor `hooks/reply_guard.test.mjs` nie je test v zmysle `node:test`,
beží ako skript a zlyhá kódom 1.

## Jazyk

Prvá verzia je po slovensky. Anglický preklad je plánovaný po schválení obsahu.

## Ako prispievať

Pošli pull request s mechanizmom: ako sa pravidlo zapíše, načíta, skontroluje
alebo opraví, s testom, ktorý na chybe zlyhá. Pravidlá prevádzky konkrétneho
operátora (kto smie čo, aké sú jeho zákazy) sem nepatria, tie si každý drží vo
vlastnom repe. Pred pull requestom spusti `node lib/public_check.mjs`, `node lib/path_check.mjs` a testy.

## Licencia

MIT, súbor `LICENSE`.
