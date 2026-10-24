# Prostredie server

Spoločný základ pre každého agenta na serveri agentov. Nad ním stoja
globálne pravidlá `~/.claude/CLAUDE.md`, pod ním persona agenta
(`/root/<meno>/CLAUDE.md` s `@PERSONA.md`) a `CLAUDE.md` projektu, ktorý má
prednosť. Role sú v `/opt/agent-rules/roles/ROLES.md`, kto ich drží, v
`/opt/agent-rules/roles/agents.md`. Prácu servera robí správca servera,
cestu k agentom a ich beh spravuje správca agentov.

## Kde čo beží

- Agenti s identitou bežia ako trvalé vlákna T3 Code pod rootom, každý
  v klone svojho repa `/root/<meno>`. Režim je full-access
  (`AGENT_RUNTIME_MODE` v `runtime.env` agenta), zábranou je persona,
  hooky a história v gite, nie práva. Agenti pod rootom zdieľajú jedno
  nastavenie povolení `/root/.claude/settings.json`, pravidlo `deny`
  jedného agenta platí pre všetkých a zápis cez `python` alebo `sed`
  nechytí.
- Pravidlá sú klon `/opt/agent-rules`, ktorý `agent-rules-sync.timer`
  každých 5 minút stiahne z GitHubu. Zmenu `global/` a `env/server/`
  vloží hook `rules_delta.mjs` do najbližšieho ťahu relácie, platí hneď.
- Klony repov agentov sú v `/root/<meno>`. Na GitHub zapisujú cez strojový
  účet `<strojový účet>`, jeden kľúč na agenta: `/root/.ssh/<strojový účet>_<meno>`
  a pod `<používateľ správcu úloh>` `/home/<používateľ správcu úloh>/.ssh/<strojový účet>_tasker`.
  Kľúč nesie `core.sshCommand` repa, deploy kľúče sa nezakladajú. Nové repo
  zakladá skill `github-repo` správcu agentov, ktorý účet pozve.
- Tajomstvá sú v `~/.config/<meno>/` v súboroch s právami `600`. Do repa
  ani do pamäte nikdy.
- Agent s hlavným vláknom aj behmi v Taskeri (skill `agent-vlakno` súkromného repa
  správcu agentov) beží na dvoch miestach: hlavné vlákno T3 pod rootom v klone
  `/root/<meno>` a behy úloh pod `<používateľ správcu úloh>` v klone
  `/home/<používateľ správcu úloh>/agenti/<meno>`. Pamäť, manuály a skilly zdieľajú cez
  git, po ich zmene preto commit a push hneď. Pripomienku operátora
  z hlavného vlákna zapíše do pamäte, manuálu alebo skillu v tom istom
  ťahu, behy ju tak uvidia. Správy zo schránky `/var/lib/<meno>/inbox`
  doručí budič `agent-driver@<meno>`. Práca na konkrétnom projekte je
  úloha v Taskeri s riešiteľom `<meno>`, nie rozhovor v hlavnom vlákne.

## Schránky a budič

- Schránka agenta je `/var/lib/<meno>/inbox`, zápis cez skrytý `.tmp`
  a `mv`. Budič `runtime/driver.mjs` súkromného repa správcu agentov doručí správu do
  vlákna ako `<schranka od=... id=... odpoveď=...>` a presunie ju do
  `processed`. Odpoveď ide príkazom z hlavičky správy, `AGENT_NAME=<meno>
  /root/<správca agentov>/runtime/reply.sh <id>`, do `/var/lib/<meno>/outbox`.
- Prvý riadok správy `odpoveď: ...` píšu skripty, nie model, a hovorí, čo
  odosielateľ čaká (`runtime/README.md` súkromného repa správcu agentov, časť Budenie):

  | hodnota | znamená | odpoveď |
  |---|---|---|
  | `čakám` | pokyn alebo otázka, odosielateľ na odpovedi stojí | povinná, `reply.sh`, zobudí ho |
  | `nečakám` | len správa Taskera (most úlohy) a ranný súhrn, výsledok prečíta pri ďalšom ťahu | `reply.sh`, nebudí ho |
  | `na vedomie` | hlásenie, výsledok, potvrdenie | nepíše sa, ani "prevzaté" |

  Novú správu píše `ask_agent.sh` predvolene ako `čakám`, s `--vedomie`
  ako `na vedomie`, iný režim nemá (`--necakam` skript odmietne, chyba
  20. 10. 2026 dvakrát: odpoveď `na vedomie` na `nečakám` odosielateľa
  nezobudila). Odpoveď `reply.sh` je predvolene `na vedomie`, keď
  niečo potrebuje späť, má `--cakam` alebo `--necakam`. Správa `na
  vedomie` agenta nebudí, budič ju prinesie len s najbližšou budiacou
  dávkou do toho istého vlákna. Správu staršiu než 24 h presunie ranný
  súhrn do `processed` a vypíše ju správcovi agentov. Práca, ktorá z nej vyplynie, je nový pokyn `ask_agent.sh`. Správy
  `tasker-*` a ranný súhrn nesú riadok samy, odpoveď do
  schránky sa na ne nepíše.
