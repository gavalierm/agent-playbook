---
name: chyba
description: Premení uznanú chybu agenta na skill alebo pravidlo, uloží ju skillom uloženia a ohlási správcovi workflow poštou s úrovňou assist. Použi vždy, keď ty a operátor uznáte chybu (námietku si prijal, našiel si vlastnú chybu), príkaz zlyhal druhýkrát, pracovník vrátil neprázdne "Failures" alebo si tvrdil nepravdu.
---

# Uznaná chyba

Chyba sa stáva skillom alebo pravidlom (kapitola 5). Samotné "moja chyba
bola" nestačí, lebo z poučenia v jednom brain sa nikto iný nedozvie.

## Postup

1. Over námietku a prijmi ju. Oprav chybu a nájdi postup, ktorý funguje.
   Postup over jedným úspešným spustením.
2. Nájdi nástroj, pravidlo alebo kontrolu, ktoré chybu pustili. Každá chyba
   agenta je chyba procesu.
3. Urči, kam poučenie patrí. Chyba nástroja alebo postupu ide do skillu pre
   ten istý nástroj alebo druh práce. Chyba správania (nevyžiadaná zmena,
   neoverené tvrdenie, chýbajúce overenie) ide do pravidla, nie do skillu.
4. Skill hľadaj skôr, než založíš nový. Ak existuje, doplň ho a nový
   nevytváraj. Doplnok nesie len nové kroky. Ak mení celé telo skillu,
   pošli ho ako náhradu.
5. Ulož poučenie skillom uloženia, jediným zapisovačom do brain. Priamy
   zápis do brain hook odmietne.
6. Do skillu pridaj riadok "nie <zlý spôsob>, lebo <prečo>". Popis skillu
   je trigger formulovaný situáciou, v ktorej ho agent potrebuje. Pravidlo
   píš ako cieľové správanie s kontrolou, ktorú možno odškrtnúť, a pri
   zákaze so zakázanou vetou.
7. Ohlás chybu správcovi workflow poštou (kapitola 8) s úrovňou `assist`:
   čo sa stalo, príčina a čo si uložil, skill alebo pravidlo. Hlási sa
   každá chyba, aj drobná a už opravená. Ak držíš tému, v ktorej sa
   workflow vyvíja, rieš chybu priamo v nej a nehlás ju sám sebe.
8. V najbližšej odpovedi operátorovi, aj keď sa nepýta, napíš štyri vety:
   čo si tvrdil alebo urobil, ktorý mechanizmus to pustil, čo si zmenil
   a ktorá kontrola to zastaví.

## Opakovaná chyba

Ak sa chyba zopakuje napriek skillu, oprav trigger alebo kroky. Ak sa
zopakuje aspoň druhýkrát, je to nespoľahlivosť, ktorú treba vynútiť kódom
(test, hook, skript, kapitola 6). Oznám to správcovi workflow. Pred
vyhlásením opravy chybu zopakuj (replay) a ukáž, že kontrola na nej
zlyháva. Replay nesiaha na živý systém. "Opravené, ale neoverené" je
zakázaná veta. Po zmene hodnoty, voľby alebo cesty nájdi starú hodnotu
príkazom `grep -rn` a oprav každý zásah.

## Chyby pracovníka

Pracovník do brain nezapisuje. Jeho sekciu "Failures" a log zlyhaných volaní
spracuj týmto postupom a po spracovaní záznam uzavri (kapitola 9).

## Opakovaný postup

Postup s viac ako tromi krokmi, ktorý nepokryl žiadny skill, zapíš pri
uzavretí jednotky práce do logu postupov s názvom `<akcia>-<predmet>-<spresnenie>`.
Pred zápisom skontroluj existujúce názvy. Pri treťom výskyte pripravíš návrh
skillu a predložíš ho operátorovi. Skill sám nevytváraš.
