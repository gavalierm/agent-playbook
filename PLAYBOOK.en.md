# Playbook: agents with identity, rules and checks

## 0. Introduction

This guide is for an operator who wants to run several agents (sessions of a language model with their own repo) and
does not want to repeat the same instructions to them again and again. It is also for an agent that got the order "read
this repo, study it and think about how to build a similar mechanism for us". It is not a plugin, and nothing gets
installed from it. It describes what we built, why, and in what order to build it yourself.

The problem is simple. An agent without memory repeats mistakes, asks about things the operator already decided, and
states things it did not verify. Asking it to "be careful next time" does not help, because next time is a new session.
Only two things help: a rule written in a file that is loaded at start, and a check that fails when the agent breaks the
rule.

So the system stands on three things. Rules and decisions are files in git. A mistake the operator acknowledges comes
with a change to the file that governs the behaviour. Whatever a machine can check is checked by a hook or a script, not
by the goodwill of the model.

Each of chapters 1 to 11 has the same structure. Problem says what goes wrong without the mechanism, also for a reader
who does not know our system. When you need it says when not to build the mechanism. Mechanism describes how it works.
How to build it gives steps, a file format and an example, without our code. What it requires from the runtime lists
what the tool the agent runs in must be able to do. Our example shows paths in this repo where you can read the finished
version. Chapter 12 is the order of work for the first week.

The scripts without which the harness would not run (the waker, clean context, messages between agents, the task
manager wrapper) live in the repo `https://github.com/gavalierm/agent-runtime`. The repo is still private and will be
published after cleanup (D0171). So every mechanism is described in a way that lets you build it without that link. The
link is only a path where you can read the finished code once it is public.

Paths are relative to the repo root unless stated otherwise. This repo is a cleaned copy of the private rules repo that
runs in our operation. Paths in the "Our example" parts point into this repo where the file exists, and otherwise into
the private operations repo (deploying it to our server is our business, not part of the guide). The map of the repo is
in `README.md`, read it first. Files that the text mentions and that are not in the repo are described in its table
"What is not in the repo". Do not copy our rules as text. They answer our mistakes, and yours will be different. Copy the
mechanisms, meaning the way a rule is written down, loaded, checked and fixed.

### Glossary

| term | meaning |
|---|---|
| operator | the human who owns the workplace, the agents and the accounts, and decides what they reserved for themselves |
| operator's deputy | an agent with a mandate to decide for the operator within approved limits |
| agent manager | a role that manages personas, rules, hooks and the flow of work of the agents |
| server administrator | an agent with root, does only work that needs root or a sensitive action |
| task manager | a tool with tasks, states and comments, in our case Tasker |
| persona, role | the file `PERSONA.md` in the agent's repo, and a mandate described in `roles/<slug>.md`, independent of the agent's name |
| runtime | the tool the agent runs in, which supplies the model, files and commands, in our case Claude Code |
| session | one run of an agent over a repo, from start to clean context or the end of the process |
| context | all the text the model gets in one call, that is rules, conversation and tool results |
| compaction | shortening of the context, where the runtime replaces the old conversation with a summary |
| hook | a script that the runtime runs on an event (session start, prompt, tool use, end of reply) and that can add text to the context or reject a step |
| memory | the agent's files in the repo (`memory/`) that hold what must survive a session and goes beyond one project |
| skill | a file with a procedure for the agent, and possibly a script, which the agent uses when the task matches its description |
| sub-agent | a second session that the main session starts for one partial piece of work and that returns only the result |
| thread | a persistent session of the agent in its tool (in our case a thread in T3 Code), survives single replies and accepts text sent into it |
| topic thread | another thread of the same agent that runs one topic, the main thread is the one the agent runs in by default |
| turn | one call of the model from input to the end of the reply, the model reads the whole context again each time |
| run | a stretch in which the agent works on one input, can have several turns and tool calls |
| mailbox | a directory of the agent with the subdirectories `inbox` and `processed`, a message is a file |
| waker | a program that delivers a message from the mailbox into the running session of the agent and moves the file to `processed` |
| batch | all waking messages for one thread that the waker sends at once, so they use one turn |
| quiet window | the time without a new waking message (in our case 30 s) after which the batch goes out, so messages that arrive close together travel together |
| message mode | the first line of a message, `odpoveď: čakám`, `nečakám` or `na vedomie` (reply: I wait, I do not wait, for information), says what the sender expects of a reply |
| reply route | a record of which thread the sender wrote from, the waker uses it to deliver the reply to that thread |
| task | a record in the task manager with a project, reason, done condition, assignee, state and comments |
| assignee | the agent or human who does the task and whom the task manager wakes on a change |
| done condition | a note in the task by which you can decide whether it is done, best a command and its expected output |
| blocker | a link "this task waits for that one" with a mandatory reason, when that one closes, this one unblocks |
| clean context | a new session without a conversation, which the agent starts from what is written in files and in the task manager |
| handover | a small file with a summary of the state and the next step, which the agent writes before cleanup and which is inserted into the new session |

