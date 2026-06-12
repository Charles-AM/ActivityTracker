import type { Challenge, Team } from "../types";

export const teams: Team[] = [
  {
    id: "team-p",
    name: "Team P",
    shortName: "P",
    twinName: "Twin P",
    favoriteColor: "pink",
    color: "#ff4fa3",
    accent: "#ffd1e8",
    emoji: "💖",
  },
  {
    id: "team-k",
    name: "Team K",
    shortName: "K",
    twinName: "Twin K",
    favoriteColor: "blue",
    color: "#5577ff",
    accent: "#dbe4ff",
    emoji: "💙",
  },
];

export const challenges: Challenge[] = [
  {
    id: "run-5k",
    title: "Run a 5k / 3 mile",
    description: "Snap your route, treadmill screen, or finish-line selfie.",
    icon: "🏃",
  },
  {
    id: "fond-memory",
    title: "Share a fond memory",
    description: "Post a sweet, funny, or chaotic memory of the birthday girl.",
    icon: "💌",
  },
  {
    id: "ted-talk",
    title: "1 minute TED talk",
    description: "Record a passionate mini-talk about any topic you love.",
    icon: "🎤",
  },
  {
    id: "happy-birthday-song",
    title: "Sing happy birthday",
    description: "You and a friend sing happy birthday to the birthday girls.",
    icon: "🎶",
  },
  {
    id: "three-shots",
    title: "Take 3 shots",
    description: "Party safely and prove your team spirit.",
    icon: "🥃",
  },
  {
    id: "favorite-color",
    title: "Wear their favorite color",
    description: "Wear something in your twin's favorite color.",
    icon: "🌈",
  },
  {
    id: "pushups-27",
    title: "Do 27 push ups",
    description: "Video proof recommended. Modified pushups count.",
    icon: "💪",
  },
  {
    id: "advice-next-year",
    title: "Leave advice for next year",
    description: "Give the birthday girls one piece of wisdom for the year ahead.",
    icon: "📝",
  },
  {
    id: "bake-cake",
    title: "Bake a cake",
    description: "Cupcakes, mug cakes, and team-colored frosting are encouraged.",
    icon: "🎂",
  },
  {
    id: "origami",
    title: "Complete an origami",
    description: "Fold something cute, weird, or birthday-themed.",
    icon: "🦢",
  },
  {
    id: "same-birthday",
    title: "Find a birthday match",
    description: "Find someone who shares the birthday girls' birthday.",
    icon: "🔎",
  },
  {
    id: "toast-language",
    title: "Toast in another language",
    description: "Make a toast to the birthday girls in a language other than English.",
    icon: "🥂",
  },
  {
    id: "picture-dog",
    title: "Take a picture with a dog",
    description: "Any good dog counts. Bonus points spiritually for costumes.",
    icon: "🐶",
  },
  {
    id: "other-twins",
    title: "Picture with another set of twins",
    description: "Find twins in the wild or share a photo with another twin duo.",
    icon: "👯",
  },
  {
    id: "throwback",
    title: "Throwback photo",
    description: "Share a throwback of you and the birthday girl.",
    icon: "📸",
  },
  {
    id: "other-color",
    title: "Other twin's color",
    description: "Take a picture with someone wearing the other twin's favorite color.",
    icon: "🎨",
  },
];

export const totalChallenges = challenges.length;
