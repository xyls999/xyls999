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

function writeStatusStrip({ user, repos }) {
  const owned = repos.filter((repo) => !repo.fork);
  const stars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const updated = repos
    .slice()
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0]?.updated_at?.slice(0, 10);
  const slots = [
    ["REPOS", user.public_repos, "#7DCFFF"],
    ["FOLLOWERS", user.followers, "#F7768E"],
    ["ORIGINAL", owned.length, "#F2B35D"],
    ["STARS", stars, "#A9DC76"],
  ];
  const strip = slots
    .map(
      ([label, value, color], index) => `
      <g transform="translate(${24 + index * 170} 9)">
        <circle cx="14" cy="14" r="10" fill="${color}" opacity=".18" stroke="${color}"/>
        <text x="36" y="11" class="label">${esc(label)}</text>
        <text x="36" y="29" class="value">${esc(value)}</text>
      </g>`
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="46" viewBox="0 0 720 46" role="img" aria-labelledby="title desc">
  <title id="title">Profile status strip</title>
  <desc id="desc">Live repository counters and build state generated from GitHub public data.</desc>
  <defs>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#7DCFFF"/>
      <stop offset="0.48" stop-color="#F2B35D"/>
      <stop offset="1" stop-color="#F7768E"/>
    </linearGradient>
    <style>
      .mono{font-family:Consolas,Monaco,monospace}
      .label{fill:#8B949E;font:11px Consolas,Monaco,monospace;letter-spacing:.8px}
      .value{fill:#F5F2E8;font:700 16px Segoe UI,Arial,sans-serif}
      .stamp{fill:#7DCFFF;font:11px Consolas,Monaco,monospace}
    </style>
  </defs>
  <rect width="720" height="46" rx="14" fill="#0D1117"/>
  <rect x="1" y="1" width="718" height="44" rx="13" fill="#101826" stroke="#214E68"/>
  <path d="M16 40H704" stroke="url(#glow)" stroke-width="2" opacity=".8">
    <animate attributeName="opacity" values=".35;.85;.35" dur="4.5s" repeatCount="indefinite"/>
  </path>
  ${strip}
  <text x="610" y="30" text-anchor="end" class="stamp">LIVE ${esc(updated || "SYNC")}</text>
</svg>`;
  fs.writeFileSync(path.join(ASSET_DIR, "status-strip.svg"), svg);
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

function pickSignalEvents(events) {
  const wanted = new Set([
    "PushEvent",
    "CreateEvent",
    "PullRequestEvent",
    "IssuesEvent",
    "ReleaseEvent",
    "ForkEvent",
    "PublicEvent",
  ]);
  return events
    .filter((event) => wanted.has(event.type))
    .slice(0, 6);
}

function shortEventLabel(event) {
  if (event.type === "PushEvent") return "PUSH";
  if (event.type === "CreateEvent") return `CREATE ${event.payload?.ref_type || ""}`.trim();
  if (event.type === "PullRequestEvent") return `PR ${event.payload?.action || ""}`.trim();
  if (event.type === "IssuesEvent") return `ISSUE ${event.payload?.action || ""}`.trim();
  if (event.type === "ReleaseEvent") return "RELEASE";
  if (event.type === "ForkEvent") return "FORK";
  if (event.type === "PublicEvent") return "PUBLIC";
  return event.type.replace(/([A-Z])/g, " $1").trim().toUpperCase();
}

function eventHue(event) {
  if (event.type === "PushEvent") return "#7DCFFF";
  if (event.type === "PullRequestEvent") return "#F7768E";
  if (event.type === "ReleaseEvent") return "#F2B35D";
  if (event.type === "IssuesEvent") return "#A9DC76";
  if (event.type === "CreateEvent") return "#AB9DF2";
  return "#78DCE8";
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

function writeSignalFeed({ events }) {
  const selected = pickSignalEvents(events);
  const rows = selected.length
    ? selected
        .map((event, i) => {
          const repo = event.repo?.name?.split("/").pop() || "unknown";
          const time = new Date(event.created_at).toISOString().slice(11, 16);
          const label = shortEventLabel(event);
          const color = eventHue(event);
          const y = 132 + i * 34;
          return `<g transform="translate(54 ${y})">
            <circle cx="10" cy="10" r="6" fill="${color}">
              <animate attributeName="r" values="5;7;5" dur="2.4s" repeatCount="indefinite" begin="${i * 0.25}s"/>
            </circle>
            <rect x="26" y="0" width="1080" height="24" rx="10" fill="#0D1117" stroke="#214E68"/>
            <text x="44" y="16" class="mono" font-size="12" fill="${color}">${esc(label)}</text>
            <text x="156" y="16" class="mono" font-size="12" fill="#F5F2E8">${esc(truncate(repo, 42))}</text>
            <text x="972" y="16" class="mono" font-size="12" fill="#8B949E">${esc(time)}</text>
          </g>`;
        })
        .join("")
    : `<text x="54" y="150" class="body">No recent public events available yet.</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="360" viewBox="0 0 1200 360" role="img" aria-labelledby="title desc">
  <title id="title">Signal feed</title>
  <desc id="desc">A live public event feed generated from GitHub activity.</desc>
  ${style()}
  ${frame(1200, 360)}
  <text x="54" y="70" class="title">Signal Feed</text>
  <text x="54" y="98" class="muted">fresh public activity :: push, issue, release, fork, and pull-request pulses</text>
  <rect x="54" y="112" width="1094" height="182" rx="14" fill="#0D1117" stroke="#214E68"/>
  <rect x="70" y="126" width="1062" height="2" fill="#7DCFFF" opacity=".16">
    <animate attributeName="y" values="126;278;126" dur="5.8s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values=".1;.55;.1" dur="5.8s" repeatCount="indefinite"/>
  </rect>
  ${rows}
  <path d="M78 262 H1118" stroke="#214E68" opacity=".5"/>
  <text x="78" y="292" class="mono" font-size="13" fill="#7DCFFF">&gt; waiting for next move _</text>
</svg>`;
  fs.writeFileSync(path.join(ASSET_DIR, "signal-feed.svg"), svg);
}

function writeConstellation({ repos }) {
  const projects = pickProjects(repos);
  const points = [
    { x: 170, y: 110, repo: projects[0], r: 16 },
    { x: 360, y: 52, repo: projects[1], r: 15 },
    { x: 560, y: 112, repo: projects[2], r: 18 },
    { x: 740, y: 62, repo: projects[3], r: 15 },
    { x: 920, y: 138, repo: projects[4], r: 16 },
    { x: 600, y: 220, repo: projects[5], r: 17 },
  ].filter((p) => p.repo);
  const center = { x: 600, y: 160 };
  const links = points
    .map((p) => `<path d="M${center.x} ${center.y} L${p.x} ${p.y}" stroke="#214E68" stroke-width="2" opacity=".75"/>`)
    .join("");
  const nodes = points
    .map((p, i) => {
      const color = ["#7DCFFF", "#F2B35D", "#F7768E", "#A9DC76", "#AB9DF2", "#78DCE8"][i];
      return `<g transform="translate(${p.x} ${p.y})">
        <circle r="${p.r + 12}" fill="${color}" opacity=".12">
          <animate attributeName="r" values="${p.r + 10};${p.r + 16};${p.r + 10}" dur="4s" repeatCount="indefinite" begin="${i * 0.3}s"/>
        </circle>
        <circle r="${p.r}" fill="${color}" opacity=".92"/>
        <text x="0" y="34" text-anchor="middle" class="mono" font-size="12" fill="#F5F2E8">${esc(truncate(p.repo.name, 16))}</text>
        <text x="0" y="50" text-anchor="middle" class="mono" font-size="11" fill="#8B949E">★ ${p.repo.stargazers_count}</text>
      </g>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="320" viewBox="0 0 1200 320" role="img" aria-labelledby="title desc">
  <title id="title">Project constellation</title>
  <desc id="desc">A connected constellation of current core repositories.</desc>
  ${style()}
  ${frame(1200, 320)}
  <text x="54" y="70" class="title">Project Constellation</text>
  <text x="54" y="98" class="muted">your core repos as connected stars in the same build graph</text>
  <g opacity=".95">
    ${links}
    <circle cx="${center.x}" cy="${center.y}" r="30" fill="#F2B35D" opacity=".18"/>
    <circle cx="${center.x}" cy="${center.y}" r="18" fill="#F2B35D"/>
    <text x="${center.x}" y="${center.y + 48}" text-anchor="middle" class="mono" font-size="13" fill="#F5F2E8">DOVAKLIN</text>
    ${nodes}
  </g>
</svg>`;
  fs.writeFileSync(path.join(ASSET_DIR, "constellation.svg"), svg);
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
  writeStatusStrip(data);
  writeActivityDashboard(data);
  writeSignalFeed(data);
  writeProjectCompendium(data);
  writeConstellation(data);
  writeResearchRadar(data);
  writeSystemLoop();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
