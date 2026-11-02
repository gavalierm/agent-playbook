# agent-playbook

Anglická verzia: [README.en.md](README.en.md), návod po anglicky: [PLAYBOOK.en.md](PLAYBOOK.en.md).

Návod, ako postaviť agentov s identitou, pamäťou, pravidlami a poštou, a
očistené ukážky súborov z živého súkromného systému jedného operátora. Systém
sa skladá z troch častí: workflow (plugin s mechanikou), brain (git repo s
dátami persony) a poštová služba. Prácu nesú témy a agenti bežia vo vláknach
T3 Code. Návod opisuje, čo sme postavili, prečo a v akom poradí to postaviť
u seba. Nie je to plugin a nič sa z neho neinštaluje.

## Kde začať

Prečítaj `PLAYBOOK.md`. Kapitola 0 dáva prehľad a slovník, kapitola 13 poradie
stavby. Každá kapitola má problém, časť Kedy to potrebuješ, mechanizmus, kroky
bez nášho kódu, čo vyžaduje od runtime a odkaz na náš príklad v tomto repe.
Skopíruj mechanizmy, nie naše pravidlá. Pravidlá sú odpoveďou na naše chyby
a tvoje budú iné.

## Čo tu je

| cesta | čo to je |
|---|---|
| `PLAYBOOK.md`, `PLAYBOOK.en.md` | samotný návod, po slovensky a po anglicky |
| `README.md`, `README.en.md` | mapa repa, po slovensky a po anglicky |
| `global/CLAUDE.md` | príklad pravidiel, ktoré platia pre všetkých agentov |
| `roles/` | index rolí `roles/ROLES.md` a pravidlá každej roly |
| `skills/unslop/SKILL.md`, `skills/chyba/SKILL.md` | skilly: písanie bez znakov strojového textu, slučka chyby |
| `rozhodnutia/README.md` | schéma záznamu rozhodnutia |
| `lib/public_check.txt` | zoznam vzorov mien a adries pre kontrolu verejného repa, vzory sú v base64 |

## Otvorené repá

Implementácia opísaná v návode je zverejnená v samostatných repách pod licenciou
MIT (súbor `LICENSE` v každom z nich). Sú to očistené snapshoty vydaných verzií
súkromných vývojových repozitárov: mená ľudí, agentov, strojov a domén sú
nahradené zástupnými (Alice, Bob, Carol, `example.com`) a história súkromných
repozitárov sa neprenáša. Snapshoty sa obnovujú pri vydaní novej verzie.

| repo | čo to je |
|---|---|
| https://github.com/gavalierm/agentic-flow-open | workflow: plugin Claude Code s pravidlami, skillmi, hookmi a skriptmi brain |
| https://github.com/gavalierm/agentic-comms-open | poštová a budiaca služba |
| https://github.com/gavalierm/agentic-brain-template | šablóna brain (dáta jednej persony alebo projektu) |
| https://github.com/gavalierm/agent-template | šablóna agenta: repo je zároveň brain (`"brain": "."`) |

Tento repo (`agent-playbook`) ostáva bez kódu: návod a ukážky.

## Čo v repe nie je

Kód a skripty sú v otvorených repách vyššie, preto tu nie sú. Nie je tu ani brain konkrétneho operátora: sú v ňom mená
ľudí, agentov, strojov a účtov, adresy, persony, pamäť, záznamy rozhodnutí
a logy. Z tohto repa si zober mechanizmy z kapitol a ukážky pravidiel a rolí.
Kód, ktorý ich vynucuje, napíšeš podľa kapitol a vlastného runtime.

Ukážky sú očistené: mená nahradila rola alebo zástupné meno.

## Kontrola a testy

Po klonovaní zapni hooky repa:

```
git config core.hooksPath .githooks
```

Repo nenesie žiadny kód. `pre-commit` aj `pre-push` zlyhajú, keď je v repe
súbor `.mjs` alebo `.sh`, aby sa kópia kódu nevrátila. Spustia aj kontrolu
verejného repa: prejde všetky súbory v gite a zlyhá, keď nájde meno človeka,
agenta, stroja, účtu alebo adresu zo vzorov v `lib/public_check.txt` (vzory sú
v base64, aby zoznam mená nevyzrádzal). Riadok zoznamu začínajúci znakom `+` je
povolený odkaz. `pre-push` skontroluje aj meno autora a správy commitov, ktoré
idú von. Druhá kontrola prejde všetky súbory `*.md` a zlyhá, keď text
v apostrofoch spomína cestu k súboru, ktorý v repe nie je.

Skripty kontrol sú vo verejnom repe `https://github.com/gavalierm/agent-runtime`.
Hooky ich volajú z jeho klonu, ktorý nájdu v premennej `AGENT_RUNTIME`, inak
vedľa tohto klonu v priečinku `agent-runtime`. Bez klonu skončia chybou
a povedia, čo naklonovať. Kontroly potrebujú Node 22 alebo novší.

## Jazyk

Zdroj je po slovensky. Anglický preklad je v `PLAYBOOK.en.md` a `README.en.md`, pri rozdiele platí slovenský text.

## Ako prispievať

Pošli pull request s mechanizmom: ako sa pravidlo zapíše, načíta, skontroluje
alebo opraví. Pravidlá prevádzky konkrétneho operátora (kto smie čo, aké sú
jeho zákazy) sem nepatria, tie si každý drží vo vlastnom repe. Pred pull
requestom prejdú kontroly z časti "Kontrola a testy" samy cez hooky.

## Licencia

MIT, súbor `LICENSE`.
