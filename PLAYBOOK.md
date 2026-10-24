# Playbook: agenti s identitou, pravidlami a kontrolou

## 0. Úvod

Tento návod je pre operátora, ktorý chce mať viac agentov (relácie jazykového modelu s vlastným repom) a nechce im
stále opakovať to isté. Je aj pre agenta, ktorý dostal pokyn "prečítaj si toto repo, naštuduj a premysli, ako
postaviť podobný mechanizmus u nás". Nie je to plugin a nič sa z neho neinštaluje. Opisuje, čo sme postavili, prečo a
v akom poradí to postaviť u seba.

Problém je jednoduchý. Agent bez pamäte opakuje chyby, pýta sa na veci, ktoré operátor už rozhodol, a tvrdí veci,
ktoré neoveril. Prosba "nabudúce pozor" nepomôže, lebo nabudúce je nová relácia. Pomáha len pravidlo zapísané v súbore,
ktorý sa pri štarte načíta, a kontrola, ktorá zlyhá, keď agent pravidlo poruší.

Systém preto stojí na troch veciach. Pravidlá a rozhodnutia sú súbory v gite. Chybu uznanú operátorom sprevádza zmena
súboru, ktorý správanie riadi. Čo sa dá skontrolovať strojom, kontroluje hook alebo skript, nie dobrá vôľa modelu.

Každá kapitola 1 až 11 má štyri časti. Problém hovorí, čo sa bez mechanizmu pokazí. Mechanizmus opisuje, ako to
robíme. Ako to postaviť dáva kroky, formát súboru a príklad. Náš príklad ukazuje cesty v tomto repe, kde si hotovú
verziu prečítaš. Kapitola 12 je poradie práce na prvý týždeň.

Cesty sú voči koreňu tohto repa, ak nie je uvedené inak. Na serveri je repo nasadené ako klon `/opt/agent-rules`,
ktorý časovač každých 5 minút stiahne z gitu. Mapu repa nesie `README.md`, prečítaj ju prvú. Neskopíruj naše pravidlá
ako text, sú odpoveďou na naše chyby a tvoje budú iné. Skopíruj mechanizmy, teda spôsob, ako sa pravidlo zapíše,
načíta, skontroluje a opraví.

### Slovník

| pojem | význam |
|---|---|
| operátor | človek, ktorý vlastní pracovisko, agentov a účty a rozhoduje o tom, čo si vyhradil |
| zástupca operátora | agent s mandátom rozhodovať za operátora v schválených medziach |
| správca agentov | rola, ktorá spravuje persony, pravidlá, hooky a tok práce agentov |
| správca servera | agent s rootom, robí len prácu, ktorá root alebo citlivý úkon potrebuje |
| správca úloh | nástroj s úlohami, stavmi a komentármi, u nás Tasker |
| persona, rola | súbor `PERSONA.md` v repe agenta a mandát opísaný v `roles/<slug>.md`, nezávislý od mena agenta |

## 1. Agent je persona a pamäť v gite, nie relácia

### Problém

Relácia modelu zanikne pri čistom kontexte, kompakcii, reštarte aj pri výmene stroja. Čo agent vie len z rozhovoru,
po nej nevie. Operátor potom vysvetľuje znova, kto agent je, čo smie a čo sa už dohodlo. Agent, ktorého správanie
závisí od toho, ako sa relácia vyvinie, je nepredvídateľný.

### Mechanizmus

Agent je repo v gite. Obsahuje personu (`PERSONA.md`), súbor runtime, ktorý personu importuje, pamäť a vlastné
skilly. Relácia je len jedno spustenie nad týmto repom. Pri štarte sa načíta persona a pamäť. Čo má prežiť reláciu,
agent zapíše do súborov, commitne a pushne.

Persona hovorí, kto agent je, ako pracuje s operátorom, čo spravuje a kde sú jeho hranice. Nemá mená nástrojov
konkrétneho runtime, aby sa dala preniesť. Pravidlá, ktoré potrebuje aj iný agent, v nej nie sú (kapitola 2).

Pamäť drží fakty, ktoré presahujú jeden projekt. Rozhodnutia a postupy patria do dokumentov projektu a do registra
rozhodnutí. Poučenie z chyby sa z pamäte prenesie do persony.

Štart relácie je vždy rovnaký. Agent urobí `git fetch origin && git rebase origin/main` v repe agenta a v repe
pravidiel, potom prečíta pamäť a schránku. `git pull` sa nepoužíva, lebo súbežné fetche viacerých relácií v jednom
klone zapíšu do `FETCH_HEAD` dva riadky a pull padne.

Commit podpisuje agent menom `<Agent> (<stroj>)` a vždy so zoznamom súborov za `--`, lebo index klonu zdieľa viac relácií.
Zakázané sú holý `git commit`, `-a`, `git add -A` aj `git add .`. Práca je hotová, keď je `git status --short` po pushi
prázdny.

### Ako to postaviť

1. Založ súkromné repo pre agenta s vlastným kľúčom na zápis. Jeden kľúč na agenta ukáže, kto pushol. Tajomstvá patria
   do súborov s právami `600` mimo repa.
2. Napíš `PERSONA.md`. Prvý riadok je nadpis s menom, pod ním riadok s rolami, potom sekcie. Päť sekcií stačí.
3. Napíš súbor runtime, ktorý personu importuje. Pre Claude Code je to `CLAUDE.md` v koreni repa.
4. Založ `memory/` s indexom `memory/MEMORY.md`, v ktorom je jeden riadok na súbor pamäte.
5. Do persony napíš pravidlo štartu (fetch, rebase, pamäť, schránka) a konca (nedokončené do pamäte, commit, push).
6. Zapni hook pre-commit, ktorý spustí kontroly repa (kapitoly 4 a 6). Bez nich sa pravidlá rozídu.

Súbor runtime:

```
@PERSONA.md

# <Meno> na <stroj>

Tento súbor pridáva k PERSONA.md len to, čo patrí behu na tomto stroji.
```

### Náš príklad

Pravidlá štartu a konca sú v `env/server/CLAUDE.md`, časť "Git na serveri", pravidlo nedokončenej práce v
`global/CLAUDE.md`, §6. Že persona nemá mená nástrojov runtime, hovorí `roles/spravca-agentov.md`, časť "Persona
agentov". Pre-commit hook je `.githooks/pre-commit`. Ukážku persony má repo správcu agentov v súbore `PERSONA.md`.

## 2. Vrstvy pravidiel

### Problém

Pravidlá napísané na jednom mieste sa rozrastú. Pravidlo, ktoré potrebuje každý agent, sa skopíruje do piatich person
a piate znenie sa potom líši od prvého. Pravidlo o role zapísané s menom agenta prestane platiť, keď sa agent premenuje
alebo rolu prevezme iný. Agent navyše nevie, ktoré z dvoch pravidiel je silnejšie.

### Mechanizmus

Pravidlá majú päť vrstiev od najširšej po najužšiu.

| vrstva | súbor | komu platí |
|---|---|---|
| globálne | `global/CLAUDE.md` | každý agent všade |
| prostredie | `env/<prostredie>/CLAUDE.md` | každý agent na tomto stroji |
| rola | `roles/<slug>.md` | agent, ktorého persona rolu uvádza |
| persona | `PERSONA.md` v repe agenta | jeden agent |
| projekt | `CLAUDE.md` projektu | práca v projekte, má prednosť |

Načítanie je tvrdé, nie dobrovoľné. Claude Code načíta `CLAUDE.md` z každého rodiča pracovného priečinka. Globálny
súbor preto dáš ako symlink do `~/.claude/CLAUDE.md` a súbor prostredia ako symlink do koreňa stromu, pod ktorým agenti
bežia. Persona sa načíta importom `@PERSONA.md` zo súboru runtime. Roly vloží hook pri štarte relácie.

