import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Camera,
  CheckCircle2,
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
import { isSupabaseConfigured, proofBucket, supabase } from "./lib/supabase";
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

function App() {
  const [selectedTeamId, setSelectedTeamId] = useState<TeamId>(getInitialTeam);
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
  const [adminPin, setAdminPin] = useState(
    () => window.localStorage.getItem(adminPinKey) ?? "",
  );
  const [adminMessage, setAdminMessage] = useState("");

  const isAdminRoute = window.location.pathname.startsWith("/admin");
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? teams[0];

  const loadSubmissions = async () => {
    setIsRefreshing(true);
    setNotice("");

    if (!isSupabaseConfigured || !supabase) {
      setSubmissions(fallbackSubmissions());
      setIsRefreshing(false);
      return;
    }

    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setNotice(`Could not load submissions: ${error.message}`);
    } else {
      setSubmissions(data ?? []);
    }

    setIsRefreshing(false);
  };

  useEffect(() => {
    void loadSubmissions();

    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    const channel = supabase
      .channel("birthday-race-submissions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submissions" },
        () => void loadSubmissions(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
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

    setIsSubmitting(true);
    setNotice("");

    try {
      let proofUrl: string | null = null;
      let proofType: string | null = proofFile?.type ?? null;

      if (isSupabaseConfigured && supabase && proofFile) {
        const path = `${selectedTeamId}/${activeChallenge.id}/${Date.now()}-${safeFileName(
          proofFile.name,
        )}`;
        const { error: uploadError } = await supabase.storage
          .from(proofBucket)
          .upload(path, proofFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data } = supabase.storage.from(proofBucket).getPublicUrl(path);
        proofUrl = data.publicUrl;
      }

      const submission: Omit<Submission, "id" | "created_at"> = {
        team_id: selectedTeamId,
        challenge_id: activeChallenge.id,
        participant_name: participantName.trim(),
        caption: caption.trim() || null,
        proof_url: proofUrl,
        proof_type: proofType,
        status: "approved",
      };

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("submissions").insert(submission);
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

      setNotice(`${activeChallenge.title} is complete for ${selectedTeam.name}!`);
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
        selectedTeam={selectedTeam}
        participantName={participantName}
        onCopyInvite={copyInvite}
      />

      {!isSupabaseConfigured && (
        <aside className="setup-banner">
          <Sparkles size={18} />
          Demo mode is active because Supabase env vars are missing. Deploy with the values in
          <code>.env.example</code> to make progress shared and live.
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
                <h2>{selectedTeam.name}'s challenge board</h2>
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
                    onClick={() => setActiveChallenge(challenge)}
                  >
                    <span className="challenge-icon">{challenge.icon}</span>
                    <span className="challenge-title">{challenge.title}</span>
                    <span className="challenge-description">{challenge.description}</span>
                    {completed && (
                      <span className="complete-ribbon">
                        <CheckCircle2 size={16} />
                        Claimed
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
          selectedTeam={selectedTeam}
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
  selectedTeam,
  participantName,
  onCopyInvite,
}: {
  selectedTeam: Team;
  participantName: string;
  onCopyInvite: (teamId: TeamId) => Promise<void>;
}) {
  return (
    <header className="hero">
      <div className="hero-copy">
        <p className="eyebrow">
          <PartyPopper size={18} />
          Birthday weekend showdown
        </p>
        <h1>Team P vs Team K: the ultimate birthday race</h1>
        <p>
          Pick a side, complete silly challenges, upload proof, and move your twin toward
          the finish line before Sunday night.
        </p>
        {participantName && (
          <div className="player-pill">
            Playing as <strong>{participantName}</strong> for <strong>{selectedTeam.name}</strong>
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
        <h2>Join the weekend game</h2>
        <p>Use your real name, nickname, or team alias. No account required.</p>
      </div>
      <form onSubmit={onSubmit}>
        <label>
          Your name
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
          Join the race
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
          <p className="eyebrow">Live race tracker</p>
          <h2>Every completed square moves the team forward</h2>
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
              {isLeader && <span className="leader-badge">Current leader</span>}
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
      <p className="eyebrow">Team boards</p>
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
                    {completed} of {totalChallenges} challenges complete
                  </p>
                </div>
              </div>
              <div className="team-card-actions">
                <button onClick={() => setSelectedTeamId(team.id)}>View board</button>
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
      <p className="eyebrow">Latest proof</p>
      <div className="feed">
        {submissions.length === 0 ? (
          <div className="empty-feed">
            <Camera size={28} />
            <p>No proof yet. First team to submit gets bragging rights.</p>
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
        <p className="eyebrow">{selectedTeam.name} submission</p>
        <h2>{activeChallenge.title}</h2>
        <p>{activeChallenge.description}</p>
        <form onSubmit={submitProof}>
          <label className="upload-box">
            <Upload size={24} />
            <span>{proofFile ? proofFile.name : "Upload photo or video proof"}</span>
            <input
              accept="image/*,video/*"
              onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
          <label>
            Caption or note
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Tell us what happened..."
            />
          </label>
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Submitting..." : "Submit proof"}
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
