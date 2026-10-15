# Saju Service Starter

**English** · [한국어](README.ko.md)

A starter project for practicing a real product development process together with an AI agent.

## Run

```sh
npm install
npm run dev
```

Open the address shown in the terminal in your browser.

## Key documents

- `docs/PRD.md`: what to build and why.
- `docs/specs/`: how each feature should behave.
- `docs/status.md`: how far the work has progressed.
- `AGENTS.md`: the basic principles the agent follows while working.
- `tests/`: automated checks.

## Folder structure

```text
├── app/                 Screens and pages
├── lib/saju/            Saju calculation logic
├── docs/
│   ├── PRD.md           Product goals and scope
│   ├── status.md        Progress for each spec
│   └── specs/           Requirements for each feature
├── tests/               Automated tests
├── .agents/skills/      Skills for repeated tasks
└── AGENTS.md            Agent working principles
```

This project combines AGENTS.md, the PRD, specs, tests, status tracking, skills and the working environment into a harness that lets the agent work reliably.

## Workflow

1. Run the service and check the current features yourself.
2. Talk with the agent to write the target users, the problem to solve and the product scope in `docs/PRD.md`.
3. Pick one feature to build and write its spec as `docs/specs/001-feature-name.md`.
4. Add that spec to `docs/status.md` as `- [ ]`.
5. Implement against the spec, then check the result with tests and on the actual screen.
6. Once implementation and checks are both done, change the item in `docs/status.md` to `- [x]`.
7. Repeat the same steps for the next feature, then deploy to Vercel and check again at the deployed address.

Do not build several features at once. Finish one spec at a time.

The documents in `docs/` are written in Korean.