### Prerequisites

The scripts in the repo are bash and Node.js 22 or newer. The test command needs that version, `node --test` with file
patterns, and the scripts use only `node:` modules, nothing gets installed.
The hooks are Claude Code hooks (SessionStart, UserPromptSubmit, PreToolUse, Stop). They work only when you wire them
into the Claude Code settings. The repo does not do that for you.
We have the rules clone deployed at fixed paths on our machines. In the text, `<rules clone>` replaces them. Pick your
own path.
We did not verify Windows. The scripts run only through WSL or Git Bash, and without bash and Node they do not run at all.
The mechanisms in the text stand without our scripts too. Following the part "How to build it" in each chapter, you write
them in your own language and your own tool.

## 1. An agent is a persona and memory in git, not a session

### Problem

A model session ends at clean context, at compaction, at restart and when you change machines. What the agent knows only
from the conversation, it does not know afterwards. The operator then explains again who the agent is, what it may do and
what was already agreed. An agent whose behaviour depends on how the session developed is unpredictable.

A second problem appears with several agents. When rules and knowledge live in conversation windows, nobody knows what
each agent knows, and you can neither check it nor roll it back.

### When you need it

You need it when an agent works longer than one session, or when you have several of them. You also need it when you want
to know what changed in its behaviour and why, because the history is in git.

You do not need it for a one-off job that one session finishes. For one agent on one project, an instruction file in the
project root is enough (`CLAUDE.md` in Claude Code). Read the rest of the chapter as a sample of where this leads.

### Mechanism

The agent is a repo in git. It contains the persona (`PERSONA.md`), a file for the runtime that imports the persona, the
memory and its own skills. A session is only one run over this repo. At start the persona and the memory load. What must
survive the session, the agent writes into files, commits and pushes.

The persona says who the agent is, how it works with the operator, what it manages and where its limits are. It has no
names of tools of a specific runtime, so that it can be moved. Rules that another agent needs too are not in it
(chapter 2).

The memory holds facts that go beyond one project, for example where things are stored and who prefers what. Decisions
and procedures belong in the project documents and in the decision register (chapter 4). A lesson from a mistake moves
from memory into the persona, and the memory entry is deleted, because memory is only read at start, while the persona
governs the agent.

Session start is always the same. The agent runs `git fetch origin && git rebase origin/main` in the agent's repo and in
the rules repo, then reads the memory and the mailbox (chapter 8). The command `git pull` is not used. Several sessions
in one clone run fetch at the same time, each writes its own line into the file `.git/FETCH_HEAD`, and pull then fails on
two lines.

The agent signs commits with the name `<Agent> (<machine>)`, so the history shows who made it and where. It always
commits with a list of files after `--`, because several sessions share the index of the clone. A bare `git commit`,
`-a`, `git add -A` and `git add .` are forbidden, because they would take along the unfinished files of another session.
Work is done when `git status --short` is empty after the push.

### How to build it

1. Create a private repo for the agent with its own write key. One key per agent shows who pushed. Secrets belong in
   files with mode `600` outside the repo.
2. Write `PERSONA.md`. The first line is a heading with the name, under it a line with the roles, then sections. Five
   sections are enough. Who I am, how I work with the operator, what I manage, limits, continuity.
3. Write the file for the runtime that imports the persona. For Claude Code it is `CLAUDE.md` in the repo root, and the
   line `@PERSONA.md` inserts the content of the file into the context.
4. Create `memory/` with the index `memory/MEMORY.md`. The index has one line per memory file, a link and one sentence
   about what the file is.
5. Write the start rule (fetch, rebase, memory, mailbox) and the end rule (unfinished work into memory, commit, push)
   into the persona.
6. Turn on a git pre-commit hook that runs the repo checks (chapters 4 and 6). A git hook is a script in `.githooks/`,
   you turn it on with `git config core.hooksPath .githooks`. Without the checks the rules drift apart.
