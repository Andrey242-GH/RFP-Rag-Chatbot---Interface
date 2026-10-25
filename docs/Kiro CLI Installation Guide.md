# Kiro CLI Installation Guide

## Overview

<Kiro CLI> is an AI-powered coding assistant that runs directly in your terminal. It can analyze codebases, generate code, run commands, create documentation, troubleshoot issues, and automate development workflows using natural language prompts. 【1-0a59e9】【2-bcfbcf】

This guide covers:

- Installing Kiro CLI on a local machine
- Installing Kiro CLI in GitHub Codespaces
- Authentication
- Configuration
- Common commands
- Best practices
- Troubleshooting

---

# Installing Kiro CLI on Your Local Machine

## Supported Platforms

<Kiro CLI> supports:

- Windows
- macOS
- Linux

The official installer automatically downloads and configures the appropriate version for your operating system. 【1-0a59e9】【3-62e41d】

---

## Prerequisites

Before installation, ensure you have:

- Internet access
- A supported operating system
- A Kiro account for authentication
- Sufficient disk space for installation and updates 【3-62e41d】

---

## Windows Installation

### Option 1: Windows Terminal

Open one of the following:

- Windows Terminal
- PowerShell
- Git Bash

Run:

```bash
curl -fsSL https://cli.kiro.dev/install | bash
```

Verify:

```bash
kiro-cli --version
```

Launch:

```bash
kiro-cli
```

---

### Option 2: Windows Subsystem for Linux (Recommended)

Install WSL:

```powershell
wsl --install
```

Open your Linux distribution and install Kiro:

```bash
curl -fsSL https://cli.kiro.dev/install | bash
```

Verify:

```bash
kiro-cli --version
```

Launch:

```bash
kiro-cli
```

This provides a Linux experience similar to GitHub Codespaces. 【1-0a59e9】【3-62e41d】

---

## macOS Installation

Open Terminal:

```bash
curl -fsSL https://cli.kiro.dev/install | bash
```

Verify:

```bash
kiro-cli --version
```

Launch:

```bash
kiro-cli
```

The installer downloads the required application and CLI components automatically. 【3-62e41d】【1-0a59e9】

---

## Linux Installation

Run:

```bash
curl -fsSL https://cli.kiro.dev/install | bash
```

Verify installation:

```bash
which kiro-cli
```

Check the version:

```bash
kiro-cli --version
```

Launch:

```bash
kiro-cli
```

【1-0a59e9】【3-62e41d】

---

## PATH Configuration

If the command is not found after installation:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Persist the change:

### Bash

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### Zsh

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

The Linux installer places the executable in:

```text
~/.local/bin
```

【3-62e41d】

---

# First-Time Authentication

Launch Kiro:

```bash
kiro-cli
```

The first time you run Kiro, it opens a browser-based authentication flow. Sign in with your Kiro account and return to the terminal. 【4-bf42ba】【2-bcfbcf】

---

# Installing Kiro CLI in GitHub Codespaces

## Create a Codespace

1. Open your repository on GitHub.
2. Click **Code**.
3. Select **Codespaces**.
4. Click **Create Codespace**.

Wait for the environment to finish loading.

---

## Install Kiro

Open the integrated terminal and run:

```bash
curl -fsSL https://cli.kiro.dev/install | bash
```

【1-0a59e9】【3-62e41d】

Verify:

```bash
kiro-cli --version
```

---

## Configure PATH

If needed:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Persist it:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

---

## Launch Kiro

Navigate to your repository:

```bash
cd /workspaces/<repository-name>
```

Start Kiro:

```bash
kiro-cli
```

Authenticate when prompted. 【2-bcfbcf】【4-bf42ba】

---

# Automatically Install Kiro in New Codespaces

Create or update:

```text
.devcontainer/devcontainer.json
```

Example:

