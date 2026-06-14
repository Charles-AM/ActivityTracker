import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Camera,
  Clipboard,
  Flag,
  PartyPopper,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Upload,
} from "lucide-react";
import { challenges, teams, totalChallenges } from "./lib/gameData";
import {
  isSupabaseConfigured,
  proofBucket,
  supabase,
  supabaseConfigError,
} from "./lib/supabase";
import type { Challenge, Submission, Team, TeamId } from "./types";
import "./styles.css";

const lastUsedNameKey = "birthday-race-last-name";
const participantTeamKey = "birthday-race-participant-team";
const demoSubmissionKey = "birthday-race-demo-submissions";
const adminPinKey = "birthday-race-admin-pin";

const fallbackSubmissions = (): Submission[] => {
  try {
    const saved = window.localStorage.getItem(demoSubmissionKey);
    return saved ? (JSON.parse(saved) as Submission[]) : [];
  } catch {
    return [];
  }
};

const saveFallbackSubmissions = (submissions: Submission[]) => {
  window.localStorage.setItem(demoSubmissionKey, JSON.stringify(submissions));
};

const getTeamFromPath = (): TeamId | null => {
  if (window.location.pathname.includes("team-p")) {
    return "team-p";
  }

  if (window.location.pathname.includes("team-k")) {
    return "team-k";
  }

  return null;
};

const getInitialTeam = (): TeamId => {
  const teamFromPath = getTeamFromPath();
  if (teamFromPath) {
    return teamFromPath;
  }

  const stored = window.localStorage.getItem(participantTeamKey);
  return stored === "team-k" ? "team-k" : "team-p";
};

const formatDate = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));

const safeFileName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");

