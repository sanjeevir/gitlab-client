jest.mock("node-fetch");

const fetch = require("node-fetch");
const GitLabAPI = require("../src/index");

describe("GitLabAPI", () => {
  const mockHost = "https://gitlab.example.com";
  const mockToken = "test_token";
  let gitlab;

  beforeEach(() => {
    gitlab = new GitLabAPI({ host: mockHost, token: mockToken });
    fetch.mockClear(); // Clear mocks before each test
  });

  it("should throw error if host or token is missing", () => {
    expect(() => new GitLabAPI({ token: mockToken })).toThrow(
      "GitLab host is required.",
    );
    expect(() => new GitLabAPI({ host: mockHost })).toThrow(
      "GitLab token is required.",
    );
  });

  it("should construct base URL correctly", () => {
    expect(gitlab.baseUrl).toBe("https://gitlab.example.com/api/v4");
  });

  describe("_request", () => {
    it("should make a GET request with correct headers", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: "test" }),
        headers: new Map(),
      });
      await gitlab._request("GET", "projects");
      expect(fetch).toHaveBeenCalledWith(
        "https://gitlab.example.com/api/v4/projects",
        {
          method: "GET",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should make a POST request with correct headers and data", async () => {
      const mockData = { name: "test project" };
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: "test" }),
        headers: new Map(),
      });
      await gitlab._request("POST", "projects", mockData);
      expect(fetch).toHaveBeenCalledWith(
        "https://gitlab.example.com/api/v4/projects",
        {
          method: "POST",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockData),
        },
      );
    });
    it("should return raw text if response is not json", async () => {
      fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("some text"),
        headers: new Map(),
      });
      const result = await gitlab._request("GET", "projects");
      expect(result.data).toBe("some text"); // Access data from the returned object
    });
    it("should throw GitLabAPIError on non-ok response", async () => {
      fetch.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          text: () => Promise.resolve("Bad Request"),
          headers: new Map(),
        }),
      );
      await expect(gitlab._request("GET", "projects")).rejects.toThrowError(
        expect.objectContaining({
          message: "HTTP error 400: Bad Request",
          statusCode: 400,
        }),
      );
    });
    it("should throw GitLabNotFoundError on 404", async () => {
      fetch.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          text: () => Promise.resolve("Not Found"),
          headers: new Map(),
        }),
      );
      await expect(gitlab._request("GET", "projects")).rejects.toThrowError(
        expect.objectContaining({
          message: "Resource not found: Not Found",
          statusCode: 404,
        }),
      );
    });

    it("should throw GitLabAuthenticationError on 401", async () => {
      fetch.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          text: () => Promise.resolve("Unauthorized"),
          headers: new Map(),
        }),
      );
      await expect(gitlab._request("GET", "projects")).rejects.toThrowError(
        expect.objectContaining({
          message: "Authentication failed: Unauthorized",
          statusCode: 401,
        }),
      );
    });

    it("should throw GitLabRateLimitError on 429", async () => {
      fetch.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          text: () => Promise.resolve("Too Many Requests"),
          headers: new Map(),
        }),
      );
      await expect(gitlab._request("GET", "projects")).rejects.toThrowError(
        expect.objectContaining({
          message: "Rate limit exceeded: Too Many Requests",
          statusCode: 429,
        }),
      );
    });
    it("should set rate limit headers", async () => {
      const mockHeaders = new Map([
        ["RateLimit-Remaining", "40"],
        ["RateLimit-Reset", "1678886400"],
      ]);
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: "test" }),
        headers: mockHeaders,
      });
      await gitlab._request("GET", "projects");
      expect(gitlab.rateLimitRemaining).toBe("40");
      expect(gitlab.rateLimitReset).toBe("1678886400");
    });
  });

  describe("_paginatedRequest", () => {
    it("should handle paginated responses", async () => {
      const mockOptions = { per_page: 2, query: {} };

      fetch
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=1");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
            headers: new Map([["X-Total-Pages", "2"]]), // Mock X-Total-Pages
          });
        })
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=2");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 3 }]),
            headers: new Map(),
          });
        });

      const result = await gitlab._paginatedRequest(
        "GET",
        "projects",
        null,
        mockOptions,
      );
      expect(result.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(result.currentPage).toBe(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should handle non-paginated responses", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1 }),
        headers: new Map(),
      });
      const result = await gitlab._paginatedRequest("GET", "projects");
      expect(result).toEqual({ id: 1 });
    });
    it("should set total pages and items if headers are present", async () => {
      const mockHeaders = new Map([
        ["X-Total-Pages", "2"],
        ["X-Total", "3"],
      ]);
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
        headers: mockHeaders,
      });
      const result = await gitlab._paginatedRequest("GET", "projects");
      expect(result.totalPages).toBe(2);
      expect(result.totalItems).toBe(3);
    });
  });

  describe("projects", () => {
    /* it('should validate projectId in show method', async () => {
      await expect(gitlab.projects.show('not a number')).rejects.toThrow('projectId must be a number.');
      expect(fetch).not.toHaveBeenCalled();
    }); */
    it("should show a project", async () => {
      fetch.mockResolvedValue(
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 1 }),
          headers: new Map(),
        }),
      );
      await gitlab.projects.show(1);
      expect(fetch).toHaveBeenCalledWith(`${mockHost}/api/v4/projects/1`, {
        method: "GET",
        headers: {
          "PRIVATE-TOKEN": mockToken,
          "Content-Type": "application/json",
        },
      });
    });

    it("should get all projects (paginated)", async () => {
      const mockOptions = { per_page: 2, query: {} };

      fetch
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=1");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
            headers: new Map([["X-Total-Pages", "2"]]),
          });
        })
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=2");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 3 }]),
            headers: new Map(),
          });
        });

      const result = await gitlab.projects.all(mockOptions);
      expect(result.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(result.currentPage).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should create a project", async () => {
      const mockProjectData = { name: "Test Project" };
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 4 }),
        headers: new Map(),
      });
      await gitlab.projects.create(mockProjectData);
      expect(fetch).toHaveBeenCalledWith(`${mockHost}/api/v4/projects`, {
        method: "POST",
        headers: {
          "PRIVATE-TOKEN": mockToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mockProjectData),
      });
    });

    it("should delete a project", async () => {
      const projectIdToDelete = 5;
      fetch.mockResolvedValue({ ok: true, headers: new Map() });
      await gitlab.projects.remove(projectIdToDelete);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectIdToDelete}`,
        {
          method: "DELETE",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should update a project", async () => {
      const projectIdToUpdate = 6;
      const mockProjectUpdateData = { description: "Updated description" };
      fetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: projectIdToUpdate,
            description: "Updated description",
          }),
        headers: new Map(),
      });
      await gitlab.projects.update(projectIdToUpdate, mockProjectUpdateData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectIdToUpdate}`,
        {
          method: "PUT",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockProjectUpdateData),
        },
      );
    });

    it("should fork a project", async () => {
      const projectIdToFork = 7;
      const mockForkData = { namespace_id: 10 }; // Example fork data
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 8 }),
        headers: new Map(),
      });
      await gitlab.projects.fork(projectIdToFork, mockForkData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectIdToFork}/fork`,
        {
          method: "POST",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockForkData),
        },
      );
    });
  });

  describe("repositories", () => {
    const projectId = 2626;
    const filePath = "path/to/file.txt";
    const branchName = "feature/new-branch";
    const mockFileData = "File content";
    const mockBranchData = { name: branchName };
    const mockCreateFileData = {
      branch: "main",
      content: "New file content",
      commit_message: "Create new file",
    };
    const mockUpdateFileData = {
      branch: "main",
      content: "Updated file content",
      commit_message: "Update file",
    };
    const mockDeleteFileData = {
      branch: "main",
      commit_message: "Delete file",
    };

    it("should get repository tree (paginated)", async () => {
      const mockOptions = { per_page: 2, query: {} };

      fetch
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=1");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
            headers: new Map([["X-Total-Pages", "2"]]),
          });
        })
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=2");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 3 }]),
            headers: new Map(),
          });
        });

      const result = await gitlab.repositories.tree(projectId, mockOptions);
      expect(result.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(result.currentPage).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should get a file", async () => {
      fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockFileData),
        headers: new Map(),
      });

      const result = await gitlab.repositories.getFile(projectId, filePath);
      expect(result.data).toEqual(mockFileData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}/raw?ref=main`,
        {
          method: "GET",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should create a file", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ file_path: filePath }),
        headers: new Map(),
      });
      await gitlab.repositories.createFile(
        projectId,
        filePath,
        mockCreateFileData,
      );
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`,
        {
          method: "POST",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockCreateFileData),
        },
      );
    });

    it("should update a file", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ file_path: filePath }),
        headers: new Map(),
      });
      await gitlab.repositories.updateFile(
        projectId,
        filePath,
        mockUpdateFileData,
      );
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`,
        {
          method: "PUT",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockUpdateFileData),
        },
      );
    });

    it("should delete a file", async () => {
      fetch.mockResolvedValue({ ok: true, status: 204, headers: new Map() });
      const result = await gitlab.repositories.deleteFile(
        projectId,
        filePath,
        mockDeleteFileData,
      );
      expect(result.data).toBeNull();
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`,
        {
          method: "DELETE",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockDeleteFileData),
        },
      );
    });

    describe("branches", () => {
      it("should get all branches (paginated)", async () => {
        const mockOptions = { per_page: 2, query: {} };

        fetch
          .mockImplementationOnce(async (url) => {
            expect(url).toContain("page=1");
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([{ name: "branch1" }, { name: "branch2" }]),
              headers: new Map([["X-Total-Pages", "2"]]),
            });
          })
          .mockImplementationOnce(async (url) => {
            expect(url).toContain("page=2");
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve([{ name: "branch3" }]),
              headers: new Map(),
            });
          });

        const result = await gitlab.repositories.branches.all(
          projectId,
          mockOptions,
        );
        expect(result.items).toEqual([
          { name: "branch1" },
          { name: "branch2" },
          { name: "branch3" },
        ]);
        expect(result.currentPage).toBe(2);
        expect(result.totalPages).toBe(2);
        expect(fetch).toHaveBeenCalledTimes(2);
      });

      it("should get a specific branch", async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockBranchData),
          headers: new Map(),
        });

        const result = await gitlab.repositories.branches.show(
          projectId,
          branchName,
        );
        expect(result.data).toEqual(mockBranchData);
        expect(fetch).toHaveBeenCalledWith(
          `${mockHost}/api/v4/projects/${projectId}/repository/branches/${encodeURIComponent(branchName)}`,
          {
            method: "GET",
            headers: {
              "PRIVATE-TOKEN": mockToken,
              "Content-Type": "application/json",
            },
          },
        );
      });

      it("should create a branch", async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockBranchData),
          headers: new Map(),
        });
        await gitlab.repositories.branches.create(projectId, mockBranchData);
        expect(fetch).toHaveBeenCalledWith(
          `${mockHost}/api/v4/projects/${projectId}/repository/branches`,
          {
            method: "POST",
            headers: {
              "PRIVATE-TOKEN": mockToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(mockBranchData),
          },
        );
      });

      it("should delete a branch", async () => {
        fetch.mockResolvedValue({ ok: true, status: 204, headers: new Map() });
        const result = await gitlab.repositories.branches.delete(
          projectId,
          branchName,
        );
        expect(result.data).toBeNull();
        expect(fetch).toHaveBeenCalledWith(
          `${mockHost}/api/v4/projects/${projectId}/repository/branches/${encodeURIComponent(branchName)}`,
          {
            method: "DELETE",
            headers: {
              "PRIVATE-TOKEN": mockToken,
              "Content-Type": "application/json",
            },
          },
        );
      });
    });
  });
  describe("mergeRequests", () => {
    const projectId = 1818;
    const mergeRequestId = 1919;
    const mockMergeRequestData = {
      iid: mergeRequestId,
      title: "Test Merge Request",
    };
    const mockUpdatedMergeRequestData = { description: "Updated description" };

    it("should get all merge requests (paginated)", async () => {
      const mockOptions = { per_page: 2, query: {} };

      fetch
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=1");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
            headers: new Map([["X-Total-Pages", "2"]]),
          });
        })
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=2");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 3 }]),
            headers: new Map(),
          });
        });

      const result = await gitlab.mergeRequests.all(projectId, mockOptions);
      expect(result.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(result.currentPage).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should get a specific merge request", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMergeRequestData),
        headers: new Map(),
      });

      const result = await gitlab.mergeRequests.show(projectId, mergeRequestId);
      expect(result.data).toEqual(mockMergeRequestData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/merge_requests/${mergeRequestId}`,
        {
          method: "GET",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should create a merge request", async () => {
      const mockCreateData = {
        source_branch: "feature",
        target_branch: "main",
        title: "New MR",
      };
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ iid: 2020 }),
        headers: new Map(),
      });
      await gitlab.mergeRequests.create(projectId, mockCreateData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/merge_requests`,
        {
          method: "POST",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockCreateData),
        },
      );
    });

    it("should update a merge request", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUpdatedMergeRequestData),
        headers: new Map(),
      });
      await gitlab.mergeRequests.update(
        projectId,
        mergeRequestId,
        mockUpdatedMergeRequestData,
      );
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/merge_requests/${mergeRequestId}`,
        {
          method: "PUT",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockUpdatedMergeRequestData),
        },
      );
    });

    it("should accept a merge request", async () => {
      const mockAcceptOptions = { merge_when_pipeline_succeeds: true };
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ state: "merged" }),
        headers: new Map(),
      });
      await gitlab.mergeRequests.accept(
        projectId,
        mergeRequestId,
        mockAcceptOptions,
      );
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/merge_requests/${mergeRequestId}/merge`,
        {
          method: "PUT",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          ...mockAcceptOptions,
        },
      );
    });

    it("should cancel a merge request", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ state: "canceled" }),
        headers: new Map(),
      });
      await gitlab.mergeRequests.cancel(projectId, mergeRequestId);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/merge_requests/${mergeRequestId}/cancel`,
        {
          method: "PUT",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });
  });

  describe("users", () => {
    it("should get the current user", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 456, username: "currentuser" }),
        headers: new Map(),
      });

      const result = await gitlab.users.current();
      expect(result.data).toEqual({ id: 456, username: "currentuser" });
      expect(fetch).toHaveBeenCalledWith(`${mockHost}/api/v4/user`, {
        method: "GET",
        headers: {
          "PRIVATE-TOKEN": mockToken,
          "Content-Type": "application/json",
        },
      });
    });

    it("should get a user by ID", async () => {
      const userId = 123;
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: userId, username: "testuser" }),
        headers: new Map(),
      });

      const result = await gitlab.users.byId(userId);
      expect(result.data).toEqual({ id: userId, username: "testuser" });
      expect(fetch).toHaveBeenCalledWith(`${mockHost}/api/v4/users/${userId}`, {
        method: "GET",
        headers: {
          "PRIVATE-TOKEN": mockToken,
          "Content-Type": "application/json",
        },
      });
    });

    it("should get all users (paginated)", async () => {
      const mockOptions = { per_page: 2, query: {} };

      fetch
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=1");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
            headers: new Map([["X-Total-Pages", "2"]]),
          });
        })
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=2");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 3 }]),
            headers: new Map(),
          });
        });

      const result = await gitlab.users.all(mockOptions);
      expect(result.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(result.currentPage).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("groups", () => {
    const groupId = 2020;
    const mockGroupData = { id: groupId, name: "Test Group" };
    const mockUpdatedGroupData = { description: "Updated description" };

    it("should get all groups (paginated)", async () => {
      const mockOptions = { per_page: 2, query: {} };

      fetch
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=1");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
            headers: new Map([["X-Total-Pages", "2"]]),
          });
        })
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=2");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 3 }]),
            headers: new Map(),
          });
        });

      const result = await gitlab.groups.all(mockOptions);
      expect(result.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(result.currentPage).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should get a specific group", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGroupData),
        headers: new Map(),
      });

      const result = await gitlab.groups.show(groupId);
      expect(result.data).toEqual(mockGroupData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/groups/${groupId}`,
        {
          method: "GET",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should create a group", async () => {
      const mockCreateData = { name: "New Group", path: "new-group" }; // Include required 'path'
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 2121 }),
        headers: new Map(),
      });
      await gitlab.groups.create(mockCreateData);
      expect(fetch).toHaveBeenCalledWith(`${mockHost}/api/v4/groups`, {
        method: "POST",
        headers: {
          "PRIVATE-TOKEN": mockToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mockCreateData),
      });
    });

    it("should update a group", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUpdatedGroupData),
        headers: new Map(),
      });
      await gitlab.groups.update(groupId, mockUpdatedGroupData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/groups/${groupId}`,
        {
          method: "PUT",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockUpdatedGroupData),
        },
      );
    });

    it("should delete a group", async () => {
      fetch.mockResolvedValue({ ok: true, status: 204, headers: new Map() });
      const result = await gitlab.groups.delete(groupId);
      expect(result.data).toBeNull();
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/groups/${groupId}`,
        {
          method: "DELETE",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should get group projects (paginated)", async () => {
      const mockOptions = { per_page: 2, query: {} };

      fetch
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=1");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
            headers: new Map([["X-Total-Pages", "2"]]),
          });
        })
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=2");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 3 }]),
            headers: new Map(),
          });
        });

      const result = await gitlab.groups.projects(groupId, mockOptions);
      expect(result.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(result.currentPage).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("issues", () => {
    const projectId = 2222;
    const issueIid = 2323;
    const noteId = 2424;
    const mockIssueData = { iid: issueIid, title: "Test Issue" };
    const mockUpdatedIssueData = { description: "Updated description" };
    const mockNoteData = { body: "Test note" };
    const mockUpdatedNoteData = { body: "Updated note" };

    it("should get all issues (paginated)", async () => {
      const mockOptions = { per_page: 2, query: {} };

      fetch
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=1");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
            headers: new Map([["X-Total-Pages", "2"]]),
          });
        })
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=2");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 3 }]),
            headers: new Map(),
          });
        });

      const result = await gitlab.issues.all(projectId, mockOptions);
      expect(result.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(result.currentPage).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should get a specific issue", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockIssueData),
        headers: new Map(),
      });

      const result = await gitlab.issues.show(projectId, issueIid);
      expect(result.data).toEqual(mockIssueData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/issues/${issueIid}`,
        {
          method: "GET",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should create an issue", async () => {
      const mockCreateData = { title: "New Issue" };
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ iid: 2525 }),
        headers: new Map(),
      });
      await gitlab.issues.create(projectId, mockCreateData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/issues`,
        {
          method: "POST",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockCreateData),
        },
      );
    });

    it("should update an issue", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUpdatedIssueData),
        headers: new Map(),
      });
      await gitlab.issues.update(projectId, issueIid, mockUpdatedIssueData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/issues/${issueIid}`,
        {
          method: "PUT",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockUpdatedIssueData),
        },
      );
    });

    it("should delete an issue", async () => {
      fetch.mockResolvedValue({ ok: true, status: 204, headers: new Map() });
      const result = await gitlab.issues.delete(projectId, issueIid);
      expect(result.data).toBeNull();
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/issues/${issueIid}`,
        {
          method: "DELETE",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    describe("notes", () => {
      it("should get all issue notes (paginated)", async () => {
        const mockOptions = { per_page: 2, query: {} };

        fetch
          .mockImplementationOnce(async (url) => {
            expect(url).toContain("page=1");
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
              headers: new Map([["X-Total-Pages", "2"]]),
            });
          })
          .mockImplementationOnce(async (url) => {
            expect(url).toContain("page=2");
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve([{ id: 3 }]),
              headers: new Map(),
            });
          });

        const result = await gitlab.issues.notes.all(
          projectId,
          issueIid,
          mockOptions,
        );
        expect(result.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
        expect(result.currentPage).toBe(2);
        expect(result.totalPages).toBe(2);
        expect(fetch).toHaveBeenCalledTimes(2);
      });

      it("should create an issue note", async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockNoteData),
          headers: new Map(),
        });
        await gitlab.issues.notes.create(projectId, issueIid, mockNoteData);
        expect(fetch).toHaveBeenCalledWith(
          `${mockHost}/api/v4/projects/${projectId}/issues/${issueIid}/notes`,
          {
            method: "POST",
            headers: {
              "PRIVATE-TOKEN": mockToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(mockNoteData),
          },
        );
      });

      it("should update an issue note", async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockUpdatedNoteData),
          headers: new Map(),
        });
        await gitlab.issues.notes.update(
          projectId,
          issueIid,
          noteId,
          mockUpdatedNoteData,
        );
        expect(fetch).toHaveBeenCalledWith(
          `${mockHost}/api/v4/projects/${projectId}/issues/${issueIid}/notes/${noteId}`,
          {
            method: "PUT",
            headers: {
              "PRIVATE-TOKEN": mockToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(mockUpdatedNoteData),
          },
        );
      });

      it("should delete an issue note", async () => {
        fetch.mockResolvedValue({ ok: true, status: 204, headers: new Map() });
        const result = await gitlab.issues.notes.delete(
          projectId,
          issueIid,
          noteId,
        );
        expect(result.data).toBeNull();
        expect(fetch).toHaveBeenCalledWith(
          `${mockHost}/api/v4/projects/${projectId}/issues/${issueIid}/notes/${noteId}`,
          {
            method: "DELETE",
            headers: {
              "PRIVATE-TOKEN": mockToken,
              "Content-Type": "application/json",
            },
          },
        );
      });
    });
  });

  describe("pipelines", () => {
    const projectId = 1515;
    const pipelineId = 1616;
    const mockPipelineData = { id: pipelineId, ref: "main", status: "success" };
    // const mockJobData = { id: 1717, name: "build" };

    it("should get all pipelines (paginated)", async () => {
      const mockOptions = { per_page: 2, query: {} };

      fetch
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=1");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
            headers: new Map([["X-Total-Pages", "2"]]),
          });
        })
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=2");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 3 }]),
            headers: new Map(),
          });
        });

      const result = await gitlab.pipelines.all(projectId, mockOptions);
      expect(result.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(result.currentPage).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should get a specific pipeline", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPipelineData),
        headers: new Map(),
      });

      const result = await gitlab.pipelines.show(projectId, pipelineId);
      expect(result.data).toEqual(mockPipelineData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/pipelines/${pipelineId}`,
        {
          method: "GET",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should create a pipeline", async () => {
      const ref = "feature-branch";
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1818, ref }),
        headers: new Map(),
      });
      await gitlab.pipelines.create(projectId, ref);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/pipelines`,
        {
          method: "POST",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ref }),
        },
      );
    });

    it("should retry a pipeline", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "success" }),
        headers: new Map(),
      });
      await gitlab.pipelines.retry(projectId, pipelineId);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/pipelines/${pipelineId}/retry`,
        {
          method: "POST",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should cancel a pipeline", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "canceled" }),
        headers: new Map(),
      });
      await gitlab.pipelines.cancel(projectId, pipelineId);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/pipelines/${pipelineId}/cancel`,
        {
          method: "POST",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should get pipeline jobs (paginated)", async () => {
      const mockOptions = { per_page: 2, query: {} };

      fetch
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=1");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
            headers: new Map([["X-Total-Pages", "2"]]),
          });
        })
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=2");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 3 }]),
            headers: new Map(),
          });
        });

      const result = await gitlab.pipelines.jobs(
        projectId,
        pipelineId,
        mockOptions,
      );
      expect(result.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(result.currentPage).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("jobs", () => {
    const projectId = 1313;
    const jobId = 1414;
    const mockJobData = { id: jobId, name: "Test Job" };
    const mockArtifactsData = { filename: "artifact.zip", size: 12345 }; // Example artifacts data
    const mockTraceData = "This is the job trace.";

    it("should get a specific job", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockJobData),
        headers: new Map(),
      });

      const result = await gitlab.jobs.show(projectId, jobId);
      expect(result.data).toEqual(mockJobData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/jobs/${jobId}`,
        {
          method: "GET",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should get job artifacts", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockArtifactsData),
        headers: new Map(),
      });

      const result = await gitlab.jobs.artifacts(projectId, jobId);
      expect(result.data).toEqual(mockArtifactsData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/jobs/${jobId}/artifacts`,
        {
          method: "GET",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should get job trace", async () => {
      fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockTraceData),
        headers: new Map(),
      });

      const result = await gitlab.jobs.trace(projectId, jobId);
      expect(result.data).toEqual(mockTraceData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/jobs/${jobId}/trace`,
        {
          method: "GET",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should retry a job", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "success" }),
        headers: new Map(),
      });
      await gitlab.jobs.retry(projectId, jobId);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/jobs/${jobId}/retry`,
        {
          method: "POST",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should cancel a job", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "canceled" }),
        headers: new Map(),
      });
      await gitlab.jobs.cancel(projectId, jobId);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/jobs/${jobId}/cancel`,
        {
          method: "POST",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });
  });
  describe("commits", () => {
    const projectId = 1212;
    const commitSha = "a1b2c3d4";
    const mockCommitData = { id: commitSha, title: "Test Commit" };
    const mockDiffData =
      "diff --git a/file1.txt b/file1.txt\nindex 123..456 100644\n--- a/file1.txt\n+++ b/file1.txt\n@@ -1 +1 @@\n-old line\n+new line";
    const mockCommentData = [{ id: 1, body: "Test comment" }];

    it("should get a specific commit", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCommitData),
        headers: new Map(),
      });

      const result = await gitlab.commits.show(projectId, commitSha);
      expect(result.data).toEqual(mockCommitData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/repository/commits/${commitSha}`,
        {
          method: "GET",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should get all commits (paginated)", async () => {
      const mockOptions = { per_page: 2, query: {} };

      fetch
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=1");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: "commit1" }, { id: "commit2" }]),
            headers: new Map([["X-Total-Pages", "2"]]),
          });
        })
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=2");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: "commit3" }]),
            headers: new Map(),
          });
        });

      const result = await gitlab.commits.commits(projectId, mockOptions);
      expect(result.items).toEqual([
        { id: "commit1" },
        { id: "commit2" },
        { id: "commit3" },
      ]);
      expect(result.currentPage).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should get the diff of a commit", async () => {
      fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockDiffData),
        headers: new Map(),
      });

      const result = await gitlab.commits.diff(projectId, commitSha);
      expect(result.data).toEqual(mockDiffData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/repository/commits/${commitSha}/diff`,
        {
          method: "GET",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should get the comments of a commit", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCommentData),
        headers: new Map(),
      });

      const result = await gitlab.commits.comments(projectId, commitSha);
      expect(result.data).toEqual(mockCommentData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/repository/commits/${commitSha}/comments`,
        {
          method: "GET",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });
  });
  describe("projectsVariables", () => {
    const projectId = 777;
    const variableKey = "MY_VARIABLE";
    const mockVariableData = { key: variableKey, value: "my_value" };
    const mockUpdatedVariableData = { value: "new_value" };

    it("should get all project variables (paginated)", async () => {
      const mockOptions = { per_page: 2, query: {} };

      fetch
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=1");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ key: "VAR1" }, { key: "VAR2" }]),
            headers: new Map([["X-Total-Pages", "2"]]),
          });
        })
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=2");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ key: "VAR3" }]),
            headers: new Map(),
          });
        });

      const result = await gitlab.projectsVariables.all(projectId, mockOptions);
      expect(result.items).toEqual([
        { key: "VAR1" },
        { key: "VAR2" },
        { key: "VAR3" },
      ]);
      expect(result.currentPage).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should get a specific project variable", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockVariableData),
        headers: new Map(),
      });

      const result = await gitlab.projectsVariables.show(
        projectId,
        variableKey,
      );
      expect(result.data).toEqual(mockVariableData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/variables/${variableKey}`,
        {
          method: "GET",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should create a project variable", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockVariableData),
        headers: new Map(),
      });
      await gitlab.projectsVariables.create(projectId, mockVariableData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/variables`,
        {
          method: "POST",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockVariableData),
        },
      );
    });

    it("should update a project variable", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUpdatedVariableData),
        headers: new Map(),
      });
      await gitlab.projectsVariables.update(
        projectId,
        variableKey,
        mockUpdatedVariableData,
      );
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/variables/${variableKey}`,
        {
          method: "PUT",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockUpdatedVariableData),
        },
      );
    });

    it("should remove a project variable", async () => {
      fetch.mockResolvedValue({ ok: true, status: 204, headers: new Map() });
      const result = await gitlab.projectsVariables.remove(
        projectId,
        variableKey,
      );
      expect(result.data).toBeNull();
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/variables/${variableKey}`,
        {
          method: "DELETE",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });
  });
  describe("deployments", () => {
    const projectId = 444;
    const deploymentId = 555;
    const mockDeploymentData = {
      environment: "production",
      sha: "abcdef123456",
    };
    const mockUpdatedDeploymentData = { environment: "staging" };

    it("should get all deployments (paginated)", async () => {
      const mockOptions = { per_page: 2, query: {} };

      fetch
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=1");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
            headers: new Map([["X-Total-Pages", "2"]]),
          });
        })
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=2");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 3 }]),
            headers: new Map(),
          });
        });

      const result = await gitlab.deployments.all(projectId, mockOptions);
      expect(result.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(result.currentPage).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should get a specific deployment", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ id: deploymentId, environment: "production" }),
        headers: new Map(),
      });

      const result = await gitlab.deployments.show(projectId, deploymentId);
      expect(result.data).toEqual({
        id: deploymentId,
        environment: "production",
      });
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/deployments/${deploymentId}`,
        {
          method: "GET",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should create a deployment", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDeploymentData),
        headers: new Map(),
      });
      await gitlab.deployments.create(projectId, mockDeploymentData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/deployments`,
        {
          method: "POST",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockDeploymentData),
        },
      );
    });

    it("should update a deployment", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUpdatedDeploymentData),
        headers: new Map(),
      });
      await gitlab.deployments.update(
        projectId,
        deploymentId,
        mockUpdatedDeploymentData,
      );
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/deployments/${deploymentId}`,
        {
          method: "PUT",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockUpdatedDeploymentData),
        },
      );
    });

    it("should delete a deployment", async () => {
      fetch.mockResolvedValue({ ok: true, status: 204, headers: new Map() });
      const result = await gitlab.deployments.delete(projectId, deploymentId);
      expect(result.data).toBeNull();
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/deployments/${deploymentId}`,
        {
          method: "DELETE",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });
  });

  describe("environments", () => {
    const projectId = 111;
    const environmentId = 222;
    const mockEnvironmentData = { name: "production" };
    const mockUpdatedEnvironmentData = { name: "staging" };

    it("should get all environments (paginated)", async () => {
      const mockOptions = { per_page: 2, query: {} };

      fetch
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=1");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
            headers: new Map([["X-Total-Pages", "2"]]),
          });
        })
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=2");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 3 }]),
            headers: new Map(),
          });
        });

      const result = await gitlab.environments.all(projectId, mockOptions);
      expect(result.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(result.currentPage).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should get a specific environment", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: environmentId, name: "production" }),
        headers: new Map(),
      });

      const result = await gitlab.environments.show(projectId, environmentId);
      expect(result.data).toEqual({ id: environmentId, name: "production" });
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/environments/${environmentId}`,
        {
          method: "GET",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should create an environment", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEnvironmentData),
        headers: new Map(),
      });
      await gitlab.environments.create(projectId, mockEnvironmentData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/environments`,
        {
          method: "POST",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockEnvironmentData),
        },
      );
    });

    it("should update an environment", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUpdatedEnvironmentData),
        headers: new Map(),
      });
      await gitlab.environments.update(
        projectId,
        environmentId,
        mockUpdatedEnvironmentData,
      );
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/environments/${environmentId}`,
        {
          method: "PUT",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockUpdatedEnvironmentData),
        },
      );
    });

    it("should delete an environment", async () => {
      fetch.mockResolvedValue({ ok: true, status: 204, headers: new Map() });
      const result = await gitlab.environments.delete(projectId, environmentId);
      expect(result.data).toBeNull();
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/environments/${environmentId}`,
        {
          method: "DELETE",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });
  });

  describe("members", () => {
    const projectId = 987;
    const userId = 654;
    const mockMemberData = { user_id: userId, access_level: 30 }; // Example member data
    const mockUpdatedMemberData = { access_level: 40 };

    it("should get all project members (paginated)", async () => {
      const mockOptions = { per_page: 2, query: {} };

      fetch
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=1");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
            headers: new Map([["X-Total-Pages", "2"]]),
          });
        })
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=2");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 3 }]),
            headers: new Map(),
          });
        });

      const result = await gitlab.members.all(projectId, mockOptions);
      expect(result.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(result.currentPage).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should get a project member by ID", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: userId, name: "Test User" }),
        headers: new Map(),
      });

      const result = await gitlab.members.show(projectId, userId);
      expect(result.data).toEqual({ id: userId, name: "Test User" });
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/members/${userId}`,
        {
          method: "GET",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should create a project member", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMemberData),
        headers: new Map(),
      });
      await gitlab.members.create(projectId, mockMemberData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/members`,
        {
          method: "POST",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockMemberData),
        },
      );
    });

    it("should update a project member", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUpdatedMemberData),
        headers: new Map(),
      });
      await gitlab.members.update(projectId, userId, mockUpdatedMemberData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/members/${userId}`,
        {
          method: "PUT",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockUpdatedMemberData),
        },
      );
    });

    it("should delete a project member", async () => {
      fetch.mockResolvedValue({ ok: true, status: 204, headers: new Map() });
      const result = await gitlab.members.delete(projectId, userId);
      expect(result.data).toBeNull();
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/projects/${projectId}/members/${userId}`,
        {
          method: "DELETE",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });
  });

  describe("groupsMembers", () => {
    const groupId = 123;
    const userId = 456;
    const mockMemberData = { user_id: userId, access_level: 30 }; // Example member data
    const mockUpdatedMemberData = { access_level: 40 };
    it("should get all group members (paginated)", async () => {
      const mockOptions = { per_page: 2, query: {} };

      fetch
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=1");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
            headers: new Map([["X-Total-Pages", "2"]]),
          });
        })
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("page=2");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 3 }]),
            headers: new Map(),
          });
        });

      const result = await gitlab.groupsMembers.all(groupId, mockOptions);
      expect(result.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(result.currentPage).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should get a group member by ID", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: userId, name: "Test User" }),
        headers: new Map(),
      });

      const result = await gitlab.groupsMembers.show(groupId, userId);
      expect(result.data).toEqual({ id: userId, name: "Test User" });
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/groups/${groupId}/members/${userId}`,
        {
          method: "GET",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should create a group member", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMemberData),
        headers: new Map(),
      });
      await gitlab.groupsMembers.create(groupId, mockMemberData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/groups/${groupId}/members`,
        {
          method: "POST",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockMemberData),
        },
      );
    });

    it("should update a group member", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUpdatedMemberData),
        headers: new Map(),
      });
      await gitlab.groupsMembers.update(groupId, userId, mockUpdatedMemberData);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/groups/${groupId}/members/${userId}`,
        {
          method: "PUT",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mockUpdatedMemberData),
        },
      );
    });

    it("should delete a group member", async () => {
      fetch.mockResolvedValue({ ok: true, status: 204, headers: new Map() });
      const result = await gitlab.groupsMembers.delete(groupId, userId);
      expect(result.data).toBeNull();
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/groups/${groupId}/members/${userId}`,
        {
          method: "DELETE",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });
  });

  describe("search", () => {
    it("should search projects", async () => {
      const query = "my-project";
      const mockOptions = { per_page: 2, query: { custom_param: "value" } }; // Include custom query params
      fetch
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("scope=projects");
          expect(url).toContain(`search=${encodeURIComponent(query)}`);
          expect(url).toContain("page=1");
          expect(url).toContain("per_page=2");
          expect(url).toContain("custom_param=value");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
            headers: new Map([["X-Total-Pages", "2"]]),
          });
        })
        .mockImplementationOnce(async (url) => {
          expect(url).toContain("scope=projects");
          expect(url).toContain(`search=${encodeURIComponent(query)}`);
          expect(url).toContain("page=2");
          expect(url).toContain("per_page=2");
          expect(url).toContain("custom_param=value");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 3 }]),
            headers: new Map(),
          });
        });

      const result = await gitlab.search.projects(query, mockOptions);
      expect(result.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(result.currentPage).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    // TODO: TBC
    /* it('should search groups', async () => {
      const query = 'my-group';
      const mockOptions = { per_page: 1 };
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ id: 4, name: 'My Group' }]),
        headers: new Map(),
      });

      const result = await gitlab.search.groups(query, mockOptions);
      expect(result.data).toEqual([{ id: 4, name: 'My Group' }]);
      expect(fetch).toHaveBeenCalledWith(`${mockHost}/api/v4/search?scope=groups&search=${encodeURIComponent(query)}&per_page=1`, {
        method: 'GET',
        headers: { 'PRIVATE-TOKEN': mockToken, 'Content-Type': 'application/json' },
      });
    }); */

    it("should search users", async () => {
      const query = "testuser";
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ id: 5, username: "testuser1" }]),
        headers: new Map(),
      });

      const result = await gitlab.search.users(query);
      expect(result.items).toEqual([{ id: 5, username: "testuser1" }]);
      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/search?scope=users&search=${encodeURIComponent(query)}&page=1&per_page=100`,
        {
          method: "GET",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });

    it("should handle special characters in search query", async () => {
      const query = "test/with/slashes";
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
        headers: new Map(),
      });

      await gitlab.search.projects(query);

      expect(fetch).toHaveBeenCalledWith(
        `${mockHost}/api/v4/search?scope=projects&search=${encodeURIComponent(query)}&page=1&per_page=100`,
        {
          method: "GET",
          headers: {
            "PRIVATE-TOKEN": mockToken,
            "Content-Type": "application/json",
          },
        },
      );
    });
  });
});
