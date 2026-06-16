const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ASSET_DIR = path.join(ROOT, "assets");
const USER = process.env.GITHUB_REPOSITORY_OWNER || "xyls999";

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const truncate = (value, length) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
};

const repoUrl = (name) => `https://github.com/${USER}/${name}`;

async function getJson(url) {
  const headers = {
    "User-Agent": "xyls999-profile-builder",
    Accept: "application/vnd.github+json",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function loadData() {
  const [user, repos, events] = await Promise.all([
    getJson(`https://api.github.com/users/${USER}`),
    getJson(`https://api.github.com/users/${USER}/repos?per_page=100&sort=updated`),
    getJson(`https://api.github.com/users/${USER}/events/public?per_page=40`),
  ]);
  return { user, repos, events };
}

function style() {
  return `
    <style>
      .ui{font-family:Segoe UI,Arial,sans-serif}
      .mono{font-family:Consolas,Monaco,monospace}
      .title{fill:#F2B35D;font:800 30px Segoe UI,Arial,sans-serif}
      .muted{fill:#8B949E;font:14px Consolas,Monaco,monospace}
      .body{fill:#F5F2E8;font:15px Segoe UI,Arial,sans-serif}
      .small{fill:#F5F2E8;font:12px Consolas,Monaco,monospace}
      .cyan{fill:#7DCFFF}.gold{fill:#F2B35D}.ember{fill:#F7768E}
    </style>`;
}

function frame(width, height) {
  return `
  <rect width="${width}" height="${height}" rx="16" fill="#0D1117"/>
  <rect x="22" y="22" width="${width - 44}" height="${height - 44}" rx="14" fill="#101826" stroke="#214E68"/>`;
}

function languageCounts(repos) {
  const counts = new Map();
  for (const repo of repos) {
    const key = repo.language || "Docs";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
}

function projectType(repo) {
  const name = repo.name.toLowerCase();
  const text = `${repo.name} ${repo.description || ""}`.toLowerCase();
  if (text.includes("agent") || text.includes("workflow") || text.includes("skill") || text.includes("bot")) return "AGENT";
  if (text.includes("ros") || text.includes("robot") || text.includes("mcp") || text.includes("harmony")) return "DEVICE";
  if (text.includes("os") || text.includes("linux") || name.includes("hhuos")) return "SYSTEM";
  if (repo.language === "Java" || text.includes("spring") || text.includes("backend")) return "BACKEND";
  if (repo.language === "Vue" || repo.language === "JavaScript" || text.includes("web") || text.includes("page")) return "FRONTEND";
  return "QUEST";
}

function pickProjects(repos) {
  const wanted = [
    "A2-AgentLinux",
    "roscar-first",
    "roscar-second",
    "cs-review",
    "xyls-smartgroup-clash",
    "java-zhizelab-backend-xyls",
    "web-zhizelabwithbackend-xyls",
    "zhize-lab-blog",
    "app-wechat-page",
    "wechat-manage",
    "robot-frie",
    "gitpageview",
  ];
  const byName = new Map(repos.map((repo) => [repo.name, repo]));
  return wanted.map((name) => byName.get(name)).filter(Boolean).slice(0, 8);
}

function pickRadar(repos, events) {
  const names = new Set([
    "LangBot",
    "WorkFlowX",
    "HarmonyOS-mcp-server",
    "lineage-skill",
    "hhuOS",
    "qodo-cover",
    "MetaGPT",
    "ChatGLM2-6B",
  ]);
  for (const event of events) {
    const repoName = event.repo?.name?.split("/").pop();
    if (repoName) names.add(repoName);
  }
  const byName = new Map(repos.map((repo) => [repo.name, repo]));
  return [...names].map((name) => byName.get(name)).filter(Boolean).slice(0, 8);
}

function writeActivityDashboard({ user, repos }) {
  const owned = repos.filter((repo) => !repo.fork);
  const forks = repos.filter((repo) => repo.fork);
  const stars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const lang = languageCounts(repos);
  const updated = repos
    .slice()
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0]?.updated_at?.slice(0, 10);
  const bars = lang
    .map(([name, count], index) => {
      const w = Math.max(36, Math.round((count / lang[0][1]) * 210));
      const y = 112 + index * 28;
      const color = ["#7DCFFF", "#F2B35D", "#F7768E", "#78DCE8", "#A9DC76", "#AB9DF2"][index] || "#7DCFFF";
      return `<text x="760" y="${y + 15}" class="small">${esc(name)}</text><rect x="860" y="${y}" width="${w}" height="16" rx="8" fill="${color}" opacity=".86"/><text x="${874 + w}" y="${y + 13}" class="small">${count}</text>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="330" viewBox="0 0 1200 330" role="img" aria-labelledby="title desc">
  <title id="title">Activity dashboard</title>
  <desc id="desc">Live profile summary generated from GitHub public data.</desc>
  ${style()}
  ${frame(1200, 330)}
  <text x="54" y="70" class="title">Activity Dashboard</text>
  <text x="54" y="98" class="muted">self-generated from GitHub API :: no external stats card failure mode</text>
  <g transform="translate(54 130)">
    ${statBox(0, "PUBLIC REPOS", user.public_repos, "#7DCFFF")}
    ${statBox(210, "ORIGINAL", owned.length, "#F2B35D")}
    ${statBox(420, "FORKED RESEARCH", forks.length, "#F7768E")}
    ${statBox(0, "FOLLOWERS", user.followers, "#7DCFFF", 92)}
    ${statBox(210, "STARS", stars, "#F2B35D", 92)}
    ${statBox(420, "LAST UPDATE", updated || "online", "#F7768E", 92)}
  </g>
  <text x="760" y="94" class="muted">language radar</text>
  ${bars}
  <path d="M692 82V274" stroke="#214E68"/>
</svg>`;
  fs.writeFileSync(path.join(ASSET_DIR, "activity-dashboard.svg"), svg);
}

function statBox(x, label, value, color, y = 0) {
  return `<g transform="translate(${x} ${y})">
    <rect width="176" height="68" rx="12" fill="#0D1117" stroke="#214E68"/>
    <text x="18" y="25" class="small" fill="#8B949E">${esc(label)}</text>
    <text x="18" y="52" class="mono" font-size="24" font-weight="800" fill="${color}">${esc(value)}</text>
  </g>`;
}

function writeProjectCompendium({ repos }) {
  const projects = pickProjects(repos);
  const cards = projects
    .map((repo, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 54 + col * 546;
      const y = 112 + row * 118;
      const type = projectType(repo);
      const color = type === "DEVICE" ? "#7DCFFF" : type === "BACKEND" ? "#F2B35D" : type === "FRONTEND" ? "#A9DC76" : type === "SYSTEM" ? "#AB9DF2" : type === "AGENT" ? "#F7768E" : "#78DCE8";
      return `<a href="${repoUrl(repo.name)}">
        <g transform="translate(${x} ${y})">
          <rect width="492" height="92" rx="14" fill="#0D1117" stroke="#214E68"/>
          <rect x="18" y="18" width="78" height="24" rx="12" fill="${color}" opacity=".22" stroke="${color}" stroke-opacity=".75"/>
          <text x="34" y="35" class="small" fill="${color}">${type}</text>
          <text x="112" y="36" class="mono" font-size="18" font-weight="800" fill="#F5F2E8">${esc(repo.name)}</text>
          <text x="112" y="61" class="body">${esc(truncate(repo.description || repo.language || "active quest", 54))}</text>
          <text x="18" y="74" class="small" fill="#8B949E">${esc(repo.language || "mixed")} · ★ ${repo.stargazers_count} · ${repo.updated_at.slice(0, 10)}</text>
        </g>
      </a>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="620" viewBox="0 0 1200 620" role="img" aria-labelledby="title desc">
  <title id="title">Project compendium</title>
  <desc id="desc">Clickable RPG-style project cards for xyls999 repositories.</desc>
  ${style()}
  ${frame(1200, 620)}
  <text x="54" y="70" class="title">Project Compendium</text>
  <text x="54" y="98" class="muted">original quests surfaced from public repositories :: click a card to open the repo</text>
  ${cards}
</svg>`;
  fs.writeFileSync(path.join(ASSET_DIR, "project-compendium.svg"), svg);
}

function writeResearchRadar({ repos, events }) {
  const radar = pickRadar(repos, events);
  const rows = radar
    .map((repo, i) => {
      const x = 68 + (i % 4) * 272;
      const y = 124 + Math.floor(i / 4) * 96;
      const type = projectType(repo);
      return `<a href="${repo.html_url}">
        <g transform="translate(${x} ${y})">
          <rect width="238" height="70" rx="12" fill="#0D1117" stroke="#214E68"/>
          <text x="16" y="27" class="mono" font-size="15" font-weight="800" fill="#7DCFFF">${esc(truncate(repo.name, 22))}</text>
          <text x="16" y="48" class="small" fill="#F2B35D">${type} · ${repo.fork ? "forked research" : "local"}</text>
          <text x="16" y="63" class="small" fill="#8B949E">★ ${repo.stargazers_count} · ${repo.updated_at.slice(0, 10)}</text>
        </g>
      </a>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="340" viewBox="0 0 1200 340" role="img" aria-labelledby="title desc">
  <title id="title">Research radar</title>
  <desc id="desc">A radar of recently explored public projects and forked references.</desc>
  ${style()}
  ${frame(1200, 340)}
  <text x="54" y="70" class="title">Research Radar</text>
  <text x="54" y="98" class="muted">projects being studied, forked, or used as reference material</text>
  ${rows}
</svg>`;
  fs.writeFileSync(path.join(ASSET_DIR, "research-radar.svg"), svg);
}

function writeSystemLoop() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="310" viewBox="0 0 1200 310" role="img" aria-labelledby="title desc">
  <title id="title">System loop</title>
  <desc id="desc">A stable SVG replacement for Mermaid system loop.</desc>
  ${style()}
  ${frame(1200, 310)}
  <text x="54" y="70" class="title">System Loop</text>
  <text x="54" y="98" class="muted">intent → plan → tool → trace → test → artifact → return</text>
  ${["Intent", "Plan", "Tool / MCP", "Trace", "Test", "Artifact", "Return"].map((label, i) => {
    const x = 74 + i * 151;
    const y = 158 + (i % 2) * 30;
    const color = ["#7DCFFF", "#F2B35D", "#F7768E"][i % 3];
    return `<g transform="translate(${x} ${y})">
      <circle cx="36" cy="36" r="34" fill="#0D1117" stroke="${color}" stroke-width="3"/>
      <text x="36" y="41" text-anchor="middle" class="small" fill="#F5F2E8">${esc(label)}</text>
    </g>`;
  }).join("")}
  <path d="M146 195 C245 123 312 251 412 185 S584 146 684 203 S842 243 946 184 S1050 132 1110 192" fill="none" stroke="#214E68" stroke-width="3"/>
  <path d="M1065 178 1110 192 1078 225" fill="none" stroke="#F2B35D" stroke-width="3"/>
</svg>`;
  fs.writeFileSync(path.join(ASSET_DIR, "system-loop.svg"), svg);
}

async function main() {
  fs.mkdirSync(ASSET_DIR, { recursive: true });
  const data = await loadData();
  writeActivityDashboard(data);
  writeProjectCompendium(data);
  writeResearchRadar(data);
  writeSystemLoop();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