```json
{
  "name": "Development Environment",
  "postCreateCommand": "curl -fsSL https://cli.kiro.dev/install | bash"
}
```

Every new Codespace will automatically install Kiro during setup. 【3-62e41d】【1-0a59e9】

---

# Basic Usage

Start Kiro:

```bash
kiro-cli
```

Examples:

```text
Explain the architecture of this project
```

```text
Generate unit tests for all services
```

```text
Review the codebase for security issues
```

```text
Generate project documentation
```

```text
Find all TODO comments
```

Kiro can read project files, generate code, execute commands, and propose modifications to your repository. 【2-bcfbcf】【1-0a59e9】

---

# Useful Commands

## Open the Guide Agent

```text
/guide
```

The guide agent explains Kiro features, configuration options, and workflows. 【2-bcfbcf】

Example:

```text
/guide
How do I connect external tools?
```

---

## Review Files

Reference files using:

```text
@filename
```

Examples:

```text
Review @package.json
```

```text
Explain @src/index.ts
```

【2-bcfbcf】

---

## Run Shell Commands

Use:

```text
!command
```

Examples:

```text
!npm test
```

```text
!npm run build
```

```text
!git status
```

【2-bcfbcf】

---

## Plan Before Making Changes

Switch to planning mode and ask:

```text
Refactor this application to TypeScript
```

Kiro will produce a plan before making modifications. 【2-bcfbcf】

---

# Development Workflow Example

Clone a repository:

```bash
git clone https://github.com/organization/project.git
cd project
```

Launch Kiro:

```bash
kiro-cli
```

Example tasks:

```text
Explain the architecture
```

```text
Generate missing documentation
```

```text
Create unit tests
```

```text
Identify performance issues
```

```text
Prepare release notes
```

---

# SharePoint Framework (SPFx) Examples

Useful prompts for SharePoint development:

```text
Explain the SPFx solution architecture
```

```text
Generate Jest tests for all web parts
```

```text
Find deprecated APIs
```

```text
Upgrade this solution to the latest SPFx version
```

```text
Generate technical documentation for this project
```

---

# Updating Kiro

To update Kiro to the latest version:

```bash
curl -fsSL https://cli.kiro.dev/install | bash
```

The installer downloads and installs the latest available release. 【3-62e41d】【1-0a59e9】

---

# Uninstalling Kiro

Find the installation:

```bash
which kiro-cli
```

Remove the executable:

```bash
rm -f ~/.local/bin/kiro-cli
```

Check for remaining Kiro files:

```bash
ls -la ~ | grep kiro
```

---

# Troubleshooting

## Command Not Found

```text
kiro-cli: command not found
```

Fix:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Verify:

```bash
which kiro-cli
```

---

## Authentication Problems

Log out:

```bash
kiro-cli logout
```

Restart:

```bash
kiro-cli
```

Authenticate again through the browser flow. 【4-bf42ba】【2-bcfbcf】

---

## Verify Available Disk Space

```bash
df -h
```

The installer requires sufficient storage during download and extraction. 【3-62e41d】

---

# Best Practices

- Create feature branches before making AI-generated changes.
- Review all generated code before committing.
- Use `/guide` to learn advanced capabilities.
- Run tests after code generation.
- Commit frequently.
- Use planning mode for large refactors.
- Keep documentation updated.

---

# Quick Reference

Install:

```bash
curl -fsSL https://cli.kiro.dev/install | bash
```

Add to PATH:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Launch:

```bash
kiro-cli
```

Open guide:

```text
/guide
```

Reference file:

```text
Review @src/app.ts
```

Run command:

```text
!npm test
```

---

# References

- <Kiro CLI> Homepage: https://kiro.dev/cli/ 【1-0a59e9】
- <Kiro CLI> Setup Documentation: https://kiro.dev/docs/cli/setup/ 【2-bcfbcf】
- <Kiro CLI> Installer: https://cli.kiro.dev/install 【3-62e41d】