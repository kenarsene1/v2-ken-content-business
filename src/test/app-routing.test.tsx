import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it('matches the profile-specific ideas page', () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes('/ideas').at(-1)?.routeId).toBe('/_authenticated/ideas');
  });
  it("matches the challenges page", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes("/challenges").at(-1)?.routeId).toBe("/_authenticated/challenges");
  });
  it("matches the focus workspace and the pipeline board", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes("/pipeline").at(-1)?.routeId).toBe("/_authenticated/pipeline/");
    expect(router.matchRoutes("/pipeline/board").at(-1)?.routeId).toBe("/_authenticated/pipeline/board");
  });
  it("matches the library page", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes("/library").at(-1)?.routeId).toBe("/_authenticated/library");
  });
  it("matches the connected calendar page", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes("/calendar").at(-1)?.routeId).toBe("/_authenticated/calendar");
  });
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
});
