import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Clock,
  Clipboard,
  Flag,
  Flame,
  PartyPopper,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Upload,
  Zap,
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

const participantNameKey = "birthday-race-participant-name";
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

const getInitialTeam = (): TeamId => {
  if (window.location.pathname.includes("team-p")) {
    return "team-p";
  }

  if (window.location.pathname.includes("team-k")) {
    return "team-k";
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

const getRaceDeadline = () => {
  const deadline = new Date();
  const daysUntilSunday = (7 - deadline.getDay()) % 7;
  deadline.setDate(deadline.getDate() + daysUntilSunday);
  deadline.setHours(23, 59, 59, 999);
  return deadline;
};

const formatTimeLeft = (now: Date) => {
  const remainingMs = getRaceDeadline().getTime() - now.getTime();

  if (remainingMs <= 0) {
    return "Final scores";
  }

  const totalMinutes = Math.ceil(remainingMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h left`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }

  return `${minutes}m left`;
};

function App() {
  const [selectedTeamId, setSelectedTeamId] = useState<TeamId>(getInitialTeam);
  const [playerTeamId, setPlayerTeamId] = useState<TeamId>(getInitialTeam);
  const [participantName, setParticipantName] = useState(
    () => window.localStorage.getItem(participantNameKey) ?? "",
  );
  const [draftName, setDraftName] = useState(participantName);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [caption, setCaption] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [adminPin, setAdminPin] = useState(
    () => window.localStorage.getItem(adminPinKey) ?? "",
  );
  const [adminMessage, setAdminMessage] = useState("");

  const isAdminRoute = window.location.pathname.startsWith("/admin");
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? teams[0];
  const playerTeam = teams.find((team) => team.id === playerTeamId) ?? selectedTeam;

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
  const teamScores = teams.map((team) => ({
    team,
    score: completedByTeam[team.id].size,
  }));
  const leader = teamScores.reduce(
    (currentLeader, challenger) =>
      challenger.score > currentLeader.score ? challenger : currentLeader,
    teamScores[0],
  );
  const totalCompleted = teamScores.reduce((sum, item) => sum + item.score, 0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const joinGame = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = draftName.trim();

    if (!cleanName) {
      setNotice("Add a name or nickname before joining.");
      return;
    }

    window.localStorage.setItem(participantNameKey, cleanName);
    window.localStorage.setItem(participantTeamKey, selectedTeamId);
    setParticipantName(cleanName);
    setPlayerTeamId(selectedTeamId);
    setNotice(`Welcome to ${selectedTeam.name}, ${cleanName}!`);
    window.history.pushState({}, "", "/");
  };

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

    if (!participantName.trim()) {
      setNotice("Join a team before submitting proof.");
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
        const path = `${playerTeamId}/${activeChallenge.id}/${Date.now()}-${safeFileName(
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

      const submission: Omit<Submission, "id" | "created_at"> = {
        team_id: playerTeamId,
        challenge_id: activeChallenge.id,
        participant_name: participantName.trim(),
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

      setNotice(`${activeChallenge.title} is complete for ${playerTeam.name}!`);
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

  if (isAdminRoute) {
    return (
      <AdminView
        adminMessage={adminMessage}
        adminPin={adminPin}
        setAdminPin={setAdminPin}
        submissions={submissions}
        onAction={runAdminAction}
        onRefresh={loadSubmissions}
      />
    );
  }

  return (
    <main className="app-shell">
      <Hero
        leader={leader}
        timeLeft={formatTimeLeft(now)}
        totalCompleted={totalCompleted}
        selectedTeam={playerTeam}
        participantName={participantName}
        onCopyInvite={copyInvite}
      />

      {!isSupabaseConfigured && (
        <aside className="setup-banner">
          <Sparkles size={18} />
          Demo mode is active because Supabase env vars are missing. Deploy with the values in
          <code>.env.example</code> to make progress shared and live.
          {supabaseConfigError && ` ${supabaseConfigError}.`}
        </aside>
      )}

      {notice && <aside className="notice">{notice}</aside>}

      {!participantName ? (
        <JoinCard
          draftName={draftName}
          selectedTeamId={selectedTeamId}
          setDraftName={setDraftName}
          setSelectedTeamId={setSelectedTeamId}
          onSubmit={joinGame}
        />
      ) : (
        <>
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
              {challenges.map((challenge, index) => {
                const completed = completedByTeam[selectedTeamId].has(challenge.id);
                return (
                  <button
                    className={`challenge-card ${completed ? "complete" : ""}`}
                    key={challenge.id}
                    onClick={() => setActiveChallenge(challenge)}
                  >
                    <span className="card-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="challenge-icon">{challenge.icon}</span>
                    <span className="challenge-title">{challenge.title}</span>
                    <span className="challenge-description">{challenge.description}</span>
                    {completed && (
                      <span className="complete-ribbon">
                        <CheckCircle2 size={16} />
                        Done
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}

      {activeChallenge && (
        <SubmissionModal
          activeChallenge={activeChallenge}
          caption={caption}
          isSubmitting={isSubmitting}
          proofFile={proofFile}
          selectedTeam={playerTeam}
          setActiveChallenge={setActiveChallenge}
          setCaption={setCaption}
          setProofFile={setProofFile}
          submitProof={submitProof}
        />
      )}
    </main>
  );
}

function Hero({
  leader,
  timeLeft,
  totalCompleted,
  selectedTeam,
  participantName,
  onCopyInvite,
}: {
  leader: { team: Team; score: number };
  timeLeft: string;
  totalCompleted: number;
  selectedTeam: Team;
  participantName: string;
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
        <div className="hero-stats">
          <span>
            <Flame size={16} />
            {leader.score > 0 ? `${leader.team.name} leads` : "Race open"}
          </span>
          <span>
            <Zap size={16} />
            {totalCompleted} scored
          </span>
          <span>
            <Clock size={16} />
            {timeLeft}
          </span>
        </div>
        {participantName && (
          <div className="player-pill">
            {participantName} / <strong>{selectedTeam.name}</strong>
          </div>
        )}
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

function JoinCard({
  draftName,
  selectedTeamId,
  setDraftName,
  setSelectedTeamId,
  onSubmit,
}: {
  draftName: string;
  selectedTeamId: TeamId;
  setDraftName: (name: string) => void;
  setSelectedTeamId: (team: TeamId) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="join-card">
      <div>
        <p className="eyebrow">Choose your side</p>
        <h2>Pick a team</h2>
        <p>Nickname in. Team selected. Game on.</p>
      </div>
      <form onSubmit={onSubmit}>
        <label>
          Player name
          <input
            autoFocus
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="e.g. Captain Cake"
          />
        </label>
        <div className="team-picker">
          {teams.map((team) => (
            <button
              className={selectedTeamId === team.id ? "selected" : ""}
              key={team.id}
              onClick={() => setSelectedTeamId(team.id)}
              style={{ "--team-color": team.color } as React.CSSProperties}
              type="button"
            >
              <span>{team.emoji}</span>
              {team.name}
            </button>
          ))}
        </div>
        <button className="primary-button" type="submit">
          Start racing
        </button>
      </form>
    </section>
  );
}

function RaceTrack({ completedByTeam }: { completedByTeam: Record<TeamId, Set<string>> }) {
  const leaderScore = Math.max(...teams.map((team) => completedByTeam[team.id].size));

  return (
    <section className="race-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Live race</p>
          <h2>Score a square. Move forward.</h2>
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
                <span>
                  {score}/{totalChallenges}
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
                  {team.emoji}
                </span>
                <span className="finish">🏁</span>
              </div>
              {isLeader && <span className="leader-badge">Leading</span>}
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
                <span className="team-emoji">{team.emoji}</span>
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
                  <div className="proof-placeholder">{challenge?.icon ?? "✨"}</div>
                )}
                <div>
                  <strong>{challenge?.title ?? "Challenge"}</strong>
                  <p>
                    {team?.emoji} {team?.name} by {submission.participant_name}
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

function SubmissionModal({
  activeChallenge,
  caption,
  isSubmitting,
  proofFile,
  selectedTeam,
  setActiveChallenge,
  setCaption,
  setProofFile,
  submitProof,
}: {
  activeChallenge: Challenge;
  caption: string;
  isSubmitting: boolean;
  proofFile: File | null;
  selectedTeam: Team;
  setActiveChallenge: (challenge: Challenge | null) => void;
  setCaption: (caption: string) => void;
  setProofFile: (file: File | null) => void;
  submitProof: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card" role="dialog" aria-modal="true">
        <button className="close-button" onClick={() => setActiveChallenge(null)}>
          Close
        </button>
        <span className="modal-icon">{activeChallenge.icon}</span>
        <p className="eyebrow">{selectedTeam.name} claim</p>
        <h2>{activeChallenge.title}</h2>
        <p>{activeChallenge.description}</p>
        <form onSubmit={submitProof}>
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

function AdminView({
  adminMessage,
  adminPin,
  setAdminPin,
  submissions,
  onAction,
  onRefresh,
}: {
  adminMessage: string;
  adminPin: string;
  setAdminPin: (pin: string) => void;
  submissions: Submission[];
  onAction: (submissionId: string, action: "approve" | "reject" | "delete") => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
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
          Demo mode admin can only delete locally saved submissions.
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
        <a className="ghost-link" href="/">
          Back to game
        </a>
      </section>

      {adminMessage && <aside className="notice">{adminMessage}</aside>}

      <section className="admin-list">
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
                <p>
                  {team?.emoji} {team?.name} by {submission.participant_name} on{" "}
                  {formatDate(submission.created_at)}
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