Hook `identity.mjs` (SessionStart) prečíta z `PERSONA.md` riadok `Role: <slug>, <slug>` a do kontextu vloží súbory
`roles/<slug>.md`. Agent, ktorého persona rolu neuvádza, jej pravidlá nedostane. Neznámy slug dá upozornenie.

Zmena pravidiel sa k agentovi dostane aj uprostred relácie. Hook `rules_delta.mjs` (UserPromptSubmit) porovná HEAD
nasadeného klonu so stavom relácie a pri zmene vloží do kontextu log a diff súborov `global/` a `env/<prostredie>/`.
Zmena tak platí najneskôr päť minút po pushi a bez reštartu.

Pravidlo o role a meno agenta majú každé jedno miesto. Pravidlo píšeš pre rolu alebo skupinu agentov. Kto rolu drží,
hovorí jediný súbor s mapovaním rolí na mená. Premenovanie agenta je zmena jedného riadku a mena repa, pravidlá sa
nemenia. Meno patrí len do príkladu alebo do opisu stavu s dátumom. Rola je mandát a zodpovednosť, nie systémové
práva.

Pravidlo patrí na úroveň svojho dosahu. Ak ho potrebuje aj iný agent alebo ak iný agent drží kópiu, patrí do
globálnych pravidiel, prostredia alebo roly. Kontrola duplikátov hľadá podobné odrážky v zdieľaných súboroch a v
personách. Hook `own_rule_scope.mjs` pri prvom zápise textu do `CLAUDE.md` alebo `PERSONA.md` agenta zamietne zápis s
otázkou, či tú vec nerobí aj iný agent. Rovnaký druhý zápis prejde. Globálne pravidlá majú strop slov, ktorý smie len
klesať. Kratšie pravidlá sa dodržiavajú lepšie.

### Ako to postaviť

1. Napíš `global/CLAUDE.md`. Začni krátko (kapitola 12) a drž ho pod stropom, ktorý si určíš.
2. Linkni ho: `ln -s <klon>/global/CLAUDE.md ~/.claude/CLAUDE.md`. Riadok v persone vyzerá `Role: zastupca-operatora,
   spravca-agentov`.
3. Napíš `env/<prostredie>/CLAUDE.md` pre veci typické pre stroj a linkni ho do koreňa stromu agentov.
4. Pri viac rolách napíš `roles/ROLES.md` ako index a `roles/<slug>.md` na každú. Mapovanie rolí na mená daj do
   jedného súboru a nikam inam mená nepíš.
5. Napíš hooky SessionStart (vloží roly) a UserPromptSubmit (vloží diff klonu, stav poslednej videnej verzie ukladaj
   do súboru po relácii).
6. Sprav opakovateľný skript nasadenia, ktorý linky a hooky nastaví, a do kontroly repa pridaj test na duplikáty.

### Náš príklad

Tabuľka vrstiev je v `README.md`. Index rolí je `roles/ROLES.md`, pravidlá rolí `roles/zastupca-operatora.md`,
`roles/spravca-agentov.md`, `roles/pracovny-agent.md` a `roles/dizajner.md`. Hooky sú `hooks/identity.mjs`,
`hooks/rules_delta.mjs` a `hooks/own_rule_scope.mjs`. Nasadenie robí `env/server/install.sh`, duplikáty hľadá
`lib/rule_dupes.mjs`, strop slov drží `lib/global_word_cap.txt`. Pravidlo "pokyn v rozpore s pravidlom" je záznam
`rozhodnutia/D0144.md`.

## 3. Operátor a zástupca

### Problém

Operátor má málo času. Agent, ktorý sa ho pýta na všetko, ho zdržuje. Agent, ktorý nepýta nič, urobí aj to, čo si
operátor vyhradil. Pýtanie sa na veci, ktoré agent vie zariadiť sám, je navyše skrytá chyba, lebo sa tvári ako
opatrnosť.

### Mechanizmus

Zástupca operátora je agent s mandátom rozhodovať za operátora, kde operátor nerozhoduje sám, v medziach, ktoré
operátor schválil. Jeho pokyn nesie značku "[<meno> za <operátor>]" a ostatní agenti ho berú ako pokyn operátora.
Zástupca je na každom stroji operátora jeden. Zástupcovia sú si rovní a stav si odovzdávajú schránkami, nie spoločnou
pamäťou.

Operátor si vyhradil nový nástroj, službu alebo postup, krok, ktorý sa nedá vrátiť, prijatie a prepustenie agenta,
zmenu persony a hraníc moci. Platby a zmluvy robí len on. Tajomstvá ostávajú v súboroch s právami `600`. Všetko
ostatné zástupca rieši sám, technickú voľbu zapíše do registra rozhodnutí. Operátorovi nosí len rozhodnutia, ktoré
patria jemu, a výstrahy.

Otázky pre operátora majú pevné miesto. Správa zástupcu, kým niečo čaká, končí riadkom "Čaká na teba:" a zoznamom
položiek so značkou (rozhodnutie), (hodnota) alebo (tvoj účet). Pred každou položkou zástupca odpovie na jednu otázku.
Viem to urobiť sám, alebo si na to zariadiť prostriedok? Ak áno, položka do riadku nepatrí. Zakázané je napríklad
založenie repa alebo pridanie kľúča cez API, ak má zástupca token alebo si ho vie vypýtať.

Rozhodnutie pre operátora je len voľba medzi aspoň dvoma cestami, ktoré obe vedú k schválenému cieľu. Ak vedie len
jedna, je to požiadavka, a tú agent urobí a zapíše. Pred označením položky ako rozhodnutia agent napíše druhú cestu.

Úkony sa dajú schváliť vopred po triedach. Zástupca sa raz spýta "Môžem urobiť X? áno/nie". Po "áno" zapíše triedu
úkonu do registra s rozsahom `schvalene` a už sa nepýta. Po "nie" ide úkon do "Čaká na teba:".

Zadanie od operátora, ktoré niečo mení, zástupca nevykoná hneď. Overí predpoklady, zistí dopady, prinesie plán (cieľ,
kroky, dopady, riziká, odporúčanie) a zadanie aj plán zapíše do úlohy. Vykoná ich po súhlase. Malej zmene stačia tri
vety. Plán úlohy v správcovi úloh schváli zástupca sám komentárom, ak v ňom nie je nič vyhradené operátorovi.

Námietka operátora, ktorú agent po overení prijme, je súhlas so zmenou. Agent ju vykoná v tom istom ťahu, aj keď si
žiada nový nástroj. Pýta sa znova len pri kroku, ktorý sa nedá vrátiť, alebo pri kroku nad rámec námietky. Zakázaná
veta je "urobím to, keď to schválite". Pokyn proti písanému pravidlu pravidlo sám nemení. Agent pomenuje pravidlo
súborom a riadkom a operátor potvrdí pravidlo alebo zmenu.

Čakanie na vonkajší systém (register domén, šírenie DNS, odpoveď služby) nerobí zástupca modelom. Zadá ho skriptu bez
modelu s príkazom na kontrolu, krokom po splnení a podmienkou hotového.

### Ako to postaviť

1. Do `roles/zastupca-operatora.md` napíš zoznam toho, čo si operátor vyhradil. Čo tam nie je, zástupca robí sám.
2. Zapíš pravidlo "Čaká na teba:" s tromi značkami a kontrolnou otázkou. Položka vyzerá `- Schváľ doménu pre nový web
   (rozhodnutie)`.