function App() {
  const [selectedTeamId, setSelectedTeamId] = useState<TeamId>(getInitialTeam);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [submissionName, setSubmissionName] = useState(
    () => window.localStorage.getItem(lastUsedNameKey) ?? "",
  );
  const [submissionTeamId, setSubmissionTeamId] = useState<TeamId>(getInitialTeam);
  const [caption, setCaption] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [adminPin, setAdminPin] = useState(
    () => window.localStorage.getItem(adminPinKey) ?? "",
  );
  const [adminMessage, setAdminMessage] = useState("");

  const [inviteTeamId] = useState<TeamId | null>(getTeamFromPath);
  const inviteTeam = inviteTeamId
    ? (teams.find((team) => team.id === inviteTeamId) ?? null)
    : null;

  const isAdminRoute = window.location.pathname.startsWith("/admin");
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? teams[0];
  const submissionTeam = teams.find((team) => team.id === submissionTeamId) ?? selectedTeam;

  const openChallenge = (challenge: Challenge) => {
    const legacyName = window.localStorage.getItem("birthday-race-participant-name");
    const lastName =
      window.localStorage.getItem(lastUsedNameKey) ?? legacyName ?? "";
    if (legacyName && !window.localStorage.getItem(lastUsedNameKey)) {
      window.localStorage.setItem(lastUsedNameKey, legacyName);
      window.localStorage.removeItem("birthday-race-participant-name");
    }
    setSubmissionName(lastName);
    setSubmissionTeamId(selectedTeamId);
    setCaption("");
    setProofFile(null);
    setActiveChallenge(challenge);
  };

  const loadSubmissions = async () => {
    setIsRefreshing(true);
    setNotice("");
    const client = supabase;

    if (!isSupabaseConfigured || !client) {
      setSubmissions(fallbackSubmissions());
      setIsRefreshing(false);
      return;
    }

    const { data, error } = await client
      .from("submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      const setupHint = error.message.toLowerCase().includes("invalid path")
        ? " Check VITE_SUPABASE_URL in Netlify. It should be the Project URL only, like https://your-project-id.supabase.co."
        : "";
      setNotice(`Could not load submissions: ${error.message}.${setupHint}`);
    } else {
      setSubmissions((data ?? []) as Submission[]);
    }

    setIsRefreshing(false);
  };

  useEffect(() => {
    void loadSubmissions();
    const client = supabase;

    if (!isSupabaseConfigured || !client) {
      return;
    }

    const channel = client
      .channel("birthday-race-submissions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submissions" },
        () => void loadSubmissions(),
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, []);

  const approvedSubmissions = useMemo(
    () => submissions.filter((submission) => submission.status === "approved"),
    [submissions],
  );

  const completedByTeam = useMemo(() => {
    const completed: Record<TeamId, Set<string>> = {
      "team-p": new Set<string>(),
      "team-k": new Set<string>(),
    };

    approvedSubmissions.forEach((submission) => {
      completed[submission.team_id].add(submission.challenge_id);
    });

    return completed;
  }, [approvedSubmissions]);

  const latestFeed = approvedSubmissions.slice(0, 8);

  const copyInvite = async (teamId: TeamId) => {
    const url = `${window.location.origin}/join/${teamId}`;
    await navigator.clipboard.writeText(url);
    setNotice(`Copied invite link for ${teams.find((team) => team.id === teamId)?.name}.`);
  };

  const submitProof = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeChallenge) {
      return;
    }

    const cleanName = submissionName.trim();

    if (!cleanName) {
      setNotice("Add the name of whoever completed this challenge.");
      return;
    }

    if (!proofFile && !caption.trim()) {
      setNotice("Add a photo, video, or note as proof before submitting.");
      return;
    }

    setIsSubmitting(true);
    setNotice("");
    const client = supabase;

    try {
      let proofUrl: string | null = null;
      let proofType: string | null = proofFile?.type ?? null;

      if (isSupabaseConfigured && client && proofFile) {
        const path = `${submissionTeamId}/${activeChallenge.id}/${Date.now()}-${safeFileName(
          proofFile.name,
        )}`;
        const { error: uploadError } = await client.storage
          .from(proofBucket)
          .upload(path, proofFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data } = client.storage.from(proofBucket).getPublicUrl(path);
        proofUrl = data.publicUrl;
      }

      window.localStorage.setItem(lastUsedNameKey, cleanName);

      const submission: Omit<Submission, "id" | "created_at"> = {
        team_id: submissionTeamId,
        challenge_id: activeChallenge.id,
        participant_name: cleanName,
        caption: caption.trim() || null,
        proof_url: proofUrl,
        proof_type: proofType,
        status: "approved",
      };

      if (isSupabaseConfigured && client) {
        const { error } = await client.from("submissions").insert(submission);
        if (error) {
          throw error;
        }
      } else {
        const demoSubmission: Submission = {
          ...submission,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
        };
        const nextSubmissions = [demoSubmission, ...fallbackSubmissions()];
        saveFallbackSubmissions(nextSubmissions);
        setSubmissions(nextSubmissions);
      }

      setNotice(`${activeChallenge.title} scored for ${submissionTeam.name} by ${cleanName}!`);
      setCaption("");
      setProofFile(null);
      setActiveChallenge(null);
      void loadSubmissions();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not submit proof.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const runAdminAction = async (submissionId: string, action: "approve" | "reject" | "delete") => {
    setAdminMessage("");

    if (!adminPin.trim()) {
      setAdminMessage("Enter the host PIN first.");
      return;
    }

    if (!isSupabaseConfigured) {
      if (action === "delete") {
        const nextSubmissions = fallbackSubmissions().filter(
          (submission) => submission.id !== submissionId,
        );
        saveFallbackSubmissions(nextSubmissions);
        setSubmissions(nextSubmissions);
        setAdminMessage("Deleted from demo storage.");
      }
      return;
    }

    const response = await fetch("/.netlify/functions/admin-submissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pin: adminPin,
        action,
        submissionId,
      }),
    });

    const result = (await response.json()) as { error?: string; message?: string };

    if (!response.ok) {
      setAdminMessage(result.error ?? "Admin action failed.");
      return;
    }

    window.localStorage.setItem(adminPinKey, adminPin);
    setAdminMessage(result.message ?? "Updated submission.");
    void loadSubmissions();
  };

  const clearAllSubmissions = async () => {
    setAdminMessage("");

    if (!adminPin.trim()) {
      setAdminMessage("Enter the host PIN first.");
      return;
    }

    const confirmed = window.confirm(
      "Clear every submission and reset the scoreboard? This cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    if (!isSupabaseConfigured) {
      saveFallbackSubmissions([]);
      setSubmissions([]);
      setAdminMessage("Cleared all demo submissions.");
      return;
    }

    const response = await fetch("/.netlify/functions/admin-submissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pin: adminPin,
        action: "clear-all",
      }),
    });

    const result = (await response.json()) as { error?: string; message?: string };

    if (!response.ok) {
      setAdminMessage(result.error ?? "Could not clear submissions.");
      return;
    }

    window.localStorage.setItem(adminPinKey, adminPin);
    setAdminMessage(result.message ?? "Cleared all submissions.");
    void loadSubmissions();
  };

  if (isAdminRoute) {
    return (
      <AdminView
        adminMessage={adminMessage}
        adminPin={adminPin}
        setAdminPin={setAdminPin}
        submissions={submissions}
        onAction={runAdminAction}
        onClearAll={() => void clearAllSubmissions()}
        onRefresh={loadSubmissions}
      />
    );
  }

  return (
    <main className="app-shell">
      <Hero inviteTeam={inviteTeam} onCopyInvite={copyInvite} />

      {!isSupabaseConfigured && (
        <aside className="setup-banner">
          <Sparkles size={18} />
          Demo mode is active because Supabase env vars are missing. Deploy with the values in
          <code>.env.example</code> to make progress shared and live.
          {supabaseConfigError && ` ${supabaseConfigError}.`}
        </aside>
      )}

      {notice && <aside className="notice">{notice}</aside>}

      <RaceTrack completedByTeam={completedByTeam} />

      <section className="dashboard-grid">
        <TeamPanel
          completedByTeam={completedByTeam}
          selectedTeamId={selectedTeamId}
          setSelectedTeamId={setSelectedTeamId}
          onCopyInvite={copyInvite}
        />
        <Feed submissions={latestFeed} />
      </section>

      <section className="board-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Weekend bingo board</p>
            <h2>{selectedTeam.name} board</h2>
            <p className="board-progress">
              {completedByTeam[selectedTeamId].size}/{totalChallenges} claimed
            </p>
          </div>
          <button className="ghost-button" onClick={() => void loadSubmissions()}>
            <RefreshCw size={16} className={isRefreshing ? "spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="bingo-board">
          {challenges.map((challenge) => {
            const completed = completedByTeam[selectedTeamId].has(challenge.id);
            return (
              <button
                className={`challenge-card ${completed ? "complete" : ""}`}
                key={challenge.id}
                onClick={() => openChallenge(challenge)}
              >
                <span className="challenge-title">{challenge.title}</span>
                {completed && <span className="complete-ribbon">Done</span>}
              </button>
            );
          })}
        </div>
      </section>

      {activeChallenge && (
        <SubmissionModal
          activeChallenge={activeChallenge}
          caption={caption}
          isSubmitting={isSubmitting}
          proofFile={proofFile}
          selectedTeam={submissionTeam}
          submissionName={submissionName}
          submissionTeamId={submissionTeamId}
          setActiveChallenge={setActiveChallenge}
          setCaption={setCaption}
          setProofFile={setProofFile}
          setSubmissionName={setSubmissionName}
          setSubmissionTeamId={setSubmissionTeamId}
          submitProof={submitProof}
        />
      )}
    </main>
  );
}

