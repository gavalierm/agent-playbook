# agent-playbook

Slovak version: [README.md](README.md), the guide in Slovak: [PLAYBOOK.md](PLAYBOOK.md).

A guide to building agents with identity, rules and checks, plus cleaned copies of files from the live private rules repo of
one operator. The guide describes what we built, why, and in what order to build it yourself. It is not a plugin, and
nothing gets installed from it.

## Where to start

Read `PLAYBOOK.en.md`. Each chapter has a problem, a part "When you need it", the mechanism, steps without our code, what it
requires from the runtime, and a link to our example in this repo. Copy the mechanisms, not our rules. The rules answer our
mistakes, and yours will be different.

## What is here

| path | what it is |
|---|---|
| `PLAYBOOK.md`, `PLAYBOOK.en.md` | the guide itself, in Slovak and in English |
| `README.md`, `README.en.md` | the map of the repo, in Slovak and in English |
| `global/CLAUDE.md` | global rules of all agents |
| `roles/` | the role index `ROLES.md` and the rules of each role |
| `env/server/CLAUDE.md` | an example of environment rules (a server with several agents) |
| `skills/unslop/`, `skills/chyba/` | skills: writing without the marks of machine text, an acknowledged mistake |
| `hooks/` | hooks with tests: identity and roles, change of rules, scope of a rule, the agent's reply, an accepted objection, task manager tasks |
| `lib/` | helper code of the hooks, the decision register `rozhodnutia.mjs`, the public repo check `public_check.mjs`, the path link check `path_check.mjs` |
| `bin/chyba.sh`, `bin/rozhodni.sh`, `bin/tk` | recording an acknowledged mistake, recording a decision, the task manager wrapper |
| `rozhodnutia/` | the schema of the decision register and the scope tags |

## What is not in the repo

The private operations repo carries things tied to one operator. It contains names of people, agents, machines and accounts,
addresses, agent personas and the runtime of the agent manager (the waker, mailboxes). So they are not carried over. The
runtime lives in the repo `https://github.com/gavalierm/agent-runtime`, which is still private and will be published after
cleanup (D0171). The references to them in `PLAYBOOK.en.md` and in the code stayed, and they point into the private operations
repo. The other files that the text mentions and that are not here are described by this table. The placeholder pattern
`rozhodnutia/D0xxx.md` means any decision record. The check `lib/path_check.mjs` fails when a text mentions a path that is
not in the repo and not in the table.

