const fetch = require("node-fetch");
const { GitLabAPIError } = require("./GitLabAPIError");
const { GitLabNotFoundError } = require("./GitLabNotFoundError");
const { GitLabAuthenticationError } = require("./GitLabAuthenticationError");
const { GitLabRateLimitError } = require("./GitLabRateLimitError");

class GitLabAPI {
  constructor(options) {
    if (!options.host) throw new Error("GitLab host is required.");
    if (!options.token) throw new Error("GitLab token is required.");

    this.host = options.host.startsWith("http")
      ? options.host
      : `https://${options.host}`;
    this.token = options.token;
    this.apiVersion = options.apiVersion || "v4";
    this.baseUrl = `${this.host}/api/${this.apiVersion}`;
    this.rateLimitRemaining = null;
    this.rateLimitReset = null;
  }

  async _request(method, endpoint, data = null, options = {}) {
    const url = `${this.baseUrl}/${endpoint}`;
    const fetchOptions = {
      method,
      headers: {
        "PRIVATE-TOKEN": this.token,
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    if (data) fetchOptions.body = JSON.stringify(data);

    try {
      const response = await fetch(url, fetchOptions);

      this.rateLimitRemaining = response.headers.get("RateLimit-Remaining");
      this.rateLimitReset = response.headers.get("RateLimit-Reset");

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          throw new GitLabAuthenticationError(
            `Authentication failed: ${errorText}`,
            response.status,
            errorText,
            url,
          );
        } else if (response.status === 404) {
          throw new GitLabNotFoundError(
            `Resource not found: ${errorText}`,
            response.status,
            errorText,
            url,
          );
        } else if (response.status === 429) {
          throw new GitLabRateLimitError(
            `Rate limit exceeded: ${errorText}`,
            response.status,
            errorText,
            url,
          );
        }
        throw new GitLabAPIError(
          `HTTP error ${response.status}: ${errorText}`,
          response.status,
          errorText,
          url,
        );
      }

      /* try {
        const json = await response.json();
        return { data: json, headers: response.headers };
      } catch (jsonError) {
        const text = await response.text();
        return { data: text, headers: response.headers };
      } */

      try {
        const json = await response.json();
        return { data: json, headers: response.headers };
      } catch (jsonError) {
        try {
          const text = await response.text();
          return { data: text, headers: response.headers };
        } catch (textError) {
          // Handle cases where there's no body (e.g., 204 No Content)
          return { data: null, headers: response.headers }; // Or return an empty object {} if preferred
        }
      }
    } catch (error) {
      console.error(`Request to ${url} failed:`, error);
      throw error;
    }
  }