3. Zapíš postup pre zadanie od operátora (overiť, dopady, plán, zápis, vykonanie po súhlase).
4. Do globálnych pravidiel napíš značku zástupcu, pravidlo "prijatá námietka je súhlas" a pravidlo rozhodnutia s dvoma
   cestami.
5. Zaveď v registri rozhodnutí rozsah `schvalene` pre vopred schválené triedy úkonov (kapitola 4).

### Náš príklad

Rolu opisuje `roles/zastupca-operatora.md`, časti "Čo urobí sám a čo čaká na operátora", "Zadanie od operátora",
"Hranice" a "Kontinuita". Čo si operátor vyhradil, je v `roles/ROLES.md`. Rozhodnutie s dvoma cestami je v
`global/CLAUDE.md`, §6, prijatá námietka v §1. Riadok "Čaká na teba:" kontroluje `hooks/reply_guard.mjs` s premennou
`AR_ROZHODNUTIA=1`. Rozsah `schvalene` je v `rozhodnutia/ROZSAHY.md`.

## 4. Register rozhodnutí

### Problém

Rozhodnutie povedané v rozhovore zanikne s reláciou. Agent sa o týždeň spýta znova alebo urobí opak. Zápis v jednom
veľkom súbore sa nedá kontrolovať a staré rozhodnutie sa nahradí novým bez opravy miest, ktoré tvrdia to staré. Pokyny
agentov potom tvrdia veci, ktoré dávno neplatia.

### Mechanizmus

Rozhodnutie je jeden súbor v `rozhodnutia/`, pomenovaný `D0001.md`, `D0002.md` a tak ďalej. Hlavička je zoznam polí
`kľúč: hodnota` medzi dvoma riadkami `---`, potom nasleduje krátke telo. Súbor sa nikdy nemaže, zmena stavu je commit.

| pole | význam |
|---|---|
| `id` | `D` a štyri číslice, rovná sa menu súboru |
| `nazov` | jedna veta, čo platí |
| `stav` | `platí`, `nahradené` alebo `zrušené` |
| `kluc` | bodková cesta jednej veci, medzi platnými záznamami jedinečná |
| `rozsah` | značky z `rozhodnutia/ROZSAHY.md` |
| `agenti` | mená agentov malými písmenami, alebo `*` |
| `rozhodol`, `moc` | kto rozhodol a akou mocou |
| `zapisal`, `datum` | kto záznam zapísal a kedy |
| `zdroj` | kde to zaznelo, napríklad vlákno, správa alebo úloha |
| `nahradza`, `nahradene` | odkazy medzi záznamami, obe strany ukazujú na seba |
| `subory` | súbory repa, ktoré rozhodnutie stelesňujú, musia existovať |
| `zrusene-tvrdenie` | regulárny výraz vety, ktorá po zmene nesmie nikde stáť |

Telo má najviac päť viet. Hovorí, čo platí, prečo, a čo sa zamietlo. História je v gite.

Kľúč bráni dvom platným záznamom o jednej veci. Skript zápisu skončí chybou, keď nový záznam s platným kľúčom
nehovorí, že starý nahrádza. Moc bráni, aby o pravidlách rozhodol agent bez mandátu. Tabuľka rozsahu a moci je v
`rozhodnutia/ROZSAHY.md` a kontrola ju vynucuje.

Zápis ide jednou cestou. Skript `bin/rozhodni.sh` pridelí číslo, zapíše súbor, prepíše generovaný `INDEX.md`,
commitne pod menom agenta a pushne. Hook `rozhodnutia_guard.mjs` (PreToolUse) zamietne každý iný zápis do záznamov,
vrátane `sed -i`, presmerovania a `tee`. Voľba `--dry-run` nezapíše nič, voľba `--zrus` rozhodnutie zruší.

Zrušené tvrdenia sa kontrolujú strojom. Keď rozhodnutie niečo mení, jeho pole `zrusene-tvrdenie` nesie regulárny
výraz starej vety. Kontrola prehľadá pokyny agentov a pamäť a zlyhá na každom mieste, ktoré starú vetu ešte tvrdí.
Druhá kontrola prejde cesty v spätných apostrofoch v pokynoch a zlyhá na ceste k súboru, ktorý neexistuje. Tretia
zlyhá na pamäti, ktorá tvrdí, že niečo čaká na operátora, alebo na rozhodnutí bez čísla.

Agent sa o rozhodnutiach dozvie z hooku `rozhodnutia_context.mjs` (SessionStart), ktorý vloží zmeny od posledného štartu a
úlohy čakajúce na operátora, z hooku `rules_delta.mjs` a príkazom `node lib/rozhodnutia.mjs list --agent <meno>`.

Poznámka v rozhovore nie je rozhodnutie. Zapíše sa až po tom, čo operátor povie áno na text. Kým o veci diskutujú,
záznam sa nepíše.

### Ako to postaviť

1. Založ `rozhodnutia/` a `rozhodnutia/README.md` so schémou polí.
2. Napíš `rozhodnutia/ROZSAHY.md` s tabuľkou značiek a tabuľkou "rozsah smie moc". Začni piatimi značkami.
3. Napíš skript zápisu. Pridelí ďalšie číslo, zapíše hlavičku a telo zo štandardného vstupu, spustí kontrolu a
   commitne.
4. Napíš kontrolu. Id sa rovná menu súboru, kľúč je medzi platnými jedinečný, odkazy `nahradza` a `nahradene` ukazujú
   na seba, súbory z `subory` existujú, značka je v tabuľke, moc sedí k rozsahu.
5. Napíš zoznam zrušených tvrdení a kontrolu, ktorá ich hľadá v pokynoch a v pamäti.
6. Zapoj hook PreToolUse, ktorý zamietne zápis do `rozhodnutia/` mimo skriptu, hook SessionStart so zmenami od
   posledného štartu a spusti kontrolu v pre-commit hooku.

Záznam:

```
---
id: D0001
nazov: Odpoveď operátorovi má najviac šesť viet
stav: platí
kluc: odpoved.strop-viet
rozsah: pravidla
agenti: *
rozhodol: <meno operátora>
moc: operator
zapisal: <agent>
datum: <RRRR-MM-DD>
zdroj: <vlákno alebo úloha, kde to zaznelo>
subory: hooks/reply_guard.mjs
---
Odpoveď operátorovi má najviac šesť viet prózy. Dôvod je, že dlhú odpoveď operátor nečíta.
Zamietnutý bol strop dvanásť viet, lebo ho agenti pravidelne dosiahli.
```

### Náš príklad

Schéma je v `rozhodnutia/README.md`, značky v `rozhodnutia/ROZSAHY.md`. Ukážkové záznamy sú `rozhodnutia/D0141.md`,
`rozhodnutia/D0142.md` a `rozhodnutia/D0144.md`, ktorý nahrádza `rozhodnutia/D0010.md`. Zápis robí `bin/rozhodni.sh`,
logiku a kontrolu `lib/rozhodnutia.mjs` s testom `lib/rozhodnutia.test.mjs`. Zrušené tvrdenia číta `lib/doc_paths.mjs`
zo súboru `lib/retired_claims.txt`, pamäť kontroluje `lib/memory_claims.mjs`. Hooky sú `hooks/rozhodnutia_guard.mjs` a
`hooks/rozhodnutia_context.mjs`.

## 5. Slučka chyby

### Problém

Agent urobí chybu, operátor ho opraví, agent povie "máš pravdu" a o týždeň urobí to isté. Oprava zapísaná len do
pamäte alebo do rozhovoru neprežije. Oprava, ktorá nemení súbor riadiaci správanie, nie je oprava. A prosba o väčšiu
opatrnosť chybu nezablokuje.

### Mechanizmus

