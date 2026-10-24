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