7. Verify it with one test. Have the agent write a fact into memory, commit, clear the context (or start a new session)
   and ask it about that fact.

The file for the runtime:

```
@PERSONA.md

# <Name> on <machine>

This file adds to PERSONA.md only what belongs to a run on this machine.
```

A line of the memory index:

```
- [Where the API secret is](tajomstvo_api.md), the path to the file and who may read it
```

### What it requires from the runtime

- It loads an instruction file from the working directory at start. Claude Code reads `CLAUDE.md`, another tool has a
  different name.
- It can insert one file into another. If it cannot, the runtime file contains the whole persona and you generate it from
  `PERSONA.md` with a script, so the texts do not start living twice.
- It lets the agent into a shell with git and a write key.

### Our example

The start and end rules are in `env/server/CLAUDE.md`, part "Git on the server" (Slovak: "Git na serveri"). The rule on
unfinished work is in `global/CLAUDE.md`, §6. That the persona has no runtime tool names is stated in
`roles/spravca-agentov.md`, part "Persona of agents" (Slovak: "Persona agentov"). The pre-commit hook is
`.githooks/pre-commit`. A sample persona is in the file `PERSONA.md` of the agent manager's repo.

## 2. Layers of rules

### Problem

Rules written in one place grow. A rule that every agent needs gets copied into five personas, and the fifth wording then
differs from the first. A rule about a role, written with an agent's name, stops being valid when the agent is renamed or
another agent takes over the role. On top of that, an agent does not know which of two rules is stronger.

A third problem appears when a rule changes. A session that is already running does not see the new wording. The agent
keeps following the old rule until someone restarts it.

### When you need it

You need it when a rule should apply to more than one agent or more than one project. You also need it with a single
agent, if it works on several machines and each has a slightly different environment.

You do not need it with one agent on one machine. One instruction file and a persona are enough. Add layers when you write
the same rule for a second agent for the first time. Add roles only when you have work that the first agent should not do.

### Mechanism

Rules have five layers, from the widest to the narrowest. A narrower layer takes precedence over a wider one.

| layer | file | applies to |
|---|---|---|
| global | `global/CLAUDE.md` | every agent everywhere |
| environment | `env/<environment>/CLAUDE.md` | every agent on this machine |
| role | `roles/<slug>.md` | an agent whose persona lists the role |
| persona | `PERSONA.md` in the agent's repo | one agent |
| project | `CLAUDE.md` of the project | work in the project, takes precedence |

Loading is hard, not voluntary. Claude Code loads the file `CLAUDE.md` from the user's home directory
(`~/.claude/CLAUDE.md`) and from every parent of the working directory. So you place the global file as a symbolic link
at `~/.claude/CLAUDE.md`, and the environment file as a symbolic link at the root of the tree under which the agents run.
The persona loads by the import `@PERSONA.md` from the runtime file. A hook inserts the roles at session start.

The identity hook runs at session start. It reads the line `Role: <slug>, <slug>` from `PERSONA.md` and inserts the files
`roles/<slug>.md` into the context. An agent whose persona lists no role does not get its rules. An unknown slug gives a
warning in the context, and the hook does not crash. The same hook also announces the identity, meaning the name from the
persona heading and the shortened session id.

A change of rules reaches the agent in the middle of a session too. On every prompt, a hook compares the commit the
deployed rules clone is on with the commit this session saw last. If they differ, it inserts into the context a list of
commits and a diff of the files in `global/` and `env/<environment>/`. The state of the last seen version is kept in one
file per session, so sessions do not affect each other. The first prompt of a session only writes the commit, because the
files were loaded fresh at start. So a change applies at most five minutes after the push and without a restart, if the
deployed clone updates itself every five minutes.

A role rule and an agent's name each have a single place. You write a rule for a role or a group of agents. A single file
that maps roles to names says who holds a role. Renaming an agent is a change of one line and of the repo name, and the
rules do not change. A name belongs only in an example or in a description of a state with a date. A role is a mandate and
a responsibility, not system privileges.

A rule belongs at the level of its reach. If another agent needs it too, or another agent holds a copy, it belongs in the
global rules, the environment or a role. Two checks enforce this. The first looks for duplicates, meaning bullets in
personas that say the same as bullets in the shared files. The second is a hook that, on the first write of new text into
an agent's rules, rejects the write with the question whether another agent does the same thing. The identical second
write passes, so the hook only forces a pause.