Slučka má päť krokov. Operátor namietne. Agent námietku overí a prijme. Opraví súbor, ktorý správanie riadi, a
commitne. Zapíše chybu do registra skriptom. Zavedie kontrolu, ktorá chybu zablokuje, najneskôr pri druhom výskyte
triedy.

Za chybu sa považuje nepravdivé tvrdenie, krok, ktorý nebol agentov, zbytočná akcia operátora, prijatá námietka,
oprava vyžiadaná dvakrát alebo škoda na živom systéme. Každá chyba agenta je chyba procesu. Agent nájde nástroj,
pravidlo alebo kontrolu, ktoré ju pustili, a opraví ich skôr, než chybu vyhlási za vybavenú.

Oprava patrí do súboru, ktorý správanie riadi, teda do persony, pravidla, skillu, hooku alebo kontroly. Zápis do
pamäte opravou nie je. Pravidlo sa píše ako cieľové správanie s kontrolou, ktorú možno odškrtnúť, a pri zákaze so
zakázanou vetou. Persona nesie krátky riadok o incidente. Mená z incidentu patria do záznamu rozhodnutia, nie do
pravidla roly.

Najsilnejšia oprava je kontrola, ktorá na chybe zlyhá. Je to test, hook alebo skript. Pred vyhlásením opravy sa chyba
zopakuje a kontrola sa ukáže, ako zlyháva. Replay nikdy nesiaha na živý systém a najprv overí, že nemôže spadnúť na
živú cestu, schránku alebo službu. Po zmene hodnoty, voľby alebo cesty agent nájde starú hodnotu príkazom `grep -rn` a
opraví každý zásah, aj v dokumentoch a komentároch.

Mechanickú časť robí `bin/chyba.sh`. Prijme triedu chyby a súbor, ktorý správanie riadi, a urobí štyri veci.

1. Odmietne súbor, ktorý nie je commitnutý, aby hlásenie malo číslo commitu opravy.
2. Zapíše do registra riadok (dátum, agent, trieda, súbor, commit, popis, číslo úlohy).
3. Pri druhom výskyte tej istej triedy toho istého agenta založí v správcovi úloh úlohu na kontrolu, ktorá chybu
   zablokuje.
4. Vypíše hlásenie v štyroch vetách. Čo som tvrdil alebo urobil, čo bola pravda, ktorý súbor a commit sa zmenil, čo to
   nabudúce zastaví.

Hlásenie agent vloží do najbližšej odpovede operátorovi, aj keď sa nepýta.

Slučku vynucuje hook `objection_fix.mjs` (Stop). Prečíta poslednú odpoveď a príkazy ťahu. Keď odpoveď uznáva chybu
(frázy ako "máš pravdu" alebo "moja chyba") a v ťahu nebežal `chyba.sh`, odpoveď zastaví. Zastaví ju aj vtedy, keď v
ťahu chýba commit súboru, ktorý agenta riadi, alebo keď odpoveď nenesie číslo commitu. Pri druhom zastavení v rade
mlčí, aby sa nezacyklil.

Správca agentov robí navyše šesťkrokový postup zlepšovania. Nájde súbor a riadok, ktorý chýbal alebo klamal, určí jednu
príčinu v systéme, napíše opravu s kontrolou, nasadí ju, zopakuje scenár, v ktorom problém vznikol, a zapíše rozhodnutie.
Opravu typu "zapísal som to do skillu" neschváli.

### Ako to postaviť

1. Do globálnych pravidiel napíš sekciu o chybách. Definuj chybu, povedz, že je to chyba procesu, že oprava ide do
   súboru riadiaceho správanie a že kontrola musí na chybe zlyhať.
2. Do persony daj sekciu "Vlastná chyba", ktorá na globálne pravidlo odkazuje a nesie krátke riadky incidentov.
3. Napíš `bin/chyba.sh` s voľbami `--trieda`, `--subor`, `--popis`, `--pravda`, `--kontrola`. Register je súbor s
   tabulátormi mimo repa, napríklad `~/.local/state/<názov>/chyby.tsv`.
4. Napíš skill `chyba`, ktorý hovorí, kedy skript spustiť a v akom poradí.
5. Napíš hook Stop, ktorý zastaví odpoveď uznávajúcu chybu bez commitu a bez skriptu.
6. Napíš test hooku s prepisom konverzácie z reálnej chyby. Test musí zlyhať, keď hook vypneš.
7. Úlohu na kontrolu pri druhom výskyte zadaj agentovi, ktorý spravuje pravidlá (kapitola 7).

Spustenie:

```
bin/chyba.sh --trieda neoverene-tvrdenie --subor PERSONA.md \
  --popis "tvrdil som stav bez kontroly" --pravda "stav bol iný" \
  --kontrola "hook odmietne odpoveď bez dôkazu"
```

### Náš príklad

Pravidlá chýb sú v `global/CLAUDE.md`, §4, prijatá námietka v §1. Skript je `bin/chyba.sh`, skill
`skills/chyba/SKILL.md`, hook `hooks/objection_fix.mjs`, testy `lib/chyba.test.mjs` a `hooks/objection_fix.test.mjs`.
Rozhodnutie o slučke je `rozhodnutia/D0142.md`. Postup zlepšovania je v `roles/spravca-agentov.md`, časť "Zlepšovanie
agentov". Sekciu "Vlastná chyba" ukazuje `PERSONA.md` v repe správcu agentov.

## 6. Hooky ako vymáhanie

### Problém

Pravidlo napísané vo vete model dodrží väčšinou, nie vždy. Čím dlhší kontext, tým väčšia šanca, že naň zabudne.
Operátor nemôže čítať každú odpoveď. Čo sa dá skontrolovať strojom, má sa skontrolovať strojom.

Zamietnutie bez vysvetlenia je ďalší problém. Model po ňom hádá a každý pokus stojí volanie s celým kontextom.

### Mechanizmus

Hook je skript, ktorý Claude Code spustí pri udalosti. Dostane JSON na štandardnom vstupe (napríklad `session_id`,
`cwd`, `transcript_path`, `tool_input`) a výsledok vráti výstupom. Udalosti, ktoré používame:

| udalosť | kedy beží | čo u nás vymáha |
|---|---|---|
| SessionStart | štart, obnovenie, `/clear`, kompakcia | `unslop.mjs` vloží jadro pravidiel písania, `identity.mjs` ohlási identitu a vloží roly, `clear_bridge.mjs` urobí štart relácie po `/clear`, `rozhodnutia_context.mjs` vloží zmeny rozhodnutí |
| UserPromptSubmit | pri každom prompte | `context_warning.mjs` upozorní na hranicu kontextu, `rules_delta.mjs` vloží zmenu pravidiel, `tasker_work.mjs` ohlási prácu na úlohe |
| PreToolUse | pred použitím nástroja | `no_model_wait.mjs` zamietne čakanie v popredí, `foreign_git.mjs` a `git_pull.mjs` nebezpečný git, `tasker_root.mjs` priamy príkaz správcu úloh pod rootom, `web_review.mjs` úlohu webu bez posudku, `rozhodnutia_guard.mjs` zápis rozhodnutia mimo skriptu, `own_rule_scope.mjs` pravidlo na zlej úrovni |
| SubagentStop | koniec sub-agenta | `tasker_work.mjs` ukončí záznam práce |
| Stop | pred koncom odpovede | `reply_guard.mjs` strop a odkazy v odpovedi, `todo_after_comment.mjs` úlohu po komentári, `objection_fix.mjs` uznanú chybu bez opravy |

