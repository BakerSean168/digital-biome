# Git Submodule Mount Point

This directory is reserved for the Obsidian vault Git Submodule.

## Setup

Add your Obsidian vault as a submodule:

```bash
# Replace with your Obsidian vault repository URL
git submodule add https://github.com/YOUR_USERNAME/YOUR_VAULT_REPO.git vault/z
```

## Alternative: Using SSH

```bash
git submodule add git@github.com:YOUR_USERNAME/YOUR_VAULT_REPO.git vault/z
```

## Structure

After adding the submodule, this directory will contain your Obsidian notes:

```
vault/z/
├── .obsidian/
├── notes/
│   ├── note-1.md
│   └── note-2.md
└── ...
```

## Netlify Deployment

The `netlify.toml` is configured to automatically initialize submodules during build:

```toml
[build]
  command = "git submodule update --init --recursive && pnpm build"
```

For private repositories, you need to:
1. Generate a Deploy Key in Netlify Dashboard
2. Add the Deploy Key to your vault repository's Deploy Keys (with read access)

## Note Format

Notes should have YAML frontmatter:

```yaml
---
title: Note Title
description: Brief description
tags:
  - type/resource
  - website/video
  - category/tech
url: https://example.com  # For bookmark notes
draft: false
---
```