The global rules have a word cap that may only go down. Shorter rules are followed better, and every word costs tokens on
every model call.

### How to build it

1. Write `global/CLAUDE.md`. Start short (chapter 12) and keep it under a cap that you set. The cap is a number in a file,
   for example `1500`, and a check counts the words of the file and fails when there are more than the number. The number
   may only go down, so the check also compares with the state in the previous commit.
2. Link it. In Claude Code it is `ln -s <rules clone>/global/CLAUDE.md ~/.claude/CLAUDE.md`. The line in the persona looks
   like `Role: zastupca-operatora, spravca-agentov`.
3. Write `env/<environment>/CLAUDE.md` for things typical of the machine and link it to the root of the agent tree, for
   example `ln -s <rules clone>/env/server/CLAUDE.md /home/agents/CLAUDE.md`.
4. With several roles, write `roles/ROLES.md` as an index and `roles/<slug>.md` for each one. Put the mapping of roles to
   names in one file, for example `roles/agents.md`, and write names nowhere else.
5. Write a SessionStart hook that reads the `Role:` line and prints the role files to standard output. At SessionStart the
   output of the hook is added to the context.
6. Write a UserPromptSubmit hook with the clone diff. The hook does this.
   1. Take `session_id` from the JSON on input.
   2. Find `git rev-parse HEAD` of the deployed clone.
   3. Read the state file for this session. If it does not exist, write HEAD and exit without output.
   4. If HEAD matches, exit. Otherwise write it and print `git log --format='%h %s' <old>..<new> -- global/ env/<environment>/`
      and `git diff <old>..<new> -- global/ env/<environment>/`, at most 20 kB.
7. Make sure the rules clone updates itself. A timer (cron or systemd) that runs `git fetch origin && git merge --ff-only origin/main`
   every five minutes is enough.
8. Write a deployment script that sets up the links, hooks and timer in a repeatable way.
9. Add a duplicate test to the repo check. Split the rules into units (a bullet or a paragraph), strip diacritics,
   punctuation and short words, cut words to five characters and report a pair of units where at least three quarters of
   the smaller one match.

### What it requires from the runtime

- It loads instructions from the user's home directory and from all parents of the working directory, or gives you another
  way to insert a global file into every session.
- It supports hooks at session start and on every prompt, whose output is added to the context.
- It gives the hook an input with the session id and the working directory. The hook stores state by the session id.
- It imports a file from a file (`@PERSONA.md`), or adds personas in another way.

### Our example

The table of layers is in `README.md`. The role index is `roles/ROLES.md`, and the role rules are
`roles/zastupca-operatora.md`, `roles/spravca-agentov.md`, `roles/pracovny-agent.md` and `roles/dizajner.md`. The hooks are
`hooks/identity.mjs`, `hooks/rules_delta.mjs` and `hooks/own_rule_scope.mjs`. Deployment is done by
`env/server/install.sh`, duplicates are found by `lib/rule_dupes.mjs`, and the word cap is held by
`lib/global_word_cap.txt`. The rule "an instruction against a rule" is the record `rozhodnutia/D0144.md`. These four files
are not in the repo, they are tied to our runtime or private. What they do is in the table "What is not in the repo"
in `README.md`.

## 3. The operator and the deputy

### Problem

The operator has little time. An agent that asks about everything delays them. An agent that asks about nothing does even
what the operator reserved. Asking about things the agent can settle itself is also a hidden mistake, because it passes as
caution.

When there are several agents and each asks the operator on its own, the operator becomes a postman between them, and
nobody knows what is currently waiting for what. Questions get lost in conversations.

### When you need it

You need it when agents work for a long time without supervision and the operator has no time to approve every step. You
need it when the operator reserved something (payments, new services, steps that cannot be undone) and the agent must know
it before it touches production.

You do not need it when you work with one agent and sit next to it. Then you decide, and the agent asks in the
conversation. With three or more agents and no deputy, you end up as a secretary who moves questions around.

### Mechanism

The operator's deputy is an agent with a mandate to decide for the operator where the operator does not decide alone, within
limits the operator approved. The mandate is written in the role file. The deputy's order carries the mark
"[<name> for <operator>]", and other agents treat it as an order of the operator. There is one deputy on each machine of
the operator. Deputies are equals and pass state to each other by messages (chapter 8), not by shared memory.

