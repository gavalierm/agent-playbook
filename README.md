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
| `lib/` | pomocný kód hookov, register rozhodnutí `rozhodnutia.mjs`, kontrola verejného repa `public_check.mjs` |
| `bin/chyba.sh`, `bin/rozhodni.sh`, `bin/tk` | zápis uznanej chyby, zápis rozhodnutia, obal správcu úloh |
| `rozhodnutia/` | schéma registra rozhodnutí a značky rozsahu |

## Čo tu nie je a prečo

Súkromné repo prevádzky nesie veci viazané na jedného operátora: tabuľku
agentov a ich rolí (`roles/agents.md`), záznamy rozhodnutí (`rozhodnutia/D0xxx.md`),
prostredia s adresami strojov (`env/mac/`, nasadenie `env/server/install.sh`),
persony agentov, repá agentov a runtime správcu agentov (`runtime/`: budič,
schránky). V týchto súboroch sú mená ľudí, agentov, strojov a účtov, preto sa
neprenášajú. Odkazy na ne v `PLAYBOOK.md` a v kóde ostali, ukazujú do súkromného
repa prevádzky. Rovnako tam ostali skripty a testy, ktoré potrebujú živý
správca úloh, schránky agentov alebo nasadenie v `/opt/agent-rules` (napríklad
`check.mjs`, `bin/ask_agent.sh`, hooky `tasker_root.mjs` a `web_review.mjs`).
Tieto veci bežia len v prevádzke, v tomto strome nie sú.

Súbory sú očistené: mená nahradila rola alebo zástupné meno (`<server>`,
`<tailnet>`, `<používateľ správcu úloh>`, `<projekt>`). Kde kód potrebuje skutočnú
hodnotu, je tam predvolená (napríklad používateľ `tasker`) a komentár, že ju máš
upraviť. Fixtúry testov používajú názvy rolí alebo mená `Alfa`, `Beta`, `Gama`.

## Kontrola a testy

Po klonovaní zapni hooky repa:

```
git config core.hooksPath .githooks
```

`pre-commit` aj `pre-push` spustia `node lib/public_check.mjs`. Ten prejde
všetky súbory v gite a zlyhá kódom 1, keď nájde meno človeka, agenta, stroja,
účtu alebo adresu zo vzorov v `lib/public_check.txt` (vzory sú v base64, aby
zoznam mená nevyzrádzal). `pre-push` skontroluje aj meno autora a správy
commitov, ktoré idú von.

Testy potrebujú Node 22 alebo novší:

```
node --test 'hooks/*.test.mjs' 'lib/*.test.mjs'
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
vlastnom repe. Pred pull requestom spusti `node lib/public_check.mjs` a testy.

## Licencia

MIT, súbor `LICENSE`.
