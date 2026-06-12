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
    description: "Route, treadmill, or finish selfie.",
    icon: "🏃",
  },
  {
    id: "fond-memory",
    title: "Share a fond memory",
    description: "Sweet, funny, or chaotic.",
    icon: "💌",
  },
  {
    id: "ted-talk",
    title: "1 minute TED talk",
    description: "One topic. Full passion.",
    icon: "🎤",
  },
  {
    id: "happy-birthday-song",
    title: "Sing happy birthday",
    description: "Grab a friend and sing.",
    icon: "🎶",
  },
  {
    id: "three-shots",
    title: "Take 3 shots",
    description: "Team spirit. Stay safe.",
    icon: "🥃",
  },
  {
    id: "favorite-color",
    title: "Wear their favorite color",
    description: "Outfit proof counts.",
    icon: "🌈",
  },
  {
    id: "pushups-27",
    title: "Do 27 push ups",
    description: "Modified counts. Video wins.",
    icon: "💪",
  },
  {
    id: "advice-next-year",
    title: "Leave advice for next year",
    description: "One note for the year ahead.",
    icon: "📝",
  },
  {
    id: "bake-cake",
    title: "Bake a cake",
    description: "Cupcakes and mug cakes count.",
    icon: "🎂",
  },
  {
    id: "origami",
    title: "Complete an origami",
    description: "Cute, weird, or birthday-themed.",
    icon: "🦢",
  },
  {
    id: "same-birthday",
    title: "Find a birthday match",
    description: "Same birthday. Screenshot it.",
    icon: "🔎",
  },
  {
    id: "toast-language",
    title: "Toast in another language",
    description: "Cheers, but not in English.",
    icon: "🥂",
  },
  {
    id: "picture-dog",
    title: "Take a picture with a dog",
    description: "Any good dog counts.",
    icon: "🐶",
  },
  {
    id: "other-twins",
    title: "Picture with another set of twins",
    description: "Twins in the wild.",
    icon: "👯",
  },
  {
    id: "throwback",
    title: "Throwback photo",
    description: "Old photo. Big nostalgia.",
    icon: "📸",
  },
  {
    id: "other-color",
    title: "Other twin's color",
    description: "Find the rival color.",
    icon: "🎨",
  },
];

export const totalChallenges = challenges.length;