- Súbor pre operátora (stránka, dokument) ulož v pracovnom priečinku mimo
  `.scratch`, napríklad `docs/`, a v odpovedi uveď jeho cestu. T3 z nej
  urobí podpísaný odkaz s platnosťou okolo hodiny, operátor ho cez
  Tailscale otvorí na Macu aj v telefóne. Zakázaná veta: "súbor je na
  serveri, neotvoríš ho".
- Webovú službu servera (Tasker, T3) dávaj operátorovi adresou cez
  Tailscale, `https://<server>.<tailnet>.ts.net:<port>` podľa
  `tailscale serve status`, nikdy `localhost` ani `127.0.0.1`. Odkaz na
  localhost zastaví hook `reply_guard.mjs`. Chyba 23. 10. 2026: odkaz na
  úlohu v Taskeri na `127.0.0.1:8801`.
- Každé volanie modelu znova prečíta celý kontext vlákna, správu preto
  vybav čo najmenej krokmi. Obsah správy prinesie budič, schránku cez `ls`
  ani `cat` nečítaj. Odpoveď, zápis do Taskera a commit spoj do jedného
  príkazu. Na odpoveď iného agenta nečakaj, ukonči ťah a budič ti ju
  doručí. Čakanie v popredí (`sleep` nad 10 s, slučka so `sleep`) zamietne
  hook `no_model_wait.mjs`. Tasker pod rootom spúšťaj obalom
  `/opt/agent-rules/bin/tk ...` namiesto `tasker ...` (beží pod `<používateľ správcu úloh>`
  s `TASKER_HOME`, meno agenta berie z `AGENT_NAME`, inak z `# Meno`
  v `PERSONA.md` projektu, bez mena skončí kódom 64). Priamy `tasker` ako
  root zamietne hook `tasker_root.mjs` (chyba 23. 10. 2026, vlákno
  <projekt>).
- Čistý kontext: po hotovom logickom celku práce zapíš stav do pamäte,
  commitni, pushni a odpoveď ukonči posledným riadkom z `kontext.sh spanok
  --stav "<súhrn>"` (holé `HOTOVO-KONTEXT` je to isté). Budič pošle
  `/clear` do toho istého vlákna a model sa nevolá. `kontext.sh pokracuj
  --dalej "<ďalší krok>"` len keď ďalší krok nečaká na nikoho, budič po
  `/clear` pošle len ten krok a štart relácie (fetch, rebase, stav) urobí
  hook. Uprostred úlohy nie, ani nad hranicou kontextu z hooku.
  `kontext.sh` odmietne (kód 1), keď tvoja úloha čaká (`waiting`) a ty si
  na nej komentoval po vstupe do čakania: zmeň jej stav (`done`, `resume`,
  `wait --reason`) a až potom spusti kontext.
- Reláciu alebo proces claude iného vlákna zastav, len keď vlákno v T3
  nemá bežiaci beh (`activeRunId` null a posledný beh skončený).

## Git na serveri

- Commit podpíš menom `<Agent> (<stroj>)`, napríklad `Správca servera (server1)`.
  Vo vlastnom klone ho nesie lokálny `user.name`, v klone, ktorého
  lokálne meno je cudzie, `git -c user.name='<Agent> (<stroj>)'`. Holé
  meno odmietne hook commit-msg (`lib/commit_guard.sh`), hook pre-commit
  repa agenta podľa mena committera rozlíši agenta a správcu agentov.

- Štart relácie: `git fetch origin && git rebase origin/main` v repe
  agenta a v `/opt/agent-rules`, potom pamäť a schránka. `git pull` nie,
  súbežné fetche viacerých relácií v jednom klone zapíšu do `FETCH_HEAD`
  dva riadky a pull padne.
- Git v klone, ktorý patrí inému používateľovi (projekty pod
  `<používateľ správcu úloh>`), spúšťaj pod ním, `runuser -u <vlastník> -- git ...`.
  Obídenie cez `safe.directory` zamietne hook `foreign_git.mjs`, chyba
  20. 10. 2026: git roota nechal v `.git` súbory roota a pull vlastníka padol.
- Commit len so zoznamom súborov za `--`, index klonu zdieľajú relácie
  viacerých agentov pod rootom. Pred commitom je `grep -n
  '^<<<<<<<\|^>>>>>>>' <súbory>` prázdny.
- Commit v `/opt/agent-rules` nerob, je to kópia na čítanie. Pravidlá
  mení správca agentov vo vlastnom klone a pushne.
- Zmenu persony a pravidiel rob malými commitmi priamo na main, vetvu
  len pre zmenu, ktorá musí počkať, a tú rebasni na origin/main na
  začiatku každého ťahu. Hook pre-commit s `lib/open_branch_guard.sh`
  repa pravidiel commit na main do súboru, ktorý mení otvorená vetva,
  odmietne, rovnako commit na vetve bez rebase.

## Kontajnery a tmux

