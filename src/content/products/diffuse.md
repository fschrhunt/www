---
title: "Diffuse"
indexLabel: "diffuse"
date: "2026-07-23"
description: "A self-hosted pull-request reviewer in development. Diffuse investigates possible bugs, then checks the evidence before publishing findings."
status: "In development"
---

A second look at your pull requests.

A plausible bug report can take as much work to dismiss as a real bug takes to fix. Diffuse is a self-hosted GitHub reviewer I'm building around that problem. Finding something suspicious is the start of a review, not enough reason to leave a comment.

The review code pairs Codex and Claude Code. One investigates the changes and relevant repository code; the other checks its proposed findings independently. Each review uses a fixed commit, so the investigation and verification refer to the same version of the code.

A finding has to survive both the verifier and checks for its location, severity, confidence, and duplicates before it can reach GitHub. The investigations are read-only. The intended result is a review with evidence you can follow back to the code, while the decision to change or merge it stays with you.

The source is now public. V1 is still in development, including work on review quality and evaluation. You can read the implementation, deployment instructions, and current scope on GitHub.

[Explore Diffuse on GitHub](https://github.com/intuitums/diffuse)
