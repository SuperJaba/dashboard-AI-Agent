---
name: find-skills
description: Discover and install agent skills via skills.sh and npx skills CLI when searching for specialized workflows, tools, or domain capabilities.
---

# Find Skills

Discover, verify, and install skills from the open agent skills ecosystem (`skills.sh`).

## When to Use

Trigger this skill when the user:
- Asks "find a skill for [topic]" or "is there a skill for [topic]"
- Asks how to accomplish a domain task (testing, design, devops) that benefits from community agent workflows
- Asks to extend agent capabilities or install community skills

## Skill Search & Installation Process

### Step 1: Query skills.sh Catalog
Check popular battle-tested skills at [skills.sh](https://skills.sh/) or search via CLI:

```bash
npx skills find "<query>"
```

### Step 2: Evaluate Skill Quality
Before recommending any skill, verify against these criteria:
- **Install count**: Prefer skills with >1,000 installs.
- **Maintainer reputation**: Prefer official organizations (`vercel-labs`, `anthropics`, `microsoft`).
- **Source repository**: Check GitHub repository activity and star count (>100 stars preferred).

### Step 3: Propose Recommendation
Format recommendation with:
1. Skill name and single-sentence purpose
2. Total installs and source repository
3. Direct installation command

Example:
> Found **`react-best-practices`** (Vercel Engineering, 185k+ installs).
> Run: `npx skills add vercel-labs/agent-skills@react-best-practices`

### Step 4: Installation
Upon user approval, install the skill:

```bash
# Project-level installation
npx skills add <owner/repo@skill> -y

# Global installation
npx skills add <owner/repo@skill> -g -y
```

### Step 5: Fallback when No Match Exists
If no quality match exists:
1. State that no matching community skill was found.
2. Offer to execute the task directly using native capabilities.
3. Suggest scaffolding a custom skill: `npx skills init <skill-name>`.
