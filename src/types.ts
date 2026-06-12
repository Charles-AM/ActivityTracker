export type TeamId = "team-p" | "team-k";

export type Team = {
  id: TeamId;
  name: string;
  shortName: string;
  twinName: string;
  favoriteColor: string;
  color: string;
  accent: string;
  emoji: string;
};

export type Challenge = {
  id: string;
  title: string;
  description: string;
  icon: string;
};

export type SubmissionStatus = "approved" | "rejected";

export type Submission = {
  id: string;
  team_id: TeamId;
  challenge_id: string;
  participant_name: string;
  caption: string | null;
  proof_url: string | null;
  proof_type: string | null;
  status: SubmissionStatus;
  created_at: string;
};

export type CompletedMap = Record<TeamId, Set<string>>;