function Hero({
  inviteTeam,
  onCopyInvite,
}: {
  inviteTeam: Team | null;
  onCopyInvite: (teamId: TeamId) => Promise<void>;
}) {
  return (
    <header className="hero">
      <div className="confetti confetti-one" />
      <div className="confetti confetti-two" />
      <div className="confetti confetti-three" />
      <div className="hero-copy">
        <p className="eyebrow">
          <PartyPopper size={18} />
          Birthday race
        </p>
        <h1>Team P vs Team K</h1>
        <p>
          Pick a side, complete challenges, upload proof, and move your team toward the finish
          line.
        </p>
        <div className="hero-tagline">
          <div className="player-pill">Which team will come out on top</div>
          {inviteTeam && (
            <p
              className="hero-team-name"
              style={{ "--team-color": inviteTeam.color } as React.CSSProperties}
            >
              {inviteTeam.name}
            </p>
          )}
        </div>
      </div>
      <div className="invite-card">
        <div className="invite-card-top">
          <Trophy size={28} />
          <span>Invite links</span>
        </div>
        <button onClick={() => onCopyInvite("team-p")}>
          <Clipboard size={16} />
          Copy Team P link
        </button>
        <button onClick={() => onCopyInvite("team-k")}>
          <Clipboard size={16} />
          Copy Team K link
        </button>
      </div>
    </header>
  );
}