Každé zamietnutie nesie správny postup. Zásada stojí na jednom helperi. Všetky hooky zamietajú cez `lib/deny.mjs`,
ktorý vypíše dôvod a riadok "Správny postup: <krok>". Helper odmietne prázdny postup aj nejasné vety ako "skús inak".
Strážca `lib/deny_check.mjs` beží v kontrole repa a zlyhá na hooku, ktorý zamieta surovým JSON-om, kódom 2 alebo
`echo` na stderr bez postupu. Pravidlo v pokynoch, ktoré hook stráži, potom stačí krátkou vetou s menom hooku.

Tri zásady pre vlastný hook.

- Hook typu Stop pri druhom zastavení v rade (`stop_hook_active`) mlčí, inak sa zacyklí.
- Hook, ktorý len ohlasuje, nikdy nezablokuje nástroj a pri chybe mlčí s kódom 0.
- Hook, ktorý drží stav v súbore, ukladá ho po relácii, aby sa relácie neovplyvňovali.

Každý hook má test vedľa seba. Chyba, kvôli ktorej hook vznikol, je v teste ako replay. Test nikdy nesiaha na živú
databázu ani službu. Hooky čítajúce stav správcu úloh čítajú databázu len na čítanie.

Zapojenie je v `settings.json`, buď v nastavení prostredia, alebo v `.claude/settings.json` repa agenta. Inštalátor
najprv odstráni skupiny hookov z našej cesty a potom pridá aktuálne, takže ho možno spúšťať opakovane a starý klon
nezostane zapojený.

### Ako to postaviť

1. Napíš helper `lib/deny.mjs` s funkciami na zamietnutie nástroja (PreToolUse), zastavenie odpovede (Stop) a
   zamietnutie kódom 2. Všetky odmietnu prázdny postup.
2. Napíš kontrolu, ktorá zlyhá na hooku so surovým zamietnutím.
3. Začni jedným hookom Stop, ktorý stráži jednu vec, čo sa ti už pokazila.
4. Pre každý nový hook napíš test s replayom chyby a pridaj ho do kontroly repa.
5. Zapoj hook v `settings.json` opakovateľným skriptom.

Zapojenie:

```
{
  "hooks": {
    "Stop": [
      { "hooks": [ { "type": "command", "command": "node /opt/agent-rules/hooks/reply_guard.mjs" } ] }
    ],
    "PreToolUse": [
      { "matcher": "Bash",
        "hooks": [ { "type": "command", "command": "node /opt/agent-rules/hooks/no_model_wait.mjs" } ] }
    ]
  }
}
```

### Náš príklad

Hooky sú v `hooks/*.mjs` a ich testy v `hooks/*.test.mjs`. Helper zamietnutia je `lib/deny.mjs` (pre git hooky
`lib/deny.sh`), strážca `lib/deny_check.mjs`, rozhodnutie `rozhodnutia/D0141.md`. Zapojenie robí funkcia `settings` v
`env/server/install.sh`. Hlavičkové komentáre `hooks/reply_guard.mjs`, `hooks/objection_fix.mjs`,
`hooks/todo_after_comment.mjs` a `hooks/tasker_work.mjs` opisujú, čo hook vymáha a čo ho vyvolalo.

## 7. Práca je úloha v správcovi úloh

### Problém

Práca zadaná v rozhovore nemá dôvod, podmienku hotového ani stav. Nikto nevie, či stojí, čaká alebo je hotová.
Otvorená úloha, na ktorej nikto nepracuje, sa stratí. Otázka na človeka v rozhovore sa stratí tiež, lebo sa nezobrazí
tam, kde ju človek hľadá.

### Mechanizmus

Bežná práca pre agenta je úloha v správcovi úloh (u nás Tasker). Každá úloha má projekt, dôvod, podmienku hotového a
riešiteľa. Úloha bez projektu sa odmietne. Úloha bez riešiteľa po dokončení blokérov nikoho nezobudí, preto sa úloha,
ktorú agent robí sám alebo cez sub-agenta, zakladá s riešiteľom.

Stavy, ktoré pravidlá a hooky používajú:

| stav | význam |
|---|---|
| `todo` | čaká na prevzatie |
| `in_progress` | niekto na nej pracuje |
| `needs_human` | agent sa pýta človeka alebo čaká na jeho schválenie |
| `blocked` | stojí na inej úlohe |
| `waiting` | čaká na udalosť mimo správcu úloh |
| `done`, `cancelled`, `failed` | koniec |

Otázka na človeka je stav úlohy, nie veta v rozhovore. Agent zapíše otázku do komentára, nastaví `needs_human` a beh
ukončí. Odpoveď človeka je komentár, ktorý úlohu zobudí. Keď odpoveď príde do vlákna namiesto komentára, agent ju
najprv zapíše do úlohy komentárom s menom operátora a až potom koná. Inak správca úloh o odpovedi nevie a úloha stojí.

Čakanie má dva tvary a oba majú dôvod. Čakanie na inú úlohu je blokér s povinným dôvodom, ktorý hovorí, na čom blokér
stojí, kto ho odstráni a čo úlohu potom pohne. Čakanie na udalosť mimo správcu úloh je stav `waiting` s dôvodom a
časom, po udalosti sa úloha uzavrie alebo obnoví. Holé čísla blokérov čitateľovi nepovedia, na čom úloha stojí.

Oprava práce na zavretej úlohe ide novou úlohou, lebo komentár na zavretej úlohe nikoho nezobudí.

Pre úlohu s viac krokmi platí štvorkrokový postup.

1. Nejasné zadanie. Agent zapíše najviac päť otázok, ktorých odpoveď nenájde v kóde ani v úlohe, a skončí v stave
   `needs_human`. Pri viacerých otázkach navrhne rozdelenie úlohy.
2. Plán. Agent zapíše do komentára plán so štyrmi časťami. Čo robíme (dve až štyri vety), kroky (najviac sedem), čo
   nerobíme (nikdy prázdne) a ako overíme, že to funguje (jedna až tri skúšky). Plán nejde do súboru v repe.
   Schválenie je komentár. Plán schváli zástupca operátora, vyhradenú vec operátor.
3. Stavba. Krok, ktorý sa nezmestí do jedného behu, je podúloha zreťazená blokérmi. Prácu mimo plánu agent nerobí,
   zmenu plánu navrhne komentárom a skončí v stave `needs_human`.
4. Kontrola. Pred uzavretím agent zapíše komentár s tromi odpoveďami s dôkazom. Funguje to (príkaz a jeho výstup)?
   Sedí to s plánom (čo chýba, čo pribudlo, čoho iného sa zmena dotkne)? Je to jednoduché (čo by sa dalo zmazať)?
   Keď odpoveď neobstojí, výsledok je `needs_human` s dôvodom.

Za tok práce zodpovedá správca agentov. Otvorená úloha, na ktorej nikto nepracuje, je jeho chyba. Blokér pridelený
človeku sleduje a keď ho do 30 minút nikto nevezme, pošle operátorovi notifikáciu s číslom úlohy a tým, čo presne
stojí. Zakázaná veta je "čaká na operátora" bez času a bez notifikácie.

Hooky držia správcu úloh a ťah v súlade. Hook `todo_after_comment.mjs` zastaví ťah, v ktorom agent napísal komentár na
svojej úlohe a tá ostala v stave `todo`, a dá postup (uzavrieť, čakať, blokovať alebo položiť otázku). Hook
`tasker_work.mjs` ohlási prácu sub-agenta z čísla úlohy v jeho zadaní. Hook `tasker_root.mjs` zamietne priamy príkaz
správcu úloh pod rootom a pošle agenta k obalu `bin/tk`. Číslo úlohy v texte pre operátora je odkaz na jej stránku, hook
`reply_guard.mjs` zastaví neprepojenú zmienku a dá hotovú náhradu.

### Ako to postaviť

