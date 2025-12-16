// DXMT Mirror API Client and Data Models

export interface DXMTBuild {
  artifact_count: number;
  created_at: string; // ISO 8601
  has_wow64: boolean;
  // Release-only fields
  tag?: string;
  // CI build-only fields
  commit_sha?: string;
  github_run_id?: number;
  description?: string;
}

export interface DXMTBuildsListResponse {
  builds: DXMTBuild[];
  total: number;
  page: number;
  page_size: number;
}

export interface DXMTVersionOption {
  id: string; // tag like "v0.71.0" OR stringified run_id like "12345678"
  label: string; // formatted display text
  build: DXMTBuild;
}

export class DXMTMirrorClient {
  private baseUrl = "https://dxmt.riverfog7.com";

  async listBuilds(page = 1, pageSize = 100): Promise<DXMTBuildsListResponse> {
    const url = `${this.baseUrl}/builds/list?page=${page}&page_size=${pageSize}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch builds: ${response.status} ${response.statusText}`
      );
    }
    return response.json();
  }
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString();
}

export function transformBuildsToOptions(builds: DXMTBuild[]): {
  releases: DXMTVersionOption[];
  ciBuilds: DXMTVersionOption[];
} {
  const releases: DXMTVersionOption[] = [];
  const ciBuilds: DXMTVersionOption[] = [];

  builds.forEach(build => {
    // Determine if it's a release by presence of tag field
    if (build.tag) {
      const date = formatDate(build.created_at);
      releases.push({
        id: build.tag,
        label: `${build.tag} - ${date}`,
        build,
      });
    } else if (build.github_run_id) {
      // CI build
      const shortSha = build.commit_sha?.substring(0, 7) || "unknown";
      const date = formatDate(build.created_at);
      const desc = build.description || "CI Build";
      ciBuilds.push({
        id: String(build.github_run_id),
        label: `${desc} (${shortSha}) - ${date}`,
        build,
      });
    }
  });

  // Sort both by date descending (newest first)
  releases.sort(
    (a, b) =>
      new Date(b.build.created_at).getTime() -
      new Date(a.build.created_at).getTime()
  );
  ciBuilds.sort(
    (a, b) =>
      new Date(b.build.created_at).getTime() -
      new Date(a.build.created_at).getTime()
  );

  return { releases, ciBuilds };
}