function SubmissionModal({
  activeChallenge,
  caption,
  isSubmitting,
  proofFile,
  selectedTeam,
  submissionName,
  submissionTeamId,
  setActiveChallenge,
  setCaption,
  setProofFile,
  setSubmissionName,
  setSubmissionTeamId,
  submitProof,
}: {
  activeChallenge: Challenge;
  caption: string;
  isSubmitting: boolean;
  proofFile: File | null;
  selectedTeam: Team;
  submissionName: string;
  submissionTeamId: TeamId;
  setActiveChallenge: (challenge: Challenge | null) => void;
  setCaption: (caption: string) => void;
  setProofFile: (file: File | null) => void;
  setSubmissionName: (name: string) => void;
  setSubmissionTeamId: (team: TeamId) => void;
  submitProof: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card" role="dialog" aria-modal="true">
        <button className="close-button" onClick={() => setActiveChallenge(null)}>
          Close
        </button>
        <p className="eyebrow">{selectedTeam.name} claim</p>
        <h2>{activeChallenge.title}</h2>
        <form onSubmit={submitProof}>
          <label>
            Who completed this?
            <input
              autoFocus
              value={submissionName}
              onChange={(event) => setSubmissionName(event.target.value)}
              placeholder="Type your name or nickname"
            />
          </label>
          <div className="submission-team-picker">
            <span className="submission-team-label">Team</span>
            <div className="team-picker compact">
              {teams.map((team) => (
                <button
                  className={submissionTeamId === team.id ? "selected" : ""}
                  key={team.id}
                  onClick={() => setSubmissionTeamId(team.id)}
                  style={{ "--team-color": team.color } as React.CSSProperties}
                  type="button"
                >
                  {team.name}
                </button>
              ))}
            </div>
          </div>
          <label className="upload-box">
            <Upload size={24} />
            <span>{proofFile ? proofFile.name : "Drop photo/video proof"}</span>
            <input
              accept="image/*,video/*"
              onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
          <label>
            Caption
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Quick note..."
            />
          </label>
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Scoring..." : "Score this square"}
          </button>
        </form>
      </section>
    </div>
  );
}