1. Vyber správcu úloh s príkazovým riadkom. Ak ho nemáš, začni súborom na úlohu v repe projektu s poľami stav,
   riešiteľ, dôvod, hotovo a komentáre. Hooky tejto kapitoly pridaj, až keď máš nástroj, ktorý vieš čítať strojom.
2. Ustáľ stavy z tabuľky a povinnosť dôvodu pri blokéri a čakaní. Príkaz vyzerá `tasker block <id> --by <id> --reason
   "<dôvod>"` a bez dôvodu zlyhá.
3. Do pravidiel prostredia napíš, že práca je úloha s projektom, dôvodom a podmienkou hotového.
4. Do prostredia napíš štvorkrokový postup a použi ho najprv pri jednom projekte.
5. Zaveď pravidlo, že odpoveď operátora do vlákna sa najprv zapíše do úlohy.
6. Napíš hook Stop, ktorý zastaví ťah, po ktorom komentovaná úloha agenta ostala v stave `todo`. Stav čítaj z
   databázy správcu úloh len na čítanie.
7. Do roly správcu agentov napíš, že otvorená úloha bez práce je jeho chyba, a limit 30 minút pre blokér pridelený
   človeku.

### Náš príklad

Pravidlá sú v `env/server/CLAUDE.md`, časti "Správca úloh" a "Postup úlohy". Plán schvaľuje zástupca podľa
`roles/zastupca-operatora.md`. Tok práce a 30 minút pre blokér sú v `roles/spravca-agentov.md`, časť "Čo spravuje a
tok práce". Hooky sú `hooks/todo_after_comment.mjs`, `hooks/tasker_work.mjs` a `hooks/tasker_root.mjs`. Obal je
`bin/tk`. Úlohu pre agenta webu zakladá `bin/uloha-webu.sh` spolu s úlohou posudku dizajnéra a hook `hooks/web_review.mjs`
zamietne všetko ostatné. Samotný správca úloh v tomto repe nie je, je to samostatný nástroj.

## 8. Správy medzi agentmi

### Problém

Agent A potrebuje od agenta B výsledok. Ak mu píše priamo do vstupu, môže prerušiť jeho beh. Ak čaká v slučke na
odpoveď, stojí ťah a každé prečítanie kontextu stojí. Ak sa nedohodne, kto na koho čaká, jedna strana čaká zbytočne a
druhá nevie, že je očakávaná.

### Mechanizmus

Každý agent má schránku, adresár s podadresármi `inbox`, `outbox` a `processed`. Správa je súbor. Zápis ide cez
skrytý dočasný súbor a `mv`, aby adresát nikdy nečítal polovičný súbor. Meno súboru má tvar
`<odosielateľ>-[<téma>-]<RRRRMMDD-HHMMSS>-<pid>.md`.

Budič je program, ktorý správy zo schránky pošle do vlákna agenta a presunie do `processed`. Nikdy nepošle správu do
bežiaceho behu. Správy, ktoré budia, pošle jednou dávkou po krátkom tichom okne, takže správy tesne za sebou idú
jedným ťahom.

Každá správa, ktorú budič pošle, je jeden ťah modelu a ten znova číta celý kontext. Meranie ukázalo, že vyše polovice
ťahov nemalo akciu. Preto prvý riadok správy hovorí, čo odosielateľ čaká, a píšu ho skripty, nie model.

| prvý riadok | znamená | budič adresáta | odpoveď |
|---|---|---|---|
| `odpoveď: čakám` | pokyn alebo otázka, odosielateľ stojí na odpovedi | zobudí | povinná, zobudí odosielateľa |
| `odpoveď: nečakám` | správa nástroja alebo súhrn, výsledok sa prečíta pri ďalšom ťahu | zobudí | ide bez budenia |
| `odpoveď: na vedomie` | hlásenie, výsledok, potvrdenie | nebudí, drží do ďalšej dávky | nepíše sa |

Skript `bin/ask_agent.sh` píše novú správu ako `čakám`, s voľbou `--vedomie` ako `na vedomie`, iný režim nemá.
Odpoveď je predvolene `na vedomie`, a keď niečo potrebuje späť, má `--cakam` alebo `--necakam`. Odpoveď `na vedomie`
na správu `nečakám` odosielateľa nezobudí, preto skript režim `nečakám` pri novej správe odmietne. Na správu `na
vedomie` sa neodpisuje a potvrdenie "prevzaté" sa neposiela. Práca, ktorá z nej vznikne, je nový pokyn.

Hlavička správy nesie `odpoveď`, `id`, `od`, `komu`, `téma` a pri odpovedi `k` (id pôvodnej správy). Odpoveď sa páruje
s pôvodnou podľa `k`, takže meno súboru môže byť ľubovoľné. Agent píše aj z vlákna témy, preto skript správ po
zápise uloží trasu (kľúč správy a vlákno odosielateľa) a budič podľa nej odpoveď doručí do vlákna témy.

Správa agentovi je pracovný príkaz. Pokyn nesie úlohu, kontext, ktorý adresát nemá, a podmienku hotového. Odpoveď nesie
výsledok, dôkaz (príkaz a jeho výstup) a čo je otvorené. Cesta, riadok alebo commit nahrádza kópiu. Neistota sa píše
slovom "neoverené". Bez pozdravov, poďakovaní, ospravedlnení a opakovania.

Prečo nie spoločná pamäť. Zástupcovia na rôznych strojoch si stav odovzdávajú schránkami, nie spoločnou pamäťou.
Správa v schránke má odosielateľa, adresáta, tému a očakávanú odpoveď. Zápis v spoločnej pamäti nič z toho nenesie,
a tak nikto nevie, kto má na ňom konať ani kto čaká.

### Ako to postaviť

1. Schránky potrebuješ od dvoch agentov, pre jedného nie. Zaveď `<koreň>/<agent>/{inbox,outbox,processed}` s právami podľa skupiny.
2. Napíš skript odoslania, ktorý zapíše správu cez skrytý `.tmp` a `mv` a vloží hlavičku s režimom, a skript odpovede
   s hlavičkou `k:` a predvoleným režimom `na vedomie`.
3. Zisti, ako sa dá správa poslať do bežiacej relácie vo vašom runtime. Ak to nástroj už vie, použi to (globálne
   pravidlo §6, najprv zisti, či to nástroj už nerobí).
4. Napíš budič, ktorý nikdy neposiela do bežiaceho behu, dávkuje a rešpektuje režim v prvom riadku.
5. Napíš pravidlo, že agent po správe `čakám` ukončí ťah a nečaká v slučke. Doplň hook, ktorý zamietne `sleep` v
   popredí nad desať sekúnd.

Správa:

