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
    title: "Run a 5k/3 mile",
    description: "",
    icon: "",
  },
  {
    id: "fond-memory",
    title: "Share a fond memory you have of the birthday girl",
    description: "",
    icon: "",
  },
  {
    id: "ted-talk",
    title: "1 minute TED talk about a topic you are passionate about",
    description: "",
    icon: "",
  },
  {
    id: "happy-birthday-song",
    title: 'Have you and a friend sing "happy birthday" to the birthday girls',
    description: "",
    icon: "",
  },
  {
    id: "three-shots",
    title: "Take 3 shots",
    description: "",
    icon: "",
  },
  {
    id: "favorite-color",
    title: "Wear something out in the birthday girls' favourite colour",
    description: "",
    icon: "",
  },
  {
    id: "pushups-27",
    title: "Do 27 push ups",
    description: "",
    icon: "",
  },
  {
    id: "advice-next-year",
    title: "Leave advice for the next year",
    description: "",
    icon: "",
  },
  {
    id: "bake-cake",
    title: "Bake a cake",
    description: "",
    icon: "",
  },
  {
    id: "origami",
    title: "Complete an origami",
    description: "",
    icon: "",
  },
  {
    id: "same-birthday",
    title: "Find someone who shares the birthday girls' birthday",
    description: "",
    icon: "",
  },
  {
    id: "toast-language",
    title: "Make a toast to the birthday girls in a different language than English",
    description: "",
    icon: "",
  },
  {
    id: "picture-dog",
    title: "Take a picture with a dog",
    description: "",
    icon: "",
  },
  {
    id: "other-twins",
    title: "Share a picture with another set of twins",
    description: "",
    icon: "",
  },
  {
    id: "throwback",
    title: "Throwback of you and the birthday girl",
    description: "",
    icon: "",
  },
  {
    id: "other-color",
    title: "Take a picture with someone wearing the other twin's favourite colour",
    description: "",
    icon: "",
  },
];

export const totalChallenges = challenges.length;