function RaceTrack({ completedByTeam }: { completedByTeam: Record<TeamId, Set<string>> }) {
  const leaderScore = Math.max(...teams.map((team) => completedByTeam[team.id].size));

  return (
    <section className="race-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Team tracker</p>
          <h2>Progress to the finish line</h2>
        </div>
        <Flag className="finish-flag" size={34} />
      </div>
      <div className="tracks">
        {teams.map((team) => {
          const score = completedByTeam[team.id].size;
          const progress = Math.round((score / totalChallenges) * 100);
          const isLeader = score === leaderScore && score > 0;

          return (
            <div className="track-row" key={team.id}>
              <div className="track-label">
                <span className="team-dot" style={{ background: team.color }} />
                <strong>{team.name}</strong>
                <span className="track-score">
                  {score}/{totalChallenges} claimed
                </span>
              </div>
              <div className="track-line">
                <div
                  className="track-progress"
                  style={
                    {
                      width: `${progress}%`,
                      "--team-color": team.color,
                    } as React.CSSProperties
                  }
                />
                <span className="runner" style={{ left: `calc(${progress}% - 18px)` }}>
                  <span className="team-badge small" style={{ background: team.color }}>
                    {team.shortName}
                  </span>
                </span>
                <span className="finish">Finish</span>
              </div>
              <div className="track-footer">
                <span>{progress}% complete</span>
                {isLeader && <span className="leader-badge">Leading</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TeamPanel({
  completedByTeam,
  selectedTeamId,
  setSelectedTeamId,
  onCopyInvite,
}: {
  completedByTeam: Record<TeamId, Set<string>>;
  selectedTeamId: TeamId;
  setSelectedTeamId: (team: TeamId) => void;
  onCopyInvite: (team: TeamId) => Promise<void>;
}) {
  return (
    <section className="panel">
      <p className="eyebrow">Scoreboard</p>
      <div className="team-cards">
        {teams.map((team) => {
          const completed = completedByTeam[team.id].size;
          return (
            <article
              className={`team-card ${selectedTeamId === team.id ? "active" : ""}`}
              key={team.id}
              style={{ "--team-color": team.color, "--team-accent": team.accent } as React.CSSProperties}
            >
              <div className="team-card-main">
                <span className="team-badge" style={{ background: team.color }}>
                  {team.shortName}
                </span>
                <div>
                  <h3>{team.name}</h3>
                  <p>
                    {completed}/{totalChallenges} claimed
                  </p>
                </div>
              </div>
              <div className="team-card-actions">
                <button onClick={() => setSelectedTeamId(team.id)}>View</button>
                <button onClick={() => onCopyInvite(team.id)}>Invite</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Feed({ submissions }: { submissions: Submission[] }) {
  return (
    <section className="panel">
      <p className="eyebrow">Proof feed</p>
      <div className="feed">
        {submissions.length === 0 ? (
          <div className="empty-feed">
            <Camera size={28} />
            <p>No proof yet. Go first.</p>
          </div>
        ) : (
          submissions.map((submission) => {
            const team = teams.find((item) => item.id === submission.team_id);
            const challenge = challenges.find((item) => item.id === submission.challenge_id);

            return (
              <article className="feed-item" key={submission.id}>
                {submission.proof_url ? (
                  submission.proof_type?.startsWith("video") ? (
                    <video src={submission.proof_url} muted controls />
                  ) : (
                    <img src={submission.proof_url} alt={challenge?.title ?? "Challenge proof"} />
                  )
                ) : (
                  <div className="proof-placeholder">Proof</div>
                )}
                <div>
                  <strong>{challenge?.title ?? "Challenge"}</strong>
                  <p>
                    {team?.name} by {submission.participant_name}
                  </p>
                  {submission.caption && <p className="caption">"{submission.caption}"</p>}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function AdminView({
  adminMessage,
  adminPin,
  setAdminPin,
  submissions,
  onAction,
  onClearAll,
  onRefresh,
}: {
  adminMessage: string;
  adminPin: string;
  setAdminPin: (pin: string) => void;
  submissions: Submission[];
  onAction: (submissionId: string, action: "approve" | "reject" | "delete") => Promise<void>;
  onClearAll: () => void;
  onRefresh: () => Promise<void>;
}) {
  const recentSubmissions = submissions.slice(0, 10);

  return (
    <main className="app-shell admin-shell">
      <header className="admin-hero">
        <ShieldCheck size={38} />
        <div>
          <p className="eyebrow">Host tools</p>
          <h1>Submission control room</h1>
          <p>Review proof, reject accidental entries, or remove anything that should not be public.</p>
        </div>
      </header>

      {!isSupabaseConfigured && (
        <aside className="setup-banner">
          Demo mode admin can delete submissions locally or clear all demo data.
        </aside>
      )}

      <section className="admin-controls">
        <label>
          Host PIN
          <input
            type="password"
            value={adminPin}
            onChange={(event) => setAdminPin(event.target.value)}
            placeholder="Enter ADMIN_PIN"
          />
        </label>
        <button className="ghost-button" onClick={() => void onRefresh()}>
          <RefreshCw size={16} />
          Refresh
        </button>
        <button
          className="danger-button admin-clear-all"
          disabled={submissions.length === 0}
          onClick={onClearAll}
          type="button"
        >
          Clear all submissions
        </button>
        <a className="ghost-link" href="/">
          Back to game
        </a>
      </section>

      {adminMessage && <aside className="notice">{adminMessage}</aside>}

      {recentSubmissions.length > 0 && (
        <section className="admin-recent">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Latest activity</p>
              <h2>Most recent submissions</h2>
            </div>
          </div>
          <div className="admin-recent-list">
            {recentSubmissions.map((submission) => {
              const team = teams.find((item) => item.id === submission.team_id);
              const challenge = challenges.find((item) => item.id === submission.challenge_id);

              return (
                <article className="admin-recent-item" key={`recent-${submission.id}`}>
                  <div className="admin-recent-main">
                    <strong className="admin-recent-name">{submission.participant_name}</strong>
                    <span className={`status-pill ${submission.status}`}>{submission.status}</span>
                  </div>
                  <p>
                    {challenge?.title ?? "Challenge"} · {team?.emoji} {team?.name}
                  </p>
                  <p className="admin-recent-time">{formatDate(submission.created_at)}</p>
                  <div className="admin-actions compact">
                    <button onClick={() => void onAction(submission.id, "approve")}>Approve</button>
                    <button onClick={() => void onAction(submission.id, "reject")}>Reject</button>
                    <button
                      className="danger-button"
                      onClick={() => void onAction(submission.id, "delete")}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="admin-list">
        <div className="section-heading">
          <div>
            <p className="eyebrow">All submissions</p>
            <h2>Full review list</h2>
          </div>
        </div>
        {submissions.map((submission) => {
          const team = teams.find((item) => item.id === submission.team_id);
          const challenge = challenges.find((item) => item.id === submission.challenge_id);

          return (
            <article className="admin-item" key={submission.id}>
              {submission.proof_url ? (
                submission.proof_type?.startsWith("video") ? (
                  <video src={submission.proof_url} controls />
                ) : (
                  <img src={submission.proof_url} alt={challenge?.title ?? "Challenge proof"} />
                )
              ) : (
                <div className="proof-placeholder">{challenge?.icon ?? "✨"}</div>
              )}
              <div>
                <span className={`status-pill ${submission.status}`}>{submission.status}</span>
                <h3>{challenge?.title ?? "Challenge"}</h3>
                <p className="admin-participant-name">{submission.participant_name}</p>
                <p>
                  {team?.emoji} {team?.name} on {formatDate(submission.created_at)}
                </p>
                {submission.caption && <p className="caption">"{submission.caption}"</p>}
                <div className="admin-actions">
                  <button onClick={() => void onAction(submission.id, "approve")}>Approve</button>
                  <button onClick={() => void onAction(submission.id, "reject")}>Reject</button>
                  <button className="danger-button" onClick={() => void onAction(submission.id, "delete")}>
                    Delete
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

export default App;
