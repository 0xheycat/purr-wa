```markdown
# purr-wa Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the `purr-wa` JavaScript repository. You'll learn about file naming, import/export styles, commit message conventions, and how to write and organize tests. While no specific frameworks or automated workflows are detected, this guide provides best practices and helpful commands for working efficiently in this codebase.

## Coding Conventions

### File Naming
- **Style:** PascalCase
- **Example:**  
  ```plaintext
  MyComponent.js
  UtilsHelper.js
  ```

### Import Style
- **Relative imports** are used throughout the codebase.
- **Example:**
  ```javascript
  import { fetchData } from './DataFetcher';
  ```

### Export Style
- **Named exports** are preferred.
- **Example:**
  ```javascript
  // In DataFetcher.js
  export function fetchData() { ... }
  ```

### Commit Messages
- **Conventional commit format** is used.
- **Prefixes:** `fix`, `build`
- **Example:**
  ```
  fix: resolve issue with data parsing in fetchData
  build: update dependencies for security patches
  ```

## Workflows

_No automated workflows detected in this repository. All workflows are manual and follow the coding and commit conventions described above._

## Testing Patterns

- **Test framework:** Unknown (not specified in the repository)
- **Test file naming pattern:** Files include `.test.` in their name.
  - **Example:**  
    ```plaintext
    DataFetcher.test.js
    ```
- **Test files are likely colocated with the modules they test.**

## Commands
| Command         | Purpose                                      |
|-----------------|----------------------------------------------|
| /commit-fix     | Start a commit for bug fixes (use `fix:`)    |
| /commit-build   | Start a commit for build changes (use `build:`) |
| /run-tests      | Run all test files matching `*.test.*`        |
| /new-module     | Create a new PascalCase module with named export |
```