The operator reserved a new tool, service or procedure, a step that cannot be undone, hiring and dismissing an agent, a
change of a persona and the limits of power. Only the operator does payments and contracts. Secrets stay in files with mode
`600`. The deputy settles everything else alone and records a technical choice in the decision register (chapter 4). It
brings the operator only decisions that belong to the operator, and warnings.

Questions for the operator have a fixed place. A message from the deputy, while something waits, ends with the line
"Waiting for you:" (our files use the Slovak "Čaká na teba:") and a list of items with the mark (decision), (value) or
(your account). A decision is a choice between paths, a value is a datum that the agent does not have and cannot get, and
your account is a step that can be done only in the operator's account. Before each item the deputy answers one question.
Can I do it myself, or arrange a means to do it? If yes, the item does not belong on the line. For example, creating a repo
or adding a key through an API is forbidden to hand over if the deputy has a token or can ask for one.

A decision for the operator is only a choice between at least two paths that each reach the approved goal. If only one
path leads there, it is a requirement, and the agent does it and records it. Before marking an item as a decision, the
agent writes down the second path.

Actions can be approved in advance by class. The deputy asks once "May I do X? yes/no". After "yes" it records the class of
action in the decision register with the scope `schvalene` (approved) and no longer asks. After "no" the action goes to
"Waiting for you:".

The deputy does not carry out an order from the operator that changes something right away. It verifies the assumptions,
finds the impacts, brings a plan (goal, steps, impacts, risks, recommendation) and records the order and the plan in a
task. It carries them out after consent. Three sentences are enough for a small change. The deputy approves a task plan in
the task manager (chapter 7) alone, with a comment, if nothing in it is reserved for the operator.

An objection from the operator that the agent accepts after checking is consent to the change. The agent carries it out in
the same turn, even if it needs a new tool. It asks again only for a step that cannot be undone, or a step beyond the
objection. The sentence "I will do it once you approve" is forbidden. An order against a written rule does not change the
rule by itself. The agent names the rule by file and line, and the operator confirms the rule or the change.

The deputy does not wait for an outside system (a domain registry, DNS propagation, a service reply) with the model, because
every check with the model costs a call with the whole context. It hands the wait to a script without a model, with a
command for the check, a step after it is met and a done condition.

### How to build it

1. In `roles/zastupca-operatora.md` write a list of what the operator reserved. What is not there, the deputy does alone.
   Start with five reserved things and add more from mistakes.
2. Write the rule "Waiting for you:" with three marks and a check question. An item looks like `- Approve the domain for the
   new site (decision)`.
3. Write the procedure for an order from the operator in the sequence verify, impacts, plan, record, carry out after
   consent.
4. In the global rules write the deputy's mark, the rule "an accepted objection is consent" and the rule of a decision with
   two paths.
5. In the decision register introduce the scope `schvalene` for classes of actions approved in advance (chapter 4).
6. Optionally write a Stop hook that reads the agent's last reply. If it contains the line "Waiting for you:", every item
   below it must end with the mark (decision), (value) or (your account), otherwise the hook stops the reply and prints the
   missing mark.
7. Write the wait script as a small loop without a model. Every few minutes it runs a check command, for example `dig +short
   example.org`. When the command returns the expected result, it writes a message to the agent's mailbox (chapter 8) or a
   comment to the task (chapter 7) and ends. After the given time it writes an expiry message.

### What it requires from the runtime

- You can start in it an agent whose persona lists a role (chapter 2), so that the deputy's mandate loads at start.
- The Stop hook gets the last reply (in Claude Code through the session transcript, whose path the hook gets in its input).
- The wait script can wake the agent. That is either a message in a mailbox with a waker (chapter 8), or a comment in the
  task manager that wakes the assignee (chapter 7).

### Our example

