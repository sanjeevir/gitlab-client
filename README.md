# @sungv/gitlab-node-client

## Overview

`@sungv/gitlab-node-client` provides a convenient interface to interact with the GitLab API from Node.js. It allows you to manage projects, issues, merge requests, users, groups, and more.

## Features

- Compatible with both Node.js and browser environments.
- Supports ES modules and CommonJS.
- Includes full development setup with linting, testing, and building.
- Automated CI/CD pipeline using GitLab CI and GitHub Actions.
- Prettier and ESLint for consistent code style.

## Badges

[![GitHub Actions Status](https://github.com/sanjeevir/gitlab-node-client/actions/workflows/ci.yml/badge.svg)](https://github.com/sanjeevir/gitlab-node-client/actions)
[![npm version](https://img.shields.io/npm/v/@sungv/gitlab-node-client.svg)](https://www.npmjs.com/package/@sungv/gitlab-node-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```sh
npm install @sungv/gitlab-node-client
```

## Usage

### Basic Example

```javascript
const GitLabAPI = require("@sungv/gitlab-node-client");

const gitlab = new GitLabAPI({
  host: "https://gitlab.example.com",
  token: "YOUR_PERSONAL_ACCESS_TOKEN",
});

// Get all projects (paginated)
(async () => {
  try {
    const projects = await gitlab.projects.all({ per_page: 5 });
    console.log("Projects:", projects.items);
  } catch (error) {
    console.error("Error:", error.message);
  }
})();
```

## Available APIs:

The following table lists all currently available API categories and methods within them. You can find the detailed documentation for the GitLab API at https://docs.gitlab.com/ee/api/rest/.

| Category              | Method                                          | Signature       | Description                                        | Example Usage                                                                                                                             |
| --------------------- | ----------------------------------------------- | --------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Projects**          | all(options = {})                               | Promise<object> | List all projects (paginated).                     | `gitlab.projects.all({ query: { simple: true } })`                                                                                        |
|                       | show(projectId)                                 | Promise<object> | Get a specific project.                            | `gitlab.projects.show(123)`                                                                                                               |
|                       | create(data)                                    | Promise<object> | Create a new project.                              | `gitlab.projects.create({ name: 'My Project' })`                                                                                          |
|                       | update(projectId, data)                         | Promise<object> | Update a project.                                  | `gitlab.projects.update(123, { description: 'Updated description' })`                                                                     |
|                       | remove(projectId)                               | Promise<object> | Remove a project.                                  | `gitlab.projects.remove(123)`                                                                                                             |
|                       | fork(projectId, data)                           | Promise<object> | Fork a project.                                    | `gitlab.projects.fork(123, { namespace_id: 456 })`                                                                                        |
|                       | search(searchString, options)                   | Promise<object> | Search for projects (paginated).                   | `gitlab.projects.search("my project", { per_page: 20 })`                                                                                  |
| **Repositories**      | tree(projectId, options)                        | Promise<object> | List repository files and directories (paginated). | `gitlab.repositories.tree(123, { path: 'src', ref: 'main' })`                                                                             |
|                       | getFile(projectId, path, ref)                   | Promise<string> | Get the raw content of a file.                     | `gitlab.repositories.getFile(123, 'README.md', 'main')`                                                                                   |
|                       | createFile(projectId, path, data)               | Promise<object> | Create a file.                                     | `gitlab.repositories.createFile(123, 'new_file.txt', { branch: 'main', content: 'file content', commit_message: 'create new file' })`     |
|                       | updateFile(projectId, path, data)               | Promise<object> | Update a file.                                     | `gitlab.repositories.updateFile(123, 'new_file.txt', { branch: 'main', content: 'updated file content', commit_message: 'update file' })` |
|                       | deleteFile(projectId, path, data)               | Promise<object> | Delete a file.                                     | `gitlab.repositories.deleteFile(123, 'new_file.txt', { branch: 'main', commit_message: 'delete file' })`                                  |
|                       | branches.all(projectId, options)                | Promise<object> | List project branches (paginated).                 | `gitlab.repositories.branches.all(123)`                                                                                                   |
|                       | branches.show(projectId, branchName)            | Promise<object> | Get a specific branch.                             | `gitlab.repositories.branches.show(123, 'main')`                                                                                          |
|                       | branches.create(projectId, data)                | Promise<object> | Create a branch                                    | `gitlab.repositories.branches.create(123, {branch: 'new-branch', ref: 'main'})`                                                           |
|                       | branches.delete(projectId, branchName)          | Promise<object> | Delete a branch                                    | `gitlab.repositories.branches.delete(123, 'new-branch')`                                                                                  |
| **Merge Requests**    | all(projectId, options)                         | Promise<object> | List project merge requests (paginated).           | `gitlab.mergeRequests.all(123, { state: 'opened' })`                                                                                      |
|                       | show(projectId, mergeRequestId)                 | Promise<object> | Get a specific merge request.                      | `gitlab.mergeRequests.show(123, 456)`                                                                                                     |
|                       | create(projectId, data)                         | Promise<object> | Create a new merge request.                        | `gitlab.mergeRequests.create(123, { source_branch: 'feature', target_branch: 'main', title: 'My MR' })`                                   |
|                       | update(projectId, mergeRequestId, data)         | Promise<object> | Update a merge request.                            | `gitlab.mergeRequests.update(123, 456, { description: 'Updated MR description' })`                                                        |
|                       | accept(projectId, mergeRequestId, options)      | Promise<object> | Accept a merge request.                            | `gitlab.mergeRequests.accept(123, 456)`                                                                                                   |
|                       | cancel(projectId, mergeRequestId)               | Promise<object> | Cancel a merge request.                            | `gitlab.mergeRequests.cancel(123, 456)`                                                                                                   |
| **Users**             | all(options = {})                               | Promise<object> | List all users (paginated).                        | `gitlab.users.all()`                                                                                                                      |
|                       | show(userId)                                    | Promise<object> | Get a specific user.                               | `gitlab.users.show(123)`                                                                                                                  |
|                       | current()                                       | Promise<object> | Get the current authenticated user.                | `gitlab.users.current()`                                                                                                                  |
| **Groups**            | all(options = {})                               | Promise<object> | List all groups (paginated).                       | `gitlab.groups.all()`                                                                                                                     |
|                       | show(groupId)                                   | Promise<object> | Get a specific group.                              | `gitlab.groups.show(123)`                                                                                                                 |
|                       | create(data)                                    | Promise<object> | Create a new group.                                | `gitlab.groups.create({ name: 'My Group', path: 'my-group' })`                                                                            |
|                       | update(groupId, data)                           | Promise<object> | Update a group.                                    | `gitlab.groups.update(123, { description: 'Updated group description' })`                                                                 |
|                       | delete(groupId)                                 | Promise<object> | Delete a group.                                    | `gitlab.groups.delete(123)`                                                                                                               |
|                       | projects(groupId, options)                      | Promise<object> | List group projects (paginated).                   | `gitlab.groups.projects(123)`                                                                                                             |
| **Issues**            | all(projectId, options = {})                    | Promise<object> | List project issues (paginated).                   | `gitlab.issues.all(123, { state: 'opened' })`                                                                                             |
|                       | show(projectId, issueIid)                       | Promise<object> | Get a specific issue.                              | `gitlab.issues.show(123, 456)`                                                                                                            |
|                       | create(projectId, data)                         | Promise<object> | Create a new issue.                                | `gitlab.issues.create(123, { title: 'My Issue' })`                                                                                        |
|                       | update(projectId, issueIid, data)               | Promise<object> | Update an issue.                                   | `gitlab.issues.update(123, 456, { description: 'Updated description' })`                                                                  |
|                       | delete(projectId, issueIid)                     | Promise<object> | Delete an issue.                                   | `gitlab.issues.delete(123, 456)`                                                                                                          |
|                       | notes.all(projectId, issueIid, options)         | Promise<object> | List issue notes (paginated).                      | `gitlab.issues.notes.all(123, 456)`                                                                                                       |
|                       | notes.create(projectId, issueIid, data)         | Promise<object> | Create an issue note.                              | `gitlab.issues.notes.create(123, 456, { body: 'My comment' })`                                                                            |
|                       | notes.update(projectId, issueIid, noteId, data) | Promise<object> | Update an issue note.                              | `gitlab.issues.notes.update(123, 456, 789, { body: 'Updated comment' })`                                                                  |
|                       | notes.delete(projectId, issueIid, noteId)       | Promise<object> | Delete an issue note.                              | `gitlab.issues.notes.delete(123, 456, 789)`                                                                                               |
| **Pipelines**         | all(projectId, options = {})                    | Promise<object> | List project pipelines (paginated).                | `gitlab.pipelines.all(123)`                                                                                                               |
|                       | show(projectId, pipelineId)                     | Promise<object> | Get a specific pipeline.                           | `gitlab.pipelines.show(123, 456)`                                                                                                         |
|                       | create(projectId, ref)                          | Promise<object> | Create a new pipeline.                             | `gitlab.pipelines.create(123, 'main')`                                                                                                    |
|                       | retry(projectId, pipelineId)                    | Promise<object> | Retry a pipeline.                                  | `gitlab.pipelines.retry(123, 456)`                                                                                                        |
|                       | cancel(projectId, pipelineId)                   | Promise<object> | Cancel a pipeline.                                 | `gitlab.pipelines.cancel(123, 456)`                                                                                                       |
|                       | jobs(projectId, pipelineId, options)            | Promise<object> | List pipeline jobs (paginated).                    | `gitlab.pipelines.jobs(123, 456)`                                                                                                         |
| **Jobs**              | show(projectId, jobId)                          | Promise<object> | Get a specific job.                                | `gitlab.jobs.show(123, 456)`                                                                                                              |
|                       | artifacts(projectId, jobId)                     | Promise<string> | Get job artifacts.                                 | `gitlab.jobs.artifacts(123, 456)`                                                                                                         |
|                       | trace(projectId, jobId)                         | Promise<string> | Get job trace.                                     | `gitlab.jobs.trace(123, 456)`                                                                                                             |
|                       | retry(projectId, jobId)                         | Promise<object> | Retry a job.                                       | `gitlab.jobs.retry(123, 456)`                                                                                                             |
|                       | cancel(projectId, jobId)                        | Promise<object> | Cancel a job.                                      | `gitlab.jobs.cancel(123, 456)`                                                                                                            |
| **Commits**           | show(projectId, commitSha)                      | Promise<object> | Get a specific commit.                             | `gitlab.commits.show(123, 'abcdef123456')`                                                                                                |
|                       | commits(projectId, options = {})                | Promise<object> | List project commits (paginated).                  | `gitlab.commits.commits(123)`                                                                                                             |
|                       | diff(projectId, commitSha)                      | Promise<string> | Get commit diff.                                   | `gitlab.commits.diff(123, 'abcdef123456')`                                                                                                |
|                       | comments(projectId, commitSha)                  | Promise<object> | Get commit comments.                               | `gitlab.commits.comments(123, 'abcdef123456')`                                                                                            |
| **Project Variables** | all(projectId, options = {})                    | Promise<object> | List project variables (paginated).                | `gitlab.projectsVariables.all(123)`                                                                                                       |
|                       | show(projectId, key)                            | Promise<object> | Get a specific project variable.                   | `gitlab.projectsVariables.show(123, 'MY_VARIABLE')`                                                                                       |
|                       | create(projectId, data)                         | Promise<object> | Create a new project variable.                     | `gitlab.projectsVariables.create(123, { key: 'NEW_VARIABLE', value: 'my value' })`                                                        |
|                       | update(projectId, key, data)                    | Promise<object> | Update a project variable.                         | `gitlab.projectsVariables.update(123, 'MY_VARIABLE', { value: 'updated value' })`                                                         |
|                       | remove(projectId, key)                          | Promise<object> | Remove a project variable.                         | `gitlab.projectsVariables.remove(123, 'MY_VARIABLE')`                                                                                     |
| **Deployments**       | all(projectId, options = {})                    | Promise<object> | List project deployments (paginated).              | `gitlab.deployments.all(123)`                                                                                                             |
|                       | show(projectId, deploymentId)                   | Promise<object> | Get a specific deployment.                         | `gitlab.deployments.show(123, 456)`                                                                                                       |
|                       | create(projectId, data)                         | Promise<object> | Create a new deployment.                           | `gitlab.deployments.create(123, { environment: 'production', tag: 'v1.0.0' })`                                                            |
|                       | update(projectId, deploymentId, data)           | Promise<object> | Update a deployment.                               | `gitlab.deployments.update(123, 456, { status: 'success' })`                                                                              |
|                       | delete(projectId, deploymentId)                 | Promise<object> | Delete a deployment.                               | `gitlab.deployments.delete(123, 456)`                                                                                                     |
| **Environments**      | all(projectId, options = {})                    | Promise<object> | List project environments (paginated).             | `gitlab.environments.all(123)`                                                                                                            |
|                       | show(projectId, environmentId)                  | Promise<object> | Get a specific environment.                        | `gitlab.environments.show(123, 456)`                                                                                                      |
|                       | create(projectId, data)                         | Promise<object> | Create a new environment.                          | `gitlab.environments.create(123, { name: 'staging' })`                                                                                    |
|                       | update(projectId, environmentId, data)          | Promise<object> | Update an environment.                             | `gitlab.environments.update(123, 456, { name: 'production' })`                                                                            |
|                       | delete(projectId, environmentId)                | Promise<object> | Delete an environment.                             | `gitlab.environments.delete(123, 456)`                                                                                                    |
| **Members**           | all(projectId, options = {})                    | Promise<object> | List project members (paginated).                  | `gitlab.members.all(123)`                                                                                                                 |
|                       | show(projectId, userId)                         | Promise<object> | Get a specific project member.                     | `gitlab.members.show(123, 456)`                                                                                                           |
|                       | create(projectId, data)                         | Promise<object> | Add a new project member.                          | `gitlab.members.create(123, { user_id: 456, access_level: 30 })`                                                                          |
|                       | update(projectId, userId, data)                 | Promise<object> | Update a project member.                           | `gitlab.members.update(123, 456, { access_level: 40 })`                                                                                   |
|                       | delete(projectId, userId)                       | Promise<object> | Remove a project member.                           | `gitlab.members.delete(123, 456)`                                                                                                         |
| **Groups Members**    | all(groupId, options = {})                      | Promise<object> | List group members (paginated).                    | `gitlab.groupsMembers.all(123)`                                                                                                           |
|                       | show(groupId, userId)                           | Promise<object> | Get a specific group member.                       | `gitlab.groupsMembers.show(123, 456)`                                                                                                     |
|                       | create(groupId, data)                           | Promise<object> | Add a new group member.                            | `gitlab.groupsMembers.create(123, { user_id: 456, access_level: 30 })`                                                                    |
|                       | update(groupId, userId, data)                   | Promise<object> | Update a group member.                             | `gitlab.groupsMembers.update(123, 456, { access_level: 40 })`                                                                             |
|                       | delete(groupId, userId)                         | Promise<object> | Remove a group member.                             | `gitlab.groupsMembers.delete(123, 456)`                                                                                                   |
| **Search**            | projects(query, options = {})                   | Promise<object> | Search for projects (paginated).                   | `gitlab.search.projects("my project", { per_page: 20, query: { order_by: "name", sort: "asc" } })`                                        |
|                       | groups(query, options = {})                     | Promise<object> | Search for groups (paginated).                     | `gitlab.search.groups("my group", { per_page: 20 })`                                                                                      |
|                       | users(query, options = {})                      | Promise<object> | Search for users (paginated).                      | `gitlab.search.users("john", { per_page: 20, query: { active: true } })`                                                                  |

### Features

#### Pagination:

Most API methods that retrieve collections (e.g., projects, issues) support pagination. You can control the page size using the per_page option in the request options object. The response object will include information about the total pages, total items, and the current page.

#### Rate Limiting:

The GitLab API enforces rate limits to prevent abuse. This module captures the remaining rate limit and reset time from the response headers and stores them in the rateLimitRemaining and rateLimitReset properties of the GitLabAPI instance. You can use this information to implement your own retry mechanism for handling rate limit errors.

#### Error Handling:

The module uses custom error classes (GitLabAPIError, GitLabNotFoundError, GitLabAuthenticationError, GitLabRateLimitError) to provide more context about API errors. These errors include the HTTP status code, response body, and the URL of the request that failed.

## Development

### Setup

1. Clone the repository:

   ```sh
   git clone https://gitlab.com/your-repo/gitlab-node-client.git
   cd gitlab-node-client
   ```

2. Install dependencies:
   ```sh
   npm install
   ```

### Scripts

- **Build:** `npm run build`
- **Test:** `npm run test`
- **Lint:** `npm run lint`
- **Format:** `npm run format`
- **Prepare (Husky hooks):** `npm run prepare`

### Code Style Guide

This project enforces consistent code style using Prettier and ESLint:

- Prettier handles code formatting.
- ESLint ensures adherence to the Airbnb base style guide.

Run formatting with:

```sh
npm run format
```

### Generate Documentation

This project uses [TypeDoc](https://typedoc.org/) for generating documentation.

Generate documentation with:

```sh
npm run typedoc
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request with your changes.

### Issue Templates

Include the following types:

- **Bug Reports**: Template for submitting bug reports.
- **Feature Requests**: Template for suggesting new features.

## License

This project is licensed under the MIT License.

## Changelog

### [1.0.0] - YYYY-MM-DD

#### Added

- Initial release with basic functionality.
- Prettier and ESLint setup.
- CI/CD pipeline using GitLab CI and GitHub Actions.
- Tree-shaking and optimized build.
- Issue templates and badges.
