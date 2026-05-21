# ContextBridge — End to End Implementation Plan

**Project Type:** Node.js CLI Tool / NPM Package  
**Version:** 1.0.0  
**Goal:** A terminal tool that extracts development context from any IDE or AI coding agent, stores it in a structured file, and injects it into Git commit messages and PR descriptions so that testing agents like CodeRabbit can review code with full intent awareness.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [How It Works — Big Picture](#2-how-it-works--big-picture)
3. [Project Structure](#3-project-structure)
4. [Phase 1 — Project Setup](#4-phase-1--project-setup)
5. [Phase 2 — Detection Module](#5-phase-2--detection-module)
6. [Phase 3 — Extraction Module](#6-phase-3--extraction-module)
7. [Phase 4 — Context Store](#7-phase-4--context-store)
8. [Phase 5 — Commit Message Generator](#8-phase-5--commit-message-generator)
9. [Phase 6 — Git Hook Installer](#9-phase-6--git-hook-installer)
10. [Phase 7 — CLI Commands](#10-phase-7--cli-commands)
11. [Phase 8 — Testing](#11-phase-8--testing)
12. [Phase 9 — Publishing to NPM](#12-phase-9--publishing-to-npm)
13. [Tech Stack Summary](#13-tech-stack-summary)
14. [Environment Variables](#14-environment-variables)
15. [Known Constraints and Decisions](#15-known-constraints-and-decisions)

---

## 1. Problem Statement

When a developer builds a project using an AI coding agent (Cursor, Claude Code, Windsurf etc.), the intent behind every decision lives in the chat conversation between the developer and the agent. When a testing agent like CodeRabbit reviews the code on a Pull Request, it only sees the raw code — no intent, no context, no reason why things were built a certain way.

This causes two problems:
- Testing agents flag intentional decisions as bugs or security issues
- Testing agents miss bugs that only make sense when you understand what the feature was supposed to do

**ContextBridge solves this by being the missing layer between development and testing.** It extracts intent from wherever it lives, stores it in a structured file, and injects it into every commit message and PR description so the testing agent has full context before it reviews a single line of code.

---

## 2. How It Works — Big Picture

```
Developer works on project (any IDE, any AI agent)
              ↓
contextbridge init  →  detects tools, installs git hook, scans for docs
              ↓
Developer makes changes and runs: git commit
              ↓
Git hook fires automatically (before commit goes through)
              ↓
ContextBridge reads:
  - The code diff (what changed)
  - AI chat logs if available (Cursor, Claude Code, Windsurf)
  - PRD / SRD / implementation plan docs if present
  - Previous context store
              ↓
Sends everything to Claude API
              ↓
Claude generates a rich structured commit message
              ↓
Terminal shows message → developer approves or edits → commit goes through
              ↓
Developer opens Pull Request on GitHub
              ↓
PR description is auto-populated with full context
              ↓
CodeRabbit reads PR description + code diff together
              ↓
CodeRabbit reviews with full intent awareness
```

---

## 3. Project Structure

```
contextbridge/
├── package.json                  ← package config, scripts, dependencies
├── .env.example                  ← example environment variables
├── README.md                     ← installation and usage docs
│
├── bin/
│   └── contextbridge.js          ← entry point, maps CLI commands
│
├── src/
│   ├── commands/
│   │   ├── init.js               ← contextbridge init command
│   │   ├── status.js             ← contextbridge status command
│   │   └── context.js            ← contextbridge context command (view/edit store)
│   │
│   ├── modules/
│   │   ├── detect.js             ← detects tools (3-layer), docs, logs
│   │   ├── extract.js            ← extracts context from all sources
│   │   ├── store.js              ← reads and writes the .contextbridge file
│   │   ├── generate.js           ← calls Claude API to generate commit message
│   │   └── hook.js               ← installs and manages the git hook
│   │
│   └── utils/
│       ├── git.js                ← git helpers (get diff, get log, check repo)
│       ├── files.js              ← file system helpers (scan, read, check exists)
│       └── logger.js             ← terminal output formatting
│
└── tests/
    ├── fixtures/
    │   └── fake-project/
    │       ├── .claude/                     ← simulate Claude Code
    │       ├── .cursor/                     ← simulate Cursor
    │       ├── .windsurf/                   ← simulate Windsurf
    │       ├── .continue/                   ← simulate Continue.dev
    │       ├── aider.chat.history           ← simulate Aider
    │       ├── prd.md                       ← simulate PRD
    │       ├── srd.md                       ← simulate SRD
    │       ├── ARCHITECTURE.md              ← simulate arch doc
    │       ├── implementation-plan.md       ← simulate impl plan
    │       ├── TODO.md                      ← simulate task list
    │       ├── CHANGELOG.md                 ← simulate changelog
    │       ├── build.log                    ← simulate build log
    │       ├── error.log                    ← simulate error log
    │       └── src/
    ├── detect.test.js
    ├── extract.test.js
    ├── store.test.js
    └── generate.test.js
```

---

## 4. Phase 1 — Project Setup

**Goal:** Get a working Node.js project that can be run from the terminal.

### Tasks

- [ ] Create project folder: `mkdir contextbridge && cd contextbridge`
- [ ] Initialize NPM: `npm init -y`
- [ ] Update `package.json` with correct name, version, description, and bin entry
- [ ] Install dependencies:
  ```bash
  npm install commander chalk ora inquirer dotenv
  npm install --save-dev jest
  ```
- [ ] Create `bin/contextbridge.js` as the entry point
- [ ] Add shebang line at top of entry point: `#!/usr/bin/env node`
- [ ] Make entry point executable: `chmod +x bin/contextbridge.js`
- [ ] Test it runs: `node bin/contextbridge.js`

### package.json bin field

```json
{
  "name": "contextbridge",
  "version": "1.0.0",
  "bin": {
    "contextbridge": "./bin/contextbridge.js"
  }
}
```

### Dependencies Explained

| Package | Purpose |
|---|---|
| commander | Parses CLI commands and flags |
| chalk | Colors terminal output |
| ora | Spinning loader in terminal |
| inquirer | Interactive prompts in terminal |
| dotenv | Loads API keys from .env file |
| jest | Testing framework |

---

## 5. Phase 2 — Detection Module

**File:** `src/modules/detect.js`  
**Goal:** Automatically detect which IDE, AI coding tools, and project documents the developer is using. Detection works in three layers so the tool never completely fails — it always finds *something* useful regardless of what the developer is using.

---

### Three-Layer Detection Strategy

```
Layer 1 — Known tool signatures
  Scan for folders and files left by specific known tools.
  If found → read logs directly from known paths.

Layer 2 — Generic log scan
  If no known tool is found, scan for any chat history files
  in the project root and home directory (.history, .chat, aider files etc).
  Catches unknown or future tools automatically.

Layer 3 — Git only fallback
  If no logs found at all, fall back to git diff + commit history.
  This always works. Every project has git.
```

---

### Layer 1 — Known AI Coding Tools

| Tool | Detection Signal | Log Location |
|---|---|---|
| Claude Code | `.claude/` folder in home or project | `~/.claude/logs/` |
| Cursor | `.cursor/` folder in home or project | `~/.cursor/logs/` |
| Windsurf / Codeium | `.windsurf/` or `.codeium/` folder | `~/.windsurf/` or `~/.codeium/` |
| GitHub Copilot | `.vscode/extensions/` contains `github.copilot` | VS Code extension logs |
| Gemini Code Assist | `.gemini/` folder in home or project | `~/.gemini/` |
| Continue.dev | `.continue/` folder in project | `.continue/logs/` |
| Tabnine | `.tabnine/` folder in home | `~/.tabnine/` |
| Aider | `aider.chat.history` file in project root | Read file directly |
| VS Code (no AI) | `.vscode/` folder exists, no AI extension | No logs — git only |
| Raw coding | None of the above | Git only |

---

### Layer 2 — Generic Log Scan

If no known tool is detected, scan for these generic patterns:

```
.chat.history
.ai.history
.agent.log
chat_history.json
conversation.json
*.chat.md
Any file in .logs/ or logs/ matching chat/conversation patterns
```

---

### Layer 3 — Git Fallback

Always available regardless of tool. Used as the baseline when nothing else is found:

```
git diff --staged        ← what changed right now
git log --oneline -10    ← recent history
```

---

### Custom Log Path (Manual Override)

If auto-detection misses a developer's tool, they can specify the log path manually in `.contextbridge`:

```json
{
  "customLogPath": "./path/to/my/agent/logs"
}
```

The tool checks for this before running auto-detection and uses it if present.

---

### Detection Report Object

```json
{
  "tools": ["claude-code", "cursor"],
  "detectionLayer": 1,
  "docs": {
    "prd": "./prd.md",
    "srd": null,
    "implementationPlan": "./implementation-plan.md",
    "architecture": "./ARCHITECTURE.md",
    "changelog": "./CHANGELOG.md",
    "tasks": "./TODO.md",
    "readme": "./README.md",
    "docsFolder": "./docs/",
    "buildLog": "./build.log",
    "errorLog": "./error.log",
    "testResults": "./test-results/"
  },
  "logPaths": {
    "claude-code": "C:/Users/name/.claude/logs/",
    "cursor": "C:/Users/name/.cursor/logs/"
  },
  "customLogPath": null
}
```

---

### Terminal Output on Detection

```
Scanning your environment...

✓ Detected AI tools:  Claude Code, Cursor  (Layer 1)
✓ Found PRD:          ./prd.md
✓ Found Arch doc:     ./ARCHITECTURE.md
✓ Found Build log:    ./build.log
✓ Git repository found

Detection complete.
```

If only fallback is available:

```
Scanning your environment...

  No AI tool logs found. Falling back to git history.  (Layer 3)
✓ Found PRD:          ./prd.md
✓ Git repository found

Detection complete. Context will be built from docs and git history.
```

---

## 6. Phase 3 — Extraction Module

**File:** `src/modules/extract.js`  
**Goal:** Pull raw context from all available sources and return it as structured text ready to be processed by the generator.

---

### Extraction Priority Order

Higher priority sources are always included first. Lower priority sources fill in the gaps.

```
Priority 1 — Planning docs          ← product intent, deliberately written
  prd.md, srd.md, brief.md, SPEC.md

Priority 2 — Architecture docs      ← technical decisions and design
  ARCHITECTURE.md, DESIGN.md, ADR/, decisions/

Priority 3 — Implementation plan    ← how it was decided to build it
  implementation-plan.md, IMPLEMENTATION.md

Priority 4 — AI chat logs           ← raw intent from development conversation
  Claude Code, Cursor, Windsurf, Aider, Continue, Copilot, Gemini, custom path

Priority 5 — Build and error logs   ← what was broken, what was fixed
  build.log, error.log, .build/, logs/

Priority 6 — Task and change docs   ← recent work history
  TODO.md, TASKS.md, CHANGELOG.md, CHANGES.md

Priority 7 — Test results           ← what passed and what failed
  test-results/, coverage/, jest-results.json

Priority 8 — Git log history        ← commit history over time
  git log --oneline -10

Priority 9 — Current diff           ← what is changing right now
  git diff --staged
```

---

### What to Extract From Each Source

**Planning docs (PRD, SRD, spec, brief)**
- Read full file content
- Tag clearly so Claude knows the document type
- Always include in full — these are the highest value context

**Architecture docs**
- Read full file content
- Include ADR (Architecture Decision Records) files if present in `decisions/` or `ADR/` folder
- These explain *why* technical choices were made

**AI chat logs**
- Extract only developer (human) messages — not AI responses
- Strip code blocks to reduce noise and token count
- Limit to last 50 developer messages to avoid token overflow
- Works for: Claude Code, Cursor, Windsurf, Aider (`aider.chat.history`), Continue.dev, custom log path

**Build logs**
- Read last 100 lines of `build.log` or equivalent
- Focus on errors and warnings — skip successful build lines
- This tells Claude what was recently broken and fixed

**Error logs**
- Read last 50 lines of `error.log` or `logs/error*`
- Gives context on what problems the current code change may be addressing

**Task files**
- Read full content of `TODO.md`, `TASKS.md`, `tasks/`
- Shows what the developer was working toward

**Changelog**
- Read last 20 entries from `CHANGELOG.md` or `CHANGES.md`
- Shows what was shipped recently

**Test results**
- Check if test results file exists and if tests passed or failed
- If tests failed, include which tests failed and why

**Git log**
- Run `git log --oneline -10`
- Gives Claude the recent build history

**Git diff**
- Run `git diff --staged`
- Always present at commit time — this is what is being committed

---

### Extracted Context Object

```json
{
  "docs": {
    "prd": "...full prd content...",
    "srd": null,
    "architecture": "...arch doc content...",
    "implementationPlan": "...full plan content...",
    "tasks": "...todo list...",
    "changelog": "...recent changes..."
  },
  "logs": {
    "build": "...last 100 lines of build log...",
    "error": "...last 50 lines of error log...",
    "testResults": "...test pass/fail summary..."
  },
  "chatLogs": {
    "detectionLayer": 1,
    "tool": "claude-code",
    "messages": "...recent developer prompts..."
  },
  "git": {
    "diff": "...staged diff...",
    "recentLog": "abc1234 add login\ndef5678 fix auth..."
  }
}
```

---

## 7. Phase 4 — Context Store

**File:** `src/modules/store.js`  
**Storage file:** `.contextbridge` at project root (committed to git)

**Goal:** Maintain a growing structured record of project context that builds up over time as the developer works.

### Structure of .contextbridge File

```json
{
  "project": {
    "name": "MyApp",
    "description": "A task management tool for remote teams",
    "createdAt": "2025-01-15T10:00:00Z",
    "lastUpdated": "2025-01-20T14:30:00Z"
  },
  "detectedTools": ["claude-code", "cursor"],
  "detectionLayer": 1,
  "customLogPath": null,
  "docs": {
    "prd": "./prd.md",
    "srd": null,
    "architecture": "./ARCHITECTURE.md",
    "implementationPlan": "./implementation-plan.md",
    "tasks": "./TODO.md",
    "changelog": "./CHANGELOG.md",
    "readme": "./README.md",
    "docsFolder": "./docs/",
    "buildLog": "./build.log",
    "errorLog": "./error.log",
    "testResults": "./test-results/"
  },
  "featureLog": [
    {
      "commitHash": "abc1234",
      "timestamp": "2025-01-18T09:00:00Z",
      "summary": "Added OTP verification to login flow",
      "intent": "Users were getting locked out due to silent password reset failures",
      "filesChanged": ["src/auth/login.js", "api/verify-otp.js"],
      "intentionalDecisions": [
        "OTP is 6 digits numeric only to reduce mobile input errors",
        "Expiry set to 5 minutes per client security brief"
      ],
      "contextSources": ["prd", "claude-code-logs", "git-diff"]
    }
  ],
  "docChanges": [
    {
      "timestamp": "2025-01-19T11:00:00Z",
      "file": "prd.md",
      "note": "PRD updated — new payment section added"
    }
  ]
}
```

### Store Operations

- `store.read()` — reads and parses the .contextbridge file
- `store.write(data)` — writes updated data back to file
- `store.addFeatureEntry(entry)` — appends a new feature log entry
- `store.getRecentEntries(n)` — returns last n feature log entries
- `store.flagDocChange(file)` — records that a doc file was modified

---

## 8. Phase 5 — Commit Message Generator

**File:** `src/modules/generate.js`  
**Goal:** Call Claude API with all extracted context and generate a rich structured commit message.

### What Gets Sent to Claude API

```
System prompt:
  You are a commit message generator. You have full context about a software project.
  Generate a structured, detailed Git commit message based on the code diff and all
  context provided. The message will be read by an AI code reviewer (CodeRabbit) so
  make intent and decisions explicit. Format the message clearly with sections for:
  summary, why this was built, what changed, intentional decisions, and known tradeoffs.

User message:
  [PRD CONTENT]
  ...prd text...

  [SRD CONTENT]
  ...srd text if present...

  [ARCHITECTURE]
  ...architecture doc if present...

  [IMPLEMENTATION PLAN]
  ...plan text if present...

  [RECENT DEVELOPER PROMPTS - via claude-code / cursor / aider / etc]
  ...chat log excerpts...

  [BUILD LOG - last 100 lines]
  ...recent build output, errors highlighted...

  [ERROR LOG - last 50 lines]
  ...recent errors if present...

  [TEST RESULTS]
  ...pass/fail summary if present...

  [TASK LIST]
  ...todo/tasks content if present...

  [RECENT GIT HISTORY]
  ...last 10 commits...

  [CURRENT DIFF]
  ...staged diff...

  Generate a commit message for the current diff given all of this context.
  Note which context sources were available at the bottom of the message.
```

### Output Format

```
feat: [one line summary of what changed]

WHY THIS WAS BUILT
[1-3 sentences explaining the business or product reason]

WHAT CHANGED
- [file or component]: [what it does now]
- [file or component]: [what it does now]

INTENTIONAL DECISIONS
- [decision]: [reason it was made this way]
- [decision]: [reason it was made this way]

KNOWN TRADEOFFS
- [tradeoff if any]

CONTEXT REF
PRD: [yes/no] | Arch: [yes/no] | Impl Plan: [yes/no] | AI Logs: [tool/none] | Build Log: [yes/no] | Tests: [pass/fail/none]
```

### Terminal Flow at Commit Time

```
⠋ Reading your changes...
⠋ Extracting context from Claude Code logs...
⠋ Generating commit message...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

feat: add OTP verification to login flow

WHY THIS WAS BUILT
Users were getting locked out due to password resets failing
silently. OTP adds a fallback verification layer.

WHAT CHANGED
- src/auth/login.js: added OTP input component
- api/verify-otp.js: new endpoint handles validation
- src/session.js: token now only issues after OTP confirmation

INTENTIONAL DECISIONS
- 6 digit numeric only to reduce mobile input errors
- 5 minute expiry per client security requirements

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use this message? (Y/e/n)
  Y = yes, use it
  e = edit before committing
  n = skip, write my own
```

---

## 9. Phase 6 — Git Hook Installer

**File:** `src/modules/hook.js`  
**Goal:** Install a `prepare-commit-msg` Git hook into the project that fires every time the developer runs `git commit`.

### How Git Hooks Work

Git has a folder `.git/hooks/` inside every repository. If a file named `prepare-commit-msg` exists there and is executable, Git runs it automatically before completing a commit. This is the intercept point.

### Hook File Content

The hook file installed at `.git/hooks/prepare-commit-msg`:

```bash
#!/bin/sh
# Installed by ContextBridge
# Runs contextbridge commit generator before every commit

node "$(npm root -g)/contextbridge/bin/contextbridge.js" hook "$1"
```

### Hook Installer Tasks

- [ ] Check if `.git/` folder exists in project (confirm it is a git repo)
- [ ] Write the hook script to `.git/hooks/prepare-commit-msg`
- [ ] Make the hook file executable: `chmod +x .git/hooks/prepare-commit-msg`
- [ ] Verify it was installed correctly
- [ ] Handle case where a hook already exists — ask developer before overwriting

---

## 10. Phase 7 — CLI Commands

**File:** `bin/contextbridge.js` and `src/commands/`

### Commands

**`contextbridge init`**

Runs on first setup in a project. Does everything needed to get started.

Steps:
1. Check it is a git repository
2. Run detection module — find tools and docs
3. Show detection results to developer
4. Ask for project name and description (two quick questions)
5. Create `.contextbridge` config file
6. Install git hook
7. Show success message and next steps

```
$ contextbridge init

  ContextBridge Setup
  ━━━━━━━━━━━━━━━━━━

  Scanning your environment...

  ✓ Claude Code detected
  ✓ PRD found: ./prd.md
  ✓ Implementation plan found: ./implementation-plan.md
  ✓ Git repository found

  ? What is this project called? › MyApp
  ? One sentence — what does it do? › Task management tool for remote teams

  ✓ Config saved to .contextbridge
  ✓ Git hook installed

  You're all set. Every commit will now generate rich context automatically.
  Run: git add . && git commit -m "test" to try it.
```

---

**`contextbridge status`**

Shows the current state of ContextBridge in the project.

```
$ contextbridge status

  ContextBridge Status
  ━━━━━━━━━━━━━━━━━━━━

  Project:         MyApp
  Git hook:        ✓ installed
  Detected tools:  Claude Code, Cursor
  Docs tracked:    prd.md, implementation-plan.md
  Features logged: 12 commits with context
  Last updated:    2 hours ago
```

---

**`contextbridge context`**

Shows the full current context store in readable format. Useful for debugging or reviewing what context is saved.

```
$ contextbridge context

  Project Context
  ━━━━━━━━━━━━━━━

  MyApp — Task management tool for remote teams

  Recent feature log:
  • [2 days ago] feat: add OTP verification to login
  • [4 days ago] feat: dashboard filters by assignee
  • [1 week ago] feat: initial auth setup

  Docs:
  • prd.md (last read: 2 days ago)
  • implementation-plan.md (last read: 2 days ago)
```

---

**`contextbridge hook` (internal)**

This command is called by the git hook automatically. Developers do not run this manually. It receives the commit message file path from git, runs the full extraction and generation pipeline, and writes the generated message back to the commit message file.

---

## 11. Phase 8 — Testing

### Manual Testing Checklist

Run these manually during development to verify everything works:

- [ ] `contextbridge init` runs without errors
- [ ] Detection Layer 1: correctly identifies Claude Code folder
- [ ] Detection Layer 1: correctly identifies Cursor folder
- [ ] Detection Layer 1: correctly identifies Windsurf / Codeium folder
- [ ] Detection Layer 1: correctly identifies Aider history file
- [ ] Detection Layer 1: correctly identifies Continue.dev folder
- [ ] Detection Layer 1: correctly identifies Copilot via VS Code extension
- [ ] Detection Layer 2: finds generic chat history file when no known tool present
- [ ] Detection Layer 3: falls back to git only when nothing else found
- [ ] Detection finds prd.md, srd.md, ARCHITECTURE.md, TODO.md, CHANGELOG.md
- [ ] Detection finds build.log and error.log when present
- [ ] Detection finds test results when present
- [ ] Custom log path in config is used when set
- [ ] Config file is created at project root after init
- [ ] Git hook file exists at `.git/hooks/prepare-commit-msg` after init
- [ ] Git hook file is executable
- [ ] `git commit` triggers the hook
- [ ] Commit message includes all available context sources
- [ ] CONTEXT REF line correctly shows which sources were used
- [ ] Approving with Y completes the commit
- [ ] `contextbridge status` shows correct information
- [ ] Tool handles missing .git folder gracefully with clear error
- [ ] Tool handles missing Anthropic API key gracefully with clear error

### Automated Tests with Jest

**detect.test.js**
- detects claude code when .claude folder exists
- detects cursor when .cursor folder exists
- detects windsurf when .windsurf folder exists
- detects aider when aider.chat.history file exists
- detects continue.dev when .continue folder exists
- falls back to Layer 2 when no known tool found but generic log exists
- falls back to Layer 3 (git only) when nothing found
- finds prd.md in project root
- finds srd.md in project root
- finds ARCHITECTURE.md in project root
- finds implementation-plan.md in project root
- finds TODO.md and CHANGELOG.md
- finds build.log and error.log
- finds test-results/ folder
- uses customLogPath from config when set
- returns correct detectionLayer value in report

**store.test.js**
- creates new store correctly with all doc fields
- reads existing store
- adds feature entry with contextSources field
- returns correct recent entries
- handles missing store file gracefully

**extract.test.js**
- reads prd content from file
- reads architecture doc content
- reads build log last 100 lines
- reads error log last 50 lines
- extracts developer messages from mock claude code log
- extracts developer messages from mock aider history file
- returns null gracefully for missing log paths
- git diff is captured correctly
- uses customLogPath when set in config

**generate.test.js**
- builds correct prompt including all available context sources
- omits sections cleanly when docs are missing
- handles missing chat logs gracefully
- handles missing build log gracefully
- parses Claude API response correctly
- CONTEXT REF line reflects which sources were actually used

Run all tests:
```bash
npm test
```

---

## 12. Phase 9 — Publishing to NPM

### Before Publishing Checklist

- [ ] All tests pass
- [ ] README.md is complete with install and usage instructions
- [ ] `.env.example` is included, `.env` is in `.gitignore`
- [ ] `.contextbridge` is in `.gitignore` for the contextbridge repo itself
- [ ] Version in `package.json` is correct
- [ ] `files` field in `package.json` includes only necessary files

### Publishing Steps

```bash
npm login
npm publish
```

### After Publishing

Developer installs with:
```bash
npm install -g contextbridge
```

Then in any project:
```bash
contextbridge init
```

---

## 13. Tech Stack Summary

| Layer | Technology | Reason |
|---|---|---|
| Language | Node.js | Runs on developer machine, great file system access |
| CLI framework | Commander.js | Standard for Node CLI tools |
| Terminal UI | Chalk + Ora + Inquirer | Colors, spinners, interactive prompts |
| AI generation | Anthropic Claude API | Generates commit messages from context |
| Testing | Jest | Standard Node testing framework |
| Distribution | NPM | Universal package manager for Node tools |
| Git integration | Native git hooks | No dependency, works in every git repo |

---

## 14. Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...              ← required, for generating commit messages
CONTEXTBRIDGE_MODEL=claude-sonnet-4-6    ← optional, defaults to sonnet 4.6
CONTEXTBRIDGE_DEBUG=false                ← optional, shows extra logs when true
```

Developers add their API key once:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Or add it to their shell profile (`~/.zshrc` or `~/.bashrc`) so it persists.

---

## 15. Known Constraints and Decisions

**Why Git hooks and not IDE plugins**
IDE plugins would need to be built separately for each IDE. Git hooks work universally across every IDE, every language, every project. One implementation covers all cases.

**Why prepare-commit-msg hook and not post-commit**
`prepare-commit-msg` fires before the commit is finalized and can modify the commit message. `post-commit` fires after — too late to change the message.

**Why three-layer detection instead of hardcoding known tools**
Hardcoding only known tools means the tool breaks whenever a developer uses a new or uncommon AI agent. The three-layer approach — known tools first, generic log scan second, git fallback third — means the tool always produces *something* useful regardless of what the developer is using. New tools get caught at Layer 2 automatically without any code changes.

**Why build logs and error logs are included in context**
Testing agents reviewing a bug fix have no way to know what the error actually was — they only see the fixed code. Including the recent error log in the commit context tells CodeRabbit exactly what was broken and why the fix was written the way it was. This prevents false positives on unconventional fixes.

**Why the context store is committed to git**
Keeping `.contextbridge` in version control means every team member has access to the full project context history. It also means the context grows alongside the codebase and is available in CI/CD environments without any extra setup.

**Why CodeRabbit PR description is the injection point**
CodeRabbit explicitly reads and incorporates the PR description into its review. This is documented behavior. It is the cleanest injection point that requires no API access or special integration — just a well structured PR description.

**Why Claude API for generation and not a local model**
Quality of commit message matters — a poor message means poor context injection. Claude produces the best structured output for this use case. Local model support can be added in a future version.

**Why NPM global install and not a per-project dependency**
A per-project dependency would require each project to install it. Global install means one installation works across all projects on the developer's machine. The git hook references the global install path.

---

*Document version: 1.1 — Expanded agent detection (3-layer), expanded doc/log scanning, model string updated to claude-sonnet-4-6*