| path | what it does | why it is not here |
|---|---|---|
| `env/mac/` | Rules, deployment and environment settings on the operator's Mac, and descriptions of the structure and the flow of work. | It carries addresses and paths of a specific machine. The shape of an environment is shown by `env/server/CLAUDE.md`. |
| `env/server/install.sh` | Deploys the rules from the clone to the server, wires the hooks into the Claude Code settings and turns on a timer that pulls the clone every 5 minutes. | Tied to our server and systemd. You wire the hooks yourself in your own Claude Code settings. |
| `roles/agents.md` | A table of agents with their role, machine and the way they are woken. | It carries names of agents and machines. The role is in `roles/ROLES.md`, and an agent name belongs only in this table. |
| `rozhodnutia/D0010.md` | An order against a written rule does not change the rule. The agent names the rule and asks whether to change it. Replaced by D0144. | A private decision record, it carries names and links to our tasks. |
| `rozhodnutia/D0141.md` | Every rejection by a hook carries the line "Correct procedure:" (in our files "Správny postup:") with a step by which the agent reaches the goal. | A private decision record. The rule itself is in chapter 6 of the playbook. |
| `rozhodnutia/D0142.md` | An acknowledged mistake starts a fix skill with a script that records it in the register and, at the second occurrence, creates a task for a check. | A private decision record. The mechanism is in chapter 5 of the playbook and in `skills/chyba/SKILL.md`. |
| `rozhodnutia/D0144.md` | A confirmed change of a rule goes into the rule at its level, a local rule with a global reach moves to the global rules, and duplicates are removed. | A private decision record, it carries links to our tasks. |
| `bin/ask_agent.sh` | Sends a message to an agent from mailbox to mailbox and records the reply route. To build your own you need to know that it writes the file through a hidden `.tmp` and `mv`, inserts a header with the mode `čakám` (I wait) or `na vedomie` (for information) and rejects the mode `nečakám` (I do not wait) (chapter 8, point 3). | It needs our agent mailboxes and the waker. |
| `hooks/ask_agent.test.mjs` | A test of the script `bin/ask_agent.sh` in temporary mailboxes. | It tests a script that is not here. |
| `runtime/reply.sh` | An agent's reply to a message from a mailbox with the header `k:` and the default mode `na vedomie`. To build your own you need to know that it finds the mode and topic from the original message in `processed`, rejects a body with a line `Úloha` (Task), `Otázka` (Question) or `Hotovo:` (Done:) without an explicit mode, and records the route (chapter 8, point 4). | It is in the agent manager's repo and reads the settings of our mailboxes. |
| `runtime/route.mjs` | The reply route (message id `k:` to the sender's thread in `routes.json`) and the list of topics. To build your own you need to know that the record is created when sending from a topic thread and the waker uses it to choose the target thread for a reply (chapter 8, point 7). | It is in the agent manager's repo and finds threads through T3 Code. |
| `runtime/driver.mjs` | The waker delivers a message from the agent's mailbox to a thread and, after the line `HOTOVO-KONTEXT`, sends `/clear`. To build your own you need to know that it reads `inbox` every 5 s, keeps a quiet window and batches, never sends into a thread with an active run, and after sending moves the files to `processed` (chapter 8, points 5 and 6). | It is in the agent manager's repo and tied to T3 Code and our mailboxes. |
| `runtime/README.md` | A description of the runtime, meaning mailboxes, the waker, replies and deployment. To build your own you need the part "Waking" ("Budenie"), which chapter 8 summarised. | It is in the agent manager's repo and describes our deployment. |
| `bin/kontext.sh` | Prints the line `HOTOVO-KONTEXT <mode> <key>` with which the agent ends a reply before a clean context. | Tied to the waker and T3 Code threads. The procedure is in chapter 11 of the playbook. |
| `lib/kontext.mjs` | The logic of the script `bin/kontext.sh`. It writes the handover and refuses clearing when the agent's task is waiting. | Tied to the waker, T3 Code threads and our task manager. |
| `hooks/clear_bridge.mjs` | A SessionStart hook after `/clear`. It prevents the old context from coming back and does the session start. | It solves a property of our runtime T3 Code, and it may behave differently for you. |
| `hooks/context_warning.mjs` | A UserPromptSubmit hook, above 80 thousand tokens of context it adds an instruction for a clean context. | The instruction calls `bin/kontext.sh` and counts on our waker. |
| `hooks/no_model_wait.mjs` | A PreToolUse hook, rejects a wait in the foreground (`sleep` over 10 s, a loop with `sleep`). To build your own, a hook that rejects a command with `sleep` over ten seconds or a loop with `sleep` is enough. | The rejection text refers to our waker and task manager. The mechanism is in chapter 6 of the playbook. |
| `hooks/unslop.mjs` | A SessionStart hook, inserts the section Core ("Jadro") from `skills/unslop/SKILL.md` with the skill version into the context. | The inserted text carries the rules of our runtime and a link to our persona. The skill itself is here. |
| `hooks/tasker_root.mjs` | A PreToolUse hook, rejects a direct task manager command under root, the correct one is the wrapper `bin/tk`. | It solves our deployment, the task manager runs under another user for us. |
| `hooks/web_review.mjs` | A PreToolUse hook, rejects creating a web task outside the script and waiting until the designer's review is satisfied. | Tied to our task manager and web agents. |
| `bin/uloha-webu.sh` | Creates a web task and, with it, a task for the designer's review, and blocks the parent. | It calls our task manager and the review gate. |
| `hooks/rozhodnutia_guard.mjs` | A PreToolUse hook, rejects a write into decision records other than by the script `bin/rozhodni.sh`. | It counts on our decision archive and hook deployment. |
| `hooks/rozhodnutia_context.mjs` | A SessionStart hook, announces the decisions changed since the agent's last start and the questions for the operator. | It reads our records, personas and task manager. |
| `lib/doc_paths.mjs` | Verifies that a path in the agent instructions points to an existing file, and stops cancelled claims. | It counts on our machines and the list of cancelled claims. The simple version for this repository is `lib/path_check.mjs`. |
| `lib/retired_claims.txt` | The list of cancelled claims. A line is a regular expression, a tab and a reason. | It carries names of our agents and cancelled things. Take over the format. |
| `lib/memory_claims.mjs` | Stops a line of an agent's memory that claims something waits for the operator without a task number, or mentions a decision without a record number. | Tied to our tasks and the agents' memory. |
| `lib/rule_dupes.mjs` | Finds rules that say the same thing in local and shared rules. | The script is portable, but its test and the list of exceptions carry our names, so we do not copy it. The procedure is in chapter 2 of the playbook. |
| `lib/global_word_cap.txt` | The cap on the number of words in `global/CLAUDE.md`, may only go down. | The number is our choice, and the cap check is not here. |
| `lib/commit_guard.sh` | A commit-msg hook, rejects the trailer Co-Authored-By, a foreign e-mail and an author whose name is not in the form agent and machine. | It reads the list of our agents and the operator's e-mail. |
| `lib/open_branch_guard.sh` | A pre-commit hook, rejects a commit on main into a file that an open branch changes, and a commit on a branch without a rebase. | It runs from the rules clone deployed on our machines. |
| `skills/projekt-novy` | A skill with scripts that creates a web project with repos, clones, DNS and tasks in one run. | An example of a skill with our accounts and domains. |
| `skills/artefakty/SKILL.md` | A skill that describes the use of approved patterns of repeated work from the directory `artifacts/`. | The patterns are our working outputs, and `artifacts/` is not in the repo. |

Also not here are the scripts and tests that need a live task manager, agent mailboxes or the deployment in `/opt/agent-rules`
(for example `check.mjs`).

The files are cleaned: names were replaced by a role or a placeholder name (`<server>`, `<tailnet>`,
`<task manager user>`, `<project>`). Where the code needs a real value, there is a default (for example the user `tasker`)
and a comment saying that you should edit it. Test fixtures use role names or the names `Alfa`, `Beta`, `Gama`.

## Checks and tests

After cloning, turn on the repo hooks:

```
git config core.hooksPath .githooks
```

`pre-commit` and `pre-push` run `node lib/public_check.mjs` and `node lib/path_check.mjs`. The first goes through all files in
git and fails with code 1 when it finds the name of a person, agent, machine or account, or an address from the patterns in
`lib/public_check.txt` (the patterns are in base64, so the list does not give the names away). A line of the list starting
with the character `+` is an allowed link, which is how links to the project's public repos pass. `pre-push` also checks the
author name and the messages of the commits that go out.

`path_check.mjs` goes through all `*.md` files in the repo and fails with code 1 when a text mentions in backticks a path
(`bin/`, `lib/`, `hooks/`, `skills/`, `roles/`, `env/`, `global/`, `rozhodnutia/`, `artifacts/`, `runtime/`) that is not in
the repo and not in the table "What is not in the repo" (in `README.md` the section "Čo v repe nie je"). It prints the file,
the line and the path.

The tests need Node 22 or newer:

```
node --test 'hooks/*.test.mjs' 'lib/*.test.mjs'
node lib/public_check.mjs
node lib/path_check.mjs
```

The `*.test.mjs` hooks run in temporary directories and do not call a live Tasker or mailboxes. The file
`hooks/reply_guard.test.mjs` is not a test in the sense of `node:test`, it runs as a script and fails with code 1.

## Language

The first version is in Slovak, and this English version is a translation of it. The Slovak files are the source. When they
differ, the Slovak text wins.

## How to contribute

Send a pull request with a mechanism: how a rule is written, loaded, checked or fixed, with a test that fails on the mistake.
The operating rules of one specific operator (who may do what, what their bans are) do not belong here, everyone keeps those
in their own repo. Before a pull request run `node lib/public_check.mjs`, `node lib/path_check.mjs` and the tests.

## License

MIT, the file `LICENSE`.