```
odpoveď: čakám
id: agent-a-nasadenie-RRRRMMDD-HHMMSS-4242.md
od: agent-a
komu: agent-b
téma: nasadenie

Úloha. Nasaď verziu 3 na testovací stroj.
Kontext. Verzia je v tagu v3. Databázu nemeň.
Hotovo, keď `curl -sI https://test.example/` vráti 200.
```

### Náš príklad

Pravidlá schránok sú v `env/server/CLAUDE.md`, časť "Schránky a budič". Skript správ je `bin/ask_agent.sh` s testom
`hooks/ask_agent.test.mjs`. Budič, skript odpovede a trasy odpovedí sú mimo tohto repa, v repe správcu agentov v
adresári `runtime/` (súbory `driver.mjs`, `reply.sh`, `route.mjs`, `morning.mjs` a `README.md`, časť "Budenie"). Hook
proti čakaniu je `hooks/no_model_wait.mjs`. Pravidlá pre správy agentom sú v `global/CLAUDE.md`, §2.

## 9. Delegovanie

### Problém

Silný model, ktorý robí všetko sám, je drahý a pomalý. Lacnejší model bez dohľadu urobí chybu, ktorú nikto nezachytí.
Úloha zadaná krok po kroku viaže zadávateľa na každý detail. A práca, ktorú robí niekto, kto na ňu nemá práva, rozbíja
hranice jurisdikcie.

### Mechanizmus

Prácu robí najnižšia úroveň, ktorá na ňu má práva. Silnejší model navrhuje a overuje, lacnejší stavia. Relácia na
najsilnejšom modeli dá implementáciu sub-agentovi na lacnejšom modeli a sama si nechá návrh a overenie. Silnejší
sub-agent ide len na návrh, audit alebo prácu, ktorá s lacnejším zlyhala, a dôvod sa napíše.

Pred každou úlohou pre agenta správca agentov postupuje v piatich krokoch.

1. Určí, aké práva úloha potrebuje, napríklad čítanie, zápis vo vlastnom repe, root, citlivý úkon alebo rozhodnutie.
2. Vyberie najnižšieho agenta, ktorému to persona dáva.
3. Pozrie otvorené úlohy vybraného agenta. Pri preťaženom úlohu rozdelí alebo zadá cez jeho nadriadeného.
4. V zadaní napíše, prečo patrí práve jemu.
5. Čakanie na vonkajší stav zadá skriptu bez modelu, ktorý agenta zobudí až pri zmene.

Zadanie hovorí cieľ a podmienku hotového, nie kroky. Medzistav agent nekontroluje, overí výsledok. Správca agentov
hotovú prácu overí sám a nespolieha sa na správu agenta. Prístup, ktorý má len správca (token, účet), nie je dôvod
robiť prácu agenta, správca vydá agentovi úzky prístup a prácu zadá jemu. Rýchlosť tiež nie je dôvod. Zakázané sú vety
"zadal som to správcovi servera" pri úlohe bez rootu a "urobil som to sám, bolo to rýchlejšie".

Úloha nesie číslo, aby bolo vidno, kto na nej pracuje. Zadanie sub-agentovi obsahuje text "úloha N". Hook
`tasker_work.mjs` v PreToolUse pre nástroje Agent a Task číslo nájde a ohlási správcovi úloh `tasker work N`, po
skončení sub-agenta (SubagentStop) záznam ukončí. Bez čísla v zadaní vyzerá úloha ako stojaca. Pred zadaním úlohy
sub-agentovi agent pozrie posledné záznamy práce na úlohe, aby ju nerobili dvaja naraz.

### Ako to postaviť

1. Do globálnych pravidiel napíš, ktorý model robí návrh a overenie, ktorý stavbu a kedy sa smie ísť vyššie.
2. Do roly správcu agentov napíš päť krokov výberu agenta a dve zakázané vety.
3. Do prostredia napíš, že zadanie sub-agentovi nesie "úloha N", a napíš hook, ktorý číslo nájde.
4. Napíš šablónu zadania s cieľom, kontextom, ktorý adresát nemá, a podmienkou hotového. Prvý riadok vyzerá `Úloha 120.
   Premenuj premennú X na Y v skriptoch v bin/. Hotovo, keď grep na X je prázdny.`
5. Z postupu zadaného druhýkrát ručne sprav skill so skriptom.

### Náš príklad

Pravidlo modelov a odovzdania práce je v `global/CLAUDE.md`, §6. Delegovanie je v `roles/spravca-agentov.md`, časť
"Delegovanie", pokyny agentom v časti "Pokyny agentom a oprava". Hook `hooks/tasker_work.mjs` s testom
`hooks/tasker_work.test.mjs` ukazuje, ako sa číslo úlohy nájde v zadaní. Skilly pre opakované postupy sú v `skills/`,
napríklad `skills/projekt-novy`.

## 10. Písanie

### Problém

Text modelu má rozpoznateľné vzory. Dlhé odpovede s úvodom, zhrnutím, ponukami práce, vatou a tučnými štítkami sa
nečítajú. Operátor v nich nenájde, čo potrebuje, a prestane ich čítať. Pravidlo "píš stručne" bez kontroly sa zabúda.

### Mechanizmus

Pravidlá písania majú jeden zdroj, skill `unslop`. Platí pre každý text určený človeku, teda pre odpovede, dokumenty,
commit správy, komentáre v kóde aj záznamy rozhodnutí. Správa inému agentovi sa riadi pravidlami správ (kapitola 8),
nie pravidlami čitateľnosti. Operátor radí `unslop` nad ostatné skilly.

Jadro skillu je jeden odsek. Krátke celé vety so slovesom, činný rod, obyčajné slová, konkrétne mená, čísla a
mechanizmy namiesto dojmov. Bez pomlčiek, typografických úvodzoviek, emoji a tučných štítkov s dvojbodkou. Bez výplne
a nafúknutých slov, bez nútených trojíc a bez chatbotových fráz. Pred odovzdaním sa agent opýta, čo na texte
prezrádza AI, a opraví to. Zvyšok skillu je katalóg vzorov s pevnými číslami pravidiel.

Hook SessionStart vloží do kontextu len jadro, pri štarte, po `/clear`, pri obnovení aj po kompakcii. Celý katalóg by
stál tisíce tokenov pri každom štarte, jadro stojí pár stoviek. Dlhšie jadro, než povolí limit vloženého kontextu,
hook ohlási a skončí s kódom 1, takže kontrola repa to zachytí pred nasadením. Prvá odpoveď relácie ohlási riadok
`unslop: načítané, hook, verzia <verzia>`, aby operátor videl, že jadro prišlo.

Dĺžka odpovede má strop. Odpoveď operátorovi má jednu až tri vety, a to verdikt, dôvod a čo robiť. Dlhšia je len
vtedy, keď o kroky, podrobnosti alebo dokument operátor požiada. Hook `reply_guard.mjs` odpoveď zastaví, keď má viac
ako šesť viet prózy, vetu nad 35 slov, položku zoznamu s viac vetami, odkaz, ktorý dnes neodpovedá, alebo odkaz na
localhost. Bloky kódu, tabuľky, nadpisy a riadky "Čaká na teba:" sa do prózy nepočítajú. Prvý riadok odpovede agenta s
personou je len jeho meno a dvojbodka, druhý je prázdny.

Podrobnosti idú do súboru. Súbor pre operátora (stránku, dokument) agent uloží do pracovného priečinka mimo dočasného
adresára, napríklad `docs/`, a v odpovedi uvedie jeho cestu. Runtime z cesty urobí odkaz, ktorý operátor otvorí.
Zakázaná veta je "súbor je na serveri, neotvoríš ho".

Plán sa dáva na schválenie len s overenými tvrdeniami. Hook `reply_guard.mjs` zastaví odpoveď, ktorá ponúka plán a
overenie odkladá na nasadenie.

### Ako to postaviť

1. Napíš skill `unslop` s jadrom na začiatku. Zakázané vzory opíš konkrétne a daj príklady v jazyku, v ktorom píšeš.
2. Napíš hook SessionStart, ktorý vloží len sekciu "Jadro", a skontroluj, že sa zmestí do limitu vloženého kontextu.
3. Do globálnych pravidiel napíš sekciu o písaní s odkazom na skill a stropom odpovede.
4. Napíš hook Stop so stropom viet a slov. Začni jedným stropom a kontroly pridávaj, keď narazíš na ďalší problém.
5. Zaveď priečinok pre dokumenty operátora a pravidlo "odpoveď nesie cestu, nie obsah".

### Náš príklad

Skill je `skills/unslop/SKILL.md`, jadro je jeho sekcia "Jadro". Vkladá ho `hooks/unslop.mjs`, strop odpovede drží
`hooks/reply_guard.mjs` s testom `hooks/reply_guard.test.mjs`. Pravidlá sú v `global/CLAUDE.md`, §2 a §5. Pravidlo
súborov pre operátora je v `env/server/CLAUDE.md`, časť "Schránky a budič". Schválené vzory opakovanej práce sú v
`artifacts/` a ich používanie opisuje `skills/artefakty/SKILL.md`.

## 11. Čistý kontext a kontinuita

### Problém

Kontext relácie rastie a každé volanie modelu ho číta celý. Dlhá relácia je drahá a model v nej robí viac chýb.
Čistenie kontextu zasa zmaže všetko, čo agent vedel. Ak stav nie je zapísaný, agent po čistení pracuje naslepo alebo
sa pýta operátora na to, čo už bolo hotové.

### Mechanizmus

Stav práce je v súboroch, nie v kontexte. Pamäť je v gite. Stav témy je úloha s komentármi a históriou v správcovi
úloh, nie súbor v gite. Do gitu idú len persona, pravidlá, rozhodnutia a kód. Nedokončená práca na konci ťahu ide do
pamäte, commitne sa a pushne. Zakázaná veta je "prinesiem to v ďalšej relácii".

Čistý kontext sa robí po hotovom logickom celku práce, nie uprostred úlohy. Postup má štyri kroky.

1. Agent zapíše stav do pamäte a úlohy.
2. Commitne a pushne.
3. Ukončí odpoveď posledným riadkom z `bin/kontext.sh spanok --stav "<súhrn>"`.
4. Budič pošle do toho istého vlákna príkaz `/clear` a model sa nevolá.

Voľba `pokracuj --dalej "<ďalší krok>"` sa použije len vtedy, keď ďalší krok nečaká na nikoho. Budič po čistení pošle
len ten krok. Štart relácie (fetch, rebase, stav) po čistení urobí hook, takže model nečíta pamäť ani nerobí fetch,
kým to práca nepotrebuje. Hook prečíta odovzdávku od `kontext.sh`, zmaže ju a vloží do novej relácie.

Skript odmietne čistenie (kód 1), keď úloha agenta čaká a agent na nej komentoval po vstupe do čakania. Agent najprv
zmení stav úlohy (uzavrie ju, obnoví ju alebo nastaví čakanie s novým dôvodom) a až potom spustí čistenie. Inak by
výsledok, na ktorý úloha čakala, zostal nespracovaný.

Hranicu kontextu stráži hook UserPromptSubmit `context_warning.mjs`. Sčíta vstupné tokeny poslednej odpovede a nad
hranicou 80 tisíc tokenov pridá do kontextu pokyn na čistý kontext. Pod hranicou mlčí. Hook `clear_bridge.mjs`
(SessionStart po `/clear`) rieši vlastnosť nášho runtime, v ktorom by sa po `/clear` vrátil starý kontext. U teba sa
to môže správať inak.

Agent, ktorý beží na dvoch miestach (hlavné vlákno a behy úloh), zdieľa pamäť, manuály a skilly cez git, preto po ich zmene
commit a push idú hneď. Čakanie na vonkajší stav robí skript, ktorý agenta zobudí až pri zmene, nie opakovaná kontrola modelom.

### Ako to postaviť

1. Do persony napíš sekciu "Kontinuita" s pravidlom štartu (fetch, rebase, commity ostatných agentov) a konca (stav do
   pamäte, commit, push).
2. Napíš skript, ktorý uloží odovzdávku a vypíše riadok s režimom čistenia, napríklad `bin/kontext.sh spanok --stav
   "<súhrn>"`. Musí odmietnuť čistenie, keď úloha čaká.
3. Napíš hook UserPromptSubmit, ktorý nad hranicou tokenov pridá pokyn na čistenie.
4. Napíš hook SessionStart, ktorý po čistení urobí štart relácie a vloží odovzdávku.
5. Do pravidiel napíš, že čistenie ide po logickom celku a nie uprostred úlohy.

### Náš príklad

Pravidlá čistého kontextu sú v `env/server/CLAUDE.md`, časť "Schránky a budič". Skript je `bin/kontext.sh`, jeho
logika `lib/kontext.mjs`. Hooky sú `hooks/context_warning.mjs` a `hooks/clear_bridge.mjs` s testami. Pravidlo
nedokončenej práce je v `global/CLAUDE.md`, §6. Časti "Kontinuita" a "Súbežnosť" ukazuje `PERSONA.md` v repe správcu
agentov. Dozor nad vláknami a budič čistého kontextu sú v jeho adresári `runtime/`.

## 12. Ako začať u seba

### Poradie na prvý týždeň

Nestavaj všetko naraz. Každý krok má vlastnú hodnotu a ďalší na ňom stojí.

1. Prvý deň, jeden agent. Založ repo, `PERSONA.md`, súbor runtime s importom a `memory/MEMORY.md`. Napíš pravidlo
   štartu a konca relácie. Hotovo, keď nová relácia po čistom kontexte vie, kto je a čo sa včera robilo.
2. Druhý deň, globálne pravidlá. Napíš `global/CLAUDE.md` o objektivite, odpovediach, trvanlivosti, chybách a
   autonómii a linkni ho do `~/.claude/CLAUDE.md`. Začni pár odrážkami, nie šiestimi sekciami, a stav ich z chýb,
   ktoré ti agent už urobil. Hotovo, keď agent v novej relácii pravidlo dodrží.
3. Tretí deň, register rozhodnutí. Založ `rozhodnutia/`, schému, skript zápisu a kontrolu. Zapíš prvé tri
   rozhodnutia, ktoré si agentovi už raz povedal. Hotovo, keď sa na ne agent nepýta.
4. Štvrtý deň, slučka chyby. Napíš sekciu o chybách, `chyba.sh`, hook, ktorý uznanie chyby bez zápisu zastaví, a test.
   Hotovo, keď hook zastaví testovaciu odpoveď "máš pravdu" bez commitu.
5. Piaty deň, hooky so správnym postupom. Zaveď helper `deny` a hooky na dve chyby, ktoré sa ti opakovali. Hotovo, keď
   každé zamietnutie nesie riadok "Správny postup:".
6. Druhý týždeň, správca úloh a postup plán, stavba, kontrola. Až keď agent robí viac vecí naraz.
7. Druhý až tretí týždeň, roly a druhý agent. Až keď existuje práca, ktorú nemá robiť prvý agent.
8. Potom schránky a budič. Až keď dvaja agenti potrebujú posielať výsledky.

### Čo odložiť

- Schránky a budič, kým nemáš aspoň dvoch agentov. Jeden agent s úlohami v správcovi úloh stačí.
- Roly nad dve, kým nemáš prácu, ktorá nepatrí žiadnej z nich.
- Ďalšie roly (dizajnér, vedúci vývoja, osobný asistent) a artefakty, kým pre ne nie je práca.

### Pred vlastným mechanizmom

Pred každým novým mechanizmom zisti, či to nástroj už nerobí. Nástroj, ktorý používaš, má dokumentáciu a niektoré
veci (zapojenie hookov, importy súborov, správu oprávnení) rieši sám. Vlastný inštalátor, pevná cesta k domovskému
priečinku a vlastný shell skript sú znaky, že si dokumentáciu neprečítal. Pravidlá a limity cudzej služby cituj len z
jej oficiálnej stránky prečítanej celej.

Dôvody v tomto playbooku vychádzajú z praxe na jednom serveri s jedným operátorom. Budič, obal pre správcu úloh a hook
`clear_bridge.mjs` sú viazané na náš runtime. Zvyšok je prenosný, teda persona v gite, register rozhodnutí, slučka chyby,
hooky so správnym postupom a úloha so stavmi.