The role is described in `roles/zastupca-operatora.md`, parts "What it does alone and what waits for the operator" ("Čo
urobí sám a čo čaká na operátora"), "Order from the operator" ("Zadanie od operátora"), "Limits" ("Hranice") and
"Continuity" ("Kontinuita"). What the operator reserved is in `roles/ROLES.md`. The decision with two paths is in
`global/CLAUDE.md`, §6, the accepted objection in §1. The line "Waiting for you:" is checked by `hooks/reply_guard.mjs` with
the variable `AR_ROZHODNUTIA=1`. The scope `schvalene` is in `rozhodnutia/ROZSAHY.md`.

## 4. Decision register

### Problem

A decision spoken in conversation dies with the session. A week later the agent asks again or does the opposite. Notes in
one big file cannot be checked, and an old decision gets replaced by a new one without fixing the places that still state
the old one. Agent instructions then claim things that stopped being true long ago.

### When you need it

You need it when an agent repeatedly asks about things you already decided, or when rules change and the old wordings
remain in personas, memory and documents. You also need it when you want to know about a decision who made it and with
what power.

You do not need it with one agent and ten rules. One file with bullets in the repo is enough then. Create the register when
you find two claims in the instructions that contradict each other, or when an agent acts on a decision that no longer
holds.

### Mechanism

A decision is one file in `rozhodnutia/` (Slovak for "decisions"), named `D0001.md`, `D0002.md` and so on. The header is a
list of `key: value` fields between two `---` lines, followed by a short body. A file is never deleted, and a change of
state is a commit. The field names and enum values below are written as they appear in our files.

| field | meaning |
|---|---|
| `id` | `D` and four digits, equal to the file name |
| `nazov` | title, one sentence saying what holds |
| `stav` | state: `platí` (valid), `nahradené` (replaced) or `zrušené` (cancelled) |
| `kluc` | key, a dotted path of one subject, for example `odpoved.strop-viet`, unique among valid records |
| `rozsah` | scope, tags from `rozhodnutia/ROZSAHY.md`, meaning the topics the decision touches |
| `agenti` | agents, names in lower case, or `*` |
| `rozhodol`, `moc` | who decided, and with what mandate (operator, deputy, agent manager and so on) |
| `zapisal`, `datum` | who wrote the record and when |
| `zdroj` | source, where it was said, for example a thread, a message or a task |
| `nahradza`, `nahradene` | links between records (replaces, replaced by), both sides point at each other |
| `subory` | files of the repo that embody the decision, they must exist |
| `zrusene-tvrdenie` | cancelled claim, a regular expression of a sentence that must not stand anywhere after the change |

The body has at most five sentences. It says what holds, why, and what was rejected. The history is in git.

The key prevents two valid records about one subject. The write script fails when a new record with a valid key does not
say that it replaces the old one. The power prevents an agent without a mandate from deciding about rules. The table of
scope and power is in `rozhodnutia/ROZSAHY.md`, and the check enforces it. The file `INDEX.md` is a generated overview of
all records and is not edited by hand.

Writing goes one way. The script `bin/rozhodni.sh` assigns a number, writes the file, rewrites `INDEX.md`, commits under
the agent's name and pushes. A hook that rejects every other write into the records runs before the tool is used. It
catches a write through the file editing tool and a command in the shell, including `sed -i`, redirection and `tee`. The
option `--dry-run` writes nothing, and the option `--zrus` (cancel) cancels a decision.

Cancelled claims are checked by a machine. When a decision changes something, its field `zrusene-tvrdenie` carries a
regular expression of the old sentence. A check scans the agent instructions and the memory and fails at every place that
still states the old sentence. A second check goes through the paths in backticks in the instructions and fails on a path
to a file that does not exist. A third fails on a memory that claims something waits for the operator without a task
number, or mentions a decision without a record number.

An agent learns about decisions from three places. A hook at session start inserts the changes since the last start and the
tasks waiting for the operator. The rules-change hook from chapter 2 inserts a change of a record into the next prompt. And
the agent lists them itself, with `node lib/rozhodnutia.mjs list --agent <name>`.

A remark in a conversation is not a decision. It is written down only after the operator says yes to the text. While they
discuss the matter, no record is written.

### How to build it

1. Create `rozhodnutia/` and `rozhodnutia/README.md` with the schema of the fields.
2. Write `rozhodnutia/ROZSAHY.md` with a table of tags and a table "scope may power". Start with five tags.
3. Write the write script. It assigns the next number (the highest number in the directory plus one), writes the header and
   the body from standard input, runs the check and commits. A write never overwrites an existing file.
4. Write the check. The id equals the file name, the key is unique among valid records, the links `nahradza` and
   `nahradene` point at each other, the files in `subory` exist, the tag is in the table, the power fits the scope.
5. Write a list of cancelled claims and a check that looks for them in the instructions and in the memory. The list can be a
   plain text file where a line is a regular expression, a tab and a reason.
6. Wire a PreToolUse hook that rejects a write into `rozhodnutia/` outside the script. The hook rejects a write tool whose
   path leads to a record `rozhodnutia/D0xxx.md`, and a shell command that mentions such a record together with `sed -i`,
   `tee` or redirection. The rejection carries the line "Correct procedure:" (our files use "Správny postup:", chapter 6).
7. Wire a SessionStart hook with the changes since the last start and run the check in the pre-commit hook.

A record:

```
---
id: D0001
nazov: Odpoveď operátorovi má najviac šesť viet
stav: platí
kluc: odpoved.strop-viet
rozsah: pravidla
agenti: *
rozhodol: <operator name>
moc: operator
zapisal: <agent>
datum: <YYYY-MM-DD>
zdroj: <thread or task where it was said>
subory: hooks/reply_guard.mjs
---
A reply to the operator has at most six sentences of prose. The reason is that the operator does not read a long reply.
A cap of twelve sentences was rejected, because agents reached it regularly.
```

### What it requires from the runtime

- PreToolUse and SessionStart hooks that can add text to the context or reject a tool with a reason (chapter 6).
- The PreToolUse hook also sees shell commands, not only writes through the file editing tool. If the runtime does not show
  shell commands to hooks, you will not catch a write through `sed`, and you guard it with a check in the pre-commit hook.
- Access to git and the ability to push under the agent's name.

### Our example

The schema is in `rozhodnutia/README.md`, the tags in `rozhodnutia/ROZSAHY.md`. Sample records are `rozhodnutia/D0141.md`,
`rozhodnutia/D0142.md` and `rozhodnutia/D0144.md`, which replaces `rozhodnutia/D0010.md`. Writing is done by
`bin/rozhodni.sh`, the logic and the check by `lib/rozhodnutia.mjs` with the test `lib/rozhodnutia.test.mjs`. Cancelled
claims are read by `lib/doc_paths.mjs` from the file `lib/retired_claims.txt`, and the memory is checked by
`lib/memory_claims.mjs`. The hooks are `hooks/rozhodnutia_guard.mjs` and `hooks/rozhodnutia_context.mjs`. The records D0010,
D0141, D0142 and D0144, the scripts `lib/doc_paths.mjs` and `lib/memory_claims.mjs`, the list `lib/retired_claims.txt` and
both `rozhodnutia_*` hooks are not in the repo. The records are private, and the rest is tied to our tasks and memory. What
they do is in the table "What is not in the repo" in `README.md`.

## 5. The mistake loop

### Problem

An agent makes a mistake, the operator corrects it, the agent says "you are right" and a week later does the same thing. A
fix written only into memory or into the conversation does not survive. A fix that does not change the file that governs
behaviour is not a fix. And a request for more caution does not block the mistake.

When nobody records mistakes, you cannot see which ones repeat. A repeated mistake is a signal that a rule or a check is
missing, and without a record you will not catch it.

### When you need it

You need it when the same mistake returns a second time, even though the agent acknowledged it once. You also need it when
you trust the agent's word and later find that it claimed what it did not verify.

You do not need it while the agent does one-off tasks and mistakes have no consequence. Even then the first step of the
chapter helps, meaning the definition of a mistake in the rules. Add the script, the register and the hook only when you
have the first repeated mistake.

### Mechanism

The loop has five steps. The operator objects. The agent verifies the objection and accepts it. It fixes the file that
governs the behaviour and commits. It records the mistake in the register with a script. It introduces a check that blocks
the mistake, at the latest at the second occurrence of the class. The class of a mistake is a short key for one cause, for
example `neoverene-tvrdenie` (unverified claim). The same cause is the same class even in another concrete case.

These count as a mistake: a false claim, a step that was not the agent's, a needless action by the operator, an accepted
objection, a fix asked for twice, or damage to a live system. Every mistake of an agent is a process mistake. The agent
finds the tool, rule or check that let it through and fixes them before it declares the mistake handled.

The fix belongs in the file that governs the behaviour, meaning the persona, a rule, a skill, a hook or a check. A memory
entry is not a fix. A rule is written as the target behaviour with a check that can be ticked off, and for a ban with a
forbidden sentence. The persona carries a short line about the incident. Names from the incident belong in a decision
record, not in a role rule.

The strongest fix is a check that fails on the mistake. It is a test, a hook or a script. Before declaring the fix, the
mistake is replayed and the check is shown failing. A replay never touches a live system, and it first verifies that it
cannot fall back to a live path, mailbox or service. After a change of a value, option or path, the agent finds the old
value with `grep -rn` and fixes every hit, also in documents and comments.

The mechanical part is done by `bin/chyba.sh`. It takes the class of the mistake and the file that governs the behaviour,
and does four things.

1. It rejects a file that is not committed, so the report carries the number of the fixing commit.
2. It writes a line into the register (date, agent, class, file, commit, description, task number).
3. At the second occurrence of the same class for the same agent, it creates in the task manager a task for a check that
   blocks the mistake.
4. It prints a report in four sentences. What I claimed or did, what was true, which file and commit changed, what stops it
   next time.

The agent puts the report into its next reply to the operator, even if not asked.

A hook that runs before the end of a reply (Stop) enforces the loop. It reads the last reply and the commands of the turn.
When the reply acknowledges a mistake (phrases like "you are right" or "my mistake") and `chyba.sh` did not run in the
turn, it stops the reply. It also stops it when the turn lacks a commit of the file that governs the agent, or when the
reply does not carry a commit number. On the second stop in a row it stays silent, so it does not loop.

The agent manager also follows a six-step improvement procedure.

1. Find the file and line that was missing or lying.
2. Name one cause in the system.
3. Write a fix with a check.
4. Deploy it.
5. Replay the scenario in which the problem arose.
6. Record the decision.

A fix of the type "I wrote it into a skill" is not approved.

### How to build it

1. In the global rules write a section on mistakes. Define a mistake, say that it is a process mistake, that the fix goes
   into a file that governs behaviour and that the check must fail on the mistake.
2. In the persona add a section "Own mistake" ("Vlastná chyba") that refers to the global rule and carries short lines about
   incidents.
3. Write `bin/chyba.sh` with the options `--trieda` (class), `--subor` (file), `--popis` (description), `--pravda` (what was
   true), `--kontrola` (check). The register is a file with tabs outside the repo, for example
   `~/.local/state/<name>/chyby.tsv`. The script finds the commit with `git log -1 --format=%h -- <file>` and rejects a file
   with unsaved changes (`git status --porcelain -- <file>` is not empty).
4. Write a skill `chyba` that says when to run the script and in what order. A skill is a file `SKILL.md` with a description
   by which the agent selects it.
5. Write a Stop hook that stops a reply that acknowledges a mistake without a commit and without the script. The hook does
   this.
   1. It takes `transcript_path` and `stop_hook_active` from the JSON on input. If `stop_hook_active` is true, it exits
      without output.
   2. It reads the transcript (one JSON per line) and finds the last message of the operator, meaning a `user` record that
      carries text.
   3. From the `assistant` records after it, it collects the reply texts and the commands of the Bash tool.
   4. If the text contains a phrase from the regular expression of acknowledgement and `chyba.sh` is not among the
      commands, it prints `{"decision":"block","reason":"<reason> Correct procedure: <step>"}`.
6. Write a hook test with a conversation transcript from a real mistake. The test must fail when you turn the hook off.
7. Give the task for the check at the second occurrence to the agent that manages the rules (chapter 7).

Running it:

```
bin/chyba.sh --trieda neoverene-tvrdenie --subor PERSONA.md \
  --popis "I claimed a state without checking" --pravda "the state was different" \
  --kontrola "the hook rejects a reply without proof"
```

### What it requires from the runtime

- A hook that runs before the end of a reply and can stop the reply with a reason that the agent gets back.
- Access of the hook to the session transcript, so it sees the reply text and the commands of the turn. In Claude Code it is
  the path in the field `transcript_path`.
- A flag that the hook already stopped once (`stop_hook_active`), so the loop does not repeat forever.
- For the automatic creation of a task for the check, a task manager with a command line (chapter 7). Without it the script
  does not create the task and says so.

### Our example

The mistake rules are in `global/CLAUDE.md`, §4, the accepted objection in §1. The script is `bin/chyba.sh`, the skill
`skills/chyba/SKILL.md`, the hook `hooks/objection_fix.mjs`, the tests `lib/chyba.test.mjs` and
`hooks/objection_fix.test.mjs`. The decision on the loop is `rozhodnutia/D0142.md`, a private record that is not in the repo
(its content is in the table "What is not in the repo" in `README.md`). The improvement procedure is in
`roles/spravca-agentov.md`, part "Improving agents" ("Zlepšovanie agentov"). The section "Own mistake" is shown by
`PERSONA.md` in the agent manager's repo.