- Príkaz v kontajneri aplikácie spúšťaj pod jej používateľom (`docker
  exec -u <používateľ>`), používateľa zisti `docker top`. Zakázané je
  `docker exec` bez `-u` pri príkaze, ktorý zapisuje.
- Interaktívny príkaz s jednorazovým výstupom spúšťaj v `tmux`
  s `remain-on-exit on`, kód pošli `send-keys -l` a samostatné Enter,
  výstup čítaj `capture-pane -p -J -S -`.
- `tmux send-keys` do agenta je záložná cesta a čaká, len keď klient na
  zápis písal posledných 30 s.

## Správca úloh

Bežná práca pre agenta je úloha v správcovi úloh s dôvodom a podmienkou
hotového. Každá úloha má projekt (`--project`), aj práca na samotnom
Taskeri (projekt `tasker`), na agentoch, runtime a pravidlách (`agenti`)
a na serveri (`server`). Úlohu bez projektu Tasker odmietne. Úlohu agentovi webu (meno alebo workdir končí na `-web`) zakladá len `/opt/agent-rules/bin/uloha-webu.sh`, ktorý do popisu dá čítanie dizajn manuálu a založí posudok dizajnérky. Agent v trvalom vlákne T3 je v Taskeri agent s `enabled=0`,
úlohu mu most správcu agentov pošle do schránky ako správu `tasker-*`
a agent ju uzavrie príkazom `tasker done <id> --summary` pod svojím menom
(`TASKER_USER`). Odpoveď na správu `tasker-*` sa do schránky nepíše. Úloha Taskera v texte pre operátora je odkaz na jej stránku na webe Taskera cez Tailscale, napríklad `[úloha 380](https://<server>.<tailnet>.ts.net:8801/tasks/380)`. Neprepojenú zmienku zastaví hook `reply_guard.mjs` a dá hotovú náhradu. Odpoveď operátora
na úlohu, ktorá príde do vlákna T3 namiesto komentára (schválenie,
odpoveď na otázku), agent najprv zapíše do úlohy komentárom s menom
operátora a až potom koná, inak Tasker o nej nevie a úloha stojí. Stav `blocked` len s komentárom, ktorý nesie príčinu a spúšťač
odblokovania, čakanie na inú úlohu je blokér `tasker block <id> --by
<id> --reason "<dôvod>"` (Tasker dôvod zapíše ako komentár, bez `--reason`
príkaz skončí kódom 2, rovnako `task add --blocked-by`): na čom blokér
stojí, kto ho odstráni a čo úlohu potom pohne. Holé čísla blokérov čitateľovi nepovedia, na čom
úloha stojí (chyba 23. 10. 2026, úloha 404, kontrolu v Taskeri robí
úloha 460). Čakanie na udalosť mimo Taskera (skript sleduje zmenu, odpoveď
služby) je `tasker wait <id> --reason "na čo" --until <čas>`, po udalosti
`tasker done` alebo `tasker resume`. Opravu práce na zavretej úlohe zadaj novou úlohou. Pred založením
úlohy pozri, či ju už niekto nezaložil. Úlohu, ktorú agent robí sám alebo cez
sub-agenta, zakladá s riešiteľom `--assign <meno>`. Úloha bez riešiteľa
po dokončení blokérov nikoho nezobudí (chyba 23. 10. 2026, úloha 427
stála 52 minút).

### Postup úlohy

Pilot od 20. 10. 2026 na úlohách projektu `<projekt>` v Taskeri
(`--project <projekt>`), prevzatý zo sady skillov fstack
(D0026). Úloha na jeden
beh ide rovno, postup platí pre úlohu s viac krokmi.

1. Nejasné zadanie: agent zapíše do komentára najviac päť otázok, ktorých
   odpoveď nenájde v kóde ani v úlohe, a beh ukončí `tasker result
   needs_human`. Pri viac otázkach navrhne rozdelenie úlohy.
2. Plán: agent zapíše do komentára plán so štyrmi časťami: čo robíme (dve
   až štyri vety), kroky (najviac sedem), čo nerobíme (nikdy prázdne)
   a ako overíme, že to funguje (jedna až tri skúšky). Beh ukončí
   `needs_human`. Plán nejde do súboru v repe. Schválenie je komentár,
   ktorý úlohu zobudí. Plán schvaľuje zástupca operátora, vyhradenú vec
   operátor.
3. Stavba: krok, ktorý sa nezmestí do jedného behu, je podúloha
   zreťazená blokermi (`tasker block --by --reason`). Prácu mimo plánu agent
   nerobí, zmenu plánu navrhne komentárom a beh ukončí `needs_human`.
4. Kontrola: pred `tasker result done` agent zapíše komentár s tromi
   odpoveďami s dôkazom. Funguje to (príkaz a jeho výstup)? Sedí to
   s plánom (čo chýba, čo pribudlo, čoho iného sa zmena dotkne)? Je to
   jednoduché (čo by sa dalo zmazať)? Keď odpoveď neobstojí, výsledok je
   `needs_human` s dôvodom.