  async _paginatedRequest(method, endpoint, data = null, options = {}) {
    let allItems = [];
    let currentPage = 1;
    const perPage = options.per_page || 100;
    let totalPages = null;
    let totalItems = null;
    let headers;

    // TODO: TBC
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const queryParams = new URLSearchParams(options.query);
        queryParams.set("page", currentPage.toString());
        queryParams.set("per_page", perPage.toString());

        const fullEndpoint =
          endpoint +
          (queryParams.toString()
            ? `${endpoint.includes("?") ? "&" : "?"}${queryParams.toString()}`
            : "");
        // TODO: TBC
        // eslint-disable-next-line no-await-in-loop
        const response = await this._request(
          method,
          fullEndpoint,
          data,
          options,
        );
        headers = response.headers;
        const responseData = response.data; // Extract the data property

        if (!Array.isArray(responseData)) {
          return responseData; // Handle non-array responses (errors, single objects)
        }

        allItems = allItems.concat(responseData); // Concatenate responseData

        const totalPagesHeader = headers?.get("X-Total-Pages");
        if (totalPagesHeader) {
          totalPages = parseInt(totalPagesHeader, 10);
        }

        const totalItemsHeader = headers?.get("X-Total");
        if (totalItemsHeader) {
          totalItems = parseInt(totalItemsHeader, 10);
        }

        if (responseData.length < perPage) {
          currentPage += 1;
          break; // No more pages based on response length
        }
        if (totalPages && currentPage >= totalPages) {
          currentPage += 1;
          break; // No more pages based on totalPages header
        }

        currentPage += 1;
      } catch (error) {
        console.error("Error fetching page:", error);
        throw error; // Re-throw the error to be handled by the caller
      }
    }

    return {
      items: allItems,
      currentPage: currentPage - 1,
      totalPages,
      totalItems,
      headers,
    };
  }

  projects = {
    all: (options = {}) =>
      this._paginatedRequest("GET", "projects", null, options),
    show: (projectId) => this._request("GET", `projects/${projectId}`),
    create: (data) => this._request("POST", "projects", data),
    update: (projectId, data) =>
      this._request("PUT", `projects/${projectId}`, data),
    remove: (projectId) => this._request("DELETE", `projects/${projectId}`),
    fork: (projectId, data) =>
      this._request("POST", `projects/${projectId}/fork`, data),
    search: (searchString, options = {}) =>
      this._paginatedRequest(
        "GET",
        `projects?search=${searchString}`,
        null,
        options,
      ),
  };

  repositories = {
    tree: (projectId, options = {}) =>
      this._paginatedRequest(
        "GET",
        `projects/${projectId}/repository/tree`,
        null,
        options,
      ),
    getFile: (projectId, filePath, ref = "main") =>
      this._request(
        "GET",
        `projects/${projectId}/repository/files/${encodeURIComponent(filePath)}/raw?ref=${ref}`,
      ),
    createFile: (projectId, filePath, data) =>
      this._request(
        "POST",
        `projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`,
        data,
      ),
    updateFile: (projectId, filePath, data) =>
      this._request(
        "PUT",
        `projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`,
        data,
      ),
    deleteFile: (projectId, filePath, data) =>
      this._request(
        "DELETE",
        `projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`,
        data,
      ),
    branches: {
      all: (projectId, options = {}) =>
        this._paginatedRequest(
          "GET",
          `projects/${projectId}/repository/branches`,
          null,
          options,
        ),
      show: (projectId, branchName) =>
        this._request(
          "GET",
          `projects/${projectId}/repository/branches/${encodeURIComponent(branchName)}`,
        ),
      create: (projectId, data) =>
        this._request(
          "POST",
          `projects/${projectId}/repository/branches`,
          data,
        ),
      delete: (projectId, branchName) =>
        this._request(
          "DELETE",
          `projects/${projectId}/repository/branches/${encodeURIComponent(branchName)}`,
        ),
    },
  };

  mergeRequests = {
    all: (projectId, options = {}) =>
      this._paginatedRequest(
        "GET",
        `projects/${projectId}/merge_requests`,
        null,
        options,
      ),
    show: (projectId, mergeRequestId) =>
      this._request(
        "GET",
        `projects/${projectId}/merge_requests/${mergeRequestId}`,
      ),
    create: (projectId, data) =>
      this._request("POST", `projects/${projectId}/merge_requests`, data),
    update: (projectId, mergeRequestId, data) =>
      this._request(
        "PUT",
        `projects/${projectId}/merge_requests/${mergeRequestId}`,
        data,
      ),
    accept: (projectId, mergeRequestId, options = {}) =>
      this._request(
        "PUT",
        `projects/${projectId}/merge_requests/${mergeRequestId}/merge`,
        null,
        options,
      ),
    cancel: (projectId, mergeRequestId) =>
      this._request(
        "PUT",
        `projects/${projectId}/merge_requests/${mergeRequestId}/cancel`,
      ),
  };

  users = {
    current: () => this._request("GET", "user"),
    byId: (userId) => this._request("GET", `users/${userId}`),
    all: (options = {}) =>
      this._paginatedRequest("GET", "users", null, options),
  };

  groups = {
    all: (options = {}) =>
      this._paginatedRequest("GET", "groups", null, options),
    show: (groupId) => this._request("GET", `groups/${groupId}`),
    create: (data) => this._request("POST", "groups", data),
    update: (groupId, data) => this._request("PUT", `groups/${groupId}`, data),
    delete: (groupId) => this._request("DELETE", `groups/${groupId}`),
    projects: (groupId, options = {}) =>
      this._paginatedRequest(
        "GET",
        `groups/${groupId}/projects`,
        null,
        options,
      ),
  };

  issues = {
    all: (projectId, options = {}) =>
      this._paginatedRequest(
        "GET",
        `projects/${projectId}/issues`,
        null,
        options,
      ),
    show: (projectId, issueIid) =>
      this._request("GET", `projects/${projectId}/issues/${issueIid}`),
    create: (projectId, data) =>
      this._request("POST", `projects/${projectId}/issues`, data),
    update: (projectId, issueIid, data) =>
      this._request("PUT", `projects/${projectId}/issues/${issueIid}`, data),
    delete: (projectId, issueIid) =>
      this._request("DELETE", `projects/${projectId}/issues/${issueIid}`),
    notes: {
      all: (projectId, issueIid, options = {}) =>
        this._paginatedRequest(
          "GET",
          `projects/${projectId}/issues/${issueIid}/notes`,
          null,
          options,
        ),
      create: (projectId, issueIid, data) =>
        this._request(
          "POST",
          `projects/${projectId}/issues/${issueIid}/notes`,
          data,
        ),
      update: (projectId, issueIid, noteId, data) =>
        this._request(
          "PUT",
          `projects/${projectId}/issues/${issueIid}/notes/${noteId}`,
          data,
        ),
      delete: (projectId, issueIid, noteId) =>
        this._request(
          "DELETE",
          `projects/${projectId}/issues/${issueIid}/notes/${noteId}`,
        ),
    },
  };

  pipelines = {
    all: (projectId, options = {}) =>
      this._paginatedRequest(
        "GET",
        `projects/${projectId}/pipelines`,
        null,
        options,
      ),
    show: (projectId, pipelineId) =>
      this._request("GET", `projects/${projectId}/pipelines/${pipelineId}`),
    create: (projectId, ref) =>
      this._request("POST", `projects/${projectId}/pipelines`, { ref }),
    retry: (projectId, pipelineId) =>
      this._request(
        "POST",
        `projects/${projectId}/pipelines/${pipelineId}/retry`,
      ),
    cancel: (projectId, pipelineId) =>
      this._request(
        "POST",
        `projects/${projectId}/pipelines/${pipelineId}/cancel`,
      ),
    jobs: (projectId, pipelineId, options = {}) =>
      this._paginatedRequest(
        "GET",
        `projects/${projectId}/pipelines/${pipelineId}/jobs`,
        null,
        options,
      ),
  };

  jobs = {
    show: (projectId, jobId) =>
      this._request("GET", `projects/${projectId}/jobs/${jobId}`),
    artifacts: (projectId, jobId) =>
      this._request("GET", `projects/${projectId}/jobs/${jobId}/artifacts`),
    trace: (projectId, jobId) =>
      this._request("GET", `projects/${projectId}/jobs/${jobId}/trace`),
    retry: (projectId, jobId) =>
      this._request("POST", `projects/${projectId}/jobs/${jobId}/retry`),
    cancel: (projectId, jobId) =>
      this._request("POST", `projects/${projectId}/jobs/${jobId}/cancel`),
  };

  commits = {
    show: (projectId, commitSha) =>
      this._request(
        "GET",
        `projects/${projectId}/repository/commits/${commitSha}`,
      ),
    commits: (projectId, options = {}) =>
      this._paginatedRequest(
        "GET",
        `projects/${projectId}/repository/commits`,
        null,
        options,
      ),
    diff: (projectId, commitSha) =>
      this._request(
        "GET",
        `projects/${projectId}/repository/commits/${commitSha}/diff`,
      ),
    comments: (projectId, commitSha) =>
      this._request(
        "GET",
        `projects/${projectId}/repository/commits/${commitSha}/comments`,
      ),
  };

  projectsVariables = {
    all: (projectId, options = {}) =>
      this._paginatedRequest(
        "GET",
        `projects/${projectId}/variables`,
        null,
        options,
      ),
    show: (projectId, key) =>
      this._request("GET", `projects/${projectId}/variables/${key}`),
    create: (projectId, data) =>
      this._request("POST", `projects/${projectId}/variables`, data),
    update: (projectId, key, data) =>
      this._request("PUT", `projects/${projectId}/variables/${key}`, data),
    remove: (projectId, key) =>
      this._request("DELETE", `projects/${projectId}/variables/${key}`),
  };

  deployments = {
    all: (projectId, options = {}) =>
      this._paginatedRequest(
        "GET",
        `projects/${projectId}/deployments`,
        null,
        options,
      ),
    show: (projectId, deploymentId) =>
      this._request("GET", `projects/${projectId}/deployments/${deploymentId}`),
    create: (projectId, data) =>
      this._request("POST", `projects/${projectId}/deployments`, data),
    update: (projectId, deploymentId, data) =>
      this._request(
        "PUT",
        `projects/${projectId}/deployments/${deploymentId}`,
        data,
      ),
    delete: (projectId, deploymentId) =>
      this._request(
        "DELETE",
        `projects/${projectId}/deployments/${deploymentId}`,
      ),
  };

  environments = {
    all: (projectId, options = {}) =>
      this._paginatedRequest(
        "GET",
        `projects/${projectId}/environments`,
        null,
        options,
      ),
    show: (projectId, environmentId) =>
      this._request(
        "GET",
        `projects/${projectId}/environments/${environmentId}`,
      ),
    create: (projectId, data) =>
      this._request("POST", `projects/${projectId}/environments`, data),
    update: (projectId, environmentId, data) =>
      this._request(
        "PUT",
        `projects/${projectId}/environments/${environmentId}`,
        data,
      ),
    delete: (projectId, environmentId) =>
      this._request(
        "DELETE",
        `projects/${projectId}/environments/${environmentId}`,
      ),
  };

  members = {
    all: (projectId, options = {}) =>
      this._paginatedRequest(
        "GET",
        `projects/${projectId}/members`,
        null,
        options,
      ),
    show: (projectId, userId) =>
      this._request("GET", `projects/${projectId}/members/${userId}`),
    create: (projectId, data) =>
      this._request("POST", `projects/${projectId}/members`, data),
    update: (projectId, userId, data) =>
      this._request("PUT", `projects/${projectId}/members/${userId}`, data),
    delete: (projectId, userId) =>
      this._request("DELETE", `projects/${projectId}/members/${userId}`),
  };

  groupsMembers = {
    all: (groupId, options = {}) =>
      this._paginatedRequest("GET", `groups/${groupId}/members`, null, options),
    show: (groupId, userId) =>
      this._request("GET", `groups/${groupId}/members/${userId}`),
    create: (groupId, data) =>
      this._request("POST", `groups/${groupId}/members`, data),
    update: (groupId, userId, data) =>
      this._request("PUT", `groups/${groupId}/members/${userId}`, data),
    delete: (groupId, userId) =>
      this._request("DELETE", `groups/${groupId}/members/${userId}`),
  };

  search = {
    projects: (query, options = {}) =>
      this._paginatedRequest(
        "GET",
        `search?scope=projects&search=${encodeURIComponent(query)}`,
        null,
        options,
      ),
    groups: (query, options = {}) =>
      this._paginatedRequest(
        "GET",
        `search?scope=groups&search=${encodeURIComponent(query)}`,
        null,
        options,
      ),
    users: (query, options = {}) =>
      this._paginatedRequest(
        "GET",
        `search?scope=users&search=${encodeURIComponent(query)}`,
        null,
        options,
      ),
  };
}

module.exports = GitLabAPI;
